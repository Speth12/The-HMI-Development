import { Canvas } from "./panels/Canvas";
import { Header } from "./panels/Header";
import { PageTabs } from "./panels/PageTabs";
import { Palette } from "./panels/Palette";
import { Properties } from "./panels/Properties";
import { TagBrowser } from "./panels/TagBrowser";

export function App() {
  return (
    <div className="h-full flex flex-col bg-zinc-950 text-zinc-100">
      <Header />
      <PageTabs />
      <div className="flex-1 grid grid-cols-[260px_1fr_320px_280px] min-h-0">
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
        {/* Right: tag browser */}
        <div className="border-l border-zinc-800 bg-zinc-900/50 flex flex-col min-h-0">
          <TagBrowser />
        </div>
        {/* Far right: project JSON peek */}
        <ProjectJSONPanel />
      </div>
    </div>
  );
}

import { useProject } from "./store/projectStore";

function ProjectJSONPanel() {
  const json = useProject((s) => s.exportJSON());
  return (
    <div className="border-l border-zinc-800 bg-zinc-950 flex flex-col min-h-0">
      <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800">project.json</div>
      <pre className="flex-1 overflow-auto p-3 text-[10px] font-mono text-zinc-400 whitespace-pre">{json}</pre>
    </div>
  );
}
