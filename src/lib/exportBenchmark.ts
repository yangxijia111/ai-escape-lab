import type { BenchmarkReport, RoomGroupStats, RunRecord } from "@/engine/types";
import { formatAction, formatDuration } from "../engine/replay.ts";

/**
 * Build an OFFICIAL benchmark report.
 * Hard rules:
 *  - only runType === "benchmark" runs are accepted (demo/human → throw)
 *  - all runs must share the same model, promptVersion and benchmarkVersion
 */
export function buildReport(runs: RunRecord[]): BenchmarkReport {
  if (runs.length === 0) {
    throw new Error("Cannot build a benchmark report from zero runs");
  }
  const nonBenchmark = runs.filter((r) => r.runType !== "benchmark");
  if (nonBenchmark.length > 0) {
    throw new Error(
      `Demo/Human runs are not benchmark results and cannot enter an official report (found ${nonBenchmark.length})`
    );
  }
  const uniqueModels = [...new Set(runs.map((r) => r.metadata.model))];
  if (uniqueModels.length > 1) {
    throw new Error(
      `Cannot build one benchmark report from multiple models: ${uniqueModels.join(", ")}`
    );
  }
  const uniquePrompt = [...new Set(runs.map((r) => r.metadata.promptVersion))];
  const uniqueBench = [...new Set(runs.map((r) => r.metadata.benchmarkVersion))];
  if (uniquePrompt.length > 1 || uniqueBench.length > 1) {
    throw new Error("Cannot mix runs from different benchmark/prompt versions in one report");
  }

  const totalRuns = runs.length;
  const successfulRuns = runs.filter((r) => r.metrics.success).length;
  const rooms = new Set(runs.map((r) => r.roomId)).size;
  const totalActions = runs.reduce((a, r) => a + r.metrics.actions, 0);
  const invalid = runs.reduce((a, r) => a + r.metrics.invalidActions, 0);
  const repeated = runs.reduce((a, r) => a + r.metrics.repeatedActions, 0);
  const selfCorr = runs.reduce((a, r) => a + r.metrics.selfCorrections, 0);
  const failureEvents = runs.reduce(
    (a, r) => a + r.steps.filter((s) => !s.response.success || s.response.criticalMistake).length,
    0
  );
  const criticalRuns = runs.filter((r) => r.metrics.criticalMistakes > 0).length;
  const formatErrors = runs.reduce((a, r) => a + r.metrics.formatErrors, 0);
  const scores = runs.map((r) => r.score.total);
  const actions = runs.map((r) => r.metrics.actions);

  const byRoomMap = new Map<string, RoomGroupStats>();
  for (const r of runs) {
    const g = byRoomMap.get(r.roomId) ?? {
      roomId: r.roomId,
      roomTitle: r.roomTitle,
      runs: 0,
      escaped: 0,
      escapeRate: 0,
      meanScore: 0,
      meanActions: 0,
    };
    g.runs += 1;
    if (r.metrics.success) g.escaped += 1;
    byRoomMap.set(r.roomId, g);
  }
  const byRoom = [...byRoomMap.values()].map((g) => {
    const roomRuns = runs.filter((r) => r.roomId === g.roomId);
    return {
      ...g,
      escapeRate: round(g.escaped / g.runs),
      meanScore: round(roomRuns.reduce((a, r) => a + r.score.total, 0) / roomRuns.length),
      meanActions: round(roomRuns.reduce((a, r) => a + r.metrics.actions, 0) / roomRuns.length),
    };
  });

  return {
    benchmark: "AI ESCAPE LAB",
    benchmarkVersion: runs[0].metadata.benchmarkVersion,
    promptVersion: runs[0].metadata.promptVersion,
    provider: runs[0].metadata.provider,
    model: uniqueModels[0],
    timestamp: new Date().toISOString(),
    summary: {
      rooms,
      totalRuns,
      successfulRuns,
      escaped: successfulRuns,
      escape_rate: round(successfulRuns / totalRuns),
      average_score: round(mean(scores)),
      mean_score: round(mean(scores)),
      median_score: round(median(scores)),
      average_actions: round(mean(actions)),
      mean_actions: round(mean(actions)),
      median_actions: round(median(actions)),
      invalid_action_rate: totalActions ? round(invalid / totalActions) : 0,
      repeated_action_rate: totalActions ? round(repeated / totalActions) : 0,
      self_correction_rate: failureEvents ? round(selfCorr / failureEvents) : 0,
      information_efficiency: round(mean(runs.map((r) => r.metrics.informationEfficiency))),
      exploration_efficiency: round(mean(runs.map((r) => r.metrics.explorationEfficiency))),
      critical_mistake_rate: round(criticalRuns / totalRuns),
      format_reliability: round(1 - formatErrors / Math.max(1, totalActions)),
      byRoom,
    },
    runs,
  };
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function round(x: number): number {
  return Math.round(x * 100) / 100;
}
function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

/**
 * Rule-based analysis. All claims are explicitly scoped to this benchmark —
 * no generalized capability statements.
 */
export function analyze(report: BenchmarkReport): { strengths: string[]; weaknesses: string[] } {
  const s = report.summary;
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const scope = "in this benchmark";

  if (s.escape_rate >= 0.8) strengths.push(`Completed ${pct(s.escape_rate)} of tested escape-room runs (${s.successfulRuns}/${s.totalRuns}) ${scope}.`);
  else if (s.escape_rate <= 0.4) weaknesses.push(`Completed only ${pct(s.escape_rate)} of tested escape-room runs (${s.successfulRuns}/${s.totalRuns}) ${scope}.`);
  else weaknesses.push(`Completion was inconsistent ${scope}: ${pct(s.escape_rate)} of runs (${s.successfulRuns}/${s.totalRuns}).`);

  if (s.format_reliability >= 0.95) strengths.push(`Showed high structured-output reliability ${scope} (format reliability ${pct(s.format_reliability)}).`);
  else weaknesses.push(`Structured-output violations required retries ${scope} (format reliability ${pct(s.format_reliability)}).`);

  if (s.self_correction_rate >= 0.6) strengths.push(`The model often recovered after explicit negative environment feedback ${scope} (self-correction rate ${pct(s.self_correction_rate)}).`);
  else if (s.self_correction_rate < 0.3) weaknesses.push(`The model rarely recovered after negative feedback ${scope} (self-correction rate ${pct(s.self_correction_rate)}).`);

  if (s.invalid_action_rate <= 0.05) strengths.push(`Showed low invalid-action rate in this controlled environment (${pct(s.invalid_action_rate)}).`);
  else weaknesses.push(`Elevated invalid-action rate in this controlled environment (${pct(s.invalid_action_rate)}).`);

  if (s.repeated_action_rate <= 0.05) strengths.push(`Rarely repeated proven-ineffective actions ${scope} (${pct(s.repeated_action_rate)}).`);
  else weaknesses.push(`Repeated ineffective actions ${scope} (${pct(s.repeated_action_rate)} of all actions).`);

  if (s.information_efficiency >= 0.6) strengths.push(`Focused exploration on task-relevant objects ${scope} (information efficiency ${pct(s.information_efficiency)}).`);
  else if (s.information_efficiency < 0.35) weaknesses.push(`Exploration was diluted by irrelevant objects ${scope} (information efficiency ${pct(s.information_efficiency)}).`);

  if (s.critical_mistake_rate >= 0.3) weaknesses.push(`Committed critical irreversible mistakes in ${pct(s.critical_mistake_rate)} of runs ${scope}.`);

  // per-room dips
  for (const g of s.byRoom) {
    if (g.runs >= 2 && g.escapeRate <= 0.4) {
      weaknesses.push(`Performance decreased on “${g.roomTitle}” (${g.escaped}/${g.runs} escaped) ${scope}.`);
    }
  }

  if (strengths.length === 0) strengths.push(`Interacted with the environment within the action rules ${scope}; no stronger claim is supported by the data.`);
  return { strengths, weaknesses };
}

export function reportToJSON(report: BenchmarkReport): string {
  return JSON.stringify(report, null, 2);
}

export function reportToMarkdown(report: BenchmarkReport): string {
  const { strengths, weaknesses } = analyze(report);
  const s = report.summary;
  const L: string[] = [];

  L.push("# AI Escape Lab Benchmark Report");
  L.push("");
  L.push(`- Benchmark: **${report.benchmark}**`);
  L.push(`- Benchmark Version: **${report.benchmarkVersion}**`);
  L.push(`- Prompt Version: **${report.promptVersion}**`);
  L.push(`- Model: **${report.model}**`);
  L.push(`- Provider: **${report.provider}**`);
  L.push(`- Run Count: **${s.totalRuns}** (${s.rooms} rooms)`);
  L.push(`- Timestamp: ${report.timestamp}`);
  L.push("");
  L.push("## Overall Result");
  L.push("");
  L.push(`- Escape Rate: **${pct(s.escape_rate)}** (${s.successfulRuns}/${s.totalRuns} runs)`);
  L.push(`- Mean Score: **${s.mean_score} / 100** · Median Score: ${s.median_score}`);
  L.push(`- Mean Actions: ${s.mean_actions} · Median Actions: ${s.median_actions}`);
  L.push(`- Invalid Action Rate: ${pct(s.invalid_action_rate)}`);
  L.push(`- Repeated Action Rate: ${pct(s.repeated_action_rate)}`);
  L.push(`- Self-Correction Rate: ${pct(s.self_correction_rate)}`);
  L.push(`- Information Efficiency: ${pct(s.information_efficiency)}`);
  L.push(`- Exploration Efficiency: ${pct(s.exploration_efficiency)}`);
  L.push(`- Critical Mistake Rate: ${pct(s.critical_mistake_rate)}`);
  L.push(`- Format Reliability: ${pct(s.format_reliability)}`);
  L.push("");
  L.push("## Per-Room Results");
  L.push("");
  L.push("| Room | Escaped | Rate | Mean Score | Mean Actions |");
  L.push("|---|---|---|---|---|");
  for (const g of s.byRoom) {
    L.push(`| ${g.roomTitle} | ${g.escaped} / ${g.runs} | ${pct(g.escapeRate)} | ${g.meanScore} | ${g.meanActions} |`);
  }
  L.push("");
  L.push("## Runs");
  L.push("");
  L.push("| Run | Room | Result | Score | Actions | Invalid | Repeated | Self-Corr | Failure | Time |");
  L.push("|---|---|---|---|---|---|---|---|---|---|");
  for (const run of report.runs) {
    const m = run.metrics;
    L.push(
      `| ${run.runId} | ${run.roomTitle} | ${m.success ? "PASS" : "FAIL"} | ${run.score.total} | ${m.actions}/${m.maxActions} | ${m.invalidActions} | ${m.repeatedActions} | ${m.selfCorrections} | ${run.failure?.primary ?? "—"} | ${formatDuration(m.durationMs)} |`
    );
  }
  L.push("");
  L.push("## Observed Strengths");
  L.push("");
  L.push("_All statements are scoped to this benchmark, these tested rooms, and this controlled environment._");
  L.push("");
  for (const x of strengths) L.push(`- ${x}`);
  L.push("");
  L.push("## Observed Weaknesses");
  L.push("");
  if (weaknesses.length === 0) L.push("- None significant in this sample.");
  for (const x of weaknesses) L.push(`- ${x}`);
  L.push("");

  const failures = report.runs.filter((r) => !r.metrics.success);
  L.push("## Failure Cases");
  L.push("");
  if (failures.length === 0) {
    L.push("No failed runs in this sample.");
  } else {
    for (const run of failures) {
      L.push(`### ${run.roomTitle} · ${run.runId} (score ${run.score.total})`);
      L.push("");
      L.push(`- Primary failure: **${run.failure?.primary ?? "UNCLASSIFIED"}**${run.failure && run.failure.secondary.length ? ` · secondary: ${run.failure.secondary.join(", ")}` : ""}`);
      L.push(`- Critical mistakes: ${run.metrics.criticalMistakes}`);
      L.push(`- Invalid actions: ${run.metrics.invalidActions} · Repeated: ${run.metrics.repeatedActions} · Irrelevant: ${run.metrics.irrelevantActions}`);
      L.push(`- Ended after ${run.metrics.actions}/${run.metrics.maxActions} actions.`);
      L.push("");
    }
  }

  L.push("## Full Trajectory");
  L.push("");
  for (const run of report.runs) {
    L.push(`### ${run.roomTitle} · ${run.runId} — ${run.metrics.success ? "ESCAPED" : "FAILED"} (${run.score.total}/100)`);
    L.push("");
    for (const st of run.steps) {
      L.push(`**Step ${String(st.step).padStart(2, "0")}** — \`${formatAction(st.action)}\``);
      if (st.reason) L.push(`- Rationale: ${st.reason}`);
      L.push(`- Result: ${st.response.success ? "OK" : "FAIL"} — ${st.response.message.replace(/\n/g, " ")}`);
      if (st.stateChanges.length) L.push(`- State: ${st.stateChanges.join("; ")}`);
      L.push("");
    }
  }

  L.push("---");
  L.push(`_AI ESCAPE LAB v${report.benchmarkVersion} — escape-room benchmark for LLM agents. Scores: Success 40 / Action Efficiency 20 / Information Efficiency 15 / Self-Correction 10 / Rule Compliance 10 / Exploration Efficiency 5. Rationale text is never scored._`);
  return L.join("\n");
}

/**
 * CSV export — one row per official benchmark run.
 * Demo/Human runs must be filtered out by the caller (buildReport enforces this).
 */
export function reportToCSV(report: BenchmarkReport): string {
  const header = [
    "run_id", "benchmark_version", "prompt_version", "provider", "model",
    "room_id", "room_title", "success", "score", "actions", "max_actions",
    "useful_actions", "irrelevant_actions", "invalid_actions", "repeated_actions",
    "critical_mistakes", "self_corrections", "format_errors", "duration_ms",
    "information_efficiency", "exploration_efficiency", "primary_failure", "timestamp",
  ];
  const rows = report.runs.map((r) => [
    r.runId, r.metadata.benchmarkVersion, r.metadata.promptVersion, r.metadata.provider, r.metadata.model,
    r.roomId, r.roomTitle, r.metrics.success ? "true" : "false", r.score.total, r.metrics.actions, r.metrics.maxActions,
    r.metrics.usefulActions, r.metrics.irrelevantActions, r.metrics.invalidActions, r.metrics.repeatedActions,
    r.metrics.criticalMistakes, r.metrics.selfCorrections, r.metrics.formatErrors, r.metrics.durationMs,
    r.metrics.informationEfficiency, r.metrics.explorationEfficiency, r.failure?.primary ?? "", new Date(r.timestamp).toISOString(),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Trigger a client-side file download. */
export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
