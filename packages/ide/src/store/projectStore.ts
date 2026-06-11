// Zustand store for the in-memory project (the JSON edited by the IDE).
import { create } from "zustand";

export type WidgetType =
  | "gauge" | "trend" | "led" | "button" | "numericInput"
  | "numericDisplay" | "textInput" | "textDisplay" | "historyLog"
  | "tank" | "setpoint" | "multiState" | "alarmBanner" | "image";

export type Widget = {
  id: string;
  type: WidgetType;
  x: number; y: number; w: number; h: number;
  binding?: string;
  visibleBinding?: string;
  locked?: boolean;
  config?: Record<string, unknown>;
};

export type Page = { id: string; name: string; widgets: Widget[] };

export type DatasourceType = "opcua" | "mbtcp" | "mqtt" | "rest" | "virtual";
export type Datasource = {
  id: string;
  type: DatasourceType;
  label: string;
  config: Record<string, unknown>;
};

export type AlarmCondition = "gt" | "gte" | "lt" | "lte" | "eq" | "ne";
export type AlarmSeverity = "critical" | "warning" | "info";

export type AlarmRule = {
  id: string;
  name: string;
  binding: string;      // "dsId:tagPath"
  condition: AlarmCondition;
  threshold: number;
  severity: AlarmSeverity;
  message: string;
};

export type RecipeEntry = {
  binding: string;   // "dsId:tagPath"
  value: unknown;    // value to write
};

export type Recipe = {
  id: string;
  name: string;
  description?: string;
  entries: RecipeEntry[];
};

export type ImageAsset = {
  id: string;
  name: string;
  dataUrl: string;   // base64 data URL
  mimeType: string;
  width: number;
  height: number;
  size: number;      // bytes (original file size)
};

export type Project = {
  version: string;
  name?: string;
  pin?: string;
  viewOnly?: boolean;
  datasources: Datasource[];
  pages: Page[];
  alarmRules?: AlarmRule[];
  recipes?: Recipe[];
  images?: ImageAsset[];
};

const MAX_HISTORY = 50;

type State = {
  project: Project;
  activePageId: string;
  selectedWidgetId: string | null;

  // Undo/redo stacks (editor-only, not serialised)
  _past: Project[];
  _future: Project[];
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;

  setActivePage: (id: string) => void;
  selectWidget: (id: string | null) => void;

  addPage: (name?: string) => void;
  renamePage: (id: string, name: string) => void;
  removePage: (id: string) => void;

  addDatasource: (ds: Datasource) => void;
  removeDatasource: (id: string) => void;

  addWidget: (pageId: string, w: Widget) => void;
  updateWidget: (pageId: string, id: string, patch: Partial<Widget>) => void;
  removeWidget: (pageId: string, id: string) => void;

  addAlarmRule: (rule: AlarmRule) => void;
  updateAlarmRule: (id: string, patch: Partial<AlarmRule>) => void;
  removeAlarmRule: (id: string) => void;

  addRecipe: (recipe: Recipe) => void;
  updateRecipe: (id: string, patch: Partial<Recipe>) => void;
  removeRecipe: (id: string) => void;

  importImage: (asset: ImageAsset) => void;
  deleteImage: (id: string) => void;
  renameImage: (id: string, name: string) => void;

  loadProject: (p: Project) => void;
  exportJSON: () => string;
};

const blankProject = (): Project => ({
  version: "0.1.0",
  datasources: [],
  pages: [{ id: "p1", name: "Main", widgets: [] }],
});

const uid = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

/** Deep-clone a project so history snapshots are independent. */
const cloneProject = (p: Project): Project => JSON.parse(JSON.stringify(p)) as Project;

export const useProject = create<State>((set, get) => {
  /** Save current project to undo stack before a mutation. */
  const pushHistory = () => {
    const s = get();
    const past = [...s._past, cloneProject(s.project)].slice(-MAX_HISTORY);
    set({ _past: past, _future: [], canUndo: true, canRedo: false });
  };

  return {
    project: blankProject(),
    activePageId: "p1",
    selectedWidgetId: null,
    _past: [],
    _future: [],
    canUndo: false,
    canRedo: false,

    undo: () => {
      const s = get();
      if (s._past.length === 0) return;
      const past = [...s._past];
      const restored = past.pop()!;
      const future = [cloneProject(s.project), ...s._future].slice(0, MAX_HISTORY);
      set({
        project: restored,
        _past: past,
        _future: future,
        canUndo: past.length > 0,
        canRedo: true,
        selectedWidgetId: null,
      });
    },

    redo: () => {
      const s = get();
      if (s._future.length === 0) return;
      const future = [...s._future];
      const restored = future.shift()!;
      const past = [...s._past, cloneProject(s.project)].slice(-MAX_HISTORY);
      set({
        project: restored,
        _past: past,
        _future: future,
        canUndo: true,
        canRedo: future.length > 0,
        selectedWidgetId: null,
      });
    },

    setActivePage: (id) => set({ activePageId: id, selectedWidgetId: null }),
    selectWidget: (id) => set({ selectedWidgetId: id }),

    addPage: (name) => {
      pushHistory();
      set((s) => {
        const id = uid("page");
        const page: Page = { id, name: name || `Page ${s.project.pages.length + 1}`, widgets: [] };
        return { project: { ...s.project, pages: [...s.project.pages, page] }, activePageId: id };
      });
    },

    renamePage: (id, name) => {
      pushHistory();
      set((s) => ({
        project: {
          ...s.project,
          pages: s.project.pages.map((p) => (p.id === id ? { ...p, name } : p)),
        },
      }));
    },

    removePage: (id) => {
      pushHistory();
      set((s) => {
        const pages = s.project.pages.filter((p) => p.id !== id);
        return {
          project: { ...s.project, pages: pages.length ? pages : blankProject().pages },
          activePageId: pages[0]?.id ?? "p1",
        };
      });
    },

    addDatasource: (ds) => {
      pushHistory();
      set((s) => ({ project: { ...s.project, datasources: [...s.project.datasources, ds] } }));
    },

    removeDatasource: (id) => {
      pushHistory();
      set((s) => ({
        project: { ...s.project, datasources: s.project.datasources.filter((d) => d.id !== id) },
      }));
    },

    addWidget: (pageId, w) => {
      pushHistory();
      set((s) => ({
        project: {
          ...s.project,
          pages: s.project.pages.map((p) =>
            p.id === pageId ? { ...p, widgets: [...p.widgets, w] } : p,
          ),
        },
        selectedWidgetId: w.id,
      }));
    },

    updateWidget: (pageId, id, patch) => {
      pushHistory();
      set((s) => ({
        project: {
          ...s.project,
          pages: s.project.pages.map((p) =>
            p.id !== pageId
              ? p
              : { ...p, widgets: p.widgets.map((w) => (w.id === id ? { ...w, ...patch } : w)) },
          ),
        },
      }));
    },

    removeWidget: (pageId, id) => {
      pushHistory();
      set((s) => ({
        project: {
          ...s.project,
          pages: s.project.pages.map((p) =>
            p.id === pageId ? { ...p, widgets: p.widgets.filter((w) => w.id !== id) } : p,
          ),
        },
        selectedWidgetId: null,
      }));
    },

    addAlarmRule: (rule) => {
      pushHistory();
      set((s) => ({ project: { ...s.project, alarmRules: [...(s.project.alarmRules ?? []), rule] } }));
    },

    updateAlarmRule: (id, patch) => {
      pushHistory();
      set((s) => ({
        project: {
          ...s.project,
          alarmRules: (s.project.alarmRules ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)),
        },
      }));
    },

    removeAlarmRule: (id) => {
      pushHistory();
      set((s) => ({
        project: {
          ...s.project,
          alarmRules: (s.project.alarmRules ?? []).filter((r) => r.id !== id),
        },
      }));
    },

    addRecipe: (recipe) => {
      pushHistory();
      set((s) => ({ project: { ...s.project, recipes: [...(s.project.recipes ?? []), recipe] } }));
    },

    updateRecipe: (id, patch) => {
      pushHistory();
      set((s) => ({
        project: {
          ...s.project,
          recipes: (s.project.recipes ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)),
        },
      }));
    },

    removeRecipe: (id) => {
      pushHistory();
      set((s) => ({
        project: {
          ...s.project,
          recipes: (s.project.recipes ?? []).filter((r) => r.id !== id),
        },
      }));
    },

    importImage: (asset) => {
      pushHistory();
      set((s) => ({
        project: { ...s.project, images: [...(s.project.images ?? []), asset] },
      }));
    },

    deleteImage: (id) => {
      pushHistory();
      set((s) => ({
        project: { ...s.project, images: (s.project.images ?? []).filter((img) => img.id !== id) },
      }));
    },

    renameImage: (id, name) => {
      pushHistory();
      set((s) => ({
        project: {
          ...s.project,
          images: (s.project.images ?? []).map((img) => img.id === id ? { ...img, name } : img),
        },
      }));
    },

    loadProject: (p) =>
      set({
        project: p,
        activePageId: p.pages[0]?.id ?? "p1",
        selectedWidgetId: null,
        _past: [],
        _future: [],
        canUndo: false,
        canRedo: false,
      }),

    exportJSON: () => {
      // Exclude internal undo state from export.
      const { project } = get();
      return JSON.stringify(project, null, 2);
    },
  };
});

export const newWidgetId = () => uid("w");

// ── LocalStorage auto-save / auto-restore ──────────────────────────────────

const LS_KEY = "xhmi-project-v1";

/** Restore any previously saved project from localStorage on startup. */
(function restoreFromStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as Project;
    if (saved && saved.version && Array.isArray(saved.pages)) {
      useProject.getState().loadProject(saved);
    }
  } catch {
    // ignore parse errors — blank project is fine
  }
})();

/** Auto-save whenever anything in state changes (debounced 1 s, saves only project). */
let _saveTimer: ReturnType<typeof setTimeout> | null = null;
useProject.subscribe((state) => {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state.project));
    } catch { /* storage full or private mode */ }
  }, 1000);
});
