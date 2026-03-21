"use client";

import { useStore } from "@/stores/useStore";
import { PromptCard } from "./PromptCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Inbox, SlidersHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import type { SortOption } from "@/types/database";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "updated_desc", label: "Récent → Ancien" },
  { value: "updated_asc", label: "Ancien → Récent" },
  { value: "alpha_asc", label: "A → Z" },
  { value: "alpha_desc", label: "Z → A" },
  { value: "most_used", label: "Plus utilisés" },
  { value: "favorites_first", label: "Favoris d'abord" },
];

interface PromptGridProps {
  title?: string;
}

export function PromptGrid({ title = "Tous les prompts" }: PromptGridProps) {
  const { filteredPrompts, openEditor, filters, setFilter, isLoading } =
    useStore();

  const prompts = filteredPrompts();

  // Active filters summary
  const activeFilters = [
    filters.favorites_only && "Favoris",
    filters.target_model,
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          <span className="text-sm text-text-secondary">
            {prompts.length} prompt{prompts.length > 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <SlidersHorizontal className="w-4 h-4" />
                <span className="hidden sm:inline">Trier</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {SORT_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => setFilter("sort", opt.value)}
                  className={
                    filters.sort === opt.value ? "text-accent" : undefined
                  }
                >
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Model filter chips */}
          <div className="hidden sm:flex items-center gap-1">
            {(["claude", "gpt", "gemini"] as const).map((m) => (
              <button
                key={m}
                onClick={() =>
                  setFilter(
                    "target_model",
                    filters.target_model === m ? null : m
                  )
                }
                className="cursor-pointer"
              >
                <Badge
                  variant={
                    filters.target_model === m ? "default" : "secondary"
                  }
                  className="cursor-pointer capitalize"
                >
                  {m}
                </Badge>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active filters */}
      {activeFilters.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary">Filtres :</span>
          {activeFilters.map((f) => (
            <Badge key={String(f)} variant="default" className="text-xs">
              {String(f)}
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilter("favorites_only", false);
              setFilter("target_model", null);
              setFilter("tag_id", null);
            }}
            className="text-xs"
          >
            Effacer
          </Button>
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-bg-secondary p-4 animate-pulse"
            >
              <div className="h-4 bg-bg-tertiary rounded w-3/4 mb-3" />
              <div className="h-3 bg-bg-tertiary rounded w-full mb-2" />
              <div className="h-3 bg-bg-tertiary rounded w-5/6 mb-2" />
              <div className="h-3 bg-bg-tertiary rounded w-2/3 mb-4" />
              <div className="flex gap-2">
                <div className="h-5 bg-bg-tertiary rounded w-16" />
                <div className="h-5 bg-bg-tertiary rounded w-12" />
              </div>
            </div>
          ))}
        </div>
      ) : prompts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {prompts.map((prompt) => (
            <PromptCard key={prompt.id} prompt={prompt} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-bg-tertiary border border-border flex items-center justify-center mb-4">
            <Inbox className="w-8 h-8 text-text-secondary" />
          </div>
          <h3 className="text-lg font-medium text-text-primary mb-1">
            {filters.search
              ? "Aucun résultat"
              : "Aucun prompt"}
          </h3>
          <p className="text-sm text-text-secondary mb-4 max-w-sm">
            {filters.search
              ? `Aucun prompt ne correspond à "${filters.search}"`
              : "Crée ton premier prompt pour commencer ta bibliothèque"}
          </p>
          {!filters.search && (
            <Button onClick={() => openEditor()}>
              <Plus className="w-4 h-4" />
              Créer un prompt
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
