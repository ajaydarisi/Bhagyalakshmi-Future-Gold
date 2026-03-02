"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
}

export function Pagination({ currentPage, totalPages }: PaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  function navigateToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", page.toString());
    router.push(`?${params.toString()}`);
  }

  const pages: number[] = [];
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-center gap-1">
      <Button
        variant="outline"
        size="icon"
        disabled={currentPage <= 1}
        onClick={() => navigateToPage(currentPage - 1)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {start > 1 && (
        <>
          <Button variant="outline" size="sm" onClick={() => navigateToPage(1)}>
            1
          </Button>
          {start > 2 && (
            <span className="px-2 text-sm text-muted-foreground">...</span>
          )}
        </>
      )}

      {pages.map((page) => (
        <Button
          key={page}
          variant={page === currentPage ? "default" : "outline"}
          size="sm"
          onClick={() => navigateToPage(page)}
        >
          {page}
        </Button>
      ))}

      {end < totalPages && (
        <>
          {end < totalPages - 1 && (
            <span className="px-2 text-sm text-muted-foreground">...</span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateToPage(totalPages)}
          >
            {totalPages}
          </Button>
        </>
      )}

      <Button
        variant="outline"
        size="icon"
        disabled={currentPage >= totalPages}
        onClick={() => navigateToPage(currentPage + 1)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
