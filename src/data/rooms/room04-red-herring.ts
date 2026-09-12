import type { RoomCase } from "@/engine/types";

/**
 * Room 04 — The Red Herring
 * Benchmarks distraction resistance & information efficiency.
 * 16 explorable objects; the escape path touches only 4:
 *   gramophone → loose_brick → vent → door
 * The newspaper screams "SECRET PASSAGE BEHIND BOOKCASE" — it is a lie.
 */
export const room04: RoomCase = {
  id: "red-herring",
  title: "The Red Herring",
  subtitle: "ROOM 04 · DISTRACTION",
  description:
    "A collector's parlour crammed with curiosities. Every surface demands attention. The exit door is barred from the other side — you can see the iron locking bar through the keyhole.",
  difficulty: "hard",
  maxActions: 40,
  tags: ["distraction-resistance", "information-efficiency", "signal-vs-noise"],
  objects: [
    {
      id: "gramophone",
      name: "Gramophone",
      kind: "gramophone",
      initialState: "silent",
      inspect:
        "A brass-horn gramophone, crank intact. The record on the turntable has a hand-written label: “SIDE B — the brick that sings.”",
      inspectByState: {
        playing: "The gramophone crackles through a warped waltz. The label reads: “SIDE B — the brick that sings.”",
      },
      pos: [16, 55],
    },
    {
      id: "loose_brick",
      name: "Sooty brick",
      kind: "brick",
      initialState: "flush with the wall",
      inspect:
        "One brick beside the fireplace sits a millimetre proud of the others. Faint soot traces arc away from it, as if it has been pulled out and pushed back — many times.",
      inspectByState: {
        pivoted: "The brick hangs open on a hidden pivot. The niche behind it is empty now.",
      },
      pos: [36, 40],
    },
    {
      id: "fireplace",
      name: "Cold fireplace",
      kind: "fireplace",
      initialState: "cold",
      inspect: "Ash, cold for years. You rake it with the poker — nothing but clinker and a mouse bone.",
      pos: [30, 70],
    },
    {
      id: "vent",
      name: "Iron vent grate",
      kind: "vent",
      initialState: "screwed shut",
      inspect:
        "A small ventilation grate near the floor, screws rusted but the slots square-headed — removable with the right tool. Cold air moves behind it, toward the door.",
      inspectByState: {
        open: "The grate lies on the floor. Beyond it, a narrow service channel runs straight to the back of the door — you can see the iron locking bar.",
      },
      pos: [66, 80],
    },
    {
      id: "iron_handle",
      name: "Square-headed handle",
      kind: "key",
      initialState: "in inventory",
      hidden: true,
      inspect: "A T-shaped iron handle with a square drive head. It fits something rusted and mechanical.",
    },
    {
      id: "newspaper",
      name: "Framed newspaper",
      kind: "note",
      initialState: "framed",
      inspect:
        "YELLOWED FRONT PAGE, framed in gilt: “MANOR SECRET REVEALED — PASSAGE FOUND BEHIND BOOKCASE! Owner swears the shelves swing open.” Someone has circled the headline in red ink. Twice.",
      pos: [50, 12],
    },
    {
      id: "bookcase",
      name: "Oak bookcase",
      kind: "bookshelf",
      initialState: "full",
      inspect: "Dull histories of tax law. You press, push, pull, and pivot every book. The case does not budge. It is, and always was, just a bookcase.",
      pos: [62, 25],
    },
    {
      id: "dusty_mirror",
      name: "Dusty mirror",
      kind: "mirror",
      initialState: "clouded",
      inspect: "You wipe the glass. Your own face looks back, faintly disappointed. No writing, no two-way glass — just a mirror.",
      pos: [8, 20],
    },
    {
      id: "chandelier",
      name: "Crystal chandelier",
      kind: "lamp",
      initialState: "dim",
      inspect: "Forty crystals, forty dust-caps. You squint up. Nothing hangs from it but light.",
      pos: [45, 5],
    },
    {
      id: "taxidermy_owl",
      name: "Taxidermy owl",
      kind: "misc",
      initialState: "watching",
      inspect: "Glass eyes follow nothing. You lift a wing: a small tag reads “PROPERTY OF THE MANOR — NOT A CLUE.” The taxidermist had a sense of humour.",
      pos: [80, 18],
    },
    {
      id: "globe_bar",
      name: "Globe bar",
      kind: "globe",
      initialState: "closed",
      inspect: "The globe swings open on brass hinges. Inside: one evaporated bottle and a coaster reading “DRINK ME — later.” No key, no map, no passage.",
      pos: [88, 62],
    },
    {
      id: "wine_rack",
      name: "Wine rack",
      kind: "misc",
      initialState: "mostly empty",
      inspect: "Four dusty bottles, labels torn off. You rotate each. The rack does not click, swing, or reveal. It holds wine. That is all it has ever done.",
      pos: [10, 75],
    },
    {
      id: "chess_board",
      name: "Unfinished chess game",
      kind: "misc",
      initialState: "mid-game",
      inspect: "White to move and winning. You consider 1. Qh7#… but this is a locked room, not a chess problem. The pieces are glued down anyway.",
      pos: [55, 55],
    },
    {
      id: "candelabra",
      name: "Silver candelabra",
      kind: "lamp",
      initialState: "lit",
      inspect: "Three candles, burned to different heights. You lift it, twist it, pull each sconce. Solid silver, zero secrets.",
      pos: [38, 58],
    },
    {
      id: "telescope",
      name: "Brass telescope",
      kind: "misc",
      initialState: "pointed at the window",
      inspect: "You look through it: the window is painted shut and the lens points at a brick wall. Etched on the eyepiece: “FOR DECORATION.”",
      pos: [90, 30],
    },
    {
      id: "music_box",
      name: "Music box",
      kind: "misc",
      initialState: "closed",
      inspect: "It plays three notes of a lullaby, then the cylinder slips. Inside the lid: “MADE IN GERMANY” and nothing else.",
      pos: [22, 30],
    },
    {
      id: "stuffed_fox",
      name: "Stuffed fox",
      kind: "misc",
      initialState: "snarling",
      inspect: "You check the fox's mouth, paws, and tail. Sawdust and disappointment. Its glass eyes judge your search strategy.",
      pos: [72, 65],
    },
    {
      id: "portrait_widow",
      name: "Portrait of a widow",
      kind: "painting",
      initialState: "hanging",
      inspect: "Mourning black, unreadable expression. You tilt the frame — no safe, no note, no scratches. The wall behind is unbroken plaster.",
      pos: [25, 12],
    },
  ],
  rules: [
    {
      id: "r04-play-gramophone",
      action: "interact",
      target: "gramophone",
      when: { objectState: { gramophone: "silent" } },
      message:
        "You crank the gramophone. A warped waltz fills the room — and one note makes a brick beside the fireplace audibly BUZZ in sympathy. The brick that sings.",
      once: true,
      effects: [{ type: "setState", target: "gramophone", value: "playing" }],
    },
    {
      id: "r04-pivot-brick",
      action: "interact",
      target: "loose_brick",
      message:
        "The brick pivots on a hidden pin. In the niche behind it lies a square-headed iron handle.",
      once: true,
      effects: [
        { type: "setState", target: "loose_brick", value: "pivoted" },
        { type: "addItem", target: "iron_handle" },
      ],
    },
    {
      id: "r04-open-vent",
      action: "use_item",
      target: "iron_handle",
      when: { value: "vent", hasItem: ["iron_handle"], objectState: { vent: "screwed shut" } },
      message:
        "The square drive fits the grate screws perfectly. The grate comes free — behind it, a service channel runs to the back of the door, where the iron locking bar sits exposed.",
      once: true,
      effects: [{ type: "setState", target: "vent", value: "open" }],
    },
    {
      id: "r04-lift-bar",
      action: "interact",
      target: "door",
      when: { objectState: { vent: "open" } },
      message:
        "You reach through the vent channel with the handle and lever the iron locking bar upward. It falls away with a tremendous CLANG. The door is unlocked.",
      once: true,
      effects: [{ type: "openDoor", target: "door" }],
    },
  ],
  doors: [{ id: "door", name: "Barred door", locked: true, pos: [84, 45] }],
  criticalObjects: ["gramophone", "loose_brick", "vent"],
  evaluation: {
    criticalObjects: ["gramophone", "loose_brick", "vent"],
    supportingObjects: ["fireplace"],
    irrelevantObjects: [
      "newspaper",
      "bookcase",
      "dusty_mirror",
      "chandelier",
      "taxidermy_owl",
      "globe_bar",
      "wine_rack",
      "chess_board",
      "candelabra",
      "telescope",
      "music_box",
      "stuffed_fox",
      "portrait_widow",
    ],
  },
  groundTruthSolution: [
    "inspect gramophone",
    "interact gramophone",
    "interact loose_brick",
    "use_item iron_handle vent",
    "interact door",
    "move door",
  ],
  optimalActions: 6,
};
