"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, use, useEffect, useMemo, useRef, useState } from "react";
import { getRoom, ROOMS } from "@/data/rooms";
import { useAgentLoop } from "@/lib/useAgentLoop";
import { MockAgentProvider } from "@/agents/mock";
import { RemoteQwenProvider } from "@/agents/remote";
import type { AIProvider } from "@/agents/provider";
import type { AgentAction, ObservedObject, RunMetrics } from "@/engine/types";
import { computeMetrics } from "@/engine/scoring";
import { formatDuration } from "@/engine/replay";
import RoomView from "@/components/RoomView/RoomView";
import AgentConsole from "@/components/AgentConsole/AgentConsole";
import Timeline from "@/components/Timeline/Timeline";

type Mode = "ai" | "human";

export default function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center text-xs tracking-[0.3em] text-lab-dim uppercase">
          <span className="anim-dot">●</span>&nbsp;LOADING…
        </div>
      }
    >
      <RoomPageInner id={id} />
    </Suspense>
  );
}

function RoomPageInner({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const mode: Mode = searchParams.get("mode") === "human" ? "human" : "ai";
  const room = getRoom(id);

  const [provider, setProvider] = useState<AIProvider | null>(null);
  const [modelLabel, setModelLabel] = useState("MockAgent (Demo Mode)");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (mode === "human") {
        setReady(true);
        return;
      }
      try {
        const res = await fetch("/api/config");
        const cfg = (await res.json()) as { qwenConfigured: boolean; model: string | null };
        if (!cancelled && cfg.qwenConfigured && cfg.model) {
          setProvider(new RemoteQwenProvider(cfg.model));
          setModelLabel(`Qwen · ${cfg.model}`);
        } else if (!cancelled) {
          setProvider(new MockAgentProvider());
        }
      } catch {
        if (!cancelled) setProvider(new MockAgentProvider());
      }
      if (!cancelled) setReady(true);
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  if (!room) {
    return (
      <div className="py-32 text-center">
        <p className="text-lab-red tracking-[0.3em] uppercase">Unknown chamber: {id}</p>
        <Link href="/#rooms" className="mt-4 inline-block border border-lab-line2 px-4 py-2 text-xs tracking-[0.2em] uppercase hover:border-lab-green/60 hover:text-lab-green">
          ← Back to rooms
        </Link>
      </div>
    );
  }

  return (
    <div className="py-4">
      {/* room selector strip */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[10px] tracking-[0.2em] uppercase">
        {ROOMS.map((r) => (
          <Link
            key={r.id}
            href={`/room/${r.id}?mode=${mode}`}
            className={`border px-2 py-1 transition-colors ${
              r.id === room.id
                ? "border-lab-green/70 text-lab-green"
                : "border-lab-line text-lab-dim hover:border-lab-line2 hover:text-lab-text"
            }`}
          >
            {r.title}
          </Link>
        ))}
        <span className="ml-auto flex gap-1.5">
          <Link href={`/room/${room.id}?mode=ai`} className={`border px-2 py-1 ${mode === "ai" ? "border-lab-green/70 text-lab-green" : "border-lab-line text-lab-dim hover:text-lab-text"}`}>
            AI Mode
          </Link>
          <Link href={`/room/${room.id}?mode=human`} className={`border px-2 py-1 ${mode === "human" ? "border-lab-amber/70 text-lab-amber" : "border-lab-line text-lab-dim hover:text-lab-text"}`}>
            Human Mode
          </Link>
        </span>
      </div>

      {!ready ? (
        <div className="flex h-64 items-center justify-center border border-lab-line bg-lab-panel text-xs tracking-[0.3em] text-lab-dim uppercase">
          <span className="anim-dot">●</span>&nbsp;INITIALIZING CHAMBER…
        </div>
      ) : (
        <RoomSession key={`${room.id}-${mode}-${ready ? "r" : ""}`} room={room} mode={mode} provider={provider} modelLabel={modelLabel} />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */

function RoomSession({
  room,
  mode,
  provider,
  modelLabel,
}: {
  room: NonNullable<ReturnType<typeof getRoom>>;
  mode: Mode;
  provider: AIProvider | null;
  modelLabel: string;
}) {
  const agentKind = mode === "human" ? "human" : provider?.kind ?? "mock";
  const loop = useAgentLoop({
    room,
    agent: agentKind,
    provider: mode === "ai" ? provider : null,
    modelLabel: mode === "ai" ? modelLabel : "Human",
    autoStart: mode === "ai",
  });

  const [elapsed, setElapsed] = useState(0);
  const startedRef = useRef(Date.now());
  useEffect(() => {
    const t = setInterval(() => setElapsed(Date.now() - startedRef.current), 500);
    return () => clearInterval(t);
  }, []);

  const lastStep = loop.steps[loop.steps.length - 1];
  const justDiscovered = useMemo(() => {
    if (!lastStep) return [];
    return lastStep.stateChanges
      .filter((c) => c.startsWith("Discovered:"))
      .map((c) => c.replace("Discovered:", "").trim().toLowerCase());
  }, [lastStep]);

  const metricsPreview: RunMetrics | null = useMemo(() => {
    if (loop.steps.length === 0) return null;
    return computeMetrics(room, loop.steps, { durationMs: elapsed });
  }, [loop.steps, room, elapsed]);

  const wrongCode = lastStep ? !lastStep.response.success && lastStep.action.action === "input" : false;

  // human mode interaction state
  const [selected, setSelected] = useState<{ kind: "object"; obj: ObservedObject } | { kind: "door"; door: { id: string; name: string; state: string } } | null>(null);

  const thinking = mode === "ai" && loop.status === "thinking";
  const finished = loop.status === "finished" && loop.finalRun;

  return (
    <div className="space-y-3">
      {/* header */}
      <div className="flex flex-wrap items-baseline justify-between border border-lab-line bg-lab-panel px-4 py-2.5">
        <div>
          <span className="text-[10px] tracking-[0.3em] text-lab-dim uppercase">{room.subtitle}</span>
          <h1 className="text-lg font-bold tracking-[0.15em] uppercase">{room.title}</h1>
        </div>
        <div className="flex items-center gap-2 text-[10px] tracking-[0.2em] uppercase">
          <span className="text-lab-dim">MODE:</span>
          <span className={mode === "ai" ? "text-lab-green" : "text-lab-amber"}>
            {mode === "ai" ? `AI · ${modelLabel}` : "HUMAN"}
          </span>
          {mode === "ai" && (
            <span className="ml-3 flex gap-1.5">
              {loop.status === "idle" && (
                <Btn onClick={loop.runAgentAutomatically} tone="green">▶ RUN</Btn>
              )}
              {(loop.status === "acting" || loop.status === "thinking") && (
                <Btn onClick={loop.pauseAgent} tone="amber">❚❚ PAUSE</Btn>
              )}
              {loop.status === "paused" && (
                <Btn onClick={loop.resumeAgent} tone="green">▶ RESUME</Btn>
              )}
              <Btn onClick={loop.runAgentStep} tone="plain" disabled={loop.status === "finished"}>STEP</Btn>
              <Btn onClick={loop.resetRoom} tone="plain">RESET</Btn>
            </span>
          )}
          {mode === "human" && (
            <span className="ml-3">
              <Btn onClick={loop.resetRoom} tone="plain">RESET</Btn>
            </span>
          )}
        </div>
      </div>

      {/* main grid: 60/40 */}
      <div className="grid gap-3 lg:grid-cols-5">
        <div className="relative lg:col-span-3">
          <RoomView
            room={room}
            observation={loop.observation}
            lastTarget={lastStep?.action.target ?? null}
            lastFailed={lastStep ? !lastStep.response.success : false}
            justDiscovered={justDiscovered}
            shake={wrongCode}
            onObjectClick={
              mode === "human"
                ? (o) => setSelected({ kind: "object", obj: o })
                : undefined
            }
            onDoorClick={
              mode === "human" ? (d) => setSelected({ kind: "door", door: d }) : undefined
            }
          />
          {/* human action popover */}
          {mode === "human" && selected && !finished && (
            <HumanActionPanel
              selected={selected}
              inventory={loop.observation.inventory}
              onAct={(a) => {
                loop.humanAct(a);
                setSelected(null);
              }}
              onClose={() => setSelected(null)}
            />
          )}
          {/* escaped overlay */}
          {loop.state.escaped && <EscapedOverlay mode={mode} modelLabel={modelLabel} />}
        </div>

        <div className="lg:col-span-2">
          <AgentConsole
            agentLabel={mode === "human" ? "YOU" : modelLabel.split(" · ")[0] === "Qwen" ? "Qwen" : "MockAgent"}
            observation={loop.observation}
            steps={loop.steps}
            thinking={thinking}
            metricsPreview={metricsPreview}
            elapsedMs={elapsed}
          />
        </div>
      </div>

      <Timeline steps={loop.steps} maxActions={room.maxActions} />

      {/* final report card */}
      {finished && loop.finalRun && (
        <ResultCard run={loop.finalRun} roomTitle={room.title} modelLabel={modelLabel} mode={mode} />
      )}
    </div>
  );
}

/* ── small pieces ─────────────────────────────────────────── */

function Btn({
  children,
  onClick,
  tone,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone: "green" | "amber" | "plain";
  disabled?: boolean;
}) {
  const cls =
    tone === "green"
      ? "border-lab-green/60 text-lab-green hover:bg-lab-green/15"
      : tone === "amber"
      ? "border-lab-amber/60 text-lab-amber hover:bg-lab-amber/15"
      : "border-lab-line2 text-lab-dim hover:text-lab-text";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`border px-2.5 py-1 tracking-[0.15em] transition-colors disabled:opacity-40 ${cls}`}
    >
      {children}
    </button>
  );
}

function HumanActionPanel({
  selected,
  inventory,
  onAct,
  onClose,
}: {
  selected: { kind: "object"; obj: ObservedObject } | { kind: "door"; door: { id: string; name: string; state: string } };
  inventory: string[];
  onAct: (a: AgentAction) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState("");
  const id = selected.kind === "object" ? selected.obj.id : selected.door.id;
  const name = selected.kind === "object" ? selected.obj.name : selected.door.name;

  const act = (action: AgentAction["action"], v: string | null = null, reason = null) =>
    onAct({ action, target: id, value: v, reason });

  return (
    <div className="anim-fade-up absolute bottom-16 left-1/2 z-20 w-[min(460px,92%)] -translate-x-1/2 border border-lab-amber/50 bg-lab-panel/95 p-3 shadow-[0_0_30px_rgba(0,0,0,0.6)] backdrop-blur">
      <div className="mb-2 flex items-center justify-between text-[10px] tracking-[0.25em] uppercase">
        <span className="text-lab-amber">{name}</span>
        <button onClick={onClose} className="text-lab-dim hover:text-lab-text">✕</button>
      </div>
      <div className="flex flex-wrap gap-1.5 text-[10px] tracking-[0.15em] uppercase">
        <ActBtn onClick={() => act("inspect")}>Inspect</ActBtn>
        <ActBtn onClick={() => act("interact")}>Interact</ActBtn>
        {selected.kind === "object" && <ActBtn onClick={() => act("take")}>Take</ActBtn>}
        {selected.kind === "door" && <ActBtn onClick={() => act("move")}>Move through</ActBtn>}
      </div>
      <div className="mt-2 flex gap-1.5">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={selected.kind === "door" ? "code / answer…" : `input value for ${id}…`}
          className="flex-1 border border-lab-line2 bg-lab-bg px-2 py-1.5 text-xs text-lab-text placeholder:text-lab-dim/60 focus:border-lab-amber/60 focus:outline-none"
        />
        <ActBtn onClick={() => value.trim() && act("input", value.trim())} tone="amber">Input</ActBtn>
      </div>
      {inventory.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] uppercase">
          <span className="tracking-[0.2em] text-lab-dim">use item →</span>
          {inventory.map((it) => (
            <ActBtn key={it} onClick={() => onAct({ action: "use_item", target: it, value: id, reason: null })} tone="amber">
              {it.replace(/_/g, " ")}
            </ActBtn>
          ))}
        </div>
      )}
    </div>
  );
}

function ActBtn({ children, onClick, tone = "plain" }: { children: React.ReactNode; onClick: () => void; tone?: "plain" | "amber" }) {
  return (
    <button
      onClick={onClick}
      className={`border px-2 py-1.5 transition-colors ${
        tone === "amber"
          ? "border-lab-amber/50 text-lab-amber hover:bg-lab-amber/15"
          : "border-lab-line2 text-lab-text/80 hover:border-lab-green/50 hover:text-lab-green"
      }`}
    >
      {children}
    </button>
  );
}

function EscapedOverlay({ mode, modelLabel }: { mode: Mode; modelLabel: string }) {
  return (
    <div className="anim-fade-up absolute inset-0 z-30 flex flex-col items-center justify-center bg-lab-bg/85 backdrop-blur-sm">
      <div className="text-[11px] tracking-[0.5em] text-lab-dim uppercase">Experiment complete</div>
      <div className="text-glow-green mt-3 text-6xl font-black tracking-[0.2em] text-lab-green uppercase">ESCAPED</div>
      <div className="mt-3 text-xs tracking-[0.25em] text-lab-text uppercase">
        {mode === "ai" ? modelLabel : "YOU"} · left the room
      </div>
    </div>
  );
}

/* ── result card ──────────────────────────────────────────── */

import type { RunRecord } from "@/engine/types";

function ResultCard({ run, roomTitle, modelLabel, mode }: { run: RunRecord; roomTitle: string; modelLabel: string; mode: Mode }) {
  const m = run.metrics;
  return (
    <div className="anim-fade-up border border-lab-line bg-lab-panel">
      <div className="flex flex-wrap items-center justify-between border-b border-lab-line px-4 py-2 text-[11px] tracking-[0.3em] uppercase">
        <span className="text-lab-dim">ESCAPE RESULT · {roomTitle}</span>
        <span className={m.success ? "text-lab-green text-glow-green" : "text-lab-red"}>
          {m.success ? "ESCAPED" : "FAILED"}
        </span>
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-[auto_1fr_auto]">
        <div className="text-center">
          <div className="text-[10px] tracking-[0.3em] text-lab-dim uppercase">{mode === "human" ? "YOU" : modelLabel}</div>
          <div className={`mt-1 text-5xl font-black ${m.success ? "text-lab-green" : "text-lab-red"}`}>
            {run.score.total}
            <span className="text-lg text-lab-dim">/100</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
          <Stat k="Actions" v={`${m.actions} / ${m.maxActions}`} />
          <Stat k="Useful" v={String(m.usefulActions)} c="text-lab-green" />
          <Stat k="Irrelevant" v={String(m.irrelevantActions)} />
          <Stat k="Invalid" v={String(m.invalidActions)} c="text-lab-red" />
          <Stat k="Repeated" v={String(m.repeatedActions)} c="text-lab-amber" />
          <Stat k="Critical mistakes" v={String(m.criticalMistakes)} c="text-lab-red" />
          <Stat k="Self corrections" v={String(m.selfCorrections)} c="text-lab-green" />
          <Stat k="Time" v={formatDuration(m.durationMs)} />
        </div>
        <div className="flex flex-col justify-center gap-2 text-[10px] tracking-[0.2em] uppercase">
          <Link href={`/replay/${run.runId}`} className="border border-lab-green/50 px-4 py-2 text-center text-lab-green hover:bg-lab-green/10">
            ▶ View Replay
          </Link>
          <Link href="/benchmark" className="border border-lab-line2 px-4 py-2 text-center text-lab-text hover:border-lab-amber/50 hover:text-lab-amber">
            Benchmark
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px border-t border-lab-line bg-lab-line text-center text-[10px] sm:grid-cols-6">
        {Object.entries(run.score.breakdown).map(([k, v]) => (
          <div key={k} className="bg-lab-panel py-2">
            <div className="text-lab-text">{v}</div>
            <div className="mt-0.5 tracking-[0.15em] text-lab-dim uppercase">{k.replace(/([A-Z])/g, " $1")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ k, v, c }: { k: string; v: string; c?: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-lab-line/50 py-1">
      <span className="tracking-[0.1em] text-lab-dim uppercase">{k}</span>
      <span className={c ?? "text-lab-text"}>{v}</span>
    </div>
  );
}
