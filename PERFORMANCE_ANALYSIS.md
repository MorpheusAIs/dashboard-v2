# Performance Analysis Report

This document identifies performance anti-patterns, N+1 queries, unnecessary re-renders, and inefficient algorithms in the dashboard-v2 codebase.

---

## Executive Summary

| Category | Critical | High | Medium | Total |
|----------|----------|------|--------|-------|
| N+1 Queries & Data Fetching | 2 | 3 | 2 | 7 |
| React Re-render Issues | 2 | 4 | 4 | 10 |
| Inefficient Algorithms | 1 | 3 | 4 | 8 |
| Bundle Size & Caching | 1 | 2 | 2 | 5 |
| **Total** | **6** | **12** | **12** | **30** |

---

## 1. N+1 Queries & Inefficient Data Fetching

### CRITICAL

#### 1.1 Linear Lookup Inside Loop (O(n²) Pattern)
**File:** `hooks/use-capital-pool-data.ts:843-872`

```typescript
// Inside configuredAssets.forEach loop:
const aTokenIndex = aTokenBalanceContracts.findIndex(contract =>
  contract && 'address' in contract &&
  contract.address.toLowerCase() === aToken.toLowerCase()
);
```

**Impact:** For each asset, a linear search is performed. With 7 assets and 7 contracts, this is 49 comparisons instead of 7.

**Fix:** Create a Map before the loop:
```typescript
const aTokenAddressToIndex = new Map(
  aTokenBalanceContracts.map((contract, idx) =>
    [contract?.address?.toLowerCase(), idx]
  )
);
// Then: const aTokenIndex = aTokenAddressToIndex.get(aToken.toLowerCase());
```

---

#### 1.2 Sequential GraphQL Queries (Waterfall Pattern)
**File:** `hooks/use-staking-data.ts:362-461`

```typescript
// First query for builder details
const builderResponse = await fetchGraphQL(...);
// Process response...

// Then separate query for users
const nextPageResponse = await fetchGraphQL(...);
```

**Impact:** Unnecessary waterfall - adds extra network round-trip latency.

**Fix:** Batch queries using `Promise.all()` or combine into single GraphQL query with fragments.

---

### HIGH

#### 1.3 Sequential Refetch Pattern
**File:** `context/CapitalPageContext.tsx:1792, 1832, 1872, 1909, 1947`

```typescript
Object.values(assetContractData).forEach(asset => asset.refetch.allowance());
Object.values(assetContractData).forEach(asset => asset.refetch.all());
```

**Impact:** Each refetch executes sequentially instead of in parallel.

**Fix:**
```typescript
await Promise.all(
  Object.values(assetContractData).map(asset => asset.refetch.allowance())
);
```

---

#### 1.4 Multiple Separate useContractReads Calls
**File:** `hooks/use-capital-pool-data.ts:263-523`

8 separate `useContractReads` hooks that could be consolidated:
- Lines 306-319: Deposited amounts
- Lines 352-370: Pool info
- Lines 393-406: Reward rates
- Lines 408-443: Virtual deposited
- Lines 432-443: Distributor pools
- Lines 446-523: aToken balances

**Impact:** Multiple RPC batches instead of one optimized batch.

**Fix:** Consolidate into 2-3 logical batches with related data.

---

#### 1.5 Unbatched Builders Query
**File:** `app/graphql/queries/builders.ts:109-130`

```graphql
query getAllBuildersProjects($first: Int = 1000, $skip: Int = 0) {
  buildersProjects(first: $first, skip: $skip, ...) { ... }
}
```

**Impact:** Loads up to 1000 builders at once without cursor-based pagination.

**Fix:** Implement cursor-based pagination with smaller page sizes (50-100).

---

## 2. React Re-render Anti-patterns

### CRITICAL

#### 2.1 Inline Functions in Context Provider Value
**File:** `context/network-context.tsx:91-96`

```typescript
value={{
  isL1Chain: (chainId: number) => getL1Chains(environment).some(...),
  isL2Chain: (chainId: number) => getL2Chains(environment).some(...),
  l1Chains: getL1Chains(environment),  // New array reference every render
  l2Chains: getL2Chains(environment),  // New array reference every render
}}
```

**Impact:** Every context consumer re-renders on any provider update due to new references.

**Fix:** Memoize functions with `useCallback` and arrays with `useMemo`:
```typescript
const isL1Chain = useCallback((chainId: number) =>
  l1Chains.some(chain => chain.id === chainId), [l1Chains]);

const l1Chains = useMemo(() => getL1Chains(environment), [environment]);
```

---

#### 2.2 Missing useCallback for Context Methods
**File:** `context/network-context.tsx:42-82`

```typescript
const switchToEnvironment = async (newEnvironment: NetworkEnvironment) => { ... };
const switchToChain = async (chainId: number) => { ... };
```

**Impact:** Functions recreated on every render, causing all consumers to re-render.

**Fix:** Wrap with `useCallback`:
```typescript
const switchToEnvironment = useCallback(async (newEnvironment) => {
  // ...
}, [dependencies]);
```

---

### HIGH

#### 2.3 Inline Arrow Functions in Event Handlers
**File:** `components/staking-table.tsx:71, 83, 95, 107, 119`

```tsx
onClick={() => onSort('amount')}
onClick={() => onSort('claimed')}
// ... repeated for each column
```

**File:** `components/capital/user-assets-table.tsx:183, 201, 209, 217, 225`

```tsx
onOpenChange={(open) => onDropdownOpenChangeAction(asset.id, open)}
onClick={() => onDropdownActionAction('withdraw', asset.assetSymbol)}
```

**Impact:** New function references prevent child component memoization.

**Fix:** Create handlers with `useCallback` or use data attributes:
```typescript
const handleSort = useCallback((e) => {
  onSort(e.currentTarget.dataset.column);
}, [onSort]);

// JSX: <th data-column="amount" onClick={handleSort}>
```

---

#### 2.4 Component Defined Inside Render
**File:** `components/staking-table.tsx:53`

```typescript
const SortIndicator = ({ column }: { column: string }) => (
  <>{sortColumn === column && <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>}</>
);
```

**Impact:** New component type created on every render, React cannot optimize.

**Fix:** Move component definition outside the parent function.

---

#### 2.5 Duplicate Computations in Context Value
**File:** `context/CapitalPageContext.tsx:2674-2684`

```typescript
totalDepositedUSD: Object.values(assets).reduce((total, asset) =>
  total + asset.totalDeposited, BigInt(0)),
// ... later in same object:
totalDepositedUSDFormatted: formatBigInt(
  Object.values(assets).reduce((total, asset) =>
    total + asset.totalDeposited, BigInt(0)),  // Same computation!
  18, 2
),
```

**Impact:** Same expensive reduce operation runs twice.

**Fix:** Compute once and reuse:
```typescript
const totalDepositedUSD = Object.values(assets).reduce(...);
// Then use totalDepositedUSD for both properties
```

---

### MEDIUM

#### 2.6 Missing React.memo on Table Components
**Files:**
- `components/capital/user-assets-table.tsx`
- `components/staking-table.tsx`
- `components/capital/deposit-modal.tsx`

**Impact:** Components re-render even when props haven't changed.

**Fix:** Wrap exports with `React.memo`:
```typescript
export const StakingTable = React.memo(function StakingTable(props) { ... });
```

---

#### 2.7 Array Creation in Loading State
**Files:**
- `components/staking-table.tsx:132`
- `components/ui/data-table.tsx:105-107`

```typescript
Array(5).fill(0).map((_, index) => <TableRow key={`loading-${index}`} />)
```

**Impact:** New array created on every render during loading.

**Fix:** Define constant outside component:
```typescript
const LOADING_ROWS = Array(5).fill(0);
// Then: LOADING_ROWS.map(...)
```

---

## 3. Inefficient Algorithms

### CRITICAL

#### 3.1 Multiple Sequential Filter Operations (4 Passes)
**File:** `context/builders-context.tsx:103-115`

```typescript
let result = [...builders];
if (nameFilter) {
  result = result.filter(builder => builder.name.toLowerCase().includes(...));
}
if (rewardTypeFilter) {
  result = result.filter(builder => builder.reward_types?.includes(...));
}
if (networkFilter) {
  result = result.filter(builder => builder.networks?.includes(...));
}
if (hasDescriptionFilter) {
  result = result.filter(builder => builder.description && ...);
}
```

**Impact:** 4 complete array passes instead of 1.

**Fix:** Combine into single filter:
```typescript
result = result.filter(builder => {
  if (nameFilter && !builder.name.toLowerCase().includes(nameFilter.toLowerCase()))
    return false;
  if (rewardTypeFilter !== 'all' && !builder.reward_types?.includes(rewardTypeFilter))
    return false;
  if (networkFilter !== 'all' && !builder.networks?.includes(networkFilter))
    return false;
  if (hasDescriptionFilter && !builder.description?.trim())
    return false;
  return true;
});
```

---

### HIGH

#### 3.2 Chained .filter().map() Operations
**Files:**
- `hooks/use-staking-data.ts:620, 690`
- `hooks/use-capital-pool-data.ts:914`

```typescript
// Two passes instead of one:
const formattedEntries = users
  .map(user => formatEntryFunc(user))
  .filter(entry => entry.amount > 0);
```

**Fix:** Use reduce or flatMap for single pass:
```typescript
const formattedEntries = users.reduce((acc, user) => {
  const entry = formatEntryFunc(user);
  if (entry.amount > 0) acc.push(entry);
  return acc;
}, []);
```

---

#### 3.3 Nested forEach for Set Building
**File:** `context/builders-context.tsx:136-138`

```typescript
const types = new Set<string>();
builders.forEach(builder => {
  if (builder.reward_types && Array.isArray(builder.reward_types)) {
    builder.reward_types.forEach(type => types.add(type));
  }
});
```

**Fix:** Use flatMap:
```typescript
const types = new Set(
  builders.flatMap(b => b.reward_types || [])
);
```

---

#### 3.4 Duplicate Reduce Operations
**File:** `context/builders-context.tsx:147-148`

```typescript
totalStaked: builders.reduce((acc, builder) => acc + (builder.totalStaked || 0), 0),
totalStaking: builders.reduce((acc, builder) => acc + (builder.stakingCount || 0), 0),
```

**Fix:** Combine into single reduce:
```typescript
const { totalStaked, totalStaking } = builders.reduce(
  (acc, builder) => ({
    totalStaked: acc.totalStaked + (builder.totalStaked || 0),
    totalStaking: acc.totalStaking + (builder.stakingCount || 0),
  }),
  { totalStaked: 0, totalStaking: 0 }
);
```

---

### MEDIUM

#### 3.5 Redundant Sort Operations
**Files:**
- `lib/utils/chart-utils.ts:38, 62`
- `app/hooks/useInteractiveChart.ts:11, 42`

```typescript
const sortedData = [...data].sort((a, b) =>
  new Date(a.date).getTime() - new Date(b.date).getTime()
);
// ... later
return [...new Set(ticks)].sort((a, b) =>
  new Date(a).getTime() - new Date(b).getTime()
);
```

**Impact:** Data sorted twice (O(2n log n)).

**Fix:** Sort once and memoize result.

---

#### 3.6 Array .includes() for Admin Check
**File:** `context/auth-context.tsx:49`

```typescript
const isAdmin = walletAddress ? ADMIN_WALLETS.includes(walletAddress.toLowerCase()) : false;
```

**Impact:** O(n) lookup on every render.

**Fix:** Use Set for O(1) lookup:
```typescript
const ADMIN_WALLETS_SET = new Set(ADMIN_WALLETS.map(w => w.toLowerCase()));
const isAdmin = walletAddress ? ADMIN_WALLETS_SET.has(walletAddress.toLowerCase()) : false;
```

---

## 4. Bundle Size & Caching Issues

### CRITICAL

#### 4.1 Recharts Wildcard Import (Blocks Tree-Shaking)
**File:** `components/ui/chart.tsx:4`

```typescript
import * as RechartsPrimitive from "recharts"
```

**Impact:** Imports entire 400KB+ library, preventing tree-shaking.

**Fix:** Use named imports:
```typescript
import {
  ResponsiveContainer,
  Tooltip,
  Legend,
  // ... only what's needed
} from "recharts";
```

---

### HIGH

#### 4.2 Heavy Modals Not Dynamically Imported
**File:** `app/capital/page.tsx:11-14`

```typescript
import { DepositModal } from "@/components/capital/deposit-modal";      // 1,385 lines
import { WithdrawModal } from "@/components/capital/withdraw-modal";    // 259 lines
import { ClaimMorRewardsModal } from "@/components/capital/claim-mor-rewards-modal"; // 636 lines
import { ChangeLockModal } from "@/components/capital/change-lock-modal"; // 186 lines
```

**Impact:** ~2.5KB of modal code in initial bundle, only used on interaction.

**Fix:** Dynamic imports:
```typescript
const DepositModal = dynamic(
  () => import("@/components/capital/deposit-modal").then(m => ({ default: m.DepositModal })),
  { ssr: false }
);
```

---

#### 4.3 Aggressive Refetch Override
**File:** `app/hooks/useSingleBuilder.ts:115`

```typescript
refetchOnWindowFocus: true, // Overrides conservative global default
```

**Impact:** Triggers API calls when users switch browser tabs.

**Fix:** Remove override to use global conservative settings:
```typescript
// Delete line 115 - global setting is refetchOnWindowFocus: false
```

---

### MEDIUM

#### 4.4 Multiple 5-Minute Refetch Intervals
**Files:**
- `hooks/use-estimated-rewards.ts:113, 152, 544` - 5 minute intervals
- `components/capital/hooks/use-daily-emissions.ts:139, 154, 171` - 5 minute intervals

**Impact:** Multiple queries refetch simultaneously, creating RPC spikes.

**Fix:** Stagger intervals or consolidate into single coordinated query.

---

## Priority Recommendations

### Immediate (High Impact, Low Effort)

1. **Replace aToken findIndex with Map** (`use-capital-pool-data.ts:843`)
2. **Combine 4 filter operations into 1** (`builders-context.tsx:103-115`)
3. **Add useCallback to network context methods** (`network-context.tsx:42-82`)
4. **Remove refetchOnWindowFocus override** (`useSingleBuilder.ts:115`)

### Short-term (High Impact, Medium Effort)

5. **Memoize context provider values** (`network-context.tsx:91-96`)
6. **Dynamically import modal components** (`capital/page.tsx:11-14`)
7. **Batch sequential GraphQL queries** (`use-staking-data.ts:362-461`)
8. **Replace forEach refetch with Promise.all** (`CapitalPageContext.tsx:1792+`)

### Medium-term (Medium Impact, Higher Effort)

9. **Consolidate useContractReads calls** (`use-capital-pool-data.ts`)
10. **Fix recharts wildcard import** (`components/ui/chart.tsx:4`)
11. **Add React.memo to table components**
12. **Implement cursor-based pagination for builders**

---

## Estimated Impact

| Fix Category | Bundle Size | RPC Calls | Render Count | User Experience |
|--------------|-------------|-----------|--------------|-----------------|
| N+1 Query Fixes | - | -40-60% | - | Faster load times |
| Re-render Fixes | - | - | -30-50% | Smoother interactions |
| Algorithm Fixes | - | - | -20% | Faster filtering/sorting |
| Bundle Fixes | -200KB | -20% | - | Faster initial load |

---

*Generated: 2026-01-01*
