import { NextResponse } from "next/server";
import { generateGroundedReply } from "@/lib/retrieval/answer";
import { retrieveCatalogContext } from "@/lib/retrieval/catalog";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const query = typeof body.query === "string" ? body.query.trim() : "";
    const locale = typeof body.locale === "string" ? body.locale : "en";

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const context = await retrieveCatalogContext({
      query,
      locale,
      limit: 6,
      offset: 0,
      sourceTypes: ["product"],
      mode: "assistant",
    });

    const reply = await generateGroundedReply({
      messages: [{ role: "user", content: query }],
      locale,
      retrievedContext: context.items,
      responseMode: "search_answer",
    });

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Search answer API error:", error);
    return NextResponse.json(
      { error: "Could not generate a grounded answer" },
      { status: 500 }
    );
  }
}
