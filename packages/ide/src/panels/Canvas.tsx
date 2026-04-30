import { useProject } from "../store/projectStore";
import { WidgetRenderer } from "../widgets";

const COLS = 12;
const ROW_H = 64; // px per grid row

export function Canvas() {
  const { project, activePageId, selectedWidgetId, selectWidget, removeWidget } = useProject();
  const page = project.pages.find((p) => p.id === activePageId);
  if (!page) return <div className="p-6 text-zinc-500">No page selected.</div>;

  return (
    <div className="flex-1 overflow-auto p-6 bg-zinc-950">
      <div
        className="grid gap-2 max-w-[1400px] mx-auto"
        style={{
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gridAutoRows: `${ROW_H}px`,
        }}
        onClick={() => selectWidget(null)}
      >
        {page.widgets.map((w) => {
          const selected = selectedWidgetId === w.id;
          return (
            <div
              key={w.id}
              onClick={(e) => { e.stopPropagation(); selectWidget(w.id); }}
              className={`relative rounded-lg ${selected ? "ring-2 ring-blue-500" : "ring-1 ring-transparent hover:ring-zinc-700"}`}
              style={{
                gridColumn: `${(w.x ?? 0) + 1} / span ${w.w}`,
                gridRow: `${(w.y ?? 0) + 1} / span ${w.h}`,
              }}
            >
              <WidgetRenderer w={w} />
              {selected && (
                <button
                  onClick={(e) => { e.stopPropagation(); removeWidget(page.id, w.id); }}
                  className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0.5 rounded bg-red-600 hover:bg-red-500"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
        {page.widgets.length === 0 && (
          <div className="col-span-full row-span-2 flex items-center justify-center text-zinc-600 italic text-sm">
            Empty page — add widgets from the left palette.
          </div>
        )}
      </div>
    </div>
  );
}

export function PositionEditor({ pageId, widgetId }: { pageId: string; widgetId: string }) {
  const { project, updateWidget } = useProject();
  const page = project.pages.find((p) => p.id === pageId);
  const w = page?.widgets.find((x) => x.id === widgetId);
  if (!w) return null;

  const num = (k: "x" | "y" | "w" | "h") => (
    <label className="flex items-center gap-2 text-[11px]">
      <span className="w-4 text-zinc-500 uppercase">{k}</span>
      <input
        type="number"
        value={w[k]}
        min={k === "x" || k === "y" ? 0 : 1}
        onChange={(e) => updateWidget(pageId, widgetId, { [k]: Number(e.target.value) })}
        className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5"
      />
    </label>
  );

  return <div className="grid grid-cols-2 gap-1.5">{num("x")}{num("y")}{num("w")}{num("h")}</div>;
}
