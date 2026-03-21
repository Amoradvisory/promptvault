"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/stores/useStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { TARGET_MODELS } from "@/types/database";
import { X, Plus, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function PromptEditor() {
  const {
    isEditorOpen,
    editingPrompt,
    closeEditor,
    createPrompt,
    updatePrompt,
    categories,
    tags: allTags,
  } = useStore();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [targetModel, setTargetModel] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const isEditing = !!editingPrompt;

  useEffect(() => {
    if (editingPrompt) {
      setTitle(editingPrompt.title);
      setContent(editingPrompt.content);
      setDescription(editingPrompt.description || "");
      setCategoryId(editingPrompt.category_id);
      setTargetModel(editingPrompt.target_model);
      setIsFavorite(editingPrompt.is_favorite);
      setSelectedTags(editingPrompt.tags?.map((t) => t.name) || []);
    } else {
      setTitle("");
      setContent("");
      setDescription("");
      setCategoryId(null);
      setTargetModel(null);
      setIsFavorite(false);
      setSelectedTags([]);
    }
  }, [editingPrompt, isEditorOpen]);

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
    }
    setTagInput("");
  };

  const handleRemoveTag = (tag: string) => {
    setSelectedTags(selectedTags.filter((t) => t !== tag));
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("Titre et contenu sont obligatoires");
      return;
    }

    setSaving(true);

    const data = {
      title: title.trim(),
      content: content.trim(),
      description: description.trim() || undefined,
      category_id: categoryId,
      target_model: targetModel,
      is_favorite: isFavorite,
      tag_names: selectedTags,
    };

    if (isEditing) {
      await updatePrompt(editingPrompt.id, data);
      toast.success("Prompt mis à jour");
    } else {
      await createPrompt(data);
      toast.success("Prompt créé");
    }

    setSaving(false);
    closeEditor();
  };

  // Tag suggestions
  const tagSuggestions = allTags
    .filter(
      (t) =>
        !selectedTags.includes(t.name) &&
        t.name.toLowerCase().includes(tagInput.toLowerCase())
    )
    .slice(0, 5);

  return (
    <Dialog open={isEditorOpen} onOpenChange={(open) => !open && closeEditor()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Modifier le prompt" : "Nouveau prompt"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modifie les détails de ton prompt"
              : "Crée un nouveau prompt dans ta bibliothèque"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-sm text-text-secondary">
              Titre <span className="text-danger">*</span>
            </label>
            <Input
              placeholder="Nom descriptif du prompt"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm text-text-secondary">
                Contenu <span className="text-danger">*</span>
              </label>
              <span className="text-xs text-text-secondary">
                {content.length} car.
              </span>
            </div>
            <Textarea
              placeholder="Le texte de ton prompt..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[200px]"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-sm text-text-secondary">Description</label>
            <Input
              placeholder="Note explicative (optionnel)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-sm text-text-secondary">Catégorie</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCategoryId(null)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs border transition-all cursor-pointer",
                  !categoryId
                    ? "border-accent/30 bg-accent/10 text-accent"
                    : "border-border text-text-secondary hover:border-accent/20"
                )}
              >
                Aucune
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryId(cat.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs border transition-all cursor-pointer flex items-center gap-1.5",
                    categoryId === cat.id
                      ? "border-accent/30 bg-accent/10 text-accent"
                      : "border-border text-text-secondary hover:border-accent/20"
                  )}
                >
                  <span
                    className="w-2 h-2 rounded-sm"
                    style={{ backgroundColor: cat.color }}
                  />
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Target Model */}
          <div className="space-y-1.5">
            <label className="text-sm text-text-secondary">Modèle cible</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setTargetModel(null)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs border transition-all cursor-pointer",
                  !targetModel
                    ? "border-accent/30 bg-accent/10 text-accent"
                    : "border-border text-text-secondary hover:border-accent/20"
                )}
              >
                Tous
              </button>
              {TARGET_MODELS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setTargetModel(m.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs border transition-all cursor-pointer",
                    targetModel === m.value
                      ? "border-accent/30 bg-accent/10"
                      : "border-border text-text-secondary hover:border-accent/20"
                  )}
                  style={
                    targetModel === m.value ? { color: m.color } : undefined
                  }
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <label className="text-sm text-text-secondary">Tags</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {selectedTags.map((tag) => (
                <Badge key={tag} variant="default" className="gap-1">
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-danger transition-colors cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="relative">
              <Input
                placeholder="Ajouter un tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
              />
              {tagInput && tagSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-bg-secondary border border-border rounded-lg shadow-xl z-10 overflow-hidden">
                  {tagSuggestions.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => {
                        setSelectedTags([...selectedTags, tag.name]);
                        setTagInput("");
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors cursor-pointer"
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Favorite toggle */}
          <button
            onClick={() => setIsFavorite(!isFavorite)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all cursor-pointer",
              isFavorite
                ? "border-favorite/30 bg-favorite/10 text-favorite"
                : "border-border text-text-secondary hover:border-favorite/20"
            )}
          >
            <Star
              className="w-4 h-4"
              fill={isFavorite ? "currentColor" : "none"}
            />
            {isFavorite ? "Favori" : "Marquer comme favori"}
          </button>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={closeEditor}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving
                ? "Enregistrement..."
                : isEditing
                ? "Mettre à jour"
                : "Créer le prompt"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
