# Capital Page APR Calculation - Technical Reference

This document provides a comprehensive technical reference for how APR (Annual Percentage Rate) calculations are performed on the `/capital` page, specifically for the assets panel that displays total amount staked and APR for each asset.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Smart Contract Functions](#smart-contract-functions)
4. [APR Calculation Formula](#apr-calculation-formula)
5. [Daily Emissions Calculation](#daily-emissions-calculation)
6. [Weighted Average APR](#weighted-average-apr)
7. [Data Flow Diagram](#data-flow-diagram)
8. [Asset Configuration](#asset-configuration)
9. [Price Data Sources](#price-data-sources)
10. [Special Cases & Edge Handling](#special-cases--edge-handling)
11. [Key Files Reference](#key-files-reference)

---

## Overview

The Capital page displays APR for multiple yield-generating assets. The APR calculation uses:

- **Real yield tracking** from the DistributorV2 contract
- **Annual emissions** computed from the RewardPoolV2 emission schedule
- **Historical 7-day window** for stable yield delta calculations
- **Protocol-truth pool shares** from `distributedRewards` deltas

**Key Insight**: APR is calculated based on the proportional yield each asset generates, which determines its share of the total MOR rewards.

---

## Architecture

### Primary Hook: `useCapitalPoolData`

**Location**: `/hooks/use-capital-pool-data.ts`

This is the main APR calculation engine. It:

1. Fetches emission schedule from RewardPoolV2
2. Discovers a historical block (~7 days ago) via archive RPC
3. Calculates yield deltas for each asset
4. Computes pool shares based on yield contribution
5. Returns APR for each configured asset

### Supporting Hooks

| Hook | Location | Purpose |
|------|----------|---------|
| `useDailyEmissions` | `/components/capital/hooks/use-daily-emissions.ts` | User's daily MOR emissions |
| `useCapitalMetrics` | `/app/hooks/useCapitalMetrics.ts` | Aggregated metrics including weighted average APR |
| `useTokenPrices` | `/components/capital/hooks/use-token-prices.ts` | Asset and MOR price data |

---

## Smart Contract Functions

### RewardPoolV2 Contract

**ABI**: `/app/abi/RewardPoolV2.json`

#### `rewardPools(uint256 index)`

Returns the emission schedule for a reward pool.

```solidity
function rewardPools(uint256 index) external view returns (
    uint128 payoutStart,      // When rewards started
    uint128 decreaseInterval, // Time between reward decreases
    uint256 initialReward,    // Initial reward amount per interval
    uint256 rewardDecrease,   // Amount reward decreases each interval
    bool isPublic             // Whether pool is public
);
```

**Usage**: Called with `index = 0` (Capital pool) to get the emission schedule.

#### `getPeriodRewards(uint256 index, uint128 startTime, uint128 endTime)`

Returns total rewards for a specific time period.

```solidity
function getPeriodRewards(
    uint256 index_,
    uint128 startTime_,
    uint128 endTime_
) external view returns (uint256);
```

**Usage**: Called to get 24-hour total rewards for daily emissions calculation.

---

### DistributorV2 Contract

**ABI**: `/app/abi/DistributorV2.json`

#### `depositPools(uint256 rewardPoolIndex, address depositPool)`

Returns pool data including price, strategy, and aToken address.

```solidity
function depositPools(uint256, address) external view returns (
    address token,                // Asset token address
    address chainLinkPath,        // Chainlink price feed
    uint256 tokenPrice,           // Price in USD (18 decimals)
    uint256 deposited,            // Total deposited
    uint256 lastUnderlyingBalance,// Last recorded balance
    uint8 strategy,               // 0=NONE, 1=NO_YIELD, 2=AAVE
    address aToken,               // aToken address for AAVE strategy
    bool isExist                  // Whether pool exists
);
```

**Strategy Types**:
- `0` (NONE): Disabled
- `1` (NO_YIELD): Rebasing assets like stETH
- `2` (AAVE): Yield-generating via AAVE (USDC, USDT, wBTC, wETH)

#### `distributedRewards(uint256 rewardPoolIndex, address depositPool)`

Returns cumulative MOR rewards distributed to a deposit pool.

```solidity
function distributedRewards(uint256, address) external view returns (uint256);
```

**Usage**: Called at current block and past block to compute 7-day reward deltas.

---

### DepositPool Contract

**ABI**: `/app/abi/DepositPool.json`

#### `totalDepositedInPublicPools()`

Returns total amount staked in the pool.

```solidity
function totalDepositedInPublicPools() external view returns (uint256);
```

#### `rewardPoolsData(uint256 index)`

Returns reward rate data for a pool.

```solidity
function rewardPoolsData(uint256 index) external view returns (
    uint128 lastUpdate,          // Last update timestamp
    uint256 rate,                // Current pool rate
    uint256 totalVirtualDeposited // Total virtual deposits
);
```

---

### ERC20 (aToken) Contract

**ABI**: `/app/abi/ERC20.json`

#### `balanceOf(address account)`

For AAVE strategy assets, used to get current aToken balance to calculate yield.

```solidity
function balanceOf(address account) external view returns (uint256);
```

---

## APR Calculation Formula

### Step 1: Compute Annual Emissions (Decay-Aware)

The Morpheus protocol uses a decaying emission schedule. Annual emissions are calculated using the `getPeriodReward` algorithm:

```typescript
// From use-capital-pool-data.ts:91-128
const getPeriodReward = (
  initialAmount: bigint,
  decreaseAmount: bigint,
  payoutStart: bigint,
  interval: bigint,
  startTime: bigint,
  endTime: bigint
): bigint => {
  // Calculate start and end interval indices
  const startIdx = startTime > payoutStart
    ? (startTime - payoutStart) / interval
    : 0n;
  const endIdx = (endTime - payoutStart - 1n) / interval;

  // Calculate first and last reward amounts in the period
  const first = initialAmount - decreaseAmount * startIdx;
  const last = initialAmount - decreaseAmount * endIdx;

  // Sum of arithmetic series: n * (first + last) / 2
  const n = endIdx - startIdx + 1n;
  return n * (first + last) / 2n;
};

// Usage: Calculate 1-year emissions from current time
const now = BigInt(Math.floor(Date.now() / 1000));
const oneYear = BigInt(365 * 24 * 60 * 60);
const annualEmissionsMOR = getPeriodReward(
  initialReward,
  rewardDecrease,
  payoutStart,
  decreaseInterval,
  now,
  now + oneYear
);
```

### Step 2: Calculate Yield Deltas (7-Day Window)

For each asset, calculate the yield generated over a 7-day historical window:

```typescript
// For NO_YIELD strategy (stETH - rebasing):
const yieldTokens = currentBalance - lastRecordedBalance;

// For AAVE strategy (USDC, USDT, wBTC, wETH):
const yieldTokens = currentATokenBalance - pastATokenBalance;

// Convert to USD
const yieldUSD = yieldTokens * assetPriceUSD;
```

### Step 3: Determine Pool Share

**Primary Method**: Protocol-truth from `distributedRewards` deltas

```typescript
// Get cumulative rewards at current and past blocks
const nowRewards = distributedRewards(0, depositPoolAddress); // current block
const pastRewards = distributedRewards(0, depositPoolAddress); // 7 days ago

// Calculate delta for each asset
const rewardDelta = nowRewards - pastRewards;

// Pool share = asset's delta / total delta across all assets
const poolShare = assetRewardDelta / totalRewardDeltaAllAssets;
```

**Fallback Method**: Yield-based share

```typescript
// If distributedRewards not available
const poolShare = assetYieldUSD / totalYieldUSD;
```

### Step 4: Calculate APR

```typescript
// Asset's annual MOR allocation
const assetAnnualShareMOR = annualEmissionsMOR * poolShare;

// APR in USD terms (requires MOR price)
const annualRewardsUSD = assetAnnualShareMOR * morPriceUSD;
const tvlUSD = totalStakedInPool * assetPriceUSD;
const aprPercentage = (annualRewardsUSD / tvlUSD) * 100;
```

### Complete Formula

```
APR% = ((annualEmissionsMOR × poolShare × morPrice) / (totalStaked × assetPrice)) × 100
```

Where:
- `annualEmissionsMOR`: Decay-aware annual MOR emissions for capital pool
- `poolShare`: Asset's proportional share of rewards (from distributedRewards or yield)
- `morPrice`: Current MOR price in USD
- `totalStaked`: Total amount staked in the asset's deposit pool
- `assetPrice`: Current asset price in USD

---

## Daily Emissions Calculation

**Location**: `/components/capital/hooks/use-daily-emissions.ts`

For user-specific daily emissions:

```typescript
// 1. Get total daily MOR rewards for capital pool
const totalDailyRewards = RewardPoolV2.getPeriodRewards(0, startTime, endTime);
// startTime = 24 hours ago, endTime = now

// 2. Get total USD value across ALL pools
const totalUSDValueAllPools = sum(
  assets.map(asset => asset.totalStaked * asset.price)
);

// 3. Calculate pool's USD share
const poolUSDValue = poolTotalStake * assetPrice;
const poolUSDShare = poolUSDValue / totalUSDValueAllPools;

// 4. Calculate user's share within the pool
const userShareOfPool = userStake / poolTotalStake;

// 5. Final calculation
const userDailyEmissions = totalDailyRewards * poolUSDShare * userShareOfPool;
```

### Formula

```
UserDailyEmissions = TotalDailyRewards × (PoolUSDValue / TotalUSDValue) × (UserStake / PoolTotalStake)
```

---

## Weighted Average APR

**Location**: `/app/hooks/useCapitalMetrics.ts:566-589`

The dashboard header displays a weighted average APR across all assets:

```typescript
let weightedAprSum = 0;

supportedAssets.forEach(assetSymbol => {
  const assetData = poolData.assets[assetSymbol];
  const assetUSDValue = assetAmounts[assetSymbol] * assetPrice;

  // Skip assets without valid APR
  if (!assetData.apr || assetData.apr === 'N/A') return;

  const aprNum = parseFloat(assetData.apr.replace('%', ''));
  const weight = assetUSDValue / totalUSDValue;

  weightedAprSum += aprNum * weight;
});

const avgApr = weightedAprSum;
```

### Formula

```
WeightedAvgAPR = Σ(AssetAPR × AssetUSDValue) / TotalUSDValue
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CONTRACT DATA SOURCES                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  RewardPoolV2                    DistributorV2                           │
│  ├─ rewardPools(0)               ├─ depositPools(0, poolAddr)            │
│  │  └─ Emission schedule         │  ├─ tokenPrice (18 decimals)          │
│  └─ getPeriodRewards()           │  ├─ lastUnderlyingBalance             │
│     └─ 24h total rewards         │  ├─ strategy (NONE/NO_YIELD/AAVE)     │
│                                  │  └─ aToken address                    │
│                                  └─ distributedRewards(0, poolAddr)      │
│                                     └─ Cumulative MOR allocated          │
│                                                                          │
│  DepositPool                     ERC20 (aToken)                          │
│  ├─ totalDepositedInPublicPools  └─ balanceOf(depositPool)               │
│  └─ rewardPoolsData(0)              └─ Current aToken balance            │
│     └─ rate, totalVirtualDeposited                                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        CALCULATION ENGINE                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  useCapitalPoolData()   [/hooks/use-capital-pool-data.ts]                │
│  │                                                                       │
│  ├─ 1. Fetch emission schedule from RewardPoolV2.rewardPools(0)          │
│  │                                                                       │
│  ├─ 2. Compute annual emissions (decay-aware arithmetic series)          │
│  │                                                                       │
│  ├─ 3. Discover past block (~7 days ago via binary search)               │
│  │                                                                       │
│  ├─ 4. Fetch current + historical data:                                  │
│  │     ├─ DistributorV2.depositPools() at current & past block           │
│  │     ├─ DistributorV2.distributedRewards() at current & past block     │
│  │     └─ aToken.balanceOf() at current & past block (AAVE assets)       │
│  │                                                                       │
│  ├─ 5. Calculate yield deltas per asset:                                 │
│  │     ├─ NO_YIELD: currentBalance - lastRecordedBalance                 │
│  │     └─ AAVE: currentATokenBalance - pastATokenBalance                 │
│  │                                                                       │
│  ├─ 6. Compute pool shares:                                              │
│  │     ├─ Primary: distributedRewards delta / total delta                │
│  │     └─ Fallback: yieldUSD / totalYieldUSD                             │
│  │                                                                       │
│  └─ 7. Calculate APR:                                                    │
│        APR = (annualEmissions × poolShare × morPrice) / (TVL × price)    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           UI COMPONENTS                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  CapitalInfoPanel         UserAssetsPanel          useCapitalMetrics     │
│  [capital-info-panel.tsx] [user-assets-panel.tsx]  [useCapitalMetrics.ts]│
│  │                        │                        │                     │
│  ├─ Displays per-asset    ├─ User's daily          ├─ Weighted avg APR   │
│  │  APR in table          │  emissions             │  for header         │
│  └─ Sorted by APR desc    └─ Total claimed/earned  └─ TVL calculation    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Asset Configuration

**Location**: `/components/capital/constants/asset-config.ts`

### Supported Assets

| Asset | Decimals | Strategy | Network |
|-------|----------|----------|---------|
| stETH | 18 | NO_YIELD (rebasing) | Mainnet, Testnet |
| LINK | 18 | - | Testnet only |
| USDC | 6 | AAVE | Mainnet |
| USDT | 6 | AAVE | Mainnet |
| wBTC | 8 | AAVE | Mainnet |
| wETH | 18 | AAVE | Mainnet |

### Deposit Pool Mapping

```typescript
export const DEPOSIT_POOL_MAPPING: Record<AssetSymbol, keyof ContractAddresses> = {
  stETH: 'stETHDepositPool',
  LINK: 'linkDepositPool',
  USDC: 'usdcDepositPool',
  USDT: 'usdtDepositPool',
  wBTC: 'wbtcDepositPool',
  wETH: 'wethDepositPool',
};
```

---

## Price Data Sources

### Token Prices

**Hook**: `/components/capital/hooks/use-token-prices.ts`

- **Source**: CoinGecko via `/api/token-price` endpoint
- **Refresh**: 10-minute cache with 3-retry limit
- **Stablecoins**: USDC and USDT hardcoded to $1.00

### Contract Prices

The DistributorV2 contract provides normalized token prices (18 decimals) via `depositPools()`. These are used as an alternative/validation source.

---

## Special Cases & Edge Handling

### wBTC Minimum APR Floor

```typescript
// use-capital-pool-data.ts:998-1004
if (symbol === 'wBTC' && aprPercentage >= 0 && aprPercentage < 0.01 && tvlForAPR > 0) {
  aprResults[symbol] = '0.01%';
  // wBTC on AAVE generates very low yield, so 7-day windows may show
  // 0 yield even though rewards are distributed
}
```

**Reason**: wBTC's AAVE yield is extremely low, causing 7-day windows to potentially show zero yield even when the pool is active.

### Missing Historical Data

If archive RPC is unavailable or past block discovery fails:
- APR calculation continues with best-effort data
- Returns `N/A` if critical data is missing

### Assets Without Pools

Assets without deployed deposit pool contracts display:
- APR: `"Coming Soon"`
- Total Staked: `"N/A"`

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `/hooks/use-capital-pool-data.ts` | **Primary APR calculation engine** |
| `/components/capital/hooks/use-daily-emissions.ts` | User daily emissions calculation |
| `/app/hooks/useCapitalMetrics.ts` | Weighted average APR, TVL aggregation |
| `/components/capital/capital-info-panel.tsx` | Assets table UI component |
| `/components/capital/constants/asset-config.ts` | Asset configuration and mapping |
| `/lib/utils/reward-calculation-utils.ts` | Reward math utilities |
| `/app/abi/RewardPoolV2.json` | RewardPoolV2 contract ABI |
| `/app/abi/DistributorV2.json` | DistributorV2 contract ABI |
| `/app/abi/DepositPool.json` | DepositPool contract ABI |
| `/config/networks.ts` | Contract addresses by network |

---

## Debug Logging

The codebase includes comprehensive console logging for debugging APR calculations:

```typescript
// Enable by checking browser console for these prefixes:
// 📆 [EMISSIONS] - Annual emissions calculation
// 🕰️ [HIST] - Historical block discovery
// 🔍 [APR CALC] - APR calculation steps
// 📊 [YIELD CALCULATION] - Per-asset yield data
// ✅ [APR CALC] - Final APR results
```

---

## External Documentation

- [Morpheus V7 Protocol Docs](https://gitbook.mor.org/smart-contracts/documentation/distribution-protocol/v7-protocol/contracts/rewardpool)
- [Morpheus Tokenomics](https://gitbook.mor.org/morpheus-tokenomics)

---

*Last Updated: January 2025*
