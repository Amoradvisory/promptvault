"use client";

import { useState, useEffect, useRef } from "react";
import { useStore } from "@/stores/useStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { hybridLogout } from "@/lib/sync-engine";
import { useRouter } from "next/navigation";
import {
  Menu,
  Plus,
  Search,
  User,
  LogOut,
  Vault,
} from "lucide-react";

export function Header() {
  const router = useRouter();
  const { user, filters, setFilter, openEditor, toggleSidebar } = useStore();
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        openEditor();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openEditor]);

  const handleLogout = async () => {
    await hybridLogout();
    router.push("/auth/login");
  };

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-border bg-bg-primary/80 backdrop-blur-md">
      <div className="flex items-center justify-between h-full px-4 gap-4">
        {/* Left */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="hidden sm:flex items-center gap-2">
            <Vault className="w-6 h-6 text-accent" />
            <span className="text-lg font-bold text-text-primary">
              PromptVault
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <Input
              ref={searchRef}
              type="text"
              placeholder="Rechercher un prompt... (Ctrl+K)"
              value={filters.search}
              onChange={(e) => setFilter("search", e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="pl-10 pr-4"
            />
            {!searchFocused && !filters.search && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 text-[10px] rounded border border-border bg-bg-tertiary text-text-secondary">
                  Ctrl
                </kbd>
                <kbd className="px-1.5 py-0.5 text-[10px] rounded border border-border bg-bg-tertiary text-text-secondary">
                  K
                </kbd>
              </div>
            )}
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          <Button onClick={() => openEditor()} className="hidden sm:inline-flex">
            <Plus className="w-4 h-4" />
            Nouveau
          </Button>
          <Button
            onClick={() => openEditor()}
            size="icon"
            className="sm:hidden"
          >
            <Plus className="w-4 h-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center">
                  <User className="w-4 h-4 text-accent" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium text-text-primary">
                  {user?.name || "Utilisateur"}
                </p>
                <p className="text-xs text-text-secondary">{user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} danger>
                <LogOut className="w-4 h-4" />
                Se déconnecter
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
