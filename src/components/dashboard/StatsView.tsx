"use client";

import { useStore } from "@/stores/useStore";
import { BarChart2, Star, Copy, FolderOpen, Tag, TrendingUp } from "lucide-react";

export function StatsView() {
  const { prompts, categories, tags } = useStore();

  const totalPrompts = prompts.length;
  const totalFavorites = prompts.filter((p) => p.is_favorite).length;
  const totalCopies = prompts.reduce((sum, p) => sum + p.use_count, 0);

  // Top 5 most used
  const topUsed = [...prompts]
    .sort((a, b) => b.use_count - a.use_count)
    .slice(0, 5);

  // Category distribution
  const catDistrib = categories.map((cat) => ({
    ...cat,
    count: prompts.filter((p) => p.category_id === cat.id).length,
  }));
  const uncategorized = prompts.filter((p) => !p.category_id).length;

  const statCard = (
    icon: React.ReactNode,
    label: string,
    value: number | string,
    color: string
  ) => (
    <div className="rounded-xl border border-border bg-bg-secondary p-4">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}15` }}
        >
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-text-primary">{value}</p>
          <p className="text-xs text-text-secondary">{label}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-text-primary">
        Tableau de bord
      </h2>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCard(
          <BarChart2 className="w-5 h-5 text-accent" />,
          "Total prompts",
          totalPrompts,
          "#6C5CE7"
        )}
        {statCard(
          <Star className="w-5 h-5 text-favorite" />,
          "Favoris",
          totalFavorites,
          "#FFD700"
        )}
        {statCard(
          <Copy className="w-5 h-5 text-accent-cyan" />,
          "Copies totales",
          totalCopies,
          "#00D2FF"
        )}
        {statCard(
          <Tag className="w-5 h-5 text-success" />,
          "Tags utilisés",
          tags.length,
          "#00E676"
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category distribution */}
        <div className="rounded-xl border border-border bg-bg-secondary p-5">
          <h3 className="text-sm font-medium text-text-primary mb-4 flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-accent" />
            Répartition par catégorie
          </h3>
          <div className="space-y-3">
            {catDistrib.map((cat) => (
              <div key={cat.id} className="flex items-center gap-3">
                <span
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="text-sm text-text-primary flex-1 truncate">
                  {cat.name}
                </span>
                <span className="text-sm text-text-secondary">{cat.count}</span>
                <div className="w-20 h-2 rounded-full bg-bg-tertiary overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${totalPrompts ? (cat.count / totalPrompts) * 100 : 0}%`,
                      backgroundColor: cat.color,
                    }}
                  />
                </div>
              </div>
            ))}
            {uncategorized > 0 && (
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-sm flex-shrink-0 bg-text-secondary/30" />
                <span className="text-sm text-text-secondary flex-1">
                  Non catégorisé
                </span>
                <span className="text-sm text-text-secondary">
                  {uncategorized}
                </span>
                <div className="w-20 h-2 rounded-full bg-bg-tertiary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-text-secondary/30"
                    style={{
                      width: `${totalPrompts ? (uncategorized / totalPrompts) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top used */}
        <div className="rounded-xl border border-border bg-bg-secondary p-5">
          <h3 className="text-sm font-medium text-text-primary mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-accent-cyan" />
            Prompts les plus utilisés
          </h3>
          <div className="space-y-3">
            {topUsed.length > 0 ? (
              topUsed.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="text-xs text-text-secondary w-5">
                    #{i + 1}
                  </span>
                  <span className="text-sm text-text-primary flex-1 truncate">
                    {p.title}
                  </span>
                  <span className="text-sm font-mono text-accent">
                    {p.use_count}×
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-text-secondary text-center py-4">
                Copie tes prompts pour voir les statistiques
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
