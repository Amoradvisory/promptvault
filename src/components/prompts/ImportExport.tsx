"use client";

import { useState, useRef } from "react";
import { useStore } from "@/stores/useStore";
import type { Category } from "@/types/database";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Download, Upload, FileJson, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ImportExportProps {
  mode: "import" | "export" | null;
  onClose: () => void;
}

export function ImportExport({ mode, onClose }: ImportExportProps) {
  const { prompts, categories, tags, fetchPrompts, fetchCategories, fetchTags, user, createPrompt, createCategory } =
    useStore();
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const data = {
      version: 1,
      exported_at: new Date().toISOString(),
      prompts: prompts.map((p) => ({
        title: p.title,
        content: p.content,
        description: p.description,
        category_name: p.category?.name || null,
        target_model: p.target_model,
        is_favorite: p.is_favorite,
        tags: p.tags?.map((t) => t.name) || [],
        created_at: p.created_at,
        updated_at: p.updated_at,
        use_count: p.use_count,
      })),
      categories: categories.map((c) => ({
        name: c.name,
        color: c.color,
        icon: c.icon,
      })),
      tags: tags.map((tag) => ({
        name: tag.name,
      })),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `promptvault-export-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success(`${prompts.length} prompts exportés`);
    onClose();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setLoading(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.prompts || !Array.isArray(data.prompts)) {
        toast.error("Format de fichier invalide");
        setLoading(false);
        return;
      }

      // Import categories first
      if (data.categories) {
        for (const cat of data.categories) {
          const exists = categories.find((c: Category) => c.name === cat.name);
          if (!exists) {
            await createCategory(cat.name, cat.color || "#6C5CE7", cat.icon || "folder");
          }
        }
        await fetchCategories();
      }

      // Import prompts
      let imported = 0;
      const updatedCategories = useStore.getState().categories;
      for (const p of data.prompts) {
        let categoryId = null;
        if (p.category_name) {
          const cat = updatedCategories.find((c: { name: string }) => c.name === p.category_name);
          if (cat) categoryId = cat.id;
        }

        await createPrompt({
          title: p.title,
          content: p.content,
          description: p.description || undefined,
          category_id: categoryId,
          target_model: p.target_model || null,
          is_favorite: p.is_favorite || false,
          tag_names: p.tags || [],
        });

        imported++;
      }

      await fetchPrompts();
      await fetchTags();
      toast.success(`${imported} prompts importés`);
      onClose();
    } catch {
      toast.error("Erreur lors de l'import");
    }
    setLoading(false);
  };

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "export" ? "Exporter" : "Importer"}
          </DialogTitle>
          <DialogDescription>
            {mode === "export"
              ? "Télécharge un backup complet de ta bibliothèque"
              : "Restaure des prompts depuis un fichier JSON"}
          </DialogDescription>
        </DialogHeader>

        {mode === "export" ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-bg-tertiary p-4">
              <div className="flex items-center gap-3 mb-3">
                <FileJson className="w-8 h-8 text-accent" />
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    Export JSON complet
                  </p>
                  <p className="text-xs text-text-secondary">
                    {prompts.length} prompts · {categories.length} catégories
                  </p>
                </div>
              </div>
            </div>
            <Button onClick={handleExport} className="w-full">
              <Download className="w-4 h-4" />
              Télécharger le backup
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div
              className="rounded-xl border-2 border-dashed border-border hover:border-accent/30 p-8 text-center cursor-pointer transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-8 h-8 text-text-secondary mx-auto mb-3" />
              <p className="text-sm text-text-primary mb-1">
                Clique pour sélectionner un fichier
              </p>
              <p className="text-xs text-text-secondary">
                Fichier JSON exporté depuis PromptVault
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImport}
              />
            </div>
            {loading && (
              <div className="flex items-center justify-center gap-2 text-sm text-text-secondary">
                <Loader2 className="w-4 h-4 animate-spin" />
                Import en cours...
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
