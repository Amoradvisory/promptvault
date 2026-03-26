"use client";

import {
  db,
  isFirebaseConfigured,
  collection,
  doc,
  setDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "@/lib/firebase";
import * as local from "@/lib/local-storage";
import type { Prompt, Category, Tag, PromptFormData, SyncSnapshot } from "@/types/database";

type FirestoreRecord = Record<string, unknown>;

function normalizeTimestamp(value: unknown, fallback = new Date().toISOString()): string {
  if (!value) return fallback;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();

  if (typeof value === "object" && value !== null && "toDate" in value) {
    const toDate = (value as { toDate?: () => Date }).toDate;
    if (typeof toDate === "function") {
      return toDate().toISOString();
    }
  }

  return fallback;
}

function normalizeTagNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((tag) => String(tag).trim()).filter(Boolean))];
}

function normalizePrompt(id: string, raw: FirestoreRecord): Prompt {
  const createdAt = normalizeTimestamp(
    raw.created_at,
    normalizeTimestamp(raw.client_created_at)
  );
  const updatedAt = normalizeTimestamp(
    raw.updated_at,
    normalizeTimestamp(raw.client_updated_at, createdAt)
  );

  return {
    id,
    user_id: String(raw.user_id ?? ""),
    title: String(raw.title ?? ""),
    content: String(raw.content ?? ""),
    description: raw.description ? String(raw.description) : null,
    category_id: raw.category_id ? String(raw.category_id) : null,
    target_model:
      raw.target_model === "claude" ||
      raw.target_model === "gpt" ||
      raw.target_model === "gemini" ||
      raw.target_model === "other"
        ? raw.target_model
        : null,
    is_favorite: Boolean(raw.is_favorite),
    use_count: Number(raw.use_count ?? 0),
    is_deleted: Boolean(raw.is_deleted),
    deleted_at: raw.deleted_at ? normalizeTimestamp(raw.deleted_at, updatedAt) : null,
    tag_names: normalizeTagNames(raw.tag_names),
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function normalizeCategory(id: string, raw: FirestoreRecord): Category {
  return {
    id,
    user_id: String(raw.user_id ?? ""),
    name: String(raw.name ?? ""),
    color: String(raw.color ?? "#6C5CE7"),
    icon: String(raw.icon ?? "folder"),
    parent_id: raw.parent_id ? String(raw.parent_id) : null,
    sort_order: Number(raw.sort_order ?? 0),
    created_at: normalizeTimestamp(raw.created_at),
  };
}

function normalizeTag(id: string, raw: FirestoreRecord): Tag {
  return {
    id,
    user_id: String(raw.user_id ?? ""),
    name: String(raw.name ?? ""),
  };
}

export function hydratePromptRelations(
  prompts: Prompt[],
  categories: Category[],
  tags: Tag[]
): Prompt[] {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const tagByName = new Map(tags.map((tag) => [tag.name.toLowerCase(), tag]));

  return prompts.map((prompt) => ({
    ...prompt,
    category: prompt.category_id ? categoryById.get(prompt.category_id) ?? null : null,
    tags: prompt.tag_names
      .map((tagName) => tagByName.get(tagName.toLowerCase()))
      .filter(Boolean) as Tag[],
  }));
}

export function canUseFirestore(): boolean {
  return isFirebaseConfigured() && db !== null;
}

function getDb() {
  if (!db) throw new Error("Firestore non disponible");
  return db;
}

const paths = {
  prompts: (uid: string) => collection(getDb(), "users", uid, "prompts"),
  prompt: (uid: string, id: string) => doc(getDb(), "users", uid, "prompts", id),
  cats: (uid: string) => collection(getDb(), "users", uid, "categories"),
  cat: (uid: string, id: string) => doc(getDb(), "users", uid, "categories", id),
  tags: (uid: string) => collection(getDb(), "users", uid, "tags"),
  tag: (uid: string, id: string) => doc(getDb(), "users", uid, "tags", id),
};

export async function fsGetPrompts(uid: string): Promise<Prompt[]> {
  const promptsQuery = query(
    paths.prompts(uid),
    where("is_deleted", "==", false),
    orderBy("updated_at", "desc")
  );
  const snapshot = await getDocs(promptsQuery);
  return snapshot.docs.map((document) => normalizePrompt(document.id, document.data() as FirestoreRecord));
}

export async function fsCreatePrompt(uid: string, id: string, data: PromptFormData): Promise<void> {
  const now = new Date().toISOString();
  await setDoc(paths.prompt(uid, id), {
    user_id: uid,
    title: data.title,
    content: data.content,
    description: data.description || null,
    category_id: data.category_id || null,
    target_model: data.target_model || null,
    tag_names: normalizeTagNames(data.tag_names),
    is_favorite: data.is_favorite || false,
    is_deleted: false,
    use_count: 0,
    deleted_at: null,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    client_created_at: now,
    client_updated_at: now,
  });
}

export async function fsUpdatePrompt(uid: string, id: string, data: Partial<PromptFormData>): Promise<void> {
  const nextData: Record<string, unknown> = {
    updated_at: serverTimestamp(),
    client_updated_at: new Date().toISOString(),
  };

  if ("title" in data) nextData.title = data.title;
  if ("content" in data) nextData.content = data.content;
  if ("description" in data) nextData.description = data.description || null;
  if ("category_id" in data) nextData.category_id = data.category_id || null;
  if ("target_model" in data) nextData.target_model = data.target_model || null;
  if ("is_favorite" in data) nextData.is_favorite = data.is_favorite;
  if ("tag_names" in data) nextData.tag_names = normalizeTagNames(data.tag_names);

  await updateDoc(paths.prompt(uid, id), nextData);
}

export async function fsDeletePrompt(uid: string, id: string): Promise<void> {
  const now = new Date().toISOString();
  await updateDoc(paths.prompt(uid, id), {
    is_deleted: true,
    deleted_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    client_updated_at: now,
  });
}

export async function fsToggleFavorite(uid: string, id: string, value: boolean): Promise<void> {
  await updateDoc(paths.prompt(uid, id), {
    is_favorite: value,
    updated_at: serverTimestamp(),
    client_updated_at: new Date().toISOString(),
  });
}

export async function fsIncrementUseCount(uid: string, id: string, count: number): Promise<void> {
  await updateDoc(paths.prompt(uid, id), {
    use_count: count,
    updated_at: serverTimestamp(),
    client_updated_at: new Date().toISOString(),
  });
}

export async function fsGetCategories(uid: string): Promise<Category[]> {
  const categoriesQuery = query(paths.cats(uid), orderBy("sort_order", "asc"));
  const snapshot = await getDocs(categoriesQuery);
  return snapshot.docs.map((document) => normalizeCategory(document.id, document.data() as FirestoreRecord));
}

export async function fsCreateCategory(
  uid: string,
  id: string,
  name: string,
  color: string,
  icon: string,
  sortOrder: number
): Promise<void> {
  await setDoc(paths.cat(uid, id), {
    user_id: uid,
    name,
    color,
    icon,
    parent_id: null,
    sort_order: sortOrder,
    created_at: serverTimestamp(),
  });
}

export async function fsUpdateCategory(uid: string, id: string, data: Partial<Category>): Promise<void> {
  const nextData = Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  );

  await updateDoc(paths.cat(uid, id), nextData);
}

export async function fsDeleteCategory(uid: string, id: string): Promise<void> {
  const promptsQuery = query(paths.prompts(uid), where("category_id", "==", id));
  const snapshot = await getDocs(promptsQuery);
  await Promise.all(
    snapshot.docs.map((document) =>
      updateDoc(document.ref, {
        category_id: null,
        updated_at: serverTimestamp(),
        client_updated_at: new Date().toISOString(),
      })
    )
  );
  await deleteDoc(paths.cat(uid, id));
}

export async function fsGetTags(uid: string): Promise<Tag[]> {
  const snapshot = await getDocs(paths.tags(uid));
  return snapshot.docs
    .map((document) => normalizeTag(document.id, document.data() as FirestoreRecord))
    .sort((left, right) => left.name.localeCompare(right.name, "fr"));
}

export async function fsCreateTag(uid: string, id: string, name: string): Promise<void> {
  await setDoc(paths.tag(uid, id), {
    user_id: uid,
    name: name.trim(),
    created_at: serverTimestamp(),
  });
}

export async function fsPullAll(uid: string): Promise<SyncSnapshot> {
  const [prompts, categories, tags] = await Promise.all([
    fsGetPrompts(uid),
    fsGetCategories(uid),
    fsGetTags(uid),
  ]);

  return {
    prompts: hydratePromptRelations(prompts, categories, tags),
    categories,
    tags,
  };
}

export async function fsSyncToLocal(uid: string): Promise<SyncSnapshot> {
  const snapshot = await fsPullAll(uid);
  local.localSyncDataset(uid, snapshot);

  return {
    prompts: local.localGetPrompts(),
    categories: local.localGetCategories(),
    tags: local.localGetTags(),
  };
}

export function fsSubscribeUserData(
  uid: string,
  onData: (snapshot: SyncSnapshot) => void,
  onError?: (error: unknown) => void
): () => void {
  if (!canUseFirestore()) return () => {};

  let prompts: Prompt[] = [];
  let categories: Category[] = [];
  let tags: Tag[] = [];
  let promptsReady = false;
  let categoriesReady = false;
  let tagsReady = false;

  const emit = () => {
    if (!promptsReady || !categoriesReady || !tagsReady) return;
    onData({
      prompts: hydratePromptRelations(prompts, categories, tags),
      categories,
      tags,
    });
  };

  const unsubscribePrompts = onSnapshot(
    query(paths.prompts(uid), where("is_deleted", "==", false), orderBy("updated_at", "desc")),
    (snapshot) => {
      prompts = snapshot.docs.map((document) => normalizePrompt(document.id, document.data() as FirestoreRecord));
      promptsReady = true;
      emit();
    },
    onError
  );

  const unsubscribeCategories = onSnapshot(
    query(paths.cats(uid), orderBy("sort_order", "asc")),
    (snapshot) => {
      categories = snapshot.docs.map((document) =>
        normalizeCategory(document.id, document.data() as FirestoreRecord)
      );
      categoriesReady = true;
      emit();
    },
    onError
  );

  const unsubscribeTags = onSnapshot(
    paths.tags(uid),
    (snapshot) => {
      tags = snapshot.docs
        .map((document) => normalizeTag(document.id, document.data() as FirestoreRecord))
        .sort((left, right) => left.name.localeCompare(right.name, "fr"));
      tagsReady = true;
      emit();
    },
    onError
  );

  return () => {
    unsubscribePrompts();
    unsubscribeCategories();
    unsubscribeTags();
  };
}
