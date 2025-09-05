# Mainnet V1 to V2 Contract Migration Plan

## Executive Summary

**Current State:**
- **Mainnet**: Using V1 contracts (ERC1967Proxy) with limited functionality
- **Testnet**: Using V2 contracts (DepositPool, DistributorV2, etc.) with full multi-asset support

**Goal:** Migrate mainnet to use the same V2 contract architecture as testnet for consistency and enhanced functionality.

---

## 📊 Contract Architecture Comparison

### V1 (Current Mainnet) Architecture
```
Ethereum Mainnet (Chain ID: 1)
├── erc1967Proxy: 0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790
├── stETH: 0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84
└── layerZeroEndpoint: 0x66A71Dcef29A0fFBDBE3c6a460a3B5BC225Cd675

Limited to:
- Single asset (stETH only)  
- Basic staking functionality
- Legacy contract interface
```

### V2 (Current Testnet) Architecture
```
Ethereum Sepolia (Chain ID: 11155111)
├── stETHDepositPool: 0xFea33A23F97d785236F22693eDca564782ae98d0
├── linkDepositPool: 0x7f4f17be21219D7DA4C8E0d0B9be6a778354E5A5
├── distributorV2: 0x65b8676392432B1cBac1BE4792a5867A8CA2f375
├── rewardPoolV2: 0xbFDbe9c7E6c8bBda228c6314E24E9043faeEfB32
├── l1SenderV2: 0x85e398705d7D77F1703b61DD422869A67B3B409d
└── linkToken: 0xf8Fb3713D459D7C1018BD0A49D19b4C44290EBE5

Features:
- Multi-asset support (stETH, LINK, and future assets)
- Enhanced power factor calculations
- Cross-chain reward distribution
- Advanced referral system
- V7 protocol compliance
```

### V2 (DEPLOYED Mainnet) Architecture  🎉
```
Ethereum Mainnet (Chain ID: 1) - CONTRACTS DEPLOYED
├── stETHDepositPool: 0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790 (upgraded from distributionV5)
├── wBTCDepositPool: [DEPLOYED - Address TBD from script variables]
├── wETHDepositPool: [DEPLOYED - Address TBD from script variables]  
├── usdcDepositPool: [DEPLOYED - Address TBD from script variables]
├── usdtDepositPool: [DEPLOYED - Address TBD from script variables]
├── distributorV2: [DEPLOYED - Address TBD from script variables]
├── rewardPoolV2: [DEPLOYED - Address TBD from script variables]
├── l1SenderV2: 0x2Efd4430489e1a05A89c2f51811aC661B7E5FF84 (upgraded)
├── chainLinkDataConsumer: [DEPLOYED - Address TBD from script variables]
└── Token Addresses:
    ├── wBTC: 0x2260fac5e5542a773aa44fbcfedf7c193bc2c599
    ├── wETH: 0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2
    ├── USDC: 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48
    ├── USDT: 0xdac17f958d2ee523a2206206994597c13d831ec7
    └── stETH: 0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84

Integration Features:
- Aave yield optimization
- Chainlink price feeds  
- Uniswap V3 integration
- Multi-asset support (5 assets: stETH, wBTC, wETH, USDC, USDT)
```

---

## 🎯 Key Differences & Migration Requirements

### 1. Contract Address Configuration
**File:** `config/networks.ts`

**Current Mainnet (V1):**
```typescript
mainnet: {
  contracts: {
    erc1967Proxy: toContract('0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790'),
    stETH: toContract('0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84'),
    layerZeroEndpoint: toContract('0x66A71Dcef29A0fFBDBE3c6a460a3B5BC225Cd675'),
    l1Factory: toContract('0x969C0F87623dc33010b4069Fea48316Ba2e45382')
  }
}
```

**DEPLOYED V2 Configuration:**
```typescript
mainnet: {
  contracts: {
    // V1 Legacy (now upgraded to V2 DepositPool)
    erc1967Proxy: toContract('0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790'), // Legacy reference
    stETH: toContract('0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84'),
    layerZeroEndpoint: toContract('0x66A71Dcef29A0fFBDBE3c6a460a3B5BC225Cd675'),
    l1Factory: toContract('0x969C0F87623dc33010b4069Fea48316Ba2e45382'),
    
    // V2 Contracts (ALREADY DEPLOYED) ✅
    stETHDepositPool: toContract('0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790'), // Upgraded distributionV5
    wBTCDepositPool: toContract('EXTRACT_FROM_SCRIPT_VARIABLE'), // depositPoolWBTC
    wETHDepositPool: toContract('EXTRACT_FROM_SCRIPT_VARIABLE'), // depositPoolWETH  
    usdcDepositPool: toContract('EXTRACT_FROM_SCRIPT_VARIABLE'), // depositPoolUSDC
    usdtDepositPool: toContract('EXTRACT_FROM_SCRIPT_VARIABLE'), // depositPoolUSDT
    distributorV2: toContract('EXTRACT_FROM_SCRIPT_VARIABLE'), // distributorAddress
    rewardPoolV2: toContract('EXTRACT_FROM_SCRIPT_VARIABLE'), // rewardPoolAddress
    l1SenderV2: toContract('0x2Efd4430489e1a05A89c2f51811aC661B7E5FF84'), // Upgraded L1Sender
    chainLinkDataConsumer: toContract('EXTRACT_FROM_SCRIPT_VARIABLE'), // chainLinkDataConsumerAddress
    
    // Token Addresses
    wBTCToken: toContract('0x2260fac5e5542a773aa44fbcfedf7c193bc2c599'),
    wETHToken: toContract('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'), 
    usdcToken: toContract('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'),
    usdtToken: toContract('0xdac17f958d2ee523a2206206994597c13d831ec7'),
    
    // LINK not deployed yet (Phase 2)
    linkToken: toContract('0x514910771AF9Ca656af840dff83E8264EcF986CA'), // Standard LINK
    linkDepositPool: toContract('TBD_FUTURE_DEPLOYMENT'), // Not in current script
  }
}
```

**⚠️ Action Required:** Extract actual deployed addresses from script variables after execution.

### 2. ABI Usage Patterns
**Files affected:** All components using capital contracts

**Current V1 Pattern:**
```typescript
// Uses single ABI for all functions
import ERC1967ProxyAbi from "@/app/abi/ERC1967Proxy.json";

// Contract calls through single proxy
const poolData = useReadContract({
  address: poolContractAddress, // erc1967Proxy
  abi: ERC1967ProxyAbi,
  functionName: 'pools',
  args: [PUBLIC_POOL_ID]
});
```

**Required V2 Pattern:**
```typescript
// Uses multiple specialized ABIs
import DepositPoolAbi from "@/app/abi/DepositPool.json";
import RewardPoolV2Abi from "@/app/abi/RewardPoolV2.json";
import DistributorV2Abi from "@/app/abi/DistributorV2.json";

// Separate contracts for each asset
const stETHPoolData = useReadContract({
  address: stETHDepositPoolAddress,
  abi: DepositPoolAbi,
  functionName: 'rewardPoolsProtocolDetails',
  args: [V2_REWARD_POOL_INDEX]
});
```

---

## 🔗 External Integrations Analysis

### Aave Protocol Integration (Contract Level)
**Configured in Migration Script:**
```typescript
// Aave addresses (configured in Distributor contract)
aavePoolAddressProvider: '0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e'
aavePoolDataProvider: '0x497a1994c46d4f6C864904A9f1fac6328Cb7C8a6'  
aaveRewardsController: '0x8164cc65827dcfe994ab23944cbc90e0aa80bfcb'
```

**Frontend Requirements Assessment:**
- **❌ Not needed in frontend configuration** - These are contract-level integrations
- **⚠️ Potential UI Enhancement:** Could display additional Aave yield information
- **📊 Monitoring:** Frontend could show combined MOR + Aave APY if desired
- **🎯 Recommendation:** Keep at contract level, add to UI only if enhanced APY display needed

### Chainlink Price Feeds (Contract Level)
**Configured Price Feeds:**
- USDC/USD, USDT/USD, wETH/USD, stETH/USD, wBTC/BTC,BTC/USD
- **❌ Not needed in frontend** - Used for contract-level asset pricing
- **💡 Note:** Frontend token price service (CoinGecko) can remain unchanged

### Uniswap V3 Integration (Contract Level)  
**Router Address:** 0xE592427A0AEce92De3Edee1F18E0157C05861564
- **❌ Not needed in frontend** - Used for contract-level token swapping
- **📝 Note:** Enables automatic token conversions within reward distribution

**Summary:** External integrations are primarily contract-level. Frontend changes not required but could enhance user experience with additional yield information.

---

## 🆕 New Features Available Post-Migration

### Multi-Asset Support (Previously Testnet-Only)
**Now Available on Mainnet:**
- ✅ stETH deposits (existing, now V2-powered)
- 🆕 wBTC deposits
- 🆕 wETH deposits  
- 🆕 USDC deposits
- 🆕 USDT deposits
- ⏳ LINK deposits (future deployment)

### Enhanced Reward System
- **Power Factor Calculations:** More sophisticated multiplier system
- **Cross-Chain Rewards:** Automatic L2 token distribution
- **Referral Rewards:** Per-asset referral tracking and claiming

### Advanced Yield Optimization
- **Aave Integration:** Additional yield on deposited assets
- **Dynamic Pricing:** Real-time Chainlink price feeds
- **Auto-Compounding:** Optimized reward distribution

---

## 📋 Complete File Migration Checklist

### Core Context & Configuration Files

#### ✅ `context/CapitalPageContext.tsx` (Lines 355-1910)
**Migration Required:**
- **Lines 378-383**: Remove V1/V2 conditional logic
- **Lines 481-546**: Replace V1 contract calls with V2 equivalents  
- **Lines 649-819**: Expand V2 calls to all networks
- **Lines 1252-1286**: Update transaction functions for V2 contracts

**Specific Changes:**
```typescript
// REMOVE: Network-aware contract address selection
const poolContractAddress = useMemo(() => {
  const contractKey = networkEnv === 'mainnet' ? 'erc1967Proxy' : 'stETHDepositPool';
  return getContractAddress(l1ChainId, contractKey, networkEnv);
}, [l1ChainId, networkEnv]);

// REPLACE WITH: Always use V2 contracts
const stETHDepositPoolAddress = useMemo(() => 
  getContractAddress(l1ChainId, 'stETHDepositPool', networkEnv), [l1ChainId, networkEnv]);
const linkDepositPoolAddress = useMemo(() => 
  getContractAddress(l1ChainId, 'linkDepositPool', networkEnv), [l1ChainId, networkEnv]);
```

### Hook Files

#### ✅ `hooks/use-capital-pool-data.ts` (Lines 52-403)
**Migration Required:**
- **Lines 93-94**: Remove testnet-only condition
- **Lines 110-112**: Remove testnet-only condition
- **Lines 131-134**: Remove testnet-only condition

**Changes:**
```typescript
// REMOVE: testnet-only conditions
query: { 
  enabled: networkEnvironment === 'testnet' && !!stETHDepositPoolAddress,

// REPLACE WITH: Always enabled when contracts available
query: { 
  enabled: !!stETHDepositPoolAddress,
```

#### ✅ `hooks/use-power-factor.ts`
**Migration Required:**
- Update contract address resolution to use V2 distributorV2 contract
- Remove network environment conditionals

#### ✅ `hooks/use-estimated-rewards.ts`
**Migration Required:**
- Update to use V2 DepositPool contracts instead of ERC1967Proxy
- Remove conditional ABI selection

### Component Files

#### ✅ `components/capital/deposit-modal.tsx` (Lines 42-937)
**Migration Required:**
- **Lines 69-71**: Update contract address selection
- **Lines 89-94**: Update power factor hook configuration
- **Lines 97-106**: Update estimated rewards hook configuration

**Changes:**
```typescript
// REMOVE: V1 contract usage
const poolContractAddress = useMemo(() => {
  return l1ChainId ? getContractAddress(l1ChainId, 'erc1967Proxy', networkEnv) : undefined;
}, [l1ChainId, networkEnv]);

// REPLACE WITH: V2 contract usage based on selected asset
const depositPoolAddress = useMemo(() => {
  const contractKey = selectedAsset === 'stETH' ? 'stETHDepositPool' : 'linkDepositPool';
  return l1ChainId ? getContractAddress(l1ChainId, contractKey, networkEnv) : undefined;
}, [l1ChainId, networkEnv, selectedAsset]);
```

#### ✅ `components/capital/withdraw-modal.tsx`
**Migration Required:**
- Update contract address resolution from erc1967Proxy to asset-specific DepositPool
- Update ABI from ERC1967ProxyAbi to DepositPoolAbi

#### ✅ `components/capital/claim-modal.tsx`
**Migration Required:**
- Update contract calls to use V2 DepositPool contracts
- Update function names from V1 to V2 equivalents

#### ✅ `components/capital/claim-mor-rewards-modal.tsx` (Lines 32-390)
**Migration Required:**
- **Lines 52-54**: Update network detection logic
- **Lines 135**: Already uses V2 contracts correctly

#### ✅ `components/capital/change-lock-modal.tsx`
**Migration Required:**
- Update from erc1967Proxy to distributorV2 contract
- Update ABI usage from ERC1967ProxyAbi to DistributorV2Abi

### Utility Hook Files  

#### ✅ `components/capital/hooks/use-daily-emissions.ts` (Lines 29-220)
**Migration Required:**
- **Lines 117-132**: Remove mainnet placeholder logic
- **Lines 135-149**: Apply to all networks, not just testnet

**Changes:**
```typescript
// REMOVE: Mainnet placeholder
if (networkEnvironment === 'mainnet') {
  const userStakedEth = Number(formatUnits(userDeposited, 18));
  const placeholderDailyRate = userStakedEth * 0.0003; 
  return placeholderDailyRate;
}

// REPLACE WITH: Live contract data for all networks
// (Remove the conditional and let all networks use contract data)
```

#### ✅ `hooks/use-total-mor-earned.ts` (Lines 152-354)
**Migration Required:**
- **Lines 196-197**: Update GraphQL client selection for mainnet
- **Lines 203-205**: Update pool constants for mainnet

### Page Components

#### ✅ `app/capital/page.tsx` (Lines 1-173)
**Migration Required:**
- **Lines 48-68**: Remove network switching logic (commented out)
- All modal components already use V2 architecture correctly through context

### Asset Configuration

#### ✅ `components/capital/constants/asset-config.ts` (Lines 95-130)
**Migration Required:**
- **Lines 107-129**: Add deployed V2 assets for mainnet

**Changes:**
```typescript
mainnet: {
  stETH: {
    address: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
    metadata: assetMetadata.stETH,
  },
  // ADD: Deployed V2 assets (from migration script) ✅
  wBTC: {
    address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
    metadata: assetMetadata.wBTC,
    disabled: false, // Now available!
  },
  wETH: {
    address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    metadata: assetMetadata.wETH,
    disabled: false, // Now available!
  },
  USDC: {
    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    metadata: assetMetadata.USDC,
    disabled: false, // Now available!
  },
  USDT: {
    address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    metadata: assetMetadata.USDT,
    disabled: false, // Now available!
  },
  // Future deployment
  LINK: {
    address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
    metadata: assetMetadata.LINK,
    disabled: true, // Not yet deployed
  },
}
```

**📊 Asset Priority:**
1. **stETH** (existing users) - Immediate migration required
2. **wBTC, wETH** - High value assets, enable ASAP
3. **USDC, USDT** - Stablecoin support, enable ASAP  
4. **LINK** - Future deployment, keep disabled for now

---

## 🔧 Function Name Mapping (V1 → V2)

### Contract Reads
| V1 Function (ERC1967Proxy) | V2 Function (DepositPool/Distributor) | Purpose |
|----------------------------|----------------------------------------|---------|
| `pools(poolId)` | `rewardPoolsProtocolDetails(poolIndex)` | Get pool configuration |
| `poolsLimits(poolId)` | `rewardPoolsProtocolDetails(poolIndex)` | Get pool limits (merged) |
| `usersData(user, poolId)` | `usersData(user, poolIndex)` | Get user stake data |
| `getCurrentUserReward(poolId, user)` | `getLatestUserReward(poolIndex, user)` | Get claimable rewards |
| `getCurrentUserMultiplier(poolId, user)` | `getCurrentUserMultiplier(poolId, user)` | Get power factor (DistributorV2) |
| `totalDepositedInPublicPools()` | `totalDepositedInPublicPools()` | Get total deposits (same name) |

### Contract Writes
| V1 Function | V2 Function | Purpose |
|-------------|-------------|---------|
| `stake(poolId, amount)` | `stake(poolIndex, amount, claimLockEnd, referrer)` | Deposit assets |
| `withdraw(poolId, amount)` | `withdraw(poolIndex, amount)` | Withdraw assets |
| `claim(poolId, user)` | `claim(poolIndex, user)` | Claim rewards |
| `lockClaim(poolId, lockEndTimestamp)` | `lockClaim(poolIndex, lockEndTimestamp)` | Lock rewards for multiplier |

### New V2-Only Functions
| Function | Contract | Purpose |
|----------|----------|---------|
| `getLatestReferrerReward(poolIndex, user)` | DepositPool | Get referral rewards |
| `claimReferrerTier(poolIndex, user)` | DepositPool | Claim referral rewards |
| `referrersData(user, poolIndex)` | DepositPool | Get referrer stats |
| `getPeriodRewards(poolId, startTime, endTime)` | RewardPoolV2 | Get emission data |

---

## 🚀 Migration Implementation Plan

### Phase 1: Contract Deployment (DevOps) ✅ COMPLETED
1. **V2 Contracts Deployed to Ethereum Mainnet** ✅
   - stETHDepositPool: 0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790 (upgraded)
   - wBTCDepositPool, wETHDepositPool, usdcDepositPool, usdtDepositPool: Deployed ✅
   - distributorV2: Deployed ✅
   - rewardPoolV2: Deployed ✅  
   - l1SenderV2: 0x2Efd4430489e1a05A89c2f51811aC661B7E5FF84 (upgraded) ✅
   - chainLinkDataConsumer: Deployed ✅

2. **Integration Services Configured** ✅
   - Chainlink price feeds: USDC/USD, USDT/USD, wETH/USD, stETH/USD, wBTC/BTC,BTC/USD
   - Aave integration: Pool provider, data provider, rewards controller
   - Uniswap V3 router: 0xE592427A0AEce92De3Edee1F18E0157C05861564

3. **Next Action Required**
   - Extract deployed contract addresses from script execution logs
   - Update `config/networks.ts` with actual addresses

### Phase 2: Code Migration (Development)
1. **Update Context (Priority 1)**
   - `context/CapitalPageContext.tsx` - Remove conditional logic
   - Test all contract reads work with V2 contracts

2. **Update Hooks (Priority 2)**
   - `hooks/use-capital-pool-data.ts` - Remove testnet-only conditions
   - `components/capital/hooks/use-daily-emissions.ts` - Use live data for all networks
   - `hooks/use-power-factor.ts` - Use distributorV2 contract
   - `hooks/use-estimated-rewards.ts` - Use DepositPool contracts

3. **Update Modal Components (Priority 3)**
   - All modal components to use V2 contracts consistently
   - Update deposit/withdraw/claim logic
   - Test multi-asset functionality

4. **Update Asset Configuration (Priority 4)**
   - Add missing mainnet assets to asset-config.ts
   - Enable multi-asset support on mainnet

### Phase 3: Testing & Validation
1. **Function Parity Testing**
   - Verify all V1 functions have V2 equivalents
   - Test read operations return expected data
   - Test write operations work correctly

2. **Multi-Asset Testing**
   - Test stETH deposits/withdrawals/claims
   - Test LINK functionality (new for mainnet)
   - Test power factor calculations

3. **Cross-Chain Testing**
   - Test reward claiming cross-chain functionality
   - Verify LayerZero integration works

### Phase 4: Deployment & Monitoring
1. **Staged Deployment**
   - Deploy to staging environment first
   - Full functionality testing
   - Performance monitoring

2. **Production Deployment**
   - Deploy during low-traffic period
   - Monitor for any issues
   - Have rollback plan ready

---

## 🎯 Success Metrics

### Technical Metrics
- [ ] All V1 contract functions have V2 equivalents
- [ ] Multi-asset support works on mainnet
- [ ] Cross-chain reward claiming functional
- [ ] Power factor calculations accurate
- [ ] No network-conditional logic remains

### User Experience Metrics  
- [ ] Existing mainnet stETH positions readable
- [ ] New deposits work with V2 contracts
- [ ] LINK staking available on mainnet
- [ ] Reward claiming works seamlessly
- [ ] No disruption to existing users

### Performance Metrics
- [ ] Contract call response times comparable
- [ ] UI loading times unchanged or improved
- [ ] Gas costs reasonable for all operations
- [ ] Cross-chain operations complete successfully

---

## 🔍 Critical Migration Insights

### Key Discovery: Contract Address Continuity ✅
**From Migration Script Analysis:**
```typescript
// The same address serves both roles:
distributionV5Address = '0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790' // V1 original
stETHDepositPool = '0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790'     // V2 upgraded
```

**Implications:**
- **✅ Zero Migration Risk:** Existing user positions preserved
- **✅ No Data Loss:** Same contract, upgraded implementation
- **✅ Seamless Transition:** Users continue using same address
- **⚠️ Frontend Challenge:** Need to update ABI/function calls to V2

### Migration Strategy Update:
1. **Contract migration already completed** via `upgradeTo()` 
2. **Frontend needs to switch** from ERC1967Proxy ABI to DepositPool ABI
3. **Same contract address** for stETH, different ABIs/functions
4. **New contracts** for wBTC, wETH, USDC, USDT at different addresses

---

## ⚠️ Risk Assessment & Mitigation

### High Risk Items (UPDATED)
1. **ABI Function Mapping** ⬆️ INCREASED PRIORITY
   - Risk: V1 → V2 function calls fail due to ABI differences
   - Mitigation: Systematic function mapping and comprehensive testing
   - **Critical:** Same contract address, different function signatures

2. **Multi-Asset Contract Handling**
   - Risk: New asset contracts (wBTC, wETH, etc.) not properly configured
   - Mitigation: Test each asset independently before enabling

3. **User Experience Continuity**
   - Risk: Existing stETH users see disruption during frontend migration  
   - Mitigation: Thorough testing with existing positions

### Medium Risk Items
1. **Multi-Asset Complexity**
   - Risk: New LINK support introduces bugs
   - Mitigation: Gradual rollout, extensive testing

2. **Cross-Chain Dependencies**
   - Risk: LayerZero integration issues
   - Mitigation: Test cross-chain operations thoroughly

### Low Risk Items
1. **UI/UX Changes**
   - Risk: User confusion with new features
   - Mitigation: Maintain familiar interface, add progressive disclosure

2. **Performance Impact**
   - Risk: More contract calls slow down UI
   - Mitigation: Optimize contract call patterns, implement caching

---

## 📝 Post-Migration Cleanup

### Code Cleanup Tasks
1. Remove all `networkEnv === 'mainnet'` conditionals
2. Remove placeholder logic and hardcoded mainnet values
3. Consolidate ABI imports (use V2 ABIs consistently)
4. Remove unused V1 contract logic
5. Update documentation and comments

### Configuration Cleanup
1. Mark V1 contracts as deprecated in config
2. Update GraphQL endpoints if needed
3. Clean up unused environment variables
4. Update CI/CD deployment scripts

---

## 📋 Migration Summary & Next Actions

### ✅ What's Already Done:
1. **All V2 contracts deployed and configured on mainnet**
2. **Existing stETH contract upgraded in-place** (same address, new functionality)
3. **4 new assets deployed**: wBTC, wETH, USDC, USDT with dedicated DepositPool contracts
4. **External integrations configured**: Aave, Chainlink, Uniswap at contract level
5. **Cross-chain infrastructure ready**: L1SenderV2 upgraded and functional

### 🎯 Immediate Frontend Actions Required:

#### Priority 1 - Critical (Existing Users):
1. **Extract deployed contract addresses** from migration script execution logs
2. **Update `config/networks.ts`** with actual V2 contract addresses  
3. **Update stETH contract calls** from ERC1967Proxy ABI to DepositPool ABI
4. **Test existing stETH user positions** work correctly

#### Priority 2 - New Features:
5. **Enable new assets** (wBTC, wETH, USDC, USDT) in asset configuration
6. **Update all modal components** to handle multi-asset V2 contracts
7. **Remove all network conditional logic** (mainnet/testnet differences)
8. **Update hooks** to use V2 contract functions consistently

#### Priority 3 - Enhancement:
9. **Test multi-asset functionality** thoroughly  
10. **Consider UI enhancements** for combined MOR + Aave yield display
11. **Update documentation** and remove outdated V1 references

### 🚨 Critical Success Factor:
The migration is primarily a **frontend code update**, not a contract deployment. All contracts are deployed and functional - the challenge is updating the frontend to use the new V2 interface while maintaining compatibility with existing user positions.

---

This migration plan provides a comprehensive roadmap for updating the frontend to utilize the already-deployed V2 contract architecture on mainnet, enabling multi-asset support, enhanced rewards, and feature parity with testnet.
