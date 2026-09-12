import type { AgentAction, AgentKind, Observation } from "@/engine/types";

export interface AgentContext {
  roomId: string;
  roomTitle: string;
  observation: Observation;
  /** compact history of previous actions + results, newest last */
  history: { step: number; action: AgentAction; result: string; success: boolean }[];
  step: number;
}

export interface AgentDecision {
  action: AgentAction;
  formatErrors: number;
}

export interface AIProvider {
  readonly kind: AgentKind;
  readonly model: string;
  generateAction(context: AgentContext): Promise<AgentDecision>;
}
