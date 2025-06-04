"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStakingContractInteractions } from "@/hooks/useStakingContractInteractions";
import { formatEther } from "viem";
import { useChainId, useReadContract, useAccount } from "wagmi";
import { Builder } from "@/app/builders/builders-data";
import { arbitrumSepolia, arbitrum, base } from 'wagmi/chains';
import { morTokenContracts } from '@/lib/contracts';
import { useNetwork } from "@/context/network-context";

// MOR Token ABI for balance checking
const MOR_ABI = [{
  "inputs": [{"internalType": "address","name": "account","type": "address"}],
  "name": "balanceOf",
  "outputs": [{"internalType": "uint256","name": "","type": "uint256"}],
  "stateMutability": "view",
  "type": "function"
}] as const;

interface StakeModalProps {
  isOpen: boolean;
  onCloseAction: () => void;
  selectedBuilder: Builder | null;
}

export function StakeModal({ 
  isOpen, 
  onCloseAction, 
  selectedBuilder 
}: StakeModalProps) {
  const [stakeAmount, setStakeAmount] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const chainId = useChainId();
  const { address } = useAccount();
  const { switchToChain } = useNetwork();
  
  // Determine if we're on testnet
  const isTestnet = chainId === arbitrumSepolia.id;
  
  // Determine target network and chainId based on selectedBuilder
  const targetNetworkInfo = useMemo(() => {
    if (!selectedBuilder) return { chainId: chainId, networkName: 'Unknown' };
    
    if (isTestnet) {
      return { chainId: arbitrumSepolia.id, networkName: 'Arbitrum Sepolia' };
    }
    
    // For mainnet, check the builder's primary network
    const primaryNetwork = selectedBuilder.networks?.[0] || selectedBuilder.network;
    if (primaryNetwork === 'Arbitrum') {
      return { chainId: arbitrum.id, networkName: 'Arbitrum' };
    } else if (primaryNetwork === 'Base') {
      return { chainId: base.id, networkName: 'Base' };
    }
    
    // Default to current chain if we can't determine
    return { chainId: chainId, networkName: 'Unknown' };
  }, [selectedBuilder, isTestnet, chainId]);
  
  // Calculate the correct subnet ID based on network type
  const subnetId = useMemo(() => {
    if (!selectedBuilder) return undefined;
    
    if (isTestnet) {
      return selectedBuilder.id as `0x${string}` | undefined;
    } else {
      return selectedBuilder.mainnetProjectId as `0x${string}` | undefined;
    }
  }, [selectedBuilder, isTestnet]);
  
  // Fetch MOR balances from all networks (following mor-balance.tsx pattern)
  const { data: arbitrumBalance } = useReadContract({
    address: morTokenContracts[42161] as `0x${string}`,
    abi: MOR_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: 42161, // Arbitrum One
    query: {
      enabled: !!address && isOpen
    }
  });

  const { data: baseBalance } = useReadContract({
    address: morTokenContracts[8453] as `0x${string}`,
    abi: MOR_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: 8453, // Base
    query: {
      enabled: !!address && isOpen
    }
  });

  const { data: arbitrumSepoliaBalance } = useReadContract({
    address: morTokenContracts[421614] as `0x${string}`,
    abi: MOR_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: 421614, // Arbitrum Sepolia
    query: {
      enabled: !!address && isOpen
    }
  });
  
  // Get the effective token balance for the target network
  const effectiveTokenBalance = useMemo(() => {
    if (targetNetworkInfo.chainId === arbitrum.id) {
      return arbitrumBalance;
    } else if (targetNetworkInfo.chainId === base.id) {
      return baseBalance;
    } else if (targetNetworkInfo.chainId === arbitrumSepolia.id) {
      return arbitrumSepoliaBalance;
    }
    return undefined;
  }, [targetNetworkInfo.chainId, arbitrumBalance, baseBalance, arbitrumSepoliaBalance]);
  
  // Use the staking hook
  const {
    isCorrectNetwork,
    tokenSymbol,
    needsApproval,
    isSubmitting,
    handleApprove,
    handleStake,
    checkAndUpdateApprovalNeeded
  } = useStakingContractInteractions({
    subnetId: subnetId,
    networkChainId: targetNetworkInfo.chainId, // Use target network, not current wallet network
    onTxSuccess: () => {
      setStakeAmount("");
      onCloseAction();
    }
  });

  // Format a value to one decimal place
  const formatToOneDecimal = useCallback((value: number): string => {
    return (Math.floor(value * 10) / 10).toString();
  }, []);
  
  // Handle max button click
  const handleMaxClick = () => {
    if (effectiveTokenBalance) {
      const maxAmount = parseFloat(formatEther(effectiveTokenBalance));
      const formattedMaxAmount = formatToOneDecimal(maxAmount);
      setStakeAmount(formattedMaxAmount);
    }
  };

  // Check if the stake amount is valid (following page.tsx validation pattern)
  const isValidForSubmission = useMemo(() => {
    if (!stakeAmount || !effectiveTokenBalance) return false;
    
    const amount = parseFloat(stakeAmount);
    if (isNaN(amount) || amount <= 0) return false;
    
    const balance = parseFloat(formatEther(effectiveTokenBalance));
    if (amount > balance) return false;
    
    // Check minimum deposit
    if (selectedBuilder?.minDeposit && amount < selectedBuilder.minDeposit) return false;
    
    return true;
  }, [stakeAmount, effectiveTokenBalance, selectedBuilder]);

  // Warning logic (following page.tsx pattern)
  const showWarning = useMemo(() => {
    // Show warning if input is empty (need to enter amount)
    if (!stakeAmount || stakeAmount.trim() === "") return true;
    
    const amount = parseFloat(stakeAmount);
    if (isNaN(amount) || amount <= 0) return true;
    
    // Show warning if on wrong network OR insufficient balance OR needs approval
    return chainId !== targetNetworkInfo.chainId ||
           (needsApproval && amount > 0) ||
           (effectiveTokenBalance && amount > parseFloat(formatEther(effectiveTokenBalance)));
  }, [stakeAmount, chainId, targetNetworkInfo.chainId, needsApproval, effectiveTokenBalance]);

  const warningMessage = useMemo(() => {
    // Show message if input is empty
    if (!stakeAmount || stakeAmount.trim() === "") {
      return "Please enter an amount to stake";
    }
    
    const amount = parseFloat(stakeAmount);
    if (isNaN(amount) || amount <= 0) {
      return "Please enter a valid amount greater than 0";
    }
    
    // Check minimum deposit first
    if (selectedBuilder?.minDeposit && amount < selectedBuilder.minDeposit) {
      return `Minimum deposit is ${selectedBuilder.minDeposit} ${tokenSymbol}`;
    }
    
    // Check balance - this is most important and should show regardless of network
    if (effectiveTokenBalance !== undefined && amount > parseFloat(formatEther(effectiveTokenBalance))) {
      const currentBalance = parseFloat(formatEther(effectiveTokenBalance));
      if (currentBalance === 0) {
        return `You don't have any ${tokenSymbol} on ${targetNetworkInfo.networkName}. You may need to bridge tokens or use a different network.`;
      } else {
        return `Insufficient balance: You have ${currentBalance.toFixed(4)} ${tokenSymbol} on ${targetNetworkInfo.networkName} but need ${amount} ${tokenSymbol}`;
      }
    }
    
    // Then check network (only if balance is sufficient)
    if (chainId !== targetNetworkInfo.chainId) {
      return `Please switch to ${targetNetworkInfo.networkName} network to stake`;
    }
    
    // Finally check approval
    if (needsApproval && amount > 0) {
      return `You need to approve ${tokenSymbol} spending first`;
    }
    
    return "";
  }, [stakeAmount, chainId, targetNetworkInfo, needsApproval, tokenSymbol, effectiveTokenBalance, selectedBuilder]);

  // Check approval status when amount changes
  useEffect(() => {
    if (stakeAmount && parseFloat(stakeAmount) > 0) {
      checkAndUpdateApprovalNeeded(stakeAmount);
    }
  }, [stakeAmount, checkAndUpdateApprovalNeeded]);

  // Reset form state when modal opens or closes
  useEffect(() => {
    if (!isOpen) {
      setStakeAmount("");
      setFormError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    if (!isValidForSubmission) {
      setFormError(warningMessage || "Invalid amount");
      return;
    }

    try {
      // FIRST: Check if we need to switch to the target network
      const needsNetworkSwitch = chainId !== targetNetworkInfo.chainId;
      
      if (needsNetworkSwitch) {
        console.log(`Switching from chainId ${chainId} to target chainId ${targetNetworkInfo.chainId} (${targetNetworkInfo.networkName})`);
        await switchToChain(targetNetworkInfo.chainId);
        return; // Exit after network switch to let user click again
      }

      // Also handle case where hook thinks we're not on correct network
      if (!isCorrectNetwork()) {
        await switchToChain(targetNetworkInfo.chainId);
        return; // Exit after network switch to let user click again
      }

      // Only proceed with approval/staking if we're on the correct network
      const currentlyNeedsApproval = stakeAmount ? await checkAndUpdateApprovalNeeded(stakeAmount) : false;

      if ((currentlyNeedsApproval || needsApproval) && stakeAmount && parseFloat(stakeAmount) > 0) {
        await handleApprove(stakeAmount);
      } else if (stakeAmount && parseFloat(stakeAmount) > 0) {
        await handleStake(stakeAmount);
      }
    } catch (error) {
      console.error("Stake/Approve Action Error:", error);
      setFormError((error as Error)?.message || "An unexpected error occurred.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCloseAction()}>
      <DialogContent className="sm:max-w-[425px] bg-background border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-emerald-400">
            Stake {tokenSymbol} on {selectedBuilder?.name || "Builder"}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Support this builder by staking your tokens.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="stake-amount" className="text-sm font-medium">
              Amount to stake
            </Label>
            <div className="relative">
              <Input
                id="stake-amount"
                placeholder="0.0"
                value={stakeAmount}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || /^\d*\.?\d*$/.test(value)) {
                    setStakeAmount(value);
                    setFormError(null);
                  }
                }}
                className={`bg-background border-gray-700 pr-32 ${showWarning ? 'border-yellow-500' : ''}`}
                type="text"
                inputMode="decimal"
                pattern="[0-9]*[.]?[0-9]*"
                min="0"
                disabled={isSubmitting}
                required
                onKeyDown={(e) => {
                  if (['e', 'E', '-', '+'].includes(e.key)) {
                    e.preventDefault();
                  }
                }}
              />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                {effectiveTokenBalance !== undefined && (
                  <span className="text-xs text-gray-400 mr-2">
                    {parseFloat(formatEther(effectiveTokenBalance)).toFixed(1)} {tokenSymbol}
                  </span>
                )}
                <button
                  type="button"
                  className="h-8 px-2 text-xs copy-button-secondary"
                  onClick={handleMaxClick}
                  disabled={!effectiveTokenBalance || isSubmitting}
                >
                  Max
                </button>
              </div>
            </div>
            {formError && (
              <p className="text-xs text-red-500 pt-1">{formError}</p>
            )}
          </div>

          {warningMessage && (
            <div className="text-yellow-400 text-sm">
              {warningMessage}
            </div>
          )}

          {selectedBuilder && (
            <div className="p-1 rounded-md text-sm">
              <p className="text-gray-300 mb-1"><strong>Lock period:</strong> {selectedBuilder.lockPeriod || "N/A"}</p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button" 
              variant="outline"
              onClick={onCloseAction}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <button
              type="submit"
              className={
                isSubmitting || !isValidForSubmission
                  ? "copy-button-secondary px-2 text-sm opacity-50 cursor-not-allowed" 
                  : (needsApproval && stakeAmount && parseFloat(stakeAmount) > 0) ||
                    (chainId !== targetNetworkInfo.chainId)
                  ? "copy-button-secondary px-2 text-sm" 
                  : "copy-button-base"
              }
              disabled={
                isSubmitting || 
                !isValidForSubmission
              }
            >
              {isSubmitting ? (
                "Processing..."
              ) : chainId !== targetNetworkInfo.chainId ? (
                `Switch to ${targetNetworkInfo.networkName}`
              ) : (needsApproval && stakeAmount && parseFloat(stakeAmount) > 0) ? (
                `Approve ${tokenSymbol}`
              ) : (
                `Stake ${tokenSymbol}`
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}