import type { RunRecord } from "@/engine/types";

const KEY = "ai-escape-lab:runs";

/** localStorage-backed run store. Benchmark dashboard & replay read from here. */

export function loadRuns(): RunRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RunRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveRun(run: RunRecord): void {
  if (typeof window === "undefined") return;
  const runs = loadRuns();
  runs.push(run);
  // keep the most recent 100 runs
  const trimmed = runs.slice(-100);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    // storage full — drop oldest and retry once
    try {
      window.localStorage.setItem(KEY, JSON.stringify(trimmed.slice(-20)));
    } catch {
      /* give up silently */
    }
  }
}

export function getRun(runId: string): RunRecord | undefined {
  return loadRuns().find((r) => r.runId === runId);
}

export function clearRuns(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

export function newRunId(): string {
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
