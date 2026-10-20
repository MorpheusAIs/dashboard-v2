# APR Calculation Explanation - V7 Protocol

## Overview

This document explains how APR is calculated for each asset in the Capital page, following the Morpheus v7 Protocol documentation.

The Capital page shows the **unlocked APR (1×)**: the rate earned by a deposit with no lock or referral bonus. Your own rate is the unlocked APR × your multiplier.

## Headline APR: Credited Over the Last 30 Days

The headline figure is what unlocked deposits were actually credited over the last ~30 days, not a projection.

`DepositPool.rewardPoolsData(0).rate` is the cumulative MOR paid per virtual deposit unit (scaled by 1e25). A 1× depositor holds one virtual unit per token, so the change in `rate` over time is exactly what an unlocked deposit earned. Lockers don't distort it.

```
r_now, r_past  = DepositPool.rewardPoolsData(0).rate        at the latest block and a block ~30 days earlier
t_now, t_past  = DepositPool.rewardPoolsData(0).lastUpdate  at the same two blocks
morPerTokenSec = (r_now − r_past) × 10^assetDecimals / 1e25 / 1e18 / (t_now − t_past)
unlockedAPR    = morPerTokenSec × 31,536,000 × MOR_price / asset_price
```

- The past block is found by timestamp (binary search), not by an assumed number of blocks per day.
- If a pool had no contract update in the window, the window widens to 60, 90, then 180 days.
- MOR and asset prices are live market prices from `/api/token-prices` (DefiLlama and CoinGecko). Stablecoins are $1.
- Computed server-side by `app/api/capital/unlocked-apr/route.ts` (needs an archive RPC) and cached for an hour.
- Expected MOR/day estimates use the same credited rate.

If the credited rate isn't available, the page falls back to the projection below. The projection assumes every scheduled MOR emission is distributed. When the Distributor distributes less than scheduled, the projection runs higher than what depositors were credited.

## Projected APR (Fallback)

## Key Concept: Yield-Based Distribution

The v7 protocol distributes MOR rewards based on **actual yield generated**, not just TVL (Total Value Locked). This is a critical distinction.

### Why Yield Matters

Different assets generate different yields when deposited:
- **USDT**: ~4.8% yield on AAVE
- **wETH**: ~1.6% yield on AAVE
- **stETH**: Rebasing yield from Lido staking
- **USDC, LINK, wBTC**: Various AAVE yields

**Key Insight**: An equal amount of USD deposited in USDT vs wETH will generate different yields, and the higher-yielding asset (USDT) will earn MORE MOR rewards, resulting in a higher APR.

### V7 Protocol Reward Distribution Formula

#### Step 1: Calculate USD-Denominated Yield Per Asset

Based on [Protocol Yield Generation](https://gitbook.mor.org/smart-contracts/documentation/distribution-protocol/v7-protocol/guides/protocol-yield-generation):

```solidity
// For AAVE strategy assets
uint256 currentBalance = aToken.balanceOf(Distributor);
uint256 yieldTokens = max(0, currentBalance - lastUnderlyingBalance);
uint256 yieldUSD = yieldTokens * tokenPrice;

// For NO_YIELD strategy (stETH)
uint256 currentBalance = totalDepositedInPublicPools;
uint256 yieldTokens = max(0, currentBalance - lastUnderlyingBalance);
uint256 yieldUSD = yieldTokens * tokenPrice;
```

**Source**: `Distributor.sol` - `depositPools()` mapping stores:
- `tokenPrice`: USD price from Chainlink (18 decimals), refreshed only when the Distributor updates. The dashboard uses live market prices instead.
- `lastUnderlyingBalance`: Last recorded balance
- `strategy`: AAVE (2) or NO_YIELD (1)
- `aToken`: Address of AAVE aToken for yield tracking

#### Step 2: Calculate Reward Share Per Asset

Based on [MOR Distribution Step #1](https://gitbook.mor.org/smart-contracts/documentation/distribution-protocol/v7-protocol/guides/mor-distribution.-step-1):

```solidity
// Total yield across all assets
uint256 totalYieldUSD = sum(yieldUSD for all assets);

// Each asset's share of daily MOR emissions
uint256 assetRewardShare = (assetYieldUSD / totalYieldUSD) * totalDailyEmissions;
```

**Key Point**: Assets with higher yields get proportionally more MOR rewards. The TVL of other assets does NOT directly impact an individual asset's APR, but the **yields** of other assets affect the reward distribution.

#### Step 3: Calculate APR

```javascript
const annualRewardsUSD = assetRewardShare * 365 * morPrice;
const APR = (annualRewardsUSD / (assetTVL * assetPrice)) * 100;
```

Where:
- `assetTVL`: Total Virtual Deposited from `DepositPool.rewardPoolsData()[2]`
- `annualRewards`: Daily MOR rewards × 365
- `morPrice`, `assetPrice`: live market prices

The dashboard takes each pool's share from the change in `Distributor.distributedRewards` over the last 7 days, which is what the protocol actually distributed, rather than recomputing it from yields.

## Implementation in Dashboard

### Location: `hooks/use-capital-pool-data.ts`

The projection follows the v7 protocol:

#### USD Yield Calculation
```typescript
// For each asset, calculate USD-denominated yield
const distributorResult = await Distributor.depositPools(poolIndex, depositPoolAddress);
const [token, chainLinkPath, tokenPrice, deposited, lastUnderlyingBalance, strategy, aToken, isExist] = distributorResult;

let currentBalance = 0;
if (strategy === 2) { // AAVE
  currentBalance = await aToken.balanceOf(distributorAddress);
} else { // NO_YIELD (stETH)
  currentBalance = deposited;
}

const yieldTokens = Math.max(0, currentBalance - lastUnderlyingBalance);
const yieldUSD = yieldTokens * tokenPrice;
```

#### Yield-Based APR Calculation
```typescript
// Distribute rewards proportionally based on yield
Object.entries(assetYields).forEach(([symbol, assetYieldUSD]) => {
  const assetRewardShare = (assetYieldUSD / totalYieldUSD) * totalDailyEmissions;
  const annualRewards = assetRewardShare * 365;
  const aprPercentage = (annualRewards / totalVirtualDeposited) * 100;
  
  aprResults[symbol] = `${aprPercentage.toFixed(2)}%`;
});
```

#### Stake-Weighted Fallback
When yield data is insufficient (totalYieldUSD < $100), the system falls back to stake-weighted distribution for stability:

```typescript
// Calculate total virtual stake across all pools
const totalVirtualStakeAcrossPools = sum(virtualStakeByAsset);

// Distribute proportionally by stake
const stakeShare = virtualStake / totalVirtualStakeAcrossPools;
const assetDailyRewards = stakeShare * totalDailyEmissions;
const aprPercentage = (assetDailyRewards * 365 / virtualStake) * 100;
```

## Why APR Differs Per Asset

### Example Scenario

Assumptions:
- Total daily emissions: 3,456 MOR/day (example)
- USDT: $1M deposited, 4.8% AAVE yield = $48,000/year = $131.51/day
- wETH: $1M deposited, 1.6% AAVE yield = $16,000/year = $43.84/day

**Total daily yield**: $175.35/day

**MOR Distribution**:
- USDT share: (131.51 / 175.35) × 3,456 = 2,591 MOR/day
- wETH share: (43.84 / 175.35) × 3,456 = 865 MOR/day

**APR Calculation** (assuming MOR = $10):
- USDT APR: (2,591 × 365 × 10) / 1,000,000 × 100 = **9.46%**
- wETH APR: (865 × 365 × 10) / 1,000,000 × 100 = **3.16%**

**Result**: Even with equal TVL, USDT has ~3x higher APR because it generates 3x more yield!

## Data Sources

### On-Chain Contracts

1. **DepositPool.rewardPoolsData(0)** → Last update time, cumulative reward rate per virtual unit & total virtual stake
2. **Distributor.depositPools(0, depositPoolAddress)** → Token price, last balance, strategy, aToken
3. **aToken.balanceOf(Distributor)** → Current AAVE balance for yield calculation
4. **Distributor.distributedRewards(0, depositPoolAddress)** → MOR distributed to each pool (7-day change gives pool shares)
5. **/api/token-prices** → Live MOR and asset prices

### Network Addresses

See `config/networks.ts`:
- Mainnet: Ethereum L1 (chainId: 1)
- Testnet: Sepolia L1 (chainId: 11155111)

## FAQ

### Q: Does adding more USDT decrease USDC's APR?
**A**: Not directly. USDT's **TVL** doesn't affect USDC's APR. However, if USDT generates significant **yield**, it will claim a larger share of daily MOR emissions, which reduces USDC's share and thus its APR.

### Q: Why is my asset's APR different from yesterday?
**A**: APR changes based on:
1. **Your asset's yield**: More/less yield = more/less MOR rewards
2. **Other assets' yields**: If other assets generate more yield, they get a larger share
3. **Total emissions**: MOR emissions decrease over time (linear decay)
4. **TVL changes**: More TVL = same rewards spread across more deposits = lower APR

### Q: When is yield calculated?
**A**: The Distributor contract tracks yield continuously but distributes rewards periodically (typically daily for public pools) to comply with the `minRewardsDistributePeriod` constraint.

### Q: Why does the dashboard sometimes show "N/A" for APR?
**A**: APR shows "N/A" when:
1. No deposit pool contract exists for that asset
2. Insufficient contract data (loading state)
3. Total virtual deposited = 0 (no deposits yet)

A pool that earns nothing shows 0.00%. There is no minimum floor.

## References

1. [Protocol Yield Generation](https://gitbook.mor.org/smart-contracts/documentation/distribution-protocol/v7-protocol/guides/protocol-yield-generation)
2. [MOR Distribution Step #1](https://gitbook.mor.org/smart-contracts/documentation/distribution-protocol/v7-protocol/guides/mor-distribution.-step-1)
3. [V7 Protocol Contracts](https://gitbook.mor.org/smart-contracts/documentation/distribution-protocol/v7-protocol/contracts)

---

**Last Updated**: October 20, 2026
**Protocol Version**: V7 / V2 Distributor
**Implementation**: `hooks/use-capital-pool-data.ts`, `app/api/capital/unlocked-apr/route.ts`
