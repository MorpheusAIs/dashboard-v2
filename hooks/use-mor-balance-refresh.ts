import { useCallback } from 'react'

declare global {
  interface Window {
    refreshMORBalances?: () => Promise<void>
  }
}

/**
 * Hook to provide balance refresh functionality for other components
 * Call this after successful transactions to update MOR balances
 */
export function useMORBalanceRefresh() {
  const refreshBalances = useCallback(async () => {
    if (typeof window !== 'undefined' && window.refreshMORBalances) {
      console.log('Triggering MOR balance refresh from external component')
      await window.refreshMORBalances()
    } else {
      console.warn('MOR balance refresh function not available')
    }
  }, [])

  return { refreshBalances }
}

/**
 * Utility function to refresh MOR balances from any component
 * Can be called directly without hooks
 */
export const triggerMORBalanceRefresh = async () => {
  if (typeof window !== 'undefined' && window.refreshMORBalances) {
    console.log('Triggering MOR balance refresh from utility function')
    await window.refreshMORBalances()
  } else {
    console.warn('MOR balance refresh function not available')
  }
} 