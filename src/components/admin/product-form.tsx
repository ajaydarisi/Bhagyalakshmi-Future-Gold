"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import Image from "next/image";
import { Loader2, Trash2, Upload } from "lucide-react";

import { productSchema, type ProductInput } from "@/lib/validators";
import { generateSlug } from "@/lib/formatters";
import { MATERIALS, PRODUCT_TAGS } from "@/lib/constants";
import { createProduct, updateProduct } from "@/app/admin/actions";
import { uploadProductImage, deleteProductImage } from "@/lib/supabase/storage";
import type { Product, Category } from "@/types/product";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

interface ProductFormProps {
  product?: Product;
  categories: Category[];
}

interface ImageEntry {
  url: string;
  file?: File;
  preview?: string;
}

function buildCategoryTree(categories: Category[]) {
  const parents = categories
    .filter((c) => !c.parent_id)
    .sort((a, b) => a.sort_order - b.sort_order);
  return parents.map((parent) => ({
    ...parent,
    children: categories
      .filter((c) => c.parent_id === parent.id)
      .sort((a, b) => a.sort_order - b.sort_order),
  }));
}

export function ProductForm({ product, categories }: ProductFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<ImageEntry[]>(
    product?.images.map((url) => ({ url })) ?? []
  );
  const [isUploading, setIsUploading] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);

  const categoryTree = buildCategoryTree(categories);

  const form = useForm<ProductInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(productSchema) as any,
    defaultValues: {
      name: product?.name ?? "",
      name_telugu: product?.name_telugu ?? null,
      slug: product?.slug ?? "",
      description: product?.description ?? "",
      description_telugu: product?.description_telugu ?? null,
      price: product?.price ?? 0,
      discount_price: product?.discount_price ?? null,
      category_id: product?.category_id ?? null,
      stock: product?.stock ?? 0,
      material: product?.material ?? null,
      tags: product?.tags ?? [],
      images: product?.images ?? [],
      is_active: product?.is_active ?? true,
      featured: product?.featured ?? false,
      is_sale: product?.is_sale ?? true,
      is_rental: product?.is_rental ?? false,
      rental_price: product?.rental_price ?? null,
      rental_discount_price: product?.rental_discount_price ?? null,
      rental_deposit: product?.rental_deposit ?? null,
      max_rental_days: product?.max_rental_days ?? null,
    },
  });

  const isRental = form.watch("is_rental");

  function handleNameChange(name: string) {
    form.setValue("name", name);
    if (!product) {
      form.setValue("slug", generateSlug(name));
    }
  }

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    const newEntries: ImageEntry[] = Array.from(files).map((file) => ({
      url: "",
      file,
      preview: URL.createObjectURL(file),
    }));

    setImages((prev) => [...prev, ...newEntries]);

    // Reset the input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function removeImage(index: number) {
    const entry = images[index];

    // If it's an already-uploaded Supabase URL, delete from storage
    if (entry.url && entry.url.includes("supabase.co/storage")) {
      await deleteProductImage(entry.url);
    }

    // Revoke preview URL to prevent memory leaks
    if (entry.preview) URL.revokeObjectURL(entry.preview);

    const updated = images.filter((_, i) => i !== index);
    setImages(updated);
    form.setValue(
      "images",
      updated.filter((e) => e.url).map((e) => e.url)
    );
  }

  async function uploadPendingImages(): Promise<string[]> {
    const urls: string[] = [];

    for (const entry of images) {
      if (entry.url) {
        // Already uploaded
        urls.push(entry.url);
      } else if (entry.file) {
        // Needs upload
        const url = await uploadProductImage(entry.file);
        urls.push(url);
      }
    }

    return urls;
  }

  function onSubmit(data: ProductInput) {
    startTransition(async () => {
      setIsUploading(true);
      try {
        // Upload any new files first
        const imageUrls = await uploadPendingImages();

        const formData = new FormData();
        formData.set("name", data.name);
        formData.set("name_telugu", data.name_telugu ?? "");
        formData.set("slug", data.slug);
        formData.set("description", data.description ?? "");
        formData.set("description_telugu", data.description_telugu ?? "");
        formData.set("price", String(data.price));
        formData.set(
          "discount_price",
          data.discount_price ? String(data.discount_price) : ""
        );
        formData.set("category_id", data.category_id ?? "");
        formData.set("stock", String(data.stock));
        formData.set("material", data.material ?? "");
        formData.set("is_active", String(data.is_active));
        formData.set("featured", String(data.featured));
        formData.set("is_sale", String(data.is_sale));
        formData.set("is_rental", String(data.is_rental));
        formData.set(
          "rental_price",
          data.rental_price ? String(data.rental_price) : ""
        );
        formData.set(
          "rental_discount_price",
          data.rental_discount_price ? String(data.rental_discount_price) : ""
        );
        formData.set(
          "rental_deposit",
          data.rental_deposit ? String(data.rental_deposit) : ""
        );
        formData.set(
          "max_rental_days",
          data.max_rental_days ? String(data.max_rental_days) : ""
        );

        for (const tag of data.tags) {
          formData.append("tags", tag);
        }
        for (const url of imageUrls) {
          formData.append("images", url);
        }

        const result = product
          ? await updateProduct(product.id, formData)
          : await createProduct(formData);

        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success(product ? "Product updated" : "Product created");

          // Fire selected notifications after successful save
          const productId = product?.id || ("productId" in result ? result.productId : undefined);
          if (productId && notifications.length > 0) {
            for (const type of notifications) {
              try {
                const res = await fetch("/api/notifications/send-product", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ productId, type }),
                });
                if (!res.ok) {
                  const data = await res.json();
                  console.error("Notification failed:", type, data);
                  toast.error(`Notification (${type}) failed: ${data.error}`);
                }
              } catch (e) {
                console.error("Notification fetch error:", type, e);
                toast.error(`Notification (${type}) failed`);
              }
            }
            setNotifications([]);
          }

          router.push("/admin/products");
          router.refresh();
        }
      } catch {
        toast.error("Failed to upload images. Please try again.");
      } finally {
        setIsUploading(false);
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main info */}
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Product Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Product name"
                          onChange={(e) => handleNameChange(e.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name_telugu"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name (Telugu)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          placeholder="తెలుగు పేరు"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Slug</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="product-slug" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          value={field.value ?? ""}
                          placeholder="Product description..."
                          rows={5}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description_telugu"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Telugu)</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          value={field.value ?? ""}
                          placeholder="తెలుగులో ఉత్పత్తి వివరణ..."
                          rows={5}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pricing & Inventory</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sale Price</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            {...field}
                            value={field.value || ""}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value
                                  ? parseFloat(e.target.value)
                                  : 0
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="discount_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Discount Price</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Leave empty if no discount"
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value
                                  ? parseFloat(e.target.value)
                                  : null
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stock</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          value={field.value || ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value
                                ? parseInt(e.target.value)
                                : 0
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Rental Pricing — shown only when is_rental is true */}
            {isRental && (
              <Card>
                <CardHeader>
                  <CardTitle>Rental Pricing</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <FormField
                      control={form.control}
                      name="rental_price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rental Price</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Per rental"
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value
                                    ? parseFloat(e.target.value)
                                    : null
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="rental_discount_price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Discount Rental Price</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Leave empty if no discount"
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value
                                    ? parseFloat(e.target.value)
                                    : null
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="rental_deposit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Deposit</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Security deposit"
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value
                                    ? parseFloat(e.target.value)
                                    : null
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="max_rental_days"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max Days</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              placeholder="Max rental days"
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value
                                    ? parseInt(e.target.value)
                                    : null
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Images</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {images.length > 0 && (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {images.map((entry, index) => (
                      <div
                        key={index}
                        className="group relative aspect-square overflow-hidden rounded-lg border bg-muted"
                      >
                        <Image
                          src={entry.preview || entry.url}
                          alt={`Product image ${index + 1}`}
                          fill
                          sizes="200px"
                          className="object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute right-2 top-2 rounded-full bg-destructive p-1.5 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFilesSelected}
                />

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="size-4" />
                  Add Images
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <FormLabel>Active</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <Separator />

                <FormField
                  control={form.control}
                  name="featured"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <FormLabel>Featured</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sale / Rental</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="is_sale"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <FormLabel>For Sale</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <Separator />

                <FormField
                  control={form.control}
                  name="is_rental"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <FormLabel>For Rent</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="is_sale"
                  render={() => <FormMessage />}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Organization</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="category_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select
                        value={field.value ?? ""}
                        onValueChange={(value) =>
                          field.onChange(value || null)
                        }
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categoryTree.map((parent) => (
                            <SelectGroup key={parent.id}>
                              <SelectLabel>{parent.name}</SelectLabel>
                              <SelectItem value={parent.id}>
                                {parent.name} (All)
                              </SelectItem>
                              {parent.children.map((child) => (
                                <SelectItem key={child.id} value={child.id}>
                                  &nbsp;&nbsp;{child.name}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="material"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Material</FormLabel>
                      <Select
                        value={field.value ?? ""}
                        onValueChange={(value) =>
                          field.onChange(value || null)
                        }
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select material" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {MATERIALS.map((material) => (
                            <SelectItem key={material} value={material}>
                              {material}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <div className="space-y-2">
                        {PRODUCT_TAGS.map((tag) => (
                          <div
                            key={tag}
                            className="flex items-center gap-2"
                          >
                            <Checkbox
                              id={`tag-${tag}`}
                              checked={field.value.includes(tag)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  field.onChange([...field.value, tag]);
                                } else {
                                  field.onChange(
                                    field.value.filter(
                                      (t: string) => t !== tag
                                    )
                                  );
                                }
                              }}
                            />
                            <Label
                              htmlFor={`tag-${tag}`}
                              className="cursor-pointer font-normal"
                            >
                              {tag}
                            </Label>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notifications</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    { value: "price_drop", label: "Price Drop (Wishlist)" },
                    { value: "new_product", label: "New Product" },
                    { value: "back_in_stock", label: "Back in Stock" },
                  ].map((n) => (
                    <div key={n.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`notif-${n.value}`}
                        checked={notifications.includes(n.value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setNotifications((prev) => [...prev, n.value]);
                          } else {
                            setNotifications((prev) =>
                              prev.filter((t) => t !== n.value)
                            );
                          }
                        }}
                      />
                      <Label
                        htmlFor={`notif-${n.value}`}
                        className="cursor-pointer font-normal"
                      >
                        {n.label}
                      </Label>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Selected notifications will be sent to all users on save.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={isPending || isUploading}>
            {(isPending || isUploading) && (
              <Loader2 className="size-4 animate-spin" />
            )}
            {isUploading
              ? "Uploading images..."
              : product
                ? "Update Product"
                : "Create Product"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/admin/products")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
