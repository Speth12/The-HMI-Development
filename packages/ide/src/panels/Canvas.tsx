import { useEffect, useRef, useState } from "react";
import { useProject } from "../store/projectStore";
import { newWidgetId } from "../store/projectStore";
import { WidgetRenderer } from "../widgets";
import { setClipboard } from "../hooks/useKeyboardShortcuts";

const COLS  = 12;
const ROW_H = 64;
const GAP   = 8;
const COL_W = 80;

// Module-level drag state — avoids stale closures during drag events.
let widgetDrag: { id: string; ox: number; oy: number } | null = null;
let resizeDrag: { id: string; originX: number; originY: number; corner: "br" | "bl" | "tr" | "tl" } | null = null;

function cellFromEvent(grid: HTMLElement, e: React.DragEvent, zoom: number) {
  const rect = grid.getBoundingClientRect();
  const cw = (COL_W + GAP) * zoom;
  const rh = (ROW_H + GAP) * zoom;
  const col = Math.max(0, Math.min(COLS - 1, Math.floor((e.clientX - rect.left) / cw)));
  const row = Math.max(0, Math.floor((e.clientY - rect.top) / rh));
  return { col, row };
}

// ── Context menu ────────────────────────────────────────────────────────────

type CtxMenu = { x: number; y: number; widgetId: string };

function ContextMenu({ menu, onClose, onAction }: {
  menu: CtxMenu;
  onClose: () => void;
  onAction: (action: string, widgetId: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [onClose]);

  const item = (label: string, action: string, danger = false) => (
    <button
      key={action}
      onMouseDown={(e) => { e.preventDefault(); onAction(action, menu.widgetId); onClose(); }}
      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-700 ${danger ? "text-red-400" : "text-zinc-200"}`}
    >
      {label}
    </button>
  );

  const { project, activePageId } = useProject.getState();
  const page = project.pages.find(p => p.id === activePageId);
  const w = page?.widgets.find(x => x.id === menu.widgetId);
  const isLocked = w?.locked ?? false;

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-zinc-800 border border-zinc-600 rounded-lg shadow-xl py-1 min-w-[140px]"
      style={{ left: menu.x, top: menu.y }}
    >
      {item(isLocked ? "🔓 Unlock" : "🔒 Lock", "lock")}
      <div className="border-t border-zinc-700 my-1" />
      {item("Copy  Ctrl+C", "copy")}
      {item("Duplicate  Ctrl+D", "duplicate")}
      <div className="border-t border-zinc-700 my-1" />
      {item("Delete", "delete", true)}
    </div>
  );
}

// ── Canvas ──────────────────────────────────────────────────────────────────

export function Canvas() {
  const { project, activePageId, selectedWidgetId, selectWidget, removeWidget, updateWidget, addWidget } = useProject();
  const gridRef   = useRef<HTMLDivElement>(null);
  const outerRef  = useRef<HTMLDivElement>(null);
  const [zoom, setZoom]     = useState(1);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);

  const page = project.pages.find((p) => p.id === activePageId);

  // Ctrl+scroll to zoom
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom((z) => Math.max(0.25, Math.min(2.5, parseFloat((z * (e.deltaY > 0 ? 0.9 : 1.11)).toFixed(2)))));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  if (!page) return <div className="p-6 text-zinc-500">No page selected.</div>;

  const eColW = COL_W * zoom;
  const eRowH = ROW_H * zoom;

  const onDragOver = (e: React.DragEvent) => {
    const types = e.dataTransfer.types;
    if (types.includes("text/x-widget-id") || types.includes("text/x-tag-binding") || types.includes("text/x-resize") || types.includes("text/x-image-id"))
      e.preventDefault();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!gridRef.current) return;
    const { col, row } = cellFromEvent(gridRef.current, e, zoom);

    const tagBinding = e.dataTransfer.getData("text/x-tag-binding");
    if (tagBinding) {
      const target = page.widgets.find(
        (w) => col >= (w.x ?? 0) && col < (w.x ?? 0) + w.w && row >= (w.y ?? 0) && row < (w.y ?? 0) + w.h,
      );
      if (target) updateWidget(activePageId, target.id, { binding: tagBinding });
      return;
    }

    const imageId = e.dataTransfer.getData("text/x-image-id");
    if (imageId) {
      const img = useProject.getState().project.images?.find(i => i.id === imageId);
      addWidget(activePageId, {
        id: newWidgetId(),
        type: "image",
        x: Math.max(0, col), y: Math.max(0, row), w: 4, h: 3,
        config: { src: `lib:${imageId}`, label: img?.name ?? "Image", objectFit: "contain" },
      });
      return;
    }

    if (resizeDrag) {
      const w = page.widgets.find((x) => x.id === resizeDrag!.id);
      if (w) {
        const { corner, originX, originY } = resizeDrag;
        let nx = w.x, ny = w.y, nw = w.w, nh = w.h;
        if (corner === "br") { nw = Math.max(1, col - originX + 1); nh = Math.max(1, row - originY + 1); }
        else if (corner === "bl") { const nx2 = Math.min(col, originX + w.w - 1); nw = Math.max(1, originX + w.w - nx2); nx = nx2; nh = Math.max(1, row - originY + 1); }
        else if (corner === "tr") { nw = Math.max(1, col - originX + 1); const ny2 = Math.min(row, originY + w.h - 1); nh = Math.max(1, originY + w.h - ny2); ny = ny2; }
        else { const nx2 = Math.min(col, originX + w.w - 1); nw = Math.max(1, originX + w.w - nx2); nx = nx2; const ny2 = Math.min(row, originY + w.h - 1); nh = Math.max(1, originY + w.h - ny2); ny = ny2; }
        updateWidget(activePageId, resizeDrag.id, { x: Math.max(0, Math.min(COLS - nw, nx)), y: Math.max(0, ny), w: Math.min(COLS, nw), h: Math.max(1, nh) });
      }
      resizeDrag = null;
      return;
    }

    if (widgetDrag) {
      const w = page.widgets.find((x) => x.id === widgetDrag!.id);
      if (w) updateWidget(activePageId, widgetDrag.id, { x: Math.max(0, Math.min(COLS - w.w, col - widgetDrag.ox)), y: Math.max(0, row - widgetDrag.oy) });
      widgetDrag = null;
    }
  };

  const handleCtxAction = (action: string, widgetId: string) => {
    const w = page.widgets.find((x) => x.id === widgetId);
    if (!w) return;
    if (action === "lock")      { updateWidget(activePageId, widgetId, { locked: !w.locked }); }
    if (action === "copy")      { setClipboard(w); }
    if (action === "duplicate") { const nextY = page.widgets.reduce((m, wg) => Math.max(m, wg.y + wg.h), 0); addWidget(activePageId, { ...w, id: newWidgetId(), y: nextY }); }
    if (action === "delete")    { removeWidget(activePageId, widgetId); }
  };

  return (
    <div
      ref={outerRef}
      className="flex-1 overflow-auto p-6 bg-zinc-950 select-none"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Zoom indicator */}
      {zoom !== 1 && (
        <div className="fixed bottom-8 right-8 z-40 bg-zinc-800 border border-zinc-600 rounded-full px-3 py-1 text-[11px] text-zinc-400 font-mono flex items-center gap-2 shadow-lg">
          {Math.round(zoom * 100)}%
          <button onClick={() => setZoom(1)} className="text-zinc-500 hover:text-zinc-200">↺</button>
        </div>
      )}

      <div
        ref={gridRef}
        className="grid relative"
        style={{
          gap: `${GAP}px`,
          gridTemplateColumns: `repeat(${COLS}, ${eColW}px)`,
          gridAutoRows: `${eRowH}px`,
          backgroundImage: `radial-gradient(circle, #3f3f4644 1px, transparent 1px)`,
          backgroundSize: `${eColW + GAP}px ${eRowH + GAP}px`,
          backgroundPosition: `${GAP / 2}px ${GAP / 2}px`,
          width: `${COLS * (eColW + GAP) - GAP}px`,
        }}
        onClick={() => { selectWidget(null); setCtxMenu(null); }}
      >
        {page.widgets.map((w) => {
          const selected = selectedWidgetId === w.id;
          const locked   = w.locked ?? false;

          const onDragStart = (e: React.DragEvent) => {
            if (locked) { e.preventDefault(); return; }
            const tag = (e.target as HTMLElement).tagName;
            if (tag === "INPUT" || tag === "BUTTON" || tag === "TEXTAREA") { e.preventDefault(); return; }
            if (!gridRef.current) return;
            const { col, row } = cellFromEvent(gridRef.current, e, zoom);
            widgetDrag = { id: w.id, ox: col - (w.x ?? 0), oy: row - (w.y ?? 0) };
            e.dataTransfer.setData("text/x-widget-id", w.id);
            e.dataTransfer.effectAllowed = "move";
          };

          const onContextMenu = (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            selectWidget(w.id);
            setCtxMenu({ x: e.clientX, y: e.clientY, widgetId: w.id });
          };

          return (
            <div
              key={w.id}
              draggable={!locked}
              onDragStart={onDragStart}
              onClick={(e) => { e.stopPropagation(); selectWidget(w.id); setCtxMenu(null); }}
              onContextMenu={onContextMenu}
              className={`relative rounded-lg ${
                selected ? "ring-2 ring-blue-500" : "ring-1 ring-transparent hover:ring-zinc-700"
              } ${locked ? "ring-amber-700/60" : ""}`}
              style={{
                gridColumn: `${(w.x ?? 0) + 1} / span ${w.w}`,
                gridRow:    `${(w.y ?? 0) + 1} / span ${w.h}`,
                cursor: locked ? "default" : "grab",
              }}
            >
              <WidgetRenderer w={w} />

              {/* Lock badge */}
              {locked && (
                <div className="absolute top-1 right-1 text-[9px] text-amber-500 pointer-events-none z-10">🔒</div>
              )}

              {selected && !locked && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeWidget(page.id, w.id); }}
                    className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0.5 rounded bg-red-600 hover:bg-red-500 z-10"
                    style={{ cursor: "default" }}
                  >×</button>
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
                        top:    corner.startsWith("t") ? -4 : undefined,
                        right:  corner.endsWith("r")   ? -4 : undefined,
                        left:   corner.endsWith("l")   ? -4 : undefined,
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

      {ctxMenu && (
        <ContextMenu menu={ctxMenu} onClose={() => setCtxMenu(null)} onAction={handleCtxAction} />
      )}
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
