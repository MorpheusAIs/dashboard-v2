  # GraphQL Test Queries for Ponder Playground

This document contains sample GraphQL queries you can use to test your deployed Ponder instance.

## 1. Basic Queries

### Get All Builders Projects
```graphql
query GetAllProjects {
  buildersProjects {
    items {
      id
      name
      admin
      totalStaked
      totalUsers
      totalClaimed
      minimalDeposit
      chainId
      contractAddress
      slug
      description
      website
      image
      createdAt
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
    }
    totalCount
  }
}
```

### Get a Specific Project by ID
```graphql
query GetProject($projectId: String!) {
  buildersProject(id: $projectId) {
    id
    name
    admin
    totalStaked
    totalUsers
    totalClaimed
    minimalDeposit
    withdrawLockPeriodAfterDeposit
    claimLockEnd
    startsAt
    chainId
    contractAddress
    slug
    description
    website
    image
    createdAt
    createdAtBlock
  }
}
```
**Variables:**
```json
{
  "projectId": "0x1234567890abcdef1234567890abcdef12345678"
}
```

### Get Global Counters
```graphql
query GetCounters {
  counterss {
    items {
      id
      totalBuildersProjects
      totalSubnets
      totalStaked
      totalUsers
      lastUpdated
    }
  }
}
```

## 2. User Queries

### Get All Users
```graphql
query GetAllUsers {
  buildersUsers(limit: 100) {
    items {
      id
      buildersProjectId
      address
      staked
      claimed
      lastStake
      claimLockEnd
      lastDeposit
      virtualDeposited
      chainId
    }
    totalCount
  }
}
```

### Get Users for a Specific Project
```graphql
query GetProjectUsers($projectId: String!) {
  buildersUsers(
    where: { buildersProjectId: $projectId }
    orderBy: "staked"
    orderDirection: "desc"
    limit: 50
  ) {
    items {
      id
      address
      staked
      claimed
      lastStake
      claimLockEnd
      lastDeposit
      virtualDeposited
      project {
        name
        slug
      }
    }
    totalCount
  }
}
```
**Variables:**
```json
{
  "projectId": "0x1234567890abcdef1234567890abcdef12345678"
}
```

### Get Users by Address
```graphql
query GetUserByAddress($userAddress: String!) {
  buildersUsers(
    where: { address: $userAddress }
    limit: 100
  ) {
    items {
      id
      buildersProjectId
      address
      staked
      claimed
      lastStake
      project {
        id
        name
        slug
      }
    }
    totalCount
  }
}
```
**Variables:**
```json
{
  "userAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
}
```

### Get Projects Where a User Has Staked
```graphql
query GetProjectsForUser($userAddress: String!) {
  buildersUsers(
    where: { address: $userAddress }
    orderBy: "staked"
    orderDirection: "desc"
    limit: 100
  ) {
    items {
      project {
        id
        name
        slug
        description
        website
        image
        admin
        totalStaked
        totalUsers
        totalClaimed
        minimalDeposit
        withdrawLockPeriodAfterDeposit
        claimLockEnd
        startsAt
        chainId
        contractAddress
        createdAt
      }
      staked
      claimed
      lastStake
      claimLockEnd
      lastDeposit
      virtualDeposited
    }
    totalCount
  }
}
```
**Variables:**
```json
{
  "userAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
}
```

**Alternative: Get Only Projects (without user staking details)**
```graphql
query GetProjectsForUserOnly($userAddress: String!) {
  buildersUsers(
    where: { address: $userAddress }
    limit: 100
  ) {
    items {
      project {
        id
        name
        slug
        description
        totalStaked
        totalUsers
        minimalDeposit
        chainId
        contractAddress
      }
    }
    totalCount
  }
}
```
**Variables:**
```json
{
  "userAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
}
```

### Get Top Stakers (Users with Highest Staked Amount)
```graphql
query GetTopStakers {
  buildersUsers(
    orderBy: "staked"
    orderDirection: "desc"
    limit: 10
  ) {
    items {
      id
      address
      staked
      claimed
      project {
        name
        slug
      }
    }
  }
}
```

## 3. Staking Event Queries

### Get All Staking Events
```graphql
query GetAllStakingEvents {
  stakingEvents(limit: 100) {
    items {
      id
      buildersProjectId
      userAddress
      eventType
      amount
      blockNumber
      blockTimestamp
      transactionHash
      logIndex
      chainId
    }
    totalCount
  }
}
```

### Get Events for a Specific Project
```graphql
query GetProjectEvents($projectId: String!) {
  stakingEvents(
    where: { buildersProjectId: $projectId }
    orderBy: "blockTimestamp"
    orderDirection: "desc"
    limit: 50
  ) {
    items {
      id
      userAddress
      eventType
      amount
      blockNumber
      blockTimestamp
      transactionHash
      project {
        name
        slug
      }
    }
    totalCount
  }
}
```
**Variables:**
```json
{
  "projectId": "0x1234567890abcdef1234567890abcdef12345678"
}
```

### Get Events by User Address
```graphql
query GetUserEvents($userAddress: String!) {
  stakingEvents(
    where: { userAddress: $userAddress }
    orderBy: "blockTimestamp"
    orderDirection: "desc"
    limit: 50
  ) {
    items {
      id
      buildersProjectId
      eventType
      amount
      blockNumber
      blockTimestamp
      transactionHash
      project {
        name
        slug
      }
    }
    totalCount
  }
}
```
**Variables:**
```json
{
  "userAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
}
```

### Get Only Deposit Events
```graphql
query GetDepositEvents {
  stakingEvents(
    where: { eventType: "DEPOSIT" }
    orderBy: "blockTimestamp"
    orderDirection: "desc"
    limit: 50
  ) {
    items {
      id
      buildersProjectId
      userAddress
      amount
      blockTimestamp
      transactionHash
      project {
        name
      }
    }
    totalCount
  }
}
```

### Get Only Withdraw Events
```graphql
query GetWithdrawEvents {
  stakingEvents(
    where: { eventType: "WITHDRAW" }
    orderBy: "blockTimestamp"
    orderDirection: "desc"
    limit: 50
  ) {
    items {
      id
      buildersProjectId
      userAddress
      amount
      blockTimestamp
      transactionHash
      project {
        name
      }
    }
    totalCount
  }
}
```

### Get Recent Events (Last 24 Hours)
```graphql
query GetRecentEvents {
  stakingEvents(
    where: { 
      blockTimestamp_gte: 1704067200  # Replace with timestamp from 24h ago
    }
    orderBy: "blockTimestamp"
    orderDirection: "desc"
    limit: 100
  ) {
    items {
      id
      buildersProjectId
      userAddress
      eventType
      amount
      blockTimestamp
      transactionHash
    }
    totalCount
  }
}
```

## 4. MOR Transfer Queries

### Get All MOR Transfers
```graphql
query GetAllMorTransfers {
  morTransfers(limit: 100) {
    items {
      id
      from
      to
      value
      blockNumber
      blockTimestamp
      transactionHash
      logIndex
      chainId
      isStakingDeposit
      isStakingWithdraw
      relatedProjectId
    }
    totalCount
  }
}
```

### Get Staking-Related Transfers
```graphql
query GetStakingTransfers {
  morTransfers(
    where: {
      OR: [
        { isStakingDeposit: true }
        { isStakingWithdraw: true }
      ]
    }
    orderBy: "blockTimestamp"
    orderDirection: "desc"
    limit: 50
  ) {
    items {
      id
      from
      to
      value
      isStakingDeposit
      isStakingWithdraw
      blockTimestamp
      transactionHash
      relatedProject {
        name
        slug
      }
    }
    totalCount
  }
}
```

### Get Transfers to/from Specific Address
```graphql
query GetTransfersForAddress($address: String!) {
  morTransfers(
    where: {
      OR: [
        { from: $address }
        { to: $address }
      ]
    }
    orderBy: "blockTimestamp"
    orderDirection: "desc"
    limit: 50
  ) {
    items {
      id
      from
      to
      value
      blockTimestamp
      transactionHash
      isStakingDeposit
      isStakingWithdraw
    }
    totalCount
  }
}
```
**Variables:**
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
}
```

## 5. Reward Distribution Queries

### Get All Reward Distributions
```graphql
query GetAllRewardDistributions {
  rewardDistributions(
    orderBy: "blockTimestamp"
    orderDirection: "desc"
    limit: 100
  ) {
    items {
      id
      receiver
      amount
      blockNumber
      blockTimestamp
      transactionHash
      logIndex
      chainId
      treasuryAddress
    }
    totalCount
  }
}
```

### Get Rewards for Specific Receiver
```graphql
query GetRewardsForReceiver($receiver: String!) {
  rewardDistributions(
    where: { receiver: $receiver }
    orderBy: "blockTimestamp"
    orderDirection: "desc"
    limit: 50
  ) {
    items {
      id
      amount
      blockTimestamp
      transactionHash
      treasuryAddress
    }
    totalCount
  }
}
```
**Variables:**
```json
{
  "receiver": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
}
```

## 6. Dynamic Subnet Queries

### Get All Dynamic Subnets
```graphql
query GetAllDynamicSubnets {
  dynamicSubnets(
    orderBy: "createdAt"
    orderDirection: "desc"
    limit: 100
  ) {
    items {
      id
      creator
      factoryAddress
      creationSalt
      createdAt
      createdAtBlock
      chainId
    }
    totalCount
  }
}
```

### Get Subnets Created by Specific Address
```graphql
query GetSubnetsByCreator($creator: String!) {
  dynamicSubnets(
    where: { creator: $creator }
    orderBy: "createdAt"
    orderDirection: "desc"
    limit: 50
  ) {
    items {
      id
      creator
      factoryAddress
      createdAt
      chainId
    }
    totalCount
  }
}
```
**Variables:**
```json
{
  "creator": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
}
```

## 7. Complex/Nested Queries

### Get Project with Users and Events
```graphql
query GetProjectWithDetails($projectId: String!) {
  buildersProject(id: $projectId) {
    id
    name
    admin
    totalStaked
    totalUsers
    totalClaimed
    slug
    description
    users(limit: 10, orderBy: "staked", orderDirection: "desc") {
      items {
        id
        address
        staked
        claimed
        lastStake
      }
      totalCount
    }
    events(limit: 20, orderBy: "blockTimestamp", orderDirection: "desc") {
      items {
        id
        userAddress
        eventType
        amount
        blockTimestamp
        transactionHash
      }
      totalCount
    }
  }
}
```
**Variables:**
```json
{
  "projectId": "0x1234567890abcdef1234567890abcdef12345678"
}
```

### Get User with Project Details
```graphql
query GetUserWithProject($userId: String!) {
  buildersUser(id: $userId) {
    id
    address
    staked
    claimed
    lastStake
    claimLockEnd
    lastDeposit
    virtualDeposited
    project {
      id
      name
      slug
      description
      totalStaked
      totalUsers
      minimalDeposit
    }
  }
}
```
**Variables:**
```json
{
  "userId": "0x1234567890abcdef1234567890abcdef12345678-0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
}
```

## 8. Filtered Queries

### Get Projects with High Total Staked
```graphql
query GetHighStakeProjects {
  buildersProjects(
    where: { totalStaked_gt: "1000000000000000000000" }  # 1000 tokens (adjust based on decimals)
    orderBy: "totalStaked"
    orderDirection: "desc"
    limit: 20
  ) {
    items {
      id
      name
      totalStaked
      totalUsers
      slug
    }
    totalCount
  }
}
```

### Get Projects by Chain ID
```graphql
query GetProjectsByChain($chainId: Int!) {
  buildersProjects(
    where: { chainId: $chainId }
    orderBy: "createdAt"
    orderDirection: "desc"
  ) {
    items {
      id
      name
      chainId
      contractAddress
      totalStaked
      totalUsers
      createdAt
    }
    totalCount
  }
}
```
**Variables:**
```json
{
  "chainId": 11155111  # Sepolia testnet
}
```

### Get Events in Block Range
```graphql
query GetEventsInBlockRange($minBlock: BigInt!, $maxBlock: BigInt!) {
  stakingEvents(
    where: {
      AND: [
        { blockNumber_gte: $minBlock }
        { blockNumber_lte: $maxBlock }
      ]
    }
    orderBy: "blockNumber"
    orderDirection: "asc"
  ) {
    items {
      id
      buildersProjectId
      userAddress
      eventType
      amount
      blockNumber
      transactionHash
    }
    totalCount
  }
}
```
**Variables:**
```json
{
  "minBlock": "5000000",
  "maxBlock": "5100000"
}
```

## 9. Pagination Examples

### Paginated Projects Query
```graphql
query GetProjectsPaginated($after: String, $limit: Int!) {
  buildersProjects(
    after: $after
    limit: $limit
    orderBy: "createdAt"
    orderDirection: "desc"
  ) {
    items {
      id
      name
      totalStaked
      totalUsers
      createdAt
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
    totalCount
  }
}
```
**Variables:**
```json
{
  "after": null,
  "limit": 20
}
```

### Paginated Events Query
```graphql
query GetEventsPaginated($after: String, $limit: Int!) {
  stakingEvents(
    after: $after
    limit: $limit
    orderBy: "blockTimestamp"
    orderDirection: "desc"
  ) {
    items {
      id
      buildersProjectId
      userAddress
      eventType
      amount
      blockTimestamp
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      endCursor
    }
    totalCount
  }
}
```
**Variables:**
```json
{
  "after": null,
  "limit": 50
}
```

## 10. Meta Query (Indexing Status)

### Get Indexing Status
```graphql
query GetMeta {
  _meta {
    status
  }
}
```

## Usage Tips

1. **Replace Placeholder Values**: Replace placeholder addresses and IDs with actual values from your deployment
2. **Adjust Timestamps**: For time-based queries, use current Unix timestamps
3. **Chain ID**: Use the appropriate chain ID (e.g., 11155111 for Sepolia)
4. **BigInt Values**: When filtering by BigInt fields, use string values (e.g., `"1000000000000000000000"`)
5. **Pagination**: Use `pageInfo.endCursor` from previous queries as the `after` parameter for next page
6. **Limit**: Always set reasonable limits to avoid timeouts (default is usually 100)

## Example Test Flow

1. Start with `GetCounters` to verify indexing is working
2. Use `GetAllProjects` to see available projects
3. Pick a project ID and use `GetProjectWithDetails` to see full details
4. Use `GetProjectUsers` to see stakers
5. Use `GetProjectEvents` to see activity
6. Test filtering with `GetHighStakeProjects` or `GetDepositEvents`

