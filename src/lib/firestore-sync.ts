// ═══════════════════════════════════════════════════════════════
// Firestore Sync — sync temps réel multi-appareils via Firebase
// ═══════════════════════════════════════════════════════════════
//
// Architecture :
// 1. Chaque utilisateur a ses données sous /users/{uid}/
// 2. Écritures locales immédiates + push Firestore async
// 3. onSnapshot = sync temps réel (autre appareil → mise à jour auto)
// 4. Offline : Firestore SDK gère le cache local natif
// ═══════════════════════════════════════════════════════════════

"use client";

import {
  db,
  isFirebaseConfigured,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "@/lib/firebase";
import type { Prompt, Category, Tag, PromptFormData } from "@/types/database";

// ── Guards ─────────────────────────────────────────

export function canUseFirestore(): boolean {
  return isFirebaseConfigured() && db !== null;
}

function getDb() {
  if (!db) throw new Error("Firestore non disponible");
  return db;
}

// ── Chemins Firestore ──────────────────────────────

const paths = {
  prompts: (uid: string) => collection(getDb(), "users", uid, "prompts"),
  prompt:  (uid: string, id: string) => doc(getDb(), "users", uid, "prompts", id),
  cats:    (uid: string) => collection(getDb(), "users", uid, "categories"),
  cat:     (uid: string, id: string) => doc(getDb(), "users", uid, "categories", id),
  tags:    (uid: string) => collection(getDb(), "users", uid, "tags"),
  tag:     (uid: string, id: string) => doc(getDb(), "users", uid, "tags", id),
};

// ── Prompts ────────────────────────────────────────

export async function fsGetPrompts(uid: string): Promise<Prompt[]> {
  const q = query(paths.prompts(uid), where("is_deleted", "==", false), orderBy("updated_at", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Prompt));
}

export async function fsCreatePrompt(uid: string, id: string, data: PromptFormData): Promise<void> {
  await setDoc(paths.prompt(uid, id), {
    user_id: uid,
    title: data.title,
    content: data.content,
    description: data.description || null,
    category_id: data.category_id || null,
    target_model: data.target_model || null,
    tag_names: data.tag_names || [],
    is_favorite: data.is_favorite || false,
    is_deleted: false,
    use_count: 0,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
}

export async function fsUpdatePrompt(uid: string, id: string, data: Partial<PromptFormData>): Promise<void> {
  await updateDoc(paths.prompt(uid, id), {
    ...data,
    updated_at: serverTimestamp(),
  });
}

export async function fsDeletePrompt(uid: string, id: string): Promise<void> {
  await updateDoc(paths.prompt(uid, id), {
    is_deleted: true,
    deleted_at: serverTimestamp(),
  });
}

export async function fsToggleFavorite(uid: string, id: string, value: boolean): Promise<void> {
  await updateDoc(paths.prompt(uid, id), { is_favorite: value, updated_at: serverTimestamp() });
}

export async function fsIncrementUseCount(uid: string, id: string, count: number): Promise<void> {
  await updateDoc(paths.prompt(uid, id), { use_count: count });
}

// ── Categories ─────────────────────────────────────

export async function fsGetCategories(uid: string): Promise<Category[]> {
  const q = query(paths.cats(uid), orderBy("sort_order", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Category));
}

export async function fsCreateCategory(uid: string, id: string, name: string, color: string, icon: string, sort_order: number): Promise<void> {
  await setDoc(paths.cat(uid, id), {
    user_id: uid,
    name,
    color,
    icon,
    sort_order,
    created_at: serverTimestamp(),
  });
}

export async function fsUpdateCategory(uid: string, id: string, data: Partial<Category>): Promise<void> {
  await updateDoc(paths.cat(uid, id), data);
}

export async function fsDeleteCategory(uid: string, id: string): Promise<void> {
  // Detach prompts from this category
  const q = query(paths.prompts(uid), where("category_id", "==", id));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map(d => updateDoc(d.ref, { category_id: null })));
  await deleteDoc(paths.cat(uid, id));
}

// ── Tags ───────────────────────────────────────────

export async function fsGetTags(uid: string): Promise<Tag[]> {
  const snap = await getDocs(paths.tags(uid));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Tag));
}

export async function fsCreateTag(uid: string, id: string, name: string): Promise<void> {
  await setDoc(paths.tag(uid, id), {
    user_id: uid,
    name: name.trim(),
    created_at: serverTimestamp(),
  });
}

// ── Sync depuis Firestore vers localStorage ────────

export async function fsSyncToLocal(uid: string): Promise<void> {
  const [prompts, categories, tags] = await Promise.all([
    fsGetPrompts(uid),
    fsGetCategories(uid),
    fsGetTags(uid),
  ]);

  localStorage.setItem("pv_prompts", JSON.stringify(prompts));
  localStorage.setItem("pv_categories", JSON.stringify(categories));
  localStorage.setItem("pv_tags", JSON.stringify(tags));
}
