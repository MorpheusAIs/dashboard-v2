/**
 * Component Tests: Staking Table
 *
 * Tests for the staking table component that displays staker data.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../mocks/react-query';

// Mock staking entry type
interface StakingEntry {
  id: string;
  address: string;
  staked: string;
  stakedFormatted: string;
  pendingRewards: string;
  pendingRewardsFormatted: string;
  lastClaimTime: number;
}

// Simple staking table component for testing
interface StakingTableProps {
  entries: StakingEntry[];
  isLoading?: boolean;
  onRowClick?: (entry: StakingEntry) => void;
  sortBy?: 'staked' | 'pendingRewards';
  onSortChange?: (sort: 'staked' | 'pendingRewards') => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function StakingTable({
  entries,
  isLoading = false,
  onRowClick,
  sortBy = 'staked',
  onSortChange,
  currentPage,
  totalPages,
  onPageChange,
}: StakingTableProps) {
  if (isLoading) {
    return <div data-testid="loading-state">Loading staking data...</div>;
  }

  if (entries.length === 0) {
    return <div data-testid="empty-state">No stakers found</div>;
  }

  return (
    <div data-testid="staking-table">
      <table>
        <thead>
          <tr>
            <th>Address</th>
            <th>
              <button
                onClick={() => onSortChange?.('staked')}
                data-testid="sort-staked"
                aria-pressed={sortBy === 'staked'}
              >
                Staked {sortBy === 'staked' && '↓'}
              </button>
            </th>
            <th>
              <button
                onClick={() => onSortChange?.('pendingRewards')}
                data-testid="sort-rewards"
                aria-pressed={sortBy === 'pendingRewards'}
              >
                Pending Rewards {sortBy === 'pendingRewards' && '↓'}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.id}
              onClick={() => onRowClick?.(entry)}
              data-testid={`staker-row-${entry.id}`}
              style={{ cursor: onRowClick ? 'pointer' : 'default' }}
            >
              <td data-testid="address-cell">
                {`${entry.address.slice(0, 6)}...${entry.address.slice(-4)}`}
              </td>
              <td data-testid="staked-cell">{entry.stakedFormatted}</td>
              <td data-testid="rewards-cell">{entry.pendingRewardsFormatted}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div data-testid="pagination">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          data-testid="prev-page"
        >
          Previous
        </button>
        <span data-testid="page-info">
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          data-testid="next-page"
        >
          Next
        </button>
      </div>
    </div>
  );
}

// Test wrapper
function createWrapper() {
  const queryClient = createTestQueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

// Mock data
const mockEntries: StakingEntry[] = [
  {
    id: 'entry-1',
    address: '0x1111111111111111111111111111111111111111',
    staked: '500000000000000000000',
    stakedFormatted: '500.00 MOR',
    pendingRewards: '10000000000000000000',
    pendingRewardsFormatted: '10.00 MOR',
    lastClaimTime: 1704067200,
  },
  {
    id: 'entry-2',
    address: '0x2222222222222222222222222222222222222222',
    staked: '1000000000000000000000',
    stakedFormatted: '1,000.00 MOR',
    pendingRewards: '25000000000000000000',
    pendingRewardsFormatted: '25.00 MOR',
    lastClaimTime: 1704153600,
  },
  {
    id: 'entry-3',
    address: '0x3333333333333333333333333333333333333333',
    staked: '250000000000000000000',
    stakedFormatted: '250.00 MOR',
    pendingRewards: '5000000000000000000',
    pendingRewardsFormatted: '5.00 MOR',
    lastClaimTime: 1704240000,
  },
];

describe('StakingTable Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render table with entries', () => {
      render(
        <StakingTable
          entries={mockEntries}
          currentPage={1}
          totalPages={1}
          onPageChange={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByTestId('staking-table')).toBeInTheDocument();
      expect(screen.getAllByTestId(/staker-row-/)).toHaveLength(3);
    });

    it('should display loading state', () => {
      render(
        <StakingTable
          entries={[]}
          isLoading={true}
          currentPage={1}
          totalPages={1}
          onPageChange={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
      expect(screen.getByText('Loading staking data...')).toBeInTheDocument();
    });

    it('should display empty state', () => {
      render(
        <StakingTable
          entries={[]}
          isLoading={false}
          currentPage={1}
          totalPages={1}
          onPageChange={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('No stakers found')).toBeInTheDocument();
    });
  });

  describe('Data Display', () => {
    it('should display truncated addresses', () => {
      render(
        <StakingTable
          entries={mockEntries}
          currentPage={1}
          totalPages={1}
          onPageChange={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      const row = screen.getByTestId('staker-row-entry-1');
      const addressCell = within(row).getByTestId('address-cell');

      expect(addressCell).toHaveTextContent('0x1111...1111');
    });

    it('should display formatted staked amounts', () => {
      render(
        <StakingTable
          entries={mockEntries}
          currentPage={1}
          totalPages={1}
          onPageChange={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      const row = screen.getByTestId('staker-row-entry-1');
      const stakedCell = within(row).getByTestId('staked-cell');

      expect(stakedCell).toHaveTextContent('500.00 MOR');
    });

    it('should display formatted pending rewards', () => {
      render(
        <StakingTable
          entries={mockEntries}
          currentPage={1}
          totalPages={1}
          onPageChange={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      const row = screen.getByTestId('staker-row-entry-1');
      const rewardsCell = within(row).getByTestId('rewards-cell');

      expect(rewardsCell).toHaveTextContent('10.00 MOR');
    });
  });

  describe('Row Interaction', () => {
    it('should call onRowClick when row is clicked', async () => {
      const user = userEvent.setup();
      const mockOnRowClick = vi.fn();

      render(
        <StakingTable
          entries={mockEntries}
          onRowClick={mockOnRowClick}
          currentPage={1}
          totalPages={1}
          onPageChange={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      await user.click(screen.getByTestId('staker-row-entry-1'));

      expect(mockOnRowClick).toHaveBeenCalledWith(mockEntries[0]);
    });
  });

  describe('Sorting', () => {
    it('should show sort indicator for staked column', () => {
      render(
        <StakingTable
          entries={mockEntries}
          sortBy="staked"
          onSortChange={vi.fn()}
          currentPage={1}
          totalPages={1}
          onPageChange={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      const sortButton = screen.getByTestId('sort-staked');
      expect(sortButton).toHaveTextContent('Staked ↓');
      expect(sortButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should show sort indicator for rewards column', () => {
      render(
        <StakingTable
          entries={mockEntries}
          sortBy="pendingRewards"
          onSortChange={vi.fn()}
          currentPage={1}
          totalPages={1}
          onPageChange={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      const sortButton = screen.getByTestId('sort-rewards');
      expect(sortButton).toHaveTextContent('Pending Rewards ↓');
      expect(sortButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should call onSortChange when sort button clicked', async () => {
      const user = userEvent.setup();
      const mockOnSortChange = vi.fn();

      render(
        <StakingTable
          entries={mockEntries}
          sortBy="staked"
          onSortChange={mockOnSortChange}
          currentPage={1}
          totalPages={1}
          onPageChange={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      await user.click(screen.getByTestId('sort-rewards'));

      expect(mockOnSortChange).toHaveBeenCalledWith('pendingRewards');
    });
  });

  describe('Pagination', () => {
    it('should display current page info', () => {
      render(
        <StakingTable
          entries={mockEntries}
          currentPage={2}
          totalPages={5}
          onPageChange={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByTestId('page-info')).toHaveTextContent('Page 2 of 5');
    });

    it('should call onPageChange when next button clicked', async () => {
      const user = userEvent.setup();
      const mockOnPageChange = vi.fn();

      render(
        <StakingTable
          entries={mockEntries}
          currentPage={1}
          totalPages={5}
          onPageChange={mockOnPageChange}
        />,
        { wrapper: createWrapper() }
      );

      await user.click(screen.getByTestId('next-page'));

      expect(mockOnPageChange).toHaveBeenCalledWith(2);
    });

    it('should call onPageChange when previous button clicked', async () => {
      const user = userEvent.setup();
      const mockOnPageChange = vi.fn();

      render(
        <StakingTable
          entries={mockEntries}
          currentPage={3}
          totalPages={5}
          onPageChange={mockOnPageChange}
        />,
        { wrapper: createWrapper() }
      );

      await user.click(screen.getByTestId('prev-page'));

      expect(mockOnPageChange).toHaveBeenCalledWith(2);
    });

    it('should disable previous button on first page', () => {
      render(
        <StakingTable
          entries={mockEntries}
          currentPage={1}
          totalPages={5}
          onPageChange={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByTestId('prev-page')).toBeDisabled();
    });

    it('should disable next button on last page', () => {
      render(
        <StakingTable
          entries={mockEntries}
          currentPage={5}
          totalPages={5}
          onPageChange={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByTestId('next-page')).toBeDisabled();
    });

    it('should enable both buttons on middle pages', () => {
      render(
        <StakingTable
          entries={mockEntries}
          currentPage={3}
          totalPages={5}
          onPageChange={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByTestId('prev-page')).not.toBeDisabled();
      expect(screen.getByTestId('next-page')).not.toBeDisabled();
    });
  });
});
