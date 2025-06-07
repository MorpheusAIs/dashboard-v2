import { useCallback, useEffect, useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { useWaitForTransactionReceipt, useWriteContract, useReadContract } from 'wagmi';
import { parseEther, formatEther, Address, isAddress, Abi } from 'viem';
import { toast } from "sonner";
import { useNetwork } from "@/context/network-context";
import { getUnixTime } from "date-fns";
import { arbitrum, base, arbitrumSepolia } from 'wagmi/chains'; // Import chains

// Import the ABIs
import BuilderSubnetsV2Abi from '@/app/abi/BuilderSubnetsV2.json';
import ERC20Abi from '@/app/abi/ERC20.json';
import BuildersAbi from '@/app/abi/Builders.json';

// Import constants
import { SUPPORTED_CHAINS, FALLBACK_TOKEN_ADDRESS, DEFAULT_TOKEN_SYMBOL } from '@/components/subnet-form/constants';
import { FormData } from '@/components/subnet-form/schemas';
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
    const defaultFee = (selectedChainId === arbitrum.id || selectedChainId === base.id) ? BigInt(0) : parseEther("0.1");
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
        } else if (selectedChainId === arbitrumSepolia.id) {
          // Only use fallback on Arbitrum Sepolia testnet
          console.log("Using fallback token address (Sepolia testnet):", FALLBACK_TOKEN_ADDRESS);
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
    // Add handler for transaction error/timeout
    if (isWriteTxError || (writeTxResult && !isWriteTxLoading && !isWriteTxSuccess)) {
      toast.error("Transaction Failed or Timed Out", { 
        id: "subnet-tx", 
        description: "The transaction may still be pending on the network. Check your wallet or block explorer for status.",
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
  }, [isWritePending, isWriteTxSuccess, isWriteTxError, writeTxResult, isWriteTxLoading, writeError, selectedChainId, resetWriteContract, onTxSuccess]);

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
            
            // Add the subnet name to local cache for immediate visibility
            addNewlyCreatedSubnet(submittedFormData.subnet.name, networkName);
            console.log(`[useSubnetContractInteractions] Added "${submittedFormData.subnet.name}" to newly created subnets cache`);
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

  // Check for Subnet Creation Fee - only on testnet (BuilderSubnetsV2 contract)
  const isTestnet = selectedChainId === arbitrumSepolia.id;
  const { data: subnetCreationFeeAmount } = useReadContract({
    address: builderContractAddress as Address,
    abi: BuilderSubnetsV2Abi,
    functionName: 'subnetCreationFeeAmount',
    chainId: selectedChainId,
    query: {
      enabled: !!builderContractAddress && isTestnet, // Only query on testnet
    }
  });

  useEffect(() => {
    if (isTestnet && subnetCreationFeeAmount !== undefined && subnetCreationFeeAmount !== null) {
      console.log("Testnet subnet creation fee amount:", subnetCreationFeeAmount.toString());
      setCreationFee(subnetCreationFeeAmount as bigint);
    }
  }, [subnetCreationFeeAmount, isTestnet]);

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
        // Add explicit gas limit for Arbitrum Sepolia to prevent excessive estimates
        gas: selectedChainId === arbitrumSepolia.id ? BigInt(400000) : undefined,
      });
    } catch (error) {
      console.error("Error preparing approve transaction:", error);
      toast.error("Error preparing approval: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  }, [isCorrectNetwork, tokenAddress, connectedAddress, builderContractAddress, writeApprove, creationFee, selectedChainId]);

  const handleCreateSubnet = useCallback(async (data: FormData) => {
    const isMainnet = selectedChainId === arbitrum.id || selectedChainId === base.id;

    if (!connectedAddress || !isCorrectNetwork()) {
      toast.error("Cannot create builder subnet: Wallet or network issue.");
      return;
    }

    if (!builderContractAddress) {
      toast.error("Builder contract address not found. Please check network configuration.");
      return;
    }

    try {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);
      const startsAtTimestamp = BigInt(getUnixTime(futureDate));
      // console.log(`Setting startsAt to 1 hour in the future for contract: ${new Date(Number(startsAtTimestamp) * 1000).toISOString()}`);

      if (isMainnet) {
        const poolName = data.builderPool?.name || data.subnet.name || `UniquePool-${Date.now()}`; // Name from form
        const adminAddress = connectedAddress;
        const poolStart = startsAtTimestamp.toString(); // From "now + 1hr"

        // These now come directly from validated form data
        const withdrawLock = calculateSecondsForLockPeriod(
          data.subnet.withdrawLockPeriod,
          data.subnet.withdrawLockUnit
        ).toString();

        const claimLock = BigInt(
          getUnixTime(data.subnet.maxClaimLockEnd ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) // Default if not set
        ).toString();

        // Form validation should ensure this meets contract's practical minimum (e.g. >= 0.01)
        const minDeposit = parseEther(
          (data.builderPool?.minimalDeposit ?? data.subnet.minStake ?? 0.01).toString() // Fallback to 0.01 if form values are missing
        ).toString();

        const dynamicBuilderPoolTuple = [
          poolName, adminAddress, poolStart, withdrawLock, claimLock, minDeposit
        ];
        console.log("Creating builder pool (Mainnet) with validated DYNAMIC parameters:", dynamicBuilderPoolTuple);

        writeContract({
          address: builderContractAddress,
          abi: BuildersAbi as Abi, 
          functionName: 'createBuilderPool',
          args: [dynamicBuilderPoolTuple],
          chainId: selectedChainId,
        });

      } else {
        // Testnet logic (as corrected previously)
        const testnetSubnetName = data.subnet.name || `TestNetSubnet-${Date.now()}`;
        const testnetSlug = data.metadata.slug || testnetSubnetName.toLowerCase().replace(/\s+/g, '-');

        const subnetStruct = {
          name: testnetSubnetName,
          owner: connectedAddress as `0x${string}`,
          // Form validation should ensure minStake is appropriate for testnet (e.g. >= 0.001)
          minStake: parseEther((data.subnet.minStake || 0.001).toString()),
          fee: BigInt(data.subnet.fee || 0),
          feeTreasury: (data.subnet.feeTreasury || connectedAddress) as `0x${string}`,
          startsAt: startsAtTimestamp,
          withdrawLockPeriodAfterStake: calculateSecondsForLockPeriod(
            data.subnet.withdrawLockPeriod,
            data.subnet.withdrawLockUnit
          ),
          maxClaimLockEnd: BigInt(getUnixTime(data.subnet.maxClaimLockEnd ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))),
        };

        const metadataStruct = {
          slug: testnetSlug,
          description: data.metadata.description || "Testnet subnet description",
          website: data.metadata.website || "https://example.com",
          image: data.metadata.image || ""
        };

        console.log("Creating subnet (Testnet) with DYNAMIC parameters:", subnetStruct, metadataStruct);

        writeContract({
          address: builderContractAddress,
          abi: BuilderSubnetsV2Abi, 
          functionName: 'createSubnet',
          args: [subnetStruct, metadataStruct],
          chainId: selectedChainId,
        });
      }

      setSubmittedFormData(data);
      
    } catch (error) {
      console.error("Error preparing createSubnet/createBuilderPool transaction:", error);
      toast.error("Error preparing transaction: " + (error instanceof Error ? error.message : "Unknown error"), { id: "subnet-tx" });
    }
  }, [
    connectedAddress,
    isCorrectNetwork,
    builderContractAddress,
    writeContract,
    selectedChainId,
    calculateSecondsForLockPeriod,
    arbitrum.id, 
    base.id,     
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