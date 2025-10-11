# APR Calculation: Complete Implementation Guide

## Table of Contents
1. [Overview](#overview)
2. [Documentation References](#documentation-references)
3. [Developer Feedback](#developer-feedback)
4. [Implementation: Option A (distributedRewards-based)](#implementation-option-a)
5. [Critical Fixes Applied](#critical-fixes-applied)
6. [Code Changes](#code-changes)
7. [Testing & Verification](#testing--verification)

---

## Overview

This document details the complete implementation of accurate APR calculation for the Morpheus Capital page, using a 7-day historical window with `distributedRewards` deltas to determine protocol-truth pool shares.

### Key Results
- **USDC**: 11.97% APR ✅
- **USDT**: 13.68% APR ✅
- **wETH**: 5.92% APR ✅
- **wBTC**: 0.01% APR (working but low)
- **stETH**: N/A (requires further debugging)

---

## Documentation References

### Morpheus Protocol Documentation
1. **Protocol Yield Generation**
   - https://gitbook.mor.org/smart-contracts/documentation/distribution-protocol/v7-protocol/guides/protocol-yield-generation
   - Key insight: "we calculate APR related to a specific asset TVL and its share in the total emission pool"
   - "The difference is in generated yield. For example, USDT generates 4.8% yield on AAVE and wETH generates 1.6%"

2. **MOR Distribution (Step 1)**
   - https://gitbook.mor.org/smart-contracts/documentation/distribution-protocol/v7-protocol/guides/mor-distribution.-step-1
   - Details the reward distribution mechanism based on yield contributions

3. **LinearDistributionIntervalDecrease**
   - https://gitbook.mor.org/smart-contracts/documentation/distribution-protocol/v7-protocol/contracts/libs/lineardistributionintervaldecrease#getperiodreward
   - `getPeriodReward` function for decay-aware emissions calculation

---

## Developer Feedback

### Feedback #1: Decay-Aware Emissions
**From**: Smart contract developer  
**Context**: Discussion on emission calculation

> "This appears to be a viable option:
> 1) The MOR emission should be calculated at the time of calculation from the current time and for the coming year, rather than taking a fixed value and multiplying it by 365.
> 2) Yield should be calculated for the entire year, rather than on a daily basis.
> 3) Essentially, if there is a deposit in the pool, then the APR can be calculated."

**Follow-up Q&A**:
- **Q**: "How do we project for the coming year if not multiplying by 365?"
- **A**: "You can calculate MOR emission for the period, take it from now + 1 year. Use `getPeriodReward` from LinearDistributionIntervalDecrease. What I mean is that if you have an annual MOR emission, you can calculate the yield of the pool in MOR for the year, rather than for the day. `pool_share * year_emission = pool_mor_year_yield`"

### Feedback #2: Historical Window for Stability
**Context**: User observed high APR volatility with short-term yield deltas

**Decision**: Use 7-day historical window instead of `lastUpdate` timestamp to calculate more stable yield deltas:
- More reliable yield data over longer period
- Smooths out short-term variations
- Provides better APR stability

### Feedback #3: Protocol-Truth via distributedRewards
**Context**: Annualized 7-day yield deltas resulted in "same APR for every asset"

**Root cause**: Yield deltas were proportional to TVL, causing pool shares to cancel out TVL in the APR formula.

**Solution**: Use `Distributor.distributedRewards(pool=0, depositPool)` deltas as the authoritative source for pool shares, as this directly reflects how the protocol actually distributes rewards.

---

## Implementation: Option A

### Concept
Instead of calculating pool shares from annualized yield deltas, we use the protocol's own record of distributed rewards over a 7-day window.

### Formula

```typescript
// Step 1: Calculate distributedRewards delta for each asset
delta_i = distributedRewards(now)_i - distributedRewards(~7d ago)_i

// Step 2: Calculate pool share
poolShare_i = delta_i / Σ(all deltas)

// Step 3: Calculate annual MOR rewards for asset
annualRewardsMOR_i = poolShare_i × annualEmissionsMOR

// Step 4: Calculate APR
APR% = (annualRewardsMOR_i × MOR_price) / (actualTVL_i × assetUSDPrice_i) × 100
```

### Key Components

#### 1. Historical Block Discovery (7-day window)
```typescript
const WINDOW_DAYS = 7;
const [pastBlockNumber, setPastBlockNumber] = useState<bigint | null>(null);
const [pastBlockTimestamp, setPastBlockTimestamp] = useState<number | null>(null);

const publicClient = usePublicClient({ chainId: l1ChainId });
const pastBlockLoadedRef = useRef(false);

useEffect(() => {
  let cancelled = false;
  (async () => {
    try {
      if (!publicClient || pastBlockLoadedRef.current) return;
      const latest = await publicClient.getBlock();
      const latestNum = BigInt(latest.number);
      const targetTs = Math.floor(Date.now() / 1000) - WINDOW_DAYS * 24 * 60 * 60;
      const est = latestNum - BigInt(Math.floor((WINDOW_DAYS * 24 * 60 * 60) / 12));
      
      // Binary search for target block
      let low = est > 0n ? est : 0n;
      let high = latestNum;
      for (let i = 0; i < 18; i++) {
        const mid = (low + high) / 2n;
        const blk = await publicClient.getBlock({ blockNumber: mid });
        if (Number(blk.timestamp) >= targetTs) high = mid; else low = mid;
      }
      
      if (cancelled) return;
      const past = await publicClient.getBlock({ blockNumber: high });
      setPastBlockNumber(prev => (prev !== high ? high : prev));
      setPastBlockTimestamp(prev => (prev !== Number(past.timestamp) ? Number(past.timestamp) : prev));
      pastBlockLoadedRef.current = true;
      
      console.log('🕰️ [HIST] Past block (≈7d):', { 
        block: high.toString(), 
        ts: Number(past.timestamp) 
      });
    } catch (e) {
      console.warn('⚠️ [HIST] Unable to fetch past block (archive RPC required)', (e as Error).message);
    }
  })();
  return () => { cancelled = true; };
}, [publicClient, WINDOW_DAYS]);
```

#### 2. Decay-Aware Annual Emissions
```typescript
// getPeriodReward TS helper (linear decrease per interval)
const getPeriodReward = useCallback((
  initialAmount: bigint,
  decreaseAmount: bigint,
  payoutStart: bigint,
  interval: bigint,
  startTime: bigint,
  endTime: bigint,
): bigint => {
  if (endTime <= startTime) return BigInt(0);
  if (endTime <= payoutStart) return BigInt(0);

  const one = BigInt(1);
  const i0 = payoutStart;
  const intv = interval === BigInt(0) ? BigInt(1) : interval;

  const startIdx = startTime > i0 ? (startTime - i0) / intv : BigInt(0);
  const endIdxRaw = (endTime - i0 - one) / intv;
  if (endIdxRaw < BigInt(0)) return BigInt(0);

  let first = initialAmount - decreaseAmount * startIdx;
  if (first <= BigInt(0)) return BigInt(0);

  let last = initialAmount - decreaseAmount * endIdxRaw;
  if (last < BigInt(0)) {
    const maxIdx = initialAmount / (decreaseAmount === BigInt(0) ? BigInt(1) : decreaseAmount);
    const clampedEndIdx = maxIdx > BigInt(0) ? maxIdx - BigInt(1) : BigInt(0);
    last = initialAmount - decreaseAmount * clampedEndIdx;
    if (clampedEndIdx < startIdx) return BigInt(0);
    first = initialAmount - decreaseAmount * startIdx;
  }

  const n = (endIdxRaw - startIdx + BigInt(1));
  return n * (first + last) / BigInt(2);
}, []);

// Compute annual emissions from RewardPoolV2 schedule
useEffect(() => {
  try {
    if (!scheduleResults || scheduleResults.length === 0) return;
    const res = scheduleResults[0];
    if (!res || (res as any).status !== 'success' || !Array.isArray((res as any).result)) return;
    
    type RewardPoolTuple = readonly [bigint, bigint, bigint, bigint, boolean];
    const tuple = (res as { result: RewardPoolTuple }).result;
    const payoutStart = tuple[0];
    const decreaseInterval = tuple[1];
    const initialReward = tuple[2];
    const rewardDecrease = tuple[3];

    setIsLoadingAnnualEmissions(true);
    const now = BigInt(Math.floor(Date.now() / 1000));
    const oneYear = BigInt(365 * 24 * 60 * 60);
    const end = now + oneYear;
    
    const periodReward = getPeriodReward(
      initialReward, 
      rewardDecrease, 
      payoutStart, 
      decreaseInterval, 
      now, 
      end
    );
    const annual = Number(formatUnits(periodReward, 18));
    setAnnualEmissions(annual);
    setAnnualEmissionsError(null);
    setIsLoadingAnnualEmissions(false);

    console.log('📆 [EMISSIONS] Annual emissions (decay-aware):', {
      annualEmissionsMOR: annual,
    });
  } catch (e) {
    console.error('❌ [EMISSIONS] Failed to compute annual emissions:', e);
    setAnnualEmissionsError((e as Error).message);
    setIsLoadingAnnualEmissions(false);
  }
}, [scheduleResults, getPeriodReward]);
```

#### 3. distributedRewards Contract Reads (Current & Historical)

**CRITICAL**: Pass `blockNumber` at TOP LEVEL of `useContractReads`, NOT in individual contract objects!

```typescript
// Current distributedRewards
const distributedRewardsContracts = useMemo(() => {
  if (!distributorV2Address) return [];
  return configuredAssets
    .filter((assetConfig) => depositPoolAddresses[assetConfig.metadata.symbol])
    .map((assetConfig) => ({
      address: distributorV2Address,
      abi: DistributorV2Abi,
      functionName: 'distributedRewards',
      args: [BigInt(0), depositPoolAddresses[assetConfig.metadata.symbol]!],
      chainId: l1ChainId,
      // ❌ DO NOT put blockNumber here!
    }));
}, [configuredAssets, depositPoolAddresses, distributorV2Address, l1ChainId]);

const { data: distributedRewardsNow } = useContractReads({
  contracts: distributedRewardsContracts as any,
  allowFailure: true,
  query: { enabled: distributedRewardsContracts.length > 0 },
});

// Historical distributedRewards (~7d ago)
const distributedRewardsContractsPast = useMemo(() => {
  if (!distributorV2Address || pastBlockNumber == null) return [];
  return configuredAssets
    .filter((assetConfig) => depositPoolAddresses[assetConfig.metadata.symbol])
    .map((assetConfig) => ({
      address: distributorV2Address,
      abi: DistributorV2Abi,
      functionName: 'distributedRewards',
      args: [BigInt(0), depositPoolAddresses[assetConfig.metadata.symbol]!],
      chainId: l1ChainId,
      // ❌ DO NOT put blockNumber here!
    }));
}, [configuredAssets, depositPoolAddresses, distributorV2Address, l1ChainId, pastBlockNumber]);

const { data: distributedRewardsPast } = useContractReads({
  contracts: distributedRewardsContractsPast as any,
  allowFailure: true,
  blockNumber: pastBlockNumber ?? undefined, // ✅ Pass blockNumber HERE!
  query: { enabled: distributedRewardsContractsPast.length > 0 && !!pastBlockNumber },
});
```

#### 4. Pool Share Calculation from distributedRewards Deltas
```typescript
// Inside calculateV7APR useMemo:

// Compute protocol-truth shares from distributedRewards deltas (7d window)
let rewardsShareByAsset: Record<string, number> | null = null;
if (distributedRewardsNow && distributedRewardsPast && distributedRewardsNow.length === configuredAssets.length) {
  const deltas: number[] = configuredAssets.map((assetConfig, i) => {
    const nowVal = distributedRewardsNow?.[i]?.status === 'success' 
      ? Number(formatUnits(distributedRewardsNow[i].result as bigint, 18)) 
      : 0;
    const pastVal = distributedRewardsPast?.[i]?.status === 'success' 
      ? Number(formatUnits(distributedRewardsPast[i].result as bigint, 18)) 
      : 0;
    return Math.max(0, nowVal - pastVal);
  });
  
  const totalDelta = deltas.reduce((a, b) => a + b, 0);
  
  if (totalDelta > 0) {
    rewardsShareByAsset = {};
    configuredAssets.forEach((assetConfig, i) => {
      rewardsShareByAsset![assetConfig.metadata.symbol] = deltas[i] / totalDelta;
    });
    console.log('✅ [APR CALC] Using distributedRewards-based distribution');
  }
}

const useRewardsShares = !!rewardsShareByAsset;
```

#### 5. APR Calculation with Protocol Shares
```typescript
Object.entries(assetYields).forEach(([symbol, assetYieldUSD]) => {
  const rateData = rewardPoolRateData[symbol as keyof typeof rewardPoolRateData];
  
  if (!rateData?.data || !Array.isArray(rateData.data)) {
    aprResults[symbol] = 'N/A';
    return;
  }

  const [, , totalVirtualDeposited] = rateData.data;
  const assetConfig = configuredAssets.find(config => config.metadata.symbol === symbol);
  const decimals = assetConfig?.metadata.decimals || 18;
  
  // Get actual deposited amount (not virtual)
  const contract = contractData[symbol as keyof typeof contractData];
  const totalActualDeposited = contract?.data 
    ? Number(formatUnits(contract.data as bigint, decimals))
    : 0;
  
  const tvlForAPR = totalActualDeposited > 0 ? totalActualDeposited : totalVirtual;
  
  // Get asset price from Distributor
  const distributorPoolResult = distributorPoolResults?.find((_, idx) => 
    configuredAssets[idx]?.metadata.symbol === symbol
  );
  const assetPriceUSD = distributorPoolResult?.status === 'success' && Array.isArray(distributorPoolResult.result)
    ? Number(formatUnits(distributorPoolResult.result[2] as bigint, 18))
    : 1.0;
  
  if (tvlForAPR > 0 && annualEmissionsMOR && annualEmissionsMOR > 0) {
    // Use distributedRewards share if available, otherwise fall back to yield share
    const share = useRewardsShares 
      ? (rewardsShareByAsset![symbol] ?? 0) 
      : (assetYieldUSD / totalYieldUSD);
    
    const assetAnnualShareMOR = share * annualEmissionsMOR;
    
    // Calculate APR in USD terms with MOR price
    let aprPercentage: number;
    if (morPriceOption && morPriceOption > 0) {
      const annualRewardsUSD = assetAnnualShareMOR * morPriceOption;
      const tvlUSD = tvlForAPR * assetPriceUSD;
      aprPercentage = (annualRewardsUSD / tvlUSD) * 100;
    } else {
      // Fallback: APR in MOR terms
      aprPercentage = (assetAnnualShareMOR / tvlForAPR) * 100;
    }
    
    aprResults[symbol] = aprPercentage > 0.01 ? `${aprPercentage.toFixed(2)}%` : 'N/A';
    
    console.log(`✅ [APR CALC] ${symbol} - REAL YIELD-BASED APR:`, {
      poolShare: (share * 100).toFixed(2) + '%',
      annualRewardsMOR: assetAnnualShareMOR.toFixed(2) + ' MOR/year',
      morPrice: morPriceOption || 'not provided',
      tvlUSD: (tvlForAPR * assetPriceUSD).toFixed(2),
      finalAPR: aprResults[symbol],
      calculationMethod: morPriceOption ? 'USD-based (actual capital)' : 'MOR-based fallback'
    });
  }
});
```

---

## Critical Fixes Applied

### Fix #1: Wagmi Config - Explicit Alchemy Transport

**File**: `config/index.tsx`

**Problem**: Wagmi was using default public RPCs which don't support archive state reads.

**Solution**: Explicitly configure transports to force Alchemy RPC for mainnet.

```typescript
import { defaultWagmiConfig } from '@web3modal/wagmi/react/config';
import { cookieStorage, createStorage, http } from 'wagmi';
import { mainnet, arbitrum, base, arbitrumSepolia, sepolia } from 'wagmi/chains';

export const getWagmiConfig = () => {
  const chains = [mainnet, arbitrum, base, arbitrumSepolia, sepolia] as const;

  return defaultWagmiConfig({
    chains,
    projectId,
    metadata,
    ssr: true,
    storage: createStorage({
      storage: cookieStorage
    }),
    // ✅ CRITICAL: Explicitly configure transports to use Alchemy for mainnet (archive RPC)
    transports: {
      [mainnet.id]: http('https://eth-mainnet.g.alchemy.com/v2/ZuAAStm6GwtaIo5vTSy9a'),
      [arbitrum.id]: http(),
      [base.id]: http(),
      [arbitrumSepolia.id]: http(),
      [sepolia.id]: http(),
    },
    enableCoinbase: true,
    auth: {
      showWallets: true,
      walletFeatures: true,
      email: false,
      socials: [],
    },
    enableWalletConnect: true,
    enableInjected: true,
    enableEIP6963: true,
    pollingInterval: 4000,
  });
};

export const config = getWagmiConfig();
```

### Fix #2: API Default to Mainnet

**File**: `app/api/daily-emissions/route.ts`

**Problem**: API returned error when `networkEnv` param was missing.

**Solution**: Default to mainnet and accept both param names.

```typescript
export async function GET(request: NextRequest) {
  try {
    console.log('🎯 [DAILY EMISSIONS API] Starting daily emissions fetch...');

    // Get network environment from query params, default to mainnet for safety
    const searchParams = request.nextUrl.searchParams;
    const networkEnvParam = searchParams.get('networkEnv') || searchParams.get('network');
    const networkEnv = (networkEnvParam === 'testnet' ? 'testnet' : 'mainnet') as NetworkEnvironment;

    console.log('🌐 [DAILY EMISSIONS API] Network environment:', {
      param: networkEnvParam,
      resolved: networkEnv
    });

    // ... rest of handler
  } catch (error) {
    // ... error handling
  }
}
```

### Fix #3: Stale Price Cache Cleanup

**File**: `context/CapitalPageContext.tsx`

**Problem**: Old MOR price (0.086) was cached, causing incorrect APR calculations.

**Solution**: Clear stale cache on mount.

```typescript
// --- Clear Stale Price Cache on Mount ---
useEffect(() => {
  if (typeof window === 'undefined') return;
  
  try {
    const cached = localStorage.getItem('morpheus_token_prices');
    if (cached) {
      const parsed = JSON.parse(cached);
      
      // If MOR price is suspiciously low (< $0.50), clear the cache
      if (parsed.morPrice && parsed.morPrice < 0.5) {
        console.log('🧹 Clearing stale price cache (morPrice too low):', parsed.morPrice);
        localStorage.removeItem('morpheus_token_prices');
      }
      
      // If cache is older than 24 hours, clear it
      const cacheAge = Date.now() - (parsed.timestamp || 0);
      const oneDayMs = 24 * 60 * 60 * 1000;
      if (cacheAge > oneDayMs) {
        console.log('🧹 Clearing expired price cache (age: ' + Math.floor(cacheAge / 1000 / 60 / 60) + 'h)');
        localStorage.removeItem('morpheus_token_prices');
      }
    }
  } catch (error) {
    console.warn('Error checking price cache:', error);
  }
}, []); // Run once on mount

// --- Get MOR Price for APR Calculation ---
const { morPrice } = useTokenPrices({
  isInitialLoad: true,
  shouldRefreshData: false,
  userAddress: undefined,
  networkEnv: networkEnv
});

// --- Pool Data Hook with Refetch Functions ---
const capitalPoolData = useCapitalPoolData({ morPrice: morPrice || undefined });
```

### Fix #4: Pass MOR Price to useCapitalPoolData

**File**: `hooks/use-capital-pool-data.ts`

**Problem**: APR calculation wasn't receiving MOR price for USD-based APR.

**Solution**: Accept `morPrice` via options parameter.

```typescript
export interface CapitalPoolDataOptions {
  morPrice?: number | null; // MOR price for APR calculation in USD terms
}

export function useCapitalPoolData(options?: CapitalPoolDataOptions): CapitalPoolData {
  const { morPrice: morPriceOption } = options || {};
  
  console.log('🔍 [useCapitalPoolData] Received options:', {
    morPrice: morPriceOption,
    hasOptions: !!options,
    optionsKeys: options ? Object.keys(options) : []
  });
  
  // ... use morPriceOption in APR calculation
}
```

### Fix #5: Historical Reads - Top-Level blockNumber

**File**: `hooks/use-capital-pool-data.ts`

**Problem**: `blockNumber` was passed in individual contract objects, causing archive reads to fail.

**Solution**: Pass `blockNumber` at top level of `useContractReads`.

```typescript
// ❌ WRONG:
const distributedRewardsContractsPast = useMemo(() => {
  return configuredAssets.map((assetConfig) => ({
    address: distributorV2Address,
    abi: DistributorV2Abi,
    functionName: 'distributedRewards',
    args: [BigInt(0), depositPoolAddresses[assetConfig.metadata.symbol]!],
    chainId: l1ChainId,
    blockNumber: pastBlockNumber, // ❌ Don't do this!
  }));
}, [...]);

// ✅ CORRECT:
const distributedRewardsContractsPast = useMemo(() => {
  return configuredAssets.map((assetConfig) => ({
    address: distributorV2Address,
    abi: DistributorV2Abi,
    functionName: 'distributedRewards',
    args: [BigInt(0), depositPoolAddresses[assetConfig.metadata.symbol]!],
    chainId: l1ChainId,
    // ✅ No blockNumber here
  }));
}, [...]);

const { data: distributedRewardsPast } = useContractReads({
  contracts: distributedRewardsContractsPast as any,
  allowFailure: true,
  blockNumber: pastBlockNumber ?? undefined, // ✅ Pass it HERE!
  query: { enabled: distributedRewardsContractsPast.length > 0 && !!pastBlockNumber },
});
```

### Fix #6: Loading Gates for Historical Data

**File**: `hooks/use-capital-pool-data.ts`

**Problem**: APR calculation was running before historical data was ready.

**Solution**: Add comprehensive loading checks.

```typescript
const calculateV7APR = useMemo(() => {
  // ⏳ CHECK #1: Wait for historical data
  if (pastBlockNumber == null || pastBlockTimestamp == null) {
    console.log('⏳ [APR CALC] Waiting for past block discovery (7d window)');
    return null;
  }
  
  if (!distributorPoolResultsPast || distributorPoolResultsPast.length === 0) {
    console.log('⏳ [APR CALC] Waiting for distributor past snapshots...');
    return null;
  }
  
  if (!distributedRewardsNow || !distributedRewardsPast) {
    console.log('⏳ [APR CALC] Waiting for distributed rewards data...');
    return null;
  }
  
  if (!annualEmissions || isLoadingAnnualEmissions) {
    console.log('⏳ [APR CALC] Waiting for annual emissions...', {
      annualEmissions,
      isLoadingAnnualEmissions,
      error: annualEmissionsError
    });
    return null;
  }

  const annualEmissionsMOR = annualEmissions;
  
  // ... proceed with calculation
}, [
  // ... dependencies including all historical data
  distributorPoolResultsPast,
  distributedRewardsNow,
  distributedRewardsPast,
  annualEmissions,
  isLoadingAnnualEmissions,
  annualEmissionsError,
  pastBlockNumber,
  pastBlockTimestamp,
  morPriceOption
]);
```

---

## Code Changes

### Files Modified

1. **`config/index.tsx`**
   - Added explicit transport configuration for Alchemy RPC

2. **`app/api/daily-emissions/route.ts`**
   - Default to mainnet, accept multiple param names

3. **`context/CapitalPageContext.tsx`**
   - Added stale price cache cleanup
   - Pass MOR price to useCapitalPoolData

4. **`hooks/use-capital-pool-data.ts`**
   - Added historical block discovery (7-day window)
   - Added decay-aware annual emissions calculation
   - Added distributedRewards contract reads (current & past)
   - Added historical aToken balance reads
   - Added historical distributor pool reads
   - Updated calculateV7APR with loading gates
   - Implemented distributedRewards-based pool share calculation
   - Added comprehensive dependency array
   - Changed `apy` to `apr` in all return objects

### Interface Changes

```typescript
// OLD:
export interface AssetPoolData {
  totalStaked: string;
  apy: string;
  isLoading: boolean;
  error: Error | null;
}

export function useCapitalPoolData(): CapitalPoolData {
  // ...
}

// NEW:
export interface AssetPoolData {
  totalStaked: string;
  apr: string; // Renamed from 'apy'
  isLoading: boolean;
  error: Error | null;
  aprLoading?: boolean; // Added separate loading state
}

export interface CapitalPoolDataOptions {
  morPrice?: number | null; // NEW: MOR price for APR calculation
}

export function useCapitalPoolData(options?: CapitalPoolDataOptions): CapitalPoolData {
  // ...
}
```

---

## Testing & Verification

### Console Logs to Check

1. **Historical Block Discovery**:
   ```
   🕰️ [HIST] Past block (≈7d): { block: '23503341', ts: 1759567967 }
   ```

2. **Annual Emissions**:
   ```
   📆 [EMISSIONS] Annual emissions (decay-aware): {
     payoutStart: ...,
     decreaseInterval: ...,
     initialReward: ...,
     rewardDecrease: ...,
     annualEmissionsMOR: 1130952.23
   }
   ```

3. **distributedRewards Usage**:
   ```
   ✅ [APR CALC] Using distributedRewards-based distribution
   ```

4. **Per-Asset APR**:
   ```
   ✅ [APR CALC] USDC - REAL YIELD-BASED APR: {
     poolShare: '16.07%',
     annualRewardsMOR: '181753.88 MOR/year',
     morPrice: 3.7,
     tvlUSD: '4871.86',
     finalAPR: '11.97%',
     calculationMethod: 'USD-based (actual capital)'
   }
   ```

### Manual Verification Steps

1. **Test Archive RPC**:
   ```javascript
   await publicClient.getBlock({ blockNumber: 12345678n })
   // Should return block data, not error
   ```

2. **Check MOR Price**:
   ```javascript
   JSON.parse(localStorage.getItem('morpheus_token_prices')||'{}').morPrice
   // Should return ~3-4, not 0.086
   ```

3. **Verify API**:
   ```javascript
   await fetch('/api/daily-emissions?network=mainnet').then(r=>r.json())
   // Should return { success: true, dailyEmissions: <number> }
   ```

4. **Check Network Tab**:
   - Filter by `eth_call`
   - Verify requests for:
     - `distributorV2.depositPools` (current)
     - `distributorV2.depositPools` (with blockNumber parameter for past)
     - `distributorV2.distributedRewards` (current)
     - `distributorV2.distributedRewards` (with blockNumber parameter for past)
     - `aToken.balanceOf` (for AAVE assets, current & past)

### Expected Results

| Asset | Expected APR | Status |
|-------|--------------|--------|
| USDC  | ~11.97%      | ✅ Working |
| USDT  | ~13.68%      | ✅ Working |
| wETH  | ~5.92%       | ✅ Working |
| wBTC  | ~0.01%       | ✅ Working (low but correct) |
| stETH | TBD          | ⚠️ Requires debugging |

---

## Known Issues & Next Steps

### Issue: stETH showing N/A

**Possible causes**:
1. Strategy enum mismatch (0 = NO_YIELD vs expected)
2. Zero `distributedRewards` delta over 7-day window
3. Rebase calculation needs adjustment

**Debugging steps**:
1. Check console for `📊 NO_YIELD STRATEGY [stETH]` logs
2. Verify `distributedRewards` deltas are non-zero
3. Check `lastUnderlyingBalance` delta over 7 days

**Potential solutions**:
- Extend window to 14 or 30 days for rebasing tokens
- Use different calculation method for NO_YIELD strategy
- Fall back to yield-based share for stETH only

---

## Summary

This implementation successfully calculates accurate APR values for most assets using:
- **Protocol-truth**: `distributedRewards` deltas as authoritative pool shares
- **Decay-aware emissions**: `getPeriodReward` for accurate annual MOR emissions
- **Historical window**: 7-day lookback for stable calculations
- **Archive RPC**: Alchemy configured for historical state reads
- **USD-denominated APR**: Using live MOR price from DefiLlama

The system is modular, well-logged, and follows the Morpheus v7 protocol specifications as documented in the official GitBook.

