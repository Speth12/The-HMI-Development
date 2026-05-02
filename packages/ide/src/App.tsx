import { useState } from "react";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { Canvas } from "./panels/Canvas";
import { Header } from "./panels/Header";
import { PageTabs } from "./panels/PageTabs";
import { Palette } from "./panels/Palette";
import { Properties } from "./panels/Properties";
import { TagBrowser } from "./panels/TagBrowser";
import { Alarms, AlarmBadge } from "./panels/Alarms";
import { StatusBar } from "./panels/StatusBar";
import { useProject } from "./store/projectStore";

export function App() {
  const [rightTab, setRightTab] = useState<"alarms" | "json">("alarms");
  useKeyboardShortcuts();

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-zinc-100">
      <HeaderWithAlarms />
      <PageTabs />
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
            {(["alarms", "json"] as const).map((tab) => (
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
          {rightTab === "alarms" ? <Alarms /> : <ProjectJSONPanel />}
        </div>
      </div>
      <StatusBar />
    </div>
  );
}

function HeaderWithAlarms() {
  return (
    <div className="flex items-center">
      <div className="flex-1">
        <Header />
      </div>
      <div className="pr-3">
        <AlarmBadge />
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
