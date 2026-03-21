"use client";

import { useStore } from "@/stores/useStore";
import { cn } from "@/lib/utils";
import { Home, FolderOpen, Star, BarChart2, Settings } from "lucide-react";

interface MobileNavProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

export function MobileNav({ currentView, onViewChange }: MobileNavProps) {
  const { setFilter } = useStore();

  const items = [
    {
      id: "all",
      label: "Accueil",
      icon: Home,
      action: () => {
        setFilter("category_id", null);
        setFilter("favorites_only", false);
        setFilter("tag_id", null);
      },
    },
    {
      id: "categories-view",
      label: "Catégories",
      icon: FolderOpen,
      action: () => {},
    },
    {
      id: "favorites",
      label: "Favoris",
      icon: Star,
      action: () => {
        setFilter("favorites_only", true);
        setFilter("category_id", null);
      },
    },
    {
      id: "stats",
      label: "Stats",
      icon: BarChart2,
      action: () => {},
    },
    {
      id: "settings",
      label: "Options",
      icon: Settings,
      action: () => {},
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-bg-secondary/95 backdrop-blur-md border-t border-border lg:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              item.action();
              onViewChange(item.id);
            }}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-all cursor-pointer",
              currentView === item.id
                ? "text-accent"
                : "text-text-secondary"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px]">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
