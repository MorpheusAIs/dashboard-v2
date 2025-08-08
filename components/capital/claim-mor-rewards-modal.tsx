"use client";

import { useState, useMemo } from "react";
import { 
  Dialog, 
  DialogPortal, 
  DialogContent, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight, Clock } from "lucide-react";
import { TokenIcon } from '@web3icons/react';
import { useCapitalContext } from "@/context/CapitalPageContext";
import { useNetwork } from "@/context/network-context";
import { sepolia, mainnet } from 'wagmi/chains';
import { formatNumber } from "@/lib/utils";

interface ClaimableAsset {
  symbol: 'stETH' | 'LINK';
  icon: string;
  claimableAmount: number;
  claimableAmountFormatted: string;
  canClaim: boolean;
}

export function ClaimMorRewardsModal() {
  const {
    activeModal,
    setActiveModal,
    assets,
    stETHV2CanClaim,
    linkV2CanClaim,
    claimAssetRewards,
    lockAssetRewards,
    isProcessingClaim,
    isProcessingChangeLock,
    networkEnv,
  } = useCapitalContext();

  // Add network detection
  const { currentChainId, switchToChain, isNetworkSwitching } = useNetwork();

  // Determine correct network based on environment
  // Claims happen on L1 (Ethereum), not L2 (Arbitrum)
  const correctChainId = useMemo(() => {
    return networkEnv === 'testnet' ? sepolia.id : mainnet.id;
  }, [networkEnv]);

  // Check if user is on correct network
  const isOnCorrectNetwork = useMemo(() => {
    return currentChainId === correctChainId;
  }, [currentChainId, correctChainId]);

  // Get network name for display
  const networkName = useMemo(() => {
    return networkEnv === 'testnet' ? 'Ethereum Sepolia' : 'Ethereum Mainnet';
  }, [networkEnv]);

  const isOpen = activeModal === 'claimMorRewards';

  // State for selected assets
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  
  // State for lock duration (for lock rewards functionality)
  const [lockValue, setLockValue] = useState<string>("30");
  const [lockUnit, setLockUnit] = useState<'days' | 'months' | 'years'>('days');
  
  // Helper to convert lock duration to seconds
  const durationToSeconds = (value: string, unit: 'days' | 'months' | 'years'): bigint => {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) return BigInt(0);
    
    const secondsPerDay = 24 * 60 * 60;
    const secondsPerMonth = 30 * secondsPerDay; // Approximate
    const secondsPerYear = 365 * secondsPerDay; // Approximate
    
    switch (unit) {
      case 'days':
        return BigInt(Math.floor(numValue * secondsPerDay));
      case 'months':
        return BigInt(Math.floor(numValue * secondsPerMonth));
      case 'years':
        return BigInt(Math.floor(numValue * secondsPerYear));
      default:
        return BigInt(0);
    }
  };

  const handleClose = () => {
    setActiveModal(null);
    setSelectedAssets(new Set()); // Reset selections when closing
  };

  // Helper function to safely parse claimable amount
  const parseClaimableAmount = (claimableFormatted: string | undefined): number => {
    try {
      if (!claimableFormatted || typeof claimableFormatted !== 'string') {
        return 0;
      }
      const cleanedValue = claimableFormatted.replace(/,/g, '');
      const parsed = parseFloat(cleanedValue);
      return isNaN(parsed) ? 0 : parsed;
    } catch (error) {
      console.error('Error parsing claimable amount:', error);
      return 0;
    }
  };

  // Get claimable assets (only those with MOR > 0)
  const claimableAssets: ClaimableAsset[] = useMemo(() => {
    const stethClaimable = parseClaimableAmount(assets.stETH?.claimableAmountFormatted);
    const linkClaimable = parseClaimableAmount(assets.LINK?.claimableAmountFormatted);

    // Debug logging
    console.log('🔍 ClaimMorRewardsModal - Asset Data:', {
      stETH: {
        claimableAmountFormatted: assets.stETH?.claimableAmountFormatted,
        parsed: stethClaimable,
        canClaim: stETHV2CanClaim,
      },
      LINK: {
        claimableAmountFormatted: assets.LINK?.claimableAmountFormatted,
        parsed: linkClaimable,
        canClaim: linkV2CanClaim,
      },
    });

    const assetList: ClaimableAsset[] = [];

    // Show stETH if user has deposited (even if claimable is 0)
    if (assets.stETH && (stethClaimable > 0 || assets.stETH.userDeposited > BigInt(0))) {
      assetList.push({
        symbol: 'stETH',
        icon: 'eth',
        claimableAmount: stethClaimable,
        claimableAmountFormatted: assets.stETH?.claimableAmountFormatted || '0',
        canClaim: stETHV2CanClaim && stethClaimable > 0,
      });
    }

    // Show LINK if user has deposited (even if claimable is 0)
    if (assets.LINK && (linkClaimable > 0 || assets.LINK.userDeposited > BigInt(0))) {
      assetList.push({
        symbol: 'LINK',
        icon: 'link',
        claimableAmount: linkClaimable,
        claimableAmountFormatted: assets.LINK?.claimableAmountFormatted || '0',
        canClaim: linkV2CanClaim && linkClaimable > 0,
      });
    }

    return assetList;
  }, [assets, stETHV2CanClaim, linkV2CanClaim]);

  // Determine if network switch is needed
  const needsNetworkSwitch = useMemo(() => {
    return !isOnCorrectNetwork && claimableAssets.length > 0;
  }, [isOnCorrectNetwork, claimableAssets.length]);

  // Calculate totals for selected assets
  const selectedTotals = useMemo(() => {
    const selectedClaimableAssets = claimableAssets.filter(asset => 
      selectedAssets.has(asset.symbol) && asset.canClaim
    );
    
    const totalAmount = selectedClaimableAssets.reduce((sum, asset) => sum + asset.claimableAmount, 0);
    
    return {
      selectedAssets: selectedClaimableAssets,
      totalAmount,
      totalAmountFormatted: formatNumber(totalAmount),
    };
  }, [claimableAssets, selectedAssets]);

  const handleAssetToggle = (assetSymbol: string, checked: boolean | 'indeterminate') => {
    const newSelected = new Set(selectedAssets);
    if (checked === true) {
      newSelected.add(assetSymbol);
    } else {
      newSelected.delete(assetSymbol);
    }
    setSelectedAssets(newSelected);
  };

  const handleNetworkSwitch = async () => {
    try {
      await switchToChain(correctChainId);
    } catch (error) {
      console.error('Network switching failed:', error);
      // Error handling is done in the context via toast notifications
    }
  };

  const handleClaim = async () => {
    if (selectedTotals.selectedAssets.length === 0) return;
    
    try {
      // Claim rewards for each selected asset
      for (const asset of selectedTotals.selectedAssets) {
        if (asset.canClaim) {
          await claimAssetRewards(asset.symbol);
        }
      }
      handleClose();
    } catch (error) {
      console.error('Error claiming rewards:', error);
      // Error handling is done in the context via toast notifications
    }
  };

  const handleLockRewards = async () => {
    if (selectedTotals.selectedAssets.length === 0) return;
    
    const lockDurationSeconds = durationToSeconds(lockValue, lockUnit);
    if (lockDurationSeconds <= BigInt(0)) {
      console.error('Invalid lock duration');
      return;
    }
    
    try {
      // Lock rewards for each selected asset
      for (const asset of selectedTotals.selectedAssets) {
        await lockAssetRewards(asset.symbol, lockDurationSeconds);
      }
      handleClose();
    } catch (error) {
      console.error('Error locking rewards:', error);
      // Error handling is done in the context via toast notifications
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogPortal>
        <DialogContent className="sm:max-w-[425px] bg-background border-gray-800">
          {/* Custom header with close button */}
          {/* <div className="flex items-center justify-between p-6 pb-4"> */}
            <DialogTitle className="text-xl font-bold text-emerald-400">
              Claim MOR Rewards
            </DialogTitle>
          {/* </div> */}

          <div className="px-6 pb-6">
            <DialogDescription className="text-gray-400 text-sm leading-relaxed mb-6">
              Claim rewards earned by staking capital to Morpheus or lock your rewards for an increased power factor for future rewards.
            </DialogDescription>

            {claimableAssets.length > 0 ? (
              <>
                {/* Network Status Indicator */}
                <div className={`mb-4 p-3 rounded-lg border ${
                  isOnCorrectNetwork 
                    ? 'border-emerald-400 bg-emerald-400/10' 
                    : 'border-yellow-400 bg-yellow-400/10'
                }`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      isOnCorrectNetwork ? 'bg-emerald-400' : 'bg-yellow-400'
                    }`} />
                    <span className={`text-sm font-medium ${
                      isOnCorrectNetwork ? 'text-emerald-400' : 'text-yellow-400'
                    }`}>
                      {isOnCorrectNetwork 
                        ? `Connected to ${networkName}` 
                        : `Please switch to ${networkName}`
                      }
                    </span>
                  </div>
                  {!isOnCorrectNetwork && (
                    <p className="text-xs text-yellow-300 mt-1">
                      Claims are processed on {networkName}. MOR tokens will be minted on {networkEnv === 'testnet' ? 'Arbitrum Sepolia' : 'Arbitrum One'}.
                    </p>
                  )}
                </div>

                {/* Select Rewards to Claim */}
                <div className="mb-6">
                  <h3 className="text-white text-base font-medium mb-4">Select Rewards to Claim</h3>
                  <div className="space-y-3">
                    {claimableAssets.map((asset) => (
                      <div
                        key={asset.symbol}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                          selectedAssets.has(asset.symbol) 
                            ? 'border-emerald-400 bg-emerald-400/10' 
                            : 'border-gray-700 bg-gray-800/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-lg">
                            <TokenIcon symbol={asset.icon} variant="background" size="24" />
                          </div>
                          <span className="text-white font-sm">{asset.symbol}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-sm ${asset.canClaim ? 'text-white' : 'text-gray-500'}`}>
                            {asset.claimableAmountFormatted} MOR
                          </span>
                          {/* {selectedAssets.has(asset.symbol) && ( */}
                            <Checkbox
                                checked={selectedAssets.has(asset.symbol)}
                                onCheckedChange={(checked) => handleAssetToggle(asset.symbol, checked)}
                                disabled={!asset.canClaim || needsNetworkSwitch}
                            />
                          {/* )} */}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Summary */}
                {selectedTotals.selectedAssets.length > 0 && (
                  <div className="mb-6 p-4 rounded-lg bg-gray-800/50 border border-gray-700">
                    {selectedTotals.selectedAssets.map((asset) => (
                      <div key={asset.symbol} className="flex justify-between items-center mb-2 last:mb-0">
                        <span className="text-gray-300">{asset.symbol} Rewards</span>
                        <span className="text-white font-medium">{asset.claimableAmountFormatted} MOR</span>
                      </div>
                    ))}
                    <div className="border-t border-gray-600 pt-2 mt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-white font-semibold">Total Rewards</span>
                        <span className="text-white font-bold">{selectedTotals.totalAmountFormatted} MOR</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Lock Duration Selection (for Lock Rewards) */}
                {selectedTotals.selectedAssets.length > 0 && (
                  <div className="mb-6 p-4 rounded-lg bg-yellow-400/10 border border-yellow-400/20">
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="h-4 w-4 text-yellow-400" />
                      <Label className="text-sm font-medium text-yellow-400">Lock Duration (for increased multiplier)</Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        value={lockValue}
                        onChange={(e) => setLockValue(e.target.value)}
                        className="flex-1 bg-gray-800 border-gray-600 text-white"
                        placeholder="30"
                        min="1"
                      />
                      <Select value={lockUnit} onValueChange={(value: 'days' | 'months' | 'years') => setLockUnit(value)}>
                        <SelectTrigger className="w-32 bg-gray-800 border-gray-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="days">Days</SelectItem>
                          <SelectItem value="months">Months</SelectItem>
                          <SelectItem value="years">Years</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-yellow-300 mt-2">
                      Locking rewards increases your power factor for future rewards but delays claiming.
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-3">
                  <button
                    className="w-full copy-button flex items-center justify-center gap-2"
                    onClick={handleLockRewards}
                    disabled={selectedTotals.selectedAssets.length === 0 || isProcessingChangeLock || isProcessingClaim || needsNetworkSwitch}
                  >
                    {isProcessingChangeLock ? "Locking..." : "Lock MOR Rewards"}
                    <ChevronRight className="h-4 w-4" />
                  </button>

                  {needsNetworkSwitch ? (
                    <button
                      className="w-full copy-button-secondary px-4 py-2"
                      onClick={handleNetworkSwitch}
                      disabled={isNetworkSwitching}
                    >
                      {isNetworkSwitching ? "Switching..." : `Switch to ${networkName}`}
                    </button>
                  ) : (
                    <button
                      className="w-full copy-button-secondary px-4 py-2"
                      onClick={handleClaim}
                      disabled={selectedTotals.selectedAssets.length === 0 || isProcessingClaim || isProcessingChangeLock}
                    >
                      {isProcessingClaim ? "Claiming..." : "Claim MOR Rewards"}
                    </button>
                  )}
                  
                  <p className="text-xs text-gray-400 text-center">
                    {needsNetworkSwitch ? (
                      <>⚠️ Switch to {networkName} network to claim rewards</>
                    ) : (
                      <>⚠️ Claims require ~0.01 ETH for cross-chain gas. MOR tokens will be minted on {networkEnv === 'testnet' ? 'Arbitrum Sepolia' : 'Arbitrum One'}</>
                    )}
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-400 text-sm">No claimable rewards available.</p>
                <button
                  className="mt-4 copy-button-secondary px-4 py-2"
                  onClick={handleClose}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
} 