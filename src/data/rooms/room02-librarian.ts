import type { RoomCase } from "@/engine/types";

/**
 * Room 02 — The Librarian
 * Benchmarks cross-object information combination:
 * the code is derivable ONLY by combining the shelf order, the planetary index,
 * and the wall inscription. No single object contains the answer.
 *
 * Shelf order (left→right): Venus, Mars, Mercury, Earth
 * Index: 1-Mercury 2-Venus 3-Earth 4-Mars
 * Code = catalog numbers of the shelf order = 2 4 1 3 → "2413"
 * "Home is third" confirms Earth = 3 (consistency check).
 */
export const room02: RoomCase = {
  id: "librarian",
  title: "The Librarian",
  subtitle: "ROOM 02 · CROSS-REFERENCE",
  description:
    "Floor-to-ceiling shelves lean under the weight of unread centuries. A reading desk, a locked drawer, and the smell of old paper. The door has no handle — only a small brass plate: “Order is everything.”",
  difficulty: "easy",
  maxActions: 40,
  tags: ["information-combination", "cross-reference", "deduction"],
  objects: [
    {
      id: "bookshelf",
      name: "Great bookshelf",
      kind: "bookshelf",
      initialState: "four books stand out",
      inspect:
        "Rows of rotting ledgers — but four leather volumes are pristine, arranged left to right: “Venus”, “Mars”, “Mercury”, “Earth”. Each spine has a stamped number plate… scraped blank.",
      pos: [18, 30],
    },
    {
      id: "inscription",
      name: "Wall inscription",
      kind: "inscription",
      initialState: "legible",
      inspect:
        "Etched into the plaster between the shelves: “Home is third.” Below it, a faint child's drawing of a planet with one moon.",
      pos: [46, 16],
    },
    {
      id: "reading_desk",
      name: "Reading desk",
      kind: "desk",
      initialState: "tidy",
      inspect: "A lamplit reading desk. A green blotter, a dry inkwell, and a single locked drawer with a four-digit brass lock.",
      inspectByState: {
        searched: "The desk is searched. The drawer's lock awaits four digits.",
      },
      pos: [70, 58],
    },
    {
      id: "drawer",
      name: "Locked drawer",
      kind: "safe",
      initialState: "locked",
      inspect: "A four-digit brass combination lock is set into the drawer. Digits 0–9 on each wheel. Someone has oiled it recently.",
      inspectByState: {
        open: "The drawer is open. Whatever it held, you hold now.",
      },
      pos: [70, 70],
    },
    {
      id: "globe",
      name: "Tarnished globe",
      kind: "globe",
      initialState: "spinning loosely",
      inspect:
        "A celestial globe — not terrestrial. Constellations you half-recognise. A small card slot is glued shut behind the horizon ring… something is inside.",
      pos: [30, 66],
    },
    {
      id: "planetary_index",
      name: "Planetary index card",
      kind: "note",
      initialState: "in inventory",
      hidden: true,
      inspect:
        "A librarian's catalog card, ink fading:\n“INDEX OF THE HEAVENS — catalogued by distance from the Sun:\nI. Mercury\nII. Venus\nIII. Earth\nIV. Mars\n— Shelve by catalog number. Order is everything.”",
    },
    {
      id: "silver_key",
      name: "Silver key",
      kind: "key",
      initialState: "in inventory",
      hidden: true,
      inspect: "A slim silver key on a chain-link ring. The bow is shaped like an open book.",
    },
    {
      id: "ladder",
      name: "Rolling ladder",
      kind: "misc",
      initialState: "parked",
      inspect: "A brass-railed library ladder. The upper shelves hold nothing but dust and dead beetles.",
      pos: [8, 40],
    },
    {
      id: "lamp",
      name: "Green lamp",
      kind: "misc",
      initialState: "lit",
      inspect: "A banker's lamp, still warm. Its bulb flickers when you touch the base — but reveals nothing.",
      pos: [86, 30],
    },
  ],
  rules: [
    {
      id: "r02-open-globe",
      action: "interact",
      target: "globe",
      message:
        "You prise the card slot open. A yellowed index card slips out — “INDEX OF THE HEAVENS”.",
      once: true,
      effects: [
        { type: "setState", target: "globe", value: "opened" },
        { type: "addItem", target: "planetary_index" },
      ],
    },
    {
      id: "r02-search-desk",
      action: "interact",
      target: "reading_desk",
      when: { objectState: { reading_desk: "tidy" } },
      message: "You search the desk. Nothing but blotting paper — and the locked drawer, with its four-digit brass lock.",
      once: true,
      effects: [{ type: "setState", target: "reading_desk", value: "searched" }],
    },
    {
      id: "r02-drawer-correct",
      action: "input",
      target: "drawer",
      when: { value: "2413", objectState: { drawer: "locked" } },
      message:
        "2-4-1-3. Venus, Mars, Mercury, Earth — shelved by catalog number. The lock exhales a click. Inside the drawer: a silver key resting on velvet.",
      once: true,
      effects: [
        { type: "setState", target: "drawer", value: "open" },
        { type: "unlockPuzzle", target: "drawer_puzzle" },
        { type: "addItem", target: "silver_key" },
      ],
    },
    {
      id: "r02-drawer-wrong",
      action: "input",
      target: "drawer",
      when: { valueNot: "2413", objectState: { drawer: "locked" } },
      success: false,
      message: "The wheels spin and settle. Nothing. Incorrect combination.",
      effects: [],
    },
    {
      id: "r02-use-key",
      action: "use_item",
      target: "silver_key",
      when: { value: "door", hasItem: ["silver_key"], puzzleSolved: ["drawer_puzzle"] },
      message: "The silver key fits a hidden keyhole beneath the brass plate. The door unlocks.",
      once: true,
      effects: [
        { type: "openDoor", target: "door" },
        { type: "removeItem", target: "silver_key" },
      ],
    },
  ],
  doors: [{ id: "door", name: "Handle-less door", locked: true, pos: [88, 44] }],
  criticalObjects: ["bookshelf", "globe", "planetary_index", "drawer", "inscription"],
  groundTruthSolution: [
    "inspect bookshelf",
    "inspect inscription",
    "interact globe",
    "inspect planetary_index",
    "input drawer 2413",
    "use_item silver_key door",
    "move door",
  ],
  optimalActions: 7,
};
