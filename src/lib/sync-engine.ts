// ═══════════════════════════════════════════════════════════════
// Sync Engine — Supabase (primary) + localStorage (offline cache)
// ═══════════════════════════════════════════════════════════════
//
// Stratégie :
// 1. Toute écriture va d'abord dans localStorage (instantané)
// 2. Si online + Supabase configuré → push vers Supabase
// 3. Si offline → stocker dans la queue de sync
// 4. Au retour online → rejouer la queue automatiquement
// ═══════════════════════════════════════════════════════════════

"use client";

import { createClient } from "@/lib/supabase/client";
import * as local from "@/lib/local-storage";
import type { Prompt, Category, Tag, PromptFormData } from "@/types/database";

// ── Config detection ───────────────────────────────

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return !!(
    url &&
    key &&
    !url.includes("your-project") &&
    !key.includes("your-anon-key")
  );
}

function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

export function canUseSupabase(): boolean {
  return isSupabaseConfigured() && isOnline();
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
    if (isOnline() && isSupabaseConfigured()) {
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

// ── Auth ───────────────────────────────────────────

export async function hybridRegister(
  name: string,
  email: string,
  password: string
): Promise<{ user: { id: string; email: string; name: string } | null; error: string | null }> {
  // Always register locally first
  const localResult = local.localRegister(name, email, password);
  if (localResult.error) return { user: null, error: localResult.error };

  const localUser = {
    id: localResult.user!.id,
    email: localResult.user!.email,
    name: localResult.user!.name,
  };

  // Try Supabase if available
  if (canUseSupabase()) {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });

      if (!error && data.user) {
        // Update local user ID to match Supabase
        const mappedUser = {
          id: data.user.id,
          email: data.user.email || email,
          name,
        };
        localStorage.setItem(
          "pv_user",
          JSON.stringify(mappedUser)
        );
        // Store Supabase ID mapping
        localStorage.setItem("pv_supabase_uid", data.user.id);
        return { user: mappedUser, error: null };
      }
      // If Supabase fails, local still works
      console.warn("Supabase register failed, using local:", error?.message);
    } catch (e) {
      console.warn("Supabase unavailable, using local mode");
    }
  }

  return { user: localUser, error: null };
}

export async function hybridLogin(
  email: string,
  password: string
): Promise<{ user: { id: string; email: string; name: string } | null; error: string | null }> {
  // Try Supabase first if available
  if (canUseSupabase()) {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error && data.user) {
        const user = {
          id: data.user.id,
          email: data.user.email || email,
          name: data.user.user_metadata?.name || email.split("@")[0],
        };
        localStorage.setItem("pv_user", JSON.stringify(user));
        localStorage.setItem("pv_supabase_uid", data.user.id);
        return { user, error: null };
      }
    } catch {
      // Fall through to local
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

export async function hybridLogout(): Promise<void> {
  local.localLogout();
  if (canUseSupabase()) {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
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
  // Check Supabase session first
  if (canUseSupabase()) {
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        const user = {
          id: data.user.id,
          email: data.user.email || "",
          name: data.user.user_metadata?.name || "",
        };
        localStorage.setItem("pv_user", JSON.stringify(user));
        return user;
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
  if (canUseSupabase()) {
    try {
      const supabase = createClient();
      const { data: prompts } = await supabase
        .from("prompts")
        .select("*, category:categories(*)")
        .eq("is_deleted", false)
        .order("updated_at", { ascending: false });

      if (prompts) {
        const { data: promptTags } = await supabase
          .from("prompt_tags")
          .select("prompt_id, tag:tags(*)");

        const tagMap = new Map<string, Tag[]>();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        promptTags?.forEach((pt: any) => {
          if (!tagMap.has(pt.prompt_id)) tagMap.set(pt.prompt_id, []);
          tagMap.get(pt.prompt_id)!.push(pt.tag as Tag);
        });

        const enriched = prompts.map((p: Prompt) => ({
          ...p,
          tags: tagMap.get(p.id) || [],
        }));

        // Cache locally
        localStorage.setItem("pv_prompts", JSON.stringify(prompts));

        return enriched;
      }
    } catch {
      console.warn("Supabase fetch failed, using local cache");
    }
  }

  return local.localGetPrompts();
}

export async function hybridCreatePrompt(
  userId: string,
  data: PromptFormData
): Promise<Prompt> {
  // Always save locally first (instant)
  const localPrompt = local.localCreatePrompt(userId, data);

  // Push to Supabase if available
  if (canUseSupabase()) {
    try {
      const supabase = createClient();
      const { data: sbPrompt, error } = await supabase
        .from("prompts")
        .insert({
          user_id: userId,
          title: data.title,
          content: data.content,
          description: data.description || null,
          category_id: data.category_id || null,
          target_model: data.target_model || null,
          is_favorite: data.is_favorite || false,
        })
        .select()
        .single();

      if (!error && sbPrompt && data.tag_names?.length) {
        for (const tagName of data.tag_names) {
          // Get or create tag
          let { data: existingTag } = await supabase
            .from("tags")
            .select()
            .eq("user_id", userId)
            .ilike("name", tagName)
            .single();

          if (!existingTag) {
            const { data: newTag } = await supabase
              .from("tags")
              .insert({ user_id: userId, name: tagName.trim() })
              .select()
              .single();
            existingTag = newTag;
          }

          if (existingTag) {
            await supabase
              .from("prompt_tags")
              .insert({ prompt_id: sbPrompt.id, tag_id: existingTag.id });
          }
        }
      }
    } catch {
      // Queue for later sync
      addToSyncQueue({
        type: "create_prompt",
        payload: { userId, data, localId: localPrompt.id },
      });
    }
  } else if (isSupabaseConfigured()) {
    // Configured but offline — queue
    addToSyncQueue({
      type: "create_prompt",
      payload: { userId, data, localId: localPrompt.id },
    });
  }

  return localPrompt;
}

export async function hybridUpdatePrompt(
  id: string,
  data: PromptFormData
): Promise<void> {
  // Local first
  local.localUpdatePrompt(id, data);

  if (canUseSupabase()) {
    try {
      const supabase = createClient();

      // Save version
      const { data: current } = await supabase
        .from("prompts")
        .select("title, content, description")
        .eq("id", id)
        .single();

      if (current) {
        const { count } = await supabase
          .from("prompt_versions")
          .select("*", { count: "exact", head: true })
          .eq("prompt_id", id);

        await supabase.from("prompt_versions").insert({
          prompt_id: id,
          title: current.title,
          content: current.content,
          description: current.description,
          version_number: (count || 0) + 1,
        });
      }

      await supabase
        .from("prompts")
        .update({
          title: data.title,
          content: data.content,
          description: data.description || null,
          category_id: data.category_id || null,
          target_model: data.target_model || null,
          is_favorite: data.is_favorite,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      // Update tags
      await supabase.from("prompt_tags").delete().eq("prompt_id", id);
      const userId = localStorage.getItem("pv_supabase_uid") || "";
      if (data.tag_names?.length) {
        for (const tagName of data.tag_names) {
          let { data: tag } = await supabase
            .from("tags")
            .select()
            .eq("user_id", userId)
            .ilike("name", tagName)
            .single();

          if (!tag) {
            const { data: newTag } = await supabase
              .from("tags")
              .insert({ user_id: userId, name: tagName.trim() })
              .select()
              .single();
            tag = newTag;
          }

          if (tag) {
            await supabase
              .from("prompt_tags")
              .insert({ prompt_id: id, tag_id: tag.id });
          }
        }
      }
    } catch {
      addToSyncQueue({ type: "update_prompt", payload: { id, data } });
    }
  } else if (isSupabaseConfigured()) {
    addToSyncQueue({ type: "update_prompt", payload: { id, data } });
  }
}

export async function hybridDeletePrompt(id: string): Promise<void> {
  local.localDeletePrompt(id);

  if (canUseSupabase()) {
    try {
      const supabase = createClient();
      await supabase
        .from("prompts")
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq("id", id);
    } catch {
      addToSyncQueue({ type: "delete_prompt", payload: { id } });
    }
  } else if (isSupabaseConfigured()) {
    addToSyncQueue({ type: "delete_prompt", payload: { id } });
  }
}

export async function hybridToggleFavorite(id: string): Promise<boolean> {
  const newVal = local.localToggleFavorite(id);

  if (canUseSupabase()) {
    try {
      const supabase = createClient();
      await supabase.from("prompts").update({ is_favorite: newVal }).eq("id", id);
    } catch {
      addToSyncQueue({ type: "toggle_favorite", payload: { id, newVal } });
    }
  }

  return newVal;
}

export async function hybridIncrementUseCount(id: string): Promise<number> {
  const newCount = local.localIncrementUseCount(id);

  if (canUseSupabase()) {
    try {
      const supabase = createClient();
      await supabase.from("prompts").update({ use_count: newCount }).eq("id", id);
    } catch {
      // Non-critical, skip queue
    }
  }

  return newCount;
}

// ── Categories ─────────────────────────────────────

export async function hybridFetchCategories(): Promise<Category[]> {
  if (canUseSupabase()) {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order", { ascending: true });

      if (data) {
        localStorage.setItem("pv_categories", JSON.stringify(data));
        return data;
      }
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

  if (canUseSupabase()) {
    try {
      const supabase = createClient();
      await supabase.from("categories").insert({
        user_id: userId,
        name,
        color,
        icon,
        sort_order: cat.sort_order,
      });
    } catch {
      addToSyncQueue({
        type: "create_category",
        payload: { userId, name, color, icon },
      });
    }
  }

  return cat;
}

export async function hybridUpdateCategory(
  id: string,
  data: Partial<Category>
): Promise<void> {
  local.localUpdateCategory(id, data);

  if (canUseSupabase()) {
    try {
      const supabase = createClient();
      await supabase.from("categories").update(data).eq("id", id);
    } catch {
      addToSyncQueue({ type: "update_category", payload: { id, data } });
    }
  }
}

export async function hybridDeleteCategory(id: string): Promise<void> {
  local.localDeleteCategory(id);

  if (canUseSupabase()) {
    try {
      const supabase = createClient();
      await supabase.from("prompts").update({ category_id: null }).eq("category_id", id);
      await supabase.from("categories").delete().eq("id", id);
    } catch {
      addToSyncQueue({ type: "delete_category", payload: { id } });
    }
  }
}

// ── Tags ───────────────────────────────────────────

export async function hybridFetchTags(): Promise<Tag[]> {
  if (canUseSupabase()) {
    try {
      const supabase = createClient();
      const { data } = await supabase.from("tags").select("*");
      if (data) {
        localStorage.setItem("pv_tags", JSON.stringify(data));
        return data;
      }
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

  if (canUseSupabase() && tag) {
    try {
      const supabase = createClient();
      await supabase
        .from("tags")
        .upsert({ user_id: userId, name: name.trim() }, { onConflict: "user_id,name" });
    } catch {
      addToSyncQueue({ type: "create_tag", payload: { userId, name } });
    }
  }

  return tag;
}

// ── Full Sync (replay queue) ───────────────────────

export async function replaySync(): Promise<number> {
  if (!canUseSupabase()) return 0;

  const queue = getSyncQueue();
  if (queue.length === 0) return 0;

  let synced = 0;
  const userId = localStorage.getItem("pv_supabase_uid") || "";

  for (const action of queue) {
    try {
      switch (action.type) {
        case "create_prompt": {
          const p = action.payload;
          const supabase = createClient();
          await supabase.from("prompts").insert({
            user_id: userId,
            title: (p.data as PromptFormData).title,
            content: (p.data as PromptFormData).content,
            description: (p.data as PromptFormData).description || null,
            category_id: (p.data as PromptFormData).category_id || null,
            target_model: (p.data as PromptFormData).target_model || null,
            is_favorite: (p.data as PromptFormData).is_favorite || false,
          });
          synced++;
          break;
        }
        case "update_prompt": {
          const supabase = createClient();
          const d = action.payload.data as PromptFormData;
          await supabase
            .from("prompts")
            .update({
              title: d.title,
              content: d.content,
              description: d.description || null,
              category_id: d.category_id || null,
              target_model: d.target_model || null,
              is_favorite: d.is_favorite,
              updated_at: new Date().toISOString(),
            })
            .eq("id", action.payload.id as string);
          synced++;
          break;
        }
        case "delete_prompt": {
          const supabase = createClient();
          await supabase
            .from("prompts")
            .update({ is_deleted: true, deleted_at: new Date().toISOString() })
            .eq("id", action.payload.id as string);
          synced++;
          break;
        }
        case "create_category": {
          const supabase = createClient();
          await supabase.from("categories").insert({
            user_id: userId,
            name: action.payload.name as string,
            color: action.payload.color as string,
            icon: action.payload.icon as string,
          });
          synced++;
          break;
        }
        default:
          synced++;
          break;
      }
    } catch (e) {
      console.warn("Sync action failed, will retry:", e);
      // Keep failed actions in queue
      continue;
    }
  }

  clearSyncQueue();
  return synced;
}
