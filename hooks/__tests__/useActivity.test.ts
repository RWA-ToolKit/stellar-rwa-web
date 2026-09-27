import { renderHook, waitFor } from "@testing-library/react";
import { api, type ApiEvent } from "@/lib/api";
import { useActivity } from "../useActivity";

jest.mock("@/lib/api", () => ({
  api: {
    getEvents: jest.fn(),
  },
}));

const mockGetEvents = api.getEvents as jest.MockedFunction<typeof api.getEvents>;

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
  beforeEach(() => jest.clearAllMocks());

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

  it("does not request events when there is no token contract", () => {
    const { result } = renderHook(() => useActivity(null));

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(mockGetEvents).not.toHaveBeenCalled();
  });
});
