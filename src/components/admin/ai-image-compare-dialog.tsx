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
  `First analyze the original image carefully and identify only the jewelry products that are physically present. Create an exact inventory of the visible ornaments and use only those items.

Then create a realistic product-composite image by placing the verified ornaments onto a clean white plastic jewelry display set. The display set must be white, not beige, cream, gold, gray, or any other color. The stands, trays, busts, holders, and base should all be matte or satin white plastic. The overall scene should look like a premium white studio jewelry display.

Place every identified ornament from the original image onto the white display set in a natural, balanced showroom layout. Every visible ornament must appear exactly once unless it is clearly a separate duplicate in the original image.

Preserve each ornament exactly as it appears in the source image: same design, shape, proportions, colors, stones, metalwork, and finish. Do not redesign, stylize, simplify, enhance, or invent any ornament. Do not omit any original item.

Critical constraint: do not add bangles, bracelets, wristwear, or any other jewelry that is not visible in the original image. If an item is not present in the original image, it must not appear in the final image. Do not infer missing products from the style of the jewelry. Only use the ornaments provided above.

Arrange only the verified products neatly on the white plastic display set so the final image looks like a premium jewelry catalog shot. Keep the background clean, bright, and white, with realistic lighting, soft shadows, and reflections that match a white product display. The result must contain only the original products accurately transferred onto the white plastic set.
`;

function buildDefaultPrompt(
  description?: string | null,
  descriptionTelugu?: string | null
) {
  const lines: string[] = [];
  const normalizedDescription = description?.trim();
  const normalizedDescriptionTelugu = descriptionTelugu?.trim();

  if (normalizedDescription) {
    lines.push(`Ornaments present in the image are : ${normalizedDescription}`);
  }

  if (normalizedDescriptionTelugu) {
    lines.push(
      `Ornaments present in the image are in Telugu : ${normalizedDescriptionTelugu}`
    );
  }

  return `${lines.join("\n")}\n\n${DEFAULT_PROMPT}`;
}

interface AIImageCompareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalSrc: string;
  file: File;
  description?: string | null;
  descriptionTelugu?: string | null;
  onApprove: (enhancedFile: File, enhancedSrc: string) => void;
  onApproveBoth?: (enhancedFile: File, enhancedSrc: string) => void;
  onReject: () => void;
}

export function AIImageCompareDialog({
  open,
  onOpenChange,
  originalSrc,
  file,
  description,
  descriptionTelugu,
  onApprove,
  onApproveBoth,
  onReject,
}: AIImageCompareDialogProps) {
  const [prompt, setPrompt] = useState(
    buildDefaultPrompt(description, descriptionTelugu)
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [enhancedSrc, setEnhancedSrc] = useState<string | null>(null);
  const [enhancedFile, setEnhancedFile] = useState<File | null>(null);

  function handleClose(isOpen: boolean) {
    if (!isOpen) {
      setEnhancedSrc(null);
      setEnhancedFile(null);
      setPrompt(buildDefaultPrompt(description, descriptionTelugu));
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
      setPrompt(buildDefaultPrompt(description, descriptionTelugu));
    }
  }

  function handleApproveBoth() {
    if (enhancedFile && enhancedSrc && onApproveBoth) {
      onApproveBoth(enhancedFile, enhancedSrc);
      setEnhancedSrc(null);
      setEnhancedFile(null);
      setPrompt(buildDefaultPrompt(description, descriptionTelugu));
    }
  }

  function handleReject() {
    setEnhancedSrc(null);
    setEnhancedFile(null);
    setPrompt(buildDefaultPrompt(description, descriptionTelugu));
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
                rows={1}
                className="h-60 resize-none overflow-y-auto"
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
                rows={1}
                className="h-60 resize-none overflow-y-auto"
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
              {onApproveBoth && (
                <Button onClick={handleApproveBoth} disabled={isGenerating}>
                  Use Both
                </Button>
              )}
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
