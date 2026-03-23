import { NextResponse } from "next/server";
import { searchProducts } from "@/lib/retrieval/catalog";

export const runtime = "nodejs";

function parseList(value: string | null) {
  return value ? value.split(",").filter(Boolean) : [];
}

function parseNumber(value: string | null, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim() ?? "";
    const locale = searchParams.get("locale") || "en";
    const limit = clamp(parseNumber(searchParams.get("limit"), 12), 1, 24);
    const offset = Math.max(parseNumber(searchParams.get("offset"), 0), 0);

    const response = await searchProducts({
      query,
      locale,
      limit,
      offset,
      filters: {
        categoryIds: parseList(searchParams.get("categoryIds")),
        materials: parseList(searchParams.get("materials")),
        tags: parseList(searchParams.get("tags")),
        type: (searchParams.get("type") as "sale" | "rental" | "all" | "") || "all",
        minPrice: parseNumber(searchParams.get("minPrice"), 0),
        maxPrice: parseNumber(searchParams.get("maxPrice"), 0),
      },
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Search products API error:", error);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
