import type { AgentAction, AgentKind, PublicObservation } from "@/engine/types";

/**
 * AgentContext — the ONLY data a provider receives.
 * Contains the PublicObservation plus public history. It must NEVER include
 * RoomCase, RoomState, rules, groundTruthSolution, criticalObjects,
 * optimalActions, hiddenObjects, puzzleStates or expected answers.
 */
export interface AgentContext {
  roomId: string;
  roomTitle: string;
  observation: PublicObservation;
  /** compact history of previous actions + results, newest last */
  history: { step: number; action: AgentAction; result: string; success: boolean }[];
  step: number;
}

export interface TokenUsage {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
}

export interface AgentDecision {
  action: AgentAction;
  formatErrors: number;
  /** real token usage from the API; null when unavailable (never estimated) */
  usage?: TokenUsage;
}

export interface AIProvider {
  readonly kind: AgentKind;
  readonly model: string;
  generateAction(context: AgentContext): Promise<AgentDecision>;
}
