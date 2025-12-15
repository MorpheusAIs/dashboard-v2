# Frontend Query Compatibility Analysis

## Summary

**Status: ⚠️ QUERIES WILL NOT WORK AS-IS**

The frontend queries are designed for The Graph/Alchemy subgraph schema, but Ponder uses a different GraphQL schema structure. However, **we can adapt the Ponder schema to maximize compatibility** with minimal frontend changes.

## Key Differences

### 1. Type Names (CRITICAL)
- **Expected**: `BuildersProject`, `BuildersUser` (capitalized)
- **Ponder**: `buildersProject`, `buildersUser` (lowercase)
- **Impact**: Fragment definitions and type references will fail

### 2. Pagination Parameters (CRITICAL)
- **Expected**: `first: Int`, `skip: Int`
- **Ponder**: `limit: Int`, `before: String`, `after: String`
- **Impact**: All queries using `first`/`skip` will fail

### 3. Return Structure (CRITICAL)
- **Expected**: Direct array `[BuildersProject!]!`
- **Ponder**: Paginated result `buildersProjectPage!` with `items` field
- **Impact**: All queries expecting direct arrays will fail

### 4. Nested Filters (CRITICAL)
- **Expected**: `where: { buildersProject_: { id: $projectId } }`
- **Ponder**: `where: { buildersProjectId: $projectId }` (direct field filter)
- **Impact**: Query #3 (`GET_BUILDERS_PROJECT_USERS`) will fail

### 5. Relationship Field Name (FIXED)
- **Expected**: `buildersProject` relationship field
- **Ponder**: Was `project`, now changed to `buildersProject` ✅
- **Impact**: None - already fixed

### 6. Enum Types (MODERATE)
- **Expected**: `BuildersProject_orderBy` enum, `OrderDirection` enum
- **Ponder**: `String` types for both
- **Impact**: Type checking may fail, but values work as strings

### 7. Field Types (FIXED)
- **Expected**: `totalUsers: BigInt!`, `totalBuildersProjects: BigInt!`
- **Ponder**: Was `Int!`, now changed to `BigInt!` ✅
- **Impact**: None - already fixed

## Query-by-Query Analysis

### Query 1: `COMBINED_BUILDERS_LIST_FILTERED_BY_PREDEFINED_BUILDERS`

**Issues:**
- ❌ Uses `first`/`skip` → needs `limit`/offset calculation
- ❌ Fragment uses `BuildersProject` → needs `buildersProject`
- ❌ Expects direct array → needs `.items` access
- ✅ Uses `String` for `orderBy`/`orderDirection` (compatible)

**Frontend Changes Needed:**
- Change fragment type name
- Change pagination parameters
- Access `.items` from result

### Query 2: `GET_ACCOUNT_USER_BUILDERS_PROJECTS`

**Issues:**
- ❌ Fragment uses `BuildersProject` → needs `buildersProject`
- ❌ Expects direct array → needs `.items` access
- ✅ Uses `where: { address: $address }` (compatible)
- ✅ Uses `buildersProject` relationship (compatible after fix)

**Frontend Changes Needed:**
- Change fragment type name
- Access `.items` from result

### Query 3: `GET_BUILDERS_PROJECT_USERS` ⚠️ CRITICAL

**Issues:**
- ❌ Uses `first`/`skip` → needs `limit`/offset calculation
- ❌ Uses nested filter `buildersProject_: { id: $projectId }` → **NOT SUPPORTED**
- ❌ Expects direct array → needs `.items` access
- ✅ Uses `String` for `orderBy`/`orderDirection` (compatible)

**Frontend Changes Needed:**
- Change nested filter to direct field: `where: { buildersProjectId: $buildersProjectId }`
- Change pagination parameters
- Access `.items` from result

### Query 4: `GET_BUILDERS_PROJECT_BY_NAME`

**Issues:**
- ❌ Expects direct array → needs `.items` access
- ✅ Uses `where: { name: $name }` (compatible)

**Frontend Changes Needed:**
- Access `.items` from result (may need `.items[0]` for single result)

## Recommended Solution: Adapt Ponder Schema

To maximize compatibility and avoid frontend refactoring, we should create a **GraphQL schema adapter layer** that:

1. **Adds type aliases** for capitalized type names
2. **Adds `first`/`skip` support** via resolver logic
3. **Flattens paginated results** to direct arrays
4. **Adds nested filter support** for relationships

However, this requires custom GraphQL resolvers which Ponder may not support directly.

## Alternative: Minimal Frontend Changes

If we can't adapt the Ponder schema, here are the **minimum frontend changes** needed:

### Change 1: Update Fragment Type Names

```graphql
# OLD
fragment BuilderProject on BuildersProject { ... }

# NEW
fragment BuilderProject on buildersProject { ... }
```

### Change 2: Update Pagination Parameters

```graphql
# OLD
buildersProjects(
  first: $first
  skip: $skip
) { ... }

# NEW
buildersProjects(
  limit: $first  # Use first as limit
) {
  items { ... }
}
```

**Note**: `skip` needs to be handled differently - either:
- Use cursor-based pagination (`before`/`after`)
- Or implement offset calculation client-side

### Change 3: Fix Nested Filters

```graphql
# OLD
buildersUsers(
  where: { buildersProject_: { id: $buildersProjectId } }
) { ... }

# NEW
buildersUsers(
  where: { buildersProjectId: $buildersProjectId }
) {
  items { ... }
}
```

### Change 4: Access Paginated Results

```typescript
// OLD
const projects = data.buildersProjects;

// NEW
const projects = data.buildersProjects.items;
```

## Detailed Query Fixes

### Query 1: `COMBINED_BUILDERS_LIST_FILTERED_BY_PREDEFINED_BUILDERS`

**Fixed Version:**
```graphql
fragment BuilderProject on buildersProject {
  admin
  claimLockEnd
  id
  minimalDeposit
  name
  startsAt
  totalClaimed
  totalStaked
  totalUsers
  withdrawLockPeriodAfterDeposit
  __typename
}

query combinedBuildersListFilteredByPredefinedBuilders(
  $limit: Int = 1000,
  $orderBy: String,
  $orderDirection: String,
  $usersOrderBy: String,
  $usersDirection: String,
  $name_in: [String!] = "",
  $address: String = ""
) {
  buildersProjects(
    limit: $limit
    where: { name_in: $name_in }
    orderBy: $orderBy
    orderDirection: $orderDirection
  ) {
    items {
      ...BuilderProject
    }
  }
  buildersUsers(
    where: { address: $address }
    orderBy: $usersOrderBy
    orderDirection: $usersDirection
  ) {
    items {
      address
      id
      lastStake
      staked
      buildersProject {
        ...BuilderProject
      }
    }
  }
}
```

### Query 2: `GET_ACCOUNT_USER_BUILDERS_PROJECTS`

**Fixed Version:**
```graphql
query getAccountUserBuildersProjects($address: String = "") {
  buildersUsers(where: { address: $address }) {
    items {
      address
      id
      lastStake
      staked
      buildersProject {
        ...BuilderProject
      }
    }
  }
}
```

### Query 3: `GET_BUILDERS_PROJECT_USERS` ⚠️

**Fixed Version:**
```graphql
query getBuildersProjectUsers(
  $limit: Int = 5
  $buildersProjectId: String = ""  # Changed from Bytes to String
  $orderBy: String = "staked"
  $orderDirection: String = "desc"
) {
  buildersUsers(
    limit: $limit
    where: { buildersProjectId: $buildersProjectId }  # Changed from nested filter
    orderBy: $orderBy
    orderDirection: $orderDirection
  ) {
    items {  # Added items wrapper
      address
      id
      staked
      lastStake
      __typename
    }
  }
}
```

**Note**: This removes `skip` support. To add offset pagination:
- Option A: Use cursor-based (`before`/`after`)
- Option B: Calculate offset client-side and use `limit` with offset calculation

### Query 4: `GET_BUILDERS_PROJECT_BY_NAME`

**Fixed Version:**
```graphql
query getBuildersProjectsByName($name: String!) {
  buildersProjects(where: { name: $name }) {
    items {  # Added items wrapper
      id
      name
      totalStaked
      totalUsers
      withdrawLockPeriodAfterDeposit
      minimalDeposit
    }
  }
}
```

**Frontend Code Change:**
```typescript
// OLD
const project = data.buildersProjects[0];

// NEW
const project = data.buildersProjects.items[0];
```

## Implementation Priority

### High Priority (Breaking Changes)
1. ✅ Fix relationship field name (`project` → `buildersProject`) - **DONE**
2. ✅ Fix field types (`Int` → `BigInt`) - **DONE**
3. ⚠️ Add support for `first`/`skip` pagination (or update frontend)
4. ⚠️ Add nested filter support (or update frontend)
5. ⚠️ Flatten paginated results (or update frontend)

### Medium Priority (Type Compatibility)
1. Add type aliases for capitalized names (if possible)
2. Add enum types (if possible)

### Low Priority (Nice to Have)
1. Add `__typename` support (already works)
2. Optimize query performance

## Recommendation

**Option A: Adapt Ponder Schema (Preferred if possible)**
- Create custom GraphQL resolvers to support `first`/`skip` and nested filters
- Add type aliases for compatibility
- **Result**: Zero frontend changes

**Option B: Minimal Frontend Changes (If Option A not possible)**
- Update fragment type names (1 file)
- Update pagination parameters (3-4 queries)
- Fix nested filter in Query #3 (1 query)
- Access `.items` from results (all queries)
- **Result**: ~5-10 files changed, mostly query definitions

**Option C: Hybrid Approach**
- Keep Ponder schema as-is
- Create a GraphQL proxy/adapter layer between frontend and Ponder
- Transform queries/responses in the adapter
- **Result**: No frontend changes, but adds complexity

## Next Steps

1. **Check if Ponder supports custom resolvers** for schema adaptation
2. **If yes**: Implement adapter layer in Ponder
3. **If no**: Update frontend queries with minimal changes
4. **Test**: Verify all queries work with updated schema
