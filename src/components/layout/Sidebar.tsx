"use client";

import { useStore } from "@/stores/useStore";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Star,
  FolderOpen,
  Tag,
  Download,
  Upload,
  Trash2,
  X,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  onImport: () => void;
  onExport: () => void;
}

export function Sidebar({
  currentView,
  onViewChange,
  onImport,
  onExport,
}: SidebarProps) {
  const {
    categories,
    tags,
    prompts,
    filters,
    setFilter,
    sidebarOpen,
    toggleSidebar,
    openEditor,
  } = useStore();

  const favoriteCount = prompts.filter((p) => p.is_favorite).length;

  const navItem = (
    id: string,
    label: string,
    icon: React.ReactNode,
    count?: number,
    onClick?: () => void
  ) => (
    <button
      onClick={() => {
        onClick?.();
        onViewChange(id);
        if (sidebarOpen) toggleSidebar();
      }}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer",
        currentView === id
          ? "bg-accent/15 text-accent border border-accent/20"
          : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
      )}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="text-xs text-text-secondary">{count}</span>
      )}
    </button>
  );

  return (
    <>
      {/* Overlay on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-64 bg-bg-secondary border-r border-border flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <span className="text-lg font-bold text-text-primary">Menu</span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleSidebar}
            className="lg:hidden"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItem(
            "all",
            "Tous les prompts",
            <LayoutDashboard className="w-4 h-4" />,
            prompts.length,
            () => {
              setFilter("category_id", null);
              setFilter("tag_id", null);
              setFilter("favorites_only", false);
            }
          )}

          {navItem(
            "favorites",
            "Favoris",
            <Star className="w-4 h-4" />,
            favoriteCount,
            () => {
              setFilter("favorites_only", true);
              setFilter("category_id", null);
            }
          )}

          {/* Categories */}
          <div className="pt-4 pb-1">
            <div className="flex items-center justify-between px-3">
              <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                Catégories
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onViewChange("manage-categories")}
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {categories.map((cat) => {
            const count = prompts.filter(
              (p) => p.category_id === cat.id
            ).length;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setFilter("category_id", cat.id);
                  setFilter("favorites_only", false);
                  onViewChange("category");
                  if (sidebarOpen) toggleSidebar();
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer",
                  filters.category_id === cat.id
                    ? "bg-bg-tertiary text-text-primary"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
                )}
              >
                <span
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="flex-1 text-left truncate">{cat.name}</span>
                {count > 0 && (
                  <span className="text-xs text-text-secondary">{count}</span>
                )}
              </button>
            );
          })}

          {/* Tags */}
          <div className="pt-4 pb-1">
            <span className="px-3 text-xs font-medium text-text-secondary uppercase tracking-wider">
              Tags
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 px-3">
            {tags.slice(0, 12).map((tag) => (
              <button
                key={tag.id}
                onClick={() => {
                  setFilter(
                    "tag_id",
                    filters.tag_id === tag.id ? null : tag.id
                  );
                  onViewChange("tag");
                  if (sidebarOpen) toggleSidebar();
                }}
                className="cursor-pointer"
              >
                <Badge
                  variant={
                    filters.tag_id === tag.id ? "default" : "secondary"
                  }
                  className="cursor-pointer"
                >
                  {tag.name}
                </Badge>
              </button>
            ))}
          </div>
        </div>

        {/* Bottom actions */}
        <div className="p-3 border-t border-border space-y-1">
          <button
            onClick={onImport}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            Importer
          </button>
          <button
            onClick={onExport}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Exporter
          </button>
          {navItem("trash", "Corbeille", <Trash2 className="w-4 h-4" />)}
        </div>
      </aside>
    </>
  );
}
