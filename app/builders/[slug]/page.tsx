"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Builder } from "../builders-data";
import { formatUnits } from "viem";
import { GET_BUILDERS_PROJECT_USERS, GET_BUILDER_SUBNET_USERS } from "@/app/graphql/queries/builders";
import { type BuildersUser, type SubnetUser } from "@/app/graphql/types";
import { ProjectHeader } from "@/components/staking/project-header";
import { StakingFormCard } from "@/components/staking/staking-form-card";
import { StakingPositionCard } from "@/components/staking/staking-position-card";
import { StakingTable } from "@/components/staking-table";
import { useStakingData, type UseStakingDataProps, type BuilderSubnetUser as StakingBuilderSubnetUser } from "@/hooks/use-staking-data";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { slugToBuilderName } from "@/app/utils/supabase-utils";
import { useBuilders } from "@/context/builders-context";
import { useChainId, useAccount, useReadContract } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';
import { MetricCard } from "@/components/metric-card";
import BuilderSubnetsV2Abi from '@/app/abi/BuilderSubnetsV2.json';
import { useStakingContractInteractions, type UseStakingContractInteractionsProps } from "@/hooks/useStakingContractInteractions";
import { formatEther, type Address } from "viem";
import { testnetChains, mainnetChains } from '@/config/networks';

// Type for user in formatStakingEntry
type StakingUser = BuildersUser | StakingBuilderSubnetUser | SubnetUser;

// Function to format a timestamp to date
const formatDate = (timestamp: number): string => {
  return new Date(timestamp * 1000).toLocaleDateString();
};

// Function to format wei to MOR tokens (without decimals)
const formatMOR = (weiAmount: string): number => {
  try {
    return Math.round(parseFloat(formatUnits(BigInt(weiAmount), 18)));
  } catch (error) {
    console.error("Error formatting MOR:", error);
    return 0;
  }
};

// Function to get explorer URL based on network
const getExplorerUrl = (address: string, network?: string): string => {
  return network === 'Arbitrum' || network === 'Arbitrum Sepolia'
    ? `https://arbiscan.io/address/${address}`
    : `https://basescan.org/address/${address}`;
};

export default function BuilderPage() {
  const { slug } = useParams();
  const router = useRouter();
  const { builders, isLoading, error: buildersError } = useBuilders();
  const chainId = useChainId();
  const { address: userAddress } = useAccount();
  const isTestnet = chainId === arbitrumSepolia.id;
  const previousIsTestnetRef = useRef<boolean>();
  
  const [userStakedAmount, setUserStakedAmount] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [withdrawLockPeriod] = useState<number>(30 * 24 * 60 * 60); // Default to 30 days
  const refreshStakingDataRef = useRef(false); // Add a ref to track if refresh has been called
  const [builder, setBuilder] = useState<Builder | null>(null);
  const [subnetId, setSubnetId] = useState<Address | null>(null);
  const [stakeAmount, setStakeAmount] = useState<string>("");
  
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
    
    const name = slugToBuilderName(slug);
    let foundBuilder: Builder | null | undefined = null;
    
    if (builders && builders.length > 0) {
      foundBuilder = builders.find(b => 
        b.name.toLowerCase() === name.toLowerCase()
      );
    }

    if (foundBuilder) {
      const builderToSet: Builder = {
        ...foundBuilder,
        admin: foundBuilder.admin || null, 
      };
      setBuilder(builderToSet); // This sets the local builder state
      
      // Set subnetId (UUID for testnet identification if needed elsewhere, or builder.id)
      // Note: builder.id from BuilderDB is the UUID.
      if (foundBuilder.id) { 
        setSubnetId(foundBuilder.id as Address); 
      }
    } else {
      setBuilder(null); // Clear builder if not found
      setSubnetId(null);
    }
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
  const { data: stakerData } = useReadContract({
    address: contractAddress,
    abi: BuilderSubnetsV2Abi,
    functionName: 'stakers',
    args: subnetId && userAddress ? [subnetId, userAddress] : undefined,
    query: {
      enabled: !!subnetId && !!userAddress && !!contractAddress, // Only enable if all args are present
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  });
  
  // Update user staked amount and time until unlock when data is loaded
  useEffect(() => {
    if (stakerData) {
      // Staker data structure: [staked, virtualStaked, pendingRewards, rate, lastStake, claimLockEnd]
      const [staked, , , , , claimLockEnd] = stakerData as [bigint, bigint, bigint, bigint, bigint, bigint];
      
      // Format the staked amount
      const formattedStaked = parseFloat(formatUnits(staked, 18));
      setUserStakedAmount(Math.round(formattedStaked));
      
      // Calculate time until unlock
      const now = Math.floor(Date.now() / 1000);
      const claimLockEndNumber = Number(claimLockEnd);
      
      if (claimLockEndNumber > now) {
        const secondsRemaining = claimLockEndNumber - now;
        
        if (secondsRemaining < 60) {
          setTimeLeft(`${secondsRemaining} seconds`);
        } else if (secondsRemaining < 3600) {
          setTimeLeft(`${Math.floor(secondsRemaining / 60)} minutes`);
        } else if (secondsRemaining < 86400) {
          setTimeLeft(`${Math.floor(secondsRemaining / 3600)} hours`);
        } else {
          setTimeLeft(`${Math.floor(secondsRemaining / 86400)} days`);
        }
      } else {
        setTimeLeft("Unlocked");
      }
      
      console.log("Staker data loaded:", {
        staked: formattedStaked,
        claimLockEnd: new Date(Number(claimLockEnd) * 1000).toLocaleString(),
        timeLeft
      });
    } else {
      // Reset values if no data
      setUserStakedAmount(0);
      setTimeLeft("Not staked");
    }
  }, [stakerData, timeLeft]);
  
  // Custom formatter function to handle timestamp and unlock date
  const formatStakingEntry = useCallback((user: StakingUser) => ({
    address: user.address,
    displayAddress: `${user.address.substring(0, 6)}...${user.address.substring(user.address.length - 4)}`,
    amount: formatMOR(user.staked || '0'),
    timestamp: ('lastStake' in user && typeof user.lastStake === 'string') ? parseInt(user.lastStake) : 0,
    unlockDate: (('lastStake' in user && typeof user.lastStake === 'string') ? parseInt(user.lastStake) : 0) + (builder?.withdrawLockPeriodRaw || withdrawLockPeriod),
  }), [withdrawLockPeriod, builder]);

  const stakingDataHookProps: UseStakingDataProps = useMemo(() => ({
    queryDocument: isTestnet ? GET_BUILDER_SUBNET_USERS : GET_BUILDERS_PROJECT_USERS,
    projectId: hookProjectId, // Use the derived and stable hookProjectId
    isTestnet: isTestnet,
    formatEntryFunc: formatStakingEntry,
    network: networksToDisplay[0],
  }), [isTestnet, hookProjectId, formatStakingEntry, networksToDisplay]);

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
  
  // Staking hook
  const stakingContractHookProps: UseStakingContractInteractionsProps = useMemo(() => ({
    subnetId: subnetId || undefined,
    networkChainId: chainId,
    onTxSuccess: () => {
      console.log("Transaction successful, setting refreshStakingDataRef to true.");
      refreshStakingDataRef.current = true; 
      setStakeAmount("");
    },
    lockPeriodInSeconds: builder?.withdrawLockPeriodRaw,
  }), [subnetId, chainId, builder?.withdrawLockPeriodRaw]);

  const {
    isCorrectNetwork,
    tokenSymbol,
    tokenBalance,
    needsApproval,
    isApproving,
    isStaking,
    isWithdrawing,
    isSubmitting,
    handleNetworkSwitch,
    handleApprove,
    handleStake,
    handleWithdraw,
    checkAndUpdateApprovalNeeded
  } = useStakingContractInteractions(stakingContractHookProps);

  // Check if approval is needed when stake amount changes
  useEffect(() => {
    if (stakeAmount && parseFloat(stakeAmount) > 0) {
      checkAndUpdateApprovalNeeded(stakeAmount);
    }
  }, [stakeAmount, checkAndUpdateApprovalNeeded]);

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
      tokenSymbol
    });
    
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

  const onWithdrawSubmit = async (amount: string) => {
    console.log("Withdrawing:", amount);
    // If not on the correct network, switch first
    if (!isCorrectNetwork()) {
      await handleNetworkSwitch();
      return; // Exit after network switch to prevent further action
    }

    // Actually perform the withdrawal
    if (amount && parseFloat(amount) > 0) {
      await handleWithdraw(amount);
    }
  };

  // Loading state for the page should consider builder loading first
  if (isLoading) { // This isLoading is from useBuilders()
    return <div className="p-8">Loading builder details...</div>;
  }

  if (buildersError) {
    return <div className="p-8 text-red-500">Error loading builder: {buildersError.message}</div>;
  }

  if (!builder) {
    return <div className="p-8">Builder not found</div>;
  }

  return (
    <div className="page-container">
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
              title="Builder Stats"
              metrics={[
                { value: builder.totalStaked, label: "MOR" },
                { value: builder.stakingCount || 0, label: "staking" }
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
          
          <div className="relative">
            <MetricCard
              title="Minimum Deposit"
              metrics={[{ value: builder.minDeposit, label: "MOR" }]}
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
        </div>

        {/* Staking Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Stake Form */}
          <div className="relative">
            <StakingFormCard
              title="Stake MOR"
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

          {/* Withdrawal Form */}
          <div className="relative">
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
              description={
                timeLeft !== "Unlocked"
                  ? `Your funds are locked until ${timeLeft} from now.`
                  : userStakedAmount
                  ? `You can withdraw up to ${userStakedAmount} ${tokenSymbol}.`
                  : `You have no staked tokens to withdraw.`
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
        </div>

        {/* Staking Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold">All staking addresses ({builder.stakingCount || 0})</CardTitle>
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