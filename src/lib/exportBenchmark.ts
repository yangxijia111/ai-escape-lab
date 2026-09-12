import type { BenchmarkReport, RunRecord } from "@/engine/types";
import { formatAction, formatDuration } from "../engine/replay.ts";

/** Build the standard benchmark report object from a set of runs. */
export function buildReport(runs: RunRecord[], model: string): BenchmarkReport {
  const rooms = new Set(runs.map((r) => r.roomId)).size;
  const escaped = runs.filter((r) => r.metrics.success).length;
  const totalActions = runs.reduce((a, r) => a + r.metrics.actions, 0);
  const invalid = runs.reduce((a, r) => a + r.metrics.invalidActions, 0);
  const repeated = runs.reduce((a, r) => a + r.metrics.repeatedActions, 0);
  const selfCorr = runs.reduce((a, r) => a + r.metrics.selfCorrections, 0);
  const failureEvents = runs.reduce(
    (a, r) => a + r.steps.filter((s) => !s.response.success || s.response.criticalMistake).length,
    0
  );
  const infoEff = runs.length
    ? runs.reduce((a, r) => a + r.metrics.informationEfficiency, 0) / runs.length
    : 0;
  const formatErrors = runs.reduce((a, r) => a + r.metrics.formatErrors, 0);
  const formatCalls = Math.max(1, totalActions);

  return {
    benchmark: "AI ESCAPE LAB",
    model,
    timestamp: new Date().toISOString(),
    summary: {
      rooms,
      escaped,
      escape_rate: runs.length ? round(escaped / runs.length) : 0,
      average_score: runs.length ? round(runs.reduce((a, r) => a + r.score.total, 0) / runs.length) : 0,
      average_actions: runs.length ? round(totalActions / runs.length) : 0,
      invalid_action_rate: totalActions ? round(invalid / totalActions) : 0,
      repeated_action_rate: totalActions ? round(repeated / totalActions) : 0,
      self_correction_rate: failureEvents ? round(selfCorr / failureEvents) : 0,
      information_efficiency: round(infoEff),
      format_reliability: round(1 - formatErrors / formatCalls),
    },
    runs,
  };
}

function round(x: number): number {
  return Math.round(x * 100) / 100;
}

/** Rule-based strengths / weaknesses (no LLM needed). */
export function analyze(report: BenchmarkReport): { strengths: string[]; weaknesses: string[] } {
  const s = report.summary;
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (s.escape_rate >= 0.8) strengths.push(`High escape rate (${pct(s.escape_rate)}) — reliable long-horizon task completion.`);
  else if (s.escape_rate <= 0.4) weaknesses.push(`Low escape rate (${pct(s.escape_rate)}) — fails to complete long-horizon goals.`);
  else weaknesses.push(`Inconsistent escape rate (${pct(s.escape_rate)}).`);

  if (s.format_reliability >= 0.95) strengths.push(`Excellent format reliability (${pct(s.format_reliability)}) — structured JSON output is dependable.`);
  else weaknesses.push(`Format reliability issues (${pct(s.format_reliability)}) — schema violations required retries.`);

  if (s.self_correction_rate >= 0.6) strengths.push(`Strong self-correction (${pct(s.self_correction_rate)}) — recovers from failed hypotheses.`);
  else if (s.self_correction_rate < 0.3) weaknesses.push(`Weak self-correction (${pct(s.self_correction_rate)}) — often stuck on falsified hypotheses.`);

  if (s.invalid_action_rate <= 0.05) strengths.push(`Strong rule compliance — invalid action rate only ${pct(s.invalid_action_rate)}.`);
  else weaknesses.push(`Rule compliance gaps — ${pct(s.invalid_action_rate)} of actions were illegal (unobserved targets).`);

  if (s.repeated_action_rate <= 0.05) strengths.push("Rarely repeats proven-useless actions.");
  else weaknesses.push(`Repeats ineffective actions (${pct(s.repeated_action_rate)} of all actions).`);

  if (s.information_efficiency >= 0.6) strengths.push(`High information efficiency (${pct(s.information_efficiency)}) — focuses on critical objects, resists distractors.`);
  else if (s.information_efficiency < 0.35) weaknesses.push(`Low information efficiency (${pct(s.information_efficiency)}) — attention diluted by irrelevant objects.`);

  if (strengths.length === 0) strengths.push("Completed structured interaction with the environment without crashing the run.");
  return { strengths, weaknesses };
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
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
  L.push(`> Can an AI escape the room? — generated ${report.timestamp}`);
  L.push("");
  L.push("## Model");
  L.push("");
  L.push(`**${report.model}**`);
  L.push("");
  L.push("## Overall Result");
  L.push("");
  L.push(`- Escape Rate: **${pct(s.escape_rate)}** (${s.escaped}/${s.rooms} rooms)`);
  L.push(`- Average Score: **${s.average_score} / 100**`);
  L.push(`- Average Actions: ${s.average_actions}`);
  L.push(`- Invalid Action Rate: ${pct(s.invalid_action_rate)}`);
  L.push(`- Repeated Action Rate: ${pct(s.repeated_action_rate)}`);
  L.push(`- Self-Correction Rate: ${pct(s.self_correction_rate)}`);
  L.push(`- Information Efficiency: ${pct(s.information_efficiency)}`);
  L.push(`- Format Reliability: ${pct(s.format_reliability)}`);
  L.push("");
  L.push("## Room Results");
  L.push("");
  L.push("| Room | Result | Score | Actions | Invalid | Repeated | Self-Corr | Time |");
  L.push("|---|---|---|---|---|---|---|---|");
  for (const run of report.runs) {
    const m = run.metrics;
    L.push(
      `| ${run.roomTitle} | ${m.success ? "PASS" : "FAIL"} | ${run.score.total} | ${m.actions}/${m.maxActions} | ${m.invalidActions} | ${m.repeatedActions} | ${m.selfCorrections} | ${formatDuration(m.durationMs)} |`
    );
  }
  L.push("");
  L.push("## Observed Strengths");
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
      L.push(`### ${run.roomTitle} (score ${run.score.total})`);
      L.push("");
      const crits = run.steps.filter((st) => st.response.criticalMistake);
      const invalids = run.steps.filter((st) => st.classification === "invalid");
      const repeats = run.steps.filter((st) => st.classification === "repeated");
      L.push(`- Critical mistakes: ${crits.length}${crits.length ? ` — ${crits.map((c) => formatAction(c.action)).join("; ")}` : ""}`);
      L.push(`- Invalid actions: ${invalids.length}`);
      L.push(`- Repeated actions: ${repeats.length}`);
      L.push(`- Ran out of budget after ${run.metrics.actions} actions.`);
      L.push("");
    }
  }

  L.push("## Full Trajectory");
  L.push("");
  for (const run of report.runs) {
    L.push(`### ${run.roomTitle} — ${run.metrics.success ? "ESCAPED" : "FAILED"} (${run.score.total}/100)`);
    L.push("");
    for (const st of run.steps) {
      L.push(`**Step ${String(st.step).padStart(2, "0")}** — \`${formatAction(st.action)}\``);
      if (st.reason) L.push(`- Hypothesis: ${st.reason}`);
      L.push(`- Result: ${st.response.success ? "OK" : "FAIL"} — ${st.response.message.replace(/\n/g, " ")}`);
      if (st.stateChanges.length) L.push(`- State: ${st.stateChanges.join("; ")}`);
      L.push("");
    }
  }

  L.push("---");
  L.push("_AI ESCAPE LAB — escape-room benchmark for LLM agents. Scores: Success 40 / Action Efficiency 20 / Information Efficiency 15 / Reasoning 10 / Self-Correction 10 / Compliance 5._");
  return L.join("\n");
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
