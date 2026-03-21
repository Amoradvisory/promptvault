// Local storage backend — fonctionne sans Supabase
// Les données sont persistées dans localStorage du navigateur

import type { Prompt, Category, Tag, PromptFormData } from "@/types/database";
import { DEFAULT_CATEGORIES } from "@/types/database";

const KEYS = {
  user: "pv_user",
  prompts: "pv_prompts",
  categories: "pv_categories",
  tags: "pv_tags",
  promptTags: "pv_prompt_tags",
  versions: "pv_versions",
} as const;

function generateId(): string {
  return crypto.randomUUID();
}

function get<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function set(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

// ── User ───────────────────────────────────────────

export interface LocalUser {
  id: string;
  email: string;
  name: string;
  password_hash: string;
}

export function localRegister(
  name: string,
  email: string,
  password: string
): { user: LocalUser | null; error: string | null } {
  const users = get<LocalUser[]>("pv_users", []);
  if (users.find((u) => u.email === email)) {
    return { user: null, error: "Cet email est déjà utilisé" };
  }

  const user: LocalUser = {
    id: generateId(),
    email,
    name,
    password_hash: btoa(password), // Simple encoding for local mode
  };

  users.push(user);
  set("pv_users", users);
  set(KEYS.user, { id: user.id, email: user.email, name: user.name });

  // Create default categories
  const categories: Category[] = DEFAULT_CATEGORIES.map((c, i) => ({
    id: generateId(),
    user_id: user.id,
    name: c.name,
    color: c.color,
    icon: c.icon,
    parent_id: null,
    sort_order: i + 1,
    created_at: new Date().toISOString(),
  }));
  set(KEYS.categories, categories);

  return { user, error: null };
}

export function localLogin(
  email: string,
  password: string
): { user: LocalUser | null; error: string | null } {
  const users = get<LocalUser[]>("pv_users", []);
  const user = users.find(
    (u) => u.email === email && u.password_hash === btoa(password)
  );

  if (!user) {
    return { user: null, error: "Email ou mot de passe incorrect" };
  }

  set(KEYS.user, { id: user.id, email: user.email, name: user.name });
  return { user, error: null };
}

export function localGetUser(): {
  id: string;
  email: string;
  name: string;
} | null {
  return get(KEYS.user, null);
}

export function localLogout(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(KEYS.user);
  }
}

// ── Prompts ────────────────────────────────────────

export function localGetPrompts(): Prompt[] {
  const prompts = get<Prompt[]>(KEYS.prompts, []);
  const categories = get<Category[]>(KEYS.categories, []);
  const promptTags = get<{ prompt_id: string; tag_id: string }[]>(
    KEYS.promptTags,
    []
  );
  const tags = get<Tag[]>(KEYS.tags, []);

  return prompts
    .filter((p) => !p.is_deleted)
    .map((p) => ({
      ...p,
      category:
        categories.find((c) => c.id === p.category_id) || null,
      tags: promptTags
        .filter((pt) => pt.prompt_id === p.id)
        .map((pt) => tags.find((t) => t.id === pt.tag_id))
        .filter(Boolean) as Tag[],
    }))
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
}

export function localCreatePrompt(
  userId: string,
  data: PromptFormData
): Prompt {
  const prompts = get<Prompt[]>(KEYS.prompts, []);
  const now = new Date().toISOString();

  const prompt: Prompt = {
    id: generateId(),
    user_id: userId,
    title: data.title,
    content: data.content,
    description: data.description || null,
    category_id: data.category_id || null,
    target_model: (data.target_model as Prompt["target_model"]) || null,
    is_favorite: data.is_favorite || false,
    use_count: 0,
    is_deleted: false,
    deleted_at: null,
    created_at: now,
    updated_at: now,
  };

  prompts.push(prompt);
  set(KEYS.prompts, prompts);

  // Handle tags
  if (data.tag_names?.length) {
    const tags = get<Tag[]>(KEYS.tags, []);
    const promptTags = get<{ prompt_id: string; tag_id: string }[]>(
      KEYS.promptTags,
      []
    );

    for (const tagName of data.tag_names) {
      let tag = tags.find(
        (t) => t.name.toLowerCase() === tagName.toLowerCase()
      );
      if (!tag) {
        tag = { id: generateId(), user_id: userId, name: tagName.trim() };
        tags.push(tag);
      }
      promptTags.push({ prompt_id: prompt.id, tag_id: tag.id });
    }

    set(KEYS.tags, tags);
    set(KEYS.promptTags, promptTags);
  }

  return prompt;
}

export function localUpdatePrompt(id: string, data: PromptFormData): void {
  const prompts = get<Prompt[]>(KEYS.prompts, []);
  const idx = prompts.findIndex((p) => p.id === id);
  if (idx === -1) return;

  // Save version
  const versions = get<
    {
      id: string;
      prompt_id: string;
      title: string;
      content: string;
      description: string | null;
      version_number: number;
      created_at: string;
    }[]
  >(KEYS.versions, []);

  const current = prompts[idx];
  const versionCount = versions.filter((v) => v.prompt_id === id).length;

  versions.push({
    id: generateId(),
    prompt_id: id,
    title: current.title,
    content: current.content,
    description: current.description,
    version_number: versionCount + 1,
    created_at: new Date().toISOString(),
  });

  // Keep only last 10
  const promptVersions = versions.filter((v) => v.prompt_id === id);
  if (promptVersions.length > 10) {
    const oldest = promptVersions.sort(
      (a, b) => a.version_number - b.version_number
    )[0];
    const removeIdx = versions.findIndex((v) => v.id === oldest.id);
    if (removeIdx !== -1) versions.splice(removeIdx, 1);
  }

  set(KEYS.versions, versions);

  // Update prompt
  prompts[idx] = {
    ...prompts[idx],
    title: data.title,
    content: data.content,
    description: data.description || null,
    category_id: data.category_id || null,
    target_model: (data.target_model as Prompt["target_model"]) || null,
    is_favorite: data.is_favorite ?? prompts[idx].is_favorite,
    updated_at: new Date().toISOString(),
  };

  set(KEYS.prompts, prompts);

  // Update tags
  const promptTags = get<{ prompt_id: string; tag_id: string }[]>(
    KEYS.promptTags,
    []
  );
  const filtered = promptTags.filter((pt) => pt.prompt_id !== id);

  if (data.tag_names?.length) {
    const tags = get<Tag[]>(KEYS.tags, []);
    const userId = prompts[idx].user_id;

    for (const tagName of data.tag_names) {
      let tag = tags.find(
        (t) => t.name.toLowerCase() === tagName.toLowerCase()
      );
      if (!tag) {
        tag = { id: generateId(), user_id: userId, name: tagName.trim() };
        tags.push(tag);
      }
      filtered.push({ prompt_id: id, tag_id: tag.id });
    }

    set(KEYS.tags, tags);
  }

  set(KEYS.promptTags, filtered);
}

export function localDeletePrompt(id: string): void {
  const prompts = get<Prompt[]>(KEYS.prompts, []);
  const idx = prompts.findIndex((p) => p.id === id);
  if (idx === -1) return;

  prompts[idx] = {
    ...prompts[idx],
    is_deleted: true,
    deleted_at: new Date().toISOString(),
  };

  set(KEYS.prompts, prompts);
}

export function localToggleFavorite(id: string): boolean {
  const prompts = get<Prompt[]>(KEYS.prompts, []);
  const idx = prompts.findIndex((p) => p.id === id);
  if (idx === -1) return false;

  prompts[idx].is_favorite = !prompts[idx].is_favorite;
  set(KEYS.prompts, prompts);
  return prompts[idx].is_favorite;
}

export function localIncrementUseCount(id: string): number {
  const prompts = get<Prompt[]>(KEYS.prompts, []);
  const idx = prompts.findIndex((p) => p.id === id);
  if (idx === -1) return 0;

  prompts[idx].use_count += 1;
  set(KEYS.prompts, prompts);
  return prompts[idx].use_count;
}

// ── Categories ─────────────────────────────────────

export function localGetCategories(): Category[] {
  return get<Category[]>(KEYS.categories, []).sort(
    (a, b) => a.sort_order - b.sort_order
  );
}

export function localCreateCategory(
  userId: string,
  name: string,
  color: string,
  icon: string
): Category {
  const categories = get<Category[]>(KEYS.categories, []);
  const maxOrder = Math.max(0, ...categories.map((c) => c.sort_order));

  const cat: Category = {
    id: generateId(),
    user_id: userId,
    name,
    color,
    icon,
    parent_id: null,
    sort_order: maxOrder + 1,
    created_at: new Date().toISOString(),
  };

  categories.push(cat);
  set(KEYS.categories, categories);
  return cat;
}

export function localUpdateCategory(
  id: string,
  data: Partial<Category>
): void {
  const categories = get<Category[]>(KEYS.categories, []);
  const idx = categories.findIndex((c) => c.id === id);
  if (idx === -1) return;

  categories[idx] = { ...categories[idx], ...data };
  set(KEYS.categories, categories);
}

export function localDeleteCategory(id: string): void {
  const categories = get<Category[]>(KEYS.categories, []);
  set(
    KEYS.categories,
    categories.filter((c) => c.id !== id)
  );

  // Unset category from prompts
  const prompts = get<Prompt[]>(KEYS.prompts, []);
  prompts.forEach((p) => {
    if (p.category_id === id) p.category_id = null;
  });
  set(KEYS.prompts, prompts);
}

// ── Tags ───────────────────────────────────────────

export function localGetTags(): Tag[] {
  return get<Tag[]>(KEYS.tags, []);
}

export function localCreateTag(userId: string, name: string): Tag | null {
  const tags = get<Tag[]>(KEYS.tags, []);
  const existing = tags.find(
    (t) => t.name.toLowerCase() === name.toLowerCase()
  );
  if (existing) return existing;

  const tag: Tag = { id: generateId(), user_id: userId, name: name.trim() };
  tags.push(tag);
  set(KEYS.tags, tags);
  return tag;
}
