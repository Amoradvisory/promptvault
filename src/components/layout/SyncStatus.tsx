"use client";

import { useStore } from "@/stores/useStore";
import { isFirebaseConfigured } from "@/lib/firebase";
import { Cloud, CloudOff, HardDrive, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export function SyncStatus() {
  const { isOnline, pendingSync, syncNow } = useStore();
  const cloudConfigured = isFirebaseConfigured();

  // Don't show anything if everything is normal (online + synced)
  if (cloudConfigured && isOnline && pendingSync === 0) return null;

  return (
    <div className="fixed bottom-20 left-4 z-30 lg:bottom-4">
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border shadow-lg",
          !isOnline
            ? "bg-danger/10 border-danger/20 text-danger"
            : pendingSync > 0
            ? "bg-favorite/10 border-favorite/20 text-favorite cursor-pointer"
            : "bg-bg-secondary border-border text-text-secondary"
        )}
        onClick={pendingSync > 0 ? syncNow : undefined}
      >
        {!isOnline ? (
          <>
            <CloudOff className="w-3.5 h-3.5" />
            <span>Hors-ligne</span>
            {pendingSync > 0 && (
              <span className="bg-danger/20 px-1.5 py-0.5 rounded-full">
                {pendingSync} en attente
              </span>
            )}
          </>
        ) : !cloudConfigured ? (
          <>
            <HardDrive className="w-3.5 h-3.5" />
            <span>Mode local</span>
          </>
        ) : pendingSync > 0 ? (
          <>
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{pendingSync} à synchroniser</span>
          </>
        ) : (
          <>
            <Cloud className="w-3.5 h-3.5 text-success" />
            <span>Synchronisé</span>
          </>
        )}
      </div>
    </div>
  );
}
