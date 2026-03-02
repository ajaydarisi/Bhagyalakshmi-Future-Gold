export interface EnhanceImageResult {
  imageBase64: string;
  mimeType: string;
}

export async function enhanceImageWithAI(
  file: File,
  prompt?: string
): Promise<EnhanceImageResult> {
  const buffer = await file.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(buffer).reduce(
      (data, byte) => data + String.fromCharCode(byte),
      ""
    )
  );

  const response = await fetch("/api/ai/enhance-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageBase64: base64,
      mimeType: file.type,
      prompt,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "AI enhancement failed");
  }

  return response.json();
}

export function base64ToFile(
  base64: string,
  mimeType: string,
  filename: string
): File {
  const byteString = atob(base64);
  const bytes = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    bytes[i] = byteString.charCodeAt(i);
  }
  const ext = mimeType.split("/")[1] || "png";
  return new File([bytes], `${filename}.${ext}`, { type: mimeType });
}
