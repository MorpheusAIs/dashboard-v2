"use client";

import { useState, useTransition, useMemo } from "react";
import type { UserAsset } from "../types/user-asset";

export function useAssetsTable(userAssets: UserAsset[]) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isSorting, startSortTransition] = useTransition();

  // Apply sorting to user assets data without triggering data refetch
  const sortedUserAssets = useMemo(() => {
    if (!sortColumn || !userAssets.length) {
      return userAssets;
    }

    const sortedAssets = [...userAssets].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      // Get values based on column id
      switch (sortColumn) {
        case 'amountStaked':
          aValue = a.amountStaked;
          bValue = b.amountStaked;
          break;
        case 'available':
          aValue = a.available;
          bValue = b.available;
          break;
        case 'dailyEmissions':
          aValue = a.dailyEmissions;
          bValue = b.dailyEmissions;
          break;
        case 'availableToClaim':
          aValue = a.availableToClaim;
          bValue = b.availableToClaim;
          break;
        case 'asset':
        default:
          // Sort by symbol for asset column
          aValue = a.symbol;
          bValue = b.symbol;
          break;
      }

      // Handle numeric sorting
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // Handle string sorting
      const aString = String(aValue || '').toLowerCase();
      const bString = String(bValue || '').toLowerCase();

      if (sortDirection === 'asc') {
        return aString.localeCompare(bString);
      } else {
        return bString.localeCompare(aString);
      }
    });

    return sortedAssets;
  }, [userAssets, sortColumn, sortDirection]);

  // Handle sorting change with transition for smooth UI updates
  const handleSortingChange = (columnId: string) => {
    startSortTransition(() => {
      if (sortColumn === columnId) {
        // Toggle direction if same column
        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
      } else {
        // New column, default to asc
        setSortColumn(columnId);
        setSortDirection('asc');
      }
    });
  };

  // Sorting configuration for DataTable
  const sorting = useMemo(() => {
    if (!sortColumn) return null;
    return {
      id: sortColumn,
      desc: sortDirection === 'desc'
    };
  }, [sortColumn, sortDirection]);

  return {
    sortedUserAssets,
    sorting,
    handleSortingChange,
    isSorting
  };
}
