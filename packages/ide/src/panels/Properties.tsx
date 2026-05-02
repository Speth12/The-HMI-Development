import { useProject } from "../store/projectStore";
import { PositionEditor } from "./Canvas";

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

  return (
    <div className="p-3 space-y-4 overflow-auto">
      {/* Widget meta */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Widget</div>
        <div className="text-sm font-medium">{w.type}</div>
        <div className="text-[10px] text-zinc-600 font-mono">{w.id}</div>
      </div>

      {/* Binding */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Binding</div>
        <input
          value={w.binding ?? ""}
          onChange={(e) => updateWidget(page.id, w.id, { binding: e.target.value || undefined })}
          placeholder="ds:tagPath"
          className={`${inp} font-mono`}
        />
        <div className="text-[10px] text-zinc-600 mt-0.5">Drag tag from browser → widget</div>
      </div>

      {/* Layout */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Layout</div>
        <PositionEditor pageId={page.id} widgetId={w.id} />
      </div>

      {/* Label (all types) */}
      <div>
        {label("Label")}
        <input value={cfgStr("label")} onChange={(e) => setConfig("label", e.target.value)} className={inp} />
      </div>

      {/* ── Gauge ─────────────────────────────────────────────────────── */}
      {w.type === "gauge" && (
        <>
          <RangeEditor cfgNum={cfgNum} setConfig={setConfig} inp={inp} numInp={numInp} label={label} />
          <UnitEditor cfgStr={cfgStr} setConfig={setConfig} inp={inp} label={label} />
          <ThresholdEditor w={w} setConfig={setConfig} inp={inp} numInp={numInp} label={label} />
        </>
      )}

      {/* ── Numeric Display ───────────────────────────────────────────── */}
      {w.type === "numericDisplay" && (
        <>
          <RangeEditor cfgNum={cfgNum} setConfig={setConfig} inp={inp} numInp={numInp} label={label} />
          <UnitEditor cfgStr={cfgStr} setConfig={setConfig} inp={inp} label={label} />
        </>
      )}

      {/* ── Numeric Input ─────────────────────────────────────────────── */}
      {w.type === "numericInput" && (
        <UnitEditor cfgStr={cfgStr} setConfig={setConfig} inp={inp} label={label} />
      )}

      {/* ── LED ──────────────────────────────────────────────────────── */}
      {w.type === "led" && (
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
      )}

      {/* ── Button ───────────────────────────────────────────────────── */}
      {w.type === "button" && (
        <>
          <div>
            {label("Mode")}
            <div className="flex gap-2">
              {["momentary", "toggle"].map((m) => (
                <button
                  key={m}
                  onClick={() => setConfig("momentary", m === "momentary")}
                  className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                    (m === "momentary") === cfgBool("momentary", true)
                      ? "bg-blue-700 border-blue-600 text-white"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                  }`}
                >
                  {m}
                </button>
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

      {/* ── Trend ────────────────────────────────────────────────────── */}
      {w.type === "trend" && (
        <>
          <div>
            {label("Duration (seconds)")}
            <input type="number" min={10} value={cfgNum("duration", 300)}
              onChange={(e) => setConfig("duration", Number(e.target.value))}
              className={numInp} />
          </div>
          <RangeEditor cfgNum={cfgNum} setConfig={setConfig} inp={inp} numInp={numInp} label={label}
            note="Leave blank for auto-scale" />
          <TrendSeriesEditor w={w} setConfig={setConfig} inp={inp} label={label} />
        </>
      )}

      {/* ── History Log ──────────────────────────────────────────────── */}
      {w.type === "historyLog" && (
        <div>
          {label("Rows to fetch")}
          <input type="number" min={10} max={500} value={cfgNum("pageSize", 100)}
            onChange={(e) => setConfig("pageSize", Number(e.target.value))}
            className={numInp} />
        </div>
      )}
    </div>
  );
}

// ── Trend series editor ────────────────────────────────────────────────────

const SERIES_COLORS = ["#3b82f6","#22c55e","#f59e0b","#ef4444","#a855f7","#06b6d4"];
type TrendSeries = { binding: string; color: string; label?: string };

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
              {tags.length > 1 && (
                <button onClick={() => remove(i)} className="text-zinc-600 hover:text-red-400 text-xs shrink-0">×</button>
              )}
            </div>
            <input value={s.binding} placeholder="ds:tagPath"
              onChange={(e) => update(i, { binding: e.target.value })}
              className={`${inp} font-mono text-[10px]`} />
          </div>
        ))}
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
