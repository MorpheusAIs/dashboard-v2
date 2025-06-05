"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Builder } from "../builders-data";
import { formatUnits } from "viem";
import { GET_BUILDERS_PROJECT_USERS, GET_BUILDER_SUBNET_USERS } from "@/app/graphql/queries/builders";
import { type BuildersUser, type SubnetUser } from "@/app/graphql/types";
import { ProjectHeader } from "@/components/staking/project-header";
import { StakingFormCard } from "@/components/staking/staking-form-card";
import { StakingPositionCard } from "@/components/staking/staking-position-card";
import { ClaimFormCard } from "@/components/staking/claim-form-card";
import { StakingTable } from "@/components/staking-table";
import { useStakingData, type UseStakingDataProps, type BuilderSubnetUser as StakingBuilderSubnetUser } from "@/hooks/use-staking-data";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { slugToBuilderName } from "@/app/utils/supabase-utils";
import { useBuilders } from "@/context/builders-context";
import { useChainId, useAccount, useReadContract } from 'wagmi';
import { useNetwork } from "@/context/network-context";
import { arbitrumSepolia, arbitrum, base } from 'wagmi/chains';
import { MetricCard } from "@/components/metric-card";
import BuildersAbi from '@/app/abi/Builders.json';
import BuilderSubnetsV2Abi from '@/app/abi/BuilderSubnetsV2.json';
import { useStakingContractInteractions, type UseStakingContractInteractionsProps } from "@/hooks/useStakingContractInteractions";
import { formatEther, type Address, parseUnits } from "viem";
import { testnetChains, mainnetChains } from '@/config/networks';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

// Type for user in formatStakingEntry
type StakingUser = BuildersUser | StakingBuilderSubnetUser | SubnetUser;

// Function to format a timestamp to date
const formatDate = (timestamp: number): string => {
  return new Date(timestamp * 1000).toLocaleDateString();
};

// Function to format wei to MOR tokens (with decimals for small amounts)
const formatMOR = (weiAmount: string): number => {
  try {
    // Handle empty or invalid input
    if (!weiAmount || weiAmount === "0") return 0;
    
    const amount = parseFloat(formatUnits(BigInt(weiAmount), 18));
    
    // Check for unreasonable values
    if (!isFinite(amount) || amount < 0) return 0;
    
    // If amount is less than 1, show up to 3 decimal places
    // Otherwise round to whole numbers as before
    return amount < 1 ? parseFloat(amount.toFixed(3)) : Math.round(amount);
  } catch (error) {
    console.error("Error formatting MOR:", error, "Input:", weiAmount);
    return 0;
  }
};

// Function to get explorer URL based on network
const getExplorerUrl = (address: string, network?: string): string => {
  switch (network) {
    case 'Arbitrum':
      return `https://arbiscan.io/address/${address}`;
    case 'Arbitrum Sepolia':
      return `https://sepolia.arbiscan.io/address/${address}`;
    default:
      return `https://basescan.org/address/${address}`;
  }
};

console.log("########## BUILDER PAGE COMPONENT RENDERED ##########"); // Top-level log

export default function BuilderPage() {
  const { slug } = useParams();
  const router = useRouter();
  const { builders, isLoading, error: buildersError } = useBuilders();
  const chainId = useChainId();
  const { address: userAddress } = useAccount();
  const isTestnet = chainId === arbitrumSepolia.id;
  const previousIsTestnetRef = useRef<boolean>();
  
  const { switchToChain, isNetworkSwitching } = useNetwork();
  
  const [userStakedAmount, setUserStakedAmount] = useState<number | null>(null);
  const [rawStakedAmount, setRawStakedAmount] = useState<bigint | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [withdrawLockPeriod] = useState<number>(30 * 24 * 60 * 60); // Default to 30 days
  const refreshStakingDataRef = useRef(false); // Add a ref to track if refresh has been called
  const previousStakedAmountRef = useRef<number | null>(null); // Add ref to track previous staked amount
  const [builder, setBuilder] = useState<Builder | null>(null);
  const [subnetId, setSubnetId] = useState<Address | null>(null);
  const [stakeAmount, setStakeAmount] = useState<string>("");
  const [builderResolutionComplete, setBuilderResolutionComplete] = useState(false);
  
  // Local alert dialog state
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const showAlert = (msg: string) => setAlertMessage(msg);
  
  // useEffect for redirecting on network change (mainnet <-> testnet)
  useEffect(() => {
    // On the very first render, previousIsTestnetRef.current will be undefined.
    // Store the initial isTestnet status and do nothing to prevent redirect on initial load.
    if (previousIsTestnetRef.current === undefined) {
      previousIsTestnetRef.current = isTestnet;
      return;
    }

    // If isTestnet status has changed since the last render.
    if (previousIsTestnetRef.current !== isTestnet) {
      console.log(
        `Network type changed. Previous: \${previousIsTestnetRef.current ? 'Testnet' : 'Mainnet'}, Current: \${isTestnet ? 'Testnet' : 'Mainnet'}. Redirecting to /builders.`
      );
      router.push('/builders');
    }

    // Always update the ref to the current isTestnet status for the next check.
    // This ensures that if the effect runs (e.g. due to chainId change) but isTestnet type didn't flip,
    // the ref is still correctly set for the *next actual* flip.
    previousIsTestnetRef.current = isTestnet;

  }, [isTestnet, router]); // Re-run this effect if isTestnet or router instance changes.

  // Effects to reset builder resolution state
  useEffect(() => {
    setBuilder(null);
    setSubnetId(null);
    setBuilderResolutionComplete(false);
  }, [slug]);

  useEffect(() => {
    if (isLoading) { // If the main builders list starts loading
      setBuilder(null);
      setSubnetId(null);
      setBuilderResolutionComplete(false);
    }
  }, [isLoading]);

  // useEffect to find builder and set its details
  useEffect(() => {
    if (typeof slug !== 'string') return;
    
    console.log("########## EFFECT TO FIND BUILDER: slug, builders, isTestnet ##########", slug, builders, isTestnet);
    
    // Extract network from slug if present
    const hasNetworkSuffix = slug.includes('-base') || slug.includes('-arbitrum');
    const network = slug.includes('-base') ? 'Base' : 
                   slug.includes('-arbitrum') ? 'Arbitrum' : undefined;
    
    // Extract base name without network suffix
    const slugWithoutNetwork = hasNetworkSuffix 
      ? slug.substring(0, slug.lastIndexOf('-'))
      : slug;
    
    const builderNameFromSlug = slugToBuilderName(slugWithoutNetwork);
    let foundBuilder: Builder | null | undefined = null;
    
    if (builders && builders.length > 0) {
      // Find builder matching both name and network (if specified)
      foundBuilder = builders.find(b => {
        const nameMatches = b.name.toLowerCase() === builderNameFromSlug.toLowerCase();
        // If network is specified in the slug, require a network match
        if (network) {
          return nameMatches && b.network === network;
        }
        // Otherwise just match by name
        return nameMatches;
      });
      
      // Log for debugging
      if (hasNetworkSuffix) {
        console.log(`########## LOOKING FOR BUILDER WITH NAME '${builderNameFromSlug}' ON NETWORK '${network}' ##########`);
      }
    }

    if (foundBuilder) {

      const builderToSet: Builder = {
        ...foundBuilder,
        admin: foundBuilder.admin || null, 
      };



      setBuilder(builderToSet);
      
      // Set the appropriate subnetId based on network
      if (isTestnet) {
        // For testnet, use foundBuilder.id
        if (foundBuilder.id) {
          setSubnetId(foundBuilder.id as Address);
          console.log("########## TESTNET: SUBNET ID SET FROM foundBuilder.id ##########", foundBuilder.id);
        } else {
          console.error("########## TESTNET: BUILDER ID IS UNDEFINED, CANNOT SET SUBNET ID ##########");
          setSubnetId(null);
        }
      } else {
        // For mainnet, use mainnetProjectId
        if (foundBuilder.mainnetProjectId) {
          setSubnetId(foundBuilder.mainnetProjectId as Address);
          console.log("########## MAINNET: SUBNET ID SET FROM foundBuilder.mainnetProjectId ##########", foundBuilder.mainnetProjectId);
        } else {
          console.error("########## MAINNET: BUILDER mainnetProjectId IS UNDEFINED, CANNOT SET SUBNET ID ##########");
          setSubnetId(null);
        }
      }
    } else {
      setBuilder(null);
      setSubnetId(null);
      console.log("########## BUILDER NOT FOUND, SUBNET ID CLEARED ##########");
    }
    setBuilderResolutionComplete(true);
  }, [slug, builders, isTestnet, buildersError, isLoading]);

  // Derive the projectId for useStakingData once builder is loaded
  const hookProjectId = useMemo(() => {
    if (!builder) {
      console.log("[BuilderPage] hookProjectId: builder not yet available.");
      return undefined;
    }
    if (isTestnet) {
      // For testnet, use builder.id (which should be the UUID / subnetId)
      console.log("[BuilderPage] hookProjectId (Testnet): using builder.id:", builder.id);
      return builder.id || undefined; 
    } else {
      // For mainnet, use builder.mainnetProjectId (which should be the ETH address like ID)
      console.log("[BuilderPage] hookProjectId (Mainnet): using builder.mainnetProjectId:", builder.mainnetProjectId);
      return builder.mainnetProjectId || undefined;
    }
  }, [builder, isTestnet]);

  // Use the networks from the builder data, or default based on current chainId
  const networksToDisplay = useMemo(() => {
    if (builder?.networks && builder.networks.length > 0) {
      return builder.networks;
    }
    
    if (isTestnet) {
      return ['Arbitrum Sepolia'];
    } else if (chainId === 42161) {
      return ['Arbitrum'];
    } else {
      return ['Base'];
    }
  }, [builder, isTestnet, chainId]);
  
  // Get contract address from configuration based on current chain ID
  const contractAddress = useMemo<Address | undefined>(() => {
    const selectedChain = isTestnet ? testnetChains.arbitrumSepolia : (chainId === 42161 ? mainnetChains.arbitrum : mainnetChains.base);
    return selectedChain.contracts?.builders?.address as Address | undefined;
  }, [isTestnet, chainId]);
  
  // Log the addresses for debugging
  useEffect(() => {
    console.log("Network information:", {
      chainId,
      isTestnet,
      networksToDisplay,
      contractAddress,
      testnetBuildersAddress: testnetChains.arbitrumSepolia.contracts?.builders?.address,
      testnetTokenAddress: testnetChains.arbitrumSepolia.contracts?.morToken?.address,
      mainnetBuildersAddress: mainnetChains.base.contracts?.builders?.address,
      mainnetTokenAddress: mainnetChains.base.contracts?.morToken?.address,
    });
  }, [chainId, isTestnet, networksToDisplay, contractAddress]);
  
  // Get staker information from the contract
  const { data: stakerData, refetch: refetchStakerDataForUser } = useReadContract({
    address: contractAddress,
    abi: isTestnet ? BuilderSubnetsV2Abi : BuildersAbi, // Use BuildersAbi for mainnet
    functionName: isTestnet ? 'stakers' : 'usersData', // Different function name in mainnet contract
    args: subnetId && userAddress ? [isTestnet ? subnetId : userAddress, isTestnet ? userAddress : subnetId] : undefined, // Different parameter order
    query: {
      enabled: !!subnetId && !!userAddress && !!contractAddress, // Only enable if all args are present
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  });
  
  // Update user staked amount and time until unlock when data is loaded
  useEffect(() => {
    console.log("Processing staker data:", { stakerData, isTestnet, userAddress });
    
    if (stakerData) {
      let staked: bigint;
      let lastStake: bigint;
      let claimLockEndRaw: bigint;

      if (isTestnet) {
        // Testnet data structure: [staked, virtualStaked, pendingRewards, rate, lastStake, claimLockEnd]
        const [stakedData, , , , lastStakeData, claimLockEndData] = stakerData as [bigint, bigint, bigint, bigint, bigint, bigint];
        staked = stakedData;
        lastStake = lastStakeData;
        claimLockEndRaw = claimLockEndData;
      } else {
        // Mainnet structure from usersData:
        // [lastDeposit, claimLockStart, deposited, virtualDeposited]
        // [uint128, uint128, uint256, uint256]
        // Only extract the values we need (index 0 and 2)
        const stakerArray = stakerData as [bigint, bigint, bigint, bigint];
        const lastStakeData = stakerArray[0];
        const depositedData = stakerArray[2];
        staked = depositedData;
        lastStake = lastStakeData;
        // For mainnet, calculate claimLockEnd
        claimLockEndRaw = BigInt(0); // Default to 0
        if (lastStake !== BigInt(0)) {
          const lpSeconds = isTestnet
            ? (builder?.withdrawLockPeriodRaw ?? withdrawLockPeriod)
            : (builder?.withdrawLockPeriodAfterDeposit ? Number(builder.withdrawLockPeriodAfterDeposit) : withdrawLockPeriod);
          claimLockEndRaw = BigInt(Number(lastStake) + lpSeconds);
        }
      }
      
      // Determine effective claimLockEnd. If contract returned 0 (or an old value),
      // fallback to lastStake + appropriate lock period based on network
      let effectiveClaimLockEnd = claimLockEndRaw;
      if (claimLockEndRaw === BigInt(0) || Number(claimLockEndRaw) < Number(lastStake)) {
        const lpSeconds = isTestnet
          ? (builder?.withdrawLockPeriodRaw ?? withdrawLockPeriod)
          : (builder?.withdrawLockPeriodAfterDeposit ? Number(builder.withdrawLockPeriodAfterDeposit) : withdrawLockPeriod);
        effectiveClaimLockEnd = BigInt(Number(lastStake) + lpSeconds);
      }
      
      setRawStakedAmount(staked); // Store the raw bigint value

      // Format the staked amount for UI display
      const formattedStaked = parseFloat(formatUnits(staked, 18));
      const previousUserStakedAmount = previousStakedAmountRef.current;
      setUserStakedAmount(formattedStaked); // Keep decimal precision
      previousStakedAmountRef.current = formattedStaked; // Update ref with new value
      
      console.log("Updated user staked amount:", {
        previousAmount: previousUserStakedAmount,
        newAmount: formattedStaked,
        rawStaked: staked.toString(),
        formattedForDisplay: formattedStaked.toFixed(2)
      });
      
      // Calculate time until unlock
      const now = Math.floor(Date.now() / 1000);
      const claimLockEndNumber = Number(effectiveClaimLockEnd);
      let calculatedTimeLeft: string;
      
      if (claimLockEndNumber > now) {
        const secondsRemaining = claimLockEndNumber - now;
        
        if (secondsRemaining < 60) {
          calculatedTimeLeft = `${secondsRemaining} seconds`;
        } else if (secondsRemaining < 3600) {
          calculatedTimeLeft = `${Math.floor(secondsRemaining / 60)} minutes`;
        } else if (secondsRemaining < 86400) {
          calculatedTimeLeft = `${Math.floor(secondsRemaining / 3600)} hours`;
        } else {
          calculatedTimeLeft = `${Math.floor(secondsRemaining / 86400)} days`;
        }
      } else {
        calculatedTimeLeft = "Unlocked";
      }
      
      setTimeLeft(calculatedTimeLeft);
      
      console.log("Staker data processed:", {
        isTestnet,
        stakedRaw: staked.toString(),
        stakedFormattedForUI: formattedStaked.toFixed(2),
        claimLockEnd: new Date(Number(effectiveClaimLockEnd) * 1000).toLocaleString(),
        lastStake: new Date(Number(lastStake) * 1000).toLocaleString(),
        timeLeft: calculatedTimeLeft
      });
    } else {
      // Reset values if no data
      console.log("No staker data found, resetting values");
      setUserStakedAmount(0);
      setRawStakedAmount(null); // Reset raw amount
      setTimeLeft("Not staked");
    }
  }, [stakerData, builder, withdrawLockPeriod, isTestnet, userAddress]);
  
  const stakingDataHookProps: UseStakingDataProps = useMemo(() => ({
    queryDocument: isTestnet ? GET_BUILDER_SUBNET_USERS : GET_BUILDERS_PROJECT_USERS,
    projectId: hookProjectId,
    isTestnet: isTestnet,
    formatEntryFunc: (user: StakingUser) => ({
        address: user.address,
        displayAddress: `${user.address.substring(0, 6)}...${user.address.substring(user.address.length - 4)}`,
        amount: user.staked === "0" ? 0 : formatMOR(user.staked || '0'),
        timestamp: ('lastStake' in user && typeof user.lastStake === 'string') ? parseInt(user.lastStake) : 0,
        unlockDate: (('lastStake' in user && typeof user.lastStake === 'string') ? parseInt(user.lastStake) : 0) + (builder?.withdrawLockPeriodRaw || withdrawLockPeriod),
    }),
    network: networksToDisplay[0],
  }), [isTestnet, hookProjectId, networksToDisplay, builder?.withdrawLockPeriodRaw, withdrawLockPeriod]);

  // Log the props just before calling the hook
  console.log("[BuilderPage] Props for useStakingData:", stakingDataHookProps);

  const {
    entries: stakingEntries,
    isLoading: isLoadingStakingEntries,
    error: stakingEntriesError,
    pagination,
    sorting,
    refresh: refreshStakingEntries,
  } = useStakingData(stakingDataHookProps);
  
  // useEffect for triggering refresh based on refreshStakingDataRef
  useEffect(() => {
    if (refreshStakingDataRef.current) {
      console.log("[BuilderPage] Calling refreshStakingEntries due to ref. hookProjectId:", hookProjectId);
      refreshStakingEntries();
      refreshStakingDataRef.current = false; 
    }
  }, [refreshStakingEntries, hookProjectId]); // Added hookProjectId as a dep, though refreshStakingEntries is main trigger

  // useEffect to signal staking data refresh when hookProjectId is ready and changes
  useEffect(() => {
    if (hookProjectId) { 
      console.log(`[BuilderPage] hookProjectId is now ready: ${hookProjectId}. Triggering staking data refresh signal.`);
      refreshStakingDataRef.current = true;
    } else {
      console.log(`[BuilderPage] hookProjectId is not ready or became undefined. Builder:`, builder, `isTestnet:`, isTestnet);
      // Optionally, if hookProjectId becomes undefined after being set, clear existing staking data
      // This might require exposing a 'clear' function from useStakingData or handling it via refresh logic.
      // For now, just log.
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hookProjectId]); // React to changes in the finalized hookProjectId (refreshStakingEntries is not needed here)
  
  // Create a ref to store the approval refresh function
  const refreshApprovalRef = useRef<((amount: string) => Promise<boolean> | boolean) | null>(null);
  
  // Staking hook
  const stakingContractHookProps: UseStakingContractInteractionsProps = useMemo(() => ({
    subnetId: subnetId || undefined,
    networkChainId: chainId,
    onTxSuccess: () => {
      console.log("Transaction successful (stake/withdraw/claim), refreshing staking table and current user staker data.");
      refreshStakingDataRef.current = true; // For the main staking table
      const currentStakeAmount = stakeAmount; // Capture current stake amount
      setStakeAmount(""); // Clear stake input
      
      // Signal the StakingPositionCard to reset its withdrawal amount
      if (window && window.document) {
        const resetWithdrawEvent = new CustomEvent('reset-withdraw-form');
        window.document.dispatchEvent(resetWithdrawEvent);
      }
      
      // Refetch the current user's staker data with logging
      if (refetchStakerDataForUser) {
        console.log("Calling refetchStakerDataForUser to refresh user's staked amount...");
        refetchStakerDataForUser().then(() => {
          console.log("Successfully refetched user staker data after transaction");
        }).catch((error: unknown) => {
          console.error("Error refetching user staker data:", error);
        });
      } else {
        console.warn("refetchStakerDataForUser is not available");
      }
      

      
      // Force refresh approval state after successful transaction
      // Use timeout to allow blockchain state to update
      setTimeout(() => {
        console.log("Refreshing approval state after successful transaction...");
        if (refreshApprovalRef.current && currentStakeAmount && parseFloat(currentStakeAmount) > 0) {
          try {
            const result = refreshApprovalRef.current(currentStakeAmount);
            console.log("Successfully refreshed approval state after transaction, result:", result);
          } catch (error: unknown) {
            console.error("Error refreshing approval state:", error);
          }
        }
      }, 2000); // 2 second delay to allow blockchain state to update
    },
    lockPeriodInSeconds: builder?.withdrawLockPeriodRaw,
  }), [subnetId, chainId, builder?.withdrawLockPeriodRaw, refetchStakerDataForUser, stakeAmount]);

  // Log subnet ID state for debugging
  useEffect(() => {
    console.log("Subnet ID state updated:", {
      subnetId,
      isTestnet,
      builderId: builder?.id,
      mainnetProjectId: builder?.mainnetProjectId,
      chainId
    });
  }, [subnetId, isTestnet, builder, chainId]);

  const {
    isCorrectNetwork,
    tokenSymbol,
    tokenBalance,
    needsApproval,
    isLoadingData,
    isApproving,
    isStaking,
    isWithdrawing,
    isClaiming,
    isSubmitting,
    claimableAmount,
    handleNetworkSwitch,
    handleApprove,
    handleStake,
    handleWithdraw,
    handleClaim,
    checkAndUpdateApprovalNeeded,
    refetchClaimableAmount
  } = useStakingContractInteractions(stakingContractHookProps);

  // Set the ref to the actual function for use in the onTxSuccess callback
  useEffect(() => {
    refreshApprovalRef.current = checkAndUpdateApprovalNeeded;
  }, [checkAndUpdateApprovalNeeded]);

  // Refresh claimable amount after successful transactions
  useEffect(() => {
    // Use a timeout to allow blockchain state to update after successful transactions
    const timer = setTimeout(() => {
      if (refetchClaimableAmount) {
        console.log("Refreshing claimable amount after transaction state change...");
        refetchClaimableAmount().then(() => {
          console.log("Successfully refreshed claimable amount");
        }).catch((error: unknown) => {
          console.error("Error refetching claimable amount:", error);
        });
      }
    }, 3000); // 3 second delay to allow blockchain state to update

    return () => clearTimeout(timer);
  }, [userStakedAmount, refetchClaimableAmount]); // Trigger when user staked amount changes (indicating a successful transaction)

  // Check if approval is needed when stake amount changes
  useEffect(() => {
    if (stakeAmount && parseFloat(stakeAmount) > 0) {
      checkAndUpdateApprovalNeeded(stakeAmount);
    }
  }, [stakeAmount, checkAndUpdateApprovalNeeded]);

  // Refresh approval state when user returns to the page or when allowance data loads
  // This fixes the issue where interface keeps asking for approval after page reload
  useEffect(() => {
    if (stakeAmount && parseFloat(stakeAmount) > 0 && !isLoadingData) {
      console.log("Refreshing approval state due to allowance data update");
      checkAndUpdateApprovalNeeded(stakeAmount);
    }
  }, [stakeAmount, checkAndUpdateApprovalNeeded, isLoadingData]); // Added isLoadingData dependency

  // Debug useEffect for token approval states
  useEffect(() => {
    if (stakeAmount && parseFloat(stakeAmount) > 0) {
      console.log("Approval state debug:", {
        needsApproval,
        stakeAmount,
        parsedAmount: parseFloat(stakeAmount),
        isCorrectNetwork: isCorrectNetwork(),
        isStaking,
        isApproving,
        chainId,
        networksToDisplay,
        buttonText: needsApproval && stakeAmount && parseFloat(stakeAmount) > 0
          ? `Approve ${tokenSymbol}`
          : `Stake ${tokenSymbol}`
      });
    }
  }, [needsApproval, stakeAmount, isCorrectNetwork, isStaking, isApproving, chainId, networksToDisplay, tokenSymbol]);
  
  // Handlers for staking actions
  const onStakeSubmit = async () => {
    console.log("onStakeSubmit called with:", {
      needsApproval,
      stakeAmount,
      isCorrectNetwork: isCorrectNetwork(),
      tokenSymbol,
      subnetId  // Log subnetId here to debug
    });
    
    // Validate subnetId is present
    if (!subnetId) {
      console.error("ERROR: Cannot stake - subnetId is missing!", {
        isTestnet,
        builderId: builder?.id,
        mainnetProjectId: builder?.mainnetProjectId
      });
      showAlert("Cannot stake: Subnet ID is missing. This is likely because the builder's mainnet project ID is not set correctly.");
      return;
    }

    // If not on the correct network, switch first
    if (!isCorrectNetwork()) {
      await handleNetworkSwitch();
      return; // Exit after network switch to prevent further action
    }

    // Force a fresh check for approval before proceeding
    const currentlyNeedsApproval = stakeAmount ? await checkAndUpdateApprovalNeeded(stakeAmount) : false;
    console.log(`Fresh approval check: ${currentlyNeedsApproval ? 'Needs approval' : 'No approval needed'}`);

    // Already on correct network, handle approval or staking
    if ((currentlyNeedsApproval || needsApproval) && stakeAmount && parseFloat(stakeAmount) > 0) {
      console.log(`Calling handleApprove with amount: ${stakeAmount}`);
      await handleApprove(stakeAmount);
    } else if (stakeAmount && parseFloat(stakeAmount) > 0) {
      console.log(`Calling handleStake with amount: ${stakeAmount}`);
      await handleStake(stakeAmount);
    } else {
      console.warn("Neither approval nor staking conditions met:", {
        needsApproval,
        currentlyNeedsApproval,
        stakeAmount,
        parsed: parseFloat(stakeAmount || "0")
      });
    }
  };

  const onWithdrawSubmit = async (amountUserWantsToWithdrawStr: string) => {
    console.log("########## ON WITHDRAW SUBMIT - User wants to withdraw:", amountUserWantsToWithdrawStr, "##########");
    
    const amountUserWantsToWithdraw = parseFloat(amountUserWantsToWithdrawStr);
    
    // Basic validation - ensure valid withdrawal amount
    if (isNaN(amountUserWantsToWithdraw) || amountUserWantsToWithdraw <= 0) {
      showAlert("Please enter a valid withdrawal amount greater than zero.");
      return;
    }
    
    if (userStakedAmount === null || userStakedAmount <= 0) {
      showAlert("You have no staked amount to withdraw.");
      return;
    }
    
    // Check if user is trying to withdraw more than they have staked
    if (amountUserWantsToWithdraw > userStakedAmount) {
      showAlert(`You cannot withdraw ${amountUserWantsToWithdraw.toFixed(6)} ${tokenSymbol} because you only have ${userStakedAmount.toFixed(6)} ${tokenSymbol} staked.`);
      return;
    }
    
    console.log("########## Withdrawal validation passed:", {
      userStakedAmount,
      amountUserWantsToWithdraw,
      isWithdrawingAll: Math.abs(amountUserWantsToWithdraw - userStakedAmount) < 0.000001
    });

    if (!isCorrectNetwork()) {
      console.log("########## Incorrect network. Requesting switch. ##########");
      await handleNetworkSwitch();
      return; // Exit after network switch
    }

    if (!rawStakedAmount || rawStakedAmount <= BigInt(0)) {
      console.warn("########## No staked amount available for withdrawal. rawStakedAmount:", rawStakedAmount?.toString(), "##########");
      showAlert("You have no staked amount to withdraw.");
      return;
    }

    let amountToWithdrawWei: bigint;
    try {
      amountToWithdrawWei = parseUnits(amountUserWantsToWithdrawStr, 18); // Convert user input (e.g., "4") to BigInt wei
    } catch (error) {
      console.error("########## Invalid withdrawal amount format:", amountUserWantsToWithdrawStr, error, "##########");
      showAlert("Invalid amount format. Please enter a valid number.");
      return;
    }

    if (amountToWithdrawWei <= BigInt(0)) {
      console.warn("########## Withdrawal amount must be greater than zero. Attempted:", amountUserWantsToWithdrawStr, "##########");
      showAlert("Withdrawal amount must be greater than zero.");
      return;
    }

    if (amountToWithdrawWei > rawStakedAmount) {
      const maxWithdrawFriendly = formatUnits(rawStakedAmount, 18);
      console.warn(
        `########## Withdrawal amount (${amountUserWantsToWithdrawStr} ${tokenSymbol}) exceeds staked balance (${maxWithdrawFriendly} ${tokenSymbol}). rawStaked: ${rawStakedAmount.toString()}, attemptedWei: ${amountToWithdrawWei.toString()} ##########`
      );
      showAlert(
        `Error: You are trying to withdraw ${amountUserWantsToWithdrawStr} ${tokenSymbol}, but you only have ${maxWithdrawFriendly} ${tokenSymbol} staked. Please enter a valid amount.`
      );
      return;
    }

    console.log(`########## CALLING HANDLEWITHDRAW ########## Amount (token units string): ${amountUserWantsToWithdrawStr}, SubnetID: ${subnetId}`);
    // Pass the original string (e.g., "4") to handleWithdraw, as the hook expects token units.
    await handleWithdraw(amountUserWantsToWithdrawStr);
  };

  // Effect to listen for the reset-withdraw-form event
  useEffect(() => {
    const handleResetWithdrawForm = () => {
      // This code is for demonstration - since we can't directly reset StakingPositionCard's state
      // Another approach would be to pass a resetWithdrawAmount prop to StakingPositionCard
      console.log("Should reset withdrawal form now");
    };
    
    document.addEventListener('reset-withdraw-form', handleResetWithdrawForm);
    return () => {
      document.removeEventListener('reset-withdraw-form', handleResetWithdrawForm);
    };
  }, []);

  // Add a flag to track if network switch has been attempted
  const networkSwitchAttempted = useRef(false);
  
  // Add a flag to track when the page is fully loaded
  const [isPageFullyLoaded, setIsPageFullyLoaded] = useState(false);
  
  // Update the shouldSwitchNetwork function to return the target chainId
  const networkInfo = useMemo(() => {
    if (!builder || isTestnet || !networksToDisplay.length) return { shouldSwitch: false, targetChainId: null };
    
    // If on mainnet, check if current network matches builder's network
    const builderNetwork = networksToDisplay[0]; // Primary network
    
    // Arbitrum network is chainId 42161
    if (builderNetwork === 'Arbitrum' && chainId !== arbitrum.id) {
      return { shouldSwitch: true, targetChainId: arbitrum.id };
    }
    
    // Base network is chainId 8453
    if (builderNetwork === 'Base' && chainId !== base.id) {
      return { shouldSwitch: true, targetChainId: base.id };
    }
    
    return { shouldSwitch: false, targetChainId: null };
  }, [builder, isTestnet, networksToDisplay, chainId]);
  
  // Effect to auto-switch network after data is loaded
  useEffect(() => {
    // Only run if:
    // 1. Page is fully loaded
    // 2. We should switch networks
    // 3. We haven't attempted a switch yet in this session
    if (isPageFullyLoaded && 
        networkInfo.shouldSwitch && 
        networkInfo.targetChainId && 
        !networkSwitchAttempted.current && 
        !isNetworkSwitching) {
      
      console.log(`Auto-switching network to ${networksToDisplay[0]} (chainId: ${networkInfo.targetChainId}) for builder ${builder?.name}`);
      
      // Set the flag to prevent multiple switch attempts
      networkSwitchAttempted.current = true;
      
      // Show notification
      setShowNetworkSwitchNotice(true);
      
      // Use a small delay to ensure the UI is fully rendered
      const timer = setTimeout(() => {
        // Call the network context's switchToChain function
        switchToChain(networkInfo.targetChainId);
        
        // Hide notification after a brief period
        setTimeout(() => {
          setShowNetworkSwitchNotice(false);
        }, 3000);
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [isPageFullyLoaded, networkInfo, networksToDisplay, builder, switchToChain, isNetworkSwitching]);

  // Effect to determine when the page is fully loaded
  useEffect(() => {
    if (!isLoading && builder && subnetId) {
      setIsPageFullyLoaded(true);
    }
  }, [isLoading, builder, subnetId]);
  
  // Add state for network switch notification
  const [showNetworkSwitchNotice, setShowNetworkSwitchNotice] = useState(false);
  
  // Loading state for the page should consider builder loading first
  if (isLoading || (!builderResolutionComplete && !buildersError)) {
    return <div className="p-8">Loading builder details...</div>;
  }

  if (buildersError) {
    return <div className="p-8 text-red-500">Error loading builder: {buildersError.message}</div>;
  }

  if (!builder && builderResolutionComplete) {
    return <div className="p-8">Builder not found</div>;
  }

  // Final guard to ensure builder is non-null for TypeScript
  if (!builder) {
    // This state should ideally not be reached if the logic above is correct
    // and "Builder not found" or other loading/error states were returned.
    return <div className="p-8">Loading details or an unexpected error occurred...</div>;
  }

  return (
    <div className="page-container">
      {/* Network Switch Notification */}
      {showNetworkSwitchNotice && (
        <div className="fixed top-4 right-4 bg-emerald-500/90 text-white px-4 py-3 rounded-lg shadow-lg z-50 max-w-md transition-all duration-300 ease-in-out opacity-100 transform translate-y-0">
          <p>Switching to {networksToDisplay[0]} network to view this builder...</p>
        </div>
      )}
      
      {/* Destructive alert dialog */}
      {alertMessage && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <Alert variant="destructive" className="w-[90%] max-w-md bg-black">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{alertMessage}</AlertDescription>
            <Button
              variant="destructive"
              className="mr-auto mt-4"
              onClick={() => setAlertMessage(null)}
            >
              Understood
            </Button>
          </Alert>
        </div>
      )}

      {/* Main content */}
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Builder Header */}
        <ProjectHeader
          name={builder.name}
          description={builder.description || ""}
          imagePath={builder.image_src || ""}
          networks={networksToDisplay}
          website={builder.website || ""}
          rewardType={builder.reward_types?.[0] || ""}
          backButton={true}
          backPath="/builders"
        />

        {/* Staking Stats */}
        <div className={`grid grid-cols-1 md:grid-cols-4 gap-4`}>
          <div className="relative md:col-span-2">
            <MetricCard
              title="Builder Stats (MOR)"
              metrics={[
                { value: builder.totalStaked, label: "Staked" },
                { value: builder.totalClaimed || 0, label: "Claimed" }
              ]}
              autoFormatNumbers={true}
            />
            <GlowingEffect 
              spread={40}
              glow={true}
              disabled={false}
              proximity={64}
              inactiveZone={0.01}
              borderWidth={2}
              borderRadius="rounded-xl"
            />
          </div>
          
          <div className="relative">
            <MetricCard
              title="Users staking"
              metrics={[{ value: builder.stakingCount || 0, label: "All time" }]}
              autoFormatNumbers={true}
            />
            <GlowingEffect 
              spread={40}
              glow={true}
              disabled={false}
              proximity={64}
              inactiveZone={0.01}
              borderWidth={2}
              borderRadius="rounded-xl"
            />
          </div>
          
          <div className="relative">
            <MetricCard
              title="Lock Period"
              metrics={[{ 
                value: builder.lockPeriod ? builder.lockPeriod.split(' ')[0] : "-", 
                label: builder.lockPeriod ? builder.lockPeriod.split(' ')[1] : "" 
              }]}
            />
            <GlowingEffect 
              spread={40}
              glow={true}
              disabled={false}
              proximity={64}
              inactiveZone={0.01}
              borderWidth={2}
              borderRadius="rounded-xl"
            />
          </div>
          
        </div>

        {/* Staking Actions */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          {/* Left column - 3/5 width, contains Stake and Claim forms */}
          <div className="md:col-span-3 space-y-4">
            {/* Stake Form */}
            <div className="relative">
              <StakingFormCard
                title="Stake MOR"
                value={stakeAmount}
                onStake={onStakeSubmit}
                onAmountChange={(value) => {
                  // Format value to one decimal place if possible
                  let formattedValue = value;
                  const parsed = parseFloat(value);
                  if (!isNaN(parsed)) {
                    // Round to 1 decimal place
                    formattedValue = (Math.floor(parsed * 10) / 10).toString();
                  }
                  
                  setStakeAmount(formattedValue);
                  // Force approval check every time amount changes
                  if (formattedValue && parseFloat(formattedValue) > 0) {
                    checkAndUpdateApprovalNeeded(formattedValue);
                  }
                }}
                maxAmount={tokenBalance ? parseFloat(formatEther(tokenBalance)) : 0}
                minDeposit={builder.minDeposit}
                tokenSymbol={tokenSymbol}
                buttonText={
                  !isCorrectNetwork()
                    ? "Switch Network"
                    : isStaking
                    ? "Staking..."
                    : isApproving
                    ? "Approving..."
                    : needsApproval && stakeAmount && parseFloat(stakeAmount) > 0
                    ? `Approve ${tokenSymbol}`
                    : `Stake ${tokenSymbol}`
                }
                disableStaking={isSubmitting}
                showWarning={
                  !isCorrectNetwork() || 
                  (needsApproval && !!stakeAmount && parseFloat(stakeAmount) > 0) ||
                  (!!stakeAmount && parseFloat(stakeAmount) > (tokenBalance ? parseFloat(formatEther(tokenBalance)) : 0))
                }
                warningMessage={
                  !isCorrectNetwork() 
                    ? `Please switch to ${networksToDisplay[0]} network to stake` 
                    : needsApproval && stakeAmount && parseFloat(stakeAmount) > 0
                    ? `You need to approve ${tokenSymbol} spending first`
                    : `Warning: You don't have enough ${tokenSymbol}`
                }
              />
              <GlowingEffect 
                spread={40}
                glow={true}
                disabled={false}
                proximity={64}
                inactiveZone={0.01}
                borderWidth={2}
                borderRadius="rounded-xl"
              />
            </div>

            {/* Claim Form */}
            <div className="relative">
              <ClaimFormCard
                onClaim={async () => {
                  if (!isCorrectNetwork()) {
                    await handleNetworkSwitch();
                    return;
                  }
                  
                  console.log("Claim button clicked, calling handleClaim");
                  await handleClaim();
                }}
                claimableAmount={claimableAmount ? parseFloat(formatEther(claimableAmount)) : 0}
                tokenSymbol={tokenSymbol}
                buttonText={
                  !isCorrectNetwork()
                    ? "Switch Network"
                    : isClaiming
                    ? "Claiming..."
                    : "Claim all"
                }
                disableClaiming={!isCorrectNetwork() || isClaiming || !claimableAmount || claimableAmount === BigInt(0)}
                isClaiming={isClaiming}
              />
              <GlowingEffect 
                spread={40}
                glow={true}
                disabled={false}
                proximity={64}
                inactiveZone={0.01}
                borderWidth={2}
                borderRadius="rounded-xl"
              />
            </div>
          </div>

          {/* Right column - 2/5 width, Your Position card spans full height */}
          <div className="md:col-span-2 relative">
            <StakingPositionCard
              userStakedAmount={userStakedAmount || 0}
              timeUntilUnlock={timeLeft}
              onWithdraw={onWithdrawSubmit}
              disableWithdraw={!userStakedAmount || timeLeft !== "Unlocked" || isWithdrawing}
              isWithdrawing={isWithdrawing}
              tokenSymbol={tokenSymbol}
              withdrawButtonText={
                !isCorrectNetwork()
                  ? "Switch Network"
                  : isWithdrawing
                  ? "Withdrawing..."
                  : "Withdraw MOR"
              }
              // description={
              //   timeLeft !== "Unlocked"
              //     ? `Your funds are locked until ${timeLeft} from now.`
              //     : userStakedAmount
              //     ? `You can withdraw up to ${Math.max(userStakedAmount - (builder?.minDeposit ? Number(builder.minDeposit) : 0), 0)} ${tokenSymbol}.`
              //     : `You have no staked tokens to withdraw.`
              // }
            />
            <GlowingEffect 
              spread={40}
              glow={true}
              disabled={false}
              proximity={64}
              inactiveZone={0.01}
              borderWidth={2}
              borderRadius="rounded-xl"
            />
          </div>
        </div>

        {/* Staking Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold">Active staking addresses</CardTitle>
          </CardHeader>
          <CardContent>
            {stakingEntriesError ? (
              <div className="text-red-500">Error loading staking data: {stakingEntriesError.message}</div>
            ) : (
              <StakingTable
                entries={stakingEntries}
                isLoading={isLoadingStakingEntries}
                error={stakingEntriesError}
                sortColumn={sorting.column}
                sortDirection={sorting.direction}
                onSort={(columnId) => sorting.setSort(columnId)}
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                onPreviousPage={pagination.prevPage}
                onNextPage={pagination.nextPage}
                hideColumns={['claimed', 'fee']}
                getExplorerUrl={getExplorerUrl}
                network={networksToDisplay[0]}
                formatDate={formatDate}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 