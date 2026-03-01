"use client";

import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  target_type: string;
  target_value: string | null;
  status: string;
  sent_count: number;
  failed_count: number;
  sent_at: string | null;
  created_at: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  sending: "bg-yellow-100 text-yellow-800",
  sent: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

const typeLabels: Record<string, string> = {
  custom: "Custom",
  promotion: "Promotion",
  order_update: "Order Update",
  price_drop: "Price Drop",
  back_in_stock: "Back in Stock",
};

const targetLabels: Record<string, string> = {
  all: "All Users",
  user: "Specific User",
  topic: "Topic",
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotificationsTable({
  notifications,
}: {
  notifications: Notification[];
}) {
  const [searchFilter, setSearchFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const isFiltered =
    searchFilter || typeFilter !== "all" || statusFilter !== "all";

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (
        searchFilter &&
        !n.title.toLowerCase().includes(searchFilter.toLowerCase()) &&
        !n.body.toLowerCase().includes(searchFilter.toLowerCase())
      ) {
        return false;
      }
      if (typeFilter !== "all" && n.type !== typeFilter) return false;
      if (statusFilter !== "all" && n.status !== statusFilter) return false;
      return true;
    });
  }, [notifications, searchFilter, typeFilter, statusFilter]);

  function resetFilters() {
    setSearchFilter("");
    setTypeFilter("all");
    setStatusFilter("all");
  }

  if (notifications.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notification History</CardTitle>
          <CardDescription>No notifications sent yet</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification History</CardTitle>
        <CardDescription>
          {notifications.length} notification{notifications.length !== 1 && "s"}{" "}
          sent
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:flex-1 sm:min-w-50 sm:max-w-sm">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search notifications..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(typeLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-35">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sending">Sending</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>

          {isFiltered && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Reset
              <X className="ml-1 size-4" />
            </Button>
          )}
        </div>

        {/* Mobile card view */}
        <div className="space-y-3 lg:hidden">
          {filtered.length > 0 ? (
            filtered.map((n) => (
              <div key={n.id} className="rounded-md border bg-card p-3 space-y-1">
                <p className="font-medium">{n.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {n.body}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline">
                    {typeLabels[n.type] || n.type}
                  </Badge>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 font-medium ${
                      statusColors[n.status] || ""
                    }`}
                  >
                    {n.status}
                  </span>
                  <span className="text-muted-foreground">
                    {targetLabels[n.target_type] || n.target_type}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>Sent: {n.sent_count}</span>
                  <span>Failed: {n.failed_count}</span>
                  <span>{formatDate(n.sent_at || n.created_at)}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="py-8 text-center text-muted-foreground">
              No notifications match the current filters.
            </p>
          )}
        </div>

        {/* Desktop table view */}
        <div className="hidden overflow-hidden lg:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length > 0 ? (
                filtered.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{n.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {n.body}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {typeLabels[n.type] || n.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {targetLabels[n.target_type] || n.target_type}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          statusColors[n.status] || ""
                        }`}
                      >
                        {n.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{n.sent_count}</TableCell>
                    <TableCell className="text-right">
                      {n.failed_count}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(n.sent_at || n.created_at)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    No notifications match the current filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
