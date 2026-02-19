"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { formatPrice, formatDate } from "@/lib/formatters";
import {
  createCoupon,
  updateCoupon,
  deleteCoupon,
} from "@/app/admin/actions";
import type { Database } from "@/types/database";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Coupon = Database["public"]["Tables"]["coupons"]["Row"];

interface CouponsManagerProps {
  coupons: Coupon[];
}

export function CouponsManager({ coupons }: CouponsManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);

  // Form state
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">(
    "percentage"
  );
  const [discountValue, setDiscountValue] = useState(0);
  const [minOrderAmount, setMinOrderAmount] = useState(0);
  const [maxUses, setMaxUses] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [expiresAt, setExpiresAt] = useState("");

  function resetForm() {
    setCode("");
    setDescription("");
    setDiscountType("percentage");
    setDiscountValue(0);
    setMinOrderAmount(0);
    setMaxUses("");
    setIsActive(true);
    setExpiresAt("");
    setEditing(null);
  }

  function openCreateDialog() {
    resetForm();
    setOpen(true);
  }

  function openEditDialog(coupon: Coupon) {
    setEditing(coupon);
    setCode(coupon.code);
    setDescription(coupon.description ?? "");
    setDiscountType(coupon.discount_type);
    setDiscountValue(coupon.discount_value);
    setMinOrderAmount(coupon.min_order_amount);
    setMaxUses(coupon.max_uses !== null ? String(coupon.max_uses) : "");
    setIsActive(coupon.is_active);
    setExpiresAt(
      coupon.expires_at ? coupon.expires_at.split("T")[0] : ""
    );
    setOpen(true);
  }

  function handleSubmit() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("code", code);
      formData.set("description", description);
      formData.set("discount_type", discountType);
      formData.set("discount_value", String(discountValue));
      formData.set("min_order_amount", String(minOrderAmount));
      formData.set("max_uses", maxUses);
      formData.set("is_active", String(isActive));
      formData.set("expires_at", expiresAt || "");

      const result = editing
        ? await updateCoupon(editing.id, formData)
        : await createCoupon(formData);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(editing ? "Coupon updated" : "Coupon created");
        setOpen(false);
        resetForm();
        router.refresh();
      }
    });
  }

  function handleDelete(coupon: Coupon) {
    if (!confirm(`Delete coupon "${coupon.code}"? This cannot be undone.`))
      return;

    startTransition(async () => {
      const result = await deleteCoupon(coupon.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Coupon deleted");
        router.refresh();
      }
    });
  }

  function formatDiscount(coupon: Coupon) {
    if (coupon.discount_type === "percentage") {
      return `${coupon.discount_value}%`;
    }
    return formatPrice(coupon.discount_value);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="size-4" />
              Add Coupon
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit Coupon" : "New Coupon"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="SAVE20"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Discount Type</Label>
                  <Select
                    value={discountType}
                    onValueChange={(v) =>
                      setDiscountType(v as "percentage" | "fixed")
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>
                    Discount Value{" "}
                    {discountType === "percentage" ? "(%)" : "(INR)"}
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step={discountType === "percentage" ? "1" : "0.01"}
                    value={discountValue || ""}
                    onChange={(e) =>
                      setDiscountValue(parseFloat(e.target.value) || 0)
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Min Order Amount</Label>
                  <Input
                    type="number"
                    min="0"
                    value={minOrderAmount || ""}
                    onChange={(e) =>
                      setMinOrderAmount(parseFloat(e.target.value) || 0)
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Max Uses (leave empty for unlimited)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    placeholder="Unlimited"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Expires At</Label>
                <Input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <Label>Active</Label>
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
              <Button onClick={handleSubmit} disabled={isPending || !code}>
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
              <TableHead>Code</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Min Order</TableHead>
              <TableHead className="text-center">Usage</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {coupons.length > 0 ? (
              coupons.map((coupon) => (
                <TableRow key={coupon.id}>
                  <TableCell className="font-mono font-medium">
                    {coupon.code}
                  </TableCell>
                  <TableCell>{formatDiscount(coupon)}</TableCell>
                  <TableCell>
                    {coupon.min_order_amount > 0
                      ? formatPrice(coupon.min_order_amount)
                      : "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    {coupon.used_count}
                    {coupon.max_uses !== null ? ` / ${coupon.max_uses}` : ""}
                  </TableCell>
                  <TableCell>
                    {coupon.expires_at
                      ? formatDate(coupon.expires_at)
                      : "Never"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={coupon.is_active ? "default" : "secondary"}
                    >
                      {coupon.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => openEditDialog(coupon)}
                      >
                        <Pencil className="size-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleDelete(coupon)}
                        disabled={isPending}
                      >
                        <Trash2 className="size-4 text-destructive" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No coupons yet. Create one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
