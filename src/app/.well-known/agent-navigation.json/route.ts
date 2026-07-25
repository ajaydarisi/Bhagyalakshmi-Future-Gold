import { NextResponse } from "next/server";
import { buildAgentNavigationManifest } from "@/lib/agent-navigation-surface";

export const revalidate = 3_600;

export async function GET() {
  return NextResponse.json(buildAgentNavigationManifest(), {
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
