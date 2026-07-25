import { buildLlmsText } from "@/lib/agent-navigation-surface";

export const revalidate = 3_600;

export async function GET() {
  return new Response(buildLlmsText(), {
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
