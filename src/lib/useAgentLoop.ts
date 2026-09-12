"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildObservation,
  executeAction,
  initialState,
} from "@/engine/environment";
import { classifyFailure, classifyStep, computeMetrics, computeScore } from "@/engine/scoring";
import { scoreDeltaForStep } from "@/engine/replay";
import { newRunId, saveRun } from "@/lib/storage";
import { BENCHMARK_VERSION } from "@/config/benchmark";
import { PROMPT_VERSION, QWEN_MAX_TOKENS, QWEN_TEMPERATURE } from "@/agents/prompts";
import type { AIProvider } from "@/agents/provider";
import type {
  ActionResult,
  AgentAction,
  AgentKind,
  Observation,
  RoomCase,
  RoomState,
  RunRecord,
  RunType,
  StepRecord,
} from "@/engine/types";

const MAX_CONSECUTIVE_INVALID = 5;

export type LoopStatus = "idle" | "thinking" | "acting" | "paused" | "finished";

export interface AgentLoop {
  room: RoomCase;
  state: RoomState;
  observation: Observation;
  steps: StepRecord[];
  status: LoopStatus;
  agentKind: AgentKind;
  runId: string;
  finalRun: RunRecord | null;
  lastResult: ActionResult | null;
  /** human mode: submit an action from the UI */
  humanAct: (action: AgentAction) => void;
  /** AI mode controls */
  runAgentStep: () => Promise<void>;
  runAgentAutomatically: () => void;
  pauseAgent: () => void;
  resumeAgent: () => void;
  resetRoom: () => void;
}

interface LoopOptions {
  room: RoomCase;
  agent: AgentKind; // "mock" | "qwen" | "human"
  provider?: AIProvider | null;
  modelLabel: string;
  autoStart?: boolean;
  stepDelayMs?: [number, number]; // visual delay range for auto mode
}

export function useAgentLoop(opts: LoopOptions): AgentLoop {
  const { room, agent, provider, modelLabel, stepDelayMs = [500, 1500] } = opts;

  const [runId] = useState(() => newRunId());
  const [state, setState] = useState<RoomState>(() => initialState(room));
  const [steps, setSteps] = useState<StepRecord[]>([]);
  const [status, setStatus] = useState<LoopStatus>("idle");
  const [lastResult, setLastResult] = useState<ActionResult | null>(null);
  const [finalRun, setFinalRun] = useState<RunRecord | null>(null);
  const [recentEvents, setRecentEvents] = useState<string[]>(["You wake up in the room."]);

  // refs mirror state for the async auto-loop
  const stateRef = useRef(state);
  const stepsRef = useRef(steps);
  const eventsRef = useRef(recentEvents);
  const runningRef = useRef(false);
  const pausedRef = useRef(false);
  const formatErrorsRef = useRef(0);
  const usageRef = useRef({ promptTokens: 0, completionTokens: 0, totalTokens: 0, sawUsage: false });
  const startedAtRef = useRef<number>(Date.now());
  const finishedRef = useRef(false);
  stateRef.current = state;
  stepsRef.current = steps;
  eventsRef.current = recentEvents;

  const observation = buildObservation(room, state, recentEvents);

  const finalize = useCallback(
    (finalState: RoomState, finalSteps: StepRecord[]) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      const finishedAt = Date.now();
      const metrics = computeMetrics(room, finalSteps, {
        formatErrors: formatErrorsRef.current,
        durationMs: finishedAt - startedAtRef.current,
      });
      const score = computeScore(room, metrics, finalSteps);
      const failure = classifyFailure(metrics, finalSteps);
      // Demo/Human runs are strictly separated from official benchmark runs.
      const runType: RunType = agent === "qwen" ? "benchmark" : agent === "mock" ? "demo" : "human";
      const isQwen = agent === "qwen";
      const u = usageRef.current;
      const record: RunRecord = {
        runId,
        benchmark: "AI ESCAPE LAB",
        runType,
        model: modelLabel,
        agent,
        roomId: room.id,
        roomTitle: room.title,
        timestamp: finishedAt,
        metadata: {
          benchmarkVersion: BENCHMARK_VERSION,
          promptVersion: PROMPT_VERSION,
          provider: agent,
          model: modelLabel,
          temperature: isQwen ? QWEN_TEMPERATURE : null,
          maxTokens: isQwen ? QWEN_MAX_TOKENS : null,
          promptTokens: u.sawUsage ? u.promptTokens : null,
          completionTokens: u.sawUsage ? u.completionTokens : null,
          totalTokens: u.sawUsage ? u.totalTokens : null,
          formatRetries: formatErrorsRef.current,
          startedAt: startedAtRef.current,
          finishedAt,
        },
        metrics,
        score,
        failure,
        steps: finalSteps,
      };
      saveRun(record);
      setFinalRun(record);
      setStatus("finished");
      runningRef.current = false;
      void finalState;
    },
    [room, agent, modelLabel, runId]
  );

  /** Core single-step pipeline shared by human & AI. */
  const applyAction = useCallback(
    (action: AgentAction, actor: AgentKind): { done: boolean } => {
      const prevSteps = stepsRef.current;
      const prevState = stateRef.current;
      const { state: nextState, result } = executeAction(room, prevState, action);

      const classification = classifyStep(
        room,
        { action, result },
        prevSteps.map((s) => ({ action: s.action }))
      );

      const record: StepRecord = {
        timestamp: Date.now(),
        step: prevSteps.length + 1,
        agent: actor,
        observation: buildObservation(room, prevState, eventsRef.current),
        action,
        reason: action.reason,
        response: result,
        stateChanges: result.stateChanges,
        scoreDelta: scoreDeltaForStep(classification),
        classification,
      };

      const nextSteps = [...prevSteps, record];
      const events = result.events.length ? result.events : [result.message];

      setState(nextState);
      setSteps(nextSteps);
      setLastResult(result);
      setRecentEvents(events);
      stateRef.current = nextState;
      stepsRef.current = nextSteps;
      eventsRef.current = events;

      const consecutiveInvalid = (() => {
        let n = 0;
        for (let i = nextSteps.length - 1; i >= 0; i--) {
          if (nextSteps[i].classification === "invalid") n++;
          else break;
        }
        return n;
      })();

      if (
        nextState.escaped ||
        nextState.failed ||
        nextState.actionCount >= nextState.maxActions ||
        consecutiveInvalid >= MAX_CONSECUTIVE_INVALID
      ) {
        if (!nextState.escaped && consecutiveInvalid >= MAX_CONSECUTIVE_INVALID) {
          nextState.failed = true;
        }
        finalize(nextState, nextSteps);
        return { done: true };
      }
      return { done: false };
    },
    [room, finalize]
  );

  const humanAct = useCallback(
    (action: AgentAction) => {
      if (finishedRef.current) return;
      applyAction({ ...action, reason: action.reason ?? null }, "human");
    },
    [applyAction]
  );

  const runAgentStep = useCallback(async () => {
    if (!provider || finishedRef.current) return;
    setStatus("thinking");
    const ctx = {
      roomId: room.id,
      roomTitle: room.title,
      observation: buildObservation(room, stateRef.current, eventsRef.current),
      history: stepsRef.current.map((s) => ({
        step: s.step,
        action: s.action,
        result: s.response.message.slice(0, 220),
        success: s.response.success,
      })),
      step: stepsRef.current.length + 1,
    };
    try {
      const decision = await provider.generateAction(ctx);
      formatErrorsRef.current += decision.formatErrors;
      if (decision.usage) {
        usageRef.current.sawUsage = true;
        usageRef.current.promptTokens += decision.usage.promptTokens ?? 0;
        usageRef.current.completionTokens += decision.usage.completionTokens ?? 0;
        usageRef.current.totalTokens += decision.usage.totalTokens ?? 0;
      }
      setStatus("acting");
      applyAction(decision.action, provider.kind);
      if (!finishedRef.current) setStatus("idle");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Agent error";
      setLastResult({ success: false, message: msg, invalid: true, events: [], stateChanges: [] });
      setStatus("idle");
    }
  }, [provider, room, applyAction]);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const autoLoop = useCallback(async () => {
    runningRef.current = true;
    pausedRef.current = false;
    setStatus("acting");
    while (runningRef.current && !finishedRef.current) {
      if (pausedRef.current) {
        await sleep(150);
        continue;
      }
      await runAgentStep();
      if (finishedRef.current || !runningRef.current) break;
      const [lo, hi] = stepDelayMs;
      await sleep(lo + Math.random() * (hi - lo));
    }
    if (!finishedRef.current) setStatus("idle");
  }, [runAgentStep, stepDelayMs]);

  const runAgentAutomatically = useCallback(() => {
    if (runningRef.current || finishedRef.current) return;
    void autoLoop();
  }, [autoLoop]);

  const pauseAgent = useCallback(() => {
    if (!runningRef.current) return;
    pausedRef.current = true;
    setStatus("paused");
  }, []);

  const resumeAgent = useCallback(() => {
    if (!runningRef.current || finishedRef.current) return;
    pausedRef.current = false;
    setStatus("acting");
  }, []);

  const resetRoom = useCallback(() => {
    runningRef.current = false;
    pausedRef.current = false;
    finishedRef.current = false;
    formatErrorsRef.current = 0;
    usageRef.current = { promptTokens: 0, completionTokens: 0, totalTokens: 0, sawUsage: false };
    startedAtRef.current = Date.now();
    const fresh = initialState(room);
    setState(fresh);
    stateRef.current = fresh;
    setSteps([]);
    stepsRef.current = [];
    setLastResult(null);
    setFinalRun(null);
    const ev = ["You wake up in the room."];
    setRecentEvents(ev);
    eventsRef.current = ev;
    setStatus("idle");
  }, [room]);

  // auto start for AI mode
  useEffect(() => {
    if (opts.autoStart && agent !== "human" && provider && !runningRef.current && !finishedRef.current) {
      runAgentAutomatically();
    }
    return () => {
      runningRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    room,
    state,
    observation,
    steps,
    status,
    agentKind: agent,
    runId,
    finalRun,
    lastResult,
    humanAct,
    runAgentStep,
    runAgentAutomatically,
    pauseAgent,
    resumeAgent,
    resetRoom,
  };
}
