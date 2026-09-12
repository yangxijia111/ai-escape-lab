/* Full pipeline test: MockAgent loop → scoring → run-type separation → report → export.
   Run with: node scripts/pipeline.ts */
import { executeAction, initialState, buildObservation } from "../src/engine/environment.ts";
import { classifyStep, classifyFailure, computeMetrics, computeScore } from "../src/engine/scoring.ts";
import { scoreDeltaForStep } from "../src/engine/replay.ts";
import { buildReport, reportToJSON, reportToMarkdown, reportToCSV, analyze } from "../src/lib/exportBenchmark.ts";
import { MOCK_SCRIPTS } from "../src/agents/mock.ts";
import { room01 } from "../src/data/rooms/room01-clockmaker.ts";
import { room02 } from "../src/data/rooms/room02-librarian.ts";
import { room03 } from "../src/data/rooms/room03-liar.ts";
import { room04 } from "../src/data/rooms/room04-red-herring.ts";
import { room05 } from "../src/data/rooms/room05-loop.ts";

let failures = 0;
function check(ok, label) {
  console.log(`  ${ok ? "PASS " : "FAIL "} ${label}`);
  if (!ok) failures += 1;
}

const demoRuns = [];
for (const room of [room01, room02, room03, room04, room05]) {
  let state = initialState(room);
  let events = ["You wake up in the room."];
  const steps = [];
  const script = MOCK_SCRIPTS[room.id];
  if (!script) throw new Error("no mock script for " + room.id);

  for (const s of script) {
    const obs = buildObservation(room, state, events);
    const { state: next, result } = executeAction(room, state, s.action);
    const classification = classifyStep(room, { action: s.action, result }, steps.map((x) => ({ action: x.action })));
    steps.push({
      timestamp: Date.now(),
      step: steps.length + 1,
      agent: "mock",
      observation: obs,
      action: s.action,
      reason: s.action.reason,
      response: result,
      stateChanges: result.stateChanges,
      scoreDelta: scoreDeltaForStep(classification),
      classification,
    });
    state = next;
    events = result.events.length ? result.events : [result.message];
    if (state.escaped || state.actionCount >= state.maxActions) break;
  }

  const startedAt = Date.now() - 90000;
  const metrics = computeMetrics(room, steps, { durationMs: 90000 });
  const score = computeScore(room, metrics, steps);
  demoRuns.push({
    runId: "smoke_" + room.id,
    benchmark: "AI ESCAPE LAB",
    runType: "demo",
    model: "MockAgent v1 (Demo Mode)",
    agent: "mock",
    roomId: room.id,
    roomTitle: room.title,
    timestamp: Date.now(),
    metadata: {
      benchmarkVersion: "test", promptVersion: "test", provider: "mock",
      model: "MockAgent v1 (Demo Mode)", temperature: null, maxTokens: null,
      promptTokens: null, completionTokens: null, totalTokens: null,
      formatRetries: 0, startedAt, finishedAt: Date.now(),
    },
    metrics,
    score,
    failure: classifyFailure(metrics, steps),
    steps,
  });
  console.log(
    `${room.title.padEnd(16)} escaped=${String(state.escaped).padEnd(5)} score=${String(score.total).padStart(3)} ` +
    `actions=${metrics.actions}/${metrics.maxActions} useful=${metrics.usefulActions} irr=${metrics.irrelevantActions} ` +
    `inv=${metrics.invalidActions} rep=${metrics.repeatedActions} crit=${metrics.criticalMistakes} selfCorr=${metrics.selfCorrections}`
  );
}

console.log("\n── run-type separation ──");
check(demoRuns.every((r) => r.runType === "demo"), "all mock runs are typed as demo");

let threw = false;
try { buildReport(demoRuns); } catch { threw = true; }
check(threw, "buildReport REJECTS demo runs");

// In-memory copies typed as benchmark (never stored) to exercise report/export paths.
const testRuns = demoRuns.map((r) => ({
  ...r,
  runType: "benchmark",
  model: "PipelineTestModel",
  metadata: { ...r.metadata, model: "PipelineTestModel", provider: "qwen" },
}));

threw = false;
try { buildReport([...testRuns, { ...testRuns[0], metadata: { ...testRuns[0].metadata, model: "OtherModel" } }]); } catch { threw = true; }
check(threw, "buildReport REJECTS multiple models in one report");

console.log("\n── report & export ──");
const report = buildReport(testRuns);
check(report.summary.totalRuns === 5 && report.summary.byRoom.length === 5, "report aggregates 5 runs / 5 rooms");
console.log("SUMMARY escape_rate:", report.summary.escape_rate, "| mean_score:", report.summary.mean_score,
  "| info_eff:", report.summary.information_efficiency, "| explore_eff:", report.summary.exploration_efficiency);

const { strengths, weaknesses } = analyze(report);
check(strengths.length > 0, "analysis produces scoped strengths (" + strengths.length + ") / weaknesses (" + weaknesses.length + ")");
const scoped = [...strengths, ...weaknesses].every((s) => /this benchmark|this controlled environment/i.test(s));
check(scoped, "every analysis statement is scope-limited (no generalized capability claims)");

const md = reportToMarkdown(report);
const json = reportToJSON(report);
const csv = reportToCSV(report);
check(md.includes("## Full Trajectory") && md.includes("## Failure Cases"), "MD contains trajectory + failure sections");
check(md.includes("Rationale text is never scored"), "MD documents that rationale text is never scored");
check(!md.toLowerCase().includes("reasoning quality"), "MD has no Reasoning Quality dimension");
check(json.includes('"runType": "benchmark"'), "JSON marks runs as benchmark");
check(csv.split("\n")[0].includes("information_efficiency") && csv.split("\n").length === 6, "CSV has header + 5 run rows incl. efficiency columns");

const allEscaped = demoRuns.every((r) => r.metrics.success);
check(allEscaped, "all rooms escaped via mock pipeline");

if (failures > 0 || !allEscaped) {
  console.error(`\n✗ PIPELINE FAILURE — ${failures} check(s) failed`);
  process.exit(1);
}
console.log("\n✓ PIPELINE OK");
