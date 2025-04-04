"use client";

import { useParams } from "next/navigation";
import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Builder } from "../builders-data";
import { formatUnits } from "viem";
import { GET_BUILDERS_PROJECT_USERS } from "@/app/graphql/queries/builders";
import { BuildersUser } from "@/app/graphql/types";
import { ProjectHeader } from "@/components/staking/project-header";
import { StakingFormCard } from "@/components/staking/staking-form-card";
import { StakingPositionCard } from "@/components/staking/staking-position-card";
import { StakingTable } from "@/components/staking-table";
import { useStakingData } from "@/hooks/use-staking-data";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { slugToBuilderName } from "@/app/utils/supabase-utils";
import { useBuilders } from "@/context/builders-context";
import { useChainId } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';
import { MetricCard } from "@/components/metric-card";

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

export default function BuilderPage() {
  const { slug } = useParams();
  const { builders, buildersProjects, isLoading: isLoadingBuilders } = useBuilders();
  const chainId = useChainId();
  const isTestnet = chainId === arbitrumSepolia.id;
  
  const [userStakedAmount] = useState(1000); // Mock user's staked amount
  const [timeLeft] = useState("15 days"); // Mock time left until unlock
  const [withdrawLockPeriod] = useState<number>(30 * 24 * 60 * 60); // Default to 30 days
  const refreshRef = useRef(false); // Add a ref to track if refresh has been called
  const [builder, setBuilder] = useState<Builder | null>(null);
  
  // Find the builder from the context using the slug
  useEffect(() => {
    if (typeof slug !== 'string') return;
    
    console.log(`Trying to find builder for slug: ${slug}, isTestnet: ${isTestnet}`);
    console.log(`Available builders: ${builders.length}, available projects: ${buildersProjects.length}`);
    
    // Convert slug back to name by replacing hyphens with spaces and capitalizing words
    const name = slugToBuilderName(slug);
    
    let foundBuilder = null;
    
    // Case-insensitive match for the builder name
    if (builders && builders.length > 0) {
      foundBuilder = builders.find(b => 
        b.name.toLowerCase() === name.toLowerCase()
      );
    }
    
    // If in testnet and builder not found, try to find it directly in buildersProjects
    if (!foundBuilder && isTestnet && buildersProjects && buildersProjects.length > 0) {
      const testnetBuilder = buildersProjects.find(b => 
        b.name.toLowerCase() === name.toLowerCase()
      );
      
      if (testnetBuilder) {
        // Convert testnet project to Builder format if found
        foundBuilder = {
          id: testnetBuilder.id,
          name: testnetBuilder.name,
          description: testnetBuilder.description || "",
          long_description: testnetBuilder.description || "",
          networks: testnetBuilder.networks || ["Arbitrum Sepolia"],
          network: "Arbitrum Sepolia",
          totalStaked: testnetBuilder.totalStakedFormatted || 0,
          minDeposit: testnetBuilder.minDeposit || 0,
          lockPeriod: testnetBuilder.lockPeriod || "",
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
  
  // Custom formatter function to handle timestamp and unlock date
  const formatStakingEntry = useCallback((user: BuildersUser) => {
    // Calculate unlock date using the withdraw lock period
        const lastStakeTimestamp = parseInt(user.lastStake);
        const unlockDateTimestamp = lastStakeTimestamp + withdrawLockPeriod;
        
        return {
          address: user.address,
      displayAddress: `${user.address.substring(0, 6)}...${user.address.substring(user.address.length - 4)}`,
          amount: formatMOR(user.staked),
          timestamp: lastStakeTimestamp,
          unlockDate: unlockDateTimestamp
        };
  }, [withdrawLockPeriod]);
  
  // Use our custom hook for data fetching
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
    queryDocument: GET_BUILDERS_PROJECT_USERS,
    formatEntryFunc: formatStakingEntry,
    initialSort: { column: 'amount', direction: 'desc' },
    initialPageSize: 5,
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
              metrics={[{ value: builder.lockPeriod || "-", label: "" }]}
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
              userStakedAmount={userStakedAmount}
              timeUntilUnlock={timeLeft}
              onWithdraw={handleWithdraw}
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
            <CardTitle className="text-lg font-bold">All staking addresses ({builder.stakingCount})</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 