"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Builder } from "../builders-data";
import { formatUnits } from "viem";
import { GET_BUILDERS_PROJECT_USERS, GET_BUILDER_SUBNET_USERS } from "@/app/graphql/queries/builders";
import { type BuildersUser, type SubnetUser } from "@/app/graphql/types";
import { ProjectHeader } from "@/components/staking/project-header";
import { StakingFormCard } from "@/components/staking/staking-form-card";
import { WithdrawalPositionCard } from "@/components/staking/withdrawal-position-card";
import { ClaimFormCard } from "@/components/staking/claim-form-card";
import { StakingTable } from "@/components/staking-table";
import { useStakingData, type UseStakingDataProps, type BuilderSubnetUser as StakingBuilderSubnetUser } from "@/hooks/use-staking-data";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { slugToBuilderName } from "@/app/utils/supabase-utils";
import { useBuilders } from "@/context/builders-context";
import { useChainId, useAccount, useReadContract } from 'wagmi';
import { useAuth } from "@/context/auth-context";
import { useNetwork } from "@/context/network-context";
import { baseSepolia, arbitrum, base } from 'wagmi/chains';
import { MetricCardMinimal } from "@/components/metric-card-minimal";
import BuildersAbi from '@/app/abi/Builders.json';
import BuildersV4Abi from '@/app/abi/BuildersV4.json';
import { useStakingContractInteractions, type UseStakingContractInteractionsProps } from "@/hooks/useStakingContractInteractions";
import { formatEther, type Address, parseUnits } from "viem";
import { testnetChains, mainnetChains } from '@/config/networks';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Code } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUrlParams } from '@/lib/utils/url-params';
import { NetworkSwitchNotification } from "@/components/network-switch-notification";
import { Skeleton } from "@/components/ui/skeleton";
import { useSingleBuilder } from "@/app/hooks/useSingleBuilder";
import { useQueryClient } from "@tanstack/react-query";
import { parseBuilderDescription } from "@/lib/utils";

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
    case 'Base Sepolia':
      return `https://sepolia.basescan.org/address/${address}`;
    default:
      return `https://basescan.org/address/${address}`;
  }
};

console.log("########## BUILDER PAGE COMPONENT RENDERED ##########"); // Top-level log

export default function BuilderPage() {
  const { slug } = useParams();
  const router = useRouter();
  const { getParam } = useUrlParams();
  const { builders, isLoading, error: buildersError, refreshData } = useBuilders();
  const chainId = useChainId();
  const { address: userAddress } = useAccount();
  const { userAddress: authUserAddress } = useAuth();
  const isTestnet = chainId === baseSepolia.id;
  const previousIsTestnetRef = useRef<boolean | undefined>(undefined);
  const queryClient = useQueryClient();
  
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

  // useEffect to find builder and set its details
  useEffect(() => {
    if (typeof slug !== 'string') return;
    
    console.log("########## EFFECT TO FIND BUILDER: slug, builders, isTestnet ##########", slug, builders, isTestnet);
    
    // Get subnet_id from URL params - prioritize this over slug-based matching
    const subnetIdFromUrl = getParam('subnet_id');
    console.log("########## SUBNET_ID FROM URL: ##########", subnetIdFromUrl);
    
    let foundBuilder: Builder | null | undefined = null;
    
    if (builders && builders.length > 0) {
      // First try to find by subnet_id if available
      if (subnetIdFromUrl) {
        foundBuilder = builders.find(b => {
          // Check both id (testnet) and mainnetProjectId (mainnet)
          return b.id === subnetIdFromUrl || b.mainnetProjectId === subnetIdFromUrl;
        });
        
        if (foundBuilder) {
          console.log("########## BUILDER FOUND BY SUBNET_ID ##########", foundBuilder.name);
        } else {
          console.log("########## NO BUILDER FOUND WITH SUBNET_ID ##########", subnetIdFromUrl);
        }
      }
      
      // If not found by subnet_id, fall back to slug-based matching
      if (!foundBuilder) {
        console.log("########## FALLING BACK TO SLUG-BASED MATCHING ##########");
        
        // Extract network from slug if present
        // Check for network suffixes: -base-sepolia, -base, or -arbitrum
        // Order matters: check -base-sepolia before -base to avoid false matches
        // Use endsWith() to match the $ anchored regex used for removal
        const hasNetworkSuffix = slug.endsWith('-base-sepolia') || slug.endsWith('-base') || slug.endsWith('-arbitrum');
        let network: string | undefined = undefined;
        if (slug.endsWith('-base-sepolia')) {
          network = 'Base Sepolia';
        } else if (slug.endsWith('-base')) {
          network = 'Base';
        } else if (slug.endsWith('-arbitrum')) {
          network = 'Arbitrum';
        }
        
        // Extract base name without network suffix
        // Handle -base-sepolia (two hyphens) specially
        let slugWithoutNetwork = slug;
        if (hasNetworkSuffix) {
          if (slug.endsWith('-base-sepolia')) {
            slugWithoutNetwork = slug.replace(/-base-sepolia$/, '');
          } else if (slug.endsWith('-base')) {
            slugWithoutNetwork = slug.replace(/-base$/, '');
          } else if (slug.endsWith('-arbitrum')) {
            slugWithoutNetwork = slug.replace(/-arbitrum$/, '');
          }
        }
        
        const builderNameFromSlug = slugToBuilderName(slugWithoutNetwork);
        
        // Find builder matching both name and network (if specified)
        foundBuilder = builders.find(b => {
          const nameMatches = b.name.toLowerCase() === builderNameFromSlug.toLowerCase();
          // If network is specified in the slug, require a network match
          // Check both b.network and b.networks array for compatibility
          if (network) {
            const builderNetworkMatch = b.network === network || 
                                       (b.networks && b.networks.includes(network));
            return nameMatches && builderNetworkMatch;
          }
          // Otherwise just match by name
          return nameMatches;
        });
        
        // Log for debugging
        if (hasNetworkSuffix) {
          console.log(`########## LOOKING FOR BUILDER WITH NAME '${builderNameFromSlug}' ON NETWORK '${network}' ##########`);
        }
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
  }, [slug, builders, isTestnet, buildersError, isLoading, getParam]);

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

  // Use the networks from the URL parameter first, then builder data, or default based on current chainId
  const networksToDisplay = useMemo(() => {
    // First priority: check for network parameter in URL
    const networkFromUrl = getParam('network');
    if (networkFromUrl) {
      console.log('[BuilderPage] Using network from URL parameter:', networkFromUrl);
      return [networkFromUrl];
    }
    
    // Second priority: use builder's defined networks
    if (builder?.networks && builder.networks.length > 0) {
      console.log('[BuilderPage] Using networks from builder data:', builder.networks);
      return builder.networks;
    }
    
    // Last resort: fallback to user's wallet network
    if (isTestnet) {
      console.log('[BuilderPage] Fallback to testnet network');
      return ['Base Sepolia'];
    } else if (chainId === 42161) {
      console.log('[BuilderPage] Fallback to Arbitrum network');
      return ['Arbitrum'];
    } else {
      console.log('[BuilderPage] Fallback to Base network');
      return ['Base'];
    }
  }, [getParam, builder, isTestnet, chainId]);

  // Subnet's chain ID (may differ from wallet's chainId when user hasn't switched networks)
  const subnetChainId = useMemo(() => {
    const subnetNetwork = networksToDisplay[0];
    if (!subnetNetwork) return chainId;
    
    const normalizedNetwork = subnetNetwork.toLowerCase();
    if (normalizedNetwork === 'base sepolia') return baseSepolia.id;
    if (normalizedNetwork === 'base') return base.id;
    if (normalizedNetwork === 'arbitrum') return arbitrum.id;
    
    return chainId;
  }, [networksToDisplay, chainId]);

  // Normalize network names for icon display (Base Sepolia -> Base)
  const networksForIconDisplay = useMemo(() => {
    return networksToDisplay.map(network => {
      // Map Base Sepolia to Base for icon display
      if (network === 'Base Sepolia') {
        return 'Base';
      }
      return network;
    });
  }, [networksToDisplay]);

  // Fetch single builder data for real-time metrics updates
  const singleBuilderProjectId = useMemo(() => {
    if (isTestnet) return null; // useSingleBuilder doesn't support testnet
    return hookProjectId || null;
  }, [isTestnet, hookProjectId]);

  // Determine network for single builder query
  const singleBuilderNetwork = useMemo(() => {
    if (!networksToDisplay || networksToDisplay.length === 0) return undefined;
    const network = networksToDisplay[0];
    if (!network) return undefined;
    return network.toLowerCase();
  }, [networksToDisplay]);

  const { 
    data: singleBuilderData, 
    refetch: refetchSingleBuilder,
    isLoading: isLoadingSingleBuilder 
  } = useSingleBuilder({ 
    projectId: singleBuilderProjectId || undefined,
    network: singleBuilderNetwork
  });

  // Merge single builder metrics into the current builder state
  const builderWithUpdatedMetrics = useMemo(() => {
    if (!builder) return null;
    
    // If we have fresh single builder data, use it to update metrics
    if (singleBuilderData && !isTestnet) {
      return {
        ...builder,
        totalStaked: singleBuilderData.totalStaked ?? builder.totalStaked,
        totalClaimed: singleBuilderData.totalClaimed ?? builder.totalClaimed,
        stakingCount: singleBuilderData.stakingCount ?? builder.stakingCount,
      };
    }
    
    return builder;
  }, [builder, singleBuilderData, isTestnet]);
  
  // Get contract address from configuration based on current chain ID
  const contractAddress = useMemo<Address | undefined>(() => {
    const selectedChain = isTestnet ? testnetChains.baseSepolia : (chainId === 42161 ? mainnetChains.arbitrum : mainnetChains.base);
    return selectedChain.contracts?.builders?.address as Address | undefined;
  }, [isTestnet, chainId]);
  
  // Log the addresses for debugging
  useEffect(() => {
    console.log("Network information:", {
      chainId,
      isTestnet,
      networksToDisplay,
      contractAddress,
      testnetBuildersAddress: testnetChains.baseSepolia.contracts?.builders?.address,
      testnetTokenAddress: testnetChains.baseSepolia.contracts?.morToken?.address,
      mainnetBuildersAddress: mainnetChains.base.contracts?.builders?.address,
      mainnetTokenAddress: mainnetChains.base.contracts?.morToken?.address,
    });
  }, [chainId, isTestnet, networksToDisplay, contractAddress]);
  
  // Get subnet admin address from contract if builder.admin is missing (for newly created subnets)
  const { data: subnetAdminData } = useReadContract({
    address: contractAddress,
    abi: isTestnet ? BuildersV4Abi : BuildersAbi,
    functionName: isTestnet ? 'subnets' : 'builderPools', // BuildersV4 uses 'subnets', Builders uses 'builderPools'
    args: subnetId ? [subnetId] : undefined,
    query: {
      enabled: !!subnetId && !!contractAddress && (!builder?.admin), // Only fetch if admin is missing
      staleTime: 5 * 60 * 1000,
    },
  });
  
  // Extract admin address from contract data
  const contractAdminAddress = useMemo(() => {
    if (!subnetAdminData) return null;
    // BuildersV4 returns [name, admin, ...], Builders returns [name, admin, ...]
    const admin = Array.isArray(subnetAdminData) ? subnetAdminData[1] : null;
    return admin ? String(admin).toLowerCase() : null;
  }, [subnetAdminData]);
  
  // Use contract admin if builder.admin is missing
  const effectiveAdmin = useMemo(() => {
    return builder?.admin?.toLowerCase() || contractAdminAddress || null;
  }, [builder?.admin, contractAdminAddress]);
  
  // Determine if user is admin for edit button visibility
  const isUserAdmin = useMemo(() => {
    const userAddresses = [
      authUserAddress?.toLowerCase(),
      userAddress?.toLowerCase()
    ].filter(Boolean);
    
    if (!effectiveAdmin || userAddresses.length === 0) {
      console.log('[BuilderPage] Edit button check - No admin or user addresses:', {
        effectiveAdmin,
        builderAdminFromData: builder?.admin?.toLowerCase(),
        contractAdminAddress,
        userAddresses,
        authUserAddress,
        userAddress,
        subnetId
      });
      return false;
    }
    
    const isAdmin = userAddresses.some(addr => addr === effectiveAdmin);
    
    console.log('[BuilderPage] Edit button check:', {
      isAdmin,
      effectiveAdmin,
      builderAdminFromData: builder?.admin?.toLowerCase(),
      contractAdminAddress,
      userAddresses,
      builderName: builder?.name,
      subnetId
    });
    
    return isAdmin;
  }, [effectiveAdmin, authUserAddress, userAddress, builder?.admin, contractAdminAddress, builder?.name, subnetId]);

  // Get staker information from the contract
  const { data: stakerData, refetch: refetchStakerDataForUser } = useReadContract({
    address: contractAddress,
    abi: isTestnet ? BuildersV4Abi : BuildersAbi, // BuildersV4 for testnet, BuildersAbi for mainnet
    functionName: 'usersData', // Both testnet (BuildersV4) and mainnet use usersData
    args: subnetId && userAddress ? [userAddress, subnetId] : undefined, // Consistent parameter order: [user, subnetId]
    query: {
      enabled: !!subnetId && !!userAddress && !!contractAddress, // Only enable if all args are present
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  });
  
  // Update user staked amount and time until unlock when data is loaded
  useEffect(() => {
    console.log("Processing staker data:", { stakerData, isTestnet, userAddress });

    if (stakerData) {
      // BuildersV4 (testnet) and mainnet both use usersData with the same structure:
      // [lastDeposit, claimLockStart, deposited, virtualDeposited]
      // [uint128, uint128, uint256, uint256]
      // Note: claimLockStart is for claim locks, NOT withdrawal locks
      // For withdrawal unlock time, we use: lastDeposit + withdrawLockPeriodAfterDeposit
      const stakerArray = stakerData as [bigint, bigint, bigint, bigint];
      const lastStakeData = stakerArray[0]; // lastDeposit timestamp
      const depositedData = stakerArray[2]; // staked amount
      const staked = depositedData;
      const lastStake = lastStakeData;

      // Calculate withdrawal unlock time from lastDeposit + withdrawLockPeriodAfterDeposit
      // This is the correct formula for withdrawal locks (not claim locks)
      let withdrawalUnlockEnd: bigint;

      if (lastStake !== BigInt(0)) {
        // Calculate unlock time from last deposit + lock period
        const lpSeconds = builder?.withdrawLockPeriodAfterDeposit
          ? Number(builder.withdrawLockPeriodAfterDeposit)
          : (builder?.withdrawLockPeriodRaw ?? withdrawLockPeriod);
        withdrawalUnlockEnd = BigInt(Number(lastStake) + lpSeconds);
        console.log("Calculating withdrawal unlock from lastDeposit:", {
          lastDeposit: lastStake.toString(),
          lockPeriod: lpSeconds,
          calculatedUnlockEnd: withdrawalUnlockEnd.toString()
        });
      } else {
        // No stake data available
        withdrawalUnlockEnd = BigInt(0);
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
      
      // Calculate time until withdrawal unlock
      const now = Math.floor(Date.now() / 1000);
      const unlockEndNumber = Number(withdrawalUnlockEnd);
      let calculatedTimeLeft: string;

      if (unlockEndNumber > now) {
        const secondsRemaining = unlockEndNumber - now;

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
        withdrawalUnlockEnd: new Date(Number(withdrawalUnlockEnd) * 1000).toLocaleString('en-US'),
        lastDeposit: new Date(Number(lastStake) * 1000).toLocaleString('en-US'),
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
        unlockDate: (('lastStake' in user && typeof user.lastStake === 'string') ? parseInt(user.lastStake) : 0) +
          (builder?.withdrawLockPeriodAfterDeposit
            ? Number(builder.withdrawLockPeriodAfterDeposit)
            : (builder?.withdrawLockPeriodRaw ?? withdrawLockPeriod)),
    }),
    network: networksToDisplay[0],
  }), [isTestnet, hookProjectId, networksToDisplay, builder?.withdrawLockPeriodAfterDeposit, builder?.withdrawLockPeriodRaw, withdrawLockPeriod]);

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
      
      // Refresh multiple times to ensure we get updated data from blockchain
      const refreshMultipleTimes = () => {
        // First immediate refresh
        refreshStakingEntries();
        
        // Then refresh again after delays
        setTimeout(() => {
          console.log(`Refreshing staking entries (attempt 2/3)...`);
          refreshStakingEntries();
        }, 2000);
        
        setTimeout(() => {
          console.log(`Refreshing staking entries (attempt 3/3)...`);
          refreshStakingEntries();
        }, 4000);
      };
      
      refreshMultipleTimes();
      refreshStakingDataRef.current = false; 
    }
  }, [refreshStakingEntries]);


  
  // Create a ref to store the approval refresh function
  const refreshApprovalRef = useRef<((amount: string) => Promise<boolean> | boolean) | null>(null);
  // Create a ref to store the allowance refetch function
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const refetchAllowanceRef = useRef<(() => Promise<any>) | null>(null);
  
  // Staking hook
  const stakingContractHookProps: UseStakingContractInteractionsProps = useMemo(() => ({
    subnetId: subnetId || undefined,
    networkChainId: subnetChainId,
    onTxSuccess: () => {
      console.log("Transaction successful (stake/withdraw/claim), refreshing staking table and current user staker data.");
      refreshStakingDataRef.current = true; // For the main staking table
      const currentStakeAmount = stakeAmount; // Capture current stake amount
      setStakeAmount(""); // Clear stake input
      
      // Signal the WithdrawalPositionCard to reset its withdrawal amount
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
      
      // Invalidate userStakedBuilders query to refresh "Staking in" tab on builders page
      // Use a delay to allow blockchain state to propagate
      setTimeout(() => {
        console.log("Invalidating userStakedBuilders query to refresh 'Staking in' tab...");
        queryClient.invalidateQueries({ queryKey: ['userStakedBuilders'] });
      }, 2000); // 2 second delay to allow blockchain state to update

      // Refresh single builder metrics immediately (for mainnet)
      // This is more efficient than refreshing all builders
      if (!isTestnet && refetchSingleBuilder) {
        // Invalidate immediately to mark data as stale
        queryClient.invalidateQueries({ queryKey: ['singleBuilder', singleBuilderProjectId] });
        
        // Then refetch multiple times to ensure we get updated data
        const refetchMetrics = async () => {
          for (let i = 0; i < 3; i++) {
            await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1))); // 2s, 4s, 6s
            console.log(`Refreshing single builder metrics (attempt ${i + 1}/3)...`);
            try {
              await refetchSingleBuilder();
              console.log(`Successfully refreshed single builder metrics (attempt ${i + 1}/3)`);
            } catch (error: unknown) {
              console.error(`Error refreshing single builder metrics (attempt ${i + 1}/3):`, error);
            }
          }
        };
        refetchMetrics();
      }
      
      // Refresh builders data to update totalStaked amounts in "Your Subnets" table
      // Use timeout to allow blockchain state to propagate
      setTimeout(() => {
        console.log("Refreshing builders data after successful transaction to update totalStaked amounts...");
        refreshData().then(() => {
          console.log("Successfully refreshed builders data after transaction");
        }).catch((error: unknown) => {
          console.error("Error refreshing builders data:", error);
        });
      }, 3000); // 3 second delay to allow blockchain state to update and propagate
      
      // Force refresh allowance and approval state after successful transaction
      // Use timeout to allow blockchain state to update
      setTimeout(async () => {
        console.log("Refreshing allowance and approval state after successful transaction...");
        // First refresh the allowance data
        if (refetchAllowanceRef.current) {
          try {
            await refetchAllowanceRef.current();
            console.log("Successfully refreshed allowance after transaction");
            // Then check approval state with the fresh allowance
            if (refreshApprovalRef.current && currentStakeAmount && parseFloat(currentStakeAmount) > 0) {
              // Small delay to ensure state propagates
              await new Promise(resolve => setTimeout(resolve, 500));
              const result = refreshApprovalRef.current(currentStakeAmount);
              console.log("Successfully refreshed approval state after transaction, result:", result);
            }
          } catch (error: unknown) {
            console.error("Error refreshing allowance/approval state:", error);
          }
        } else if (refreshApprovalRef.current && currentStakeAmount && parseFloat(currentStakeAmount) > 0) {
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
  }), [subnetId, subnetChainId, builder?.withdrawLockPeriodRaw, refetchStakerDataForUser, stakeAmount, refreshData, isTestnet, refetchSingleBuilder, singleBuilderProjectId, queryClient]);

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
    refetchClaimableAmount,
    refetchAllowance
  } = useStakingContractInteractions(stakingContractHookProps);

  // Set the refs to the actual functions for use in the onTxSuccess callback
  useEffect(() => {
    refreshApprovalRef.current = checkAndUpdateApprovalNeeded;
  }, [checkAndUpdateApprovalNeeded]);

  useEffect(() => {
    refetchAllowanceRef.current = refetchAllowance || null;
  }, [refetchAllowance]);

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
  // Only check if we have allowance data loaded to avoid false positives
  useEffect(() => {
    if (stakeAmount && parseFloat(stakeAmount) > 0 && !isLoadingData) {
      checkAndUpdateApprovalNeeded(stakeAmount);
    } else if (stakeAmount && parseFloat(stakeAmount) > 0 && isLoadingData) {
      // If data is still loading, don't assume approval is needed
      // Wait for data to load first
      console.log("Waiting for allowance data to load before checking approval");
    }
  }, [stakeAmount, checkAndUpdateApprovalNeeded, isLoadingData]);

  // Refresh approval state when allowance data loads
  // This fixes the issue where interface keeps asking for approval after page reload
  useEffect(() => {
    if (stakeAmount && parseFloat(stakeAmount) > 0 && !isLoadingData) {
      console.log("Refreshing approval state due to allowance data update");
      checkAndUpdateApprovalNeeded(stakeAmount);
    }
  }, [stakeAmount, checkAndUpdateApprovalNeeded, isLoadingData]);

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

    // Refresh allowance first to ensure we have the latest data
    if (refetchAllowance) {
      console.log("Refreshing allowance before checking approval...");
      try {
        await refetchAllowance();
        // Small delay to ensure state updates
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error("Error refreshing allowance:", error);
        // Continue anyway - the check will use cached data
      }
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
      // This code is for demonstration - since we can't directly reset WithdrawalPositionCard's state
      // Another approach would be to pass a resetWithdrawAmount prop to WithdrawalPositionCard
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
  
  const [showNetworkSwitchNotice, setShowNetworkSwitchNotice] = useState(false);

  const handleOpenJsonApi = () => {
    const { subnet_id, network } = Object.fromEntries(
      new URLSearchParams(window.location.search)
    );
    const slugPath = window.location.pathname.replace(/\/$/, '');
    const queryParams = new URLSearchParams();
    if (subnet_id) queryParams.set('subnet_id', subnet_id);
    if (network) queryParams.set('network', network);
    const queryString = queryParams.toString();
    const jsonApiUrl = `${slugPath}.json${queryString ? '?' + queryString : ''}`;
    window.open(jsonApiUrl, '_blank');
  };
  
  // Determine if we should show skeleton loading state
  // Show skeleton if: loading, no builder, or no subnetId
  const showSkeleton = isLoading || !builder || !subnetId;
  
  // Show skeleton loading state instead of error messages
  if (showSkeleton) {
    const builderName = builder?.name;
    
    return (
      <div className="page-container">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Builder Header Skeleton */}
          <div className="space-y-4">
            {/* Mobile Layout Skeleton */}
            <div className="sm:hidden space-y-4">
              <div className="flex items-center gap-4">
                <Skeleton className="size-16 sm:size-24 rounded-xl" />
                {builderName ? (
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-100 flex-1">{builderName}</h1>
                ) : (
                  <Skeleton className="h-7 w-48 flex-1" />
                )}
              </div>
              <Skeleton className="h-6 w-full max-w-md" />
            </div>
            
            {/* Desktop Layout Skeleton */}
            <div className="hidden sm:flex items-start gap-6">
              <Skeleton className="size-24 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-4">
                {builderName ? (
                  <h1 className="text-2xl font-bold text-gray-100 mb-2">{builderName}</h1>
                ) : (
                  <Skeleton className="h-8 w-64" />
                )}
                <Skeleton className="h-6 w-80" />
              </div>
            </div>
          </div>

          {/* Staking Stats Skeleton */}
          <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4`}>
            <MetricCardMinimal
              title="Total Staked"
              isLoading={true}
              disableGlow={false}
            />
            <MetricCardMinimal
              title="Total Claimed"
              isLoading={true}
              disableGlow={false}
            />
            <MetricCardMinimal
              title="Cumulative stakers"
              isLoading={true}
              disableGlow={false}
            />
            <MetricCardMinimal
              title="Lock Period"
              isLoading={true}
              disableGlow={false}
            />
          </div>

          {/* Staking Actions Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="relative">
              <StakingFormCard
                title="Stake MOR"
                value=""
                onStake={() => {}}
                onAmountChange={() => {}}
                maxAmount={0}
                tokenSymbol="MOR"
                disableStaking={true}
                buttonText="Stake MOR"
              />
            </div>
            <div className="relative">
              <WithdrawalPositionCard
                userStakedAmount={0}
                timeUntilUnlock=""
                onWithdraw={() => {}}
                disableWithdraw={true}
                withdrawButtonText="Withdraw MOR"
                tokenSymbol="MOR"
                compactMode={true}
              />
            </div>
          </div>

          {/* Staking Table Skeleton */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold">Active staking addresses</CardTitle>
            </CardHeader>
            <CardContent>
              <StakingTable
                entries={[]}
                isLoading={true}
                error={null}
                sortColumn="amount"
                sortDirection="desc"
                onSort={() => {}}
                currentPage={1}
                totalPages={1}
                onPreviousPage={() => {}}
                onNextPage={() => {}}
                hideColumns={['claimed', 'fee']}
                getExplorerUrl={getExplorerUrl}
                network={networksToDisplay[0] || 'Base'}
                formatDate={formatDate}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (buildersError) {
    return <div className="p-8 text-red-500">Error loading builder: {buildersError.message}</div>;
  }

  // Safety check: if builder is null, show skeleton
  if (!builder) {
    return (
      <div className="page-container">
        <div className="max-w-5xl mx-auto space-y-8">
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <NetworkSwitchNotification
        show={showNetworkSwitchNotice}
        networkName={`${networksToDisplay[0] || 'network'} network`}
      />
      
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
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenJsonApi}
            className="gap-2"
          >
            <Code className="size-4" />
            GetData
          </Button>
        </div>

        <ProjectHeader
          name={builder.name}
          description={parseBuilderDescription(builder.description)}
          imagePath={builder.image_src || ""}
          networks={networksForIconDisplay}
          website={builder.website || ""}
          rewardType={builder.reward_types?.[0] || ""}
          backButton={true}
          backPath="/builders"
          builder={builder}
          showEditButton={isUserAdmin}
          subnetId={subnetId || null}
          isTestnet={isTestnet}
        />

        {/* Staking Stats */}
        <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4`}>
          <MetricCardMinimal
            title="Total Staked"
            value={builderWithUpdatedMetrics?.totalStaked || builder?.totalStaked || 0}
            label="MOR"
            autoFormatNumbers={true}
            disableGlow={false}
            isLoading={isLoadingSingleBuilder}
          />
          
          <MetricCardMinimal
            title="Total Claimed"
            value={builderWithUpdatedMetrics?.totalClaimed || builder?.totalClaimed || 0}
            label="MOR"
            autoFormatNumbers={true}
            disableGlow={false}
            isLoading={isLoadingSingleBuilder}
          />
          
          <MetricCardMinimal
            title="Cumulative stakers"
            value={builderWithUpdatedMetrics?.stakingCount || builder?.stakingCount || 0}
            label="users"
            autoFormatNumbers={true}
            disableGlow={false}
            isLoading={isLoadingSingleBuilder}
          />
          
          <MetricCardMinimal
            title="Lock Period"
            value={builder.lockPeriod ? builder.lockPeriod.split(' ')[0] : "-"}
            label={builder.lockPeriod ? builder.lockPeriod.split(' ')[1] : ""}
            disableGlow={false}
          />
        </div>

        {/* Staking Actions */}
        {(() => {
          const isAdmin = authUserAddress && builder.admin && authUserAddress.toLowerCase() === builder.admin.toLowerCase();
          
          // Stake Form Component
          const StakeFormWithGlow = (
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
                    : (() => {
                        const isBaseMainnet = !isTestnet && networksToDisplay[0] === 'Base';
                        if (isBaseMainnet) {
                          return (
                            <>
                              Warning: You don&apos;t have enough {tokenSymbol}.{" "}
                              <Link href="/bridge-mor" className="underline hover:text-emerald-400 transition-colors">
                                Bridge more tokens
                              </Link>
                            </>
                          );
                        }
                        return `Warning: You don't have enough ${tokenSymbol}`;
                      })()
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
          );

          // Claim Form Component (only for admins)
          const ClaimFormWithGlow = isAdmin ? (
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
          ) : null;

          // Withdrawal Position Card Component
          const WithdrawalCardWithGlow = (
            <div className="relative">
              <WithdrawalPositionCard
                userStakedAmount={userStakedAmount || 0}
                rawStakedAmount={rawStakedAmount || undefined}
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
                compactMode={!isAdmin}
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
          );

          // Render layout based on admin status
          if (isAdmin) {
            // Admin layout - 3/5 and 2/5 split with claim form
            return (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
                <div className="md:col-span-3 space-y-4">
                  {StakeFormWithGlow}
                  {ClaimFormWithGlow}
                </div>
                <div className="md:col-span-2">
                  {WithdrawalCardWithGlow}
                </div>
              </div>
            );
          } else {
            // Non-admin layout - 1/2 and 1/2 split without claim form
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {StakeFormWithGlow}
                {WithdrawalCardWithGlow}
              </div>
            );
          }
        })()}

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