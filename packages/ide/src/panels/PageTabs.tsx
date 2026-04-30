import { useProject } from "../store/projectStore";

export function PageTabs() {
  const { project, activePageId, setActivePage, addPage, removePage } = useProject();
  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-zinc-800 bg-zinc-900">
      {project.pages.map((p) => (
        <button
          key={p.id}
          onClick={() => setActivePage(p.id)}
          className={`group flex items-center gap-1 px-2.5 py-1 rounded text-xs ${
            activePageId === p.id ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800/50"
          }`}
        >
          {p.name}
          {project.pages.length > 1 && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); removePage(p.id); }}
              className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 ml-1 text-xs leading-none"
            >×</span>
          )}
        </button>
      ))}
      <button onClick={() => addPage()} className="ml-1 text-xs px-2 py-1 rounded text-zinc-500 hover:bg-zinc-800/50">+ Page</button>
    </div>
  );
}
