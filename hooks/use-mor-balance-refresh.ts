import { useCallback, useEffect, useRef, useState } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { useReadContract } from 'wagmi'
import { morTokenContracts } from '@/lib/contracts'
import { formatUnits } from 'viem'

declare global {
  interface Window {
    refreshMORBalances?: () => Promise<void>
  }
}

const MOR_ABI = [{
  "inputs": [{"internalType": "address","name": "account","type": "address"}],
  "name": "balanceOf",
  "outputs": [{"internalType": "uint256","name": "","type": "uint256"}],
  "stateMutability": "view",
  "type": "function"
}] as const

/**
 * Hook to provide balance refresh functionality for other components
 * Call this after successful transactions to update MOR balances
 */
export function useMORBalanceRefresh() {
  const refreshBalances = useCallback(async () => {
    if (typeof window !== 'undefined' && window.refreshMORBalances) {
      await window.refreshMORBalances()
    } else {
      console.warn('MOR balance refresh function not available')
    }
  }, [])

  return { refreshBalances }
}

/**
 * Hook to monitor MOR balance changes after a claim transaction
 * @param isClaiming - Whether a claim is currently in progress
 * @param onBalanceIncrease - Callback when balance increases (tokens received)
 * @param onTimeout - Callback when monitoring times out without balance change
 */
export function useMORBalanceMonitor(
  isClaiming: boolean,
  onBalanceIncrease?: (newBalance: number, increase: number) => void,
  onTimeout?: () => void
) {
  const { address } = useAccount()
  const chainId = useChainId()
  const [initialBalance, setInitialBalance] = useState<number | null>(null)
  const [currentBalance, setCurrentBalance] = useState<number | null>(null)
  const monitoringRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const isTestnet = chainId === 421614 || chainId === 11155111
  const targetChainId = isTestnet ? 421614 : 42161 // Arbitrum Sepolia for testnet, Arbitrum One for mainnet
  const morContractAddress = morTokenContracts[targetChainId]

  // Get current MOR balance
  const { data: morBalance, refetch: refetchMORBalance } = useReadContract({
    address: morContractAddress as `0x${string}`,
    abi: MOR_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: targetChainId,
    account: address
  })

  // Format balance to number for comparison
  const formatBalance = useCallback((balance: bigint | undefined): number => {
    if (!balance) return 0
    return parseFloat(formatUnits(balance, 18))
  }, [])

  // Start monitoring when claiming begins
  useEffect(() => {
    if (isClaiming && address && morBalance !== undefined) {
      const currentBalanceNum = formatBalance(morBalance)
      setInitialBalance(currentBalanceNum)
      setCurrentBalance(currentBalanceNum)
      startTimeRef.current = Date.now()

      // Clear any existing monitoring
      if (monitoringRef.current) {
        clearInterval(monitoringRef.current)
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Monitor balance every 5 seconds (more frequent than the default 30s)
      monitoringRef.current = setInterval(async () => {
        try {
          await refetchMORBalance()
        } catch (error) {
          console.warn('Error refreshing MOR balance during monitoring:', error)
        }
      }, 5000) // 5 second intervals

      // Set timeout after 5 minutes (300,000ms)
      timeoutRef.current = setTimeout(() => {
        stopMonitoring()
        onTimeout?.()
      }, 300000)
    } else if (!isClaiming) {
      stopMonitoring()
    }
  }, [isClaiming, address, morBalance, refetchMORBalance, formatBalance, targetChainId, morContractAddress, onTimeout])

  // Check for balance changes
  useEffect(() => {
    if (isClaiming && initialBalance !== null && morBalance !== undefined) {
      const newBalanceNum = formatBalance(morBalance)
      const increase = newBalanceNum - initialBalance

      if (increase > 0.0001) { // Small threshold to avoid floating point precision issues
        setCurrentBalance(newBalanceNum)
        onBalanceIncrease?.(newBalanceNum, increase)
        stopMonitoring()
      }
    }
  }, [morBalance, initialBalance, isClaiming, formatBalance, onBalanceIncrease])

  const stopMonitoring = useCallback(() => {
    if (monitoringRef.current) {
      clearInterval(monitoringRef.current)
      monitoringRef.current = null
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    startTimeRef.current = null
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMonitoring()
    }
  }, [stopMonitoring])

  return {
    initialBalance,
    currentBalance,
    isMonitoring: !!monitoringRef.current,
    stopMonitoring
  }
}

/**
 * Utility function to refresh MOR balances from any component
 * Can be called directly without hooks
 */
export const triggerMORBalanceRefresh = async () => {
  if (typeof window !== 'undefined' && window.refreshMORBalances) {
    await window.refreshMORBalances()
  } else {
    console.warn('MOR balance refresh function not available')
  }
} 