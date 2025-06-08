# Fix: Immediate Visibility of Newly Created Subnets

## Problem
When users create a new subnet on mainnet networks (Arbitrum or Base), they can't see the new subnet immediately in the "Your Subnets" tab because:

1. New subnet data is stored in Supabase immediately ✅
2. But GraphQL queries depend on builder names from morlord JSON file ❌
3. Morlord JSON file only refreshes every 10 minutes ❌
4. So new subnets don't appear until the next morlord refresh ❌
5. **ADDITIONAL ISSUE**: Even if the subnet name is cached, the GraphQL query might not find on-chain data yet, so the `admin` field is null and the subnet won't show in "Your Subnets" ❌

## Solution
Implemented a local caching mechanism with admin address tracking to store newly created subnet names and temporarily populate the admin field until indexer picks up the on-chain data.

### Files Modified

#### 1. `app/hooks/useNewlyCreatedSubnets.ts` (New)
- Manages newly created subnet names in localStorage with admin addresses
- Auto-expires entries after 15 minutes
- Provides cleanup when names appear in official morlord data
- Functions:
  - `addNewlyCreatedSubnet(name, network, adminAddress)` - Add new subnet with admin to cache
  - `getNewlyCreatedSubnetNames()` - Get cached names for queries
  - `getNewlyCreatedSubnetAdmin(subnetName)` - Get admin address for specific subnet
  - `cleanupExistingSubnets(officialNames)` - Remove cached names that now exist in morlord

#### 2. `app/hooks/useAllBuildersQuery.ts` (Modified)
- Integrated newly created subnets hook
- Combines morlord names with cached newly created names
- Uses combined list for GraphQL queries
- Automatically cleans up cache when names appear in morlord data
- Passes admin lookup function to buildersService

#### 3. `hooks/useSubnetContractInteractions.ts` (Modified)
- Added integration with newly created subnets hook
- After successful mainnet subnet creation and Supabase sync, adds subnet name with admin address to cache
- Ensures immediate visibility in the builders context

#### 4. `app/services/buildersService.ts` (Modified)
- Updated to accept admin lookup function parameter
- For Supabase-only builders (no on-chain data yet), uses cached admin address if available
- Temporarily populates admin field for newly created subnets until indexer picks up on-chain data

### Flow After Fix

1. User creates subnet on mainnet → Transaction succeeds ✅
2. Subnet data inserted into Supabase ✅
3. **NEW**: Subnet name + admin address added to local cache ✅
4. User redirected to builders page with `refresh=true`
5. `useAllBuildersQuery` runs:
   - Gets morlord names (may not include new subnet yet)
   - **NEW**: Gets cached newly created names ✅
   - **NEW**: Combines both lists for GraphQL query ✅
   - **NEW**: Passes admin lookup function to buildersService ✅
6. GraphQL query includes new subnet name → Data fetched ✅
7. **NEW**: For subnets without on-chain data, admin field populated from cache ✅
8. New subnet appears immediately in "Your Subnets" tab with correct admin ✅

### Cache Management

- **Storage**: localStorage with 15-minute expiration
- **Cleanup**: Automatic removal when names appear in morlord data
- **Fallback**: If localStorage fails, degrades gracefully
- **Cross-tab**: Works across browser tabs/windows
- **Admin Tracking**: Stores creator's address for immediate admin field population

### Admin Field Fix

The critical addition is tracking the admin address in cache because:
- "Your Subnets" tab filters by `builder.admin === userAddress`
- GraphQL queries might not find on-chain data immediately after creation
- Without on-chain data, there's no admin field → subnet doesn't show
- Our cache temporarily provides the admin field until indexer catches up

### Benefits

- ✅ **Immediate visibility** of newly created subnets
- ✅ **Immediate admin recognition** - shows in "Your Subnets" tab instantly
- ✅ **No backend changes** required
- ✅ **Graceful degradation** if caching fails
- ✅ **Automatic cleanup** prevents stale data
- ✅ **Cross-session persistence** works across browser tabs/windows
- ✅ **Minimal performance impact**

### Testing

To test the fix:
1. Create a new subnet on Arbitrum or Base mainnet
2. Verify it appears immediately in "Your Subnets" tab (not just "Builders" tab)
3. Verify the admin field is correctly set (your address)
4. Wait 10+ minutes and verify it still appears (now from morlord/on-chain data)
5. Check browser localStorage for cached subnet names and admin addresses
6. Verify cache expires after 15 minutes

### Technical Notes

- Cache duration (15 minutes) is longer than morlord refresh (10 minutes) to ensure coverage
- Admin addresses are stored temporarily until on-chain indexing completes
- Uses subnet names as cache keys since they're unique identifiers
- Integrates with existing React Query invalidation system
- No changes to GraphQL schema or backend APIs required
- Backwards compatible - existing functionality unaffected 