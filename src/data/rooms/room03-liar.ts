import type { RoomCase } from "@/engine/types";

/**
 * Room 03 — The Liar
 * Benchmarks contradiction reasoning.
 *
 * Three notes, EXACTLY ONE is true:
 *   Note A (on chest A): "The key is not in chest A."
 *   Note B (on chest B): "The key is in chest A."
 *   Note C (on chest C): "The key is not in chest C."
 *
 * key in A → A false, B true, C true  → two truths  ✗
 * key in B → A true,  B false, C true → two truths  ✗
 * key in C → A true,  B false, C false→ one truth   ✓ unique
 *
 * Wrong chests seal permanently (critical mistake) — brute force is punished.
 */
export const room03: RoomCase = {
  id: "liar",
  title: "The Liar",
  subtitle: "ROOM 03 · CONTRADICTION",
  description:
    "A circular vault room. Three identical iron chests stand on pedestals, each with a pinned note. Above the door, an engraving: “ONLY ONE NOTE SPEAKS TRUE. CHOOSE ONCE — THE WRONG CHEST SEALS FOREVER.”",
  difficulty: "medium",
  maxActions: 30,
  tags: ["contradiction-reasoning", "logic-constraints", "no-brute-force"],
  objects: [
    {
      id: "engraving",
      name: "Door engraving",
      kind: "inscription",
      initialState: "legible",
      inspect:
        "“ONLY ONE NOTE SPEAKS TRUE. CHOOSE ONCE — THE WRONG CHEST SEALS FOREVER.” The letters are deep-cut, emphatic.",
      pos: [78, 14],
    },
    {
      id: "chest_a",
      name: "Chest A",
      kind: "chest",
      initialState: "closed",
      inspect:
        "An iron chest on a stone pedestal. A note is pinned to its lid:\n“NOTE A — The key is not in chest A.”",
      inspectByState: {
        open: "Chest A stands open.",
        sealed: "Chest A is fused shut. Its note has turned to ash. A wrong choice.",
      },
      pos: [20, 40],
    },
    {
      id: "chest_b",
      name: "Chest B",
      kind: "chest",
      initialState: "closed",
      inspect:
        "An iron chest on a stone pedestal. A note is pinned to its lid:\n“NOTE B — The key is in chest A.”",
      inspectByState: {
        open: "Chest B stands open.",
        sealed: "Chest B is fused shut. Its note has turned to ash. A wrong choice.",
      },
      pos: [44, 30],
    },
    {
      id: "chest_c",
      name: "Chest C",
      kind: "chest",
      initialState: "closed",
      inspect:
        "An iron chest on a stone pedestal. A note is pinned to its lid:\n“NOTE C — The key is not in chest C.”",
      inspectByState: {
        open: "Chest C stands open.",
        sealed: "Chest C is fused shut. A wrong choice.",
      },
      pos: [68, 40],
    },
    {
      id: "vault_key",
      name: "Vault key",
      kind: "key",
      initialState: "in inventory",
      hidden: true,
      inspect: "A cold, heavy vault key. Its bow is stamped with a single eye — the one that saw the truth.",
    },
  ],
  rules: [
    {
      id: "r03-open-a-wrong",
      action: "interact",
      target: "chest_a",
      when: { objectState: { chest_a: "closed" } },
      message:
        "The lid rises — empty. Instantly the chest slams shut and the iron fuses into a seamless block. Note A crumbles to ash. A wrong choice. The room remembers.",
      once: true,
      critical: true,
      effects: [{ type: "setState", target: "chest_a", value: "sealed" }],
    },
    {
      id: "r03-open-b-wrong",
      action: "interact",
      target: "chest_b",
      when: { objectState: { chest_b: "closed" } },
      message:
        "The lid rises — empty. The chest slams shut and seals forever. Note B crumbles to ash. A wrong choice. The room remembers.",
      once: true,
      critical: true,
      effects: [{ type: "setState", target: "chest_b", value: "sealed" }],
    },
    {
      id: "r03-open-c-correct",
      action: "interact",
      target: "chest_c",
      when: { objectState: { chest_c: "closed" } },
      message:
        "The lid rises. On velvet, a heavy vault key stamped with a single eye. Note C was the liar — “the key is not in chest C” was false, and exactly one note spoke true.",
      once: true,
      effects: [
        { type: "setState", target: "chest_c", value: "open" },
        { type: "unlockPuzzle", target: "liar_puzzle" },
        { type: "addItem", target: "vault_key" },
      ],
    },
    {
      id: "r03-use-key",
      action: "use_item",
      target: "vault_key",
      when: { value: "door", hasItem: ["vault_key"], puzzleSolved: ["liar_puzzle"] },
      message: "The vault key turns. Somewhere inside the door, tumblers the size of fists fall into place.",
      once: true,
      effects: [
        { type: "openDoor", target: "door" },
        { type: "removeItem", target: "vault_key" },
      ],
    },
  ],
  doors: [{ id: "door", name: "Vault door", locked: true, pos: [84, 52] }],
  criticalObjects: ["chest_a", "chest_b", "chest_c", "engraving"],
  groundTruthSolution: [
    "inspect chest_a",
    "inspect chest_b",
    "inspect chest_c",
    "inspect engraving",
    "interact chest_c",
    "use_item vault_key door",
    "move door",
  ],
  optimalActions: 7,
};
