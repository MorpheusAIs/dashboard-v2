
## ** Why We Need a Subgraph**


### **Current Approach Problems:**

1. **Snapshot-Based Yield is Unreliable**
   - We're comparing `currentBalance - lastUnderlyingBalance` from **two points in time**
   - These could be **minutes apart** (last `distributeRewards()` call)
   - Results in **tiny or negative yields** that aren't representative

2. **Missing Historical Context**
   - Can't see **actual reward distribution patterns** over time
   - Can't track **real yield generation cycles**
   - Can't calculate **meaningful averages** for stable APR

3. **No Access to Distribution Events**
   - Need to see **when and how much** each asset actually received
   - Need **proportional shares** from actual distributions, not assumptions

## **🏗️ Subgraph Requirements**

### **Essential Entities to Track:**

#### **1. Daily Reward Distributions**
```graphql
type RewardDistribution @entity {
  id: String! # timestamp-poolIndex
  timestamp: BigInt!
  rewardPoolIndex: Int!
  totalMOREmitted: BigDecimal!
  distributorAddress: Bytes!
  blockNumber: BigInt!
}
```

#### **2. Asset Pool Rewards**  
```graphql
type AssetPoolReward @entity {
  id: String! # timestamp-poolIndex-assetAddress
  timestamp: BigInt!
  assetSymbol: String!
  depositPoolAddress: Bytes!
  morRewardsReceived: BigDecimal! # Actual MOR distributed to this asset
  proportionalShare: BigDecimal! # Percentage of total pool rewards
  yieldGeneratedUSD: BigDecimal! # USD yield that earned these rewards
}
```

#### **3. Yield Tracking Over Time**
```graphql
type AssetYieldSnapshot @entity {
  id: String! # timestamp-assetAddress
  timestamp: BigInt!
  assetSymbol: String!
  strategy: String! # AAVE, NO_YIELD, NONE
  currentBalance: BigDecimal! # Current token/aToken balance
  lastUnderlyingBalance: BigDecimal! # Previous balance
  yieldGenerated: BigDecimal! # currentBalance - lastUnderlyingBalance
  tokenPriceUSD: BigDecimal! # Chainlink price at this time
  yieldUSD: BigDecimal! # yieldGenerated * tokenPriceUSD
}
```

#### **4. Virtual Stake Changes**
```graphql
type VirtualStakeSnapshot @entity {
  id: String! # timestamp-assetAddress
  timestamp: BigInt!
  assetSymbol: String!
  totalVirtualDeposited: BigDecimal!
  totalActualDeposited: BigDecimal!
  averageMultiplier: BigDecimal! # virtual/actual ratio
}
```

#### **5. APR Calculation Results**
```graphql
type APRSnapshot @entity {
  id: String! # timestamp-assetAddress
  timestamp: BigInt!
  assetSymbol: String!
  dailyMORRewards: BigDecimal! # This asset's daily MOR allocation
  totalVirtualStake: BigDecimal!
  calculatedAPR: BigDecimal!
  calculationMethod: String! # "yield-based" or "stake-weighted"
}
```

## **📊 Events to Index:**

### **From Distributor Contract:**
- `RewardPoolLastCalculatedTimestampSet` - When distributions happen
- `TokenPriceSet` - Chainlink price updates
- Any balance changes in Distributor contract

### **From DepositPool Contracts:**
- Stake/withdraw events to track virtual stake changes
- Reward coefficient updates

### **From RewardPool Contract:**  
- Emission schedule changes

## **Calculated Metrics from Subgraph:**

### **7-Day Rolling APR:**
```graphql
# Query last 7 days of distributions
{
  assetPoolRewards(
    where: { timestamp_gte: $sevenDaysAgo }
    orderBy: timestamp
  ) {
    assetSymbol
    morRewardsReceived
    timestamp
  }
  
  virtualStakeSnapshots(
    where: { timestamp_gte: $sevenDaysAgo }
    orderBy: timestamp  
  ) {
    assetSymbol
    totalVirtualDeposited
    timestamp
  }
}
```
