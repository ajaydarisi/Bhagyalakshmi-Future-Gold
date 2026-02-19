"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, SortableHeader } from "@/components/admin/data-table";
import { formatDate } from "@/lib/formatters";
import { updateUserRole } from "@/app/admin/actions";
import type { Profile } from "@/types/user";

function RoleCell({ user }: { user: Profile }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleRoleChange(role: string) {
    startTransition(async () => {
      const result = await updateUserRole(
        user.id,
        role as "customer" | "admin"
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Role updated to ${role}`);
        router.refresh();
      }
    });
  }

  return (
    <Select
      value={user.role}
      onValueChange={handleRoleChange}
      disabled={isPending}
    >
      <SelectTrigger className="w-[120px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="customer">Customer</SelectItem>
        <SelectItem value="admin">Admin</SelectItem>
      </SelectContent>
    </Select>
  );
}

const columns: ColumnDef<Profile>[] = [
  {
    accessorKey: "full_name",
    header: ({ column }) => (
      <SortableHeader column={column}>Name</SortableHeader>
    ),
    cell: ({ row }) => (
      <span className="font-medium">
        {row.original.full_name || "No name"}
      </span>
    ),
  },
  {
    accessorKey: "email",
    header: ({ column }) => (
      <SortableHeader column={column}>Email</SortableHeader>
    ),
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => <RoleCell user={row.original} />,
  },
  {
    accessorKey: "created_at",
    header: ({ column }) => (
      <SortableHeader column={column}>Joined</SortableHeader>
    ),
    cell: ({ row }) => formatDate(row.original.created_at),
  },
];

interface UsersTableProps {
  users: Profile[];
}

export function UsersTable({ users }: UsersTableProps) {
  return <DataTable columns={columns} data={users} />;
}
