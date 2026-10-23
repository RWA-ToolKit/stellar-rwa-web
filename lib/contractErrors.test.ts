import { describe, it, expect } from 'vitest';
import { contractErrors } from './contractErrors';

describe('contractErrors', () => {
  describe('empty/zero/null input', () => {
    it('returns an empty array for an empty string', () => {
      // Deliberate: an empty message carries no contract error, so nothing is reported.
      expect(contractErrors('')).toEqual([]);
    });

    it('returns an empty array for the zero string', () => {
      // "0" is not a known contract error code/message, so it is treated as no error.
      expect(contractErrors('0')).toEqual([]);
    });

    it('returns an empty array for null', () => {
      expect(contractErrors(null as unknown as string)).toEqual([]);
    });

    it('returns an empty array for undefined', () => {
      expect(contractErrors(undefined as unknown as string)).toEqual([]);
    });
  });

  describe('purity / no stale state', () => {
    // contractErrors is a pure utility module: it has no React hooks, props, or
    // state, so there is no dependency array to audit. These tests assert that
    // repeated calls with the same input are deterministic and that the function
    // does not retain state between invocations (the stale-closure failure mode).
    it('returns the same result for repeated calls with the same input', () => {
      const input = 'insufficient balance';
      const first = contractErrors(input);
      const second = contractErrors(input);
      expect(second).toEqual(first);
    });

    it('does not leak state between different inputs', () => {
      const a = contractErrors('insufficient balance');
      const b = contractErrors('');
      const aAgain = contractErrors('insufficient balance');
      expect(b).toEqual([]);
      expect(aAgain).toEqual(a);
    });

    it('does not mutate its input', () => {
      const input = 'insufficient balance';
      const snapshot = input;
      contractErrors(input);
      expect(input).toBe(snapshot);
    });
  });
});
