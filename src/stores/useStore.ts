"use client";

import { create } from "zustand";
import Fuse from "fuse.js";
import type {
  Prompt,
  Category,
  Tag,
  Filters,
  SortOption,
  PromptFormData,
  SyncSnapshot,
} from "@/types/database";
import * as hybrid from "@/lib/sync-engine";

interface AppState {
  prompts: Prompt[];
  categories: Category[];
  tags: Tag[];
  user: { id: string; email: string; name: string | null } | null;

  filters: Filters;
  isLoading: boolean;
  editingPrompt: Prompt | null;
  isEditorOpen: boolean;
  sidebarOpen: boolean;
  isOnline: boolean;
  pendingSync: number;

  setUser: (user: AppState["user"]) => void;
  hydrateData: (snapshot: SyncSnapshot) => void;

  fetchPrompts: () => Promise<void>;
  createPrompt: (data: PromptFormData) => Promise<Prompt | null>;
  updatePrompt: (id: string, data: PromptFormData) => Promise<void>;
  deletePrompt: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  incrementUseCount: (id: string) => Promise<void>;
  duplicatePrompt: (id: string) => Promise<void>;

  fetchCategories: () => Promise<void>;
  createCategory: (name: string, color: string, icon: string) => Promise<void>;
  updateCategory: (id: string, data: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  fetchTags: () => Promise<void>;
  createTag: (name: string) => Promise<Tag | null>;

  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  resetFilters: () => void;

  openEditor: (prompt?: Prompt) => void;
  closeEditor: () => void;
  toggleSidebar: () => void;
  setOnline: (online: boolean) => void;
  syncNow: () => Promise<void>;

  filteredPrompts: () => Prompt[];
}

const defaultFilters: Filters = {
  search: "",
  category_id: null,
  tag_id: null,
  target_model: null,
  favorites_only: false,
  sort: "updated_desc",
};

function snapshotToState(snapshot: SyncSnapshot) {
  return {
    prompts: snapshot.prompts,
    categories: snapshot.categories,
    tags: snapshot.tags,
    pendingSync: hybrid.getPendingSyncCount(),
  };
}

export const useStore = create<AppState>((set, get) => ({
  prompts: [],
  categories: [],
  tags: [],
  user: null,
  filters: { ...defaultFilters },
  isLoading: false,
  editingPrompt: null,
  isEditorOpen: false,
  sidebarOpen: false,
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  pendingSync: hybrid.getPendingSyncCount(),

  setUser: (user) => set({ user }),

  hydrateData: (snapshot) => set(snapshotToState(snapshot)),

  fetchPrompts: async () => {
    set({ isLoading: true });
    const snapshot = await hybrid.hybridFetchAllData();
    set({ ...snapshotToState(snapshot), isLoading: false });
  },

  createPrompt: async (data) => {
    const user = get().user;
    if (!user) return null;

    const prompt = await hybrid.hybridCreatePrompt(user.id, data);
    const snapshot = await hybrid.hybridFetchAllData();
    set(snapshotToState(snapshot));
    return prompt;
  },

  updatePrompt: async (id, data) => {
    await hybrid.hybridUpdatePrompt(id, data);
    const snapshot = await hybrid.hybridFetchAllData();
    set(snapshotToState(snapshot));
  },

  deletePrompt: async (id) => {
    await hybrid.hybridDeletePrompt(id);
    const snapshot = await hybrid.hybridFetchAllData();
    set(snapshotToState(snapshot));
  },

  toggleFavorite: async (id) => {
    await hybrid.hybridToggleFavorite(id);
    const snapshot = await hybrid.hybridFetchAllData();
    set(snapshotToState(snapshot));
  },

  incrementUseCount: async (id) => {
    await hybrid.hybridIncrementUseCount(id);
    const snapshot = await hybrid.hybridFetchAllData();
    set(snapshotToState(snapshot));
  },

  duplicatePrompt: async (id) => {
    const prompt = get().prompts.find((item) => item.id === id);
    if (!prompt) return;

    await get().createPrompt({
      title: `${prompt.title} (copie)`,
      content: prompt.content,
      description: prompt.description || undefined,
      category_id: prompt.category_id,
      target_model: prompt.target_model,
      tag_names: prompt.tag_names,
    });
  },

  fetchCategories: async () => {
    const snapshot = await hybrid.hybridFetchAllData();
    set(snapshotToState(snapshot));
  },

  createCategory: async (name, color, icon) => {
    const user = get().user;
    if (!user) return;

    await hybrid.hybridCreateCategory(user.id, name, color, icon);
    const snapshot = await hybrid.hybridFetchAllData();
    set(snapshotToState(snapshot));
  },

  updateCategory: async (id, data) => {
    await hybrid.hybridUpdateCategory(id, data);
    const snapshot = await hybrid.hybridFetchAllData();
    set(snapshotToState(snapshot));
  },

  deleteCategory: async (id) => {
    await hybrid.hybridDeleteCategory(id);
    const snapshot = await hybrid.hybridFetchAllData();
    set(snapshotToState(snapshot));
  },

  fetchTags: async () => {
    const snapshot = await hybrid.hybridFetchAllData();
    set(snapshotToState(snapshot));
  },

  createTag: async (name) => {
    const user = get().user;
    if (!user) return null;

    const tag = await hybrid.hybridCreateTag(user.id, name);
    const snapshot = await hybrid.hybridFetchAllData();
    set(snapshotToState(snapshot));
    return tag;
  },

  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),

  resetFilters: () => set({ filters: { ...defaultFilters } }),

  openEditor: (prompt) => set({ editingPrompt: prompt || null, isEditorOpen: true }),

  closeEditor: () => set({ editingPrompt: null, isEditorOpen: false }),

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setOnline: (online) => set({ isOnline: online }),

  syncNow: async () => {
    await hybrid.replaySync();
    const snapshot = await hybrid.hybridFetchAllData();
    set(snapshotToState(snapshot));
  },

  filteredPrompts: () => {
    const { prompts, filters } = get();
    let result = [...prompts];

    if (filters.category_id) {
      result = result.filter((prompt) => prompt.category_id === filters.category_id);
    }

    if (filters.tag_id) {
      result = result.filter((prompt) => prompt.tags?.some((tag) => tag.id === filters.tag_id));
    }

    if (filters.target_model) {
      result = result.filter((prompt) => prompt.target_model === filters.target_model);
    }

    if (filters.favorites_only) {
      result = result.filter((prompt) => prompt.is_favorite);
    }

    if (filters.search.trim()) {
      const fuse = new Fuse(result, {
        keys: [
          { name: "title", weight: 0.4 },
          { name: "content", weight: 0.3 },
          { name: "description", weight: 0.2 },
          { name: "tags.name", weight: 0.1 },
        ],
        threshold: 0.3,
        ignoreLocation: true,
      });
      result = fuse.search(filters.search).map((entry) => entry.item);
    }

    const sorters: Record<SortOption, (left: Prompt, right: Prompt) => number> = {
      updated_desc: (left, right) =>
        new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime(),
      updated_asc: (left, right) =>
        new Date(left.updated_at).getTime() - new Date(right.updated_at).getTime(),
      created_desc: (left, right) =>
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
      created_asc: (left, right) =>
        new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
      alpha_asc: (left, right) => left.title.localeCompare(right.title, "fr"),
      alpha_desc: (left, right) => right.title.localeCompare(left.title, "fr"),
      most_used: (left, right) => right.use_count - left.use_count,
      favorites_first: (left, right) => {
        if (left.is_favorite !== right.is_favorite) {
          return left.is_favorite ? -1 : 1;
        }

        return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
      },
    };

    if (!filters.search.trim()) {
      result.sort(sorters[filters.sort]);
    }

    return result;
  },
}));
