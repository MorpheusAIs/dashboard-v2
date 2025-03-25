"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { builders, Builder } from "../builders-data";
import { ethers } from "ethers";
import { GET_BUILDERS_PROJECT_BY_NAME, GET_BUILDERS_PROJECT_USERS } from "@/app/graphql/queries/builders";
import { BuildersUser } from "@/app/graphql/types";
import { ProjectHeader } from "@/components/staking/project-header";
import { StakingStatsCard, StatItem } from "@/components/staking/staking-stats-card";
import { StakingFormCard } from "@/components/staking/staking-form-card";
import { StakingPositionCard } from "@/components/staking/staking-position-card";
import { StakingTable } from "@/components/staking-table";
import { useStakingData } from "@/hooks/use-staking-data";
import { GlowingEffect } from "@/components/ui/glowing-effect";

// Function to format a timestamp to date
const formatDate = (timestamp: number): string => {
  return new Date(timestamp * 1000).toLocaleDateString();
};

// Function to format wei to MOR tokens (without decimals)
const formatMOR = (weiAmount: string): number => {
  try {
    // Parse the amount and round to the nearest integer
    return Math.round(parseFloat(ethers.utils.formatUnits(weiAmount, 18)));
  } catch (error) {
    console.error("Error formatting MOR:", error);
    return 0;
  }
};

// Function to get explorer URL based on network
const getExplorerUrl = (address: string, network?: string): string => {
  return network === 'Arbitrum' 
    ? `https://arbiscan.io/address/${address}`
    : `https://basescan.org/address/${address}`;
};

// Create a custom stats card component with glowing effect
function GlowingStatCard({ item }: { item: StatItem }) {
  return (
    <div className="relative">
      <Card>
        <CardHeader>
          <CardTitle>{item.label}</CardTitle>
          {item.description && (
            <p className="text-sm text-gray-400">{item.description}</p>
          )}
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-gray-100">
            {typeof item.value === 'number' 
              ? item.value.toLocaleString() 
              : item.value}
          </p>
        </CardContent>
      </Card>
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
}

export default function BuilderPage() {
  const { slug } = useParams();
  const [userStakedAmount] = useState(1000); // Mock user's staked amount
  const [timeLeft] = useState("15 days"); // Mock time left until unlock
  const [withdrawLockPeriod] = useState<number>(30 * 24 * 60 * 60); // Default to 30 days
  
  // Find the builder based on the slug
  const builder = builders.find((b: Builder) => b.name.toLowerCase().replace(/\s+/g, '-') === slug);

  // Use the networks from the builder data
  const networksToDisplay = builder?.networks || ['Base']; // Default to Base if not specified
  
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
  } = useStakingData({
    projectName: builder?.name,
    network: networksToDisplay[0],
    queryDocument: GET_BUILDERS_PROJECT_USERS,
    formatEntryFunc: formatStakingEntry,
    initialSort: { column: 'amount', direction: 'desc' },
    initialPageSize: 5,
  });
  
  // Handlers for staking actions
  const handleStake = (amount: string) => {
    console.log("Staking:", amount);
  };

  const handleWithdraw = (amount: string) => {
    console.log("Withdrawing:", amount);
  };

  if (!builder) {
    return <div className="p-8">Builder not found</div>;
  }

  // Prepare stats data
  const statsItems = [
    { 
      label: "Total Staked", 
      value: `${builder.totalStaked.toLocaleString()} MOR`,
      description: "Current total MOR staked"
    },
    { 
      label: "Lock Period", 
      value: builder.lockPeriod || "-",
      description: "Required locking duration"
    },
    { 
      label: "Minimum Deposit", 
      value: `${builder.minDeposit} MOR`,
      description: "Minimum required MOR"
    }
  ];

  return (
    <div className="page-container">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Builder Header */}
        <ProjectHeader
          name={builder.name}
          description={builder.description}
          imagePath={builder.localImage}
          networks={networksToDisplay}
          website={builder.website}
          rewardType={builder.rewardType}
        />

        {/* Staking Stats */}
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-4`}>
          {statsItems.map((item, index) => (
            <GlowingStatCard key={index} item={item} />
          ))}
        </div>

        {/* Staking Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Stake Form */}
          <div className="relative">
            <StakingFormCard
              title="Stake MOR"
              description="Stake MOR to support this builder"
              onStake={handleStake}
              minAmount={builder.minDeposit}
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
            <CardTitle className="text-lg font-bold">All staking addresses</CardTitle>
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