# Refactor Builders Testnet from Arbitrum Sepolia to Base Sepolia

## Overview

Replace all Arbitrum Sepolia testnet references with Base Sepolia for builders functionality. This includes switching from Builders/BuilderSubnetsV2 ABIs to BuildersV4/RewardPoolV4 ABIs, updating contract addresses, and modifying all testnet detection logic.

## Key Differences

- **Arbitrum Sepolia**: Uses `BuilderSubnetsV2Abi`, function `stake()`, chain ID 421614
- **Base Sepolia**: Uses `BuildersV4Abi`, function `deposit()`, chain ID 84532, requires RewardPoolV4

## Files to Modify

### 1. Network Configuration

**File**: `config/networks.ts`

- Already has Base Sepolia configured with BuildersV4 and RewardPool addresses
- No changes needed (already completed)

### 2. Contract Address Mappings

**File**: `lib/contracts.ts`

- Update `builderContracts` to include Base Sepolia (84532)
- Update `morTokenContracts` to include Base Sepolia MOR token
- Remove or deprecate Arbitrum Sepolia (421614) entries

### 3. GraphQL Client Configuration

**File**: `app/graphql/client.ts`

- Add Base Sepolia GraphQL endpoint to `GRAPHQL_ENDPOINTS`
- Update `getEndpointForNetwork` to handle 'Base_Sepolia' or 'Base Sepolia'
- Add Base Sepolia to Apollo client setup (if using Apollo)

### 4. Network Detection

**File**: `lib/utils/network-detection.ts`

- Update `SupportedNetwork` type to include 'Base_Sepolia'
- Update `detectBuilderNetwork` to query Base Sepolia GraphQL
- Remove or deprecate Arbitrum Sepolia detection logic

### 5. Contract Interaction Hooks

#### 5.1 Staking Interactions

**File**: `hooks/useStakingContractInteractions.ts`

- Change `isTestnet` detection from `arbitrumSepolia.id` to `baseSepolia.id`
- Replace `BuilderSubnetsV2Abi` import with `BuildersV4Abi`
- Replace `BuilderSubnetsAbi` import with `BuildersV4Abi` (unify for mainnet too)
- Update `getAbi()` to return `BuildersV4Abi` for testnet
- Change function name from `stake()` to `deposit()` for testnet
- Update parameter ordering: `deposit(bytes32 subnetId_, uint256 amount_)` (consistent with mainnet)
- Update claim function: `claim(bytes32 subnetId_, address receiver_)`
- Update user data query: `usersData(address user, bytes32 subnetId)` (consistent with mainnet)
- Remove conditional logic differences between testnet/mainnet

#### 5.2 Subnet Creation

**File**: `hooks/useSubnetContractInteractions.ts`

- Change `isTestnet` detection from `arbitrumSepolia.id` to `baseSepolia.id`
- Replace `BuilderSubnetsV2Abi` with `BuildersV4Abi`
- Update `createSubnet` call to match BuildersV4 signature:
- Function: `createSubnet(Subnet subnet_, SubnetMetadata metadata_)`
- Struct parameters instead of separate args
- Update fee handling (BuildersV4 uses `subnetCreationFeeAmount`)
- Remove conditional createBuilderPool vs createSubnet logic

### 6. Individual Builder Page

**File**: `app/builders/[slug]/page.tsx`

- Change `isTestnet` from `chainId === arbitrumSepolia.id` to `chainId === baseSepolia.id`
- Update contract address resolution to use `testnetChains.baseSepolia`
- Replace `BuilderSubnetsV2Abi` with `BuildersV4Abi`
- Update `useReadContract` call:
- Function: `usersData` (consistent with mainnet)
- Args: `[userAddress, subnetId]` (consistent with mainnet)
- Remove conditional differences between testnet/mainnet
- Update network display logic to show Base Sepolia instead of Arbitrum Sepolia

### 7. New Subnet Creation Page

**File**: `app/builders/newsubnet/page.tsx`

- Change default network from `arbitrumSepolia.id` to `baseSepolia.id` in `getInitialNetworkId()`
- Update supported chains to include `baseSepolia.id` instead of `arbitrumSepolia.id`
- Update network name display/logic

### 8. Subnet Form Components

#### 8.1 Pool Configuration

**File**: `components/subnet-form/Step1PoolConfig.tsx`

- Remove testnet-specific fields if they don't exist in BuildersV4
- Update form validation for BuildersV4 structure
- Ensure form maps correctly to BuildersV4 Subnet struct

#### 8.2 Metadata Step

**File**: `components/subnet-form/Step2ProjectMetadata.tsx`

- Update to match BuildersV4 SubnetMetadata structure
- Ensure slug field works with BuildersV4 requirements

### 9. Staking Modal

**File**: `components/staking/stake-modal.tsx`

- Change `isTestnet` from `chainId === arbitrumSepolia.id` to `chainId === baseSepolia.id`
- Update `targetNetworkInfo` to return Base Sepolia for testnet
- Update subnet ID resolution logic

### 10. Builders List Page

**File**: `app/builders/page.tsx`

- Update `isTestnet` detection to use `baseSepolia.id`
- Update `getSubnetId` helper to use Base Sepolia addresses
- Update network filtering/display logic

### 11. Staking Data Hook

**File**: `hooks/use-staking-data.ts`

- Update GraphQL queries to use Base Sepolia endpoint
- Update network detection logic
- Ensure query structure matches Base Sepolia subgraph schema

### 12. Constants and Utilities

**File**: `components/subnet-form/utils/constants.ts`

- Update `SUPPORTED_CHAINS` to include Base Sepolia
- Remove Arbitrum Sepolia from supported chains (or mark as deprecated)

### 13. Context Files (if applicable)

- Check `context/builders-context.tsx` for Arbitrum Sepolia references
- Check `context/network-context.tsx` for network switching logic
- Update any network-specific logic

### 14. GraphQL Queries

**Files**: `app/graphql/queries/builders.ts` (if exists)

- Ensure queries work with Base Sepolia subgraph
- Verify field names match BuildersV4 contract structure

### 15. Type Definitions

- Check if `app/builders/builders-data.ts` needs updates for Base Sepolia
- Verify Builder type includes Base Sepolia network support

## Implementation Steps

1. **Update network configuration** (already done)
2. **Update contract mappings** in `lib/contracts.ts`
3. **Add Base Sepolia GraphQL endpoint** 
4. **Update network detection** utilities
5. **Refactor contract interaction hooks** (staking and subnet creation)
6. **Update individual builder page** 
7. **Update new subnet creation page**
8. **Update form components**
9. **Update staking modal**
10. **Update builders list page**
11. **Update data fetching hooks**
12. **Test all interactions**: deposit, withdraw, claim, create subnet
13. **Remove or deprecate Arbitrum Sepolia code**

## Testing Checklist

- [ ] Network switching to Base Sepolia works
- [ ] MOR token balance displays correctly
- [ ] Deposit (staking) works with BuildersV4
- [ ] Withdraw works with BuildersV4
- [ ] Claim works with BuildersV4
- [ ] Create subnet works with BuildersV4 signature
- [ ] Subnet metadata editing works
- [ ] User staking data displays correctly
- [ ] GraphQL queries return correct data
- [ ] Network detection identifies Base Sepolia builders
- [ ] All ABIs load correctly (BuildersV4, RewardPoolV4)

## Notes

- Base Sepolia uses BuildersV4 which has a different structure than BuilderSubnetsV2
- BuildersV4 uses `deposit()` instead of `stake()` (consistent with mainnet)
- BuildersV4 uses `usersData()` with consistent parameter order (user first, subnetId second)
- Subnet creation uses structs in BuildersV4 (Subnet and SubnetMetadata)
- RewardPoolV4 may be needed for reward-related queries