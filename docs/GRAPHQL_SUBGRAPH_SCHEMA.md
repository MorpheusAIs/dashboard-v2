# GraphQL Subgraph Schema Documentation

## Overview

This document provides comprehensive documentation of the GraphQL schemas used for the Morpheus Builders subgraphs on Base and Arbitrum mainnet networks. The subgraphs index on-chain data from the Builders contracts and provide queryable interfaces for builder projects, users, and staking information.

## Subgraph Endpoints

### Base Mainnet
```
https://api.goldsky.com/api/public/project_cmgzm6igw009l5np264iw7obk/subgraphs/morpheus-mainnet-base/v0.0.2/gn
```

### Arbitrum Mainnet
```
https://api.goldsky.com/api/public/project_cmgzm6igw009l5np264iw7obk/subgraphs/morpheus-mainnet-arbitrum/v0.0.2/gn
```

## Entity Types

### BuildersProject (Mainnet)

The `BuildersProject` entity represents a builder project/staking pool on mainnet networks (Base and Arbitrum).

#### Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | `Bytes!` | Unique identifier (contract address) |
| `admin` | `Bytes!` | Address of the project administrator |
| `name` | `String!` | Name of the builder project |
| `minimalDeposit` | `BigInt!` | Minimum deposit amount required (in wei) |
| `totalStaked` | `BigInt!` | Total amount staked across all users |
| `totalClaimed` | `BigInt!` | Total amount claimed by the admin |
| `totalUsers` | `BigInt!` | Total number of unique users who have staked |
| `startsAt` | `BigInt!` | Unix timestamp when the project starts accepting stakes |
| `claimLockEnd` | `BigInt!` | Unix timestamp when claim lock period ends |
| `withdrawLockPeriodAfterDeposit` | `BigInt!` | Lock period in seconds after deposit before withdrawal is allowed |
| `__typename` | `String!` | GraphQL type name (always "BuildersProject") |

#### Relationships

- **One-to-Many**: `BuildersProject` → `BuildersUser`
  - A project can have multiple users who have staked
  - Accessed via `buildersUsers` query with `where: { buildersProject_: { id: $projectId } }`

#### Order By Options

The following fields can be used for ordering `BuildersProject` queries:

- `admin`
- `claimLockEnd`
- `id`
- `minimalDeposit`
- `name`
- `startsAt`
- `totalClaimed`
- `totalStaked`
- `totalUsers`
- `withdrawLockPeriodAfterDeposit`

#### Example Query

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

---

### BuilderSubnet (Testnet)

The `BuilderSubnet` entity represents a builder subnet on testnet networks (Arbitrum Sepolia). This entity has additional metadata fields compared to `BuildersProject`.

#### Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | `Bytes!` | Unique identifier (contract address) |
| `name` | `String!` | Name of the builder subnet |
| `owner` | `Bytes!` | Address of the subnet owner/admin |
| `minStake` | `BigInt!` | Minimum stake amount required (in wei) |
| `fee` | `BigInt!` | Fee percentage or amount |
| `feeTreasury` | `Bytes!` | Address where fees are sent |
| `startsAt` | `BigInt!` | Unix timestamp when the subnet starts accepting stakes |
| `withdrawLockPeriodAfterStake` | `BigInt!` | Lock period in seconds after stake before withdrawal is allowed |
| `maxClaimLockEnd` | `BigInt!` | Maximum claim lock end timestamp |
| `slug` | `String!` | URL-friendly identifier for the subnet |
| `description` | `String!` | Description of the subnet |
| `website` | `String!` | Website URL for the subnet |
| `image` | `String!` | Image URL for the subnet logo/icon |
| `totalStaked` | `BigInt!` | Total amount staked across all users |
| `totalClaimed` | `BigInt!` | Total amount claimed by the owner |
| `totalUsers` | `BigInt!` | Total number of unique users who have staked |
| `builderUsers` | `[BuilderUser!]!` | Array of users who have staked in this subnet |
| `__typename` | `String!` | GraphQL type name (always "BuilderSubnet") |

#### Relationships

- **One-to-Many**: `BuilderSubnet` → `BuilderUser`
  - A subnet can have multiple users who have staked
  - Accessed via `builderUsers` query with `where: { builderSubnet_: { id: $subnetId } }`
  - Can also be accessed directly via the `builderUsers` field on the subnet

#### Order By Options

The following fields can be used for ordering `BuilderSubnet` queries:

- `id`
- `name`
- `owner`
- `minStake`
- `fee`
- `feeTreasury`
- `startsAt`
- `withdrawLockPeriodAfterStake`
- `maxClaimLockEnd`
- `slug`
- `description`
- `website`
- `image`
- `totalStaked`
- `totalClaimed`
- `totalUsers`
- `builderUsers`

#### Example Query

```graphql
query getBuilderSubnets(
  $first: Int = 1000
  $skip: Int = 0
  $orderBy: BuilderSubnet_orderBy
  $orderDirection: OrderDirection
) {
  builderSubnets(
    first: $first
    skip: $skip
    orderBy: $orderBy
    orderDirection: $orderDirection
  ) {
    id
    name
    owner
    minStake
    fee
    feeTreasury
    startsAt
    withdrawLockPeriodAfterStake
    maxClaimLockEnd
    slug
    description
    website
    image
    totalStaked
    totalClaimed
    totalUsers
    builderUsers {
      id
      address
      staked
      claimed
      claimLockEnd
      lastStake
    }
  }
}
```

---

### BuildersUser / BuilderUser

The `BuildersUser` (mainnet) or `BuilderUser` (testnet) entity represents a user's staking relationship with a builder project or subnet.

#### Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | `Bytes!` | Unique identifier (typically `${projectId}-${userAddress}`) |
| `address` | `Bytes!` | User's wallet address |
| `staked` | `BigInt!` | Total amount currently staked by this user (in wei) |
| `claimed` | `BigInt!` | Total amount claimed by this user (in wei) |
| `claimLockEnd` | `BigInt!` | Unix timestamp when claim lock period ends for this user |
| `lastStake` | `BigInt!` | Unix timestamp of the user's last stake action |
| `buildersProject` | `BuildersProject` | Reference to the builder project (mainnet only) |
| `builderSubnet` | `BuilderSubnet` | Reference to the builder subnet (testnet only) |
| `__typename` | `String!` | GraphQL type name |

#### Relationships

- **Many-to-One**: `BuildersUser` → `BuildersProject` (mainnet)
  - Multiple users can stake in the same project
  - Accessed via `buildersProject` field on the user entity

- **Many-to-One**: `BuilderUser` → `BuilderSubnet` (testnet)
  - Multiple users can stake in the same subnet
  - Accessed via `builderSubnet` field on the user entity

#### Order By Options

The following fields can be used for ordering `BuildersUser` queries:

- `id`
- `address`
- `staked`
- `claimed`
- `claimLockEnd`
- `lastStake`
- `builderSubnet` (testnet)
- `builderSubnet__totalStaked` (testnet - nested field sorting)

#### Example Query (Mainnet)

```graphql
query getBuildersProjectUsers(
  $first: Int = 50
  $skip: Int = 0
  $buildersProjectId: Bytes!
  $orderBy: BuildersUser_orderBy
  $orderDirection: OrderDirection
) {
  buildersUsers(
    first: $first
    skip: $skip
    where: { buildersProject_: { id: $buildersProjectId } }
    orderBy: $orderBy
    orderDirection: $orderDirection
  ) {
    address
    id
    staked
    lastStake
    claimed
    claimLockEnd
    buildersProject {
      id
      name
      totalStaked
    }
  }
}
```

#### Example Query (Testnet)

```graphql
query getBuilderSubnetUsers(
  $first: Int = 50
  $skip: Int = 0
  $builderSubnetId: Bytes!
  $orderBy: BuilderUser_orderBy
  $orderDirection: OrderDirection
) {
  builderUsers(
    first: $first
    skip: $skip
    where: { builderSubnet_: { id: $builderSubnetId } }
    orderBy: $orderBy
    orderDirection: $orderDirection
  ) {
    address
    id
    staked
    claimed
    claimLockEnd
    lastStake
    builderSubnet {
      id
      name
      totalStaked
    }
  }
}
```

---

### Counter

The `Counter` entity provides aggregate statistics across all builder projects/subnets.

#### Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String!` | Unique identifier (typically "1" for global counter) |
| `totalBuildersProjects` | `BigInt!` | Total number of builder projects (mainnet) |
| `totalSubnets` | `BigInt!` | Total number of builder subnets (testnet) |

#### Example Query

```graphql
query GetBuildersCounters {
  counters {
    id
    totalBuildersProjects
    totalSubnets
  }
}
```

---

## Query Types

### Root Query Fields

#### Mainnet Queries

- `buildersProjects`: Query multiple builder projects
  - Parameters: `first`, `skip`, `where`, `orderBy`, `orderDirection`
  - Returns: `[BuildersProject!]!`

- `buildersProject(id: ID!)`: Query a single builder project by ID
  - Returns: `BuildersProject`

- `buildersUsers`: Query multiple builder users
  - Parameters: `first`, `skip`, `where`, `orderBy`, `orderDirection`
  - Returns: `[BuildersUser!]!`

- `counters`: Query aggregate counters
  - Returns: `[Counter!]!`

#### Testnet Queries

- `builderSubnets`: Query multiple builder subnets
  - Parameters: `first`, `skip`, `where`, `orderBy`, `orderDirection`
  - Returns: `[BuilderSubnet!]!`

- `builderSubnet(id: ID!)`: Query a single builder subnet by ID
  - Returns: `BuilderSubnet`

- `builderUsers`: Query multiple builder users
  - Parameters: `first`, `skip`, `where`, `orderBy`, `orderDirection`
  - Returns: `[BuilderUser!]!`

- `counters`: Query aggregate counters
  - Returns: `[Counter!]!`

---

## Filtering (Where Clauses)

### BuildersProject Filters

- `id`: Filter by project ID
- `id_in`: Filter by multiple project IDs
- `name`: Filter by exact name match
- `name_contains`: Filter by name containing substring
- `name_contains_nocase`: Case-insensitive name contains
- `name_in`: Filter by multiple names
- `admin`: Filter by admin address
- `totalStaked_gt`: Filter by total staked greater than
- `totalStaked_gte`: Filter by total staked greater than or equal
- `totalStaked_lt`: Filter by total staked less than
- `totalStaked_lte`: Filter by total staked less than or equal
- `totalUsers_gt`: Filter by total users greater than
- `startsAt_gt`: Filter by start timestamp greater than
- `startsAt_gte`: Filter by start timestamp greater than or equal

### BuilderSubnet Filters

Similar to `BuildersProject` filters, plus:
- `owner`: Filter by owner address
- `slug`: Filter by slug
- `slug_contains`: Filter by slug containing substring
- `minStake_gt`: Filter by minimum stake greater than
- `fee_gt`: Filter by fee greater than

### BuildersUser / BuilderUser Filters

- `id`: Filter by user ID
- `address`: Filter by user address
- `address_in`: Filter by multiple addresses
- `staked_gt`: Filter by staked amount greater than
- `staked_gte`: Filter by staked amount greater than or equal
- `staked_lt`: Filter by staked amount less than
- `staked_lte`: Filter by staked amount less than or equal
- `lastStake_gt`: Filter by last stake timestamp greater than
- `claimLockEnd_gt`: Filter by claim lock end timestamp greater than
- `buildersProject_`: Nested filter on related project (mainnet)
  - `buildersProject_: { id: $projectId }`
  - `buildersProject_: { name: $name }`
  - `buildersProject_: { name_in: $names }`
- `builderSubnet_`: Nested filter on related subnet (testnet)
  - `builderSubnet_: { id: $subnetId }`
  - `builderSubnet_: { name: $name }`
  - `builderSubnet_: { name_in: $names }`

---

## Enums

### OrderDirection

```graphql
enum OrderDirection {
  asc
  desc
}
```

### BuildersProject_orderBy

```graphql
enum BuildersProject_orderBy {
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
}
```

### BuilderSubnet_orderBy

```graphql
enum BuilderSubnet_orderBy {
  id
  name
  owner
  minStake
  fee
  feeTreasury
  startsAt
  withdrawLockPeriodAfterStake
  maxClaimLockEnd
  slug
  description
  website
  image
  totalStaked
  totalClaimed
  totalUsers
  builderUsers
}
```

### BuildersUser_orderBy / BuilderUser_orderBy

```graphql
enum BuildersUser_orderBy {
  id
  address
  staked
  claimed
  claimLockEnd
  lastStake
  builderSubnet
  builderSubnet__totalStaked
}
```

---

## Scalar Types

- `Bytes`: Ethereum address or bytes32 value (represented as hex string)
- `BigInt`: Large integer (represented as string in JSON)
- `String`: Standard string type
- `ID`: Unique identifier (typically a string)
- `Int`: Standard integer type

---

## Common Query Patterns

### Get All Builder Projects (Paginated)

```graphql
query getAllBuildersProjects(
  $first: Int = 1000
  $skip: Int = 0
  $orderBy: BuildersProject_orderBy = totalStaked
  $orderDirection: OrderDirection = desc
) {
  buildersProjects(
    first: $first
    skip: $skip
    orderBy: $orderBy
    orderDirection: $orderDirection
  ) {
    id
    name
    admin
    minimalDeposit
    totalStaked
    totalUsers
    totalClaimed
    startsAt
    withdrawLockPeriodAfterDeposit
  }
}
```

### Get Builder Project by Name

```graphql
query getBuildersProjectByName($name: String!) {
  buildersProjects(where: { name: $name }, first: 1) {
    id
    name
    admin
    totalStaked
    totalUsers
    minimalDeposit
    withdrawLockPeriodAfterDeposit
  }
}
```

### Get Users for a Specific Project

```graphql
query getBuildersProjectUsers(
  $buildersProjectId: Bytes!
  $first: Int = 50
  $skip: Int = 0
  $orderBy: BuildersUser_orderBy = staked
  $orderDirection: OrderDirection = desc
) {
  buildersUsers(
    first: $first
    skip: $skip
    where: { buildersProject_: { id: $buildersProjectId } }
    orderBy: $orderBy
    orderDirection: $orderDirection
  ) {
    id
    address
    staked
    claimed
    lastStake
    claimLockEnd
  }
}
```

### Get User's Staked Projects

```graphql
query getUserStakedProjects($address: Bytes!) {
  buildersUsers(
    where: { address: $address, staked_gt: "0" }
    first: 1000
  ) {
    id
    address
    staked
    claimed
    lastStake
    buildersProject {
      id
      name
      totalStaked
      totalUsers
      admin
    }
  }
}
```

### Get Admin's Projects

```graphql
query getAdminProjects($adminAddress: Bytes!) {
  buildersProjects(
    where: { admin: $adminAddress }
    first: 1000
  ) {
    id
    name
    totalStaked
    totalUsers
    admin
    startsAt
  }
}
```

### Combined Query (Projects + User Data + Counters)

```graphql
query combinedBuildersList(
  $first: Int = 1000
  $skip: Int = 0
  $orderBy: BuildersProject_orderBy = totalStaked
  $orderDirection: OrderDirection = desc
  $usersOrderBy: BuildersUser_orderBy = staked
  $usersDirection: OrderDirection = desc
  $address: Bytes = ""
) {
  buildersProjects(
    first: $first
    skip: $skip
    orderBy: $orderBy
    orderDirection: $orderDirection
  ) {
    id
    name
    admin
    totalStaked
    totalUsers
    minimalDeposit
    withdrawLockPeriodAfterDeposit
  }

  buildersUsers(
    orderBy: $usersOrderBy
    orderDirection: $usersDirection
    where: { address: $address }
  ) {
    id
    address
    staked
    lastStake
    buildersProject {
      id
      name
      totalStaked
    }
  }

  counters {
    id
    totalBuildersProjects
    totalSubnets
  }
}
```

---

## Relationships Summary

### Entity Relationship Diagram

```
BuildersProject (Mainnet)
├── One-to-Many → BuildersUser
│   └── Many-to-One → BuildersProject (back reference)
│
BuilderSubnet (Testnet)
├── One-to-Many → BuilderUser
│   └── Many-to-One → BuilderSubnet (back reference)
│
Counter
└── Global aggregate statistics
```

### Relationship Access Patterns

1. **Project → Users**: Query users filtered by project ID
   ```graphql
   buildersUsers(where: { buildersProject_: { id: $projectId } })
   ```

2. **User → Project**: Access project via nested field
   ```graphql
   buildersUsers {
     buildersProject {
       id
       name
     }
   }
   ```

3. **Subnet → Users**: Query users filtered by subnet ID
   ```graphql
   builderUsers(where: { builderSubnet_: { id: $subnetId } })
   ```

4. **User → Subnet**: Access subnet via nested field
   ```graphql
   builderUsers {
     builderSubnet {
       id
       name
     }
   }
   ```

---

## Data Types and Formats

### Timestamps

All timestamp fields (`startsAt`, `lastStake`, `claimLockEnd`, etc.) are stored as Unix timestamps in seconds (BigInt).

### Amounts

All amount fields (`staked`, `claimed`, `totalStaked`, `minimalDeposit`, etc.) are stored in wei (smallest unit) as BigInt values. In JSON responses, BigInt values are represented as strings.

**Conversion Example:**
- GraphQL returns: `"1000000000000000000"` (string)
- This represents: `1 ETH` or `1 MOR` (assuming 18 decimals)
- JavaScript conversion: `BigInt("1000000000000000000")` or `parseInt("1000000000000000000")`

### Addresses

All address fields (`id`, `admin`, `owner`, `address`, `feeTreasury`) are stored as `Bytes` type, represented as hex strings (with or without `0x` prefix).

---

## Differences Between Mainnet and Testnet Schemas

| Aspect | Mainnet (BuildersProject) | Testnet (BuilderSubnet) |
|--------|---------------------------|-------------------------|
| Entity Name | `BuildersProject` | `BuilderSubnet` |
| User Entity | `BuildersUser` | `BuilderUser` |
| Admin Field | `admin` | `owner` |
| Min Stake Field | `minimalDeposit` | `minStake` |
| Lock Period Field | `withdrawLockPeriodAfterDeposit` | `withdrawLockPeriodAfterStake` |
| Metadata Fields | Basic (name, admin) | Extended (slug, description, website, image) |
| Fee Fields | Not present | `fee`, `feeTreasury` |
| Claim Lock | `claimLockEnd` (on project) | `maxClaimLockEnd` (on subnet) |
| User Relationship | `buildersProject` | `builderSubnet` |

---

## Best Practices

1. **Always include `__typename`** in queries for Apollo Client cache normalization
2. **Use fragments** for reusable field sets
3. **Paginate large queries** using `first` and `skip` parameters
4. **Filter at the query level** rather than filtering results client-side
5. **Use appropriate orderBy** fields for sorting (don't sort client-side)
6. **Handle BigInt values** as strings in JavaScript/TypeScript
7. **Validate addresses** before querying (ensure proper hex format)
8. **Use nested filters** for efficient relationship queries
9. **Cache counters** separately as they change less frequently
10. **Handle null/undefined** values gracefully in nested relationships

---

## Error Handling

Common GraphQL errors you may encounter:

- **Entity not found**: Query returns `null` for single entity queries
- **Invalid filter**: Check filter syntax and field names
- **Type mismatch**: Ensure variables match expected types (Bytes vs String)
- **Rate limiting**: Implement retry logic with exponential backoff
- **Network errors**: Handle network failures gracefully

---

## Version Information

- **Subgraph Version**: v0.0.2
- **Last Updated**: Based on codebase analysis
- **Networks**: Base Mainnet, Arbitrum Mainnet
- **Provider**: Goldsky (Base & Arbitrum), The Graph Studio (legacy endpoints)

---

## Additional Resources

- Base Subgraph Playground: See `BASE_SUBGRAPH_PLAYGROUND_QUERY.md`
- GraphQL Client Configuration: `app/graphql/client.ts`
- Apollo Client Setup: `lib/apollo-client.ts`
- Query Definitions: `lib/graphql/builders-queries.ts`
- Type Definitions: `lib/types/graphql.ts`

---

## Notes

- The subgraph schemas for Base and Arbitrum mainnet are identical
- Testnet (Arbitrum Sepolia) uses a different schema (`BuilderSubnet` vs `BuildersProject`)
- All monetary values are in wei (18 decimals for MOR token)
- Timestamps are Unix timestamps in seconds
- Addresses are hex strings (with or without `0x` prefix)
- The `id` field for users is typically a composite key combining project/subnet ID and user address

