# Fix: Immediate Visibility of Newly Created Subnets

## Problem
When users create a new subnet on mainnet networks (Arbitrum or Base), they can't see the new subnet immediately in the "Your Subnets" tab because:

1. New subnet data is stored in Supabase immediately ✅
2. But GraphQL queries depend on builder names from morlord JSON file ❌
3. Morlord JSON file only refreshes every 10 minutes ❌
4. So new subnets don't appear until the next morlord refresh

## Solution
Implemented a local caching mechanism to store newly created subnet names and include them in GraphQL queries immediately.

### Files Modified

#### 1. `app/hooks/useNewlyCreatedSubnets.ts` (New)
- Manages newly created subnet names in localStorage
- Auto-expires entries after 15 minutes
- Provides cleanup when names appear in official morlord data
- Functions:
  - `addNewlyCreatedSubnet(name, network)` - Add new subnet to cache
  - `getNewlyCreatedSubnetNames()` - Get cached names for queries
  - `cleanupExistingSubnets(officialNames)` - Remove cached names that now exist in morlord

#### 2. `app/hooks/useAllBuildersQuery.ts` (Modified)
- Integrated newly created subnets hook
- Combines morlord names with cached newly created names
- Uses combined list for GraphQL queries
- Automatically cleans up cache when names appear in morlord data

#### 3. `hooks/useSubnetContractInteractions.ts` (Modified)
- Added integration with newly created subnets hook
- After successful mainnet subnet creation and Supabase sync, adds subnet name to cache
- Ensures immediate visibility in the builders context

### Flow After Fix

1. User creates subnet on mainnet → Transaction succeeds
2. Subnet data inserted into Supabase ✅
3. **NEW**: Subnet name added to local cache ✅
4. User redirected to builders page with `refresh=true`
5. `useAllBuildersQuery` runs:
   - Gets morlord names (may not include new subnet yet)
   - **NEW**: Gets cached newly created names ✅
   - **NEW**: Combines both lists for GraphQL query ✅
6. GraphQL query includes new subnet name → Data fetched ✅
7. New subnet appears immediately in "Your Subnets" tab ✅

### Cache Management

- **Storage**: localStorage with 15-minute expiration
- **Cleanup**: Automatic removal when names appear in morlord data
- **Fallback**: If localStorage fails, degrades gracefully
- **Cross-tab**: Works across browser tabs/windows

### Benefits

- ✅ Immediate visibility of newly created subnets
- ✅ No backend changes required
- ✅ Graceful degradation if caching fails
- ✅ Automatic cleanup prevents stale data
- ✅ Works across browser sessions
- ✅ Minimal performance impact

### Testing

To test the fix:
1. Create a new subnet on Arbitrum or Base mainnet
2. Verify it appears immediately in "Your Subnets" tab
3. Wait 10+ minutes and verify it still appears (now from morlord data)
4. Check browser localStorage for cached subnet names
5. Verify cache expires after 15 minutes

### Technical Notes

- Cache duration (15 minutes) is longer than morlord refresh (10 minutes) to ensure coverage
- Uses subnet names as cache keys since they're unique identifiers
- Integrates with existing React Query invalidation system
- No changes to GraphQL schema or backend APIs required 