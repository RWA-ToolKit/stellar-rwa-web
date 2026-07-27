/**
 * Startup validation for the env-driven config in `lib/stellar.ts` and
 * `lib/contracts.ts`. Those read `NEXT_PUBLIC_*` vars with `??` fallbacks
 * that are empty strings for mainnet, so a missing var otherwise only
 * surfaces later as an opaque RPC/contract error. This turns that into a
 * clear warning at boot instead.
 */

const REQUIRED_MAINNET_VARS = [
  "NEXT_PUBLIC_MAINNET_RPC_URL",
  "NEXT_PUBLIC_MAINNET_REGISTRY_ID",
  "NEXT_PUBLIC_MAINNET_COMPLIANCE_ID",
  "NEXT_PUBLIC_MAINNET_DIVIDEND_ID",
] as const;

export function validateEnv(): void {
  if (process.env.NEXT_PUBLIC_DEFAULT_NETWORK !== "mainnet") return;

  const missing = REQUIRED_MAINNET_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.warn(
      `[stellar-rwa-web] NEXT_PUBLIC_DEFAULT_NETWORK is "mainnet" but the ` +
        `following env vars are missing: ${missing.join(", ")}. ` +
        `Contract calls will fail at runtime until these are set — see .env.example.`,
    );
  }
}
