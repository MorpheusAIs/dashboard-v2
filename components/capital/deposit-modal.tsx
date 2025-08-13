"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { formatUnits, parseUnits, isAddress } from "viem";
import { useEnsAddress } from "wagmi";
import { TokenIcon } from '@web3icons/react';
import { 
  Dialog, 
  DialogPortal, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

// Import Context hook
import { useCapitalContext } from "@/context/CapitalPageContext";

// Time unit type for lock period
type TimeUnit = "days" | "months" | "years";

// Regular expression for Ethereum addresses
const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

// Helper function to convert duration to seconds
const durationToSeconds = (value: string, unit: TimeUnit): bigint => {
  const numValue = parseInt(value, 10);
  if (isNaN(numValue) || numValue <= 0) return BigInt(0);
  let multiplier: bigint;
  switch (unit) {
    case "days": multiplier = BigInt(86400); break;
    case "months": multiplier = BigInt(86400) * BigInt(30); break; // Approximation
    case "years": multiplier = BigInt(86400) * BigInt(365); break; // Approximation
    default: multiplier = BigInt(0);
  }
  return BigInt(numValue) * multiplier;
};

// Asset configuration
const assetOptions = [
  { value: "stETH", label: "stETH", symbol: "eth" },
  { value: "LINK", label: "LINK", symbol: "link" },
];

// Time lock options
const timeLockOptions = [
  { value: "days", label: "Days" },
  { value: "months", label: "Months" },
  { value: "years", label: "Years" },
];

export function DepositModal() {
  // Get state and actions from V2 context
  const {
    userAddress,
    assets,
    selectedAsset: contextSelectedAsset,
    deposit,
    approveToken,
    needsApproval: checkNeedsApproval,
    isProcessingDeposit,
    isApprovalSuccess,
    activeModal,
    setActiveModal,
    triggerMultiplierEstimation,
    estimatedMultiplierValue,
    isSimulatingMultiplier
  } = useCapitalContext();

  const isOpen = activeModal === 'deposit';

  // Form state
  const [amount, setAmount] = useState("");
  const [referrerAddress, setReferrerAddress] = useState("");
  const [lockValue, setLockValue] = useState("6");
  const [lockUnit, setLockUnit] = useState<TimeUnit>("months");
  const [formError, setFormError] = useState<string | null>(null);
  const [referrerAddressError, setReferrerAddressError] = useState<string | null>(null);
  const [assetDropdownOpen, setAssetDropdownOpen] = useState(false);
  const [timeLockDropdownOpen, setTimeLockDropdownOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<'stETH' | 'LINK'>(contextSelectedAsset);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timeLockDropdownRef = useRef<HTMLDivElement>(null);

  // Current asset data
  const currentAsset = assets[selectedAsset];
  
  const amountBigInt = useMemo(() => {
    try {
      return amount ? parseUnits(amount, 18) : BigInt(0);
    } catch { 
      return BigInt(0);
    }
  }, [amount]);

  // ENS Resolution
  const isEnsName = useMemo(() => {
    if (!referrerAddress || !referrerAddress.trim()) return false;
    const trimmedAddress = referrerAddress.trim();
    return trimmedAddress.endsWith('.eth') && !ETH_ADDRESS_REGEX.test(trimmedAddress);
  }, [referrerAddress]);

  const { data: resolvedAddress, isLoading: isResolvingEns, error: ensError, refetch: refetchEns } = useEnsAddress({
    name: isEnsName ? referrerAddress.trim() : undefined,
    chainId: 1, // Force mainnet for ENS resolution
    query: {
      enabled: isEnsName,
      retry: 2, // Retry failed requests twice
      retryDelay: 1000, // Wait 1s between retries
    }
  });

  // Debug ENS resolution
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[ENS Debug]', {
        referrerAddress: referrerAddress.trim(),
        isEnsName,
        isResolvingEns,
        resolvedAddress,
        ensError: ensError?.message,
        fullError: ensError
      });
    }
  }, [referrerAddress, isEnsName, isResolvingEns, resolvedAddress, ensError]);

  // Log wagmi config info for debugging
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && isEnsName) {
      console.log('[ENS Config Debug]', {
        userAddress,
        chainId: 'using mainnet (1) for ENS',
        ensName: referrerAddress.trim(),
        wagmiConfigured: !!resolvedAddress || !!ensError || isResolvingEns
      });
    }
  }, [isEnsName, referrerAddress, userAddress, resolvedAddress, ensError, isResolvingEns]);

  // State to track approval status
  const [currentlyNeedsApproval, setCurrentlyNeedsApproval] = useState(false);
  const [processedApprovalSuccess, setProcessedApprovalSuccess] = useState(false);
  
  // Check approval status
  const checkApprovalStatus = useCallback(async () => {
    if (amount && parseFloat(amount) > 0 && userAddress) {
      const needsApproval = checkNeedsApproval(selectedAsset, amount);
      setCurrentlyNeedsApproval(needsApproval);
    } else {
      setCurrentlyNeedsApproval(false);
    }
  }, [amount, userAddress, selectedAsset, checkNeedsApproval]);

  // Check approval status when dependencies change
  useEffect(() => {
    checkApprovalStatus();
    setProcessedApprovalSuccess(false);
  }, [checkApprovalStatus]);

  // Handle approval success
  useEffect(() => {
    if (isApprovalSuccess && amount && parseFloat(amount) > 0 && !processedApprovalSuccess) {
      setProcessedApprovalSuccess(true);
      setTimeout(() => {
        checkApprovalStatus();
      }, 1000);
    }
  }, [isApprovalSuccess, amount, processedApprovalSuccess, checkApprovalStatus]);

  // Trigger multiplier estimation when lock period changes
  useEffect(() => {
    if (lockValue && parseInt(lockValue, 10) > 0) {
      triggerMultiplierEstimation(lockValue, lockUnit);
    }
  }, [lockValue, lockUnit, triggerMultiplierEstimation]);

  // Referrer address validation function
  const validateReferrerAddress = useCallback((address: string) => {
    if (!address || address.trim() === "") {
      setReferrerAddressError(null);
      return true;
    }

    const trimmedAddress = address.trim();
    
    // Check if it's an ENS name
    if (trimmedAddress.endsWith('.eth')) {
      // For ENS names, we'll wait for resolution
      if (isResolvingEns) {
        setReferrerAddressError("Resolving ENS name...");
        return false;
      }
      
      // Check if there was an ENS resolution error
      if (ensError) {
        const errorMessage = ensError.message || 'Unknown ENS error';
        setReferrerAddressError(`ENS resolution failed: ${errorMessage}`);
        console.error('[ENS Error]', ensError);
        return false;
      }
      
      // If we've finished loading but have no resolved address and no error, 
      // it might be a network issue or the name doesn't exist
      if (isEnsName && !resolvedAddress && !isResolvingEns) {
        setReferrerAddressError("ENS name could not be resolved. Please check the name or try again.");
        return false;
      }
      
      // ENS resolved successfully
      if (resolvedAddress) {
        setReferrerAddressError(null);
        return true;
      }
      
      // Still loading or no result yet - don't show error yet
      setReferrerAddressError(null);
      return !isResolvingEns; // Only validate if not loading
    }
    
    // Check if it matches basic Ethereum address format
    if (!ETH_ADDRESS_REGEX.test(trimmedAddress)) {
      setReferrerAddressError("Invalid Ethereum address format");
      return false;
    }

    // Additional validation using viem's isAddress for checksum validation
    if (!isAddress(trimmedAddress)) {
      setReferrerAddressError("Invalid Ethereum address checksum");
      return false;
    }

    setReferrerAddressError(null);
    return true;
  }, [isEnsName, isResolvingEns, resolvedAddress, ensError]);

  // Auto-validate when ENS resolution changes
  useEffect(() => {
    if (referrerAddress) {
      validateReferrerAddress(referrerAddress);
    }
  }, [referrerAddress, resolvedAddress, isResolvingEns, validateReferrerAddress]);

  // Calculate unlock date
  const unlockDate = useMemo(() => {
    if (!lockValue || parseInt(lockValue, 10) <= 0) return null;
    
    const now = new Date();
    const lockDuration = parseInt(lockValue, 10);
    
    const calculatedUnlockDate = new Date(now);
    switch (lockUnit) {
      case "days":
        calculatedUnlockDate.setDate(now.getDate() + lockDuration);
        break;
      case "months":
        calculatedUnlockDate.setMonth(now.getMonth() + lockDuration);
        break;
      case "years":
        calculatedUnlockDate.setFullYear(now.getFullYear() + lockDuration);
        break;
    }
    
    return calculatedUnlockDate;
  }, [lockValue, lockUnit]);

  // Validation
  const validationError = useMemo(() => {
    if (amountBigInt <= BigInt(0)) return null;
    
    // TODO: Add minimal stake validation once PoolLimitsData interface is updated
    // const minimalStake = currentAsset?.protocolDetails?.minimalStake;
    // if (minimalStake && amountBigInt < minimalStake) {
    //   return `Minimum deposit is ${formatUnits(minimalStake, 18)} ${selectedAsset}`;
    // }
    
    if (currentAsset?.userBalance && amountBigInt > currentAsset.userBalance) {
      return `Insufficient ${selectedAsset} balance`;
    }
    
    return null;
  }, [amountBigInt, currentAsset, selectedAsset]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    
    if (validationError) {
      setFormError(validationError);
      return;
    }

    // Validate referrer address before submission
    if (!validateReferrerAddress(referrerAddress)) {
      return;
    }

    try {
      if (currentlyNeedsApproval) {
        await approveToken(selectedAsset);
      } else {
        // Calculate lock duration in seconds
        const lockDuration = durationToSeconds(lockValue, lockUnit);
        
        // Use resolved address if available, otherwise use the original input
        const finalReferrerAddress = resolvedAddress || (referrerAddress.trim() || undefined);
        
        // TODO: Update your deposit function to accept the referrer address parameter
        // For now, we'll just log it and use the existing deposit call
        if (finalReferrerAddress) {
          console.log("Referrer address for deposit:", finalReferrerAddress);
        }
        
        await deposit(selectedAsset, amount, lockDuration);
      }
    } catch (error) {
      console.error("Deposit/Approve Action Error:", error);
      setFormError((error as Error)?.message || "An unexpected error occurred.");
    }
  };

  const handleMaxAmount = () => {
    if (currentAsset?.userBalance) {
      const maxAmount = formatUnits(currentAsset.userBalance, 18);
      setAmount(maxAmount);
    }
  };



  // Check if we should show warning/validation
  const showWarning = useMemo(() => {
    if (!amount || amount.trim() === "") return true;
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return true;
    return !!validationError || !!formError || !!referrerAddressError || currentlyNeedsApproval;
  }, [amount, validationError, formError, referrerAddressError, currentlyNeedsApproval]);

  // Click outside handler for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setAssetDropdownOpen(false);
      }
      if (timeLockDropdownRef.current && !timeLockDropdownRef.current.contains(event.target as Node)) {
        setTimeLockDropdownOpen(false);
      }
    };

    if (assetDropdownOpen || timeLockDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [assetDropdownOpen, timeLockDropdownOpen]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setAmount("");
      setReferrerAddress("");
      setLockValue("6");
      setLockUnit("months");
      setFormError(null);
      setReferrerAddressError(null);
      setCurrentlyNeedsApproval(false);
      setProcessedApprovalSuccess(false);
      setAssetDropdownOpen(false);
      setTimeLockDropdownOpen(false);
      setSelectedAsset(contextSelectedAsset);
    }
  }, [isOpen, contextSelectedAsset]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && setActiveModal(null)}>
      <DialogPortal>
        <DialogContent className="sm:max-w-[425px] bg-background border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-emerald-400">Stake Capital</DialogTitle>
            <DialogDescription className="text-gray-400">
              Stake an asset to start earning MOR rewards.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            {/* Asset Selection */}
            <div className="space-y-2 relative">
              <Label className="text-sm font-medium text-white">Select Asset</Label>
              <div className="relative" ref={dropdownRef}>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between bg-background border-gray-700 hover:bg-gray-800"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setAssetDropdownOpen(!assetDropdownOpen);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8">
                      <TokenIcon symbol={selectedAsset === 'stETH' ? 'eth' : 'link'} variant="background" size="26" />
                    </div>
                    <span>{selectedAsset}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm">
                      {Number(assets[selectedAsset]?.userBalanceFormatted || '0').toFixed(2)} Available
                    </span>
                    <ChevronDown className={`h-4 w-4 opacity-50 transition-transform ${assetDropdownOpen ? 'rotate-180' : ''}`} />
                  </div>
                </Button>
                
                {assetDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-gray-700 rounded-md shadow-lg overflow-hidden z-[10000]">
                    {assetOptions.map((asset) => (
                      <button
                        key={asset.value}
                        type="button"
                        className="w-full p-3 text-left hover:bg-gray-800 flex items-center gap-3 justify-between transition-colors"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedAsset(asset.value as 'stETH' | 'LINK');
                          setAssetDropdownOpen(false);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6">
                            <TokenIcon symbol={asset.symbol} variant="background" size="24" />
                          </div>
                          <span className="text-white">{asset.label}</span>
                        </div>
                                                  <span className="text-gray-400 text-sm">
                            {Number(assets[asset.value as 'stETH' | 'LINK']?.userBalanceFormatted || '0').toFixed(2)} Available
                          </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Stake Amount */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-white">Stake Amount</Label>
              <div className="relative">
                <Input
                  placeholder="0.0"
                  value={amount}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^\d*\.?\d*$/.test(value)) {
                      setAmount(value);
                      setFormError(null);
                    }
                  }}
                  className={`bg-background border-gray-700 pr-32 ${
                    (validationError || formError) ? 'border-red-500' : showWarning ? 'border-yellow-500' : ''
                  }`}
                  disabled={isProcessingDeposit}
                  onKeyDown={(e) => {
                    if (['e', 'E', '-', '+'].includes(e.key)) {
                      e.preventDefault();
                    }
                  }}
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                  {currentAsset?.userBalanceFormatted && (
                    <span className="text-xs text-gray-400 mr-2">
                      {currentAsset.userBalanceFormatted} {selectedAsset}
                    </span>
                  )}
                  <button
                    type="button"
                    className="h-8 px-2 text-xs copy-button-secondary"
                    onClick={handleMaxAmount}
                    disabled={!currentAsset?.userBalance || isProcessingDeposit}
                  >
                    Max
                  </button>
                </div>
              </div>
            </div>

            {/* Referrer Address */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-white">Referrer Address</Label>
                <span className="text-xs text-gray-400">Optional</span>
              </div>
              <Input
                placeholder="0x1234...abcd or davidjohnston.eth"
                value={referrerAddress}
                onChange={(e) => {
                  const value = e.target.value;
                  setReferrerAddress(value);
                  validateReferrerAddress(value);
                }}
                onBlur={() => validateReferrerAddress(referrerAddress)}
                className={`bg-background border-gray-700 ${
                  referrerAddressError && !referrerAddressError.includes('Resolving') ? 'border-red-500' : 
                  isResolvingEns ? 'border-yellow-500' :
                  resolvedAddress ? 'border-green-500' : ''
                }`}
                disabled={isProcessingDeposit}
              />
              
              {/* Show resolved address */}
              {resolvedAddress && isEnsName && (
                <div className="flex items-center gap-2 text-xs text-green-400">
                  <span>Address:</span>
                  <code className="bg-green-500/10 px-2 py-1 rounded border border-green-500/20">
                    {resolvedAddress}
                  </code>
                </div>
              )}
              
              {/* Show loading state */}
              {isResolvingEns && (
                <div className="flex items-center gap-2 text-xs text-yellow-400">
                  <span>🔄 Resolving ENS name...</span>
                </div>
              )}
              
              {/* Show ENS error details */}
              {ensError && !isResolvingEns && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-red-500 text-sm">
                      ENS resolution failed: {ensError.message}
                    </p>
                    <button
                      type="button"
                      onClick={() => refetchEns()}
                      className="text-xs text-blue-400 hover:text-blue-300 underline"
                      disabled={isProcessingDeposit}
                    >
                      Retry
                    </button>
                  </div>
                  {process.env.NODE_ENV !== 'production' && (
                    <details className="text-xs text-gray-400">
                      <summary className="cursor-pointer">Debug Info</summary>
                      <pre className="mt-1 p-2 bg-gray-800 rounded text-xs overflow-auto">
                        {JSON.stringify({
                          name: referrerAddress.trim(),
                          isEnsName,
                          resolvedAddress,
                          error: ensError.name,
                          message: ensError.message,
                          cause: ensError.cause
                        }, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}
              
              {referrerAddressError && !isResolvingEns && !ensError && (
                <p className="text-red-500 text-sm mt-1">
                  {referrerAddressError}
                </p>
              )}
            </div>

            {/* Time Lock Period */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-white">Time Lock Period</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="6"
                  value={lockValue}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^\d+$/.test(value)) {
                      setLockValue(value);
                    }
                  }}
                  className="bg-background border-gray-700 flex-1"
                  disabled={isProcessingDeposit}
                />
                <div className="relative w-32" ref={timeLockDropdownRef}>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between bg-background border-gray-700 hover:bg-gray-800"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setTimeLockDropdownOpen(!timeLockDropdownOpen);
                    }}
                  >
                    {lockUnit.charAt(0).toUpperCase() + lockUnit.slice(1)}
                    <ChevronDown className={`h-4 w-4 opacity-50 transition-transform ${timeLockDropdownOpen ? 'rotate-180' : ''}`} />
                  </Button>
                  
                  {timeLockDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-gray-700 rounded-md shadow-lg overflow-hidden z-[10000]">
                      {timeLockOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className="w-full p-3 text-left hover:bg-gray-800 transition-colors text-white"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setLockUnit(option.value as TimeUnit);
                            setTimeLockDropdownOpen(false);
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Summary Section */}
            {amount && parseFloat(amount) > 0 && lockValue && parseInt(lockValue, 10) > 0 && (
              <div className="p-1 rounded-md text-sm bg-emerald-500/10 rounded-lg p-2">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Stake Amount</span>
                    <span className="text-white">{amount} {selectedAsset}</span>
                  </div>
                  {unlockDate && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Unlock Date</span>
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
                    <span className="text-gray-400">Power Factor</span>
                    <span className="text-white">
                      {isSimulatingMultiplier ? "Loading..." : (estimatedMultiplierValue || "1.0x")}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Est. Rewards Earned</span>
                    <span className="text-white">
                      {/* TODO: Calculate estimated rewards based on current rates */}
                      --- MOR
                    </span>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveModal(null)}
                disabled={isProcessingDeposit}
              >
                Cancel
              </Button>
              <button
                type="submit"
                className={
                  isProcessingDeposit || !!validationError || !!referrerAddressError || amountBigInt <= BigInt(0) || !userAddress ||
                  !lockValue || parseInt(lockValue, 10) <= 0
                    ? "copy-button-secondary px-2 text-sm opacity-50 cursor-not-allowed" 
                    : currentlyNeedsApproval
                    ? "copy-button-secondary px-2 text-sm" 
                    : "copy-button-base"
                }
                disabled={
                  isProcessingDeposit || 
                  !!validationError || 
                  !!referrerAddressError ||
                  amountBigInt <= BigInt(0) || 
                  !userAddress ||
                  !lockValue ||
                  parseInt(lockValue, 10) <= 0
                }
              >
                {isProcessingDeposit ? (
                  <div className="flex flex-row align-middle items-center gap-2">
                    {/* <Spinner className="text-emerald-500" size="sm"/> */}
                    <svg className="text-emerald-400 animate-spin ..." viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"
                      width="16" height="16">
                      <path
                        d="M32 3C35.8083 3 39.5794 3.75011 43.0978 5.20749C46.6163 6.66488 49.8132 8.80101 52.5061 11.4939C55.199 14.1868 57.3351 17.3837 58.7925 20.9022C60.2499 24.4206 61 28.1917 61 32C61 35.8083 60.2499 39.5794 58.7925 43.0978C57.3351 46.6163 55.199 49.8132 52.5061 52.5061C49.8132 55.199 46.6163 57.3351 43.0978 58.7925C39.5794 60.2499 35.8083 61 32 61C28.1917 61 24.4206 60.2499 20.9022 58.7925C17.3837 57.3351 14.1868 55.199 11.4939 52.5061C8.801 49.8132 6.66487 46.6163 5.20749 43.0978C3.7501 39.5794 3 35.8083 3 32C3 28.1917 3.75011 24.4206 5.2075 20.9022C6.66489 17.3837 8.80101 14.1868 11.4939 11.4939C14.1868 8.80099 17.3838 6.66487 20.9022 5.20749C24.4206 3.7501 28.1917 3 32 3L32 3Z"
                        stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"></path>
                      <path
                        d="M32 3C36.5778 3 41.0906 4.08374 45.1692 6.16256C49.2477 8.24138 52.7762 11.2562 55.466 14.9605C58.1558 18.6647 59.9304 22.9531 60.6448 27.4748C61.3591 31.9965 60.9928 36.6232 59.5759 40.9762"
                        stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" className="text-gray-900">
                      </path>
                    </svg>
                    Processing...
                  </div>
                ) : (
                  currentlyNeedsApproval ? `Approve ${selectedAsset}` : "Confirm Deposit"
                )}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
} 