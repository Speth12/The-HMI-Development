// Operator panel widget renderers — read + write support.
// The operator runs ON the PLC so all URLs are relative (same origin).
import { useEffect, useRef, useState } from "react";
import { useTag } from "../hooks/useTag";
import { useWriteConfirm } from "../writeContext";

export type WidgetType =
  | "gauge" | "trend" | "led" | "button" | "numericInput"
  | "numericDisplay" | "textInput" | "textDisplay" | "historyLog"
  | "tank" | "setpoint" | "multiState";

export type Widget = {
  id: string;
  type: WidgetType;
  x: number; y: number; w: number; h: number;
  binding?: string;
  config?: Record<string, unknown>;
};

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

async function writeTag(binding: string, value: unknown): Promise<void> {
  const sep = binding.indexOf(":");
  if (sep < 0) return;
  const datasource = binding.slice(0, sep);
  const path = binding.slice(sep + 1);
  try {
    await fetch(`/api/v1/tag/${encodeURIComponent(path)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ datasource, value }),
    });
  } catch { /* ignore */ }
}

// ── Frame ──────────────────────────────────────────────────────────────────

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

// ── Read widgets ───────────────────────────────────────────────────────────

// Gauge SVG helpers
const GAUGE_CX = 50, GAUGE_CY = 60, GAUGE_R = 36;
const GAUGE_START = 225;
const GAUGE_SWEEP = 270;

function gaugePolar(angleDeg: number, r = GAUGE_R) {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return { x: GAUGE_CX + r * Math.cos(rad), y: GAUGE_CY + r * Math.sin(rad) };
}

function gaugeArcPath(startDeg: number, sweepDeg: number): string {
  const s = Math.max(0.01, Math.min(sweepDeg, GAUGE_SWEEP - 0.01));
  const p0 = gaugePolar(startDeg); const p1 = gaugePolar(startDeg + s);
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
        <path d={gaugeArcPath(GAUGE_START, GAUGE_SWEEP)} fill="none" stroke="#27272a" strokeWidth="7" strokeLinecap="round" />
        {fillSweep > 0.5 && <path d={gaugeArcPath(GAUGE_START, fillSweep)} fill="none" stroke={arcColor} strokeWidth="7" strokeLinecap="round" />}
        {[0, 0.25, 0.5, 0.75, 1].map((p) => {
          const a = GAUGE_START + p * GAUGE_SWEEP;
          const outer = gaugePolar(a, GAUGE_R + 2); const inner = gaugePolar(a, GAUGE_R - 9);
          return <line key={p} x1={outer.x.toFixed(2)} y1={outer.y.toFixed(2)} x2={inner.x.toFixed(2)} y2={inner.y.toFixed(2)} stroke="#52525b" strokeWidth={p === 0 || p === 1 ? 1.5 : 0.8} />;
        })}
        <text x={minPt.x.toFixed(1)} y={minPt.y.toFixed(1)} textAnchor="end" fontSize="5" fill="#52525b" fontFamily="monospace">{min}</text>
        <text x={maxPt.x.toFixed(1)} y={maxPt.y.toFixed(1)} textAnchor="start" fontSize="5" fill="#52525b" fontFamily="monospace">{max}</text>
        <line x1={needleBase.x.toFixed(2)} y1={needleBase.y.toFixed(2)} x2={needleTip.x.toFixed(2)} y2={needleTip.y.toFixed(2)} stroke="#e4e4e7" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx={GAUGE_CX} cy={GAUGE_CY} r="3.5" fill="#52525b" />
        <circle cx={GAUGE_CX} cy={GAUGE_CY} r="1.5" fill="#a1a1aa" />
        <text x={GAUGE_CX} y={GAUGE_CY + 14} textAnchor="middle" fontSize="8" fill="#e4e4e7" fontWeight="600" fontFamily="monospace">
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
  const trueColor  = (w.config?.trueColor  as string) ?? "#22c55e";
  const falseColor = (w.config?.falseColor as string) ?? "#3f3f46";
  return (
    <div className="flex items-center gap-2 h-full">
      <div
        className="w-6 h-6 rounded-full"
        style={{
          background: on ? trueColor : falseColor,
          boxShadow: on ? `0 0 10px ${trueColor}88` : undefined,
        }}
      />
      <div className="text-sm font-medium">
        {on ? (w.config?.trueLabel as string ?? "ON") : (w.config?.falseLabel as string ?? "OFF")}
      </div>
    </div>
  );
}

// ── Tank (vertical level) ─────────────────────────────────────────────────

function TankWidget({ w }: { w: Widget }) {
  const t = useTag(w.binding);
  const min = (w.config?.min as number) ?? 0;
  const max = (w.config?.max as number) ?? 100;
  const v = typeof t.value === "number" ? t.value : 0;
  const pct = Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
  const thresholds = (w.config?.thresholds as Array<{ value: number; color: string }>) ?? [];
  let fillColor = "#3b82f6";
  thresholds.forEach((th) => { if (v >= th.value) fillColor = th.color; });
  return (
    <div className="flex gap-3 h-full items-end">
      <div className="flex flex-col w-10 h-full bg-zinc-800 rounded-md overflow-hidden relative border border-zinc-700">
        {[75, 50, 25].map((p) => (
          <div key={p} className="absolute left-0 right-0 border-t border-zinc-600/50"
            style={{ bottom: `${p}%` }} />
        ))}
        <div
          className="absolute bottom-0 left-0 right-0 rounded-b-md transition-all duration-500"
          style={{ height: `${pct}%`, background: fillColor, opacity: 0.85 }}
        />
      </div>
      <div className="flex flex-col justify-end pb-1">
        <div className="text-xl font-semibold tabular-nums leading-none">{fmt(t.value)}</div>
        {(w.config?.unit as string | undefined) && <div className="text-[10px] text-zinc-500">{w.config!.unit as string}</div>}
        <div className={`text-[9px] mt-1 ${qualityColor[t.quality] ?? "text-zinc-500"}`}>{t.quality}</div>
      </div>
    </div>
  );
}

// ── Write widgets ──────────────────────────────────────────────────────────

function ButtonWidget({ w }: { w: Widget }) {
  const t = useTag(w.binding);
  const confirm   = useWriteConfirm();
  const label     = (w.config?.label    as string)  ?? "Press";
  const momentary = (w.config?.momentary as boolean) ?? true;
  const onValue   = w.config?.onValue  ?? 1;
  const offValue  = w.config?.offValue ?? 0;

  if (momentary) {
    // Momentary: write directly on pointer events (no confirm — too fast for a dialog).
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
  // Toggle: show confirmation dialog before writing.
  const on = !!t.value;
  const nextValue = on ? offValue : onValue;
  const nextLabel = on ? `OFF (${String(offValue)})` : `ON (${String(onValue)})`;
  return (
    <button
      className={`w-full h-full rounded-md text-sm font-medium transition-all active:scale-95 ${
        on ? "bg-emerald-600 hover:bg-emerald-500" : "bg-zinc-700 hover:bg-zinc-600"
      }`}
      onClick={() => w.binding && confirm({ binding: w.binding, value: nextValue, label: nextLabel })}
    >
      {label}
    </button>
  );
}

function NumericInputWidget({ w }: { w: Widget }) {
  const t = useTag(w.binding);
  const confirm = useWriteConfirm();
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
    if (!isNaN(n) && w.binding) {
      confirm({ binding: w.binding, value: n });
    }
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
        {editing ? "Enter → confirm write" : t.quality}
      </div>
    </div>
  );
}

function TextInputWidget({ w }: { w: Widget }) {
  const t = useTag(w.binding);
  const confirm = useWriteConfirm();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const startEdit = () => { setDraft(fmt(t.value)); setEditing(true); };
  const commit = () => {
    if (w.binding) confirm({ binding: w.binding, value: draft });
    setEditing(false);
  };
  return (
    <div className="flex flex-col h-full justify-center">
      {editing ? (
        <input autoFocus type="text" value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          className="text-sm bg-zinc-800 border border-blue-500 rounded px-2 py-1 w-full outline-none font-mono"
        />
      ) : (
        <div onClick={startEdit} className="text-sm cursor-text hover:bg-zinc-800 rounded px-1 font-mono">
          {fmt(t.value)}
        </div>
      )}
    </div>
  );
}

// ── Trend ──────────────────────────────────────────────────────────────────

type Sample = { ts: number; v: number };
type TrendSeries = { binding: string; color: string; label?: string };
const SERIES_COLORS = ["#3b82f6","#22c55e","#f59e0b","#ef4444","#a855f7","#06b6d4"];

function useSeries(binding: string | undefined, duration: number): Sample[] {
  const t = useTag(binding);
  const [pts, setPts] = useState<Sample[]>([]);
  const ptsRef = useRef<Sample[]>([]);
  useEffect(() => {
    if (!binding) { setPts([]); ptsRef.current = []; return; }
    const from = (Date.now() - duration) * 1e6;
    fetch(`/api/v1/history?path=${encodeURIComponent(binding)}&from=${from}&limit=500`)
      .then((r) => (r.ok ? r.json() : []))
      .then((samples: Array<{ ts: number; value: unknown }>) => {
        const loaded: Sample[] = samples.filter((s) => typeof s.value === "number")
          .map((s) => ({ ts: s.ts > 1e15 ? s.ts / 1e6 : s.ts, v: s.value as number }));
        ptsRef.current = loaded; setPts([...loaded]);
      }).catch(() => {});
  }, [binding, duration]);
  useEffect(() => {
    if (typeof t.value !== "number" || t.quality === "Unknown") return;
    const now = t.ts > 1e15 ? t.ts / 1e6 : t.ts > 0 ? t.ts : Date.now();
    const prev = ptsRef.current;
    if (prev.length > 0 && prev[prev.length - 1]!.ts >= now) return;
    const next = [...prev.filter((p) => p.ts >= now - duration), { ts: now, v: t.value as number }];
    ptsRef.current = next; setPts(next);
  }, [t.value, t.ts, t.quality, duration]);
  return pts;
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

  const cfgTags = w.config?.tags as TrendSeries[] | undefined;
  const series: TrendSeries[] = cfgTags?.length ? cfgTags
    : w.binding ? [{ binding: w.binding, color: SERIES_COLORS[0]! }] : [];

  const s0 = useSeries(series[0]?.binding, duration);
  const s1 = useSeries(series[1]?.binding, duration);
  const s2 = useSeries(series[2]?.binding, duration);
  const s3 = useSeries(series[3]?.binding, duration);
  const s4 = useSeries(series[4]?.binding, duration);
  const s5 = useSeries(series[5]?.binding, duration);
  const allPts = [s0,s1,s2,s3,s4,s5].slice(0, series.length);
  const flat = allPts.flat();

  const cfgMin = w.config?.min as number | undefined;
  const cfgMax = w.config?.max as number | undefined;
  const vMin = cfgMin ?? (flat.length ? Math.min(...flat.map((p) => p.v)) : 0);
  const vMax = cfgMax ?? (flat.length ? Math.max(...flat.map((p) => p.v)) : 100);
  const vRange = vMax - vMin || 1;
  const tMax = flat.length ? Math.max(...flat.map((p) => p.ts)) : Date.now();
  const tMin = tMax - duration;
  const tSpan = tMax - tMin || 1;

  const toLine = (pts: Sample[]) => pts.length < 2 ? "" : pts.filter((p) => p.ts >= tMin)
    .map((p) => `${(((p.ts-tMin)/tSpan)*100).toFixed(2)},${(100-((p.v-vMin)/vRange)*100).toFixed(2)}`).join(" ");

  return (
    <div className="flex flex-col h-full">
      {/* Time-window picker */}
      <div className="flex gap-1 shrink-0 mb-0.5">
        {TREND_WINDOWS.map((tw) => (
          <button key={tw.sec} onClick={() => setWindowSec(tw.sec)}
            className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${windowSec === tw.sec ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"}`}>
            {tw.label}
          </button>
        ))}
      </div>
      <svg className="flex-1 w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
        {[0,25,50,75,100].map((y) => (
          <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#27272a" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
        ))}
        {allPts.map((pts, i) => {
          const color = series[i]?.color ?? SERIES_COLORS[i % SERIES_COLORS.length]!;
          const last = pts.at(-1);
          return (
            <g key={i}>
              <polyline points={toLine(pts)} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              {last && <circle cx={(((last.ts-tMin)/tSpan)*100)} cy={(100-((last.v-vMin)/vRange)*100)} r="2" fill={color} vectorEffect="non-scaling-stroke" />}
            </g>
          );
        })}
      </svg>
      <div className="flex items-center justify-between text-[10px] text-zinc-600 font-mono mt-0.5 shrink-0 gap-2 flex-wrap">
        <span>{vMin.toFixed(1)}</span>
        <div className="flex gap-2 flex-wrap">
          {allPts.map((pts, i) => {
            const color = series[i]?.color ?? SERIES_COLORS[i % SERIES_COLORS.length]!;
            const last = pts.at(-1);
            return <span key={i} style={{ color }} className="font-semibold">{series[i]?.label ? `${series[i].label}: ` : ""}{last ? fmt(last.v) : "—"}</span>;
          })}
        </div>
        <span>{vMax.toFixed(1)}</span>
      </div>
    </div>
  );
}

function HistoryLogWidget({ w }: { w: Widget }) {
  const [rows, setRows] = useState<Array<{ ts: number; value: unknown }>>([]);
  useEffect(() => {
    if (!w.binding) return;
    const from = (Date.now() - 3600_000) * 1e6;
    fetch(`/api/v1/history?path=${encodeURIComponent(w.binding)}&from=${from}&limit=${(w.config?.pageSize as number) ?? 100}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setRows).catch(() => {});
  }, [w.binding]);
  const downloadCSV = () => {
    if (!w.binding) return;
    const from = (Date.now() - 3600_000) * 1e6;
    const a = document.createElement("a");
    a.href = `/api/v1/history?path=${encodeURIComponent(w.binding)}&from=${from}&limit=10000&format=csv`;
    a.download = `${w.binding.replace(/[:/]/g, "_")}.csv`;
    a.click();
  };
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-end mb-0.5 shrink-0">
        <button onClick={downloadCSV} className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400">↓ CSV</button>
      </div>
      <div className="flex-1 overflow-auto text-[10px] font-mono space-y-0.5">
        {rows.length === 0 && <div className="text-zinc-600 italic">No history</div>}
        {[...rows].reverse().map((r, i) => (
          <div key={i} className="flex gap-2 border-b border-zinc-800/50 pb-0.5">
            <span className="text-zinc-600 shrink-0">{new Date(r.ts > 1e15 ? r.ts / 1e6 : r.ts).toLocaleTimeString()}</span>
            <span className="text-zinc-300">{fmt(r.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Setpoint slider ────────────────────────────────────────────────────────

function SetpointWidget({ w }: { w: Widget }) {
  const t = useTag(w.binding);
  const confirm = useWriteConfirm();
  const min = (w.config?.min as number) ?? 0;
  const max = (w.config?.max as number) ?? 100;
  const step = (w.config?.step as number) ?? 1;
  const [draft, setDraft] = useState<number | null>(null);
  const displayVal = draft ?? (typeof t.value === "number" ? t.value : min);

  const commit = (n: number) => {
    setDraft(null);
    if (w.binding) confirm({ binding: w.binding, value: n });
  };

  return (
    <div className="flex flex-col h-full justify-center gap-2">
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-semibold tabular-nums">{displayVal.toFixed(step < 1 ? 1 : 0)}</span>
        {(w.config?.unit as string | undefined) && <span className="text-xs text-zinc-500">{w.config!.unit as string}</span>}
      </div>
      <input
        type="range" min={min} max={max} step={step} value={displayVal}
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

// ── Registry ───────────────────────────────────────────────────────────────

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
  return <Frame w={w}><R w={w} /></Frame>;
}
