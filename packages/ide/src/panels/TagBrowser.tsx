import { useEffect, useState } from "react";
import { useProject } from "../store/projectStore";

type TagDef = { Path: string; Description?: string; Writable?: boolean };

export function TagBrowser() {
  const { project, selectedWidgetId, activePageId, updateWidget } = useProject();
  const [byDS, setByDS] = useState<Record<string, TagDef[]>>({});
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setBusy(true);
    const next: Record<string, TagDef[]> = {};
    for (const ds of project.datasources) {
      try {
        const r = await fetch(`/api/v1/datasources/${ds.id}/tags`);
        const data = (await r.json()) as TagDef[] | null;
        next[ds.id] = data ?? [];
      } catch {
        next[ds.id] = [];
      }
    }
    setByDS(next);
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

      {project.datasources.length === 0 && (
        <div className="text-xs text-zinc-500">No datasources. Add one in the project header.</div>
      )}

      {project.datasources.map((ds) => (
        <div key={ds.id} className="mb-3">
          <div className="text-xs font-semibold text-zinc-300 mb-1">{ds.label || ds.id} <span className="text-zinc-500">[{ds.type}]</span></div>
          <div className="space-y-0.5">
            {(byDS[ds.id] ?? []).slice(0, 100).map((t) => (
              <button
                key={t.Path}
                onClick={() => bind(ds.id, t.Path)}
                title={selectedWidgetId ? `Bind to selected widget` : `Select a widget first`}
                disabled={!selectedWidgetId}
                className="block w-full text-left text-[11px] truncate font-mono py-0.5 px-1.5 rounded hover:bg-zinc-800 disabled:opacity-60"
              >
                {t.Path}
              </button>
            ))}
            {byDS[ds.id]?.length === 0 && (
              <div className="text-[11px] text-zinc-600 italic">no tags / not connected</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
