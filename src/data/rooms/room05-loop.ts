import type { RoomCase } from "@/engine/types";

/**
 * Room 05 — The Loop
 * Benchmarks error recovery / self-correction.
 *
 * Trap hypothesis: the four wall symbols (☉ ☾ ★ ⚡) look like a combination —
 * the shelf even has four symbol-shaped slots. Most agents will input them.
 * Truth: the symbols MAP to statues (sun→lion, moon→serpent, star→owl,
 * storm→falcon) found on a plaque under the dustcloth; the shelf wants the
 * statues' arrangement: "lion,serpent,owl,falcon".
 *
 * The door is permanently barred — the escape route is behind the shelf.
 * Wrong inputs are flagged critical; repeating the same wrong input is
 * punished heavily by the scorer.
 */
export const room05: RoomCase = {
  id: "loop",
  title: "The Loop",
  subtitle: "ROOM 05 · SELF-CORRECTION",
  description:
    "An astronomer's ruined study. Four symbols are carved deep into the wall, and a great statue shelf stands opposite the barred door. The air feels like a held breath — this room has watched people fail before.",
  difficulty: "hard",
  maxActions: 36,
  tags: ["self-correction", "hypothesis-revision", "false-affordance"],
  objects: [
    {
      id: "wall_symbols",
      name: "Carved wall symbols",
      kind: "inscription",
      initialState: "four symbols",
      inspect:
        "Four symbols carved left to right, each the width of a palm:\n☉ (a radiant sun) — ☾ (a crescent moon) — ★ (a five-point star) — ⚡ (a forked storm).\nThey are deep, deliberate, and arranged exactly like a combination.",
      pos: [22, 16],
    },
    {
      id: "statue_shelf",
      name: "Statue shelf",
      kind: "bookshelf",
      initialState: "statues disordered",
      inspect:
        "A heavy oak shelf with four alcoves, left to right. In them stand small stone statues, currently in the order: falcon, owl, lion, serpent. Beneath the alcoves run four symbol-shaped slots: ☉ ☾ ★ ⚡. A bronze plate on the shelf's base reads: “SET THE ORDER AND THE WAY OPENS.”",
      inspectByState: {
        "statues disordered":
          "A heavy oak shelf with four alcoves. The statues stand: falcon, owl, lion, serpent. Beneath the alcoves run four symbol-shaped slots: ☉ ☾ ★ ⚡. Bronze plate: “SET THE ORDER AND THE WAY OPENS.”",
      },
      pos: [55, 45],
    },
    {
      id: "dustcloth",
      name: "Dustcloth",
      kind: "misc",
      initialState: "draped over the writing table",
      inspect:
        "A heavy dustcloth draped over the writing table. Its outline is wrong — something rigid and rectangular hides beneath the folds.",
      inspectByState: {
        removed: "The dustcloth lies in a heap. The writing table's brass plaque is exposed.",
      },
      pos: [80, 66],
    },
    {
      id: "plaque",
      name: "Brass plaque",
      kind: "note",
      initialState: "hidden",
      hidden: true,
      inspect:
        "An engraved brass plaque, green with age:\n“THE SUN RISES OVER THE LION.\nTHE MOON COILS BESIDE THE SERPENT.\nTHE STAR WATCHES THE OWL.\nTHE STORM CARRIES THE FALCON.\n— set them as the heavens set them.”",
      pos: [80, 72],
    },
    {
      id: "orrery",
      name: "Broken orrery",
      kind: "globe",
      initialState: "jammed",
      inspect:
        "A brass orrery, arms bent, planets missing. One remaining sphere is stamped ☉. It is decorative. The jam tells you nothing about symbols or statues.",
      pos: [35, 70],
    },
    {
      id: "star_chart",
      name: "Torn star chart",
      kind: "note",
      initialState: "torn",
      inspect:
        "Half a star chart pinned to the wall. The torn half would have shown something; this half shows Ursa Major and a coffee ring.",
      pos: [65, 14],
    },
  ],
  rules: [
    {
      id: "r05-inspect-door",
      action: "inspect",
      target: "door",
      message:
        "You shoulder it, study it, pry at it. The door is barred from the outside with a beam the width of a leg. No lock, no hinges on this side. This door is scenery.",
      effects: [],
    },
    {
      id: "r05-remove-cloth",
      action: "interact",
      target: "dustcloth",
      when: { objectState: { dustcloth: "draped over the writing table" } },
      message: "You whip the dustcloth away. Beneath it, set into the writing table, a brass plaque catches the light.",
      once: true,
      effects: [
        { type: "setState", target: "dustcloth", value: "removed" },
        { type: "reveal", target: "plaque" },
      ],
    },
    {
      id: "r05-shelf-symbols-wrong",
      action: "input",
      target: "statue_shelf",
      when: { value: "sun,moon,star,storm", objectState: { statue_shelf: "statues disordered" } },
      success: false,
      message:
        "You push the statues to mirror the wall symbols and press them into the slots. A spring SLAMS the shelf's frame shut and the statues reset, disordered. Bronze letters flicker on the plate: “THE SLOTS ARE KEYS, NOT ANSWERS. THE HEAVENS SPEAK IN LIVING FORMS.”",
      critical: true,
      effects: [],
    },
    {
      id: "r05-shelf-generic-wrong",
      action: "input",
      target: "statue_shelf",
      when: { valueNot: "lion,serpent,owl,falcon", objectState: { statue_shelf: "statues disordered" } },
      success: false,
      message:
        "You set the order and press. The shelf groans, rejects it, and resets the statues. Incorrect arrangement.",
      effects: [],
    },
    {
      id: "r05-shelf-correct",
      action: "input",
      target: "statue_shelf",
      when: { value: "lion,serpent,owl,falcon", objectState: { statue_shelf: "statues disordered" } },
      message:
        "Lion, serpent, owl, falcon — sun, moon, star, storm, as the heavens set them. The slots accept the statues with four soft clicks. The whole shelf swings inward on hidden hinges, breathing cold night air: a moonlit passage. You step through. ESCAPED.",
      once: true,
      effects: [
        { type: "setState", target: "statue_shelf", value: "opened" },
        { type: "unlockPuzzle", target: "shelf_puzzle" },
        { type: "escape" },
      ],
    },
  ],
  doors: [{ id: "door", name: "Barred door", locked: true, pos: [8, 45] }],
  criticalObjects: ["wall_symbols", "statue_shelf", "dustcloth", "plaque"],
  evaluation: {
    criticalObjects: ["wall_symbols", "statue_shelf", "dustcloth", "plaque"],
    supportingObjects: [],
    irrelevantObjects: ["orrery", "star_chart"],
  },
  groundTruthSolution: [
    "inspect wall_symbols",
    "inspect statue_shelf",
    "inspect dustcloth",
    "interact dustcloth",
    "inspect plaque",
    "input statue_shelf lion,serpent,owl,falcon",
  ],
  optimalActions: 6,
};
