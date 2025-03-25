'use client'

import { formatUnits } from 'viem'
import { useAccount, useReadContract, useChainId } from 'wagmi'
import { ArbitrumIcon, BaseIcon } from './network-icons'
import NumberFlow from '@number-flow/react'
import { morTokenContracts } from '@/lib/contracts'

const MOR_ABI = [{
  "inputs": [{"internalType": "address","name": "account","type": "address"}],
  "name": "balanceOf",
  "outputs": [{"internalType": "uint256","name": "","type": "uint256"}],
  "stateMutability": "view",
  "type": "function"
}] as const

export function MORBalance() {
  const { address } = useAccount()
  const chainId = useChainId()

  const { data: arbitrumBalance } = useReadContract({
    address: morTokenContracts[42161],
    abi: MOR_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: 42161, // Arbitrum One
    account: address
  })

  const { data: baseBalance } = useReadContract({
    address: morTokenContracts[8453],
    abi: MOR_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: 8453, // Base
    account: address
  })

  const { data: arbitrumSepoliaBalance } = useReadContract({
    address: morTokenContracts[421614],
    abi: MOR_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: 421614, // Arbitrum Sepolia
    account: address
  })

  if (!address || !chainId) return null

  // Format the balance for display with one decimal
  const formatBalance = (balance: bigint | undefined): number => {
    if (!balance) return 0;
    const fullNumber = parseFloat(formatUnits(balance, 18));
    return Number(fullNumber.toFixed(1));
  }

  const isTestnet = chainId === 421614; // Arbitrum Sepolia

  if (isTestnet) {
    return (
      <div className="hidden md:flex items-center gap-2 text-sm text-white/80 font-medium">
        <div className="flex items-center gap-1 transition-all duration-200 hover:scale-110 hover:text-white">
          <ArbitrumIcon size={18} className="text-current" /> 
          <span className="text-xs">(Sepolia)</span>
          <NumberFlow value={formatBalance(arbitrumSepoliaBalance)} /> MOR
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