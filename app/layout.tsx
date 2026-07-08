import type { Metadata, Viewport } from "next";
import "./globals.css";
import { WalletProvider } from "@/hooks/useWallet";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

export const metadata: Metadata = {
  title: {
    default: "Stellar RWA — Tokenize real-world assets on Stellar",
    template: "%s · Stellar RWA",
  },
  description:
    "Tokenize real-world assets on Stellar. Issue compliant asset tokens, manage KYC allowlists, and distribute dividends — all on-chain via Soroban.",
  keywords: ["Stellar", "Soroban", "RWA", "tokenization", "real-world assets", "compliance", "DeFi"],
  openGraph: {
    title: "Stellar RWA",
    description: "Tokenize real-world assets on Stellar with on-chain compliance.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#08090c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="flex min-h-screen flex-col">
        <WalletProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </WalletProvider>
      </body>
    </html>
  );
}
