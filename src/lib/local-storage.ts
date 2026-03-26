import type { Prompt, Category, Tag, PromptFormData, SyncSnapshot } from "@/types/database";
import { DEFAULT_CATEGORIES } from "@/types/database";

const KEYS = {
  user: "pv_user",
  users: "pv_users",
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
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function set(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeTagNames(tagNames?: string[]): string[] {
  return [...new Set((tagNames ?? []).map((tag) => tag.trim()).filter(Boolean))];
}

function getActiveUserId(): string | null {
  const currentUser = get<{ id: string } | null>(KEYS.user, null);
  return currentUser?.id ?? null;
}

function setCurrentUser(user: { id: string; email: string; name: string }): void {
  set(KEYS.user, user);
}

function usersForCurrentSession<T extends { user_id: string }>(items: T[]): T[] {
  const userId = getActiveUserId();
  return userId ? items.filter((item) => item.user_id === userId) : [];
}

function mergeUserScopedItems<T extends { user_id: string }>(key: string, userId: string, nextItems: T[]): void {
  const currentItems = get<T[]>(key, []);
  const preservedItems = currentItems.filter((item) => item.user_id !== userId);
  set(key, [...preservedItems, ...nextItems]);
}

export interface LocalUser {
  id: string;
  email: string;
  name: string;
  password_hash: string;
}

export function localUpsertUser(
  id: string,
  email: string,
  name: string,
  password: string
): LocalUser {
  const users = get<LocalUser[]>(KEYS.users, []);
  const passwordHash = btoa(password);
  const existingIndex = users.findIndex((user) => user.id === id || user.email === email);

  const nextUser: LocalUser = {
    id,
    email,
    name,
    password_hash: passwordHash,
  };

  if (existingIndex >= 0) {
    users[existingIndex] = nextUser;
  } else {
    users.push(nextUser);
  }

  set(KEYS.users, users);
  setCurrentUser({ id, email, name });
  localEnsureDefaultCategories(id);

  return nextUser;
}

export function localRegister(
  name: string,
  email: string,
  password: string,
  userId?: string
): { user: LocalUser | null; error: string | null } {
  const users = get<LocalUser[]>(KEYS.users, []);
  const existingUser = users.find((user) => user.email === email);

  if (existingUser && existingUser.id !== userId) {
    return { user: null, error: "Cet email est deja utilise" };
  }

  const user = localUpsertUser(userId ?? generateId(), email, name, password);
  return { user, error: null };
}

export function localLogin(
  email: string,
  password: string
): { user: LocalUser | null; error: string | null } {
  const users = get<LocalUser[]>(KEYS.users, []);
  const user = users.find(
    (candidate) => candidate.email === email && candidate.password_hash === btoa(password)
  );

  if (!user) {
    return { user: null, error: "Email ou mot de passe incorrect" };
  }

  setCurrentUser({ id: user.id, email: user.email, name: user.name });
  localEnsureDefaultCategories(user.id);
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
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEYS.user);
}

export function localEnsureDefaultCategories(userId: string): Category[] {
  const categories = get<Category[]>(KEYS.categories, []);
  const existingCategories = categories.filter((category) => category.user_id === userId);
  if (existingCategories.length > 0) {
    return existingCategories.sort((a, b) => a.sort_order - b.sort_order);
  }

  const nextCategories: Category[] = DEFAULT_CATEGORIES.map((category, index) => ({
    id: generateId(),
    user_id: userId,
    name: category.name,
    color: category.color,
    icon: category.icon,
    parent_id: null,
    sort_order: index + 1,
    created_at: new Date().toISOString(),
  }));

  set(KEYS.categories, [...categories, ...nextCategories]);
  return nextCategories;
}

export function localSyncDataset(userId: string, snapshot: SyncSnapshot): void {
  const promptTagPairs = snapshot.prompts.flatMap((prompt) => {
    const promptTagNames = normalizeTagNames(prompt.tag_names);
    return promptTagNames.map((tagName) => ({ prompt_id: prompt.id, tag_name: tagName }));
  });

  const tagMap = new Map(
    snapshot.tags.map((tag) => [tag.name.toLowerCase(), tag])
  );

  const nextTags = [...snapshot.tags];
  for (const promptTag of promptTagPairs) {
    if (tagMap.has(promptTag.tag_name.toLowerCase())) continue;

    const nextTag: Tag = {
      id: generateId(),
      user_id: userId,
      name: promptTag.tag_name,
    };

    tagMap.set(nextTag.name.toLowerCase(), nextTag);
    nextTags.push(nextTag);
  }

  const promptTags = promptTagPairs
    .map((promptTag) => {
      const tag = tagMap.get(promptTag.tag_name.toLowerCase());
      return tag ? { prompt_id: promptTag.prompt_id, tag_id: tag.id } : null;
    })
    .filter(Boolean);

  mergeUserScopedItems(KEYS.prompts, userId, snapshot.prompts);
  mergeUserScopedItems(KEYS.categories, userId, snapshot.categories);
  mergeUserScopedItems(KEYS.tags, userId, nextTags);

  const existingPromptTags = get<{ prompt_id: string; tag_id: string }[]>(KEYS.promptTags, []);
  const userPromptIds = new Set(snapshot.prompts.map((prompt) => prompt.id));
  const userTagIds = new Set(nextTags.map((tag) => tag.id));
  const preservedPromptTags = existingPromptTags.filter(
    (pair) => !userPromptIds.has(pair.prompt_id) && !userTagIds.has(pair.tag_id)
  );
  set(KEYS.promptTags, [...preservedPromptTags, ...(promptTags as { prompt_id: string; tag_id: string }[])]);
}

export function localGetPrompts(): Prompt[] {
  const prompts = usersForCurrentSession(get<Prompt[]>(KEYS.prompts, []));
  const categories = usersForCurrentSession(get<Category[]>(KEYS.categories, []));
  const tags = usersForCurrentSession(get<Tag[]>(KEYS.tags, []));
  const promptTags = get<{ prompt_id: string; tag_id: string }[]>(KEYS.promptTags, []);
  const tagById = new Map(tags.map((tag) => [tag.id, tag]));
  const tagByName = new Map(tags.map((tag) => [tag.name.toLowerCase(), tag]));

  return prompts
    .filter((prompt) => !prompt.is_deleted)
    .map((prompt) => {
      const promptTagNames = normalizeTagNames(prompt.tag_names);
      const tagsFromNames = promptTagNames
        .map((tagName) => tagByName.get(tagName.toLowerCase()))
        .filter(Boolean) as Tag[];

      const tagsFromPairs = promptTags
        .filter((pair) => pair.prompt_id === prompt.id)
        .map((pair) => tagById.get(pair.tag_id))
        .filter(Boolean) as Tag[];

      const mergedTags = [...new Map(
        [...tagsFromNames, ...tagsFromPairs].map((tag) => [tag.id, tag])
      ).values()];

      return {
        ...prompt,
        tag_names: promptTagNames,
        category: categories.find((category) => category.id === prompt.category_id) ?? null,
        tags: mergedTags,
      };
    })
    .sort(
      (left, right) =>
        new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
    );
}

export function localCreatePrompt(userId: string, data: PromptFormData): Prompt {
  const prompts = get<Prompt[]>(KEYS.prompts, []);
  const tags = get<Tag[]>(KEYS.tags, []);
  const promptTags = get<{ prompt_id: string; tag_id: string }[]>(KEYS.promptTags, []);
  const now = new Date().toISOString();
  const tagNames = normalizeTagNames(data.tag_names);

  const prompt: Prompt = {
    id: generateId(),
    user_id: userId,
    category_id: data.category_id || null,
    title: data.title,
    content: data.content,
    description: data.description || null,
    target_model: (data.target_model as Prompt["target_model"]) || null,
    is_favorite: data.is_favorite || false,
    use_count: 0,
    is_deleted: false,
    deleted_at: null,
    tag_names: tagNames,
    created_at: now,
    updated_at: now,
  };

  prompts.push(prompt);
  set(KEYS.prompts, prompts);

  if (tagNames.length > 0) {
    for (const tagName of tagNames) {
      let tag = tags.find((candidate) => candidate.name.toLowerCase() === tagName.toLowerCase());
      if (!tag) {
        tag = { id: generateId(), user_id: userId, name: tagName };
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
  const index = prompts.findIndex((prompt) => prompt.id === id);
  if (index === -1) return;

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

  const currentPrompt = prompts[index];
  const nextVersionNumber = versions.filter((version) => version.prompt_id === id).length + 1;

  versions.push({
    id: generateId(),
    prompt_id: id,
    title: currentPrompt.title,
    content: currentPrompt.content,
    description: currentPrompt.description,
    version_number: nextVersionNumber,
    created_at: new Date().toISOString(),
  });

  const promptVersions = versions.filter((version) => version.prompt_id === id);
  if (promptVersions.length > 10) {
    const oldestVersion = promptVersions.sort(
      (left, right) => left.version_number - right.version_number
    )[0];
    const oldestIndex = versions.findIndex((version) => version.id === oldestVersion.id);
    if (oldestIndex >= 0) versions.splice(oldestIndex, 1);
  }

  set(KEYS.versions, versions);

  prompts[index] = {
    ...prompts[index],
    title: data.title,
    content: data.content,
    description: data.description || null,
    category_id: data.category_id || null,
    target_model: (data.target_model as Prompt["target_model"]) || null,
    is_favorite: data.is_favorite ?? prompts[index].is_favorite,
    tag_names: normalizeTagNames(data.tag_names),
    updated_at: new Date().toISOString(),
  };

  set(KEYS.prompts, prompts);

  const tags = get<Tag[]>(KEYS.tags, []);
  const promptTags = get<{ prompt_id: string; tag_id: string }[]>(KEYS.promptTags, []);
  const nextPromptTags = promptTags.filter((pair) => pair.prompt_id !== id);
  const tagNames = normalizeTagNames(data.tag_names);

  for (const tagName of tagNames) {
    let tag = tags.find((candidate) => candidate.name.toLowerCase() === tagName.toLowerCase());
    if (!tag) {
      tag = { id: generateId(), user_id: prompts[index].user_id, name: tagName };
      tags.push(tag);
    }

    nextPromptTags.push({ prompt_id: id, tag_id: tag.id });
  }

  set(KEYS.tags, tags);
  set(KEYS.promptTags, nextPromptTags);
}

export function localDeletePrompt(id: string): void {
  const prompts = get<Prompt[]>(KEYS.prompts, []);
  const index = prompts.findIndex((prompt) => prompt.id === id);
  if (index === -1) return;

  const now = new Date().toISOString();
  prompts[index] = {
    ...prompts[index],
    is_deleted: true,
    deleted_at: now,
    updated_at: now,
  };

  set(KEYS.prompts, prompts);
}

export function localToggleFavorite(id: string): boolean {
  const prompts = get<Prompt[]>(KEYS.prompts, []);
  const index = prompts.findIndex((prompt) => prompt.id === id);
  if (index === -1) return false;

  prompts[index] = {
    ...prompts[index],
    is_favorite: !prompts[index].is_favorite,
    updated_at: new Date().toISOString(),
  };

  set(KEYS.prompts, prompts);
  return prompts[index].is_favorite;
}

export function localIncrementUseCount(id: string): number {
  const prompts = get<Prompt[]>(KEYS.prompts, []);
  const index = prompts.findIndex((prompt) => prompt.id === id);
  if (index === -1) return 0;

  prompts[index] = {
    ...prompts[index],
    use_count: prompts[index].use_count + 1,
    updated_at: new Date().toISOString(),
  };

  set(KEYS.prompts, prompts);
  return prompts[index].use_count;
}

export function localGetCategories(): Category[] {
  return usersForCurrentSession(get<Category[]>(KEYS.categories, [])).sort(
    (left, right) => left.sort_order - right.sort_order
  );
}

export function localCreateCategory(
  userId: string,
  name: string,
  color: string,
  icon: string
): Category {
  const categories = get<Category[]>(KEYS.categories, []);
  const nextSortOrder = Math.max(
    0,
    ...categories.filter((category) => category.user_id === userId).map((category) => category.sort_order)
  ) + 1;

  const category: Category = {
    id: generateId(),
    user_id: userId,
    name,
    color,
    icon,
    parent_id: null,
    sort_order: nextSortOrder,
    created_at: new Date().toISOString(),
  };

  categories.push(category);
  set(KEYS.categories, categories);
  return category;
}

export function localUpdateCategory(id: string, data: Partial<Category>): void {
  const categories = get<Category[]>(KEYS.categories, []);
  const index = categories.findIndex((category) => category.id === id);
  if (index === -1) return;

  categories[index] = { ...categories[index], ...data };
  set(KEYS.categories, categories);
}

export function localDeleteCategory(id: string): void {
  const categories = get<Category[]>(KEYS.categories, []);
  set(
    KEYS.categories,
    categories.filter((category) => category.id !== id)
  );

  const prompts = get<Prompt[]>(KEYS.prompts, []);
  const nextPrompts = prompts.map((prompt) =>
    prompt.category_id === id ? { ...prompt, category_id: null, updated_at: new Date().toISOString() } : prompt
  );
  set(KEYS.prompts, nextPrompts);
}

export function localGetTags(): Tag[] {
  return usersForCurrentSession(get<Tag[]>(KEYS.tags, [])).sort((left, right) =>
    left.name.localeCompare(right.name, "fr")
  );
}

export function localCreateTag(userId: string, name: string): Tag | null {
  const normalizedName = name.trim();
  if (!normalizedName) return null;

  const tags = get<Tag[]>(KEYS.tags, []);
  const existingTag = tags.find(
    (tag) => tag.user_id === userId && tag.name.toLowerCase() === normalizedName.toLowerCase()
  );

  if (existingTag) return existingTag;

  const tag: Tag = { id: generateId(), user_id: userId, name: normalizedName };
  tags.push(tag);
  set(KEYS.tags, tags);
  return tag;
}
