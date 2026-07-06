"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { AddressForm } from "@/components/checkout/address-form";
import { EmptyState } from "@/components/shared/empty-state";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import type { AddressInput } from "@/lib/validators";
import type { Address } from "@/types/user";
import { toast } from "sonner";
import { MapPin, Plus, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { user } = useAuth();
  const supabase = createClient();
  const t = useTranslations("account.addresses");

  const fetchAddresses = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    setAddresses(data || []);
    setIsLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      await fetchAddresses();
    };
    load();
  }, [user, fetchAddresses]);

  async function handleAddAddress(data: AddressInput) {
    if (!user) return;
    const { error } = await supabase
      .from("addresses")
      .insert({ ...data, user_id: user.id });
    if (error) {
      toast.error(t("addError"));
    } else {
      toast.success(t("addSuccess"));
      setDialogOpen(false);
      fetchAddresses();
    }
  }

  async function handleUpdateAddress(data: AddressInput) {
    if (!user || !editingAddress) return;
    const { error } = await supabase
      .from("addresses")
      .update(data)
      .eq("id", editingAddress.id);
    if (error) {
      toast.error(t("updateError"));
    } else {
      toast.success(t("updateSuccess"));
      setEditingAddress(null);
      setDialogOpen(false);
      fetchAddresses();
    }
  }

  async function handleDeleteAddress(id: string) {
    const { error } = await supabase.from("addresses").delete().eq("id", id);
    if (error) {
      toast.error(t("deleteError"));
    } else {
      toast.success(t("deleteSuccess"));
      fetchAddresses();
    }
  }

  async function handleSetDefault(id: string) {
    if (!user) return;
    await supabase
      .from("addresses")
      .update({ is_default: false })
      .eq("user_id", user.id);
    await supabase
      .from("addresses")
      .update({ is_default: true })
      .eq("id", id);
    toast.success(t("defaultSuccess"));
    fetchAddresses();
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--gold-500)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display text-2xl text-text-primary">{t("title")}</h2>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingAddress(null);
        }}>
          <DialogTrigger asChild>
            <Button variant="gold" size="bfg-sm">
              <Plus className="mr-2 h-4 w-4" />
              {t("addAddress")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingAddress ? t("editAddress") : t("addNewAddress")}
              </DialogTitle>
            </DialogHeader>
            <AddressForm
              address={editingAddress}
              onSubmit={editingAddress ? handleUpdateAddress : handleAddAddress}
              onCancel={() => {
                setDialogOpen(false);
                setEditingAddress(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {addresses.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-8 w-8" strokeWidth={1.7} />}
          title={t("empty")}
          description={t("emptyDesc")}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses.map((address) => (
            <Card key={address.id}>
              <CardContent className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{address.label}</span>
                    {address.is_default && (
                      <Badge variant="gold" size="sm">{t("default")}</Badge>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditingAddress(address);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("deleteDesc")}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteAddress(address.id)}
                          >
                            {t("delete")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>{address.full_name}</p>
                  <p>{address.address_line_1}</p>
                  {address.address_line_2 && <p>{address.address_line_2}</p>}
                  <p>
                    {address.city}, {address.state} {address.postal_code}
                  </p>
                  <p>{address.phone}</p>
                </div>
                {!address.is_default && (
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-2 h-auto p-0 text-text-gold"
                    onClick={() => handleSetDefault(address.id)}
                  >
                    {t("setDefault")}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
