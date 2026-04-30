// Zustand store for the in-memory project (the JSON edited by the IDE).
import { create } from "zustand";

export type WidgetType =
  | "gauge" | "trend" | "led" | "button" | "numericInput"
  | "numericDisplay" | "textInput" | "textDisplay" | "historyLog";

export type Widget = {
  id: string;
  type: WidgetType;
  x: number; y: number; w: number; h: number;
  binding?: string;
  config?: Record<string, unknown>;
};

export type Page = { id: string; name: string; widgets: Widget[] };

export type DatasourceType = "opcua" | "mbtcp" | "mqtt" | "rest";
export type Datasource = {
  id: string;
  type: DatasourceType;
  label: string;
  config: Record<string, unknown>;
};

export type Project = {
  version: string;
  name?: string;
  datasources: Datasource[];
  pages: Page[];
};

type State = {
  project: Project;
  activePageId: string;
  selectedWidgetId: string | null;

  setActivePage: (id: string) => void;
  selectWidget: (id: string | null) => void;

  addPage: (name?: string) => void;
  removePage: (id: string) => void;

  addDatasource: (ds: Datasource) => void;
  removeDatasource: (id: string) => void;

  addWidget: (pageId: string, w: Widget) => void;
  updateWidget: (pageId: string, id: string, patch: Partial<Widget>) => void;
  removeWidget: (pageId: string, id: string) => void;

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

export const useProject = create<State>((set, get) => ({
  project: blankProject(),
  activePageId: "p1",
  selectedWidgetId: null,

  setActivePage: (id) => set({ activePageId: id, selectedWidgetId: null }),
  selectWidget: (id) => set({ selectedWidgetId: id }),

  addPage: (name) =>
    set((s) => {
      const id = uid("page");
      const page: Page = { id, name: name || `Page ${s.project.pages.length + 1}`, widgets: [] };
      return { project: { ...s.project, pages: [...s.project.pages, page] }, activePageId: id };
    }),

  removePage: (id) =>
    set((s) => {
      const pages = s.project.pages.filter((p) => p.id !== id);
      return {
        project: { ...s.project, pages: pages.length ? pages : blankProject().pages },
        activePageId: pages[0]?.id ?? "p1",
      };
    }),

  addDatasource: (ds) =>
    set((s) => ({ project: { ...s.project, datasources: [...s.project.datasources, ds] } })),

  removeDatasource: (id) =>
    set((s) => ({
      project: { ...s.project, datasources: s.project.datasources.filter((d) => d.id !== id) },
    })),

  addWidget: (pageId, w) =>
    set((s) => ({
      project: {
        ...s.project,
        pages: s.project.pages.map((p) =>
          p.id === pageId ? { ...p, widgets: [...p.widgets, w] } : p,
        ),
      },
      selectedWidgetId: w.id,
    })),

  updateWidget: (pageId, id, patch) =>
    set((s) => ({
      project: {
        ...s.project,
        pages: s.project.pages.map((p) =>
          p.id !== pageId
            ? p
            : { ...p, widgets: p.widgets.map((w) => (w.id === id ? { ...w, ...patch } : w)) },
        ),
      },
    })),

  removeWidget: (pageId, id) =>
    set((s) => ({
      project: {
        ...s.project,
        pages: s.project.pages.map((p) =>
          p.id === pageId ? { ...p, widgets: p.widgets.filter((w) => w.id !== id) } : p,
        ),
      },
      selectedWidgetId: null,
    })),

  loadProject: (p) => set({ project: p, activePageId: p.pages[0]?.id ?? "p1", selectedWidgetId: null }),

  exportJSON: () => JSON.stringify(get().project, null, 2),
}));

export const newWidgetId = () => uid("w");
