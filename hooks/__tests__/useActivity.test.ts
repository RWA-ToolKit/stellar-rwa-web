import { act, renderHook, waitFor } from "@testing-library/react";
import { api, type ApiEvent } from "@/lib/api";
import type { Network } from "@/types";
import { useActivity } from "../useActivity";

let mockNetwork: Network = "testnet";

jest.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ network: mockNetwork }),
}));

jest.mock("@/lib/api", () => ({
  API_MAX_PAGES: 50,
  API_PAGE_SIZE: 100,
  api: {
    getEvents: jest.fn(),
    isConfigured: jest.fn(),
  },
}));

const mockGetEvents = api.getEvents as jest.MockedFunction<typeof api.getEvents>;
const mockIsConfigured = api.isConfigured as jest.MockedFunction<
  typeof api.isConfigured
>;

function makeEvent(overrides: Partial<ApiEvent> = {}): ApiEvent {
  return {
    id: 1,
    contract: "CTOKEN_A",
    event_type: "Transfer",
    ledger: 100,
    timestamp: "2026-07-09T08:43:12.101Z",
    data: { from: "GFROM", to: "GTO", amount: "9007199254740993" },
    ...overrides,
  };
}

describe("useActivity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNetwork = "testnet";
    mockIsConfigured.mockReturnValue(true);
  });

  it("filters the event feed to valid transfers for the requested token", async () => {
    mockGetEvents.mockResolvedValue([
      makeEvent(),
      makeEvent({ id: 2, contract: "CTOKEN_B" }),
      makeEvent({ id: 3, event_type: "Mint" }),
      makeEvent({ id: 4, data: { from: "GFROM", to: "GTO", amount: "not-an-integer" } }),
    ]);

    const { result } = renderHook(() => useActivity("CTOKEN_A"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual([
      {
        id: 1,
        from: "GFROM",
        to: "GTO",
        amount: 9007199254740993n,
        ledger: 100,
        timestamp: "2026-07-09T08:43:12.101Z",
      },
    ]);
  });

  it("returns an explicit error when the indexing API is unavailable", async () => {
    mockGetEvents.mockResolvedValue(null);

    const { result } = renderHook(() => useActivity("CTOKEN_A"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toMatch(/indexing API/i);
  });

  it("loads a long activity feed across pages without duplicates or gaps", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) =>
      makeEvent({ id: index + 1 }),
    );
    const secondPage = Array.from({ length: 100 }, (_, index) =>
      makeEvent({ id: index + 101 }),
    );
    const finalPage = [makeEvent({ id: 201 })];
    mockGetEvents
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce(secondPage)
      .mockResolvedValueOnce(finalPage);

    const { result } = renderHook(() => useActivity("CTOKEN_A"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGetEvents).toHaveBeenNthCalledWith(1, { offset: 0, limit: 100 });
    expect(mockGetEvents).toHaveBeenNthCalledWith(2, { offset: 100, limit: 100 });
    expect(mockGetEvents).toHaveBeenNthCalledWith(3, { offset: 200, limit: 100 });
    expect(result.current.data?.map((event) => event.id)).toEqual(
      Array.from({ length: 201 }, (_, index) => index + 1),
    );
  });

  it("returns an empty disabled state when the indexing API is not configured", () => {
    mockIsConfigured.mockReturnValue(false);

    const { result } = renderHook(() => useActivity("CTOKEN_A"));

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(mockGetEvents).not.toHaveBeenCalled();
  });

  it("does not request events when there is no token contract", () => {
    const { result } = renderHook(() => useActivity(null));

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(mockGetEvents).not.toHaveBeenCalled();
  });

  describe("network switch mid-session (#600)", () => {
    it("clears cached testnet activity immediately when switching to mainnet and loads mainnet events", async () => {
      let resolveMainnet!: (events: ApiEvent[]) => void;
      const mainnetPromise = new Promise<ApiEvent[]>((resolve) => {
        resolveMainnet = resolve;
      });

      mockGetEvents.mockImplementation(() => {
        if (mockNetwork === "testnet") {
          return Promise.resolve([
            makeEvent({
              id: 10,
              contract: "CTOKEN_A",
              data: { from: "GTEST_FROM", to: "GTEST_TO", amount: "100" },
            }),
          ]);
        }
        return mainnetPromise;
      });

      const { result, rerender } = renderHook(() => useActivity("CTOKEN_A"));

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.data).toEqual([
        {
          id: 10,
          from: "GTEST_FROM",
          to: "GTEST_TO",
          amount: 100n,
          ledger: 100,
          timestamp: "2026-07-09T08:43:12.101Z",
        },
      ]);

      // Switch network mid-session from testnet to mainnet
      mockNetwork = "mainnet";
      rerender();

      // Stale testnet activity must not remain visible while mainnet loads
      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(true);

      await act(async () => {
        resolveMainnet([
          makeEvent({
            id: 20,
            contract: "CTOKEN_A",
            data: { from: "GMAIN_FROM", to: "GMAIN_TO", amount: "500" },
          }),
        ]);
      });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.data).toEqual([
        {
          id: 20,
          from: "GMAIN_FROM",
          to: "GMAIN_TO",
          amount: 500n,
          ledger: 100,
          timestamp: "2026-07-09T08:43:12.101Z",
        },
      ]);
    });

    it("ignores late in-flight responses and errors from the previous network after switching", async () => {
      let resolveTestnet!: (events: ApiEvent[] | null) => void;
      const slowTestnet = new Promise<ApiEvent[] | null>((resolve) => {
        resolveTestnet = resolve;
      });

      mockGetEvents.mockImplementation(() => {
        if (mockNetwork === "testnet") {
          return slowTestnet;
        }
        return Promise.resolve([
          makeEvent({
            id: 99,
            contract: "CTOKEN_A",
            data: { from: "GMAIN_1", to: "GMAIN_2", amount: "2500" },
          }),
        ]);
      });

      const { result, rerender } = renderHook(() => useActivity("CTOKEN_A"));
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBeNull();

      // Switch to mainnet while the testnet fetch is still in flight
      mockNetwork = "mainnet";
      rerender();

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.data).toEqual([
        {
          id: 99,
          from: "GMAIN_1",
          to: "GMAIN_2",
          amount: 2500n,
          ledger: 100,
          timestamp: "2026-07-09T08:43:12.101Z",
        },
      ]);

      // Resolve the stale testnet response after mainnet has already settled
      await act(async () => {
        resolveTestnet([
          makeEvent({
            id: 1,
            contract: "CTOKEN_A",
            data: { from: "GSTALE_1", to: "GSTALE_2", amount: "999" },
          }),
        ]);
      });

      // Mainnet data must not be overwritten by the stale testnet response
      expect(result.current.data).toEqual([
        {
          id: 99,
          from: "GMAIN_1",
          to: "GMAIN_2",
          amount: 2500n,
          ledger: 100,
          timestamp: "2026-07-09T08:43:12.101Z",
        },
      ]);
      expect(result.current.error).toBeNull();
    });
  });
});
