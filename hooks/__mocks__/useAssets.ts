/**
 * Manual Jest mock for hooks/useAssets.
 *
 * Placing this file at hooks/__mocks__/useAssets.ts means that any test which
 * calls `jest.mock('@/hooks/useAssets')` will use this factory instead of the
 * real module — and, critically, the real module (which transitively imports
 * @stellar/stellar-sdk) is never loaded by Jest at all.
 */
import type { AssetEntry } from "@/types";

export type UseAssetsReturn = {
  assets: AssetEntry[];
  loading: boolean;
  error: string | null;
  data: AssetEntry[] | undefined;
  refetch: () => void;
};

export const useAssets = jest.fn<UseAssetsReturn, []>(() => ({
  assets: [],
  loading: false,
  error: null,
  data: undefined,
  refetch: jest.fn(),
}));
