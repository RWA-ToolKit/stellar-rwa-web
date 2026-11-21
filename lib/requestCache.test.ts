import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requestCache } from './requestCache';

describe('requestCache error path', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects predictably when the underlying fetch fails', async () => {
    const failure = new Error('network down');
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(failure);

    const result = requestCache('https://example.test/resource');

    await expect(result).rejects.toThrow('network down');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('surfaces the failure as readable state instead of an unhandled exception', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('boom'));

    let caught: unknown;
    try {
      await requestCache('https://example.test/resource');
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe('boom');
  });
});

describe('requestCache empty/zero input', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // An empty URL is not a valid request target. The behaviour is deliberate:
  // requestCache still delegates to fetch (no silent short-circuit), so the
  // caller observes the same rejection path as any other failed request.
  it('delegates an empty string URL to fetch and rejects on failure', async () => {
    const failure = new Error('invalid url');
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(failure);

    const result = requestCache('');

    await expect(result).rejects.toThrow('invalid url');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith('');
  });

  // A zero/empty cache key must not be treated as a cache hit or silently
  // resolved. It flows through the same fetch path and surfaces errors.
  it('treats a zero/empty key as a normal request rather than a cache hit', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('ok'));

    const result = requestCache('');

    await expect(result).resolves.toBeDefined();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe('requestCache stale closure / dependency array', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // requestCache is a plain module-level function, not a React hook, so it has
  // no dependency array to audit. The stale-closure risk here is instead a
  // captured `fetch` reference: if the implementation closed over `fetch` at
  // module load, later replacements (e.g. test mocks or polyfills) would be
  // ignored. This asserts the current `globalThis.fetch` is used per call.
  it('uses the current global fetch on every call rather than a captured reference', async () => {
    const first = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('first'));

    await requestCache('https://example.test/first');
    expect(first).toHaveBeenCalledTimes(1);

    first.mockRestore();

    const second = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('second'));

    await requestCache('https://example.test/second');
    expect(second).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledWith('https://example.test/second');
  });

  // Guards against a stale closure over the URL argument: each invocation must
  // forward its own argument, not a value captured from a previous call.
  it('forwards the argument of each call without leaking a previous URL', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('ok'));

    await requestCache('https://example.test/a');
    await requestCache('https://example.test/b');

    expect(fetchSpy).toHaveBeenNthCalledWith(1, 'https://example.test/a');
    expect(fetchSpy).toHaveBeenNthCalledWith(2, 'https://example.test/b');
  });
});
