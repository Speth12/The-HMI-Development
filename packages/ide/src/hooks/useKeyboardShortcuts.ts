// Global keyboard shortcut handler for the IDE.
// Mounted once in App — uses window event listeners.
import { useEffect, useRef } from "react";
import { useProject, type Widget } from "../store/projectStore";
import { newWidgetId } from "../store/projectStore";

export function useKeyboardShortcuts() {
  const { activePageId, selectedWidgetId, selectWidget, removeWidget, addWidget, project, exportJSON, undo, redo } = useProject();
  const clipboard = useRef<Widget | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't fire when focus is inside an input/textarea.
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      // Delete / Backspace — remove selected widget
      if ((e.key === "Delete" || e.key === "Backspace") && selectedWidgetId) {
        removeWidget(activePageId, selectedWidgetId);
        return;
      }

      // Escape — deselect
      if (e.key === "Escape") {
        selectWidget(null);
        return;
      }

      // Ctrl/Cmd+Z — undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z — redo
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }

      // Ctrl/Cmd+S — save to file
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        const blob = new Blob([exportJSON()], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${(project.name ?? "project").replace(/\s+/g, "-")}.xhmi.json`;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }

      // Ctrl/Cmd+C — copy selected widget
      if ((e.ctrlKey || e.metaKey) && e.key === "c" && selectedWidgetId) {
        const page = project.pages.find((p) => p.id === activePageId);
        const w = page?.widgets.find((x) => x.id === selectedWidgetId);
        if (w) { clipboard.current = w; }
        return;
      }

      // Ctrl/Cmd+D — duplicate selected widget
      if ((e.ctrlKey || e.metaKey) && e.key === "d" && selectedWidgetId) {
        e.preventDefault();
        const page = project.pages.find((p) => p.id === activePageId);
        const w = page?.widgets.find((x) => x.id === selectedWidgetId);
        if (w) {
          const nextY = page!.widgets.reduce((max, wg) => Math.max(max, wg.y + wg.h), 0);
          addWidget(activePageId, { ...w, id: newWidgetId(), y: nextY });
        }
        return;
      }

      // Ctrl/Cmd+V — paste widget
      if ((e.ctrlKey || e.metaKey) && e.key === "v" && clipboard.current) {
        e.preventDefault();
        const w = clipboard.current;
        const page = project.pages.find((p) => p.id === activePageId);
        const nextY = page?.widgets.reduce((max, wg) => Math.max(max, wg.y + wg.h), 0) ?? 0;
        addWidget(activePageId, { ...w, id: newWidgetId(), y: nextY });
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activePageId, selectedWidgetId, project, exportJSON, selectWidget, removeWidget, addWidget, undo, redo]);
}
