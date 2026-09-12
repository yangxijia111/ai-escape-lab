import { isAgentAction } from "@/engine/environment";
import type { AgentAction } from "@/engine/types";
import type { AgentContext, AgentDecision, AIProvider, TokenUsage } from "./provider";
import { buildSystemPrompt, buildUserPrompt, QWEN_MAX_TOKENS, QWEN_TEMPERATURE } from "./prompts";

/**
 * QwenProvider — OpenAI-compatible chat completions.
 * SERVER-SIDE ONLY: the API key is read from process.env and never
 * shipped to the browser. The frontend calls /api/agent, which uses
 * this provider.
 */

export interface QwenConfig {
  apiKey: string;
  model: string;
  baseURL: string;
}

export function qwenConfigFromEnv(): QwenConfig | null {
  const apiKey = process.env.QWEN_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    model: process.env.QWEN_MODEL || "qwen-plus",
    baseURL: process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
  };
}

const MAX_FORMAT_RETRIES = 2;

export class QwenProvider implements AIProvider {
  readonly kind = "qwen" as const;
  readonly model: string;
  private config: QwenConfig;

  constructor(config: QwenConfig) {
    this.config = config;
    this.model = config.model;
  }

  async generateAction(ctx: AgentContext): Promise<AgentDecision> {
    let formatErrors = 0;
    const usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildUserPrompt(ctx) },
    ];

    for (let attempt = 0; attempt <= MAX_FORMAT_RETRIES; attempt++) {
      const { text, usage: u } = await this.chat(messages);
      if (u) {
        usage.promptTokens = (usage.promptTokens ?? 0) + (u.promptTokens ?? 0);
        usage.completionTokens = (usage.completionTokens ?? 0) + (u.completionTokens ?? 0);
        usage.totalTokens = (usage.totalTokens ?? 0) + (u.totalTokens ?? 0);
      }
      const parsed = parseAction(text);
      if (parsed) {
        return { action: parsed, formatErrors, usage: u ? usage : undefined };
      }
      formatErrors += 1;
      // Feed the format error back and retry (max 2 retries).
      messages.push({ role: "assistant", content: text });
      messages.push({
        role: "user",
        content:
          "FORMAT ERROR: your last reply was not a single valid JSON action object. Reply again with EXACTLY one JSON object: {\"action\": ..., \"target\": ..., \"value\": ... | null, \"reason\": ...}. No prose, no code fences.",
      });
    }

    // Exhausted retries — return a safe no-op inspection so the run can continue.
    const firstObj = ctx.observation.visible_objects[0];
    return {
      action: {
        action: "inspect",
        target: firstObj?.id ?? ctx.observation.doors[0]?.id ?? "door",
        value: null,
        reason: "Model produced invalid format twice; falling back to a safe inspection.",
      },
      formatErrors,
      usage: usage.totalTokens ? usage : undefined,
    };
  }

  private async chat(
    messages: { role: string; content: string }[]
  ): Promise<{ text: string; usage: TokenUsage | null }> {
    const res = await fetch(`${this.config.baseURL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: QWEN_TEMPERATURE,
        max_tokens: QWEN_MAX_TOKENS,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Qwen API error ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const usage: TokenUsage | null = data.usage
      ? {
          promptTokens: data.usage.prompt_tokens ?? null,
          completionTokens: data.usage.completion_tokens ?? null,
          totalTokens: data.usage.total_tokens ?? null,
        }
      : null;
    return { text: data.choices?.[0]?.message?.content ?? "", usage };
  }
}

/** Extract a valid AgentAction from raw model text (tolerates code fences / prose). */
export function parseAction(text: string): AgentAction | null {
  const candidates: string[] = [];
  // fenced json blocks
  const fence = /```(?:json)?\s*([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = fence.exec(text)) !== null) candidates.push(m[1]);
  candidates.push(text);
  // innermost {...} spans
  const brace = /\{[\s\S]*?\}/g;
  while ((m = brace.exec(text)) !== null) candidates.push(m[0]);

  for (const c of candidates) {
    try {
      const obj = JSON.parse(c.trim());
      if (isAgentAction(obj)) {
        return {
          action: obj.action,
          target: obj.target,
          value: obj.value ?? null,
          reason: obj.reason ?? null,
        };
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}
