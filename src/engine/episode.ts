import { buildObservation, executeAction, initialState } from "./environment.ts";
import { classifyStep, classifyFailure, computeMetrics, computeScore } from "./scoring.ts";
import { scoreDeltaForStep } from "./replay.ts";
import { BENCHMARK_VERSION } from "../config/benchmark.ts";
import { PROMPT_VERSION, QWEN_MAX_TOKENS, QWEN_TEMPERATURE } from "../agents/prompts.ts";
import type { AIProvider } from "../agents/provider.ts";
import type {
  RoomCase,
  RoomState,
  RunMetadata,
  RunRecord,
  RunType,
  StepRecord,
} from "./types.ts";

const MAX_CONSECUTIVE_INVALID = 5;

/**
 * runEpisode — framework-agnostic single-run executor.
 * Used by the Benchmark Suite runner (browser) and by test scripts (node).
 * The provider only ever receives PublicObservation + public history.
 */
export interface EpisodeOptions {
  room: RoomCase;
  provider: AIProvider;
  runType: RunType;
  modelLabel: string;
  runId: string;
  /** called after each committed step (progress UI / tests) */
  onStep?: (step: StepRecord, state: RoomState) => void;
  /** return true to cancel mid-episode */
  shouldStop?: () => boolean;
  /** visual pacing delay between steps (ms) */
  stepDelayMs?: number;
  /** id of the Benchmark Suite execution; null for manual single-room runs */
  suiteId?: string | null;
}

export interface EpisodeResult {
  run: RunRecord;
  cancelled: boolean;
}

/**
 * Recording guard: a CANCELLED episode is a partial run — it must NEVER be
 * saved to storage, counted as completed, or allowed into an official report.
 */
export function shouldSaveEpisode(result: EpisodeResult): boolean {
  return !result.cancelled;
}

export async function runEpisode(opts: EpisodeOptions): Promise<EpisodeResult> {
  const { room, provider, runType, modelLabel, runId, onStep, shouldStop, stepDelayMs = 0, suiteId = null } = opts;
  const startedAt = Date.now();
  let state = initialState(room);
  let events: string[] = ["You wake up in the room."];
  const steps: StepRecord[] = [];
  let formatErrors = 0;
  const usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let sawUsage = false;
  let cancelled = false;

  while (!state.escaped && !state.failed && state.actionCount < state.maxActions) {
    if (shouldStop?.()) {
      cancelled = true;
      break;
    }
    const observation = buildObservation(room, state, events);
    const decision = await provider.generateAction({
      roomId: room.id,
      roomTitle: room.title,
      observation,
      history: steps.map((s) => ({
        step: s.step,
        action: s.action,
        result: s.response.message.slice(0, 220),
        success: s.response.success,
      })),
      step: steps.length + 1,
    });
    formatErrors += decision.formatErrors;
    if (decision.usage) {
      sawUsage = true;
      usage.promptTokens += decision.usage.promptTokens ?? 0;
      usage.completionTokens += decision.usage.completionTokens ?? 0;
      usage.totalTokens += decision.usage.totalTokens ?? 0;
    }

    const action = decision.action;
    const { state: nextState, result } = executeAction(room, state, action);
    const classification = classifyStep(room, { action, result }, steps.map((s) => ({ action: s.action })));
    const step: StepRecord = {
      timestamp: Date.now(),
      step: steps.length + 1,
      agent: provider.kind,
      observation,
      action,
      reason: action.reason,
      response: result,
      stateChanges: result.stateChanges,
      scoreDelta: scoreDeltaForStep(classification),
      classification,
    };
    steps.push(step);
    state = nextState;
    events = result.events.length ? result.events : [result.message];
    onStep?.(step, state);

    let consecutiveInvalid = 0;
    for (let i = steps.length - 1; i >= 0; i--) {
      if (steps[i].classification === "invalid") consecutiveInvalid++;
      else break;
    }
    if (consecutiveInvalid >= MAX_CONSECUTIVE_INVALID) state = { ...state, failed: true };

    if (stepDelayMs > 0 && !state.escaped && !state.failed) {
      await new Promise((r) => setTimeout(r, stepDelayMs));
    }
  }

  const finishedAt = Date.now();
  const metrics = computeMetrics(room, steps, {
    formatErrors,
    durationMs: finishedAt - startedAt,
  });
  const score = computeScore(room, metrics, steps);
  const failure = classifyFailure(metrics, steps);

  const isQwen = provider.kind === "qwen";
  const metadata: RunMetadata = {
    benchmarkVersion: BENCHMARK_VERSION,
    promptVersion: PROMPT_VERSION,
    provider: provider.kind,
    model: modelLabel,
    temperature: isQwen ? QWEN_TEMPERATURE : null,
    maxTokens: isQwen ? QWEN_MAX_TOKENS : null,
    promptTokens: sawUsage ? usage.promptTokens : null,
    completionTokens: sawUsage ? usage.completionTokens : null,
    totalTokens: sawUsage ? usage.totalTokens : null,
    formatRetries: formatErrors,
    startedAt,
    finishedAt,
    suiteId,
  };

  const run: RunRecord = {
    runId,
    benchmark: "AI ESCAPE LAB",
    runType,
    model: modelLabel,
    agent: provider.kind,
    roomId: room.id,
    roomTitle: room.title,
    timestamp: finishedAt,
    suiteId,
    metadata,
    metrics,
    score,
    failure,
    steps,
  };
  return { run, cancelled };
}
