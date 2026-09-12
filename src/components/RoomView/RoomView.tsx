"use client";

import type { ObservedObject, Observation, RoomCase } from "@/engine/types";

/**
 * ROOM VIEW — renders the chamber as a stylized CSS/SVG scene.
 * Objects are positioned by their `pos` hint (percentages).
 * No image assets.
 */

interface Props {
  room: RoomCase;
  observation: Observation;
  lastTarget?: string | null;
  lastFailed?: boolean;
  justDiscovered?: string[];
  shake?: boolean;
  onObjectClick?: (obj: ObservedObject) => void;
  onDoorClick?: (door: { id: string; name: string; state: string }) => void;
}

export default function RoomView({
  room,
  observation,
  lastTarget,
  lastFailed,
  justDiscovered = [],
  shake,
  onObjectClick,
  onDoorClick,
}: Props) {
  return (
    <div className="relative flex h-full flex-col border border-lab-line bg-lab-panel">
      {/* header */}
      <div className="flex items-center justify-between border-b border-lab-line px-4 py-2 text-[11px] tracking-[0.25em] uppercase">
        <span className="text-lab-dim">
          ROOM VIEW · <span className="text-lab-text">{room.title}</span>
        </span>
        <span className="flex items-center gap-2 text-lab-dim">
          <span className={`inline-block h-1.5 w-1.5 ${observation.escaped ? "bg-lab-green" : "bg-lab-amber"} anim-dot`} />
          {observation.escaped ? "ESCAPED" : "SEALED"}
        </span>
      </div>

      {/* scene */}
      <div className="relative min-h-[380px] flex-1 overflow-hidden">
        {/* wall + floor */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#141417] via-[#101013] to-[#0b0b0d]" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-[#0d0d10] to-[#08080a] border-t border-lab-line/70"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 64px)",
          }}
        />
        <div className="lab-grid pointer-events-none absolute inset-0 opacity-60" />
        {/* ambient light */}
        <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-[70%] -translate-x-1/2 bg-gradient-to-b from-lab-amber/5 to-transparent" />

        {/* doors */}
        {observation.doors.map((d) => (
          <button
            key={d.id}
            onClick={() => onDoorClick?.(d)}
            className="group absolute -translate-x-1/2 -translate-y-1/2 focus:outline-none"
            style={{ left: `${room.doors.find((x) => x.id === d.id)?.pos?.[0] ?? 85}%`, top: `${room.doors.find((x) => x.id === d.id)?.pos?.[1] ?? 45}%` }}
            title={d.name}
          >
            <div className={`relative h-24 w-14 border ${d.state === "open" ? "border-lab-green/70" : "border-lab-line2"} bg-[#0e0e11] ${lastTarget === d.id && lastFailed ? "anim-shake" : ""}`}>
              <div className={`absolute inset-1 origin-left border border-lab-line2 bg-gradient-to-b from-[#1b1b20] to-[#121216] ${d.state === "open" ? "anim-door" : ""}`} />
              <span className={`absolute right-2 top-1/2 h-1.5 w-1.5 rounded-full ${d.state === "open" ? "bg-lab-green" : "bg-lab-amber"}`} />
              {d.state === "open" && <div className="absolute inset-y-1 left-1 w-4 bg-lab-green/15 blur-[2px]" />}
            </div>
            <div className="mt-1 text-center text-[9px] tracking-[0.2em] text-lab-dim uppercase group-hover:text-lab-text">
              {d.name} · {d.state}
            </div>
          </button>
        ))}

        {/* objects */}
        {observation.visible_objects.map((o) => {
          const def = room.objects.find((x) => x.id === o.id);
          const isNew = justDiscovered.includes(o.id);
          const isTarget = lastTarget === o.id;
          return (
            <button
              key={o.id}
              onClick={() => onObjectClick?.(o)}
              className={`group absolute -translate-x-1/2 -translate-y-1/2 focus:outline-none ${isNew ? "anim-discover" : ""}`}
              style={{ left: `${def?.pos?.[0] ?? 50}%`, top: `${def?.pos?.[1] ?? 50}%` }}
              title={`${o.name} — ${o.state}`}
            >
              <div
                className={`relative flex h-16 w-16 items-center justify-center border bg-lab-panel2/90 transition-colors sm:h-[72px] sm:w-[72px] ${
                  isTarget
                    ? lastFailed
                      ? "border-lab-red/80 anim-shake"
                      : "border-lab-green/80 shadow-[0_0_18px_rgba(61,240,126,0.25)]"
                    : "border-lab-line2 group-hover:border-lab-amber/60"
                }`}
              >
                <Glyph kind={o.kind} state={o.state} />
                {isNew && <span className="absolute -right-1 -top-1 h-2 w-2 bg-lab-green anim-dot" />}
              </div>
              <div className="mt-1 max-w-[110px] text-center">
                <div className="truncate text-[9px] tracking-[0.12em] text-lab-text/80 uppercase">{o.name}</div>
                <div className="truncate text-[8px] tracking-[0.1em] text-lab-dim uppercase">{o.state}</div>
              </div>
            </button>
          );
        })}

        {/* shake overlay for wrong code */}
        {shake && <div className="pointer-events-none absolute inset-0 border-2 border-lab-red/40 anim-shake" />}
      </div>

      {/* footer strip: description */}
      <div className="border-t border-lab-line px-4 py-2 text-[11px] leading-relaxed text-lab-dim">
        {observation.description}
      </div>
    </div>
  );
}

/* ── minimal SVG glyphs per object kind ───────────────────── */

function Glyph({ kind, state }: { kind: string; state: string }) {
  const stroke = "currentColor";
  const cls = "text-lab-text/70";
  const common = { stroke, strokeWidth: 1.4, fill: "none" } as const;
  switch (kind) {
    case "clock":
      return (
        <svg viewBox="0 0 32 32" className={`h-9 w-9 ${cls}`} {...common}>
          <circle cx="16" cy="16" r="11" />
          <path d="M16 16 L16 9 M16 16 L21 18" />
          <path d="M16 5 v2 M27 16 h-2 M16 27 v-2 M5 16 h2" strokeWidth="1" />
        </svg>
      );
    case "painting":
      return (
        <svg viewBox="0 0 32 32" className={`h-9 w-9 ${state === "moved" ? "text-lab-green" : cls}`} {...common}>
          <rect x="6" y="5" width="20" height="22" />
          <rect x="9" y="8" width="14" height="16" strokeWidth="1" />
          <circle cx="16" cy="14" r="3" strokeWidth="1" />
          <path d="M11 24 q5 -6 10 0" strokeWidth="1" />
        </svg>
      );
    case "desk":
      return (
        <svg viewBox="0 0 32 32" className={`h-9 w-9 ${cls}`} {...common}>
          <rect x="4" y="10" width="24" height="4" />
          <path d="M7 14 v12 M25 14 v12" />
          <rect x="12" y="16" width="8" height="4" strokeWidth="1" />
        </svg>
      );
    case "safe":
      return (
        <svg viewBox="0 0 32 32" className={`h-9 w-9 ${state === "unlocked" || state === "open" ? "text-lab-green" : cls}`} {...common}>
          <rect x="5" y="6" width="22" height="20" />
          <circle cx="16" cy="16" r="5" />
          <path d="M16 11 v-2 M16 23 v-2 M21 16 h2 M9 16 h2" strokeWidth="1" />
          {(state === "unlocked" || state === "open") && <path d="M24 8 l4 -4" />}
        </svg>
      );
    case "note":
      return (
        <svg viewBox="0 0 32 32" className={`h-9 w-9 ${cls}`} {...common}>
          <path d="M8 4 h12 l4 4 v20 H8 z" />
          <path d="M20 4 v4 h4" strokeWidth="1" />
          <path d="M12 14 h8 M12 18 h8 M12 22 h5" strokeWidth="1" />
        </svg>
      );
    case "key":
      return (
        <svg viewBox="0 0 32 32" className="h-9 w-9 text-lab-amber" {...common}>
          <circle cx="10" cy="12" r="5" />
          <path d="M13.5 15.5 L24 26 M20 22 l3 -3 M17 19 l3 -3" />
        </svg>
      );
    case "bookshelf":
      return (
        <svg viewBox="0 0 32 32" className={`h-9 w-9 ${cls}`} {...common}>
          <rect x="5" y="4" width="22" height="24" />
          <path d="M5 16 h22" strokeWidth="1" />
          <path d="M9 8 v5 M13 7 v6 M17 8 v5 M21 7 v6 M9 20 v5 M14 19 v6 M19 20 v5 M23 19 v6" strokeWidth="1.6" />
        </svg>
      );
    case "inscription":
      return (
        <svg viewBox="0 0 32 32" className={`h-9 w-9 ${cls}`} {...common}>
          <rect x="5" y="6" width="22" height="20" strokeDasharray="2 2" strokeWidth="1" />
          <path d="M9 12 h14 M9 16 h14 M9 20 h9" />
        </svg>
      );
    case "globe":
      return (
        <svg viewBox="0 0 32 32" className={`h-9 w-9 ${cls}`} {...common}>
          <circle cx="16" cy="14" r="9" />
          <ellipse cx="16" cy="14" rx="4" ry="9" strokeWidth="1" />
          <path d="M7 14 h18 M10 26 h12 M16 23 v3" strokeWidth="1" />
        </svg>
      );
    case "chest":
      return (
        <svg viewBox="0 0 32 32" className={`h-9 w-9 ${state === "open" ? "text-lab-green" : state === "sealed" ? "text-lab-red" : cls}`} {...common}>
          <path d="M5 14 q11 -8 22 0 v12 H5 z" />
          <path d="M5 14 h22" strokeWidth="1" />
          <rect x="14" y="12" width="4" height="6" strokeWidth="1" />
        </svg>
      );
    case "brick":
      return (
        <svg viewBox="0 0 32 32" className={`h-9 w-9 ${state === "pivoted" ? "text-lab-green" : cls}`} {...common}>
          <rect x="4" y="9" width="24" height="6" strokeWidth="1" />
          <rect x="4" y="17" width="24" height="6" strokeWidth="1" />
          <rect x="9" y="9" width="10" height="6" />
        </svg>
      );
    case "vent":
      return (
        <svg viewBox="0 0 32 32" className={`h-9 w-9 ${state === "open" ? "text-lab-green" : cls}`} {...common}>
          <rect x="5" y="7" width="22" height="18" />
          {state === "open" ? (
            <path d="M9 11 h14 M9 16 h14 M9 21 h14" strokeWidth="1" strokeDasharray="3 3" />
          ) : (
            <path d="M9 11 h14 M9 16 h14 M9 21 h14" strokeWidth="1.6" />
          )}
        </svg>
      );
    case "gramophone":
      return (
        <svg viewBox="0 0 32 32" className={`h-9 w-9 ${state === "playing" ? "text-lab-amber" : cls}`} {...common}>
          <path d="M6 24 h12 l-2 -6 h-8 z" />
          <path d="M14 18 L24 6 q6 4 2 10 L16 20" />
          <circle cx="11" cy="21" r="1.4" strokeWidth="1" />
        </svg>
      );
    case "fireplace":
      return (
        <svg viewBox="0 0 32 32" className={`h-9 w-9 ${cls}`} {...common}>
          <path d="M5 26 v-14 q11 -8 22 0 v14 z" />
          <path d="M11 26 v-7 q5 -5 10 0 v7" strokeWidth="1" />
        </svg>
      );
    case "mirror":
      return (
        <svg viewBox="0 0 32 32" className={`h-9 w-9 ${cls}`} {...common}>
          <ellipse cx="16" cy="14" rx="8" ry="10" />
          <path d="M12 10 q4 -3 8 0" strokeWidth="1" />
          <path d="M16 24 v4 M12 28 h8" strokeWidth="1" />
        </svg>
      );
    case "lamp":
      return (
        <svg viewBox="0 0 32 32" className="h-9 w-9 text-lab-amber/80" {...common}>
          <path d="M8 14 h16 l-4 -8 h-8 z" />
          <path d="M16 14 v10 M12 26 h8" strokeWidth="1" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 32 32" className={`h-9 w-9 ${cls}`} {...common}>
          <path d="M16 5 L27 16 L16 27 L5 16 z" />
          <circle cx="16" cy="16" r="2.5" strokeWidth="1" />
        </svg>
      );
  }
}
