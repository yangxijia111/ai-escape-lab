import type {
  ActionResult,
  AgentAction,
  RoomCase,
  RunMetrics,
  RunScore,
  StepRecord,
} from "./types";

/**
 * Classify a single step for metrics.
 *  invalid    — environment rejected the action as illegal
 *  repeated   — identical (action,target,value) already performed
 *  useful     — succeeded AND (changed state / hit a critical object / solved puzzle / escaped)
 *  irrelevant — everything else (distractors, wasted exploration)
 */
export function classifyStep(
  room: RoomCase,
  step: { action: AgentAction; result: ActionResult },
  previous: { action: AgentAction }[]
): StepRecord["classification"] {
  if (step.result.invalid) return "invalid";
  const dup = previous.some(
    (p) =>
      p.action.action === step.action.action &&
      p.action.target === step.action.target &&
      p.action.value === step.action.value
  );
  if (dup) return "repeated";
  if (
    step.result.success &&
    (step.result.stateChanges.length > 0 ||
      room.criticalObjects.includes(step.action.target) ||
      step.result.escaped)
  ) {
    return "useful";
  }
  return "irrelevant";
}

/**
 * Detect self-correction: a failed/critical attempt on target T, followed by
 * later success involving T or the puzzle it gates, with a different value.
 */
export function countSelfCorrections(steps: StepRecord[]): number {
  let corrections = 0;
  const failedTargets = new Set<string>();
  for (const s of steps) {
    const failed = !s.response.success || s.response.criticalMistake;
    if (failed) {
      failedTargets.add(s.action.target);
    } else if (s.response.stateChanges.length > 0 && failedTargets.has(s.action.target)) {
      corrections += 1;
      failedTargets.delete(s.action.target);
    }
  }
  return corrections;
}

export function computeMetrics(
  room: RoomCase,
  steps: StepRecord[],
  opts: { formatErrors?: number; hintUsage?: number; durationMs?: number } = {}
): RunMetrics {
  const actions = steps.length;
  const usefulActions = steps.filter((s) => s.classification === "useful").length;
  const irrelevantActions = steps.filter((s) => s.classification === "irrelevant").length;
  const invalidActions = steps.filter((s) => s.classification === "invalid").length;
  const repeatedActions = steps.filter((s) => s.classification === "repeated").length;
  const criticalMistakes = steps.filter((s) => s.response.criticalMistake).length;
  const success = steps.some((s) => s.response.escaped) ;
  const selfCorrections = countSelfCorrections(steps);

  // action efficiency: how close to the optimal solution length
  const actionEfficiency = success ? Math.min(1, room.optimalActions / Math.max(1, actions)) : Math.min(0.3, room.optimalActions / Math.max(1, actions) * 0.5);
  // information efficiency: share of actions spent on critical objects
  const criticalHits = steps.filter((s) => room.criticalObjects.includes(s.action.target)).length;
  const informationEfficiency = actions === 0 ? 0 : criticalHits / actions;

  return {
    success,
    actions,
    maxActions: room.maxActions,
    usefulActions,
    irrelevantActions,
    invalidActions,
    repeatedActions,
    criticalMistakes,
    selfCorrections,
    formatErrors: opts.formatErrors ?? 0,
    hintUsage: opts.hintUsage ?? 0,
    durationMs: opts.durationMs ?? 0,
    informationEfficiency: round2(informationEfficiency),
    actionEfficiency: round2(actionEfficiency),
  };
}

/**
 * Escape Score 0–100:
 *   Success                 40
 *   Action Efficiency       20
 *   Information Efficiency  15
 *   Reasoning Quality       10
 *   Self Correction         10
 *   Rule Compliance          5
 */
export function computeScore(room: RoomCase, metrics: RunMetrics, steps: StepRecord[]): RunScore {
  const success = metrics.success ? 40 : 0;

  const actionEfficiency = Math.round(20 * clamp01(metrics.actionEfficiency));

  const informationEfficiency = Math.round(15 * clamp01(metrics.informationEfficiency));

  // Reasoning quality: steps that carry a non-trivial reason, minus repeated/critical penalties
  const reasoned = steps.filter((s) => (s.reason ?? "").trim().length >= 10).length;
  const reasonRatio = steps.length ? reasoned / steps.length : 0;
  const repeatPenalty = Math.min(4, metrics.repeatedActions * 1.5);
  const criticalPenalty = Math.min(4, metrics.criticalMistakes * 2);
  const reasoningQuality = Math.max(0, Math.round(10 * reasonRatio - repeatPenalty - criticalPenalty));

  // Self correction: full marks if agent recovered from every failure cluster; scaled by need
  let selfCorrection: number;
  const failureCount = steps.filter((s) => !s.response.success || s.response.criticalMistake).length;
  if (failureCount === 0) {
    selfCorrection = metrics.success ? 10 : 0; // never needed to correct
  } else {
    const ratio = clamp01(metrics.selfCorrections / Math.max(1, Math.min(failureCount, metrics.selfCorrections + 1)));
    selfCorrection = Math.round(10 * (metrics.success ? Math.max(0.5, ratio) : ratio * 0.5));
  }

  // Rule compliance: valid JSON actions, no invalid targets, few format errors
  const invalidRatio = metrics.actions ? metrics.invalidActions / metrics.actions : 0;
  const compliance =
    5 -
    Math.min(3, invalidRatio * 10) -
    Math.min(2, metrics.formatErrors * 0.5);
  const ruleCompliance = Math.max(0, Math.round(compliance));

  const total = Math.max(
    0,
    Math.min(100, success + actionEfficiency + informationEfficiency + reasoningQuality + selfCorrection + ruleCompliance)
  );

  return {
    total,
    breakdown: {
      success,
      actionEfficiency,
      informationEfficiency,
      reasoningQuality,
      selfCorrection,
      ruleCompliance,
    },
  };
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
