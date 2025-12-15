# Frontend Migration Guide: Alchemy Subgraph → Ponder Index

## Overview

This guide provides **exact changes** needed to migrate frontend queries from Alchemy/The Graph subgraph to Ponder indexer.

## Quick Reference: What Needs to Change

| Aspect | Alchemy/The Graph | Ponder | Change Required |
|--------|------------------|--------|----------------|
| Type names | `BuildersProject` | `buildersProject` | ✅ Change fragment |
| Pagination | `first`/`skip` | `limit`/`before`/`after` | ✅ Change params |
| Return type | Direct array | `{ items: [...] }` | ✅ Access `.items` |
| Nested filters | `buildersProject_: { id }` | `buildersProjectId` | ✅ Use direct field |
| Relationship | `buildersProject` | `buildersProject` | ✅ Already fixed |
| Field types | `BigInt!` | `BigInt!` | ✅ Already fixed |

## ⚠️ CRITICAL: Common Errors to Avoid

### 1. Pagination: Offset/Skip NOT Supported

**Ponder does NOT support offset/skip pagination.** 

- ❌ **DO NOT** define `$offset` or `$skip` variables - they will cause **"Variable is never used"** errors
- ❌ **DO NOT** use `skip:` or `offset:` arguments - they are not supported
- ✅ **ONLY** use cursor-based pagination with `before`/`after` parameters
- ✅ Use `limit` to control page size

**Example Error:**
```graphql
# ❌ WRONG - Will cause "Variable $offset is never used" error
query getBuildersProjects(
  $limit: Int = 1000
  $offset: Int = 0  # ❌ This will cause an error!
) {
  buildersProjects(limit: $limit) { ... }
}
```

**Correct Approach:**
```graphql
# ✅ CORRECT - Use cursor-based pagination
query getBuildersProjects(
  $limit: Int = 1000
  $after: String  # ✅ Use cursor instead
) {
  buildersProjects(limit: $limit, after: $after) { ... }
}
```

### 2. Fragment Name Case Sensitivity

- ✅ Fragment type: `on buildersProject` (lowercase - matches Ponder schema)
- ✅ Fragment name: `BuilderProject` (can be capitalized)
- ✅ Fragment spread: `...BuilderProject` (must match fragment name exactly)

**Example Error:**
```graphql
# Fragment definition
fragment BuilderProject on buildersProject { ... }

# ❌ WRONG - Case mismatch
items {
  ...builderProject  # ❌ Error: Unknown fragment "builderProject"
}

# ✅ CORRECT - Matches fragment name
items {
  ...BuilderProject  # ✅ Works!
}
```

**If your frontend uses offset-based pagination, you must:**
1. Refactor to use cursor-based pagination (recommended)
2. Or fetch all data and paginate client-side (not recommended for large datasets)

## File-by-File Changes

### 1. `lib/graphql/builders-queries.ts`

#### Change Fragment Type Name

```typescript
// OLD (line ~6-20)
fragment BuilderProject on BuildersProject {
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

// NEW
fragment BuilderProject on buildersProject {  // Changed: BuildersProject → buildersProject
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
```

#### Change Query 1: `COMBINED_BUILDERS_LIST_FILTERED_BY_PREDEFINED_BUILDERS`

```typescript
// OLD (lines ~183-223)
query combinedBuildersListFilteredByPredefinedBuilders(
  $first: Int = 1000,
  $orderBy: String,
  $orderDirection: String,
  $usersOrderBy: String,
  $usersDirection: String,
  $name_in: [String!] = "",
  $address: String = ""
) {
  buildersProjects(
    first: $first
    skip: 0  # or calculated skip
    where: { name_in: $name_in }
    orderBy: $orderBy
    orderDirection: $orderDirection
  ) {
    ...BuilderProject
  }
  buildersUsers(
    where: { address: $address }
    orderBy: $usersOrderBy
    orderDirection: $usersDirection
  ) {
    address
    id
    lastStake
    staked
    buildersProject {
      ...BuilderProject
    }
  }
}

// NEW
query combinedBuildersListFilteredByPredefinedBuilders(
  $limit: Int = 1000,  // Changed: first → limit
  $orderBy: String,
  $orderDirection: String,
  $usersOrderBy: String,
  $usersDirection: String,
  $name_in: [String!] = "",
  $address: String = ""
) {
  buildersProjects(
    limit: $limit  // Changed: first → limit, removed skip
    where: { name_in: $name_in }
    orderBy: $orderBy
    orderDirection: $orderDirection
  ) {
    items {  // Added: items wrapper
      ...BuilderProject
    }
  }
  buildersUsers(
    where: { address: $address }
    orderBy: $usersOrderBy
    orderDirection: $usersDirection
  ) {
    items {  // Added: items wrapper
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

#### Change Query 2: `GET_ACCOUNT_USER_BUILDERS_PROJECTS`

```typescript
// OLD (lines ~92-105)
query getAccountUserBuildersProjects($address: Bytes = "") {
  buildersUsers(where: { address: $address }) {
    address
    id
    lastStake
    staked
    buildersProject {
      ...BuilderProject
    }
  }
}

// NEW
query getAccountUserBuildersProjects($address: String = "") {  // Changed: Bytes → String
  buildersUsers(where: { address: $address }) {
    items {  // Added: items wrapper
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

### 2. `app/graphql/queries/builders.ts`

#### Change Query 3: `GET_BUILDERS_PROJECT_USERS` ⚠️ CRITICAL

```typescript
// OLD (lines ~38-59)
query getBuildersProjectUsers(
  $first: Int = 5
  $skip: Int = 0
  $buildersProjectId: Bytes = ""
  $orderBy: String = "staked"
  $orderDirection: String = "desc"
) {
  buildersUsers(
    first: $first
    skip: $skip
    where: { buildersProject_: { id: $buildersProjectId } }  // Nested filter
    orderBy: $orderBy
    orderDirection: $orderDirection
  ) {
    address
    id
    staked
    lastStake
    __typename
  }
}

// NEW
query getBuildersProjectUsers(
  $limit: Int = 5  // Changed: first → limit
  $buildersProjectId: String = ""  // Changed: Bytes → String, removed skip
  $orderBy: String = "staked"
  $orderDirection: String = "desc"
) {
  buildersUsers(
    limit: $limit  // Changed: first → limit, removed skip
    where: { buildersProjectId: $buildersProjectId }  // Changed: nested filter → direct field
    orderBy: $orderBy
    orderDirection: $orderDirection
  ) {
    items {  // Added: items wrapper
      address
      id
      staked
      lastStake
      __typename
    }
  }
}
```

**⚠️ IMPORTANT: Pagination Changes**

Ponder **does NOT support** `skip` or `offset` parameters. If you define `$skip` or `$offset` variables, you will get "unused variable" errors.

**You have two options to handle pagination:**

**Option A: Use cursor-based pagination (RECOMMENDED)**
```typescript
// Store cursor from previous page
query getBuildersProjectUsers(
  $limit: Int = 5
  $after: String  // Cursor from previous page
  $buildersProjectId: String = ""
  $orderBy: String = "staked"
  $orderDirection: String = "desc"
) {
  buildersUsers(
    limit: $limit
    after: $after  // Use cursor instead of skip
    where: { buildersProjectId: $buildersProjectId }
    orderBy: $orderBy
    orderDirection: $orderDirection
  ) {
    items {
      address
      id
      staked
      lastStake
      __typename
    }
    pageInfo {
      endCursor  // Use this for next page
      hasNextPage
    }
  }
}
```

**Option B: Client-side pagination (NOT RECOMMENDED)**
```typescript
// ⚠️ WARNING: This requires fetching all data and paginating client-side
// Only use this if you have a small, fixed dataset
// For large datasets, use cursor-based pagination (Option A)

const page = 1;
const pageSize = 5;
const limit = 1000; // Fetch all, then slice client-side
const offset = (page - 1) * pageSize;

// After fetching:
const paginatedItems = data.buildersUsers.items.slice(offset, offset + pageSize);
```

**⚠️ Important**: Option B is inefficient and should be avoided for production use. Always prefer cursor-based pagination.

#### Change Query 4: `GET_BUILDERS_PROJECT_BY_NAME`

```typescript
// OLD (lines ~3-14)
query getBuildersProjectsByName($name: String!) {
  buildersProjects(where: { name: $name }) {
    id
    name
    totalStaked
    totalUsers
    withdrawLockPeriodAfterDeposit
    minimalDeposit
  }
}

// NEW
query getBuildersProjectsByName($name: String!) {
  buildersProjects(where: { name: $name }) {
    items {  // Added: items wrapper
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

### 3. Frontend Code Changes (TypeScript/JavaScript)

#### Update Data Access Patterns

**File: `app/services/buildersService.ts`**

```typescript
// OLD (lines ~223-229)
const projects = data.buildersProjects;
const users = data.buildersUsers;

// NEW
const projects = data.buildersProjects.items;  // Added: .items
const users = data.buildersUsers.items;  // Added: .items
```

**File: `hooks/use-staking-data.ts`**

```typescript
// OLD (line ~195, ~337, ~532)
const project = data.buildersProjects[0];
const users = data.buildersUsers;

// NEW
const project = data.buildersProjects.items[0];  // Added: .items[0]
const users = data.buildersUsers.items;  // Added: .items
```

**File: `app/hooks/useUserStakedBuilders.ts`**

```typescript
// OLD (lines ~102-111)
const stakedProjects = data.buildersUsers.map(user => user.buildersProject);

// NEW
const stakedProjects = data.buildersUsers.items.map(user => user.buildersProject);  // Added: .items
```

**File: `app/builders/[slug]/page.tsx`**

```typescript
// OLD (line ~406)
const project = data.buildersProjects?.[0];
const users = data.buildersUsers || [];

// NEW
const project = data.buildersProjects?.items?.[0];  // Added: .items?.[0]
const users = data.buildersUsers?.items || [];  // Added: .items
```

## Summary of Changes

### GraphQL Query Files (2 files)
1. ✅ `lib/graphql/builders-queries.ts`
   - Change fragment type: `BuildersProject` → `buildersProject`
   - Change pagination: `first` → `limit`, **remove `skip` completely** (not supported)
   - Add `.items` wrapper to all query results
   - Change `Bytes` → `String` for address variables
   - ⚠️ **DO NOT** define `$offset` or `$skip` variables - they will cause errors

2. ✅ `app/graphql/queries/builders.ts`
   - Change nested filter: `buildersProject_: { id }` → `buildersProjectId`
   - Change pagination: `first` → `limit`, **remove `skip` completely** (not supported)
   - Add `.items` wrapper to all query results
   - Change `Bytes` → `String` for ID variables
   - ⚠️ **DO NOT** define `$offset` or `$skip` variables - they will cause errors

### Frontend Code Files (4 files)
1. ✅ `app/services/buildersService.ts` - Access `.items` from results
2. ✅ `hooks/use-staking-data.ts` - Access `.items` from results
3. ✅ `app/hooks/useUserStakedBuilders.ts` - Access `.items` from results
4. ✅ `app/builders/[slug]/page.tsx` - Access `.items` from results

## Testing Checklist

After making changes, test:

- [ ] Main builders list page loads
- [ ] Individual builder page loads
- [ ] User staked builders ("Participating" tab) loads
- [ ] Pagination works (if using cursor-based)
- [ ] Filtering by project ID works
- [ ] Filtering by user address works
- [ ] Sorting/ordering works
- [ ] All data fields display correctly

## Migration Script (Optional)

If you want to automate some changes, here's a find/replace guide:

```bash
# 1. Change fragment type name
find . -name "*.ts" -o -name "*.tsx" -o -name "*.graphql" | xargs sed -i '' 's/on BuildersProject/on buildersProject/g'

# 2. Change first to limit (be careful - may need manual review)
find . -name "*.ts" -o -name "*.tsx" -o -name "*.graphql" | xargs sed -i '' 's/first: \$first/limit: $limit/g'

# 3. Change Bytes to String for variables (be careful - review each)
find . -name "*.ts" -o -name "*.tsx" -o -name "*.graphql" | xargs sed -i '' 's/\$address: Bytes/\$address: String/g'
find . -name "*.ts" -o -name "*.tsx" -o -name "*.graphql" | xargs sed -i '' 's/\$buildersProjectId: Bytes/\$buildersProjectId: String/g'
```

**Note**: Always review automated changes manually!

## Rollback Plan

If issues occur:

1. Keep old query files as backup
2. Use feature flags to switch between endpoints
3. Test thoroughly before removing old code

## Estimated Effort

- **Query changes**: ~30 minutes
- **Code changes**: ~1 hour
- **Testing**: ~2 hours
- **Total**: ~3-4 hours

## Support

If you encounter issues:
1. Check `FRONTEND_COMPATIBILITY_ANALYSIS.md` for detailed analysis
2. Verify schema matches `generated/schema.graphql`
3. Test queries in GraphQL playground first
