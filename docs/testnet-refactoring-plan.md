
## Summary of `isTestnet` Dependencies and Logic

I've analyzed the codebase and identified all dependencies, files, and logic that use the `isTestnet` switch for different contract ABIs. Here's a comprehensive overview:

### 1. **Contract ABIs Currently Used**
- **Testnet (Arbitrum Sepolia)**: `BuilderSubnetsV2.json`
- **Mainnet (Arbitrum & Base)**: `Builders.json`

### 2. **Key Files Using `isTestnet` Logic**

#### **Contract Interaction Hooks**
- `/hooks/useStakingContractInteractions.ts`
- `/hooks/useSubnetContractInteractions.ts`

#### **UI Components**
- `/app/builders/[slug]/page.tsx`
- `/app/builders/newsubnet/page.tsx`
- `/app/builders/page.tsx`
- `/components/staking/stake-modal.tsx`
- `/components/subnet-form/Step1PoolConfig.tsx`
- `/components/subnet-form/Step2ProjectMetadata.tsx`

#### **Data Fetching & Context**
- `/app/hooks/useAllBuildersQuery.ts`
- `/app/hooks/useUserStakedBuilders.ts`
- `/app/hooks/useNetworkInfo.ts`
- `/hooks/use-staking-data.ts`
- `/context/network-context.tsx`

### 3. **Key Differences Between Contracts**

#### **BuilderSubnetsV2 (Testnet)**
- Functions: `createSubnet`, `stake`, `claim`, `withdraw`, `stakers`
- Has subnet creation fee: `subnetCreationFeeAmount`
- Different data structures for subnets
- Uses `getStakerRewards` for claimable amounts

#### **Builders (Mainnet)**
- Functions: `createBuilderPool`, `deposit`, `claim`, `withdraw`, `usersData`
- No subnet creation fee (or fee is 0)
- Different parameter names and order
- Uses `getCurrentBuilderReward` for claimable amounts

## Implementation Plan for Unifying to Use `Builders.json`

### Phase 1: Deploy New Contract on Testnet
1. **Deploy Builders.sol contract to Arbitrum Sepolia**
   - Use the same contract code as mainnet
   - Update the contract address in `/config/networks.ts`

### Phase 2: Update Network Configuration
```typescript
// /config/networks.ts
arbitrumSepolia: {
  ...arbitrumSepolia,
  contracts: {
    morToken: toContract('0x34a285A1B1C166420Df5b6630132542923B5b27E'),
    builders: toContract('0x[NEW_BUILDERS_CONTRACT_ADDRESS]'), // Replace with new address
    // Remove references to subnetFactory and BuilderSubnetsV2
  }
}
```

### Phase 3: Remove `isTestnet` Conditional Logic

#### 3.1 **Update Contract Hooks**
```typescript
// /hooks/useStakingContractInteractions.ts
// Remove all isTestnet conditionals:
- Remove BuilderSubnetsV2Abi import
- Always use BuildersAbi
- Use consistent function names (deposit instead of stake)
- Use consistent parameter ordering
```

#### 3.2 **Update Subnet Creation**
```typescript
// /hooks/useSubnetContractInteractions.ts
// Remove testnet-specific logic:
- Always use createBuilderPool function
- Remove createSubnet function calls
- Unify fee handling (likely 0 for all networks)
```

### Phase 4: Update GraphQL Queries and Data Structures

#### 4.1 **Unify GraphQL Queries**
- Update testnet GraphQL schema to match mainnet structure
- Replace `builderSubnets` with `buildersProjects`
- Update field names to match mainnet

#### 4.2 **Update Data Fetching Logic**
```typescript
// /app/services/buildersService.ts
// Remove isTestnet conditionals in fetchBuildersAPI
// Use same query structure for all networks
```

### Phase 5: Update UI Components

#### 5.1 **Builder Detail Page**
```typescript
// /app/builders/[slug]/page.tsx
// Remove isTestnet conditionals for:
- Contract ABI selection
- Function name selection (stakers vs usersData)
- Parameter ordering
```

#### 5.2 **New Subnet Form**
```typescript
// /app/builders/newsubnet/page.tsx
// /components/subnet-form/Step1PoolConfig.tsx
// Remove testnet-specific fields:
- Remove slug field (testnet only)
- Unify name fields
- Remove fee configuration for testnet
```

### Phase 6: Data Migration

1. **Map existing testnet data to new structure**
   - Convert subnet IDs to builder pool IDs
   - Update field names in database
   - Migrate user stakes to new contract

2. **Update Supabase schema if needed**
   - Ensure consistent field names
   - Remove testnet-specific fields

### Phase 7: Testing Strategy

1. **Deploy to testnet first**
   - Test all staking operations
   - Verify data migration
   - Test subnet creation

2. **Integration tests**
   - Test with both new and existing subnets
   - Verify backwards compatibility
   - Test user stake migrations

### Phase 8: Deployment Steps

1. **Pre-deployment**
   - Backup existing testnet data
   - Prepare migration scripts
   - Update environment variables

2. **Deployment**
   - Deploy new contract
   - Run data migration
   - Update frontend configuration
   - Deploy frontend changes

3. **Post-deployment**
   - Monitor for errors
   - Verify all functions work
   - Check data integrity

### Key Benefits of Unification

1. **Simplified codebase**: Remove ~30-40% of conditional logic
2. **Consistent behavior**: Same contract interface across all networks
3. **Easier maintenance**: Single contract to maintain and audit
4. **Better testing**: Can test same code path on testnet and mainnet

### Potential Challenges

1. **Data migration complexity**: Need to carefully map existing testnet data
2. **Breaking changes**: Existing testnet users will need to migrate
3. **GraphQL schema updates**: May require coordination with subgraph deployment
4. **Gas cost differences**: Testnet and mainnet may have different gas requirements

This refactoring would significantly simplify the codebase by removing the dual contract system and making the testnet a true testing environment for mainnet functionality.