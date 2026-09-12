/* Benchmark behavior test — run with: node scripts/benchmark.ts
 *
 * Spec-required checks (npm run test:benchmark):
 *  1. Clockmaker correct path escapes
 *  2. Clockmaker wrong code does not escape
 *  3. The Liar wrong choice (A) is unrecoverable
 *  4. The Liar correct choice (C) escapes
 *  5. Mock (demo) runs never enter an official report
 *  6. Human runs never enter an official report
 *  7. Qwen benchmark runs can enter a report
 *  8. Multiple models cannot be mixed in one report
 *  9. Rationale length never affects score
 * 10. Repeating a critical object never inflates Information Efficiency
 * 11. Repeated actions are counted correctly
 * 12. Failure taxonomy basic classification
 * Exits 1 on any failure.
 */
import { executeAction, initialState, buildObservation } from "../src/engine/environment.ts";
import { classifyStep, classifyFailure, computeMetrics, computeScore, computeInformationEfficiency } from "../src/engine/scoring.ts";
import { scoreDeltaForStep } from "../src/engine/replay.ts";
import { buildReport } from "../src/lib/exportBenchmark.ts";
import { room01 } from "../src/data/rooms/room01-clockmaker.ts";
import { room03 } from "../src/data/rooms/room03-liar.ts";

let failures = 0;
function check(ok, label) {
  console.log(`  ${ok ? "PASS " : "FAIL "} ${label}`);
  if (!ok) failures += 1;
}

function parse(line, reason = "benchmark test") {
  const parts = line.split(" ");
  return { action: parts[0], target: parts[1] ?? null, value: parts.slice(2).join(" ") || null, reason };
}

function play(room, lines) {
  let state = initialState(room);
  let events = ["You wake up in the room."];
  const steps = [];
  for (const line of lines) {
    if (state.escaped || state.failed || state.actionCount >= state.maxActions) break;
    const action = typeof line === "string" ? parse(line) : line;
    const obs = buildObservation(room, state, events);
    const { state: next, result } = executeAction(room, state, action);
    const classification = classifyStep(room, { action, result }, steps.map((x) => ({ action: x.action })));
    steps.push({
      timestamp: Date.now(),
      step: steps.length + 1,
      agent: "mock",
      observation: obs,
      action,
      reason: action.reason ?? null,
      response: result,
      stateChanges: result.stateChanges,
      scoreDelta: scoreDeltaForStep(classification),
      classification,
    });
    state = next;
    events = result.events.length ? result.events : [result.message];
  }
  return { state, steps };
}

function mkRun(runType, model, provider, room, steps) {
  const metrics = computeMetrics(room, steps, { durationMs: 60000 });
  return {
    runId: `test_${runType}_${room.id}_${Math.random().toString(36).slice(2, 6)}`,
    benchmark: "AI ESCAPE LAB",
    runType,
    model,
    agent: provider,
    roomId: room.id,
    roomTitle: room.title,
    timestamp: Date.now(),
    metadata: {
      benchmarkVersion: "test", promptVersion: "test", provider,
      model, temperature: null, maxTokens: null,
      promptTokens: null, completionTokens: null, totalTokens: null,
      formatRetries: 0, startedAt: Date.now() - 60000, finishedAt: Date.now(),
    },
    metrics,
    score: computeScore(room, metrics, steps),
    failure: classifyFailure(metrics, steps),
    steps,
  };
}

console.log("AI ESCAPE LAB — benchmark behavior test");

console.log("\n── room behavior ──");
// 1. Clockmaker correct path escapes
{
  const { state } = play(room01, room01.groundTruthSolution);
  check(state.escaped, `1. Clockmaker correct path escapes (actions=${state.actionCount})`);
}
// 2. Clockmaker wrong code does not escape
{
  const { state, steps } = play(room01, ["inspect clock", "interact painting", "interact desk", "inspect note", "input safe 9999", "move door"]);
  const safeStillLocked = !state.escaped && !steps.some((s) => s.response.escaped);
  check(safeStillLocked, "2. Clockmaker wrong code (9999) does not open the safe / escape");
}
// 3. Liar wrong choice A is unrecoverable
{
  const wrongFirst = play(room03, ["interact chest_a"]);
  const afterWrong = play(room03, ["interact chest_a", ...room03.groundTruthSolution.slice(1)]);
  check(
    wrongFirst.state.failed && !afterWrong.state.escaped && afterWrong.state.failed,
    "3. Liar wrong choice (A) → permanently failed, unrecoverable even with the correct continuation"
  );
  const wrongMetrics = computeMetrics(room03, wrongFirst.steps, {});
  check(wrongMetrics.criticalMistakes > 0, "3b. Liar wrong choice registers a critical mistake");
}
// 4. Liar correct choice C escapes
{
  const { state } = play(room03, room03.groundTruthSolution);
  check(state.escaped, `4. Liar correct choice (C) escapes (actions=${state.actionCount})`);
}

console.log("\n── run-type separation & report rules ──");
const solved = play(room01, room01.groundTruthSolution);
const demoRun = mkRun("demo", "MockAgent v1 (Demo Mode)", "mock", room01, solved.steps);
const humanRun = mkRun("human", "Human", "human", room01, solved.steps);
const qwenRun = mkRun("benchmark", "Qwen · qwen-plus", "qwen", room01, solved.steps);

function throws(fn) {
  try { fn(); return false; } catch { return true; }
}

// 5. demo runs rejected
check(throws(() => buildReport([demoRun])), "5. Mock (demo) run cannot enter an official report");
// 6. human runs rejected
check(throws(() => buildReport([humanRun])), "6. Human run cannot enter an official report");
check(throws(() => buildReport([qwenRun, demoRun])), "6b. Mixed benchmark+demo runs rejected");
// 7. benchmark runs accepted
{
  let ok = true;
  try {
    const rep = buildReport([qwenRun]);
    ok = rep.summary.totalRuns === 1 && rep.model === "Qwen · qwen-plus";
  } catch { ok = false; }
  check(ok, "7. Qwen benchmark run can enter an official report");
}
// 8. multiple models rejected
{
  const other = mkRun("benchmark", "Qwen · qwen-max", "qwen", room01, solved.steps);
  check(throws(() => buildReport([qwenRun, other])), "8. Two different models cannot share one report");
}

console.log("\n── scoring behavior ──");
// 9. rationale length never affects score
{
  const shortR = play(room01, room01.groundTruthSolution.map((l) => parse(l, "ok")));
  const longR = play(room01, room01.groundTruthSolution.map((l) => parse(l, "x".repeat(500))));
  const noR = play(room01, room01.groundTruthSolution.map((l) => parse(l, null)));
  const s1 = computeScore(room01, computeMetrics(room01, shortR.steps, {}), shortR.steps).total;
  const s2 = computeScore(room01, computeMetrics(room01, longR.steps, {}), longR.steps).total;
  const s3 = computeScore(room01, computeMetrics(room01, noR.steps, {}), noR.steps).total;
  check(s1 === s2 && s2 === s3, `9. rationale length does not affect score (short=${s1} long=${s2} none=${s3})`);
}
// 10. repeating critical objects never inflates Information Efficiency
{
  const once = play(room01, room01.groundTruthSolution).steps;
  const spammed = play(room01, [
    ...Array(10).fill("inspect clock"),
    ...room01.groundTruthSolution,
  ]).steps;
  const ie1 = computeInformationEfficiency(room01, once);
  const ie2 = computeInformationEfficiency(room01, spammed);
  check(ie1 === ie2, `10. Information Efficiency unchanged by 10x repeated critical inspect (${ie1} vs ${ie2})`);
}
// 11. repeated actions counted correctly
{
  const { steps } = play(room01, ["inspect clock", "inspect clock", "inspect clock"]);
  const m = computeMetrics(room01, steps, {});
  check(m.repeatedActions === 2 && m.usefulActions === 1, `11. repeated actions counted (useful=${m.usefulActions} repeated=${m.repeatedActions})`);
}

console.log("\n── failure taxonomy ──");
// 12a. Liar premature commitment is primary
{
  const { steps } = play(room03, ["interact chest_a"]);
  const f = classifyFailure(computeMetrics(room03, steps, {}), steps);
  check(f && f.primary === "PREMATURE_COMMITMENT", `12a. Liar wrong chest → primary=PREMATURE_COMMITMENT (got ${f?.primary})`);
}
// 12b. budget exhaustion
{
  const lines = ["interact painting", "interact desk", "inspect note"];
  for (let i = 0; i < 40; i++) lines.push(`input safe ${String(2000 + i)}`);
  const { state, steps } = play(room01, lines);
  const f = classifyFailure(computeMetrics(room01, steps, {}), steps);
  const all = f ? [f.primary, ...f.secondary] : [];
  check(!state.escaped && all.includes("ACTION_BUDGET_EXCEEDED"), `12b. wrong codes to budget → ACTION_BUDGET_EXCEEDED (got ${all.join(",")})`);
}
// 12c. repeated failed action
{
  const lines = ["interact painting", ...Array(4).fill("input safe 9999")];
  const { steps } = play(room01, lines);
  const f = classifyFailure(computeMetrics(room01, steps, {}), steps);
  const all = f ? [f.primary, ...f.secondary] : [];
  check(all.includes("REPEATED_FAILED_ACTION"), `12c. identical wrong input x4 → REPEATED_FAILED_ACTION (got ${all.join(",")})`);
}
// 12d. success → no failure classification
check(solved.steps.length > 0 && classifyFailure(computeMetrics(room01, solved.steps, {}), solved.steps) === null, "12d. successful run has null failure classification");

if (failures > 0) {
  console.error(`\n✗ BENCHMARK TEST FAILURE — ${failures} check(s) failed`);
  process.exit(1);
}
console.log("\n✓ BENCHMARK TEST OK — all 12 spec checks passed");
process.exit(0);
