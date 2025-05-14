# Morpheus Capital Page (/capital) Implementation Plan

This document outlines the steps to implement the `/capital` page functionality described in `docs/capital_page_description.md` within the Next.js application (`app/capital/page.tsx`), utilizing `shadcn/ui` components, Tailwind CSS, and `wagmi`/`viem` for blockchain interactions, following the project's established patterns.

## Phase 1: UI Component Scaffolding

Create the basic structure and visual components using `shadcn/ui` and Tailwind CSS based on the descriptions in `capital_page_description.md`.

1.  **Page Layout:**
    *   Establish the main page structure following the pattern in existing pages like `app/builders/page.tsx` and `app/compute/page.tsx`.
    *   Use a main `div` container with appropriate padding (`page-container`).
    *   Employ a CSS Grid (`page-grid`) for the top metric cards, similar to the existing `app/capital/page.tsx` and other pages.
    *   Structure subsequent sections using `div` wrappers (`page-section`, `section-content`, `section-body`) as seen in `app/builders/page.tsx` and `app/compute/page.tsx`.

2.  **Info Bar / Global Pool Stats:**
    *   Replicate the `MetricCard` component pattern from the current `page.tsx`.
    *   Create `MetricCard` instances for:
        *   Total Deposits (stETH/wstETH)
        *   Current Daily Reward (MOR) - *Value calculated in frontend based on contract parameters.*
        *   Pool Start Time
        *   Withdraw Lock Until - *Displays calculated absolute timestamp based on user and pool data.*
        *   Claim Lock Until - *Displays calculated absolute timestamp based on user and pool data.*
    *   Add placeholder values initially.
    *   Implement the "Deposit stETH/wstETH" button using `shadcn/ui` Button. Add an `onClick` handler placeholder.
    *   (Optional) Add a link/button for acquiring stETH.

3.  **Info Dashboard / User-Specific Stats & Actions:**
    *   Use `shadcn/ui Card` or custom divs styled like cards (`card-container`) for grouping user information.
    *   Create `MetricCard`-like displays (or integrate into the card) for:
        *   Your Deposit (stETH/wstETH)
        *   Available to Claim (MOR)
        *   Your Power Factor (Reward Multiplier) - Use Tooltip for info icon.
    *   Add placeholder values initially.
    *   Implement action buttons using `shadcn/ui` Button:
        *   "Withdraw stETH/wstETH"
        *   "Claim MOR"
        *   "Stake MOR Rewards" (Conditional rendering based on context - see Phase 2)
    *   Add `onClick` handler placeholders for buttons.
    *   Integrate placeholder sections for graphs/charts (e.g., using a simple `div` with text).
    *   Add a section for notes/informational text using standard text elements (`p`, `span`).

4.  **Modals (using `shadcn/ui Dialog`):**
    *   Create separate component files for each modal:
        *   `DepositModal.tsx`
        *   `WithdrawModal.tsx`
        *   `ClaimModal.tsx`
        *   `ChangeLockModal.tsx` (for Staking MOR Rewards / Setting Lock Period)
    *   Structure each modal with:
        *   `DialogTrigger` (linked to the corresponding button from steps 2 & 3).
        *   `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`.
        *   Input fields (`shadcn/ui Input`) where necessary (e.g., deposit amount, withdraw amount, lock period).
        *   Display areas for relevant data (e.g., amount to claim, current lock period, new multiplier).
        *   Action buttons within the modal (`Confirm`, `Cancel`). Add `onClick` placeholders.
    *   Implement basic form handling structure using `react-hook-form` (as per `components/knowledge.md`) if complex input/validation is needed, otherwise simple `useState` for amounts.

## Phase 2: Data Fetching & Contract Interaction Logic

Integrate blockchain data fetching and transaction logic using `wagmi`/`viem`, contract ABIs (`ERC1967Proxy.json`, `ERC20.json`), and project hooks/context.

1.  **Contract Setup:**
    *   Ensure `ERC1967Proxy.json` and `ERC20.json` (and potentially `MOR20.json`) ABIs are correctly placed (`app/abi/`).
    *   Utilize `config/networks.ts` and its `getContractAddress` helper to get network-specific contract addresses for:
        *   Main Pool Contract (ERC1967Proxy) - Ethereum L1 (Mainnet/Sepolia)
        *   Deposit Token (stETH/wstETH) - Ethereum L1
        *   Reward Token (MOR) - Arbitrum L1 (Mainnet/Sepolia)
    *   Ensure `wagmi` is configured for multi-chain support (Ethereum and Arbitrum).

2.  **Read Contract Data (Global & User):**
    *   Use `wagmi`'s `useReadContract` or `useReadContracts` hook to fetch data from the `ERC1967Proxy` contract (on L1, using `poolId=0`):
        *   **Global Pool Config (`pools` function):** `payoutStart`, `minimalStake`, `initialReward`, `rewardDecrease`, `decreaseInterval`, `withdrawLockPeriod`, `claimLockPeriod`, `withdrawLockPeriodAfterStake`.
        *   **Global Pool Limits (`poolsLimits` function):** `claimLockPeriodAfterStake`, `claimLockPeriodAfterClaim`.
        *   **Global Pool State:** `totalDepositedInPublicPools`.
        *   **User-Specific Data (`usersData` function, requires connected address):** `deposited`, `lastStake`, `lastClaim`, `claimLockEnd`.
        *   **User-Specific State (`getCurrentUserReward`, `getCurrentUserMultiplier` functions, require address):** Current claimable MOR amount, current power factor multiplier.
    *   Use `wagmi`'s `useBalance` hook:
        *   Fetch user's stETH/wstETH balance (on L1).
        *   Fetch user's MOR balance (on L2 - Arbitrum).
    *   Populate the placeholder UI elements from Phase 1 with fetched data. Format numbers and dates appropriately.
    *   Implement loading and error states for data fetching (e.g., using returned flags from `wagmi` hooks).

3.  **Frontend Calculations:**
    *   **Current Daily Reward:** Implement the frontend calculation based on fetched `initialReward`, `rewardDecrease`, `decreaseInterval`, and `payoutStart` from the `pools` function. Update the corresponding `MetricCard`.
    *   **Withdraw Lock Timestamp:** Calculate the absolute timestamp for when the user's withdrawal is unlocked. This involves comparing the global lock time (`payoutStart` + `withdrawLockPeriod`) with the user-specific lock time (`lastStake` + `withdrawLockPeriodAfterStake`) and taking the later date. Update the "Withdraw Lock Until" `MetricCard`.
    *   **Claim Lock Timestamp:** Calculate the absolute timestamp for when the user's rewards are claimable. This involves comparing multiple potential lock times: the user's explicit `claimLockEnd`, the global lock (`payoutStart` + `claimLockPeriod`), the post-claim lock (`lastClaim` + `claimLockPeriodAfterClaim`), and the post-stake lock (`lastStake` + `claimLockPeriodAfterStake`). Take the latest applicable timestamp. Update the "Claim Lock Until" `MetricCard`.
    *   **Modal Eligibility Checks:** Implement logic based on the calculated lock timestamps and other fetched data (e.g., available balance, deposited amount) to determine if Withdraw/Claim actions are currently allowed. Use this to enable/disable buttons within the respective modals.

4.  **Implement Deposit Logic (`DepositModal.tsx`):**
    *   Get user input amount.
    *   Validate against user's stETH/wstETH balance and `minimalStake`.
    *   **Approve:** Use `wagmi`'s `useWriteContract` to call the `approve` function on the stETH/wstETH contract (L1), approving the Main Pool Contract address to spend the input amount. Handle transaction states (loading, success, error).
    *   **Deposit:** Once approved (or if allowance sufficient), use `useWriteContract` to call the `stake` function on the Main Pool Contract (L1), passing the pool ID (0), amount, and potentially a referrer address. Handle transaction states.
    *   Refetch relevant user/pool data upon successful deposit using `wagmi`'s cache invalidation or manual refetching (e.g., calling `refetch` functions from `useReadContract` hooks).

5.  **Implement Claim Logic (`ClaimModal.tsx`):**
    *   Display the claimable amount fetched in Step 2.
    *   Use the calculated Claim Lock Timestamp (from Step 3) to determine eligibility. Disable the claim button if ineligible.
    *   Use `useWriteContract` to call the `claim` function on the Main Pool Contract (L1), passing pool ID (0) and the user's address as the receiver. Handle transaction states.
    *   Refetch relevant user data upon successful claim.

6.  **Implement Withdraw Logic (`WithdrawModal.tsx`):**
    *   Get user input amount.
    *   Use the calculated Withdraw Lock Timestamp (from Step 3) to determine eligibility. Disable the withdraw button if ineligible.
    *   Validate input amount against the user's deposited amount (`usersData`).
    *   Use `useWriteContract` to call the `withdraw` function on the Main Pool Contract (L1), passing pool ID (0) and the amount. Handle transaction states.
    *   Refetch relevant user data upon successful withdrawal.

7.  **Implement Change Lock Period Logic (`ChangeLockModal.tsx`):**
    *   Allow user to select/input a new lock duration (value + unit).
    *   Use `useReadContract` to call `getClaimLockPeriodMultiplier` (L1) to display the potential multiplier increase based on the user's selection (converting duration to appropriate start/end timestamps for the call).
    *   Convert the selected duration into an absolute end timestamp required by the contract.
    *   Use `useWriteContract` to call `lockClaim` (or similar function identified) on the Main Pool Contract (L1), passing pool ID (0) and the calculated `claimLockEnd` timestamp. Handle transaction states.
    *   Refetch user data (`usersData`, multiplier) upon success.
    *   Conditionally render the "Stake MOR Rewards" button on the main page (e.g., always enabled if connected?).

8.  **State Management (Implemented via Context):**
    *   **React Context (`CapitalPageContext`):** Centralizes core logic, state, and actions related to the capital page.
        *   Manages all `wagmi` hook calls (`useReadContract`, `useBalance`, `useWriteContract`, etc.) and associated data/loading states.
        *   Holds calculated state (e.g., eligibility flags `canClaim`, `canWithdraw`, formatted display values).
        *   Manages modal visibility state (`activeModal`) and provides the `setActiveModal` function.
        *   Provides stable action functions (`deposit`, `claim`, `withdraw`, `changeLock`, `approveStEth`) that encapsulate transaction logic and feedback.
    *   **`wagmi` Cache:** Leveraged implicitly by the `useReadContract` and `useBalance` hooks within the context for caching fetched on-chain data.
    *   **Local `useState` (in Modals):** Used within individual modal components (`DepositModal`, `WithdrawModal`, `ChangeLockModal`) for managing local form state (input values like `amount`, `lockValue`, `lockUnit`) and local form validation errors (`formError`).

## Phase 3: Styling & Refinements

Apply final styling touches and ensure consistency with the rest of the application.

1.  **Tailwind CSS:**
    *   Refine spacing, typography, and colors using Tailwind utility classes to match the application's design system.
    *   Ensure responsiveness across different screen sizes.
    *   Utilize the `cn` utility for conditional class application (e.g., disabled states, hover effects).
    *   Apply specific styles mentioned (e.g., `card-gradient` hover effects) consistently.

2.  **Component Refinement:**
    *   Ensure all `shadcn/ui` components are styled consistently.
    *   Add tooltips (`shadcn/ui Tooltip`) to info icons (`lucide-react Info`) explaining specific metrics or terms.
    *   Refine loading indicators (e.g., skeleton loaders for data, spinners for transaction processing).
    *   Improve error message display (e.g., using `shadcn/ui Alert` or inline messages).

3.  **Accessibility:**
    *   Review and ensure proper ARIA attributes are used, especially for interactive elements, modals, and form inputs.
    *   Check color contrast ratios.

4.  **Cross-Browser/Device Testing:**
    *   Test the page functionality and appearance on major browsers and different device sizes.

## Phase 4: Testing

1.  **Component Tests:** Write unit/integration tests for individual components and hooks where appropriate.
2.  **End-to-End Tests:** Simulate user flows (deposit, claim, withdraw) using a testnet environment.
3.  **Manual Testing:** Thoroughly test all functionalities on supported testnets (e.g., Arbitrum Sepolia, Ethereum Sepolia). 