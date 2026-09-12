import Link from "next/link";
import { ROOMS } from "@/data/rooms";

const DIFF_COLOR: Record<string, string> = {
  tutorial: "text-lab-green border-lab-green/40",
  easy: "text-lab-green border-lab-green/40",
  medium: "text-lab-amber border-lab-amber/40",
  hard: "text-lab-red border-lab-red/40",
};

export default function Home() {
  return (
    <div className="lab-grid pb-20">
      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="relative flex min-h-[560px] flex-col items-center justify-center py-16 text-center">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 overflow-hidden opacity-40">
          <div className="anim-scan h-8 w-full bg-gradient-to-b from-transparent via-lab-green/10 to-transparent" />
        </div>

        <p className="anim-fade-up text-[11px] tracking-[0.5em] text-lab-dim uppercase">
          Experiment 0047 · Agent Evaluation Facility
        </p>
        <h1 className="anim-flicker anim-fade-up mt-6 text-6xl font-black tracking-[0.12em] text-lab-text uppercase sm:text-8xl" style={{ animationDelay: "0.1s" }}>
          AI <span className="text-glow-green text-lab-green">ESCAPE</span> LAB
        </h1>
        <p className="anim-fade-up mt-5 text-sm tracking-[0.3em] text-lab-dim uppercase sm:text-base" style={{ animationDelay: "0.2s" }}>
          Can an AI escape the room?
        </p>

        {/* experiment card */}
        <div className="anim-fade-up mt-12 w-full max-w-md border border-lab-line2 bg-lab-panel/80 p-6 text-left text-xs" style={{ animationDelay: "0.3s" }}>
          <Row k="MODEL" v="QWEN" accent />
          <Row k="ENVIRONMENT" v="UNKNOWN ROOM" />
          <Row k="OBSERVABILITY" v="PARTIAL" />
          <Row k="OBJECTIVE" v="ESCAPE." accent />
          <Row k="STATUS" v="READY" accent />
          <div className="mt-6 flex flex-col gap-2">
            <Link
              href="/room/clockmaker?mode=ai"
              className="group border border-lab-green/60 bg-lab-green/10 px-4 py-3 text-center tracking-[0.25em] text-lab-green uppercase transition-colors hover:bg-lab-green/25"
            >
              ▶ Watch Qwen Escape
            </Link>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/room/clockmaker?mode=human"
                className="border border-lab-line2 px-4 py-2.5 text-center tracking-[0.2em] text-lab-text uppercase transition-colors hover:border-lab-amber/60 hover:text-lab-amber"
              >
                Challenge Yourself
              </Link>
              <Link
                href="/benchmark"
                className="border border-lab-line2 px-4 py-2.5 text-center tracking-[0.2em] text-lab-text uppercase transition-colors hover:border-lab-amber/60 hover:text-lab-amber"
              >
                Benchmark
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHAT IT MEASURES ─────────────────────────────── */}
      <section className="mx-auto max-w-4xl border-y border-lab-line py-10">
        <p className="text-center text-[11px] tracking-[0.4em] text-lab-dim uppercase">
          Not a riddle test — a benchmark for
        </p>
        <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-3 text-xs sm:grid-cols-5">
          {[
            "Information Gathering",
            "Multi-step Reasoning",
            "Planning",
            "Hypothesis Testing",
            "Self-Correction",
            "Tool / Action Use",
            "State Understanding",
            "Long-horizon Tasks",
            "Distraction Resistance",
            "Rule Compliance",
          ].map((cap, i) => (
            <div key={cap} className="flex items-center gap-2 text-lab-text/80">
              <span className="text-lab-green">{String(i + 1).padStart(2, "0")}</span>
              {cap}
            </div>
          ))}
        </div>
      </section>

      {/* ── ROOMS ────────────────────────────────────────── */}
      <section id="rooms" className="py-14">
        <div className="mb-8 flex items-baseline justify-between">
          <h2 className="text-lg tracking-[0.35em] uppercase">Test Chambers</h2>
          <span className="text-[11px] text-lab-dim tracking-[0.2em] uppercase">select room → select mode</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ROOMS.map((r, i) => (
            <div
              key={r.id}
              className="group relative flex flex-col border border-lab-line bg-lab-panel p-5 transition-colors hover:border-lab-green/50"
            >
              <div className="flex items-start justify-between">
                <span className="text-[10px] tracking-[0.3em] text-lab-dim uppercase">
                  Room {String(i + 1).padStart(2, "0")}
                </span>
                <span className={`border px-2 py-0.5 text-[10px] tracking-[0.2em] uppercase ${DIFF_COLOR[r.difficulty]}`}>
                  {r.difficulty}
                </span>
              </div>
              <h3 className="mt-3 text-xl font-bold tracking-wide text-lab-text group-hover:text-lab-green transition-colors">
                {r.title}
              </h3>
              <p className="mt-1 text-[11px] tracking-[0.2em] text-lab-dim uppercase">{r.subtitle}</p>
              <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-lab-text/60">{r.description}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {r.tags.map((t) => (
                  <span key={t} className="border border-lab-line2 px-1.5 py-0.5 text-[10px] text-lab-dim uppercase">
                    {t}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-lab-line pt-3 text-[11px] text-lab-dim">
                <span>MAX {r.maxActions} ACTIONS</span>
                <div className="flex gap-2">
                  <Link
                    href={`/room/${r.id}?mode=ai`}
                    className="border border-lab-green/40 px-3 py-1.5 tracking-[0.15em] text-lab-green uppercase transition-colors hover:bg-lab-green/15"
                  >
                    AI Mode
                  </Link>
                  <Link
                    href={`/room/${r.id}?mode=human`}
                    className="border border-lab-line2 px-3 py-1.5 tracking-[0.15em] text-lab-text uppercase transition-colors hover:border-lab-amber/60 hover:text-lab-amber"
                  >
                    Human
                  </Link>
                </div>
              </div>
            </div>
          ))}

          {/* demo mode card */}
          <div className="flex flex-col justify-center border border-dashed border-lab-line2 bg-transparent p-5 text-xs text-lab-dim">
            <p className="tracking-[0.25em] text-lab-amber uppercase">Demo Mode</p>
            <p className="mt-2 leading-relaxed">
              No API key? No problem. AI Mode automatically falls back to a scripted MockAgent that
              simulates realistic exploration — hypotheses, mistakes, corrections, escape.
            </p>
            <p className="mt-3 text-[11px]">
              Set <code className="text-lab-green">QWEN_API_KEY</code> in <code>.env.local</code> to run the real model.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-lab-line pt-6 text-center text-[10px] tracking-[0.3em] text-lab-dim/60 uppercase">
        AI ESCAPE LAB · Observe → Hypothesize → Act → Feedback → Correct → Escape
      </footer>
    </div>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between border-b border-lab-line/60 py-2">
      <span className="tracking-[0.3em] text-lab-dim uppercase">{k}</span>
      <span className={`tracking-[0.2em] ${accent ? "text-lab-green text-glow-green" : "text-lab-text"}`}>{v}</span>
    </div>
  );
}
