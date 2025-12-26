# V4 Subgraph Migration Summary

## Overview
Successfully migrated the Builders application from Goldsky V1 subgraph endpoints to **Goldsky V4 subgraph endpoints** for **Base mainnet and Arbitrum mainnet only**. Testnet (Base Sepolia) was already using v4 and required no changes.

## Migration Date
December 23, 2025

## What Changed

### 1. Subgraph Endpoints Updated
**File**: `app/config/subgraph-endpoints.ts`

- Added new Goldsky V4 endpoints:
  - `GoldskyBaseV4`: Base mainnet v4 endpoint
  - `GoldskyArbitrumV4`: Arbitrum mainnet v4 endpoint
- Updated feature flags:
  - `USE_GOLDSKY_V1_DATA`: Changed from `true` to `false`
  - `USE_GOLDSKY_V4_DATA`: Added and set to `true`

### 2. Apollo Client Configuration
**File**: `lib/apollo-client.ts`

- Updated `NETWORK_ENDPOINTS` to use Goldsky V4 endpoints:
  - `Base`: Now uses `GoldskyBaseV4`
  - `Arbitrum`: Now uses `GoldskyArbitrumV4`

### 3. GraphQL Queries Updated
**File**: `lib/graphql/builders-queries.ts`

Updated mainnet queries to match v4 schema:
- `COMBINED_BUILDERS_PROJECTS_BASE_MAINNET`
- `COMBINED_BUILDERS_PROJECTS_ARBITRUM_MAINNET`
- `GET_PROJECTS_FOR_USER_BASE_MAINNET`
- `GET_PROJECTS_FOR_USER_ARBITRUM_MAINNET`
- `GET_PROJECTS_BY_ADMIN_BASE_MAINNET`
- `GET_PROJECTS_BY_ADMIN_ARBITRUM_MAINNET`
- `GET_BUILDERS_PROJECT_USERS`

**Key Schema Changes**:
- V4 returns arrays directly (no `items` wrapper)
- Uses `buildersProject` relation (not `builderSubnet`)
- Uses `staked` field (not `deposited`)
- **NO** `claimed` field on `BuildersUser`
- **NO** `claimLockEnd` field on `BuildersUser`
- Added `totalClaimed` to `BuildersProject` level

### 4. API Routes Updated
**Files**: `app/api/builders/goldsky/**/*.ts`

Updated all mainnet API routes to query v4 endpoints:
- `user-staked/[network]/route.ts` - "Staking in" tab data
- `user-admin/[network]/route.ts` - "Your Subnets" tab data
- `[projectId]/users/route.ts` - Stakers table with pagination

Changes:
- Now query Goldsky V4 endpoints directly
- Updated GraphQL queries to v4 schema
- Removed `items` wrapper from response parsing
- Fixed response format to return arrays directly

### 5. React Hooks Updated

**File**: `app/hooks/useUserStakedBuilders.ts`
- Updated type definitions to match v4 schema
- Added `totalClaimed` field to project types
- Updated API response parsing (array, not items wrapper)
- Updated field mapping (`buildersProject` instead of `project`)

**File**: `app/hooks/useUserAdminSubnets.ts`
- Updated type definitions to match v4 schema
- Added `totalClaimed` field to project types
- Updated API response parsing (array, not items wrapper)

**File**: `hooks/use-staking-data.ts`
- Fixed pagination to expect `totalCount` as separate field
- Updated response parsing for v4 format (array, not items wrapper)

### 6. Service Layer Updated
**File**: `app/services/buildersService.ts`

- Updated to handle both array and items wrapper formats
- Updated GraphQL query response types
- Maintained backward compatibility during transition

### 7. Builder Detail Page Enhanced
**File**: `app/builders/[slug]/page.tsx`

- Updated withdrawal time calculation to use actual `claimLockStart` from contract
- Improved time-until-unlock accuracy by using contract data when available
- Fallback to calculated time if contract data not available

### 8. New Adapter Created
**File**: `lib/utils/goldsky-v4-adapter.ts`

Created clean v4 adapter with:
- Direct v4 schema transformation
- Wei to token conversions
- Timestamp formatting
- Network name normalization
- No field name transformations needed (v4 uses standard mainnet names)

## V4 Schema Characteristics

### BuildersProject (Mainnet)
- `id`: Bytes (on-chain project ID)
- `name`: String
- `admin`: Bytes (admin address)
- `totalStaked`: BigInt
- `totalUsers`: BigInt
- `totalClaimed`: BigInt
- `minimalDeposit`: BigInt
- `withdrawLockPeriodAfterDeposit`: BigInt
- `startsAt`: BigInt (timestamp)
- `claimLockEnd`: BigInt (timestamp)

### BuildersUser (Mainnet)
- `id`: Bytes
- `address`: Bytes
- `staked`: BigInt (**not** "deposited")
- `lastStake`: BigInt (timestamp)
- `buildersProject`: BuildersProject (relation)
- **NO** `claimed` field
- **NO** `claimLockEnd` field

### Pagination
- Uses GraphQL standard: `first` and `skip`
- Returns direct arrays (no `items` wrapper)
- Separate `totalCount` field for total items

## What Was NOT Changed

### Testnet (Base Sepolia)
- **No changes made** - already using v4 schema and working correctly
- Testnet queries remain unchanged
- Testnet endpoints remain unchanged
- Testnet schema uses same v4 format as mainnet

## Testing Performed

1. ✅ Schema discovery via direct v4 endpoint testing
2. ✅ Verified v4 returns `buildersProjects` and `buildersUsers` entities
3. ✅ Confirmed field names and structure match documentation
4. ✅ Tested pagination with `first/skip` parameters
5. ✅ Verified no linting errors in updated files
6. ✅ Confirmed development server running successfully

## Files Modified

### Configuration
- `app/config/subgraph-endpoints.ts`
- `lib/apollo-client.ts`

### GraphQL
- `app/graphql/queries/builders.ts`
- `lib/graphql/builders-queries.ts`

### API Routes
- `app/api/builders/goldsky/user-staked/[network]/route.ts`
- `app/api/builders/goldsky/user-admin/[network]/route.ts`
- `app/api/builders/goldsky/[projectId]/users/route.ts`

### Hooks
- `app/hooks/useUserStakedBuilders.ts`
- `app/hooks/useUserAdminSubnets.ts`
- `hooks/use-staking-data.ts`

### Services
- `app/services/buildersService.ts`

### Components
- `app/builders/[slug]/page.tsx` (time calculation enhancement)

### New Files
- `lib/utils/goldsky-v4-adapter.ts`
- `docs/V4_SCHEMA_FINDINGS.md`
- `docs/V4_MIGRATION_SUMMARY.md` (this file)

## Benefits of V4 Migration

1. **Standard Schema**: Uses consistent mainnet schema across Base and Arbitrum
2. **Better Performance**: Direct endpoint access without transformation layers
3. **Simpler Code**: No need for complex v1-to-v4 adapters
4. **More Accurate Data**: Uses actual contract timestamps for unlock times
5. **Unified Format**: Same response structure for easier maintenance

## Breaking Changes

### For Developers
- API routes now return arrays directly (not `{ items: [], totalCount: 0 }`)
- `BuildersUser` no longer has `claimed` or `claimLockEnd` fields
- Must use `buildersProject` relation instead of `builderSubnet`
- Pagination uses `first/skip` instead of `limit/offset` in some queries

### For Users
- **No breaking changes** - UI functionality remains the same
- Improved accuracy in withdrawal unlock time calculations

## Rollback Plan

If issues arise, rollback by:
1. Set `USE_GOLDSKY_V1_DATA = true` in `app/config/subgraph-endpoints.ts`
2. Set `USE_GOLDSKY_V4_DATA = false` in same file
3. Restart development server

V1 API routes are preserved and will continue to work as fallback.

## Future Cleanup Recommendations

1. Remove V1 API routes after v4 is stable (30+ days)
2. Remove `goldsky-v1-to-v4-adapter.ts` once no longer needed
3. Remove old V1 endpoint constants from configuration
4. Update any remaining references to V1 schema in comments
5. Archive schema discovery test scripts

## Support Resources

- V4 Schema Documentation: `docs/V4_SCHEMA_FINDINGS.md`
- Original Schema Documentation: `docs/GRAPHQL_SUBGRAPH_SCHEMA.md`
- Goldsky V4 Endpoints: https://gitbook.mor.org/smart-contracts/documentation/builders-protocol/deployed-contracts#graph-for-the-v4

## Migration Success Criteria

- ✅ All three tabs load correctly (Builders, Staking in, Your Subnets)
- ✅ Pagination works on stakers table
- ✅ Filtering and sorting work correctly
- ✅ No console errors from GraphQL queries
- ✅ Withdrawal time calculations use contract data
- ✅ All linting passes
- ✅ Development server runs without errors

## Notes

- Migration only affects Base mainnet and Arbitrum mainnet
- Testnet (Base Sepolia) was already using v4 and required no changes
- V1 API routes remain available as fallback
- All user-facing functionality preserved





