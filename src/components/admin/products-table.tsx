"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable, SortableHeader } from "@/components/admin/data-table";
import { formatPrice } from "@/lib/formatters";
import { deleteProduct } from "@/app/admin/actions";
import type { ProductWithCategory } from "@/types/product";

const columns: ColumnDef<ProductWithCategory>[] = [
  {
    accessorKey: "images",
    header: "Image",
    cell: ({ row }) => {
      const images = row.original.images;
      return images && images.length > 0 ? (
        <div className="relative size-10 overflow-hidden rounded-md">
          <Image
            src={images[0]}
            alt={row.original.name}
            fill
            className="object-cover"
          />
        </div>
      ) : (
        <div className="flex size-10 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
          N/A
        </div>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <SortableHeader column={column}>Name</SortableHeader>
    ),
    cell: ({ row }) => (
      <span className="font-medium">{row.original.name}</span>
    ),
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => row.original.category?.name ?? "Uncategorized",
  },
  {
    accessorKey: "price",
    header: ({ column }) => (
      <SortableHeader column={column}>Price</SortableHeader>
    ),
    cell: ({ row }) => {
      const { price, discount_price } = row.original;
      return (
        <div>
          <span>{formatPrice(discount_price ?? price)}</span>
          {discount_price && (
            <span className="ml-1 text-xs text-muted-foreground line-through">
              {formatPrice(price)}
            </span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "stock",
    header: ({ column }) => (
      <SortableHeader column={column}>Stock</SortableHeader>
    ),
    cell: ({ row }) => {
      const stock = row.original.stock;
      return (
        <Badge variant={stock > 0 ? "secondary" : "destructive"}>
          {stock}
        </Badge>
      );
    },
  },
  {
    accessorKey: "is_active",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={row.original.is_active ? "default" : "outline"}>
        {row.original.is_active ? "Active" : "Draft"}
      </Badge>
    ),
  },
  {
    id: "actions",
    cell: function ActionCell({ row }) {
      const router = useRouter();
      const product = row.original;

      async function handleDelete() {
        if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;

        const result = await deleteProduct(product.id);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Product deleted");
          router.refresh();
        }
      }

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs">
              <MoreHorizontal className="size-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/admin/products/${product.id}/edit`}>
                <Pencil className="size-4" />
                Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={handleDelete}>
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    enableSorting: false,
  },
];

interface ProductsTableProps {
  products: ProductWithCategory[];
}

export function ProductsTable({ products }: ProductsTableProps) {
  return <DataTable columns={columns} data={products} />;
}
