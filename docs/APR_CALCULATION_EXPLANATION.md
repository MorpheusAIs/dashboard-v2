# APR Calculation Explanation - V7 Protocol

## Overview

This document explains how APR is calculated for each asset in the Capital page, following the Morpheus v7 Protocol documentation.

## Key Concept: Yield-Based Distribution

The v7 protocol distributes MOR rewards based on **actual yield generated**, not just TVL (Total Value Locked). This is a critical distinction.

### Why Yield Matters

Different assets generate different yields when deposited:
- **USDT**: ~4.8% yield on AAVE
- **wETH**: ~1.6% yield on AAVE
- **stETH**: Rebasing yield from Lido staking
- **USDC, LINK, wBTC**: Various AAVE yields

**Key Insight**: An equal amount of USD deposited in USDT vs wETH will generate different yields, and the higher-yielding asset (USDT) will earn MORE MOR rewards, resulting in a higher APR.

## V7 Protocol Reward Distribution Formula

### Step 1: Calculate USD-Denominated Yield Per Asset

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
- `tokenPrice`: USD price from Chainlink (18 decimals)
- `lastUnderlyingBalance`: Last recorded balance
- `strategy`: AAVE (2) or NO_YIELD (1)
- `aToken`: Address of AAVE aToken for yield tracking

### Step 2: Calculate Reward Share Per Asset

Based on [MOR Distribution Step #1](https://gitbook.mor.org/smart-contracts/documentation/distribution-protocol/v7-protocol/guides/mor-distribution.-step-1):

```solidity
// Total yield across all assets
uint256 totalYieldUSD = sum(yieldUSD for all assets);

// Each asset's share of daily MOR emissions
uint256 assetRewardShare = (assetYieldUSD / totalYieldUSD) * totalDailyEmissions;
```

**Key Point**: Assets with higher yields get proportionally more MOR rewards. The TVL of other assets does NOT directly impact an individual asset's APR, but the **yields** of other assets affect the reward distribution.

### Step 3: Calculate APR

```javascript
const annualRewards = assetRewardShare * 365;
const APR = (annualRewards / assetTVL) * 100;
```

Where:
- `assetTVL`: Total Virtual Deposited from `DepositPool.rewardPoolsData()[2]`
- `annualRewards`: Daily MOR rewards × 365

## Implementation in Dashboard

### Location: `hooks/use-capital-pool-data.ts`

The implementation follows the v7 protocol exactly:

#### Lines 444-569: USD Yield Calculation
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

#### Lines 593-626: Yield-Based APR Calculation
```typescript
// Distribute rewards proportionally based on yield
Object.entries(assetYields).forEach(([symbol, assetYieldUSD]) => {
  const assetRewardShare = (assetYieldUSD / totalYieldUSD) * totalDailyEmissions;
  const annualRewards = assetRewardShare * 365;
  const aprPercentage = (annualRewards / totalVirtualDeposited) * 100;
  
  aprResults[symbol] = aprPercentage > 0.01 ? `${aprPercentage.toFixed(2)}%` : 'N/A';
});
```

#### Lines 628-685: Stake-Weighted Fallback
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

1. **DepositPool.rewardPoolsData(0)** → Daily MOR emission rate & total virtual stake
2. **Distributor.depositPools(0, depositPoolAddress)** → Token price, last balance, strategy, aToken
3. **aToken.balanceOf(Distributor)** → Current AAVE balance for yield calculation
4. **ChainLinkDataConsumer** → USD prices from Chainlink oracles

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
4. APR calculation yields < 0.01% (negligible rewards)

## References

1. [Protocol Yield Generation](https://gitbook.mor.org/smart-contracts/documentation/distribution-protocol/v7-protocol/guides/protocol-yield-generation)
2. [MOR Distribution Step #1](https://gitbook.mor.org/smart-contracts/documentation/distribution-protocol/v7-protocol/guides/mor-distribution.-step-1)
3. [V7 Protocol Contracts](https://gitbook.mor.org/smart-contracts/documentation/distribution-protocol/v7-protocol/contracts)

---

**Last Updated**: October 3, 2025
**Protocol Version**: V7 / V2 Distributor
**Implementation**: `hooks/use-capital-pool-data.ts` (lines 390-698)





