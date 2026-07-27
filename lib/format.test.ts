import { describe, it, expect, vi, afterEach } from "vitest";
import { ASSET_TYPES, ASSET_TYPE_LABELS } from "@/types";
import { assetTypeLabel, ledgerToApproxDate } from "./format";

describe("assetTypeLabel", () => {
  it.each(ASSET_TYPES)("returns the known label for %s", (type) => {
    expect(assetTypeLabel(type)).toBe(ASSET_TYPE_LABELS[type]);
  });

  it("title-cases arbitrary/unknown type strings", () => {
    expect(assetTypeLabel("mystery_box")).toBe("Mystery Box");
    expect(assetTypeLabel("gold-bar")).toBe("Gold Bar");
    expect(assetTypeLabel("single")).toBe("Single");
  });
});

describe("ledgerToApproxDate", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null when targetLedger is 0 (never expires)", () => {
    expect(ledgerToApproxDate(0, 12345)).toBeNull();
  });

  it("returns a future date when targetLedger is ahead of currentLedger", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const result = ledgerToApproxDate(1100, 1000);

    expect(result).not.toBeNull();
    expect(result!.getTime()).toBe(Date.now() + 100 * 5 * 1000);
    expect(result!.getTime()).toBeGreaterThan(Date.now());
  });

  it("returns a past date when targetLedger is behind currentLedger", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const result = ledgerToApproxDate(900, 1000);

    expect(result).not.toBeNull();
    expect(result!.getTime()).toBe(Date.now() - 100 * 5 * 1000);
    expect(result!.getTime()).toBeLessThan(Date.now());
  });
});
