"use client";

import { useMemo, useState } from "react";
import { TokenIcon } from '@web3icons/react';
import { DataTable, Column } from "@/components/ui/data-table";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Ellipsis,
  TrendingUp,
  ArrowDownToLine,
  Lock,
  HandCoins,
} from "lucide-react";
import { useCapitalContext } from "@/context/CapitalPageContext";
import { formatNumber } from "@/lib/utils";
import { MetricCardMinimal } from "@/components/metric-card-minimal";

interface UserAsset {
  id: string;
  symbol: string;
  icon: string;
  amountStaked: number;
  available: number;
  dailyEmissions: number;
  powerFactor: number;
  unlockDate: string | null;
  availableToClaim: number;
}

export function UserAssetsPanel() {
  const {
    userAddress,
    setActiveModal,
    userDepositFormatted,
    isLoadingUserData,
  } = useCapitalContext();

  // State for sorting
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Check if user has stETH staked
  const hasStakedAssets = useMemo(() => {
    const depositAmount = parseFloat(userDepositFormatted.replace(/,/g, ''));
    return !isNaN(depositAmount) && depositAmount > 0;
  }, [userDepositFormatted]);

  // Mock data for metrics (in a real app, these would come from context/API)
  const metricsData = {
    stakedValue: hasStakedAssets ? "$324,691" : "$0",
    totalMorStaked: hasStakedAssets ? "3,326.57" : "0",
    dailyEmissionsEarned: hasStakedAssets ? "104.82" : "0",
    lifetimeEmissionsEarned: hasStakedAssets ? "19,677" : "0",
    referralRewards: hasStakedAssets ? "3,326.57" : "0",
  };

  // Mock data for assets (real data for stETH, placeholders for others)
  const userAssets: UserAsset[] = useMemo(() => {
    if (!hasStakedAssets) return [];

    const stethAmount = parseFloat(userDepositFormatted.replace(/,/g, ''));
    
    return [
      {
        id: "1",
        symbol: "stETH",
        icon: "eth",
        amountStaked: stethAmount,
        available: 8.054, // Placeholder
        dailyEmissions: 61.492, // Placeholder
        powerFactor: 0.1, // Placeholder
        unlockDate: "July 18, 2025", // Placeholder
        availableToClaim: 0.000, // Placeholder
      },
      {
        id: "2",
        symbol: "wBTC",
        icon: "btc",
        amountStaked: 0.285,
        available: 0.007,
        dailyEmissions: 23.217,
        powerFactor: 0.01,
        unlockDate: null,
        availableToClaim: 732.529,
      },
      {
        id: "3",
        symbol: "USDC",
        icon: "usdc",
        amountStaked: 26728.348,
        available: 15.267,
        dailyEmissions: 20.062,
        powerFactor: 0.01,
        unlockDate: "Oct 31, 2025",
        availableToClaim: 94.364,
      },
      {
        id: "4",
        symbol: "LINK",
        icon: "link",
        amountStaked: 0.000,
        available: 98.002,
        dailyEmissions: 0.000,
        powerFactor: 0,
        unlockDate: null,
        availableToClaim: 0.000,
      },
    ];
  }, [hasStakedAssets, userDepositFormatted]);

  // Sorting logic
  const sorting = useMemo(() => {
    if (!sortColumn) return null;
    return {
      id: sortColumn,
      desc: sortDirection === 'desc'
    };
  }, [sortColumn, sortDirection]);

  // Define columns for the assets table
  const assetsColumns: Column<UserAsset>[] = useMemo(
    () => [
      {
        id: "asset",
        header: "Asset",
        cell: (asset) => (
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center">
              <TokenIcon symbol={asset.icon} variant="background" size="24" />
            </div>
            <span className="font-medium text-white">{asset.symbol}</span>
          </div>
        ),
      },
      {
        id: "amountStaked",
        header: "Amount Staked",
        accessorKey: "amountStaked",
        enableSorting: true,
        cell: (asset) => (
          <span className="text-gray-200">
            {formatNumber(asset.amountStaked)}
          </span>
        ),
      },
      {
        id: "available",
        header: "Available",
        accessorKey: "available",
        enableSorting: true,
        cell: (asset) => (
          <span className="text-gray-200">
            {formatNumber(asset.available)}
          </span>
        ),
      },
      {
        id: "dailyEmissions",
        header: "Daily Emissions",
        accessorKey: "dailyEmissions",
        enableSorting: true,
        cell: (asset) => (
          <span className="text-gray-200">
            {formatNumber(asset.dailyEmissions)} MOR
          </span>
        ),
      },
      {
        id: "powerFactor",
        header: "Power Factor",
        accessorKey: "powerFactor",
        enableSorting: true,
        cell: (asset) => (
          <span className="text-gray-200">
            {asset.powerFactor}
          </span>
        ),
      },
      {
        id: "unlockDate",
        header: "Unlock Date",
        cell: (asset) => (
          <span className="text-gray-300">
            {asset.unlockDate || "N/A"}
          </span>
        ),
      },
      {
        id: "availableToClaim",
        header: "Available to Claim",
        accessorKey: "availableToClaim",
        enableSorting: true,
        cell: (asset) => (
          <span className="text-gray-200">
            {formatNumber(asset.availableToClaim)} MOR
          </span>
        ),
      },
      {
        id: "actions",
        header: "", // No header for actions column
        cell: () => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
                <Ellipsis className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="mt-2">
              <DropdownMenuItem onClick={() => setActiveModal('deposit')}>
                <TrendingUp className="mr-2 h-4 w-4" /> 
                Stake
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActiveModal('withdraw')}>
                <ArrowDownToLine className="mr-2 h-4 w-4" /> 
                Withdraw
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActiveModal('changeLock')}>
                <Lock className="mr-2 h-4 w-4" /> 
                Lock Rewards
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActiveModal('claim')}>
                <HandCoins className="mr-2 h-4 w-4" /> 
                Claim Rewards
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [setActiveModal]
  );

  // Handle sorting change
  const handleSortingChange = (columnId: string) => {
    if (sortColumn === columnId) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to asc
      setSortColumn(columnId);
      setSortDirection('asc');
    }
  };

  // Empty state component
  const EmptyState = () => (
    <div className="flex flex-col panel-gradient-base items-center h-[260px] justify-center py-12 px-6 rounded-xl border border-emerald-400/[0.1] bac">
      <h3 className={userAddress ? "text-lg font-semibold text-white mb-2" : "text-lg font-semibold text-gray-400 mb-2"}>
        {userAddress ? "Stake an asset to start earning" : "Please connect your wallet"}
      </h3>
      {userAddress && (
      <button
        className="copy-button"
        onClick={() => userAddress && setActiveModal('deposit')}
        disabled={!userAddress}
        >
          Stake
        </button>
      )}
    </div>
  );

  if (isLoadingUserData) {
    return (
      <div className="page-section mt-8">
        <div className="relative">
          <div className="section-content group relative">
            <div className="section-content-gradient" />
            <div className="p-6 text-center text-gray-400">
              Loading assets...
            </div>
          </div>
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
    );
  }

  return (
    <div className="page-section mt-8">
      <div className="relative">
        <GlowingEffect 
          spread={40}
          glow={true}
          disabled={false}
          proximity={64}
          inactiveZone={0.01}
          borderWidth={2}
          borderRadius="rounded-xl"
        />
        <div className="section-content group relative">
          <div className="section-content-gradient group-hover:bg-gradient-to-bl group-hover:from-emerald-400/10 group-hover:to-transparent" />
          <div className="p-4 md:p-6">
            {/* Header with title and stake button */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">My Position</h2>
              <button
                className="copy-button-base"
                onClick={() => setActiveModal('deposit')}
                disabled={!userAddress}
              >
                Stake
              </button>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <MetricCardMinimal
                title="Staked Value"
                value={metricsData.stakedValue}
                isUSD={true}
                disableGlow={true}
                className="col-span-1"
              />
              <MetricCardMinimal
                title="Daily Emissions"
                value={metricsData.dailyEmissionsEarned}
                label="MOR"
                disableGlow={true}
                autoFormatNumbers={true}
                className="col-span-1"
              />
              <MetricCardMinimal
                title="Lifetime Earned"
                value={metricsData.lifetimeEmissionsEarned}
                label="MOR"
                disableGlow={true}
                autoFormatNumbers={true}
                className="col-span-1"
              />
              <MetricCardMinimal
                title="MOR Staked"
                value={metricsData.totalMorStaked}
                label="MOR"
                disableGlow={true}
                autoFormatNumbers={true}
                className="col-span-1"
              />
            </div>

            {/* Assets table or empty state */}
            {hasStakedAssets ? (
              <div className="[&>div]:max-h-[400px] overflow-auto custom-scrollbar">
                <DataTable
                  columns={assetsColumns}
                  data={userAssets}
                  isLoading={false}
                  sorting={sorting}
                  onSortingChange={handleSortingChange}
                  loadingRows={4}
                  noResultsMessage="No assets found."
                />
              </div>
            ) : (
              <EmptyState />
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 