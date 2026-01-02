/**
 * React Query Mocks and Test Utilities
 * Utilities for testing components and hooks that use React Query.
 */

import { QueryClient } from '@tanstack/react-query';
import { vi } from 'vitest';

// ============================================================================
// QUERY CLIENT FACTORY
// ============================================================================

/**
 * Create a fresh QueryClient configured for testing.
 * Each test should use its own QueryClient to avoid state pollution.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Disable retries for faster test failures
        retry: false,
        // Disable caching for predictable tests
        gcTime: 0,
        staleTime: 0,
        // Disable refetching on window focus
        refetchOnWindowFocus: false,
        // Disable refetching on reconnect
        refetchOnReconnect: false,
        // Disable refetching on mount
        refetchOnMount: false,
      },
      mutations: {
        // Disable retries for mutations
        retry: false,
      },
    },
    // Disable logging in tests
    logger: {
      log: () => {},
      warn: () => {},
      error: () => {},
    },
  });
}

// ============================================================================
// MOCK QUERY RESULTS
// ============================================================================

export const createMockQueryResult = <T>(data: T, overrides = {}) => ({
  data,
  dataUpdatedAt: Date.now(),
  error: null,
  errorUpdatedAt: 0,
  failureCount: 0,
  failureReason: null,
  fetchStatus: 'idle' as const,
  isError: false,
  isFetched: true,
  isFetchedAfterMount: true,
  isFetching: false,
  isInitialLoading: false,
  isLoading: false,
  isLoadingError: false,
  isPaused: false,
  isPending: false,
  isPlaceholderData: false,
  isRefetchError: false,
  isRefetching: false,
  isStale: false,
  isSuccess: true,
  refetch: vi.fn().mockResolvedValue({ data }),
  status: 'success' as const,
  ...overrides,
});

export const createMockLoadingResult = <T>(overrides = {}) => ({
  data: undefined as T | undefined,
  dataUpdatedAt: 0,
  error: null,
  errorUpdatedAt: 0,
  failureCount: 0,
  failureReason: null,
  fetchStatus: 'fetching' as const,
  isError: false,
  isFetched: false,
  isFetchedAfterMount: false,
  isFetching: true,
  isInitialLoading: true,
  isLoading: true,
  isLoadingError: false,
  isPaused: false,
  isPending: true,
  isPlaceholderData: false,
  isRefetchError: false,
  isRefetching: false,
  isStale: false,
  isSuccess: false,
  refetch: vi.fn().mockResolvedValue({ data: undefined }),
  status: 'pending' as const,
  ...overrides,
});

export const createMockErrorResult = <T>(error: Error, overrides = {}) => ({
  data: undefined as T | undefined,
  dataUpdatedAt: 0,
  error,
  errorUpdatedAt: Date.now(),
  failureCount: 1,
  failureReason: error,
  fetchStatus: 'idle' as const,
  isError: true,
  isFetched: true,
  isFetchedAfterMount: true,
  isFetching: false,
  isInitialLoading: false,
  isLoading: false,
  isLoadingError: true,
  isPaused: false,
  isPending: false,
  isPlaceholderData: false,
  isRefetchError: false,
  isRefetching: false,
  isStale: false,
  isSuccess: false,
  refetch: vi.fn().mockResolvedValue({ error }),
  status: 'error' as const,
  ...overrides,
});

// ============================================================================
// MOCK MUTATION RESULTS
// ============================================================================

export const createMockMutationResult = <TData, TError = Error, TVariables = unknown>(
  overrides = {}
) => ({
  data: undefined as TData | undefined,
  error: null as TError | null,
  failureCount: 0,
  failureReason: null,
  isError: false,
  isIdle: true,
  isPaused: false,
  isPending: false,
  isSuccess: false,
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue(undefined as TData),
  reset: vi.fn(),
  status: 'idle' as const,
  submittedAt: 0,
  variables: undefined as TVariables | undefined,
  ...overrides,
});

export const createMockSuccessMutationResult = <TData>(data: TData, overrides = {}) => ({
  data,
  error: null,
  failureCount: 0,
  failureReason: null,
  isError: false,
  isIdle: false,
  isPaused: false,
  isPending: false,
  isSuccess: true,
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue(data),
  reset: vi.fn(),
  status: 'success' as const,
  submittedAt: Date.now(),
  variables: undefined,
  ...overrides,
});

// ============================================================================
// USEQUERY MOCK FACTORY
// ============================================================================

/**
 * Create a mock useQuery hook that returns specified data.
 * Useful for mocking specific query hooks in tests.
 */
export const createMockUseQuery = <T>(data: T) => {
  return vi.fn().mockReturnValue(createMockQueryResult(data));
};

/**
 * Create a mock useQuery hook that returns loading state.
 */
export const createMockLoadingUseQuery = <T>() => {
  return vi.fn().mockReturnValue(createMockLoadingResult<T>());
};

/**
 * Create a mock useQuery hook that returns error state.
 */
export const createMockErrorUseQuery = <T>(error: Error) => {
  return vi.fn().mockReturnValue(createMockErrorResult<T>(error));
};

// ============================================================================
// INFINITE QUERY MOCKS
// ============================================================================

export const createMockInfiniteQueryResult = <T>(
  pages: T[],
  pageParams: unknown[],
  overrides = {}
) => ({
  data: {
    pages,
    pageParams,
  },
  error: null,
  fetchNextPage: vi.fn(),
  fetchPreviousPage: vi.fn(),
  hasNextPage: true,
  hasPreviousPage: false,
  isFetchingNextPage: false,
  isFetchingPreviousPage: false,
  isLoading: false,
  isError: false,
  isSuccess: true,
  status: 'success' as const,
  refetch: vi.fn(),
  ...overrides,
});
