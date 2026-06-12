import { useState } from "react";
import { useProject, type Faceplate, type FaceplateParam } from "../store/projectStore";

const uid = () => `fp-${Math.random().toString(36).slice(2, 8)}`;

const inp = "w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-zinc-500";

function ParamRow({
  param,
  onChange,
  onRemove,
}: {
  param: FaceplateParam;
  onChange: (patch: Partial<FaceplateParam>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex gap-1.5 items-center">
      <input
        value={param.name}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder="paramName"
        className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-[11px] font-mono focus:outline-none"
      />
      <input
        value={param.description ?? ""}
        onChange={(e) => onChange({ description: e.target.value || undefined })}
        placeholder="description"
        className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-[11px] focus:outline-none"
      />
      <button onClick={onRemove} className="text-zinc-600 hover:text-red-400 text-xs">×</button>
    </div>
  );
}

function FaceplateCard({ fp }: { fp: Faceplate }) {
  const { updateFaceplate, removeFaceplate } = useProject();
  const [open, setOpen] = useState(false);

  const setParams = (params: FaceplateParam[]) => updateFaceplate(fp.id, { params });

  const addParam = () => setParams([...fp.params, { name: `param${fp.params.length + 1}` }]);

  const updateParam = (i: number, patch: Partial<FaceplateParam>) =>
    setParams(fp.params.map((p, j) => j === i ? { ...p, ...patch } : p));

  const removeParam = (i: number) => setParams(fp.params.filter((_, j) => j !== i));

  return (
    <div className="border border-zinc-700/50 rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-2 px-3 py-2 bg-zinc-800/40 cursor-pointer hover:bg-zinc-800/60"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-[10px] text-zinc-500 w-3">{open ? "▾" : "▸"}</span>
        <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
        <input
          value={fp.name}
          onChange={(e) => { e.stopPropagation(); updateFaceplate(fp.id, { name: e.target.value }); }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 bg-transparent text-xs font-medium text-zinc-200 outline-none"
          placeholder="Faceplate Name"
        />
        <span className="text-[10px] text-zinc-600">{fp.params.length}p · {fp.widgets.length}w</span>
        <button
          onClick={(e) => { e.stopPropagation(); removeFaceplate(fp.id); }}
          className="text-zinc-600 hover:text-red-400 text-xs"
        >
          ×
        </button>
      </div>

      {open && (
        <div className="px-3 py-2 space-y-2 bg-zinc-900/30">
          <input
            value={fp.description ?? ""}
            onChange={(e) => updateFaceplate(fp.id, { description: e.target.value || undefined })}
            placeholder="Description"
            className={`${inp} text-[10px]`}
          />

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Parameters</span>
              <button onClick={addParam} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700">+ add</button>
            </div>
            <div className="space-y-1">
              {fp.params.length === 0 && <div className="text-[10px] text-zinc-600 italic">No params.</div>}
              {fp.params.map((p, i) => (
                <ParamRow
                  key={i}
                  param={p}
                  onChange={(patch) => updateParam(i, patch)}
                  onRemove={() => removeParam(i)}
                />
              ))}
            </div>
            <div className="text-[10px] text-zinc-600 mt-1">
              Use <code className="text-zinc-400">{"{paramName}"}</code> in widget bindings to be replaced at render time.
            </div>
          </div>

          <div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Widgets</div>
            {fp.widgets.length === 0 && (
              <div className="text-[10px] text-zinc-600 italic">Drop widgets onto the canvas with faceplate type to add them here.</div>
            )}
            {fp.widgets.map((w, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] py-0.5 border-b border-zinc-800/50">
                <span className="text-zinc-500 font-mono w-16 truncate">{w.type}</span>
                <span className="text-zinc-600 font-mono flex-1 truncate">{w.binding ?? "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function Faceplates() {
  const { project, addFaceplate } = useProject();
  const faceplates = project.faceplates ?? [];

  const handleAdd = () => addFaceplate({
    id: uid(),
    name: `Faceplate ${faceplates.length + 1}`,
    params: [{ name: "prefix" }],
    widgets: [],
  });

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500">Faceplate Templates</div>
        <button onClick={handleAdd} className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700">
          + New Faceplate
        </button>
      </div>

      {faceplates.length === 0 && (
        <div className="text-[11px] text-zinc-600 italic">
          No faceplates yet. Create one to build reusable composite widgets with parameterized bindings.
        </div>
      )}

      <div className="space-y-2">
        {faceplates.map((fp) => <FaceplateCard key={fp.id} fp={fp} />)}
      </div>
    </div>
  );
}
