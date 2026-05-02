// Operator panel widget renderers — read + write support.
// The operator runs ON the PLC so all URLs are relative (same origin).
import { useEffect, useRef, useState } from "react";
import { useTag } from "../hooks/useTag";

export type WidgetType =
  | "gauge" | "trend" | "led" | "button" | "numericInput"
  | "numericDisplay" | "textInput" | "textDisplay" | "historyLog";

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

function GaugeWidget({ w }: { w: Widget }) {
  const t = useTag(w.binding);
  const min = (w.config?.min as number) ?? 0;
  const max = (w.config?.max as number) ?? 100;
  const v = typeof t.value === "number" ? t.value : 0;
  const pct = Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
  const thresholds = (w.config?.thresholds as Array<{ value: number; color: string }>) ?? [];
  let barColor = "bg-emerald-500";
  let inlineColor: string | undefined;
  thresholds.forEach((th) => { if (v >= th.value) { barColor = ""; inlineColor = th.color; } });
  return (
    <div className="flex flex-col h-full justify-center">
      <div className="text-3xl font-semibold tabular-nums">
        {fmt(t.value)}
        {w.config?.unit ? <span className="text-base text-zinc-500 ml-1">{w.config.unit as string}</span> : null}
      </div>
      <div className="h-2 mt-2 rounded bg-zinc-800 overflow-hidden">
        <div className={`h-full ${barColor}`} style={{ width: `${pct}%`, ...(inlineColor ? { background: inlineColor } : {}) }} />
      </div>
      <div className={`text-[10px] mt-1 ${qualityColor[t.quality] ?? "text-zinc-500"}`}>{t.quality}</div>
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

// ── Write widgets ──────────────────────────────────────────────────────────

function ButtonWidget({ w }: { w: Widget }) {
  const t = useTag(w.binding);
  const label     = (w.config?.label    as string)  ?? "Press";
  const momentary = (w.config?.momentary as boolean) ?? true;
  const onValue   = w.config?.onValue  ?? 1;
  const offValue  = w.config?.offValue ?? 0;

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
  const commit = () => { if (w.binding) writeTag(w.binding, draft); setEditing(false); };
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

function TrendWidget({ w }: { w: Widget }) {
  const t = useTag(w.binding);
  const duration = ((w.config?.duration as number) ?? 300) * 1000;
  const [pts, setPts] = useState<Sample[]>([]);
  const ptsRef = useRef<Sample[]>([]);

  useEffect(() => {
    if (!w.binding) { setPts([]); ptsRef.current = []; return; }
    const from = (Date.now() - duration) * 1e6;
    fetch(`/api/v1/history?path=${encodeURIComponent(w.binding)}&from=${from}&limit=500`)
      .then((r) => (r.ok ? r.json() : []))
      .then((samples: Array<{ ts: number; value: unknown }>) => {
        const loaded: Sample[] = samples
          .filter((s) => typeof s.value === "number")
          .map((s) => ({ ts: s.ts > 1e15 ? s.ts / 1e6 : s.ts, v: s.value as number }));
        ptsRef.current = loaded;
        setPts([...loaded]);
      })
      .catch(() => {});
  }, [w.binding, duration]);

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

  const cfgMin  = w.config?.min as number | undefined;
  const cfgMax  = w.config?.max as number | undefined;
  const vMin    = cfgMin ?? (pts.length ? Math.min(...pts.map((p) => p.v)) : 0);
  const vMax    = cfgMax ?? (pts.length ? Math.max(...pts.map((p) => p.v)) : 100);
  const vRange  = vMax - vMin || 1;
  const latest  = pts.at(-1);

  const svgLine = (): string => {
    if (pts.length < 2) return "";
    const t0 = pts[0]!.ts, t1 = pts[pts.length - 1]!.ts, span = t1 - t0 || 1;
    return pts.map((p) => {
      const x = ((p.ts - t0) / span) * 100;
      const y = 100 - ((p.v - vMin) / vRange) * 100;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ");
  };

  const dotCoords = (() => {
    if (!pts.length) return null;
    const p = pts[pts.length - 1]!;
    const t0 = pts[0]!.ts, span = p.ts - t0 || 1;
    return { x: pts.length > 1 ? ((p.ts - t0) / span) * 100 : 100, y: 100 - ((p.v - vMin) / vRange) * 100 };
  })();

  return (
    <div className="flex flex-col h-full">
      <svg className="flex-1 w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
        {[0,25,50,75,100].map((y) => (
          <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#27272a" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
        ))}
        <polyline points={svgLine()} fill="none" stroke="#3b82f6" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {dotCoords && <circle cx={dotCoords.x} cy={dotCoords.y} r="2" fill="#3b82f6" vectorEffect="non-scaling-stroke" />}
      </svg>
      <div className="flex justify-between text-[10px] text-zinc-600 font-mono mt-0.5 shrink-0">
        <span>{vMin.toFixed(1)}</span>
        <span className="text-zinc-400 font-semibold">{latest ? fmt(latest.v) : "—"}</span>
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
  return (
    <div className="h-full overflow-auto text-[10px] font-mono space-y-0.5">
      {rows.length === 0 && <div className="text-zinc-600 italic">No history</div>}
      {[...rows].reverse().map((r, i) => (
        <div key={i} className="flex gap-2 border-b border-zinc-800/50 pb-0.5">
          <span className="text-zinc-600 shrink-0">{new Date(r.ts > 1e15 ? r.ts / 1e6 : r.ts).toLocaleTimeString()}</span>
          <span className="text-zinc-300">{fmt(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Registry ───────────────────────────────────────────────────────────────

const renderers: Record<string, React.ComponentType<{ w: Widget }>> = {
  gauge:          GaugeWidget,
  numericDisplay: NumericDisplayWidget,
  textDisplay:    TextDisplayWidget,
  led:            LEDWidget,
  button:         ButtonWidget,
  trend:          TrendWidget,
  numericInput:   NumericInputWidget,
  textInput:      TextInputWidget,
  historyLog:     HistoryLogWidget,
};

export function WidgetRenderer({ w }: { w: Widget }) {
  const R = renderers[w.type] ?? (() => (
    <div className="flex items-center justify-center h-full text-zinc-500 text-xs">{w.type}</div>
  ));
  return <Frame w={w}><R w={w} /></Frame>;
}
