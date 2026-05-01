import { useEffect, useState } from "react";
import { useProject } from "../store/projectStore";

type TagDef = { Path: string; Description?: string; Writable?: boolean };
type DSStatus = { connected: boolean; lastError: string; tagCount: number };

export function TagBrowser() {
  const { project, selectedWidgetId, activePageId, updateWidget } = useProject();
  const [byDS, setByDS] = useState<Record<string, TagDef[]>>({});
  const [statusByDS, setStatusByDS] = useState<Record<string, DSStatus | null>>({});
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");

  const refresh = async () => {
    setBusy(true);
    const nextTags: Record<string, TagDef[]> = {};
    const nextStatus: Record<string, DSStatus | null> = {};
    for (const ds of project.datasources) {
      try {
        const [tagR, stR] = await Promise.all([
          fetch(`/api/v1/datasources/${ds.id}/tags`),
          fetch(`/api/v1/datasources/${ds.id}/status`),
        ]);
        const data = tagR.ok ? await tagR.json() : null;
        nextTags[ds.id] = Array.isArray(data) ? data : [];
        nextStatus[ds.id] = stR.ok ? (await stR.json()) as DSStatus : null;
      } catch {
        nextTags[ds.id] = [];
        nextStatus[ds.id] = null;
      }
    }
    setByDS(nextTags);
    setStatusByDS(nextStatus);
    setBusy(false);
  };

  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, [project.datasources.length]);

  const bind = (dsId: string, path: string) => {
    if (!selectedWidgetId) return;
    updateWidget(activePageId, selectedWidgetId, { binding: `${dsId}:${path}` });
  };

  return (
    <div className="flex-1 overflow-auto p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500">Tags</div>
        <button onClick={refresh} disabled={busy} className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50">
          {busy ? "…" : "refresh"}
        </button>
      </div>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="filter tags…"
        className="w-full mb-2 text-[11px] bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
      />

      {project.datasources.length === 0 && (
        <div className="text-xs text-zinc-500">No datasources. Add one in the project header.</div>
      )}

      {project.datasources.map((ds) => {
        const tags = byDS[ds.id] ?? [];
        const st = statusByDS[ds.id];
        return (
          <div key={ds.id} className="mb-4">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-semibold text-zinc-300">{ds.label || ds.id}</span>
              <span className="text-zinc-500 text-[10px]">[{ds.type}]</span>
              {st != null && (
                <span className={`text-[10px] ml-auto ${st.connected ? "text-emerald-500" : "text-red-400"}`}>
                  {st.connected ? "●" : "○"}
                </span>
              )}
            </div>

            {st != null && !st.connected && st.lastError && (
              <div className="text-[10px] text-red-400 mb-1 break-all">{st.lastError}</div>
            )}

            <div className="space-y-0.5">
              {tags
                .filter((t) => {
                  if (!filter) return true;
                  const q = filter.toLowerCase();
                  return t.Path.toLowerCase().includes(q) || (t.Description ?? "").toLowerCase().includes(q);
                })
                .slice(0, 200)
                .map((t) => (
                <button
                  key={t.Path}
                  onClick={() => bind(ds.id, t.Path)}
                  title={t.Path}
                  disabled={!selectedWidgetId}
                  className="block w-full text-left py-0.5 px-1.5 rounded hover:bg-zinc-800 disabled:opacity-60"
                >
                  <div className="text-[11px] truncate">{t.Description || t.Path}</div>
                  {t.Description && (
                    <div className="text-[10px] font-mono text-zinc-500 truncate">{t.Path}</div>
                  )}
                </button>
              ))}

              {tags.length === 0 && st?.connected && ds.type === "mbtcp" && (
                <div className="text-[10px] text-zinc-500 italic">
                  Connected. Modbus has no tag discovery — bind widgets to paths like{" "}
                  <span className="font-mono">holding:100</span> or{" "}
                  <span className="font-mono">coil:0</span>.
                </div>
              )}
              {tags.length === 0 && (!st || !st.connected) && (
                <div className="text-[11px] text-zinc-600 italic">
                  {st == null ? "not deployed" : "not connected"}
                </div>
              )}
              {tags.length === 0 && st?.connected && ds.type === "rest" && (
                <div className="text-[10px] text-zinc-500 italic">
                  Connected. Click <span className="font-semibold">refresh</span> to browse tags,
                  or bind widgets to paths like{" "}
                  <span className="font-mono">sensors#temperature</span>.
                </div>
              )}
              {tags.length === 0 && st?.connected && ds.type !== "mbtcp" && ds.type !== "rest" && (
                <div className="text-[11px] text-zinc-600 italic">connected — no tags found</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
