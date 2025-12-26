'use client'

import { useReadContract } from 'wagmi'
import { morTokenContracts } from '@/lib/contracts'
import { testnetChains } from '@/config/networks'

const MOR_ABI = [{
  "inputs": [{"internalType": "address","name": "account","type": "address"}],
  "name": "balanceOf",
  "outputs": [{"internalType": "uint256","name": "","type": "uint256"}],
  "stateMutability": "view",
  "type": "function"
}] as const

/**
 * Shared hook for fetching MOR token balances across all networks
 * This prevents duplicate RPC calls when multiple components need balance data
 */
export function useMORBalances(address: `0x${string}` | undefined) {
  const { data: arbitrumBalance, refetch: refetchArbitrum } = useReadContract({
    address: morTokenContracts[42161] as `0x${string}`,
    abi: MOR_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: 42161, // Arbitrum One
    account: address,
    query: {
      enabled: !!address,
      refetchInterval: false, // Disable automatic polling - components will manually refetch when needed
    }
  })

  const { data: baseBalance, refetch: refetchBase } = useReadContract({
    address: morTokenContracts[8453] as `0x${string}`,
    abi: MOR_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: 8453, // Base
    account: address,
    query: {
      enabled: !!address,
      refetchInterval: false, // Disable automatic polling - components will manually refetch when needed
    }
  })

  // @deprecated - Arbitrum Sepolia MOR token (kept for backward compatibility)
  const { data: arbitrumSepoliaBalance, refetch: refetchSepolia } = useReadContract({
    address: testnetChains.arbitrumSepolia.contracts?.morToken?.address as `0x${string}`,
    abi: MOR_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: 421614, // Arbitrum Sepolia
    account: address,
    query: {
      enabled: !!address && !!testnetChains.arbitrumSepolia.contracts?.morToken?.address,
      refetchInterval: false, // Disable automatic polling
    }
  })

  const { data: baseSepoliaBalance, refetch: refetchBaseSepolia } = useReadContract({
    address: morTokenContracts[84532] as `0x${string}`,
    abi: MOR_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: 84532, // Base Sepolia
    account: address,
    query: {
      enabled: !!address,
      refetchInterval: false, // Disable automatic polling
    }
  })

  return {
    arbitrumBalance,
    baseBalance,
    arbitrumSepoliaBalance,
    baseSepoliaBalance,
    refetchArbitrum,
    refetchBase,
    refetchSepolia,
    refetchBaseSepolia,
  }
}

