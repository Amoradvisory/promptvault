"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/stores/useStore";
import { hybridGetUser, onSyncNeeded, canUseSupabase } from "@/lib/sync-engine";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { PromptGrid } from "@/components/prompts/PromptGrid";
import { PromptEditor } from "@/components/prompts/PromptEditor";
import { CategoryManager } from "@/components/categories/CategoryManager";
import { ImportExport } from "@/components/prompts/ImportExport";
import { StatsView } from "@/components/dashboard/StatsView";
import { SyncStatus } from "@/components/layout/SyncStatus";
import { Toaster, toast } from "sonner";

export default function DashboardPage() {
  const router = useRouter();
  const {
    setUser,
    fetchPrompts,
    fetchCategories,
    fetchTags,
    filters,
    categories,
    setOnline,
    syncNow,
  } = useStore();

  const [currentView, setCurrentView] = useState("all");
  const [importExportMode, setImportExportMode] = useState<
    "import" | "export" | null
  >(null);
  const [ready, setReady] = useState(false);

  const initApp = useCallback(async () => {
    const user = await hybridGetUser();
    if (!user) {
      router.replace("/auth/login");
      return;
    }

    setUser({ id: user.id, email: user.email, name: user.name });
    await Promise.all([fetchPrompts(), fetchCategories(), fetchTags()]);
    setReady(true);
  }, [setUser, fetchPrompts, fetchCategories, fetchTags, router]);

  useEffect(() => {
    initApp();
  }, [initApp]);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      toast.success("Connexion rétablie — synchronisation...");
      syncNow().then(() => {
        toast.success("Données synchronisées");
      });
    };
    const handleOffline = () => {
      setOnline(false);
      toast.warning("Mode hors-ligne — les modifications seront synchronisées au retour");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Also listen to sync engine
    const unsub = onSyncNeeded(() => {
      syncNow();
    });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unsub();
    };
  }, [setOnline, syncNow]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-text-secondary animate-pulse">Chargement...</div>
      </div>
    );
  }

  const getViewTitle = () => {
    switch (currentView) {
      case "favorites":
        return "Favoris";
      case "category": {
        const cat = categories.find((c) => c.id === filters.category_id);
        return cat?.name || "Catégorie";
      }
      case "tag":
        return "Résultats par tag";
      default:
        return "Tous les prompts";
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#12121A",
            border: "1px solid #2A2A3E",
            color: "#E8E8F0",
          },
        }}
      />

      <Header />

      <div className="flex h-[calc(100vh-4rem)]">
        <Sidebar
          currentView={currentView}
          onViewChange={setCurrentView}
          onImport={() => setImportExportMode("import")}
          onExport={() => setImportExportMode("export")}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 lg:pb-6">
          {currentView === "manage-categories" ? (
            <CategoryManager />
          ) : currentView === "stats" ? (
            <StatsView />
          ) : (
            <PromptGrid title={getViewTitle()} />
          )}
        </main>
      </div>

      <SyncStatus />
      <MobileNav currentView={currentView} onViewChange={setCurrentView} />
      <PromptEditor />
      <ImportExport
        mode={importExportMode}
        onClose={() => setImportExportMode(null)}
      />
    </div>
  );
}
