# Project Restoration Plan: Builders Module

**Date:** 2024-07-27

**Objective:** Restore lost functionality related to TanStack Query integration, URL-based `projectId` handling for builder detail pages, and related features in the Builders module. This plan addresses issues arising from conflicting merges and reverts.

## 1. Summary of Issues and Lost Functionality

Following a series of complex Git operations (PRs, merges, reverts), several key functionalities and code structures were lost or broken. The primary areas affected are:

*   **TanStack Query Integration:** The refactor to use TanStack Query for data fetching and state management was largely undone. This includes missing custom hooks, provider setup, and context modifications.
*   **`projectId` Handling for Builder Detail Pages:** The mechanism to pass and use a specific `projectId` (especially `mainnetProjectId`) via URL parameters for fetching staker data on mainnet builder pages was lost. Pages reverted to using only the `slug`.
*   **Missing Core Files:**
    *   Custom Hooks: `useAllBuildersQuery.ts`, `useNetworkInfo.ts`, `useSupabaseBuilders.ts`.
    *   Providers: `app/providers.tsx` and its integration into `app/layout.tsx`.
*   **Feature Integrity:**
    *   The "Your Subnets" and "Participating" tabs on the main builders page may not function correctly due to the underlying data context issues.
    *   Network redirection logic on individual builder pages (when switching between mainnet/testnet) was lost.
*   **Data Consistency:** Incorrect or missing `mainnetProjectId` in types, data transformations, and GraphQL queries.

## 2. Analysis of Provided Diff Files

*   **`pr-1_diff.diff` (TanStack Query Refactor & New Tabs):** This diff contains the initial, correct implementation of TanStack Query, the new hooks, provider setup, context refactoring, and the logic for the "Your Subnets" and "Participating" tabs. It also included updates to data structures for `mainnetProjectId` and `builderUsers`.
*   **`pr-2_diff.diff` (URL Params for Builder Page & `projectId` Fix):** This diff correctly implemented the passing of `name` and `projectId` as URL parameters to the builder detail page (`app/builders/[slug]/page.tsx`) and its consumption for fetching staking data. It updated GraphQL queries and services to handle `mainnetProjectId`.
*   **`pr-3_diff.diff` (Revert/Problematic State):** This diff largely represents the current problematic state, showing the *absence* of the features and fixes introduced in PR1 and PR2. It reflects a revert to an older, `useEffect`-based data fetching mechanism and removal of the URL parameter logic.

## 3. Planned Course of Action

The restoration will proceed in phases, focusing on rebuilding the foundational elements first, then integrating page-specific logic.

### Phase 1: Foundational Restore (TanStack Query & Core Hooks)

1.  **Branch:** All work will be done on a new branch: `fix/restore-lost-functionality` (created from `dev`).
2.  **Restore Hook Files:**
    *   Re-create `app/hooks/useAllBuildersQuery.ts` from `pr-1_diff.diff`.
    *   Re-create `app/hooks/useNetworkInfo.ts` from `pr-1_diff.diff`.
    *   Re-create `app/hooks/useSupabaseBuilders.ts` from `pr-1_diff.diff`.
3.  **Restore Providers:**
    *   Re-create `app/providers.tsx` from `pr-1_diff.diff` to set up `QueryClientProvider`.
    *   Modify `app/layout.tsx` to use the `<Providers>` component as per `pr-1_diff.diff`.
4.  **Refactor `context/builders-context.tsx`:**
    *   Apply changes from `pr-1_diff.diff` to fully reintegrate TanStack Query using `useAllBuildersQuery`.
    *   Remove old `useEffect`-based fetching.
    *   Ensure state variables (`isLoading`, `error`, `data`) are sourced from TanStack Query.
    *   Implement logic for `userAdminSubnets` and `userBuilders` (for "Participating" tab) based on data from `useAllBuildersQuery` and authentication state.
    *   Update `refreshData` to use `queryClient.invalidateQueries({ queryKey: ['builders'] });`.
5.  **Update Data Structures & Services:**
    *   **`app/builders/builders-data.ts`:** Ensure `Builder` interface includes `mainnetProjectId: string | null;` and `builderUsers?: BuilderUser[];`. Verify `mergeBuilderData`.
    *   **`app/graphql/queries/builders.ts`:** Add `mainnetProjectId` back to the `GET_ALL_BUILDERS_PROJECTS` query (ref: `pr-2_diff.diff`).
    *   **`app/services/buildersService.ts`:** Update `fetchBuildersAPI` to align with `pr-1_diff.diff` and `pr-2_diff.diff` for correct data fetching (testnet vs. mainnet), `mainnetProjectId` handling, and `builderUsers` population.

### Phase 2: Page-Level Integration & Feature Restoration

6.  **Refactor `app/builders/page.tsx` (Main Builders List Page):**
    *   Adapt to use the refactored `BuildersContext`.
    *   Restore "Your Subnets" and "Participating" tabs functionality using data from the context.
    *   **URL Construction for Navigation:** Modify `onRowClick` for the builders table to navigate to `/builders/[slug]?name=\${encodeURIComponent(builder.name)}&projectId=\${builder.mainnetProjectId || ''}` using `next/navigation#useRouter`. (Ref: `pr-2_diff.diff`).
7.  **Refactor `app/builders/[slug]/page.tsx` (Individual Builder Detail Page):**
    *   **URL Parameter Consumption:**
        *   Use `useSearchParams` from `next/navigation` to get `builderName` and `projectId`.
        *   Retrieve the full `builder` object from the `useBuilders()` context by matching `builderName`.
    *   **Staking Data (`useStakingData`):**
        *   Restore `hookProjectId` memoized value: `builder.id` for testnet, or `projectId` (from URL) for mainnet.
        *   Pass `hookProjectId` as the `projectId` prop to `useStakingData`.
    *   **Contract Interactions (`subnetId`):** Ensure `subnetId` used in `useStakingContractInteractions` is correctly set to `hookProjectId`.
    *   **Network Redirect Logic:** Re-implement the `useEffect` hook for redirecting to `/builders` upon mainnet/testnet switching (Ref: `pr-2_diff.diff`, version `9ceacbc`).

### Phase 3: Verification and Cleanup

8.  **Thorough Testing:** Test all aspects: data fetching (mainnet/testnet), tab functionality, navigation, individual page data (stakers table), network redirection, and absence of excessive API calls (using TanStack Query Devtools).
9.  **Code Review & Cleanup:** Ensure code consistency, type safety, and remove any dead code.

This plan aims to systematically restore the intended functionality by combining the correct pieces from the provided diffs.