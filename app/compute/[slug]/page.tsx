"use client";

import { useParams } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompute } from "@/context/compute-context";
import { GET_SUBNET_USERS } from "@/app/graphql/queries/compute";
import { SubnetUser } from "@/app/graphql/types";
import { ProjectHeader } from "@/components/staking/project-header";
import { StakingFormCard } from "@/components/staking/staking-form-card";
import { StakingPositionCard } from "@/components/staking/staking-position-card";
import { StakingTable } from "@/components/staking-table";
import { useStakingData } from "@/hooks/use-staking-data";
import Link from "next/link";

// Format date from timestamp
const formatDate = (timestamp: string): string => {
  if (!timestamp) return "N/A";
  try {
    return new Date(parseInt(timestamp) * 1000).toLocaleDateString();
  } catch {
    return "Invalid date";
  }
};

// Format address display
const formatAddress = (address: string): string => {
  if (!address) return "";
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

// Function to get explorer URL based on network
const getExplorerUrl = (address: string): string => {
  return `https://basescan.org/address/${address}`;
};

export default function ComputeSubnetPage() {
  const { slug } = useParams();
  const { subnets, isLoading: isLoadingSubnets } = useCompute();
  const [userStakedAmount] = useState(0); // Mock user's staked amount
  
  // Find the subnet based on the slug
  const subnet = !isLoadingSubnets ? subnets.find(s => 
    s.name.toLowerCase().replace(/\s+/g, '-') === slug.toString().toLowerCase()
  ) : null;
  
  // Format staking entries from subnet users
  const formatStakingEntry = useCallback((user: SubnetUser) => {
    return {
      address: user.address,
      displayAddress: formatAddress(user.address),
      amount: parseFloat(user.staked) / 10**18,
      claimed: parseFloat(user.claimed) / 10**18,
      fee: subnet?.fee || 90, // Use subnet fee or default to 90%
    };
  }, [subnet?.fee]);
  
  // Use our custom hook for data fetching
  const { 
    entries: stakingEntries, 
    isLoading: isLoadingEntries, 
    error,
    pagination,
    sorting,
    refresh
  } = useStakingData({
    projectId: subnet?.id,
    queryEndpoint: 'https://api.studio.thegraph.com/query/73688/lumerin-node/version/latest',
    queryDocument: GET_SUBNET_USERS,
    formatEntryFunc: formatStakingEntry,
    initialSort: { column: 'amount', direction: 'desc' },
    initialPageSize: 5,
    isComputeProject: true,
  });

  // When subnet changes, refresh the data
  useEffect(() => {
    if (subnet?.id) {
      refresh();
    }
  }, [subnet?.id, refresh]);
  
  // Whether everything is loading
  const isLoading = isLoadingSubnets || isLoadingEntries;
  
  // Handlers for staking actions
  const handleStake = (amount: string) => {
    alert(`Staking ${amount} MOR to ${subnet?.name}`);
  };

  const handleWithdraw = (amount: string) => {
    alert(`Withdrawing ${amount} MOR from ${subnet?.name}`);
  };
  
  if (isLoadingSubnets) {
    return <div className="p-8">Loading subnet details...</div>;
  }
  
  if (!subnet) {
    return (
      <div className="p-8">
        <p>Subnet not found</p>
        <Link href="/compute" className="text-emerald-400 hover:underline">
          Return to Compute page
        </Link>
      </div>
    );
  }
  
  const additionalWithdrawInfo = (
    <div className="text-xs text-gray-400 pt-4 mt-2 border-t border-gray-800">
      You will be able to claim staked tokens after the Subnet deregistration.
      <br />
      Deregistration will be available on {formatDate(subnet.deregistrationOpensAt)}.
    </div>
  );

  return (
    <div className="page-container">
      <div className="flex flex-col gap-8">
        {/* Header with back button and title */}
        <ProjectHeader
          name={subnet.name}
          backButton={true}
          backPath="/compute"
        />

        {/* Overview section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="col-span-1 md:col-span-2">
            <Card className="bg-card-darker">
              <CardHeader>
                <CardTitle>Subnet Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-400">Subnet Fee</h3>
                      <p className="mt-1 text-lg font-medium text-gray-200">{subnet.fee}%</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-400">Total Staked</h3>
                      <p className="mt-1 text-lg font-medium text-gray-200">{subnet.totalStaked.toLocaleString()} MOR</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-400">Total Claimed</h3>
                      <p className="mt-1 text-lg font-medium text-gray-200">{subnet.totalClaimed.toLocaleString()} MOR</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-400">Owner</h3>
                      <div className="mt-1 flex items-center">
                        <a 
                          href={getExplorerUrl(subnet.owner)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-400 hover:text-emerald-300 transition-colors flex items-center"
                        >
                          {formatAddress(subnet.owner)}
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="ml-1 h-3 w-3"
                          >
                            <path d="M7 7h10v10M7 17 17 7" />
                          </svg>
                        </a>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-400">Total Stakers</h3>
                      <p className="mt-1 text-lg font-medium text-gray-200">{subnet.stakingCount}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-400">Deregistration Opens</h3>
                      <p className="mt-1 text-lg font-medium text-gray-200">{formatDate(subnet.deregistrationOpensAt)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Staking Card */}
          <div className="col-span-1">
            <StakingFormCard
              description="Stake MOR to support this subnet"
              onStake={handleStake}
            />

            {userStakedAmount > 0 && (
              <div className="mt-4">
                <StakingPositionCard
                  userStakedAmount={userStakedAmount}
                  onWithdraw={handleWithdraw}
                  showUnlockTime={false}
                  additionalInfo={additionalWithdrawInfo}
                />
              </div>
            )}
          </div>
        </div>

        {/* Stakers Table */}
        <div className="mt-8">
          <h2 className="section-title mb-4">Stakers</h2>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
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
                  hideColumns={['timestamp', 'unlockDate']}
                  getExplorerUrl={getExplorerUrl}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 