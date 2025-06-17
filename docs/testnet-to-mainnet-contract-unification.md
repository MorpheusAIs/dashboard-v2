# Testnet to Mainnet Contract Unification Analysis

## Summary of `isTestnet` Dependencies and Logic

### 1. Contract ABIs Currently Used

- **Testnet (Arbitrum Sepolia)**: `BuilderSubnetsV2.json`
- **Mainnet (Arbitrum & Base)**: `Builders.json`

### 2. Key Files Using `isTestnet` Logic

#### Contract Interaction Hooks
- `/hooks/useStakingContractInteractions.ts`
  - Uses conditional ABI selection: `isTestnet ? BuilderSubnetsV2Abi : BuildersAbi`
  - Different function names: `stake` (testnet) vs `deposit` (mainnet)
  - Different parameter ordering for read/write operations
  - Different claimable amount functions: `getStakerRewards` vs `getCurrentBuilderReward`

- `/hooks/useSubnetContractInteractions.ts`
  - Subnet creation: `createSubnet` (testnet) vs `createBuilderPool` (mainnet)
  - Fee handling: testnet has `subnetCreationFeeAmount`, mainnet has no fee or 0 fee
  - Different contract structure and parameters

#### UI Components
- `/app/builders/[slug]/page.tsx`
  - Conditional contract ABI loading
  - Different read functions: `stakers` vs `usersData`
  - Network-based redirection logic
  - Different parameter structures for staking data

- `/app/builders/newsubnet/page.tsx`
  - Form field differences based on network
  - Different validation rules for testnet/mainnet

- `/app/builders/page.tsx`
  - Network-specific builder list handling
  - Different subnet ID resolution logic

- `/components/staking/stake-modal.tsx`
  - Network-specific subnet ID determination

- `/components/subnet-form/Step1PoolConfig.tsx`
  - Different form fields: testnet has `slug`, fee configuration
  - Name field mapping: `subnet.name` vs `builderPool.name`

- `/components/subnet-form/Step2ProjectMetadata.tsx`
  - Testnet-specific slug field handling

#### Data Fetching & Context
- `/app/hooks/useAllBuildersQuery.ts`
  - Different GraphQL queries for testnet vs mainnet
  - Different data structures and response handling

- `/app/hooks/useUserStakedBuilders.ts`
  - Testnet uses context builders, mainnet uses GraphQL query
  - Different data filtering logic

- `/app/hooks/useNetworkInfo.ts`
  - Central place for `isTestnet` boolean determination

- `/hooks/use-staking-data.ts`
  - Different GraphQL queries: `builderSubnets` vs `buildersProjects`
  - Different query variables and response structures

- `/context/network-context.tsx`
  - Network environment determination
  - API endpoint selection based on network

### 3. Key Differences Between Contracts

#### BuilderSubnetsV2 (Testnet)
```solidity
// Main functions
createSubnet(Subnet memory subnet, SubnetMetadata memory metadata)
stake(bytes32 subnetId, address stakerAddress, uint256 amount, uint128 claimLockEnd)
claim(bytes32 subnetId, address stakerAddress)
withdraw(bytes32 subnetId, uint256 amount)
stakers(bytes32 subnetId, address stakerAddress) // returns staker info

// Additional features
subnetCreationFeeAmount() // returns fee amount
getStakerRewards(bytes32 subnetId, address stakerAddress) // returns claimable amount
```

#### Builders (Mainnet)
```solidity
// Main functions
createBuilderPool(BuilderPool memory pool)
deposit(bytes32 poolId, uint256 amount)
claim(bytes32 poolId, address receiver)
withdraw(bytes32 poolId, uint256 amount)
usersData(address user, bytes32 poolId) // returns user data

// Additional features
getCurrentBuilderReward(bytes32 poolId) // returns claimable amount
// No creation fee function (fee is 0 on mainnet)
```

### 4. Data Structure Differences

#### Testnet (BuilderSubnetsV2)
- Uses `Subnet` struct with fields: name, owner, minStake, fee, feeTreasury, startsAt, withdrawLockPeriodAfterStake, maxClaimLockEnd
- Has `SubnetMetadata` with: slug, description, website, image
- Staker data includes: staked, virtualStaked, pendingRewards, rate, lastStake, claimLockEnd

#### Mainnet (Builders)
- Uses `BuilderPool` struct with fields: name, admin, poolStart, withdrawLockPeriodAfterDeposit, claimLockEnd, minimalDeposit
- No separate metadata struct
- User data includes: lastDeposit, claimLockStart, deposited, virtualDeposited

## Implementation Plan for Unifying to Use `Builders.json`

### Phase 1: Deploy New Contract on Testnet

1. **Deploy Builders.sol contract to Arbitrum Sepolia**
   - Use the exact same contract code as mainnet
   - Update deployment scripts to target Arbitrum Sepolia
   - Verify contract on Arbiscan Sepolia

2. **Update contract address in configuration**
   ```typescript
   // /config/networks.ts
   arbitrumSepolia: {
     ...arbitrumSepolia,
     contracts: {
       morToken: toContract('0x34a285A1B1C166420Df5b6630132542923B5b27E'),
       builders: toContract('0x[NEW_BUILDERS_CONTRACT_ADDRESS]'), // New unified contract
       // Remove: subnetFactory, l2Factory (if not needed)
     }
   }
   ```

### Phase 2: Remove `isTestnet` Conditional Logic

#### 2.1 Update Contract Interaction Hooks

**File: `/hooks/useStakingContractInteractions.ts`**
```typescript
// Remove imports
- import BuilderSubnetsV2Abi from '@/app/abi/BuilderSubnetsV2.json';
- import BuilderSubnetsAbi from '@/app/abi/BuilderSubnets.json';

// Keep only
+ import BuildersAbi from '@/app/abi/Builders.json';

// Remove conditional ABI selection
- const getAbi = useCallback(() => {
-   return isTestnet ? BuilderSubnetsV2Abi : BuilderSubnetsAbi;
- }, [isTestnet]);

// Update all contract calls to use BuildersAbi
// Change 'stake' to 'deposit' for all networks
// Unify parameter ordering
```

**File: `/hooks/useSubnetContractInteractions.ts`**
```typescript
// Remove BuilderSubnetsV2Abi import
- import BuilderSubnetsV2Abi from '@/app/abi/BuilderSubnetsV2.json';

// Remove conditional subnet creation
- if (isMainnet) {
-   // createBuilderPool logic
- } else {
-   // createSubnet logic
- }

// Use only createBuilderPool for all networks
+ writeContract({
+   address: builderContractAddress,
+   abi: BuildersAbi,
+   functionName: 'createBuilderPool',
+   args: [builderPoolTuple],
+   chainId: selectedChainId,
+ });
```

#### 2.2 Update UI Components

**File: `/app/builders/[slug]/page.tsx`**
```typescript
// Remove conditional imports and logic
- import BuilderSubnetsV2Abi from '@/app/abi/BuilderSubnetsV2.json';

// Remove all isTestnet conditionals
- abi: isTestnet ? BuilderSubnetsV2Abi : BuildersAbi,
+ abi: BuildersAbi,

- functionName: isTestnet ? 'stakers' : 'usersData',
+ functionName: 'usersData',

// Unify parameter ordering
- args: subnetId && userAddress ? [isTestnet ? subnetId : userAddress, isTestnet ? userAddress : subnetId] : undefined,
+ args: [userAddress, subnetId],
```

### Phase 3: Update GraphQL Schema and Queries

#### 3.1 Deploy New Subgraph for Testnet
- Update subgraph schema to match mainnet structure
- Replace `builderSubnets` with `buildersProjects`
- Update entity names and field mappings

#### 3.2 Update GraphQL Queries
```typescript
// Remove testnet-specific queries
- export const GET_BUILDER_SUBNET_USERS = `...`
- export const GET_BUILDER_SUBNET_BY_NAME = `...`
- export const COMBINED_BUILDER_SUBNETS = `...`

// Use mainnet queries for all networks
+ export const GET_BUILDERS_PROJECT_USERS = `...` // Same for all networks
```

### Phase 4: Update Data Services

**File: `/app/services/buildersService.ts`**
```typescript
// Remove isTestnet parameter and conditionals
export const fetchBuildersAPI = async (
  userAddress: string | null,
  supabaseBuilders: BuilderDB[] | null
): Promise<Builder[]> => {
  // Remove testnet-specific logic
  // Use same query structure for all networks
}
```

### Phase 5: Form and UI Updates

#### 5.1 Update Subnet Creation Form

**File: `/components/subnet-form/Step1PoolConfig.tsx`**
```typescript
// Remove testnet-specific fields
- {isTestnet && (
-   <FormField name="subnet.slug" ... />
- )}

// Unify name fields
- name={isTestnet ? "subnet.name" : "builderPool.name"}
+ name="builderPool.name"

// Remove fee configuration for testnet
- {isTestnet && (
-   <FormField name="subnet.fee" ... />
-   <FormField name="subnet.feeTreasury" ... />
- )}
```

### Phase 6: Data Migration Strategy

#### 6.1 Pre-Migration Steps
1. **Export existing testnet data**
   ```sql
   -- Export all subnet data
   SELECT * FROM builder_subnets WHERE network = 'Arbitrum Sepolia';
   
   -- Export all user stakes
   SELECT * FROM builder_users WHERE network = 'Arbitrum Sepolia';
   ```

2. **Create mapping table**
   ```typescript
   // Map old subnet IDs to new builder pool IDs
   const subnetIdMapping = {
     '0xOldSubnetId1': '0xNewPoolId1',
     '0xOldSubnetId2': '0xNewPoolId2',
     // ...
   };
   ```

#### 6.2 Migration Script
```typescript
// Example migration script
async function migrateTestnetData() {
  // 1. Deploy new pools for each existing subnet
  for (const subnet of existingSubnets) {
    const poolData = {
      name: subnet.name,
      admin: subnet.owner,
      poolStart: subnet.startsAt,
      withdrawLockPeriodAfterDeposit: subnet.withdrawLockPeriodAfterStake,
      claimLockEnd: subnet.maxClaimLockEnd,
      minimalDeposit: subnet.minStake
    };
    
    await createBuilderPool(poolData);
  }
  
  // 2. Migrate user stakes
  for (const userStake of existingStakes) {
    await migrateUserStake(userStake, subnetIdMapping);
  }
}
```

### Phase 7: Testing Plan

#### 7.1 Unit Tests
- Test all contract functions with unified ABI
- Verify parameter ordering and return values
- Test edge cases and error handling

#### 7.2 Integration Tests
```typescript
describe('Unified Contract Integration', () => {
  it('should create builder pool on testnet', async () => {
    // Test pool creation
  });
  
  it('should handle deposits correctly', async () => {
    // Test staking/deposit
  });
  
  it('should migrate existing stakes', async () => {
    // Test migration logic
  });
});
```

#### 7.3 E2E Tests
- Test complete user flows on testnet
- Verify UI behaves correctly without isTestnet conditionals
- Test data consistency after migration

### Phase 8: Deployment Checklist

#### Pre-Deployment
- [ ] Backup all testnet data
- [ ] Deploy new contract to testnet
- [ ] Update subgraph and wait for indexing
- [ ] Run migration scripts in test environment
- [ ] Update environment variables
- [ ] Code review all changes

#### Deployment Steps
1. **Infrastructure**
   - [ ] Deploy new contract
   - [ ] Verify contract on explorer
   - [ ] Deploy updated subgraph
   
2. **Frontend**
   - [ ] Update configuration files
   - [ ] Deploy frontend to staging
   - [ ] Run smoke tests
   - [ ] Deploy to production

3. **Data Migration**
   - [ ] Run migration script
   - [ ] Verify data integrity
   - [ ] Update database indices

#### Post-Deployment
- [ ] Monitor error logs
- [ ] Check user transactions
- [ ] Verify GraphQL queries
- [ ] Test all user flows
- [ ] Monitor gas usage

### Benefits of Unification

1. **Code Simplification**
   - Remove ~500+ lines of conditional logic
   - Single code path for all networks
   - Easier to understand and maintain

2. **Consistency**
   - Same behavior on testnet and mainnet
   - Better testing confidence
   - Reduced chance of network-specific bugs

3. **Development Speed**
   - Faster feature development
   - Simpler debugging
   - Better developer experience

4. **Maintenance**
   - Single contract to audit
   - Unified documentation
   - Simpler deployment process

### Potential Risks and Mitigations

1. **Data Loss Risk**
   - **Mitigation**: Comprehensive backups before migration
   - Keep old contract active during transition
   - Implement rollback plan

2. **User Disruption**
   - **Mitigation**: Clear communication about migration
   - Provide migration UI if needed
   - Support both contracts temporarily

3. **Gas Cost Differences**
   - **Mitigation**: Analyze gas usage on testnet
   - Optimize contract calls if needed
   - Monitor costs post-deployment

4. **Integration Issues**
   - **Mitigation**: Extensive testing on testnet
   - Gradual rollout with feature flags
   - Monitor all integrations closely

### Timeline Estimate

- **Week 1**: Contract deployment and configuration updates
- **Week 2**: Code refactoring to remove isTestnet logic
- **Week 3**: GraphQL updates and testing
- **Week 4**: Data migration and final testing
- **Week 5**: Production deployment and monitoring

### Conclusion

Unifying the testnet to use the same contract as mainnet will significantly simplify the codebase, improve maintainability, and provide better testing confidence. While the migration requires careful planning and execution, the long-term benefits far outweigh the short-term effort required.