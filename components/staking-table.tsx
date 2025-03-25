import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { StakingEntry } from "@/app/graphql/types";

export interface StakingTableProps {
  entries: StakingEntry[];
  isLoading: boolean;
  error: Error | null;
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc';
  onSort: (column: string) => void;
  // Pagination props
  currentPage: number;
  totalPages: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
  // Optional display properties
  hideColumns?: string[];
  getExplorerUrl: (address: string, network?: string) => string;
  network?: string;
  formatDate?: (timestamp: number) => string;
}

export function StakingTable({
  entries,
  isLoading,
  error,
  sortColumn,
  sortDirection,
  onSort,
  currentPage,
  totalPages,
  onPreviousPage,
  onNextPage,
  hideColumns = [],
  getExplorerUrl,
  network,
  formatDate = (timestamp) => new Date(timestamp * 1000).toLocaleDateString(),
}: StakingTableProps) {
  // Helper to determine if a column should be shown
  const showColumn = (columnId: string) => !hideColumns.includes(columnId);

  // Default sorting indicator
  const SortIndicator = ({ column }: { column: string }) => (
    <>
      {sortColumn === column && (
        <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
      )}
    </>
  );

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-b border-white/[0.08]">
            <TableHead className="text-sm font-medium text-gray-400">Address</TableHead>
            
            {showColumn('amount') && (
              <TableHead 
                className="text-sm font-medium text-gray-400 cursor-pointer"
                onClick={() => onSort('amount')}
              >
                <div className="flex items-center">
                  MOR Staked
                  <SortIndicator column="amount" />
                </div>
              </TableHead>
            )}
            
            {showColumn('claimed') && (
              <TableHead 
                className="text-sm font-medium text-gray-400 cursor-pointer"
                onClick={() => onSort('claimed')}
              >
                <div className="flex items-center">
                  MOR Claimed
                  <SortIndicator column="claimed" />
                </div>
              </TableHead>
            )}
            
            {showColumn('fee') && (
              <TableHead 
                className="text-sm font-medium text-gray-400 cursor-pointer"
                onClick={() => onSort('fee')}
              >
                <div className="flex items-center">
                  Fee Charged
                  <SortIndicator column="fee" />
                </div>
              </TableHead>
            )}
            
            {showColumn('timestamp') && (
              <TableHead 
                className="text-sm font-medium text-gray-400 cursor-pointer"
                onClick={() => onSort('timestamp')}
              >
                <div className="flex items-center">
                  Stake Date
                  <SortIndicator column="timestamp" />
                </div>
              </TableHead>
            )}
            
            {showColumn('unlockDate') && (
              <TableHead 
                className="text-sm font-medium text-gray-400 cursor-pointer"
                onClick={() => onSort('unlockDate')}
              >
                <div className="flex items-center">
                  Unlock Date
                  <SortIndicator column="unlockDate" />
                </div>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            // Loading state - show skeleton rows
            Array(5).fill(0).map((_, index) => (
              <TableRow key={`loading-${index}`} className="border-b border-white/[0.08]">
                <TableCell>
                  <div className="h-6 bg-gray-700/30 rounded animate-pulse w-24"></div>
                </TableCell>
                {showColumn('amount') && (
                  <TableCell>
                    <div className="h-6 bg-gray-700/30 rounded animate-pulse w-20"></div>
                  </TableCell>
                )}
                {showColumn('claimed') && (
                  <TableCell>
                    <div className="h-6 bg-gray-700/30 rounded animate-pulse w-20"></div>
                  </TableCell>
                )}
                {showColumn('fee') && (
                  <TableCell>
                    <div className="h-6 bg-gray-700/30 rounded animate-pulse w-16"></div>
                  </TableCell>
                )}
                {showColumn('timestamp') && (
                  <TableCell>
                    <div className="h-6 bg-gray-700/30 rounded animate-pulse w-28"></div>
                  </TableCell>
                )}
                {showColumn('unlockDate') && (
                  <TableCell>
                    <div className="h-6 bg-gray-700/30 rounded animate-pulse w-28"></div>
                  </TableCell>
                )}
              </TableRow>
            ))
          ) : error ? (
            // Error state
            <TableRow>
              <TableCell colSpan={6} className="text-center py-6 text-red-400">
                Error loading data: {error.message}
              </TableCell>
            </TableRow>
          ) : entries.length === 0 ? (
            // Empty state
            <TableRow>
              <TableCell colSpan={6} className="text-center py-6 text-gray-400">
                No stakers found for this subnet.
              </TableCell>
            </TableRow>
          ) : (
            // Data state - only show when we actually have data
            entries.map((entry, index) => (
              <TableRow 
                key={`entry-${entry.address}-${index}`}
                className="border-b border-white/[0.08] hover:bg-emerald-400/10 transition-colors"
              >
                <TableCell className="font-mono">
                  <div className="flex items-center gap-2">
                    {entry.displayAddress}
                    <a 
                      href={getExplorerUrl(entry.address, network)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:text-emerald-300"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </TableCell>
                
                {showColumn('amount') && (
                  <TableCell>{entry.amount.toLocaleString()} MOR</TableCell>
                )}
                
                {showColumn('claimed') && (
                  <TableCell>
                    {entry.claimed !== undefined ? `${entry.claimed.toLocaleString()} MOR` : 'N/A'}
                  </TableCell>
                )}
                
                {showColumn('fee') && (
                  <TableCell>
                    {entry.fee !== undefined ? `${entry.fee}%` : 'N/A'}
                  </TableCell>
                )}
                
                {showColumn('timestamp') && (
                  <TableCell>
                    {entry.timestamp ? formatDate(entry.timestamp) : 'N/A'}
                  </TableCell>
                )}
                
                {showColumn('unlockDate') && (
                  <TableCell>
                    {entry.unlockDate ? formatDate(entry.unlockDate) : 'N/A'}
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      
      {/* Pagination Controls */}
      {!isLoading && !error && entries.length > 0 && (
        <div className="flex justify-center items-center gap-4 mt-4">
          <div className="flex items-center">
            <Button 
              onClick={onPreviousPage}
              disabled={currentPage === 1}
              variant="outline"
              size="sm"
            >
              Previous
            </Button>
            <span className="text-sm text-gray-400 mx-4">
              Page {currentPage}/{totalPages}
            </span>
            <Button 
              onClick={onNextPage}
              disabled={currentPage >= totalPages}
              variant="outline"
              size="sm"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  );
} 