# GraphQL Queries Used by Builders Frontend

This document lists all GraphQL queries actually used by the builders frontend components and their source files.

## Query Definitions Location

All GraphQL queries are defined in:
- **`lib/graphql/builders-queries.ts`** - Main query definitions (Apollo Client gql format)
- **`app/graphql/queries/builders.ts`** - Alternative query definitions (plain GraphQL strings)

## Queries Used for Base & Arbitrum Mainnet

### 1. `COMBINED_BUILDERS_LIST_FILTERED_BY_PREDEFINED_BUILDERS`
**Defined in:** `lib/graphql/builders-queries.ts` (lines 183-223)

**Used in:**
- **`app/services/buildersService.ts`** (lines 223-224, 228-229)
  - Executed for both Base and Arbitrum networks in parallel
  - Used to fetch builders projects filtered by predefined names from Morlord API
  - Called via `fetchBuildersAPI()` which is used by `useAllBuildersQuery`

**Purpose:** Fetches builders projects and user staking data filtered by builder names

**Query Structure:**
```graphql
query combinedBuildersListFilteredByPredefinedBuilders(
  $first: Int = 1000,
  $orderBy: String,
  $orderDirection: String,
  $usersOrderBy: String,
  $usersDirection: String,
  $name_in: [String!] = "",
  $address: String = ""
) {
  buildersProjects(...) { ...BuilderProject }
  buildersUsers(...) { ... }
}
```

---

### 2. `GET_ACCOUNT_USER_BUILDERS_PROJECTS`
**Defined in:** `lib/graphql/builders-queries.ts` (lines 92-105)

**Used in:**
- **`app/hooks/useUserStakedBuilders.ts`** (lines 102-111)
  - Executed for both Base and Arbitrum networks in parallel
  - Used to fetch all builders where the authenticated user has staked tokens
  - Used in the "Participating" tab of the builders page

**Purpose:** Fetches all builder projects where a specific user address has staked

**Query Structure:**
```graphql
query getAccountUserBuildersProjects($address: Bytes = "") {
  buildersUsers(where: { address: $address }) {
    address
    id
    lastStake
    staked
    buildersProject { ...BuilderProject }
  }
}
```

---

### 3. `GET_BUILDERS_PROJECT_USERS`
**Defined in:** `lib/graphql/builders-queries.ts` (lines 107-129)
**Also defined in:** `app/graphql/queries/builders.ts` (lines 38-59)

**Used in:**
- **`app/builders/[slug]/page.tsx`** (line 8, line 406)
  - Used to fetch staking users for a specific builder project on mainnet
  - Passed to `useStakingData` hook
  
- **`hooks/use-staking-data.ts`** (lines 337, 532)
  - Used as the default query document for mainnet builder projects
  - Fetches paginated list of users who have staked in a builder project

**Purpose:** Fetches paginated list of users who have staked in a specific builder project

**Query Structure:**
```graphql
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

---

### 4. `GET_BUILDERS_PROJECT_BY_NAME`
**Defined in:** `app/graphql/queries/builders.ts` (lines 3-14)

**Used in:**
- **`hooks/use-staking-data.ts`** (line 195)
  - Used to fetch a builder project by name to get its ID
  - Used when only project name is available (not ID)

**Purpose:** Fetches a builder project by its name

**Query Structure:**
```graphql
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
```

---

## Queries Used for Testnet (Arbitrum Sepolia)

### 5. `GET_BUILDER_SUBNET_USERS`
**Defined in:** `app/graphql/queries/builders.ts` (lines 62-85)

**Used in:**
- **`app/builders/[slug]/page.tsx`** (line 8, line 406)
  - Used to fetch staking users for a specific builder subnet on testnet
  - Passed to `useStakingData` hook
  
- **`hooks/use-staking-data.ts`** (lines 436, 557)
  - Used as the default query document for testnet builder subnets
  - Fetches paginated list of users who have staked in a builder subnet

**Purpose:** Fetches paginated list of users who have staked in a specific builder subnet (testnet)

---

### 6. `GET_BUILDER_SUBNET_BY_NAME`
**Defined in:** `app/graphql/queries/builders.ts` (lines 17-36)

**Used in:**
- **`hooks/use-staking-data.ts`** (line 134)
  - Used to fetch a builder subnet by name to get its ID on testnet
  - Used when only subnet name is available (not ID)

**Purpose:** Fetches a builder subnet by its name (testnet)

---

## Supporting Fragments

### `BUILDER_PROJECT_FRAGMENT`
**Defined in:** `lib/graphql/builders-queries.ts` (lines 6-20)

**Used by:**
- `COMBINED_BUILDERS_LIST_FILTERED_BY_PREDEFINED_BUILDERS`
- `GET_ACCOUNT_USER_BUILDERS_PROJECTS`
- `GET_BUILDERS_PROJECTS`
- `GET_BUILDERS_PROJECT`
- `GET_USER_STAKED_BUILDERS`
- `GET_USER_ACCOUNT_BUILDERS_PROJECT`
- `GET_BUILDERS_PROJECT_BY_ID`

**Fields:**
```graphql
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
```

---

## Data Flow Summary

### Main Builders List Page (`app/builders/page.tsx`)
1. Uses `useAllBuildersQuery` hook
2. Which calls `fetchBuildersAPI` from `app/services/buildersService.ts`
3. Which executes `COMBINED_BUILDERS_LIST_FILTERED_BY_PREDEFINED_BUILDERS` for Base and Arbitrum

### Individual Builder Page (`app/builders/[slug]/page.tsx`)
1. Uses `useStakingData` hook
2. Which uses `GET_BUILDERS_PROJECT_USERS` (mainnet) or `GET_BUILDER_SUBNET_USERS` (testnet)
3. Also uses `GET_BUILDERS_PROJECT_BY_NAME` or `GET_BUILDER_SUBNET_BY_NAME` to resolve project ID

### User Staked Builders (`app/hooks/useUserStakedBuilders.ts`)
1. Executes `GET_ACCOUNT_USER_BUILDERS_PROJECTS` for Base and Arbitrum
2. Used in "Participating" tab to show builders where user has staked

---

## Network-Specific Usage

### Base Mainnet
- Uses all mainnet queries (`GET_BUILDERS_PROJECT_*`)
- Endpoint: `https://api.goldsky.com/api/public/project_cmgzm6igw009l5np264iw7obk/subgraphs/morpheus-mainnet-base/v0.0.2/gn`

### Arbitrum Mainnet
- Uses all mainnet queries (`GET_BUILDERS_PROJECT_*`)
- Endpoint: `https://api.goldsky.com/api/public/project_cmgzm6igw009l5np264iw7obk/subgraphs/morpheus-mainnet-arbitrum/v0.0.2/gn`

### Arbitrum Sepolia (Testnet)
- Uses testnet queries (`GET_BUILDER_SUBNET_*`)
- Endpoint: `https://subgraph.satsuma-prod.com/8675f21b07ed/9iqb9f4qcmhosiruyg763--465704/morpheus-arbitrum-sepolia/api`

---

## Unused Queries (Not Currently Used by Frontend)

These queries are defined but not actively used by the builders frontend:
- `COMBINED_BUILDERS_LIST` (defined but not used - replaced by filtered version)
- `GET_BUILDERS_PROJECTS` (defined but not used)
- `GET_BUILDERS_PROJECT` (defined but not used)
- `GET_BUILDERS_COUNTERS` (defined but not used)
- `GET_USER_STAKED_BUILDERS` (defined but not used - replaced by `GET_ACCOUNT_USER_BUILDERS_PROJECTS`)
- `GET_BUILDERS_PROJECT_BY_ID` (defined but not used)
- `GET_BUILDER_SUBNET_BY_ID` (defined but not used)

