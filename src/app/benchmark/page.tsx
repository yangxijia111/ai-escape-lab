"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { clearRuns, loadRuns } from "@/lib/storage";
import { analyze, buildReport, downloadFile, reportToJSON, reportToMarkdown } from "@/lib/exportBenchmark";
import { formatDuration } from "@/engine/replay";
import type { RunRecord } from "@/engine/types";

export default function BenchmarkPage() {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setRuns(loadRuns());
    setLoaded(true);
  }, []);

  const report = useMemo(() => (runs.length ? buildReport(runs, runs[runs.length - 1].model) : null), [runs]);
  const analysis = useMemo(() => (report ? analyze(report) : null), [report]);

  // latest run per room for the results table
  const latestByRoom = useMemo(() => {
    const map = new Map<string, RunRecord>();
    for (const r of runs) map.set(r.roomId, r);
    return [...map.values()];
  }, [runs]);

  if (!loaded) return <div className="py-32 text-center text-xs tracking-[0.3em] text-lab-dim uppercase"><span className="anim-dot">●</span> LOADING BENCHMARK DATA…</div>;

  return (
    <div className="py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[0.4em] text-lab-dim uppercase">Benchmark Dashboard</p>
          <h1 className="mt-1 text-3xl font-black tracking-[0.15em] uppercase">
            EVALUATION <span className="text-lab-green text-glow-green">RESULTS</span>
          </h1>
        </div>
        <div className="flex gap-2 text-[10px] tracking-[0.2em] uppercase">
          <button
            onClick={() => report && downloadFile("benchmark-report.json", reportToJSON(report), "application/json")}
            disabled={!report}
            className="border border-lab-green/50 px-3 py-2 text-lab-green hover:bg-lab-green/10 disabled:opacity-30"
          >
            ↓ Export JSON
          </button>
          <button
            onClick={() => report && downloadFile("benchmark-report.md", reportToMarkdown(report), "text/markdown")}
            disabled={!report}
            className="border border-lab-green/50 px-3 py-2 text-lab-green hover:bg-lab-green/10 disabled:opacity-30"
          >
            ↓ Export Markdown
          </button>
          <button
            onClick={() => { clearRuns(); setRuns([]); }}
            disabled={runs.length === 0}
            className="border border-lab-line2 px-3 py-2 text-lab-dim hover:border-lab-red/50 hover:text-lab-red disabled:opacity-30"
          >
            Clear data
          </button>
        </div>
      </div>

      {runs.length === 0 ? (
        <div className="mt-10 border border-dashed border-lab-line2 p-16 text-center">
          <p className="text-sm tracking-[0.3em] text-lab-dim uppercase">No runs recorded yet</p>
          <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-lab-dim/80">
            Run a room in AI Mode or Human Mode — every completed experiment is stored locally and
            aggregated here.
          </p>
          <Link href="/room/clockmaker?mode=ai" className="mt-6 inline-block border border-lab-green/60 px-5 py-2.5 text-xs tracking-[0.25em] text-lab-green uppercase hover:bg-lab-green/10">
            ▶ Run first experiment
          </Link>
        </div>
      ) : (
        report && analysis && (
          <div className="mt-6 space-y-4">
            {/* summary tiles */}
            <div className="grid grid-cols-2 gap-px border border-lab-line bg-lab-line md:grid-cols-4 xl:grid-cols-8">
              <Tile k="Overall Score" v={report.summary.average_score.toFixed(1)} max="/100" accent />
              <Tile k="Escape Rate" v={`${Math.round(report.summary.escape_rate * 100)}%`} />
              <Tile k="Avg Actions" v={report.summary.average_actions.toFixed(1)} />
              <Tile k="Invalid Rate" v={`${Math.round(report.summary.invalid_action_rate * 100)}%`} warn={report.summary.invalid_action_rate > 0.08} />
              <Tile k="Repeat Rate" v={`${Math.round(report.summary.repeated_action_rate * 100)}%`} warn={report.summary.repeated_action_rate > 0.08} />
              <Tile k="Self-Corr" v={`${Math.round(report.summary.self_correction_rate * 100)}%`} />
              <Tile k="Info Eff" v={`${Math.round(report.summary.information_efficiency * 100)}%`} />
              <Tile k="Format Rel" v={`${Math.round(report.summary.format_reliability * 100)}%`} />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {/* results table */}
              <div className="border border-lab-line bg-lab-panel lg:col-span-2">
                <SectionTitle>Room Results (latest run per room)</SectionTitle>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-lab-line text-[10px] tracking-[0.2em] text-lab-dim uppercase">
                      <th className="px-3 py-2">Room</th>
                      <th className="px-3 py-2">Agent</th>
                      <th className="px-3 py-2">Result</th>
                      <th className="px-3 py-2">Score</th>
                      <th className="px-3 py-2">Actions</th>
                      <th className="px-3 py-2">Time</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {latestByRoom.map((r) => (
                      <tr key={r.runId} className="border-b border-lab-line/50 hover:bg-lab-panel2">
                        <td className="px-3 py-2 text-lab-text">{r.roomTitle}</td>
                        <td className="px-3 py-2 text-lab-dim">{r.agent === "human" ? "HUMAN" : r.model}</td>
                        <td className={`px-3 py-2 font-bold ${r.metrics.success ? "text-lab-green" : "text-lab-red"}`}>
                          {r.metrics.success ? "PASS" : "FAIL"}
                        </td>
                        <td className="px-3 py-2 text-lab-text">{r.score.total}</td>
                        <td className="px-3 py-2 text-lab-dim">{r.metrics.actions}/{r.metrics.maxActions}</td>
                        <td className="px-3 py-2 text-lab-dim">{formatDuration(r.metrics.durationMs)}</td>
                        <td className="px-3 py-2">
                          <Link href={`/replay/${r.runId}`} className="text-[10px] tracking-[0.2em] text-lab-green uppercase hover:underline">
                            Replay →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-3 py-2 text-[10px] text-lab-dim">
                  {runs.length} total run{runs.length === 1 ? "" : "s"} recorded
                </div>
              </div>

              {/* radar */}
              <div className="border border-lab-line bg-lab-panel">
                <SectionTitle>Capability Radar</SectionTitle>
                <Radar report={report} />
              </div>
            </div>

            {/* score bars + strengths */}
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="border border-lab-line bg-lab-panel lg:col-span-2">
                <SectionTitle>Score by Room</SectionTitle>
                <div className="space-y-3 p-4">
                  {latestByRoom.map((r) => (
                    <div key={r.runId}>
                      <div className="mb-1 flex justify-between text-[11px] uppercase">
                        <span className="tracking-[0.15em] text-lab-text">{r.roomTitle}</span>
                        <span className={r.metrics.success ? "text-lab-green" : "text-lab-red"}>{r.score.total}/100</span>
                      </div>
                      <div className="h-2 w-full border border-lab-line2 bg-lab-bg">
                        <div
                          className={`h-full ${r.metrics.success ? "bg-lab-green/80" : "bg-lab-red/70"}`}
                          style={{ width: `${r.score.total}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border border-lab-line bg-lab-panel">
                <SectionTitle>Automated Analysis</SectionTitle>
                <div className="space-y-3 p-4 text-xs leading-relaxed">
                  <div>
                    <p className="mb-1 text-[10px] tracking-[0.25em] text-lab-green uppercase">Strengths</p>
                    <ul className="space-y-1 text-lab-text/80">
                      {analysis.strengths.map((s, i) => <li key={i}>+ {s}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] tracking-[0.25em] text-lab-red uppercase">Weaknesses</p>
                    <ul className="space-y-1 text-lab-text/80">
                      {analysis.weaknesses.length === 0 && <li>— none significant —</li>}
                      {analysis.weaknesses.map((w, i) => <li key={i}>− {w}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-lab-line px-4 py-2 text-[10px] tracking-[0.3em] text-lab-dim uppercase">{children}</div>;
}

function Tile({ k, v, max, accent, warn }: { k: string; v: string; max?: string; accent?: boolean; warn?: boolean }) {
  return (
    <div className="bg-lab-panel px-3 py-3">
      <div className="text-[9px] tracking-[0.25em] text-lab-dim uppercase">{k}</div>
      <div className={`mt-1 text-xl font-bold ${warn ? "text-lab-red" : accent ? "text-lab-green text-glow-green" : "text-lab-text"}`}>
        {v}
        {max && <span className="ml-0.5 text-xs text-lab-dim">{max}</span>}
      </div>
    </div>
  );
}

/* lightweight SVG radar — no chart library */
function Radar({ report }: { report: NonNullable<ReturnType<typeof buildReport>> }) {
  const s = report.summary;
  const axes = [
    { label: "SUCCESS", v: s.escape_rate },
    { label: "EFFICIENCY", v: Math.min(1, s.average_actions > 0 ? 1 - Math.abs(s.average_actions - 10) / 30 : 0) },
    { label: "INFO GAIN", v: s.information_efficiency },
    { label: "COMPLIANCE", v: 1 - s.invalid_action_rate },
    { label: "SELF-CORR", v: s.self_correction_rate },
    { label: "FORMAT", v: s.format_reliability },
  ];
  const N = axes.length;
  const R = 84;
  const cx = 120, cy = 108;
  const pt = (i: number, r: number) => {
    const a = (Math.PI * 2 * i) / N - Math.PI / 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  };
  const poly = axes.map((ax, i) => pt(i, R * Math.max(0.04, Math.min(1, ax.v))).join(",")).join(" ");

  return (
    <div className="flex flex-col items-center p-2">
      <svg viewBox="0 0 240 216" className="w-full max-w-[280px]">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon
            key={f}
            points={axes.map((_, i) => pt(i, R * f).join(",")).join(" ")}
            fill="none"
            stroke="#26262b"
            strokeWidth="1"
          />
        ))}
        {axes.map((_, i) => {
          const [x, y] = pt(i, R);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#26262b" strokeWidth="1" />;
        })}
        <polygon points={poly} fill="rgba(61,240,126,0.15)" stroke="#3df07e" strokeWidth="1.5" />
        {axes.map((ax, i) => {
          const [x, y] = pt(i, R * Math.max(0.04, Math.min(1, ax.v)));
          return <circle key={i} cx={x} cy={y} r="2.5" fill="#3df07e" />;
        })}
        {axes.map((ax, i) => {
          const [x, y] = pt(i, R + 16);
          return (
            <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="7.5" fill="#71717a" letterSpacing="1">
              {ax.label}
            </text>
          );
        })}
      </svg>
      <p className="mt-1 text-[9px] tracking-[0.2em] text-lab-dim uppercase">aggregate over {report.runs.length} run(s)</p>
    </div>
  );
}
