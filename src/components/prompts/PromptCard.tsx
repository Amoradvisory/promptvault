"use client";

import { useState } from "react";
import { useStore } from "@/stores/useStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { copyToClipboard, truncate, formatRelative } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  Star,
  Copy,
  Check,
  MoreHorizontal,
  Pencil,
  Trash2,
  CopyPlus,
} from "lucide-react";
import { TARGET_MODELS } from "@/types/database";
import type { Prompt } from "@/types/database";
import { toast } from "sonner";

interface PromptCardProps {
  prompt: Prompt;
}

export function PromptCard({ prompt }: PromptCardProps) {
  const { openEditor, toggleFavorite, deletePrompt, incrementUseCount, duplicatePrompt } =
    useStore();
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await copyToClipboard(prompt.content);
    if (ok) {
      setCopied(true);
      incrementUseCount(prompt.id);
      toast.success("Prompt copié !");
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleDelete = async () => {
    deletePrompt(prompt.id);
    toast.success("Prompt déplacé dans la corbeille");
  };

  const model = TARGET_MODELS.find((m) => m.value === prompt.target_model);

  return (
    <div
      className="group relative rounded-xl border border-border bg-bg-secondary p-4 card-glow cursor-pointer"
      onClick={() => openEditor(prompt)}
    >
      {/* Top row: title + actions */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-text-primary line-clamp-1 flex-1">
          {prompt.title}
        </h3>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Favorite */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(prompt.id);
            }}
            className={cn(
              prompt.is_favorite
                ? "text-favorite"
                : "text-text-secondary opacity-0 group-hover:opacity-100"
            )}
          >
            <Star
              className="w-4 h-4"
              fill={prompt.is_favorite ? "currentColor" : "none"}
            />
          </Button>

          {/* Copy — THE #1 FEATURE */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleCopy}
            className={cn(
              "transition-all",
              copied
                ? "text-success copy-pulse"
                : "text-text-secondary hover:text-accent"
            )}
          >
            {copied ? (
              <Check className="w-4 h-4" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </Button>

          {/* Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => e.stopPropagation()}
                className="text-text-secondary opacity-0 group-hover:opacity-100"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  openEditor(prompt);
                }}
              >
                <Pencil className="w-4 h-4" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  duplicatePrompt(prompt.id);
                  toast.success("Prompt dupliqué");
                }}
              >
                <CopyPlus className="w-4 h-4" />
                Dupliquer
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                danger
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
              >
                <Trash2 className="w-4 h-4" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content preview */}
      <p className="text-xs text-text-secondary font-mono leading-relaxed line-clamp-3 mb-3">
        {truncate(prompt.content, 200)}
      </p>

      {/* Bottom row: category, tags, model, date */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {prompt.category && (
            <Badge color={prompt.category.color} className="text-[10px]">
              {prompt.category.name}
            </Badge>
          )}
          {prompt.tags?.slice(0, 2).map((tag) => (
            <Badge key={tag.id} variant="secondary" className="text-[10px]">
              {tag.name}
            </Badge>
          ))}
          {(prompt.tags?.length || 0) > 2 && (
            <span className="text-[10px] text-text-secondary">
              +{(prompt.tags?.length || 0) - 2}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {model && (
            <span
              className="text-[10px] font-medium"
              style={{ color: model.color }}
            >
              {model.label}
            </span>
          )}
          <span className="text-[10px] text-text-secondary">
            {formatRelative(prompt.updated_at)}
          </span>
        </div>
      </div>

      {/* Use count indicator */}
      {prompt.use_count > 0 && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-[10px] text-text-secondary bg-bg-tertiary px-1.5 py-0.5 rounded">
            {prompt.use_count}×
          </span>
        </div>
      )}
    </div>
  );
}
