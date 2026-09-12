"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { clearRuns, loadRuns, newRunId, saveRun } from "@/lib/storage";
import {
  analyze,
  buildReport,
  downloadFile,
  reportToCSV,
  reportToJSON,
  reportToMarkdown,
} from "@/lib/exportBenchmark";
import { formatDuration } from "@/engine/replay";
import { runEpisode } from "@/engine/episode";
import { ROOMS } from "@/data/rooms";
import { RemoteQwenProvider } from "@/agents/remote";
import type { AIProvider } from "@/agents/provider";
import { BENCHMARK_VERSION } from "@/config/benchmark";
import type { RoomGroupStats, RunRecord, RunType } from "@/engine/types";
import RunTypeBadge from "@/components/ui/RunTypeBadge";

type Filter = RunType;

interface SuiteState {
  phase: "idle" | "running" | "paused" | "done" | "cancelled" | "error";
  error?: string;
  total: number;
  completed: number;
  model?: string;
  currentRoom?: string;
  currentRun?: string;
  currentStep?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function runTypeOf(r: RunRecord): RunType {
  return r.runType ?? (r.agent === "qwen" ? "benchmark" : r.agent === "mock" ? "demo" : "human");
}

/* ── aggregation that never throws (used for every filter tab) ── */

interface AggStats {
  totalRuns: number;
  escaped: number;
  escapeRate: number;
  meanScore: number;
  medianScore: number;
  meanActions: number;
  invalidRate: number;
  repeatedRate: number;
  selfCorrRate: number;
  infoEff: number;
  exploreEff: number;
  criticalRate: number;
  formatRel: number;
  byRoom: RoomGroupStats[];
}

const r2 = (x: number) => Math.round(x * 100) / 100;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function aggregate(runs: RunRecord[]): AggStats | null {
  if (runs.length === 0) return null;
  const totalActions = runs.reduce((a, r) => a + r.metrics.actions, 0);
  const invalid = runs.reduce((a, r) => a + r.metrics.invalidActions, 0);
  const repeated = runs.reduce((a, r) => a + r.metrics.repeatedActions, 0);
  const selfCorr = runs.reduce((a, r) => a + r.metrics.selfCorrections, 0);
  const failureEvents = runs.reduce(
    (a, r) => a + r.steps.filter((s) => !s.response.success || s.response.criticalMistake).length,
    0
  );
  const formatErrors = runs.reduce((a, r) => a + r.metrics.formatErrors, 0);
  const escaped = runs.filter((r) => r.metrics.success).length;
  const criticalRuns = runs.filter((r) => r.metrics.criticalMistakes > 0).length;

  const byRoomMap = new Map<string, RoomGroupStats>();
  for (const r of runs) {
    const g = byRoomMap.get(r.roomId) ?? {
      roomId: r.roomId, roomTitle: r.roomTitle, runs: 0, escaped: 0,
      escapeRate: 0, meanScore: 0, meanActions: 0,
    };
    g.runs += 1;
    if (r.metrics.success) g.escaped += 1;
    byRoomMap.set(r.roomId, g);
  }
  const byRoom = [...byRoomMap.values()].map((g) => {
    const rr = runs.filter((r) => r.roomId === g.roomId);
    return {
      ...g,
      escapeRate: r2(g.escaped / g.runs),
      meanScore: r2(mean(rr.map((r) => r.score.total))),
      meanActions: r2(mean(rr.map((r) => r.metrics.actions))),
    };
  });

  return {
    totalRuns: runs.length,
    escaped,
    escapeRate: r2(escaped / runs.length),
    meanScore: r2(mean(runs.map((r) => r.score.total))),
    medianScore: r2(median(runs.map((r) => r.score.total))),
    meanActions: r2(mean(runs.map((r) => r.metrics.actions))),
    invalidRate: totalActions ? r2(invalid / totalActions) : 0,
    repeatedRate: totalActions ? r2(repeated / totalActions) : 0,
    selfCorrRate: failureEvents ? r2(selfCorr / failureEvents) : 0,
    infoEff: r2(mean(runs.map((r) => r.metrics.informationEfficiency))),
    exploreEff: r2(mean(runs.map((r) => r.metrics.explorationEfficiency))),
    criticalRate: r2(criticalRuns / runs.length),
    formatRel: r2(1 - formatErrors / Math.max(1, totalActions)),
    byRoom,
  };
}

export default function BenchmarkPage() {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<Filter>("benchmark");
  const [runsPerRoom, setRunsPerRoom] = useState(5);
  const [suite, setSuite] = useState<SuiteState>({ phase: "idle", total: 0, completed: 0 });

  const pausedRef = useRef(false);
  const cancelRef = useRef(false);

  useEffect(() => {
    setRuns(loadRuns());
    setLoaded(true);
  }, []);

  const filtered = useMemo(() => runs.filter((r) => runTypeOf(r) === filter), [runs, filter]);
  const benchmarkRuns = useMemo(() => runs.filter((r) => runTypeOf(r) === "benchmark"), [runs]);
  const counts = useMemo(
    () => ({
      benchmark: runs.filter((r) => runTypeOf(r) === "benchmark").length,
      demo: runs.filter((r) => runTypeOf(r) === "demo").length,
      human: runs.filter((r) => runTypeOf(r) === "human").length,
    }),
    [runs]
  );
  const stats = useMemo(() => aggregate(filtered), [filtered]);
  const newestFirst = useMemo(() => [...filtered].sort((a, b) => b.timestamp - a.timestamp), [filtered]);

  // Official report: only ever built from benchmark runs; null (with a notice)
  // when the data would produce an invalid report (e.g. multiple models mixed).
  const reportError = useMemo(() => {
    if (benchmarkRuns.length === 0) return null;
    try {
      buildReport(benchmarkRuns);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Report error";
    }
  }, [benchmarkRuns]);
  const report = useMemo(() => {
    if (benchmarkRuns.length === 0 || reportError) return null;
    try {
      return buildReport(benchmarkRuns);
    } catch {
      return null;
    }
  }, [benchmarkRuns, reportError]);
  const analysis = useMemo(() => (report ? analyze(report) : null), [report]);

  /* ── benchmark suite runner (Qwen only — never falls back to demo agent) ── */

  async function startSuite() {
    cancelRef.current = false;
    pausedRef.current = false;
    let model: string;
    try {
      const res = await fetch("/api/config");
      const cfg = (await res.json()) as { qwenConfigured: boolean; model: string | null };
      if (!cfg.qwenConfigured || !cfg.model) {
        setSuite({
          phase: "error",
          total: 0,
          completed: 0,
          error:
            "QWEN API NOT CONFIGURED — official benchmark runs require the Qwen provider (QWEN_API_KEY / QWEN_MODEL in .env.local, then restart the server). There is no fallback: MockAgent demo runs are only available on room pages and are never counted as benchmark results.",
        });
        return;
      }
      model = cfg.model;
    } catch {
      setSuite({ phase: "error", total: 0, completed: 0, error: "Failed to read Qwen configuration." });
      return;
    }

    const total = ROOMS.length * runsPerRoom;
    setSuite({ phase: "running", total, completed: 0, model });
    let completed = 0;
    let cancelled = false;

    outer: for (const room of ROOMS) {
      for (let i = 0; i < runsPerRoom; i++) {
        if (cancelRef.current) {
          cancelled = true;
          break outer;
        }
        setSuite((s) => ({ ...s, currentRoom: room.title, currentRun: `${i + 1}/${runsPerRoom}`, currentStep: 0 }));
        const base = new RemoteQwenProvider(model);
        const provider: AIProvider = {
          kind: base.kind,
          model: base.model,
          generateAction: async (ctx) => {
            while (pausedRef.current && !cancelRef.current) await sleep(150);
            if (cancelRef.current) throw new Error("CANCELLED");
            return base.generateAction(ctx);
          },
        };
        try {
          const result = await runEpisode({
            room,
            provider,
            runType: "benchmark",
            modelLabel: `Qwen · ${model}`,
            runId: newRunId(),
            stepDelayMs: 200,
            shouldStop: () => cancelRef.current,
            onStep: (step) => setSuite((s) => ({ ...s, currentStep: step.step })),
          });
          saveRun(result.run);
          setRuns(loadRuns());
          completed += 1;
          setSuite((s) => ({ ...s, completed }));
          if (result.cancelled) {
            cancelled = true;
            break outer;
          }
        } catch (e) {
          if (cancelRef.current) {
            cancelled = true;
            break outer;
          }
          setSuite({
            phase: "error",
            total,
            completed,
            model,
            error: e instanceof Error ? e.message : "Suite run failed",
          });
          return;
        }
      }
    }
    setSuite((s) => ({
      ...s,
      phase: cancelled ? "cancelled" : "done",
      completed,
      currentRoom: undefined,
      currentRun: undefined,
    }));
  }

  const pauseSuite = () => {
    pausedRef.current = true;
    setSuite((s) => ({ ...s, phase: "paused" }));
  };
  const resumeSuite = () => {
    pausedRef.current = false;
    setSuite((s) => ({ ...s, phase: "running" }));
  };
  const cancelSuite = () => {
    cancelRef.current = true;
    pausedRef.current = false;
  };

  function exportReport(kind: "json" | "md" | "csv") {
    try {
      const rep = buildReport(benchmarkRuns); // throws on demo/human or mixed models
      if (kind === "json") downloadFile("benchmark-report.json", reportToJSON(rep), "application/json");
      else if (kind === "md") downloadFile("benchmark-report.md", reportToMarkdown(rep), "text/markdown");
      else downloadFile("benchmark-summary.csv", reportToCSV(rep), "text/csv");
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Export failed");
    }
  }

  if (!loaded) {
    return (
      <div className="py-32 text-center text-xs tracking-[0.3em] text-lab-dim uppercase">
        <span className="anim-dot">●</span> LOADING BENCHMARK DATA…
      </div>
    );
  }

  const suiteBusy = suite.phase === "running" || suite.phase === "paused";

  return (
    <div className="py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[0.4em] text-lab-dim uppercase">
            Benchmark Dashboard · v{BENCHMARK_VERSION}
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-[0.15em] uppercase">
            EVALUATION <span className="text-lab-green text-glow-green">RESULTS</span>
          </h1>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] tracking-[0.2em] uppercase">
          <button
            onClick={() => exportReport("json")}
            disabled={!report}
            title={report ? "Export official benchmark report (JSON)" : "Requires official benchmark runs of a single model"}
            className="border border-lab-green/50 px-3 py-2 text-lab-green hover:bg-lab-green/10 disabled:opacity-30"
          >
            ↓ JSON
          </button>
          <button
            onClick={() => exportReport("md")}
            disabled={!report}
            className="border border-lab-green/50 px-3 py-2 text-lab-green hover:bg-lab-green/10 disabled:opacity-30"
          >
            ↓ Markdown
          </button>
          <button
            onClick={() => exportReport("csv")}
            disabled={!report}
            className="border border-lab-green/50 px-3 py-2 text-lab-green hover:bg-lab-green/10 disabled:opacity-30"
          >
            ↓ CSV
          </button>
          <button
            onClick={() => {
              if (window.confirm("Delete ALL locally stored runs (benchmark, demo and human)?")) {
                clearRuns();
                setRuns([]);
              }
            }}
            disabled={runs.length === 0 || suiteBusy}
            className="border border-lab-line2 px-3 py-2 text-lab-dim hover:border-lab-red/50 hover:text-lab-red disabled:opacity-30"
          >
            Clear data
          </button>
        </div>
      </div>

      {/* run-type filter tabs — demo/human are strictly separated views */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[10px] tracking-[0.2em] uppercase">
        {(["benchmark", "demo", "human"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            disabled={suiteBusy}
            className={`border px-3 py-1.5 transition-colors disabled:opacity-50 ${
              filter === f
                ? f === "benchmark"
                  ? "border-lab-green/70 text-lab-green"
                  : f === "demo"
                  ? "border-lab-amber/70 text-lab-amber"
                  : "border-lab-text/60 text-lab-text"
                : "border-lab-line text-lab-dim hover:border-lab-line2 hover:text-lab-text"
            }`}
          >
            {f === "benchmark" ? "Official Benchmark" : f === "demo" ? "Demo (MockAgent)" : "Human"} · {counts[f]}
          </button>
        ))}
      </div>

      {/* benchmark suite runner */}
      <div className="mt-3 border border-lab-line bg-lab-panel">
        <SectionTitle>Benchmark Suite · official runs · Qwen only (no demo fallback)</SectionTitle>
        <div className="flex flex-wrap items-center gap-3 p-4 text-[10px] tracking-[0.2em] uppercase">
          <span className="text-lab-dim">Runs / room:</span>
          {[1, 3, 5].map((n) => (
            <button
              key={n}
              onClick={() => setRunsPerRoom(n)}
              disabled={suiteBusy}
              className={`border px-3 py-1.5 disabled:opacity-40 ${
                runsPerRoom === n ? "border-lab-green/70 text-lab-green" : "border-lab-line2 text-lab-dim hover:text-lab-text"
              }`}
            >
              {n}
            </button>
          ))}
          <span className="text-lab-dim">
            = {ROOMS.length * runsPerRoom} runs · {ROOMS.length} rooms
          </span>
          <span className="ml-auto flex gap-2">
            {!suiteBusy && (
              <button
                onClick={() => void startSuite()}
                className="border border-lab-green/60 px-4 py-1.5 text-lab-green hover:bg-lab-green/10"
              >
                ▶ Start benchmark
              </button>
            )}
            {suite.phase === "running" && (
              <button onClick={pauseSuite} className="border border-lab-amber/60 px-4 py-1.5 text-lab-amber hover:bg-lab-amber/10">
                ❚❚ Pause
              </button>
            )}
            {suite.phase === "paused" && (
              <button onClick={resumeSuite} className="border border-lab-green/60 px-4 py-1.5 text-lab-green hover:bg-lab-green/10">
                ▶ Resume
              </button>
            )}
            {suiteBusy && (
              <button onClick={cancelSuite} className="border border-lab-red/60 px-4 py-1.5 text-lab-red hover:bg-lab-red/10">
                ✕ Cancel
              </button>
            )}
          </span>
        </div>
        {suiteBusy && (
          <div className="border-t border-lab-line px-4 py-3">
            <div className="flex flex-wrap justify-between gap-2 text-[10px] tracking-[0.2em] uppercase">
              <span className={suite.phase === "paused" ? "text-lab-amber" : "text-lab-green"}>
                <span className="anim-dot">●</span> {suite.phase === "paused" ? "PAUSED" : "RUNNING"} · {suite.currentRoom} · run {suite.currentRun} · step {suite.currentStep ?? 0}
              </span>
              <span className="text-lab-dim">
                {suite.completed} / {suite.total} complete{suite.model ? ` · ${suite.model}` : ""}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full border border-lab-line2 bg-lab-bg">
              <div
                className="h-full bg-lab-green/80 transition-all"
                style={{ width: `${suite.total ? (suite.completed / suite.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
        {suite.phase === "error" && (
          <div className="border-t border-lab-red/40 px-4 py-3 text-xs leading-relaxed text-lab-red">{suite.error}</div>
        )}
        {suite.phase === "done" && (
          <div className="border-t border-lab-green/40 px-4 py-3 text-[11px] tracking-[0.2em] text-lab-green uppercase">
            ✓ Suite complete — {suite.completed} official benchmark run{suite.completed === 1 ? "" : "s"} recorded
          </div>
        )}
        {suite.phase === "cancelled" && (
          <div className="border-t border-lab-amber/40 px-4 py-3 text-[11px] tracking-[0.2em] text-lab-amber uppercase">
            Cancelled — {suite.completed} completed run(s) were kept
          </div>
        )}
      </div>

      {filter !== "benchmark" && filtered.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3 border border-lab-amber/50 bg-lab-amber/5 px-4 py-2.5 text-[11px] leading-relaxed">
          <RunTypeBadge runType={filter} />
          <span className="text-lab-text/80">
            {filter === "demo"
              ? "MockAgent demonstration runs — scripted trajectories for UI preview. They NEVER count toward official statistics, reports or exports."
              : "Human playthroughs — kept strictly separate from model benchmark results and excluded from official reports/exports."}
          </span>
        </div>
      )}

      {filter === "benchmark" && reportError && (
        <div className="mt-3 border border-lab-red/50 bg-lab-red/5 px-4 py-2.5 text-[11px] leading-relaxed text-lab-red">
          {reportError} — official export is disabled until the stored benchmark data contains a single model. Clear data and run a fresh suite.
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="mt-8 border border-dashed border-lab-line2 p-14 text-center">
          <p className="text-sm tracking-[0.3em] text-lab-dim uppercase">
            No {filter === "benchmark" ? "official benchmark" : filter} runs recorded yet
          </p>
          <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-lab-dim/80">
            {filter === "benchmark"
              ? "Configure QWEN_API_KEY and start the Benchmark Suite above, or run a room in AI Mode with Qwen configured."
              : filter === "demo"
              ? "Open any room in AI Mode without a Qwen API key — the MockAgent demo runs will appear here, clearly marked."
              : "Open any room in Human Mode and play through it — your runs will appear here."}
          </p>
          <Link
            href="/room/clockmaker?mode=ai"
            className="mt-5 inline-block border border-lab-green/60 px-5 py-2.5 text-xs tracking-[0.25em] text-lab-green uppercase hover:bg-lab-green/10"
          >
            ▶ Go to a room
          </Link>
        </div>
      ) : (
        stats && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-px border border-lab-line bg-lab-line sm:grid-cols-5 xl:grid-cols-10">
              <Tile k="Mean Score" v={stats.meanScore.toFixed(1)} max="/100" accent />
              <Tile k="Escape Rate" v={`${Math.round(stats.escapeRate * 100)}%`} sub={`${stats.escaped}/${stats.totalRuns}`} />
              <Tile k="Mean Actions" v={stats.meanActions.toFixed(1)} />
              <Tile k="Invalid Rate" v={`${Math.round(stats.invalidRate * 100)}%`} warn={stats.invalidRate > 0.08} />
              <Tile k="Repeat Rate" v={`${Math.round(stats.repeatedRate * 100)}%`} warn={stats.repeatedRate > 0.08} />
              <Tile k="Self-Corr" v={`${Math.round(stats.selfCorrRate * 100)}%`} />
              <Tile k="Info Eff" v={`${Math.round(stats.infoEff * 100)}%`} />
              <Tile k="Explore Eff" v={`${Math.round(stats.exploreEff * 100)}%`} />
              <Tile k="Critical Rate" v={`${Math.round(stats.criticalRate * 100)}%`} warn={stats.criticalRate >= 0.3} />
              <Tile k="Format Rel" v={`${Math.round(stats.formatRel * 100)}%`} />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="border border-lab-line bg-lab-panel lg:col-span-2">
                <SectionTitle>Room Results · multi-run aggregates ({filter})</SectionTitle>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-lab-line text-[10px] tracking-[0.2em] text-lab-dim uppercase">
                      <th className="px-3 py-2">Room</th>
                      <th className="px-3 py-2">Runs</th>
                      <th className="px-3 py-2">Escaped</th>
                      <th className="px-3 py-2">Rate</th>
                      <th className="px-3 py-2">Mean Score</th>
                      <th className="px-3 py-2">Mean Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byRoom.map((g) => (
                      <tr key={g.roomId} className="border-b border-lab-line/50 hover:bg-lab-panel2">
                        <td className="px-3 py-2 text-lab-text">{g.roomTitle}</td>
                        <td className="px-3 py-2 text-lab-dim">{g.runs}</td>
                        <td className="px-3 py-2 text-lab-dim">
                          {g.escaped} / {g.runs}
                        </td>
                        <td className={`px-3 py-2 font-bold ${g.escapeRate >= 0.6 ? "text-lab-green" : g.escapeRate > 0 ? "text-lab-amber" : "text-lab-red"}`}>
                          {Math.round(g.escapeRate * 100)}%
                        </td>
                        <td className="px-3 py-2 text-lab-text">{g.meanScore}</td>
                        <td className="px-3 py-2 text-lab-dim">{g.meanActions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-3 py-2 text-[10px] text-lab-dim">
                  {stats.totalRuns} run{stats.totalRuns === 1 ? "" : "s"} in this view · median score {stats.medianScore}
                </div>
              </div>

              <div className="border border-lab-line bg-lab-panel">
                <SectionTitle>Capability Radar</SectionTitle>
                <Radar stats={stats} />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="border border-lab-line bg-lab-panel lg:col-span-2">
                <SectionTitle>Individual Runs (newest first)</SectionTitle>
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-lab-panel">
                      <tr className="border-b border-lab-line text-[10px] tracking-[0.2em] text-lab-dim uppercase">
                        <th className="px-3 py-2">Run</th>
                        <th className="px-3 py-2">Room</th>
                        <th className="px-3 py-2">Result</th>
                        <th className="px-3 py-2">Score</th>
                        <th className="px-3 py-2">Actions</th>
                        <th className="px-3 py-2">Failure</th>
                        <th className="px-3 py-2">Time</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {newestFirst.map((r) => (
                        <tr key={r.runId} className="border-b border-lab-line/50 hover:bg-lab-panel2">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] text-lab-dim">{r.runId.slice(-8)}</span>
                              <RunTypeBadge runType={runTypeOf(r)} compact />
                            </div>
                            <div className="mt-0.5 text-[9px] tracking-[0.15em] text-lab-dim/70 uppercase">{r.model}</div>
                          </td>
                          <td className="px-3 py-2 text-lab-text">{r.roomTitle}</td>
                          <td className={`px-3 py-2 font-bold ${r.metrics.success ? "text-lab-green" : "text-lab-red"}`}>
                            {r.metrics.success ? "PASS" : "FAIL"}
                          </td>
                          <td className="px-3 py-2 text-lab-text">{r.score.total}</td>
                          <td className="px-3 py-2 text-lab-dim">
                            {r.metrics.actions}/{r.metrics.maxActions}
                          </td>
                          <td className="px-3 py-2 text-[10px] text-lab-red/80">
                            {r.metrics.success ? "—" : r.failure?.primary ?? "UNCLASSIFIED"}
                          </td>
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
                </div>
              </div>

              <div className="border border-lab-line bg-lab-panel">
                <SectionTitle>Automated Analysis {filter === "benchmark" ? "(official runs only)" : ""}</SectionTitle>
                {filter !== "benchmark" ? (
                  <div className="p-4 text-xs leading-relaxed text-lab-dim">
                    Rule-based analysis is generated from OFFICIAL benchmark runs only.{" "}
                    {filter === "demo" ? "Demo (MockAgent) runs" : "Human runs"} are excluded by design.
                  </div>
                ) : analysis ? (
                  <div className="space-y-3 p-4 text-xs leading-relaxed">
                    <div>
                      <p className="mb-1 text-[10px] tracking-[0.25em] text-lab-green uppercase">Strengths</p>
                      <ul className="space-y-1 text-lab-text/80">
                        {analysis.strengths.map((s, i) => (
                          <li key={i}>+ {s}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] tracking-[0.25em] text-lab-red uppercase">Weaknesses</p>
                      <ul className="space-y-1 text-lab-text/80">
                        {analysis.weaknesses.length === 0 && <li>— none significant in this sample —</li>}
                        {analysis.weaknesses.map((w, i) => (
                          <li key={i}>− {w}</li>
                        ))}
                      </ul>
                    </div>
                    <p className="text-[9px] leading-relaxed tracking-[0.1em] text-lab-dim uppercase">
                      All statements are scoped to this benchmark, these rooms and this controlled environment.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 text-xs leading-relaxed text-lab-dim">
                    {reportError
                      ? "Analysis unavailable: stored benchmark runs mix multiple models."
                      : "Analysis appears once official benchmark runs exist."}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}

/* ── small pieces ─────────────────────────────────────────── */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-lab-line px-4 py-2 text-[10px] tracking-[0.3em] text-lab-dim uppercase">{children}</div>;
}

function Tile({ k, v, max, sub, accent, warn }: { k: string; v: string; max?: string; sub?: string; accent?: boolean; warn?: boolean }) {
  return (
    <div className="bg-lab-panel px-3 py-3">
      <div className="text-[9px] tracking-[0.25em] text-lab-dim uppercase">{k}</div>
      <div className={`mt-1 text-xl font-bold ${warn ? "text-lab-red" : accent ? "text-lab-green text-glow-green" : "text-lab-text"}`}>
        {v}
        {max && <span className="ml-0.5 text-xs text-lab-dim">{max}</span>}
      </div>
      {sub && <div className="text-[9px] tracking-[0.15em] text-lab-dim uppercase">{sub}</div>}
    </div>
  );
}

/* lightweight SVG radar — no chart library */
function Radar({ stats }: { stats: AggStats }) {
  const axes = [
    { label: "SUCCESS", v: stats.escapeRate },
    { label: "ACTION EFF", v: stats.meanActions > 0 ? Math.max(0, Math.min(1, 1 - Math.abs(stats.meanActions - 10) / 30)) : 0 },
    { label: "INFO EFF", v: stats.infoEff },
    { label: "EXPLORE", v: stats.exploreEff },
    { label: "COMPLIANCE", v: 1 - stats.invalidRate },
    { label: "SELF-CORR", v: stats.selfCorrRate },
    { label: "FORMAT", v: stats.formatRel },
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
          <polygon key={f} points={axes.map((_, i) => pt(i, R * f).join(",")).join(" ")} fill="none" stroke="#26262b" strokeWidth="1" />
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
            <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="7" fill="#71717a" letterSpacing="1">
              {ax.label}
            </text>
          );
        })}
      </svg>
      <p className="mt-1 text-[9px] tracking-[0.2em] text-lab-dim uppercase">aggregate over {stats.totalRuns} run(s)</p>
    </div>
  );
}
