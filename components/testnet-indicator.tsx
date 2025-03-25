'use client'

import { useChainId } from 'wagmi'

export function TestnetIndicator() {
  const chainId = useChainId()
  const isTestnet = chainId === 421614 // Arbitrum Sepolia

  if (!isTestnet) return null

  return (
    <div className="hidden md:flex items-center px-4 py-1.5 text-sm font-medium text-emerald-400 bg-emerald-400/10 rounded-full">
      You are connected to Testnet
    </div>
  )
} 