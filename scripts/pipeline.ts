/* Full pipeline smoke test: MockAgent loop → scoring → report → export.
   Run with: node scripts/pipeline.ts */
import { executeAction, initialState, buildObservation } from "../src/engine/environment.ts";
import { classifyStep, computeMetrics, computeScore } from "../src/engine/scoring.ts";
import { scoreDeltaForStep } from "../src/engine/replay.ts";
import { buildReport, reportToJSON, reportToMarkdown, analyze } from "../src/lib/exportBenchmark.ts";
import { MOCK_SCRIPTS } from "../src/agents/mock.ts";
import { room01 } from "../src/data/rooms/room01-clockmaker.ts";
import { room02 } from "../src/data/rooms/room02-librarian.ts";
import { room03 } from "../src/data/rooms/room03-liar.ts";
import { room04 } from "../src/data/rooms/room04-red-herring.ts";
import { room05 } from "../src/data/rooms/room05-loop.ts";

const runs = [];
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

  const metrics = computeMetrics(room, steps, { durationMs: 90000 + Math.random() * 60000 });
  const score = computeScore(room, metrics, steps);
  runs.push({
    runId: "smoke_" + room.id,
    benchmark: "AI ESCAPE LAB",
    model: "MockAgent v1 (Demo Mode)",
    agent: "mock",
    roomId: room.id,
    roomTitle: room.title,
    timestamp: Date.now(),
    metrics,
    score,
    steps,
  });
  console.log(
    `${room.title.padEnd(16)} escaped=${String(state.escaped).padEnd(5)} score=${String(score.total).padStart(3)} ` +
    `actions=${metrics.actions}/${metrics.maxActions} useful=${metrics.usefulActions} irr=${metrics.irrelevantActions} ` +
    `inv=${metrics.invalidActions} rep=${metrics.repeatedActions} crit=${metrics.criticalMistakes} selfCorr=${metrics.selfCorrections}`
  );
}

const report = buildReport(runs, "MockAgent v1 (Demo Mode)");
console.log("\nSUMMARY:", JSON.stringify(report.summary));
const { strengths, weaknesses } = analyze(report);
console.log("STRENGTHS:", strengths.length, "| WEAKNESSES:", weaknesses.length);
const md = reportToMarkdown(report);
const json = reportToJSON(report);
console.log("MD length:", md.length, "| JSON length:", json.length);
console.log("MD has trajectory:", md.includes("## Full Trajectory"), "| MD has failure section:", md.includes("## Failure Cases"));
const allEscaped = runs.every((r) => r.metrics.success);
console.log(allEscaped ? "\n✓ ALL ROOMS ESCAPED VIA MOCK PIPELINE" : "\n✗ SOME ROOM FAILED");
if (!allEscaped) process.exitCode = 1;
