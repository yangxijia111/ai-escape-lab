import type {
  ActionResult,
  AgentAction,
  FailureType,
  RoomCase,
  RunFailure,
  RunMetrics,
  RunScore,
  SelfCorrectionEvent,
  StepRecord,
} from "./types";
import { formatAction } from "./replay.ts";

/**
 * Classify a single step for metrics.
 *  invalid    — environment rejected the action as illegal
 *  repeated   — identical (action,target,value) already performed
 *  useful     — succeeded AND (changed state / hit a critical object / escaped)
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
 * STRICT self-correction detection — behavior-based only (rationale text is
 * never parsed). A valid SelfCorrectionEvent requires ALL of:
 *   1. an explicit failure / critical mistake at step F
 *   2. step F+1 is NOT an identical repeat of the failed (action,target,value)
 *   3. within the next N steps the agent performs a recovery behavior:
 *        - inspects/interacts with a target it never acted on before, OR
 *        - retries the same puzzle target with a DIFFERENT value
 *   4. that recovery behavior is followed by positive progress
 *      (a step with state changes, or escape) later in the run
 */
export function detectSelfCorrections(steps: StepRecord[], window = 4): SelfCorrectionEvent[] {
  const events: SelfCorrectionEvent[] = [];
  const isFailure = (s: StepRecord) => !s.response.success || Boolean(s.response.criticalMistake);

  for (let f = 0; f < steps.length; f++) {
    const failed = steps[f];
    if (!isFailure(failed)) continue;
    // budget-exhaustion / post-failure noise cannot be "corrected"
    if (failed.response.failed && failed.response.invalid) continue;

    const next = steps[f + 1];
    if (!next) continue;
    const identical = (a: StepRecord, b: StepRecord) =>
      a.action.action === b.action.action &&
      a.action.target === b.action.target &&
      a.action.value === b.action.value;
    if (identical(failed, next)) continue; // blind retry — not a correction

    // targets acted on strictly before the failure
    const knownTargets = new Set(steps.slice(0, f + 1).map((s) => `${s.action.action}:${s.action.target}`));

    let recoveryIdx = -1;
    const limit = Math.min(steps.length - 1, f + window);
    for (let k = f + 1; k <= limit; k++) {
      const s = steps[k];
      const novelGather =
        (s.action.action === "inspect" || s.action.action === "interact" || s.action.action === "take") &&
        !knownTargets.has(`${s.action.action}:${s.action.target}`);
      const differentRetry =
        s.action.action === failed.action.action &&
        s.action.target === failed.action.target &&
        s.action.value !== failed.action.value &&
        failed.action.value !== null;
      if (novelGather || differentRetry) {
        recoveryIdx = k;
        break;
      }
    }
    if (recoveryIdx < 0) continue;

    // require positive progress at or after the recovery step
    const progressed = steps
      .slice(recoveryIdx)
      .some((s) => s.response.stateChanges.length > 0 || s.response.escaped);
    if (!progressed) continue;

    events.push({
      failedStep: failed.step,
      recoveryStep: steps[recoveryIdx].step,
      failedAction: formatAction(failed.action),
      recoveryAction: formatAction(steps[recoveryIdx].action),
    });
    // skip past this recovery so one failure yields at most one event
    f = recoveryIdx;
  }
  return events;
}

/** @deprecated kept for compatibility — use detectSelfCorrections().length */
export function countSelfCorrections(steps: StepRecord[]): number {
  return detectSelfCorrections(steps).length;
}

/**
 * Information Efficiency (leak-safe, repeat-safe):
 *   coverage    = unique critical objects explored / total critical objects
 *   noiseRatio  = unique irrelevant objects explored /
 *                 max(1, criticalExplored + supportingExplored + irrelevantExplored)
 *   IE = clamp01(coverage * (1 − 0.5 * noiseRatio))
 * Repeating the same object never increases the score (unique targets only).
 */
export function computeInformationEfficiency(room: RoomCase, steps: StepRecord[]): number {
  const ev = room.evaluation ?? { criticalObjects: room.criticalObjects };
  const critical = new Set(ev.criticalObjects);
  const supporting = new Set(ev.supportingObjects ?? []);
  const irrelevant = new Set(ev.irrelevantObjects ?? []);

  // unique, non-invalid exploration targets
  const explored = new Set<string>();
  for (const s of steps) {
    if (s.classification === "invalid") continue;
    explored.add(s.action.target);
  }
  const criticalExplored = [...explored].filter((t) => critical.has(t)).length;
  const supportingExplored = [...explored].filter((t) => supporting.has(t)).length;
  const irrelevantExplored = [...explored].filter((t) => irrelevant.has(t)).length;

  const coverage = critical.size ? criticalExplored / critical.size : 1;
  const noiseRatio =
    irrelevantExplored / Math.max(1, criticalExplored + supportingExplored + irrelevantExplored);
  return round2(clamp01(coverage * (1 - 0.5 * noiseRatio)));
}

/**
 * Exploration Efficiency (0..1) — penalizes wasted exploration overall:
 *   1 − (0.4·irrelevantRatio + 0.3·repeatedRatio + 0.3·invalidRatio)
 */
export function computeExplorationEfficiency(m: {
  actions: number;
  irrelevantActions: number;
  repeatedActions: number;
  invalidActions: number;
}): number {
  if (m.actions === 0) return 1;
  const irr = m.irrelevantActions / m.actions;
  const rep = m.repeatedActions / m.actions;
  const inv = m.invalidActions / m.actions;
  return round2(clamp01(1 - (0.4 * irr + 0.3 * rep + 0.3 * inv)));
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
  const success = steps.some((s) => s.response.escaped);
  const selfCorrectionEvents = detectSelfCorrections(steps);

  const actionEfficiency = success
    ? Math.min(1, room.optimalActions / Math.max(1, actions))
    : Math.min(0.3, (room.optimalActions / Math.max(1, actions)) * 0.5);

  const base = {
    actions,
    irrelevantActions,
    repeatedActions,
    invalidActions,
  };

  return {
    success,
    actions,
    maxActions: room.maxActions,
    usefulActions,
    irrelevantActions,
    invalidActions,
    repeatedActions,
    criticalMistakes,
    selfCorrections: selfCorrectionEvents.length,
    formatErrors: opts.formatErrors ?? 0,
    hintUsage: opts.hintUsage ?? 0,
    durationMs: opts.durationMs ?? 0,
    informationEfficiency: computeInformationEfficiency(room, steps),
    actionEfficiency: round2(actionEfficiency),
    explorationEfficiency: computeExplorationEfficiency(base),
    selfCorrectionEvents,
  };
}

/**
 * Escape Score 0–100 (v1.1 — rationale text is NEVER scored):
 *   Success                  40
 *   Action Efficiency        20
 *   Information Efficiency   15
 *   Self Correction          10
 *   Rule Compliance          10
 *   Exploration Efficiency    5
 */
export function computeScore(room: RoomCase, metrics: RunMetrics, steps: StepRecord[]): RunScore {
  const success = metrics.success ? 40 : 0;
  const actionEfficiency = Math.round(20 * clamp01(metrics.actionEfficiency));
  const informationEfficiency = Math.round(15 * clamp01(metrics.informationEfficiency));

  // Self correction: if no failure ever occurred, award full marks on success.
  // Otherwise scale by strict recovery events relative to distinct failure clusters.
  let selfCorrection: number;
  const failureCount = steps.filter((s) => !s.response.success || s.response.criticalMistake).length;
  if (failureCount === 0) {
    selfCorrection = metrics.success ? 10 : 0;
  } else {
    const failureClusters = Math.max(1, Math.min(failureCount, metrics.selfCorrections + 1));
    const ratio = clamp01(metrics.selfCorrections / failureClusters);
    selfCorrection = Math.round(10 * (metrics.success ? Math.max(0.5, ratio) : ratio * 0.5));
  }

  // Rule compliance (10): legal targets + valid output format
  const invalidRatio = metrics.actions ? metrics.invalidActions / metrics.actions : 0;
  const compliance = 10 - Math.min(6, invalidRatio * 20) - Math.min(4, metrics.formatErrors * 1);
  const ruleCompliance = Math.max(0, Math.round(compliance));

  const explorationEfficiency = Math.round(5 * clamp01(metrics.explorationEfficiency));

  const total = Math.max(
    0,
    Math.min(
      100,
      success + actionEfficiency + informationEfficiency + selfCorrection + ruleCompliance + explorationEfficiency
    )
  );

  return {
    total,
    breakdown: {
      success,
      actionEfficiency,
      informationEfficiency,
      selfCorrection,
      ruleCompliance,
      explorationEfficiency,
    },
  };
}

/**
 * Rule-based Failure Taxonomy — no LLM involved.
 * Returns primary + secondary failure types for a failed run (null on success).
 */
export function classifyFailure(metrics: RunMetrics, steps: StepRecord[]): RunFailure | null {
  if (metrics.success) return null;
  const found: FailureType[] = [];

  // explicit environment-declared failure types win (e.g. PREMATURE_COMMITMENT)
  for (const s of steps) {
    if (s.response.failureType && !found.includes(s.response.failureType)) {
      found.push(s.response.failureType);
    }
  }
  if (metrics.criticalMistakes > 0 && !found.includes("CRITICAL_MISTAKE")) found.push("CRITICAL_MISTAKE");
  if (metrics.repeatedActions >= 3 && !found.includes("REPEATED_FAILED_ACTION")) found.push("REPEATED_FAILED_ACTION");
  if (metrics.actions > 0 && metrics.irrelevantActions / metrics.actions > 0.5 && !found.includes("OVER_EXPLORATION"))
    found.push("OVER_EXPLORATION");
  if (metrics.actions > 0 && metrics.invalidActions / metrics.actions > 0.25 && !found.includes("INVALID_ACTIONS"))
    found.push("INVALID_ACTIONS");
  if (metrics.formatErrors >= 3 && !found.includes("FORMAT_FAILURE")) found.push("FORMAT_FAILURE");

  // negative feedback with zero strict self-correction events
  const hadNegativeFeedback = steps.some((s) => !s.response.success || s.response.criticalMistake);
  if (hadNegativeFeedback && metrics.selfCorrections === 0 && !found.includes("NO_RECOVERY"))
    found.push("NO_RECOVERY");

  if (metrics.actions >= metrics.maxActions && !found.includes("ACTION_BUDGET_EXCEEDED"))
    found.push("ACTION_BUDGET_EXCEEDED");

  if (found.length === 0) found.push("ACTION_BUDGET_EXCEEDED");
  return { primary: found[0], secondary: found.slice(1) };
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
