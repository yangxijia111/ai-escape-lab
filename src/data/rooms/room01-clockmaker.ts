import type { RoomCase } from "@/engine/types";

export const room01: RoomCase = {
  id: "clockmaker",
  title: "The Clockmaker",
  subtitle: "ROOM 01 · TUTORIAL",
  description:
    "A dimly lit study room. Dust hangs in the air. Somewhere, a mechanism ticks — then stops. The door ahead is sealed.",
  difficulty: "tutorial",
  maxActions: 40,
  tags: ["observation", "clue-combination", "tutorial"],
  objects: [
    {
      id: "clock",
      name: "Broken clock",
      kind: "clock",
      initialState: "stopped at 10:15",
      inspect:
        "An ornate wall clock, its pendulum frozen. The hands are stopped at exactly 10:15. Fresh scratches surround the numeral X.",
      inspectByState: {
        "stopped at 10:15":
          "An ornate wall clock, its pendulum frozen. The hands are stopped at exactly 10:15. Fresh scratches surround the numeral X.",
      },
      pos: [22, 18],
    },
    {
      id: "painting",
      name: "Portrait",
      kind: "painting",
      initialState: "hanging",
      inspect:
        "A stern-faced clockmaker stares back at you. The frame sits slightly crooked — and there are scratches around its edges, as if it has been moved before.",
      inspectByState: {
        moved: "The portrait leans against the wall, revealing what was hidden behind it.",
      },
      pos: [55, 20],
    },
    {
      id: "desk",
      name: "Old wooden desk",
      kind: "desk",
      initialState: "closed",
      inspect: "A heavy oak desk. The single drawer is closed. Ink stains map years of late nights.",
      inspectByState: {
        open: "The drawer hangs open. Empty now, except for ink stains and a false bottom.",
      },
      pos: [30, 62],
    },
    {
      id: "note",
      name: "Folded note",
      kind: "note",
      initialState: "in inventory",
      hidden: true,
      inspect: "The note reads, in careful handwriting: “Time never lies.”",
    },
    {
      id: "safe",
      name: "Wall safe",
      kind: "safe",
      initialState: "locked",
      hidden: true,
      inspect: "A small iron safe set into the wall behind the portrait. A four-digit combination dial glints faintly.",
      inspectByState: {
        unlocked: "The safe door stands open. Empty — but it was not, once.",
      },
      pos: [58, 34],
    },
    {
      id: "brass_key",
      name: "Brass key",
      kind: "key",
      initialState: "in inventory",
      hidden: true,
      inspect: "A heavy brass key, still warm. Its teeth are cut in an unusual clock-gear pattern.",
    },
  ],
  rules: [
    {
      id: "r01-move-painting",
      action: "interact",
      target: "painting",
      when: { objectState: { painting: "hanging" } },
      message: "You push the portrait aside. It scrapes against the wall — revealing a small iron safe hidden behind it.",
      once: true,
      effects: [
        { type: "setState", target: "painting", value: "moved" },
        { type: "reveal", target: "safe" },
      ],
    },
    {
      id: "r01-open-desk",
      action: "interact",
      target: "desk",
      when: { objectState: { desk: "closed" } },
      message: "The drawer slides open with a groan. Inside lies a folded note.",
      once: true,
      effects: [
        { type: "setState", target: "desk", value: "open" },
        { type: "addItem", target: "note" },
      ],
    },
    {
      id: "r01-safe-correct",
      action: "input",
      target: "safe",
      when: { value: "1015", objectState: { safe: "locked" } },
      message: "1-0-1-5. The dial clicks. The safe swings open — inside rests a heavy brass key.",
      once: true,
      effects: [
        { type: "setState", target: "safe", value: "unlocked" },
        { type: "unlockPuzzle", target: "safe_puzzle" },
        { type: "addItem", target: "brass_key" },
      ],
    },
    {
      id: "r01-safe-wrong",
      action: "input",
      target: "safe",
      when: { valueNot: "1015", objectState: { safe: "locked" } },
      success: false,
      message: "The dial resists. Incorrect combination.",
      effects: [],
    },
    {
      id: "r01-use-key",
      action: "use_item",
      target: "brass_key",
      when: { value: "door", hasItem: ["brass_key"], puzzleSolved: ["safe_puzzle"] },
      message: "The brass key slides into the lock and turns with a satisfying, mechanical click. The door is unlocked.",
      once: true,
      effects: [
        { type: "openDoor", target: "door" },
        { type: "removeItem", target: "brass_key" },
      ],
    },
  ],
  doors: [{ id: "door", name: "Sealed door", locked: true, pos: [84, 45] }],
  criticalObjects: ["clock", "painting", "desk", "safe", "note"],
  groundTruthSolution: [
    "inspect clock",
    "interact painting",
    "interact desk",
    "inspect note",
    "input safe 1015",
    "use_item brass_key door",
    "move door",
  ],
  optimalActions: 6,
};
