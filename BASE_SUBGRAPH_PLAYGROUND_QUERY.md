# Base Subgraph Playground Query

## Endpoint URL
```
https://api.goldsky.com/api/public/project_cmgzm6igw009l5np264iw7obk/subgraphs/morpheus-mainnet-base/v0.0.2/gn
```

## Query: Get All Builders Projects

### GraphQL Query (Playground Ready)
```graphql
query getBuildersProjects(
  $first: Int = 1000
  $skip: Int = 0
  $orderBy: BuildersProject_orderBy
  $orderDirection: OrderDirection
) {
  buildersProjects(
    first: $first
    skip: $skip
    orderBy: $orderBy
    orderDirection: $orderDirection
  ) {
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
}
```

### Example Variables (JSON)
```json
{
  "first": 10,
  "skip": 0,
  "orderBy": "totalStaked",
  "orderDirection": "desc"
}
```

### Alternative: Simple Query (No Variables)
```graphql
query getBuildersProjects {
  buildersProjects(first: 10, orderBy: totalStaked, orderDirection: desc) {
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
}
```

## Additional Useful Queries

### Get Single Builder Project by ID
```graphql
query getBuildersProject($id: ID!) {
  buildersProject(id: $id) {
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
}
```

**Variables:**
```json
{
  "id": "0x..."
}
```

### Get Builder Project Users
```graphql
query getBuildersProjectUsers(
  $first: Int = 50
  $skip: Int = 0
  $buildersProjectId: Bytes!
  $orderBy: String = "staked"
  $orderDirection: String = "desc"
) {
  buildersUsers(
    first: $first
    skip: $skip
    where: { buildersProject_: {id: $buildersProjectId} }
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
```

**Variables:**
```json
{
  "buildersProjectId": "0x...",
  "first": 20,
  "orderBy": "staked",
  "orderDirection": "desc"
}
```

### Get Counters
```graphql
query GetBuildersCounters {
  counters {
    id
    totalBuildersProjects
    totalSubnets
  }
}
```

## Usage in The Graph Studio Playground

1. Go to The Graph Studio or your GraphQL playground
2. Set the endpoint URL to the Base subgraph endpoint above
3. Paste the query in the query panel
4. Add variables in the variables panel (if using variables)
5. Execute the query

## Notes

- The Base subgraph uses `BuildersProject` entities (mainnet)
- For testnet (Arbitrum Sepolia), use `BuilderSubnet` instead
- All queries include `__typename` for Apollo Client cache normalization
- Use `orderBy` values like: `totalStaked`, `totalUsers`, `name`, `startsAt`
- Use `orderDirection`: `asc` or `desc`


