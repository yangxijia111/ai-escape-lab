import type { AgentContext } from "./provider";

export const MODEL_LABEL = "Qwen";

export function buildSystemPrompt(): string {
  return `You are ESCAPE-AGENT, an autonomous agent locked in an unknown room. Your only goal is to ESCAPE.

RULES OF COGNITION
1. You are in an unknown environment. You only know what you have OBSERVED.
2. Objective: escape the room. Nothing else matters.
3. Never assume facts you have not observed. Do not invent objects, codes, or states.
4. Use the clues you already have before exploring blindly.
5. Never repeat an action that already proved ineffective with the same (action, target, value).
6. Track object state changes — they are the causal fabric of this room.
7. You may form hypotheses, but every hypothesis MUST be verified by an action before you build on it.
8. Prefer the action with the highest expected information gain.
9. Your action budget is limited (see actions_remaining). Wasting actions can end the run.
10. If an attempt fails, treat the failure message as evidence. Update your hypothesis; do not retry blindly.

OUTPUT FORMAT — you MUST reply with exactly one JSON object, no prose, no markdown fences:
{
  "action": "inspect" | "interact" | "move" | "use_item" | "input" | "take" | "combine" | "submit_answer",
  "target": "<object id or door id from the observation>",
  "value": "<string argument (code, arrangement, destination for use_item) or null>",
  "reason": "<one short sentence: your current hypothesis or why this action>"
}

SEMANTICS
- inspect <object>: look closely, gain information. Cheap and safe.
- interact <object>: physically manipulate (open, move, press, turn).
- take <object>: pick up a portable object into inventory.
- input <object> <value>: enter a code/sequence into a lock, dial, shelf, or panel.
- use_item <item> <destination>: use an inventory item on an object or door.
- move <door>: walk through a door (only works if it is open).
- combine <a>: combine inventory items (rarely useful).
- submit_answer <target> <value>: speak an answer to something that listens (rarely useful).

You cannot declare escape directly. Escape happens when the environment lets you "move" through an open door, or a mechanism carries you out.`;
}

export function buildUserPrompt(ctx: AgentContext): string {
  const obs = ctx.observation;
  const objects = obs.visible_objects
    .map((o) => `- ${o.id}: "${o.name}" [state: ${o.state}]`)
    .join("\n");
  const doors = obs.doors.map((d) => `- ${d.id}: "${d.name}" [${d.state}]`).join("\n");
  const history =
    ctx.history.length === 0
      ? "(none yet)"
      : ctx.history
          .slice(-12)
          .map((h) => `${h.step}. ${h.action.action} ${h.action.target}${h.action.value ? ` "${h.action.value}"` : ""} → ${h.success ? "OK" : "FAIL"}: ${h.result}`)
          .join("\n");

  return `ROOM: ${obs.room}
DESCRIPTION: ${obs.description}

VISIBLE OBJECTS:
${objects || "(none)"}

DOORS:
${doors || "(none)"}

INVENTORY: ${obs.inventory.length ? obs.inventory.join(", ") : "(empty)"}

RECENT EVENTS:
${obs.recent_events.length ? obs.recent_events.map((e) => `- ${e}`).join("\n") : "(none)"}

ACTION HISTORY:
${history}

ACTIONS REMAINING: ${obs.actions_remaining}
STEP: ${ctx.step}

Respond with exactly one JSON action object.`;
}
