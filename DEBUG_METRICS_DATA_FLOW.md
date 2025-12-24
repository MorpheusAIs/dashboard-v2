# Debug: Metrics Data Flow for Builder Detail Page

## Data Flow Path

1. **Builder Detail Page** (`app/builders/[slug]/page.tsx`)
   - Uses: `useBuilders()` hook from context
   - Gets: `builder` object with `totalStaked`, `totalClaimed`, `stakingCount`

2. **Builders Context** (`context/builders-context.tsx`)
   - Uses: `useAllBuildersQuery()` hook
   - Returns: Array of `Builder` objects

3. **All Builders Query** (`app/hooks/useAllBuildersQuery.ts`)
   - Calls: `fetchBuildersAPI()` from `app/services/buildersService.ts`

4. **Builders Service** (`app/services/buildersService.ts`)
   - Checks: `USE_GOLDSKY_V1_DATA` flag (currently `true`)
   - If `true`: Calls API routes
   - If `false`: Uses direct GraphQL queries

## Current Configuration

**Feature Flag:** `USE_GOLDSKY_V1_DATA = true` (in `app/config/subgraph-endpoints.ts`)

This means the code uses **API routes** instead of direct GraphQL queries.

## API Routes Called (When USE_GOLDSKY_V1_DATA = true)

### 1. Base Network
- **Internal API Route:** `/api/builders/goldsky/base`
- **File:** `app/api/builders/goldsky/base/route.ts`
- **Method:** GET
- **Calls External URL:** `https://api.goldsky.com/api/public/project_cmgzm6igw009l5np264iw7obk/subgraphs/morpheus-mainnet-base-compatible/v0.0.1/gn`

### 2. Arbitrum Network
- **Internal API Route:** `/api/builders/goldsky/arbitrum`
- **File:** `app/api/builders/goldsky/arbitrum/route.ts`
- **Method:** GET
- **Calls External URL:** `https://api.goldsky.com/api/public/project_cmgzm6igw009l5np264iw7obk/subgraphs/morpheus-mainnet-arbitrum-compatible/v0.0.1/gn`

## GraphQL Query Used

Both API routes use the same query structure:

```graphql
query combinedBuildersProjectsBaseMainnet {
  buildersProjects(
    first: 1000
    orderBy: totalStaked
    orderDirection: desc
  ) {
    id
    name
    admin
    totalStaked
    totalClaimed
    totalUsers
    minimalDeposit
    withdrawLockPeriodAfterDeposit
    startsAt
    claimLockEnd
    __typename
  }
}
```

**Note:** For Arbitrum, the query name is `combinedBuildersProjectsArbitrumMainnet` but the structure is identical.

## How to Test the Query Directly

You can test the Goldsky endpoint directly using curl:

```bash
# Base Network
curl -X POST \
  https://api.goldsky.com/api/public/project_cmgzm6igw009l5np264iw7obk/subgraphs/morpheus-mainnet-base-compatible/v0.0.1/gn \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { buildersProjects(first: 1000, orderBy: totalStaked, orderDirection: desc) { id name admin totalStaked totalClaimed totalUsers minimalDeposit withdrawLockPeriodAfterDeposit startsAt claimLockEnd __typename } }"
  }'

# Arbitrum Network
curl -X POST \
  https://api.goldsky.com/api/public/project_cmgzm6igw009l5np264iw7obk/subgraphs/morpheus-mainnet-arbitrum-compatible/v0.0.1/gn \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { buildersProjects(first: 1000, orderBy: totalStaked, orderDirection: desc) { id name admin totalStaked totalClaimed totalUsers minimalDeposit withdrawLockPeriodAfterDeposit startsAt claimLockEnd __typename } }"
  }'
```

## Data Mapping

The API routes return:
```json
{
  "buildersProjects": [
    {
      "id": "...",
      "name": "...",
      "totalStaked": "1000000000000000000",  // in wei (18 decimals)
      "totalClaimed": "500000000000000000",   // in wei (18 decimals)
      "totalUsers": "5",                      // string number
      ...
    }
  ]
}
```

This gets transformed in `buildersService.ts`:
- `totalStaked` (wei) → `totalStaked` (MOR) = `Number(totalStaked) / 1e18`
- `totalClaimed` (wei) → `totalClaimed` (MOR) = `Number(totalClaimed) / 1e18`
- `totalUsers` (string) → `stakingCount` (number) = `parseInt(totalUsers, 10)`

## Where Metrics Are Displayed

In `app/builders/[slug]/page.tsx`:
- **Total Staked:** `builder.totalStaked` (line 1058)
- **Total Claimed:** `builder.totalClaimed` (line 1066)
- **Cumulative stakers:** `builder.stakingCount` (line 1074)
- **Lock Period:** `builder.lockPeriod` (line 1082)

## Debugging Steps

1. Check browser Network tab for calls to `/api/builders/goldsky/base` and `/api/builders/goldsky/arbitrum`
2. Check server logs for `[Goldsky V4 API Base]` and `[Goldsky V4 API Arbitrum]` messages
3. Check browser console for `[API]` messages showing fetched project counts
4. Check if `builder` object has the expected properties when found

## Potential Issues

1. **Goldsky endpoint might be down or returning errors**
2. **Query might be failing silently** (check for GraphQL errors in response)
3. **Builder might not be found** in the fetched projects list (name mismatch)
4. **Data transformation might be failing** (check if totalStaked/totalClaimed are strings vs numbers)

