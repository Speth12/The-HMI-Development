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

  const cfgString = (k: string) => (w.config?.[k] as string) ?? "";
  const cfgNumber = (k: string) => (w.config?.[k] as number | undefined);

  return (
    <div className="p-3 space-y-3 overflow-auto">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Widget</div>
        <div className="text-sm">{w.type}</div>
        <div className="text-[10px] text-zinc-600 font-mono">{w.id}</div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Binding</div>
        <input
          value={w.binding ?? ""}
          onChange={(e) => updateWidget(page.id, w.id, { binding: e.target.value || undefined })}
          placeholder="datasource_id:tag_path"
          className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs font-mono"
        />
        <div className="text-[10px] text-zinc-600 mt-1">
          Click a tag on the right to bind it.
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Layout</div>
        <PositionEditor pageId={page.id} widgetId={w.id} />
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Label</div>
        <input
          value={cfgString("label")}
          onChange={(e) => setConfig("label", e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs"
        />
      </div>

      {(w.type === "gauge" || w.type === "numericDisplay") && (
        <>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Range</div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <label>min<input
                type="number"
                value={cfgNumber("min") ?? 0}
                onChange={(e) => setConfig("min", Number(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 mt-0.5"
              /></label>
              <label>max<input
                type="number"
                value={cfgNumber("max") ?? 100}
                onChange={(e) => setConfig("max", Number(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 mt-0.5"
              /></label>
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Unit</div>
            <input
              value={cfgString("unit")}
              onChange={(e) => setConfig("unit", e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs"
            />
          </div>
        </>
      )}
    </div>
  );
}
