'use client'

import { useReadContract } from 'wagmi'
import { useAccount } from 'wagmi'
import { formatUnits } from 'viem'

const MOR_ABI = [{
  "inputs": [{"internalType": "address","name": "account","type": "address"}],
  "name": "balanceOf",
  "outputs": [{"internalType": "uint256","name": "","type": "uint256"}],
  "stateMutability": "view",
  "type": "function"
}] as const

const ARBITRUM_MOR = '0x092baadb7def4c3981454dd9c0a0d7ff07bcfc86'
const BASE_MOR = '0x7431ada8a591c955a994a21710752ef9b882b8e3'

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

  return (
    <div className="hidden md:flex items-center gap-2 text-sm text-white/70">
      <div>
        ARB: {arbitrumBalance ? formatUnits(arbitrumBalance, 18) : '0'} MOR
      </div>
      <div>
        Base: {baseBalance ? formatUnits(baseBalance, 18) : '0'} MOR
      </div>
    </div>
  )
} 