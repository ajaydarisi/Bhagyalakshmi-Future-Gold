import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { requireAdmin } from "@/lib/auth/require-admin";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// ~15 MB of base64 (roughly an 11 MB source image). Generous for product
// photos while preventing oversized payloads from burning the Gemini quota.
const MAX_IMAGE_BASE64_CHARS = 15 * 1024 * 1024;

export async function POST(request: Request) {
  // Admin-only: this endpoint calls a paid AI model, so it must not be
  // reachable by anonymous callers (cost abuse / quota exhaustion).
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  try {
    const { imageBase64, mimeType, prompt } = await request.json();

    if (!imageBase64 || !mimeType) {
      return NextResponse.json(
        { error: "Missing imageBase64 or mimeType" },
        { status: 400 }
      );
    }

    if (
      typeof imageBase64 !== "string" ||
      imageBase64.length > MAX_IMAGE_BASE64_CHARS
    ) {
      return NextResponse.json(
        { error: "Image is too large" },
        { status: 413 }
      );
    }

    if (typeof prompt !== "undefined" && typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Invalid prompt" },
        { status: 400 }
      );
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: imageBase64,
                mimeType,
              },
            },
            {
              text: prompt || "Give me in a website presentable photo wearing on a plastic set",
            },
          ],
        },
      ],
      config: {
        responseModalities: ["IMAGE", "TEXT"],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData);

    if (!imagePart?.inlineData?.data || !imagePart.inlineData.mimeType) {
      return NextResponse.json(
        { error: "Gemini did not return an image. Try a different photo." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      imageBase64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType,
    });
  } catch (error) {
    console.error("Gemini enhance error:", error);
    const message =
      error instanceof Error ? error.message : "AI image generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
