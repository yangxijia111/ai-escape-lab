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
 * 13. Cancelled suite episodes are never saved / counted / reported
 * 14. suiteId isolation: one suite per official report, manual runs never sneak in
 * 15. Self-correction rate = recoveries / opportunities; N/A (null) when zero opportunities
 * 16. Format reliability is clamped to [0,1]
 * Exits 1 on any failure.
 */
import { executeAction, initialState, buildObservation } from "../src/engine/environment.ts";
import { classifyStep, classifyFailure, computeMetrics, computeScore, computeInformationEfficiency } from "../src/engine/scoring.ts";
import { scoreDeltaForStep } from "../src/engine/replay.ts";
import { runEpisode, shouldSaveEpisode } from "../src/engine/episode.ts";
import { buildReport, analyze } from "../src/lib/exportBenchmark.ts";
import { MOCK_SCRIPTS } from "../src/agents/mock.ts";
import { room01 } from "../src/data/rooms/room01-clockmaker.ts";
import { room03 } from "../src/data/rooms/room03-liar.ts";
import { room05 } from "../src/data/rooms/room05-loop.ts";

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

function mkRun(runType, model, provider, room, steps, suiteId = null, formatErrors = 0) {
  const metrics = computeMetrics(room, steps, { durationMs: 60000, formatErrors });
  return {
    runId: `test_${runType}_${room.id}_${Math.random().toString(36).slice(2, 6)}`,
    benchmark: "AI ESCAPE LAB",
    runType,
    model,
    agent: provider,
    roomId: room.id,
    roomTitle: room.title,
    timestamp: Date.now(),
    suiteId,
    metadata: {
      benchmarkVersion: "test", promptVersion: "test", provider,
      model, temperature: null, maxTokens: null,
      promptTokens: null, completionTokens: null, totalTokens: null,
      formatRetries: formatErrors, startedAt: Date.now() - 60000, finishedAt: Date.now(),
      suiteId,
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

console.log("\n── suite cancel & suiteId isolation ──");
function scriptedProvider(lines) {
  let i = 0;
  return {
    kind: "mock",
    model: "ScriptedTestProvider",
    async generateAction() {
      const action = parse(lines[Math.min(i, lines.length - 1)]);
      i += 1;
      return { action, formatErrors: 0 };
    },
  };
}
// 13. cancelled episodes are partial data — never saved, counted or reported
{
  let committed = 0;
  const partial = await runEpisode({
    room: room01,
    provider: scriptedProvider(room01.groundTruthSolution),
    runType: "benchmark",
    modelLabel: "Qwen · test",
    runId: "test_cancel_partial",
    suiteId: "suite_test",
    shouldStop: () => committed >= 2,
    onStep: () => { committed += 1; },
  });
  check(partial.cancelled === true && !partial.run.metrics.success, "13a. cancelled episode flagged cancelled and did not escape");
  check(shouldSaveEpisode(partial) === false, "13b. cancelled episode fails the recording guard (never saved/counted/reported)");

  const full = await runEpisode({
    room: room01,
    provider: scriptedProvider(room01.groundTruthSolution),
    runType: "benchmark",
    modelLabel: "Qwen · test",
    runId: "test_cancel_full",
    suiteId: "suite_test",
  });
  check(full.cancelled === false && full.run.metrics.success && shouldSaveEpisode(full), "13c. completed episode passes the recording guard");
  check(full.run.suiteId === "suite_test" && full.run.metadata.suiteId === "suite_test", "13d. suiteId recorded on RunRecord + RunMetadata");
}
// 14. one suite per official report
{
  const a1 = mkRun("benchmark", "Qwen · qwen-plus", "qwen", room01, solved.steps, "suite_A");
  const a2 = mkRun("benchmark", "Qwen · qwen-plus", "qwen", room03, play(room03, room03.groundTruthSolution).steps, "suite_A");
  const b1 = mkRun("benchmark", "Qwen · qwen-plus", "qwen", room01, solved.steps, "suite_B");
  const manual = mkRun("benchmark", "Qwen · qwen-plus", "qwen", room01, solved.steps); // suiteId = null
  check(!throws(() => buildReport([a1, a2])), "14a. same suiteId can share one report");
  check(throws(() => buildReport([a1, b1])), "14b. different suiteIds cannot mix in one report");
  check(throws(() => buildReport([a1, manual])), "14c. manual run (null suiteId) cannot sneak into a suite report");
  check(!throws(() => buildReport([manual])), "14d. manual-only runs can build their own report");
  check(buildReport([a1, a2]).suiteId === "suite_A", "14e. report carries its suiteId");
}

console.log("\n── self-correction rate & format reliability ──");
// 15. rate = recoveries / opportunities; N/A when no opportunity
{
  const clean = mkRun("benchmark", "Qwen · qwen-plus", "qwen", room01, solved.steps);
  check(clean.metrics.selfCorrectionOpportunities === 0, "15a. clean run has zero recovery opportunities");
  const cleanRep = buildReport([clean]);
  check(cleanRep.summary.self_correction_rate === null, "15b. summary rate is null (N/A), not 0%, when opportunities === 0");
  const an = analyze(cleanRep);
  check(!/self-correction/i.test([...an.strengths, ...an.weaknesses].join(" ")), "15c. analysis makes NO self-correction claim without opportunities");

  const loopSteps = play(room05, MOCK_SCRIPTS["loop"].map((s) => s.action)).steps;
  const loopRun = mkRun("benchmark", "Qwen · qwen-plus", "qwen", room05, loopSteps);
  check(
    loopRun.metrics.selfCorrectionOpportunities >= 1 && loopRun.metrics.selfCorrections >= 1,
    `15d. error→correction trajectory yields opportunities=${loopRun.metrics.selfCorrectionOpportunities} events=${loopRun.metrics.selfCorrections}`
  );
  const loopRate = buildReport([loopRun]).summary.self_correction_rate;
  check(typeof loopRate === "number" && loopRate > 0 && loopRate <= 1, `15e. rate is a real ratio when opportunities exist (got ${loopRate})`);
}
// 16. format reliability clamped
{
  const spam = mkRun("benchmark", "Qwen · qwen-plus", "qwen", room01, solved.steps, null, 999);
  const fr = buildReport([spam]).summary.format_reliability;
  check(fr >= 0 && fr <= 1, `16. format reliability clamped to [0,1] even with 999 format errors (got ${fr})`);
}

if (failures > 0) {
  console.error(`\n✗ BENCHMARK TEST FAILURE — ${failures} check(s) failed`);
  process.exit(1);
}
console.log("\n✓ BENCHMARK TEST OK — all 16 spec checks passed");
process.exit(0);
