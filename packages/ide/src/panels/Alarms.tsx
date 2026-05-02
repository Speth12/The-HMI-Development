// Alarms panel: rule editor (top) + live alarm events (bottom).
import { useEffect, useRef, useState } from "react";
import { useProject, type AlarmCondition, type AlarmRule, type AlarmSeverity } from "../store/projectStore";
import { apiBase } from "../store/runtimeTarget";

// ── Types ──────────────────────────────────────────────────────────────────

type AlarmEvent = {
  id: string;
  ruleId: string;
  ruleName: string;
  binding: string;
  severity: AlarmSeverity;
  message: string;
  value: number;
  active: boolean;
  acked: boolean;
  triggeredAt: string;
  ackedAt?: string;
  normalAt?: string;
};

const uid = () => `alarm-${Math.random().toString(36).slice(2, 8)}`;

const CONDITIONS: { value: AlarmCondition; label: string }[] = [
  { value: "gt",  label: "> greater than" },
  { value: "gte", label: "≥ at least" },
  { value: "lt",  label: "< less than" },
  { value: "lte", label: "≤ at most" },
  { value: "eq",  label: "= equal to" },
  { value: "ne",  label: "≠ not equal to" },
];

const SEVERITIES: AlarmSeverity[] = ["critical", "warning", "info"];

const severityColor: Record<AlarmSeverity, string> = {
  critical: "text-red-400",
  warning:  "text-amber-400",
  info:     "text-blue-400",
};

const severityBg: Record<AlarmSeverity, string> = {
  critical: "bg-red-950/40 border-red-800",
  warning:  "bg-amber-950/40 border-amber-800",
  info:     "bg-blue-950/40 border-blue-800",
};

// ── Rule Editor ────────────────────────────────────────────────────────────

function RuleForm({ initial, onSave, onCancel }: {
  initial?: Partial<AlarmRule>;
  onSave: (r: AlarmRule) => void;
  onCancel: () => void;
}) {
  const { project } = useProject();
  const [name, setName]           = useState(initial?.name ?? "");
  const [binding, setBinding]     = useState(initial?.binding ?? "");
  const [condition, setCondition] = useState<AlarmCondition>(initial?.condition ?? "gt");
  const [threshold, setThreshold] = useState(String(initial?.threshold ?? "0"));
  const [severity, setSeverity]   = useState<AlarmSeverity>(initial?.severity ?? "warning");
  const [message, setMessage]     = useState(initial?.message ?? "");

  const save = () => {
    const t = parseFloat(threshold);
    if (!name || !binding || isNaN(t)) return;
    onSave({ id: initial?.id ?? uid(), name, binding, condition, threshold: t, severity, message });
  };

  const inputCls = "w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-zinc-500";

  return (
    <div className="border border-zinc-700 rounded-lg p-3 space-y-2 bg-zinc-900/60">
      <div className="text-[11px] font-semibold text-zinc-300">{initial?.id ? "Edit rule" : "New alarm rule"}</div>

      <label className="block text-[10px] text-zinc-500">Name
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="High pressure" className={`mt-0.5 ${inputCls}`} />
      </label>

      <label className="block text-[10px] text-zinc-500">Tag binding
        <select
          value={binding}
          onChange={(e) => setBinding(e.target.value)}
          className={`mt-0.5 ${inputCls}`}
        >
          <option value="">— pick a tag —</option>
          {project.pages.flatMap((p) =>
            p.widgets.filter((w) => w.binding).map((w) => (
              <option key={w.id} value={w.binding!}>{w.binding}</option>
            ))
          )}
          {/* Also allow manual entry */}
          {binding && !project.pages.some((p) => p.widgets.some((w) => w.binding === binding)) && (
            <option value={binding}>{binding}</option>
          )}
        </select>
        <input
          value={binding}
          onChange={(e) => setBinding(e.target.value)}
          placeholder="ds:tagPath"
          className={`mt-1 ${inputCls} font-mono text-[10px]`}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[10px] text-zinc-500">Condition
          <select value={condition} onChange={(e) => setCondition(e.target.value as AlarmCondition)} className={`mt-0.5 ${inputCls}`}>
            {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
        <label className="block text-[10px] text-zinc-500">Threshold
          <input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} className={`mt-0.5 ${inputCls} font-mono`} />
        </label>
      </div>

      <label className="block text-[10px] text-zinc-500">Severity
        <div className="flex gap-2 mt-1">
          {SEVERITIES.map((s) => (
            <button
              key={s}
              onClick={() => setSeverity(s)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                severity === s
                  ? s === "critical" ? "bg-red-700 border-red-600 text-white"
                  : s === "warning"  ? "bg-amber-700 border-amber-600 text-white"
                  : "bg-blue-700 border-blue-600 text-white"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </label>

      <label className="block text-[10px] text-zinc-500">Message
        <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Pressure exceeded limit" className={`mt-0.5 ${inputCls}`} />
      </label>

      <div className="flex gap-2 pt-1">
        <button onClick={save} className="text-xs px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 font-medium">Save</button>
        <button onClick={onCancel} className="text-xs px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600">Cancel</button>
      </div>
    </div>
  );
}

// ── Alarms Panel ───────────────────────────────────────────────────────────

export function Alarms() {
  const { project, addAlarmRule, updateAlarmRule, removeAlarmRule } = useProject();
  const rules = project.alarmRules ?? [];

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState<string | null>(null);
  const [events, setEvents]     = useState<AlarmEvent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  // ── Live alarm WebSocket ────────────────────────────────────────────────
  useEffect(() => {
    const wsBase = apiBase
      ? apiBase.replace(/^http/, "ws")
      : (location.protocol === "https:" ? "wss://" : "ws://") + location.host;
    const ws = new WebSocket(`${wsBase}/ws/alarms`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const ev: AlarmEvent = JSON.parse(e.data);
        setEvents((prev) => {
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

    ws.onerror = () => { /* silently ignore if runtime not running */ };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, []);

  const ack = async (eventId: string) => {
    try {
      await fetch(`${apiBase}/api/v1/alarms/${encodeURIComponent(eventId)}/ack`, { method: "POST" });
    } catch { /* ignore */ }
  };

  const editingRule = editId ? rules.find((r) => r.id === editId) : undefined;
  const activeCount = events.filter((e) => e.active && !e.acked).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Alarms</span>
          {activeCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-700 text-white font-semibold">{activeCount}</span>
          )}
        </div>
        <button
          onClick={() => { setEditId(null); setShowForm(true); }}
          className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700"
        >
          + rule
        </button>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-4">
        {/* New / Edit Form */}
        {showForm && !editId && (
          <RuleForm
            onSave={(r) => { addAlarmRule(r); setShowForm(false); }}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* Rule List */}
        {rules.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Rules ({rules.length})</div>
            {rules.map((r) =>
              editId === r.id ? (
                <RuleForm
                  key={r.id}
                  initial={r}
                  onSave={(updated) => { updateAlarmRule(r.id, updated); setEditId(null); }}
                  onCancel={() => setEditId(null)}
                />
              ) : (
                <div key={r.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-zinc-800/50 group">
                  <span className={`text-[10px] font-semibold w-14 shrink-0 ${severityColor[r.severity]}`}>{r.severity}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium truncate">{r.name}</div>
                    <div className="text-[10px] text-zinc-500 font-mono truncate">{r.binding} {r.condition} {r.threshold}</div>
                  </div>
                  <button onClick={() => setEditId(r.id)} className="text-[10px] text-zinc-600 hover:text-zinc-300 opacity-0 group-hover:opacity-100">edit</button>
                  <button onClick={() => removeAlarmRule(r.id)} className="text-[10px] text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100">×</button>
                </div>
              )
            )}
          </div>
        )}

        {rules.length === 0 && !showForm && (
          <div className="text-xs text-zinc-600 italic text-center pt-4">
            No alarm rules.<br />Click <span className="font-semibold">+ rule</span> to create one.
          </div>
        )}

        {/* Live Events */}
        {events.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">Active events ({events.filter((e) => e.active).length})</div>
            {[...events]
              .sort((a, b) => {
                // active unacked first, then by time desc
                const aUrgent = a.active && !a.acked ? 0 : 1;
                const bUrgent = b.active && !b.acked ? 0 : 1;
                if (aUrgent !== bUrgent) return aUrgent - bUrgent;
                return new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime();
              })
              .map((ev) => (
                <div key={ev.id} className={`rounded border px-2 py-1.5 ${ev.active && !ev.acked ? severityBg[ev.severity] : "bg-zinc-900/40 border-zinc-800"}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold ${ev.active ? severityColor[ev.severity] : "text-zinc-600"}`}>
                      {ev.active ? "●" : "○"} {ev.severity.toUpperCase()}
                    </span>
                    <span className="text-[11px] font-medium flex-1 truncate">{ev.ruleName}</span>
                    {ev.active && !ev.acked && (
                      <button
                        onClick={() => ack(ev.id)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 hover:bg-zinc-600 shrink-0"
                      >
                        ACK
                      </button>
                    )}
                    {ev.acked && <span className="text-[10px] text-zinc-600">acked</span>}
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">{ev.message || ev.binding}</div>
                  <div className="text-[10px] text-zinc-600 font-mono">
                    value={ev.value.toFixed(2)} · {new Date(ev.triggeredAt).toLocaleTimeString()}
                    {ev.normalAt && ` · normal @${new Date(ev.normalAt).toLocaleTimeString()}`}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Compact alarm banner for the top-bar ───────────────────────────────────

export function AlarmBadge() {
  const [activeCount, setActiveCount] = useState(0);
  const [worstSeverity, setWorstSeverity] = useState<AlarmSeverity | null>(null);

  useEffect(() => {
    // Poll REST endpoint every 5 s as a lightweight fallback (WS is primary via Alarms panel).
    const poll = async () => {
      try {
        const r = await fetch(`${apiBase}/api/v1/alarms`);
        if (!r.ok) return;
        const events: AlarmEvent[] = await r.json();
        const active = events.filter((e) => e.active && !e.acked);
        setActiveCount(active.length);
        if (active.some((e) => e.severity === "critical")) setWorstSeverity("critical");
        else if (active.some((e) => e.severity === "warning")) setWorstSeverity("warning");
        else if (active.length > 0) setWorstSeverity("info");
        else setWorstSeverity(null);
      } catch { /* runtime not running */ }
    };
    void poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  if (activeCount === 0) return null;

  return (
    <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
      worstSeverity === "critical" ? "bg-red-700 text-white animate-pulse"
      : worstSeverity === "warning" ? "bg-amber-700 text-white"
      : "bg-blue-700 text-white"
    }`}>
      ⚠ {activeCount} alarm{activeCount !== 1 ? "s" : ""}
    </div>
  );
}
