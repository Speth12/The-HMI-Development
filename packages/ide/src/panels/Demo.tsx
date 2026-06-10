import { useEffect, useRef, useState, useCallback } from "react";
import { apiBase } from "../store/runtimeTarget";

// ── Types ──────────────────────────────────────────────────────────────────

type FeatureMeta = {
  id: string;
  title: string;
  badge: "backend" | "frontend" | "full-stack";
  tagline: string;
  accentColor: string;
};

const FEATURES: FeatureMeta[] = [
  { id: "namespace",  title: "Unified Namespace",     badge: "backend",    tagline: "One address space for all protocols",    accentColor: "#3b82f6" },
  { id: "tagbrowser", title: "Tag Browser",           badge: "frontend",   tagline: "Browse by source or UNS tree",          accentColor: "#8b5cf6" },
  { id: "expr",       title: "Expression Engine",     badge: "backend",    tagline: "Virtual tags with formula dependencies", accentColor: "#f59e0b" },
  { id: "eventbus",   title: "Event Bus",             badge: "backend",    tagline: "Typed pub/sub across the runtime",       accentColor: "#06b6d4" },
  { id: "security",   title: "Security & Auth",       badge: "full-stack", tagline: "JWT · Roles · Permission middleware",    accentColor: "#ef4444" },
  { id: "historian",  title: "Historian Providers",   badge: "backend",    tagline: "SQLite + in-memory backends",           accentColor: "#10b981" },
  { id: "assets",     title: "Asset Model",           badge: "backend",    tagline: "Template inheritance + instances",      accentColor: "#f97316" },
  { id: "faceplate",  title: "Faceplate Framework",  badge: "full-stack", tagline: "Per-asset pop-up views with bindings",  accentColor: "#a78bfa" },
  { id: "recipe",     title: "Recipe Engine",         badge: "full-stack", tagline: "Versioned apply + approval workflow",   accentColor: "#22d3ee" },
  { id: "wiring",     title: "Runtime Wiring",        badge: "backend",    tagline: "All stores unified in one Runtime",     accentColor: "#84cc16" },
  { id: "api",        title: "REST API",              badge: "full-stack", tagline: "JWT-protected routes for everything",   accentColor: "#e879f9" },
];

// ── Small shared components ─────────────────────────────────────────────────

function Badge({ type }: { type: FeatureMeta["badge"] }) {
  const map = {
    "backend":    "bg-blue-950 text-blue-400 border-blue-800",
    "frontend":   "bg-purple-950 text-purple-400 border-purple-800",
    "full-stack": "bg-zinc-800 text-zinc-300 border-zinc-700",
  };
  return (
    <span className={`text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border font-medium ${map[type]}`}>
      {type}
    </span>
  );
}

function Pill({ label, color = "#3b82f6" }: { label: string; color?: string }) {
  return (
    <span className="inline-block text-[10px] font-mono px-2 py-0.5 rounded-full border mr-1 mb-1"
      style={{ borderColor: color + "55", color, background: color + "15" }}>
      {label}
    </span>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-2 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-[11px] font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
      {children}
    </pre>
  );
}

function LiveBox({ label, data, error, loading }: { label: string; data?: unknown; error?: string; loading?: boolean }) {
  return (
    <div className="mt-3 rounded-lg border border-zinc-800 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
        <span className="text-[10px] text-zinc-500 font-mono">{label}</span>
        {loading && <span className="text-[10px] text-zinc-600 animate-pulse">loading…</span>}
      </div>
      <div className="p-3 bg-zinc-950 text-[11px] font-mono text-zinc-300 max-h-40 overflow-auto">
        {error   ? <span className="text-zinc-600 italic">{error}</span> :
         loading  ? <span className="text-zinc-700">…</span> :
         data != null ? JSON.stringify(data, null, 2) : <span className="text-zinc-700">—</span>}
      </div>
    </div>
  );
}

function SectionCard({ feature, children }: { feature: FeatureMeta; children: React.ReactNode }) {
  return (
    <div id={`demo-${feature.id}`} className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden mb-6">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800"
        style={{ background: feature.accentColor + "0d", borderLeftWidth: 4, borderLeftColor: feature.accentColor }}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-sm text-zinc-100">{feature.title}</span>
            <Badge type={feature.badge} />
          </div>
          <div className="text-[11px] text-zinc-400">{feature.tagline}</div>
        </div>
      </div>
      <div className="px-5 py-4 space-y-3">{children}</div>
    </div>
  );
}

function Explain({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] text-zinc-300 leading-relaxed">{children}</p>;
}

// ── Live API hooks ──────────────────────────────────────────────────────────

function useFetch<T>(url: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true); setError(undefined);
    fetch(url)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError("runtime not connected — start with `go run ./cmd/x-hmi`"); setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading };
}

// ── Feature sections ───────────────────────────────────────────────────────

function NamespaceSection({ feature }: { feature: FeatureMeta }) {
  const { data, error, loading } = useFetch<unknown[]>(`${apiBase}/api/v1/namespace/tree?path=`);
  return (
    <SectionCard feature={feature}>
      <Explain>
        Every tag from every protocol is published into a single hierarchical address space using
        dot-separated paths. Drivers, virtual tags, and assets all live side-by-side, so operators
        see one consistent tree regardless of whether the source is OPC UA, Modbus, MQTT, or REST.
      </Explain>
      <div className="flex flex-wrap mt-1">
        {["Plant.Line1.PumpA.RunStatus","Plant.Line1.PumpA.FlowRate","Plant.Tank101.Level","calc.TempF"].map(p =>
          <Pill key={p} label={p} color={feature.accentColor} />
        )}
      </div>
      <Code>{`// Publish a driver tag into the UNS
r.Namespace.PublishDriverTag(
  "Plant.Line1.PumpA.RunStatus",   // NS path
  "opc1",                          // driver ID
  "ns=2;s=Pump1.Run",             // driver address
  "bool",
)`}</Code>
      <LiveBox
        label="GET /api/v1/namespace/tree?path= (root children)"
        data={data}
        error={error}
        loading={loading}
      />
    </SectionCard>
  );
}

function TagBrowserSection({ feature }: { feature: FeatureMeta }) {
  return (
    <SectionCard feature={feature}>
      <Explain>
        The Tag Browser panel now has two tabs. <strong className="text-zinc-200">By Source</strong> browses
        each datasource's raw protocol-native tags (OPC UA address space, Modbus register map, etc.) with
        live values from the WebSocket. <strong className="text-zinc-200">Namespace</strong> shows the UNS
        tree with lazy-loaded children, debounced search, live values, and drag-to-bind support.
      </Explain>
      <div className="grid grid-cols-2 gap-3 mt-2">
        {[
          { title: "By Source", desc: "Protocol-native browse. Shows connected/error status per driver. Click or drag any tag to bind it to the selected widget.", icon: "⊞" },
          { title: "Namespace", desc: "UNS tree view. Lazy loads children on expand. Search across all sources simultaneously. Node icons indicate type: folder ▸ asset ◈ tag ◎ virtual ⊕", icon: "⊟" },
        ].map(m => (
          <div key={m.title} className="rounded-lg border border-zinc-700 p-3 bg-zinc-800/50">
            <div className="text-sm font-medium text-zinc-200 mb-1">{m.icon} {m.title}</div>
            <div className="text-[11px] text-zinc-400 leading-relaxed">{m.desc}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 text-[11px] text-zinc-500 bg-zinc-950 rounded-lg border border-zinc-800 px-3 py-2">
        💡 <strong className="text-zinc-400">Drag-to-bind:</strong> Drag any tag from either tab and drop it
        directly onto a widget on the canvas to set its binding.
      </div>
    </SectionCard>
  );
}

function ExprSection({ feature }: { feature: FeatureMeta }) {
  const [expr, setExpr] = useState("Average(10, 20, 30) * 1.8 + 32");
  const [result, setResult] = useState<string | null>(null);

  // Client-side eval demo using the same built-ins as the Go engine
  const evaluate = useCallback(() => {
    try {
      const builtins: Record<string, (...a: number[]) => number> = {
        Average: (...a) => a.reduce((s, v) => s + v, 0) / a.length,
        Avg:     (...a) => a.reduce((s, v) => s + v, 0) / a.length,
        Min:     (...a) => Math.min(...a),
        Max:     (...a) => Math.max(...a),
        Sum:     (...a) => a.reduce((s, v) => s + v, 0),
        Abs:     (v) => Math.abs(v),
        Round:   (v) => Math.round(v),
        Sqrt:    (v) => Math.sqrt(v),
        Clamp:   (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
        If:      (c, t, f) => c ? t : f,
      };
      let replaced = expr.replace(/\{[^}]+\}/g, "42"); // replace tag refs with demo value
      // Replace builtin names with JS calls
      const fn = new Function(...Object.keys(builtins), `return (${replaced})`);
      const r = fn(...Object.values(builtins));
      setResult(String(Math.round(r * 1000) / 1000));
    } catch { setResult("parse error"); }
  }, [expr]);

  useEffect(() => { evaluate(); }, [evaluate]);

  return (
    <SectionCard feature={feature}>
      <Explain>
        The recursive-descent expression engine powers virtual tags. It supports arithmetic, comparison,
        logical operators, and built-in functions. Dependency tracking uses a dry-run evaluation — the
        engine records which tag paths are accessed, then re-evaluates whenever any dependency changes.
        Circular dependencies are detected via DFS before registration.
      </Explain>
      <div className="flex flex-wrap mt-1">
        {["Average","Min","Max","Sum","If","Clamp","Abs","Round","Sqrt"].map(f =>
          <Pill key={f} label={f + "(…)"} color={feature.accentColor} />
        )}
      </div>
      <div className="mt-2 flex gap-2 items-center">
        <input
          value={expr}
          onChange={e => { setExpr(e.target.value); }}
          onKeyUp={evaluate}
          className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-[12px] font-mono text-zinc-200 focus:outline-none focus:border-blue-600"
          placeholder="Enter expression…"
        />
        <span className="text-xs text-zinc-500">=</span>
        <span className="text-sm font-mono font-semibold text-emerald-400 min-w-[60px]">{result ?? "…"}</span>
      </div>
      <p className="text-[11px] text-zinc-600 mt-1">
        Tag references like <code className="text-zinc-400">{"{opc1:Pump.Speed}"}</code> are replaced with 42 in this demo.
      </p>
      <Code>{`// Register a virtual tag
manager.Register("Plant.TempF",
  "Average({opc1:T1}, {opc1:T2}) * 1.8 + 32",
)
// → re-evaluates whenever opc1:T1 or opc1:T2 change`}</Code>
    </SectionCard>
  );
}

function EventBusSection({ feature }: { feature: FeatureMeta }) {
  const events = [
    { type: "tag.changed",    desc: "Fires on every tag value update from any driver",       color: "#3b82f6" },
    { type: "alarm.raised",   desc: "Fired when an alarm rule transitions to active",         color: "#ef4444" },
    { type: "alarm.cleared",  desc: "Fired when an alarm returns to normal",                  color: "#10b981" },
    { type: "alarm.acked",    desc: "Fired when an operator acknowledges an alarm",           color: "#f59e0b" },
    { type: "recipe.applied", desc: "Fired after a recipe is successfully applied",           color: "#8b5cf6" },
    { type: "user.login",     desc: "Fired on successful JWT login",                          color: "#06b6d4" },
    { type: "project.loaded", desc: "Fired when a project is deployed to the runtime",       color: "#84cc16" },
  ];
  return (
    <SectionCard feature={feature}>
      <Explain>
        An in-process typed pub/sub bus decouples the runtime subsystems. Any component can publish or
        subscribe without a direct reference to the other. Subscriptions return a <code className="text-zinc-300 text-[11px]">cancel()</code> function
        and a channel — unsubscribing is safe to call multiple times.
      </Explain>
      <div className="mt-2 space-y-1.5">
        {events.map(e => (
          <div key={e.type} className="flex items-start gap-3 rounded-lg px-3 py-2 bg-zinc-800/50 border border-zinc-700/50">
            <span className="font-mono text-[11px] shrink-0 mt-0.5" style={{ color: e.color }}>{e.type}</span>
            <span className="text-[11px] text-zinc-400">{e.desc}</span>
          </div>
        ))}
      </div>
      <Code>{`// Subscribe to all tag changes
ch, cancel := rt.Events.Subscribe(eventbus.EventTagChanged)
defer cancel()
for ev := range ch {
    fmt.Println(ev.Payload)
}`}</Code>
    </SectionCard>
  );
}

function SecuritySection({ feature }: { feature: FeatureMeta }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [loginResult, setLoginResult] = useState<Record<string, unknown> | null>(null);
  const [loginError, setLoginError] = useState("");
  const [busy, setBusy] = useState(false);

  const whoami = useFetch(`${apiBase}/api/v1/whoami`);

  const doLogin = async () => {
    setBusy(true); setLoginResult(null); setLoginError("");
    try {
      const r = await fetch(`${apiBase}/api/v1/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const d = await r.json();
      if (r.ok) setLoginResult(d); else setLoginError(d.error ?? "failed");
    } catch { setLoginError("runtime not connected"); }
    setBusy(false);
  };

  const roles = [
    { role: "Operator",   perms: ["tag.read", "alarm.ack"] },
    { role: "Supervisor", perms: ["tag.read", "tag.write", "alarm.ack", "recipe.apply"] },
    { role: "Engineer",   perms: ["…Supervisor", "project.deploy"] },
    { role: "Admin",      perms: ["…Engineer", "users.manage"] },
  ];

  return (
    <SectionCard feature={feature}>
      <Explain>
        Every <code className="text-zinc-300 text-[11px]">/api/v1</code> route is guarded by JWT middleware.
        Tokens are HS256 signed, 8-hour expiry. Passwords are bcrypt-hashed in SQLite. Role-based
        permissions are checked per-endpoint — if the runtime has no <code className="text-zinc-300 text-[11px]">--security-db</code>, all
        requests pass as anonymous/admin (dev mode).
      </Explain>

      {/* Role table */}
      <div className="mt-2 rounded-lg border border-zinc-800 overflow-hidden">
        <table className="w-full text-[11px]">
          <thead><tr className="bg-zinc-900 border-b border-zinc-800">
            <th className="text-left px-3 py-1.5 text-zinc-500 font-medium">Role</th>
            <th className="text-left px-3 py-1.5 text-zinc-500 font-medium">Permissions</th>
          </tr></thead>
          <tbody>
            {roles.map(r => (
              <tr key={r.role} className="border-b border-zinc-800/50 last:border-0">
                <td className="px-3 py-2 font-mono font-medium text-zinc-200">{r.role}</td>
                <td className="px-3 py-2 text-zinc-400">{r.perms.join(" · ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Login tester */}
      <div className="mt-3 rounded-lg border border-zinc-700 p-3 bg-zinc-800/40">
        <div className="text-[11px] text-zinc-400 mb-2 font-medium">Try login → POST /api/v1/auth/login</div>
        <div className="flex gap-2">
          <input value={username} onChange={e => setUsername(e.target.value)}
            className="w-28 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
            placeholder="username" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            className="w-28 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
            placeholder="password" />
          <button onClick={doLogin} disabled={busy}
            className="text-xs px-3 py-1 rounded bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white">
            {busy ? "…" : "Login"}
          </button>
        </div>
        {loginError && <div className="text-[11px] text-red-400 mt-1.5">{loginError}</div>}
        {loginResult && (
          <pre className="mt-2 text-[10px] font-mono text-emerald-400 whitespace-pre-wrap">{JSON.stringify(loginResult, null, 2)}</pre>
        )}
      </div>

      <LiveBox label="GET /api/v1/whoami (current identity)" data={whoami.data} error={whoami.error} loading={whoami.loading} />
    </SectionCard>
  );
}

function HistorianSection({ feature }: { feature: FeatureMeta }) {
  const to = Date.now() * 1_000_000; // ns
  const from = (Date.now() - 60_000) * 1_000_000;
  const { data, error, loading } = useFetch(
    `${apiBase}/api/v1/history?path=test.tag&from=${from}&to=${to}&limit=5`
  );

  const backends = [
    { name: "sqlite",  desc: "Persistent WAL journal. Supports aggregation, retention, multi-tag queries. Default production backend.", icon: "🗄" },
    { name: "memory",  desc: "In-process map. Zero dependencies, instant writes. Used in tests and embedded scenarios.", icon: "⚡" },
  ];

  return (
    <SectionCard feature={feature}>
      <Explain>
        The <code className="text-zinc-300 text-[11px]">historian.Provider</code> interface abstracts the storage
        backend. Both SQLite and in-memory backends register themselves via <code className="text-zinc-300 text-[11px]">init()</code> side-effects.
        The API supports raw samples, aggregated buckets (min/avg/max), multi-tag queries, and CSV export.
      </Explain>
      <div className="grid grid-cols-2 gap-3 mt-1">
        {backends.map(b => (
          <div key={b.name} className="rounded-lg border border-zinc-700 p-3 bg-zinc-800/50">
            <div className="flex items-center gap-2 mb-1">
              <span>{b.icon}</span>
              <code className="text-[12px] font-mono text-zinc-200">{b.name}</code>
            </div>
            <div className="text-[11px] text-zinc-400 leading-relaxed">{b.desc}</div>
          </div>
        ))}
      </div>
      <Code>{`// Query with 1-minute aggregation buckets
GET /api/v1/history
  ?path=Plant.Tank101.Level
  &from=1718000000000000000
  &to=1718003600000000000
  &bucket=1m
  &limit=60
// → [{ts, min, avg, max, count}, …]`}</Code>
      <LiveBox label="GET /api/v1/history?path=test.tag (last 60s, limit 5)" data={data} error={error} loading={loading} />
    </SectionCard>
  );
}

function AssetsSection({ feature }: { feature: FeatureMeta }) {
  const templates = useFetch(`${apiBase}/api/v1/assets/templates`);
  const instances = useFetch(`${apiBase}/api/v1/assets/instances`);

  const inheritance = [
    { id: "motor",     parent: null,      props: ["RunStatus", "Fault", "Current"] },
    { id: "vfd-motor", parent: "motor",   props: ["+ Speed", "+ Frequency"] },
    { id: "pump",      parent: null,      props: ["RunStatus", "Fault", "FlowRate"] },
    { id: "valve",     parent: null,      props: ["Position", "Fault"] },
    { id: "tank",      parent: null,      props: ["Level", "Volume", "Temperature"] },
  ];

  return (
    <SectionCard feature={feature}>
      <Explain>
        Assets model real physical objects. Every instance is created from a template. Templates
        support single inheritance — child properties override parent properties on name conflict.
        An instance with an <code className="text-zinc-300 text-[11px]">NSPath</code> and <code className="text-zinc-300 text-[11px]">TagMap</code> automatically
        resolves to fully-qualified namespace and driver addresses.
      </Explain>
      <div className="mt-2 space-y-1">
        {inheritance.map(t => (
          <div key={t.id} className="flex items-center gap-2 rounded px-3 py-1.5 bg-zinc-800/50 border border-zinc-700/40">
            {t.parent && <span className="text-zinc-600 text-[10px] shrink-0">↳</span>}
            {!t.parent && <span className="w-4 shrink-0" />}
            <code className="text-[11px] font-mono text-zinc-200 w-24 shrink-0">{t.id}</code>
            <span className="text-[11px] text-zinc-500">{t.props.join(" · ")}</span>
          </div>
        ))}
      </div>
      <Code>{`// Create an instance
POST /api/v1/assets/instances
{
  "id": "pump-a", "name": "Pump A",
  "templateId": "pump",
  "nsPath": "Plant.Line1.PumpA",
  "driverId": "opc1",
  "tagMap": { "RunStatus": "ns=2;s=Pump1.Run" }
}`}</Code>
      <LiveBox label="GET /api/v1/assets/templates" data={templates.data} error={templates.error} loading={templates.loading} />
      <LiveBox label="GET /api/v1/assets/instances" data={instances.data} error={instances.error} loading={instances.loading} />
    </SectionCard>
  );
}

function FaceplateSection({ feature }: { feature: FeatureMeta }) {
  return (
    <SectionCard feature={feature}>
      <Explain>
        Faceplates are reusable pop-up views tied to an asset template — overview, diagnostics, trend, alarms.
        When resolved for an instance, template variables are substituted using the instance's real paths.
        Views are inherited from parent templates, so a <code className="text-zinc-300 text-[11px]">vfd-motor</code> instance automatically
        gets the <code className="text-zinc-300 text-[11px]">motor</code> diagnostic view.
      </Explain>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {[
          { vt: "overview",    desc: "Status, key values, start/stop buttons" },
          { vt: "diagnostics", desc: "Fault codes, counters, health indicators" },
          { vt: "trend",       desc: "Historical chart for asset-specific tags" },
          { vt: "alarms",      desc: "Active and historical alarms for this asset" },
        ].map(v => (
          <div key={v.vt} className="rounded border border-zinc-700 px-3 py-2 bg-zinc-800/50">
            <div className="text-[11px] font-mono text-zinc-200">{v.vt}</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">{v.desc}</div>
          </div>
        ))}
      </div>
      <Code>{`// Substitution variables in widget JSON:
"{{.NSPath}}"          →  Plant.Line1.PumpA
"{{.Name}}"            →  Pump A
"{{.Tags.RunStatus}}"  →  Plant.Line1.PumpA.RunStatus
"{{.Bindings.Fault}}"  →  opc1:ns=2;s=Pump1.Fault

GET /api/v1/faceplates/pump-a          → all views
GET /api/v1/faceplates/pump-a/overview → single view`}</Code>
    </SectionCard>
  );
}

function RecipeSection({ feature }: { feature: FeatureMeta }) {
  const history = useFetch(`${apiBase}/api/v1/recipes/history?limit=5`);
  const pending = useFetch(`${apiBase}/api/v1/recipes/pending?status=pending`);

  const flow = [
    { actor: "Operator",   action: "POST /recipes/{id}/request",          color: "#06b6d4",  desc: "Submits a pending approval request" },
    { actor: "Supervisor", action: "GET  /recipes/pending",               color: "#f59e0b",  desc: "Reviews pending requests" },
    { actor: "Supervisor", action: "POST /recipes/pending/{id}/approve",  color: "#10b981",  desc: "Approves → executes immediately" },
    { actor: "—",          action: "POST /recipes/pending/{id}/reject",   color: "#ef4444",  desc: "Rejects with optional note" },
    { actor: "Engineer+",  action: "POST /recipes/{id}/apply",            color: "#8b5cf6",  desc: "Direct apply (skips approval)" },
  ];

  return (
    <SectionCard feature={feature}>
      <Explain>
        Recipes write multiple tag values in a single atomic operation. Every application is logged to
        an immutable SQLite run log with who applied it, when, and any errors. The approval workflow
        lets operators request a recipe application that a Supervisor or Engineer must explicitly
        approve before execution.
      </Explain>
      <div className="mt-2 space-y-1.5">
        {flow.map((s, i) => (
          <div key={i} className="flex items-center gap-3 rounded px-3 py-1.5 bg-zinc-800/50 border border-zinc-700/40">
            <span className="text-[10px] text-zinc-500 w-20 shrink-0">{s.actor}</span>
            <code className="text-[10px] font-mono shrink-0" style={{ color: s.color }}>{s.action}</code>
            <span className="text-[11px] text-zinc-400 truncate">{s.desc}</span>
          </div>
        ))}
      </div>
      <LiveBox label="GET /api/v1/recipes/history?limit=5" data={history.data} error={history.error} loading={history.loading} />
      <LiveBox label="GET /api/v1/recipes/pending?status=pending" data={pending.data} error={pending.error} loading={pending.loading} />
    </SectionCard>
  );
}

function WiringSection({ feature }: { feature: FeatureMeta }) {
  const alive = useFetch<{ ok: boolean }>(`${apiBase}/api/v1/alive`);
  const stores = [
    { name: "TagStore",          flag: "--",        desc: "Always active. In-memory tag state cache." },
    { name: "Historian",         flag: "--history",      desc: "SQLite WAL. Persistent time-series with retention." },
    { name: "AlarmStore",        flag: "--alarm-db",     desc: "SQLite. Immutable alarm event history." },
    { name: "VersionStore",      flag: "--version-db",   desc: "SQLite. Append-only project version log." },
    { name: "Security",          flag: "--security-db",  desc: "SQLite. Users, bcrypt hashes, JWT secret." },
    { name: "Audit",             flag: "--audit-db",     desc: "SQLite. Append-only audit trail." },
    { name: "RecipeStore",       flag: "--recipe-db",    desc: "SQLite. Run log + pending approvals." },
    { name: "Assets",            flag: "(always on)",    desc: "In-memory asset registry with builtins." },
    { name: "Faceplates",        flag: "(always on)",    desc: "In-memory faceplate registry." },
    { name: "Namespace",         flag: "(always on)",    desc: "In-memory UNS tree." },
    { name: "Events",            flag: "(always on)",    desc: "In-process typed pub/sub bus." },
  ];
  return (
    <SectionCard feature={feature}>
      <Explain>
        All stores are fields on the <code className="text-zinc-300 text-[11px]">Runtime</code> struct.
        Optional stores (Security, Audit, Recipes) are nil in dev mode — every handler checks for nil
        and returns 503 gracefully. Required stores (TagStore, Namespace, Events, Assets) are always
        initialized. The main binary enables optional stores via CLI flags.
      </Explain>
      <div className="mt-2 rounded-lg border border-zinc-800 overflow-hidden">
        <table className="w-full text-[11px]">
          <thead><tr className="bg-zinc-900 border-b border-zinc-800">
            <th className="text-left px-3 py-1.5 text-zinc-500 font-medium">Store</th>
            <th className="text-left px-3 py-1.5 text-zinc-500 font-medium">Flag</th>
            <th className="text-left px-3 py-1.5 text-zinc-500 font-medium">Notes</th>
          </tr></thead>
          <tbody>
            {stores.map(s => (
              <tr key={s.name} className="border-b border-zinc-800/50 last:border-0">
                <td className="px-3 py-1.5 font-mono text-zinc-300">{s.name}</td>
                <td className="px-3 py-1.5 font-mono text-zinc-500 text-[10px]">{s.flag}</td>
                <td className="px-3 py-1.5 text-zinc-500">{s.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <LiveBox
        label="GET /api/v1/alive"
        data={alive.data}
        error={alive.error}
        loading={alive.loading}
      />
    </SectionCard>
  );
}

function ApiSection({ feature }: { feature: FeatureMeta }) {
  const groups = [
    { group: "Auth",       routes: ["POST /auth/login", "GET /whoami"] },
    { group: "Project",    routes: ["GET /project", "POST /project"] },
    { group: "Tags",       routes: ["GET /tag/*", "POST /tag/*", "GET /history"] },
    { group: "Alarms",     routes: ["GET /alarms", "GET /alarms/history", "POST /alarms/{id}/ack"] },
    { group: "Recipes",    routes: ["GET /recipes", "POST /recipes/{id}/apply", "POST /recipes/{id}/request", "GET /recipes/history", "GET /recipes/pending", "POST /recipes/pending/{id}/approve|reject"] },
    { group: "Assets",     routes: ["GET /assets/templates", "POST /assets/templates", "GET /assets/instances", "POST /assets/instances", "DELETE /assets/instances/{id}"] },
    { group: "Faceplates", routes: ["GET /faceplates/{instanceId}", "GET /faceplates/{instanceId}/{viewType}", "POST /faceplates"] },
    { group: "Namespace",  routes: ["GET /namespace", "GET /namespace/tree", "GET /namespace/search", "POST /namespace", "DELETE /namespace/*"] },
    { group: "Users",      routes: ["GET /users", "POST /users", "PUT /users/{u}/role", "PUT /users/{u}/enabled", "DELETE /users/{u}"] },
    { group: "Audit",      routes: ["GET /audit"] },
    { group: "Versions",   routes: ["GET /versions", "GET /versions/{id}", "POST /versions/{id}/restore"] },
  ];

  return (
    <SectionCard feature={feature}>
      <Explain>
        All <code className="text-zinc-300 text-[11px]">/api/v1</code> routes are protected by JWT middleware.
        The login endpoint is public. Permission checks are per-endpoint using chi middleware chains.
        Dev mode (no security DB) injects anonymous/admin identity, so all routes work without a token.
      </Explain>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {groups.map(g => (
          <div key={g.group} className="rounded-lg border border-zinc-700/50 bg-zinc-800/40 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">{g.group}</div>
            {g.routes.map(r => (
              <div key={r} className="text-[10px] font-mono text-zinc-400 leading-relaxed truncate">{r}</div>
            ))}
          </div>
        ))}
      </div>
      <Code>{`# Example: deploy with JWT auth
curl -X POST http://localhost:3001/api/v1/auth/login \\
  -d '{"username":"admin","password":"secret"}' | jq .token

# Use token on protected routes
curl -H "Authorization: Bearer <token>" \\
  http://localhost:3001/api/v1/audit?limit=10`}</Code>
    </SectionCard>
  );
}

// ── Main Demo modal ────────────────────────────────────────────────────────

export function DemoModal({ onClose }: { onClose: () => void }) {
  const [activeId, setActiveId] = useState("namespace");
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollTo = (id: string) => {
    setActiveId(id);
    const el = document.getElementById(`demo-${id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Update active section on scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => {
      for (const f of FEATURES) {
        const section = document.getElementById(`demo-${f.id}`);
        if (!section) continue;
        const rect = section.getBoundingClientRect();
        if (rect.top <= 200) setActiveId(f.id);
      }
    };
    el.addEventListener("scroll", handler);
    return () => el.removeEventListener("scroll", handler);
  }, []);

  const sectionMap: Record<string, (f: FeatureMeta) => React.ReactNode> = {
    namespace:  (f) => <NamespaceSection key={f.id} feature={f} />,
    tagbrowser: (f) => <TagBrowserSection key={f.id} feature={f} />,
    expr:       (f) => <ExprSection key={f.id} feature={f} />,
    eventbus:   (f) => <EventBusSection key={f.id} feature={f} />,
    security:   (f) => <SecuritySection key={f.id} feature={f} />,
    historian:  (f) => <HistorianSection key={f.id} feature={f} />,
    assets:     (f) => <AssetsSection key={f.id} feature={f} />,
    faceplate:  (f) => <FaceplateSection key={f.id} feature={f} />,
    recipe:     (f) => <RecipeSection key={f.id} feature={f} />,
    wiring:     (f) => <WiringSection key={f.id} feature={f} />,
    api:        (f) => <ApiSection key={f.id} feature={f} />,
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex" onClick={onClose}>
      <div
        className="flex flex-1 m-4 rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Sidebar */}
        <div className="w-52 shrink-0 border-r border-zinc-800 bg-zinc-950/60 flex flex-col">
          <div className="px-4 py-4 border-b border-zinc-800">
            <div className="font-bold text-sm text-zinc-100">X-HMI Platform</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">Phase 0 Feature Demo</div>
          </div>
          <div className="flex-1 overflow-auto py-2">
            {FEATURES.map((f, i) => (
              <button
                key={f.id}
                onClick={() => scrollTo(f.id)}
                className={`w-full text-left flex items-center gap-2.5 px-4 py-2 text-[11px] transition-colors ${
                  activeId === f.id
                    ? "text-zinc-100 bg-zinc-800"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
                }`}
              >
                <span className="text-zinc-600 shrink-0 w-4 text-center text-[10px]">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{f.title}</div>
                </div>
                {activeId === f.id && (
                  <div className="w-1 h-4 rounded-full shrink-0" style={{ background: f.accentColor }} />
                )}
              </button>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-zinc-800">
            <div className="text-[10px] text-zinc-600">11 features · 9 days</div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/80 shrink-0">
            <div>
              <h1 className="font-bold text-base text-zinc-100">X-HMI Platform — Feature Demo</h1>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Live API calls hit <code className="font-mono text-zinc-400">localhost:3001</code> — start the runtime with{" "}
                <code className="font-mono text-zinc-400">go run ./cmd/x-hmi</code> to see live responses.
              </p>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 text-xl leading-none px-2">×</button>
          </div>

          {/* Scrollable sections */}
          <div ref={scrollRef} className="flex-1 overflow-auto px-6 py-6">
            {FEATURES.map(f => sectionMap[f.id]?.(f))}
          </div>
        </div>
      </div>
    </div>
  );
}
