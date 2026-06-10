import { useEffect, useRef, useState, useCallback } from "react";
import { useProject } from "../store/projectStore";
import { apiBase } from "../store/runtimeTarget";
import { tagStoreClient, type TagState } from "../store/tagStoreClient";

// ── Shared types ───────────────────────────────────────────────────────────

type TagDef = { Path: string; Description?: string; Writable?: boolean };
type DSStatus = { connected: boolean; lastError: string; tagCount: number };

type NSNode = {
  path: string;
  name: string;
  type: "folder" | "asset" | "tag" | "virtual";
  dataType?: string;
  unit?: string;
  description?: string;
  driverId?: string;
  driverAddr?: string;
};

function fmtValue(s: TagState | undefined): string {
  if (!s) return "";
  const v = s.value;
  if (v == null) return "—";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(3);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "string") return v.length > 16 ? v.slice(0, 16) + "…" : v;
  return JSON.stringify(v).slice(0, 20);
}

// ── Root component ─────────────────────────────────────────────────────────

export function TagBrowser() {
  const [mode, setMode] = useState<"source" | "namespace">("source");

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Mode tabs */}
      <div className="flex border-b border-zinc-800 shrink-0">
        {(["source", "namespace"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-1 text-[10px] uppercase tracking-wider font-medium transition-colors ${
              mode === m
                ? "text-zinc-100 border-b-2 border-blue-500 -mb-px"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {m === "source" ? "By Source" : "Namespace"}
          </button>
        ))}
      </div>

      {mode === "source" ? <SourceBrowser /> : <NamespaceBrowser />}
    </div>
  );
}

// ── By-Source browser (existing logic, unchanged) ─────────────────────────

function SourceBrowser() {
  const { project, selectedWidgetId, activePageId, updateWidget } = useProject();
  const [byDS, setByDS] = useState<Record<string, TagDef[]>>({});
  const [statusByDS, setStatusByDS] = useState<Record<string, DSStatus | null>>({});
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const [liveValues, setLiveValues] = useState<Record<string, TagState>>({});
  const unsubsRef = useRef<Array<() => void>>([]);

  const refresh = async () => {
    setBusy(true);
    const nextTags: Record<string, TagDef[]> = {};
    const nextStatus: Record<string, DSStatus | null> = {};
    for (const ds of project.datasources) {
      try {
        const [tagR, stR] = await Promise.all([
          fetch(`${apiBase}/api/v1/datasources/${ds.id}/tags`),
          fetch(`${apiBase}/api/v1/datasources/${ds.id}/status`),
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

  useEffect(() => {
    unsubsRef.current.forEach((u) => u());
    unsubsRef.current = [];
    const nextValues: Record<string, TagState> = {};
    for (const [dsId, tags] of Object.entries(byDS)) {
      for (const t of tags) {
        const path = `${dsId}:${t.Path}`;
        const unsub = tagStoreClient.subscribe(path, (state) => {
          setLiveValues((prev) => ({ ...prev, [path]: state }));
        });
        unsubsRef.current.push(unsub);
        const cached = tagStoreClient.get(path);
        if (cached) nextValues[path] = cached;
      }
    }
    if (Object.keys(nextValues).length) setLiveValues(nextValues);
    return () => { unsubsRef.current.forEach((u) => u()); unsubsRef.current = []; };
  }, [byDS]);

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
                .map((t) => {
                  const tagKey = `${ds.id}:${t.Path}`;
                  const live = liveValues[tagKey];
                  const valueText = fmtValue(live);
                  const isGood = live?.quality === "Good";
                  return (
                    <button
                      key={t.Path}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/x-tag-binding", tagKey);
                        e.dataTransfer.effectAllowed = "link";
                      }}
                      onClick={() => bind(ds.id, t.Path)}
                      title={`${tagKey} — drag onto a widget to bind`}
                      className="flex items-center w-full text-left py-0.5 px-1.5 rounded hover:bg-zinc-800 cursor-grab active:cursor-grabbing gap-1.5"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] truncate">{t.Description || t.Path}</div>
                        {t.Description && (
                          <div className="text-[10px] font-mono text-zinc-500 truncate">{t.Path}</div>
                        )}
                      </div>
                      {valueText && (
                        <span className={`text-[10px] font-mono shrink-0 tabular-nums ${isGood ? "text-emerald-400" : "text-zinc-500"}`}>
                          {valueText}
                        </span>
                      )}
                    </button>
                  );
                })}

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

// ── Namespace browser ──────────────────────────────────────────────────────

function NamespaceBrowser() {
  const { selectedWidgetId, activePageId, updateWidget } = useProject();
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<NSNode[] | null>(null);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tree root children
  const [rootNodes, setRootNodes] = useState<NSNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [children, setChildren] = useState<Record<string, NSNode[]>>({});
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());

  // Live values for visible tags
  const [liveValues, setLiveValues] = useState<Record<string, TagState>>({});
  const unsubsRef = useRef<Map<string, () => void>>(new Map());

  const bindNSNode = (node: NSNode) => {
    if (!selectedWidgetId) return;
    if (node.type !== "tag" && node.type !== "virtual") return;
    // Build binding: driverId:driverAddr if available, else NSPath
    const binding = node.driverId && node.driverAddr
      ? `${node.driverId}:${node.driverAddr}`
      : node.path;
    updateWidget(activePageId, selectedWidgetId, { binding });
  };

  const subscribeTag = useCallback((path: string) => {
    if (unsubsRef.current.has(path)) return;
    const unsub = tagStoreClient.subscribe(path, (state) => {
      setLiveValues((prev) => ({ ...prev, [path]: state }));
    });
    unsubsRef.current.set(path, unsub);
    const cached = tagStoreClient.get(path);
    if (cached) setLiveValues((prev) => ({ ...prev, [path]: cached }));
  }, []);

  // Load root on mount
  useEffect(() => {
    fetch(`${apiBase}/api/v1/namespace/tree?path=`)
      .then((r) => r.ok ? r.json() : [])
      .then((nodes: NSNode[]) => {
        setRootNodes(nodes ?? []);
        for (const n of (nodes ?? [])) {
          if (n.type === "tag" || n.type === "virtual") subscribeTag(n.path);
        }
      })
      .catch(() => setRootNodes([]));
    return () => {
      unsubsRef.current.forEach((u) => u());
      unsubsRef.current.clear();
    };
  }, [subscribeTag]);

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!query.trim()) { setSearchResults(null); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`${apiBase}/api/v1/namespace/search?q=${encodeURIComponent(query)}`);
        const data: NSNode[] = r.ok ? await r.json() : [];
        setSearchResults(data ?? []);
        for (const n of (data ?? [])) {
          if (n.type === "tag" || n.type === "virtual") subscribeTag(n.path);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [query, subscribeTag]);

  const toggleExpand = async (path: string) => {
    if (expanded.has(path)) {
      setExpanded((prev) => { const s = new Set(prev); s.delete(path); return s; });
      return;
    }
    setExpanded((prev) => new Set(prev).add(path));
    if (children[path]) return; // already loaded
    setLoadingPaths((prev) => new Set(prev).add(path));
    try {
      const r = await fetch(`${apiBase}/api/v1/namespace/tree?path=${encodeURIComponent(path)}`);
      const data: NSNode[] = r.ok ? await r.json() : [];
      setChildren((prev) => ({ ...prev, [path]: data ?? [] }));
      for (const n of (data ?? [])) {
        if (n.type === "tag" || n.type === "virtual") subscribeTag(n.path);
      }
    } catch {
      setChildren((prev) => ({ ...prev, [path]: [] }));
    } finally {
      setLoadingPaths((prev) => { const s = new Set(prev); s.delete(path); return s; });
    }
  };

  const isLeaf = (n: NSNode) => n.type === "tag" || n.type === "virtual";

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Search bar */}
      <div className="p-2 border-b border-zinc-800 shrink-0">
        <div className="relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search namespace…"
            className="w-full text-[11px] bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 pr-6"
          />
          {searching && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 animate-pulse">…</span>
          )}
          {query && !searching && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 text-xs"
            >×</button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Search results */}
        {searchResults !== null ? (
          <div className="p-2">
            {searchResults.length === 0 ? (
              <div className="text-[11px] text-zinc-600 italic px-1">No results.</div>
            ) : (
              <div className="space-y-0.5">
                {searchResults.map((n) => (
                  <NSNodeRow
                    key={n.path}
                    node={n}
                    depth={0}
                    live={liveValues[n.path]}
                    onBind={bindNSNode}
                    hasWidget={!!selectedWidgetId}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Tree view */
          <div className="p-2">
            {rootNodes.length === 0 ? (
              <div className="text-[11px] text-zinc-600 italic px-1 pt-2">
                Namespace is empty. Deploy a project or create nodes via the API.
              </div>
            ) : (
              <NSTree
                nodes={rootNodes}
                depth={0}
                expanded={expanded}
                children={children}
                loadingPaths={loadingPaths}
                liveValues={liveValues}
                onToggle={toggleExpand}
                onBind={bindNSNode}
                hasWidget={!!selectedWidgetId}
                isLeaf={isLeaf}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tree renderer ──────────────────────────────────────────────────────────

function NSTree({
  nodes, depth, expanded, children, loadingPaths, liveValues, onToggle, onBind, hasWidget, isLeaf,
}: {
  nodes: NSNode[];
  depth: number;
  expanded: Set<string>;
  children: Record<string, NSNode[]>;
  loadingPaths: Set<string>;
  liveValues: Record<string, TagState>;
  onToggle: (path: string) => void;
  onBind: (node: NSNode) => void;
  hasWidget: boolean;
  isLeaf: (n: NSNode) => boolean;
}) {
  return (
    <div>
      {nodes.map((n) => (
        <div key={n.path}>
          <NSNodeRow
            node={n}
            depth={depth}
            live={liveValues[n.path]}
            onBind={onBind}
            hasWidget={hasWidget}
            expanded={expanded.has(n.path)}
            loading={loadingPaths.has(n.path)}
            onToggle={isLeaf(n) ? undefined : () => onToggle(n.path)}
          />
          {!isLeaf(n) && expanded.has(n.path) && (
            <NSTree
              nodes={children[n.path] ?? []}
              depth={depth + 1}
              expanded={expanded}
              children={children}
              loadingPaths={loadingPaths}
              liveValues={liveValues}
              onToggle={onToggle}
              onBind={onBind}
              hasWidget={hasWidget}
              isLeaf={isLeaf}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Single node row ────────────────────────────────────────────────────────

const NODE_ICONS: Record<NSNode["type"], string> = {
  folder: "▸",
  asset:  "◈",
  tag:    "◎",
  virtual: "⊕",
};

function NSNodeRow({
  node, depth, live, onBind, hasWidget, expanded, loading, onToggle,
}: {
  node: NSNode;
  depth: number;
  live?: TagState;
  onBind: (node: NSNode) => void;
  hasWidget: boolean;
  expanded?: boolean;
  loading?: boolean;
  onToggle?: () => void;
}) {
  const isTag = node.type === "tag" || node.type === "virtual";
  const valueText = fmtValue(live);
  const isGood = live?.quality === "Good";

  // Build the binding string for drag-drop
  const binding = node.driverId && node.driverAddr
    ? `${node.driverId}:${node.driverAddr}`
    : node.path;

  return (
    <div
      style={{ paddingLeft: depth * 12 + 4 }}
      className={`flex items-center group min-w-0 rounded py-0.5 pr-1 gap-1 ${
        isTag && hasWidget
          ? "hover:bg-zinc-800 cursor-pointer"
          : isTag
          ? "cursor-grab active:cursor-grabbing hover:bg-zinc-800/50"
          : "hover:bg-zinc-800/40"
      }`}
      draggable={isTag}
      onDragStart={isTag ? (e) => {
        e.dataTransfer.setData("text/x-tag-binding", binding);
        e.dataTransfer.effectAllowed = "link";
      } : undefined}
      onClick={isTag ? () => onBind(node) : onToggle}
      title={isTag ? `${node.path}${node.description ? " — " + node.description : ""}` : node.path}
    >
      {/* Expand chevron for folders/assets */}
      {onToggle ? (
        <span
          className={`text-[10px] text-zinc-500 shrink-0 w-3 transition-transform ${expanded ? "rotate-90" : ""}`}
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
        >
          {loading ? "·" : "▸"}
        </span>
      ) : (
        <span className="w-3 shrink-0" />
      )}

      {/* Type icon */}
      <span className={`text-[10px] shrink-0 ${
        node.type === "folder"  ? "text-zinc-600" :
        node.type === "asset"   ? "text-blue-500" :
        node.type === "virtual" ? "text-amber-500" :
        "text-zinc-400"
      }`}>
        {expanded !== undefined && !loading ? (expanded ? "▾" : NODE_ICONS[node.type]) : NODE_ICONS[node.type]}
      </span>

      {/* Label */}
      <div className="flex-1 min-w-0">
        <span className={`text-[11px] truncate block ${isTag ? "text-zinc-200" : "text-zinc-400"}`}>
          {node.name}
        </span>
        {isTag && (node.unit || node.dataType) && (
          <span className="text-[9px] text-zinc-600 block truncate">
            {[node.dataType, node.unit].filter(Boolean).join(" · ")}
          </span>
        )}
      </div>

      {/* Live value */}
      {isTag && valueText && (
        <span className={`text-[10px] font-mono shrink-0 tabular-nums ml-1 ${isGood ? "text-emerald-400" : "text-zinc-500"}`}>
          {valueText}
        </span>
      )}
    </div>
  );
}
