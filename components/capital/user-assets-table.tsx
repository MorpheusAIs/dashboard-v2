"use client";

import { useMemo, useState } from "react";
import { TokenIcon } from '@web3icons/react';
import { DataTable, Column } from "@/components/ui/data-table";
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
  LockOpen,
  HandCoins,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";
import { formatAssetAmount, formatStakedAmount } from "./utils/asset-formatters";
import type { UserAsset } from "./types/user-asset";
import type { AssetSymbol } from "@/context/CapitalPageContext";

interface UserAssetsTableProps {
  userAssets: UserAsset[];
  isLoading: boolean;
  sorting: { id: string; desc: boolean } | null;
  onSortingChangeAction: (columnId: string) => void;
  onDropdownOpenChangeAction: (assetId: string, open: boolean) => void;
  onDropdownActionAction: (modalType: 'deposit' | 'withdraw' | 'changeLock' | 'claimMorRewards' | 'stakeMorRewards', assetSymbol?: AssetSymbol) => void;
  openDropdownId: string | null;
  isAnyActionProcessing: boolean;
  isModalTransitioning: boolean;
  isDropdownTransitioning: boolean;
}

export function UserAssetsTable({
  userAssets,
  isLoading,
  sorting,
  onSortingChangeAction,
  onDropdownOpenChangeAction,
  onDropdownActionAction,
  openDropdownId,
  isAnyActionProcessing,
  isModalTransitioning,
  isDropdownTransitioning
}: UserAssetsTableProps) {
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  // Define columns for the assets table
  const assetsColumns: Column<UserAsset>[] = useMemo(
    () => [
      {
        id: "asset",
        header: "Asset",
        cell: (asset) => (
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center">
              <TokenIcon symbol={asset.icon} className='rounded-lg' variant="background" size="24" />
            </div>
            <span className="font-medium text-white">{asset.symbol}</span>
          </div>
        ),
      },
      {
        id: "amountStaked",
        header: "Amount Deposited",
        accessorKey: "amountStaked",
        enableSorting: true,
        cell: (asset) => (
          <div className="flex items-center gap-2">
            <span className="text-gray-200">
              {formatStakedAmount(asset.amountStaked, asset.assetSymbol)}
            </span>
            {asset.amountStaked > 0 && (
              <Badge className={`h-4 min-w-4 rounded-full px-1 font-mono tabular-nums ${
                asset.canWithdraw
                  ? "bg-emerald-400 hover:bg-emerald-500 text-black border-emerald-400"
                  : "bg-yellow-600 hover:bg-yellow-700 text-white border-yellow-600"
              }`}>
                {asset.canWithdraw ? (
                  <LockOpen className="h-3 w-3" />
                ) : (
                  <Lock className="h-3 w-3" />
                )}
              </Badge>
            )}
          </div>
        ),
      },
      {
        id: "depositUnlockDate",
        header: "Deposit Unlock Date",
        cell: (asset) => (
          <span className="text-gray-300 whitespace-nowrap">
            {asset.withdrawUnlockDate || "N/A"}
          </span>
        ),
      },
      {
        id: "available",
        header: "Available to Deposit",
        accessorKey: "available",
        enableSorting: true,
        cell: (asset) => (
          <span className="text-gray-200">
            {formatAssetAmount(asset.available, asset.assetSymbol)}
          </span>
        ),
      },
      {
        id: "dailyEmissions",
        header: "Daily Emissions",
        accessorKey: "dailyEmissions",
        enableSorting: true,
        cell: (asset) => {
          const formattedValue = asset.dailyEmissions < 1 && asset.dailyEmissions >= 0
            ? asset.dailyEmissions.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 3 })
            : formatNumber(asset.dailyEmissions);

          return (
            <span className="text-gray-200">
              {formattedValue} MOR
            </span>
          );
        },
      },
      {
        id: "powerFactor",
        header: "Power Factor",
        accessorKey: "powerFactor",
        enableSorting: false, // Disable sorting for now since it's a formatted string
        cell: (asset) => (
          <span className="text-gray-200">
            {asset.powerFactor}
          </span>
        ),
      },
      {
        id: "unlockDate",
        header: "MOR Unlock Date",
        cell: (asset) => (
          <span className="text-gray-300 whitespace-nowrap">
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
          <div className="flex items-center gap-2">
            <span className={asset.canClaim ? "text-gray-200" : "text-gray-500"}>
              {formatNumber(asset.availableToClaim)} MOR
            </span>
            {asset.amountStaked > 0 && (
              <Badge className={`h-4 min-w-4 rounded-full px-1 font-mono tabular-nums ${
                asset.canClaim
                  ? "bg-emerald-400 hover:bg-emerald-500 text-black border-emerald-400"
                  : "bg-yellow-600 hover:bg-yellow-700 text-white border-yellow-600"
              }`}>
                {asset.canClaim ? (
                  <LockOpen className="h-3 w-3" />
                ) : (
                  <Lock className="h-3 w-3" />
                )}
              </Badge>
            )}
          </div>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: (asset) => (
          <DropdownMenu
            open={openDropdownId === asset.id}
            onOpenChange={(open) => onDropdownOpenChangeAction(asset.id, open)}
          >
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className={`h-8 w-8 p-0 rounded-lg transition-all duration-200 ${
                  hoveredRowId === asset.id 
                    ? 'animate-pulse ring-2 ring-emerald-500 ring-opacity-75' 
                    : ''
                }`} 
                disabled={isAnyActionProcessing || isModalTransitioning || isDropdownTransitioning}
              >
                <Ellipsis className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="mt-2 rounded-lg">
              <DropdownMenuItem onClick={() => onDropdownActionAction('stakeMorRewards', asset.assetSymbol)} disabled={isAnyActionProcessing || isModalTransitioning}>
                <TrendingUp className="mr-2 h-4 w-4" />
                {isModalTransitioning ? 'Opening...' : 'Stake Rewards'}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDropdownActionAction('withdraw', asset.assetSymbol)}
                disabled={isAnyActionProcessing || isModalTransitioning || !asset.canWithdraw}
                className={!asset.canWithdraw ? "text-gray-500 cursor-not-allowed" : ""}
              >
                <ArrowDownToLine className="mr-2 h-4 w-4" />
                {isModalTransitioning ? 'Opening...' : 'Withdraw'}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDropdownActionAction('claimMorRewards', asset.assetSymbol)}
                disabled={isAnyActionProcessing || isModalTransitioning || asset.availableToClaim <= 0}
                className={asset.availableToClaim <= 0 ? "text-gray-500 cursor-not-allowed" : ""}
              >
                <Lock className="mr-2 h-4 w-4" />
                {isModalTransitioning ? 'Opening...' : 'Lock Rewards'}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDropdownActionAction('claimMorRewards', asset.assetSymbol)}
                disabled={isAnyActionProcessing || isModalTransitioning || !asset.canClaim}
                className={!asset.canClaim ? "text-gray-500 cursor-not-allowed" : ""}
              >
                <HandCoins className="mr-2 h-4 w-4" />
                {isModalTransitioning ? 'Opening...' : 'Claim Rewards'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [isAnyActionProcessing, onDropdownActionAction, openDropdownId, onDropdownOpenChangeAction, isModalTransitioning, isDropdownTransitioning, hoveredRowId]
  );

  return (
    <div className="[&>div]:max-h-[400px] overflow-auto custom-scrollbar rounded-xl">
      <DataTable
        columns={assetsColumns}
        data={userAssets}
        isLoading={isLoading}
        sorting={sorting}
        onSortingChange={onSortingChangeAction}
        loadingRows={2}
        noResultsMessage="No assets found."
        onRowHover={setHoveredRowId}
        getItemId={(asset) => asset.id}
      />
    </div>
  );
}
