/**
 * Shared mock helper for lib/contracts.ts — reused across route-level tests.
 *
 * Provides configurable mocking of contract read methods (registry.getAllAssets,
 * registry.getAsset, registry.getAssetsByIssuer, etc.) so tests can exercise
 * different contract states without real Soroban/RPC calls.
 *
 * Usage:
 *   jest.mock('@/lib/contracts');
 *   import * as contracts from '@/lib/contracts';
 *   const { setupContractsMock } = require('@/test/mocks/contracts');
 *
 *   beforeEach(() => {
 *     setupContractsMock(contracts as jest.Mocked<typeof contracts>, {
 *       getAllAssets: () => [asset1, asset2],
 *       getAsset: (_, id) => id === 1n ? asset1 : null,
 *     });
 *   });
 */

import type * as ContractsModule from "@/lib/contracts";
import type { AssetEntry } from "@/types";

export interface ContractsMockConfig {
  getAllAssets?: (network: string) => AssetEntry[] | Promise<AssetEntry[]>;
  getAsset?: (network: string, id: bigint) => AssetEntry | Promise<AssetEntry>;
  getAssetsByIssuer?: (network: string, issuer: string) => AssetEntry[] | Promise<AssetEntry[]>;
  getAssetsByType?: (network: string, assetType: string) => AssetEntry[] | Promise<AssetEntry[]>;
}

/**
 * Configure the mocked contracts module with custom behavior.
 * Call this in beforeEach() to set up contract responses per test scenario.
 */
export function setupContractsMock(
  mockContracts: jest.Mocked<typeof ContractsModule>,
  config: ContractsMockConfig,
) {
  // Mock registry methods
  if (config.getAllAssets) {
    mockContracts.registry.getAllAssets.mockImplementation(async (network) => {
      const result = config.getAllAssets!(network);
      return Promise.resolve(result);
    });
  } else {
    mockContracts.registry.getAllAssets.mockResolvedValue([]);
  }

  if (config.getAsset) {
    mockContracts.registry.getAsset.mockImplementation(async (network, id) => {
      const result = config.getAsset!(network, id);
      return Promise.resolve(result);
    });
  }

  if (config.getAssetsByIssuer) {
    mockContracts.registry.getAssetsByIssuer.mockImplementation(async (network, issuer) => {
      const result = config.getAssetsByIssuer!(network, issuer);
      return Promise.resolve(result);
    });
  } else {
    mockContracts.registry.getAssetsByIssuer.mockResolvedValue([]);
  }

  if (config.getAssetsByType) {
    mockContracts.registry.getAssetsByType.mockImplementation(async (network, assetType) => {
      const result = config.getAssetsByType!(network, assetType);
      return Promise.resolve(result);
    });
  } else {
    mockContracts.registry.getAssetsByType.mockResolvedValue([]);
  }
}

/**
 * Helper to create a mock asset for testing.
 */
export function makeMockAsset(
  overrides: Partial<AssetEntry> & Pick<AssetEntry, "id" | "name">,
): AssetEntry {
  return {
    id: overrides.id,
    tokenContract: `CTOKEN${overrides.id}`,
    issuer: "GISSUER",
    name: overrides.name,
    assetType: "real_estate",
    valuation: 1_000_000_00n,
    createdAt: 100,
    active: true,
    ...overrides,
  };
}
