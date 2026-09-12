"use client";

import type { Observation, RunMetrics, StepRecord } from "@/engine/types";
import { formatAction, formatDuration } from "@/engine/replay";
import { useState } from "react";

/**
 * AGENT CONSOLE — right column of the room page.
 * Live broadcast of THOUGHT / ACTION / OBSERVATION + inventory + discoveries + HUD.
 */

interface Props {
  agentLabel: string;
  observation: Observation;
  steps: StepRecord[];
  thinking: boolean;
  metricsPreview: RunMetrics | null;
  elapsedMs: number;
}

export default function AgentConsole({ agentLabel, observation, steps, thinking, metricsPreview, elapsedMs }: Props) {
  const latest = steps[steps.length - 1];
  const discoveries = steps.flatMap((s) =>
    s.stateChanges.filter((c) => c.startsWith("Discovered") || c.startsWith("Puzzle solved") || c.startsWith("Door opened") || c === "ESCAPED")
  );

  return (
    <div className="flex h-full flex-col gap-3">
      {/* HUD */}
      <div className="grid grid-cols-3 gap-px border border-lab-line bg-lab-line text-[10px]">
        <Hud k="AGENT" v={agentLabel} accent />
        <Hud k="ACTIONS" v={`${observation.actions_remaining} LEFT`} warn={observation.actions_remaining <= 8} />
        <Hud k="TIME" v={formatDuration(elapsedMs)} />
      </div>

      {/* thought / action / observation */}
      <div className="flex-1 space-y-3 overflow-y-auto pr-1" style={{ maxHeight: "46vh" }}>
        <Panel title="THOUGHT / HYPOTHESIS">
          {thinking ? (
            <ThinkingLine agentLabel={agentLabel} />
          ) : latest?.reason ? (
            <p className="text-xs leading-relaxed text-lab-text/85 italic">&ldquo;{latest.reason}&rdquo;</p>
          ) : (
            <p className="text-xs text-lab-dim">Awaiting first observation…</p>
          )}
        </Panel>

        <Panel title="ACTION">
          {latest ? (
            <div className="anim-step-in">
              <code className="block text-xs text-lab-amber">
                {String(latest.step).padStart(2, "0")} ▸ {formatAction(latest.action)}
              </code>
              <span className={`mt-1 inline-block border px-1.5 py-0.5 text-[9px] tracking-[0.2em] uppercase ${classFor(latest.classification)}`}>
                {latest.classification}
              </span>
            </div>
          ) : (
            <p className="text-xs text-lab-dim">—</p>
          )}
        </Panel>

        <Panel title="OBSERVATION / FEEDBACK">
          {latest ? (
            <p className={`anim-step-in whitespace-pre-line text-xs leading-relaxed ${latest.response.success ? "text-lab-text/85" : "text-lab-red/90"}`}>
              {latest.response.message}
            </p>
          ) : (
            <p className="text-xs text-lab-dim">{observation.recent_events[0] ?? "—"}</p>
          )}
          {latest && latest.stateChanges.length > 0 && (
            <ul className="mt-2 space-y-0.5 border-t border-lab-line pt-2">
              {latest.stateChanges.map((c, i) => (
                <li key={i} className="text-[10px] tracking-wide text-lab-green/90 uppercase">Δ {c}</li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* inventory + discoveries */}
      <div className="grid grid-cols-2 gap-3">
        <Panel title="INVENTORY">
          {observation.inventory.length === 0 ? (
            <p className="text-xs text-lab-dim">empty</p>
          ) : (
            <ul className="space-y-1">
              {observation.inventory.map((it) => (
                <li key={it} className="anim-step-in flex items-center gap-1.5 text-xs text-lab-amber">
                  <span className="inline-block h-1.5 w-1.5 bg-lab-amber" /> {it.replace(/_/g, " ")}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="DISCOVERIES">
          {discoveries.length === 0 ? (
            <p className="text-xs text-lab-dim">none yet</p>
          ) : (
            <ul className="space-y-1">
              {discoveries.slice(-5).map((d, i) => (
                <li key={i} className="anim-step-in truncate text-[11px] text-lab-green">◈ {d}</li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* live metrics */}
      {metricsPreview && (
        <div className="grid grid-cols-4 gap-px border border-lab-line bg-lab-line text-center text-[10px]">
          <Mini k="USEFUL" v={metricsPreview.usefulActions} c="text-lab-green" />
          <Mini k="IRRELEV" v={metricsPreview.irrelevantActions} c="text-lab-dim" />
          <Mini k="INVALID" v={metricsPreview.invalidActions} c="text-lab-red" />
          <Mini k="REPEAT" v={metricsPreview.repeatedActions} c="text-lab-amber" />
        </div>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-lab-line bg-lab-panel p-3">
      <div className="mb-2 text-[10px] tracking-[0.3em] text-lab-dim uppercase">{title}</div>
      {children}
    </div>
  );
}

function Hud({ k, v, accent, warn }: { k: string; v: string; accent?: boolean; warn?: boolean }) {
  return (
    <div className="bg-lab-panel px-3 py-2">
      <div className="tracking-[0.25em] text-lab-dim uppercase">{k}</div>
      <div className={`mt-0.5 truncate tracking-[0.1em] ${warn ? "text-lab-red" : accent ? "text-lab-green" : "text-lab-text"}`}>{v}</div>
    </div>
  );
}

function Mini({ k, v, c }: { k: string; v: number; c: string }) {
  return (
    <div className="bg-lab-panel py-1.5">
      <span className={`text-sm font-bold ${c}`}>{v}</span>
      <span className="ml-1 tracking-[0.15em] text-lab-dim uppercase">{k}</span>
    </div>
  );
}

function ThinkingLine({ agentLabel }: { agentLabel: string }) {
  const [dots] = useState("…");
  return (
    <p className="flex items-center gap-2 text-xs text-lab-green">
      <span className="anim-dot">●</span>
      <span className="anim-dot-2">●</span>
      <span className="anim-dot-3">●</span>
      {agentLabel} is thinking{dots}
    </p>
  );
}

function classFor(c: StepRecord["classification"]): string {
  switch (c) {
    case "useful": return "border-lab-green/50 text-lab-green";
    case "invalid": return "border-lab-red/50 text-lab-red";
    case "repeated": return "border-lab-amber/50 text-lab-amber";
    default: return "border-lab-line2 text-lab-dim";
  }
}
