// ─── Core type system for AI ESCAPE LAB ─────────────────────────────────────

export type ActionType =
  | "inspect"
  | "interact"
  | "move"
  | "use_item"
  | "input"
  | "take"
  | "combine"
  | "submit_answer";

export interface AgentAction {
  action: ActionType;
  target: string;
  value: string | null;
  reason: string | null;
}

/** A declarative object inside a room definition. */
export interface RoomObject {
  id: string;
  name: string;
  /** short visual label / kind hint for the CSS renderer */
  kind: string;
  initialState: string;
  /** if true the object is hidden until revealed by an effect */
  hidden?: boolean;
  /** static description returned by `inspect` */
  inspect?: string;
  /** inspect text per object-state, falls back to `inspect` */
  inspectByState?: Record<string, string>;
  /** item id granted by `take` (object must be takeable) */
  takeable?: boolean;
  /** position hint for the room renderer: [x%, y%] */
  pos?: [number, number];
}

export type EffectType =
  | "setState"        // objectStates[target] = value
  | "reveal"           // make hidden object(s) visible
  | "addItem"          // put item in inventory
  | "removeItem"
  | "setMessage"       // push an event message
  | "unlockPuzzle"     // puzzleStates[id] = true
  | "openDoor"         // doorStates[target] = "open"
  | "escape";          // escaped = true

export interface Effect {
  type: EffectType;
  target?: string;
  value?: string;
  message?: string;
}

export interface Condition {
  /** required objectStates, e.g. { painting: "moved" } */
  objectState?: Record<string, string>;
  /** required inventory items */
  hasItem?: string[];
  /** consume these items when the rule fires */
  consumeItem?: string[];
  /** required puzzle flags */
  puzzleSolved?: string[];
  /** for input rules: exact expected value */
  value?: string;
  /** for wrong-code rules: fires when value is anything except this */
  valueNot?: string;
}

/** Declarative interaction rule attached to a room. */
export interface Rule {
  id: string;
  /** which action triggers it */
  action: ActionType;
  /** object id the action targets */
  target: string;
  /** extra conditions beyond target visibility */
  when?: Condition;
  /** message returned on success */
  message: string;
  /** defaults to true; set false for failed-attempt rules (wrong code etc.) */
  success?: boolean;
  effects: Effect[];
  /** if true, rule fires only once */
  once?: boolean;
  /** if true, firing this rule counts as a critical mistake (e.g. wrong chest, wrong code with penalty) */
  critical?: boolean;
}

export interface DoorDef {
  id: string;
  name: string;
  /** rule id or inline condition that opens it */
  locked: boolean;
  pos?: [number, number];
}

export interface RoomCase {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  difficulty: "tutorial" | "easy" | "medium" | "hard";
  maxActions: number;
  /** capabilities this room benchmarks */
  tags: string[];
  objects: RoomObject[];
  rules: Rule[];
  doors: DoorDef[];
  /** object ids on the critical escape path — used for information efficiency */
  criticalObjects: string[];
  /** canonical minimal solution (action strings, for reference/report) */
  groundTruthSolution: string[];
  /** minimum number of actions a perfect solver needs */
  optimalActions: number;
}

// ─── Runtime state ──────────────────────────────────────────────────────────

export interface RoomState {
  currentRoom: string;
  discoveredObjects: string[];
  hiddenObjects: string[];
  inventory: string[];
  objectStates: Record<string, string>;
  puzzleStates: Record<string, boolean>;
  doorStates: Record<string, "locked" | "open">;
  firedRules: string[];
  inspectedObjects: string[];
  actionCount: number;
  maxActions: number;
  escaped: boolean;
  failed: boolean;
}

export interface ObservedObject {
  id: string;
  name: string;
  kind: string;
  state: string;
}

export interface Observation {
  room: string;
  description: string;
  visible_objects: ObservedObject[];
  doors: { id: string; name: string; state: string }[];
  inventory: string[];
  recent_events: string[];
  actions_remaining: number;
  escaped: boolean;
}

export interface ActionResult {
  success: boolean;
  message: string;
  /** true when the environment rejected the action as illegal/invalid */
  invalid?: boolean;
  events: string[];
  stateChanges: string[];
  escaped?: boolean;
  failed?: boolean;
  /** set when a matched rule is flagged critical */
  criticalMistake?: boolean;
}

// ─── Run trace / replay / benchmark ─────────────────────────────────────────

export type AgentKind = "qwen" | "mock" | "human";

export interface StepRecord {
  timestamp: number;
  step: number;
  agent: AgentKind;
  observation: Observation;
  action: AgentAction;
  reason: string | null;
  response: ActionResult;
  stateChanges: string[];
  scoreDelta: number;
  /** classification used by metrics */
  classification: "useful" | "irrelevant" | "invalid" | "repeated";
}

export interface RunMetrics {
  success: boolean;
  actions: number;
  maxActions: number;
  usefulActions: number;
  irrelevantActions: number;
  invalidActions: number;
  repeatedActions: number;
  criticalMistakes: number;
  selfCorrections: number;
  formatErrors: number;
  hintUsage: number;
  durationMs: number;
  informationEfficiency: number; // 0..1
  actionEfficiency: number;      // 0..1
}

export interface RunScore {
  total: number;
  breakdown: {
    success: number;
    actionEfficiency: number;
    informationEfficiency: number;
    reasoningQuality: number;
    selfCorrection: number;
    ruleCompliance: number;
  };
}

export interface RunRecord {
  runId: string;
  benchmark: "AI ESCAPE LAB";
  model: string;
  agent: AgentKind;
  roomId: string;
  roomTitle: string;
  timestamp: number;
  metrics: RunMetrics;
  score: RunScore;
  steps: StepRecord[];
}

export interface BenchmarkReport {
  benchmark: "AI ESCAPE LAB";
  model: string;
  timestamp: string;
  summary: {
    rooms: number;
    escaped: number;
    escape_rate: number;
    average_score: number;
    average_actions: number;
    invalid_action_rate: number;
    repeated_action_rate: number;
    self_correction_rate: number;
    information_efficiency: number;
    format_reliability: number;
  };
  runs: RunRecord[];
}
