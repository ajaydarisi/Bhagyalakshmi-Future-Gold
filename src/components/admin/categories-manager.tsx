"use client";

import { useState, useTransition, Fragment } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { generateSlug } from "@/lib/formatters";
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/app/admin/actions";
import type { Category } from "@/types/product";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CategoriesManagerProps {
  categories: Category[];
}

type CategoryNode = Category & { children: CategoryNode[] };

function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const parents = categories
    .filter((c) => !c.parent_id)
    .sort((a, b) => a.sort_order - b.sort_order);
  return parents.map((parent) => ({
    ...parent,
    children: categories
      .filter((c) => c.parent_id === parent.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((child) => ({
        ...child,
        children: categories
          .filter((c) => c.parent_id === child.id)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((gc) => ({ ...gc, children: [] })),
      })),
  }));
}

export function CategoriesManager({ categories }: CategoriesManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [nameTelugu, setNameTelugu] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [parentId, setParentId] = useState<string | null>(null);

  const categoryTree = buildCategoryTree(categories);

  function resetForm() {
    setName("");
    setNameTelugu("");
    setSlug("");
    setDescription("");
    setImageUrl("");
    setSortOrder(0);
    setParentId(null);
    setEditing(null);
  }

  function openCreateDialog(presetParentId?: string) {
    resetForm();
    if (presetParentId) setParentId(presetParentId);
    setOpen(true);
  }

  function openEditDialog(category: Category) {
    setEditing(category);
    setName(category.name);
    setNameTelugu(category.name_telugu ?? "");
    setSlug(category.slug);
    setDescription(category.description ?? "");
    setImageUrl(category.image_url ?? "");
    setSortOrder(category.sort_order);
    setParentId(category.parent_id);
    setOpen(true);
  }

  function handleNameChange(value: string) {
    setName(value);
    if (!editing) {
      setSlug(generateSlug(value));
    }
  }

  function handleSubmit() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("name", name);
      formData.set("name_telugu", nameTelugu);
      formData.set("slug", slug || generateSlug(name));
      formData.set("description", description);
      formData.set("image_url", imageUrl);
      formData.set("sort_order", String(sortOrder));
      formData.set("parent_id", parentId ?? "");

      const result = editing
        ? await updateCategory(editing.id, formData)
        : await createCategory(formData);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          editing ? "Category updated" : "Category created"
        );
        setOpen(false);
        resetForm();
        router.refresh();
      }
    });
  }

  function handleDelete(category: Category) {
    if (!confirm(`Delete "${category.name}"? This will also delete all subcategories.`)) return;

    startTransition(async () => {
      const result = await deleteCategory(category.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Category deleted");
        router.refresh();
      }
    });
  }

  function renderCategoryRow(cat: Category, depth: number) {
    return (
      <TableRow key={cat.id}>
        <TableCell className="font-medium">
          <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 24}px` }}>
            {depth > 0 && <ChevronRight className="size-3 text-muted-foreground shrink-0" />}
            <span>{cat.name}</span>
            {cat.name_telugu && (
              <span className="text-xs text-muted-foreground ml-1">
                ({cat.name_telugu})
              </span>
            )}
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground">
          {cat.slug}
        </TableCell>
        <TableCell className="max-w-[200px] truncate text-muted-foreground">
          {cat.description || "-"}
        </TableCell>
        <TableCell className="text-center">
          {cat.sort_order}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => openCreateDialog(cat.id)}
              title="Add subcategory"
            >
              <Plus className="size-4" />
              <span className="sr-only">Add subcategory</span>
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => openEditDialog(cat)}
            >
              <Pencil className="size-4" />
              <span className="sr-only">Edit</span>
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => handleDelete(cat)}
              disabled={isPending}
            >
              <Trash2 className="size-4 text-destructive" />
              <span className="sr-only">Delete</span>
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  function renderTree(nodes: CategoryNode[], depth: number) {
    return nodes.map((node) => (
      <Fragment key={node.id}>
        {renderCategoryRow(node, depth)}
        {node.children.length > 0 && renderTree(node.children, depth + 1)}
      </Fragment>
    ));
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openCreateDialog()}>
              <Plus className="size-4" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit Category" : "New Category"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Parent Category</Label>
                <Select
                  value={parentId ?? "none"}
                  onValueChange={(value) =>
                    setParentId(value === "none" ? null : value)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="None (top-level)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (top-level)</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.parent_id ? "\u00A0\u00A0" : ""}{cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Category name"
                />
              </div>

              <div className="space-y-2">
                <Label>Name (Telugu)</Label>
                <Input
                  value={nameTelugu}
                  onChange={(e) => setNameTelugu(e.target.value)}
                  placeholder="తెలుగు పేరు"
                />
              </div>

              <div className="space-y-2">
                <Label>Slug</Label>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="category-slug"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Image URL</Label>
                <Input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  min="0"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isPending || !name}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                {editing ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-center">Sort Order</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categoryTree.length > 0 ? (
              renderTree(categoryTree, 0)
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No categories yet. Create one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
