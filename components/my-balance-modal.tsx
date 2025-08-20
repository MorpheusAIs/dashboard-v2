"use client"

import { useState } from 'react'
import { formatUnits } from 'viem'
import { useAccount, useReadContract, useChainId } from 'wagmi'
import { ArbitrumIcon, BaseIcon } from './network-icons'
import NumberFlow from '@number-flow/react'
import { morTokenContracts } from '@/lib/contracts'
import { CowSwapModal } from './cowswap-modal'
import { Eye } from 'lucide-react'
import {
  Dialog,
  DialogPortal,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const MOR_ABI = [{
  "inputs": [{"internalType": "address","name": "account","type": "address"}],
  "name": "balanceOf",
  "outputs": [{"internalType": "uint256","name": "","type": "uint256"}],
  "stateMutability": "view",
  "type": "function"
}] as const

// Custom hook for MOR balance management (similar to mor-balance.tsx)
function useMORBalances(address: `0x${string}` | undefined) {
  const { data: arbitrumBalance } = useReadContract({
    address: morTokenContracts[42161] as `0x${string}`,
    abi: MOR_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: 42161, // Arbitrum One
    account: address
  })

  const { data: baseBalance } = useReadContract({
    address: morTokenContracts[8453] as `0x${string}`,
    abi: MOR_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: 8453, // Base
    account: address
  })

  const { data: arbitrumSepoliaBalance } = useReadContract({
    address: morTokenContracts[421614] as `0x${string}`,
    abi: MOR_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: 421614, // Arbitrum Sepolia
    account: address
  })

  return {
    arbitrumBalance,
    baseBalance,
    arbitrumSepoliaBalance
  }
}

export function MyBalanceModal() {
  const [isOpen, setIsOpen] = useState(false)
  const { address } = useAccount()
  const chainId = useChainId()
  
  const { arbitrumBalance, baseBalance, arbitrumSepoliaBalance } = useMORBalances(address)

  // Format the balance for display with one decimal
  const formatBalance = (balance: bigint | undefined): number => {
    if (!balance) return 0;
    const fullNumber = parseFloat(formatUnits(balance, 18));
    return Number(fullNumber.toFixed(1));
  }

  const arbitrumFormattedBalance = formatBalance(arbitrumBalance);
  const baseFormattedBalance = formatBalance(baseBalance);
  const sepoliaFormattedBalance = formatBalance(arbitrumSepoliaBalance);

  const isTestnet = chainId === 421614 || chainId === 11155111; // Arbitrum Sepolia or Sepolia

  const handleClose = () => {
    setIsOpen(false)
  }

  if (!address) return null

  return (
    <>
      <button 
        className="flex items-center gap-1 px-2 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-emerald-400 text-sm font-medium hover:bg-emerald-500/30 transition-colors"
        onClick={() => setIsOpen(true)}
      >
        <Eye size={12} />
        My Balance
      </button>
      
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogPortal>
          <DialogContent className="sm:max-w-[425px] bg-background border-gray-800">
            <DialogHeader className="">
              <DialogTitle className="text-sm font-medium text-gray-400 text-center">
                Total Balance
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pb-6">
              {/* Total Balance - Main Highlight */}
              <div className="text-center space-y-1">
                <div className="text-3xl font-bold text-emerald-400">
                  <NumberFlow 
                    value={isTestnet 
                      ? sepoliaFormattedBalance 
                      : arbitrumFormattedBalance + baseFormattedBalance
                    } 
                  /> MOR
                </div>
                {/* <p className="text-sm text-gray-500">Total Balance</p> */}
              </div>

              {/* Divider */}
              <hr className="border-gray-700" />

              {/* Chain Balances */}
              <div className="space-y-1">
                {/* Arbitrum Balance */}
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <ArbitrumIcon size={18} className="text-gray-400" />
                    <span className="text-gray-300 font-medium">
                      {isTestnet ? "Arbitrum Sepolia" : "Arbitrum One"}
                    </span>
                  </div>
                  <span className="text-gray-200 font-medium">
                    <NumberFlow 
                      value={isTestnet ? sepoliaFormattedBalance : arbitrumFormattedBalance} 
                    /> MOR
                  </span>
                </div>

                {/* Base Balance - only show on mainnet */}
                {!isTestnet && (
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <BaseIcon size={18} className="text-gray-400" />
                      <span className="text-gray-300 font-medium">Base</span>
                    </div>
                    <span className="text-gray-200 font-medium">
                      <NumberFlow value={baseFormattedBalance} /> MOR
                    </span>
                  </div>
                )}
              </div>

              {/* Divider */}
              <hr className="border-gray-700" />

              {/* Buy MOR Button */}
              <div className="flex justify-center">
                <div className="[&>button]:text-base [&>button]:px-6 [&>button]:py-2">
                  <CowSwapModal />
                </div>
              </div>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </>
  )
}
