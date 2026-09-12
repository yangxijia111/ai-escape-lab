import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/config
 * Tells the frontend whether a real Qwen key is configured —
 * WITHOUT exposing the key itself.
 */
export async function GET() {
  const hasKey = Boolean(process.env.QWEN_API_KEY);
  return NextResponse.json({
    qwenConfigured: hasKey,
    model: hasKey ? process.env.QWEN_MODEL || "qwen-plus" : null,
  });
}
