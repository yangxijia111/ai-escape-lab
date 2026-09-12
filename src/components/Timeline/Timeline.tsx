"use client";

import { useEffect, useRef } from "react";
import type { StepRecord } from "@/engine/types";
import { formatAction } from "@/engine/replay";

/**
 * Timeline — horizontal action log at the bottom of the room page.
 */
export default function Timeline({ steps, maxActions }: { steps: StepRecord[]; maxActions: number }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "end" });
  }, [steps.length]);

  return (
    <div className="border border-lab-line bg-lab-panel">
      <div className="flex items-center justify-between border-b border-lab-line px-3 py-1.5 text-[10px] tracking-[0.3em] text-lab-dim uppercase">
        <span>Timeline / Action Log</span>
        <span>
          {steps.length} / {maxActions} ACTIONS
        </span>
      </div>
      <div className="flex items-stretch gap-0 overflow-x-auto px-3 py-2">
        {steps.length === 0 && <span className="py-2 text-[11px] text-lab-dim">— no actions recorded —</span>}
        {steps.map((s) => (
          <div key={s.step} className="anim-step-in group relative flex min-w-[128px] flex-col border-l border-lab-line2 pl-2 pr-3">
            <span className={`absolute -left-[3px] top-1 h-1.5 w-1.5 rounded-full ${dotColor(s)}`} />
            <span className="text-[9px] tracking-[0.2em] text-lab-dim uppercase">STEP {String(s.step).padStart(2, "0")}</span>
            <code className="mt-0.5 truncate text-[10px] text-lab-text/85 group-hover:text-lab-amber">
              {formatAction(s.action)}
            </code>
            <span className={`truncate text-[9px] uppercase ${s.response.success ? "text-lab-green/70" : "text-lab-red/70"}`}>
              {s.response.success ? (s.response.escaped ? "ESCAPED" : "OK") : s.response.invalid ? "INVALID" : "FAIL"}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}

function dotColor(s: StepRecord): string {
  if (s.response.escaped) return "bg-lab-green shadow-[0_0_6px_#3df07e]";
  switch (s.classification) {
    case "useful": return "bg-lab-green";
    case "invalid": return "bg-lab-red";
    case "repeated": return "bg-lab-amber";
    default: return "bg-lab-dim";
  }
}
