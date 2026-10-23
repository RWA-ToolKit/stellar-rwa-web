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
});
