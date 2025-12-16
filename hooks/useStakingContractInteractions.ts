import { useCallback, useEffect, useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { useWaitForTransactionReceipt, useWriteContract, useReadContract } from 'wagmi';
import { parseEther, formatEther, Address, isAddress } from 'viem';
import { toast } from "sonner";
import { getSafeWalletUrlIfApplicable } from "@/lib/utils/safe-wallet-detection";
import { useNetwork } from "@/context/network-context";
import { arbitrumSepolia } from 'wagmi/chains';
import { formatTimePeriod } from '@/app/utils/time-utils';

// Import the ABIs
import BuilderSubnetsV2Abi from '@/app/abi/BuilderSubnetsV2.json';
import BuilderSubnetsAbi from '@/app/abi/BuilderSubnets.json';
import ERC20Abi from '@/app/abi/ERC20.json';
import BuildersAbi from '@/app/abi/Builders.json';

// Import from config
import { getChainById } from '@/config/networks';

export interface UseStakingContractInteractionsProps {
  subnetId?: `0x${string}`;
  networkChainId: number;
  onTxSuccess?: () => void;
  lockPeriodInSeconds?: number;
}

export const useStakingContractInteractions = ({ 
  subnetId,
  networkChainId,
  onTxSuccess,
  lockPeriodInSeconds
}: UseStakingContractInteractionsProps) => {
  // Basic state
  const [isNetworkSwitching, setIsNetworkSwitching] = useState(false);
  const [tokenAddress, setTokenAddress] = useState<Address | undefined>(undefined);
  const [tokenSymbol, setTokenSymbol] = useState<string>('MOR');
  const [tokenBalance, setTokenBalance] = useState<bigint | undefined>(undefined);
  const [allowance, setAllowance] = useState<bigint | undefined>(undefined);
  const [needsApproval, setNeedsApproval] = useState<boolean>(false);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [contractAddress, setContractAddress] = useState<Address | undefined>(undefined);

  // Hooks
  const { address: connectedAddress } = useAccount();
  const walletChainId = useChainId();
  const { switchToChain } = useNetwork();
  
  // Determine if we're using testnet
  const isTestnet = networkChainId === arbitrumSepolia.id;
  
  // Helper Functions
  const isCorrectNetwork = useCallback(() => {
    return typeof walletChainId === 'number' && walletChainId === networkChainId;
  }, [walletChainId, networkChainId]);

  const getAbi = useCallback(() => {
    return isTestnet ? BuilderSubnetsV2Abi : BuilderSubnetsAbi;
  }, [isTestnet]);

  const getNetworkName = useCallback((chainId: number): string => {
    const chain = getChainById(chainId, isTestnet ? 'testnet' : 'mainnet');
    return chain?.name ?? `Network ID ${chainId}`;
  }, [isTestnet]);

  // Helper function to show enhanced toast with Safe wallet link if applicable
  const showEnhancedLoadingToast = useCallback(async (message: string, toastId: string) => {
    if (connectedAddress && networkChainId) {
      try {
        const safeWalletUrl = await getSafeWalletUrlIfApplicable(connectedAddress, networkChainId);
        if (safeWalletUrl) {
          toast.loading(message, {
            id: toastId,
            description: "If the transaction doesn't appear, check your Safe wallet.",
            action: {
              label: "Open Safe Wallet",
              onClick: () => window.open(safeWalletUrl, "_blank")
            }
          });
        } else {
          toast.loading(message, { id: toastId });
        }
      } catch (error) {
        console.warn("Failed to check if wallet is Safe:", error);
        toast.loading(message, { id: toastId });
      }
    } else {
      toast.loading(message, { id: toastId });
    }
  }, [connectedAddress, networkChainId]);

  // Format balance to string with token symbol
  const formatBalance = useCallback(() => {
    if (tokenBalance === undefined) return "Loading...";
    if (tokenBalance === BigInt(0)) return `0 ${tokenSymbol}`;
    return `${formatEther(tokenBalance)} ${tokenSymbol}`;
  }, [tokenBalance, tokenSymbol]);

  // Set contract addresses 
  useEffect(() => {
    const chain = getChainById(networkChainId, isTestnet ? 'testnet' : 'mainnet');
    if (chain) {
      // Set the builders contract address
      const addr = chain.contracts?.builders?.address;
      if (addr && isAddress(addr)) {
        console.log(`✅ Setting contract address for ${chain.name} (chainId: ${networkChainId}):`, addr);
        
        // Special validation for Base network
        if (networkChainId === 8453) {
          const expectedBaseBuilders = '0x42bb446eae6dca7723a9ebdb81ea88afe77ef4b9';
          if (addr.toLowerCase() !== expectedBaseBuilders.toLowerCase()) {
            console.warn(`⚠️ Base builders contract mismatch! Expected: ${expectedBaseBuilders}, Got: ${addr}`);
          } else {
            console.log(`✅ Base builders contract correctly configured`);
          }
        }
        
        setContractAddress(addr as Address);
      } else {
        console.error(`❌ Invalid or missing builders contract address for chain ${networkChainId}`);
      }

      // Also set the token address directly from configuration
      // This helps in case the contract call to get token address fails
      const tokenAddr = chain.contracts?.morToken?.address;
      if (tokenAddr && isAddress(tokenAddr)) {
        console.log(`✅ Setting token address from config for ${chain.name}:`, tokenAddr);
        
        // Special validation for Base network
        if (networkChainId === 8453) {
          const expectedBaseMOR = '0x7431ada8a591c955a994a21710752ef9b882b8e3';
          if (tokenAddr.toLowerCase() !== expectedBaseMOR.toLowerCase()) {
            console.warn(`⚠️ Base MOR token contract mismatch! Expected: ${expectedBaseMOR}, Got: ${tokenAddr}`);
          } else {
            console.log(`✅ Base MOR token contract correctly configured`);
          }
        }
        
        setTokenAddress(tokenAddr as Address);
      }
    } else {
      console.error(`❌ Could not find chain configuration for chainId ${networkChainId}`);
    }
  }, [networkChainId, isTestnet, getChainById]);

  // Get token address from contract (skip for Base network as it doesn't have token() function)
  const { data: morTokenAddressData, isFetching: isFetchingToken, error: tokenAddressError } = useReadContract({
    address: contractAddress,
    abi: getAbi(),
    functionName: 'token',
    chainId: networkChainId,
    query: {
       enabled: isCorrectNetwork() && !!contractAddress && networkChainId !== 8453, // Skip for Base network
       retry: networkChainId === 8453 ? 3 : 1, // More retries for Base network
    }
  });

  // Get token symbol
  const { data: tokenSymbolData, isFetching: isFetchingSymbol, error: tokenSymbolError } = useReadContract({
    address: tokenAddress,
    abi: ERC20Abi,
    functionName: 'symbol',
    chainId: networkChainId,
    query: {
       enabled: isCorrectNetwork() && !!tokenAddress,
       retry: networkChainId === 8453 ? 3 : 1, // More retries for Base network
    }
  });

  // Get token balance
  const { data: balanceData, refetch: refetchBalance, isFetching: isFetchingBalance, error: balanceError } = useReadContract({
    address: tokenAddress,
    abi: ERC20Abi,
    functionName: 'balanceOf',
    args: [connectedAddress!],
    chainId: networkChainId,
    query: {
       enabled: isCorrectNetwork() && !!tokenAddress && !!connectedAddress,
       retry: networkChainId === 8453 ? 3 : 1, // More retries for Base network
    }
  });

  // Get token allowance
  const { data: allowanceData, refetch: refetchAllowance, isFetching: isFetchingAllowance, error: allowanceError } = useReadContract({
    address: tokenAddress,
    abi: ERC20Abi,
    functionName: 'allowance',
    args: [connectedAddress!, contractAddress!],
    chainId: networkChainId,
    query: {
       enabled: isCorrectNetwork() && !!tokenAddress && !!connectedAddress && !!contractAddress,
       retry: 3, // More retries for all networks to handle Safe wallet delays
       refetchInterval: false, // Disable automatic polling - we'll handle it manually after transactions
       staleTime: 5000, // Consider data stale after 5 seconds
       gcTime: 30000, // Keep in cache for 30 seconds (previously cacheTime)
    }
  });

  // Get claimable amount - different functions for mainnet vs testnet
  const { data: claimableAmountData, refetch: refetchClaimableAmount, isFetching: isFetchingClaimableAmount } = useReadContract({
    address: contractAddress,
    abi: isTestnet ? BuilderSubnetsV2Abi : BuildersAbi,
    functionName: isTestnet ? 'getStakerRewards' : 'getCurrentBuilderReward',
    args: isTestnet 
      ? [subnetId!, connectedAddress!] // testnet: getStakerRewards(subnetId, stakerAddress)
      : [subnetId!], // mainnet: getCurrentBuilderReward(builderPoolId)
    chainId: networkChainId,
    query: {
       enabled: isCorrectNetwork() && !!contractAddress && !!subnetId && !!connectedAddress,
       staleTime: 5 * 60 * 1000, // 5 minutes
    }
  });

  // Enhanced debugging with error logging for Base network issues
  useEffect(() => {
    // Log contract read errors for debugging
    if (tokenAddressError && networkChainId === 8453) {
      console.error(`🔴 Base network token address read error:`, tokenAddressError);
    }
    if (tokenSymbolError && networkChainId === 8453) {
      console.error(`🔴 Base network token symbol read error:`, tokenSymbolError);
    }
    if (balanceError && networkChainId === 8453) {
      console.error(`🔴 Base network balance read error:`, balanceError);
    }
    if (allowanceError && networkChainId === 8453) {
      console.error(`🔴 Base network allowance read error:`, allowanceError);
    }
  }, [tokenAddressError, tokenSymbolError, balanceError, allowanceError, networkChainId]);

  // Fix: Log allowance data when it changes to debug mainnet approval issues
  useEffect(() => {
    if (allowanceData !== undefined && allowanceData !== null && !isTestnet) {
      console.log(`💰 Mainnet allowance data received (${networkChainId}):`, {
        allowance: allowanceData.toString(),
        formattedAllowance: formatEther(allowanceData as bigint),
        tokenAddress,
        contractAddress,
        connectedAddress,
        isCorrectNetwork: isCorrectNetwork(),
        networkName: networkChainId === 8453 ? 'Base' : networkChainId === 42161 ? 'Arbitrum' : 'Unknown'
      });
    }
  }, [allowanceData, isTestnet, networkChainId, tokenAddress, contractAddress, connectedAddress, isCorrectNetwork]);

  // Contract Write Hooks
  const { data: stakeTxResult, writeContract: writeStake, isPending: isStakePending, error: stakeError, reset: resetStakeContract } = useWriteContract({
    mutation: {
      onError: (error) => {
        console.error("Detailed staking error:", error);
        let errorMessage = "Unknown error";
        
        if (error instanceof Error) {
          errorMessage = error.message;
          
          // Try to extract the revert reason if available
          const revertMatch = errorMessage.match(/reverted with reason string '([^']*)'/);
          if (revertMatch && revertMatch[1]) {
            errorMessage = `Contract reverted: ${revertMatch[1]}`;
          }
          
          // Extract gas errors
          if (errorMessage.includes("gas")) {
            errorMessage = "Transaction would exceed gas limits. The contract function may be failing.";
          }
        }
        
        toast.error("Staking Failed", { 
          id: "stake-tx", 
          description: errorMessage 
        });
      }
    }
  });

  const { data: claimTxResult, writeContract: writeClaim, isPending: isClaimPending, error: claimError, reset: resetClaimContract } = useWriteContract({
    mutation: {
      onError: (error) => {
        console.error("Detailed claim error:", error);
        let errorMessage = "Unknown error";
        
        if (error instanceof Error) {
          errorMessage = error.message;
          
          // Try to extract the revert reason if available
          const revertMatch = errorMessage.match(/reverted with reason string '([^']*)'/);
          if (revertMatch && revertMatch[1]) {
            errorMessage = `Contract reverted: ${revertMatch[1]}`;
          }
          
          // Extract gas errors
          if (errorMessage.includes("gas")) {
            errorMessage = "Transaction would exceed gas limits. The contract function may be failing.";
          }
        }
        
        toast.error("Claim Failed", { 
          id: "claim-tx", 
          description: errorMessage 
        });
      }
    }
  });

  const { data: withdrawTxResult, writeContract: writeWithdraw, isPending: isWithdrawPending, error: withdrawError, reset: resetWithdrawContract } = useWriteContract({
    mutation: {
      onError: (error) => {
        console.error("Detailed withdrawal error:", error);
        let errorMessage = "Unknown error";
        
        if (error instanceof Error) {
          errorMessage = error.message;
          
          // Try to extract the revert reason if available
          const revertMatch = errorMessage.match(/reverted with reason string '([^']*)'/);
          if (revertMatch && revertMatch[1]) {
            errorMessage = `Contract reverted: ${revertMatch[1]}`;
          }
          
          // Extract gas errors
          if (errorMessage.includes("gas")) {
            errorMessage = "Transaction would exceed gas limits. The contract function may be failing.";
          }
        }
        
        toast.error("Withdrawal Failed", { 
          id: "withdraw-tx", 
          description: errorMessage 
        });
      }
    }
  });

  const { data: approveTxResult, writeContract: writeApprove, isPending: isApprovePending, error: approveError, reset: resetApproveContract } = useWriteContract({
    mutation: {
      onError: (error) => {
        console.error("Detailed approval error:", error);
        let errorMessage = "Unknown error";
        
        if (error instanceof Error) {
          errorMessage = error.message;
          
          // Try to extract the revert reason if available
          const revertMatch = errorMessage.match(/reverted with reason string '([^']*)'/);
          if (revertMatch && revertMatch[1]) {
            errorMessage = `Token approval reverted: ${revertMatch[1]}`;
          }
          
          // Extract gas errors
          if (errorMessage.includes("gas")) {
            errorMessage = "Approval would exceed gas limits. The token contract may be non-standard.";
          }
        }
        
        toast.error("Token Approval Failed", { 
          id: "approval-tx", 
          description: errorMessage 
        });
      }
    }
  });

  // Transaction Receipt Hooks
  const { isLoading: isStakeTxLoading, isSuccess: isStakeTxSuccess } = useWaitForTransactionReceipt({ hash: stakeTxResult });
  const { isLoading: isApproveTxLoading, isSuccess: isApproveTxSuccess } = useWaitForTransactionReceipt({ hash: approveTxResult });
  const { isLoading: isWithdrawTxLoading, isSuccess: isWithdrawTxSuccess } = useWaitForTransactionReceipt({ hash: withdrawTxResult });
  const { isLoading: isClaimTxLoading, isSuccess: isClaimTxSuccess } = useWaitForTransactionReceipt({ hash: claimTxResult });

  // Combined Loading States
  const isApproving = isApprovePending || isApproveTxLoading;
  const isStaking = isStakePending || isStakeTxLoading;
  const isWithdrawing = isWithdrawPending || isWithdrawTxLoading;
  const isClaiming = isClaimPending || isClaimTxLoading;
  const isAnyTxPending = isApproving || isStaking || isWithdrawing || isClaiming;
  const isSubmitting = isAnyTxPending || isNetworkSwitching;

  // Update state variables from read hook data
  useEffect(() => {
    // For Base network, we skip the contract call and already have token address from config
    if (networkChainId === 8453) {
      console.log("✅ Base network: Using token address from config (skipping contract call)");
      // Token address already set from config in the earlier useEffect
    } else if (morTokenAddressData && isAddress(morTokenAddressData as string)) {
      console.log("✅ Token address from contract:", morTokenAddressData);
      setTokenAddress(morTokenAddressData as Address);
    } else if (morTokenAddressData) {
      console.error("❌ Invalid token address returned from contract:", morTokenAddressData);
    }
    
    if (tokenSymbolData) {
      setTokenSymbol(tokenSymbolData as string);
    }
    if (balanceData !== undefined) {
      setTokenBalance(balanceData as bigint);
    }
    if (allowanceData !== undefined) {
      setAllowance(allowanceData as bigint);
      console.log(`📊 Allowance data updated: ${formatEther(allowanceData as bigint)} ${tokenSymbol}`);
    }
  }, [morTokenAddressData, tokenSymbolData, balanceData, allowanceData, networkChainId, tokenSymbol]);
  
  // Refetch allowance when critical dependencies change (e.g., after page reload or network switch)
  // This helps ensure we always have fresh data, especially important for Safe wallet users
  useEffect(() => {
    if (isCorrectNetwork() && tokenAddress && connectedAddress && contractAddress) {
      console.log("🔄 Critical dependencies ready, refetching allowance for fresh data...");
      const timer = setTimeout(() => {
        refetchAllowance().then(() => {
          console.log("✅ Initial allowance refetch completed");
        }).catch((error: unknown) => {
          console.error("Error in initial allowance refetch:", error);
        });
      }, 500); // Small delay to avoid immediate double-fetch
      
      return () => clearTimeout(timer);
    }
  }, [isCorrectNetwork, tokenAddress, connectedAddress, contractAddress]);

  // Update loading state for token data, balance, and allowance
  useEffect(() => {
    setIsLoadingData(isFetchingToken || isFetchingSymbol || isFetchingBalance || isFetchingAllowance || isFetchingClaimableAmount);
  }, [isFetchingToken, isFetchingSymbol, isFetchingBalance, isFetchingAllowance, isFetchingClaimableAmount]);

  // Handle Approval Transaction Notifications
  useEffect(() => {
    if (isApprovePending) {
      showEnhancedLoadingToast("Confirm approval in wallet...", "approval-tx");
    }
    if (isApproveTxLoading) {
      // Show enhanced toast while waiting for transaction confirmation
      showEnhancedLoadingToast(
        "Waiting for approval confirmation...", 
        "approval-tx"
      );
    }
    if (isApproveTxSuccess) {
      console.log(`🎉 Approval transaction confirmed! Hash: ${approveTxResult}`);
      toast.success("Approval transaction confirmed!", { id: "approval-tx" });
      
      // Enhanced allowance refresh with retry logic for Safe wallet and multi-sig transactions
      // Safe wallets require more time for transaction propagation (10-30 seconds typical)
      // CRITICAL: We need to verify the allowance actually updated before proceeding
      const refreshAllowanceWithRetry = async () => {
        const maxRetries = 15; // Increased to 15 attempts for Safe wallet
        const delays = [2000, 3000, 3000, 5000, 5000, 5000, 8000, 8000, 10000, 10000, 15000, 15000, 20000, 20000, 30000]; // Progressive delays
        
        console.log("🔄 Starting allowance refresh with retry logic for Safe wallet compatibility...");
        console.log(`📋 Checking allowance for: token=${tokenAddress}, spender=${contractAddress}`);
        
        for (let i = 0; i < maxRetries; i++) {
          const delay = delays[i] || 15000;
          
          // Show progress toast
          if (i > 0 && i % 3 === 0) {
            toast.loading(`Checking approval status... (${i + 1}/${maxRetries})`, { id: "approval-check" });
          }
          
          await new Promise(resolve => setTimeout(resolve, delay));
          
          try {
            console.log(`🔍 Attempt ${i + 1}/${maxRetries}: Refreshing allowance after approval...`);
            const result = await refetchAllowance();
            
            // Check if allowance has been updated
            if (result.data !== undefined && result.data !== null) {
              const currentAllowance = result.data as bigint;
              const formattedAllowance = formatEther(currentAllowance);
              console.log(`💰 Allowance fetched: ${formattedAllowance} ${tokenSymbol} (raw: ${currentAllowance.toString()})`);
              
              // If allowance is greater than 0, approval was successful
              if (currentAllowance > BigInt(0)) {
                console.log(`✅ Allowance successfully updated after ${i + 1} attempts and ${(delays.slice(0, i + 1).reduce((a, b) => a + b, 0) / 1000).toFixed(1)}s`);
                setAllowance(currentAllowance);
                setNeedsApproval(false);
                toast.success(`Approval confirmed! You can now stake.`, { id: "approval-check" });
                return;
              } else {
                console.log(`⏳ Attempt ${i + 1}: Allowance still 0, waiting for blockchain update...`);
              }
            } else {
              console.log(`⚠️ Attempt ${i + 1}: Allowance data is undefined/null`);
            }
          } catch (error) {
            console.error(`❌ Attempt ${i + 1}: Error refreshing allowance:`, error);
          }
        }
        
        // Max retries reached - provide helpful error
        console.error("❌ Max retry attempts reached. Allowance still showing as 0.");
        console.error(`📋 Debug info: token=${tokenAddress}, spender=${contractAddress}, chain=${networkChainId}`);
        
        toast.error(
          "Approval taking longer than expected", 
          { 
            id: "approval-check",
            description: "The approval transaction was confirmed, but the allowance hasn't updated yet. This can happen with Safe wallets. Please wait a moment and refresh the page.",
            duration: 10000,
            action: {
              label: "Refresh Page",
              onClick: () => window.location.reload()
            }
          }
        );
      };
      
      refreshAllowanceWithRetry();
      resetApproveContract();
    }
    if (approveError) {
      const errorMsg = approveError?.message || "Approval failed.";
      let displayError = errorMsg.split('(')[0].trim();
      const detailsMatch = errorMsg.match(/(?:Details|Reason): (.*?)(?:\\n|\.|$)/i);
      if (detailsMatch && detailsMatch[1]) displayError = detailsMatch[1].trim();
      toast.error("Approval Failed", { id: "approval-tx", description: displayError });
      toast.dismiss("approval-check");
      resetApproveContract();
    }
  }, [isApproveTxSuccess, isApproveTxLoading, isApprovePending, approveError, approveTxResult, resetApproveContract, refetchAllowance, tokenSymbol, tokenAddress, contractAddress, networkChainId, showEnhancedLoadingToast]);

  // Handle Staking Transaction Notifications
  useEffect(() => {
    if (isStakePending) {
      showEnhancedLoadingToast("Confirm staking in wallet...", "stake-tx");
    }
    if (isStakeTxLoading) {
      // CRITICAL: Show enhanced toast while waiting for stake confirmation
      // This prevents UI from appearing "stuck"
      showEnhancedLoadingToast(
        "Waiting for staking confirmation...", 
        "stake-tx"
      );
      console.log(`⏳ Waiting for stake transaction to be confirmed...`);
    }
    if (isStakeTxSuccess) {
      console.log(`🎉 Stake transaction confirmed! Hash: ${stakeTxResult}`);
      
      // Show success with explorer link
      toast.success("Stake transaction confirmed!", {
        id: "stake-tx",
        description: "Your tokens have been staked. Balances will update shortly.",
        action: {
          label: "View on Explorer",
          onClick: () => {
            const chain = getChainById(networkChainId, isTestnet ? 'testnet' : 'mainnet');
            const explorerUrl = chain?.blockExplorers?.default.url;
            if (explorerUrl && stakeTxResult) {
              window.open(`${explorerUrl}/tx/${stakeTxResult}`, "_blank");
            }
          }
        },
        duration: 10000
      });
      
      resetStakeContract();
      
      // Enhanced data refresh with retry logic for Safe wallet and multi-sig transactions
      // After staking, it may take time for balance/allowance to update on-chain
      const refreshDataWithRetry = async () => {
        const maxRetries = 12; // Increased for Safe wallet
        const delays = [2000, 3000, 3000, 5000, 5000, 8000, 8000, 10000, 10000, 15000, 20000, 30000];
        
        console.log("🔄 Starting data refresh after stake transaction...");
        
        for (let i = 0; i < maxRetries; i++) {
          const delay = delays[i] || 15000;
          
          // Show progress for longer waits
          if (i > 0 && i % 4 === 0) {
            toast.loading(`Updating balances... (${i + 1}/${maxRetries})`, { id: "stake-refresh" });
          }
          
          await new Promise(resolve => setTimeout(resolve, delay));
          
          try {
            console.log(`🔍 Attempt ${i + 1}/${maxRetries}: Refreshing balance and allowance...`);
            const [balanceResult, allowanceResult] = await Promise.all([
              refetchBalance(),
              refetchAllowance()
            ]);
            
            // Log the results
            if (balanceResult.data) {
              console.log(`💰 New balance: ${formatEther(balanceResult.data as bigint)} ${tokenSymbol}`);
            }
            if (allowanceResult.data) {
              console.log(`✓ New allowance: ${formatEther(allowanceResult.data as bigint)} ${tokenSymbol}`);
            }
            
            if (i === maxRetries - 1) {
              console.log(`✅ Data refresh completed after ${i + 1} attempts`);
              toast.success("Balances updated!", { id: "stake-refresh" });
            }
          } catch (error) {
            console.error(`❌ Attempt ${i + 1}: Error refreshing data:`, error);
          }
        }
      };
      
      refreshDataWithRetry();
      
      if (onTxSuccess) {
        onTxSuccess();
      }
    }
    if (stakeError) {
      const errorMsg = stakeError?.message || "Staking failed.";
      let displayError = errorMsg.split('(')[0].trim();
      const detailsMatch = errorMsg.match(/(?:Details|Reason): (.*?)(?:\\n|\.|$)/i);
      if (detailsMatch && detailsMatch[1]) displayError = detailsMatch[1].trim();
      toast.error("Staking Failed", { id: "stake-tx", description: displayError });
      toast.dismiss("stake-refresh");
      resetStakeContract();
    }
  }, [isStakePending, isStakeTxLoading, isStakeTxSuccess, stakeTxResult, stakeError, resetStakeContract, onTxSuccess, refetchBalance, refetchAllowance, networkChainId, isTestnet, tokenSymbol, showEnhancedLoadingToast]);

  // Handle Withdrawal Transaction Notifications
  useEffect(() => {
    if (isWithdrawPending) {
      showEnhancedLoadingToast("Confirm withdrawal in wallet...", "withdraw-tx");
    }
    if (isWithdrawTxSuccess) {
      toast.success("Successfully withdrawn tokens!", {
        id: "withdraw-tx",
        description: `Tx: ${withdrawTxResult?.substring(0, 10)}...`,
        action: {
          label: "View on Explorer",
          onClick: () => {
            const chain = getChainById(networkChainId, isTestnet ? 'testnet' : 'mainnet');
            const explorerUrl = chain?.blockExplorers?.default.url;
            if (explorerUrl && withdrawTxResult) {
              window.open(`${explorerUrl}/tx/${withdrawTxResult}`, "_blank");
            }
          }
        }
      });
      resetWithdrawContract();
      // Refresh balance after withdrawal
      refetchBalance();
      if (onTxSuccess) {
        onTxSuccess();
      }
    }
    if (withdrawError) {
      const errorMsg = withdrawError?.message || "Withdrawal failed.";
      let displayError = errorMsg.split('(')[0].trim();
      const detailsMatch = errorMsg.match(/(?:Details|Reason): (.*?)(?:\\n|\.|$)/i);
      if (detailsMatch && detailsMatch[1]) displayError = detailsMatch[1].trim();
      toast.error("Withdrawal Failed", { id: "withdraw-tx", description: displayError });
      resetWithdrawContract();
    }
  }, [isWithdrawPending, isWithdrawTxSuccess, withdrawTxResult, withdrawError, resetWithdrawContract, onTxSuccess, refetchBalance, networkChainId, isTestnet]);

  // Handle Claim Transaction Notifications
  useEffect(() => {
    if (isClaimPending) {
      showEnhancedLoadingToast("Confirm claim in wallet...", "claim-tx");
    }
    if (isClaimTxSuccess) {
      toast.success("Successfully claimed rewards!", {
        id: "claim-tx",
        description: `Tx: ${claimTxResult?.substring(0, 10)}...`,
        action: {
          label: "View on Explorer",
          onClick: () => {
            const chain = getChainById(networkChainId, isTestnet ? 'testnet' : 'mainnet');
            const explorerUrl = chain?.blockExplorers?.default.url;
            if (explorerUrl && claimTxResult) {
              window.open(`${explorerUrl}/tx/${claimTxResult}`, "_blank");
            }
          }
        }
      });
      resetClaimContract();
      // Refresh balance and claimable amount after claim
      refetchBalance();
      refetchClaimableAmount();
      if (onTxSuccess) {
        onTxSuccess();
      }
    }
    if (claimError) {
      const errorMsg = claimError?.message || "Claim failed.";
      let displayError = errorMsg.split('(')[0].trim();
      const detailsMatch = errorMsg.match(/(?:Details|Reason): (.*?)(?:\\n|\.|$)/i);
      if (detailsMatch && detailsMatch[1]) displayError = detailsMatch[1].trim();
      toast.error("Claim Failed", { id: "claim-tx", description: displayError });
      resetClaimContract();
    }
  }, [isClaimPending, isClaimTxSuccess, claimTxResult, claimError, resetClaimContract, onTxSuccess, refetchBalance, refetchClaimableAmount, networkChainId, isTestnet]);

  // Network switching
  const handleNetworkSwitch = useCallback(async () => {
    if (isCorrectNetwork()) return true;
    
    setIsNetworkSwitching(true);
    try {
      const targetNetwork = getNetworkName(networkChainId);
      const networkType = isTestnet ? 'testnet' : 'mainnet';
      
      console.log(`Switching to ${targetNetwork} (${networkType}, chainId: ${networkChainId})...`);
      toast.loading(`Switching to ${targetNetwork}...`, { id: "network-switch" });
      
      await switchToChain(networkChainId);
      
      toast.success(`Successfully switched to ${targetNetwork}`, { id: "network-switch" });
      console.log(`Successfully switched to ${targetNetwork} (${networkType}, chainId: ${networkChainId})`);
      
      setIsNetworkSwitching(false);
      return true;
    } catch (error) {
      console.error("Failed to switch network:", error);
      setIsNetworkSwitching(false);
      toast.error(`Failed to switch to ${getNetworkName(networkChainId)}. Please switch manually.`, { id: "network-switch" });
      return false;
    }
  }, [isCorrectNetwork, switchToChain, networkChainId, getNetworkName, isTestnet]);

  // Check if approval is needed and update state
  const checkAndUpdateApprovalNeeded = useCallback((stakeAmount: string) => {
    try {
      // If no amount or zero amount, no approval needed
      if (!stakeAmount || stakeAmount === '0' || parseFloat(stakeAmount) <= 0) {
        setNeedsApproval(false);
        console.log("Zero or invalid amount - no approval needed");
        return false;
      }
      
      // If no allowance data yet, wait for it
      if (allowance === undefined || !tokenAddress || !contractAddress) {
        const missingData = [];
        if (allowance === undefined) missingData.push("allowance");
        if (!tokenAddress) missingData.push("tokenAddress");
        if (!contractAddress) missingData.push("contractAddress");
        
        console.log(`Waiting for data: ${missingData.join(", ")}. Chain: ${networkChainId}, isTestnet: ${isTestnet}`);
        
        // FIXED: Don't aggressively assume approval is needed when data is loading
        // This was causing the UI to get stuck in "approve" state even after successful approval
        // Instead, we wait for the actual allowance data to load
        // The UI will show "loading" or "waiting for data" state instead of "needs approval"
        console.log("Data still loading - waiting for allowance data before determining approval status");
        
        // Return true to indicate we're still checking, but don't set needsApproval state yet
        // This prevents the UI from incorrectly showing "Approve" button
        return allowance === undefined; // Return true if still loading
      }
      
      const parsedAmount = parseEther(stakeAmount);
      const currentAllowance = allowance || BigInt(0);
      
      // Standard approval check for all networks (including Base)
      // Fixed: Use the same logic for all networks to avoid Base network issues
      const approvalNeeded = currentAllowance < parsedAmount;
      
      console.log(`Approval check on ${isTestnet ? 'testnet' : 'mainnet'} (chain ${networkChainId}):`, {
        parsedAmount: parsedAmount.toString(),
        currentAllowance: currentAllowance.toString(),
        formattedAmount: formatEther(parsedAmount),
        formattedAllowance: formatEther(currentAllowance),
        needsApproval: approvalNeeded,
        tokenAddress,
        contractAddress,
        networkName: networkChainId === 8453 ? 'Base' : networkChainId === 42161 ? 'Arbitrum' : 'Unknown'
      });
      
      setNeedsApproval(approvalNeeded);
      return approvalNeeded;
    } catch (error) {
      console.error("Error checking approval:", error);
      return true; // Assume approval needed on error
    }
  }, [allowance, tokenAddress, contractAddress, networkChainId, isTestnet]);

  // Handle token approval
  const handleApprove = useCallback(async (amount: string) => {
    console.log("Approval request with parameters:", {
      tokenAddress,
      contractAddress,
      networkChainId,
      amount
    });

    if (!tokenAddress) {
      console.error("Cannot approve: Token address is missing");
      toast.error("Cannot approve: Token address is missing. Please try refreshing the page.");
      return false;
    }

    if (!contractAddress) {
      console.error("Cannot approve: Contract address is missing");
      toast.error("Cannot approve: Contract address is missing. Please try refreshing the page.");
      return false;
    }

    try {
      // Parse the amount to approve
      const parsedAmount = parseEther(amount);
      
      // Use exact amount requested by user for all networks
      const approvalAmount = parsedAmount;
      
      console.log(`Using exact approval amount:`, {
        requestedAmount: formatEther(parsedAmount),
        approvalAmount: formatEther(approvalAmount)
      });
      
      console.log(`Requesting approval for ${formatEther(approvalAmount)} ${tokenSymbol} to ${contractAddress}`);
      console.log("Using token contract:", tokenAddress);

      writeApprove({
        address: tokenAddress,
        abi: ERC20Abi,
        functionName: 'approve',
        args: [contractAddress, approvalAmount],
        chainId: networkChainId,
      });
      
      return true;
    } catch (error) {
      console.error("Error in approval call:", error);
      toast.error("Approval request failed: " + (error instanceof Error ? error.message : "Unknown error"));
      return false;
    }
  }, [tokenAddress, contractAddress, networkChainId, writeApprove, tokenSymbol]);

  // Handle staking
  const handleStake = useCallback(async (amount: string) => {
    if (!connectedAddress || !isCorrectNetwork()) {
      toast.error("Cannot stake: Wallet or network issue.");
      return false;
    }
    
    if (!contractAddress) {
      toast.error("Builder contract address not found.");
      return false;
    }

    if (!subnetId) {
      toast.error("Subnet ID is required for staking.");
      return false;
    }

    try {
      const parsedAmount = parseEther(amount);
      
      // Check if user has enough balance
      const userBalance = tokenBalance || BigInt(0);
      if (userBalance < parsedAmount) {
        toast.error(`Insufficient balance. You have ${formatEther(userBalance)} ${tokenSymbol}.`);
        return false;
      }
      
      // Different staking function for testnet vs mainnet
      if (isTestnet) {
        // For testnet using BuilderSubnetsV2
        const now = Math.floor(Date.now() / 1000);
        
        // Use the subnet-specific lock period if provided, otherwise default to 30 days
        const lockPeriod = lockPeriodInSeconds || (30 * 24 * 60 * 60); // Default to 30 days in seconds
        console.log(`Using lock period: ${lockPeriod} seconds (${formatTimePeriod(lockPeriod)})`);
        
        const lockEndTimestamp = BigInt(now + lockPeriod);
        
        // Explicitly convert to uint128 by ensuring it's within range
        const claimLockEndUint128 = lockEndTimestamp & BigInt("0xFFFFFFFFFFFFFFFF"); // Mask to uint128 range
        
        // Verify the contract address is the one from the networks.ts config
        const expectedContractAddress = getChainById(networkChainId, 'testnet')?.contracts?.builders?.address;
        
        console.log("Testnet staking transaction parameters:", {
          subnetId,
          stakerAddress: connectedAddress,
          amount: parsedAmount.toString(),
          formattedAmount: formatEther(parsedAmount),
          lockPeriodInSeconds: lockPeriod,
          claimLockEnd: claimLockEndUint128.toString(),
          formattedLockEnd: new Date(Number(claimLockEndUint128) * 1000).toISOString(),
          contractAddress,
          expectedContractAddress,
          chainId: networkChainId
        });
        
        // Ensure we're using the correct contract address
        if (expectedContractAddress && contractAddress.toLowerCase() !== expectedContractAddress.toLowerCase()) {
          console.warn(`Contract address mismatch! Using ${contractAddress} but expected ${expectedContractAddress}`);
        }
        
        // Make sure the subnetId is properly formatted as bytes32
        if (!subnetId.startsWith('0x') || subnetId.length !== 66) {
          console.warn(`SubnetId format may be incorrect: ${subnetId}`);
        }
        
        // Optimize gas settings for Arbitrum Sepolia
        const gasConfig = networkChainId === 421614 ? {
          gas: BigInt(3000000), // Fixed gas limit to avoid over-estimation
          gasPrice: undefined   // Let Arbitrum estimate the gas price
        } : {};
        
        writeStake({
          address: contractAddress,
          abi: BuilderSubnetsV2Abi,
          functionName: 'stake',
          args: [
            subnetId, 
            connectedAddress, 
            parsedAmount,
            claimLockEndUint128
          ],
          chainId: networkChainId,
          ...gasConfig
        });
      } else {
        // For mainnet using BuilderSubnets
        // Get the network name for clearer logging
        const networkName = networkChainId === 42161 ? 'Arbitrum' : 'Base';
        
        console.log(`Mainnet staking transaction parameters (${networkName}):`, {
          builderPoolId: subnetId, // Log this to debug
          amount: parsedAmount.toString(),
          formattedAmount: formatEther(parsedAmount),
          contractAddress,
          chainId: networkChainId,
          networkName
        });
        
        // For mainnet, we need to use deposit(bytes32,uint256) from BuildersAbi
        // Mainnet uses a different contract interface: Builders.json
        writeStake({
          address: contractAddress,
          abi: BuildersAbi, // Changed from BuilderSubnetsAbi to BuildersAbi
          functionName: 'deposit', // Changed from 'stake' to 'deposit'
          args: [subnetId, parsedAmount], // Changed to include subnetId
          chainId: networkChainId,
        });
      }
      
      return true;
    } catch (error) {
      console.error("Error in handleStake:", error);
      toast.error(`Failed to stake: ${error instanceof Error ? error.message : "Unknown error"}`);
      return false;
    }
  }, [connectedAddress, isCorrectNetwork, contractAddress, subnetId, tokenBalance, networkChainId, isTestnet, tokenSymbol, writeStake, getChainById, lockPeriodInSeconds]);

  // Handle withdraw
  const handleWithdraw = useCallback(async (amount: string) => {
    if (!connectedAddress || !isCorrectNetwork()) {
      toast.error("Cannot withdraw: Wallet or network issue.");
      return false;
    }
    
    if (!contractAddress) {
      toast.error("Builder contract address not found.");
      return false;
    }

    if (!subnetId) {
      toast.error("Subnet ID is required for withdrawing.");
      return false;
    }

    try {
      const parsedAmount = parseEther(amount);
      
      // Get network name for better logging
      const networkType = isTestnet ? 'testnet' : 'mainnet';
      const networkName = isTestnet ? 'Arbitrum Sepolia' : 
                         (networkChainId === 42161 ? 'Arbitrum' : 'Base');
      
      console.log(`${networkType.charAt(0).toUpperCase() + networkType.slice(1)} withdrawal transaction parameters (${networkName}):`, {
        subnetId,
        amount: parsedAmount.toString(),
        formattedAmount: formatEther(parsedAmount),
        contractAddress,
        chainId: networkChainId,
        networkName
      });
      
      // Both testnet (V2) and mainnet contracts use the same withdraw interface
      // withdraw(bytes32 subnetId_, uint256 amount_)
      writeWithdraw({
        address: contractAddress,
        abi: isTestnet ? BuilderSubnetsV2Abi : BuildersAbi, // Use BuildersAbi for mainnet
        functionName: 'withdraw',
        args: [subnetId, parsedAmount],
        chainId: networkChainId,
      });
      
      return true;
    } catch (error) {
      console.error("Error in handleWithdraw:", error);
      toast.error(`Failed to withdraw: ${error instanceof Error ? error.message : "Unknown error"}`);
      return false;
    }
  }, [connectedAddress, isCorrectNetwork, contractAddress, subnetId, networkChainId, isTestnet, writeWithdraw]);

  // Handle claim
  const handleClaim = useCallback(async () => {
    if (!connectedAddress || !isCorrectNetwork()) {
      toast.error("Cannot claim: Wallet or network issue.");
      return false;
    }
    
    if (!contractAddress) {
      toast.error("Builder contract address not found.");
      return false;
    }

    if (!subnetId) {
      toast.error("Subnet ID is required for claiming.");
      return false;
    }

    try {
      // Get network name for better logging
      const networkType = isTestnet ? 'testnet' : 'mainnet';
      const networkName = isTestnet ? 'Arbitrum Sepolia' : 
                         (networkChainId === 42161 ? 'Arbitrum' : 'Base');
      
      console.log(`${networkType.charAt(0).toUpperCase() + networkType.slice(1)} claim transaction parameters (${networkName}):`, {
        subnetId,
        contractAddress,
        chainId: networkChainId,
        networkName,
        connectedAddress
      });
      
      // Different claim function signatures for testnet vs mainnet
      if (isTestnet) {
        // Testnet: claim(bytes32 subnetId_, address stakerAddress_)
        writeClaim({
          address: contractAddress,
          abi: BuilderSubnetsV2Abi,
          functionName: 'claim',
          args: [subnetId, connectedAddress],
          chainId: networkChainId,
        });
      } else {
        // Mainnet: claim(bytes32 builderPoolId_, address receiver_)
        writeClaim({
          address: contractAddress,
          abi: BuildersAbi,
          functionName: 'claim',
          args: [subnetId, connectedAddress],
          chainId: networkChainId,
        });
      }
      
      return true;
    } catch (error) {
      console.error("Error in handleClaim:", error);
      toast.error(`Failed to claim: ${error instanceof Error ? error.message : "Unknown error"}`);
      return false;
    }
  }, [connectedAddress, isCorrectNetwork, contractAddress, subnetId, networkChainId, isTestnet, writeClaim]);

  // Manual refresh function for allowance - useful for Safe wallet users
  const manualRefreshAllowance = useCallback(async () => {
    console.log("Manual allowance refresh triggered...");
    try {
      const result = await refetchAllowance();
      if (result.data !== undefined) {
        const currentAllowance = result.data as bigint;
        console.log(`✅ Manual refresh: Allowance = ${formatEther(currentAllowance)} ${tokenSymbol}`);
        setAllowance(currentAllowance);
        
        // Also update needsApproval state if we have a pending amount to check
        return currentAllowance;
      }
      return undefined;
    } catch (error) {
      console.error("Error in manual allowance refresh:", error);
      return undefined;
    }
  }, [refetchAllowance, tokenSymbol]);

  return {
    // State
    isCorrectNetwork,
    isNetworkSwitching,
    tokenSymbol,
    tokenBalance,
    needsApproval,
    isLoadingData,
    isApproving,
    isStaking,
    isWithdrawing,
    isClaiming,
    isAnyTxPending,
    isSubmitting,
    allowance,
    claimableAmount: claimableAmountData as bigint | undefined,
    // Format helpers
    formatBalance,
    getNetworkName,
    // Actions
    handleNetworkSwitch,
    handleApprove,
    handleStake,
    handleWithdraw,
    handleClaim,
    checkAndUpdateApprovalNeeded,
    // Refetch functions
    refetchClaimableAmount,
    manualRefreshAllowance,
  };
};

export default useStakingContractInteractions; 