# Capital V2 Contracts Integration Plan

## Overview

This document outlines the implementation plan for connecting the existing capital UI components (`/components/capital/`) to the new V2 contracts deployed on Ethereum Sepolia testnet. The new architecture introduces multiple asset support (stETH and LINK) and a more modular contract structure.

## ✅ **CONFIRMED Contract Addresses & Architecture**

### **Proxy → Implementation Mapping:**
- **stETH Deposit Pool**: `0xFea33A23F97d785236F22693eDca564782ae98d0` (proxy) → `DepositPool.json` (impl: `0xfc088c5ec4288a3b337c6b93968e521aaf06f346`)
- **LINK Deposit Pool**: `0x7f4f17be21219D7DA4C8E0d0B9be6a778354E5A5` (proxy) → `DepositPool.json` (impl: `0xfc088c5ec4288a3b337c6b93968e521aaf06f346`)  
- **Distributor**: `0x65b8676392432B1cBac1BE4792a5867A8CA2f375` (proxy) → `DistributorV2.json` (impl: `0xab64f40c8c21e220358cb5ba6f2896376b45c911`)
- **Reward Pool**: `0xbFDbe9c7E6c8bBda228c6314E24E9043faeEfB32` (proxy) → `RewardPoolV2.json` (impl: `0xcf293ae0c55ef926283e48d905537c818071960b`)
- **L1 Sender**: `0x85e398705d7D77F1703b61DD422869A67B3B409d` (proxy) → `L1SenderV2.json` (impl: `0xddb80d5bce57adf40081ca4c76678f64497c89cc`)

### **Token Addresses:**
- **stETH**: Using existing config address
- **LINK**: `0x779877A7B0D9E8603169DdbD7836e478b4624789` ✅

### **Key Architecture Insight:** 
Both stETH and LINK pools use the **same `DepositPool.json` ABI** - this significantly simplifies the implementation!

## 🔍 **Questions Answered**

### **Q: How to determine `rewardPoolIndex`?**

**A:** Query the deposit pool contracts directly:
```typescript
// Test with index 0 first (most likely for main public pools)
const poolData = await depositPool.read.rewardPoolsData([0]);
const poolDetails = await depositPool.read.rewardPoolsProtocolDetails([0]);

// If these return valid data (non-zero values), then rewardPoolIndex = 0
// If they revert or return empty data, try index 1, 2, etc.
```

**Implementation approach:**
1. Test `rewardPoolIndex = 0` on both stETH and LINK deposit pools
2. Check recent transactions on Sepolia Etherscan for these contracts to see what pool IDs are being used
3. Add to config once confirmed

### **Q: Does `claim()` automatically trigger cross-chain?**

**A:** From the contract ABIs, the flow appears to be:
```
DepositPool.claim(poolId, receiver) 
  ↓ (automatic)
DistributorV2.sendMintMessage()
  ↓ (automatic)  
L1SenderV2.sendMintMessage()
  ↓ (LayerZero)
L2 MOR minting
```

**Key observations:**
- `claim()` is **`payable`** - requires ETH for cross-chain gas
- Internal calls to Distributor and L1Sender appear automatic
- **Need to confirm with smart contract devs:**
  - How much ETH to send with `claim()` calls?
  - Which L2 network receives the MOR tokens?
  - Is the full flow automatic or are there separate steps?

## 📋 **Updated Implementation Phases**

### **✅ Phase 1: Research & Documentation** 
- ✅ Contract addresses confirmed
- ✅ ABI mappings confirmed  
- ✅ Token addresses confirmed
- 🔄 Need to confirm `rewardPoolIndex` values
- 🔄 Need to confirm claim flow details with devs

### **✅ Phase 2: Config Updates**
- ✅ Added V2 contract addresses to `config/networks.ts`
- ✅ Added LINK token address
- ✅ Updated interface documentation

### **✅ Phase 3: Context Updates** 
- ✅ Added asset types, V2 contract addresses, multi-asset infrastructure
- ✅ Added V2 DepositPool contract reads for both stETH and LINK pools
- ✅ Confirmed rewardPoolIndex = 0 on live testnet
- ✅ Integrated multiplier estimation functionality

### **🚀 Phase 4: UI Component Updates** (IN PROGRESS)

**4.1 ✅ DepositModal V2 Update** (COMPLETED)
- ✅ Added asset selection dropdown (stETH/LINK)
- ✅ Integrated V2 `deposit(asset, amount)` function 
- ✅ Added referrer address field (optional)
- ✅ Added time lock period selection with units
- ✅ Added summary section showing:
  - Stake amount and selected asset
  - Calculated unlock date
  - Live power factor from multiplier estimation
  - Placeholder for estimated rewards
- ✅ **Updated styling to match withdraw-modal.tsx** (`bg-background border-gray-800`, `text-emerald-400` title)
- ✅ Approval flow for both stETH and LINK
- ✅ Form validation and error handling
- ✅ **Fixed dropdown selection issue** - Added proper z-index and hover states
- ✅ **Added TokenIcon integration** - Using same icons as capital-info-panel.tsx

**4.1.1 ✅ StakeModal Styling Update** (COMPLETED)  
- ✅ **Updated to match withdraw-modal.tsx pattern** (`bg-background border-gray-800`)
- ✅ Consistent form styling with `bg-background border-gray-700` inputs
- ✅ Standard Max button styling (`h-7 px-2 text-xs`)
- ✅ Emerald-400 title and consistent spacing (`space-y-4 pt-4`)
- ✅ Proper background opacity for info sections (`bg-gray-800/30`)
- ✅ Removed custom dark theme - using app's standard styling

**4.2 ClaimModal V2 Update** (Next)
- Update for cross-chain claim flow with ETH gas handling
- Aggregate claims from both stETH and LINK pools
- Handle V2 `claim()` payable function

**4.3 CapitalInfoPanel V2 Update** (Pending)
- Display both stETH and LINK assets with V2 data
- Show combined portfolio value
- Update APY calculations from V2 contracts

### **Phase 5: Testing & Validation**
- Test with actual Sepolia testnet contracts
- Validate cross-chain claim flows
- Test error handling and edge cases

### **Phase 6: Documentation & Deployment**  
- Update component documentation
- Deploy to staging environment
- User acceptance testing

## ⚠️ **Outstanding Questions for Smart Contract Devs**

1. **Confirm `rewardPoolIndex`**: Is it `0` for both stETH and LINK main public pools?
2. **Cross-chain gas requirements**: How much ETH should be sent with `claim()` calls?
3. **✅ L2 destination**: ~~Which network receives the MOR tokens? (Arbitrum Sepolia?)~~ **CONFIRMED: Arbitrum Sepolia**
4. **Error handling**: What errors should we expect and handle in the UI?
5. **Rate limiting**: Any restrictions on deposit/withdraw/claim frequency?

## 🎯 **Next Steps**

1. **✅ Complete CapitalPageContext V2 integration** - Added asset types, V2 contract addresses, multi-asset infrastructure
2. **🚀 Test `rewardPoolIndex` discovery** on both deposit pools (CURRENT)
3. **Add V2 contract reads** for both stETH and LINK pools using DepositPool ABI
4. **Reach out to smart contract team** for remaining clarifications (gas requirements, pool index)
5. **Begin UI component updates** once context is stable

---

## 📈 **Success Metrics**

- [ ] Both stETH and LINK deposits working on testnet
- [ ] Cross-chain claims successfully delivering MOR to **Arbitrum Sepolia** ✅ 
- [ ] UI properly displays multi-asset portfolio
- [ ] Error handling gracefully manages edge cases
- [ ] Performance remains smooth with multi-asset data loading

**Estimated Completion**: 5-7 days from context completion 