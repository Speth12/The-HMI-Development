import { useEffect, useRef, useState } from "react";
import { WidgetRenderer, type Widget } from "./widgets";

type Page = { id: string; name: string; widgets: Widget[] };
type Project = { version: string; pages: Page[]; datasources: unknown[] };

type AlarmEvent = {
  id: string;
  ruleName: string;
  severity: "critical" | "warning" | "info";
  message: string;
  binding: string;
  value: number;
  active: boolean;
  acked: boolean;
  triggeredAt: string;
};

const COLS = 12;
const ROW_H = 72;

const severityBg: Record<string, string> = {
  critical: "bg-red-900/80 border-red-700",
  warning:  "bg-amber-900/80 border-amber-700",
  info:     "bg-blue-900/80 border-blue-700",
};

export function App() {
  const [project, setProject] = useState<Project | null>(null);
  const [activePage, setActivePage] = useState(0);
  const [error, setError] = useState("");
  const [alarms, setAlarms] = useState<AlarmEvent[]>([]);
  const wsAlarmRef = useRef<WebSocket | null>(null);

  // Load project every 5 s
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

  // Alarm WebSocket
  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(`ws://${location.host}/ws/alarms`);
      wsAlarmRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const ev: AlarmEvent = JSON.parse(e.data);
          setAlarms((prev) => {
            const idx = prev.findIndex((x) => x.id === ev.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = ev;
              return next;
            }
            return [...prev, ev];
          });
        } catch { /* ignore */ }
      };

      ws.onclose = () => setTimeout(connect, 3000);
      ws.onerror = () => ws.close();
    };
    connect();
    return () => { wsAlarmRef.current?.close(); };
  }, []);

  const ack = async (eventId: string) => {
    try { await fetch(`/api/v1/alarms/${encodeURIComponent(eventId)}/ack`, { method: "POST" }); }
    catch { /* ignore */ }
  };

  const activeAlarms = alarms.filter((a) => a.active && !a.acked);
  const hasAlarm = activeAlarms.length > 0;
  const worstSeverity = activeAlarms.some((a) => a.severity === "critical")
    ? "critical"
    : activeAlarms.some((a) => a.severity === "warning")
    ? "warning"
    : activeAlarms.length > 0 ? "info" : null;

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
        <div className="flex-1" />
        {hasAlarm && (
          <div className={`text-xs font-semibold px-2 py-0.5 rounded ${
            worstSeverity === "critical" ? "bg-red-700 animate-pulse" : worstSeverity === "warning" ? "bg-amber-700" : "bg-blue-700"
          }`}>
            ⚠ {activeAlarms.length} alarm{activeAlarms.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Alarm banner strip */}
      {activeAlarms.length > 0 && (
        <div className="px-4 py-1.5 space-y-1 border-b border-zinc-800 bg-zinc-900/40">
          {activeAlarms.slice(0, 3).map((a) => (
            <div key={a.id} className={`flex items-center gap-3 px-3 py-1 rounded border text-xs ${severityBg[a.severity]}`}>
              <span className="font-semibold uppercase text-[10px] w-16 shrink-0">{a.severity}</span>
              <span className="flex-1 truncate">{a.ruleName}{a.message ? ` — ${a.message}` : ""}</span>
              <span className="font-mono text-[10px] text-zinc-400 shrink-0">{a.value.toFixed(2)}</span>
              <button
                onClick={() => ack(a.id)}
                className="text-[10px] px-2 py-0.5 rounded bg-zinc-700 hover:bg-zinc-600 shrink-0"
              >
                ACK
              </button>
            </div>
          ))}
          {activeAlarms.length > 3 && (
            <div className="text-[10px] text-zinc-500 px-3">…and {activeAlarms.length - 3} more</div>
          )}
        </div>
      )}

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
