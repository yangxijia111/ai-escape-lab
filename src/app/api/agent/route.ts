import { NextResponse } from "next/server";
import { QwenProvider, qwenConfigFromEnv } from "@/agents/qwen";
import type { AgentContext } from "@/agents/provider";

export const runtime = "nodejs";

/**
 * POST /api/agent
 * Body: AgentContext
 * Returns: { action, formatErrors, model } or { error, fallback: true }
 *
 * The API key never reaches the browser — all Qwen calls happen here.
 */
export async function POST(req: Request) {
  let ctx: AgentContext;
  try {
    ctx = (await req.json()) as AgentContext;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!ctx?.observation || !ctx?.roomId) {
    return NextResponse.json({ error: "Malformed AgentContext." }, { status: 400 });
  }

  const config = qwenConfigFromEnv();
  if (!config) {
    return NextResponse.json(
      {
        error: "QWEN_API_KEY is not configured on the server. Use Demo Mode (MockAgent).",
        fallback: true,
      },
      { status: 503 }
    );
  }

  try {
    const provider = new QwenProvider(config);
    const decision = await provider.generateAction(ctx);
    return NextResponse.json({
      action: decision.action,
      formatErrors: decision.formatErrors,
      usage: decision.usage ?? null,
      model: config.model,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
