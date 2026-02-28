import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Bhagyalakshmi Future Gold — Quality-Checked Fashion Jewellery";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1a1a1a",
          borderTop: "6px solid #7a462e",
          padding: "60px",
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: "#ffffff",
            marginBottom: 24,
          }}
        >
          Bhagyalakshmi Future Gold
        </div>
        <div
          style={{
            fontSize: 32,
            color: "#d99e84",
            marginBottom: 16,
          }}
        >
          Quality-Checked Fashion Jewellery
        </div>
        <div
          style={{
            fontSize: 24,
            color: "#9ca3af",
          }}
        >
          Chirala, Andhra Pradesh
        </div>
      </div>
    ),
    { ...size }
  );
}
