import { useCallback, useEffect, useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { useWaitForTransactionReceipt, useWriteContract, useReadContract } from 'wagmi';
import { parseEther, formatEther, Address, isAddress } from 'viem';
import { toast } from "sonner";
import { getSafeWalletUrlIfApplicable } from "@/lib/utils/safe-wallet-detection";
import { useNetwork } from "@/context/network-context";
import { baseSepolia, base, arbitrum } from 'wagmi/chains';

// Import the ABIs
import BuildersV4Abi from '@/app/abi/BuildersV4.json';
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
  const isTestnet = networkChainId === baseSepolia.id;
  
  // Determine if we're using BuildersV4 (testnet, Base mainnet, or Arbitrum mainnet)
  const isBuildersV4 = isTestnet || networkChainId === base.id || networkChainId === arbitrum.id;
  
  // Helper Functions
  const isCorrectNetwork = useCallback(() => {
    return typeof walletChainId === 'number' && walletChainId === networkChainId;
  }, [walletChainId, networkChainId]);

  const getAbi = useCallback(() => {
    // BuildersV4 (testnet, Base mainnet, Arbitrum mainnet) uses BuildersV4Abi
    // Legacy mainnet networks use BuilderSubnetsAbi
    return isBuildersV4 ? BuildersV4Abi : BuilderSubnetsAbi;
  }, [isBuildersV4]);

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
       retry: networkChainId === 8453 ? 3 : 1, // More retries for Base network
    }
  });

  // Get claimable amount - BuildersV4 uses getCurrentSubnetRewards, Builders uses getCurrentBuilderReward
  // Base and Arbitrum mainnet now use BuildersV4, so they use getCurrentSubnetRewards
  const { data: claimableAmountData, refetch: refetchClaimableAmount, isFetching: isFetchingClaimableAmount } = useReadContract({
    address: contractAddress,
    abi: isBuildersV4 ? BuildersV4Abi : BuildersAbi,
    functionName: isBuildersV4 ? 'getCurrentSubnetRewards' : 'getCurrentBuilderReward',
    args: [subnetId!], // Both testnet and mainnet take subnetId/builderPoolId as single argument
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
    }
  }, [morTokenAddressData, tokenSymbolData, balanceData, allowanceData, networkChainId]);

  // Update loading state for token data, balance, and allowance
  useEffect(() => {
    setIsLoadingData(isFetchingToken || isFetchingSymbol || isFetchingBalance || isFetchingAllowance || isFetchingClaimableAmount);
  }, [isFetchingToken, isFetchingSymbol, isFetchingBalance, isFetchingAllowance, isFetchingClaimableAmount]);

  // Handle Approval Transaction Notifications
  useEffect(() => {
    if (isApprovePending && !isApproveTxSuccess && !approveError) {
      showEnhancedLoadingToast("Confirm approval in wallet...", "approval-tx");
    }
    if (isApproveTxSuccess) {
      toast.dismiss("approval-tx");
      toast.success("Approval successful!", { id: "approval-tx" });
      
      // Improved allowance refresh for Base network and all networks
      // Add a delay to ensure blockchain state is updated
      const refreshAllowanceWithDelay = () => {
        setTimeout(() => {
          console.log("Refreshing allowance after successful approval...");
          refetchAllowance().then(() => {
            console.log("Successfully refreshed allowance after approval");
          }).catch((error: unknown) => {
            console.error("Error refreshing allowance after approval:", error);
          });
        }, 2000); // 2 second delay for Base network compatibility
      };
      
      refreshAllowanceWithDelay();
      resetApproveContract();
    }
    if (approveError) {
      toast.dismiss("approval-tx");
      const errorMsg = approveError?.message || "Approval failed.";
      let displayError = errorMsg.split('(')[0].trim();
      const detailsMatch = errorMsg.match(/(?:Details|Reason): (.*?)(?:\\n|\.|$)/i);
      if (detailsMatch && detailsMatch[1]) displayError = detailsMatch[1].trim();
      toast.error("Approval Failed", { id: "approval-tx", description: displayError });
      resetApproveContract();
    }
  }, [isApprovePending, isApproveTxSuccess, approveError, resetApproveContract, refetchAllowance, showEnhancedLoadingToast]);

  // Handle Staking Transaction Notifications
  useEffect(() => {
    if (isStakePending && !isStakeTxSuccess && !stakeError) {
      showEnhancedLoadingToast("Confirm staking in wallet...", "stake-tx");
    }
    if (isStakeTxSuccess) {
      toast.dismiss("stake-tx");
      toast.success("Successfully staked tokens!", {
        id: "stake-tx",
        description: `Tx: ${stakeTxResult?.substring(0, 10)}...`,
        action: {
          label: "View on Explorer",
          onClick: () => {
            const chain = getChainById(networkChainId, isTestnet ? 'testnet' : 'mainnet');
            const explorerUrl = chain?.blockExplorers?.default.url;
            if (explorerUrl && stakeTxResult) {
              window.open(`${explorerUrl}/tx/${stakeTxResult}`, "_blank");
            }
          }
        }
      });
      resetStakeContract();
      // Refresh balance and allowance after staking
      refetchBalance();
      refetchAllowance();
      if (onTxSuccess) {
        onTxSuccess();
      }
    }
    if (stakeError) {
      toast.dismiss("stake-tx");
      const errorMsg = stakeError?.message || "Staking failed.";
      let displayError = errorMsg.split('(')[0].trim();
      const detailsMatch = errorMsg.match(/(?:Details|Reason): (.*?)(?:\\n|\.|$)/i);
      if (detailsMatch && detailsMatch[1]) displayError = detailsMatch[1].trim();
      toast.error("Staking Failed", { id: "stake-tx", description: displayError });
      resetStakeContract();
    }
  }, [isStakePending, isStakeTxSuccess, stakeTxResult, stakeError, resetStakeContract, onTxSuccess, refetchBalance, refetchAllowance, networkChainId, isTestnet, showEnhancedLoadingToast, getChainById]);

  // Handle Withdrawal Transaction Notifications
  useEffect(() => {
    if (isWithdrawPending && !isWithdrawTxSuccess && !withdrawError) {
      showEnhancedLoadingToast("Confirm withdrawal in wallet...", "withdraw-tx");
    }
    if (isWithdrawTxSuccess) {
      toast.dismiss("withdraw-tx");
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
      toast.dismiss("withdraw-tx");
      const errorMsg = withdrawError?.message || "Withdrawal failed.";
      let displayError = errorMsg.split('(')[0].trim();
      const detailsMatch = errorMsg.match(/(?:Details|Reason): (.*?)(?:\\n|\.|$)/i);
      if (detailsMatch && detailsMatch[1]) displayError = detailsMatch[1].trim();
      toast.error("Withdrawal Failed", { id: "withdraw-tx", description: displayError });
      resetWithdrawContract();
    }
  }, [isWithdrawPending, isWithdrawTxSuccess, withdrawTxResult, withdrawError, resetWithdrawContract, onTxSuccess, refetchBalance, networkChainId, isTestnet, showEnhancedLoadingToast, getChainById]);

  // Handle Claim Transaction Notifications
  useEffect(() => {
    if (isClaimPending && !isClaimTxSuccess && !claimError) {
      showEnhancedLoadingToast("Confirm claim in wallet...", "claim-tx");
    }
    if (isClaimTxSuccess) {
      toast.dismiss("claim-tx");
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
      toast.dismiss("claim-tx");
      const errorMsg = claimError?.message || "Claim failed.";
      let displayError = errorMsg.split('(')[0].trim();
      const detailsMatch = errorMsg.match(/(?:Details|Reason): (.*?)(?:\\n|\.|$)/i);
      if (detailsMatch && detailsMatch[1]) displayError = detailsMatch[1].trim();
      toast.error("Claim Failed", { id: "claim-tx", description: displayError });
      resetClaimContract();
    }
  }, [isClaimPending, isClaimTxSuccess, claimTxResult, claimError, resetClaimContract, onTxSuccess, refetchBalance, refetchClaimableAmount, networkChainId, isTestnet, showEnhancedLoadingToast, getChainById]);

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
        
        // IMPORTANT: For mainnet, assume approval is needed when data is missing
        if (!isTestnet) {
          console.log("Mainnet with missing data - assuming approval needed");
          setNeedsApproval(true);
          return true;
        }
        
        return true; // Assume approval needed while loading
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
      
      // BuildersV4 uses deposit() like mainnet, so we can unify the logic
      const networkName = isTestnet ? 'Base Sepolia' : 
                         (networkChainId === 42161 ? 'Arbitrum' : 'Base');
      
      console.log(`Staking transaction parameters (${networkName}):`, {
        builderPoolId: subnetId,
        amount: parsedAmount.toString(),
        formattedAmount: formatEther(parsedAmount),
        contractAddress,
        chainId: networkChainId,
        networkName
      });
      
      // BuildersV4 (testnet, Base mainnet, Arbitrum mainnet) and legacy Builders use deposit(bytes32,uint256)
      writeStake({
        address: contractAddress,
        abi: isBuildersV4 ? BuildersV4Abi : BuildersAbi,
        functionName: 'deposit',
        args: [subnetId, parsedAmount],
        chainId: networkChainId,
      });
      
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
      const networkName = isTestnet ? 'Base Sepolia' : 
                         (networkChainId === 42161 ? 'Arbitrum' : 'Base');
      
      console.log(`${networkType.charAt(0).toUpperCase() + networkType.slice(1)} withdrawal transaction parameters (${networkName}):`, {
        subnetId,
        amount: parsedAmount.toString(),
        formattedAmount: formatEther(parsedAmount),
        contractAddress,
        chainId: networkChainId,
        networkName
      });
      
      // BuildersV4 (testnet, Base mainnet, Arbitrum mainnet) and legacy Builders use the same withdraw interface
      // withdraw(bytes32 subnetId_, uint256 amount_)
      writeWithdraw({
        address: contractAddress,
        abi: isBuildersV4 ? BuildersV4Abi : BuildersAbi,
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
      const networkName = isTestnet ? 'Base Sepolia' : 
                         (networkChainId === 42161 ? 'Arbitrum' : 'Base');
      
      console.log(`${networkType.charAt(0).toUpperCase() + networkType.slice(1)} claim transaction parameters (${networkName}):`, {
        subnetId,
        contractAddress,
        chainId: networkChainId,
        networkName,
        connectedAddress
      });
      
      // BuildersV4 (testnet, Base mainnet, Arbitrum mainnet) and legacy Builders use the same claim signature
      // claim(bytes32 subnetId_, address receiver_)
      writeClaim({
        address: contractAddress,
        abi: isBuildersV4 ? BuildersV4Abi : BuildersAbi,
        functionName: 'claim',
        args: [subnetId, connectedAddress],
        chainId: networkChainId,
      });
      
      return true;
    } catch (error) {
      console.error("Error in handleClaim:", error);
      toast.error(`Failed to claim: ${error instanceof Error ? error.message : "Unknown error"}`);
      return false;
    }
  }, [connectedAddress, isCorrectNetwork, contractAddress, subnetId, networkChainId, isTestnet, writeClaim]);

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
    refetchAllowance,
  };
};

export default useStakingContractInteractions; 