"use client";

import { useState } from "react";
import Image from "next/image";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { enhanceImageWithAI, base64ToFile } from "@/lib/ai/enhance-image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const DEFAULT_PROMPT =
  "Give me in a website presentable photo wearing on a plastic set";

interface AIImageCompareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalSrc: string;
  file: File;
  onApprove: (enhancedFile: File, enhancedSrc: string) => void;
  onReject: () => void;
}

export function AIImageCompareDialog({
  open,
  onOpenChange,
  originalSrc,
  file,
  onApprove,
  onReject,
}: AIImageCompareDialogProps) {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [isGenerating, setIsGenerating] = useState(false);
  const [enhancedSrc, setEnhancedSrc] = useState<string | null>(null);
  const [enhancedFile, setEnhancedFile] = useState<File | null>(null);

  function handleClose(isOpen: boolean) {
    if (!isOpen) {
      setEnhancedSrc(null);
      setEnhancedFile(null);
      setPrompt(DEFAULT_PROMPT);
      onOpenChange(false);
    }
  }

  async function handleGenerate() {
    setIsGenerating(true);
    try {
      const result = await enhanceImageWithAI(file, prompt);
      const dataUrl = `data:${result.mimeType};base64,${result.imageBase64}`;
      const newFile = base64ToFile(
        result.imageBase64,
        result.mimeType,
        `ai-enhanced-${Date.now()}`
      );
      setEnhancedSrc(dataUrl);
      setEnhancedFile(newFile);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "AI enhancement failed"
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function handleApprove() {
    if (enhancedFile && enhancedSrc) {
      onApprove(enhancedFile, enhancedSrc);
      setEnhancedSrc(null);
      setEnhancedFile(null);
      setPrompt(DEFAULT_PROMPT);
    }
  }

  function handleReject() {
    setEnhancedSrc(null);
    setEnhancedFile(null);
    setPrompt(DEFAULT_PROMPT);
    onReject();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>AI Image Enhancement</DialogTitle>
          <DialogDescription>
            {enhancedSrc
              ? "Compare the original with the AI-generated version."
              : "Edit the prompt and generate an AI-enhanced version."}
          </DialogDescription>
        </DialogHeader>

        {enhancedSrc ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-center">Original</p>
                <div className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
                  <Image
                    src={originalSrc}
                    alt="Original"
                    fill
                    className="object-cover"
                    sizes="300px"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-center">AI Enhanced</p>
                <div className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={enhancedSrc}
                    alt="AI Enhanced"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-prompt-edit">Prompt</Label>
              <Textarea
                id="ai-prompt-edit"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={2}
                disabled={isGenerating}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative aspect-video max-h-48 mx-auto overflow-hidden rounded-lg border bg-muted">
              <Image
                src={originalSrc}
                alt="Original"
                fill
                className="object-contain"
                sizes="400px"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-prompt">Prompt</Label>
              <Textarea
                id="ai-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                placeholder="Describe how you want the image enhanced..."
                disabled={isGenerating}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {enhancedSrc ? (
            <>
              <Button variant="outline" onClick={handleReject}>
                Keep Original
              </Button>
              <Button
                variant="outline"
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
              >
                {isGenerating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Regenerate
              </Button>
              <Button onClick={handleApprove} disabled={isGenerating}>
                Use AI Version
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => handleClose(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
              >
                {isGenerating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {isGenerating ? "Generating..." : "Generate"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
