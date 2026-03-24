// ═══════════════════════════════════════════════════════════════
// Sync Engine — Firestore (primary) + localStorage (offline cache)
// ═══════════════════════════════════════════════════════════════
//
// Stratégie :
// 1. Toute écriture va d'abord dans localStorage (instantané)
// 2. Si Firebase configuré → push vers Firestore (sync multi-appareils)
// 3. Si offline → Firestore SDK gère le cache natif automatiquement
// 4. Au retour online → Firestore rejoue automatiquement
// ═══════════════════════════════════════════════════════════════

"use client";

import {
  auth,
  isFirebaseConfigured,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
} from "@/lib/firebase";
import {
  canUseFirestore,
  fsGetPrompts,
  fsCreatePrompt,
  fsUpdatePrompt,
  fsDeletePrompt,
  fsToggleFavorite,
  fsIncrementUseCount,
  fsGetCategories,
  fsCreateCategory,
  fsUpdateCategory,
  fsDeleteCategory,
  fsGetTags,
  fsCreateTag,
  fsSyncToLocal,
} from "@/lib/firestore-sync";
import * as local from "@/lib/local-storage";
import type { Prompt, Category, Tag, PromptFormData } from "@/types/database";

// ── Config detection ───────────────────────────────

function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

// Kept for backward compatibility
export function canUseSupabase(): boolean {
  return false;
}

// ── Sync Queue ─────────────────────────────────────

interface SyncAction {
  id: string;
  type: "create_prompt" | "update_prompt" | "delete_prompt" | "toggle_favorite" | "increment_use" | "create_category" | "update_category" | "delete_category" | "create_tag";
  payload: Record<string, unknown>;
  timestamp: string;
}

function getSyncQueue(): SyncAction[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("pv_sync_queue") || "[]");
  } catch {
    return [];
  }
}

function addToSyncQueue(action: Omit<SyncAction, "id" | "timestamp">): void {
  const queue = getSyncQueue();
  queue.push({
    ...action,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  });
  localStorage.setItem("pv_sync_queue", JSON.stringify(queue));
}

function clearSyncQueue(): void {
  localStorage.setItem("pv_sync_queue", "[]");
}

// ── Online status listener ─────────────────────────

let syncCallback: (() => void) | null = null;

export function onSyncNeeded(cb: () => void): () => void {
  syncCallback = cb;

  const handler = () => {
    if (isOnline() && isFirebaseConfigured()) {
      cb();
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("online", handler);
    return () => window.removeEventListener("online", handler);
  }
  return () => {};
}

export function getPendingSyncCount(): number {
  return getSyncQueue().length;
}

// ── Firebase Auth helpers ──────────────────────────

function canUseFirebase(): boolean {
  return isFirebaseConfigured() && auth !== null;
}

function getCurrentUid(): string | null {
  if (auth?.currentUser) return auth.currentUser.uid;
  try {
    const stored = localStorage.getItem("pv_user");
    if (stored) return JSON.parse(stored).id || null;
  } catch { /* ignore */ }
  return null;
}

function firebaseErrorToFrench(code: string): string {
  const map: Record<string, string> = {
    "auth/email-already-in-use": "Cet email est déjà utilisé",
    "auth/invalid-email": "Email invalide",
    "auth/weak-password": "Mot de passe trop faible (6 caractères minimum)",
    "auth/user-not-found": "Aucun compte avec cet email",
    "auth/wrong-password": "Mot de passe incorrect",
    "auth/invalid-credential": "Email ou mot de passe incorrect",
    "auth/too-many-requests": "Trop de tentatives, réessaie plus tard",
    "auth/popup-closed-by-user": "Connexion annulée",
  };
  return map[code] || "Erreur d'authentification";
}

// ── Auth ───────────────────────────────────────────

export async function hybridRegister(
  name: string,
  email: string,
  password: string
): Promise<{ user: { id: string; email: string; name: string } | null; error: string | null }> {
  // Try Firebase first if configured
  if (canUseFirebase()) {
    try {
      const credential = await createUserWithEmailAndPassword(auth!, email, password);
      await updateProfile(credential.user, { displayName: name });

      const user = {
        id: credential.user.uid,
        email: credential.user.email || email,
        name,
      };

      // Also register locally for offline use
      local.localRegister(name, email, password);
      localStorage.setItem("pv_user", JSON.stringify(user));
      localStorage.setItem("pv_firebase_uid", credential.user.uid);

      return { user, error: null };
    } catch (e: unknown) {
      const firebaseError = e as { code?: string };
      return { user: null, error: firebaseErrorToFrench(firebaseError.code || "") };
    }
  }

  // Fallback to local only
  const localResult = local.localRegister(name, email, password);
  if (localResult.error) return { user: null, error: localResult.error };

  return {
    user: {
      id: localResult.user!.id,
      email: localResult.user!.email,
      name: localResult.user!.name,
    },
    error: null,
  };
}

export async function hybridLogin(
  email: string,
  password: string
): Promise<{ user: { id: string; email: string; name: string } | null; error: string | null }> {
  // Try Firebase first if configured
  if (canUseFirebase()) {
    try {
      const credential = await signInWithEmailAndPassword(auth!, email, password);

      const user = {
        id: credential.user.uid,
        email: credential.user.email || email,
        name: credential.user.displayName || email.split("@")[0],
      };

      // Sync to local
      const localResult = local.localLogin(email, password);
      if (localResult.error) {
        // User exists in Firebase but not local — register locally
        local.localRegister(user.name, email, password);
      }

      localStorage.setItem("pv_user", JSON.stringify(user));
      localStorage.setItem("pv_firebase_uid", credential.user.uid);

      return { user, error: null };
    } catch (e: unknown) {
      const firebaseError = e as { code?: string };
      return { user: null, error: firebaseErrorToFrench(firebaseError.code || "") };
    }
  }

  // Fallback to local
  const localResult = local.localLogin(email, password);
  if (localResult.error) return { user: null, error: localResult.error };

  return {
    user: {
      id: localResult.user!.id,
      email: localResult.user!.email,
      name: localResult.user!.name,
    },
    error: null,
  };
}

export async function hybridOAuthLogin(
  provider: "google" | "github"
): Promise<{ user: { id: string; email: string; name: string } | null; error: string | null }> {
  if (!canUseFirebase()) {
    return { user: null, error: "Firebase non configuré" };
  }

  try {
    const authProvider = provider === "google"
      ? new GoogleAuthProvider()
      : new GithubAuthProvider();

    const credential = await signInWithPopup(auth!, authProvider);

    const user = {
      id: credential.user.uid,
      email: credential.user.email || "",
      name: credential.user.displayName || credential.user.email?.split("@")[0] || "",
    };

    // Register locally for offline
    const localResult = local.localLogin(user.email, "oauth-" + credential.user.uid);
    if (localResult.error) {
      local.localRegister(user.name, user.email, "oauth-" + credential.user.uid);
    }

    localStorage.setItem("pv_user", JSON.stringify(user));
    localStorage.setItem("pv_firebase_uid", credential.user.uid);

    return { user, error: null };
  } catch (e: unknown) {
    const firebaseError = e as { code?: string };
    return { user: null, error: firebaseErrorToFrench(firebaseError.code || "") };
  }
}

export async function hybridLogout(): Promise<void> {
  local.localLogout();
  if (canUseFirebase()) {
    try {
      await firebaseSignOut(auth!);
    } catch {
      // Ignore
    }
  }
}

export async function hybridGetUser(): Promise<{
  id: string;
  email: string;
  name: string;
} | null> {
  // Check Firebase session first
  if (canUseFirebase()) {
    try {
      const firebaseUser = auth!.currentUser;
      if (firebaseUser) {
        const user = {
          id: firebaseUser.uid,
          email: firebaseUser.email || "",
          name: firebaseUser.displayName || "",
        };
        localStorage.setItem("pv_user", JSON.stringify(user));
        return user;
      }

      // Firebase may not have loaded yet — check promise
      const freshUser = await new Promise<{ id: string; email: string; name: string } | null>(
        (resolve) => {
          const { onAuthStateChanged } = require("firebase/auth");
          const unsub = onAuthStateChanged(auth!, (u: import("firebase/auth").User | null) => {
            unsub();
            if (u) {
              resolve({
                id: u.uid,
                email: u.email || "",
                name: u.displayName || "",
              });
            } else {
              resolve(null);
            }
          });
          // Timeout after 3s
          setTimeout(() => resolve(null), 3000);
        }
      );

      if (freshUser) {
        localStorage.setItem("pv_user", JSON.stringify(freshUser));
        return freshUser;
      }
    } catch {
      // Fall through
    }
  }

  // Fallback to local
  return local.localGetUser();
}

// ── Prompts ────────────────────────────────────────

export async function hybridFetchPrompts(): Promise<Prompt[]> {
  const uid = getCurrentUid();
  if (canUseFirestore() && uid) {
    try {
      const prompts = await fsGetPrompts(uid);
      localStorage.setItem("pv_prompts", JSON.stringify(prompts));
      return prompts;
    } catch {
      console.warn("Firestore fetch failed, using local cache");
    }
  }
  return local.localGetPrompts();
}

export async function hybridCreatePrompt(
  userId: string,
  data: PromptFormData
): Promise<Prompt> {
  const localPrompt = local.localCreatePrompt(userId, data);
  if (canUseFirestore()) {
    try {
      await fsCreatePrompt(userId, localPrompt.id, data);
    } catch (e) {
      console.warn("Firestore create prompt failed:", e);
    }
  }
  return localPrompt;
}

export async function hybridUpdatePrompt(
  id: string,
  data: PromptFormData
): Promise<void> {
  local.localUpdatePrompt(id, data);
  const uid = getCurrentUid();
  if (canUseFirestore() && uid) {
    try {
      await fsUpdatePrompt(uid, id, data);
    } catch (e) {
      console.warn("Firestore update prompt failed:", e);
    }
  }
}

export async function hybridDeletePrompt(id: string): Promise<void> {
  local.localDeletePrompt(id);
  const uid = getCurrentUid();
  if (canUseFirestore() && uid) {
    try {
      await fsDeletePrompt(uid, id);
    } catch (e) {
      console.warn("Firestore delete prompt failed:", e);
    }
  }
}

export async function hybridToggleFavorite(id: string): Promise<boolean> {
  const newVal = local.localToggleFavorite(id);
  const uid = getCurrentUid();
  if (canUseFirestore() && uid) {
    try {
      await fsToggleFavorite(uid, id, newVal);
    } catch {
      // Non-critical
    }
  }
  return newVal;
}

export async function hybridIncrementUseCount(id: string): Promise<number> {
  const newCount = local.localIncrementUseCount(id);
  const uid = getCurrentUid();
  if (canUseFirestore() && uid) {
    try {
      await fsIncrementUseCount(uid, id, newCount);
    } catch {
      // Non-critical
    }
  }
  return newCount;
}

// ── Categories ─────────────────────────────────────

export async function hybridFetchCategories(): Promise<Category[]> {
  const uid = getCurrentUid();
  if (canUseFirestore() && uid) {
    try {
      const data = await fsGetCategories(uid);
      localStorage.setItem("pv_categories", JSON.stringify(data));
      return data;
    } catch {
      // Fall through
    }
  }
  return local.localGetCategories();
}

export async function hybridCreateCategory(
  userId: string,
  name: string,
  color: string,
  icon: string
): Promise<Category> {
  const cat = local.localCreateCategory(userId, name, color, icon);
  if (canUseFirestore()) {
    try {
      await fsCreateCategory(userId, cat.id, name, color, icon, cat.sort_order);
    } catch (e) {
      console.warn("Firestore create category failed:", e);
    }
  }
  return cat;
}

export async function hybridUpdateCategory(
  id: string,
  data: Partial<Category>
): Promise<void> {
  local.localUpdateCategory(id, data);
  const uid = getCurrentUid();
  if (canUseFirestore() && uid) {
    try {
      await fsUpdateCategory(uid, id, data);
    } catch (e) {
      console.warn("Firestore update category failed:", e);
    }
  }
}

export async function hybridDeleteCategory(id: string): Promise<void> {
  local.localDeleteCategory(id);
  const uid = getCurrentUid();
  if (canUseFirestore() && uid) {
    try {
      await fsDeleteCategory(uid, id);
    } catch (e) {
      console.warn("Firestore delete category failed:", e);
    }
  }
}

// ── Tags ───────────────────────────────────────────

export async function hybridFetchTags(): Promise<Tag[]> {
  const uid = getCurrentUid();
  if (canUseFirestore() && uid) {
    try {
      const data = await fsGetTags(uid);
      localStorage.setItem("pv_tags", JSON.stringify(data));
      return data;
    } catch {
      // Fall through
    }
  }
  return local.localGetTags();
}

export async function hybridCreateTag(
  userId: string,
  name: string
): Promise<Tag | null> {
  const tag = local.localCreateTag(userId, name);
  if (canUseFirestore() && tag) {
    try {
      await fsCreateTag(userId, tag.id, name);
    } catch (e) {
      console.warn("Firestore create tag failed:", e);
    }
  }
  return tag;
}

// ── Full Sync depuis le cloud ──────────────────────

export async function replaySync(): Promise<number> {
  const uid = getCurrentUid();
  if (!canUseFirestore() || !uid) return 0;
  try {
    await fsSyncToLocal(uid);
    clearSyncQueue();
    return 1;
  } catch {
    return 0;
  }
  }

  clearSyncQueue();
  return synced;
}
