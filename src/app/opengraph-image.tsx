import { ImageResponse } from "next/og";

export const alt = "HedgeNYC: independent NYC hedging research. Every business is exposed. Not every risk is hedgeable.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#091019", color: "#F7F6F0", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, fontFamily: "Georgia, serif" }}>
        <div style={{ display: "flex", color: "#84E5D0", fontSize: 24, letterSpacing: 8, fontFamily: "monospace" }}>HEDGE / NYC</div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 84, lineHeight: 1.02 }}>
          <span>Every business is exposed.</span>
          <span style={{ color: "#F2AD78", fontStyle: "italic" }}>Not every risk is hedgeable.</span>
        </div>
        <div style={{ display: "flex", fontSize: 22, color: "#8995A4", fontFamily: "monospace" }}>Independent research, not affiliated with Kalshi</div>
      </div>
    ),
    size,
  );
}
