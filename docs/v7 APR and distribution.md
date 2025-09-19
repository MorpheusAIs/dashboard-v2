Based on my analysis of the [Morpheus v7 Protocol documentation](https://gitbook.mor.org/smart-contracts/documentation/distribution-protocol/v7-protocol), here's a comprehensive overview of daily emissions, rewards, and APR/APY calculations:

source: https://gitbook.mor.org/smart-contracts/documentation/distribution-protocol/v7-protocol

## **Daily Emissions and Reward Distribution**

### **Core Emission Formula**
The protocol uses the `LinearDistributionIntervalDecrease` library with a linear decay model:

**Emission Parameters:**
- `initialAmount` - Starting reward amount per interval (e.g., 1000 tokens per day)
- `decreaseAmount` - How much reward decreases per interval (e.g., 10 tokens less per day)  
- `interval` - Time in seconds (typically 86400 for daily)
- `payoutStart` - Timestamp when emissions begin

**Formula for Full Intervals:**
```
initialReward * ip_ - (decreaseAmount_ * (ip_ * (ip_ - 1))) / 2
```

**Emission Cutoff:**
```
maxIntervals = ceil(initialAmount / decreaseAmount)
maxEndTime = payoutStart + maxIntervals * interval
```

### **Key Contract Functions:**

**RewardPool Contract:**
- `getPeriodRewards(uint256 index_, uint128 startTime_, uint128 endTime_)` - Calculates total MOR rewards for a time period

**Distributor Contract:**
- `distributeRewards(uint256 rewardPoolIndex_)` - Main daily distribution function
- `updateDepositTokensPrices(uint256 rewardPoolIndex_)` - Updates Chainlink prices

## **Reward Calculation System**

### **Step 1: Pool-Level Distribution (Distributor Contract)**

**USD Yield Calculation:**
```
uint256 yield = (tokenBalance - lastUnderlyingBalance).to18(decimals) * tokenPrice
```

**Pool Share Formula:**
```
uint256 rewardShare = (poolYield * totalRewards) / totalYield
```

Where:
- `poolYield` = USD yield of the specific deposit pool
- `totalYield` = Sum of all deposit pool yields
- `totalRewards` = Total MOR emission from RewardPool

### **Step 2: User-Level Distribution (DepositPool Contract)**

**User Reward Formula:**
```
uint256 userReward = pendingRewards + virtualStake * (poolRewardCoefficient - userRewardCoefficient)
```

**Pool Coefficient Update:**
```
poolRewardCoefficient += distributedRewards / totalVirtualStake
```

### **Virtual Stake Calculation**
Users receive bonuses through multipliers:

**Components:**
1. **Base Stake:** Actual deposited amount
2. **Lock Multiplier (Power Factor):** Based on claim lock duration
3. **Referral Multiplier:** 1% bonus (REFERRAL_MULTIPLIER = 10^25 * 101/100)

**Key Functions:**
- `getCurrentUserMultiplier(uint256 rewardPoolIndex_, address user_)` - Returns combined multiplier
- `getLockPeriodMultiplier(uint128 start_, uint128 end_)` - Lock period bonus
- `getReferralMultiplier(address referrer_)` - Returns referral bonus

## **Yield Generation Strategies**

### **Strategy Types:**
1. **AAVE** - Deposits tokens into Aave for yield generation
2. **NO_YIELD** - Used for stETH (native Lido rebasing)
3. **NONE** - No yield logic (private buckets)

### **Price Normalization:**
- All yields converted to USD via `ChainLinkDataConsumer`
- Ensures fair distribution across different assets
- Daily price updates during reward distribution

## **APR/APY Related Calculations**

### **Key Factors Affecting Returns:**

**1. Emission Rate:** 
- Decreases linearly over time based on emission curve
- Current rate determined by `getPeriodRewards()` function

**2. Total Value Locked (TVL):**
- Higher TVL = lower individual APR
- Calculated as sum of `totalVirtualStake` across pools

**3. Multipliers:**
- Lock period increases effective stake weight
- Referrals provide 1% bonus
- Referrer tiers provide additional bonuses

**4. Yield Generation:**
- Real yield from Aave lending (for supported assets)
- stETH rebasing rewards
- Cross-asset yield sharing based on USD values

### **APR Calculation Components:**

**Base APR Formula (conceptual):**
```
APR = (Annual MOR Emissions * MOR Price) / (Total USD Value Staked) * 100
```

**Effective APR with Multipliers:**
```
Effective APR = Base APR * User Multipliers
```

## **Distribution Timing and Constraints**

### **Daily Distribution Requirements:**
- Minimum period: `minRewardsDistributePeriod` (typically daily)
- Triggered by user actions (stake, withdraw, claim) or manual calls
- stETH yield measured daily due to Lido rebasing mechanism

### **Critical Contract Addresses:**
- **RewardPool** - Emission logic and curves
- **Distributor** - Yield aggregation and pool distribution  
- **DepositPool** - User staking and individual rewards
- **ChainLinkDataConsumer** - Price feeds
- **L1SenderV2** - Cross-chain messaging

### **Key Read Functions for APR/Rewards:**
- `getLatestUserReward(uint256 rewardPoolIndex_, address user_)` - Current claimable rewards
- `getLatestReferrerReward(uint256 rewardPoolIndex_, address user_)` - Referrer rewards
- `getDistributedRewards(uint256 rewardPoolIndex_, address depositPoolAddress_)` - Pool rewards

This system creates a complex but fair reward distribution mechanism where APR/APY depends on emission schedules, total participation, individual multipliers, and real yield generation across multiple asset types.