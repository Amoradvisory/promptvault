"use client";

import { useState } from "react";
import { useStore } from "@/stores/useStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORY_COLORS } from "@/types/database";
import { cn } from "@/lib/utils";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";

export function CategoryManager() {
  const { categories, createCategory, updateCategory, deleteCategory, prompts } =
    useStore();

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(CATEGORY_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createCategory(newName.trim(), newColor, "folder");
    setNewName("");
    toast.success("Catégorie créée");
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    await updateCategory(id, { name: editName.trim(), color: editColor });
    setEditingId(null);
    toast.success("Catégorie mise à jour");
  };

  const handleDelete = async (id: string) => {
    const count = prompts.filter((p) => p.category_id === id).length;
    if (count > 0) {
      const ok = window.confirm(
        `Cette catégorie contient ${count} prompt${count > 1 ? "s" : ""}. Ils seront décatégorisés. Continuer ?`
      );
      if (!ok) return;
    }
    await deleteCategory(id);
    toast.success("Catégorie supprimée");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-1">
          Gérer les catégories
        </h2>
        <p className="text-sm text-text-secondary">
          Organise tes prompts par catégorie avec des couleurs personnalisées
        </p>
      </div>

      {/* Create new */}
      <div className="flex items-end gap-3">
        <div className="flex-1 space-y-1.5">
          <label className="text-sm text-text-secondary">
            Nouvelle catégorie
          </label>
          <Input
            placeholder="Nom de la catégorie"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm text-text-secondary">Couleur</label>
          <div className="flex gap-1.5">
            {CATEGORY_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setNewColor(color)}
                className={cn(
                  "w-7 h-7 rounded-md transition-all cursor-pointer border-2",
                  newColor === color
                    ? "border-text-primary scale-110"
                    : "border-transparent hover:scale-105"
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
        <Button onClick={handleCreate} disabled={!newName.trim()}>
          <Plus className="w-4 h-4" />
          Créer
        </Button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {categories.map((cat) => {
          const count = prompts.filter(
            (p) => p.category_id === cat.id
          ).length;
          const isEditing = editingId === cat.id;

          return (
            <div
              key={cat.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-bg-secondary"
            >
              {isEditing ? (
                <>
                  <div className="flex gap-1">
                    {CATEGORY_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setEditColor(color)}
                        className={cn(
                          "w-5 h-5 rounded transition-all cursor-pointer border",
                          editColor === color
                            ? "border-text-primary"
                            : "border-transparent"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 h-8"
                    autoFocus
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleUpdate(cat.id)
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleUpdate(cat.id)}
                  >
                    <Check className="w-4 h-4 text-success" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setEditingId(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span
                    className="w-4 h-4 rounded-md flex-shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="flex-1 text-sm text-text-primary">
                    {cat.name}
                  </span>
                  <span className="text-xs text-text-secondary">
                    {count} prompt{count > 1 ? "s" : ""}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      setEditingId(cat.id);
                      setEditName(cat.name);
                      setEditColor(cat.color);
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(cat.id)}
                    className="text-text-secondary hover:text-danger"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}
            </div>
          );
        })}

        {categories.length === 0 && (
          <p className="text-sm text-text-secondary text-center py-8">
            Aucune catégorie. Crée ta première catégorie ci-dessus.
          </p>
        )}
      </div>
    </div>
  );
}
