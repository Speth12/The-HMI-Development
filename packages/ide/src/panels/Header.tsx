import { useEffect, useRef, useState } from "react";
import { useProject, type DatasourceType } from "../store/projectStore";
import { useShallow } from "zustand/react/shallow";
import { setApiBase } from "../store/runtimeTarget";
import { tagStoreClient } from "../store/tagStoreClient";

const LOCAL = "/api/v1";
const storedTarget = () => localStorage.getItem("deployTarget") ?? LOCAL;
const runtimeBase = (target: string) =>
  target === LOCAL ? "" : target.replace(/\/$/, "");

export function Header() {
  const { project, addDatasource, removeDatasource, exportJSON, loadProject } = useProject();
  const { canUndo, canRedo, undo, redo } = useProject(
    useShallow((s) => ({ canUndo: s.canUndo, canRedo: s.canRedo, undo: s.undo, redo: s.redo }))
  );
  const [showAddDS, setShowAddDS] = useState(false);
  const [busy, setBusy] = useState<"none" | "deploy" | "load">("none");
  const [msg, setMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState(storedTarget);

  // Sync the module-level API base on first render so tagStoreClient and
  // widgets use the correct URL before any user interaction.
  useEffect(() => {
    const base = runtimeBase(storedTarget());
    setApiBase(base);
    tagStoreClient.reconnectTo(base);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveTarget = (v: string) => {
    setTarget(v);
    localStorage.setItem("deployTarget", v);
    const base = runtimeBase(v);
    setApiBase(base);
    tagStoreClient.reconnectTo(base);
  };

  const apiBase = runtimeBase(target);

  const deploy = async () => {
    setBusy("deploy");
    setMsg("");
    try {
      const r = await fetch(`${apiBase}/api/v1/project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: exportJSON(),
      });
      const data = (await r.json()) as { ok?: boolean; error?: string; datasources?: number; pages?: number };
      setMsg(r.ok ? `deployed → ${target === LOCAL ? "local" : target} (${data.datasources} ds, ${data.pages} pages)` : `error: ${data.error}`);
    } catch (e) {
      setMsg(`error: ${(e as Error).message}`);
    } finally {
      setBusy("none");
    }
  };

  const saveToFile = () => {
    const blob = new Blob([exportJSON()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(project.name ?? "project").replace(/\s+/g, "-")}.xhmi.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg("saved to file");
  };

  const loadFromFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const p = JSON.parse(reader.result as string);
        loadProject(p);
        setMsg(`loaded ${file.name}`);
      } catch {
        setMsg("invalid project file");
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be reloaded.
    e.target.value = "";
  };

  const loadFromRuntime = async () => {
    setBusy("load");
    try {
      const r = await fetch(`${apiBase}/api/v1/project`);
      if (!r.ok) throw new Error("not loaded");
      const p = await r.json();
      if (p) { loadProject(p); setMsg("loaded from runtime"); }
      else { setMsg("runtime has no project loaded"); }
    } catch {
      setMsg("nothing on runtime");
    } finally {
      setBusy("none");
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
      <div className="font-semibold text-sm">X-HMI <span className="text-zinc-500 font-normal">IDE</span></div>

      {/* Project name */}
      <input
        value={project.name ?? ""}
        onChange={(e) => {
          const p = JSON.parse(exportJSON());
          loadProject({ ...p, name: e.target.value || undefined });
        }}
        placeholder="Untitled"
        className="text-xs bg-transparent border-b border-zinc-700 px-1 py-0.5 text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 w-28"
      />

      <div className="flex items-center gap-2">
        {project.datasources.map((d) => (
          <span key={d.id} className="text-[11px] bg-zinc-800 rounded px-2 py-0.5 flex items-center gap-1">
            <span className="font-mono">{d.id}</span>
            <span className="text-zinc-500">[{d.type}]</span>
            <button onClick={() => removeDatasource(d.id)} className="text-zinc-500 hover:text-red-400">×</button>
          </span>
        ))}
        <button onClick={() => setShowAddDS(true)} className="text-[11px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700">+ datasource</button>
      </div>

      <div className="flex-1" />

      {/* Deploy target selector */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-zinc-500">target</span>
        <select
          value={target === LOCAL ? LOCAL : "custom"}
          onChange={(e) => {
            if (e.target.value === LOCAL) saveTarget(LOCAL);
            else saveTarget("http://10.0.0.210:8080");
          }}
          className="text-[11px] bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-zinc-300"
        >
          <option value={LOCAL}>local</option>
          <option value="custom">PLC / custom…</option>
        </select>
        {target !== LOCAL && (
          <input
            value={target}
            onChange={(e) => saveTarget(e.target.value)}
            placeholder="http://10.0.0.210:8080"
            className="text-[11px] font-mono bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 w-44 text-zinc-200"
          />
        )}
      </div>

      {msg && <span className="text-[11px] text-zinc-400 max-w-xs truncate">{msg}</span>}

      {/* Preview operator panel */}
      <button
        onClick={() => window.open(apiBase || window.location.origin, "_blank")}
        title="Open operator panel in new tab"
        className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700"
      >
        ⬡ Preview
      </button>

      {/* Undo / Redo */}
      <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)"
        className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 font-mono">↩</button>
      <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)"
        className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 font-mono">↪</button>

      {/* File save / load */}
      <button onClick={saveToFile} title="Save project to .xhmi.json file"
        className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700" >↓ Save</button>
      <button onClick={() => fileInputRef.current?.click()} title="Load project from .xhmi.json file"
        className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700">↑ Load</button>
      <input ref={fileInputRef} type="file" accept=".json,.xhmi.json" className="hidden" onChange={loadFromFile} />

      <button onClick={loadFromRuntime} disabled={busy !== "none"} className="text-xs px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50">{busy === "load" ? "…" : "Pull"}</button>
      <button onClick={deploy} disabled={busy !== "none"} className="text-xs px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-medium">{busy === "deploy" ? "deploying…" : "Deploy"}</button>

      {showAddDS && <AddDatasourceModal onClose={() => setShowAddDS(false)} onAdd={(ds) => { addDatasource(ds); setShowAddDS(false); }} />}
    </div>
  );
}

const TYPE_DEFAULTS: Record<DatasourceType, { id: string; label: string }> = {
  opcua:   { id: "opcua",  label: "OPC UA" },
  mbtcp:   { id: "mb",     label: "Modbus TCP" },
  mqtt:    { id: "mqtt",   label: "MQTT" },
  rest:    { id: "rest",   label: "PLCnext REST" },
  virtual: { id: "calc",   label: "Computed Tags" },
};

function AddDatasourceModal({ onClose, onAdd }: { onClose: () => void; onAdd: (ds: { id: string; type: DatasourceType; label: string; config: Record<string, unknown> }) => void }) {
  const [type, setType] = useState<DatasourceType>("opcua");
  const [id, setId] = useState(TYPE_DEFAULTS.opcua.id);
  const [label, setLabel] = useState(TYPE_DEFAULTS.opcua.label);
  const [ip, setIp] = useState("10.0.0.210");
  // per-type extras
  const [opcuaPort, setOpcuaPort]           = useState(4840);
  const [securityMode, setSecurityMode]     = useState("None");
  const [securityPolicy, setSecurityPolicy] = useState("None");
  const [mbPort, setMbPort]                 = useState(502);
  const [slaveId, setSlaveId]               = useState(1);
  const [mqttPort, setMqttPort]             = useState(1883);
  const [basePath, setBasePath]             = useState("/_pxc_api/v1.14");
  const [bearerToken, setBearerToken]       = useState("");
  // Virtual/computed tags — stored as structured array for form editing
  const [virtualRows, setVirtualRows]       = useState<{ path: string; formula: string }[]>([
    { path: "tempF", formula: "{opcua:Temp}*9/5+32" },
  ]);
  // test connection
  const [testing, setTesting]               = useState(false);
  const [testResult, setTestResult]         = useState<{ ok: boolean; msg: string } | null>(null);

  const changeType = (t: DatasourceType) => {
    setType(t);
    setId(TYPE_DEFAULTS[t].id);
    setLabel(TYPE_DEFAULTS[t].label);
    setTestResult(null);
  };

  /** Build the datasource element payload (used for both Test and Add). */
  const buildPayload = () => {
    const config: Record<string, unknown> = {};
    if (type === "opcua") {
      config.endpoint = `opc.tcp://${ip}:${opcuaPort}`;
      config.securityMode = securityMode;
      config.securityPolicy = securityPolicy;
    } else if (type === "mbtcp") {
      config.host = ip;
      config.port = mbPort || 502;
      config.slaveId = slaveId || 1;
    } else if (type === "mqtt") {
      config.host = ip;
      config.port = mqttPort || 1883;
    } else if (type === "virtual") {
      config.tags = JSON.stringify(virtualRows.filter((r) => r.path.trim()));
    } else {
      config.endpoint = `https://${ip}`;
      config.basePath = basePath;
      if (bearerToken) config.bearerToken = bearerToken;
    }
    return { id, type, label, config };
  };

  const testConn = async () => {
    setTesting(true);
    setTestResult(null);
    const { type: dsType, config } = buildPayload();
    try {
      const r = await fetch("/api/v1/datasources/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "test", type: dsType, label: "test", config }),
      });
      const data = (await r.json()) as { connected: boolean; lastError?: string; tagCount?: number };
      if (data.connected) {
        setTestResult({ ok: true, msg: `Connected${data.tagCount ? ` · ${data.tagCount} tags` : ""}` });
      } else {
        setTestResult({ ok: false, msg: data.lastError ?? "Connection failed" });
      }
    } catch (e) {
      setTestResult({ ok: false, msg: (e as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const submit = () => {
    const { id: dsId, type: dsType, label: dsLabel, config } = buildPayload();
    onAdd({ id: dsId, type: dsType, label: dsLabel, config });
  };

  const inputCls = "mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs font-mono";
  const labelCls = "block text-[11px]";

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 w-[420px] space-y-3">
        <div className="text-sm font-semibold">Add Datasource</div>

        {/* Type */}
        <label className={labelCls}>Type
          <select value={type} onChange={(e) => changeType(e.target.value as DatasourceType)}
            className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs">
            <option value="opcua">OPC UA</option>
            <option value="mbtcp">Modbus TCP</option>
            <option value="mqtt">MQTT</option>
            <option value="rest">REST (PLCnext pxc_api)</option>
            <option value="virtual">Virtual (computed expressions)</option>
          </select>
        </label>

        {/* ID + Label */}
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px]">ID
            <input value={id} onChange={(e) => setId(e.target.value)} className={inputCls} />
          </label>
          <label className="text-[11px]">Label
            <input value={label} onChange={(e) => setLabel(e.target.value)}
              className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs" />
          </label>
        </div>

        {/* IP — shared by network types (not virtual) */}
        {type !== "virtual" && (
          <label className={labelCls}>IP Address
            <input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="10.0.0.210" className={inputCls} />
          </label>
        )}

        {/* OPC UA extras */}
        {type === "opcua" && (<>
          <label className={labelCls}>Port
            <input type="number" value={opcuaPort} onChange={(e) => setOpcuaPort(Number(e.target.value))}
              className="mt-1 w-28 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs block" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px]">Security mode
              <select value={securityMode} onChange={(e) => setSecurityMode(e.target.value)}
                className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs">
                <option value="None">None</option>
                <option value="Sign">Sign</option>
                <option value="SignAndEncrypt">Sign &amp; Encrypt</option>
              </select>
            </label>
            <label className="text-[11px]">Security policy
              <select value={securityPolicy} onChange={(e) => setSecurityPolicy(e.target.value)}
                className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs">
                <option value="None">None</option>
                <option value="Basic128Rsa15">Basic128Rsa15</option>
                <option value="Basic256">Basic256</option>
                <option value="Basic256Sha256">Basic256Sha256</option>
              </select>
            </label>
          </div>
        </>)}

        {/* Modbus extras */}
        {type === "mbtcp" && (<>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px]">Port
              <input type="number" value={mbPort} onChange={(e) => setMbPort(Number(e.target.value))}
                className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs" />
            </label>
            <label className="text-[11px]">Slave ID
              <input type="number" value={slaveId} onChange={(e) => setSlaveId(Number(e.target.value))}
                className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs" />
            </label>
          </div>
        </>)}

        {/* MQTT extras */}
        {type === "mqtt" && (
          <label className={labelCls}>Port
            <input type="number" value={mqttPort} onChange={(e) => setMqttPort(Number(e.target.value))}
              className="mt-1 w-28 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs block" />
          </label>
        )}

        {/* REST extras */}
        {type === "rest" && (<>
          <label className={labelCls}>Base path
            <input value={basePath} onChange={(e) => setBasePath(e.target.value)} className={inputCls} />
          </label>
          <label className={labelCls}>Bearer token <span className="text-zinc-600">(optional)</span>
            <input value={bearerToken} onChange={(e) => setBearerToken(e.target.value)}
              placeholder="leave blank if not required" className={inputCls} />
          </label>
        </>)}

        {/* Virtual (computed) extras */}
        {type === "virtual" && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-zinc-300">Computed Tags</span>
              <button
                onClick={() => setVirtualRows((r) => [...r, { path: "", formula: "" }])}
                className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700"
              >
                + add tag
              </button>
            </div>
            <div className="text-[10px] text-zinc-600 mb-1.5">
              Formula: <span className="font-mono text-zinc-500">{`{dsId:tagPath}`}</span> ·{" "}
              <span className="font-mono text-zinc-500">abs() min() max() clamp() sqrt() pow()</span>
            </div>
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
              {virtualRows.map((row, i) => (
                <div key={i} className="flex gap-1.5 items-center">
                  <input
                    value={row.path}
                    onChange={(e) => setVirtualRows((rows) => rows.map((r, j) => j === i ? { ...r, path: e.target.value } : r))}
                    placeholder="tagName"
                    className="w-24 shrink-0 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[11px] font-mono focus:outline-none focus:border-zinc-600"
                  />
                  <span className="text-zinc-600 text-[10px] shrink-0">=</span>
                  <input
                    value={row.formula}
                    onChange={(e) => setVirtualRows((rows) => rows.map((r, j) => j === i ? { ...r, formula: e.target.value } : r))}
                    placeholder="{ds:path} * 9/5 + 32"
                    className="flex-1 min-w-0 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[11px] font-mono focus:outline-none focus:border-zinc-600"
                  />
                  <button
                    onClick={() => setVirtualRows((rows) => rows.filter((_, j) => j !== i))}
                    className="text-zinc-600 hover:text-red-400 text-xs shrink-0 px-1"
                  >
                    ×
                  </button>
                </div>
              ))}
              {virtualRows.length === 0 && (
                <div className="text-[10px] text-zinc-600 italic text-center py-2">
                  No tags — click <span className="font-semibold">+ add tag</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Preview line */}
        <div className="text-[10px] text-zinc-600 font-mono truncate">
          {type === "opcua"   && `opc.tcp://${ip}:${opcuaPort}`}
          {type === "mbtcp"   && `${ip}:${mbPort}  slave=${slaveId}`}
          {type === "mqtt"    && `${ip}:${mqttPort}`}
          {type === "rest"    && `https://${ip}${basePath}`}
          {type === "virtual" && `${virtualRows.filter((r) => r.path.trim()).length} computed tag(s)`}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={testConn}
            disabled={testing}
            className="text-xs px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50"
          >
            {testing ? "Testing…" : "Test"}
          </button>
          {testResult && (
            <span className={`text-[11px] flex-1 truncate ${testResult.ok ? "text-emerald-400" : "text-red-400"}`}>
              {testResult.ok ? "✓ " : "✗ "}{testResult.msg}
            </span>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="text-xs px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700">Cancel</button>
          <button onClick={submit} className="text-xs px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 font-medium">Add</button>
        </div>
      </div>
    </div>
  );
}
