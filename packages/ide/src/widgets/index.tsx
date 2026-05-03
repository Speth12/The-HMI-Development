// Widget renderers — read, write, and trend support.
import { useEffect, useRef, useState } from "react";
import type { Widget } from "../store/projectStore";
import { useTag } from "../hooks/useTag";
import { apiBase } from "../store/runtimeTarget";

// ── helpers ────────────────────────────────────────────────────────────────

const fmt = (v: unknown): string => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return Number.isInteger(v) ? `${v}` : v.toFixed(2);
  if (typeof v === "boolean") return v ? "ON" : "OFF";
  return String(v);
};

const qualityColor: Record<string, string> = {
  Good: "text-emerald-400",
  Bad: "text-red-400",
  Uncertain: "text-amber-400",
  Unknown: "text-zinc-500",
};

/** POST a value to the write endpoint. Binding is "dsId:tagPath".
 *  Always uses the current runtime target (local or PLC). */
async function writeTag(binding: string, value: unknown): Promise<void> {
  const sep = binding.indexOf(":");
  if (sep < 0) return;
  const datasource = binding.slice(0, sep);
  const path = binding.slice(sep + 1);
  try {
    await fetch(`${apiBase}/api/v1/tag/${encodeURIComponent(path)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ datasource, value }),
    });
  } catch {
    // swallow — write failures visible as stale read values
  }
}

// ── shared Frame ───────────────────────────────────────────────────────────

function Frame({ w, children }: { w: Widget; children: React.ReactNode }) {
  return (
    <div className="h-full w-full rounded-lg bg-zinc-900/80 border border-zinc-800 p-3 flex flex-col gap-1 select-none">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 truncate">
        {(w.config?.label as string) ?? w.type}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

// ── read-only widgets ──────────────────────────────────────────────────────

// Gauge SVG helpers
const GAUGE_CX = 50, GAUGE_CY = 60, GAUGE_R = 36;
const GAUGE_START = 225; // deg clockwise from top (7:30 position)
const GAUGE_SWEEP = 270; // total arc in degrees

function gaugePolar(angleDeg: number, r = GAUGE_R) {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return { x: GAUGE_CX + r * Math.cos(rad), y: GAUGE_CY + r * Math.sin(rad) };
}

function gaugeArcPath(startDeg: number, sweepDeg: number): string {
  const s = Math.max(0.01, Math.min(sweepDeg, GAUGE_SWEEP - 0.01));
  const p0 = gaugePolar(startDeg);
  const p1 = gaugePolar(startDeg + s);
  return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${GAUGE_R} ${GAUGE_R} 0 ${s > 180 ? 1 : 0} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
}

function GaugeWidget({ w }: { w: Widget }) {
  const t = useTag(w.binding);
  const min = (w.config?.min as number) ?? 0;
  const max = (w.config?.max as number) ?? 100;
  const v = typeof t.value === "number" ? t.value : min;
  const pct = Math.max(0, Math.min(1, (v - min) / (max - min)));
  const fillSweep = pct * GAUGE_SWEEP;

  const thresholds = (w.config?.thresholds as Array<{ value: number; color: string }>) ?? [];
  let arcColor = "#22c55e";
  thresholds.forEach((th) => { if (v >= th.value) arcColor = th.color; });

  const needleAngle = GAUGE_START + fillSweep;
  const needleTip  = gaugePolar(needleAngle, GAUGE_R - 4);
  const needleBase = gaugePolar(needleAngle + 180, 6);

  const minPt = gaugePolar(GAUGE_START, GAUGE_R + 6);
  const maxPt = gaugePolar(GAUGE_START + GAUGE_SWEEP, GAUGE_R + 6);

  return (
    <div className="flex flex-col h-full justify-center gap-0.5">
      <svg viewBox="0 0 100 75" className="w-full max-h-28">
        {/* Track */}
        <path d={gaugeArcPath(GAUGE_START, GAUGE_SWEEP)} fill="none" stroke="#27272a" strokeWidth="7" strokeLinecap="round" />
        {/* Fill */}
        {fillSweep > 0.5 && (
          <path d={gaugeArcPath(GAUGE_START, fillSweep)} fill="none" stroke={arcColor} strokeWidth="7" strokeLinecap="round" />
        )}
        {/* Tick marks at 0%, 25%, 50%, 75%, 100% */}
        {[0, 0.25, 0.5, 0.75, 1].map((p) => {
          const a = GAUGE_START + p * GAUGE_SWEEP;
          const outer = gaugePolar(a, GAUGE_R + 2);
          const inner = gaugePolar(a, GAUGE_R - 9);
          return (
            <line key={p} x1={outer.x.toFixed(2)} y1={outer.y.toFixed(2)}
              x2={inner.x.toFixed(2)} y2={inner.y.toFixed(2)}
              stroke="#52525b" strokeWidth={p === 0 || p === 1 ? 1.5 : 0.8} />
          );
        })}
        {/* Min/max labels */}
        <text x={minPt.x.toFixed(1)} y={minPt.y.toFixed(1)} textAnchor="end"
          fontSize="5" fill="#52525b" fontFamily="monospace">{min}</text>
        <text x={maxPt.x.toFixed(1)} y={maxPt.y.toFixed(1)} textAnchor="start"
          fontSize="5" fill="#52525b" fontFamily="monospace">{max}</text>
        {/* Needle */}
        <line x1={needleBase.x.toFixed(2)} y1={needleBase.y.toFixed(2)}
          x2={needleTip.x.toFixed(2)} y2={needleTip.y.toFixed(2)}
          stroke="#e4e4e7" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx={GAUGE_CX} cy={GAUGE_CY} r="3.5" fill="#52525b" />
        <circle cx={GAUGE_CX} cy={GAUGE_CY} r="1.5" fill="#a1a1aa" />
        {/* Value */}
        <text x={GAUGE_CX} y={GAUGE_CY + 14} textAnchor="middle"
          fontSize="8" fill="#e4e4e7" fontWeight="600" fontFamily="monospace">
          {typeof t.value === "number" ? t.value.toFixed(1) : "—"}
          {w.config?.unit ? ` ${w.config.unit as string}` : ""}
        </text>
      </svg>
      <div className={`text-[9px] text-center ${qualityColor[t.quality] ?? "text-zinc-600"}`}>{t.quality}</div>
    </div>
  );
}

function NumericDisplayWidget({ w }: { w: Widget }) {
  const t = useTag(w.binding);
  return (
    <div className="flex flex-col h-full justify-center">
      <div className="text-3xl font-semibold tabular-nums">
        {fmt(t.value)}
        {w.config?.unit ? <span className="text-base text-zinc-500 ml-1">{w.config.unit as string}</span> : null}
      </div>
      <div className={`text-[10px] mt-1 ${qualityColor[t.quality] ?? "text-zinc-500"}`}>{t.quality}</div>
    </div>
  );
}

function TextDisplayWidget({ w }: { w: Widget }) {
  const t = useTag(w.binding);
  return <div className="text-lg break-words h-full flex items-center">{fmt(t.value)}</div>;
}

function LEDWidget({ w }: { w: Widget }) {
  const t = useTag(w.binding);
  const on = !!t.value;
  const trueColor = (w.config?.trueColor as string) ?? "#22c55e";
  const falseColor = (w.config?.falseColor as string) ?? "#3f3f46";
  return (
    <div className="flex items-center gap-2 h-full">
      <div
        className="w-6 h-6 rounded-full shadow-[inset_0_0_8px_rgba(0,0,0,0.4)]"
        style={{ background: on ? trueColor : falseColor, boxShadow: on ? `0 0 10px ${trueColor}88` : undefined }}
      />
      <div className="text-sm font-medium">{on ? (w.config?.trueLabel as string ?? "ON") : (w.config?.falseLabel as string ?? "OFF")}</div>
    </div>
  );
}

// ── write widgets ──────────────────────────────────────────────────────────

function ButtonWidget({ w }: { w: Widget }) {
  const t = useTag(w.binding);
  const label = (w.config?.label as string) ?? "Press";
  const momentary = (w.config?.momentary as boolean) ?? true;
  const onValue  = w.config?.onValue  ?? 1;
  const offValue = w.config?.offValue ?? 0;

  if (momentary) {
    return (
      <button
        className="w-full h-full rounded-md bg-blue-600 hover:bg-blue-500 active:scale-95 text-sm font-medium transition-all"
        onPointerDown={() => w.binding && writeTag(w.binding, onValue)}
        onPointerUp={()   => w.binding && writeTag(w.binding, offValue)}
        onPointerLeave={()=> w.binding && writeTag(w.binding, offValue)}
      >
        {label}
      </button>
    );
  }

  // Toggle mode — read current, invert
  const on = !!t.value;
  return (
    <button
      className={`w-full h-full rounded-md text-sm font-medium transition-all active:scale-95 ${
        on ? "bg-emerald-600 hover:bg-emerald-500" : "bg-zinc-700 hover:bg-zinc-600"
      }`}
      onClick={() => w.binding && writeTag(w.binding, on ? offValue : onValue)}
    >
      {label}
    </button>
  );
}

function NumericInputWidget({ w }: { w: Widget }) {
  const t = useTag(w.binding);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setDraft(t.value != null ? String(t.value) : "");
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commit = () => {
    const n = parseFloat(draft);
    if (!isNaN(n) && w.binding) writeTag(w.binding, n);
    setEditing(false);
  };

  return (
    <div className="flex flex-col h-full justify-center">
      {editing ? (
        <input
          ref={inputRef}
          autoFocus
          type="number"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          className="text-2xl font-mono bg-zinc-800 border border-blue-500 rounded px-2 py-1 w-full outline-none"
        />
      ) : (
        <div
          onClick={startEdit}
          className="text-3xl font-semibold tabular-nums cursor-text hover:bg-zinc-800 rounded px-1 transition-colors"
        >
          {fmt(t.value)}
          {w.config?.unit ? <span className="text-base text-zinc-500 ml-1">{w.config.unit as string}</span> : null}
        </div>
      )}
      <div className={`text-[10px] mt-1 ${qualityColor[t.quality] ?? "text-zinc-500"}`}>
        {editing ? "enter value → confirm" : t.quality}
      </div>
    </div>
  );
}

function TextInputWidget({ w }: { w: Widget }) {
  const t = useTag(w.binding);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEdit = () => { setDraft(fmt(t.value)); setEditing(true); };
  const commit = () => {
    if (w.binding) writeTag(w.binding, draft);
    setEditing(false);
  };

  return (
    <div className="flex flex-col h-full justify-center gap-1">
      {editing ? (
        <input
          autoFocus
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          className="text-sm bg-zinc-800 border border-blue-500 rounded px-2 py-1 w-full outline-none font-mono"
        />
      ) : (
        <div onClick={startEdit} className="text-sm cursor-text hover:bg-zinc-800 rounded px-1 transition-colors font-mono">
          {fmt(t.value)}
        </div>
      )}
    </div>
  );
}

// ── tank (vertical level) ─────────────────────────────────────────────────

function TankWidget({ w }: { w: Widget }) {
  const t = useTag(w.binding);
  const min = (w.config?.min as number) ?? 0;
  const max = (w.config?.max as number) ?? 100;
  const v = typeof t.value === "number" ? t.value : 0;
  const pct = Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
  const thresholds = (w.config?.thresholds as Array<{ value: number; color: string }>) ?? [];
  let fillColor = "#3b82f6"; // blue default
  thresholds.forEach((th) => { if (v >= th.value) fillColor = th.color; });

  return (
    <div className="flex gap-3 h-full items-end">
      {/* Vertical bar */}
      <div className="flex flex-col w-10 h-full bg-zinc-800 rounded-md overflow-hidden relative border border-zinc-700">
        {/* Tick marks */}
        {[75, 50, 25].map((p) => (
          <div key={p} className="absolute left-0 right-0 border-t border-zinc-600/50 text-[8px] text-zinc-600 pl-0.5"
            style={{ bottom: `${p}%` }} />
        ))}
        {/* Fill */}
        <div
          className="absolute bottom-0 left-0 right-0 transition-all duration-500 rounded-b-md"
          style={{ height: `${pct}%`, background: fillColor, opacity: 0.85 }}
        />
      </div>
      {/* Value + quality */}
      <div className="flex flex-col justify-end pb-1">
        <div className="text-xl font-semibold tabular-nums leading-none">
          {fmt(t.value)}
        </div>
        {(w.config?.unit as string | undefined) && (
          <div className="text-[10px] text-zinc-500">{w.config!.unit as string}</div>
        )}
        <div className={`text-[9px] mt-1 ${qualityColor[t.quality] ?? "text-zinc-500"}`}>{t.quality}</div>
      </div>
    </div>
  );
}

// ── setpoint slider ────────────────────────────────────────────────────────

function SetpointWidget({ w }: { w: Widget }) {
  const t = useTag(w.binding);
  const min = (w.config?.min as number) ?? 0;
  const max = (w.config?.max as number) ?? 100;
  const step = (w.config?.step as number) ?? 1;

  // Local draft so the slider feels snappy while the write propagates.
  const [draft, setDraft] = useState<number | null>(null);
  const displayVal = draft ?? (typeof t.value === "number" ? t.value : min);

  const commit = (n: number) => {
    setDraft(null);
    if (w.binding) writeTag(w.binding, n);
  };

  return (
    <div className="flex flex-col h-full justify-center gap-2">
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-semibold tabular-nums">{displayVal.toFixed(step < 1 ? 1 : 0)}</span>
        {(w.config?.unit as string | undefined) && <span className="text-xs text-zinc-500">{w.config!.unit as string}</span>}
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={displayVal}
        onChange={(e) => setDraft(Number(e.target.value))}
        onMouseUp={(e) => commit(Number((e.target as HTMLInputElement).value))}
        onTouchEnd={(e) => commit(Number((e.target as HTMLInputElement).value))}
        className="w-full accent-blue-500 cursor-pointer"
      />
      <div className="flex justify-between text-[9px] text-zinc-600">
        <span>{min}</span>
        <span className={qualityColor[t.quality] ?? "text-zinc-600"}>{t.quality}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

// ── trend widget (multi-series) ────────────────────────────────────────────

type Sample = { ts: number; v: number };
type TrendSeries = { binding: string; color: string; label?: string };

const SERIES_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4"];

/** Tracks one time-series: fetches history + appends live updates. */
function useSeries(binding: string | undefined, duration: number): Sample[] {
  const t = useTag(binding);
  const [pts, setPts] = useState<Sample[]>([]);
  const ptsRef = useRef<Sample[]>([]);

  // Fetch history on mount / binding change.
  useEffect(() => {
    if (!binding) { setPts([]); ptsRef.current = []; return; }
    const from = (Date.now() - duration) * 1e6;
    fetch(`${apiBase}/api/v1/history?path=${encodeURIComponent(binding)}&from=${from}&limit=500`)
      .then((r) => (r.ok ? r.json() : []))
      .then((samples: Array<{ ts: number; value: unknown }>) => {
        const loaded: Sample[] = samples
          .filter((s) => typeof s.value === "number")
          .map((s) => ({ ts: s.ts > 1e15 ? s.ts / 1e6 : s.ts, v: s.value as number }));
        ptsRef.current = loaded;
        setPts([...loaded]);
      })
      .catch(() => {});
  }, [binding, duration]);

  // Append live values.
  useEffect(() => {
    if (typeof t.value !== "number" || t.quality === "Unknown") return;
    const now = t.ts > 1e15 ? t.ts / 1e6 : t.ts > 0 ? t.ts : Date.now();
    const cutoff = now - duration;
    const prev = ptsRef.current;
    if (prev.length > 0 && prev[prev.length - 1]!.ts >= now) return;
    const next = [...prev.filter((p) => p.ts >= cutoff), { ts: now, v: t.value as number }];
    ptsRef.current = next;
    setPts(next);
  }, [t.value, t.ts, t.quality, duration]);

  return pts;
}

/** Convert a series' samples to SVG polyline points in a shared [tMin,tMax] window. */
function toPolyline(pts: Sample[], tMin: number, tMax: number, vMin: number, vRange: number): string {
  if (pts.length < 2) return "";
  const tSpan = tMax - tMin || 1;
  return pts
    .filter((p) => p.ts >= tMin)
    .map((p) => {
      const x = ((p.ts - tMin) / tSpan) * 100;
      const y = 100 - ((p.v - vMin) / vRange) * 100;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

const TREND_WINDOWS = [
  { label: "30s", sec: 30 },
  { label: "1m",  sec: 60 },
  { label: "5m",  sec: 300 },
  { label: "1h",  sec: 3600 },
];

function TrendWidget({ w }: { w: Widget }) {
  const cfgDuration = (w.config?.duration as number) ?? 300;
  const [windowSec, setWindowSec] = useState(cfgDuration);
  const duration = windowSec * 1000;

  // Build series list: config.tags[] for multi-series, or fall back to w.binding.
  const cfgTags = w.config?.tags as TrendSeries[] | undefined;
  const series: TrendSeries[] = cfgTags?.length
    ? cfgTags
    : w.binding
    ? [{ binding: w.binding, color: SERIES_COLORS[0]! }]
    : [];

  // We need fixed-count hooks — support up to 6 series (pad with undefined).
  const s0 = useSeries(series[0]?.binding, duration);
  const s1 = useSeries(series[1]?.binding, duration);
  const s2 = useSeries(series[2]?.binding, duration);
  const s3 = useSeries(series[3]?.binding, duration);
  const s4 = useSeries(series[4]?.binding, duration);
  const s5 = useSeries(series[5]?.binding, duration);
  const allPts = [s0, s1, s2, s3, s4, s5].slice(0, series.length);

  const cfgMin = w.config?.min as number | undefined;
  const cfgMax = w.config?.max as number | undefined;
  const flat = allPts.flat();
  const vMin = cfgMin ?? (flat.length ? Math.min(...flat.map((p) => p.v)) : 0);
  const vMax = cfgMax ?? (flat.length ? Math.max(...flat.map((p) => p.v)) : 100);
  const vRange = vMax - vMin || 1;

  // Shared time window: most recent point across all series.
  const tMax = flat.length ? Math.max(...flat.map((p) => p.ts)) : Date.now();
  const tMin = tMax - duration;

  return (
    <div className="flex flex-col h-full">
      {/* Time-window picker */}
      <div className="flex gap-1 shrink-0 mb-0.5">
        {TREND_WINDOWS.map((tw) => (
          <button
            key={tw.sec}
            onClick={() => setWindowSec(tw.sec)}
            className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${
              windowSec === tw.sec
                ? "bg-blue-600 text-white"
                : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
            }`}
          >
            {tw.label}
          </button>
        ))}
      </div>
      <svg className="flex-1 w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
        {[0, 25, 50, 75, 100].map((y) => (
          <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#27272a" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
        ))}
        {allPts.map((pts, i) => {
          const color = series[i]?.color ?? SERIES_COLORS[i % SERIES_COLORS.length]!;
          const polyPts = toPolyline(pts, tMin, tMax, vMin, vRange);
          const last = pts.at(-1);
          const dotX = last ? ((last.ts - tMin) / (tMax - tMin || 1)) * 100 : null;
          const dotY = last ? 100 - ((last.v - vMin) / vRange) * 100 : null;
          return (
            <g key={i}>
              <polyline points={polyPts} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              {dotX !== null && dotY !== null && (
                <circle cx={dotX} cy={dotY} r="2" fill={color} vectorEffect="non-scaling-stroke" />
              )}
            </g>
          );
        })}
      </svg>
      {/* Legend + values */}
      <div className="flex items-center justify-between text-[10px] text-zinc-600 font-mono mt-0.5 shrink-0 flex-wrap gap-x-3">
        <span>{vMin.toFixed(1)}</span>
        <div className="flex gap-2 flex-wrap">
          {allPts.map((pts, i) => {
            const color = series[i]?.color ?? SERIES_COLORS[i % SERIES_COLORS.length]!;
            const latest = pts.at(-1);
            return (
              <span key={i} style={{ color }} className="font-semibold">
                {series[i]?.label ? `${series[i].label}: ` : ""}
                {latest ? fmt(latest.v) : "—"}
              </span>
            );
          })}
        </div>
        <span>{vMax.toFixed(1)}</span>
      </div>
    </div>
  );
}

// ── history log ────────────────────────────────────────────────────────────

function HistoryLogWidget({ w }: { w: Widget }) {
  const [rows, setRows] = useState<Array<{ ts: number; value: unknown; quality: string }>>([]);

  useEffect(() => {
    if (!w.binding) return;
    const from = (Date.now() - 3600_000) * 1e6;
    fetch(`${apiBase}/api/v1/history?path=${encodeURIComponent(w.binding)}&from=${from}&limit=${(w.config?.pageSize as number) ?? 100}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setRows)
      .catch(() => {});
  }, [w.binding]);

  const downloadCSV = () => {
    if (!w.binding) return;
    const from = (Date.now() - 3600_000) * 1e6;
    const url = `${apiBase}/api/v1/history?path=${encodeURIComponent(w.binding)}&from=${from}&limit=10000&format=csv`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${w.binding.replace(/[:/]/g, "_")}.csv`;
    a.click();
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-end mb-0.5 shrink-0">
        <button onClick={downloadCSV} className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400">
          ↓ CSV
        </button>
      </div>
      <div className="flex-1 overflow-auto text-[10px] font-mono space-y-0.5">
        {rows.length === 0 && <div className="text-zinc-600 italic">No history</div>}
        {[...rows].reverse().map((r, i) => (
          <div key={i} className="flex gap-2 border-b border-zinc-800/50 pb-0.5">
            <span className="text-zinc-600 shrink-0">
              {new Date(r.ts > 1e15 ? r.ts / 1e6 : r.ts).toLocaleTimeString()}
            </span>
            <span className="text-zinc-300">{fmt(r.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MultiState widget ──────────────────────────────────────────────────────

type StateEntry = { value: number | string; label: string; color: string; textColor?: string };

const DEFAULT_STATES: StateEntry[] = [
  { value: 0, label: "OFF",     color: "#27272a", textColor: "#a1a1aa" },
  { value: 1, label: "RUNNING", color: "#14532d", textColor: "#4ade80" },
  { value: 2, label: "FAULT",   color: "#450a0a", textColor: "#f87171" },
];

function MultiStateWidget({ w }: { w: Widget }) {
  const t = useTag(w.binding);
  const states: StateEntry[] = (w.config?.states as StateEntry[]) ?? DEFAULT_STATES;
  const raw = t.value;
  // Match by loose equality (handles numeric string vs number).
  const match = states.find((s) => String(s.value) === String(raw));
  const bg      = match?.color    ?? "#1c1c1e";
  const textClr = match?.textColor ?? "#71717a";
  const text    = match?.label    ?? (raw == null ? "—" : String(raw));

  return (
    <div
      className="h-full flex items-center justify-center rounded transition-colors duration-300"
      style={{ backgroundColor: bg }}
    >
      <span className="text-lg font-bold tracking-widest uppercase" style={{ color: textClr }}>
        {text}
      </span>
    </div>
  );
}

// ── registry ───────────────────────────────────────────────────────────────

const renderers: Record<string, React.ComponentType<{ w: Widget }>> = {
  gauge:          GaugeWidget,
  numericDisplay: NumericDisplayWidget,
  textDisplay:    TextDisplayWidget,
  led:            LEDWidget,
  tank:           TankWidget,
  button:         ButtonWidget,
  setpoint:       SetpointWidget,
  trend:          TrendWidget,
  numericInput:   NumericInputWidget,
  textInput:      TextInputWidget,
  historyLog:     HistoryLogWidget,
  multiState:     MultiStateWidget,
};

export function WidgetRenderer({ w }: { w: Widget }) {
  const R = renderers[w.type] ?? (() => (
    <div className="flex items-center justify-center h-full text-zinc-500 text-xs">{w.type}</div>
  ));
  return (
    <Frame w={w}>
      <R w={w} />
    </Frame>
  );
}
