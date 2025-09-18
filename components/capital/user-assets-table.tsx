"use client";

import { useMemo } from "react";
import { TokenIcon } from '@web3icons/react';
import { DataTable, Column } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
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

// Helper function to format unlock date for tooltip in mm/dd/yyyy hh:mm format
function formatUnlockDateForTooltip(unlockDate: string | null): string {
  if (!unlockDate || unlockDate === "N/A") {
    return "No unlock date available";
  }

  // Try to parse the date string and format it
  try {
    const date = new Date(unlockDate);
    if (isNaN(date.getTime())) {
      return "Invalid unlock date";
    }

    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${month}/${day}/${year} ${hours}:${minutes}`;
  } catch (error) {
    console.error("Error formatting unlock date:", error);
    return "Error formatting date";
  }
}

interface UserAssetsTableProps {
  userAssets: UserAsset[];
  isLoading: boolean;
  sorting: { id: string; desc: boolean } | null;
  onSortingChangeAction: (columnId: string) => void;
  onDropdownOpenChangeAction: (assetId: string, open: boolean) => void;
  onDropdownActionAction: (modalType: 'deposit' | 'withdraw' | 'changeLock' | 'claim' | 'claimMorRewards' | 'stakeMorRewards', assetSymbol?: AssetSymbol) => void;
  openDropdownId: string | null;
  isUnlockDateReachedAction: (unlockDate: string | null) => boolean;
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
  isUnlockDateReachedAction,
  isAnyActionProcessing,
  isModalTransitioning,
  isDropdownTransitioning
}: UserAssetsTableProps) {
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
          <div className="flex items-center gap-2">
            <span className="text-gray-200">
              {formatStakedAmount(asset.amountStaked)}
            </span>
            {asset.amountStaked > 0 && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="inline-block">
                      <Badge className={`h-4 min-w-4 rounded-full px-1 font-mono tabular-nums cursor-pointer ${
                        isUnlockDateReachedAction(asset.unlockDate)
                          ? "bg-emerald-400 hover:bg-emerald-500 text-black border-emerald-400"
                          : "bg-yellow-600 hover:bg-yellow-700 text-white border-yellow-600"
                      }`}>
                        {isUnlockDateReachedAction(asset.unlockDate) ? (
                          <LockOpen className="h-3 w-3" />
                        ) : (
                          <Lock className="h-3 w-3" />
                        )}
                      </Badge>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    avoidCollisions={false}
                    className="bg-black/90 text-white border-emerald-500/20 z-50 rounded-xl"
                  >
                    <p className="text-sm font-medium">
                      {asset.canWithdraw
                        ? "Unlocked"
                        : `Locked until ${formatUnlockDateForTooltip(asset.unlockDate)}`
                      }
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        ),
      },
      {
        id: "available",
        header: "Available to Stake",
        accessorKey: "available",
        enableSorting: true,
        cell: (asset) => (
          <span className="text-gray-200">
            {formatAssetAmount(asset.available)}
          </span>
        ),
      },
      {
        id: "dailyEmissions",
        header: "Daily Emissions",
        accessorKey: "dailyEmissions",
        enableSorting: true,
        cell: (asset) => {
          return (
            <span className="text-gray-200">
              {formatNumber(asset.dailyEmissions)} MOR
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
        header: "Unlock Date",
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
            {asset.availableToClaim > 0 && (
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
        header: "", // No header for actions column
        cell: (asset) => (
          <DropdownMenu
            open={openDropdownId === asset.id}
            onOpenChange={(open) => onDropdownOpenChangeAction(asset.id, open)}
          >
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 p-0" disabled={isAnyActionProcessing || isModalTransitioning || isDropdownTransitioning}>
                <Ellipsis className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="mt-2">
              <DropdownMenuItem onClick={() => onDropdownActionAction('stakeMorRewards', asset.assetSymbol)} disabled={isAnyActionProcessing || isModalTransitioning}>
                <TrendingUp className="mr-2 h-4 w-4" />
                {isModalTransitioning ? 'Opening...' : 'Stake Rewards'}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDropdownActionAction('withdraw', asset.assetSymbol)}
                disabled={isAnyActionProcessing || isModalTransitioning || !isUnlockDateReachedAction(asset.unlockDate)}
                className={!isUnlockDateReachedAction(asset.unlockDate) ? "text-gray-500 cursor-not-allowed" : ""}
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
    [isAnyActionProcessing, onDropdownActionAction, openDropdownId, onDropdownOpenChangeAction, isUnlockDateReachedAction, isModalTransitioning, isDropdownTransitioning]
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
      />
    </div>
  );
}
