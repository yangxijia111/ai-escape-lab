import type { AgentAction } from "@/engine/types";
import type { AgentContext, AgentDecision, AIProvider } from "./provider";

/**
 * MockAgentProvider — Demo Mode.
 * Scripted trajectories per room that simulate a realistic agent run:
 * observe → hypothesize → try → fail → reconsider → correct → escape.
 * Used whenever no QWEN_API_KEY is configured, and by "Demo Mode".
 */

interface ScriptStep {
  action: AgentAction;
}

function s(action: AgentAction["action"], target: string, value: string | null, reason: string): ScriptStep {
  return { action: { action, target, value, reason } };
}

export const MOCK_SCRIPTS: Record<string, ScriptStep[]> = {
  clockmaker: [
    s("inspect", "clock", null, "A stopped clock is a classic code carrier — note the exact time first."),
    s("inspect", "painting", null, "The frame is crooked and scratched. Something may hide behind it."),
    s("interact", "painting", null, "Move the portrait aside to test the scratch hypothesis."),
    s("inspect", "safe", null, "A four-digit dial. I need a 4-digit candidate; 10:15 → 1015 is plausible but unverified."),
    s("interact", "desk", null, "Before entering a code, search the room for corroborating clues."),
    s("inspect", "note", null, "“Time never lies” — the clock's time IS the code. Hypothesis confirmed by a second source."),
    s("input", "safe", "1015", "Two independent clues point to 10:15. Enter 1015."),
    s("use_item", "brass_key", "door", "The key from the safe should fit the sealed door."),
    s("move", "door", null, "The door is unlocked. Escape."),
  ],
  librarian: [
    s("inspect", "bookshelf", null, "Four pristine planet books with scraped-off numbers — order looks significant."),
    s("inspect", "inscription", null, "“Home is third” — Earth is the third planet. A consistency anchor."),
    s("inspect", "reading_desk", null, "The desk mentions a four-digit locked drawer."),
    s("inspect", "drawer", null, "Four digits needed. Planet titles alone are not digits — I need a mapping."),
    s("inspect", "globe", null, "The globe has a glued-shut card slot. Something is inside."),
    s("interact", "globe", null, "Open the card slot to retrieve whatever is hidden inside."),
    s("inspect", "planetary_index", null, "Index maps planets → catalog numbers: Mercury 1, Venus 2, Earth 3, Mars 4."),
    s("input", "drawer", "3214", "First hypothesis: “Home is third” leads — maybe Earth first: 3-2-1-4."),
    s("inspect", "drawer", null, "Failed. Re-read constraints: the desk says “Order is everything”. The shelf order is the key, not importance."),
    s("input", "drawer", "2413", "Shelf order Venus, Mars, Mercury, Earth → catalog numbers 2,4,1,3. Earth=3rd also checks out."),
    s("use_item", "silver_key", "door", "Use the silver key on the handle-less door."),
    s("move", "door", null, "The door is unlocked. Escape."),
  ],
  liar: [
    s("inspect", "engraving", null, "Establish the rules first: exactly one note is true, wrong chests seal forever."),
    s("inspect", "chest_a", null, "Note A: “The key is not in chest A.”"),
    s("inspect", "chest_b", null, "Note B: “The key is in chest A.” A and B contradict — one of them is the single truth."),
    s("inspect", "chest_c", null, "Note C: “The key is not in chest C.” Test cases: key in A → 2 truths ✗; key in B → 2 truths ✗; key in C → exactly 1 truth ✓."),
    s("interact", "chest_c", null, "Only “key in C” satisfies the exactly-one-truth constraint. Note C is the liar. Open chest C."),
    s("use_item", "vault_key", "door", "Use the vault key on the vault door."),
    s("move", "door", null, "The door is unlocked. Escape."),
  ],
  "red-herring": [
    s("inspect", "newspaper", null, "The framed headline is the loudest signal in the room — verify it before ignoring it."),
    s("inspect", "bookcase", null, "The paper claims a passage behind the bookcase."),
    s("interact", "bookcase", null, "Test the newspaper's claim directly."),
    s("inspect", "gramophone", null, "Newspaper was misdirection — it is framed and circled, too convenient. Switch to systematic scan. The gramophone's hand-written label stands out."),
    s("interact", "gramophone", null, "Play it — “the brick that sings” suggests sound locates something."),
    s("inspect", "loose_brick", null, "A buzzing brick near the fireplace. Soot arcs confirm it moves."),
    s("interact", "loose_brick", null, "Pivot the singing brick."),
    s("inspect", "vent", null, "Got a square-headed handle. The vent has square screws and airflow toward the door."),
    s("use_item", "iron_handle", "vent", "The handle should fit the vent screws."),
    s("interact", "door", null, "The locking bar is exposed through the vent channel — lever it with the handle."),
    s("move", "door", null, "The bar is down. Escape."),
  ],
  loop: [
    s("inspect", "wall_symbols", null, "Four symbols ☉☾★⚡ carved like a combination. Strong first hypothesis."),
    s("inspect", "statue_shelf", null, "The shelf has four symbol-shaped slots and four statues. “SET THE ORDER AND THE WAY OPENS.”"),
    s("input", "statue_shelf", "sun,moon,star,storm", "Arrange statues to mirror the wall symbols and press them into the slots."),
    s("inspect", "statue_shelf", null, "Rejected — and the plate said “THE SLOTS ARE KEYS, NOT ANSWERS. THE HEAVENS SPEAK IN LIVING FORMS.” My symbol hypothesis is wrong. The symbols must MAP to something."),
    s("inspect", "dustcloth", null, "Before re-guessing, search the room for the mapping. The dustcloth hides something rigid."),
    s("interact", "dustcloth", null, "Pull the cloth — the hidden object may carry the mapping."),
    s("inspect", "plaque", null, "The plaque maps symbols to statues: sun→lion, moon→serpent, star→owl, storm→falcon."),
    s("input", "statue_shelf", "lion,serpent,owl,falcon", "Set the statues in wall-symbol order via the mapping: lion, serpent, owl, falcon."),
  ],
};

/** Greedy fallback when a script runs out (should rarely happen). */
function fallback(ctx: AgentContext): AgentAction {
  const obs = ctx.observation;
  const tried = new Set(ctx.history.map((h) => `${h.action.action}:${h.action.target}`));
  for (const o of obs.visible_objects) {
    if (!tried.has(`inspect:${o.id}`)) {
      return { action: "inspect", target: o.id, value: null, reason: "Script exhausted — fall back to systematic inspection." };
    }
  }
  for (const o of obs.visible_objects) {
    if (!tried.has(`interact:${o.id}`)) {
      return { action: "interact", target: o.id, value: null, reason: "Systematic interaction sweep." };
    }
  }
  const openDoor = obs.doors.find((d) => d.state === "open");
  if (openDoor) {
    return { action: "move", target: openDoor.id, value: null, reason: "An open door exists — escape." };
  }
  return { action: "inspect", target: obs.doors[0]?.id ?? "door", value: null, reason: "Nothing left to try but the door." };
}

export class MockAgentProvider implements AIProvider {
  readonly kind = "mock" as const;
  readonly model: string;

  constructor(model = "MockAgent v1 (Demo Mode)") {
    this.model = model;
  }

  async generateAction(ctx: AgentContext): Promise<AgentDecision> {
    // Simulate "thinking" latency for the live broadcast feel.
    await sleep(350 + Math.random() * 450);
    const script = MOCK_SCRIPTS[ctx.roomId];
    if (script) {
      const next = script[ctx.history.length];
      if (next) return { action: next.action, formatErrors: 0 };
    }
    return { action: fallback(ctx), formatErrors: 0 };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
