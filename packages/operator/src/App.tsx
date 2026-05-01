import { useEffect, useState } from "react";
import { WidgetRenderer, type Widget } from "./widgets";

type Page = { id: string; name: string; widgets: Widget[] };
type Project = { version: string; pages: Page[]; datasources: unknown[] };

const COLS = 12;
const ROW_H = 72;

export function App() {
  const [project, setProject] = useState<Project | null>(null);
  const [activePage, setActivePage] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = () =>
      fetch("/api/v1/project")
        .then((r) => r.json())
        .then((p) => {
          if (p && p.pages) { setProject(p); setError(""); }
          else setError("No project deployed to this runtime.");
        })
        .catch(() => setError("Cannot reach runtime API."));

    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-950 text-zinc-400">
        <div className="text-center space-y-2">
          <div className="text-4xl">⚠</div>
          <div>{error}</div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-950 text-zinc-500">
        Loading…
      </div>
    );
  }

  const page = project.pages[activePage] ?? project.pages[0];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-800 bg-zinc-900/60">
        <span className="font-semibold text-sm">X-HMI <span className="text-zinc-500 font-normal">Operator</span></span>
        <div className="flex gap-1">
          {project.pages.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setActivePage(i)}
              className={`text-xs px-3 py-1 rounded ${i === activePage ? "bg-blue-600 text-white" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"}`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto p-6">
        {page.widgets.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-zinc-600 italic">
            No widgets on this page.
          </div>
        ) : (
          <div
            className="grid gap-2 max-w-[1400px] mx-auto"
            style={{
              gridTemplateColumns: `repeat(${COLS}, 1fr)`,
              gridAutoRows: `${ROW_H}px`,
            }}
          >
            {page.widgets.map((w) => (
              <div
                key={w.id}
                style={{
                  gridColumn: `${(w.x ?? 0) + 1} / span ${w.w}`,
                  gridRow: `${(w.y ?? 0) + 1} / span ${w.h}`,
                }}
              >
                <WidgetRenderer w={w} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
