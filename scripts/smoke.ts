/* Engine smoke test — run with: node scripts/smoke.ts */
import { executeAction, initialState, buildObservation } from "../src/engine/environment.ts";
import { room01 } from "../src/data/rooms/room01-clockmaker.ts";
import { room02 } from "../src/data/rooms/room02-librarian.ts";
import { room03 } from "../src/data/rooms/room03-liar.ts";
import { room04 } from "../src/data/rooms/room04-red-herring.ts";
import { room05 } from "../src/data/rooms/room05-loop.ts";

function parse(line) {
  const parts = line.split(" ");
  const action = parts[0];
  const target = parts[1];
  const value = parts.slice(2).join(" ") || null;
  return { action, target, value, reason: "smoke test" };
}

function run(room, solution) {
  let state = initialState(room);
  const log = [];
  for (const line of solution) {
    const obs = buildObservation(room, state, []);
    const action = parse(line);
    const { state: next, result } = executeAction(room, state, action);
    state = next;
    log.push(`${line} → ${result.success ? "OK" : "FAIL"}: ${result.message.slice(0, 80)}`);
    if (state.escaped) break;
    void obs;
  }
  console.log(`\n══ ${room.title} ══ escaped=${state.escaped} actions=${state.actionCount}/${state.maxActions}`);
  for (const l of log) console.log("  " + l);
  if (!state.escaped) {
    console.error(`  ✗✗ ${room.id}: ground truth solution did NOT escape!`);
    process.exitCode = 1;
  }
  return state;
}

for (const r of [room01, room02, room03, room04, room05]) run(r, r.groundTruthSolution);

// Wrong-code path check (room01)
let s = initialState(room01);
s = executeAction(room01, s, { action: "interact", target: "painting", value: null, reason: null }).state;
const wrong = executeAction(room01, s, { action: "input", target: "safe", value: "9999", reason: null });
console.log("\nWrong-code check:", wrong.result.message, "| success =", wrong.result.success);
// Illegal target check
const illegal = executeAction(room01, s, { action: "inspect", target: "spaceship", value: null, reason: null });
console.log("Illegal target check:", illegal.result.message.slice(0, 60), "| invalid =", illegal.result.invalid);
// Room05 trap input check
const s5 = initialState(room05);
const trap = executeAction(room05, s5, { action: "input", target: "statue_shelf", value: "sun,moon,star,storm", reason: null });
console.log("Loop trap check: critical =", trap.result.criticalMistake, "|", trap.result.message.slice(0, 60));

console.log("\nSMOKE TEST DONE");
