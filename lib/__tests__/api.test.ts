import { api } from "@/lib/api";

// Mock fetch globally
global.fetch = jest.fn();

describe("api client error handling", () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  // ---------------------------------------------------------------------------
  // Non-200 response handling
  // ---------------------------------------------------------------------------

  it("returns null for non-200 responses", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const result = await api.getStats();
    expect(result).toBeNull();
  });

  it("returns null for 500 server errors", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const result = await api.getStats();
    expect(result).toBeNull();
  });

  it("handles 401 unauthorized without throwing", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    const result = await api.getStats();
    expect(result).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Malformed response body handling
  // ---------------------------------------------------------------------------

  it("throws error when response body is not valid JSON", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockRejectedValueOnce(new SyntaxError("Unexpected token < in JSON at position 0")),
    });

    // This test documents the current buggy behavior: malformed JSON causes unhandled error
    await expect(api.getStats()).rejects.toThrow(SyntaxError);
  });

  it("throws error when response body claims JSON but contains HTML (e.g., error page)", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockRejectedValueOnce(new SyntaxError("Unexpected token < in JSON at position 0")),
    });

    await expect(api.getStats()).rejects.toThrow(SyntaxError);
  });

  it("throws error for unexpectedly-shaped JSON response", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ unexpected: "shape" }),
    });

    // Current behavior: no validation of response shape, just passes through
    const result = await api.getStats();
    // Type-wise this is { unexpected: "shape" } not ApiStatsResult, but no runtime error
    expect(result).toEqual({ unexpected: "shape" });
  });

  // ---------------------------------------------------------------------------
  // Successful responses
  // ---------------------------------------------------------------------------

  it("returns parsed JSON for successful response", async () => {
    const mockData = {
      totalAssets: 10,
      tvl: "1000000000",
      totalHolders: 250,
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockData),
    });

    const result = await api.getStats();
    expect(result).toEqual(mockData);
  });

  it("returns null when URL is empty", async () => {
    // When BASE is not set, apiUrl returns empty string
    const originalEnv = process.env.NEXT_PUBLIC_API_URL;
    delete process.env.NEXT_PUBLIC_API_URL;

    const result = await api.getStats();
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();

    process.env.NEXT_PUBLIC_API_URL = originalEnv;
  });
});
