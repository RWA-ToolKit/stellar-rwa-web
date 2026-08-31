import { vi, describe, it, expect } from "vitest";
import {
  readContract,
  ContractError,
} from "@/lib/stellar";
import { rpc } from "@stellar/stellar-sdk";

// ---------------------------------------------------------------------------
// Issue #254 — readContract error handling
// ---------------------------------------------------------------------------
describe("readContract", () => {
  describe("simulation failure error handling", () => {
    it("throws a typed ContractError when simulation returns an error", async () => {
      const mockServer = {
        simulateTransaction: vi.fn().mockResolvedValue({
          error: "Error(Contract, #3)",
        }),
      };

      vi.stubGlobal("getServer", () => mockServer);

      // Mock the rpc.Api.isSimulationError to return true
      const isSimulationErrorSpy = vi.spyOn(rpc.Api, "isSimulationError");
      isSimulationErrorSpy.mockReturnValue(true);

      try {
        await readContract("testnet", "CXXXXX", "test_method");
        expect.fail("Expected ContractError to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(ContractError);
        expect((e as ContractError).message).toBe(
          "You are not authorized to perform this action."
        );
        expect((e as ContractError).detail).toBe("Error(Contract, #3)");
      }

      isSimulationErrorSpy.mockRestore();
    });

    it("throws ContractError with parsed message for known contract error codes", async () => {
      const mockServer = {
        simulateTransaction: vi.fn().mockResolvedValue({
          error: "Error(Contract, #2)",
        }),
      };

      vi.stubGlobal("getServer", () => mockServer);
      const isSimulationErrorSpy = vi.spyOn(rpc.Api, "isSimulationError");
      isSimulationErrorSpy.mockReturnValue(true);

      try {
        await readContract("testnet", "CXXXXX", "test_method");
        expect.fail("Expected ContractError to be thrown");
      } catch (e) {
        expect((e as ContractError).message).toBe(
          "Contract is not initialized."
        );
      }

      isSimulationErrorSpy.mockRestore();
    });

    it("throws ContractError with generic message for unknown error codes", async () => {
      const mockServer = {
        simulateTransaction: vi.fn().mockResolvedValue({
          error: "Error(Contract, #999)",
        }),
      };

      vi.stubGlobal("getServer", () => mockServer);
      const isSimulationErrorSpy = vi.spyOn(rpc.Api, "isSimulationError");
      isSimulationErrorSpy.mockReturnValue(true);

      try {
        await readContract("testnet", "CXXXXX", "test_method");
        expect.fail("Expected ContractError to be thrown");
      } catch (e) {
        expect((e as ContractError).message).toContain("code 999");
      }

      isSimulationErrorSpy.mockRestore();
    });

    it("throws ContractError for trustline/insufficient balance errors", async () => {
      const mockServer = {
        simulateTransaction: vi.fn().mockResolvedValue({
          error: "insufficient balance for trustline",
        }),
      };

      vi.stubGlobal("getServer", () => mockServer);
      const isSimulationErrorSpy = vi.spyOn(rpc.Api, "isSimulationError");
      isSimulationErrorSpy.mockReturnValue(true);

      try {
        await readContract("testnet", "CXXXXX", "test_method");
        expect.fail("Expected ContractError to be thrown");
      } catch (e) {
        expect((e as ContractError).message).toContain(
          "Insufficient balance or a missing trustline"
        );
      }

      isSimulationErrorSpy.mockRestore();
    });

    it("returns undefined when simulation succeeds but has no return value", async () => {
      const mockServer = {
        simulateTransaction: vi.fn().mockResolvedValue({
          result: { retval: null },
        }),
      };

      vi.stubGlobal("getServer", () => mockServer);
      const isSimulationErrorSpy = vi.spyOn(rpc.Api, "isSimulationError");
      isSimulationErrorSpy.mockReturnValue(false);

      const result = await readContract("testnet", "CXXXXX", "test_method");
      expect(result).toBeUndefined();

      isSimulationErrorSpy.mockRestore();
    });

    it("distinguishes simulation failure (throws) from successful call with no data (returns undefined)", async () => {
      const mockServer = {
        simulateTransaction: vi.fn(),
      };

      vi.stubGlobal("getServer", () => mockServer);
      const isSimulationErrorSpy = vi.spyOn(rpc.Api, "isSimulationError");

      // Case 1: Simulation fails → throws
      mockServer.simulateTransaction.mockResolvedValueOnce({
        error: "Error(Contract, #4)",
      });
      isSimulationErrorSpy.mockReturnValueOnce(true);

      try {
        await readContract("testnet", "CXXXXX", "test_method");
        expect.fail("Expected throw on simulation failure");
      } catch (e) {
        expect(e).toBeInstanceOf(ContractError);
      }

      // Case 2: Simulation succeeds, no data → returns undefined
      mockServer.simulateTransaction.mockResolvedValueOnce({
        result: { retval: null },
      });
      isSimulationErrorSpy.mockReturnValueOnce(false);

      const result = await readContract("testnet", "CXXXXX", "test_method");
      expect(result).toBeUndefined();

      isSimulationErrorSpy.mockRestore();
    });
  });
});
