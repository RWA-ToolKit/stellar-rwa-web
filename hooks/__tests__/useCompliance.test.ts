import { renderHook, waitFor } from "@testing-library/react";
import { useCompliance, useComplianceOverview, useAllowlist } from "../useCompliance";
import { compliance } from "@/lib/contracts";

jest.mock("@/lib/contracts", () => ({
  compliance: {
    isAllowed: jest.fn(),
    getRecord: jest.fn(),
    getAllowlist: jest.fn(),
    isJurisdictionBlocked: jest.fn(),
  },
}));

jest.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ network: "testnet" }),
}));

describe("useCompliance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("useCompliance", () => {
    it("returns default inactive state when complianceId or address is null", async () => {
      const { result: res1 } = renderHook(() => useCompliance(null, "GABC123"));
      expect(res1.current.data).toBeNull();
      expect(res1.current.loading).toBe(false);

      const { result: res2 } = renderHook(() => useCompliance("C123", null));
      expect(res2.current.data).toBeNull();
      expect(res2.current.loading).toBe(false);
    });

    it("does not invoke contract reads when given empty or whitespace-only inputs (#632)", () => {
      const cases: Array<[string | null, string | null]> = [
        ["", "GABC123"],
        ["C123", ""],
        ["", ""],
        ["   ", "GABC123"],
        ["C123", "   "],
        [null, null],
      ];

      for (const [cid, addr] of cases) {
        const { result } = renderHook(() => useCompliance(cid, addr));
        expect(result.current.data).toBeNull();
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
      }

      expect(compliance.isAllowed).not.toHaveBeenCalled();
      expect(compliance.getRecord).not.toHaveBeenCalled();
    });

    it("clears previously loaded data when complianceId or address becomes empty (#632)", async () => {
      (compliance.isAllowed as jest.Mock).mockResolvedValue(true);
      (compliance.getRecord as jest.Mock).mockResolvedValue({
        address: "GABC123",
        status: "Approved" as const,
        jurisdiction: "US",
        verifiedAt: 1000,
        expiresAt: 0,
      });

      const { result, rerender } = renderHook(
        ({ cid, addr }: { cid: string | null; addr: string | null }) =>
          useCompliance(cid, addr),
        { initialProps: { cid: "C123", addr: "GABC123" } },
      );

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.data?.allowed).toBe(true);

      rerender({ cid: "C123", addr: "" });
      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(compliance.isAllowed).toHaveBeenCalledTimes(1);
    });

    it("returns compliance summary when contract calls succeed", async () => {
      const mockRecord = {
        address: "GABC123",
        status: "Approved" as const,
        jurisdiction: "US",
        approvedAt: 1000,
      };
      (compliance.isAllowed as jest.Mock).mockResolvedValue(true);
      (compliance.getRecord as jest.Mock).mockResolvedValue(mockRecord);

      const { result } = renderHook(() => useCompliance("C123", "GABC123"));

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(compliance.isAllowed).toHaveBeenCalledWith("testnet", "C123", "GABC123");
      expect(compliance.getRecord).toHaveBeenCalledWith("testnet", "C123", "GABC123");
      expect(result.current.data).toEqual({
        allowed: true,
        status: "Approved",
        record: mockRecord,
      });
      expect(result.current.error).toBeNull();
    });

    it("degrades gracefully when contract read fails", async () => {
      (compliance.isAllowed as jest.Mock).mockRejectedValue(
        new Error("Contract read error"),
      );
      (compliance.getRecord as jest.Mock).mockResolvedValue(null);

      const { result } = renderHook(() => useCompliance("C123", "GABC123"));

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toBe("Contract read error");
      expect(result.current.data).toBeNull();
    });
  });

  describe("useComplianceOverview", () => {
    it("returns null overview when complianceId is null or empty (#632)", async () => {
      const { result } = renderHook(() => useComplianceOverview(null));
      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);

      const { result: emptyRes } = renderHook(() => useComplianceOverview(""));
      expect(emptyRes.current.data).toBeNull();
      expect(emptyRes.current.loading).toBe(false);

      const { result: blankRes } = renderHook(() => useComplianceOverview("   "));
      expect(blankRes.current.data).toBeNull();
      expect(blankRes.current.loading).toBe(false);
      expect(compliance.getAllowlist).not.toHaveBeenCalled();
    });

    it("returns compliance overview summary when contract calls succeed", async () => {
      (compliance.getAllowlist as jest.Mock).mockResolvedValue(["G1", "G2"]);
      (compliance.getRecord as jest.Mock)
        .mockResolvedValueOnce({ jurisdiction: "US" })
        .mockResolvedValueOnce({ jurisdiction: "GB" });
      (compliance.isJurisdictionBlocked as jest.Mock)
        .mockImplementation(async (_net, _id, code) => code === "GB");

      const { result } = renderHook(() => useComplianceOverview("C123"));

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.data).toEqual({
        allowlistSize: 2,
        jurisdictions: [
          { code: "GB", blocked: true },
          { code: "US", blocked: false },
        ],
      });
    });

    it("degrades gracefully when contract read fails", async () => {
      (compliance.getAllowlist as jest.Mock).mockRejectedValue(
        new Error("Allowlist fetch error"),
      );

      const { result } = renderHook(() => useComplianceOverview("C123"));

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toBe("Allowlist fetch error");
      expect(result.current.data).toBeNull();
    });
  });

  describe("useAllowlist", () => {
    it("returns null allowlist when complianceId is null or empty (#632)", async () => {
      const { result } = renderHook(() => useAllowlist(null));
      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);

      const { result: emptyRes } = renderHook(() => useAllowlist(""));
      expect(emptyRes.current.data).toBeNull();
      expect(emptyRes.current.loading).toBe(false);

      const { result: blankRes } = renderHook(() => useAllowlist("   "));
      expect(blankRes.current.data).toBeNull();
      expect(blankRes.current.loading).toBe(false);
      expect(compliance.getAllowlist).not.toHaveBeenCalled();
    });

    it("returns full allowlist records when contract calls succeed", async () => {
      const rec1 = { address: "G1", status: "Approved", jurisdiction: "US", approvedAt: 100 };
      const rec2 = { address: "G2", status: "Approved", jurisdiction: "CA", approvedAt: 200 };
      (compliance.getAllowlist as jest.Mock).mockResolvedValue(["G1", "G2"]);
      (compliance.getRecord as jest.Mock)
        .mockResolvedValueOnce(rec1)
        .mockResolvedValueOnce(rec2);

      const { result } = renderHook(() => useAllowlist("C123"));

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.data).toEqual([rec1, rec2]);
    });
  });
});
