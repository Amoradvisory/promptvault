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
} from "@/types/database";
import * as hybrid from "@/lib/sync-engine";

interface AppState {
  // Data
  prompts: Prompt[];
  categories: Category[];
  tags: Tag[];
  user: { id: string; email: string; name: string | null } | null;

  // UI State
  filters: Filters;
  isLoading: boolean;
  editingPrompt: Prompt | null;
  isEditorOpen: boolean;
  sidebarOpen: boolean;
  isOnline: boolean;
  pendingSync: number;

  // Actions — Auth
  setUser: (user: AppState["user"]) => void;

  // Actions — Prompts
  fetchPrompts: () => Promise<void>;
  createPrompt: (data: PromptFormData) => Promise<Prompt | null>;
  updatePrompt: (id: string, data: PromptFormData) => Promise<void>;
  deletePrompt: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  incrementUseCount: (id: string) => Promise<void>;
  duplicatePrompt: (id: string) => Promise<void>;

  // Actions — Categories
  fetchCategories: () => Promise<void>;
  createCategory: (name: string, color: string, icon: string) => Promise<void>;
  updateCategory: (id: string, data: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  // Actions — Tags
  fetchTags: () => Promise<void>;
  createTag: (name: string) => Promise<Tag | null>;

  // Actions — Filters
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  resetFilters: () => void;

  // Actions — UI
  openEditor: (prompt?: Prompt) => void;
  closeEditor: () => void;
  toggleSidebar: () => void;
  setOnline: (online: boolean) => void;
  syncNow: () => Promise<void>;

  // Computed
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

  // ── Prompts (hybrid) ───────────────────────────

  fetchPrompts: async () => {
    set({ isLoading: true });
    const prompts = await hybrid.hybridFetchPrompts();
    set({ prompts, isLoading: false });
  },

  createPrompt: async (data) => {
    const user = get().user;
    if (!user) return null;

    const prompt = await hybrid.hybridCreatePrompt(user.id, data);
    // Re-fetch to get enriched data
    const prompts = await hybrid.hybridFetchPrompts();
    const tags = await hybrid.hybridFetchTags();
    set({ prompts, tags, pendingSync: hybrid.getPendingSyncCount() });
    return prompt;
  },

  updatePrompt: async (id, data) => {
    await hybrid.hybridUpdatePrompt(id, data);
    const prompts = await hybrid.hybridFetchPrompts();
    const tags = await hybrid.hybridFetchTags();
    set({ prompts, tags, pendingSync: hybrid.getPendingSyncCount() });
  },

  deletePrompt: async (id) => {
    await hybrid.hybridDeletePrompt(id);
    set((s) => ({
      prompts: s.prompts.filter((p) => p.id !== id),
      pendingSync: hybrid.getPendingSyncCount(),
    }));
  },

  toggleFavorite: async (id) => {
    const newVal = await hybrid.hybridToggleFavorite(id);
    set((s) => ({
      prompts: s.prompts.map((p) =>
        p.id === id ? { ...p, is_favorite: newVal } : p
      ),
    }));
  },

  incrementUseCount: async (id) => {
    const newCount = await hybrid.hybridIncrementUseCount(id);
    set((s) => ({
      prompts: s.prompts.map((p) =>
        p.id === id ? { ...p, use_count: newCount } : p
      ),
    }));
  },

  duplicatePrompt: async (id) => {
    const prompt = get().prompts.find((p) => p.id === id);
    if (!prompt) return;

    await get().createPrompt({
      title: `${prompt.title} (copie)`,
      content: prompt.content,
      description: prompt.description || undefined,
      category_id: prompt.category_id,
      target_model: prompt.target_model,
      tag_names: prompt.tags?.map((t) => t.name) || [],
    });
  },

  // ── Categories (hybrid) ────────────────────────

  fetchCategories: async () => {
    const categories = await hybrid.hybridFetchCategories();
    set({ categories });
  },

  createCategory: async (name, color, icon) => {
    const user = get().user;
    if (!user) return;

    const cat = await hybrid.hybridCreateCategory(user.id, name, color, icon);
    set((s) => ({ categories: [...s.categories, cat] }));
  },

  updateCategory: async (id, data) => {
    await hybrid.hybridUpdateCategory(id, data);
    set((s) => ({
      categories: s.categories.map((c) =>
        c.id === id ? { ...c, ...data } : c
      ),
    }));
  },

  deleteCategory: async (id) => {
    await hybrid.hybridDeleteCategory(id);
    set((s) => ({
      categories: s.categories.filter((c) => c.id !== id),
      prompts: s.prompts.map((p) =>
        p.category_id === id ? { ...p, category_id: null, category: null } : p
      ),
    }));
  },

  // ── Tags (hybrid) ─────────────────────────────

  fetchTags: async () => {
    const tags = await hybrid.hybridFetchTags();
    set({ tags });
  },

  createTag: async (name) => {
    const user = get().user;
    if (!user) return null;

    const tag = await hybrid.hybridCreateTag(user.id, name);
    if (tag) {
      set((s) => {
        const exists = s.tags.find((t) => t.id === tag.id);
        return exists ? s : { tags: [...s.tags, tag] };
      });
    }
    return tag;
  },

  // ── Filters ────────────────────────────────────

  setFilter: (key, value) =>
    set((s) => ({ filters: { ...s.filters, [key]: value } })),

  resetFilters: () => set({ filters: { ...defaultFilters } }),

  // ── UI ─────────────────────────────────────────

  openEditor: (prompt) =>
    set({ editingPrompt: prompt || null, isEditorOpen: true }),

  closeEditor: () => set({ editingPrompt: null, isEditorOpen: false }),

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  setOnline: (online) => set({ isOnline: online }),

  syncNow: async () => {
    const synced = await hybrid.replaySync();
    if (synced > 0) {
      // Re-fetch everything from Supabase
      await get().fetchPrompts();
      await get().fetchCategories();
      await get().fetchTags();
    }
    set({ pendingSync: hybrid.getPendingSyncCount() });
  },

  // ── Computed ───────────────────────────────────

  filteredPrompts: () => {
    const { prompts, filters } = get();
    let result = [...prompts];

    if (filters.category_id) {
      result = result.filter((p) => p.category_id === filters.category_id);
    }

    if (filters.tag_id) {
      result = result.filter((p) =>
        p.tags?.some((t) => t.id === filters.tag_id)
      );
    }

    if (filters.target_model) {
      result = result.filter((p) => p.target_model === filters.target_model);
    }

    if (filters.favorites_only) {
      result = result.filter((p) => p.is_favorite);
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
      result = fuse.search(filters.search).map((r) => r.item);
    }

    const sortFns: Record<SortOption, (a: Prompt, b: Prompt) => number> = {
      updated_desc: (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      updated_asc: (a, b) =>
        new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(),
      created_desc: (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      created_asc: (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      alpha_asc: (a, b) => a.title.localeCompare(b.title, "fr"),
      alpha_desc: (a, b) => b.title.localeCompare(a.title, "fr"),
      most_used: (a, b) => b.use_count - a.use_count,
      favorites_first: (a, b) => {
        if (a.is_favorite !== b.is_favorite)
          return a.is_favorite ? -1 : 1;
        return (
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
      },
    };

    if (!filters.search.trim()) {
      result.sort(sortFns[filters.sort]);
    }

    return result;
  },
}));
