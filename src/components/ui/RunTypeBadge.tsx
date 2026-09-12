import type { RunType } from "@/engine/types";

/**
 * Run-type badge. Demo (MockAgent) runs must always be visibly marked as
 * NOT benchmark data; Human runs are marked separately from model runs.
 */
export default function RunTypeBadge({ runType, compact }: { runType: RunType; compact?: boolean }) {
  if (runType === "demo") {
    return (
      <span
        className="border border-lab-amber/60 bg-lab-amber/10 px-2 py-0.5 text-[9px] tracking-[0.25em] text-lab-amber uppercase"
        title="MockAgent demo run — NOT a benchmark result"
      >
        DEMO RUN{compact ? "" : " · NOT A BENCHMARK RESULT"}
      </span>
    );
  }
  if (runType === "human") {
    return (
      <span className="border border-lab-line2 bg-lab-panel2 px-2 py-0.5 text-[9px] tracking-[0.25em] text-lab-text/80 uppercase">
        HUMAN RUN
      </span>
    );
  }
  return (
    <span className="border border-lab-green/60 bg-lab-green/10 px-2 py-0.5 text-[9px] tracking-[0.25em] text-lab-green uppercase">
      BENCHMARK RUN
    </span>
  );
}
