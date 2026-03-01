"use client";

import Link from "next/link";
import type { ColumnDef, Table as TanStackTable } from "@tanstack/react-table";
import { Eye, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, SortableHeader } from "@/components/admin/data-table";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { formatPrice, formatDate } from "@/lib/formatters";
import { ORDER_STATUSES } from "@/lib/constants";
import type { Order } from "@/types/order";

type OrderWithEmail = Order & { customer_email: string };

const columns: ColumnDef<OrderWithEmail>[] = [
  {
    accessorKey: "order_number",
    header: ({ column }) => (
      <SortableHeader column={column}>Order</SortableHeader>
    ),
    cell: ({ row }) => (
      <Link
        href={`/admin/orders/${row.original.id}`}
        className="font-medium hover:underline"
      >
        {row.original.order_number}
      </Link>
    ),
  },
  {
    accessorKey: "customer_email",
    header: "Customer",
    filterFn: (row, _columnId, filterValue) => {
      if (!filterValue) return true;
      return row.original.customer_email
        .toLowerCase()
        .includes((filterValue as string).toLowerCase());
    },
  },
  {
    accessorKey: "created_at",
    header: ({ column }) => (
      <SortableHeader column={column}>Date</SortableHeader>
    ),
    cell: ({ row }) => formatDate(row.original.created_at),
    filterFn: (row, _columnId, filterValue) => {
      if (!filterValue || filterValue === "all") return true;
      const orderDate = new Date(row.original.created_at);
      const now = new Date();
      const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );
      switch (filterValue) {
        case "today":
          return orderDate >= startOfToday;
        case "7days": {
          const d = new Date(startOfToday);
          d.setDate(d.getDate() - 7);
          return orderDate >= d;
        }
        case "30days": {
          const d = new Date(startOfToday);
          d.setDate(d.getDate() - 30);
          return orderDate >= d;
        }
        case "90days": {
          const d = new Date(startOfToday);
          d.setDate(d.getDate() - 90);
          return orderDate >= d;
        }
        default:
          return true;
      }
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <OrderStatusBadge status={row.original.status} />,
    filterFn: (row, _columnId, filterValue) => {
      if (!filterValue || filterValue === "all") return true;
      return row.original.status === filterValue;
    },
  },
  {
    accessorKey: "total",
    header: ({ column }) => (
      <SortableHeader column={column}>Total</SortableHeader>
    ),
    cell: ({ row }) => (
      <span className="font-medium">{formatPrice(row.original.total)}</span>
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <Button variant="ghost" size="icon-xs" asChild>
        <Link href={`/admin/orders/${row.original.id}`}>
          <Eye className="size-4" />
          <span className="sr-only">View</span>
        </Link>
      </Button>
    ),
    enableSorting: false,
  },
];

function OrderMobileCard({ order }: { order: OrderWithEmail }) {
  return (
    <Link
      href={`/admin/orders/${order.id}`}
      className="block rounded-md border bg-card p-3"
    >
      <div className="flex items-center justify-between">
        <span className="font-medium">{order.order_number}</span>
        <OrderStatusBadge status={order.status} />
      </div>
      <div className="mt-1 flex items-center justify-between text-sm">
        <span className="min-w-0 truncate text-muted-foreground">
          {order.customer_email}
        </span>
        <span className="shrink-0 pl-2 font-medium">
          {formatPrice(order.total)}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {formatDate(order.created_at)}
      </p>
    </Link>
  );
}

function OrdersToolbar({
  table,
}: {
  table: TanStackTable<OrderWithEmail>;
}) {
  const customerFilter =
    (table.getColumn("customer_email")?.getFilterValue() as string) ?? "";
  const statusFilter =
    (table.getColumn("status")?.getFilterValue() as string) ?? "all";
  const dateFilter =
    (table.getColumn("created_at")?.getFilterValue() as string) ?? "all";

  const isFiltered =
    customerFilter || statusFilter !== "all" || dateFilter !== "all";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-full sm:flex-1 sm:min-w-50 sm:max-w-sm">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          placeholder="Search by customer..."
          value={customerFilter}
          onChange={(e) =>
            table.getColumn("customer_email")?.setFilterValue(e.target.value)
          }
          className="pl-9"
        />
      </div>

      <Select
        value={statusFilter}
        onValueChange={(value) =>
          table.getColumn("status")?.setFilterValue(value)
        }
      >
        <SelectTrigger className="w-45">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {ORDER_STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={dateFilter}
        onValueChange={(value) =>
          table.getColumn("created_at")?.setFilterValue(value)
        }
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="All Time" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Time</SelectItem>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="7days">Last 7 Days</SelectItem>
          <SelectItem value="30days">Last 30 Days</SelectItem>
          <SelectItem value="90days">Last 90 Days</SelectItem>
        </SelectContent>
      </Select>

      {isFiltered && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => table.resetColumnFilters()}
        >
          Reset
          <X className="ml-1 size-4" />
        </Button>
      )}
    </div>
  );
}

interface OrdersTableProps {
  orders: OrderWithEmail[];
}

export function OrdersTable({ orders }: OrdersTableProps) {
  return (
    <DataTable
      columns={columns}
      data={orders}
      toolbar={(table) => (
        <OrdersToolbar table={table as TanStackTable<OrderWithEmail>} />
      )}
      mobileCard={(order) => <OrderMobileCard order={order} />}
    />
  );
}
