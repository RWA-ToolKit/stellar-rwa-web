import { describe, it, expect } from "vitest";
import { scValToNative } from "@stellar/stellar-sdk";
import { arg } from "./stellar";

const VALID_ADDRESS = "GAIQGTOBTTLLDJ4SWGGESM7UWJ2DI4K3ZNHUSHPDKJL2IE5FKY3BSRAA";

describe("arg", () => {
  it("encodes address", () => {
    const scval = arg.address(VALID_ADDRESS);
    expect(scval.switch().name).toBe("scvAddress");
    expect(scValToNative(scval)).toBe(VALID_ADDRESS);
  });

  it("encodes string", () => {
    const scval = arg.string("Sunset Villas");
    expect(scval.switch().name).toBe("scvString");
    expect(scValToNative(scval)).toBe("Sunset Villas");
  });

  it("encodes symbol", () => {
    const scval = arg.symbol("Approved");
    expect(scval.switch().name).toBe("scvSymbol");
    expect(scValToNative(scval)).toBe("Approved");
  });

  it("encodes bool", () => {
    expect(arg.bool(true).switch().name).toBe("scvBool");
    expect(scValToNative(arg.bool(true))).toBe(true);
    expect(scValToNative(arg.bool(false))).toBe(false);
  });

  it("encodes u32", () => {
    const scval = arg.u32(42);
    expect(scval.switch().name).toBe("scvU32");
    expect(scValToNative(scval)).toBe(42);
  });

  it("encodes u64 from number and bigint", () => {
    const fromNumber = arg.u64(42);
    const fromBigint = arg.u64(42n);
    expect(fromNumber.switch().name).toBe("scvU64");
    expect(scValToNative(fromNumber)).toBe(42n);
    expect(scValToNative(fromBigint)).toBe(42n);
  });

  it("encodes i128, including negative values", () => {
    const positive = arg.i128(500000000n);
    const negative = arg.i128(-500000000n);
    expect(positive.switch().name).toBe("scvI128");
    expect(scValToNative(positive)).toBe(500000000n);
    expect(scValToNative(negative)).toBe(-500000000n);
  });
});
