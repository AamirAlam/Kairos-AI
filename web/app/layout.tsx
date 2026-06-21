import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Kairos — Autonomous AI Trading Agent",
    template: "%s · Kairos",
  },
  description:
    "Kairos is an autonomous AI trading agent on BNB Smart Chain. It reads markets via CoinMarketCap, reasons through a 3-agent pipeline, and signs its own trades self-custody via Trust Wallet Agent Kit.",
  applicationName: "Kairos",
  keywords: [
    "Kairos", "AI trading agent", "autonomous trading", "BNB Smart Chain",
    "BSC", "CoinMarketCap", "Trust Wallet Agent Kit", "DeFi", "self-custody",
  ],
  authors: [{ name: "Kairos" }],
  openGraph: {
    title: "Kairos — Autonomous AI Trading Agent",
    description:
      "Reads markets, decides, and signs its own trades self-custody on BNB Smart Chain. See the moment. Seize it.",
    siteName: "Kairos",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kairos — Autonomous AI Trading Agent",
    description:
      "Autonomous AI trading agent on BNB Smart Chain. See the moment. Seize it.",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
