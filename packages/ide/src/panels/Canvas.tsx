import { useRef } from "react";
import { useProject } from "../store/projectStore";
import { WidgetRenderer } from "../widgets";

const COLS = 12;
const ROW_H = 64; // px per grid row
const GAP = 8;    // gap-2 = 8px

// Module-level drag state — avoids stale closures during drag events.
let widgetDrag: { id: string; ox: number; oy: number } | null = null;
let resizeDrag: { id: string; originX: number; originY: number; corner: "br" | "bl" | "tr" | "tl" } | null = null;

function cellFromEvent(grid: HTMLElement, e: React.DragEvent) {
  const rect = grid.getBoundingClientRect();
  const col = Math.max(0, Math.min(COLS - 1, Math.floor((e.clientX - rect.left) / (rect.width / COLS))));
  const row = Math.max(0, Math.floor((e.clientY - rect.top) / (ROW_H + GAP)));
  return { col, row };
}

export function Canvas() {
  const { project, activePageId, selectedWidgetId, selectWidget, removeWidget, updateWidget } = useProject();
  const gridRef = useRef<HTMLDivElement>(null);

  const page = project.pages.find((p) => p.id === activePageId);
  if (!page) return <div className="p-6 text-zinc-500">No page selected.</div>;

  // Accept widget-move, resize, and tag-binding drags at the canvas level.
  const onDragOver = (e: React.DragEvent) => {
    const types = e.dataTransfer.types;
    if (types.includes("text/x-widget-id") || types.includes("text/x-tag-binding") || types.includes("text/x-resize")) {
      e.preventDefault();
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!gridRef.current) return;
    const { col, row } = cellFromEvent(gridRef.current, e);

    // Tag binding: find the widget at the drop cell and bind it.
    const tagBinding = e.dataTransfer.getData("text/x-tag-binding");
    if (tagBinding) {
      const target = page.widgets.find(
        (w) =>
          col >= (w.x ?? 0) && col < (w.x ?? 0) + w.w &&
          row >= (w.y ?? 0) && row < (w.y ?? 0) + w.h,
      );
      if (target) updateWidget(activePageId, target.id, { binding: tagBinding });
      return;
    }

    // Resize drop.
    if (resizeDrag) {
      const w = page.widgets.find((x) => x.id === resizeDrag!.id);
      if (w) {
        const { corner, originX, originY } = resizeDrag;
        let nx = w.x, ny = w.y, nw = w.w, nh = w.h;
        if (corner === "br") {
          nw = Math.max(1, col - originX + 1);
          nh = Math.max(1, row - originY + 1);
        } else if (corner === "bl") {
          const newX = Math.min(col, originX + w.w - 1);
          nw = Math.max(1, originX + w.w - newX);
          nx = newX;
          nh = Math.max(1, row - originY + 1);
        } else if (corner === "tr") {
          nw = Math.max(1, col - originX + 1);
          const newY = Math.min(row, originY + w.h - 1);
          nh = Math.max(1, originY + w.h - newY);
          ny = newY;
        } else { // tl
          const newX = Math.min(col, originX + w.w - 1);
          nw = Math.max(1, originX + w.w - newX);
          nx = newX;
          const newY = Math.min(row, originY + w.h - 1);
          nh = Math.max(1, originY + w.h - newY);
          ny = newY;
        }
        updateWidget(activePageId, resizeDrag.id, {
          x: Math.max(0, Math.min(COLS - nw, nx)),
          y: Math.max(0, ny),
          w: Math.min(COLS, nw),
          h: Math.max(1, nh),
        });
      }
      resizeDrag = null;
      return;
    }

    // Widget move: update the widget's grid position.
    if (widgetDrag) {
      const w = page.widgets.find((x) => x.id === widgetDrag!.id);
      if (w) {
        updateWidget(activePageId, widgetDrag.id, {
          x: Math.max(0, Math.min(COLS - w.w, col - widgetDrag.ox)),
          y: Math.max(0, row - widgetDrag.oy),
        });
      }
      widgetDrag = null;
    }
  };

  return (
    <div
      className="flex-1 overflow-auto p-6 bg-zinc-950"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div
        ref={gridRef}
        className="grid gap-2 max-w-[1400px] mx-auto relative"
        style={{
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gridAutoRows: `${ROW_H}px`,
          backgroundImage: `radial-gradient(circle, #3f3f4644 1px, transparent 1px)`,
          backgroundSize: `calc(100% / ${COLS}) ${ROW_H + GAP}px`,
          backgroundPosition: `${GAP / 2}px ${GAP / 2}px`,
        }}
        onClick={() => selectWidget(null)}
      >
        {page.widgets.map((w) => {
          const selected = selectedWidgetId === w.id;

          const onDragStart = (e: React.DragEvent) => {
            // Prevent drag-start from interactive children (inputs, buttons).
            const tag = (e.target as HTMLElement).tagName;
            if (tag === "INPUT" || tag === "BUTTON" || tag === "TEXTAREA") {
              e.preventDefault();
              return;
            }
            if (!gridRef.current) return;
            const { col, row } = cellFromEvent(gridRef.current, e);
            widgetDrag = { id: w.id, ox: col - (w.x ?? 0), oy: row - (w.y ?? 0) };
            e.dataTransfer.setData("text/x-widget-id", w.id);
            e.dataTransfer.effectAllowed = "move";
          };

          return (
            <div
              key={w.id}
              draggable
              onDragStart={onDragStart}
              onClick={(e) => { e.stopPropagation(); selectWidget(w.id); }}
              className={`relative rounded-lg ${
                selected
                  ? "ring-2 ring-blue-500"
                  : "ring-1 ring-transparent hover:ring-zinc-700"
              }`}
              style={{
                gridColumn: `${(w.x ?? 0) + 1} / span ${w.w}`,
                gridRow:    `${(w.y ?? 0) + 1} / span ${w.h}`,
                cursor: "grab",
              }}
            >
              <WidgetRenderer w={w} />
              {selected && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeWidget(page.id, w.id); }}
                    className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0.5 rounded bg-red-600 hover:bg-red-500 z-10"
                    style={{ cursor: "default" }}
                  >
                    ×
                  </button>
                  {/* Resize handles at each corner */}
                  {(["br","bl","tr","tl"] as const).map((corner) => (
                    <div
                      key={corner}
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation();
                        if (!gridRef.current) return;
                        resizeDrag = { id: w.id, originX: w.x ?? 0, originY: w.y ?? 0, corner };
                        e.dataTransfer.setData("text/x-resize", w.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      className="absolute w-3 h-3 bg-blue-500 rounded-full z-20 border-2 border-zinc-900 hover:bg-blue-400"
                      style={{
                        cursor: corner === "br" || corner === "tl" ? "nwse-resize" : "nesw-resize",
                        bottom: corner.startsWith("b") ? -4 : undefined,
                        top: corner.startsWith("t") ? -4 : undefined,
                        right: corner.endsWith("r") ? -4 : undefined,
                        left: corner.endsWith("l") ? -4 : undefined,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ))}
                </>
              )}
              {w.binding && (
                <div className="absolute bottom-0 left-0 right-0 text-[9px] font-mono text-zinc-600 px-1.5 truncate pointer-events-none">
                  {w.binding}
                </div>
              )}
            </div>
          );
        })}
        {page.widgets.length === 0 && (
          <div className="col-span-full row-span-2 flex items-center justify-center text-zinc-600 italic text-sm">
            Add widgets from the palette ← · drag tags from the browser → to bind
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
