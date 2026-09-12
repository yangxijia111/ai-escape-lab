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
  /** brief action rationale — recorded for replay/readability ONLY, never scored */
  reason: string | null;
}

/** A declarative object inside a room definition. */
export interface RoomObject {
  id: string;
  name: string;
  /** short visual label / kind hint for the CSS renderer */
  kind: string;
  /** INTERNAL ground-truth state — never exposed before inspection */
  initialState: string;
  /**
   * State visible to the agent before it inspects the object.
   * Must NOT contain secret information (codes, answers, mappings).
   * Falls back to initialState when omitted (safe by default only for
   * objects whose internal state carries no secrets).
   */
  publicState?: string;
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
  | "fail"             // run enters unrecoverable failed state
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
  /** tags the run with a specific failure type when this (critical) rule fires */
  failureType?: FailureType;
}

export interface DoorDef {
  id: string;
  name: string;
  /** rule id or inline condition that opens it */
  locked: boolean;
  pos?: [number, number];
}

/**
 * Private evaluation metadata. NEVER include this in any agent payload.
 */
export interface RoomEvaluation {
  /** objects on the critical escape path */
  criticalObjects: string[];
  /** objects that legitimately support reasoning but are not strictly required */
  supportingObjects?: string[];
  /** deliberate distractors — exploring them is noise */
  irrelevantObjects?: string[];
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
  /** object ids on the critical escape path — kept for step classification */
  criticalObjects: string[];
  /** private scoring metadata (critical/supporting/irrelevant) — never sent to agents */
  evaluation?: RoomEvaluation;
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
  /** INTERNAL ground-truth object states */
  objectStates: Record<string, string>;
  /** agent-visible object states (synced on inspect / state change) */
  publicStates: Record<string, string>;
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
  /** public state only — never the internal ground-truth state */
  state: string;
}

export interface PublicDoorState {
  id: string;
  name: string;
  state: string;
}

/**
 * PublicObservation — the ONLY environment data an agent is allowed to see.
 * Providers must never receive RoomCase / RoomState / rules / solutions.
 */
export interface PublicObservation {
  room: string;
  description: string;
  visible_objects: ObservedObject[];
  doors: PublicDoorState[];
  inventory: string[];
  recent_events: string[];
  actions_remaining: number;
  escaped: boolean;
}

/** @deprecated name kept for compatibility — identical to PublicObservation */
export type Observation = PublicObservation;

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
  /** set when a matched rule declares a specific failure type */
  failureType?: FailureType;
}

// ─── Run trace / replay / benchmark ─────────────────────────────────────────

export type AgentKind = "qwen" | "mock" | "human";

/**
 * benchmark — real model run (Qwen), counts toward official reports
 * demo      — MockAgent run, NEVER counts toward official reports
 * human     — human playthrough, kept separate from model benchmark
 */
export type RunType = "benchmark" | "demo" | "human";

export interface StepRecord {
  timestamp: number;
  step: number;
  agent: AgentKind;
  observation: PublicObservation;
  action: AgentAction;
  /** brief action rationale — replay/readability only, never scored */
  reason: string | null;
  response: ActionResult;
  stateChanges: string[];
  scoreDelta: number;
  /** classification used by metrics */
  classification: "useful" | "irrelevant" | "invalid" | "repeated";
}

/**
 * A strict self-correction event: explicit failure → no identical repeat →
 * new information gathering or a different attempt → positive progress.
 */
export interface SelfCorrectionEvent {
  failedStep: number;
  recoveryStep: number;
  failedAction: string;
  recoveryAction: string;
}

export type FailureType =
  | "PREMATURE_COMMITMENT"
  | "REPEATED_FAILED_ACTION"
  | "OVER_EXPLORATION"
  | "INVALID_ACTIONS"
  | "FORMAT_FAILURE"
  | "NO_RECOVERY"
  | "ACTION_BUDGET_EXCEEDED"
  | "CRITICAL_MISTAKE";

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
  explorationEfficiency: number; // 0..1
  selfCorrectionEvents: SelfCorrectionEvent[];
}

export interface RunScore {
  total: number;
  breakdown: {
    success: number;               // 40
    actionEfficiency: number;      // 20
    informationEfficiency: number; // 15
    selfCorrection: number;        // 10
    ruleCompliance: number;        // 10
    explorationEfficiency: number; // 5
  };
}

export interface RunFailure {
  primary: FailureType;
  secondary: FailureType[];
}

export interface RunMetadata {
  benchmarkVersion: string;
  promptVersion: string;
  provider: AgentKind;
  model: string;
  temperature: number | null;
  maxTokens: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  formatRetries: number;
  startedAt: number;
  finishedAt: number;
}

export interface RunRecord {
  runId: string;
  benchmark: "AI ESCAPE LAB";
  runType: RunType;
  model: string;
  agent: AgentKind;
  roomId: string;
  roomTitle: string;
  timestamp: number;
  metadata: RunMetadata;
  metrics: RunMetrics;
  score: RunScore;
  failure: RunFailure | null;
  steps: StepRecord[];
}

export interface RoomGroupStats {
  roomId: string;
  roomTitle: string;
  runs: number;
  escaped: number;
  escapeRate: number;
  meanScore: number;
  meanActions: number;
}

export interface BenchmarkSummary {
  rooms: number;
  totalRuns: number;
  successfulRuns: number;
  escaped: number;
  escape_rate: number;
  average_score: number;
  mean_score: number;
  median_score: number;
  average_actions: number;
  mean_actions: number;
  median_actions: number;
  invalid_action_rate: number;
  repeated_action_rate: number;
  self_correction_rate: number;
  information_efficiency: number;
  exploration_efficiency: number;
  critical_mistake_rate: number;
  format_reliability: number;
  byRoom: RoomGroupStats[];
}

export interface BenchmarkReport {
  benchmark: "AI ESCAPE LAB";
  benchmarkVersion: string;
  promptVersion: string;
  provider: AgentKind;
  model: string;
  timestamp: string;
  summary: BenchmarkSummary;
  runs: RunRecord[];
}
