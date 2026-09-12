import type { AgentContext, AgentDecision, AIProvider } from "./provider";

/**
 * RemoteQwenProvider — runs in the BROWSER, delegates to /api/agent.
 * The actual Qwen call (and the API key) stay on the server.
 */
export class RemoteQwenProvider implements AIProvider {
  readonly kind = "qwen" as const;
  readonly model: string;

  constructor(model: string) {
    this.model = model;
  }

  async generateAction(ctx: AgentContext): Promise<AgentDecision> {
    const res = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ctx),
    });
    const data = (await res.json()) as {
      action?: AgentDecision["action"];
      formatErrors?: number;
      usage?: AgentDecision["usage"];
      error?: string;
    };
    if (!res.ok || !data.action) {
      throw new Error(data.error ?? `Agent API failed (${res.status})`);
    }
    return { action: data.action, formatErrors: data.formatErrors ?? 0, usage: data.usage };
  }
}
