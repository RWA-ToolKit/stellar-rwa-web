/**
 * Tests for useCompliance and useAllowlist hooks.
 *
 * Strategy:
 *   - Mock @/lib/contracts so no Soroban RPC calls are made.
 *   - Mock @/hooks/useWallet to provide a fixed `network` value.
 *   - Use renderHook + waitFor from @testing-library/react (React 18 compatible).
 *   - A minimal WalletProvider substitute is injected via renderHook's `wrapper`
 *     option so the hooks' useWallet() call resolves correctly.
 */

import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";

// ---- mock contract bindings ------------------------------------------------
// Jest hoists jest.mock() calls, so the mock factory has access to jest.fn()
// before the module is imported in the hook.

jest.mock("@/lib/contracts", () => ({
  compliance: {
    isAllowed: jest.fn(),
    getRecord: jest.fn(),
    getAllowlist: jest.fn(),
  },
}));

// ---- mock wallet context ---------------------------------------------------
// useCompliance/useAllowlist only need `network` from the wallet context.
jest.mock("@/hooks/useWallet", () => ({
  useWallet: jest.fn(() => ({ network: "testnet" })),
}));

// ---- imports after mocks are registered ------------------------------------
import { useCompliance, useAllowlist } from "@/hooks/useCompliance";
import { compliance } from "@/lib/contracts";
import type { KycRecord } from "@/types";

// ---- typed mock helpers ----------------------------------------------------
const mockIsAllowed = compliance.isAllowed as jest.MockedFunction<
  typeof compliance.isAllowed
>;
const mockGetRecord = compliance.getRecord as jest.MockedFunction<
  typeof compliance.getRecord
>;
const mockGetAllowlist = compliance.getAllowlist as jest.MockedFunction<
  typeof compliance.getAllowlist
>;

// ---- shared fixtures -------------------------------------------------------
const COMPLIANCE_ID = "CBUERYDM7DXTZLLKDBRJKUBPFJ7M4OSUN4T7XKUARU345RLXNAIQD2IU";
const ADDRESS = "GABC1234TEST";

const APPROVED_RECORD: KycRecord = {
  address: ADDRESS,
  status: "Approved",
  jurisdiction: "US",
  verifiedAt: 1000,
  expiresAt: 0,
};

const PENDING_RECORD: KycRecord = {
  address: "GADDR_PENDING",
  status: "Pending",
  jurisdiction: "KE",
  verifiedAt: 2000,
  expiresAt: 0,
};

const SUSPENDED_RECORD: KycRecord = {
  address: "GADDR_SUSPENDED",
  status: "Suspended",
  jurisdiction: "DE",
  verifiedAt: 3000,
  expiresAt: 0,
};

// ============================================================================
// useCompliance
// ============================================================================

describe("useCompliance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // Case 1: null arguments → immediate "None" short-circuit (no RPC calls)
  // --------------------------------------------------------------------------

  it("returns None status immediately when complianceId is null", async () => {
    const { result } = renderHook(() => useCompliance(null, ADDRESS));

    // Should not be loading (enabled=false when id is null)
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();

    // Contract bindings must never be called
    expect(mockIsAllowed).not.toHaveBeenCalled();
    expect(mockGetRecord).not.toHaveBeenCalled();
  });

  it("returns None status immediately when address is null", async () => {
    const { result } = renderHook(() => useCompliance(COMPLIANCE_ID, null));

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();

    expect(mockIsAllowed).not.toHaveBeenCalled();
    expect(mockGetRecord).not.toHaveBeenCalled();
  });

  it("returns None status immediately when both args are null", async () => {
    const { result } = renderHook(() => useCompliance(null, null));

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(mockIsAllowed).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // Case 2: isAllowed=true + record present → allowed=true, status from record
  // --------------------------------------------------------------------------

  it("combines isAllowed=true with KYC record to produce allowed=true + Approved status", async () => {
    mockIsAllowed.mockResolvedValueOnce(true);
    mockGetRecord.mockResolvedValueOnce(APPROVED_RECORD);

    const { result } = renderHook(() =>
      useCompliance(COMPLIANCE_ID, ADDRESS),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual({
      allowed: true,
      status: "Approved",
      record: APPROVED_RECORD,
    });

    // Both contract calls should be made in parallel with the right args
    expect(mockIsAllowed).toHaveBeenCalledWith("testnet", COMPLIANCE_ID, ADDRESS);
    expect(mockGetRecord).toHaveBeenCalledWith("testnet", COMPLIANCE_ID, ADDRESS);
  });

  it("combines isAllowed=false with Suspended record → allowed=false, status=Suspended", async () => {
    mockIsAllowed.mockResolvedValueOnce(false);
    mockGetRecord.mockResolvedValueOnce(SUSPENDED_RECORD);

    const { result } = renderHook(() =>
      useCompliance(COMPLIANCE_ID, "GADDR_SUSPENDED"),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toMatchObject({
      allowed: false,
      status: "Suspended",
      record: SUSPENDED_RECORD,
    });
  });

  it("reflects Pending status even when isAllowed=false", async () => {
    mockIsAllowed.mockResolvedValueOnce(false);
    mockGetRecord.mockResolvedValueOnce(PENDING_RECORD);

    const { result } = renderHook(() =>
      useCompliance(COMPLIANCE_ID, "GADDR_PENDING"),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toMatchObject({
      allowed: false,
      status: "Pending",
    });
  });

  // --------------------------------------------------------------------------
  // Case 3: record is null → status falls back to "None"
  // --------------------------------------------------------------------------

  it("returns status=None when getRecord returns null", async () => {
    mockIsAllowed.mockResolvedValueOnce(false);
    mockGetRecord.mockResolvedValueOnce(null);

    const { result } = renderHook(() =>
      useCompliance(COMPLIANCE_ID, ADDRESS),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual({
      allowed: false,
      status: "None",
      record: null,
    });
  });

  it("returns status=None and record=null even when isAllowed returns true but record is missing", async () => {
    // Edge-case: gate says allowed but no KYC record (shouldn't happen on-chain
    // but the UI must handle it gracefully).
    mockIsAllowed.mockResolvedValueOnce(true);
    mockGetRecord.mockResolvedValueOnce(null);

    const { result } = renderHook(() =>
      useCompliance(COMPLIANCE_ID, ADDRESS),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual({
      allowed: true,
      status: "None",
      record: null,
    });
  });

  // --------------------------------------------------------------------------
  // Case 4: contract call rejects → error state is surfaced
  // --------------------------------------------------------------------------

  it("surfaces an error when isAllowed rejects", async () => {
    mockIsAllowed.mockRejectedValueOnce(new Error("RPC timeout"));
    mockGetRecord.mockResolvedValueOnce(APPROVED_RECORD);

    const { result } = renderHook(() =>
      useCompliance(COMPLIANCE_ID, ADDRESS),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("RPC timeout");
    expect(result.current.data).toBeNull();
  });

  // --------------------------------------------------------------------------
  // Case 5: refetch triggers a fresh load
  // --------------------------------------------------------------------------

  it("re-runs the loader when refetch is called", async () => {
    mockIsAllowed.mockResolvedValue(true);
    mockGetRecord.mockResolvedValue(APPROVED_RECORD);

    const { result } = renderHook(() =>
      useCompliance(COMPLIANCE_ID, ADDRESS),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockIsAllowed).toHaveBeenCalledTimes(1);

    // Trigger a re-fetch
    act(() => { result.current.refetch(); });

    await waitFor(() => expect(mockIsAllowed).toHaveBeenCalledTimes(2));
    expect(result.current.data?.allowed).toBe(true);
  });
});

// ============================================================================
// useAllowlist
// ============================================================================

describe("useAllowlist", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // Case 1: null complianceId → disabled, returns empty data
  // --------------------------------------------------------------------------

  it("returns empty data immediately when complianceId is null", () => {
    const { result } = renderHook(() => useAllowlist(null));

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(mockGetAllowlist).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // Case 2: record filtering — null records are excluded from the returned array
  // --------------------------------------------------------------------------

  it("filters out null records from the allowlist", async () => {
    // getAllowlist returns three addresses; two have records, one does not.
    mockGetAllowlist.mockResolvedValueOnce([
      APPROVED_RECORD.address,
      PENDING_RECORD.address,
      "GADDR_NO_RECORD",
    ]);
    mockGetRecord
      .mockResolvedValueOnce(APPROVED_RECORD)
      .mockResolvedValueOnce(PENDING_RECORD)
      .mockResolvedValueOnce(null); // third address has no record

    const { result } = renderHook(() => useAllowlist(COMPLIANCE_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    // Only the two non-null records should be returned
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data).toEqual([APPROVED_RECORD, PENDING_RECORD]);

    expect(mockGetAllowlist).toHaveBeenCalledWith("testnet", COMPLIANCE_ID);
    expect(mockGetRecord).toHaveBeenCalledTimes(3);
  });

  it("returns an empty array when getAllowlist returns no addresses", async () => {
    mockGetAllowlist.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useAllowlist(COMPLIANCE_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual([]);
    // getRecord should never be called when there are no addresses
    expect(mockGetRecord).not.toHaveBeenCalled();
  });

  it("returns all records when none are null", async () => {
    mockGetAllowlist.mockResolvedValueOnce([
      APPROVED_RECORD.address,
      SUSPENDED_RECORD.address,
    ]);
    mockGetRecord
      .mockResolvedValueOnce(APPROVED_RECORD)
      .mockResolvedValueOnce(SUSPENDED_RECORD);

    const { result } = renderHook(() => useAllowlist(COMPLIANCE_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data).toContainEqual(APPROVED_RECORD);
    expect(result.current.data).toContainEqual(SUSPENDED_RECORD);
  });

  // --------------------------------------------------------------------------
  // Case 3: error propagation
  // --------------------------------------------------------------------------

  it("surfaces an error when getAllowlist rejects", async () => {
    mockGetAllowlist.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useAllowlist(COMPLIANCE_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Network error");
    expect(result.current.data).toBeNull();
  });

  it("surfaces an error when a getRecord call rejects", async () => {
    mockGetAllowlist.mockResolvedValueOnce([APPROVED_RECORD.address]);
    mockGetRecord.mockRejectedValueOnce(new Error("Record fetch failed"));

    const { result } = renderHook(() => useAllowlist(COMPLIANCE_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Record fetch failed");
  });

  // --------------------------------------------------------------------------
  // Case 4: refetch works
  // --------------------------------------------------------------------------

  it("re-fetches when refetch is called", async () => {
    mockGetAllowlist.mockResolvedValue([APPROVED_RECORD.address]);
    mockGetRecord.mockResolvedValue(APPROVED_RECORD);

    const { result } = renderHook(() => useAllowlist(COMPLIANCE_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockGetAllowlist).toHaveBeenCalledTimes(1);

    act(() => { result.current.refetch(); });

    await waitFor(() => expect(mockGetAllowlist).toHaveBeenCalledTimes(2));
  });
});
