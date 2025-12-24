# Queries Used for Builder Detail Page

## Summary

The builder detail page now uses **two separate queries**:

1. **Metrics (Total Staked, Total Claimed, Cumulative stakers)**: Fetches single builder by ID
2. **Active Staking Addresses Table**: Fetches users for that builder

## 1. Metrics Query (Single Builder)

### API Route Called
- **Internal Route:** `/api/builders/goldsky/[projectId]?network=[network]`
- **Example:** `/api/builders/goldsky/0x123...?network=base`
- **File:** `app/api/builders/goldsky/[projectId]/route.ts`

### External Goldsky Endpoint
- **Base:** `https://api.goldsky.com/api/public/project_cmgzm6igw009l5np264iw7obk/subgraphs/morpheus-mainnet-base-compatible/v0.0.1/gn`
- **Arbitrum:** `https://api.goldsky.com/api/public/project_cmgzm6igw009l5np264iw7obk/subgraphs/morpheus-mainnet-arbitrum-compatible/v0.0.1/gn`

### GraphQL Query Used

```graphql
query GetProjectDetails($projectId: Bytes!) {
  buildersProjects(
    where: { id: $projectId }
    first: 1
  ) {
    id
    name
    admin
    totalStaked
    totalUsers
    totalClaimed
    minimalDeposit
    withdrawLockPeriodAfterDeposit
    startsAt
    claimLockEnd
  }
}
```

### Variables
```json
{
  "projectId": "0x123..." // The builder's mainnetProjectId or subnetId
}
```

### Response Structure
```json
{
  "buildersProject": {
    "id": "0x123...",
    "name": "Builder Name",
    "totalStaked": "1000000000000000000",  // in wei
    "totalClaimed": "500000000000000000",   // in wei
    "totalUsers": "5",                      // string number
    ...
  }
}
```

## 2. Active Staking Addresses Table Query

### API Route Called
- **Internal Route:** `/api/builders/goldsky/[projectId]/users?network=[network]&limit=[limit]&offset=[offset]`
- **Example:** `/api/builders/goldsky/0x123.../users?network=base&limit=5&offset=0`
- **File:** `app/api/builders/goldsky/[projectId]/users/route.ts`

### External Goldsky Endpoint
- Same endpoints as above (Base or Arbitrum)

### GraphQL Query Used

```graphql
query GetBuilderUsers($projectId: Bytes!, $first: Int!, $skip: Int!) {
  buildersUsers(
    first: $first
    skip: $skip
    where: { buildersProject_: { id: $projectId } }
    orderBy: staked
    orderDirection: desc
  ) {
    id
    address
    staked
    lastStake
  }
}
```

### Variables
```json
{
  "projectId": "0x123...",
  "first": 5,    // page size
  "skip": 0      // offset for pagination
}
```

### Response Structure
```json
{
  "buildersUsers": [
    {
      "id": "...",
      "address": "0xabc...",
      "staked": "1000000000000000000",  // in wei
      "lastStake": "1234567890"         // timestamp
    }
  ],
  "totalCount": 10
}
```

## Implementation Details

### Hook Used
- **New Hook:** `useSingleBuilder()` in `app/hooks/useSingleBuilder.ts`
- **Existing Hook:** `useStakingData()` in `hooks/use-staking-data.ts`

### When Queries Are Called

1. **Single Builder Query:**
   - Called when `projectIdForFetch` is available (from `subnetId` or `builder.mainnetProjectId`)
   - Only on mainnet (testnet still uses all-builders approach)
   - Updates builder metrics when data arrives

2. **Users Query:**
   - Called by `useStakingData` hook
   - Uses `hookProjectId` (derived from builder)
   - Supports pagination (page 1 fetches project + users, subsequent pages fetch users only)

## Testing

You can test these queries directly:

```bash
# Test single builder query
curl -X POST \
  "https://api.goldsky.com/api/public/project_cmgzm6igw009l5np264iw7obk/subgraphs/morpheus-mainnet-base-compatible/v0.0.1/gn" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query GetProjectDetails($projectId: Bytes!) { buildersProjects(where: { id: $projectId } first: 1) { id name admin totalStaked totalUsers totalClaimed minimalDeposit withdrawLockPeriodAfterDeposit startsAt claimLockEnd } }",
    "variables": { "projectId": "YOUR_PROJECT_ID_HERE" }
  }'

# Test users query
curl -X POST \
  "https://api.goldsky.com/api/public/project_cmgzm6igw009l5np264iw7obk/subgraphs/morpheus-mainnet-base-compatible/v0.0.1/gn" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query GetBuilderUsers($projectId: Bytes!, $first: Int!, $skip: Int!) { buildersUsers(first: $first skip: $skip where: { buildersProject_: { id: $projectId } } orderBy: staked orderDirection: desc) { id address staked lastStake } }",
    "variables": { "projectId": "YOUR_PROJECT_ID_HERE", "first": 5, "skip": 0 }
  }'
```

