# Issues #874, #873 - Asset Props & Format Consolidation

## Issue #874 - Normalize Prop Naming Conventions

### Problem

AssetCard, AssetHeader, and AssetDetailView each define bespoke prop interfaces for the same underlying Asset type; mapping at call sites is error-prone boilerplate.

### Current State

```typescript
// types/index.ts
export interface Asset {
  id: string;
  name: string;
  type: 'token' | 'nft' | 'derivative';
  status: 'active' | 'paused' | 'revoked';
  tvl: number;
  decimals: number;
  // ... 20+ more fields
}

// components/asset/AssetCard.tsx
interface AssetCardProps {
  assetName: string;      // Renamed from 'name'
  assetType: string;       // Renamed from 'type'
  tvlAmount: number;       // Renamed from 'tvl'
}

// components/asset/AssetHeader.tsx
interface AssetHeaderProps {
  title: string;           // Renamed from 'name'
  kind: string;            // Renamed from 'type'
  value: number;           // Renamed from 'tvl'
  isActive: boolean;       // Custom boolean from 'status'
}

// components/asset/AssetDetailView.tsx
interface AssetDetailViewProps {
  asset: {                  // Custom shape
    assetName: string;
    assetStatus: string;
    assetValue: number;
  };
}

// Call sites (error-prone mapping)
<AssetCard 
  assetName={asset.name}
  assetType={asset.type}
  tvlAmount={asset.tvl}
/>

<AssetHeader
  title={asset.name}
  kind={asset.type}
  value={asset.tvl}
  isActive={asset.status === 'active'}
/>
```

### Solution

#### Phase 1 - Define Shared Types (PR 1)

**Update types/index.ts:**

```typescript
// types/index.ts

export interface Asset {
  id: string;
  name: string;
  type: 'token' | 'nft' | 'derivative';
  status: 'active' | 'paused' | 'revoked';
  tvl: number;
  decimals: number;
  // ... other fields
}

/**
 * Shared prop type for asset-display components
 * Uses Pick<Asset> to ensure type safety and documentation
 * of exactly which fields each component needs
 */
export type AssetDisplayProps = Pick<Asset, 'name' | 'type' | 'status' | 'tvl'>;

/**
 * Alternative: minimal asset card display (lighter prop set)
 */
export type AssetCardDisplayProps = Pick<Asset, 'name' | 'type' | 'tvl'>;

/**
 * Alternative: full asset detail display
 */
export type AssetDetailDisplayProps = Asset;
```

#### Phase 2 - Refactor AssetCard (PR 2)

**Update components/asset/AssetCard.tsx:**

```typescript
import { AssetCardDisplayProps } from 'types';

interface AssetCardProps {
  asset: AssetCardDisplayProps;
  onClick?: () => void;
}

export const AssetCard: React.FC<AssetCardProps> = ({ asset, onClick }) => {
  return (
    <div 
      className="p-4 border rounded cursor-pointer hover:bg-gray-50"
      onClick={onClick}
    >
      <h3 className="font-semibold">{asset.name}</h3>
      <p className="text-sm text-gray-600">{asset.type}</p>
      <p className="text-lg font-bold">${asset.tvl.toLocaleString()}</p>
    </div>
  );
};
```

**Before this was:**
```typescript
interface AssetCardProps {
  assetName: string;
  assetType: string;
  tvlAmount: number;
  onClick?: () => void;
}

export const AssetCard: React.FC<AssetCardProps> = ({ 
  assetName, assetType, tvlAmount, onClick 
}) => {
  // ... uses assetName, assetType, tvlAmount
};
```

#### Phase 3 - Refactor AssetHeader (PR 3)

**Update components/asset/AssetHeader.tsx:**

```typescript
import { AssetDisplayProps } from 'types';

interface AssetHeaderProps {
  asset: AssetDisplayProps;
}

export const AssetHeader: React.FC<AssetHeaderProps> = ({ asset }) => {
  const isActive = asset.status === 'active';

  return (
    <div className="border-b pb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{asset.name}</h1>
        <span className={`px-3 py-1 rounded ${isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {asset.status}
        </span>
      </div>
      <p className="text-gray-600">{asset.type}</p>
      <p className="text-3xl font-bold mt-2">${asset.tvl.toLocaleString()}</p>
    </div>
  );
};
```

**Before this was:**
```typescript
interface AssetHeaderProps {
  title: string;
  kind: string;
  value: number;
  isActive: boolean;
}

export const AssetHeader: React.FC<AssetHeaderProps> = ({ title, kind, value, isActive }) => {
  // ... uses title, kind, value, isActive
};
```

#### Phase 4 - Refactor AssetDetailView (PR 4)

**Update components/asset/AssetDetailView.tsx:**

```typescript
import { AssetDetailDisplayProps } from 'types';
import { AssetHeader } from './AssetHeader';
import { AssetInfo } from './AssetInfo';

interface AssetDetailViewProps {
  assetId: string;
}

export const AssetDetailView: React.FC<AssetDetailViewProps> = ({ assetId }) => {
  const { asset, loading } = useAsset(assetId);

  if (loading) return <Skeleton />;
  if (!asset) return <div>Not found</div>;

  return (
    <div>
      <AssetHeader asset={asset} />  {/* Pass entire asset, let AssetHeader pick fields */}
      <AssetInfo asset={asset} />
    </div>
  );
};
```

**Before this was:**
```typescript
interface AssetDetailViewProps {
  asset: {
    assetName: string;
    assetStatus: string;
    assetValue: number;
  };
}

export const AssetDetailView: React.FC<AssetDetailViewProps> = ({ asset }) => {
  // ... works with custom shape
};
```

#### Phase 5 - Update Call Sites (PR 5)

**Before (error-prone mapping):**
```typescript
<AssetCard 
  assetName={asset.name}
  assetType={asset.type}
  tvlAmount={asset.tvl}
/>

<AssetHeader
  title={asset.name}
  kind={asset.type}
  value={asset.tvl}
  isActive={asset.status === 'active'}
/>
```

**After (simple pass-through):**
```typescript
<AssetCard asset={asset} />

<AssetHeader asset={asset} />
```

#### Phase 6 - Update Tests (PR 6)

**Update components/asset/__tests__/AssetCard.test.tsx:**

```typescript
import { AssetCard } from '../AssetCard';
import { AssetCardDisplayProps } from 'types';

describe('AssetCard', () => {
  const mockAsset: AssetCardDisplayProps = {
    name: 'Bitcoin',
    type: 'token',
    tvl: 50000,
  };

  it('renders asset name', () => {
    render(<AssetCard asset={mockAsset} />);
    expect(screen.getByText('Bitcoin')).toBeInTheDocument();
  });

  it('renders asset type', () => {
    render(<AssetCard asset={mockAsset} />);
    expect(screen.getByText('token')).toBeInTheDocument();
  });

  it('renders TVL with currency formatting', () => {
    render(<AssetCard asset={mockAsset} />);
    expect(screen.getByText('$50,000')).toBeInTheDocument();
  });
});
```

### Checklist

- [ ] Define AssetDisplayProps, AssetCardDisplayProps in types/index.ts
- [ ] Refactor AssetCard to accept `asset: AssetCardDisplayProps`
- [ ] Refactor AssetHeader to accept `asset: AssetDisplayProps`
- [ ] Refactor AssetDetailView to pass asset directly
- [ ] Update all call sites (remove manual mapping)
- [ ] Update tests to use shared types
- [ ] Run tests: all pass with no behavior change
- [ ] Verify no visual regression

### Benefits

✅ Single source of truth (types/index.ts)  
✅ Less boilerplate at call sites  
✅ Type safety (TypeScript prevents wrong props)  
✅ Easier to refactor later (change once, update all)  

---

## Issue #873 - Extract Shared Decimal Conversion Logic

### Problem

Decimal conversion math (e.g., token units ↔ display units) duplicated across components; risks precision bugs.

### Current State

```typescript
// lib/format.ts
export function formatAmount(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// components/portfolio/TransferPanel.tsx
function handleTransfer(displayAmount: string, decimals: number) {
  // Manual conversion
  const baseUnits = Math.floor(parseFloat(displayAmount) * Math.pow(10, decimals));
  submitTransaction(baseUnits);
}

// components/portfolio/DistributionCard.tsx
function formatReward(baseUnits: bigint, decimals: number): string {
  // Different conversion logic
  const amount = Number(baseUnits) / Math.pow(10, decimals);
  return `${amount.toFixed(2)} tokens`;
}

// components/asset/PriceChart.tsx
function convertPrice(raw: number, decimals: number): number {
  // Yet another conversion
  return raw / (10 ** decimals);
}
```

### Solution

#### Phase 1 - Audit & Centralize (PR 1)

**Extend lib/format.ts:**

```typescript
// lib/format.ts

/**
 * Convert display amount (user input) to blockchain base units
 * Example: "1.5" tokens with 6 decimals = 1500000 base units
 */
export function toBaseUnits(
  displayAmount: string | number,
  decimals: number
): bigint {
  const amount = typeof displayAmount === 'string' 
    ? parseFloat(displayAmount) 
    : displayAmount;

  if (isNaN(amount)) {
    throw new Error(`Invalid amount: ${displayAmount}`);
  }

  if (decimals < 0) {
    throw new Error(`Invalid decimals: ${decimals}`);
  }

  // Multiply by 10^decimals and convert to BigInt (safe for large numbers)
  const multiplier = BigInt(10) ** BigInt(decimals);
  const baseUnits = BigInt(Math.floor(amount * 10 ** decimals));

  return baseUnits;
}

/**
 * Convert blockchain base units to display amount
 * Example: 1500000 base units with 6 decimals = 1.5 tokens
 */
export function fromBaseUnits(
  baseUnits: bigint | number,
  decimals: number
): number {
  if (decimals < 0) {
    throw new Error(`Invalid decimals: ${decimals}`);
  }

  const divisor = BigInt(10) ** BigInt(decimals);
  const units = typeof baseUnits === 'number' ? BigInt(baseUnits) : baseUnits;
  
  return Number(units) / Number(divisor);
}

/**
 * Convert and format amount for display
 * Example: 1500000 base units with 6 decimals = "1.50 XLM"
 */
export function formatTokenAmount(
  baseUnits: bigint | number,
  decimals: number,
  symbol?: string,
  maxDecimals: number = 6
): string {
  const displayAmount = fromBaseUnits(baseUnits, decimals);
  const formatted = displayAmount.toFixed(Math.min(decimals, maxDecimals));
  
  return symbol ? `${formatted} ${symbol}` : formatted;
}

/**
 * Parse user input and validate it doesn't exceed max supply
 */
export function parseAndValidateAmount(
  input: string,
  decimals: number,
  maxBaseUnits?: bigint
): bigint {
  const baseUnits = toBaseUnits(input, decimals);

  if (maxBaseUnits && baseUnits > maxBaseUnits) {
    throw new Error(
      `Amount exceeds maximum (${formatTokenAmount(maxBaseUnits, decimals)})`
    );
  }

  return baseUnits;
}

// Legacy functions (kept for backward compatibility)
export function formatAmount(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
```

#### Phase 2 - Update Components (PR 2)

**Update components/portfolio/TransferPanel.tsx:**

```typescript
import { toBaseUnits, formatTokenAmount } from 'lib/format';

function TransferPanel() {
  const [displayAmount, setDisplayAmount] = useState('');
  const { decimals } = useAsset();

  const handleTransfer = async () => {
    try {
      // Single, canonical conversion
      const baseUnits = toBaseUnits(displayAmount, decimals);
      await submitTransaction(baseUnits);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <input
        value={displayAmount}
        onChange={(e) => setDisplayAmount(e.target.value)}
        placeholder="Enter amount"
      />
      <button onClick={handleTransfer}>Transfer</button>
    </div>
  );
}
```

**Before:**
```typescript
function handleTransfer(displayAmount: string, decimals: number) {
  const baseUnits = Math.floor(parseFloat(displayAmount) * Math.pow(10, decimals));
  submitTransaction(baseUnits);
}
```

**Update components/portfolio/DistributionCard.tsx:**

```typescript
import { formatTokenAmount } from 'lib/format';

function DistributionCard({ reward, decimals }: Props) {
  // Single, canonical formatting
  const formatted = formatTokenAmount(reward, decimals, 'tokens');

  return <div>{formatted}</div>;
}
```

**Before:**
```typescript
function formatReward(baseUnits: bigint, decimals: number): string {
  const amount = Number(baseUnits) / Math.pow(10, decimals);
  return `${amount.toFixed(2)} tokens`;
}
```

**Update components/asset/PriceChart.tsx:**

```typescript
import { fromBaseUnits } from 'lib/format';

function PriceChart({ prices, decimals }: Props) {
  const chartData = prices.map(price => ({
    ...price,
    // Single, canonical conversion
    display: fromBaseUnits(price.value, decimals),
  }));

  return <Chart data={chartData} />;
}
```

**Before:**
```typescript
function convertPrice(raw: number, decimals: number): number {
  return raw / (10 ** decimals);
}
```

#### Phase 3 - Create Tests (PR 3)

**Create lib/__tests__/format.test.ts:**

```typescript
import { 
  toBaseUnits, 
  fromBaseUnits, 
  formatTokenAmount, 
  parseAndValidateAmount 
} from '../format';

describe('Decimal Conversion', () => {
  it('converts display to base units', () => {
    expect(toBaseUnits('1.5', 6)).toBe(BigInt(1500000));
    expect(toBaseUnits('0.1', 8)).toBe(BigInt(10000000));
  });

  it('converts base units to display', () => {
    expect(fromBaseUnits(BigInt(1500000), 6)).toBe(1.5);
    expect(fromBaseUnits(1500000, 6)).toBe(1.5);
  });

  it('formats amount with symbol', () => {
    expect(formatTokenAmount(BigInt(1500000), 6, 'XLM')).toBe('1.5 XLM');
    expect(formatTokenAmount(1500000, 6, 'USD')).toBe('1.5 USD');
  });

  it('handles large numbers safely with BigInt', () => {
    const largeAmount = BigInt('999999999999999999');
    const display = fromBaseUnits(largeAmount, 18);
    expect(display).toBe(0.999999999999999999);
  });

  it('validates against max supply', () => {
    const max = BigInt(1000000);
    expect(() => 
      parseAndValidateAmount('2.0', 6, max)
    ).toThrow('Amount exceeds maximum');
  });

  it('throws on invalid input', () => {
    expect(() => toBaseUnits('not a number', 6)).toThrow('Invalid amount');
    expect(() => toBaseUnits('1.5', -1)).toThrow('Invalid decimals');
  });
});
```

#### Phase 4 - Add Precision Docs (PR 4)

**Create docs/DECIMAL_MATH.md:**

```markdown
# Decimal Math & Token Amount Conversion

## Overview

Blockchain token amounts use large integers (base units) with decimals specifying the decimal point position.

**Example:** 1.5 XLM with 6 decimals = 1500000 (base units)

## Functions

### toBaseUnits(displayAmount, decimals)
Converts user-facing amounts to blockchain base units.

```typescript
toBaseUnits('1.5', 6)  // → BigInt(1500000)
```

### fromBaseUnits(baseUnits, decimals)
Converts blockchain base units to display amounts.

```typescript
fromBaseUnits(1500000, 6)  // → 1.5
```

### formatTokenAmount(baseUnits, decimals, symbol?, maxDecimals?)
Formats amount for display with optional symbol.

```typescript
formatTokenAmount(1500000, 6, 'XLM')  // → "1.5 XLM"
```

## Why BigInt?

Blockchain amounts can exceed JavaScript's safe integer limit (2^53).

```typescript
// ❌ UNSAFE - precision loss
const baseUnits = Math.floor(1e18 * 1e18);  // loses precision

// ✅ SAFE - no precision loss
const baseUnits = BigInt(10) ** BigInt(36);  // exact
```

## Rules

1. **Always use canonical functions** - never inline decimal math
2. **Use BigInt for large amounts** - prevents overflow
3. **Validate user input** - catches invalid amounts early
4. **Test precision edge cases** - small amounts, 18+ decimals
```

### Checklist

- [ ] Extend lib/format.ts with toBaseUnits, fromBaseUnits, formatTokenAmount
- [ ] Audit all components for inline decimal math
- [ ] Update TransferPanel to use canonical conversion
- [ ] Update DistributionCard to use canonical formatting
- [ ] Update PriceChart to use canonical conversion
- [ ] Find and update all other decimal conversions
- [ ] Create comprehensive test suite (format.test.ts)
- [ ] Create docs/DECIMAL_MATH.md
- [ ] Verify no precision regressions

### Benefits

✅ Single source of truth for decimal math  
✅ Prevents precision bugs  
✅ Safe BigInt handling  
✅ Easier to audit & test  
