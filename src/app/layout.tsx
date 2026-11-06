import type { Metadata, Viewport } from "next";
import { Fraunces, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SmoothScroll } from "@/components/SmoothScroll";
import { RevealObserver } from "@/components/RevealObserver";

const display = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", style: ["normal", "italic"], axes: ["opsz"] });
const sans = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-plex-mono", display: "swap", weight: ["400", "500"] });

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hedgenyc.vercel.app";
const DESC = "An evidence-led map of New York businesses, the events that move their margins, and the hard questions between a market price and a useful hedge. Independent research, not affiliated with Kalshi.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "HedgeNYC | Independent NYC hedging research", template: "%s | HedgeNYC" },
  description: DESC,
  openGraph: { title: "HedgeNYC: Every business is exposed. Not every risk is hedgeable.", description: DESC, type: "website", siteName: "HedgeNYC" },
  twitter: { card: "summary_large_image", title: "HedgeNYC", description: DESC },
  robots: { index: true, follow: true },
};
export const viewport: Viewport = { themeColor: "#091019", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body className="min-h-screen font-sans">
        <Header />
        <main id="main" tabIndex={-1} className="outline-none">{children}</main>
        <Footer />
        <SmoothScroll />
        <RevealObserver />
      </body>
    </html>
  );
}
