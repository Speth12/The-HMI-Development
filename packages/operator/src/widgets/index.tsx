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

function GaugeWidget({ w }: { w: Widget }) {
  const t = useTag(w.binding);
  const min = (w.config?.min as number) ?? 0;
  const max = (w.config?.max as number) ?? 100;
  const v = typeof t.value === "number" ? t.value : 0;
  const pct = Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
  const thresholds = (w.config?.thresholds as Array<{ value: number; color: string }>) ?? [];
  let color = "bg-emerald-500";
  thresholds.forEach((th) => { if (v >= th.value) color = th.color.startsWith("#") ? "" : th.color; });
  const inlineColor = thresholds.find((th) => v >= th.value)?.color;
  return (
    <div className="flex flex-col h-full justify-center">
      <div className="text-3xl font-semibold tabular-nums">
        {fmt(t.value)}
        {w.config?.unit ? <span className="text-base text-zinc-500 ml-1">{w.config.unit as string}</span> : null}
      </div>
      <div className="h-2 mt-2 rounded bg-zinc-800 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%`, ...(inlineColor ? { background: inlineColor } : {}) }} />
      </div>
      <div className={`text-[10px] mt-1 ${qualityColor[t.quality] ?? "text-zinc-500"}`}>{t.quality}</div>
    </div>
  );
}

function NumericDisplayWidget({ w }: { w: Widget }) {
  const t = useTag(w.binding);
  return (
    <div className="flex flex-col h-full justify-center">
      <div className="text-3xl font-semibold tabular-nums">{fmt(t.value)}</div>
      <div className={`text-[10px] mt-1 ${qualityColor[t.quality] ?? "text-zinc-500"}`}>{t.quality}</div>
    </div>
  );
}

function TextDisplayWidget({ w }: { w: Widget }) {
  const t = useTag(w.binding);
  return <div className="text-lg break-words">{fmt(t.value)}</div>;
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
        style={{ background: on ? trueColor : falseColor }}
      />
      <div className="text-sm">{on ? "ON" : "OFF"}</div>
    </div>
  );
}

function ButtonWidget({ w }: { w: Widget }) {
  return (
    <button className="w-full h-full rounded-md bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-sm font-medium transition">
      {(w.config?.label as string) ?? "Press"}
    </button>
  );
}

const placeholder = (label: string) => () => (
  <div className="flex items-center justify-center h-full text-zinc-500 text-xs">{label}</div>
);

const renderers: Record<string, React.ComponentType<{ w: Widget }>> = {
  gauge: GaugeWidget,
  numericDisplay: NumericDisplayWidget,
  textDisplay: TextDisplayWidget,
  led: LEDWidget,
  button: ButtonWidget,
  trend: placeholder("Trend"),
  numericInput: placeholder("Numeric Input"),
  textInput: placeholder("Text Input"),
  historyLog: placeholder("History Log"),
};

export function WidgetRenderer({ w }: { w: Widget }) {
  const R = renderers[w.type] ?? placeholder(w.type);
  return (
    <Frame w={w}>
      <R w={w} />
    </Frame>
  );
}
