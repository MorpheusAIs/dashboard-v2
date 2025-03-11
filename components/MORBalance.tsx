'use client'

import { formatUnits } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { ArbitrumIcon, BaseIcon } from './network-icons'
import NumberFlow from '@number-flow/react'

const MOR_ABI = [{
  "inputs": [{"internalType": "address","name": "account","type": "address"}],
  "name": "balanceOf",
  "outputs": [{"internalType": "uint256","name": "","type": "uint256"}],
  "stateMutability": "view",
  "type": "function"
}] as const

const ARBITRUM_MOR = '0x092baadb7def4c3981454dd9c0a0d7ff07bcfc86'
const BASE_MOR = '0x092baadb7def4c3981454dd9c0a0d7ff07bcfc86'

export function MORBalance() {
  const { address } = useAccount()

  const { data: arbitrumBalance } = useReadContract({
    address: ARBITRUM_MOR,
    abi: MOR_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: 42161, // Arbitrum One
    account: address
  })

  const { data: baseBalance } = useReadContract({
    address: BASE_MOR,
    abi: MOR_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: 8453, // Base
    account: address
  })

  if (!address) return null

  // Format the balance for display
  const formatBalance = (balance: bigint | undefined): number => {
    if (!balance) return 0;
    return parseFloat(formatUnits(balance, 18));
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