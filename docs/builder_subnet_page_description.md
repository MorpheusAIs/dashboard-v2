# Morpheus Individual Builder Subnet Page Documentation

This document describes the structure, functionality, and technical details of the individual builder subnet page in the Morpheus Dashboard. This page allows users to view detailed information about a specific builder subnet, stake MOR tokens into it, manage their stake, and for subnet admins, to manage the subnet.

## Overview

The individual builder subnet page serves as the primary interface for users to interact with a specific builder subnet. Users can view its parameters, staking statistics, and the list of stakers. If they have MOR tokens, they can stake into the subnet. Admins of the subnet have additional capabilities like editing subnet details and potentially claiming fees or rewards.

The main component responsible for this view is `src/pages/Builders/pages/BuildersItem/index.vue`. It utilizes data fetched via GraphQL and interacts with smart contracts for staking, withdrawing, and admin functions.

## Page Structure

The page is generally structured as follows:

1.  **Navigation and Header:**
    *   **Back Button:** Allows users to navigate to the previous page (likely the builders list).
    *   **Subnet Title Area:**
        *   Displays an optional image for the subnet (from `predefinedBuildersMeta.json`).
        *   Displays the **Subnet Name**.
        *   **Edit Button:** Visible to the subnet admin if the subnet has not yet started or is within the `editPoolDeadline`. Opens the `BuilderFormModal` for modifications.
    *   **Subnet Metadata:**
        *   **Description:** A textual description of the subnet.
        *   **Admin Address:** Displays the admin's Ethereum address (abbreviated) with a copy button.
        *   **Website Link:** An external link to the builder's website, if provided (from `predefinedBuildersMeta.json`).

2.  **Global Subnet Information Cards:** A row of cards displaying key parameters of the subnet:
    *   **Start Time:** The timestamp when staking and other activities in the subnet begin.
    *   **Minimal Deposit:** The minimum amount of MOR tokens required for a single stake transaction.
    *   **Withdraw Lock Period:** The duration a user's deposit is locked after *each* stake they make.

3.  **User-Specific Information & Actions / Subnet Totals (Left Column):**
    *   **Your Builder Label:** A visual indicator shown if the connected user has an active stake in this subnet.
    *   **Available for Withdrawal Card:**
        *   Displays the user's currently staked MOR amount in this subnet.
        *   **Withdraw Button:** Enabled if the user has a stake and their last stake's lock period has expired. Opens the `BuilderWithdrawModal`.
        *   **Unlock Time:** If the user's stake is currently locked, this shows the timestamp when it will become available for withdrawal.
    *   **Total Claimed Card:** Displays the total amount of MOR claimed by all users from this subnet.
    *   **Total Staked Card:** Displays the total amount of MOR currently staked in this subnet by all users.
    *   **Claim Lock Ends / Admin Claim Card:**
        *   Displays the `claimLockEnd` timestamp for the subnet (relevant for admin claims or reward distribution cycles).
        *   **Admin Claim Button:** Visible to the subnet admin. Allows the admin to execute a claim transaction. The exact nature of this claim (e.g., fees, undistributed rewards) is determined by the smart contract logic.
        *   Displays the Admin Address again with a copy button.

4.  **Stakers List & Stake Action (Right Column):**
    *   **Stakers Header:**
        *   "Stakers" title.
        *   **Total Stakers Count:** Shows the number of unique addresses currently staking in the subnet.
    *   **Stake Button:** Allows any user to stake MOR into this subnet. Opens the `BuildersStakeModal`. Disabled if the subnet hasn't started, the user has no MOR balance, or an admin claim is in progress.
    *   **Stakers Table:**
        *   Lists addresses that have staked in the subnet.
        *   **Columns:** Staker Address (abbreviated, copyable), Staked Amount (MOR), Date (timestamp of their last stake).
        *   Includes pagination if the number of stakers exceeds the page limit.
    *   **No Data Message:** Displayed if there are no stakers in the subnet.

## Core Functionality

### 1. Viewing Subnet Details
Users can view comprehensive details about a builder subnet, including:
*   Name, description, image, and website.
*   Administrative address.
*   Operational parameters: start time, minimum deposit, withdrawal lock periods.
*   Aggregated statistics: total MOR staked, total MOR claimed by users, total number of stakers.
*   A list of all current stakers with their staked amounts and last stake times.

### 2. Staking MOR into a Subnet
*   **Trigger:** User clicks the "Stake" button.
*   **UI:** The `BuildersStakeModal` appears, prompting the user for the amount of MOR to stake.
*   **Pre-conditions:**
    *   The subnet must have reached its `startsAt` time.
    *   The user must have a sufficient MOR balance.
    *   No admin claim operation (`isClaimSubmitting`) should be in progress.
*   **Contract Interaction:**
    *   Likely calls a `stake(uint256 amount)` function on the specific subnet's smart contract instance.
    *   The user must approve the subnet contract to spend their MOR tokens if it's the first time or the allowance is insufficient.
    *   The transaction transfers MOR from the user to the subnet contract.
    *   The user's `lastStake` timestamp and `staked` amount for this subnet are updated.
*   **Event Handling:** After successful staking (`@staked` event from modal), the page data is refreshed.

### 3. Withdrawing MOR from a Subnet
*   **Trigger:** User clicks the "Withdraw" button on the "Available for Withdrawal" card.
*   **UI:** The `BuilderWithdrawModal` appears, allowing the user to withdraw up to their available staked amount.
*   **Eligibility:**
    *   User must have an active stake (`buildersData.buildersProjectUserAccount?.staked > 0`).
    *   The withdrawal lock period for their *last stake* must have passed. The unlock time is calculated as `user.lastStake + subnet.withdrawLockPeriodAfterDeposit`.
*   **Contract Interaction:**
    *   Likely calls a `withdraw(uint256 amount)` function on the specific subnet's smart contract instance.
    *   The transaction transfers MOR from the subnet contract back to the user.
*   **Event Handling:** After successful withdrawal (`@submitted` event from modal), the page data is refreshed.

### 4. Admin: Claiming from Subnet
*   **Trigger:** Subnet admin clicks the "Claim" button on the "Claim Lock Ends / Admin Claim" card.
*   **Eligibility:**
    *   Connected user must be the admin of the subnet.
    *   Conditions related to `claimLockEnd` timestamp (e.g., it might need to be in the past, or this action triggers a new cycle based on it).
*   **Contract Interaction:**
    *   Calls a `claim()` function, potentially on the `BuilderSubnets` contract or the individual subnet contract. The exact parameters and behavior depend on the contract implementation (e.g., claiming accrued fees, distributing rewards).
    *   The `isClaimSubmitting` flag is used to manage the UI state during this operation.
*   **Event Handling:** After the claim, the page data is refreshed.

### 5. Admin: Editing Subnet Details
*   **Trigger:** Subnet admin clicks the "Edit" button in the page header.
*   **UI:** The `BuilderFormModal` appears, pre-filled with the current subnet's details, allowing the admin to modify them.
*   **Eligibility:**
    *   Connected user must be the admin of the subnet.
    *   The subnet's `startsAt` time must be in the future OR the current time must be before the `editPoolDeadline` from the `startsAt` time.
    *   No admin claim operation (`isClaimSubmitting`) should be in progress.
*   **Contract Interaction:**
    *   Calls a function (e.g., `editSubnet` or similar, with new `SubnetStruct` and `SubnetMetadataStruct`) on the `BuilderSubnets` contract.
*   **Event Handling:** After successful update (`@submitted` event from modal), the page data is refreshed.

## Technical Details

### Smart Contracts

Two main types of contracts are involved:

1.  **`BuilderSubnets` Contract (Factory & Registry):**
    *   Manages the creation and high-level administration of all builder subnets.
    *   Functions like `createSubnet`, `editSubnet` (likely), `getSubnetId`, `editPoolDeadline`, `subnetCreationFeeAmount` are part of this contract.
    *   **Arbitrum One (Mainnet) Address:** `0xC0eD68f163d44B6e9985F0041fDf6f67c6BCFF3f`
    *   **Arbitrum Sepolia (Testnet) Address:** `0x5271B2FE76303ca7DDCB8Fb6fA77906E2B4f03C7`
    *   **Base (Mainnet) Address:** `0x42BB446eAE6dca7723a9eBdb81EA88aFe77eF4B9`
    *   Accessed via `useWeb3ProvidersStore().buildersContract`.

2.  **Individual Subnet Contract (Instance per Subnet):**
    *   Each builder subnet deployed would be its own contract instance, likely cloned from a base implementation or deployed via proxy.
    *   Handles the specific logic for that subnet: staking (`stake`), withdrawals (`withdraw`), reward tracking, and potentially its own claim mechanism for users/delegators (though user claims are not directly visible on this specific admin-focused page, a commented-out claim button in the stakers list hints at this).
    *   The `DelegatorInfoCards.vue` and `compute_subnet_staking_process.md` reference a `Subnet__factory` and direct `stake` and `claim` calls on a subnet contract instance, confirming this pattern.
    *   The address for each individual subnet contract is part of its data fetched via GraphQL (`buildersProject.id` is likely the contract address or an identifier linked to it).

### Network Contract Addresses

#### Arbitrum One (Mainnet)
* **BuilderSubnets Contract:** `0xC0eD68f163d44B6e9985F0041fDf6f67c6BCFF3f`
* **MOR Token:** `0x092bAaDB7DEf4C3981454dD9c0A0D7FF07bCFc86`
* **Subnet Implementation/Template:** Deployed per subnet via the BuilderSubnets factory

#### Base (Mainnet)
* **BuilderSubnets Contract:** `0x42BB446eAE6dca7723a9eBdb81EA88aFe77eF4B9`
* **MOR Token:** `0x63e42Fc959a6bd75A48462F1a7868DcB575A4677`
* **Subnet Implementation/Template:** Deployed per subnet via the BuilderSubnets factory

#### Arbitrum Sepolia (Testnet)
* **BuilderSubnets Contract:** `0x5271B2FE76303ca7DDCB8Fb6fA77906E2B4f03C7`
* **MOR Token:** `0x34a285A1B1C166420Df5b6630132542923B5b27E`
* **Subnet Implementation/Template:** Deployed per subnet via the BuilderSubnets factory

### ABIs

*   **`BuilderSubnets.json`:** Defines the interface for the main `BuilderSubnets` factory/registry contract.
    *   Key functions: `createSubnet(SubnetStruct, SubnetMetadataStruct)`, `editSubnet(...)`, `editPoolDeadline()`, `subnetCreationFeeAmount()`, `getSubnetId(string name)`.
    *   `SubnetStruct`: Contains `name`, `owner`, `minStake`, `fee`, `feeTreasury`, `startsAt`, `withdrawLockPeriodAfterStake`, `maxClaimLockEnd`.
    *   `SubnetMetadataStruct`: Contains `slug`, `description`, `website`, `image`.
*   **`Subnet.json` (or similar):** Defines the interface for the individual subnet contract instances.
    *   Key functions: `stake(uint256 amount)`, `withdraw(uint256 amount)`, `claim(...)`, `getCurrentStakerRewards(address user)`.
*   **`ERC20.json`:** Standard ERC20 token interface for MOR (the staking token) and potentially reward tokens. Used for `balanceOf`, `approve`.

### GraphQL Queries & Subgraph

The page heavily relies on a subgraph for querying subnet data. Key queries are defined in `src/graphql/BuildersQueries.graphql`.

*   **`GetBuildersProject`:** Fetches details for a single subnet by its ID.
    *   Input: `id` (subnet ID/address).
    *   Returns: `BuildersProject` object (includes `admin`, `claimLockEnd`, `id`, `minimalDeposit`, `name`, `startsAt`, `totalClaimed`, `totalStaked`, `totalUsers`, `withdrawLockPeriodAfterDeposit`).
*   **`GetUserAccountBuildersProject`:** Fetches the connected user's data for a specific subnet.
    *   Input: `address` (user address), `project_id` (subnet ID).
    *   Returns: `BuildersUser` object (includes `address`, `id`, `lastStake`, `staked`, and nested `buildersProject` details).
*   **`GetBuildersProjectUsers`:** Fetches a paginated list of stakers for a subnet.
    *   Input: `buildersProjectId`, `first` (page size), `skip`.
    *   Returns: List of `BuildersUser` objects (each with `address`, `id`, `staked`, `lastStake`).

**Subgraph Endpoint:** The application uses `useSecondApolloClient()` which configures clients for different chains, implying subgraph deployments per supported chain (e.g., Arbitrum One, Arbitrum Sepolia). The exact endpoint URLs are configured in the Apollo client setup.

### Key Function Calls (from `src/pages/Builders/pages/BuildersItem/index.vue`)

*   Data Loading: `useLoad` composable wrapping Apollo Client queries (`currentClient.value.query(...)` with `GetBuildersProject` and `GetUserAccountBuildersProject`).
*   Staker List: `currentClient.value.query(...)` with `GetBuildersProjectUsers`, refetched on `stakersCurrentPage` change.
*   Admin Edit Deadline: `buildersContract.value.providerBased.value.editPoolDeadline()`.
*   Admin Claim: `claim()` function within the component, likely interacting with `buildersContract.value.signerBased.value.claim(...)` or a specific subnet contract method.
*   User Stake/Withdraw/Admin Edit: Primarily handled through modals (`BuildersStakeModal`, `BuilderWithdrawModal`, `BuilderFormModal`) which encapsulate their respective contract interaction logic.

### Libraries Used

*   `ethers.js`: For blockchain interactions.
*   `@vueuse/core`: For utility composables.
*   `@distributedlab/tools`: For `time` and other utilities.
*   `@apollo/client`: For GraphQL communication.
*   Vue 3 & Pinia: For frontend framework and state management.

### Testnet Setup

*   The system is designed for multi-chain support, including testnets like **Arbitrum Sepolia**.
*   The `BuilderSubnets` contract has a deployed address on Arbitrum Sepolia: `0x5271B2FE76303ca7DDCB8Fb6fA77906E2B4f03C7`.
*   GraphQL queries and contract interactions will target the appropriate endpoints and contract addresses based on the connected network (`route.query.chain` and `currentClient`).
*   Functionality (staking test MOR, withdrawing, admin actions) on Arbitrum Sepolia mirrors Mainnet, using testnet versions of tokens and contracts.
*   The shared ABIs ensure functional consistency between Mainnet and Testnet operations. 