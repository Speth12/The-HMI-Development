// Global keyboard shortcut handler for the IDE.
// Mounted once in App — uses window event listeners.
import { useEffect } from "react";
import { useProject } from "../store/projectStore";

export function useKeyboardShortcuts() {
  const { activePageId, selectedWidgetId, selectWidget, removeWidget, project, exportJSON } = useProject();

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
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activePageId, selectedWidgetId, project.name, exportJSON, selectWidget, removeWidget]);
}
