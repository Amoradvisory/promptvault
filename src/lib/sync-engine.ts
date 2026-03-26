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
  onAuthStateChanged,
} from "@/lib/firebase";
import {
  canUseFirestore,
  fsGetCategories,
  fsGetPrompts,
  fsGetTags,
  fsCreatePrompt,
  fsUpdatePrompt,
  fsDeletePrompt,
  fsToggleFavorite,
  fsIncrementUseCount,
  fsCreateCategory,
  fsUpdateCategory,
  fsDeleteCategory,
  fsCreateTag,
  fsSyncToLocal,
  fsSubscribeUserData,
} from "@/lib/firestore-sync";
import * as local from "@/lib/local-storage";
import type { Prompt, Category, Tag, PromptFormData, SyncSnapshot } from "@/types/database";

type SyncActionType =
  | "create_prompt"
  | "update_prompt"
  | "delete_prompt"
  | "toggle_favorite"
  | "increment_use"
  | "create_category"
  | "update_category"
  | "delete_category"
  | "create_tag";

interface SyncAction {
  id: string;
  type: SyncActionType;
  payload: Record<string, unknown>;
  timestamp: string;
}

interface AppUser {
  id: string;
  email: string;
  name: string;
}

function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

export function canUseCloudSync(): boolean {
  return isFirebaseConfigured() && auth !== null && canUseFirestore();
}

function getCurrentUid(): string | null {
  if (auth?.currentUser?.uid) return auth.currentUser.uid;
  return local.localGetUser()?.id ?? null;
}

function rememberUser(user: AppUser): void {
  localStorage.setItem("pv_user", JSON.stringify(user));
  local.localEnsureDefaultCategories(user.id);
}

function firebaseErrorToFrench(code: string): string {
  const messages: Record<string, string> = {
    "auth/email-already-in-use": "Cet email est deja utilise",
    "auth/invalid-email": "Email invalide",
    "auth/weak-password": "Mot de passe trop faible (6 caracteres minimum)",
    "auth/user-not-found": "Aucun compte avec cet email",
    "auth/wrong-password": "Mot de passe incorrect",
    "auth/invalid-credential": "Email ou mot de passe incorrect",
    "auth/too-many-requests": "Trop de tentatives, reessaie plus tard",
    "auth/popup-closed-by-user": "Connexion annulee",
    "auth/popup-blocked": "Le navigateur a bloque la fenetre de connexion",
  };

  return messages[code] || "Erreur d'authentification";
}

function getSyncQueue(): SyncAction[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("pv_sync_queue") || "[]") as SyncAction[];
  } catch {
    return [];
  }
}

function saveSyncQueue(queue: SyncAction[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("pv_sync_queue", JSON.stringify(queue));
}

function addToSyncQueue(action: Omit<SyncAction, "id" | "timestamp">): void {
  const queue = getSyncQueue();
  queue.push({
    ...action,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  });
  saveSyncQueue(queue);
}

function shouldQueue(uid: string | null): uid is string {
  return Boolean(isFirebaseConfigured() && uid);
}

async function runCloudWrite(
  uid: string | null,
  action: Omit<SyncAction, "id" | "timestamp">,
  operation: () => Promise<void>
): Promise<void> {
  if (!shouldQueue(uid)) return;

  if (!canUseCloudSync() || !isOnline()) {
    addToSyncQueue(action);
    return;
  }

  try {
    await operation();
  } catch (error) {
    console.warn("Echec de sync cloud, action mise en attente", error);
    addToSyncQueue(action);
  }
}

export function onSyncNeeded(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = () => {
    if (isOnline() && canUseCloudSync()) {
      callback();
    }
  };

  window.addEventListener("online", handler);
  return () => window.removeEventListener("online", handler);
}

export function getPendingSyncCount(): number {
  return getSyncQueue().length;
}

async function ensureDefaultCategories(uid: string): Promise<void> {
  local.localEnsureDefaultCategories(uid);

  if (!canUseCloudSync()) return;

  const existingCategories = await fsGetCategories(uid);
  if (existingCategories.length > 0) return;

  const localCategories = local.localGetCategories();
  await Promise.all(
    localCategories.map((category) =>
      fsCreateCategory(
        uid,
        category.id,
        category.name,
        category.color,
        category.icon,
        category.sort_order
      )
    )
  );
}

export async function hybridRegister(
  name: string,
  email: string,
  password: string
): Promise<{ user: AppUser | null; error: string | null }> {
  if (isFirebaseConfigured() && auth) {
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: name });

      const user: AppUser = {
        id: credential.user.uid,
        email: credential.user.email || email,
        name,
      };

      local.localUpsertUser(user.id, user.email, user.name, password);
      rememberUser(user);
      await ensureDefaultCategories(user.id);

      return { user, error: null };
    } catch (error) {
      const firebaseError = error as { code?: string };
      return { user: null, error: firebaseErrorToFrench(firebaseError.code || "") };
    }
  }

  const result = local.localRegister(name, email, password);
  if (result.error || !result.user) {
    return { user: null, error: result.error };
  }

  return {
    user: {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
    },
    error: null,
  };
}

export async function hybridLogin(
  email: string,
  password: string
): Promise<{ user: AppUser | null; error: string | null }> {
  if (isFirebaseConfigured() && auth) {
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const user: AppUser = {
        id: credential.user.uid,
        email: credential.user.email || email,
        name: credential.user.displayName || email.split("@")[0],
      };

      local.localUpsertUser(user.id, user.email, user.name, password);
      rememberUser(user);
      await ensureDefaultCategories(user.id);

      return { user, error: null };
    } catch (error) {
      const firebaseError = error as { code?: string };
      return { user: null, error: firebaseErrorToFrench(firebaseError.code || "") };
    }
  }

  const result = local.localLogin(email, password);
  if (result.error || !result.user) {
    return { user: null, error: result.error };
  }

  return {
    user: {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
    },
    error: null,
  };
}

export async function hybridOAuthLogin(
  provider: "google" | "github"
): Promise<{ user: AppUser | null; error: string | null }> {
  if (!isFirebaseConfigured() || !auth) {
    return { user: null, error: "Firebase non configure" };
  }

  try {
    const authProvider = provider === "google" ? new GoogleAuthProvider() : new GithubAuthProvider();
    const credential = await signInWithPopup(auth, authProvider);
    const fallbackPassword = `oauth-${credential.user.uid}`;

    const user: AppUser = {
      id: credential.user.uid,
      email: credential.user.email || "",
      name: credential.user.displayName || credential.user.email?.split("@")[0] || "Utilisateur",
    };

    local.localUpsertUser(user.id, user.email, user.name, fallbackPassword);
    rememberUser(user);
    await ensureDefaultCategories(user.id);

    return { user, error: null };
  } catch (error) {
    const firebaseError = error as { code?: string };
    return { user: null, error: firebaseErrorToFrench(firebaseError.code || "") };
  }
}

export async function hybridLogout(): Promise<void> {
  local.localLogout();

  if (auth) {
    try {
      await firebaseSignOut(auth);
    } catch {
      // Ignore sign-out failures and keep local logout.
    }
  }
}

export async function hybridGetUser(): Promise<AppUser | null> {
  const firebaseAuth = auth;

  if (firebaseAuth && isFirebaseConfigured()) {
    if (firebaseAuth.currentUser) {
      const user: AppUser = {
        id: firebaseAuth.currentUser.uid,
        email: firebaseAuth.currentUser.email || "",
        name:
          firebaseAuth.currentUser.displayName ||
          firebaseAuth.currentUser.email?.split("@")[0] ||
          "Utilisateur",
      };
      rememberUser(user);
      return user;
    }

    try {
      const user = await new Promise<AppUser | null>((resolve) => {
        const timeout = window.setTimeout(() => resolve(null), 3000);
        const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
          window.clearTimeout(timeout);
          unsubscribe();

          if (!firebaseUser) {
            resolve(null);
            return;
          }

          resolve({
            id: firebaseUser.uid,
            email: firebaseUser.email || "",
            name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Utilisateur",
          });
        });
      });

      if (user) {
        rememberUser(user);
        return user;
      }
    } catch {
      // Fall through to local mode.
    }
  }

  return local.localGetUser();
}

export async function hybridFetchAllData(): Promise<SyncSnapshot> {
  const uid = getCurrentUid();

  if (uid) {
    local.localEnsureDefaultCategories(uid);
  }

  if (canUseCloudSync() && uid) {
    try {
      await ensureDefaultCategories(uid);
      if (isOnline() && getPendingSyncCount() > 0) {
        await replaySync();
      }
      return await fsSyncToLocal(uid);
    } catch (error) {
      console.warn("Lecture cloud indisponible, fallback local", error);
    }
  }

  return {
    prompts: local.localGetPrompts(),
    categories: local.localGetCategories(),
    tags: local.localGetTags(),
  };
}

export async function hybridFetchPrompts(): Promise<Prompt[]> {
  return (await hybridFetchAllData()).prompts;
}

export async function hybridFetchCategories(): Promise<Category[]> {
  return (await hybridFetchAllData()).categories;
}

export async function hybridFetchTags(): Promise<Tag[]> {
  return (await hybridFetchAllData()).tags;
}

export async function hybridCreatePrompt(userId: string, data: PromptFormData): Promise<Prompt> {
  const prompt = local.localCreatePrompt(userId, data);

  await runCloudWrite(
    userId,
    {
      type: "create_prompt",
      payload: { uid: userId, id: prompt.id, data },
    },
    () => fsCreatePrompt(userId, prompt.id, data)
  );

  return prompt;
}

export async function hybridUpdatePrompt(id: string, data: PromptFormData): Promise<void> {
  local.localUpdatePrompt(id, data);
  const uid = getCurrentUid();

  await runCloudWrite(
    uid,
    {
      type: "update_prompt",
      payload: { uid, id, data },
    },
    () => fsUpdatePrompt(uid!, id, data)
  );
}

export async function hybridDeletePrompt(id: string): Promise<void> {
  local.localDeletePrompt(id);
  const uid = getCurrentUid();

  await runCloudWrite(
    uid,
    {
      type: "delete_prompt",
      payload: { uid, id },
    },
    () => fsDeletePrompt(uid!, id)
  );
}

export async function hybridToggleFavorite(id: string): Promise<boolean> {
  const nextValue = local.localToggleFavorite(id);
  const uid = getCurrentUid();

  await runCloudWrite(
    uid,
    {
      type: "toggle_favorite",
      payload: { uid, id, value: nextValue },
    },
    () => fsToggleFavorite(uid!, id, nextValue)
  );

  return nextValue;
}

export async function hybridIncrementUseCount(id: string): Promise<number> {
  const nextCount = local.localIncrementUseCount(id);
  const uid = getCurrentUid();

  await runCloudWrite(
    uid,
    {
      type: "increment_use",
      payload: { uid, id, count: nextCount },
    },
    () => fsIncrementUseCount(uid!, id, nextCount)
  );

  return nextCount;
}

export async function hybridCreateCategory(
  userId: string,
  name: string,
  color: string,
  icon: string
): Promise<Category> {
  const category = local.localCreateCategory(userId, name, color, icon);

  await runCloudWrite(
    userId,
    {
      type: "create_category",
      payload: {
        uid: userId,
        id: category.id,
        name,
        color,
        icon,
        sortOrder: category.sort_order,
      },
    },
    () => fsCreateCategory(userId, category.id, name, color, icon, category.sort_order)
  );

  return category;
}

export async function hybridUpdateCategory(id: string, data: Partial<Category>): Promise<void> {
  local.localUpdateCategory(id, data);
  const uid = getCurrentUid();

  await runCloudWrite(
    uid,
    {
      type: "update_category",
      payload: { uid, id, data },
    },
    () => fsUpdateCategory(uid!, id, data)
  );
}

export async function hybridDeleteCategory(id: string): Promise<void> {
  local.localDeleteCategory(id);
  const uid = getCurrentUid();

  await runCloudWrite(
    uid,
    {
      type: "delete_category",
      payload: { uid, id },
    },
    () => fsDeleteCategory(uid!, id)
  );
}

export async function hybridCreateTag(userId: string, name: string): Promise<Tag | null> {
  const tag = local.localCreateTag(userId, name);
  if (!tag) return null;

  await runCloudWrite(
    userId,
    {
      type: "create_tag",
      payload: { uid: userId, id: tag.id, name: tag.name },
    },
    () => fsCreateTag(userId, tag.id, tag.name)
  );

  return tag;
}

async function applySyncAction(action: SyncAction): Promise<void> {
  switch (action.type) {
    case "create_prompt": {
      const payload = action.payload as { uid: string; id: string; data: PromptFormData };
      await fsCreatePrompt(payload.uid, payload.id, payload.data);
      return;
    }
    case "update_prompt": {
      const payload = action.payload as { uid: string; id: string; data: PromptFormData };
      await fsUpdatePrompt(payload.uid, payload.id, payload.data);
      return;
    }
    case "delete_prompt": {
      const payload = action.payload as { uid: string; id: string };
      await fsDeletePrompt(payload.uid, payload.id);
      return;
    }
    case "toggle_favorite": {
      const payload = action.payload as { uid: string; id: string; value: boolean };
      await fsToggleFavorite(payload.uid, payload.id, payload.value);
      return;
    }
    case "increment_use": {
      const payload = action.payload as { uid: string; id: string; count: number };
      await fsIncrementUseCount(payload.uid, payload.id, payload.count);
      return;
    }
    case "create_category": {
      const payload = action.payload as {
        uid: string;
        id: string;
        name: string;
        color: string;
        icon: string;
        sortOrder: number;
      };
      await fsCreateCategory(payload.uid, payload.id, payload.name, payload.color, payload.icon, payload.sortOrder);
      return;
    }
    case "update_category": {
      const payload = action.payload as { uid: string; id: string; data: Partial<Category> };
      await fsUpdateCategory(payload.uid, payload.id, payload.data);
      return;
    }
    case "delete_category": {
      const payload = action.payload as { uid: string; id: string };
      await fsDeleteCategory(payload.uid, payload.id);
      return;
    }
    case "create_tag": {
      const payload = action.payload as { uid: string; id: string; name: string };
      await fsCreateTag(payload.uid, payload.id, payload.name);
      return;
    }
  }
}

export async function replaySync(): Promise<number> {
  const uid = getCurrentUid();
  if (!uid || !canUseCloudSync()) return 0;

  const queue = getSyncQueue();
  const remaining: SyncAction[] = [];
  let syncedActions = 0;

  for (const action of queue) {
    try {
      await applySyncAction(action);
      syncedActions += 1;
    } catch (error) {
      console.warn("Une action en attente n'a pas pu etre synchronisee", error);
      remaining.push(action);
    }
  }

  saveSyncQueue(remaining);

  try {
    await fsSyncToLocal(uid);
  } catch (error) {
    console.warn("Impossible de rafraichir les donnees cloud apres replay", error);
  }

  return syncedActions;
}

export function subscribeToRealtimeData(
  uid: string,
  onData: (snapshot: SyncSnapshot) => void
): () => void {
  if (!canUseCloudSync()) return () => {};

  return fsSubscribeUserData(
    uid,
    (snapshot) => {
      local.localSyncDataset(uid, snapshot);
      onData({
        prompts: local.localGetPrompts(),
        categories: local.localGetCategories(),
        tags: local.localGetTags(),
      });
    },
    (error) => {
      console.warn("Realtime Firestore indisponible", error);
    }
  );
}

export async function preloadCloudData(uid: string): Promise<SyncSnapshot> {
  const [prompts, categories, tags] = await Promise.all([
    fsGetPrompts(uid),
    fsGetCategories(uid),
    fsGetTags(uid),
  ]);

  return {
    prompts,
    categories,
    tags,
  };
}
