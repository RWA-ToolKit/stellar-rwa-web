/**
 * Integration check for the security headers configured in next.config.mjs.
 * The config is ESM (and uses import.meta), so it is loaded in a real Node
 * process rather than through Jest's CJS transform.
 */

import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = path.resolve(__dirname, "../..");
const configUrl = pathToFileURL(path.join(projectRoot, "next.config.mjs")).href;

function loadHeaders(): Array<{ source: string; headers: Array<{ key: string; value: string }> }> {
  const script = `
    const mod = await import(${JSON.stringify(configUrl)});
    const result = typeof mod.default.headers === "function"
      ? await mod.default.headers()
      : [];
    process.stdout.write(JSON.stringify(result));
  `;
  const output = execFileSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: projectRoot,
    encoding: "utf8",
  });
  return JSON.parse(output);
}

describe("next.config.mjs security headers", () => {
  const rules = loadHeaders();
  const rule = rules[0];
  const byKey = new Map(rule.headers.map((header) => [header.key, header.value]));
  const csp = byKey.get("Content-Security-Policy") ?? "";

  it("applies the headers to every route", () => {
    expect(rules).toHaveLength(1);
    expect(rule.source).toBe("/:path*");
  });

  it("sets a restrictive Content-Security-Policy", () => {
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
  });

  it("allows only configured Soroban RPC origins for network calls", () => {
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("https://soroban-testnet.stellar.org");
    expect(csp).toContain("https://mainnet.sorobanrpc.com");
    expect(csp).not.toContain("connect-src 'self' https:");
  });

  it("sets clickjacking and referrer protections", () => {
    expect(byKey.get("X-Frame-Options")).toBe("DENY");
    expect(byKey.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });
});
