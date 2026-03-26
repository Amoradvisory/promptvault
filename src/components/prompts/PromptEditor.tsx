"use client";

import { useState } from "react";
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
import { TARGET_MODELS, type Prompt } from "@/types/database";
import { X, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface PromptEditorFormProps {
  prompt: Prompt | null;
  onClose: () => void;
}

function PromptEditorForm({ prompt, onClose }: PromptEditorFormProps) {
  const { createPrompt, updatePrompt, categories, tags: allTags } = useStore();
  const isEditing = Boolean(prompt);

  const [title, setTitle] = useState(prompt?.title ?? "");
  const [content, setContent] = useState(prompt?.content ?? "");
  const [description, setDescription] = useState(prompt?.description ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(prompt?.category_id ?? null);
  const [targetModel, setTargetModel] = useState<string | null>(prompt?.target_model ?? null);
  const [isFavorite, setIsFavorite] = useState(prompt?.is_favorite ?? false);
  const [tagInput, setTagInput] = useState("");
  const [selectedTags, setSelectedTags] = useState(prompt?.tag_names ?? prompt?.tags?.map((tag) => tag.name) ?? []);
  const [saving, setSaving] = useState(false);

  const selectedTagNames = new Set(selectedTags.map((tag) => tag.toLowerCase()));

  const tagSuggestions = allTags
    .filter(
      (tag) =>
        !selectedTagNames.has(tag.name.toLowerCase()) &&
        tag.name.toLowerCase().includes(tagInput.trim().toLowerCase())
    )
    .slice(0, 5);

  const handleAddTag = () => {
    const nextTag = tagInput.trim();
    if (!nextTag || selectedTagNames.has(nextTag.toLowerCase())) {
      setTagInput("");
      return;
    }

    setSelectedTags((current) => [...current, nextTag]);
    setTagInput("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setSelectedTags((current) => current.filter((tag) => tag !== tagToRemove));
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

    if (prompt) {
      await updatePrompt(prompt.id, data);
      toast.success("Prompt mis a jour");
    } else {
      await createPrompt(data);
      toast.success("Prompt cree");
    }

    setSaving(false);
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEditing ? "Modifier le prompt" : "Nouveau prompt"}</DialogTitle>
        <DialogDescription>
          {isEditing
            ? "Modifie les details de ton prompt"
            : "Cree un nouveau prompt dans ta bibliotheque"}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 mt-2">
        <div className="space-y-1.5">
          <label className="text-sm text-text-secondary">
            Titre <span className="text-danger">*</span>
          </label>
          <Input
            placeholder="Nom descriptif du prompt"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm text-text-secondary">
              Contenu <span className="text-danger">*</span>
            </label>
            <span className="text-xs text-text-secondary">{content.length} car.</span>
          </div>
          <Textarea
            placeholder="Le texte de ton prompt..."
            value={content}
            onChange={(event) => setContent(event.target.value)}
            className="min-h-[200px]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm text-text-secondary">Description</label>
          <Input
            placeholder="Note explicative (optionnel)"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm text-text-secondary">Categorie</label>
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
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setCategoryId(category.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs border transition-all cursor-pointer flex items-center gap-1.5",
                  categoryId === category.id
                    ? "border-accent/30 bg-accent/10 text-accent"
                    : "border-border text-text-secondary hover:border-accent/20"
                )}
              >
                <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: category.color }} />
                {category.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm text-text-secondary">Modele cible</label>
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
            {TARGET_MODELS.map((model) => (
              <button
                key={model.value}
                onClick={() => setTargetModel(model.value)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs border transition-all cursor-pointer",
                  targetModel === model.value
                    ? "border-accent/30 bg-accent/10"
                    : "border-border text-text-secondary hover:border-accent/20"
                )}
                style={targetModel === model.value ? { color: model.color } : undefined}
              >
                {model.label}
              </button>
            ))}
          </div>
        </div>

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
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
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
                      setSelectedTags((current) => [...current, tag.name]);
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

        <button
          onClick={() => setIsFavorite((current) => !current)}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all cursor-pointer",
            isFavorite
              ? "border-favorite/30 bg-favorite/10 text-favorite"
              : "border-border text-text-secondary hover:border-favorite/20"
          )}
        >
          <Star className="w-4 h-4" fill={isFavorite ? "currentColor" : "none"} />
          {isFavorite ? "Favori" : "Marquer comme favori"}
        </button>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement..." : isEditing ? "Mettre a jour" : "Creer le prompt"}
          </Button>
        </div>
      </div>
    </>
  );
}

export function PromptEditor() {
  const { isEditorOpen, editingPrompt, closeEditor } = useStore();

  return (
    <Dialog open={isEditorOpen} onOpenChange={(open) => !open && closeEditor()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {isEditorOpen ? (
          <PromptEditorForm key={editingPrompt?.id ?? "new"} prompt={editingPrompt} onClose={closeEditor} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
