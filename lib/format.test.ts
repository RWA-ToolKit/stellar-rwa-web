import { describe, expect, it } from "vitest";
import { percent, truncateAddress } from "@/lib/format";

describe("percent", () => {
  it("returns 0 when whole is zero", () => {
    expect(percent(5n, 0n)).toBe(0);
  });

  it("returns 0 when whole is negative", () => {
    expect(percent(5n, -10n)).toBe(0);
  });

  it("computes a normal percentage to one decimal", () => {
    expect(percent(1n, 3n)).toBe(33.33);
  });

  it("clamps above 100 when part exceeds whole", () => {
    expect(percent(150n, 100n)).toBe(100);
  });

  it("clamps below 0 for a negative part", () => {
    expect(percent(-10n, 100n)).toBe(0);
  });
});

describe("truncateAddress", () => {
  it("returns the address unchanged when at the lead+tail+1 boundary", () => {
    // lead=4, tail=4 -> boundary length is 9; addresses at or below this
    // are shorter than "lead…tail" would save, so they pass through untouched.
    const addr = "123456789";
    expect(addr.length).toBe(9);
    expect(truncateAddress(addr)).toBe(addr);
  });

  it("returns the address unchanged when just below the boundary", () => {
    const addr = "12345678";
    expect(truncateAddress(addr)).toBe(addr);
  });

  it("truncates once the address exceeds the boundary by one char", () => {
    const addr = "1234567890";
    expect(truncateAddress(addr)).toBe("1234…7890");
  });

  it("truncates a realistic Stellar address", () => {
    const addr = "GAIQGTOBTTLLDJ4SWGGESM7UWJ2DI4K3ZNHUSHPDKJL2IE5FKY3BSRAA";
    expect(truncateAddress(addr)).toBe("GAIQ…SRAA");
  });

  it("returns empty/falsy input unchanged", () => {
    expect(truncateAddress("")).toBe("");
  });

  it("respects custom lead/tail lengths", () => {
    expect(truncateAddress("1234567890", 2, 2)).toBe("12…90");
  });
});
