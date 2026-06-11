import { useRef } from "react";
import { useProject } from "../store/projectStore";
import { useTag } from "../hooks/useTag";
import { PositionEditor } from "./Canvas";
import { registerWidget, getWidget, type PropertiesPanelProps } from "../widgets/widgetRegistry";

const qualityColor: Record<string, string> = {
  Good: "text-emerald-400", Bad: "text-red-400", Uncertain: "text-amber-400",
  Unknown: "text-zinc-600", Write: "text-purple-400",
};

const fmt = (v: unknown): string => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return Number.isInteger(v) ? `${v}` : v.toFixed(3);
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
};

function LiveTagPreview({ binding }: { binding?: string }) {
  const t = useTag(binding);
  if (!binding) return null;
  return (
    <div className="flex items-center gap-2 mt-1 px-2 py-1.5 rounded bg-zinc-950/60 border border-zinc-800">
      <span className="text-xs font-mono font-semibold text-zinc-200">{fmt(t.value)}</span>
      <span className={`text-[10px] ml-auto ${qualityColor[t.quality] ?? "text-zinc-600"}`}>{t.quality}</span>
    </div>
  );
}

export function Properties() {
  const { project, activePageId, selectedWidgetId, updateWidget } = useProject();
  const page = project.pages.find((p) => p.id === activePageId);
  const w = page?.widgets.find((x) => x.id === selectedWidgetId);

  if (!w || !page) {
    return (
      <div className="p-3 text-xs text-zinc-500">
        Select a widget on the canvas to edit its properties.
      </div>
    );
  }

  const setConfig = (k: string, v: unknown) =>
    updateWidget(page.id, w.id, { config: { ...(w.config ?? {}), [k]: v } });

  const cfgStr = (k: string, def = "") => (w.config?.[k] as string) ?? def;
  const cfgNum = (k: string, def?: number) => (w.config?.[k] as number | undefined) ?? def;
  const cfgBool = (k: string, def = false) => (w.config?.[k] as boolean | undefined) ?? def;

  const inp = "w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-zinc-500";
  const numInp = `${inp} font-mono`;
  const label = (t: string) => <div className="text-[10px] text-zinc-500 mb-0.5">{t}</div>;

  const panelProps: PropertiesPanelProps = { w, page, project, setConfig, cfgStr, cfgNum, cfgBool, inp, numInp, label };
  const WidgetPanel = getWidget(w.type)?.PropertiesPanel;

  return (
    <div className="p-3 space-y-4 overflow-auto">
      {/* Widget meta */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Widget</div>
        <div className="text-sm font-medium">{w.type}</div>
        <div className="text-[10px] text-zinc-600 font-mono">{w.id}</div>
      </div>

      {/* Binding + live value */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Binding</div>
        <input
          value={w.binding ?? ""}
          onChange={(e) => updateWidget(page.id, w.id, { binding: e.target.value || undefined })}
          placeholder="ds:tagPath"
          className={`${inp} font-mono`}
        />
        <div className="text-[10px] text-zinc-600 mt-0.5">Drag tag from browser → widget</div>
        <LiveTagPreview binding={w.binding} />
      </div>

      {/* Visibility binding */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Visibility</div>
        <input
          value={w.visibleBinding ?? ""}
          onChange={(e) => updateWidget(page.id, w.id, { visibleBinding: e.target.value || undefined })}
          placeholder="ds:tagPath (BOOL — hides when 0/false)"
          className={`${inp} font-mono`}
        />
        <LiveTagPreview binding={w.visibleBinding} />
      </div>

      {/* Layout */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Layout</div>
        <PositionEditor pageId={page.id} widgetId={w.id} />
      </div>

      {/* Color binding (all types) */}
      <ColorBindingEditor w={w} setConfig={setConfig} cfgStr={cfgStr} inp={inp} numInp={numInp} label={label} />

      {/* Label (all types) */}
      <div>
        {label("Label")}
        <input value={cfgStr("label")} onChange={(e) => setConfig("label", e.target.value)} className={inp} />
      </div>

      {/* Per-widget panel — looked up from the registry */}
      {WidgetPanel && <WidgetPanel {...panelProps} />}
    </div>
  );
}

// ── Multi-State editor ────────────────────────────────────────────────────

type StateEntry = { value: number | string; label: string; color: string; textColor?: string };

function MultiStateEditor({ w, setConfig, inp, label }: {
  w: { config?: Record<string, unknown> };
  setConfig: (k: string, v: unknown) => void;
  inp: string; label: LabelFn;
}) {
  const states: StateEntry[] = (w.config?.states as StateEntry[]) ?? [
    { value: 0, label: "OFF",      color: "#27272a", textColor: "#a1a1aa" },
    { value: 1, label: "RUNNING",  color: "#14532d", textColor: "#4ade80" },
    { value: 2, label: "FAULT",    color: "#450a0a", textColor: "#f87171" },
  ];

  const update = (idx: number, patch: Partial<StateEntry>) => {
    const next = states.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    setConfig("states", next);
  };

  const add = () => {
    setConfig("states", [...states, { value: states.length, label: "STATE " + states.length, color: "#1c1c1e", textColor: "#ffffff" }]);
  };

  const remove = (idx: number) => setConfig("states", states.filter((_, i) => i !== idx));

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        {label("States")}
        <button onClick={add} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700">+ add</button>
      </div>
      <div className="space-y-1.5">
        {states.map((s, i) => (
          <div key={i} className="border border-zinc-700/50 rounded p-1.5 space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-zinc-500 shrink-0">val</span>
              <input value={String(s.value)} placeholder="0"
                onChange={(e) => update(i, { value: isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value) })}
                className={`${inp} w-12 font-mono text-[10px]`} />
              <input value={s.label} placeholder="label"
                onChange={(e) => update(i, { label: e.target.value })}
                className={`${inp} flex-1`} />
              <button onClick={() => remove(i)} className="text-zinc-600 hover:text-red-400 text-xs shrink-0">×</button>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-zinc-500 w-6">bg</span>
              <input type="color" value={s.color}
                onChange={(e) => update(i, { color: e.target.value })}
                className="h-5 w-7 rounded border border-zinc-700 bg-zinc-900 cursor-pointer shrink-0" />
              <span className="text-[10px] text-zinc-500 w-6">txt</span>
              <input type="color" value={s.textColor ?? "#ffffff"}
                onChange={(e) => update(i, { textColor: e.target.value })}
                className="h-5 w-7 rounded border border-zinc-700 bg-zinc-900 cursor-pointer shrink-0" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Trend series editor ────────────────────────────────────────────────────

const SERIES_COLORS = ["#3b82f6","#22c55e","#f59e0b","#ef4444","#a855f7","#06b6d4"];
type TrendSeries = { binding: string; color: string; label?: string; fill?: boolean; yMin?: number; yMax?: number };
type RefLine = { value: number; color: string; label?: string };

function TrendSeriesEditor({ w, setConfig, inp, label }: {
  w: { binding?: string; config?: Record<string, unknown> };
  setConfig: (k: string, v: unknown) => void;
  inp: string; label: LabelFn;
}) {
  const cfgTags = w.config?.tags as TrendSeries[] | undefined;
  // If no explicit tags config, seed from the widget binding (series 0).
  const tags: TrendSeries[] = cfgTags ?? (w.binding ? [{ binding: w.binding, color: SERIES_COLORS[0]! }] : []);

  const update = (idx: number, patch: Partial<TrendSeries>) => {
    const next = tags.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    setConfig("tags", next);
  };

  const add = () => {
    const color = SERIES_COLORS[tags.length % SERIES_COLORS.length]!;
    setConfig("tags", [...tags, { binding: "", color, label: "" }]);
  };

  const remove = (idx: number) => setConfig("tags", tags.filter((_, i) => i !== idx));

  if (tags.length <= 1 && !cfgTags) {
    // Single-series mode — show "add series" to switch to multi.
    return (
      <div>
        {label("Multi-series")}
        <button onClick={add} className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 w-full text-left">
          + add second series
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        {label("Series")}
        {tags.length < 6 && (
          <button onClick={add} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700">+ add</button>
        )}
      </div>
      <div className="space-y-2">
        {tags.map((s, i) => (
          <div key={i} className="border border-zinc-700/50 rounded p-2 space-y-1.5">
            <div className="flex items-center gap-1">
              <input type="color" value={s.color}
                onChange={(e) => update(i, { color: e.target.value })}
                className="h-6 w-8 rounded border border-zinc-700 bg-zinc-900 cursor-pointer shrink-0" />
              <input value={s.label ?? ""} placeholder="label"
                onChange={(e) => update(i, { label: e.target.value })}
                className={`${inp} flex-1`} />
              <label className="flex items-center gap-0.5 text-[9px] text-zinc-500 shrink-0 cursor-pointer" title="Fill area">
                <input type="checkbox" checked={s.fill ?? false}
                  onChange={(e) => update(i, { fill: e.target.checked || undefined })}
                  className="accent-blue-500 scale-75" />
                fill
              </label>
              {tags.length > 1 && (
                <button onClick={() => remove(i)} className="text-zinc-600 hover:text-red-400 text-xs shrink-0">×</button>
              )}
            </div>
            <input value={s.binding} placeholder="ds:tagPath"
              onChange={(e) => update(i, { binding: e.target.value })}
              className={`${inp} font-mono text-[10px]`} />
            <div className="flex gap-1 items-center">
              <span className="text-[9px] text-zinc-600 shrink-0">Y range</span>
              <input type="number" placeholder="min"
                value={s.yMin ?? ""}
                onChange={(e) => update(i, { yMin: e.target.value === "" ? undefined : Number(e.target.value) })}
                className="w-16 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-[10px] font-mono focus:outline-none focus:border-zinc-500" />
              <span className="text-[9px] text-zinc-600">–</span>
              <input type="number" placeholder="max"
                value={s.yMax ?? ""}
                onChange={(e) => update(i, { yMax: e.target.value === "" ? undefined : Number(e.target.value) })}
                className="w-16 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-[10px] font-mono focus:outline-none focus:border-zinc-500" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Reference lines editor ────────────────────────────────────────────────

function RefLinesEditor({ w, setConfig, inp, label }: {
  w: { config?: Record<string, unknown> };
  setConfig: (k: string, v: unknown) => void;
  inp: string; label: LabelFn;
}) {
  const lines: RefLine[] = (w.config?.refLines as RefLine[]) ?? [];
  const update = (idx: number, patch: Partial<RefLine>) =>
    setConfig("refLines", lines.map((l, i) => i === idx ? { ...l, ...patch } : l));
  const add = () => setConfig("refLines", [...lines, { value: 0, color: "#ef4444", label: "" }]);
  const remove = (idx: number) => setConfig("refLines", lines.filter((_, i) => i !== idx));

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        {label("Reference Lines")}
        <button onClick={add} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700">+ add</button>
      </div>
      {lines.length === 0 && <div className="text-[10px] text-zinc-600 italic">No reference lines.</div>}
      <div className="space-y-1.5">
        {lines.map((rl, i) => (
          <div key={i} className="flex items-center gap-1">
            <input type="color" value={rl.color}
              onChange={(e) => update(i, { color: e.target.value })}
              className="h-6 w-8 rounded border border-zinc-700 bg-zinc-900 cursor-pointer shrink-0" />
            <input type="number" value={rl.value}
              onChange={(e) => update(i, { value: Number(e.target.value) })}
              className="w-16 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-zinc-500" />
            <input value={rl.label ?? ""} placeholder="label"
              onChange={(e) => update(i, { label: e.target.value })}
              className={`${inp} flex-1`} />
            <button onClick={() => remove(i)} className="text-zinc-600 hover:text-red-400 text-xs shrink-0">×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Image source editor ────────────────────────────────────────────────────

function ImageUploadEditor({ setConfig, cfgStr, inp, label }: {
  setConfig: (k: string, v: unknown) => void;
  cfgStr: (k: string, def?: string) => string;
  inp: string; label: LabelFn;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const src = cfgStr("src");
  const images = useProject(s => s.project.images ?? []);

  // Resolve current src for preview
  const isLib = src.startsWith("lib:");
  const libId = isLib ? src.slice(4) : null;
  const libAsset = libId ? images.find(i => i.id === libId) : null;
  const previewSrc = isLib ? (libAsset?.dataUrl ?? null) : (src || null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setConfig("src", reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-2">
      {/* Library picker */}
      {images.length > 0 && (
        <div>
          {label("From image library")}
          <div className="grid grid-cols-3 gap-1 mt-1 max-h-40 overflow-auto">
            {images.map(img => (
              <button
                key={img.id}
                onClick={() => setConfig("src", `lib:${img.id}`)}
                title={img.name}
                className={`rounded border p-0.5 transition-colors ${
                  libId === img.id
                    ? "border-blue-500 bg-blue-950/30"
                    : "border-zinc-700 hover:border-zinc-500 bg-zinc-800/40"
                }`}
              >
                <img src={img.dataUrl} alt={img.name}
                  className="w-full object-contain rounded"
                  style={{ height: 40 }} />
              </button>
            ))}
          </div>
          {images.length > 0 && (
            <div className="text-[9px] text-zinc-600 mt-1">Click to select · or use URL / upload below</div>
          )}
        </div>
      )}

      {/* URL input */}
      <div>
        {label("Image URL")}
        <input
          value={isLib ? "" : src}
          onChange={e => setConfig("src", e.target.value)}
          placeholder="https://… or leave blank"
          className={`mt-1 ${inp}`}
        />
      </div>

      {/* Upload fallback */}
      <button onClick={() => fileRef.current?.click()}
        className="w-full py-1.5 text-xs rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 border-dashed">
        Upload from file…
      </button>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />

      {/* Preview + clear */}
      {previewSrc && (
        <div className="space-y-1">
          <img src={previewSrc} alt=""
            className="w-full max-h-24 object-contain rounded border border-zinc-700 bg-zinc-950" />
          {libAsset && (
            <div className="text-[10px] text-zinc-500 text-center">{libAsset.name} · {libAsset.width}×{libAsset.height}</div>
          )}
          <button onClick={() => setConfig("src", undefined)}
            className="text-[10px] text-red-500 hover:text-red-400">Remove image</button>
        </div>
      )}
    </div>
  );
}

// ── Color binding editor ───────────────────────────────────────────────────

type ColorThreshold = { value: number; color: string };

function ColorBindingEditor({ w, setConfig, cfgStr, inp, numInp, label }: {
  w: { binding?: string; config?: Record<string, unknown> };
  setConfig: (k: string, v: unknown) => void;
  cfgStr: (k: string, def?: string) => string;
  inp: string; numInp: string; label: LabelFn;
}) {
  const thresholds: ColorThreshold[] = (w.config?.colorThresholds as ColorThreshold[]) ?? [];

  const update = (idx: number, patch: Partial<ColorThreshold>) => {
    setConfig("colorThresholds", thresholds.map((t, i) => i === idx ? { ...t, ...patch } : t));
  };
  const add = () => {
    const lastVal = thresholds.at(-1)?.value ?? 75;
    setConfig("colorThresholds", [...thresholds, { value: lastVal + 10, color: "#ef4444" }]);
  };
  const remove = (idx: number) => setConfig("colorThresholds", thresholds.filter((_, i) => i !== idx));

  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Color</div>
      <div className="mb-1.5">
        <div className="text-[10px] text-zinc-500 mb-0.5">Source tag (blank = use binding)</div>
        <input
          value={cfgStr("colorBinding")}
          onChange={(e) => setConfig("colorBinding", e.target.value || undefined)}
          placeholder="ds:tagPath"
          className={`${inp} font-mono`}
        />
      </div>
      <div className="flex items-center justify-between mb-1">
        {label("Thresholds (≥ value → color)")}
        <button onClick={add} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700">+ add</button>
      </div>
      <div className="space-y-1">
        {thresholds.map((t, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-600 w-3">≥</span>
            <input type="number" value={t.value}
              onChange={(e) => update(i, { value: Number(e.target.value) })}
              className={`${numInp} w-16`} />
            <input type="color" value={t.color}
              onChange={(e) => update(i, { color: e.target.value })}
              className="h-6 w-8 rounded border border-zinc-700 bg-zinc-900 cursor-pointer shrink-0" />
            <input value={t.color} onChange={(e) => update(i, { color: e.target.value })}
              className={`${inp} flex-1 font-mono text-[10px]`} />
            <button onClick={() => remove(i)} className="text-zinc-600 hover:text-red-400 text-xs shrink-0">×</button>
          </div>
        ))}
        {thresholds.length === 0 && (
          <div className="text-[10px] text-zinc-600 italic">No thresholds — default border</div>
        )}
      </div>
    </div>
  );
}

// ── Shared sub-editors ─────────────────────────────────────────────────────

type LabelFn = (t: string) => React.ReactNode;

function RangeEditor({ cfgNum, setConfig, inp, numInp, label, note }: {
  cfgNum: (k: string, def?: number) => number | undefined;
  setConfig: (k: string, v: unknown) => void;
  inp: string; numInp: string; label: LabelFn; note?: string;
}) {
  return (
    <div>
      {label("Range")}
      <div className="grid grid-cols-2 gap-1.5">
        <label className="text-[10px] text-zinc-600">min
          <input type="number" value={cfgNum("min") ?? ""} placeholder="auto"
            onChange={(e) => setConfig("min", e.target.value === "" ? undefined : Number(e.target.value))}
            className={`mt-0.5 ${numInp}`} />
        </label>
        <label className="text-[10px] text-zinc-600">max
          <input type="number" value={cfgNum("max") ?? ""} placeholder="auto"
            onChange={(e) => setConfig("max", e.target.value === "" ? undefined : Number(e.target.value))}
            className={`mt-0.5 ${numInp}`} />
        </label>
      </div>
      {note && <div className="text-[10px] text-zinc-600 mt-0.5">{note}</div>}
    </div>
  );
}

function UnitEditor({ cfgStr, setConfig, inp, label }: {
  cfgStr: (k: string, def?: string) => string;
  setConfig: (k: string, v: unknown) => void;
  inp: string; label: LabelFn;
}) {
  return (
    <div>
      {label("Unit")}
      <input value={cfgStr("unit")} onChange={(e) => setConfig("unit", e.target.value)}
        placeholder="°C, bar, rpm…" className={inp} />
    </div>
  );
}

type Threshold = { value: number; color: string };

function ThresholdEditor({ w, setConfig, inp, numInp, label }: {
  w: { config?: Record<string, unknown> };
  setConfig: (k: string, v: unknown) => void;
  inp: string; numInp: string; label: LabelFn;
}) {
  const thresholds: Threshold[] = (w.config?.thresholds as Threshold[]) ?? [];

  const update = (idx: number, patch: Partial<Threshold>) => {
    const next = thresholds.map((t, i) => (i === idx ? { ...t, ...patch } : t));
    setConfig("thresholds", next);
  };

  const add = () => {
    const lastVal = thresholds.at(-1)?.value ?? 75;
    setConfig("thresholds", [...thresholds, { value: lastVal + 10, color: "#ef4444" }]);
  };

  const remove = (idx: number) => {
    setConfig("thresholds", thresholds.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        {label("Color thresholds")}
        <button onClick={add} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700">+ add</button>
      </div>
      <div className="space-y-1">
        {thresholds.map((t, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-600 w-6">≥</span>
            <input type="number" value={t.value}
              onChange={(e) => update(i, { value: Number(e.target.value) })}
              className={`${numInp} w-16 flex-1`} />
            <input type="color" value={t.color}
              onChange={(e) => update(i, { color: e.target.value })}
              className="h-6 w-8 rounded border border-zinc-700 bg-zinc-900 cursor-pointer shrink-0" />
            <input value={t.color} onChange={(e) => update(i, { color: e.target.value })}
              className={`${inp} w-20 font-mono text-[10px]`} />
            <button onClick={() => remove(i)} className="text-zinc-600 hover:text-red-400 text-xs shrink-0">×</button>
          </div>
        ))}
        {thresholds.length === 0 && (
          <div className="text-[10px] text-zinc-600 italic">No thresholds — bar stays green</div>
        )}
      </div>
    </div>
  );
}

// ── Per-widget PropertiesPanel components ─────────────────────────────────

function GaugeProps({ setConfig, cfgNum, cfgStr, inp, numInp, label, w }: PropertiesPanelProps) {
  return (
    <>
      <RangeEditor cfgNum={cfgNum} setConfig={setConfig} inp={inp} numInp={numInp} label={label} />
      <UnitEditor cfgStr={cfgStr} setConfig={setConfig} inp={inp} label={label} />
      <ThresholdEditor w={w} setConfig={setConfig} inp={inp} numInp={numInp} label={label} />
    </>
  );
}

function NumericDisplayProps({ setConfig, cfgNum, cfgStr, inp, numInp, label }: PropertiesPanelProps) {
  return (
    <>
      <RangeEditor cfgNum={cfgNum} setConfig={setConfig} inp={inp} numInp={numInp} label={label} />
      <UnitEditor cfgStr={cfgStr} setConfig={setConfig} inp={inp} label={label} />
    </>
  );
}

function NumericInputProps({ setConfig, cfgStr, inp, label }: PropertiesPanelProps) {
  return <UnitEditor cfgStr={cfgStr} setConfig={setConfig} inp={inp} label={label} />;
}

function LEDProps({ setConfig, cfgStr, inp, label }: PropertiesPanelProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <div>
          {label("ON color")}
          <div className="flex gap-1">
            <input type="color" value={cfgStr("trueColor", "#22c55e")}
              onChange={(e) => setConfig("trueColor", e.target.value)}
              className="h-7 w-8 rounded border border-zinc-700 bg-zinc-900 cursor-pointer" />
            <input value={cfgStr("trueColor", "#22c55e")}
              onChange={(e) => setConfig("trueColor", e.target.value)}
              className={`${inp} flex-1 font-mono text-[10px]`} />
          </div>
        </div>
        <div>
          {label("OFF color")}
          <div className="flex gap-1">
            <input type="color" value={cfgStr("falseColor", "#3f3f46")}
              onChange={(e) => setConfig("falseColor", e.target.value)}
              className="h-7 w-8 rounded border border-zinc-700 bg-zinc-900 cursor-pointer" />
            <input value={cfgStr("falseColor", "#3f3f46")}
              onChange={(e) => setConfig("falseColor", e.target.value)}
              className={`${inp} flex-1 font-mono text-[10px]`} />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>{label("ON label")}<input value={cfgStr("trueLabel", "ON")} onChange={(e) => setConfig("trueLabel", e.target.value)} className={inp} /></div>
        <div>{label("OFF label")}<input value={cfgStr("falseLabel", "OFF")} onChange={(e) => setConfig("falseLabel", e.target.value)} className={inp} /></div>
      </div>
    </>
  );
}

function ButtonProps({ setConfig, cfgStr, cfgNum, cfgBool, inp, numInp, label, project }: PropertiesPanelProps) {
  return (
    <>
      <div>
        {label("Action")}
        <div className="flex gap-2">
          {(["write", "navigate"] as const).map((a) => (
            <button key={a} onClick={() => setConfig("action", a)}
              className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                cfgStr("action", "write") === a
                  ? "bg-blue-700 border-blue-600 text-white"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
              }`}>{a}</button>
          ))}
        </div>
      </div>
      {cfgStr("action", "write") === "navigate" ? (
        <div>
          {label("Target page")}
          <select value={cfgStr("navigateTo")} onChange={(e) => setConfig("navigateTo", e.target.value)} className={inp}>
            <option value="">— select page —</option>
            {project.pages.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      ) : (
        <>
          <div>
            {label("Mode")}
            <div className="flex gap-2">
              {["momentary", "toggle"].map((m) => (
                <button key={m} onClick={() => setConfig("momentary", m === "momentary")}
                  className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                    (m === "momentary") === cfgBool("momentary", true)
                      ? "bg-blue-700 border-blue-600 text-white"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                  }`}>{m}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              {label("ON value")}
              <input type="number" value={cfgNum("onValue", 1)} onChange={(e) => setConfig("onValue", Number(e.target.value))} className={numInp} />
            </div>
            <div>
              {label("OFF value")}
              <input type="number" value={cfgNum("offValue", 0)} onChange={(e) => setConfig("offValue", Number(e.target.value))} className={numInp} />
            </div>
          </div>
        </>
      )}
    </>
  );
}

function TankProps({ setConfig, cfgNum, cfgStr, inp, numInp, label, w }: PropertiesPanelProps) {
  return (
    <>
      <RangeEditor cfgNum={cfgNum} setConfig={setConfig} inp={inp} numInp={numInp} label={label} />
      <UnitEditor cfgStr={cfgStr} setConfig={setConfig} inp={inp} label={label} />
      <ThresholdEditor w={w} setConfig={setConfig} inp={inp} numInp={numInp} label={label} />
    </>
  );
}

function SetpointProps({ setConfig, cfgNum, cfgStr, inp, numInp, label }: PropertiesPanelProps) {
  return (
    <>
      <RangeEditor cfgNum={cfgNum} setConfig={setConfig} inp={inp} numInp={numInp} label={label} />
      <UnitEditor cfgStr={cfgStr} setConfig={setConfig} inp={inp} label={label} />
      <div>
        {label("Step")}
        <input type="number" min={0.01} step={0.1} value={cfgNum("step", 1)}
          onChange={(e) => setConfig("step", Number(e.target.value))}
          className={numInp} />
      </div>
    </>
  );
}

function MultiStateProps({ setConfig, inp, label, w }: PropertiesPanelProps) {
  return <MultiStateEditor w={w} setConfig={setConfig} inp={inp} label={label} />;
}

function TrendProps({ setConfig, cfgNum, cfgStr, inp, numInp, label, w }: PropertiesPanelProps) {
  return (
    <>
      <div>
        {label("Duration (seconds)")}
        <input type="number" min={10} value={cfgNum("duration", 300)}
          onChange={(e) => setConfig("duration", Number(e.target.value))}
          className={numInp} />
      </div>
      <div>
        {label("X-axis format")}
        <select value={cfgStr("xFormat", "time")} onChange={(e) => setConfig("xFormat", e.target.value)} className={inp}>
          <option value="time">HH:MM:SS</option>
          <option value="time-short">HH:MM</option>
          <option value="relative">Relative (−5m, −1m…)</option>
          <option value="datetime">Date + time</option>
        </select>
      </div>
      <RangeEditor cfgNum={cfgNum} setConfig={setConfig} inp={inp} numInp={numInp} label={label} note="Leave blank for auto-scale" />
      <TrendSeriesEditor w={w} setConfig={setConfig} inp={inp} label={label} />
      <RefLinesEditor w={w} setConfig={setConfig} inp={inp} label={label} />
    </>
  );
}

function HistoryLogProps({ setConfig, cfgNum, numInp, label }: PropertiesPanelProps) {
  return (
    <div>
      {label("Rows to fetch")}
      <input type="number" min={10} max={500} value={cfgNum("pageSize", 100)}
        onChange={(e) => setConfig("pageSize", Number(e.target.value))}
        className={numInp} />
    </div>
  );
}

function AlarmBannerProps({ setConfig, cfgNum, cfgBool, numInp, label }: PropertiesPanelProps) {
  return (
    <>
      <div>
        {label("Max rows")}
        <input type="number" min={1} max={20} value={cfgNum("maxRows", 5)}
          onChange={(e) => setConfig("maxRows", Number(e.target.value))}
          className={numInp} />
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="showAcked" checked={cfgBool("showAcked")}
          onChange={(e) => setConfig("showAcked", e.target.checked)}
          className="accent-blue-500" />
        <label htmlFor="showAcked" className="text-xs text-zinc-300 cursor-pointer">Show acknowledged alarms</label>
      </div>
    </>
  );
}

function ImageProps({ setConfig, cfgStr, inp, label }: PropertiesPanelProps) {
  return (
    <>
      <ImageUploadEditor setConfig={setConfig} cfgStr={cfgStr} inp={inp} label={label} />
      <div>
        {label("Fit")}
        <select value={cfgStr("fit", "contain")} onChange={(e) => setConfig("fit", e.target.value)} className={inp}>
          <option value="contain">Contain</option>
          <option value="cover">Cover</option>
          <option value="fill">Fill</option>
        </select>
      </div>
    </>
  );
}

// ── Register per-widget properties panels ─────────────────────────────────
// Merges into registry entries created by widgets/index.tsx at module load.

registerWidget({ type: "gauge",          label: "Gauge",       defaultW: 4, defaultH: 3, PropertiesPanel: GaugeProps });
registerWidget({ type: "numericDisplay", label: "Numeric",     defaultW: 3, defaultH: 2, PropertiesPanel: NumericDisplayProps });
registerWidget({ type: "numericInput",   label: "Numeric In",  defaultW: 3, defaultH: 2, PropertiesPanel: NumericInputProps });
registerWidget({ type: "led",            label: "LED",         defaultW: 2, defaultH: 2, PropertiesPanel: LEDProps });
registerWidget({ type: "button",         label: "Button",      defaultW: 3, defaultH: 2, PropertiesPanel: ButtonProps });
registerWidget({ type: "tank",           label: "Tank",        defaultW: 2, defaultH: 4, PropertiesPanel: TankProps });
registerWidget({ type: "setpoint",       label: "Setpoint",    defaultW: 4, defaultH: 2, PropertiesPanel: SetpointProps });
registerWidget({ type: "multiState",     label: "Multi-State", defaultW: 3, defaultH: 2, PropertiesPanel: MultiStateProps });
registerWidget({ type: "trend",          label: "Trend",       defaultW: 6, defaultH: 4, PropertiesPanel: TrendProps });
registerWidget({ type: "historyLog",     label: "History",     defaultW: 6, defaultH: 4, PropertiesPanel: HistoryLogProps });
registerWidget({ type: "alarmBanner",    label: "Alarms",      defaultW: 6, defaultH: 3, PropertiesPanel: AlarmBannerProps });
registerWidget({ type: "image",          label: "Image",       defaultW: 3, defaultH: 3, PropertiesPanel: ImageProps });
