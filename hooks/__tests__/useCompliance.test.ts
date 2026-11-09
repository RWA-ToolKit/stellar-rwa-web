import { act, renderHook, waitFor } from "@testing-library/react";
import { useCompliance, useComplianceOverview, useAllowlist } from "../useCompliance";
import { compliance } from "@/lib/contracts";
import type { Network } from "@/types";

let mockNetwork: Network = "testnet";

jest.mock("@/lib/contracts", () => ({
  compliance: {
    isAllowed: jest.fn(),
    getRecord: jest.fn(),
    getAllowlist: jest.fn(),
    isJurisdictionBlocked: jest.fn(),
  },
}));

jest.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ network: mockNetwork }),
}));

describe("useCompliance", () => {
  beforeEach(() => {
    mockNetwork = "testnet";
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
    it("returns null overview when complianceId is null", async () => {
      const { result } = renderHook(() => useComplianceOverview(null));
      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);
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
    it("returns null allowlist when complianceId is null", async () => {
      const { result } = renderHook(() => useAllowlist(null));
      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);
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

  describe("stale closure and dependency array audit (#633)", () => {
    it("re-runs useCompliance with updated complianceId, address, and network without stale closures", async () => {
      (compliance.isAllowed as jest.Mock).mockImplementation(
        async (net: string, cid: string, addr: string) =>
          net === "mainnet" && cid === "C_NEW" && addr === "G_NEW",
      );
      (compliance.getRecord as jest.Mock).mockImplementation(
        async (_net: string, cid: string, addr: string) => ({
          address: addr,
          status: cid === "C_NEW" ? ("Approved" as const) : ("Pending" as const),
          jurisdiction: "US",
          verifiedAt: 1000,
          expiresAt: 0,
        }),
      );

      const { result, rerender } = renderHook(
        ({ cid, addr }: { cid: string | null; addr: string | null }) =>
          useCompliance(cid, addr),
        { initialProps: { cid: "C_OLD", addr: "G_OLD" } },
      );

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(compliance.isAllowed).toHaveBeenLastCalledWith("testnet", "C_OLD", "G_OLD");
      expect(result.current.data?.allowed).toBe(false);
      expect(result.current.data?.status).toBe("Pending");

      // Update complianceId and address
      rerender({ cid: "C_NEW", addr: "G_NEW" });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(compliance.isAllowed).toHaveBeenLastCalledWith("testnet", "C_NEW", "G_NEW");
      expect(result.current.data?.record?.address).toBe("G_NEW");
      expect(result.current.data?.status).toBe("Approved");

      // Switch wallet network to mainnet
      mockNetwork = "mainnet";
      rerender({ cid: "C_NEW", addr: "G_NEW" });
      await waitFor(() => expect(result.current.data?.allowed).toBe(true));
      expect(compliance.isAllowed).toHaveBeenLastCalledWith("mainnet", "C_NEW", "G_NEW");

      // Manual refetch must also use the latest closure values
      act(() => {
        result.current.refetch();
      });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(compliance.isAllowed).toHaveBeenLastCalledWith("mainnet", "C_NEW", "G_NEW");
    });

    it("re-runs useComplianceOverview and useAllowlist when complianceId or network changes", async () => {
      (compliance.getAllowlist as jest.Mock).mockImplementation(
        async (net: string, cid: string) => [`${net}:${cid}`],
      );
      (compliance.getRecord as jest.Mock).mockImplementation(
        async (_net: string, _cid: string, addr: string) => ({
          address: addr,
          status: "Approved" as const,
          jurisdiction: addr.startsWith("mainnet") ? "CH" : "US",
          verifiedAt: 100,
          expiresAt: 0,
        }),
      );
      (compliance.isJurisdictionBlocked as jest.Mock).mockResolvedValue(false);

      const { result: overviewRes, rerender: rerenderOverview } = renderHook(
        ({ cid }: { cid: string | null }) => useComplianceOverview(cid),
        { initialProps: { cid: "C_1" } },
      );
      const { result: allowlistRes, rerender: rerenderAllowlist } = renderHook(
        ({ cid }: { cid: string | null }) => useAllowlist(cid),
        { initialProps: { cid: "C_1" } },
      );

      await waitFor(() => expect(overviewRes.current.loading).toBe(false));
      await waitFor(() => expect(allowlistRes.current.loading).toBe(false));
      expect(overviewRes.current.data?.jurisdictions).toEqual([
        { code: "US", blocked: false },
      ]);
      expect(allowlistRes.current.data?.[0]?.address).toBe("testnet:C_1");

      // Update complianceId and network
      mockNetwork = "mainnet";
      rerenderOverview({ cid: "C_2" });
      rerenderAllowlist({ cid: "C_2" });

      await waitFor(() =>
        expect(overviewRes.current.data?.jurisdictions).toEqual([
          { code: "CH", blocked: false },
        ]),
      );
      await waitFor(() =>
        expect(allowlistRes.current.data?.[0]?.address).toBe("mainnet:C_2"),
      );
    });
  });
});
