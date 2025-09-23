"use client"

import { useState, useEffect } from 'react'
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
import { CowSwapModal } from './cowswap-modal'
import { Eye } from 'lucide-react'
import { getTokenPrice } from '@/app/services/token-price.service'
import {
  Dialog,
  DialogPortal,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"

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
  const [morPrice, setMorPrice] = useState<number | null>(null)
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

  // Fetch MOR price from CoinGecko
  useEffect(() => {
    async function fetchMorPrice() {
      try {
        const price = await getTokenPrice('morpheusai', 'usd') // MOR token ID on CoinGecko
        setMorPrice(price)
      } catch (error) {
        console.error('Error fetching MOR price:', error)
      }
    }

    fetchMorPrice()
  }, [])

  const handleClose = () => {
    setIsOpen(false)
  }

  // Calculate total balance and USD equivalent
  const totalMorBalance = isTestnet 
    ? sepoliaFormattedBalance 
    : arbitrumFormattedBalance + baseFormattedBalance
  
  const totalUsdValue = morPrice ? totalMorBalance * morPrice : null

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
                  <NumberFlow value={totalMorBalance} /> MOR
                </div>
                {/* USD Equivalent */}
                {totalMorBalance > 0 && totalUsdValue && totalUsdValue > 0 && (
                  <div className="text-sm text-white">
                    ${totalUsdValue.toFixed(2)}
                  </div>
                )}
              </div>


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
                {/* Divider */}
                <Separator />

                {/* Base Balance - only show on mainnet */}
                {!isTestnet && (
                <>
                    <div className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-3">
                            <BaseIcon size={18} className="text-gray-400" />
                            <span className="text-gray-300 font-medium">Base</span>
                        </div>
                        <span className="text-gray-200 font-medium">
                        <NumberFlow value={baseFormattedBalance} /> MOR
                        </span>
                    </div>
                    <Separator />
                  </>
                )}
              </div>

              {/* Divider */}
              {/* <hr className="border-gray-700" /> */}

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
