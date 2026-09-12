/* Benchmark integrity test — run with: node scripts/integrity.ts
 *
 * Verifies the PublicObservation boundary:
 *  1. The payload a provider receives (AgentContext = observation + history)
 *     never contains forbidden fields (ground truth, rules, evaluation…).
 *  2. Initial observations never leak room secrets (codes, answers, mappings).
 *  3. Hidden objects never appear before being discovered.
 *  4. The boundary holds across a FULL ground-truth trajectory, not just step 1.
 * Exits 1 on any failure.
 */
import { executeAction, initialState, buildObservation } from "../src/engine/environment.ts";
import { room01 } from "../src/data/rooms/room01-clockmaker.ts";
import { room02 } from "../src/data/rooms/room02-librarian.ts";
import { room03 } from "../src/data/rooms/room03-liar.ts";
import { room04 } from "../src/data/rooms/room04-red-herring.ts";
import { room05 } from "../src/data/rooms/room05-loop.ts";

const FORBIDDEN_KEYS = new Set([
  "groundTruthSolution",
  "criticalObjects",
  "optimalActions",
  "hiddenObjects",
  "puzzleStates",
  "rules",
  "expected",
  "correct",
  "solution",
  "evaluation",
  "supportingObjects",
  "irrelevantObjects",
  "inspect",
  "inspectByState",
  "when",
  "effects",
  "hidden",
  "critical",
  "failureType",
  "answer",
]);

/** Secret strings that must never appear in a room's INITIAL payload. */
const INITIAL_SECRETS = {
  clockmaker: ["1015", "10:15"],
  librarian: ["2413"],
  liar: ["Note C was the liar", "r03-open-c-correct", "liar_puzzle", "vault_key", "Vault key"],
  "red-herring": [],
  loop: ["lion,serpent,owl,falcon", "lion, serpent, owl, falcon", "sun→lion", "r05-"],
};

let failures = 0;
function check(ok, label) {
  if (ok) {
    console.log(`  PASS  ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label}`);
  }
}

function forbiddenKeysIn(value, path = "$") {
  const found = [];
  const walk = (v, p) => {
    if (Array.isArray(v)) {
      v.forEach((x, i) => walk(x, `${p}[${i}]`));
    } else if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) {
        if (FORBIDDEN_KEYS.has(k)) found.push(`${p}.${k}`);
        walk(x, `${p}.${k}`);
      }
    }
  };
  walk(value, path);
  return found;
}

function parse(line) {
  const parts = line.split(" ");
  return {
    action: parts[0],
    target: parts[1] ?? null,
    value: parts.slice(2).join(" ") || null,
    reason: "integrity test",
  };
}

function auditRoom(room) {
  console.log(`\n══ ${room.title} (${room.id}) ══`);
  let state = initialState(room);
  let events = ["You wake up in the room."];

  // ── initial payload (exactly what episode.ts hands the provider) ──
  const initialPayload = {
    roomId: room.id,
    roomTitle: room.title,
    observation: buildObservation(room, state, events),
    history: [],
    step: 1,
  };
  const initialJson = JSON.stringify(initialPayload);

  const badKeys = forbiddenKeysIn(initialPayload);
  check(badKeys.length === 0, `initial payload has no forbidden fields${badKeys.length ? ` (found: ${badKeys.join(", ")})` : ""}`);

  const secrets = INITIAL_SECRETS[room.id] ?? [];
  const leaked = secrets.filter((s) => initialJson.includes(s));
  check(leaked.length === 0, `initial payload leaks no secrets${leaked.length ? ` (found: ${leaked.join(" | ")})` : ""}`);

  const hiddenLeaks = room.objects
    .filter((o) => o.hidden)
    .filter((o) => initialJson.includes(o.id) || initialJson.includes(o.name));
  check(hiddenLeaks.length === 0, `hidden objects absent from initial payload${hiddenLeaks.length ? ` (found: ${hiddenLeaks.map((o) => o.id).join(", ")})` : ""}`);

  // ── full ground-truth trajectory: boundary must hold at every step ──
  let stepNo = 1;
  let trajectoryLeak = null;
  const history = [];
  for (const line of room.groundTruthSolution) {
    if (state.escaped || state.failed) break;
    const payload = {
      roomId: room.id,
      roomTitle: room.title,
      observation: buildObservation(room, state, events),
      history: [...history],
      step: stepNo,
    };
    const bad = forbiddenKeysIn(payload);
    if (bad.length && !trajectoryLeak) trajectoryLeak = `step ${stepNo}: ${bad.join(", ")}`;
    const { state: next, result } = executeAction(room, state, parse(line));
    history.push({ step: stepNo, action: parse(line), result: result.message.slice(0, 220), success: result.success });
    state = next;
    events = result.events.length ? result.events : [result.message];
    stepNo += 1;
  }
  check(trajectoryLeak === null, `no forbidden fields across full trajectory${trajectoryLeak ? ` (${trajectoryLeak})` : ""}`);
  check(state.escaped, `ground-truth solution still escapes the room (actions=${state.actionCount})`);
}

console.log("AI ESCAPE LAB — integrity test (PublicObservation boundary)");
for (const room of [room01, room02, room03, room04, room05]) auditRoom(room);

if (failures > 0) {
  console.error(`\n✗ INTEGRITY FAILURE — ${failures} check(s) failed`);
  process.exit(1);
}
console.log("\n✓ INTEGRITY OK — no ground-truth leakage detected");
process.exit(0);
