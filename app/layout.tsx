import type { Metadata, Viewport } from "next";
import "./globals.css";
import { WalletProvider, WalletErrorBoundary } from "@/hooks/useWallet";
import { ThemeProvider, ThemeScript } from "@/hooks/useTheme";
import { SkipLink } from "@/components/layout/SkipLink";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ToastProvider } from "@/components/ui/ToastProvider";

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
  appleWebApp: {
    title: "Stellar RWA",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  // theme-color follows the resolved theme; a meta[name=theme-color] media
  // query pair lets the browser pick the right value automatically.
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#08090c" },
    { media: "(prefers-color-scheme: light)", color: "#f6f8fb" },
  ],
  width: "device-width",
  initialScale: 1,
};

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <SkipLink />
      <SiteHeader />
      <main id="main-content" className="flex-1" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter />
    </ToastProvider>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // No `className="dark"` here — ThemeScript sets/clears it synchronously
    // before hydration so there's no flash of wrong theme. ThemeProvider then
    // keeps it in sync with user preference changes and OS-level switches.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
         * Runs synchronously before React hydration to apply the correct
         * theme class. suppressHydrationWarning on <html> prevents React
         * complaining about the class mismatch between SSR (no class) and
         * the client (class set by this script).
         */}
        <ThemeScript />
      </head>
      <body className="flex min-h-screen flex-col">
        <ThemeProvider>
          <WalletErrorBoundary fallback={<AppShell>{children}</AppShell>}>
            <WalletProvider>
              <AppShell>{children}</AppShell>
            </WalletProvider>
          </WalletErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  );
}
