import type { AgentAction, RunRecord, StepRecord } from "./types";

/** Replay helpers: formatting & run assembly shared by room page, replay page, export. */

export function formatAction(a: AgentAction): string {
  const value = a.value ? ` "${a.value}"` : "";
  return `${a.action} ${a.target}${value}`;
}

export function stepHeadline(s: StepRecord, agentLabel: string): string {
  return `${agentLabel} ${pastTense(s.action.action)} ${s.action.target}${s.action.value ? ` → "${s.action.value}"` : ""}`;
}

function pastTense(a: string): string {
  const map: Record<string, string> = {
    inspect: "inspected",
    interact: "interacted with",
    move: "moved to",
    use_item: "used item on",
    input: "entered input on",
    take: "took",
    combine: "combined",
    submit_answer: "submitted answer to",
  };
  return map[a] ?? a;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Running score contribution is computed at run end; per-step delta tracks usefulness. */
export function scoreDeltaForStep(classification: StepRecord["classification"]): number {
  switch (classification) {
    case "useful":
      return 1;
    case "irrelevant":
      return 0;
    case "repeated":
      return -2;
    case "invalid":
      return -2;
  }
}

export function buildRunSummary(run: RunRecord): string[] {
  const lines: string[] = [];
  lines.push(`Room: ${run.roomTitle}`);
  lines.push(`Model: ${run.model} (${run.agent})`);
  lines.push(`Result: ${run.metrics.success ? "ESCAPED" : "FAILED"}`);
  lines.push(`Score: ${run.score.total} / 100`);
  lines.push(`Actions: ${run.metrics.actions} / ${run.metrics.maxActions}`);
  return lines;
}
