import { useCallback, useEffect, useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { useWaitForTransactionReceipt, useWriteContract, useReadContract } from 'wagmi';
import { parseEther, formatEther, Address, isAddress } from 'viem';
import { toast } from "sonner";
import { useNetwork } from "@/context/network-context";
import { getUnixTime } from "date-fns";
import { arbitrum, base } from 'wagmi/chains'; // Import mainnet chains

// Import the ABIs
import BuilderSubnetsV2Abi from '@/app/abi/BuilderSubnetsV2.json';
import ERC20Abi from '@/app/abi/ERC20.json';

// Import constants
import { SUPPORTED_CHAINS, FALLBACK_TOKEN_ADDRESS, DEFAULT_TOKEN_SYMBOL } from '@/components/subnet-form/constants';
import { FormData } from '@/components/subnet-form/schemas';
import { BuildersService } from '@/app/services/builders.service'; // Import BuildersService
import { BuilderDB } from '@/app/lib/supabase'; // Import BuilderDB type

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

  const calculateSecondsForLockPeriod = (period: number, unit: "hours" | "days"): bigint => {
    const secondsInHour = BigInt(3600);
    const secondsInDay = BigInt(86400);
    const bnPeriod = BigInt(period);
    return unit === "hours" ? bnPeriod * secondsInHour : bnPeriod * secondsInDay;
  };

  const formatCreationFee = useCallback(() => {
    if (creationFee === undefined) return "Loading...";
    if (creationFee === BigInt(0)) return `0 ${tokenSymbol}`;
    return `${formatEther(creationFee)} ${tokenSymbol}`;
  }, [creationFee, tokenSymbol]);

  // Contract Read Hooks
  const { data: morTokenAddressData, isFetching: isFetchingToken } = useReadContract({
    address: builderContractAddress,
    abi: BuilderSubnetsV2Abi,
    functionName: 'token',
    chainId: selectedChainId,
    query: {
       enabled: isCorrectNetwork() && !!builderContractAddress,
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
        console.error("Detailed contract write error:", error);
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
            errorMessage = "Transaction would exceed gas limits. The contract function may be failing or incompatible.";
          }
        }
        
        toast.error("Contract Interaction Failed", { 
          id: "subnet-tx", 
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
  const { isLoading: isWriteTxLoading, isSuccess: isWriteTxSuccess } = useWaitForTransactionReceipt({ hash: writeTxResult });
  const { isLoading: isApproveTxLoading, isSuccess: isApproveTxSuccess } = useWaitForTransactionReceipt({ hash: approveTxResult });

  // Store form data temporarily when submit is called
  const [submittedFormData, setSubmittedFormData] = useState<FormData | null>(null);

  // Combined Loading States
  const isApproving = isApprovePending || isApproveTxLoading;
  const isCreating = isWritePending || isWriteTxLoading;
  const isAnyTxPending = isApproving || isCreating;
  const isSubmitting = isAnyTxPending || isNetworkSwitching;

  // Effects
  useEffect(() => {
    console.log("Setting hardcoded creation fee and token values for fallback");
    setCreationFee(parseEther("0.1")); // Reduced to a small amount for testing
    
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
        
        if (configuredTokenAddress && isAddress(configuredTokenAddress)) {
          console.log("Using token address from config:", configuredTokenAddress);
          setTokenAddress(configuredTokenAddress);
        } 
        // Fallback to hardcoded address 
        else {
          console.log("Using fallback token address:", FALLBACK_TOKEN_ADDRESS);
          setTokenAddress(FALLBACK_TOKEN_ADDRESS);
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
      const effectiveFee = creationFee || parseEther("0.1");
      const effectiveAllowance = allowance || BigInt(0);
      
      console.log("Checking approval needs:", {
        effectiveFee: effectiveFee.toString(),
        effectiveAllowance: effectiveAllowance.toString(),
        needsApproval: effectiveAllowance < effectiveFee
      });
      
      return effectiveFee > BigInt(0) && effectiveAllowance < effectiveFee;
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
    if (isApprovePending) {
      toast.loading("Confirm approval in wallet...", { id: "approval-tx" });
    }
    if (isApproveTxSuccess) {
      toast.success("Approval successful!", { id: "approval-tx" });
      refetchAllowance();
      resetApproveContract();
    }
    if (approveError) {
      const errorMsg = approveError?.message || "Approval failed.";
      let displayError = errorMsg.split('(')[0].trim();
      const detailsMatch = errorMsg.match(/(?:Details|Reason): (.*?)(?:\\n|\.|$)/i);
      if (detailsMatch && detailsMatch[1]) displayError = detailsMatch[1].trim();
      toast.error("Approval Failed", { id: "approval-tx", description: displayError });
      resetApproveContract();
    }
  }, [isApprovePending, isApproveTxSuccess, approveError, resetApproveContract, refetchAllowance]);

  // Handle Subnet Creation Transaction Notifications
  useEffect(() => {
    if (isWritePending) {
      toast.loading("Confirm creation in wallet...", { id: "subnet-tx" });
    }
    if (isWriteTxSuccess) {
      toast.success("Subnet created successfully!", {
        id: "subnet-tx",
        description: `Tx: ${writeTxResult?.substring(0, 10)}...`,
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
      setSubmittedFormData(null); // Clear form data on success
      if (onTxSuccess) {
        setTimeout(() => onTxSuccess(), 3000);
      }
    }
    if (writeError) {
      const errorMsg = writeError?.message || "Subnet creation failed.";
      let displayError = errorMsg.split('(')[0].trim();
      const detailsMatch = errorMsg.match(/(?:Details|Reason): (.*?)(?:\\n|\.|$)/i);
      if (detailsMatch && detailsMatch[1]) displayError = detailsMatch[1].trim();
      toast.error("Subnet Creation Failed", { id: "subnet-tx", description: displayError });
      resetWriteContract();
      setSubmittedFormData(null); // Clear form data on error
    }
  }, [isWritePending, isWriteTxSuccess, writeTxResult, writeError, selectedChainId, resetWriteContract, onTxSuccess]);

  // Effect to handle Supabase insertion after successful transaction
  useEffect(() => {
    const insertIntoSupabase = async () => {
      if (isWriteTxSuccess && submittedFormData && writeTxResult) {
        const isMainnet = selectedChainId === arbitrum.id || selectedChainId === base.id;
        console.log(`Transaction successful (Tx: ${writeTxResult}). Checking if mainnet for Supabase insert...`, { selectedChainId, isMainnet });

        if (isMainnet) {
          const networkName = getNetworkName(selectedChainId);
          console.log(`Mainnet detected (${networkName}). Preparing data for Supabase...`);

          const newBuilderData: Partial<BuilderDB> = {
            name: submittedFormData.subnet.name,
            networks: [networkName], // Set network based on selectedChainId
            description: submittedFormData.metadata.description || null,
            long_description: submittedFormData.metadata.description || null, // Use description as long description for now
            image_src: submittedFormData.metadata.image || null,
            website: submittedFormData.metadata.website || null,
            discord_url: submittedFormData.projectOffChain.discordLink || null,
            twitter_url: submittedFormData.projectOffChain.twitterLink || null,
            // Assuming 'rewards' in projectOffChain maps to reward_types
            reward_types: submittedFormData.projectOffChain.rewards?.map(r => r.value) || [], 
            // Default other fields as they are not in the form
            tags: [],
            github_url: null,
            contributors: 0,
            github_stars: 0,
            reward_types_detail: [],
          };

          console.log("Data to insert into Supabase:", newBuilderData);

          try {
            toast.info("Syncing project details with database...", { id: "supabase-sync" });
            await BuildersService.addBuilder(newBuilderData);
            toast.success("Project details synced successfully!", { id: "supabase-sync" });
          } catch (dbError) {
            console.error("Failed to insert builder data into Supabase:", dbError);
            toast.error("Database Sync Failed", {
              id: "supabase-sync",
              description: dbError instanceof Error ? dbError.message : "Could not save project details."
            });
            // Don't block navigation if DB insert fails, but log error
          }
        } else {
          console.log("Not a mainnet chain, skipping Supabase insertion.");
        }

        // Clear submitted data and trigger original success callback (navigation)
        setSubmittedFormData(null);
        if (onTxSuccess) {
           setTimeout(() => onTxSuccess(), 1000); // Short delay after toasts
        }
      }
    };

    insertIntoSupabase();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWriteTxSuccess, submittedFormData, selectedChainId, writeTxResult, getNetworkName, onTxSuccess]); // Add dependencies

  // Update loading state for token data and allowance
  useEffect(() => {
    setIsLoadingFeeData(isFetchingToken || isFetchingSymbol || isFetchingAllowance);
  }, [isFetchingToken, isFetchingSymbol, isFetchingAllowance]);

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
    // Use fallback token address if undefined
    const effectiveTokenAddress = tokenAddress || FALLBACK_TOKEN_ADDRESS;
    // Use a larger approval amount (max uint256 / 2) to avoid needing multiple approvals
    const effectiveFee = parseEther("1000000"); // Approve 1M tokens to avoid repeated approvals
    
    if (!effectiveTokenAddress || !builderContractAddress) {
      toast.error("Cannot approve: Missing contract address data.");
      return;
    }

    console.log(`Requesting approval for ${formatEther(effectiveFee)} ${tokenSymbol} to ${builderContractAddress}`);
    console.log(`Using token address: ${effectiveTokenAddress}`);

    try {
      writeApprove({
        address: effectiveTokenAddress,
        abi: ERC20Abi,
        functionName: 'approve',
        args: [builderContractAddress, effectiveFee],
        chainId: selectedChainId,
      });
    } catch (error) {
      console.error("Error in approval call:", error);
      toast.error("Approval request failed: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  }, [tokenAddress, builderContractAddress, selectedChainId, writeApprove, tokenSymbol]);

  const handleCreateSubnet = useCallback(async (data: FormData) => {
    if (!connectedAddress || !isCorrectNetwork()) {
      toast.error("Cannot create builder subnet: Wallet or network issue.");
      return;
    }
    
    if (!builderContractAddress) {
      toast.error("Builder contract address not found. Please check network configuration.");
      return;
    }

    try {
      // Final address validation before submitting
      if (data.subnet.feeTreasury && !isAddress(data.subnet.feeTreasury)) {
        toast.error("Invalid Fee Treasury address provided.");
        return;
      }

      // Always set startsAt to 5 minutes in the future to avoid contract validation errors
      const futureDate = new Date();
      futureDate.setMinutes(futureDate.getMinutes() + 5);
      const startsAtTimestamp = BigInt(getUnixTime(futureDate));
      
      console.log(`Setting startsAt to 5 minutes in the future: ${new Date(Number(startsAtTimestamp) * 1000).toISOString()}`);

      // Format subnet struct with explicit types to avoid encoding issues
      const subnet = {
        name: data.subnet.name,
        owner: connectedAddress as `0x${string}`,
        minStake: parseEther(data.subnet.minStake.toString()),
        fee: BigInt(data.subnet.fee),
        feeTreasury: (data.subnet.feeTreasury || connectedAddress) as `0x${string}`,
        startsAt: startsAtTimestamp,
        withdrawLockPeriodAfterStake: calculateSecondsForLockPeriod(
          data.subnet.withdrawLockPeriod,
          data.subnet.withdrawLockUnit
        ),
        maxClaimLockEnd: BigInt(getUnixTime(data.subnet.maxClaimLockEnd ?? new Date())),
      };

      // Format metadata struct with explicit types
      const metadata = {
        slug: data.metadata.slug || data.subnet.name.toLowerCase().replace(/\s+/g, '-'),
        description: data.metadata.description || '',
        website: data.metadata.website || '',
        image: data.metadata.image || '',
      };

      console.log("Creating subnet with parameters:", {
        subnet,
        metadata
      });

      toast.info("Please confirm in wallet & approve reasonable gas cost", {
        id: "gas-notice", 
        description: "This contract operation may require significant gas. Only approve if the cost seems reasonable."
      });

      // Try the transaction without specifying gas to let the estimator work
      writeContract({
        address: builderContractAddress,
        abi: BuilderSubnetsV2Abi,
        functionName: 'createSubnet',
        args: [subnet, metadata],
        chainId: selectedChainId,
        // Let the wallet handle gas estimation
      });

      // Store form data upon successful initiation
      setSubmittedFormData(data);
      
    } catch (error) {
      console.error("Error preparing createSubnet transaction:", error);
      toast.error("Error preparing transaction: " + (error instanceof Error ? error.message : "Unknown error"), { id: "subnet-tx" });
    }
  }, [
    connectedAddress,
    isCorrectNetwork,
    builderContractAddress,
    writeContract,
    selectedChainId,
    calculateSecondsForLockPeriod
  ]);

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