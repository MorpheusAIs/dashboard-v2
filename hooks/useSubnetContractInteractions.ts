import { useCallback, useEffect, useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { useWaitForTransactionReceipt, useWriteContract, useReadContract } from 'wagmi';
import { parseEther, formatEther, Address, isAddress } from 'viem';
import { toast } from "sonner";
import { getSafeWalletUrlIfApplicable } from "@/lib/utils/safe-wallet-detection";
import { useNetwork } from "@/context/network-context";
import { base, baseSepolia } from 'wagmi/chains'; // Import chains

// Import the ABIs
import BuildersV4Abi from '@/app/abi/BuildersV4.json';
import ERC20Abi from '@/app/abi/ERC20.json';

// Import constants
import { SUPPORTED_CHAINS, FALLBACK_TOKEN_ADDRESS, DEFAULT_TOKEN_SYMBOL } from '@/components/subnet-form/utils/constants';
import { FormData } from '@/components/subnet-form/types/schemas';
import { BuildersService } from '@/app/services/builders.service'; // Import BuildersService
import { BuilderDB } from '@/app/lib/supabase'; // Import BuilderDB type
import { useNewlyCreatedSubnets } from '@/app/hooks/useNewlyCreatedSubnets'; // Import the new hook

export interface UseSubnetContractInteractionsProps {
  selectedChainId: number;
  onTxSuccess?: () => void;
}

export const useSubnetContractInteractions = ({ 
  selectedChainId,
  onTxSuccess
}: UseSubnetContractInteractionsProps) => {
  // Basic state
  const [isNetworkSwitching, setIsNetworkSwitching] = useState(false);
  const [creationFee, setCreationFee] = useState<bigint | undefined>(undefined);
  const [tokenAddress, setTokenAddress] = useState<Address | undefined>(undefined);
  const [tokenSymbol, setTokenSymbol] = useState<string>(DEFAULT_TOKEN_SYMBOL);
  const [allowance, setAllowance] = useState<bigint | undefined>(undefined);
  const [needsApproval, setNeedsApproval] = useState<boolean>(false);
  const [isLoadingFeeData, setIsLoadingFeeData] = useState<boolean>(true);

  // Hooks
  const { address: connectedAddress } = useAccount();
  const walletChainId = useChainId();
  const { switchToChain } = useNetwork();
  const { addNewlyCreatedSubnet } = useNewlyCreatedSubnets();

  // Helper Functions
  const isCorrectNetwork = useCallback(() => {
    return typeof walletChainId === 'number' && walletChainId === selectedChainId;
  }, [walletChainId, selectedChainId]);

  const getBuilderContractAddress = useCallback((): Address | undefined => {
    const chainConfig = SUPPORTED_CHAINS[selectedChainId];
    const addr = chainConfig?.contracts?.builders?.address;
    return addr && isAddress(addr) ? addr : undefined;
  }, [selectedChainId]);

  const builderContractAddress = getBuilderContractAddress();

  const getNetworkName = useCallback((chainId: number): string => {
    const chain = SUPPORTED_CHAINS[chainId];
    return chain?.name ?? `Network ID ${chainId}`;
  }, []);

  // Helper function to show enhanced toast with Safe wallet link if applicable
  const showEnhancedLoadingToast = useCallback(async (message: string, toastId: string) => {
    if (connectedAddress && selectedChainId) {
      try {
        const safeWalletUrl = await getSafeWalletUrlIfApplicable(connectedAddress, selectedChainId);
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
  }, [connectedAddress, selectedChainId]);


  const formatCreationFee = useCallback(() => {
    if (creationFee === undefined) return "Loading...";
    if (creationFee === BigInt(0)) return `0 ${tokenSymbol}`;
    return `${formatEther(creationFee)} ${tokenSymbol}`;
  }, [creationFee, tokenSymbol]);

  // Contract Read Hooks
  // Note: BuildersV4 uses depositToken() instead of token()
  const { data: morTokenAddressData, isFetching: isFetchingToken } = useReadContract({
    address: builderContractAddress,
    abi: BuildersV4Abi,
    functionName: 'depositToken',
    chainId: selectedChainId,
    query: {
       enabled: isCorrectNetwork() && !!builderContractAddress && selectedChainId === baseSepolia.id,
    }
  });

  const { data: tokenSymbolData, isFetching: isFetchingSymbol } = useReadContract({
    address: tokenAddress,
    abi: ERC20Abi,
    functionName: 'symbol',
    chainId: selectedChainId,
    query: {
       enabled: isCorrectNetwork() && !!tokenAddress,
    }
  });

  const { data: allowanceData, refetch: refetchAllowance, isFetching: isFetchingAllowance } = useReadContract({
    address: tokenAddress || FALLBACK_TOKEN_ADDRESS,
    abi: ERC20Abi,
    functionName: 'allowance',
    args: [connectedAddress!, builderContractAddress!],
    chainId: selectedChainId,
    query: {
       enabled: isCorrectNetwork() && !!tokenAddress && !!connectedAddress && !!builderContractAddress,
    }
  });

  // Contract Write Hooks
  const { data: writeTxResult, writeContract, isPending: isWritePending, error: writeError, reset: resetWriteContract } = useWriteContract({
    mutation: {
      onError: (error) => {
        console.error("[SubnetCreation] Detailed contract write error:", error);
        console.error("[SubnetCreation] Error type:", error?.constructor?.name);
        console.error("[SubnetCreation] Error stack:", error?.stack);
        console.error("[SubnetCreation] Selected chain ID:", selectedChainId);
        console.error("[SubnetCreation] Builder contract address:", builderContractAddress);
        console.error("[SubnetCreation] Connected address:", connectedAddress);
        console.error("[SubnetCreation] Is correct network:", isCorrectNetwork());

        let errorMessage = "Unknown error";

        if (error instanceof Error) {
          errorMessage = error.message;
          console.error("[SubnetCreation] Raw error message:", errorMessage);

          // Try to extract the revert reason if available
          const revertMatch = errorMessage.match(/reverted with reason string '([^']*)'/);
          if (revertMatch && revertMatch[1]) {
            errorMessage = `Contract reverted: ${revertMatch[1]}`;
            console.error("[SubnetCreation] Extracted revert reason:", revertMatch[1]);
          }

          // Extract gas errors
          if (errorMessage.includes("gas")) {
            errorMessage = "Transaction would exceed gas limits. The contract function may be failing or incompatible.";
            console.error("[SubnetCreation] Gas-related error detected");
          }

          // Check for common RPC errors
          if (errorMessage.includes("Internal JSON-RPC error")) {
            errorMessage = "Network RPC error. This may be due to network congestion or a temporary issue. Please try again.";
            console.error("[SubnetCreation] Internal JSON-RPC error detected");
          }
        }

        toast.error("Contract Interaction Failed", {
          id: "subnet-tx",
          description: errorMessage,
          duration: 10000, // Show for 10 seconds instead of default
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
          description: errorMessage,
          duration: 10000, // Show for 10 seconds instead of default
        });
      }
    }
  });

  // Transaction Receipt Hooks
  const { isLoading: isWriteTxLoading, isSuccess: isWriteTxSuccess, isError: isWriteTxError } = useWaitForTransactionReceipt({ 
    hash: writeTxResult,
    timeout: 60_000, // Add a 60-second timeout
  });
  const { isLoading: isApproveTxLoading, isSuccess: isApproveTxSuccess } = useWaitForTransactionReceipt({ 
    hash: approveTxResult,
    timeout: 60_000, // Add a 60-second timeout
  });

  // Store form data temporarily when submit is called
  const [submittedFormData, setSubmittedFormData] = useState<FormData | null>(null);

  // Combined Loading States
  const isApproving = isApprovePending || isApproveTxLoading;
  const isCreating = isWritePending || isWriteTxLoading;
  const isAnyTxPending = isApproving || isCreating;
  const isSubmitting = isAnyTxPending || isNetworkSwitching;

  // Effects
  useEffect(() => {
    // Set a default creation fee depending on network (0 on mainnets)
    const defaultFee = selectedChainId === base.id ? BigInt(0) : parseEther("0.1");
    console.log("Setting default creation fee:", defaultFee.toString());
    setCreationFee(defaultFee);
    
    if (isCorrectNetwork()) {
      // Try to get token address from contract first
      if (morTokenAddressData && isAddress(morTokenAddressData as string)) {
        console.log("Using token address from contract:", morTokenAddressData);
        setTokenAddress(morTokenAddressData as Address);
      } 
      // Otherwise use the configured token address from networks.ts
      else {
        const chainConfig = SUPPORTED_CHAINS[selectedChainId];
        const configuredTokenAddress = chainConfig?.contracts?.morToken?.address;

        if (configuredTokenAddress) {
          console.log("Using token address from config:", configuredTokenAddress);
          // Skip checksum validation by lowercasing
          setTokenAddress(configuredTokenAddress.toLowerCase() as Address);
        } else if (selectedChainId === baseSepolia.id) {
          // Only use fallback on Base Sepolia testnet
          console.log("Using fallback token address (Base Sepolia testnet):", FALLBACK_TOKEN_ADDRESS);
          setTokenAddress(FALLBACK_TOKEN_ADDRESS);
        } else {
          console.error("Token address not configured for chain", selectedChainId);
          toast.error("Token address missing for this network. Please update configuration.");
        }
      }
    }
    
    setIsLoadingFeeData(false);
  }, [isCorrectNetwork, builderContractAddress, morTokenAddressData, selectedChainId]);

  // Update state variables from read hook data
  useEffect(() => {
    if (morTokenAddressData && isAddress(morTokenAddressData as string)) {
      console.log("Token address from contract:", morTokenAddressData);
      setTokenAddress(morTokenAddressData as Address);
    }
    if (tokenSymbolData) {
      setTokenSymbol(tokenSymbolData as string);
    }
    if (allowanceData !== undefined) {
      setAllowance(allowanceData as bigint);
    }
  }, [morTokenAddressData, tokenSymbolData, allowanceData]);

  // Determine if approval is needed based on fee and allowance
  useEffect(() => {
    const checkNeedsApproval = () => {
      // If creation fee is 0 (mainnet), no approval needed
      if (!creationFee || creationFee === BigInt(0)) {
        console.log("No approval needed - creation fee is 0 (likely mainnet)");
        return false;
      }
      
      const effectiveAllowance = allowance || BigInt(0);
      const needsApproval = effectiveAllowance < creationFee;
      
      console.log("Checking approval needs:", {
        creationFee: creationFee.toString(),
        effectiveAllowance: effectiveAllowance.toString(),
        needsApproval
      });
      
      return needsApproval;
    };
    
    setNeedsApproval(checkNeedsApproval());
  }, [creationFee, allowance]);

  // Refetch allowance when key dependencies change
  useEffect(() => {
    if (isCorrectNetwork() && tokenAddress && connectedAddress && builderContractAddress) {
      console.log("Refetching allowance...");
      refetchAllowance();
    }
  }, [
    isCorrectNetwork,
    tokenAddress,
    connectedAddress,
    builderContractAddress,
    refetchAllowance,
    selectedChainId
  ]);

  // Handle Approval Transaction Notifications
  useEffect(() => {
    if (isApprovePending && !isApproveTxSuccess && !approveError) {
      showEnhancedLoadingToast("Confirm approval in wallet...", "approval-tx");
    }
    if (isApproveTxSuccess) {
      toast.dismiss("approval-tx");
      toast.success("Approval successful!", { id: "approval-tx" });
      refetchAllowance();
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

  // Handle Subnet Creation Transaction Notifications
  useEffect(() => {
    console.log("[useSubnetContractInteractions] Transaction state changed:", {
      isWritePending,
      isWriteTxSuccess,
      isWriteTxError,
      isWriteTxLoading,
      writeTxResult,
      hasSubmittedFormData: !!submittedFormData,
      onTxSuccessExists: !!onTxSuccess
    });
    
    // Show loading toast when transaction is pending (user needs to sign) or when transaction hash is received
    if ((isWritePending || (writeTxResult && isWriteTxLoading)) && !isWriteTxSuccess && !writeError && !isWriteTxError) {
      const message = isWritePending ? "Confirm creation in wallet..." : "Creating subnet...";
      showEnhancedLoadingToast(message, "subnet-tx");
    }
    
    if (isWriteTxSuccess) {
      console.log("[useSubnetContractInteractions] Transaction successful! Processing...");
      toast.dismiss("subnet-tx");
      toast.success("Subnet created successfully!", {
        id: "subnet-tx",
        description: `Tx: ${writeTxResult?.substring(0, 10)}...`,
        duration: 5000,
      });

      resetWriteContract();
      
      // IMMEDIATELY populate cache before redirect (only for mainnet)
      const isMainnet = selectedChainId === base.id;
      console.log("[useSubnetContractInteractions] Is mainnet?", isMainnet, "Selected chain:", selectedChainId);
      
      if (isMainnet && submittedFormData && connectedAddress) {
        const networkName = getNetworkName(selectedChainId);
        console.log("[useSubnetContractInteractions] Populating cache BEFORE redirect with:", {
          subnetName: submittedFormData.subnet.name,
          networkName,
          connectedAddress,
          addNewlyCreatedSubnetExists: !!addNewlyCreatedSubnet
        });
        
        // Add to cache immediately so it's available for queries
        if (addNewlyCreatedSubnet) {
          addNewlyCreatedSubnet(submittedFormData.subnet.name, networkName, connectedAddress);
          console.log("[useSubnetContractInteractions] Cache populated BEFORE redirect");
        }
      }
      
      // Call onTxSuccess (redirect) - works for both Base and Base Sepolia
      if (onTxSuccess) {
        console.log("[useSubnetContractInteractions] Transaction successful, calling onTxSuccess");
        
        // Use a shorter delay for both networks since we want immediate feedback
        setTimeout(() => {
          console.log("[useSubnetContractInteractions] Executing redirect");
          onTxSuccess();
        }, 1500); // Consistent delay for both networks
      } else {
        console.warn("[useSubnetContractInteractions] onTxSuccess callback not provided - redirect will not happen");
      }
    }
    if (writeError) {
      toast.dismiss("subnet-tx");
      const errorMsg = writeError?.message || "Subnet creation failed.";
      let displayError = errorMsg.split('(')[0].trim();
      const detailsMatch = errorMsg.match(/(?:Details|Reason): (.*?)(?:\\n|\.|$)/i);
      if (detailsMatch && detailsMatch[1]) displayError = detailsMatch[1].trim();
      toast.error("Subnet Creation Failed", {
        id: "subnet-tx",
        description: displayError,
        duration: 15000, // Show for 15 seconds for critical errors
      });
      resetWriteContract();
      setSubmittedFormData(null); // Clear form data on error
    }
    // Add handler for transaction error/timeout
    if (isWriteTxError || (writeTxResult && !isWriteTxLoading && !isWriteTxSuccess && !isWritePending)) {
      toast.dismiss("subnet-tx");
      toast.error("Transaction Failed or Timed Out", {
        id: "subnet-tx",
        description: "The transaction may still be pending on the network. Check your wallet or block explorer for status.",
        duration: 20000, // Show for 20 seconds for timeout errors
        action: {
          label: "View on Explorer",
          onClick: () => {
            const explorerUrl = SUPPORTED_CHAINS[selectedChainId]?.blockExplorers?.default.url;
            if (explorerUrl && writeTxResult) {
              window.open(`${explorerUrl}/tx/${writeTxResult}`, "_blank");
            }
          }
        }
      });
      resetWriteContract();
    }
  }, [isWritePending, isWriteTxSuccess, isWriteTxError, isWriteTxLoading, writeTxResult, writeError, selectedChainId, resetWriteContract, onTxSuccess, showEnhancedLoadingToast, submittedFormData, connectedAddress, addNewlyCreatedSubnet, getNetworkName]);

  // Effect to handle Supabase insertion after successful transaction (only for non-v4 networks)
  useEffect(() => {
    console.log("[useSubnetContractInteractions] Supabase insertion effect triggered:", {
      isWriteTxSuccess,
      hasSubmittedFormData: !!submittedFormData,
      writeTxResult,
      onTxSuccessExists: !!onTxSuccess,
      selectedChainId
    });

    const insertIntoSupabase = async () => {
      if (isWriteTxSuccess && submittedFormData && writeTxResult) {
        const isV4Network = selectedChainId === base.id || selectedChainId === baseSepolia.id;
        console.log(`[useSubnetContractInteractions] Transaction successful (Tx: ${writeTxResult}). Checking network type...`, { selectedChainId, isV4Network });

        // Skip Supabase insertion for v4 networks (Base and Base Sepolia) since metadata is stored on-chain
        if (isV4Network) {
          console.log("[useSubnetContractInteractions] V4 network detected - skipping Supabase insertion (metadata stored on-chain)");
          // Clear submitted data - redirect already happened immediately after transaction
          setSubmittedFormData(null);
          return;
        }

        // Legacy Supabase insertion for non-v4 networks (if any exist in the future)
        const isMainnet = selectedChainId === base.id; // This will be false for v4 networks
        if (isMainnet) {
          const networkName = getNetworkName(selectedChainId);
          console.log(`[useSubnetContractInteractions] Legacy mainnet detected (${networkName}). Preparing data for Supabase...`);

          const newBuilderData: Partial<BuilderDB> = {
            name: submittedFormData.subnet.name,
            networks: [networkName], // Set network based on selectedChainId
            description: submittedFormData.metadata.description || null,
            long_description: submittedFormData.metadata.description || null, // Use description as long description for now
            image_src: submittedFormData.metadata.image || null,
            website: submittedFormData.metadata.website || null,
            discord_url: submittedFormData.projectOffChain?.discordLink || null,
            twitter_url: submittedFormData.projectOffChain?.twitterLink || null,
            // Assuming 'rewards' in projectOffChain maps to reward_types
            reward_types: submittedFormData.projectOffChain?.rewards?.map(r => r.value) || [],
            // Default other fields as they are not in the form
            tags: [],
            github_url: null,
            contributors: 0,
            github_stars: 0,
            reward_types_detail: [],
          };

          console.log("[useSubnetContractInteractions] Data to insert into Supabase:", newBuilderData);

          try {
            toast.info("Syncing project details with database...", { id: "supabase-sync" });
            await BuildersService.addBuilder(newBuilderData);
            toast.success("Project details synced successfully!", {
              id: "supabase-sync"
            });

            // Cache was already populated before redirect, so no need to add again
            console.log("[useSubnetContractInteractions] Supabase insertion successful, cache already populated");

          } catch (dbError) {
            console.error("[useSubnetContractInteractions] Supabase insertion failed:", dbError);
            toast.error("Failed to sync project details with database", { id: "supabase-sync" });
            // Don't block user experience if DB insert fails, cache and redirect already happened
            console.log("[useSubnetContractInteractions] Supabase insertion failed, but navigation already happened");
          }
        } else {
          console.log("[useSubnetContractInteractions] Not a mainnet chain, skipping Supabase insertion.");
        }

        // Clear submitted data - redirect already happened immediately after transaction
        console.log("[useSubnetContractInteractions] Supabase insertion complete, clearing form data");
        setSubmittedFormData(null);
      } else {
        console.log("[useSubnetContractInteractions] Supabase insertion effect triggered but conditions not met:", {
          isWriteTxSuccess,
          hasSubmittedFormData: !!submittedFormData,
          writeTxResult
        });
      }
    };

    insertIntoSupabase();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWriteTxSuccess, submittedFormData, selectedChainId, writeTxResult, getNetworkName, onTxSuccess, addNewlyCreatedSubnet, connectedAddress]); // Add dependencies

  // Update loading state for token data and allowance
  useEffect(() => {
    setIsLoadingFeeData(isFetchingToken || isFetchingSymbol || isFetchingAllowance);
  }, [isFetchingToken, isFetchingSymbol, isFetchingAllowance]);

  // Add this new useEffect after the transaction receipt hooks
  // Add a recovery timeout for stuck transactions
  useEffect(() => {
    let txTimeoutId: NodeJS.Timeout | null = null;
    
    // Start a timeout if we have a transaction hash and are waiting
    if (writeTxResult && isWriteTxLoading) {
      txTimeoutId = setTimeout(() => {
        // After 60 seconds, offer a way to continue even if the transaction receipt wasn't detected
        toast.warning("Transaction Taking Longer Than Expected", {
          id: "tx-stuck",
          description: "The transaction was submitted but confirmation is taking longer than expected.",
          action: {
            label: "Continue Anyway",
            onClick: () => {
              resetWriteContract();
              if (onTxSuccess) {
                toast.info("Redirecting...", { id: "tx-stuck" });
                onTxSuccess();
              }
            }
          },
          duration: 30000, // Show for 30 seconds
        });
      }, 60000); // 60 seconds
    }
    
    // Clear timeout on unmount or when state changes
    return () => {
      if (txTimeoutId) clearTimeout(txTimeoutId);
    };
  }, [writeTxResult, isWriteTxLoading, resetWriteContract, onTxSuccess]);

  // Check for Subnet Creation Fee - both Base and Base Sepolia use BuildersV4 contract
  const isV4Network = selectedChainId === base.id || selectedChainId === baseSepolia.id;
  const { data: subnetCreationFeeAmount } = useReadContract({
    address: builderContractAddress as Address,
    abi: BuildersV4Abi,
    functionName: 'subnetCreationFeeAmount',
    chainId: selectedChainId,
    query: {
      enabled: !!builderContractAddress && isV4Network, // Query on both Base and Base Sepolia
    }
  });

  useEffect(() => {
    if (isV4Network && subnetCreationFeeAmount !== undefined && subnetCreationFeeAmount !== null) {
      console.log("Subnet creation fee amount:", subnetCreationFeeAmount.toString());
      setCreationFee(subnetCreationFeeAmount as bigint);
    }
  }, [subnetCreationFeeAmount, isV4Network]);

  // Action Handlers
  const handleNetworkSwitch = useCallback(async () => {
    if (isCorrectNetwork()) return true;
    
    setIsNetworkSwitching(true);
    try {
      toast.loading(`Switching to ${getNetworkName(selectedChainId)}...`, { id: "network-switch" });
      await switchToChain(selectedChainId);
      toast.success(`Successfully switched to ${getNetworkName(selectedChainId)}`, { id: "network-switch" });
      setIsNetworkSwitching(false);
      return true;
    } catch (error) {
      console.error("Failed to switch network:", error);
      setIsNetworkSwitching(false);
      toast.error(`Failed to switch to ${getNetworkName(selectedChainId)}. Please switch manually.`, { id: "network-switch" });
      return false;
    }
  }, [isCorrectNetwork, switchToChain, selectedChainId, getNetworkName]);

  const handleApprove = useCallback(async () => {
    if (!isCorrectNetwork()) {
      toast.error("Please connect to the right network.");
      return;
    }

    if (!tokenAddress || !connectedAddress || !builderContractAddress) {
      toast.error("Missing required contract addresses for approval.");
      return;
    }

    // Safety check: Don't approve 0 tokens (causes "Remove permission" in MetaMask)
    if (!creationFee || creationFee === BigInt(0)) {
      console.error("Cannot approve 0 tokens - this would show 'Remove permission' in MetaMask");
      toast.error("No approval needed - creation fee is 0.");
      return;
    }

    try {
      console.log(`Approving ${creationFee.toString()} tokens for builder contract`);
      writeApprove({
        address: tokenAddress,
        abi: ERC20Abi,
        functionName: 'approve',
        args: [builderContractAddress, creationFee],
        chainId: selectedChainId,
        // Add explicit gas limit for Base Sepolia to prevent excessive estimates
        gas: selectedChainId === baseSepolia.id ? BigInt(400000) : undefined,
      });
    } catch (error) {
      console.error("Error preparing approve transaction:", error);
      toast.error("Error preparing approval: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  }, [isCorrectNetwork, tokenAddress, connectedAddress, builderContractAddress, writeApprove, creationFee, selectedChainId]);

  const handleCreateSubnet = async (formData: FormData) => {
    console.log("[SubnetCreation] handleCreateSubnet called with data:", formData);
    console.log("[SubnetCreation] Current selectedChainId:", selectedChainId);
    console.log("[SubnetCreation] Connected address:", connectedAddress);
    console.log("[SubnetCreation] Is correct network:", isCorrectNetwork());
    console.log("[SubnetCreation] Builder contract address:", builderContractAddress);
    console.log("[SubnetCreation] Creation fee:", creationFee?.toString());
    console.log("[SubnetCreation] Token address:", tokenAddress);
    console.log("[SubnetCreation] Token symbol:", tokenSymbol);
    console.log("[SubnetCreation] Needs approval:", needsApproval);

    // Store form data for later use (mainly for Supabase insertion on mainnet)
    setSubmittedFormData(formData);
    console.log("[SubnetCreation] Form data stored for later use");

    const isV4Network = selectedChainId === base.id || selectedChainId === baseSepolia.id;
    const isTestnet = selectedChainId === baseSepolia.id;
    console.log("[SubnetCreation] Is V4 network?", isV4Network, "Is testnet?", isTestnet);

    if (!connectedAddress || !isCorrectNetwork()) {
      console.error("[SubnetCreation] Cannot proceed: connectedAddress or network issue");
      toast.error("Cannot create builder subnet: Wallet or network issue.");
      return;
    }

    if (!builderContractAddress) {
      console.error("[SubnetCreation] Builder contract address not found");
      toast.error("Builder contract address not found. Please check network configuration.");
      return;
    }

    try {
      // Both Base and Base Sepolia use BuildersV4 with the same structure
      const subnetName = formData.subnet.name || `Subnet-${Date.now()}`;
      const subnetSlug = formData.metadata.slug || subnetName.toLowerCase().replace(/\s+/g, '-');

      // BuildersV4 Subnet struct: name, admin, unusedStorage1_V4Update, withdrawLockPeriodAfterDeposit, 
      // unusedStorage2_V4Update, minimalDeposit, claimAdmin
      const claimAdminAddress = formData.subnet.claimAdmin && isAddress(formData.subnet.claimAdmin) 
        ? formData.subnet.claimAdmin as `0x${string}`
        : connectedAddress as `0x${string}`; // Fallback to connected address if invalid
      
      const subnetStruct = {
        name: subnetName,
        admin: connectedAddress as `0x${string}`,
        unusedStorage1_V4Update: BigInt(0), // Set to 0 as unused
        withdrawLockPeriodAfterDeposit: BigInt(formData.subnet.withdrawLockPeriod * 86400), // Convert days to seconds
        unusedStorage2_V4Update: BigInt(0), // Set to 0 as unused
        minimalDeposit: parseEther((formData.subnet.minStake || 0.001).toString()),
        claimAdmin: claimAdminAddress,
      };

      // BuildersV4 SubnetMetadata struct: slug, description, website, image
      const metadataStruct = {
        slug: subnetSlug,
        description: formData.metadata.description || "",
        website: formData.metadata.website || "https://example.com",
        image: formData.metadata.image || ""
      };

      const networkName = isTestnet ? "Base Sepolia" : "Base";
      console.log(`[SubnetCreation] Creating subnet (${networkName} - BuildersV4) with DYNAMIC parameters:`, {
        subnetStruct,
        metadataStruct,
        builderContractAddress,
        selectedChainId
      });

      // Pre-flight checks
      if (creationFee && creationFee > BigInt(0) && needsApproval) {
        console.error("[SubnetCreation] Attempting to create subnet without proper approval. Creation fee:", creationFee.toString(), "Allowance:", allowance?.toString());
        toast.error("Token approval required. Please approve the token first.");
        return;
      }

      console.log("[SubnetCreation] Pre-flight checks passed. Proceeding with transaction...");

      console.log("[SubnetCreation] Calling writeContract with config:", {
        address: builderContractAddress,
        functionName: 'createSubnet',
        chainId: selectedChainId,
        hasArgs: true,
        gasLimit: selectedChainId === base.id ? "1000000" : "auto"
      });

      writeContract({
        address: builderContractAddress,
        abi: BuildersV4Abi,
        functionName: 'createSubnet',
        args: [subnetStruct, metadataStruct],
        chainId: selectedChainId,
        // Add explicit gas limit for Base mainnet to prevent estimation issues
        gas: selectedChainId === base.id ? BigInt(1000000) : undefined,
      });

      console.log("[SubnetCreation] writeContract called successfully, waiting for user confirmation...");

    } catch (error) {
      console.error("Error preparing createSubnet/createBuilderPool transaction:", error);
      toast.error("Error preparing transaction: " + (error instanceof Error ? error.message : "Unknown error"), { id: "subnet-tx" });
    }
  };

  return {
    // State
    isCorrectNetwork,
    isNetworkSwitching,
    creationFee,
    tokenSymbol,
    needsApproval,
    isLoadingFeeData,
    isApproving,
    isCreating,
    isAnyTxPending,
    isSubmitting,
    // Format helpers
    formatCreationFee,
    getNetworkName,
    // Actions
    handleNetworkSwitch,
    handleApprove,
    handleCreateSubnet,
  };
};

export default useSubnetContractInteractions; 