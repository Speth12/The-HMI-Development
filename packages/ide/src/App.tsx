import { useEffect, useRef, useState } from "react";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { Canvas } from "./panels/Canvas";
import { Header } from "./panels/Header";
import { LeftPanel } from "./panels/LeftPanel";
import { Palette } from "./panels/Palette";
import { Properties } from "./panels/Properties";
import { TagBrowser } from "./panels/TagBrowser";
import { StatusBar } from "./panels/StatusBar";
import { useProject } from "./store/projectStore";
import { useShallow } from "zustand/react/shallow";

const SHORTCUTS = [
  { keys: "Del / Backspace", desc: "Delete selected widget" },
  { keys: "Esc",             desc: "Deselect" },
  { keys: "Ctrl+Z",          desc: "Undo" },
  { keys: "Ctrl+Y / ⇧Z",    desc: "Redo" },
  { keys: "Ctrl+S",          desc: "Save project to file" },
  { keys: "Ctrl+C",          desc: "Copy widget (works across pages)" },
  { keys: "Ctrl+V",          desc: "Paste widget onto active page" },
  { keys: "Ctrl+D",          desc: "Duplicate widget" },
  { keys: "Ctrl+Scroll",     desc: "Zoom canvas (25%–250%)" },
  { keys: "Right-click",     desc: "Lock / copy / delete widget" },
  { keys: "Drag widget",     desc: "Move to new grid position" },
  { keys: "Drag corner ●",   desc: "Resize widget" },
  { keys: "Drag tag → cell", desc: "Bind tag to widget" },
];

function ShortcutModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 w-80 shadow-2xl space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm">Keyboard Shortcuts</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">×</button>
        </div>
        <div className="space-y-1">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-center gap-3">
              <code className="text-[10px] bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 font-mono text-zinc-300 shrink-0 min-w-[110px] text-center">{s.keys}</code>
              <span className="text-[11px] text-zinc-400">{s.desc}</span>
            </div>
          ))}
        </div>
        <div className="text-[10px] text-zinc-600 pt-1 border-t border-zinc-800">
          Press <kbd className="bg-zinc-800 px-1 rounded">?</kbd> to toggle
        </div>
      </div>
    </div>
  );
}

function JSONPanel() {
  const json = useProject((s) => s.exportJSON());
  return (
    <div className="flex-1 min-h-0 overflow-auto bg-zinc-950">
      <pre className="p-4 text-[11px] font-mono text-zinc-300 whitespace-pre leading-relaxed">{json}</pre>
    </div>
  );
}

function useDrag(
  onDelta: (dx: number) => void,
): (e: React.MouseEvent) => void {
  const dragging = useRef(false);
  const last = useRef(0);
  return (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    last.current = e.clientX;
    const move = (ev: MouseEvent) => {
      if (!dragging.current) return;
      onDelta(ev.clientX - last.current);
      last.current = ev.clientX;
    };
    const up = () => { dragging.current = false; window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };
}

export function App() {
  const [showHelp, setShowHelp]     = useState(false);
  const [showJSON, setShowJSON]     = useState(false);
  const [rightTab, setRightTab]     = useState<"tags" | "properties">("tags");
  const [rightOpen, setRightOpen]   = useState(true);
  const [leftW, setLeftW]           = useState(260);
  const [rightW, setRightW]         = useState(280);

  const dragLeft  = useDrag((dx) => setLeftW((w) => Math.max(160, Math.min(480, w + dx))));
  const dragRight = useDrag((dx) => setRightW((w) => Math.max(160, Math.min(480, w - dx))));

  const selectedWidgetId = useProject(useShallow((s) => s.selectedWidgetId));
  useKeyboardShortcuts();

  useEffect(() => {
    const toggle = () => setShowHelp((v) => !v);
    window.addEventListener("xhmi:toggleHelp", toggle);
    return () => window.removeEventListener("xhmi:toggleHelp", toggle);
  }, []);

  useEffect(() => {
    if (selectedWidgetId) { setRightTab("properties"); setRightOpen(true); }
  }, [selectedWidgetId]);

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-zinc-100">

      {/* ── Top bar ───────────────────────────────────────────────────── */}
      <Header
        onHelp={() => setShowHelp((v) => !v)}
        showJSON={showJSON}
        onToggleJSON={() => setShowJSON((v) => !v)}
      />

      {/* ── Body: left | center | right ──────────────────────────────── */}
      <div className="flex-1 flex min-h-0">

        {/* Left: Project & Page settings */}
        <LeftPanel width={leftW} />

        {/* Left drag handle */}
        <div
          onMouseDown={dragLeft}
          className="w-1 shrink-0 cursor-col-resize hover:bg-blue-500/40 active:bg-blue-500/60 transition-colors"
        />

        {/* Center: palette strip + canvas (or JSON view) */}
        <div className="flex-1 flex flex-col min-h-0">
          <Palette />
          {showJSON ? <JSONPanel /> : <Canvas />}
        </div>

        {/* Right drag handle */}
        {rightOpen && (
          <div
            onMouseDown={dragRight}
            className="w-1 shrink-0 cursor-col-resize hover:bg-blue-500/40 active:bg-blue-500/60 transition-colors"
          />
        )}

        {/* Right: Tags | Properties — collapsible */}
        {rightOpen ? (
          <div className="shrink-0 border-l border-zinc-800 bg-zinc-900/50 flex flex-col min-h-0" style={{ width: rightW }}>
            <div className="flex items-center border-b border-zinc-800 shrink-0">
              {(["tags", "properties"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setRightTab(t)}
                  className={`flex-1 py-1.5 text-[10px] uppercase tracking-wider font-medium transition-colors ${
                    rightTab === t
                      ? "text-zinc-100 border-b-2 border-blue-500 -mb-px"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {t}
                </button>
              ))}
              <button
                onClick={() => setRightOpen(false)}
                className="px-2 text-zinc-600 hover:text-zinc-300 text-base leading-none"
                title="Collapse panel"
              >
                ›
              </button>
            </div>
            <div className="flex-1 overflow-auto min-h-0">
              {rightTab === "tags" ? <TagBrowser /> : <Properties />}
            </div>
          </div>
        ) : (
          <div className="w-7 shrink-0 border-l border-zinc-800 bg-zinc-900/50 flex flex-col items-center pt-2 gap-3">
            <button
              onClick={() => { setRightOpen(true); setRightTab("tags"); }}
              className="text-zinc-600 hover:text-zinc-300 text-[9px] uppercase tracking-widest"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
              title="Tags"
            >
              Tags
            </button>
            <button
              onClick={() => { setRightOpen(true); setRightTab("properties"); }}
              className="text-zinc-600 hover:text-zinc-300 text-[9px] uppercase tracking-widest"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
              title="Properties"
            >
              Props
            </button>
          </div>
        )}
      </div>

      <StatusBar />
      {showHelp && <ShortcutModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}
