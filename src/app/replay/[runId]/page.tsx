"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { getRun } from "@/lib/storage";
import { formatAction, formatDuration } from "@/engine/replay";
import type { RunRecord } from "@/engine/types";

export default function ReplayPage({ params }: { params: Promise<{ runId: string }> }) {
  return <ReplayInner runId={use(params).runId} />;
}

function ReplayInner({ runId }: { runId: string }) {
  const [run, setRun] = useState<RunRecord | null | undefined>(undefined);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setRun(getRun(runId) ?? null);
  }, [runId]);

  useEffect(() => {
    if (playing && run) {
      timer.current = setInterval(() => {
        setIdx((i) => {
          if (i >= run.steps.length - 1) {
            setPlaying(false);
            return i;
          }
          return i + 1;
        });
      }, 1400);
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, run]);

  if (run === undefined) {
    return <div className="py-32 text-center text-xs tracking-[0.3em] text-lab-dim uppercase"><span className="anim-dot">●</span> LOADING TRACE…</div>;
  }
  if (run === null) {
    return (
      <div className="py-32 text-center">
        <p className="tracking-[0.3em] text-lab-red uppercase">Run not found: {runId}</p>
        <Link href="/benchmark" className="mt-4 inline-block border border-lab-line2 px-4 py-2 text-xs tracking-[0.2em] uppercase hover:border-lab-green/60 hover:text-lab-green">
          ← Benchmark
        </Link>
      </div>
    );
  }

  const step = run.steps[idx];
  const done = idx >= run.steps.length - 1;

  return (
    <div className="py-6">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border border-lab-line bg-lab-panel px-4 py-3">
        <div>
          <p className="text-[10px] tracking-[0.35em] text-lab-dim uppercase">Replay · {run.runId}</p>
          <h1 className="mt-0.5 text-xl font-bold tracking-[0.15em] uppercase">
            {run.roomTitle} <span className="text-lab-dim">—</span>{" "}
            <span className={run.metrics.success ? "text-lab-green" : "text-lab-red"}>
              {run.metrics.success ? "ESCAPED" : "FAILED"}
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-3 text-[11px] tracking-[0.2em] uppercase">
          <span className="text-lab-dim">AGENT <span className="text-lab-text">{run.agent === "human" ? "HUMAN" : run.model}</span></span>
          <span className="text-lab-dim">SCORE <span className="text-lab-green">{run.score.total}/100</span></span>
          <span className="text-lab-dim">TIME <span className="text-lab-text">{formatDuration(run.metrics.durationMs)}</span></span>
          <Link href="/benchmark" className="border border-lab-line2 px-3 py-1.5 text-lab-dim hover:border-lab-green/50 hover:text-lab-green">
            ← Benchmark
          </Link>
        </div>
      </div>

      {/* transport controls */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border border-lab-line bg-lab-panel px-4 py-2.5">
        <button
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="border border-lab-line2 px-3 py-1.5 text-[11px] tracking-[0.2em] uppercase text-lab-text hover:border-lab-amber/60 hover:text-lab-amber disabled:opacity-30"
        >
          ◀ Prev
        </button>
        <button
          onClick={() => setPlaying((p) => !p)}
          className={`border px-4 py-1.5 text-[11px] tracking-[0.2em] uppercase ${playing ? "border-lab-amber/60 text-lab-amber" : "border-lab-green/60 text-lab-green hover:bg-lab-green/10"}`}
        >
          {playing ? "❚❚ Pause" : "▶ Auto Play"}
        </button>
        <button
          onClick={() => setIdx((i) => Math.min(run.steps.length - 1, i + 1))}
          disabled={done}
          className="border border-lab-line2 px-3 py-1.5 text-[11px] tracking-[0.2em] uppercase text-lab-text hover:border-lab-amber/60 hover:text-lab-amber disabled:opacity-30"
        >
          Next ▶
        </button>
        <div className="ml-2 flex-1">
          <input
            type="range"
            min={0}
            max={Math.max(0, run.steps.length - 1)}
            value={idx}
            onChange={(e) => setIdx(Number(e.target.value))}
            className="w-full accent-lab-green"
          />
        </div>
        <span className="text-[11px] tracking-[0.2em] text-lab-dim uppercase">
          Step {String(idx + 1).padStart(2, "0")} / {run.steps.length}
        </span>
      </div>

      {/* step detail */}
      {step && (
        <div key={step.step} className="anim-step-in mt-3 grid gap-3 lg:grid-cols-2">
          <div className="border border-lab-line bg-lab-panel p-4">
            <Section>OBSERVATION @ STEP {String(step.step).padStart(2, "0")}</Section>
            <p className="mt-2 text-xs leading-relaxed text-lab-text/70">{step.observation.description}</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
              <div>
                <p className="tracking-[0.2em] text-lab-dim uppercase">Visible objects</p>
                <ul className="mt-1 space-y-0.5">
                  {step.observation.visible_objects.map((o) => (
                    <li key={o.id} className="text-lab-text/80">
                      <span className="text-lab-green">·</span> {o.name} <span className="text-lab-dim">[{o.state}]</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="tracking-[0.2em] text-lab-dim uppercase">Inventory</p>
                <ul className="mt-1 space-y-0.5">
                  {step.observation.inventory.length === 0 && <li className="text-lab-dim">empty</li>}
                  {step.observation.inventory.map((it) => (
                    <li key={it} className="text-lab-amber">· {it.replace(/_/g, " ")}</li>
                  ))}
                </ul>
                <p className="mt-2 tracking-[0.2em] text-lab-dim uppercase">
                  Actions left <span className="text-lab-text">{step.observation.actions_remaining}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="border border-lab-line bg-lab-panel p-4">
            <Section>AGENT DECISION</Section>
            {step.reason && (
              <p className="mt-2 border-l-2 border-lab-amber/60 pl-3 text-xs leading-relaxed text-lab-text/85 italic">
                &ldquo;{step.reason}&rdquo;
              </p>
            )}
            <p className="mt-3 text-xs">
              <span className="tracking-[0.2em] text-lab-dim uppercase">Action: </span>
              <code className="text-lab-amber">{formatAction(step.action)}</code>
            </p>
            <p className="mt-2 text-xs leading-relaxed">
              <span className="tracking-[0.2em] text-lab-dim uppercase">Result: </span>
              <span className={step.response.success ? "text-lab-green" : "text-lab-red"}>
                {step.response.message}
              </span>
            </p>
            {step.stateChanges.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {step.stateChanges.map((c, i) => (
                  <li key={i} className="text-[11px] tracking-wide text-lab-green/90 uppercase">Δ {c}</li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex gap-2 text-[10px] tracking-[0.2em] uppercase">
              <span className={`border px-2 py-0.5 ${
                step.classification === "useful" ? "border-lab-green/50 text-lab-green" :
                step.classification === "invalid" ? "border-lab-red/50 text-lab-red" :
                step.classification === "repeated" ? "border-lab-amber/50 text-lab-amber" :
                "border-lab-line2 text-lab-dim"
              }`}>{step.classification}</span>
              <span className="border border-lab-line2 px-2 py-0.5 text-lab-dim">
                score Δ {step.scoreDelta >= 0 ? "+" : ""}{step.scoreDelta}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* full trace list */}
      <div className="mt-3 border border-lab-line bg-lab-panel">
        <div className="border-b border-lab-line px-4 py-2 text-[10px] tracking-[0.3em] text-lab-dim uppercase">
          Full trace
        </div>
        <div className="max-h-56 overflow-y-auto">
          {run.steps.map((s, i) => (
            <button
              key={s.step}
              onClick={() => setIdx(i)}
              className={`flex w-full items-center gap-3 border-b border-lab-line/40 px-4 py-1.5 text-left text-[11px] hover:bg-lab-panel2 ${i === idx ? "bg-lab-panel2" : ""}`}
            >
              <span className="w-12 text-lab-dim">{String(s.step).padStart(2, "0")}</span>
              <code className="flex-1 truncate text-lab-text/85">{formatAction(s.action)}</code>
              <span className={s.response.success ? "text-lab-green" : "text-lab-red"}>
                {s.response.escaped ? "ESCAPED" : s.response.success ? "OK" : s.response.invalid ? "INVALID" : "FAIL"}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] tracking-[0.3em] text-lab-dim uppercase">{children}</div>;
}
