# Issue #867 - Split lib/stellar.ts into Read and Write Paths

## Problem

lib/stellar.ts contains both:
- **Read path:** readContract (simulate-only, read state)
- **Write path:** invokeContract (full write pipeline, state changes)

**Result:** Large file mixing concerns, harder to test/reason about each path in isolation

## Current Structure

```typescript
// lib/stellar.ts (single large file)
export async function readContract(params) { ... }
export async function invokeContract(params) { ... }
export async function normalizeResponse(response) { ... }
// 300+ lines mixed logic
```

## Proposed Solution

Split into separate modules while maintaining backward compatibility:

```
lib/stellar/
├── read.ts        (readContract, read-only operations)
├── write.ts       (invokeContract, state-changing operations)
├── normalize.ts   (shared response normalization)
├── types.ts       (shared types)
└── index.ts       (re-exports for backward compatibility)

lib/stellar.ts (deprecated, re-exports from lib/stellar/index.ts)

lib/__tests__/
├── read.test.ts       (read-path tests)
├── write.test.ts      (write-path tests)
└── normalize.test.ts  (shared utilities)
```

## Implementation Steps

### Phase 1 - Extract Shared Types (PR 1)

**Create lib/stellar/types.ts:**

```typescript
// lib/stellar/types.ts
export interface ContractReadParams {
  contractId: string;
  method: string;
  args?: any[];
  ledger?: string;
}

export interface ContractReadResult {
  result: any;
  ledger: string;
  resource: string;
}

export interface ContractInvokeParams {
  contractId: string;
  method: string;
  args?: any[];
  wallet: any;
  fee?: number;
  networkPassphrase?: string;
}

export interface ContractInvokeResult {
  hash: string;
  ledger: number;
  result: any;
}

export type TransactionResponse = any; // From Horizon SDK
```

### Phase 2 - Extract Read Path (PR 2)

**Create lib/stellar/read.ts:**

```typescript
// lib/stellar/read.ts
import { ContractReadParams, ContractReadResult } from './types';

const rpcUrl = process.env.REACT_APP_RPC_URL || 'https://soroban-testnet.stellar.org:443';
const networkPassphrase =
  process.env.REACT_APP_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';

/**
 * Read from a contract without state changes (simulation only)
 * Safe to call; no transaction fees
 */
export async function readContract({
  contractId,
  method,
  args = [],
  ledger,
}: ContractReadParams): Promise<ContractReadResult> {
  // Normalize arguments
  const normalizedArgs = args.map((arg) => normalizeArg(arg));

  // Build contract read request
  const request = {
    jsonrpc: '2.0',
    id: '1',
    method: 'simulateTransaction',
    params: {
      transaction: buildTransaction({
        contractId,
        method,
        args: normalizedArgs,
      }),
      resourceLeeway: 10,
      ledgerIndex: ledger || 'latest',
    },
  };

  // Send to RPC
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  const json = await response.json();

  if (json.error) {
    throw new Error(`Read error: ${json.error.message}`);
  }

  // Parse result
  const result = parseSimulationResult(json.result);

  return {
    result,
    ledger: json.result.latestLedger,
    resource: json.result.resource,
  };
}

// Helper functions (private to this module)
function normalizeArg(arg: any): any {
  // Implementation: convert JS values to Soroban XDR
  return arg;
}

function buildTransaction(params: any): any {
  // Implementation: build Stellar transaction envelope
  return {};
}

function parseSimulationResult(result: any): any {
  // Implementation: parse XDR result
  return result;
}
```

**Create lib/__tests__/read.test.ts:**

```typescript
// lib/__tests__/read.test.ts
import { readContract } from 'lib/stellar/read';

describe('readContract', () => {
  it('reads contract state without side effects', async () => {
    const result = await readContract({
      contractId: 'CAX4RBSXCGC52BWHWCLHQRKNXU7CXMNQSDAGP72O7RVKQ5FT4LXLDD',
      method: 'balanceOf',
      args: ['address'],
    });

    expect(result).toHaveProperty('result');
    expect(result).toHaveProperty('ledger');
    expect(result).toHaveProperty('resource');
  });

  it('throws error on invalid contract ID', async () => {
    expect(async () => {
      await readContract({
        contractId: 'invalid',
        method: 'balanceOf',
        args: ['address'],
      });
    }).rejects.toThrow();
  });

  it('normalizes arguments correctly', async () => {
    // Test argument normalization
    const result = await readContract({
      contractId: 'CAX4RBSXCGC52BWHWCLHQRKNXU7CXMNQSDAGP72O7RVKQ5FT4LXLDD',
      method: 'transfer',
      args: [
        'GAX4RBSXCGC52BWHWCLHQRKNXU7CXMNQSDAGP72O7RVKQ5FT4LXL',
        1000000,
        'memo',
      ],
    });

    expect(result.result).toBeDefined();
  });
});
```

### Phase 3 - Extract Write Path (PR 3)

**Create lib/stellar/write.ts:**

```typescript
// lib/stellar/write.ts
import { ContractInvokeParams, ContractInvokeResult } from './types';

/**
 * Invoke a contract method that changes state
 * Requires wallet connection and signature
 */
export async function invokeContract({
  contractId,
  method,
  args = [],
  wallet,
  fee = 100,
  networkPassphrase,
}: ContractInvokeParams): Promise<ContractInvokeResult> {
  if (!wallet) {
    throw new Error('Wallet not connected');
  }

  // Step 1: Get current sequence number from wallet
  const publicKey = wallet.publicKey;
  const account = await getAccount(publicKey);

  // Step 2: Build transaction
  const txBuilder = new TransactionBuilder(account, {
    fee: fee.toString(),
    networkPassphrase,
  });

  // Add contract invocation
  txBuilder.addOperation(
    invokeHostFunction({
      hostFunction: buildContractInvoke(contractId, method, args),
      auth: [],
    })
  );

  // Step 3: Sign transaction
  const tx = txBuilder.build();
  const signedTx = await wallet.signTransaction(tx.toXDR());

  // Step 4: Submit to network
  const result = await submitTransaction(signedTx);

  return {
    hash: result.id,
    ledger: result.ledger_attr,
    result: parseTransactionResult(result),
  };
}

// Helper functions
async function getAccount(publicKey: string): Promise<any> {
  // Implementation: fetch account from Horizon
  return {};
}

function buildContractInvoke(contractId: string, method: string, args: any[]): any {
  // Implementation: build contract invocation
  return {};
}

async function submitTransaction(txXdr: string): Promise<any> {
  // Implementation: submit to Horizon
  return {};
}

function parseTransactionResult(tx: any): any {
  // Implementation: extract result from transaction
  return tx.result;
}
```

**Create lib/__tests__/write.test.ts:**

```typescript
// lib/__tests__/write.test.ts
import { invokeContract } from 'lib/stellar/write';

describe('invokeContract', () => {
  it('requires wallet connection', async () => {
    expect(async () => {
      await invokeContract({
        contractId: 'CAX4RBSXCGC52BWHWCLHQRKNXU7CXMNQSDAGP72O7RVKQ5FT4LXLDD',
        method: 'transfer',
        args: ['address', 1000],
        wallet: null as any,
      });
    }).rejects.toThrow('Wallet not connected');
  });

  it('signs and submits transaction', async () => {
    const mockWallet = {
      publicKey: 'GAAAAA...',
      signTransaction: jest.fn().mockResolvedValue('signed_xdr'),
    };

    const result = await invokeContract({
      contractId: 'CAX4RBSXCGC52BWHWCLHQRKNXU7CXMNQSDAGP72O7RVKQ5FT4LXLDD',
      method: 'transfer',
      args: ['GAX4RBSXCGC52BWHWCLHQRKNXU7CXMNQSDAGP72O7RVKQ5FT4LXL', 1000],
      wallet: mockWallet,
    });

    expect(result).toHaveProperty('hash');
    expect(result).toHaveProperty('ledger');
    expect(mockWallet.signTransaction).toHaveBeenCalled();
  });

  it('handles transaction submission errors', async () => {
    // Test error handling during submission
    const mockWallet = {
      publicKey: 'GAAAAA...',
      signTransaction: jest.fn().mockResolvedValue('signed_xdr'),
    };

    // Mock network error
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    expect(async () => {
      await invokeContract({
        contractId: 'CAX4RBSXCGC52BWHWCLHQRKNXU7CXMNQSDAGP72O7RVKQ5FT4LXLDD',
        method: 'transfer',
        args: ['address', 1000],
        wallet: mockWallet,
      });
    }).rejects.toThrow();
  });
});
```

### Phase 4 - Extract Shared Normalize (PR 4)

**Create lib/stellar/normalize.ts:**

```typescript
// lib/stellar/normalize.ts
export function normalizeResponse(response: any): any {
  // Extract and format response based on type
  if (response.soroban_xdr) {
    return decodeSorobanXDR(response.soroban_xdr);
  }
  return response;
}

function decodeSorobanXDR(xdr: string): any {
  // Implementation
  return {};
}
```

### Phase 5 - Create Index (PR 5)

**Create lib/stellar/index.ts:**

```typescript
// lib/stellar/index.ts - Public API, backward compatible
export { readContract } from './read';
export { invokeContract } from './write';
export { normalizeResponse } from './normalize';
export type {
  ContractReadParams,
  ContractReadResult,
  ContractInvokeParams,
  ContractInvokeResult,
} from './types';
```

**Update lib/stellar.ts (deprecated):**

```typescript
// lib/stellar.ts - Deprecated, use lib/stellar/index.ts instead
// Kept for backward compatibility
export * from './stellar';
```

### Phase 6 - Update Imports (PR 6)

Existing code continues working without changes:

```typescript
// Old imports still work
import { readContract, invokeContract } from 'lib/stellar';

// New pattern (optional)
import { readContract } from 'lib/stellar/read';
import { invokeContract } from 'lib/stellar/write';
```

## Verification

**All existing tests pass:**
```bash
npm run test -- lib/__tests__/stellar.test.ts
npm run test -- lib/__tests__/read.test.ts
npm run test -- lib/__tests__/write.test.ts
```

**No behavior changes:**
```bash
npm run build  # Verify build succeeds
npm run test   # All tests pass
```

## Checklist

- [ ] Extract types to lib/stellar/types.ts
- [ ] Extract read path to lib/stellar/read.ts
- [ ] Add read.test.ts with comprehensive tests
- [ ] Extract write path to lib/stellar/write.ts
- [ ] Add write.test.ts with comprehensive tests
- [ ] Extract normalize to lib/stellar/normalize.ts
- [ ] Create lib/stellar/index.ts with re-exports
- [ ] Update lib/stellar.ts for backward compatibility
- [ ] Run all tests - verify passing
- [ ] Update imports where possible (optional)

## Benefits

✅ Clear separation of concerns  
✅ Each path independently testable  
✅ Easier to reason about state flow  
✅ Backward compatible (no breaking changes)  
✅ Future enhancements easier  
