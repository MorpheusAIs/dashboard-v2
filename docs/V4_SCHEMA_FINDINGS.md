# V4 Subgraph Schema Findings

## Summary
The v4 subgraphs for Base and Arbitrum mainnet use **mainnet-style schema** (not testnet style).

## Endpoints
- **Base**: `https://api.goldsky.com/api/public/project_cmgzm6igw009l5np264iw7obk/subgraphs/morpheus-mainnet-base-compatible/v0.0.1/gn`
- **Arbitrum**: `https://api.goldsky.com/api/public/project_cmgzm6igw009l5np264iw7obk/subgraphs/morpheus-mainnet-arbitrum-compatible/v0.0.1/gn`

## Entity Names
- ✅ `buildersProjects` (not builderSubnets)
- ✅ `buildersUsers` (not builderUsers)
- ✅ Uses `subnet` and `subnetUser` as well (additional entities)

## BuildersProject Fields
```graphql
type BuildersProject {
  id: Bytes!
  name: String!
  admin: Bytes!
  minimalDeposit: BigInt!
  totalStaked: BigInt!
  totalUsers: BigInt!
  totalClaimed: BigInt!
  startsAt: BigInt!
  withdrawLockPeriodAfterDeposit: BigInt!
  claimLockEnd: BigInt!
}
```

## BuildersUser Fields
```graphql
type BuildersUser {
  id: Bytes!
  address: Bytes!
  staked: BigInt!              # NOTE: "staked" not "deposited"
  lastStake: BigInt!
  buildersProject: BuildersProject!  # Relation field
}
```

### ⚠️ Important Differences from V1
1. **NO `claimed` field** on BuildersUser (claimed is tracked at project level only)
2. **NO `claimLockEnd` field** on BuildersUser (lock end is at project level)
3. Uses **`staked`** field (not `deposited` like testnet schema)
4. Uses **`buildersProject`** relation (not `builderSubnet`)

## Pagination Style
- Uses GraphQL standard: **`first` and `skip`** parameters
- Example: `buildersUsers(first: 50, skip: 0, orderBy: staked, orderDirection: desc)`
- **NOT** `limit` and `offset`

## Filtering & Sorting
- Standard The Graph filtering:
  - `where: { address: $address }`
  - `where: { staked_gt: "0" }`
  - `where: { address: $address, buildersProject_: { id: $projectId } }`
- Standard ordering:
  - `orderBy: staked`
  - `orderDirection: desc` or `asc`

## Query Fields Available
From introspection:
- `buildersProject(id: ID!)` - Single project
- `buildersProjects` - List of projects
- `buildersUser(id: ID!)` - Single user
- `buildersUsers` - List of users
- `subnet` - V4 subnet entity
- `subnets` - V4 subnet list
- `subnetUser` - V4 subnet user
- `subnetUsers` - V4 subnet user list
- `counter` - Global counters
- `counters` - Multiple counters
- `_meta` - Metadata about the subgraph

## Migration Notes

### Query Changes Needed
1. Remove `claimed` field from BuildersUser queries
2. Remove `claimLockEnd` field from BuildersUser queries  
3. Keep `staked` field name (no change needed)
4. Update pagination from `limit/offset` to `first/skip` where needed
5. Update relation name from `builderSubnet` to `buildersProject`

### Adapter Changes Needed
1. V1-to-V4 adapter should be removed/simplified since v4 uses native mainnet schema
2. Data transformation should focus on:
   - Wei to token conversion
   - Timestamp formatting
   - Network name normalization
3. No longer need to transform field names (staked vs deposited, etc.)

### Data Completeness
- ✅ Project metrics are complete (totalStaked, totalClaimed, totalUsers)
- ✅ User staking data is complete (staked, lastStake)
- ❌ User-level claimed amounts not available in v4 schema
- ❌ User-level claimLockEnd not available in v4 schema

### Recommendations
1. Use project-level `totalClaimed` for displaying total claimed rewards
2. Calculate user claim lock end from `lastStake + withdrawLockPeriodAfterDeposit`
3. Update UI to reflect that individual user claim amounts are not tracked in v4


