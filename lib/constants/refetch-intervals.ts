/**
 * Standardized refetch intervals for React Query hooks
 *
 * These constants ensure consistent polling behavior across the application
 * and prevent "request storms" caused by misaligned intervals.
 *
 * Guidelines:
 * - FAST: Use for data that changes frequently (prices, balances during transactions)
 * - NORMAL: Use for most data that benefits from regular updates
 * - SLOW: Use for data that rarely changes (pool configs, contract addresses)
 * - VERY_SLOW: Use for data fetched from rate-limited APIs (Dune, CoinGecko)
 */

// Interval constants (in milliseconds)
export const REFETCH_INTERVALS = {
  /** 30 seconds - Use for actively monitored data (bridge status) */
  FAST: 30 * 1000,

  /** 1 minute - Use for frequently changing data (LayerZero fees) */
  MODERATE: 60 * 1000,

  /** 2 minutes - Use for user-specific data (deposits, rewards) */
  NORMAL: 2 * 60 * 1000,

  /** 5 minutes - Use for aggregated/computed data (pool totals, APR) */
  SLOW: 5 * 60 * 1000,

  /** 10 minutes - Use for slowly changing data (token prices, emissions) */
  VERY_SLOW: 10 * 60 * 1000,

  /** Disabled - Use for data that should only refresh on user action */
  DISABLED: false as const,
} as const;

// Stale time constants (in milliseconds)
export const STALE_TIMES = {
  /** 30 seconds - Data becomes stale quickly */
  SHORT: 30 * 1000,

  /** 1 minute - Default for most queries */
  NORMAL: 60 * 1000,

  /** 5 minutes - Data can be cached longer */
  LONG: 5 * 60 * 1000,
} as const;

// Type exports for TypeScript
export type RefetchInterval = typeof REFETCH_INTERVALS[keyof typeof REFETCH_INTERVALS];
export type StaleTime = typeof STALE_TIMES[keyof typeof STALE_TIMES];
