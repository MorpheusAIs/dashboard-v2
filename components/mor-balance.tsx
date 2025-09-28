'use client'

import { formatUnits } from 'viem'
import { useAccount, useReadContract, useChainId } from 'wagmi'
import { ArbitrumIcon, BaseIcon } from './network-icons'
import dynamic from 'next/dynamic'
import { morTokenContracts } from '@/lib/contracts'

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

const MOR_ABI = [{
  "inputs": [{"internalType": "address","name": "account","type": "address"}],
  "name": "balanceOf",
  "outputs": [{"internalType": "uint256","name": "","type": "uint256"}],
  "stateMutability": "view",
  "type": "function"
}, {
  "anonymous": false,
  "inputs": [
    {"indexed": true, "internalType": "address", "name": "from", "type": "address"},
    {"indexed": true, "internalType": "address", "name": "to", "type": "address"},
    {"indexed": false, "internalType": "uint256", "name": "value", "type": "uint256"}
  ],
  "name": "Transfer",
  "type": "event"
}] as const

// Custom hook for MOR balance management
function useMORBalances(address: `0x${string}` | undefined) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const { data: arbitrumBalance, refetch: refetchArbitrum } = useReadContract({
    address: morTokenContracts[42161] as `0x${string}`,
    abi: MOR_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: 42161, // Arbitrum One
    account: address
  })

  const { data: baseBalance, refetch: refetchBase } = useReadContract({
    address: morTokenContracts[8453] as `0x${string}`,
    abi: MOR_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: 8453, // Base
    account: address
  })

  const { data: arbitrumSepoliaBalance, refetch: refetchSepolia } = useReadContract({
    address: morTokenContracts[421614] as `0x${string}`,
    abi: MOR_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: 421614, // Arbitrum Sepolia
    account: address
  })

  // Function to refresh all balances
  const refreshBalances = useCallback(async () => {
    // console.log('MORBalance - Refreshing all balances...')
    await Promise.all([
      refetchArbitrum(),
      refetchBase(),
      refetchSepolia()
    ])
  }, [refetchArbitrum, refetchBase, refetchSepolia])

  // Set up polling for balance updates instead of watching events
  useEffect(() => {
    if (!address) {
      // Clear interval if no address
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // Poll for balance updates every 30 seconds
    // This is more reliable than event watching with RPC providers that don't support filters
    intervalRef.current = setInterval(() => {
      // console.log('MORBalance - Polling for balance updates...')
      refreshBalances()
    }, 30000) // 30 seconds

    // Cleanup interval on unmount or address change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [address, refreshBalances])

  return {
    arbitrumBalance,
    baseBalance,
    arbitrumSepoliaBalance,
    refreshBalances
  }
}

export function MORBalance() {
  const { address } = useAccount()
  const chainId = useChainId()
  
  // console.log('MORBalance - Connected chainId:', chainId)
  // console.log('MORBalance - User address:', address)
  // console.log('MORBalance - MOR contract addresses:', morTokenContracts)

  const { arbitrumBalance, baseBalance, arbitrumSepoliaBalance, refreshBalances } = useMORBalances(address)
  
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

  const isTestnet = chainId === 421614 || chainId === 11155111; // Arbitrum Sepolia or Sepolia
  // console.log('MORBalance - Is testnet:', isTestnet);

  if (isTestnet) {
    return (
      <div className="mor-balance hidden md:flex items-center gap-2 text-sm text-white/80 font-medium">
        <div className="flex items-center gap-1 transition-all duration-200 hover:scale-110 hover:text-white">
          <ArbitrumIcon size={18} className="text-current" /> 
          <span className="text-xs">(Sepolia)</span>
          <NumberFlow value={formatBalance(arbitrumSepoliaBalance)} /> MOR
        </div>
      </div>
    )
  }

  return (
    <div className="mor-balance hidden md:flex items-center gap-2 text-sm text-white/80 font-medium">
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