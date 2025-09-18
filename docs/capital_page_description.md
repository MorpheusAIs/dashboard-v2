# Morpheus Capital Page (/capital) Documentation

This document describes the structure, functionality, and technical details of the `/capital` page in the Morpheus Dashboard.

## Overview

The `/capital` page serves as the primary interface for users to contribute capital (in the form of stETH or wstETH) to the Morpheus network's public liquidity pool and manage their position, including claiming MOR rewards.

The main component responsible for this view is `src/pages/HomePage/views/PublicPoolView.vue`. It utilizes data and interaction logic primarily from the `src/composables/use-pool.ts` composable and the `src/store/modules/web3-providers.module.ts` store module.

## Page Structure

The page is broadly divided into two main sections:

1.  **Info Bar (`<info-bar>`):** Displays global information about the public capital pool.
    *   **Title:** "Capital"
    *   **Description:** Provides context about the pool, potentially including details on lock periods via the `<zero-pool-description>` component.
        *   *Note:* There's an identified inconsistency where the `withdrawAfterTime` prop passed to `<zero-pool-description>` incorrectly treats a duration (`withdrawLockPeriodAfterStake`) as a timestamp. The `claimAfterTime` prop correctly passes the calculated global initial claim lock end timestamp.
    *   **Indicators:** Shows key metrics for the entire pool:
        *   Total Deposits (stETH/wstETH): From `poolData.totalDeposited`.
        *   Current Daily Reward (MOR): Calculated in the frontend (`use-pool.ts -> getDailyReward`) based on contract parameters (`initialReward`, `rewardDecrease`, `decreaseInterval`, `payoutStart`) fetched via the `pools` function. It represents the current reward rate per interval.
        *   Pool Start Time: From `poolData.payoutStart` (timestamp).
        *   Withdraw Lock Until: Displays the calculated absolute timestamp (`withdrawAtTime` computed property in `PublicPoolView.vue`) when the *user's* deposit is no longer locked, based on `payoutStart`, `withdrawLockPeriod`, `lastStake`, and `withdrawLockPeriodAfterStake`.
        *   Claim Lock Until: Displays the calculated absolute timestamp (`claimLockTime` computed property in `PublicPoolView.vue`) when the *user's* rewards are claimable, based on `claimLockEnd`, `payoutStart`, `claimLockPeriod`, `lastClaim`, `lastStake`, `claimLockPeriodAfterClaim`, and `claimLockPeriodAfterStake`.
    *   **Actions:**
        *   "Deposit stETH/wstETH" Button: Opens the `DepositModal` for staking.
        *   (Optional) Link to acquire stETH.

2.  **Info Dashboard (`<info-dashboard>`):** Displays user-specific information and actions related to their position in the pool.
    *   **Indicators:** Shows metrics relevant to the connected wallet:
        *   Your Deposit (stETH/wstETH)
        *   Available to Claim (MOR)
        *   Your Power Factor (Reward Multiplier - only shown on `/capital`, not `/dashboard/capital`)
    *   **Graphs:** This section, implemented within `src/common/InfoDashboard/index.vue`, shows historical data selectable by month and year. It uses an `<app-chart>` component and fetches data via GraphQL using the `useFirstApolloClient` composable. Data fetching is handled by helper functions located in `src/common/InfoDashboard/helpers.ts`.
        *   **Subgraph Endpoint (Mainnet):** `https://api.studio.thegraph.com/query/67225/morpheus-dashboard/version/latest` (The Sepolia endpoint is different but configured similarly in `config.ts`).
        *   **Amount of Deposited stETH Graph:**
            *   Toggled via chart controls.
            *   **Helper Function:** `getChartData(poolId, payoutStart, month, year, apolloClient)`.
            *   **Purpose:** Queries the subgraph to get the total deposited stETH value at the end of each day for the selected period.
            *   **Actual GraphQL Query Structure (sent via `getChartData` helper):** The frontend constructs a query with multiple aliases (`d1`, `d2`, ... up to `d31`), one for each day of the month. Each alias queries the `poolInteractions` entity to find the latest record on or before the end of that specific day.
                ```graphql
                # Example structure (variables like timestamps and pool ID are dynamic)
                query GetEndOfDayDeposits {
                  # Alias for Day 1
                  d1: poolInteractions(
                    first: 1
                    orderDirection: desc
                    where: {timestamp_lte: "<end_timestamp_day_1>", pool: "<pool_id>"}
                    orderBy: timestamp
                  ) {
                    totalStaked
                    __typename
                  }
                  # Alias for Day 2
                  d2: poolInteractions(
                    first: 1
                    orderDirection: desc
                    where: {timestamp_lte: "<end_timestamp_day_2>", pool: "<pool_id>"}
                    orderBy: timestamp
                  ) {
                    totalStaked
                    __typename
                  }
                  # ... continues for d3, d4, ... up to d31
                }
                ```
            *   **Response Data Shape (TypeScript Type):**
                ```typescript
                interface PoolInteraction {
                  totalStaked: string; // BigNumber represented as a string
                  __typename: "PoolInteraction";
                }

                interface DailyDepositResponse {
                  data: {
                    [dayAlias: string]: PoolInteraction[]; // e.g., d1: [PoolInteraction], d2: [PoolInteraction]
                  };
                }
                ```
        *   **User Earned MOR Graph:**
            *   Toggled via chart controls.
            *   **Helper Function:** `getUserYieldPerDayChartData(poolId, userAddress, month, year, apolloClient)`.
            *   **Purpose:** Queries the subgraph for the connected user's daily earned or claimed MOR for the selected period.
            *   **Inferred GraphQL Query Logic (Option A - User Snapshots):**
                ```graphql
                query GetUserDailySnapshots($userId: ID!, $startDate: BigInt!, $endDate: BigInt!) {
                  userDailySnapshots( # Assumes this entity exists
                    where: {
                      user: $userId,
                      timestamp_gte: $startDate,
                      timestamp_lt: $endDate
                    },
                    orderBy: timestamp,
                    orderDirection: asc
                  ) {
                    id
                    timestamp
                    totalClaimed # Or calculated rewardsEarned
                  }
                }
                ```
            *   **Inferred GraphQL Query Logic (Option B - Aggregating Claims):**
                ```graphql
                query GetUserClaims($userId: ID!, $startDate: BigInt!, $endDate: BigInt!) {
                  claims( # Assumes Claim event entity exists
                    where: {
                      user: $userId,
                      timestamp_gte: $startDate,
                      timestamp_lt: $endDate
                    },
                    orderBy: timestamp,
                    orderDirection: asc
                  ) {
                    id
                    timestamp
                    amount
                  }
                }
                ```
    *   **Actions:**
        *   "Withdraw stETH/wstETH" Button: Opens the `WithdrawModal`.
        *   "Claim MOR" Button: Opens the `ClaimModal`.
        *   "Stake MOR Rewards" Button: Opens the `ChangeLockModal` (only shown on `/capital`, not `/dashboard/capital`).
    *   **Notes:** Displays informational text about withdrawal/claim processes (e.g., claims mint MOR on Arbitrum One) and lock period requirements.

## Core Functionality

### 1. Staking / Depositing (stETH/wstETH)

*   **Trigger:** User clicks the "Deposit stETH/wstETH" button in the Info Bar.
*   **UI:** The `DepositModal` appears, prompting the user for the amount to deposit. It may include steps for swapping other assets into stETH/wstETH if needed (`SwapStep.vue`). It also interacts with the `ChangeLockModal` logic to potentially set an initial claim lock period.
*   **Contract Interaction:**
    *   Calls a `deposit` or `stake` function on the main pool contract (`erc1967ProxyContract`).
    *   Requires the user to approve the contract to spend their stETH/wstETH.
    *   Sends the specified amount of stETH/wstETH to the contract.
    *   May accept a `referrer` address.
    *   The `usePool` composable reads `poolData.minimalStake` to enforce minimums.
*   **Key Functions (Read):** `pools`, `usersData` (to check current deposit).

### 2. Claiming Rewards (MOR)

*   **Trigger:** User clicks the "Claim MOR" button in the Info Dashboard.
*   **UI:** The `ClaimModal` appears, showing the amount of MOR available to claim.
*   **Contract Interaction:**
    *   Calls a `claim` or `claimReward` function on the main pool contract (`erc1967ProxyContract`).
    *   The contract calculates the rewards based on the user's deposit, time staked, and multiplier.
    *   The claimed MOR tokens are minted to the user's wallet on the **Arbitrum One** network.
*   **Eligibility:** Determined by `usePool` composable (`isClaimDisabled` computed property). Checks various lock conditions (`claimLockEnd`, `payoutStart`, `claimLockPeriod`, `lastClaim`, `lastStake`, `claimLockPeriodAfterClaim`, `claimLockPeriodAfterStake`).
*   **Key Functions (Read):** `getCurrentUserReward`, `usersData`, `pools`, `poolsLimits`.

### 3. Withdrawing Deposit (stETH/wstETH)

*   **Trigger:** User clicks the "Withdraw stETH/wstETH" button in the Info Dashboard.
*   **UI:** The `WithdrawModal` appears, allowing the user to specify the amount to withdraw (up to their deposited total).
*   **Contract Interaction:**
    *   Calls a `withdraw` function on the main pool contract (`erc1967ProxyContract`).
    *   The contract transfers the specified amount of stETH/wstETH back to the user's wallet on the **Ethereum** network (Mainnet/Sepolia).
*   **Eligibility:** Determined by `usePool` composable (`isWithdrawDisabled` computed property). Checks lock conditions based on `payoutStart`, `withdrawLockPeriod`, `lastStake`, and `withdrawLockPeriodAfterStake`.
*   **Key Functions (Read):** `usersData`, `pools`.

### 4. Staking MOR Rewards / Changing Lock Period

*   **Trigger:** User clicks the "Stake MOR Rewards" button in the Info Dashboard (only available on `/capital`).
*   **UI:** The `ChangeLockModal` appears, allowing the user to select a new, potentially longer, lock period for their *next* claim. This increases their "Power Factor" (rewards multiplier).
*   **Contract Interaction:**
    *   Likely calls a function like `setClaimLockPeriod(poolId, lockEndTimestamp)` on the main pool contract (`erc1967ProxyContract`).
    *   This updates the user's `claimLockEnd` for future reward calculations.
    *   The modal uses `getClaimLockPeriodMultiplier` to show the expected multiplier increase before confirmation.
*   **Key Functions (Read):** `usersData`, `getClaimLockPeriodMultiplier`.

## Technical Details

### Smart Contracts

*   **Main Pool Contract:** An ERC1967 Proxy contract used for depositing/staking stETH/wstETH and managing rewards. Accessed via `web3ProvidersStore.erc1967ProxyContract`.
    *   **Ethereum Mainnet Address:** `0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790`
    *   **Sepolia Testnet Address:** `0x7c46d6bebf3dcd902eb431054e59908a02aba524`
    *   Handles deposits, withdrawals, reward calculations, claims, and lock period management on Ethereum L1.
    *   The implementation likely adheres to an interface defined by `Erc1967ProxyType` or `Mor1967ProxyType`.
*   **Deposit Token (stETH/wstETH):** Standard ERC20 contract for Lido Staked Ether (or Wrapped stETH) on Ethereum L1. Accessed via `web3ProvidersStore.depositContract`.
    *   **Ethereum Mainnet Address:** `0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84`
    *   **Sepolia Testnet Address:** `0xa878Ad6FF38d6fAE81FBb048384cE91979d448DA`
*   **Reward Token (MOR):** The Morpheus MOR token contract, an ERC20 token on Arbitrum L1. MOR rewards are claimed to this network. Accessed via `web3ProvidersStore.rewardsContract`.
    *   **Arbitrum Mainnet Address:** `0x092bAaDB7DEf4C3981454dD9c0A0D7FF07bCFc86`
    *   **Arbitrum Sepolia Testnet Address:** `0x34a285A1B1C166420Df5b6630132542923B5b27E`

### ABIs

The specific ABIs are defined as JSON files within the `app/abi` directory. The key ABI files used for the `/capital` page are:

*   **`ERC1967Proxy.json`:** Defines the interface for the main pool contract, including functions for deposits, withdrawals, claims, and reading pool/user data.
*   **`ERC20.json`:** The standard ERC20 token interface, used for both the deposit token (stETH/wstETH) and the reward token (MOR). It includes functions like `balanceOf`, `approve`, `transfer`, and `symbol`.

Key elements defined within these ABIs for the pool contract (`ERC1967Proxy.json`) include:

*   **Functions:**
    *   `deposit(uint256 poolId, uint256 amount, address referrer)` (or similar `stake` function) - *Action*
    *   `withdraw(uint256 poolId, uint256 amount)` - *Action*
    *   `claim(uint256 poolId)` (or `claimReward`) - *Action*
    *   `setClaimLockPeriod(uint256 poolId, uint256 lockEndTimestamp)` (or similar for managing locks/multiplier) - *Action*
    *   `pools(uint256 poolId)` (returns `PoolData` struct) - *Read*
    *   `poolsData(uint256 poolId)` (returns dynamic pool data struct) - *Read*
    *   `usersData(address user, uint256 poolId)` (returns `UserData` struct) - *Read*
    *   `getCurrentUserReward(uint256 poolId, address user)` (returns `uint256` reward amount) - *Read*
    *   `getCurrentUserMultiplier(uint256 poolId, address user)` (returns `uint256` multiplier value) - *Read*
    *   `getClaimLockPeriodMultiplier(uint256 poolId, uint256 lockStart, uint256 lockEnd)` (returns `uint256` multiplier value) - *Read*
    *   `poolsLimits(uint256 poolId)` (optional, returns specific lock periods) - *Read*
    *   `totalDepositedInPublicPools()` (returns `uint256` total) - *Read*
*   **Structs & Key Fields (Distinguishing Timestamps vs. Durations):**
    *   `PoolData` (from `pools` function):
        *   `payoutStart`: Absolute Unix Timestamp when pool rewards start.
        *   `minimalStake`: Minimum deposit amount (uint256).
        *   `initialReward`: Initial reward rate (uint256).
        *   `rewardDecrease`: Amount reward rate decreases per interval (uint256).
        *   `decreaseInterval`: Duration in seconds for reward decrease interval.
        *   `withdrawLockPeriod`: Global Duration in seconds for withdrawal lock after pool start.
        *   `claimLockPeriod`: Global Duration in seconds for claim lock after pool start.
        *   `withdrawLockPeriodAfterStake`: Duration in seconds for withdrawal lock after a user stakes.
        *   `claimLockPeriodAfterStake`: Duration in seconds for claim lock after a user stakes (from `poolsLimits`).
        *   `claimLockPeriodAfterClaim`: Duration in seconds for claim lock after a user claims (from `poolsLimits`).
    *   `UserData` (from `usersData` function):
        *   `deposited`: Amount user deposited (uint256).
        *   `lastStake`: Absolute Unix Timestamp of user's last stake/deposit.
        *   `lastClaim`: Absolute Unix Timestamp of user's last claim.
        *   `pendingRewards`: Rewards accrued but not yet claimable (uint256).
        *   `rate`: User specific reward rate factor (uint256).
        *   `claimLockEnd`: Absolute Unix Timestamp when the user's *current* claim lock ends.
        *   `claimLockStart`: Absolute Unix Timestamp when the user's *current* claim lock started.
        *   `referrer`: Address of the user's referrer.
*   **Events:** `Deposited`, `Withdrawn`, `Claimed`, `LockPeriodSet`, etc.

### Key Function Calls (from `use-pool.ts`)

*   `erc1967ProxyContract.pools(poolId)`
*   `erc1967ProxyContract.poolsData(poolId)`
*   `erc1967ProxyContract.poolsLimits(poolId)`
*   `erc1967ProxyContract.usersData(userAddress, poolId)`
*   `erc1967ProxyContract.getCurrentUserReward(poolId, userAddress)`
*   `erc1967ProxyContract.getCurrentUserMultiplier(poolId, userAddress)`
*   `erc1967ProxyContract.getClaimLockPeriodMultiplier(poolId, lockStart, lockEnd)`
*   `erc1967ProxyContract.totalDepositedInPublicPools()`

### Libraries Used

*   `ethers.js`: For interacting with Ethereum-compatible blockchains and smart contracts.
*   `@vueuse/core`: For composables like `useTimestamp`.
*   `@distributedlab/tools`: For time/duration utilities (`Time`, `duration`). 