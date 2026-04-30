import { newWidgetId, useProject, type WidgetType } from "../store/projectStore";

const items: { type: WidgetType; label: string; w: number; h: number }[] = [
  { type: "gauge", label: "Gauge", w: 4, h: 3 },
  { type: "numericDisplay", label: "Numeric", w: 3, h: 2 },
  { type: "textDisplay", label: "Text", w: 4, h: 2 },
  { type: "led", label: "LED", w: 2, h: 2 },
  { type: "button", label: "Button", w: 3, h: 2 },
  { type: "trend", label: "Trend", w: 6, h: 4 },
  { type: "numericInput", label: "Numeric In", w: 3, h: 2 },
  { type: "textInput", label: "Text In", w: 3, h: 2 },
  { type: "historyLog", label: "History", w: 6, h: 4 },
];

export function Palette() {
  const { activePageId, addWidget, project } = useProject();
  const page = project.pages.find((p) => p.id === activePageId);

  const add = (type: WidgetType, w: number, h: number) => {
    if (!page) return;
    addWidget(page.id, {
      id: newWidgetId(),
      type,
      x: 0, y: 0, w, h,
      config: { label: type },
    });
  };

  return (
    <div className="p-3 border-b border-zinc-800">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Palette</div>
      <div className="grid grid-cols-2 gap-1.5">
        {items.map((it) => (
          <button
            key={it.type}
            onClick={() => add(it.type, it.w, it.h)}
            className="text-xs py-1.5 px-2 rounded bg-zinc-800 hover:bg-zinc-700 text-left"
          >
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}
