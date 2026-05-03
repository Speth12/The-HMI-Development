import { useEffect, useState } from "react";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { Canvas } from "./panels/Canvas";
import { Header } from "./panels/Header";
import { PageTabs } from "./panels/PageTabs";
import { Palette } from "./panels/Palette";
import { Properties } from "./panels/Properties";
import { TagBrowser } from "./panels/TagBrowser";
import { Alarms, AlarmBadge } from "./panels/Alarms";
import { Recipes } from "./panels/Recipes";
import { StatusBar } from "./panels/StatusBar";
import { useProject } from "./store/projectStore";

const SHORTCUTS = [
  { keys: "Del / Backspace", desc: "Delete selected widget" },
  { keys: "Esc",             desc: "Deselect" },
  { keys: "Ctrl+Z",          desc: "Undo" },
  { keys: "Ctrl+Y / ⇧Z",    desc: "Redo" },
  { keys: "Ctrl+S",          desc: "Save project to file" },
  { keys: "Ctrl+C",          desc: "Copy selected widget" },
  { keys: "Ctrl+V",          desc: "Paste widget" },
  { keys: "Ctrl+D",          desc: "Duplicate widget below" },
  { keys: "Drag widget",     desc: "Move to new grid position" },
  { keys: "Drag corner ●",   desc: "Resize widget" },
  { keys: "Drag tag → cell", desc: "Bind tag to widget" },
];

function ShortcutModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 w-80 shadow-2xl space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm">Keyboard Shortcuts</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">×</button>
        </div>
        <div className="space-y-1">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-center gap-3">
              <code className="text-[10px] bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 font-mono text-zinc-300 shrink-0 min-w-[110px] text-center">
                {s.keys}
              </code>
              <span className="text-[11px] text-zinc-400">{s.desc}</span>
            </div>
          ))}
        </div>
        <div className="text-[10px] text-zinc-600 pt-1 border-t border-zinc-800">
          Press <kbd className="bg-zinc-800 px-1 rounded">?</kbd> to toggle this panel
        </div>
      </div>
    </div>
  );
}

export function App() {
  const [rightTab, setRightTab] = useState<"alarms" | "recipes" | "json">("alarms");
  const [showHelp, setShowHelp] = useState(false);
  useKeyboardShortcuts();

  useEffect(() => {
    const toggle = () => setShowHelp((v) => !v);
    window.addEventListener("xhmi:toggleHelp", toggle);
    return () => window.removeEventListener("xhmi:toggleHelp", toggle);
  }, []);

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-zinc-100">
      <HeaderWithAlarms onHelp={() => setShowHelp((v) => !v)} />
      <PageTabs />
      {showHelp && <ShortcutModal onClose={() => setShowHelp(false)} />}
      <div className="flex-1 grid grid-cols-[260px_1fr_300px_300px] min-h-0">
        {/* Left: palette + properties */}
        <div className="border-r border-zinc-800 bg-zinc-900/50 flex flex-col min-h-0">
          <Palette />
          <div className="flex-1 overflow-auto">
            <Properties />
          </div>
        </div>
        {/* Center: canvas */}
        <div className="flex flex-col min-h-0">
          <Canvas />
        </div>
        {/* Right col 1: tag browser */}
        <div className="border-l border-zinc-800 bg-zinc-900/50 flex flex-col min-h-0">
          <TagBrowser />
        </div>
        {/* Right col 2: alarms / JSON */}
        <div className="border-l border-zinc-800 bg-zinc-900/50 flex flex-col min-h-0">
          {/* Tab bar */}
          <div className="flex border-b border-zinc-800 shrink-0">
            {(["alarms", "recipes", "json"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setRightTab(tab)}
                className={`px-3 py-1.5 text-[10px] uppercase tracking-wider font-medium transition-colors ${
                  rightTab === tab
                    ? "text-zinc-100 border-b-2 border-blue-500 -mb-px"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          {rightTab === "alarms" ? <Alarms /> : rightTab === "recipes" ? <Recipes /> : <ProjectJSONPanel />}
        </div>
      </div>
      <StatusBar />
    </div>
  );
}

function HeaderWithAlarms({ onHelp }: { onHelp: () => void }) {
  return (
    <div className="flex items-center">
      <div className="flex-1">
        <Header />
      </div>
      <div className="flex items-center gap-2 pr-3">
        <AlarmBadge />
        <button
          onClick={onHelp}
          title="Keyboard shortcuts (?)"
          className="text-xs px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-mono"
        >
          ?
        </button>
      </div>
    </div>
  );
}

function ProjectJSONPanel() {
  const json = useProject((s) => s.exportJSON());
  return (
    <div className="flex flex-col min-h-0 flex-1">
      <pre className="flex-1 overflow-auto p-3 text-[10px] font-mono text-zinc-400 whitespace-pre">{json}</pre>
    </div>
  );
}
