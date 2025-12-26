'use client'

import { formatUnits } from 'viem'
import { useAccount, useChainId } from 'wagmi'
import { ArbitrumIcon, BaseIcon } from './network-icons'
import dynamic from 'next/dynamic'
import { useMORBalances } from '@/hooks/use-mor-balances'

// Dynamically import NumberFlow with SSR disabled to prevent hydration errors
const NumberFlow = dynamic(() => import('@number-flow/react'), {
  ssr: false,
  loading: () => <span>—</span>
})
import { useEffect, useCallback, useRef } from 'react'

declare global {
  interface Window {
    refreshMORBalances?: () => Promise<void>
  }
}

export function MORBalance() {
  const { address } = useAccount()
  const chainId = useChainId()
  
  // console.log('MORBalance - Connected chainId:', chainId)
  // console.log('MORBalance - User address:', address)
  // console.log('MORBalance - MOR contract addresses:', morTokenContracts)

  const { 
    arbitrumBalance, 
    baseBalance, 
    arbitrumSepoliaBalance, 
    baseSepoliaBalance,
    refetchArbitrum,
    refetchBase,
    refetchSepolia,
    refetchBaseSepolia
  } = useMORBalances(address)

  // Function to refresh balances based on current network
  const refreshBalances = useCallback(async () => {
    const isTestnet = chainId === 421614 || chainId === 84532 || chainId === 11155111;

    if (isTestnet) {
      // Only refresh testnet balances
      await Promise.all([
        refetchSepolia(),
        refetchBaseSepolia()
      ]);
    } else {
      // Only refresh mainnet balances
      await Promise.all([
        refetchArbitrum(),
        refetchBase()
      ]);
    }
  }, [chainId, refetchArbitrum, refetchBase, refetchSepolia, refetchBaseSepolia])

  // Set up polling for balance updates instead of watching events
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  
  useEffect(() => {
    if (!address) {
      // Clear interval if no address
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // Poll for balance updates every 5 minutes - balances don't change frequently
    // This is more conservative to avoid overwhelming RPC endpoints
    intervalRef.current = setInterval(() => {
      refreshBalances()
    }, 300000) // 5 minutes (300 seconds) - significantly reduced to minimize RPC calls

    // Cleanup interval on unmount or address change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [address, refreshBalances])
  
  // console.log('MORBalance - Arbitrum One raw balance:', arbitrumBalance)
  // console.log('MORBalance - Base raw balance:', baseBalance)
  // console.log('MORBalance - Arbitrum Sepolia raw balance:', arbitrumSepoliaBalance)

  // Expose refresh function globally for other components to use
  useEffect(() => {
    // Store refresh function in window object so other components can access it
    if (typeof window !== 'undefined') {
      window.refreshMORBalances = refreshBalances
    }
  }, [refreshBalances])

  if (!address || !chainId) return null

  // Format the balance for display with one decimal
  const formatBalance = (balance: bigint | undefined): number => {
    if (!balance) return 0;
    const fullNumber = parseFloat(formatUnits(balance, 18));
    return Number(fullNumber.toFixed(1));
  }

  // const arbitrumFormattedBalance = formatBalance(arbitrumBalance);
  // const baseFormattedBalance = formatBalance(baseBalance);
  // const sepoliaFormattedBalance = formatBalance(arbitrumSepoliaBalance);
  
  // console.log('MORBalance - Formatted balances:', {
  //   arbitrum: arbitrumFormattedBalance,
  //   base: baseFormattedBalance,
  //   sepolia: sepoliaFormattedBalance
  // });

  const isTestnet = chainId === 421614 || chainId === 84532 || chainId === 11155111; // Arbitrum Sepolia, Base Sepolia, or Sepolia
  // console.log('MORBalance - Is testnet:', isTestnet);

  if (isTestnet) {
    return (
      <div className="hidden md:flex items-center gap-2 text-sm text-white/80 font-medium">
        <div className="flex items-center gap-1 transition-all duration-200 hover:scale-110 hover:text-white">
          <ArbitrumIcon size={18} className="text-current" /> 
          <span className="text-xs">(Sepolia)</span>
          <NumberFlow value={formatBalance(arbitrumSepoliaBalance)} /> MOR
        </div>
        <div className="flex items-center gap-1 transition-all duration-200 hover:scale-110 hover:text-white">
          <BaseIcon size={18} className="text-current" /> 
          <span className="text-xs">(Sepolia)</span>
          <NumberFlow value={formatBalance(baseSepoliaBalance)} /> MOR
        </div>
      </div>
    )
  }

  return (
    <div className="hidden md:flex items-center gap-2 text-sm text-white/80 font-medium">
      <div className="flex items-center gap-1 transition-all duration-200 hover:scale-110 hover:text-white">
        <ArbitrumIcon size={18} className="text-current" /> 
        <NumberFlow value={formatBalance(arbitrumBalance)} /> MOR
      </div>
      <div className="flex items-center gap-1 transition-all duration-200 hover:scale-110 hover:text-white">
        <BaseIcon size={18} className="text-current" /> 
        <NumberFlow value={formatBalance(baseBalance)} /> MOR
      </div>
    </div>
  )
} 