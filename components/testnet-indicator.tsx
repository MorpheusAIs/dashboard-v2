'use client'

import { useNetwork } from '@/context/network-context'
import { useNetworkInfo } from '@/app/hooks/useNetworkInfo'

export function TestnetIndicator() {
  const { environment, isLocalTest } = useNetwork()
  const { rpcUrl } = useNetworkInfo()
  
  if (environment === 'mainnet') {
    return null
  }

  if (isLocalTest) {
    return (
      <div className="fixed top-0 left-0 right-0 bg-orange-500 text-white text-center py-1 px-4 text-sm font-medium z-50">
        🛠️ LOCAL TEST MODE - Connected to Anvil Fork
        {rpcUrl && <span className="ml-2 text-xs opacity-75">({rpcUrl})</span>}
      </div>
    )
  }

  return (
    <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-black text-center py-1 px-4 text-sm font-medium z-50">
      ⚠️ TESTNET MODE - You are on a test network
    </div>
  )
} 