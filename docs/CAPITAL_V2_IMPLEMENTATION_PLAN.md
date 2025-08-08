# Capital V2 Contracts Integration Plan

## Overview

This document outlines the implementation plan for connecting the existing capital UI components (`/components/capital/`) to the new V2 contracts deployed on Ethereum Sepolia testnet. The new architecture introduces multiple asset support (stETH and LINK) and a more modular contract structure.

## Current State Analysis

### Existing Capital Components
- **CapitalInfoPanel** - Shows available assets for staking (currently mock data)
- **ChartSection** - Displays metrics and deposit charts
- **DepositModal** - Handles stETH deposits (single asset)
- **WithdrawModal** - Handles stETH withdrawals
- **ClaimModal** - Handles MOR reward claims
- **ChangeLockModal** - Manages reward multiplier lock periods
- **UserAssetsPanel** - Shows user's staked positions
- **ReferralPanel** - Shows referral statistics
- **DepositStethChart** - Charts deposit history

### Current Contract Integration
- Uses `ERC1967Proxy.json` ABI for main pool contract
- Uses `ERC20.json` for token interactions
- Integrated through `CapitalPageContext` provider
- Functions: `stake`, `withdraw`, `claim`, `getCurrentUserReward`, etc.

### New V2 Contract Structure
The provided ABIs are all ERC1967Proxy contracts, indicating:
- **stETHDepositPoolV2** - Handles stETH deposits and staking
- **LINKDepositPoolV2** - Handles LINK deposits and staking  
- **L1SenderV2** - Manages cross-chain communication to L2
- **DistributorV2** - Manages reward distribution
- **RewardPoolV2** - Handles reward pool operations

## Phase 1: Research and Documentation

### Task 1.1: Contract Interface Discovery
**Priority: High**
**Estimated Time: 1-2 days**

Since the provided ABIs only show proxy contracts, we need to:

1. **Find Implementation Contract ABIs**
   - Research the actual implementation contracts behind each proxy
   - Extract full ABI interfaces from:
     - Etherscan/Sepolia explorer
     - MorpheusAI GitHub repositories
     - Documentation sources

2. **Document Contract Functions**
   - Map current functions to new V2 equivalents:
     - `stake()` → `deposit()` or similar
     - `withdraw()` → New withdrawal mechanism
     - `claim()` → New claim through DistributorV2
     - User data queries → New getter functions

3. **Identify Key Differences**
   - Multi-asset support (stETH + LINK)
   - Separation of concerns (deposit pools, distributor, reward pool)
   - New parameters/requirements
   - Cross-chain integration patterns

### Task 1.2: Contract Address Configuration
**Priority: High**
**Estimated Time: 0.5 days**

Update `config/networks.ts` with Sepolia testnet V2 addresses:

```typescript
// Add to sepolia config
contracts: {
  // V2 Contracts
  stETHDepositPoolV2: '0x...',
  linkDepositPoolV2: '0x...',
  l1SenderV2: '0x...',
  distributorV2: '0x...',
  rewardPoolV2: '0x...',
  
  // Token contracts
  stETH: '0x...',
  link: '0x...',
  mor: '0x...' // Arbitrum address for claims
}
```

## Phase 2: ABI and Type Updates

### Task 2.1: Update Contract ABIs
**Priority: High**
**Estimated Time: 1 day**

1. **Replace Proxy ABIs with Implementation ABIs**
   - `app/abi/stETHDepositPoolV2.json` → Full implementation ABI
   - `app/abi/LINKDepositPoolV2.json` → Full implementation ABI
   - `app/abi/DistributorV2.json` → Full implementation ABI
   - `app/abi/RewardPoolV2.json` → Full implementation ABI
   - `app/abi/L1SenderV2.json` → Full implementation ABI

2. **Add New Token ABIs**
   - LINK token ABI if not already present
   - Update MOR token ABI if needed for V2 integration

### Task 2.2: TypeScript Type Generation
**Priority: Medium**
**Estimated Time: 0.5 days**

Generate TypeScript types for new contracts:
```bash
# Add to build process or run manually
wagmi generate
```

Update `app/graphql/types.ts` with new contract data structures.

## Phase 3: Context and State Management Updates

### Task 3.1: Enhance CapitalPageContext
**Priority: High**
**Estimated Time: 2-3 days**

**Current Context Issues to Address:**
- Single asset assumption (stETH only)
- Direct contract interactions
- V1 contract function names

**Required Changes:**

1. **Multi-Asset State Management**
```typescript
interface AssetData {
  symbol: 'stETH' | 'LINK';
  contractAddress: `0x${string}`;
  userBalance: bigint;
  userDeposited: bigint;
  apy: string;
  totalDeposited: bigint;
  allowance: bigint;
}

interface CapitalContextState {
  // Asset-specific data
  assets: Record<'stETH' | 'LINK', AssetData>;
  selectedAsset: 'stETH' | 'LINK';
  setSelectedAsset: (asset: 'stETH' | 'LINK') => void;
  
  // V2 Contract addresses
  stETHDepositPool: `0x${string}`;
  linkDepositPool: `0x${string}`;
  distributorV2: `0x${string}`;
  rewardPoolV2: `0x${string}`;
  l1SenderV2: `0x${string}`;
  
  // Updated function signatures
  depositToPool: (asset: 'stETH' | 'LINK', amount: string) => Promise<void>;
  withdrawFromPool: (asset: 'stETH' | 'LINK', amount: string) => Promise<void>;
  claimFromDistributor: () => Promise<void>;
  
  // ... existing properties with V2 updates
}
```

2. **Contract Read Operations Update**
```typescript
// Replace single contract reads with multi-contract reads
const { data: stETHPoolData } = useReadContract({
  address: stETHDepositPool,
  abi: stETHDepositPoolV2Abi,
  functionName: 'getPoolInfo', // V2 function name
  // ...
});

const { data: linkPoolData } = useReadContract({
  address: linkDepositPool, 
  abi: linkDepositPoolV2Abi,
  functionName: 'getPoolInfo', // V2 function name
  // ...
});
```

3. **Contract Write Operations Update**
```typescript
// Update function calls for V2 contracts
const depositToPool = useCallback(async (asset: 'stETH' | 'LINK', amount: string) => {
  const poolAddress = asset === 'stETH' ? stETHDepositPool : linkDepositPool;
  const poolABI = asset === 'stETH' ? stETHDepositPoolV2Abi : linkDepositPoolV2Abi;
  
  await handleTransaction(() => writeContract({
    address: poolAddress,
    abi: poolABI,
    functionName: 'deposit', // V2 function name
    args: [parseUnits(amount, 18), userAddress], // V2 parameters
    chainId: l1ChainId,
  }), {
    loading: `Depositing ${amount} ${asset}...`,
    success: `Successfully deposited ${amount} ${asset}!`,
    error: `${asset} deposit failed`
  });
}, [/* deps */]);
```

## Phase 4: Component Updates

### Task 4.1: Update CapitalInfoPanel
**Priority: High**
**Estimated Time: 1 day**

**Changes Required:**
1. **Dynamic Asset Loading**
   - Replace mock asset data with real V2 contract data
   - Support both stETH and LINK with real APY calculations
   - Real-time total staked amounts from deposit pools

2. **Updated Asset Table**
```typescript
// Replace mock data with:
const assets: Asset[] = [
  {
    symbol: "stETH",
    apy: stETHPoolData?.currentAPY || "0%",
    totalStaked: formatUnits(stETHPoolData?.totalDeposited || 0, 18),
    icon: "eth"
  },
  {
    symbol: "LINK", 
    apy: linkPoolData?.currentAPY || "0%",
    totalStaked: formatUnits(linkPoolData?.totalDeposited || 0, 18),
    icon: "link"
  }
];
```

### Task 4.2: Enhance DepositModal
**Priority: High**
**Estimated Time: 2 days**

**New Features:**
1. **Asset Selection**
   - Add asset selector (stETH/LINK tabs or dropdown)
   - Dynamic balance and validation based on selected asset
   - Asset-specific minimum deposit amounts

2. **V2 Contract Integration**
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  // Determine which pool to deposit to
  const poolAddress = selectedAsset === 'stETH' ? stETHDepositPool : linkDepositPool;
  const tokenAddress = selectedAsset === 'stETH' ? stETHContract : linkContract;
  
  try {
    // Step 1: Approve if needed
    if (needsApproval) {
      await approveToken(selectedAsset, amount);
    }
    
    // Step 2: Deposit to appropriate pool
    await depositToPool(selectedAsset, amount);
    
    setActiveModal(null);
  } catch (error) {
    handleError(error);
  }
};
```

### Task 4.3: Update WithdrawModal
**Priority: High**
**Estimated Time: 1 day**

**Changes:**
1. **Asset-Specific Withdrawals**
   - Show deposited amounts per asset
   - Allow withdrawal from specific deposit pools
   - Asset selection in modal

2. **V2 Withdrawal Logic**
   - Update to use new withdrawal functions
   - Handle new lock periods/requirements
   - Multi-pool withdrawal support

### Task 4.4: Update ClaimModal
**Priority: High**
**Estimated Time: 1.5 days**

**Major Changes:**
1. **DistributorV2 Integration**
   - Claims now go through DistributorV2 contract
   - May require different parameters/flow
   - Update reward calculation queries

2. **Cross-Chain Considerations**
   - Ensure proper L1→L2 flow for MOR claims
   - L1SenderV2 integration if needed
   - Update claim destination logic

### Task 4.5: Update ChangeLockModal  
**Priority: Medium**
**Estimated Time: 1 day**

**Updates:**
1. **V2 Lock Mechanism**
   - Update to use RewardPoolV2 or DistributorV2 lock functions
   - New multiplier calculation methods
   - Updated lock period management

### Task 4.6: Enhance UserAssetsPanel
**Priority: Medium**
**Estimated Time: 1.5 days**

**Enhancements:**
1. **Multi-Asset Position Display**
   - Show stETH and LINK positions separately
   - Asset-specific metrics (staked, available, daily emissions)
   - Power factor per asset type

2. **Updated Data Queries**
   - Query both deposit pools for user data
   - Aggregate total staked value across assets
   - Asset-specific action buttons

### Task 4.7: Update ChartSection
**Priority: Low**
**Estimated Time: 1 day**

**Updates:**
1. **Multi-Asset Chart Data**
   - Combined or separate charts for stETH/LINK
   - Updated GraphQL queries for V2 data
   - New metric calculations from V2 contracts

## Phase 5: Testing and Validation

### Task 5.1: Unit Testing
**Priority: High**
**Estimated Time: 2 days**

1. **Context Testing**
   - Test multi-asset state management
   - Mock V2 contract interactions
   - Validate error handling

2. **Component Testing**
   - Test asset selection functionality
   - Validate form inputs and validations
   - Test modal workflows

### Task 5.2: Integration Testing
**Priority: High** 
**Estimated Time: 3 days**

1. **Sepolia Testnet Testing**
   - Test all deposit/withdrawal flows
   - Validate claim functionality
   - Test lock period changes
   - Cross-asset interactions

2. **Error Scenario Testing**
   - Network switching
   - Insufficient balances
   - Contract failures
   - Transaction reverts

## Phase 6: Documentation and Deployment

### Task 6.1: Update Documentation
**Priority: Medium**
**Estimated Time: 1 day**

1. **Update Component Documentation**
   - Document V2 contract integration
   - Update API documentation
   - Create migration guide from V1 to V2

2. **Update README/CHANGELOG**
   - Document breaking changes
   - Update setup instructions
   - Add V2 contract information

### Task 6.2: Deployment Preparation
**Priority: High**
**Estimated Time: 0.5 days**

1. **Environment Configuration**
   - Update environment variables
   - Configure Sepolia RPC endpoints
   - Set up contract addresses

2. **Build and Deploy**
   - Test production build
   - Deploy to staging environment
   - Validate on Sepolia testnet

## Timeline Estimate

| Phase | Tasks | Estimated Time | Dependencies |
|-------|-------|---------------|--------------|
| Phase 1 | Research & Documentation | 2-3 days | External research |
| Phase 2 | ABI & Type Updates | 1.5 days | Phase 1 complete |
| Phase 3 | Context Updates | 2-3 days | Phase 2 complete |
| Phase 4 | Component Updates | 7-8 days | Phase 3 complete |
| Phase 5 | Testing | 5 days | Phase 4 complete |
| Phase 6 | Documentation & Deploy | 1.5 days | Phase 5 complete |

**Total Estimated Time: 19-22 days**

## Risk Assessment

### High Risk
1. **Unknown V2 Contract Interfaces** - May require significant architecture changes
2. **Cross-Chain Integration Complexity** - L1→L2 flows may be complex
3. **Multi-Asset State Management** - Complex state coordination

### Medium Risk  
1. **GraphQL Schema Changes** - May need significant query updates
2. **Testing on Sepolia** - Limited testnet liquidity/conditions
3. **Breaking Changes** - May affect other parts of application

### Low Risk
1. **UI/UX Changes** - Mostly additive functionality
2. **Documentation Updates** - Straightforward documentation tasks

## Questions and Clarifications Needed

### Contract Interface Questions
1. **What are the exact function signatures for V2 deposit pools?**
   - Deposit function parameters
   - Withdrawal mechanisms
   - User data query functions
   - Event structures

2. **How does the DistributorV2 work?**
   - Claim function interface
   - Reward calculation methods
   - Integration with L1SenderV2

3. **What is the L1SenderV2 role?**
   - When is it used in the flow?
   - Does it affect deposits/withdrawals?
   - Cross-chain message format

4. **RewardPoolV2 functionality?**
   - How does it differ from DistributorV2?
   - Lock period management
   - Multiplier calculations

### Implementation Questions
1. **Are there any GraphQL schema changes needed?**
   - New event structures to index
   - Additional data fields
   - Query pattern changes

2. **What are the Sepolia testnet contract addresses?**
   - All V2 contract addresses
   - Token contract addresses (stETH, LINK, MOR)
   - Any test token faucets available

3. **Are there any new parameters or requirements?**
   - Referral system changes
   - Lock period modifications
   - Fee structures

4. **Is there a migration strategy for existing users?**
   - How do V1 positions transfer to V2?
   - Backward compatibility requirements
   - User notification needs

### Testing Questions  
1. **What is the expected user flow on testnet?**
   - How to get test stETH/LINK tokens?
   - Expected gas costs and transaction times
   - Any testnet-specific considerations

2. **Are there any special testing scenarios?**
   - Multi-asset edge cases
   - Cross-chain failure scenarios
   - Contract upgrade scenarios

## Success Criteria

1. **Functional Requirements**
   - ✅ Users can deposit both stETH and LINK
   - ✅ Users can withdraw from both pools  
   - ✅ Users can claim MOR rewards through V2 flow
   - ✅ Users can modify lock periods for multipliers
   - ✅ Real-time data displays correctly for both assets

2. **Technical Requirements**
   - ✅ All V2 contracts properly integrated
   - ✅ Multi-asset state management working
   - ✅ Error handling for all edge cases
   - ✅ Proper loading and transaction states
   - ✅ Cross-chain functionality working

3. **User Experience Requirements**
   - ✅ Intuitive asset selection
   - ✅ Clear asset-specific information
   - ✅ Smooth modal workflows
   - ✅ Proper error messages and guidance
   - ✅ Responsive design maintained

## Next Steps

1. **Immediate Actions (Next 2 days)**
   - Research V2 contract implementation interfaces
   - Gather Sepolia testnet contract addresses
   - Document exact function signatures and parameters

2. **Week 1 Goals**
   - Complete Phase 1 and 2 (Research and ABI updates)
   - Begin Phase 3 (Context updates)
   - Set up development environment for Sepolia testing

3. **Week 2-3 Goals**  
   - Complete Phase 3 and 4 (Context and component updates)
   - Begin integration testing on Sepolia
   - Address any discovered contract interface issues

4. **Week 4 Goals**
   - Complete testing and validation
   - Finalize documentation
   - Prepare for deployment

This implementation plan provides a comprehensive roadmap for integrating the capital UI components with the V2 contracts while maintaining code quality and user experience. 