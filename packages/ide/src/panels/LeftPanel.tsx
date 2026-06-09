import { useState } from "react";
import { useProject, type DatasourceType } from "../store/projectStore";
import { AlarmBadge } from "./Alarms";

// ── Left panel: Project | Page tabs ──────────────────────────────────────────

export function LeftPanel({ width }: { width?: number }) {
  const [tab, setTab] = useState<"project" | "page">("project");

  return (
    <div className="shrink-0 border-r border-zinc-800 bg-zinc-900/50 flex flex-col min-h-0" style={{ width: width ?? 260 }}>
      {/* Tab bar */}
      <div className="flex border-b border-zinc-800 shrink-0">
        {(["project", "page"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-[10px] uppercase tracking-wider font-medium transition-colors ${
              tab === t
                ? "text-zinc-100 border-b-2 border-blue-500 -mb-px"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {tab === "project" ? <ProjectSettings /> : <PageSettings />}
      </div>
    </div>
  );
}

// ── Project Settings ──────────────────────────────────────────────────────────

function ProjectSettings() {
  const { project, exportJSON, loadProject, addDatasource, removeDatasource } = useProject();
  const [showAddDS, setShowAddDS] = useState(false);

  const inp = "w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-zinc-500";

  const setName = (name: string) => {
    const p = JSON.parse(exportJSON());
    loadProject({ ...p, name: name || undefined });
  };

  const setProp = (patch: Partial<typeof project>) => {
    const p = JSON.parse(exportJSON());
    loadProject({ ...p, ...patch });
  };

  return (
    <div className="p-3 space-y-4">
      {/* Name */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Project Name</div>
        <input
          value={project.name ?? ""}
          onChange={(e) => setName(e.target.value)}
          placeholder="Untitled"
          className={inp}
        />
      </div>

      {/* Security */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Security</div>
        <div className="space-y-2">
          <div>
            <div className="text-[10px] text-zinc-500 mb-0.5">Operator PIN (blank = no lock)</div>
            <input
              type="password"
              value={project.pin ?? ""}
              onChange={(e) => setProp({ pin: e.target.value || undefined })}
              placeholder="e.g. 1234"
              className={inp}
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={project.viewOnly ?? false}
              onChange={(e) => setProp({ viewOnly: e.target.checked || undefined })}
              className="accent-blue-500"
            />
            <span className="text-xs text-zinc-300">View-only (disable all writes)</span>
          </label>
        </div>
      </div>

      {/* Datasources */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Datasources</div>
          <button
            onClick={() => setShowAddDS(true)}
            className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700"
          >
            + add
          </button>
        </div>
        <div className="space-y-1">
          {project.datasources.length === 0 && (
            <div className="text-[11px] text-zinc-600 italic">No datasources yet.</div>
          )}
          {project.datasources.map((d) => (
            <div key={d.id} className="flex items-center gap-2 bg-zinc-800/60 rounded px-2 py-1.5">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-mono text-zinc-200 truncate">{d.id}</div>
                <div className="text-[10px] text-zinc-500">{d.type} · {d.label}</div>
              </div>
              <button
                onClick={() => removeDatasource(d.id)}
                className="text-zinc-600 hover:text-red-400 text-xs shrink-0"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Alarm Rules */}
      <AlarmRulesEditor />

      {showAddDS && (
        <AddDatasourceModal
          onClose={() => setShowAddDS(false)}
          onAdd={(ds) => { addDatasource(ds); setShowAddDS(false); }}
        />
      )}
    </div>
  );
}

// ── Alarm Rules (inline in Project Settings) ──────────────────────────────────

type AlarmRule = {
  id: string;
  name: string;
  binding: string;
  condition: string;
  threshold: number;
  severity: string;
  message: string;
};

function AlarmRulesEditor() {
  const { exportJSON, loadProject } = useProject();
  const project = useProject((s) => s.project) as { alarmRules?: AlarmRule[] } & Record<string, unknown>;
  const rules: AlarmRule[] = (project.alarmRules as AlarmRule[]) ?? [];

  const setRules = (next: AlarmRule[]) => {
    const p = JSON.parse(exportJSON());
    loadProject({ ...p, alarmRules: next });
  };

  const addRule = () => setRules([...rules, {
    id: `alarm-${Date.now()}`,
    name: "New Alarm",
    binding: "",
    condition: "gt",
    threshold: 0,
    severity: "warning",
    message: "",
  }]);

  const updateRule = (idx: number, patch: Partial<AlarmRule>) => {
    setRules(rules.map((r, i) => i === idx ? { ...r, ...patch } : r));
  };

  const removeRule = (idx: number) => setRules(rules.filter((_, i) => i !== idx));

  const inp = "w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-zinc-500";

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
          Alarm Rules <AlarmBadge />
        </div>
        <button
          onClick={addRule}
          className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700"
        >
          + add
        </button>
      </div>
      <div className="space-y-2">
        {rules.length === 0 && (
          <div className="text-[11px] text-zinc-600 italic">No alarm rules.</div>
        )}
        {rules.map((rule, i) => (
          <div key={rule.id} className="border border-zinc-700/50 rounded p-2 space-y-1.5">
            <div className="flex items-center gap-1">
              <input
                value={rule.name}
                onChange={(e) => updateRule(i, { name: e.target.value })}
                placeholder="Alarm name"
                className={`${inp} flex-1`}
              />
              <button onClick={() => removeRule(i)} className="text-zinc-600 hover:text-red-400 text-xs shrink-0">×</button>
            </div>
            <input
              value={rule.binding}
              onChange={(e) => updateRule(i, { binding: e.target.value })}
              placeholder="ds:tagPath"
              className={`${inp} font-mono text-[10px]`}
            />
            <div className="flex gap-1">
              <select
                value={rule.condition}
                onChange={(e) => updateRule(i, { condition: e.target.value })}
                className="bg-zinc-900 border border-zinc-700 rounded px-1 py-1 text-[10px] w-16"
              >
                <option value="gt">&gt;</option>
                <option value="gte">≥</option>
                <option value="lt">&lt;</option>
                <option value="lte">≤</option>
                <option value="eq">=</option>
                <option value="ne">≠</option>
              </select>
              <input
                type="number"
                value={rule.threshold}
                onChange={(e) => updateRule(i, { threshold: Number(e.target.value) })}
                className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs font-mono w-20"
              />
              <select
                value={rule.severity}
                onChange={(e) => updateRule(i, { severity: e.target.value })}
                className="bg-zinc-900 border border-zinc-700 rounded px-1 py-1 text-[10px] flex-1"
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <input
              value={rule.message}
              onChange={(e) => updateRule(i, { message: e.target.value })}
              placeholder="Alarm message"
              className={inp}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page templates ────────────────────────────────────────────────────────────

import { newWidgetId } from "../store/projectStore";
import type { Widget } from "../store/projectStore";

type Template = { id: string; name: string; description: string; widgets: Omit<Widget, "id">[] };

const PAGE_TEMPLATES: Template[] = [
  {
    id: "blank",
    name: "Blank",
    description: "Empty page",
    widgets: [],
  },
  {
    id: "overview",
    name: "Overview",
    description: "Gauges, LED, button",
    widgets: [
      { type: "gauge",          x: 0,  y: 0, w: 4, h: 3, config: { label: "Value 1" } },
      { type: "gauge",          x: 4,  y: 0, w: 4, h: 3, config: { label: "Value 2" } },
      { type: "tank",           x: 8,  y: 0, w: 2, h: 4, config: { label: "Level" } },
      { type: "numericDisplay", x: 0,  y: 3, w: 3, h: 2, config: { label: "PV" } },
      { type: "numericDisplay", x: 3,  y: 3, w: 3, h: 2, config: { label: "SP" } },
      { type: "led",            x: 10, y: 0, w: 2, h: 2, config: { label: "Status" } },
      { type: "button",         x: 10, y: 2, w: 2, h: 2, config: { label: "Reset" } },
    ],
  },
  {
    id: "trend",
    name: "Trend",
    description: "Full-width trend chart",
    widgets: [
      { type: "trend",  x: 0, y: 0, w: 12, h: 7, config: { label: "Trend", duration: 300 } },
      { type: "button", x: 0, y: 7, w: 3,  h: 2, config: { label: "← Back", action: "navigate" } },
    ],
  },
  {
    id: "alarms",
    name: "Alarms",
    description: "Alarm banner + history",
    widgets: [
      { type: "alarmBanner", x: 0, y: 0, w: 12, h: 4, config: { label: "Active Alarms", maxRows: 8 } },
      { type: "historyLog",  x: 0, y: 4, w: 12, h: 5, config: { label: "Write History" } },
    ],
  },
];

function TemplateModal({ onClose, onSelect }: { onClose: () => void; onSelect: (t: Template) => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 w-[420px] shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm">New Page — Choose Template</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none">×</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {PAGE_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => { onSelect(t); onClose(); }}
              className="text-left p-3 rounded-lg border border-zinc-700 hover:border-blue-500 hover:bg-zinc-800 transition-colors space-y-1"
            >
              <div className="text-sm font-medium text-zinc-100">{t.name}</div>
              <div className="text-[11px] text-zinc-500">{t.description}</div>
              <div className="text-[10px] text-zinc-600">{t.widgets.length} widget{t.widgets.length !== 1 ? "s" : ""}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Page Settings ─────────────────────────────────────────────────────────────

function PageSettings() {
  const { project, activePageId, setActivePage, addPage, removePage, renamePage, addWidget } = useProject();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);

  const startRename = (id: string, name: string) => { setEditingId(id); setDraft(name); };
  const commitRename = () => { if (editingId && draft.trim()) renamePage(editingId, draft.trim()); setEditingId(null); };

  const applyTemplate = (t: Template) => {
    addPage(t.name === "Blank" ? undefined : t.name);
    // addPage switches activePageId; get it after the tick
    setTimeout(() => {
      const { activePageId: newId } = useProject.getState();
      t.widgets.forEach((w) => addWidget(newId, { ...w, id: newWidgetId() }));
    }, 0);
  };

  return (
    <div className="p-3 space-y-3">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">Pages</div>
      <div className="space-y-1">
        {project.pages.map((p) => (
          <div
            key={p.id}
            onClick={() => setActivePage(p.id)}
            className={`group flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer ${
              activePageId === p.id ? "bg-zinc-700 text-zinc-100" : "hover:bg-zinc-800 text-zinc-400"
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${activePageId === p.id ? "bg-blue-400" : "bg-zinc-600"}`} />
            {editingId === p.id ? (
              <input
                autoFocus value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setEditingId(null); e.stopPropagation(); }}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 bg-zinc-600 rounded px-1 text-xs outline-none text-zinc-100"
              />
            ) : (
              <span className="flex-1 text-xs truncate" onDoubleClick={(e) => { e.stopPropagation(); startRename(p.id, p.name); }}>
                {p.name}
              </span>
            )}
            {project.pages.length > 1 && (
              <button onClick={(e) => { e.stopPropagation(); removePage(p.id); }} className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 text-xs shrink-0">×</button>
            )}
          </div>
        ))}
      </div>
      <button
        onClick={() => setShowTemplates(true)}
        className="w-full text-xs py-1.5 rounded border border-dashed border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 transition-colors"
      >
        + Add Page
      </button>
      <div className="text-[10px] text-zinc-600">Double-click a page name to rename.</div>
      {showTemplates && <TemplateModal onClose={() => setShowTemplates(false)} onSelect={applyTemplate} />}
    </div>
  );
}

// ── Add Datasource Modal (moved from Header) ──────────────────────────────────

const TYPE_DEFAULTS: Record<DatasourceType, { id: string; label: string }> = {
  opcua:   { id: "opcua",  label: "OPC UA" },
  mbtcp:   { id: "mb",     label: "Modbus TCP" },
  mqtt:    { id: "mqtt",   label: "MQTT" },
  rest:    { id: "rest",   label: "PLCnext REST" },
  virtual: { id: "calc",   label: "Computed Tags" },
};

export function AddDatasourceModal({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (ds: { id: string; type: DatasourceType; label: string; config: Record<string, unknown> }) => void;
}) {
  const [type, setType] = useState<DatasourceType>("rest");
  const [id, setId] = useState(TYPE_DEFAULTS.rest.id);
  const [label, setLabel] = useState(TYPE_DEFAULTS.rest.label);
  const [ip, setIp] = useState("10.0.0.210");
  const [opcuaPort, setOpcuaPort]           = useState(4840);
  const [securityMode, setSecurityMode]     = useState("None");
  const [securityPolicy, setSecurityPolicy] = useState("None");
  const [mbPort, setMbPort]                 = useState(502);
  const [slaveId, setSlaveId]               = useState(1);
  const [mqttPort, setMqttPort]             = useState(1883);
  const [basePath, setBasePath]             = useState("/_pxc_api/v1.14");
  const [bearerToken, setBearerToken]       = useState("");
  const [virtualRows, setVirtualRows]       = useState<{ path: string; formula: string }[]>([
    { path: "tagA", formula: "{rest:tagPath} * 1.0" },
  ]);
  const [testing, setTesting]  = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const changeType = (t: DatasourceType) => { setType(t); setId(TYPE_DEFAULTS[t].id); setLabel(TYPE_DEFAULTS[t].label); setTestResult(null); };

  const buildPayload = () => {
    const config: Record<string, unknown> = {};
    if (type === "opcua") {
      config.endpoint = `opc.tcp://${ip}:${opcuaPort}`;
      config.securityMode = securityMode;
      config.securityPolicy = securityPolicy;
    } else if (type === "mbtcp") {
      config.host = ip; config.port = mbPort || 502; config.slaveId = slaveId || 1;
    } else if (type === "mqtt") {
      config.host = ip; config.port = mqttPort || 1883;
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
    setTesting(true); setTestResult(null);
    const { type: dsType, config } = buildPayload();
    try {
      const r = await fetch("/api/v1/datasources/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: "test", type: dsType, label: "test", config }) });
      const data = (await r.json()) as { connected: boolean; lastError?: string; tagCount?: number };
      setTestResult(data.connected ? { ok: true, msg: `Connected${data.tagCount ? ` · ${data.tagCount} tags` : ""}` } : { ok: false, msg: data.lastError ?? "Connection failed" });
    } catch (e) { setTestResult({ ok: false, msg: (e as Error).message }); }
    finally { setTesting(false); }
  };

  const inpCls = "mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs font-mono";
  const lblCls = "block text-[11px] text-zinc-400";

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 w-[420px] space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="text-sm font-semibold">Add Datasource</div>

        <label className={lblCls}>Type
          <select value={type} onChange={(e) => changeType(e.target.value as DatasourceType)} className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs">
            <option value="opcua">OPC UA</option>
            <option value="mbtcp">Modbus TCP</option>
            <option value="mqtt">MQTT</option>
            <option value="rest">REST (PLCnext pxc_api)</option>
            <option value="virtual">Virtual (computed expressions)</option>
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] text-zinc-400">ID<input value={id} onChange={(e) => setId(e.target.value)} className={inpCls} /></label>
          <label className="text-[11px] text-zinc-400">Label<input value={label} onChange={(e) => setLabel(e.target.value)} className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs" /></label>
        </div>

        {type !== "virtual" && (
          <label className={lblCls}>IP Address<input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="10.0.0.210" className={inpCls} /></label>
        )}

        {type === "opcua" && (<>
          <label className={lblCls}>Port<input type="number" value={opcuaPort} onChange={(e) => setOpcuaPort(Number(e.target.value))} className="mt-1 w-28 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs block" /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] text-zinc-400">Security mode
              <select value={securityMode} onChange={(e) => setSecurityMode(e.target.value)} className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs">
                <option value="None">None</option><option value="Sign">Sign</option><option value="SignAndEncrypt">Sign &amp; Encrypt</option>
              </select>
            </label>
            <label className="text-[11px] text-zinc-400">Security policy
              <select value={securityPolicy} onChange={(e) => setSecurityPolicy(e.target.value)} className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs">
                <option value="None">None</option><option value="Basic128Rsa15">Basic128Rsa15</option><option value="Basic256">Basic256</option><option value="Basic256Sha256">Basic256Sha256</option>
              </select>
            </label>
          </div>
        </>)}

        {type === "mbtcp" && (
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] text-zinc-400">Port<input type="number" value={mbPort} onChange={(e) => setMbPort(Number(e.target.value))} className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs" /></label>
            <label className="text-[11px] text-zinc-400">Slave ID<input type="number" value={slaveId} onChange={(e) => setSlaveId(Number(e.target.value))} className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs" /></label>
          </div>
        )}

        {type === "mqtt" && <label className={lblCls}>Port<input type="number" value={mqttPort} onChange={(e) => setMqttPort(Number(e.target.value))} className="mt-1 w-28 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs block" /></label>}

        {type === "rest" && (<>
          <label className={lblCls}>Base path<input value={basePath} onChange={(e) => setBasePath(e.target.value)} className={inpCls} /></label>
          <label className={lblCls}>Bearer token <span className="text-zinc-600">(optional)</span><input value={bearerToken} onChange={(e) => setBearerToken(e.target.value)} placeholder="leave blank if not required" className={inpCls} /></label>
        </>)}

        {type === "virtual" && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-zinc-300">Computed Tags</span>
              <button onClick={() => setVirtualRows((r) => [...r, { path: "", formula: "" }])} className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700">+ add tag</button>
            </div>
            <div className="space-y-1.5 max-h-44 overflow-y-auto">
              {virtualRows.map((row, i) => (
                <div key={i} className="flex gap-1.5 items-center">
                  <input value={row.path} onChange={(e) => setVirtualRows((rows) => rows.map((r, j) => j === i ? { ...r, path: e.target.value } : r))} placeholder="tagName" className="w-24 shrink-0 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[11px] font-mono" />
                  <span className="text-zinc-600 text-[10px] shrink-0">=</span>
                  <input value={row.formula} onChange={(e) => setVirtualRows((rows) => rows.map((r, j) => j === i ? { ...r, formula: e.target.value } : r))} placeholder="{ds:path} * 9/5 + 32" className="flex-1 min-w-0 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[11px] font-mono" />
                  <button onClick={() => setVirtualRows((rows) => rows.filter((_, j) => j !== i))} className="text-zinc-600 hover:text-red-400 text-xs px-1">×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-[10px] text-zinc-600 font-mono truncate">
          {type === "opcua"   && `opc.tcp://${ip}:${opcuaPort}`}
          {type === "mbtcp"   && `${ip}:${mbPort}  slave=${slaveId}`}
          {type === "mqtt"    && `${ip}:${mqttPort}`}
          {type === "rest"    && `https://${ip}${basePath}`}
          {type === "virtual" && `${virtualRows.filter((r) => r.path.trim()).length} computed tag(s)`}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button onClick={testConn} disabled={testing} className="text-xs px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50">{testing ? "Testing…" : "Test"}</button>
          {testResult && <span className={`text-[11px] flex-1 truncate ${testResult.ok ? "text-emerald-400" : "text-red-400"}`}>{testResult.ok ? "✓ " : "✗ "}{testResult.msg}</span>}
          <div className="flex-1" />
          <button onClick={onClose} className="text-xs px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700">Cancel</button>
          <button onClick={() => { const { id: dsId, type: dsType, label: dsLabel, config } = buildPayload(); onAdd({ id: dsId, type: dsType, label: dsLabel, config }); }} className="text-xs px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 font-medium">Add</button>
        </div>
      </div>
    </div>
  );
}
