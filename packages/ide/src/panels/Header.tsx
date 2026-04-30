import { useState } from "react";
import { useProject, type DatasourceType } from "../store/projectStore";

export function Header() {
  const { project, addDatasource, removeDatasource, exportJSON, loadProject } = useProject();
  const [showAddDS, setShowAddDS] = useState(false);
  const [busy, setBusy] = useState<"none" | "deploy" | "load">("none");
  const [msg, setMsg] = useState("");

  const deploy = async () => {
    setBusy("deploy");
    setMsg("");
    try {
      const r = await fetch("/api/v1/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: exportJSON(),
      });
      const data = (await r.json()) as { ok?: boolean; error?: string; datasources?: number; pages?: number };
      setMsg(r.ok ? `deployed (${data.datasources} ds, ${data.pages} pages)` : `error: ${data.error}`);
    } catch (e) {
      setMsg(`error: ${(e as Error).message}`);
    } finally {
      setBusy("none");
    }
  };

  const loadFromRuntime = async () => {
    setBusy("load");
    try {
      const r = await fetch("/api/v1/project");
      if (!r.ok) throw new Error("not loaded");
      const p = await r.json();
      if (p) loadProject(p);
      setMsg("loaded from runtime");
    } catch {
      setMsg("nothing on runtime");
    } finally {
      setBusy("none");
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
      <div className="font-semibold text-sm">X-HMI <span className="text-zinc-500 font-normal">IDE</span></div>

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

      {msg && <span className="text-[11px] text-zinc-400">{msg}</span>}
      <button onClick={loadFromRuntime} disabled={busy !== "none"} className="text-xs px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50">{busy === "load" ? "…" : "Pull"}</button>
      <button onClick={deploy} disabled={busy !== "none"} className="text-xs px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-medium">{busy === "deploy" ? "deploying…" : "Deploy"}</button>

      {showAddDS && <AddDatasourceModal onClose={() => setShowAddDS(false)} onAdd={(ds) => { addDatasource(ds); setShowAddDS(false); }} />}
    </div>
  );
}

function AddDatasourceModal({ onClose, onAdd }: { onClose: () => void; onAdd: (ds: { id: string; type: DatasourceType; label: string; config: Record<string, unknown> }) => void }) {
  const [type, setType] = useState<DatasourceType>("opcua");
  const [id, setId] = useState("opcua");
  const [label, setLabel] = useState("OPC UA");
  const [endpoint, setEndpoint] = useState("opc.tcp://192.168.88.10:4840");
  const [host, setHost] = useState("192.168.88.10");
  const [port, setPort] = useState(502);
  const [bearerToken, setBearerToken] = useState("");

  const submit = () => {
    const config: Record<string, unknown> = {};
    if (type === "opcua") {
      config.endpoint = endpoint;
      config.securityMode = "SignAndEncrypt";
      config.securityPolicy = "Basic256Sha256";
    } else if (type === "mbtcp") {
      config.host = host;
      config.port = port || 502;
      config.slaveId = 1;
    } else if (type === "mqtt") {
      config.host = host;
      config.port = port || 1883;
    } else {
      config.endpoint = endpoint;
      config.basePath = "/_pxc_api/api/v1.5/data";
      config.bearerToken = bearerToken;
      config.insecure = "true";
    }
    onAdd({ id, type, label, config });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 w-[420px] space-y-3">
        <div className="text-sm font-semibold">Add Datasource</div>

        <label className="block text-[11px]">Type
          <select value={type} onChange={(e) => setType(e.target.value as DatasourceType)} className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs">
            <option value="opcua">OPC UA</option>
            <option value="mbtcp">Modbus TCP</option>
            <option value="mqtt">MQTT</option>
            <option value="rest">REST</option>
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px]">ID<input value={id} onChange={(e) => setId(e.target.value)} className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs font-mono" /></label>
          <label className="text-[11px]">Label<input value={label} onChange={(e) => setLabel(e.target.value)} className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs" /></label>
        </div>

        {(type === "opcua" || type === "rest") && (
          <label className="block text-[11px]">Endpoint
            <input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs font-mono" />
          </label>
        )}
        {(type === "mbtcp" || type === "mqtt") && (
          <div className="grid grid-cols-3 gap-2">
            <label className="text-[11px] col-span-2">Host<input value={host} onChange={(e) => setHost(e.target.value)} className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs font-mono" /></label>
            <label className="text-[11px]">Port<input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs" /></label>
          </div>
        )}
        {type === "rest" && (
          <label className="block text-[11px]">Bearer token
            <input value={bearerToken} onChange={(e) => setBearerToken(e.target.value)} className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs font-mono" />
          </label>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="text-xs px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700">Cancel</button>
          <button onClick={submit} className="text-xs px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 font-medium">Add</button>
        </div>
      </div>
    </div>
  );
}
