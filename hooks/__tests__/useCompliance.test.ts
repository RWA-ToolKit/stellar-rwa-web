import { act, renderHook, waitFor } from "@testing-library/react";
import { useCompliance, useComplianceOverview, useAllowlist } from "../useCompliance";
import { compliance } from "@/lib/contracts";
import type { Network } from "@/types";

jest.mock("@/lib/contracts", () => ({
  compliance: {
    isAllowed: jest.fn(),
    getRecord: jest.fn(),
    getAllowlist: jest.fn(),
    isJurisdictionBlocked: jest.fn(),
  },
}));

let mockNetwork: Network = "testnet";

jest.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ network: mockNetwork }),
}));

describe("useCompliance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNetwork = "testnet";
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

  describe("network switch mid-session (#635)", () => {
    it("clears cached testnet compliance data immediately on switch to mainnet and loads mainnet data", async () => {
      const testnetRecord = {
        address: "GABC123",
        status: "Approved" as const,
        jurisdiction: "US",
        approvedAt: 1000,
      };
      const mainnetRecord = {
        address: "GABC123",
        status: "Suspended" as const,
        jurisdiction: "SG",
        approvedAt: 2000,
      };

      (compliance.isAllowed as jest.Mock).mockImplementation(async (net: Network) =>
        net === "testnet",
      );
      (compliance.getRecord as jest.Mock).mockImplementation(async (net: Network) =>
        net === "testnet" ? testnetRecord : mainnetRecord,
      );

      let mainnetResolveGate!: () => void;
      const mainnetGate = new Promise<void>((resolve) => {
        mainnetResolveGate = resolve;
      });
      (compliance.isAllowed as jest.Mock).mockImplementation(async (net: Network) => {
        if (net === "mainnet") {
          await mainnetGate;
          return false;
        }
        return true;
      });

      const { result, rerender } = renderHook(() => useCompliance("C123", "GABC123"));

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.data).toEqual({
        allowed: true,
        status: "Approved",
        record: testnetRecord,
      });

      // Switch network mid-session from testnet to mainnet
      mockNetwork = "mainnet";
      rerender();

      // Stale testnet data must be dropped immediately while mainnet is loading
      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(true);

      await act(async () => {
        mainnetResolveGate();
      });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(compliance.isAllowed).toHaveBeenCalledWith("mainnet", "C123", "GABC123");
      expect(compliance.getRecord).toHaveBeenCalledWith("mainnet", "C123", "GABC123");
      expect(result.current.data).toEqual({
        allowed: false,
        status: "Suspended",
        record: mainnetRecord,
      });
    });

    it("ignores late in-flight responses and rejections from the previous network after switching", async () => {
      const testnetRecord = {
        address: "GABC123",
        status: "Approved" as const,
        jurisdiction: "US",
        approvedAt: 1000,
      };
      const mainnetRecord = {
        address: "GABC123",
        status: "Pending" as const,
        jurisdiction: "DE",
        approvedAt: 3000,
      };

      let resolveTestnetAllowed!: (val: boolean) => void;
      const testnetAllowedPromise = new Promise<boolean>((resolve) => {
        resolveTestnetAllowed = resolve;
      });

      (compliance.isAllowed as jest.Mock).mockImplementation((net: Network) => {
        if (net === "testnet") return testnetAllowedPromise;
        return Promise.resolve(false);
      });
      (compliance.getRecord as jest.Mock).mockImplementation((net: Network) => {
        if (net === "testnet") return Promise.resolve(testnetRecord);
        return Promise.resolve(mainnetRecord);
      });

      const { result, rerender } = renderHook(() => useCompliance("C123", "GABC123"));
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBeNull();

      // Switch network while the testnet request is still in flight
      mockNetwork = "mainnet";
      rerender();

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.data).toEqual({
        allowed: false,
        status: "Pending",
        record: mainnetRecord,
      });

      // Resolve the stale testnet request after mainnet has already settled
      await act(async () => {
        resolveTestnetAllowed(true);
      });

      // Mainnet state must remain intact without any testnet leakage
      expect(result.current.data).toEqual({
        allowed: false,
        status: "Pending",
        record: mainnetRecord,
      });
      expect(result.current.error).toBeNull();
    });

    it("prevents cross-network leakage in useComplianceOverview and useAllowlist across network switches", async () => {
      const testnetRec = {
        address: "GTEST",
        status: "Approved" as const,
        jurisdiction: "US",
        approvedAt: 100,
      };
      const mainnetRec = {
        address: "GMAIN",
        status: "Approved" as const,
        jurisdiction: "CH",
        approvedAt: 200,
      };

      let resolveTestnetAllowlist!: (addrs: string[]) => void;
      const slowTestnetAllowlist = new Promise<string[]>((resolve) => {
        resolveTestnetAllowlist = resolve;
      });

      (compliance.getAllowlist as jest.Mock).mockImplementation((net: Network) => {
        if (net === "testnet") return slowTestnetAllowlist;
        return Promise.resolve(["GMAIN"]);
      });
      (compliance.getRecord as jest.Mock).mockImplementation((net: Network) =>
        Promise.resolve(net === "testnet" ? testnetRec : mainnetRec),
      );
      (compliance.isJurisdictionBlocked as jest.Mock).mockImplementation(
        async (net: Network, _id: string, code: string) =>
          net === "mainnet" && code === "CH",
      );

      const { result: overviewRes, rerender: rerenderOverview } = renderHook(() =>
        useComplianceOverview("C123"),
      );
      const { result: allowlistRes, rerender: rerenderAllowlist } = renderHook(() =>
        useAllowlist("C123"),
      );

      // Switch to mainnet while testnet requests are still in flight
      mockNetwork = "mainnet";
      rerenderOverview();
      rerenderAllowlist();

      await waitFor(() => expect(overviewRes.current.loading).toBe(false));
      await waitFor(() => expect(allowlistRes.current.loading).toBe(false));

      expect(overviewRes.current.data).toEqual({
        allowlistSize: 1,
        jurisdictions: [{ code: "CH", blocked: true }],
      });
      expect(allowlistRes.current.data).toEqual([mainnetRec]);

      // Resolve the stale testnet allowlist call late
      await act(async () => {
        resolveTestnetAllowlist(["GTEST"]);
      });

      expect(overviewRes.current.data).toEqual({
        allowlistSize: 1,
        jurisdictions: [{ code: "CH", blocked: true }],
      });
      expect(allowlistRes.current.data).toEqual([mainnetRec]);
    });
  });
});
