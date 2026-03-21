export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  parent_id: string | null;
  sort_order: number;
  created_at: string;
  children?: Category[];
}

export interface Prompt {
  id: string;
  user_id: string;
  category_id: string | null;
  title: string;
  content: string;
  description: string | null;
  target_model: "claude" | "gpt" | "gemini" | "other" | null;
  is_favorite: boolean;
  use_count: number;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  category?: Category | null;
  tags?: Tag[];
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  count?: number;
}

export interface PromptTag {
  prompt_id: string;
  tag_id: string;
}

export interface PromptVersion {
  id: string;
  prompt_id: string;
  title: string;
  content: string;
  description: string | null;
  version_number: number;
  created_at: string;
}

export interface PromptFormData {
  title: string;
  content: string;
  description?: string;
  category_id?: string | null;
  target_model?: string | null;
  is_favorite?: boolean;
  tag_names?: string[];
}

export type SortOption =
  | "updated_desc"
  | "updated_asc"
  | "created_desc"
  | "created_asc"
  | "alpha_asc"
  | "alpha_desc"
  | "most_used"
  | "favorites_first";

export interface Filters {
  search: string;
  category_id: string | null;
  tag_id: string | null;
  target_model: string | null;
  favorites_only: boolean;
  sort: SortOption;
}

export const DEFAULT_CATEGORIES = [
  { name: "Rédaction", color: "#6C5CE7", icon: "pen-tool" },
  { name: "Code", color: "#00D2FF", icon: "code" },
  { name: "Analyse", color: "#00E676", icon: "bar-chart-2" },
  { name: "Créatif", color: "#FF6B6B", icon: "sparkles" },
  { name: "Éducation", color: "#FFD700", icon: "graduation-cap" },
  { name: "Business", color: "#FF9F43", icon: "briefcase" },
  { name: "Système", color: "#A29BFE", icon: "settings" },
  { name: "Autre", color: "#8888A0", icon: "folder" },
] as const;

export const CATEGORY_COLORS = [
  "#6C5CE7", "#00D2FF", "#00E676", "#FF5252", "#FFD700",
  "#FF9F43", "#A29BFE", "#FF6B6B", "#54A0FF", "#5F27CD",
  "#01A3A4", "#F368E0",
] as const;

export const TARGET_MODELS = [
  { value: "claude", label: "Claude", color: "#D4A574" },
  { value: "gpt", label: "GPT", color: "#74AA9C" },
  { value: "gemini", label: "Gemini", color: "#4285F4" },
  { value: "other", label: "Autre", color: "#8888A0" },
] as const;
