# GraphQL Test Queries for Ponder Builders Indexer

This document contains test queries you can run in the GraphiQL playground to verify your Ponder indexer is working correctly.

## Accessing GraphiQL Playground

When running `ponder dev`, the GraphiQL playground is typically available at:
```
http://localhost:42069/graphql
```

## Quick Start - Essential Queries

### 1. Health Check (Start Here!)
```graphql
query HealthCheck {
  counters(id: "global") {
    id
    totalBuildersProjects
  }
  
  buildersProjects(limit: 1) {
    items {
      id
      name
    }
    totalCount
  }
}
```

### 1b. Diagnostic Query - Check What Data Exists
If projects return 0, use this to diagnose:
```graphql
query DiagnosticCheck {
  # Check counters
  counters(id: "global") {
    id
    totalBuildersProjects
    totalSubnets
    totalStaked
    totalUsers
    lastUpdated
  }
  
  # Check if any events exist
  stakingEvents(limit: 5) {
    items {
      id
      eventType
      buildersProjectId
      blockTimestamp
    }
    totalCount
  }
  
  # Check if any users exist
  buildersUsers(limit: 5) {
    items {
      id
      address
      buildersProjectId
    }
    totalCount
  }
  
  # Check if any transfers exist
  morTransfers(limit: 5) {
    items {
      id
      isStakingDeposit
      isStakingWithdraw
    }
    totalCount
  }
  
  # Check meta/status - THIS IS CRITICAL FOR SYNC STATUS
  _meta {
    status
  }
}
```

### 1c. Indexer Sync Status Check (CRITICAL)
Run this first to see if the indexer is syncing:
```graphql
query CheckIndexerStatus {
  _meta {
    status
  }
  
  counters(id: "global") {
    totalBuildersProjects
    totalUsers
    totalStaked
    lastUpdated
  }
}
```

The `_meta.status` will show sync progress. If it's empty or shows errors, the indexer isn't syncing properly.

### 1d. Check What Events Have Been Indexed (For Syncing Indexers)
If indexer is syncing but queries return 0, check what events exist:
```graphql
query CheckIndexedEvents {
  # Check what event types have been indexed
  stakingEvents(limit: 20) {
    items {
      id
      eventType
      buildersProjectId
      blockNumber
      blockTimestamp
      userAddress
      amount
    }
    totalCount
  }
  
  # Check MOR transfers
  morTransfers(limit: 20) {
    items {
      id
      from
      to
      value
      isStakingDeposit
      isStakingWithdraw
      blockNumber
      blockTimestamp
    }
    totalCount
  }
  
  # Check counters
  counters(id: "global") {
    totalBuildersProjects
    totalUsers
    totalStaked
  }
  
  # Check latest processed block
  latestEvent: stakingEvents(
    orderBy: "blockNumber"
    orderDirection: "desc"
    limit: 1
  ) {
    items {
      blockNumber
      blockTimestamp
      eventType
    }
  }
}
```

**What to look for:**
- If `stakingEvents` shows only `DEPOSIT`/`WITHDRAW` but no projects → Indexer hasn't reached `BuilderPoolCreated` events yet
- If `totalBuildersProjects` is 0 → No `BuilderPoolCreated` events processed yet
- Check `latestEvent.blockNumber` to see how far the indexer has synced

### 2. Get All Projects
```graphql
query GetAllProjects {
  buildersProjects(limit: 10) {
    items {
      id
      name
      admin
      totalStaked
      totalUsers
    }
    totalCount
  }
}
```

### 3. Get All Users
```graphql
query GetAllUsers {
  buildersUsers(limit: 10) {
    items {
      id
      address
      staked
      project {
        id
        name
      }
    }
    totalCount
  }
}
```

### 4. Get Recent Events
```graphql
query GetRecentEvents {
  stakingEvents(
    limit: 20
    orderBy: "blockTimestamp"
    orderDirection: "desc"
  ) {
    items {
      id
      eventType
      userAddress
      amount
      blockTimestamp
      project {
        id
        name
      }
    }
    totalCount
  }
}
```

---

## 1. Basic Entity Queries

### Get All Builder Projects
```graphql
query GetAllProjects {
  buildersProjects(limit: 10) {
    items {
      id
      name
      admin
      totalStaked
      totalUsers
      totalClaimed
      minimalDeposit
      startsAt
      claimLockEnd
      withdrawLockPeriodAfterDeposit
      chainId
      contractAddress
      createdAt
      createdAtBlock
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
    }
    totalCount
  }
}
```

### Get Single Project by ID
```graphql
query GetProject($id: String!) {
  buildersProject(id: $id) {
    id
    name
    admin
    totalStaked
    totalUsers
    totalClaimed
    minimalDeposit
    startsAt
    claimLockEnd
    withdrawLockPeriodAfterDeposit
  }
}
```
**Variables:**
```json
{
  "id": "0x..." // Replace with actual project ID
}
```

### Get All Users
```graphql
query GetAllUsers {
  buildersUsers(limit: 10) {
    items {
      id
      address
      buildersProjectId
      staked
      claimed
      lastStake
      claimLockEnd
      lastDeposit
      virtualDeposited
      chainId
      project {
        id
        name
      }
    }
    totalCount
  }
}
```

### Get All Staking Events
```graphql
query GetAllStakingEvents {
  stakingEvents(limit: 20) {
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
      project {
        id
        name
      }
    }
    totalCount
  }
}
```

### Get All MOR Transfers
```graphql
query GetAllMorTransfers {
  morTransfers(limit: 20) {
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
      relatedProject {
        id
        name
      }
    }
    totalCount
  }
}
```

### Get Global Counters
```graphql
query GetCounters {
  counters(id: "global") {
    id
    totalBuildersProjects
    totalSubnets
    totalStaked
    totalUsers
    lastUpdated
  }
}
```

---

## 2. Relationship Queries

### Get Project with Users
```graphql
query GetProjectWithUsers($projectId: String!) {
  buildersProject(id: $projectId) {
    id
    name
    admin
    totalStaked
    totalUsers
    users(limit: 10) {
      items {
        id
        address
        staked
        claimed
        lastStake
        claimLockEnd
      }
      totalCount
    }
  }
}
```

### Get Project with Events
```graphql
query GetProjectWithEvents($projectId: String!) {
  buildersProject(id: $projectId) {
    id
    name
    totalStaked
    events(limit: 20, orderBy: "blockTimestamp", orderDirection: "desc") {
      items {
        id
        eventType
        userAddress
        amount
        blockTimestamp
        transactionHash
      }
      totalCount
    }
  }
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
    project {
      id
      name
      admin
      totalStaked
      totalUsers
      minimalDeposit
    }
  }
}
```

### Get Staking Event with Project
```graphql
query GetStakingEventWithProject($eventId: String!) {
  stakingEvent(id: $eventId) {
    id
    eventType
    userAddress
    amount
    blockTimestamp
    transactionHash
    project {
      id
      name
      totalStaked
    }
  }
}
```

---

## 3. Filtering Queries

### Get Projects by Admin Address
```graphql
query GetProjectsByAdmin($adminAddress: String!) {
  buildersProjects(
    where: { admin: $adminAddress }
    limit: 10
  ) {
    items {
      id
      name
      admin
      totalStaked
      totalUsers
    }
    totalCount
  }
}
```
**Variables:**
```json
{
  "adminAddress": "0x..." // Replace with admin address
}
```

### Get Projects with High Total Staked
```graphql
query GetHighStakeProjects($minStaked: BigInt!) {
  buildersProjects(
    where: { totalStaked_gt: $minStaked }
    orderBy: "totalStaked"
    orderDirection: "desc"
    limit: 10
  ) {
    items {
      id
      name
      totalStaked
      totalUsers
    }
    totalCount
  }
}
```
**Variables:**
```json
{
  "minStaked": "1000000000000000000" // 1 MOR (18 decimals)
}
```

### Get Users for Specific Project
```graphql
query GetProjectUsers($projectId: String!) {
  buildersUsers(
    where: { buildersProjectId: $projectId }
    limit: 50
    orderBy: "staked"
    orderDirection: "desc"
  ) {
    items {
      id
      address
      staked
      claimed
      lastStake
    }
    totalCount
  }
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
      address
      buildersProjectId
      staked
      claimed
      project {
        id
        name
        totalStaked
      }
    }
    totalCount
  }
}
```

### Get Users with Active Stakes
```graphql
query GetActiveStakers($minStake: BigInt!) {
  buildersUsers(
    where: { staked_gt: $minStake }
    orderBy: "staked"
    orderDirection: "desc"
    limit: 50
  ) {
    items {
      id
      address
      staked
      project {
        id
        name
      }
    }
    totalCount
  }
}
```
**Variables:**
```json
{
  "minStake": "100000000000000000" // 0.1 MOR
}
```

### Get Deposit Events Only
```graphql
query GetDepositEvents($projectId: String!) {
  stakingEvents(
    where: { 
      buildersProjectId: $projectId
      eventType: "DEPOSIT"
    }
    orderBy: "blockTimestamp"
    orderDirection: "desc"
    limit: 50
  ) {
    items {
      id
      userAddress
      amount
      blockTimestamp
      transactionHash
    }
    totalCount
  }
}
```

### Get Withdraw Events Only
```graphql
query GetWithdrawEvents($projectId: String!) {
  stakingEvents(
    where: { 
      buildersProjectId: $projectId
      eventType: "WITHDRAW"
    }
    orderBy: "blockTimestamp"
    orderDirection: "desc"
    limit: 50
  ) {
    items {
      id
      userAddress
      amount
      blockTimestamp
      transactionHash
    }
    totalCount
  }
}
```

### Get Staking-Related MOR Transfers
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
      relatedProjectId
      blockTimestamp
      transactionHash
    }
    totalCount
  }
}
```

---

## 4. Sorting and Pagination Queries

### Get Projects Sorted by Total Staked (Descending)
```graphql
query GetTopProjects {
  buildersProjects(
    orderBy: "totalStaked"
    orderDirection: "desc"
    limit: 10
  ) {
    items {
      id
      name
      totalStaked
      totalUsers
      admin
    }
    totalCount
  }
}
```

### Get Projects Sorted by Total Users
```graphql
query GetProjectsByUsers {
  buildersProjects(
    orderBy: "totalUsers"
    orderDirection: "desc"
    limit: 10
  ) {
    items {
      id
      name
      totalUsers
      totalStaked
    }
    totalCount
  }
}
```

### Get Projects Sorted by Creation Time
```graphql
query GetRecentProjects {
  buildersProjects(
    orderBy: "createdAt"
    orderDirection: "desc"
    limit: 10
  ) {
    items {
      id
      name
      createdAt
      createdAtBlock
      totalStaked
    }
    totalCount
  }
}
```

### Paginated Projects Query (Using Cursor)
```graphql
query GetPaginatedProjects($limit: Int, $after: String) {
  buildersProjects(
    limit: $limit
    after: $after
    orderBy: "createdAt"
    orderDirection: "desc"
  ) {
    items {
      id
      name
      totalStaked
      totalUsers
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      endCursor
      startCursor
    }
    totalCount
  }
}
```
**Variables:**
```json
{
  "limit": 10,
  "after": null
}
```

### Get Top Stakers Across All Projects
```graphql
query GetTopStakers {
  buildersUsers(
    orderBy: "staked"
    orderDirection: "desc"
    limit: 20
  ) {
    items {
      id
      address
      staked
      project {
        id
        name
      }
    }
    totalCount
  }
}
```

---

## 5. Complex Queries

### Get Complete Project Overview
```graphql
query GetCompleteProjectOverview($projectId: String!) {
  buildersProject(id: $projectId) {
    id
    name
    admin
    totalStaked
    totalUsers
    totalClaimed
    minimalDeposit
    startsAt
    claimLockEnd
    withdrawLockPeriodAfterDeposit
    
    # Top 10 stakers
    users(
      limit: 10
      orderBy: "staked"
      orderDirection: "desc"
    ) {
      items {
        id
        address
        staked
        claimed
        lastStake
      }
      totalCount
    }
    
    # Recent events
    events(
      limit: 20
      orderBy: "blockTimestamp"
      orderDirection: "desc"
    ) {
      items {
        id
        eventType
        userAddress
        amount
        blockTimestamp
        transactionHash
      }
      totalCount
    }
  }
  
  # Global stats
  counters(id: "global") {
    id
    totalBuildersProjects
    totalStaked
    totalUsers
  }
}
```

### Get User's Complete Staking History
```graphql
query GetUserStakingHistory($userAddress: String!) {
  # Get all user stakes
  buildersUsers(
    where: { address: $userAddress }
    limit: 100
  ) {
    items {
      id
      address
      staked
      claimed
      lastStake
      claimLockEnd
      project {
        id
        name
        totalStaked
        minimalDeposit
      }
    }
    totalCount
  }
  
  # Get all events for this user
  stakingEvents(
    where: { userAddress: $userAddress }
    orderBy: "blockTimestamp"
    orderDirection: "desc"
    limit: 100
  ) {
    items {
      id
      eventType
      amount
      blockTimestamp
      transactionHash
      project {
        id
        name
      }
    }
    totalCount
  }
}
```

### Get Project Activity Summary
```graphql
query GetProjectActivity($projectId: String!) {
  # Project details
  project: buildersProject(id: $projectId) {
    id
    name
    totalStaked
    totalUsers
  }
  
  # Deposit events
  deposits: stakingEvents(
    where: {
      buildersProjectId: $projectId
      eventType: "DEPOSIT"
    }
    limit: 1
  ) {
    totalCount
  }
  
  # Withdraw events
  withdraws: stakingEvents(
    where: {
      buildersProjectId: $projectId
      eventType: "WITHDRAW"
    }
    limit: 1
  ) {
    totalCount
  }
  
  # Recent activity
  recentEvents: stakingEvents(
    where: { buildersProjectId: $projectId }
    orderBy: "blockTimestamp"
    orderDirection: "desc"
    limit: 10
  ) {
    items {
      id
      eventType
      userAddress
      amount
      blockTimestamp
    }
    totalCount
  }
}
```

---

## 6. Statistics and Analytics Queries

### Get Total Statistics
```graphql
query GetTotalStatistics {
  counters(id: "global") {
    id
    totalBuildersProjects
    totalSubnets
    totalStaked
    totalUsers
    lastUpdated
  }
  
  # Count all projects
  allProjects: buildersProjects(limit: 1) {
    totalCount
  }
  
  # Count all users
  allUsers: buildersUsers(limit: 1) {
    totalCount
  }
}
```

### Get Projects Created in Time Range
```graphql
query GetProjectsInTimeRange($startTime: Int!, $endTime: Int!) {
  buildersProjects(
    where: {
      createdAt_gte: $startTime
      createdAt_lte: $endTime
    }
    orderBy: "createdAt"
    orderDirection: "asc"
  ) {
    items {
      id
      name
      createdAt
      totalStaked
      totalUsers
    }
    totalCount
  }
}
```
**Variables:**
```json
{
  "startTime": 1700000000,
  "endTime": 1735689600
}
```

### Get Events in Time Range
```graphql
query GetEventsInTimeRange($startTime: Int!, $endTime: Int!) {
  stakingEvents(
    where: {
      blockTimestamp_gte: $startTime
      blockTimestamp_lte: $endTime
    }
    orderBy: "blockTimestamp"
    orderDirection: "asc"
    limit: 100
  ) {
    items {
      id
      eventType
      userAddress
      amount
      blockTimestamp
      project {
        id
        name
      }
    }
    totalCount
  }
}
```

---

## 7. Validation Queries

### Verify Data Integrity - Check Project Totals Match User Sums
```graphql
query VerifyProjectTotals($projectId: String!) {
  project: buildersProject(id: $projectId) {
    id
    name
    totalStaked
    totalUsers
    users(limit: 1000) {
      items {
        staked
      }
      totalCount
    }
  }
}
```
*Note: You can manually verify that the sum of user stakes matches totalStaked*

### Check for Recent Activity
```graphql
query CheckRecentActivity($hoursAgo: Int!) {
  recentEvents: stakingEvents(
    where: {
      blockTimestamp_gte: $hoursAgo
    }
    orderBy: "blockTimestamp"
    orderDirection: "desc"
    limit: 50
  ) {
    items {
      id
      eventType
      userAddress
      amount
      blockTimestamp
      project {
        id
        name
      }
    }
    totalCount
  }
}
```
**Variables:**
```json
{
  "hoursAgo": 1735689600 // Unix timestamp for 24 hours ago
}
```

---

## 8. Quick Health Check Queries

### Minimal Health Check
```graphql
query HealthCheck {
  counters(id: "global") {
    id
    totalBuildersProjects
  }
  
  buildersProjects(limit: 1) {
    items {
      id
      name
    }
    totalCount
  }
}
```

### Extended Health Check
```graphql
query ExtendedHealthCheck {
  counters(id: "global") {
    id
    totalBuildersProjects
    totalSubnets
    totalStaked
    totalUsers
    lastUpdated
  }
  
  recentProjects: buildersProjects(
    orderBy: "createdAt"
    orderDirection: "desc"
    limit: 5
  ) {
    items {
      id
      name
      totalStaked
      totalUsers
      createdAt
    }
    totalCount
  }
  
  recentEvents: stakingEvents(
    orderBy: "blockTimestamp"
    orderDirection: "desc"
    limit: 5
  ) {
    items {
      id
      eventType
      blockTimestamp
      project {
        id
        name
      }
    }
    totalCount
  }
}
```

### Check Earliest Processed Block
Use this to verify what blocks have been processed:
```graphql
query CheckEarliestBlock {
  # Get earliest event
  earliestEvent: stakingEvents(
    orderBy: "blockTimestamp"
    orderDirection: "asc"
    limit: 1
  ) {
    items {
      id
      blockNumber
      blockTimestamp
      eventType
      buildersProjectId
    }
  }
  
  # Get earliest project
  earliestProject: buildersProjects(
    orderBy: "createdAtBlock"
    orderDirection: "asc"
    limit: 1
  ) {
    items {
      id
      name
      createdAtBlock
      createdAt
    }
  }
}
```

---

## Usage Tips

1. **Start Simple**: Begin with basic queries like `GetAllProjects` or `GetCounters` to verify the indexer is running.

2. **Check Relationships**: Use relationship queries to verify that foreign keys and relationships are working correctly.

3. **Test Filtering**: Try filtering queries with actual data IDs/addresses from your indexed data.

4. **Verify Sorting**: Check that `orderBy` and `orderDirection` work as expected.

5. **Test Pagination**: Use `limit` and cursor-based pagination (`after`/`before`) to test pagination with larger datasets.

6. **Monitor Performance**: For production, monitor query performance and add indexes if needed.

7. **Error Handling**: If queries fail, check:
   - Entity names match your schema (case-sensitive)
   - Field names match your schema
   - Variable types match expected types
   - Required fields are provided

---

## Common Issues and Solutions

### Issue: Query returns empty results (0 projects/users/events)

**Possible Causes:**
1. **Indexer hasn't synced yet** - The indexer needs time to process blocks from the start block
2. **Start block is too high** - If your start block is after when pools were created, no events will be found
3. **No events exist** - If no `BuilderPoolCreated` events have been emitted on-chain, there will be no projects
4. **Indexer not running** - Make sure `ponder dev` is running and syncing

**Debugging Steps:**

1. **Check if indexer is syncing:**
   ```graphql
   query CheckSyncStatus {
     _meta {
       status
     }
   }
   ```

2. **Check counters to see if ANY data exists:**
   ```graphql
   query CheckCounters {
     counters(id: "global") {
       totalBuildersProjects
       totalUsers
       totalStaked
       lastUpdated
     }
   }
   ```

3. **Check if ANY events were processed:**
   ```graphql
   query CheckEvents {
     stakingEvents(limit: 1) {
       totalCount
       items {
         id
         eventType
         blockTimestamp
         blockNumber
       }
     }
   }
   ```

4. **Verify your start block:**
   - Check `ponder.config.ts` - start block is `24381796` (or `BUILDERS_START_BLOCK` env var)
   - Check Base explorer to see when `BuilderPoolCreated` events were first emitted
   - If events happened before your start block, you need to lower the start block

5. **Check contract address:**
   - Verify `0x42BB446eAE6dca7723a9eBdb81EA88aFe77eF4B9` is correct
   - Check Base explorer for this contract to see if it has emitted events

6. **Check Ponder logs:**
   - Look for errors in `ponder dev` console output
   - Check for "Processing block" messages to confirm syncing
   - Look for any error messages about events

**If counters show 0 for everything:**
- The indexer likely hasn't processed any blocks yet, or
- The start block is incorrect, or  
- No events exist on-chain for the configured contract/start block

**If counters exist but projects don't:**
- Projects are only created from `BuilderPoolCreated` events
- Check if any `BuilderPoolCreated` events exist in the processed blocks
- Use the diagnostic query above to see what data exists

### Issue: Relationship fields return null
- **Solution**: Verify that foreign key relationships are correctly set up in your schema relations.

### Issue: BigInt values appear as strings
- **Solution**: This is expected behavior. BigInt values are serialized as strings in JSON/GraphQL.

### Issue: Filtering doesn't work
- **Solution**: Check that filter field names match your schema exactly. Ponder uses underscore notation (e.g., `totalStaked_gt`). Also note that `OR` (not `or`) is used for logical OR operations.

### Issue: Relationship field returns null
- **Solution**: The relationship field for `buildersUser` is `project` (not `buildersProject`). Make sure you're using the correct field name from the generated schema.

---

## Troubleshooting: Indexer Syncing But No Results

**If you see "Indexed X events" in logs but queries return 0:**

This means the indexer is working, but:
1. It hasn't reached blocks with `BuilderPoolCreated` events yet, OR
2. The events being indexed are MOR transfers or deposits before pools exist

**Check what's been indexed:**
```graphql
query CheckWhatWasIndexed {
  # See what events exist
  stakingEvents(limit: 10) {
    items {
      eventType
      buildersProjectId
      blockNumber
    }
    totalCount
  }
  
  # Check counters
  counters(id: "global") {
    totalBuildersProjects
  }
  
  # Check latest block processed
  latest: stakingEvents(
    orderBy: "blockNumber"
    orderDirection: "desc"
    limit: 1
  ) {
    items {
      blockNumber
      blockTimestamp
    }
  }
}
```

**If `totalBuildersProjects` is 0:**
- The indexer hasn't processed any `BuilderPoolCreated` events yet
- Wait for it to sync further (it's only at ~35% based on your logs)
- Or check if `BuilderPoolCreated` events exist at your start block

**If events exist but no projects:**
- Events might be `DEPOSIT`/`WITHDRAW` for pools that were created before your start block
- You need to lower your start block to when pools were first created

---

## Troubleshooting: Completely Empty Results (No Events, No Projects)

**If you get empty results for everything** (like the user's case), the indexer hasn't processed any blocks yet. Follow these steps:

### Step 1: Check Indexer Sync Status
Run this query first:
```graphql
query CheckIndexerStatus {
  _meta {
    status
  }
  
  counters(id: "global") {
    totalBuildersProjects
    totalUsers
    totalStaked
    lastUpdated
  }
}
```

**What to look for:**
- If `_meta.status` is `null` or empty → Indexer hasn't started syncing
- If `_meta.status` shows sync progress → Indexer is working but may not have reached your start block yet
- If `counters` returns `null` → Database hasn't been initialized yet

### Step 2: Check Ponder Console Logs
Look at your terminal where `ponder dev` is running. You should see:
- ✅ `"Starting Ponder..."` 
- ✅ `"Processing block X"` messages
- ✅ `"Indexed BuilderPoolCreated"` messages (when events are found)
- ❌ Error messages about RPC connection
- ❌ Error messages about database connection

**If you see NO "Processing block" messages:**
- The indexer isn't syncing
- Check RPC connection (Base RPC might be rate-limited)
- Check database connection (if using PostgreSQL)

### Step 3: Verify Start Block
Your config uses start block `24381796` for Builders contract. 

**Check if this is correct:**
1. Go to Base explorer: https://basescan.org/address/0x42BB446eAE6dca7723a9eBdb81EA88aFe77eF4B9#events
2. Filter for `BuilderPoolCreated` events
3. Check what block the FIRST event occurred at
4. If first event is BEFORE 24381796 → Lower your start block
5. If first event is AFTER 24381796 → Indexer needs to sync to that block

**Current Base block:** Check https://basescan.org/ to see current block number. If it's close to 24381796, there may not be many blocks to sync.

### Step 4: Check RPC Connection
Your config uses:
- `https://mainnet.base.org` (primary)
- `https://base-rpc.publicnode.com` (fallback, rate-limited to 25 req/sec)

**If RPC is failing:**
- Try setting `PONDER_RPC_URL_8453` env var to a different RPC
- Use Alchemy/Infura if you have API keys
- Check if public RPCs are rate-limiting you

### Step 5: Check Database Connection
If using PostgreSQL:
- Verify `DATABASE_URL` is set correctly
- Check if database is accessible
- Check Railway/database logs for connection errors

If using PGlite (local dev):
- Check if `.ponder` folder exists
- Check disk space
- Try deleting `.ponder` folder and restarting

### Step 6: Verify Contract Address
Double-check the contract address is correct:
- Config: `0x42BB446eAE6dca7723a9eBdb81EA88aFe77eF4B9`
- Verify on Base explorer: https://basescan.org/address/0x42BB446eAE6dca7723a9eBdb81EA88aFe77eF4B9

### Step 7: Restart Indexer
If nothing works:
1. Stop `ponder dev` (Ctrl+C)
2. If using PGlite, delete `.ponder` folder: `rm -rf .ponder`
3. Restart: `ponder dev`
4. Watch console for "Processing block" messages

### Quick Action Checklist

**Run these in order:**

1. **Check indexer status:**
   ```graphql
   query { _meta { status } }
   ```

2. **Check console output:**
   - Look for "Processing block" messages
   - Look for any error messages
   - Check if RPC calls are failing

3. **Verify start block:**
   - Current Base block: https://basescan.org/
   - Your start block: `24381796`
   - If current block < start block, that's the problem!

4. **Check if events exist:**
   - Visit: https://basescan.org/address/0x42BB446eAE6dca7723a9eBdb81EA88aFe77eF4B9#events
   - Filter for `BuilderPoolCreated`
   - Check what block the first event is at

5. **If indexer isn't syncing:**
   - Check RPC connection (try different RPC)
   - Check database connection
   - Restart indexer

**Most Common Issue:** Start block `24381796` might be AFTER the current block, or the indexer hasn't synced to that block yet. Check current Base block number!

---

## Troubleshooting: No Projects Found (But Events Exist)

If `buildersProjects` queries return 0 results but events exist, follow these steps:

### Step 1: Run Diagnostic Query
```graphql
query DiagnosticCheck {
  counters(id: "global") {
    totalBuildersProjects
    totalUsers
    totalStaked
    lastUpdated
  }
  
  stakingEvents(limit: 1) {
    totalCount
  }
  
  buildersUsers(limit: 1) {
    totalCount
  }
  
  _meta {
    status
  }
}
```

### Step 2: Check Ponder Console
Look at your `ponder dev` console output for:
- ✅ "Processing block X" messages (indexer is syncing)
- ✅ "Indexed BuilderPoolCreated" messages (events found)
- ❌ Error messages about RPC or blocks
- ❌ "No events found" messages

### Step 3: Verify Start Block
Your config uses start block `24381796`. Verify:
1. Check Base explorer: https://basescan.org/address/0x42BB446eAE6dca7723a9eBdb81EA88aFe77eF4B9#events
2. Find the first `BuilderPoolCreated` event
3. If it's before block 24381796, you need to lower your start block
4. If it's after block 24381796, wait for the indexer to sync to that block

### Step 4: Check Contract Events on Base Explorer
1. Go to: https://basescan.org/address/0x42BB446eAE6dca7723a9eBdb81EA88aFe77eF4B9#events
2. Filter for `BuilderPoolCreated` events
3. Check if any exist and what block they're at
4. If none exist, no pools have been created yet on-chain

### Step 5: Verify Indexer is Syncing
Check if blocks are being processed:
```graphql
query CheckSyncProgress {
  stakingEvents(
    orderBy: "blockTimestamp"
    orderDirection: "desc"
    limit: 1
  ) {
    items {
      blockNumber
      blockTimestamp
    }
  }
}
```

Compare the block number to the current Base block (check https://basescan.org/).

### Step 6: Reset and Re-sync (if needed)
If start block is wrong:
1. Stop `ponder dev`
2. Update `BUILDERS_START_BLOCK` env var or `ponder.config.ts`
3. Clear database (if using PGlite, delete `.ponder` folder)
4. Restart `ponder dev`

### Common Scenarios:

**Scenario A: Indexer hasn't synced yet**
- Counters show 0 for everything
- Solution: Wait for indexer to catch up

**Scenario B: Start block too high**
- No events found, but contract has events before start block
- Solution: Lower start block to when contract was deployed

**Scenario C: No pools created yet**
- Contract exists but no `BuilderPoolCreated` events emitted
- Solution: This is expected - projects only appear after pools are created

**Scenario D: Indexer stuck**
- No "Processing block" messages in console
- Solution: Check RPC connection, restart indexer

---

## Next Steps

After verifying these queries work:

1. **Add Custom Queries**: Create queries specific to your frontend needs
2. **Optimize**: Add indexes for frequently queried fields
3. **Monitor**: Set up monitoring for query performance
4. **Document**: Document your custom queries for your team
