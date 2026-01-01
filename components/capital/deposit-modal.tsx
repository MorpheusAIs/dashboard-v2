"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { formatUnits, parseUnits, isAddress } from "viem";
import { useEnsAddress, useBalance } from "wagmi";
import { mainnet } from "wagmi/chains";
import { AssetIcon } from "@/components/icons";
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

// Import Context and Hooks
import { useCapitalContext, type AssetSymbol } from "@/context/CapitalPageContext";
import { useNetwork } from "@/context/network-context";
import { usePowerFactor } from "@/hooks/use-power-factor";
// import { useEstimatedRewards } from "@/hooks/use-estimated-rewards";

// Import Config and Utils
import { getContractAddress, type NetworkEnvironment } from "@/config/networks";
import {
  getMaxAllowedValue,
  getMinAllowedValue,
  durationToSeconds,
  type TimeUnit
} from "@/lib/utils/power-factor-utils";

// Import Constants
import {
  ETH_ADDRESS_REGEX
} from "./constants/deposit-modal-constants";

// Import dynamic asset configuration
import {
  getAssetsForNetwork,
  type AssetContractInfo
} from "./constants/asset-config";
import { TimeLockPeriodSelector } from "./time-lock-period-selector";

export function DepositModal() {
  // Network switching hook
  const { currentChainId, switchToChain, isNetworkSwitching } = useNetwork();

  // Get state and actions from V2 context
  const {
    userAddress,
    assets,
    selectedAsset: contextSelectedAsset,
    deposit,
    approveToken,
    checkAndUpdateApprovalNeeded,
    isProcessingDeposit,
    isApprovalSuccess,
    activeModal,
    setActiveModal,
    preReferrerAddress,
    setPreReferrerAddress,
    // Dynamic assets system provides all unlock timestamps
    // Get contract details for power factor hook
    l1ChainId,
  } = useCapitalContext();

  // Calculate network environment and contract address
  const networkEnv = useMemo((): NetworkEnvironment => {
    return [1, 42161, 8453].includes(l1ChainId || 0) ? 'mainnet' : 'testnet';
  }, [l1ChainId]);

  const poolContractAddress = useMemo(() => {
    return l1ChainId ? getContractAddress(l1ChainId, 'distributorV2', networkEnv) as `0x${string}` | undefined : undefined;
  }, [l1ChainId, networkEnv]);

  // Get available assets for current network environment
  const availableAssets = useMemo((): AssetContractInfo[] => {
    return getAssetsForNetwork(networkEnv);
  }, [networkEnv]);

  // Create asset options for dropdown (only include assets with deposit pools)
  const assetOptions = useMemo(() => {
    // Mapping from asset symbols to their deposit pool contract keys (same as use-capital-pool-data.ts)
    const depositPoolMapping: Partial<Record<AssetSymbol, keyof import('@/config/networks').ContractAddresses>> = {
      stETH: 'stETHDepositPool',
      LINK: 'linkDepositPool', 
      USDC: 'usdcDepositPool',
      USDT: 'usdtDepositPool',
      wBTC: 'wbtcDepositPool',
      wETH: 'wethDepositPool',
    };
    
    const l1ChainId = networkEnv === 'mainnet' ? 1 : 11155111; // mainnet : sepolia
    
    return availableAssets
      .filter(asset => {
        // Only include assets that have deposit pools deployed
        const contractKey = depositPoolMapping[asset.metadata.symbol];
        const hasDepositPool = contractKey && getContractAddress(l1ChainId, contractKey, networkEnv);
        return hasDepositPool && !asset.metadata.disabled;
      })
      .map(asset => ({
        value: asset.metadata.symbol,
        label: asset.metadata.symbol,
        name: asset.metadata.name,
        symbol: asset.metadata.icon, // For TokenIcon component
      }));
  }, [availableAssets, networkEnv]);

  const isOpen = activeModal === 'deposit';

  // Check if user is on Ethereum mainnet
  const isOnMainnet = currentChainId === mainnet.id;

  // Individual balance hooks for assets that might not be in the context assets object
  // This ensures we can validate balances for all assets even if deposit pools aren't deployed
  const individualBalances = useMemo(() => {
    const balanceHooks: Record<string, { address: `0x${string}`; decimals: number }> = {};
    
    availableAssets.forEach(asset => {
      const symbol = asset.metadata.symbol;
      // Only create balance hooks for assets not already in the assets object
      // or if we need them for validation
      balanceHooks[symbol] = {
        address: asset.address,
        decimals: asset.metadata.decimals
      };
    });
    
    console.log('🔧 Individual balances setup:', {
      networkEnv,
      l1ChainId,
      userAddress,
      availableAssets: availableAssets.map(a => ({ symbol: a.metadata.symbol, address: a.address, decimals: a.metadata.decimals })),
      balanceHooks
    });
    
    return balanceHooks;
  }, [availableAssets, networkEnv, l1ChainId, userAddress]);

  // Balance hooks for each asset to ensure we can validate all assets
  const stETHBalance = useBalance({
    address: userAddress,
    token: individualBalances.stETH?.address,
    chainId: l1ChainId,
    query: { enabled: !!userAddress && !!individualBalances.stETH?.address }
  });

  const linkBalance = useBalance({
    address: userAddress,
    token: individualBalances.LINK?.address,
    chainId: l1ChainId,
    query: { enabled: !!userAddress && !!individualBalances.LINK?.address }
  });

  const usdcBalance = useBalance({
    address: userAddress,
    token: individualBalances.USDC?.address,
    chainId: l1ChainId,
    query: { enabled: !!userAddress && !!individualBalances.USDC?.address }
  });

  const usdtBalance = useBalance({
    address: userAddress,
    token: individualBalances.USDT?.address,
    chainId: l1ChainId,
    query: { enabled: !!userAddress && !!individualBalances.USDT?.address }
  });

  const wbtcBalance = useBalance({
    address: userAddress,
    token: individualBalances.wBTC?.address,
    chainId: l1ChainId,
    query: { enabled: !!userAddress && !!individualBalances.wBTC?.address }
  });

  const wethBalance = useBalance({
    address: userAddress,
    token: individualBalances.wETH?.address,
    chainId: l1ChainId,
    query: { enabled: !!userAddress && !!individualBalances.wETH?.address }
  });
  
  // Debug logging for balance hooks - show ALL assets
  console.log('⚖️ Balance hooks status:', {
    userAddress,
    l1ChainId,
    stETH: {
      token: individualBalances.stETH?.address,
      enabled: !!userAddress && !!individualBalances.stETH?.address,
      data: stETHBalance.data ? {
        value: stETHBalance.data.value.toString(),
        formatted: stETHBalance.data.formatted
      } : null,
      isLoading: stETHBalance.isLoading,
      error: stETHBalance.error?.message
    },
    LINK: {
      token: individualBalances.LINK?.address,
      enabled: !!userAddress && !!individualBalances.LINK?.address,
      data: linkBalance.data ? {
        value: linkBalance.data.value.toString(),
        formatted: linkBalance.data.formatted
      } : null,
      isLoading: linkBalance.isLoading,
      error: linkBalance.error?.message
    },
    USDC: {
      token: individualBalances.USDC?.address,
      enabled: !!userAddress && !!individualBalances.USDC?.address,
      data: usdcBalance.data ? {
        value: usdcBalance.data.value.toString(),
        formatted: usdcBalance.data.formatted
      } : null,
      isLoading: usdcBalance.isLoading,
      error: usdcBalance.error?.message
    },
    USDT: {
      token: individualBalances.USDT?.address,
      enabled: !!userAddress && !!individualBalances.USDT?.address,
      data: usdtBalance.data ? {
        value: usdtBalance.data.value.toString(),
        formatted: usdtBalance.data.formatted
      } : null,
      isLoading: usdtBalance.isLoading,
      error: usdtBalance.error?.message
    },
    wBTC: {
      token: individualBalances.wBTC?.address,
      enabled: !!userAddress && !!individualBalances.wBTC?.address,
      data: wbtcBalance.data ? {
        value: wbtcBalance.data.value.toString(),
        formatted: wbtcBalance.data.formatted
      } : null,
      isLoading: wbtcBalance.isLoading,
      error: wbtcBalance.error?.message
    },
    wETH: {
      token: individualBalances.wETH?.address,
      enabled: !!userAddress && !!individualBalances.wETH?.address,
      data: wethBalance.data ? {
        value: wethBalance.data.value.toString(),
        formatted: wethBalance.data.formatted
      } : null,
      isLoading: wethBalance.isLoading,
      error: wethBalance.error?.message
    }
  });

  // Create a lookup for individual balances
  const assetBalances = useMemo(() => ({
    stETH: stETHBalance,
    LINK: linkBalance,
    USDC: usdcBalance,
    USDT: usdtBalance,
    wBTC: wbtcBalance,
    wETH: wethBalance,
  }), [stETHBalance, linkBalance, usdcBalance, usdtBalance, wbtcBalance, wethBalance]);

  // Form state
  const [amount, setAmount] = useState("");
  const [rawAmount, setRawAmount] = useState(""); // Store raw amount for transactions
  const [referrerAddress, setReferrerAddress] = useState("");
  const [lockValue, setLockValue] = useState("7");
  const [lockUnit, setLockUnit] = useState<TimeUnit>("days");
  const [formError, setFormError] = useState<string | null>(null);
  const [referrerAddressError, setReferrerAddressError] = useState<string | null>(null);
  const [assetDropdownOpen, setAssetDropdownOpen] = useState(false);
  const [timeLockDropdownOpen, setTimeLockDropdownOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetSymbol>(contextSelectedAsset);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timeLockDropdownRef = useRef<HTMLDivElement>(null);

  // Initialize power factor hook (after state declarations)
  const powerFactor = usePowerFactor({
    contractAddress: poolContractAddress,
    chainId: l1ChainId,
    enabled: true,
  });

  // Get the deposit pool address for the selected asset (V7 protocol requirement)
  // const selectedAssetDepositPoolAddress = useMemo(() => {
  //   const depositPoolMapping: Partial<Record<AssetSymbol, keyof import('@/config/networks').ContractAddresses>> = {
  //     stETH: 'stETHDepositPool',
  //     LINK: 'linkDepositPool', 
  //     USDC: 'usdcDepositPool',
  //     USDT: 'usdtDepositPool',
  //     wBTC: 'wbtcDepositPool',
  //     wETH: 'wethDepositPool',
  //   };
    
  //   const contractKey = depositPoolMapping[selectedAsset];
  //   if (!contractKey || !l1ChainId) return undefined;
    
  //   return getContractAddress(l1ChainId, contractKey, networkEnv) as `0x${string}` | undefined;
  // }, [selectedAsset, l1ChainId, networkEnv]);

  // Initialize estimated rewards hook (after state declarations)
  // const estimatedRewards = useEstimatedRewards({
  //   contractAddress: poolContractAddress,
  //   chainId: l1ChainId,
  //   poolId: BigInt(0),
  //   depositPoolAddress: selectedAssetDepositPoolAddress, // V7: Pass asset-specific deposit pool address
  //   networkEnv, // V7: Required for RewardPoolV2 contract lookup
  //   depositAmount: amount,
  //   powerFactorString: powerFactor.currentResult.powerFactor,
  //   lockValue,
  //   lockUnit: lockUnit as "days" | "months" | "years",
  //   tokenDecimals: availableAssets.find(asset => asset.metadata.symbol === selectedAsset)?.metadata.decimals || 18, // 🚨 FIX: Use correct decimals for each token
  //   enabled: !!amount && parseFloat(amount) > 0 && powerFactor.currentResult.isValid,
  // });


  // Debug hook initialization
  // useEffect(() => {
  //   if (process.env.NODE_ENV !== 'production') {
  //     console.log('Power Factor Hook:', {
  //       contractAddress: poolContractAddress,
  //       chainId: l1ChainId,
  //       poolId: 0,
  //       enabled: true
  //     });
  //     console.log('Estimated Rewards Hook:', {
  //       contractAddress: poolContractAddress,
  //       chainId: l1ChainId,
  //       depositAmount: amount,
  //       powerFactor: powerFactor.currentResult.powerFactor,
  //       lockPeriod: { lockValue, lockUnit },
  //       enabled: !!amount && parseFloat(amount) > 0 && powerFactor.currentResult.isValid
  //     });
  //     console.groupEnd();
  //   }
  // }, [powerFactor, estimatedRewards, poolContractAddress, l1ChainId, amount, lockValue, lockUnit]);

  // Update power factor calculation when lock period changes
  useEffect(() => {
    // if (process.env.NODE_ENV !== 'production') {
    //   console.group('🎛️ [Deposit Modal Debug] Lock Period Change');
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

  // Note: We no longer use currentAsset directly, instead using currentAssetBalance for validation
  
  // Get user balance for validation - prioritize context assets, fallback to individual balance hooks
  const getUserBalanceForAsset = useCallback((asset: AssetSymbol) => {
    // Debug logging to see what's happening with each asset
    console.log(`🔍 Getting balance for ${asset}:`, {
      contextAsset: assets[asset] ? {
        balance: assets[asset].userBalance?.toString(),
        formatted: assets[asset].userBalanceFormatted
      } : null,
      individualBalance: assetBalances[asset] ? {
        data: assetBalances[asset].data ? {
          value: assetBalances[asset].data.value?.toString(),
          decimals: assetBalances[asset].data.decimals,
          formatted: assetBalances[asset].data.formatted
        } : null,
        isLoading: assetBalances[asset].isLoading,
        error: assetBalances[asset].error?.message
      } : null
    });
    
    // First try to get balance from context assets (preferred as it has formatted values)
    if (assets[asset]?.userBalance !== undefined) {
      return {
        balance: assets[asset].userBalance,
        formatted: assets[asset].userBalanceFormatted
      };
    }
    
    // Fallback to individual balance hooks for assets not in context
    const individualBalance = assetBalances[asset];
    if (individualBalance?.data) {
      return {
        balance: individualBalance.data.value,
        formatted: formatUnits(individualBalance.data.value, individualBalance.data.decimals)
      };
    }
    
    return { balance: BigInt(0), formatted: '0' };
  }, [assets, assetBalances]);
  
  const currentAssetBalance = getUserBalanceForAsset(selectedAsset);
  
  // Helper function to format balance with asset-specific decimal rules
  const formatBalanceDisplay = useCallback((numStr: string, assetSymbol: AssetSymbol): string => {
    // Handle invalid/empty input
    if (!numStr || numStr === 'undefined' || numStr === 'null') {
      return '0.00';
    }
    
    const num = Number(numStr);
    // Handle NaN or invalid numbers
    if (isNaN(num) || num === 0) return '0.00';

    // Convert to string and find decimal point
    const str = num.toString();
    const decimalIndex = str.indexOf('.');

    // Asset-specific formatting rules
    let targetDecimals: number;
    if (assetSymbol === 'wETH' || assetSymbol === 'stETH') {
      // wETH and stETH: 3 decimals if below 1, otherwise 2
      targetDecimals = num < 1 ? 3 : 2;
    } else if (assetSymbol === 'wBTC') {
      // wBTC: 4 decimals if below 1, otherwise 2
      targetDecimals = num < 1 ? 4 : 2;
    } else {
      // USDC, USDT and others: 2 decimals
      targetDecimals = 2;
    }

    if (decimalIndex === -1) {
      // No decimal point, add appropriate zeros
      return str + '.' + '0'.repeat(targetDecimals);
    } else if (str.length - decimalIndex - 1 <= targetDecimals) {
      // Already has target or fewer decimal places, pad if needed
      const currentDecimals = str.length - decimalIndex - 1;
      return str + '0'.repeat(targetDecimals - currentDecimals);
    } else {
      // Truncate to target decimal places (don't round)
      return str.slice(0, decimalIndex + targetDecimals + 1);
    }
  }, []);

  // Helper function to truncate (not round) to 2 decimal places for display (legacy function for backward compatibility)
  // const truncateToTwoDecimals = useCallback((numStr: string): string => {
  //   const num = Number(numStr);
  //   if (num === 0) return '0.00';

  //   // Convert to string and find decimal point
  //   const str = num.toString();
  //   const decimalIndex = str.indexOf('.');

  //   if (decimalIndex === -1) {
  //     // No decimal point, add .00
  //     return str + '.00';
  //   } else if (str.length - decimalIndex - 1 <= 2) {
  //     // Already has 2 or fewer decimal places, pad if needed
  //     const decimals = str.length - decimalIndex - 1;
  //     return decimals === 1 ? str + '0' : str;
  //   } else {
  //     // Truncate to 2 decimal places (don't round)
  //     return str.slice(0, decimalIndex + 3);
  //   }
  // }, []);
  
  const amountBigInt = useMemo(() => {
    try {
      // Use rawAmount for calculations when available (from Max button), fallback to amount (from manual input)
      const amountForCalculation = rawAmount || amount;
      if (!amountForCalculation) return BigInt(0);
      
      // Get the correct decimals for the selected asset
      const assetInfo = availableAssets.find(asset => asset.metadata.symbol === selectedAsset);
      const decimals = assetInfo?.metadata.decimals || 18;
      
      // Log amount processing for debugging
      console.debug(`🔍 [${selectedAsset}] Amount Processing:`, {
        selectedAsset,
        displayAmount: amount,
        rawAmount: rawAmount,
        usingForCalculation: amountForCalculation,
        decimals,
        numberValue: Number(amountForCalculation),
        expectedGasFee: 'NORMAL ($2-5)'
      });

      const result = parseUnits(amountForCalculation, decimals);

      console.debug(`🔍 [${selectedAsset}] parseUnits Result:`, {
        selectedAsset,
        input: amountForCalculation,
        decimals,
        result: result.toString(),
        resultHex: '0x' + result.toString(16)
      });

      return result;
    } catch (error) { 
      console.error('🐛 [DEPOSIT DEBUG] parseUnits error:', {
        selectedAsset,
        amount,
        rawAmount,
        error: error instanceof Error ? error.message : String(error)
      });
      return BigInt(0);
    }
  }, [amount, rawAmount, selectedAsset, availableAssets]);

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

  // State to track approval status
  const [currentlyNeedsApproval, setCurrentlyNeedsApproval] = useState(false);
  const [processedApprovalSuccess, setProcessedApprovalSuccess] = useState(false);
  
  // Check approval status
  const checkApprovalStatus = useCallback(async () => {
    if (amount && parseFloat(amount) > 0 && userAddress) {
      // Use checkAndUpdateApprovalNeeded to get fresh data from blockchain
      const needsApproval = await checkAndUpdateApprovalNeeded(selectedAsset, rawAmount || amount);
      setCurrentlyNeedsApproval(needsApproval);
    } else {
      setCurrentlyNeedsApproval(false);
    }
  }, [amount, rawAmount, userAddress, selectedAsset, checkAndUpdateApprovalNeeded]);

  // Check approval status when dependencies change
  useEffect(() => {
    checkApprovalStatus();
    setProcessedApprovalSuccess(false);
  }, [checkApprovalStatus]);

  // Handle approval success with improved timing and retry logic
  useEffect(() => {
    if (isApprovalSuccess && amount && parseFloat(amount) > 0 && !processedApprovalSuccess) {
      setProcessedApprovalSuccess(true);
      
      // Add debugging for LINK approval issues
      if (process.env.NODE_ENV !== 'production') {
        console.log('🎯 [Deposit Modal] Approval success detected:', {
          selectedAsset,
          amount,
          isApprovalSuccess,
          l1ChainId
        });
      }
      
      // Check approval status with progressive delays for better reliability
      const checkWithRetry = async (attempt = 1, maxAttempts = 4) => {
        try {
          if (process.env.NODE_ENV !== 'production') {
            console.log(`🔍 [Deposit Modal] Checking approval status (attempt ${attempt}/${maxAttempts}) for ${selectedAsset}`);
          }
          
          const needsApproval = await checkAndUpdateApprovalNeeded(selectedAsset, rawAmount || amount);
          
          if (process.env.NODE_ENV !== 'production') {
            console.log(`🔍 [Deposit Modal] Approval check result (attempt ${attempt}):`, {
              selectedAsset,
              amount,
              needsApproval,
              currentlyNeedsApproval
            });
          }
          
          if (!needsApproval) {
            // Approval detected successfully
            setCurrentlyNeedsApproval(false);
            if (process.env.NODE_ENV !== 'production') {
              console.log('✅ [Deposit Modal] Approval confirmed, button should change to "Confirm Deposit"');
            }
            return;
          }
          
          // If approval still needed and we have attempts left, retry with exponential backoff
          if (attempt < maxAttempts) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // 1s, 2s, 4s, max 5s
            if (process.env.NODE_ENV !== 'production') {
              console.log(`⏳ [Deposit Modal] Approval not detected yet, retrying in ${delay}ms...`);
            }
            setTimeout(() => checkWithRetry(attempt + 1, maxAttempts), delay);
          } else {
            // Final attempt failed, log the issue
            if (process.env.NODE_ENV !== 'production') {
              console.warn('❌ [Deposit Modal] Approval status check failed after all attempts:', {
                selectedAsset,
                amount,
                finalNeedsApproval: needsApproval
              });
            }
          }
        } catch (error) {
          console.error(`[Deposit Modal] Error checking approval status (attempt ${attempt}):`, error);
          if (attempt < maxAttempts) {
            setTimeout(() => checkWithRetry(attempt + 1, maxAttempts), 2000);
          }
        }
      };
      
      // Start the retry sequence
      checkWithRetry();
    }
  }, [isApprovalSuccess, amount, rawAmount, processedApprovalSuccess, checkApprovalStatus, selectedAsset, checkAndUpdateApprovalNeeded, currentlyNeedsApproval, l1ChainId]);

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


  // Handle lock value changes - allow all valid numeric input
  const handleLockValueChange = useCallback((value: string) => {
    if (value === '' || /^\d+$/.test(value)) {
      setLockValue(value);
    }
  }, []);

  // Handle lock unit changes
  const handleLockUnitChange = useCallback((unit: TimeUnit) => {
    setLockUnit(unit);
  }, []);

  // Calculate unlock date using utility function
  const unlockDate = useMemo(() => {
    return powerFactor.currentResult.unlockDate || null;
  }, [powerFactor.currentResult.unlockDate]);

  // Validation - minimum lock period requirement
  const minLockPeriodError = useMemo(() => {
    if (lockValue && parseInt(lockValue, 10) > 0) {
      const numValue = parseInt(lockValue, 10);
      const minAllowed = getMinAllowedValue(lockUnit);
      
      if (numValue < minAllowed) {
        return `Minimum ${minAllowed} ${lockUnit} required for MOR rewards`;
      }
    }
    return null;
  }, [lockValue, lockUnit]);

  // Validation - maximum lock period check
  const maxLockPeriodError = useMemo(() => {
    if (lockValue && parseInt(lockValue, 10) > 0) {
      const numValue = parseInt(lockValue, 10);
      const maxAllowed = getMaxAllowedValue(lockUnit);
      
      if (numValue > maxAllowed) {
        return `Maximum ${maxAllowed} ${lockUnit} allowed`;
      }
    }
    return null;
  }, [lockValue, lockUnit]);

  // Validation - separate lock period validation from other validations
  const lockPeriodError = useMemo(() => {
    // Check if new lock period would be shorter than existing position
    if (lockValue && parseInt(lockValue, 10) > 0) {
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const lockDurationSeconds = durationToSeconds(lockValue, lockUnit);
      const proposedClaimLockEnd = BigInt(currentTimestamp) + lockDurationSeconds;
      
      // Get existing lock end timestamp for selected asset - Using dynamic assets system
      const existingLockEnd = assets[selectedAsset]?.claimUnlockTimestamp;
      
      if (existingLockEnd && existingLockEnd > BigInt(0) && proposedClaimLockEnd < existingLockEnd) {
        const existingDate = new Date(Number(existingLockEnd) * 1000);
        return `Lock period too short. Your existing ${selectedAsset} position is locked until ${existingDate.toLocaleDateString()}. New deposits must have a lock period that ends on or after this date.`;
      }
    }
    return null;
  }, [lockValue, lockUnit, selectedAsset, assets]);

  const validationError = useMemo(() => {
    if (amountBigInt <= BigInt(0)) return null;
    
    // Return existing position conflict error if exists (this is a hard error)
    if (lockPeriodError) return lockPeriodError;
    
    // Return max lock period error if exists (this is a hard error)
    if (maxLockPeriodError) return maxLockPeriodError;
    
    // Debug validation logic
    console.log(`💰 Validation for ${selectedAsset}:`, {
      amountBigInt: amountBigInt.toString(),
      currentAssetBalance: {
        balance: currentAssetBalance.balance?.toString(),
        formatted: currentAssetBalance.formatted
      },
      comparison: currentAssetBalance.balance ? {
        amountGreaterThanBalance: amountBigInt > currentAssetBalance.balance,
        amountStr: amountBigInt.toString(),
        balanceStr: currentAssetBalance.balance.toString()
      } : null
    });
    
    // TODO: Add minimal stake validation once PoolLimitsData interface is updated
    // const minimalStake = currentAsset?.protocolDetails?.minimalStake;
    // if (minimalStake && amountBigInt < minimalStake) {
    //   return `Minimum deposit is ${formatUnits(minimalStake, 18)} ${selectedAsset}`;
    // }
    
    // Check if we have balance data (including 0 balance) and if amount exceeds it
    if (currentAssetBalance.balance !== undefined && amountBigInt > currentAssetBalance.balance) {
      return `Insufficient ${selectedAsset} balance`;
    }
    
    return null;
  }, [amountBigInt, currentAssetBalance, selectedAsset, lockPeriodError, maxLockPeriodError]);

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
      // Double-check approval status with fresh blockchain data before proceeding
      const freshApprovalNeeded = await checkAndUpdateApprovalNeeded(selectedAsset, rawAmount || amount);
      console.log('🔍 Fresh approval check:', { selectedAsset, amount, rawAmount, freshApprovalNeeded, currentlyNeedsApproval });
      
      if (freshApprovalNeeded || currentlyNeedsApproval) {
        console.log('💰 Approval needed, requesting approval for', selectedAsset);
        await approveToken(selectedAsset);
      } else {
        // Calculate lock duration in seconds
        const lockDuration = durationToSeconds(lockValue, lockUnit);
        
        // Use resolved address if available, otherwise use the original input
        const finalReferrerAddress = resolvedAddress || (referrerAddress.trim() || undefined);
        
        // Debug lock period validation
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const proposedClaimLockEnd = BigInt(currentTimestamp) + lockDuration;
        // Get existing lock end for debugging - Using dynamic assets system
        const existingLockEnd = assets[selectedAsset]?.claimUnlockTimestamp;
        
        console.log('🏦 Proceeding with deposit:', { 
          selectedAsset, 
          amount, 
          lockDuration: lockDuration.toString(),
          currentTimestamp,
          proposedClaimLockEnd: proposedClaimLockEnd.toString(),
          existingLockEnd: existingLockEnd?.toString(),
          proposedDate: new Date(Number(proposedClaimLockEnd) * 1000).toISOString(),
          existingDate: existingLockEnd ? new Date(Number(existingLockEnd) * 1000).toISOString() : 'none'
        });
        
        // Log pre-deposit values for debugging
        console.debug(`🔍 [${selectedAsset}] Pre-Deposit Values:`, {
          selectedAsset,
          displayAmount: amount,
          transactionAmount: rawAmount || amount,
          amountParsed: amountBigInt.toString(),
          amountHex: '0x' + amountBigInt.toString(16),
          lockDuration: lockDuration.toString(),
          expectedGasFee: 'NORMAL ($2-5)',
          assetDecimals: availableAssets.find(a => a.metadata.symbol === selectedAsset)?.metadata.decimals
        });
        
        await deposit(selectedAsset, rawAmount || amount, lockDuration, finalReferrerAddress);
      }
    } catch (error) {
      console.error("Deposit/Approve Action Error:", error);
      
      // Handle user rejection specifically
      const errorMessage = (error as Error)?.message || "";
      if (errorMessage.includes("User rejected") || 
          errorMessage.includes("User denied") || 
          errorMessage.includes("rejected the request") ||
          errorMessage.includes("denied transaction signature")) {
        // Don't set formError for user cancellation - it's not a form validation error
        // The toast notification will be shown by the context/hook that handles the transaction
        return;
      }
      
      // Handle other errors with a more user-friendly message
      if (errorMessage.includes("insufficient funds")) {
        setFormError("Insufficient funds for this transaction.");
      } else if (errorMessage.includes("gas")) {
        setFormError("Transaction failed due to gas issues. Please try again.");
      } else {
        setFormError("Transaction failed. Please try again.");
      }
    }
  };

  const handleMaxAmount = () => {
    if (currentAssetBalance.balance && currentAssetBalance.balance > BigInt(0)) {
      // Get the correct decimals for the selected asset
      const assetInfo = availableAssets.find(asset => asset.metadata.symbol === selectedAsset);
      const decimals = assetInfo?.metadata.decimals || 18;
      
      // Get raw amount for transactions and formatted amount for display
      const rawAmountForTx = formatUnits(currentAssetBalance.balance, decimals);
      const formattedAmount = formatBalanceDisplay(rawAmountForTx, selectedAsset);
      
      setAmount(formattedAmount); // Display amount (formatted)
      setRawAmount(rawAmountForTx); // Transaction amount (full precision)
      setFormError(null); // Clear form error when max amount is selected
    }
  };



  // Check if we should show warning/validation (yellow border for non-critical issues)
  const showWarning = useMemo(() => {
    if (!amount || amount.trim() === "") return true;
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return true;
    // Only show yellow warning if there are no validation/form errors (which get red border)
    return (!!referrerAddressError || currentlyNeedsApproval) && !validationError && !formError;
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
      setRawAmount("");
      setReferrerAddress("");
      setLockValue("7");
      setLockUnit("days");
      setFormError(null);
      setReferrerAddressError(null);
      setCurrentlyNeedsApproval(false);
      setProcessedApprovalSuccess(false);
      setAssetDropdownOpen(false);
      setTimeLockDropdownOpen(false);
      setSelectedAsset(contextSelectedAsset);
    } else if (isOpen) {
      // Update selected asset when modal opens with the context value
      setSelectedAsset(contextSelectedAsset);
      
      // Pre-populate referrer address when modal opens with URL referrer
      if (preReferrerAddress && !referrerAddress) {
        setReferrerAddress(preReferrerAddress);
        // Clear the pre-populated address after using it
        setPreReferrerAddress('');
      }
    }
  }, [isOpen, contextSelectedAsset, preReferrerAddress, referrerAddress, setPreReferrerAddress]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && setActiveModal(null)}>
      <DialogPortal>
        <DialogContent className="h-[100vh] w-full sm:h-auto sm:max-w-[425px] bg-background border-gray-800 flex flex-col sm:block overflow-hidden">
          <DialogHeader className="shrink-0 px-4 sm:px-0">
            <DialogTitle className="text-xl font-bold text-emerald-400">Deposit Capital</DialogTitle>
            <DialogDescription className="text-gray-400">
              Deposit an asset to start earning MOR rewards. Power factor activates after ~7-8 months and reaches maximum x10.7 at ~7 years from now.
            </DialogDescription>
          </DialogHeader>

          <form id="deposit-form" onSubmit={handleSubmit} className="space-y-4 pt-4 px-4 sm:px-0 pb-4 sm:pb-0 flex-1 overflow-y-auto sm:overflow-visible">
            {/* Asset Selection */}
            <div className="space-y-2 relative">
              <Label className="text-sm font-medium text-white">Select Asset</Label>
              <div className="relative" ref={dropdownRef}>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between bg-background border-gray-700 hover:bg-gray-800/25"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setAssetDropdownOpen(!assetDropdownOpen);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center">
                      <AssetIcon
                        symbol={selectedAsset}
                        className="rounded-lg"
                        size={24}
                      />
                    </div>
                    <span>{selectedAsset}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm">
                      {formatBalanceDisplay(currentAssetBalance.formatted || '0', selectedAsset)} Available
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
                        className="w-full p-3 text-left hover:translate-y-[-1px] hover:bg-gray-800/25 flex items-center gap-3 justify-between transition-colors"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedAsset(asset.value as AssetSymbol);
                          setAssetDropdownOpen(false);
                          setFormError(null); // Clear form error on asset change
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 flex items-center justify-center">
                            <AssetIcon symbol={asset.value as AssetSymbol} className="rounded-lg" size="24" />
                          </div>
                          <span className="text-white">{asset.label}</span>
                        </div>
                          <span className="text-gray-400 text-sm">
                            {formatBalanceDisplay(getUserBalanceForAsset(asset.value as AssetSymbol).formatted || '0', asset.value as AssetSymbol)} Available
                          </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Stake Amount */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-white">Deposit Amount</Label>
              <div className="relative">
                <Input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*\.?[0-9]*"
                  placeholder="0.0"
                  value={amount}
                  onChange={(e) => {
                    const value = e.target.value;
                    
                    // Log input changes for debugging
                    if (value) {
                      console.debug(`🔍 [${selectedAsset}] Input Change:`, {
                        selectedAsset,
                        rawValue: value,
                        numberValue: Number(value),
                        expectedGasFee: 'NORMAL ($2-5)'
                      });
                    }
                    
                    if (value === '' || /^\d*\.?\d*$/.test(value)) {
                      setAmount(value);
                      setRawAmount(''); // Clear raw amount when user types manually
                      setFormError(null);
                    }
                  }}
                  className={`bg-background pr-32 text-base ${
                    // Only show red border for balance-related errors, not lock period errors
                    (validationError && !lockPeriodError) ? '!border-red-500 border-2' : 
                    formError ? '!border-red-500 border-2' : 
                    showWarning ? 'border-yellow-500 border' : 'border-gray-700 border'
                  }`}
                  disabled={isProcessingDeposit}
                  onKeyDown={(e) => {
                    if (['e', 'E', '-', '+'].includes(e.key)) {
                      e.preventDefault();
                    }
                  }}
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                  {currentAssetBalance.formatted && Number(currentAssetBalance.formatted) > 0 && (
                    <span className="text-xs text-gray-400 mr-2">
                      {formatBalanceDisplay(currentAssetBalance.formatted, selectedAsset)} {selectedAsset}
                    </span>
                  )}
                  <button
                    type="button"
                    className="h-8 px-2 text-xs copy-button-secondary"
                    onClick={handleMaxAmount}
                    disabled={!currentAssetBalance.balance || currentAssetBalance.balance <= BigInt(0) || isProcessingDeposit}
                  >
                    Max
                  </button>
                </div>
              </div>
              
              {/* Validation error message - only show balance-related errors here */}
              {validationError && !lockPeriodError && (
                <p className="text-red-500 text-sm mt-1">
                  {validationError}
                </p>
              )}
              
              {/* Deposit lock period info */}
              <p className="text-xs text-gray-400 mt-2">
                Deposits are locked for the first 7 days.
              </p>
            </div>

            {/* Referrer Address */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-white">Referrer Address</Label>
                <span className="text-xs text-gray-400">Optional</span>
              </div>
              <Input
                placeholder="0x1234...abcd or ENS domain"
                value={referrerAddress}
                onChange={(e) => {
                  const value = e.target.value;
                  setReferrerAddress(value);
                  validateReferrerAddress(value);
                  setFormError(null); // Clear form error on input change
                }}
                onBlur={() => validateReferrerAddress(referrerAddress)}
                className={`bg-background border-gray-700 text-sm ${
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
            <TimeLockPeriodSelector
              lockValue={lockValue}
              lockUnit={lockUnit}
              onLockValueChange={handleLockValueChange}
              onLockUnitChange={handleLockUnitChange}
              minLockPeriodError={minLockPeriodError}
              maxLockPeriodError={maxLockPeriodError}
              lockPeriodError={lockPeriodError}
              disabled={isProcessingDeposit}
              onValueChangeExtra={() => setFormError(null)}
              onUnitChangeExtra={() => setFormError(null)}
            />

            {/* Summary Section */}
            {amount && parseFloat(amount) > 0 && lockValue && parseInt(lockValue, 10) > 0 && (
              <div className="p-1 rounded-md text-sm bg-emerald-500/20 rounded-lg p-3">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Deposit Amount</span>
                    <span className="text-white">{amount} {selectedAsset}</span>
                  </div>
                  {unlockDate && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">Mor Unlock Date</span>
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
                        const displayValue = powerFactor.currentResult.isLoading 
                          ? "Loading..." 
                          : powerFactor.currentResult.powerFactor;
                        
                        if (process.env.NODE_ENV !== 'production') {
                          console.log('🎨 [Deposit Modal] Power Factor Display:', {
                            isLoading: powerFactor.currentResult.isLoading,
                            powerFactorValue: powerFactor.currentResult.powerFactor,
                            displayValue,
                            fullCurrentResult: powerFactor.currentResult
                          });
                        }
                        
                        return displayValue;
                      })()}
                    </span>
                  </div>
                  
                  {/* Show power factor warning if applicable */}
                  {powerFactor.currentResult.warning && (
                    <div className="text-xs text-gray-400 mt-1">
                      * {powerFactor.currentResult.warning}
                    </div>
                  )}
                  
                  {/* Show power factor error if applicable */}
                  {powerFactor.currentResult.error && (
                    <div className="text-xs text-red-400 mt-1">
                      {powerFactor.currentResult.error}
                    </div>
                  )}
                  {/* <div className="flex justify-between items-center">
                    <span className="text-gray-300">Est. Rewards Earned</span>
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
                  {/* {estimatedRewards.error && !estimatedRewards.isLoading && (
                    <div className="text-xs text-red-400 mt-1">
                      {estimatedRewards.error}
                    </div>
                  )} */}
                </div>
              </div>
                        )}
          </form>

          <DialogFooter className="shrink-0 px-4 sm:px-0 sm:mt-4">
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
              form="deposit-form"
              className={
                isProcessingDeposit ||
                isNetworkSwitching ||
                // Only apply disabled styling for form validation when on mainnet
                (isOnMainnet && (
                  !!validationError ||
                  !!referrerAddressError ||
                  !!minLockPeriodError ||
                  !!maxLockPeriodError ||
                  !!lockPeriodError ||
                  !!powerFactor.currentResult.error ||
                  !powerFactor.currentResult.isValid ||
                  amountBigInt <= BigInt(0) ||
                  !userAddress ||
                  !lockValue ||
                  parseInt(lockValue, 10) <= 0
                ))
                  ? "copy-button-secondary px-2 py-2 text-sm opacity-50 cursor-not-allowed mb-2 sm:mb-0"
                  : currentlyNeedsApproval
                  ? "copy-button-secondary px-2 py-2 text-sm mb-2 sm:mb-0"
                  : "copy-button-base mb-2 sm:mb-0"
              }
              disabled={
                isProcessingDeposit ||
                isNetworkSwitching ||
                // Only apply form validation when on mainnet (when we can actually proceed with deposit)
                (isOnMainnet && (
                  !!validationError ||
                  !!referrerAddressError ||
                  !!minLockPeriodError ||
                  !!maxLockPeriodError ||
                  !!lockPeriodError ||
                  !!powerFactor.currentResult.error ||
                  !powerFactor.currentResult.isValid ||
                  amountBigInt <= BigInt(0) ||
                  !userAddress ||
                  !lockValue ||
                  parseInt(lockValue, 10) <= 0
                ))
              }
              onClick={async (e) => {
                e.preventDefault();

                // If not on mainnet, switch to mainnet first
                if (!isOnMainnet) {
                  try {
                    await switchToChain(mainnet.id);
                  } catch (error) {
                    console.error('Failed to switch to mainnet:', error);
                  }
                  return;
                }

                // Otherwise, proceed with form submission
                const form = document.getElementById('deposit-form') as HTMLFormElement;
                if (form) {
                  form.requestSubmit();
                }
              }}
            >
              {isProcessingDeposit ? (
                <div className="flex flex-row items-center justify-center gap-2">
                  {/* <Spinner className="text-emerald-500" size="sm"/> */}
                  <svg className="text-emerald-400 animate-spin ..." viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"
                    width="16" height="16">
                    <path
                      d="M32 3C35.8083 3 39.5794 3.75011 43.0978 5.20749C46.6163 6.66488 49.8132 8.80101 52.5061 11.4939C55.199 14.1868 57.3351 17.3837 58.7925 20.9022C60.2499 24.4206 61 28.1917 61 32C61 35.8083 60.2499 39.5794 58.7925 43.0978C57.3351 46.6163 55.199 49.8132 52.5061 52.5061C49.8132 55.199 46.6163 57.3351 43.0978 58.7925C39.5794 60.2499 35.8083 61 32 61C28.1917 61 24.4206 60.2499 20.9022 58.7925C17.3837 57.3351 14.1868 55.199 11.4939 52.5061C8.801 49.8132 6.66487 46.6163 5.20749 43.0978C3.7501 39.5794 3 35.8083 3 32C3 28.1917 3.75011 24.4206 5.2075 20.9022C6.66489 17.3837 8.80101 14.1868 11.4939 11.4939C14.1868 8.80099 17.3838 6.66487 20.9022 5.20749C24.4206 3.7501 28.1917 3 32 3L32 3Z"
                      stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path
                      d="M32 3C36.5778 3 41.0906 4.08374 45.1692 6.16256C49.2477 8.24138 52.7762 11.2562 55.466 14.9605C58.1558 18.6647 59.9304 22.9531 60.6448 27.4748C61.3591 31.9965 60.9928 36.6232 59.5759 40.9762"
                      stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-900">
                    </path>
                  </svg>
                  Processing...
                </div>
              ) : isNetworkSwitching ? (
                <div className="flex flex-row items-center justify-center gap-2">
                  <svg className="text-emerald-400 animate-spin ..." viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"
                    width="16" height="16">
                    <path
                      d="M32 3C35.8083 3 39.5794 3.75011 43.0978 5.20749C46.6163 6.66488 49.8132 8.80101 52.5061 11.4939C55.199 14.1868 57.3351 17.3837 58.7925 20.9022C60.2499 24.4206 61 28.1917 61 32C61 35.8083 60.2499 39.5794 58.7925 43.0978C57.3351 46.6163 55.199 49.8132 52.5061 52.5061C49.8132 55.199 46.6163 57.3351 43.0978 58.7925C39.5794 60.2499 35.8083 61 32 61C28.1917 61 24.4206 60.2499 20.9022 58.7925C17.3837 57.3351 14.1868 55.199 11.4939 52.5061C8.801 49.8132 6.66487 46.6163 5.20749 43.0978C3.7501 39.5794 3 35.8083 3 32C3 28.1917 3.75011 24.4206 5.2075 20.9022C6.66489 17.3837 8.80101 14.1868 11.4939 11.4939C14.1868 8.80099 17.3838 6.66487 20.9022 5.20749C24.4206 3.7501 28.1917 3 32 3L32 3Z"
                      stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path
                      d="M32 3C36.5778 3 41.0906 4.08374 45.1692 6.16256C49.2477 8.24138 52.7762 11.2562 55.466 14.9605C58.1558 18.6647 59.9304 22.9531 60.6448 27.4748C61.3591 31.9965 60.9928 36.6232 59.5759 40.9762"
                      stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-900">
                    </path>
                  </svg>
                  Switching...
                </div>
              ) : !isOnMainnet ? (
                "Switch to Mainnet"
              ) : (
                currentlyNeedsApproval ? `Approve ${selectedAsset}` : "Confirm Deposit"
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
} 