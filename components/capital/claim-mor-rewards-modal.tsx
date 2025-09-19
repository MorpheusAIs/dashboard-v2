"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogPortal,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight, Lock, LockOpen } from "lucide-react";
import { TokenIcon } from '@web3icons/react';
import { Badge } from "@/components/ui/badge";
import { useCapitalContext, type AssetSymbol } from "@/context/CapitalPageContext";
import { useNetwork } from "@/context/network-context";
import { sepolia, mainnet } from 'wagmi/chains';

// Import hooks for power factor and estimated rewards
import { usePowerFactor } from "@/hooks/use-power-factor";
import { useEstimatedRewards } from "@/hooks/use-estimated-rewards";

// Import config and utils
import { getContractAddress, type NetworkEnvironment } from "@/config/networks";
import {
  getMaxAllowedValue,
  getMinAllowedValue,
  type TimeUnit
} from "@/lib/utils/power-factor-utils";

interface ClaimableAsset {
  symbol: AssetSymbol; // Now supports all assets dynamically
  icon: string;
  claimableAmount: number;
  claimableAmountFormatted: string;
  canClaim: boolean;
}

export function ClaimMorRewardsModal() {
  const {
    activeModal,
    setActiveModal,
    selectedAsset,
    assets,
    selectedAssetCanClaim, // Use dynamic claim eligibility instead of hardcoded
    claimAssetRewards,
    lockAssetRewards,
    isProcessingClaim,
    isProcessingChangeLock,
    networkEnv,
    l1ChainId,
  } = useCapitalContext();

  // Add network detection
  const { currentChainId, switchToChain, isNetworkSwitching } = useNetwork();

  // Calculate network environment
  const networkEnvCalculated = useMemo((): NetworkEnvironment => {
    return [1, 42161, 8453].includes(l1ChainId || 0) ? 'mainnet' : 'testnet';
  }, [l1ChainId]);

  // Use the networkEnv from context, fallback to calculated
  const effectiveNetworkEnv = networkEnv || networkEnvCalculated;

  // Determine correct network based on environment
  // Claims happen on L1 (Ethereum), not L2 (Arbitrum)
  const correctChainId = useMemo(() => {
    return effectiveNetworkEnv === 'testnet' ? sepolia.id : mainnet.id;
  }, [effectiveNetworkEnv]);

  // Check if user is on correct network
  const isOnCorrectNetwork = useMemo(() => {
    return currentChainId === correctChainId;
  }, [currentChainId, correctChainId]);

  // Get network name for display
  const networkName = useMemo(() => {
    return effectiveNetworkEnv === 'testnet' ? 'Ethereum Sepolia' : 'Ethereum Mainnet';
  }, [effectiveNetworkEnv]);

  // Use distributorV2 contract for reward calculations in v7 protocol
  const poolContractAddress = useMemo(() => {
    if (!l1ChainId) return undefined;
    return getContractAddress(l1ChainId, 'distributorV2', effectiveNetworkEnv) as `0x${string}` | undefined;
  }, [l1ChainId, effectiveNetworkEnv]);

  const isOpen = activeModal === 'claimMorRewards';

  // State for lock duration (for lock rewards functionality)
  const [lockValue, setLockValue] = useState<string>("3");
  const [lockUnit, setLockUnit] = useState<TimeUnit>('months');

  // Initialize power factor hook
  const powerFactor = usePowerFactor({
    contractAddress: poolContractAddress,
    chainId: l1ChainId,
    enabled: true,
    // Uses contract calls for all networks for authoritative results
  });

  // Validate lock value based on unit (both minimum and maximum)
  const validateLockValue = React.useCallback((value: string, unit: TimeUnit) => {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue <= 0) return true; // Let basic validation handle this

    const minAllowed = getMinAllowedValue(unit);
    const maxAllowed = getMaxAllowedValue(unit);
    return numValue >= minAllowed && numValue <= maxAllowed;
  }, []);

  // Handle lock value changes with validation
  const handleLockValueChange = React.useCallback((value: string) => {
    if (value === '' || /^\d+$/.test(value)) {
      // Check if the value is within limits for the current unit
      if (value === '' || validateLockValue(value, lockUnit)) {
        setLockValue(value);
      }
      // If invalid, don't update the state (effectively prevents the input)
    }
  }, [lockUnit, validateLockValue]);

  // Handle lock unit changes with value validation
  const handleLockUnitChange = React.useCallback((unit: TimeUnit) => {
    setLockUnit(unit);

    // Validate current value with new unit
    if (lockValue && !validateLockValue(lockValue, unit)) {
      // If current value is invalid for new unit, reset to minimum valid value
      const minAllowed = getMinAllowedValue(unit);
      setLockValue(minAllowed.toString());
    }
  }, [lockValue, validateLockValue]);

  // Helper to convert lock duration to seconds
  const durationToSeconds = (value: string, unit: TimeUnit): bigint => {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) return BigInt(0);

    const secondsPerMonth = 30 * 24 * 60 * 60; // Approximate
    const secondsPerYear = 365 * 24 * 60 * 60; // Approximate
    const safetyBuffer = 300; // 5 minutes safety buffer to prevent timing race conditions

    switch (unit) {
      case 'months':
        return BigInt(Math.floor(numValue * secondsPerMonth) + safetyBuffer);
      case 'years':
        return BigInt(Math.floor(numValue * secondsPerYear) + safetyBuffer);
      default:
        return BigInt(0);
    }
  };

  const handleClose = () => {
    setActiveModal(null);
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

  // Get the selected asset data - Now fully dynamic!
  const selectedAssetData: ClaimableAsset | null = useMemo(() => {
    if (!selectedAsset) return null;

    const asset = assets[selectedAsset];
    if (!asset) return null;

    const claimableAmount = parseClaimableAmount(asset.claimableAmountFormatted);

    // Debug logging
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔍 ClaimMorRewardsModal - Dynamic Asset Data:', {
        selectedAsset,
        claimableAmountFormatted: asset.claimableAmountFormatted,
        parsed: claimableAmount,
        canClaim: selectedAssetCanClaim,
        assetIcon: asset.config.icon
      });
    }

    return {
      symbol: selectedAsset,
      icon: asset.config.icon, // Use dynamic icon from asset config
      claimableAmount: claimableAmount,
      claimableAmountFormatted: asset.claimableAmountFormatted || '0',
      canClaim: selectedAssetCanClaim && claimableAmount > 0, // Use dynamic claim eligibility
    };
  }, [selectedAsset, assets, selectedAssetCanClaim]);

  // Get the deposit pool address for the selected asset (V7 protocol requirement)
  const selectedAssetDepositPoolAddress = useMemo(() => {
    const depositPoolMapping: Partial<Record<AssetSymbol, keyof import('@/config/networks').ContractAddresses>> = {
      stETH: 'stETHDepositPool',
      LINK: 'linkDepositPool', 
      USDC: 'usdcDepositPool',
      USDT: 'usdtDepositPool',
      wBTC: 'wbtcDepositPool',
      wETH: 'wethDepositPool',
    };
    
    const contractKey = depositPoolMapping[selectedAsset];
    if (!contractKey || !l1ChainId) return undefined;
    
    return getContractAddress(l1ChainId, contractKey, effectiveNetworkEnv) as `0x${string}` | undefined;
  }, [selectedAsset, l1ChainId, effectiveNetworkEnv]);

  // Initialize estimated rewards hook (using claimable amount as deposit amount for estimation)
  const estimatedRewards = useEstimatedRewards({
    contractAddress: poolContractAddress, // Use distributorV2 contract for all assets
    chainId: l1ChainId,
    poolId: BigInt(0),
    depositPoolAddress: selectedAssetDepositPoolAddress, // V7: Pass asset-specific deposit pool address
    networkEnv: effectiveNetworkEnv, // V7: Required for RewardPoolV2 contract lookup
    depositAmount: selectedAssetData?.claimableAmountFormatted || "0", // Use claimable amount for estimation
    powerFactorString: powerFactor.currentResult.powerFactor,
    lockValue,
    lockUnit: lockUnit as "days" | "months" | "years",
    enabled: !!selectedAssetData && selectedAssetData.claimableAmount > 0 && (powerFactor?.currentResult?.isValid ?? false)
  });

  // Calculate unlock date using utility function
  const unlockDate = useMemo(() => {
    const result = powerFactor?.currentResult;
    return result && 'unlockDate' in result ? result.unlockDate || null : null;
  }, [powerFactor?.currentResult]);

  // Update power factor calculation when lock period changes
  React.useEffect(() => {
    // if (process.env.NODE_ENV !== 'production') {
    //   console.group('🎛️ [Claim Modal Debug] Lock Period Change');
    //   console.log('Lock Value:', lockValue);
    //   console.log('Lock Unit:', lockUnit);
    //   console.log('Power Factor Hook State:', {
    //     contractAddress: poolContractAddress,
    //     chainId: l1ChainId,
    //     isLoading: powerFactor.isLoading,
    //     contractError: powerFactor.contractError,
    //     currentResult: powerFactor.currentResult
    //   });
    // }

    if (lockValue && parseInt(lockValue, 10) > 0) {
      // if (process.env.NODE_ENV !== 'production') {
      //   console.log('Calling powerFactor.setLockPeriod');
      // }
      powerFactor.setLockPeriod(lockValue, lockUnit);
    }

    // if (process.env.NODE_ENV !== 'production') {
    //   console.groupEnd();
    // }
  }, [lockValue, lockUnit, powerFactor, poolContractAddress, l1ChainId]);

  // Determine if network switch is needed
  const needsNetworkSwitch = useMemo(() => {
    return !isOnCorrectNetwork && selectedAssetData !== null;
  }, [isOnCorrectNetwork, selectedAssetData]);

  // Calculate totals for the selected asset
  const selectedTotals = useMemo(() => {
    if (!selectedAssetData) {
      return {
        selectedAssets: [],
        totalAmount: 0,
        totalAmountFormatted: '0',
      };
    }

    return {
      selectedAssets: [selectedAssetData],
      totalAmount: selectedAssetData.claimableAmount,
      totalAmountFormatted: selectedAssetData.claimableAmountFormatted,
    };
  }, [selectedAssetData]);



  const handleNetworkSwitch = async () => {
    try {
      await switchToChain(correctChainId);
    } catch (error) {
      console.error('Network switching failed:', error);
      // Error handling is done in the context via toast notifications
    }
  };

  const handleClaim = async () => {
    if (selectedTotals.selectedAssets.length === 0 || !selectedAssetData) return;

    try {
      // Claim rewards for the selected asset
      if (selectedAssetData.canClaim) {
        await claimAssetRewards(selectedAssetData.symbol);
      }
      handleClose();
    } catch (error) {
      console.error('Error claiming rewards:', error);
      // Error handling is done in the context via toast notifications
    }
  };

  const handleLockRewards = async () => {
    if (selectedTotals.selectedAssets.length === 0 || !selectedAssetData) return;

    const lockDurationSeconds = durationToSeconds(lockValue, lockUnit);
    if (lockDurationSeconds <= BigInt(0)) {
      console.error('Invalid lock duration');
      return;
    }

    try {
      // Lock rewards for the selected asset
      await lockAssetRewards(selectedAssetData.symbol, lockDurationSeconds);
      handleClose();
    } catch (error) {
      console.error('Error locking rewards:', error);
      // Error handling is done in the context via toast notifications
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogPortal>
        <DialogContent className="h-[100vh] w-full sm:h-auto sm:max-w-[425px] bg-background border-gray-800 flex flex-col sm:block overflow-hidden">
          <DialogHeader className="flex-shrink-0 px-4 sm:px-0">
            <DialogTitle className="text-xl font-bold text-emerald-400">
              Manage MOR Rewards
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 sm:px-0 pb-4 sm:pb-0">
            <DialogDescription className="text-gray-400 text-sm leading-relaxed mb-6">
              Claim rewards earned by staking capital to Morpheus or lock your rewards for an increased power factor for future rewards.
            </DialogDescription>

            {selectedAssetData ? (
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

                {/* Selected Asset Display */}
                {selectedAssetData && (
                  <div className="mb-6">
                    <h3 className="text-white text-base font-medium mb-4">Selected Asset</h3>
                    <div className="flex items-center justify-between p-3 bg-emerald-400/10 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-lg">
                          <TokenIcon symbol={selectedAssetData.icon} className='rounded-lg' variant="background" size="24" />
                        </div>
                        <span className="text-white font-sm">{selectedAssetData.symbol}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-sm ${selectedAssetData.canClaim ? 'text-white' : 'text-gray-300'}`}>
                          {selectedAssetData.claimableAmountFormatted} MOR
                        </span>
                        {selectedAssetData.claimableAmount > 0 && (
                          <Badge className={`h-4 min-w-4 rounded-full px-1 font-mono tabular-nums ${
                            selectedAssetData.canClaim
                              ? "bg-emerald-400 hover:bg-emerald-500 text-black border-emerald-400"
                              : "bg-yellow-600 hover:bg-yellow-700 text-white border-yellow-600"
                          }`}>
                            {selectedAssetData.canClaim ? (
                              <LockOpen className="h-3 w-3" />
                            ) : (
                              <Lock className="h-3 w-3" />
                            )}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Summary
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
                )} */}

                {/* Lock Duration Selection (for Lock Rewards) */}
                {selectedTotals.selectedAssets.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-white">MOR Claims Lock Period</Label>
                    <p className="text-xs text-gray-400">
                      Minimum 3 months required. Locking MOR claims increases your power factor for future rewards but delays claiming. Power Factor activates after 6 months, scales up to x10.7 at 6 years, and remains capped at x10.7 for longer periods
                    </p>

                    <div className="flex gap-2">
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={lockValue}
                        onChange={(e) => handleLockValueChange(e.target.value)}
                        className="flex-1 bg-background border-gray-700 text-white"
                        placeholder="3"
                        min="3"
                      />
                      <Select value={lockUnit} onValueChange={(value: TimeUnit) => handleLockUnitChange(value)}>
                        <SelectTrigger className="w-32 bg-background border-gray-700 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="months">Months</SelectItem>
                          <SelectItem value="years">Years</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Summary Section */}
                {selectedAssetData && lockValue && parseInt(lockValue, 10) > 0 && powerFactor?.currentResult && (
                  <div className="mb-6 p-4 rounded-md text-sm bg-emerald-500/20 rounded-lg mt-2 p-3 max-h-64 overflow-y-auto">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">Rewards to Lock</span>
                        <span className="text-white">{selectedAssetData.claimableAmountFormatted} MOR</span>
                      </div>
                      {unlockDate && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300">Unlock Date</span>
                          <span className="text-white">
                            {unlockDate.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">Power Factor</span>
                        <span className="text-white">
                          {(() => {
                            const displayValue = powerFactor?.currentResult?.isLoading
                              ? "Loading..."
                              : (powerFactor?.currentResult?.powerFactor ?? 'x1.0');

                            if (process.env.NODE_ENV !== 'production') {
                              console.log('🎨 [Claim Modal] Power Factor Display:', {
                                isLoading: powerFactor?.currentResult?.isLoading,
                                powerFactorValue: powerFactor?.currentResult?.powerFactor,
                                displayValue,
                                fullCurrentResult: powerFactor?.currentResult
                              });
                            }

                            return displayValue;
                          })()}
                        </span>
                      </div>

                      {/* Show power factor warning if applicable */}
                      {(() => {
                        const result = powerFactor?.currentResult;
                        return result && 'warning' in result && result.warning ? (
                          <div className="text-xs text-gray-400 mt-1">
                            * {result.warning}
                          </div>
                        ) : null;
                      })()}

                      {/* Show power factor error if applicable */}
                      {(() => {
                        const result = powerFactor?.currentResult;
                        return result && 'error' in result && result.error ? (
                          <div className="text-xs text-red-400 mt-1">
                            {result.error}
                            {!poolContractAddress && (
                              <div className="text-xs text-orange-400 mt-1">
                                * Contract address not found. Please check network configuration.
                              </div>
                            )}
                          </div>
                        ) : null;
                      })()}
                      {/* <div className="flex justify-between items-center">
                        <span className="text-gray-300">Est. Future Rewards</span>
                        <span className="text-white">
                          {estimatedRewards.estimatedRewards}
                        </span>
                      </div> */}

                      {/* Show estimation note for valid calculations */}
                      {/* {estimatedRewards.isValid && estimatedRewards.estimatedRewards !== "---" && (
                        <div className="text-xs text-gray-400 mt-1">
                          * Estimated based on current pool rate and power factor
                        </div>
                      )} */}

                      {/* Show error if calculation failed */}
                      {estimatedRewards.error && !estimatedRewards.isLoading && (
                        <div className="text-xs text-red-400 mt-1">
                          {estimatedRewards.error}
                          {estimatedRewards.error === "Failed to fetch pool data" && (
                            <div className="text-xs text-orange-400 mt-1">
                              * Unable to connect to {selectedAsset} deposit pool contract. Check network connection.
                            </div>
                          )}
                          {!poolContractAddress && (
                            <div className="text-xs text-orange-400 mt-1">
                              * {selectedAsset} deposit pool not configured for this network.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-400 text-sm">No asset selected.</p>
                <button
                  className="mt-4 copy-button-secondary px-4 py-2"
                  onClick={handleClose}
                >
                  Close
                </button>
              </div>
            )}
          </div>

          <DialogFooter className="flex-shrink-0 px-4 sm:px-0 sm:mt-4">
            {selectedAssetData && (
              <div className="w-full space-y-3">
                <button
                  className="w-full copy-button flex items-center justify-center relative"
                  onClick={handleLockRewards}
                  disabled={selectedTotals.selectedAssets.length === 0 || isProcessingChangeLock || isProcessingClaim || needsNetworkSwitch}
                >
                  {isProcessingChangeLock ? "Locking..." : "Lock MOR Rewards"}
                  <ChevronRight className="h-4 w-4 absolute right-4" />
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
            )}
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
} 