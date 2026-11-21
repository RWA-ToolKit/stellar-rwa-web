import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import bundleAnalyzer from "@next/bundle-analyzer";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false,
});

/**
 * Best-effort short commit hash so a deploy can be correlated with a
 * user-reported issue from the footer. Falls back gracefully in
 * environments without git history (e.g. some CI checkouts).
 */
function resolveCommitSha() {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_COMMIT ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GIT_COMMIT_SHA ||
    process.env.COMMIT_REF;
  if (fromEnv) return fromEnv.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return undefined;
  }
}

/**
 * Allowed `connect-src` origins. NEXT_PUBLIC_* values are inlined at build
 * time, so this allowlist reflects the same endpoints the browser can reach:
 * public Soroban RPC, configured overrides/failovers, and the optional indexer
 * API. Everything else (including arbitrary exfiltration targets) is blocked.
 */
function connectSources() {
  const origins = new Set(["'self'"]);
  const candidates = [
    "https://soroban-testnet.stellar.org",
    "https://mainnet.sorobanrpc.com",
    process.env.NEXT_PUBLIC_TESTNET_RPC_URL,
    process.env.NEXT_PUBLIC_MAINNET_RPC_URL,
    process.env.NEXT_PUBLIC_TESTNET_RPC_URLS_FALLBACK,
    process.env.NEXT_PUBLIC_MAINNET_RPC_URLS_FALLBACK,
    process.env.NEXT_PUBLIC_API_URL,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    for (const value of candidate.split(",")) {
      try {
        origins.add(new URL(value.trim()).origin);
      } catch {
        // Ignore malformed overrides; the public RPC defaults remain allowed.
      }
    }
  }
  return [...origins].join(" ");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_APP_COMMIT: resolveCommitSha(),
  },
  async headers() {
    const isDev = process.env.NODE_ENV !== "production";
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      // Next.js App Router emits inline bootstrap scripts and styles.
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      // Freighter talks to the page over window.postMessage, which CSP does
      // not restrict; only network calls need an explicit origin allowlist.
      `connect-src ${connectSources()}${isDev ? " ws: wss:" : ""}`,
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  webpack: (config) => {
    // stellar-sdk pulls in optional node deps that are irrelevant in the browser.
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, net: false, tls: false };
    return config;
  },
};

export default withBundleAnalyzer(nextConfig);
