"use client";

import { useParams } from "next/navigation";
import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Builder } from "../builders-data";
import { formatUnits } from "viem";
import { GET_BUILDERS_PROJECT_USERS, GET_BUILDER_SUBNET_USERS } from "@/app/graphql/queries/builders";
import { BuildersUser } from "@/app/graphql/types";
import { ProjectHeader } from "@/components/staking/project-header";
import { StakingFormCard } from "@/components/staking/staking-form-card";
import { StakingPositionCard } from "@/components/staking/staking-position-card";
import { StakingTable } from "@/components/staking-table";
import { useStakingData } from "@/hooks/use-staking-data";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { slugToBuilderName } from "@/app/utils/supabase-utils";
import { useBuilders } from "@/context/builders-context";
import { useChainId, useAccount, useReadContract } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';
import { MetricCard } from "@/components/metric-card";
import { formatTimePeriod } from "@/app/utils/time-utils";
import BuilderSubnetsAbi from '@/app/abi/BuilderSubnets.json';

// Function to format a timestamp to date
const formatDate = (timestamp: number): string => {
  return new Date(timestamp * 1000).toLocaleDateString();
};

// Function to format wei to MOR tokens (without decimals)
const formatMOR = (weiAmount: string): number => {
  try {
    // Parse the amount and round to the nearest integer
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

// Contract addresses for different networks
const CONTRACT_ADDRESSES = {
  'Arbitrum Sepolia': '0x6C9427E8d770Ad9e5a493D201280Cc178125CEc0',
  'Base': '0x0000000000000000000000000000000000000000' // Replace with actual mainnet address when available
};

export default function BuilderPage() {
  const { slug } = useParams();
  const { builders, buildersProjects, isLoading: isLoadingBuilders } = useBuilders();
  const chainId = useChainId();
  const { address: userAddress } = useAccount();
  const isTestnet = chainId === arbitrumSepolia.id;
  
  const [userStakedAmount, setUserStakedAmount] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [withdrawLockPeriod] = useState<number>(30 * 24 * 60 * 60); // Default to 30 days
  const refreshRef = useRef(false); // Add a ref to track if refresh has been called
  const [builder, setBuilder] = useState<Builder | null>(null);
  const [subnetId, setSubnetId] = useState<`0x${string}` | null>(null);
  
  // Find the builder from the context using the slug
  useEffect(() => {
    if (typeof slug !== 'string') return;
    
    console.log(`Trying to find builder for slug: ${slug}, isTestnet: ${isTestnet}`);
    console.log(`Available builders: ${builders.length}, available projects: ${buildersProjects.length}`);
    
    // Convert slug back to name by replacing hyphens with spaces and capitalizing words
    const name = slugToBuilderName(slug);
    console.log(`Converted slug "${slug}" to name "${name}"`);
    
    let foundBuilder = null;
    
    // Case-insensitive match for the builder name
    if (builders && builders.length > 0) {
      foundBuilder = builders.find(b => 
        b.name.toLowerCase() === name.toLowerCase()
      );
      
      if (foundBuilder) {
        console.log(`Found builder in builders array: ${foundBuilder.name}`);
      }
    }
    
    // If in testnet and builder not found, try to find it directly in buildersProjects
    if (!foundBuilder && isTestnet && buildersProjects && buildersProjects.length > 0) {
      console.log(`Searching in buildersProjects for: ${name}`);
      console.log(`Available projects in testnet:`, buildersProjects.map(b => b.name));
      
      // Try exact match first
      let testnetBuilder = buildersProjects.find(b => 
        b.name.toLowerCase() === name.toLowerCase()
      );
      
      // If not found, try a more flexible match (for cases where slugification might not be perfect)
      if (!testnetBuilder) {
        // Try removing special characters from both sides for comparison
        const normalizedName = name.replace(/[^\w\s]/g, '').toLowerCase();
        testnetBuilder = buildersProjects.find(b => {
          const normalizedBuilderName = b.name.replace(/[^\w\s]/g, '').toLowerCase();
          return normalizedBuilderName === normalizedName;
        });
        
        if (testnetBuilder) {
          console.log(`Found builder with normalized name match: ${testnetBuilder.name}`);
        }
      } else {
        console.log(`Found builder with exact name match: ${testnetBuilder.name}`);
      }
      
      if (testnetBuilder) {
        // Convert testnet project to Builder format if found
        
        // Get lock period in seconds - extracted from testnetBuilder
        const lockPeriodSeconds = parseInt(testnetBuilder.withdrawLockPeriodAfterStake || '0', 10);
        
        foundBuilder = {
          id: testnetBuilder.id,
          name: testnetBuilder.name,
          description: testnetBuilder.description || "",
          long_description: testnetBuilder.description || "",
          networks: testnetBuilder.networks || ["Arbitrum Sepolia"],
          network: "Arbitrum Sepolia",
          totalStaked: testnetBuilder.totalStakedFormatted || 0,
          minDeposit: testnetBuilder.minDeposit || 0,
          // Store raw seconds in a new property for formatting later
          withdrawLockPeriodRaw: lockPeriodSeconds,
          lockPeriod: formatTimePeriod(lockPeriodSeconds),
          stakingCount: testnetBuilder.stakingCount || 0,
          website: testnetBuilder.website || "",
          image_src: testnetBuilder.image || "",
          image: testnetBuilder.image || "",
          tags: [],
          github_url: "",
          twitter_url: "",
          discord_url: "",
          contributors: 0,
          github_stars: 0,
          reward_types: [],
          reward_types_detail: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }
    }
    
    if (foundBuilder) {
      console.log("Found builder:", foundBuilder.name);
      setBuilder(foundBuilder);
      
      // Compute the subnet ID from the builder name
      if (isTestnet) {
        try {
          // Set the subnet ID from the builder object or a computed value
          const testnetBuilder = buildersProjects.find(b => 
            b.name.toLowerCase() === foundBuilder.name.toLowerCase()
          );
          
          if (testnetBuilder && testnetBuilder.id) {
            console.log("Setting subnet ID from testnetBuilder:", testnetBuilder.id);
            setSubnetId(testnetBuilder.id as `0x${string}`);
          }
        } catch (error) {
          console.error("Error computing subnet ID:", error);
        }
      }
    } else {
      console.error(`Builder not found: ${name}. Available builders:`, 
        builders.map(b => b.name), 
        "Available projects:", 
        buildersProjects.map(b => b.name)
      );
    }
  }, [slug, builders, buildersProjects, isTestnet]);

  // Use the networks from the builder data
  const networksToDisplay = builder?.networks || (isTestnet ? ['Arbitrum Sepolia'] : ['Base']); 
  
  // Get contract address based on network
  const contractAddress = networksToDisplay[0] ? CONTRACT_ADDRESSES[networksToDisplay[0] as keyof typeof CONTRACT_ADDRESSES] : undefined;
  
  // Get staker information from the contract
  const { data: stakerData } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: BuilderSubnetsAbi,
    functionName: 'stakers',
    args: subnetId && userAddress ? [subnetId, userAddress] : undefined,
    query: {
      enabled: !!subnetId && !!userAddress && !!contractAddress
    }
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
  }, [stakerData]);
  
  // Custom formatter function to handle timestamp and unlock date
  const formatStakingEntry = useCallback((user: BuildersUser) => {
    // Calculate unlock date using the withdraw lock period
    const lastStakeTimestamp = parseInt(user.lastStake);
    // Use the raw seconds from the builder object when available, otherwise use the default
    const builderLockPeriod = builder?.withdrawLockPeriodRaw || withdrawLockPeriod;
    const unlockDateTimestamp = lastStakeTimestamp + builderLockPeriod;
    
    return {
      address: user.address,
      displayAddress: `${user.address.substring(0, 6)}...${user.address.substring(user.address.length - 4)}`,
      amount: formatMOR(user.staked),
      timestamp: lastStakeTimestamp,
      unlockDate: unlockDateTimestamp
    };
  }, [withdrawLockPeriod, builder]);
  
  // Use our custom hook for data fetching, with appropriate query for testnet/mainnet
  const { 
    entries: stakingEntries, 
    isLoading, 
    error,
    pagination,
    sorting,
    refresh
  } = useStakingData({
    projectName: builder?.name,
    network: networksToDisplay[0],
    queryDocument: isTestnet ? GET_BUILDER_SUBNET_USERS : GET_BUILDERS_PROJECT_USERS,
    formatEntryFunc: formatStakingEntry,
    initialSort: { column: 'amount', direction: 'desc' },
    initialPageSize: 5,
    isTestnet, // Pass isTestnet flag to the hook
  });
  
  // Add useEffect to trigger data refresh when builder changes
  useEffect(() => {
    if (builder?.name && !refreshRef.current) {
      console.log('Builder found, refreshing data:', builder.name);
      refreshRef.current = true; // Mark as refreshed
      refresh();
    } else if (!builder?.name) {
      console.log('No builder found for slug:', slug);
    }
  }, [builder?.name, refresh, slug]);
  
  // Handlers for staking actions
  const handleStake = (amount: string) => {
    console.log("Staking:", amount);
  };

  const handleWithdraw = (amount: string) => {
    console.log("Withdrawing:", amount);
  };

  if (isLoadingBuilders) {
    return <div className="p-8">Loading builder...</div>;
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
              description=""
              onStake={handleStake}
              minAmount={builder.minDeposit || 1000}
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
              onWithdraw={handleWithdraw}
              disableWithdraw={!userStakedAmount || timeLeft !== "Unlocked"}
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
            {error ? (
              <div className="text-red-500">Error loading staking data: {error.message}</div>
            ) : (
              <StakingTable
                entries={stakingEntries}
                isLoading={isLoading}
                error={error}
                sortColumn={sorting.column}
                sortDirection={sorting.direction}
                onSort={sorting.setSort}
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