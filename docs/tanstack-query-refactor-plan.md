# TanStack Query Refactor Plan for Builders Data

**Version:** 1.1
**Date:** 2025-05-12
**Author:** Gemini AI Assistant
**Updated By:** Gemini AI Assistant

## 1. Introduction & Goals

This document outlines the plan to refactor the existing data fetching and state management logic for "Builders" and "Your Subnets" features from the current `React.Context` + `useEffect` approach to utilize TanStack Query (v5, formerly React Query).

**Goals:**
-   Resolve persistent race conditions causing incorrect state updates (e.g., `userAdminSubnets` being cleared).
-   Eliminate excessive API calls and `429 Too Many Requests` errors.
-   Simplify state management logic within `BuildersContext` and related components.
-   Improve caching, background updates, and overall robustness of data handling.
-   Provide a more declarative, type-safe, and maintainable approach to server state.

## 2. Current Problems Addressed

-   **Race conditions:** `useEffect` hooks in `BuildersPage` and `BuildersContext` react to auth state changes (`isAuthenticated`, `userAddress`) at slightly different times relative to data fetching and state setting, leading to incorrect "clear" logic overriding "set" logic.
-   **Complex synchronization:** Manual management of `useEffect` dependencies is error-prone.
-   **Lack of robust caching & Over-fetching:** Eager fetching without sophisticated caching leads to excessive API calls.
-   **Difficult derived state management:** Deriving `userAdminSubnets` in `useEffect` is complicated by asynchronous sources and fluctuating dependencies.

## 3. Proposed Architecture with TanStack Query

### 3.1. Core Data Fetching (`useQuery` for `allBuilders`)

-   **Query Key:** A stable, typed query key. Example: `['builders', { network: isTestnet ? 'testnet' : 'mainnet', chainId }] as const;`. Using `as const` helps with type safety if keys are constructed dynamically. Consider using the `queryOptions` helper for strongly-typed, co-located query configurations.
-   **Query Function (`queryFn`):**
    -   The existing `fetchBuildersData` logic will be adapted. It must be an async function returning `Promise<Builder[]>`.
    -   Ensure the `queryFn` is strongly typed. For instance, `const fetchBuilders: () => Promise<Builder[]> = async () => { ... }`.
    -   It should not rely on setting context state directly.
-   **Caching & Staleness:** Configure `staleTime` (e.g., 5 minutes) and `cacheTime` (e.g., 30 minutes) appropriately.
-   **`enabled` option:** Control query execution based on prerequisites (e.g., `isAuthenticated`, Supabase data loaded).
-   **Error Handling:** TanStack Query will manage error states. The `error` object in the query result can be typed (e.g., `AxiosError` or a custom error type). Consider registering a global error type via module augmentation if a specific error type is consistently expected.

### 3.2. `BuildersContext` Simplification

-   Will no longer manage raw data fetching state (`buildersProjects`, `isLoading` for fetching, etc.).
-   Will primarily consume query results from `useQuery(['builders', ...])`.
-   May still manage UI-specific state (filters, sorting), applied to data from `useQuery`.
-   Complex `useEffect` hooks for data fetching and synchronization will be removed.

### 3.3. Derived State for `userAdminSubnets`

-   Derived from cached `allBuilders` data using `React.useMemo` or the `select` option in `useQuery`.
    ```typescript
    // Example with useMemo
    const { data: allBuilders } = useQuery({ queryKey: ['builders', ...], queryFn: ... });
    const { userAddress, isAuthenticated } = useAuth();

    const userAdminSubnets = React.useMemo<Builder[] | null>(() => {
        if (!isAuthenticated || !userAddress || !allBuilders) return null;
        return allBuilders.filter((b: Builder) => b.admin?.toLowerCase() === userAddress.toLowerCase());
    }, [isAuthenticated, userAddress, allBuilders]);
    ```
-   The `select` option is powerful for transforming/filtering data directly within the query.

### 3.4. Filtering and Sorting

-   Applied client-side to the data array from `useQuery(['builders', ...])` using `React.useMemo`.

### 3.5. Auth State Integration

-   `enabled` option in `useQuery` tied to `isAuthenticated`.
-   Derived state updates automatically when `isAuthenticated` or `userAddress` changes due to `useMemo` dependencies or `select` re-evaluation.

### 3.6. TypeScript Best Practices

-   **Typed Query Functions:** Ensure `queryFn` has a clear return type (e.g., `Promise<Builder[]>`).
-   **`queryOptions` Helper:** For reusable and strongly-typed query configurations:
    ```typescript
    // services/builderService.ts (example)
    import { queryOptions } from '@tanstack/react-query';
    import { Builder } from '@/app/builders/builders-data';

    const fetchBuildersDataLogic = async (isTestnet: boolean, /* other args */): Promise<Builder[]> => {
      // ... existing fetch logic
      return []; // Placeholder
    };

    export const buildersQueryOptions = (isTestnet: boolean, /* other deps */) => queryOptions({
      queryKey: ['builders', { isTestnet }] as const,
      queryFn: () => fetchBuildersDataLogic(isTestnet, /* other args */),
      // staleTime, cacheTime, enabled etc.
    });

    // In component/context:
    // const { data } = useQuery(buildersQueryOptions(isTestnet));
    ```
-   **Error Typing:** Default error type is `Error`. If using specific error types (e.g., from Axios), use type narrowing or register a global error type.
-   **Query Key Factory:** Consider a factory for query keys to ensure consistency and type safety if keys become complex.

### 3.7. GraphQL (If Applicable)

-   While the current fetching seems to use Apollo Client against subgraphs, TanStack Query works well with direct GraphQL requests (e.g., using `graphql-request`).
-   Combining with [GraphQL Code Generator](https://graphql-code-generator.com/) provides end-to-end type safety for GraphQL operations.

## 4. Step-by-Step Implementation Plan

1.  **Install TanStack Query & Devtools:**
    ```bash
    npm install @tanstack/react-query @tanstack/react-query-devtools
    # or
    yarn add @tanstack/react-query @tanstack/react-query-devtools
    ```
    Install the ESLint plugin for best practices (optional but recommended):
    ```bash
    npm install -D @tanstack/eslint-plugin-query
    # or
    yarn add -D @tanstack/eslint-plugin-query
    ```
    (Update your ESLint config to include `plugin:@tanstack/eslint-plugin-query/recommended`)

2.  **Setup `QueryClientProvider` & Devtools:**
    -   In `pages/_app.tsx` (or your main layout component):
        ```typescript
        import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
        import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
        import React from 'react';

        const queryClient = new QueryClient({
          defaultOptions: {
            queries: {
              staleTime: 1000 * 60 * 5, // 5 minutes
              // Consider retry options, refetchOnWindowFocus, etc.
            },
          },
        });

        function MyApp({ Component, pageProps }) {
          return (
            <QueryClientProvider client={queryClient}>
              <Component {...pageProps} />
              <ReactQueryDevtools initialIsOpen={false} />
            </QueryClientProvider>
          );
        }
        export default MyApp;
        ```

3.  **Refactor `fetchBuildersData` Logic:**
    -   Create a standalone, typed asynchronous function (e.g., in a `services/buildersService.ts` or similar).
    -   This function will encapsulate the core data fetching and merging logic.
    -   Example signature: `export const fetchBuildersApi = async (isTestnet: boolean, supabaseBuilders: BuilderDB[] | null): Promise<Builder[]> => { ... }`.
    -   Remove context state setting from it.

4.  **Implement `useQuery` for `allBuilders` (e.g., in a custom hook `hooks/useBuildersData.ts` or directly in `BuildersContext` initially):**
    ```typescript
    // Example: hooks/useBuildersData.ts
    import { useQuery } from '@tanstack/react-query';
    import { fetchBuildersApi } from '@/services/buildersService'; // Assuming path
    import { useNetworkInfo } from '@/hooks/useNetworkInfo'; // Placeholder for actual hook
    import { useSupabaseData } from '@/hooks/useSupabaseData'; // Placeholder for Supabase data hook
    import { Builder } from '@/app/builders/builders-data';

    export const useAllBuildersQuery = () => {
      const { isTestnet } = useNetworkInfo(); // Example
      const { data: supabaseBuilders, isLoading: supabaseLoading } = useSupabaseData(); // Example

      return useQuery<Builder[], Error>({ // Explicitly type TData and TError
        queryKey: ['builders', { isTestnet, supabaseLoaded: !supabaseLoading && !!supabaseBuilders }],
        queryFn: () => fetchBuildersApi(isTestnet, supabaseBuilders),
        enabled: isTestnet ? true : (!supabaseLoading && !!supabaseBuilders), // Fetch mainnet only if Supabase data is ready
        // staleTime, cacheTime can be set here or in QueryClient defaultOptions
      });
    };
    ```

5.  **Update `BuildersContext`:**
    -   Remove old data fetching state and `useEffect` hooks.
    -   Call `useAllBuildersQuery()`.
    -   Provide `data`, `isLoading`, `error` from the query result.
    -   Keep UI state (filters, sort) and apply them to `data` using `useMemo`.

6.  **Refactor `userAdminSubnets` Logic in Consumers:**
    -   In `app/builders/page.tsx` or other components:
        ```typescript
        const { data: allBuilders, isLoading: isLoadingAllBuilders } = useBuilders(); // From context, now provides TanStack Query result
        const { userAddress, isAuthenticated } = useAuth();

        const userAdminSubnets = React.useMemo<Builder[] | null>(() => {
            if (!isAuthenticated || !userAddress || !allBuilders) return null;
            // Ensure allBuilders is not undefined before filtering
            return (allBuilders || []).filter((b: Builder) => b.admin?.toLowerCase() === userAddress.toLowerCase());
        }, [isAuthenticated, userAddress, allBuilders]);

        const isLoadingUserAdminSubnets = isLoadingAllBuilders; // Or combine with auth loading state
        ```

7.  **Refactor `BuildersPage.tsx`:** Adjust to use the new context structure and derived state.

8.  **Handle Supabase Integration with TanStack Query:**
    -   When Supabase real-time updates are received:
        ```typescript
        import { useQueryClient } from '@tanstack/react-query';

        // Inside your Supabase subscription setup
        const queryClient = useQueryClient();
        // ... on update from Supabase ...
        queryClient.invalidateQueries({ queryKey: ['builders'] }); // Invalidate to trigger refetch
        ```

9.  **Test Thoroughly:** Cover all cases mentioned in the previous plan.

## 5. Potential Challenges & Considerations

-   **Dependencies for `queryFn` and `queryKey`:** Ensure consistency and correctness. `queryOptions` helper can improve this.
-   **Supabase Real-time Updates:** Test invalidation strategy thoroughly.
-   **Global State vs. Local `useQuery`:** Decide where `useQuery` calls live (context, custom hooks, or components) based on reusability.
-   **SSR/SSG:** If applicable, review TanStack Query's Next.js integration guides for hydration.

## 6. Rollback Plan

-   Maintain on a separate feature branch.
-   Commit incrementally.
-   Rollback by reverting commits or merging from the main/previous stable branch.

This plan provides a roadmap for the refactor. Each step will require careful implementation and testing. 