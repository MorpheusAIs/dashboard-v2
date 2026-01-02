/**
 * E2E Tests: Capital Flow
 *
 * End-to-end tests for critical capital pool user flows.
 * These tests simulate complete user journeys through the deposit/withdraw flow.
 *
 * Note: These are integration tests that can be run with Vitest.
 * For true E2E tests, consider using Playwright or Cypress.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../mocks/react-query';

// ============================================================================
// MOCK SETUP FOR E2E TESTS
// ============================================================================

// Mock wallet state
let walletState = {
  isConnected: false,
  address: '',
  balance: '0',
};

// Mock transaction state
let transactionState = {
  pendingTxHash: '',
  confirmedTxHash: '',
  error: null as Error | null,
};

// Reset state before each test
beforeEach(() => {
  walletState = {
    isConnected: false,
    address: '',
    balance: '0',
  };
  transactionState = {
    pendingTxHash: '',
    confirmedTxHash: '',
    error: null,
  };
});

// ============================================================================
// SIMULATED CAPITAL PAGE COMPONENTS
// ============================================================================

function ConnectWalletButton({
  onConnect,
}: {
  onConnect: (address: string) => void;
}) {
  return (
    <button
      data-testid="connect-wallet"
      onClick={() => {
        walletState.isConnected = true;
        walletState.address = '0x1234567890123456789012345678901234567890';
        walletState.balance = '10000000000000000000'; // 10 tokens
        onConnect(walletState.address);
      }}
    >
      Connect Wallet
    </button>
  );
}

function CapitalPage() {
  const [isConnected, setIsConnected] = React.useState(false);
  const [address, setAddress] = React.useState('');
  const [selectedAsset, setSelectedAsset] = React.useState<string | null>(null);
  const [depositModalOpen, setDepositModalOpen] = React.useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = React.useState(false);
  const [userDeposits, setUserDeposits] = React.useState<
    Record<string, { amount: string; locked: boolean }>
  >({});
  const [txStatus, setTxStatus] = React.useState<
    'idle' | 'pending' | 'success' | 'error'
  >('idle');

  const assets = [
    { symbol: 'stETH', name: 'Lido Staked ETH', apr: '8.5%' },
    { symbol: 'LINK', name: 'Chainlink', apr: '6.2%' },
    { symbol: 'wBTC', name: 'Wrapped Bitcoin', apr: '4.8%' },
  ];

  const handleConnect = (addr: string) => {
    setIsConnected(true);
    setAddress(addr);
  };

  const handleDeposit = async (asset: string, amount: string) => {
    setTxStatus('pending');

    // Simulate transaction
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (transactionState.error) {
      setTxStatus('error');
      return;
    }

    setUserDeposits((prev) => ({
      ...prev,
      [asset]: {
        amount: (parseFloat(prev[asset]?.amount || '0') + parseFloat(amount)).toString(),
        locked: true,
      },
    }));

    setTxStatus('success');
    setDepositModalOpen(false);
  };

  const handleWithdraw = async (asset: string, amount: string) => {
    setTxStatus('pending');

    await new Promise((resolve) => setTimeout(resolve, 100));

    if (transactionState.error) {
      setTxStatus('error');
      return;
    }

    setUserDeposits((prev) => ({
      ...prev,
      [asset]: {
        ...prev[asset],
        amount: Math.max(
          0,
          parseFloat(prev[asset]?.amount || '0') - parseFloat(amount)
        ).toString(),
      },
    }));

    setTxStatus('success');
    setWithdrawModalOpen(false);
  };

  if (!isConnected) {
    return (
      <div data-testid="capital-page-disconnected">
        <h1>Capital Pools</h1>
        <p>Connect your wallet to view capital pools</p>
        <ConnectWalletButton onConnect={handleConnect} />
      </div>
    );
  }

  return (
    <div data-testid="capital-page">
      <header>
        <h1>Capital Pools</h1>
        <span data-testid="connected-address">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
      </header>

      {/* Asset List */}
      <div data-testid="asset-list">
        {assets.map((asset) => (
          <div key={asset.symbol} data-testid={`asset-${asset.symbol}`}>
            <h3>{asset.name}</h3>
            <p>APR: {asset.apr}</p>
            <p data-testid={`deposit-${asset.symbol}`}>
              Deposited: {userDeposits[asset.symbol]?.amount || '0'} {asset.symbol}
            </p>
            <button
              data-testid={`deposit-btn-${asset.symbol}`}
              onClick={() => {
                setSelectedAsset(asset.symbol);
                setDepositModalOpen(true);
              }}
            >
              Deposit
            </button>
            <button
              data-testid={`withdraw-btn-${asset.symbol}`}
              onClick={() => {
                setSelectedAsset(asset.symbol);
                setWithdrawModalOpen(true);
              }}
              disabled={!userDeposits[asset.symbol]?.amount}
            >
              Withdraw
            </button>
          </div>
        ))}
      </div>

      {/* Deposit Modal */}
      {depositModalOpen && selectedAsset && (
        <div data-testid="deposit-modal" role="dialog">
          <h2>Deposit {selectedAsset}</h2>
          <input
            data-testid="deposit-input"
            type="number"
            placeholder="Amount"
            defaultValue="1"
          />
          <button
            data-testid="confirm-deposit"
            onClick={() => {
              const input = document.querySelector(
                '[data-testid="deposit-input"]'
              ) as HTMLInputElement;
              handleDeposit(selectedAsset, input?.value || '1');
            }}
            disabled={txStatus === 'pending'}
          >
            {txStatus === 'pending' ? 'Depositing...' : 'Confirm Deposit'}
          </button>
          <button
            data-testid="cancel-deposit"
            onClick={() => setDepositModalOpen(false)}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Withdraw Modal */}
      {withdrawModalOpen && selectedAsset && (
        <div data-testid="withdraw-modal" role="dialog">
          <h2>Withdraw {selectedAsset}</h2>
          <input
            data-testid="withdraw-input"
            type="number"
            placeholder="Amount"
            defaultValue="0.5"
          />
          <button
            data-testid="confirm-withdraw"
            onClick={() => {
              const input = document.querySelector(
                '[data-testid="withdraw-input"]'
              ) as HTMLInputElement;
              handleWithdraw(selectedAsset, input?.value || '0.5');
            }}
            disabled={txStatus === 'pending'}
          >
            {txStatus === 'pending' ? 'Withdrawing...' : 'Confirm Withdraw'}
          </button>
          <button
            data-testid="cancel-withdraw"
            onClick={() => setWithdrawModalOpen(false)}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Status Indicator */}
      {txStatus !== 'idle' && (
        <div data-testid="tx-status" data-status={txStatus}>
          {txStatus === 'pending' && 'Transaction pending...'}
          {txStatus === 'success' && 'Transaction successful!'}
          {txStatus === 'error' && 'Transaction failed'}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// E2E TESTS
// ============================================================================

describe('Capital Flow E2E Tests', () => {
  function createWrapper() {
    const queryClient = createTestQueryClient();
    return function Wrapper({ children }: { children: React.ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );
    };
  }

  describe('Complete Deposit Flow', () => {
    it('should complete full deposit flow: connect -> select asset -> deposit', async () => {
      const user = userEvent.setup();

      render(<CapitalPage />, { wrapper: createWrapper() });

      // Step 1: Page shows disconnected state
      expect(screen.getByTestId('capital-page-disconnected')).toBeInTheDocument();
      expect(screen.getByText('Connect your wallet to view capital pools')).toBeInTheDocument();

      // Step 2: Connect wallet
      await user.click(screen.getByTestId('connect-wallet'));

      // Step 3: Verify connected state
      await waitFor(() => {
        expect(screen.getByTestId('capital-page')).toBeInTheDocument();
      });
      expect(screen.getByTestId('connected-address')).toHaveTextContent('0x1234...7890');

      // Step 4: Verify asset list is displayed
      expect(screen.getByTestId('asset-list')).toBeInTheDocument();
      expect(screen.getByTestId('asset-stETH')).toBeInTheDocument();

      // Step 5: Click deposit on stETH
      await user.click(screen.getByTestId('deposit-btn-stETH'));

      // Step 6: Verify deposit modal opens
      expect(screen.getByTestId('deposit-modal')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Step 7: Enter amount and confirm
      const depositInput = screen.getByTestId('deposit-input');
      await user.clear(depositInput);
      await user.type(depositInput, '5');
      await user.click(screen.getByTestId('confirm-deposit'));

      // Step 8: Wait for transaction to complete
      await waitFor(() => {
        expect(screen.getByTestId('tx-status')).toHaveAttribute(
          'data-status',
          'success'
        );
      });

      // Step 9: Verify deposit is reflected in UI
      expect(screen.getByTestId('deposit-stETH')).toHaveTextContent('5');
    });

    it('should handle deposit cancellation', async () => {
      const user = userEvent.setup();

      render(<CapitalPage />, { wrapper: createWrapper() });

      // Connect wallet
      await user.click(screen.getByTestId('connect-wallet'));
      await waitFor(() => {
        expect(screen.getByTestId('capital-page')).toBeInTheDocument();
      });

      // Open deposit modal
      await user.click(screen.getByTestId('deposit-btn-stETH'));
      expect(screen.getByTestId('deposit-modal')).toBeInTheDocument();

      // Cancel
      await user.click(screen.getByTestId('cancel-deposit'));

      // Modal should be closed
      expect(screen.queryByTestId('deposit-modal')).not.toBeInTheDocument();

      // No deposit should be made
      expect(screen.getByTestId('deposit-stETH')).toHaveTextContent('0');
    });
  });

  describe('Complete Withdraw Flow', () => {
    it('should complete full withdraw flow after deposit', async () => {
      const user = userEvent.setup();

      render(<CapitalPage />, { wrapper: createWrapper() });

      // Connect and deposit first
      await user.click(screen.getByTestId('connect-wallet'));
      await waitFor(() => {
        expect(screen.getByTestId('capital-page')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('deposit-btn-stETH'));
      const depositInput = screen.getByTestId('deposit-input');
      await user.clear(depositInput);
      await user.type(depositInput, '10');
      await user.click(screen.getByTestId('confirm-deposit'));

      await waitFor(() => {
        expect(screen.getByTestId('tx-status')).toHaveAttribute(
          'data-status',
          'success'
        );
      });

      // Verify deposit is shown
      expect(screen.getByTestId('deposit-stETH')).toHaveTextContent('10');

      // Now withdraw
      await user.click(screen.getByTestId('withdraw-btn-stETH'));

      // Verify withdraw modal opens
      expect(screen.getByTestId('withdraw-modal')).toBeInTheDocument();

      // Enter withdraw amount
      const withdrawInput = screen.getByTestId('withdraw-input');
      await user.clear(withdrawInput);
      await user.type(withdrawInput, '3');
      await user.click(screen.getByTestId('confirm-withdraw'));

      // Wait for success
      await waitFor(() => {
        expect(screen.getByTestId('tx-status')).toHaveAttribute(
          'data-status',
          'success'
        );
      });

      // Verify remaining balance
      expect(screen.getByTestId('deposit-stETH')).toHaveTextContent('7');
    });

    it('should disable withdraw button when no deposits', async () => {
      const user = userEvent.setup();

      render(<CapitalPage />, { wrapper: createWrapper() });

      // Connect wallet
      await user.click(screen.getByTestId('connect-wallet'));
      await waitFor(() => {
        expect(screen.getByTestId('capital-page')).toBeInTheDocument();
      });

      // Withdraw button should be disabled
      expect(screen.getByTestId('withdraw-btn-stETH')).toBeDisabled();
    });
  });

  describe('Multiple Asset Operations', () => {
    it('should handle deposits in multiple assets', async () => {
      const user = userEvent.setup();

      render(<CapitalPage />, { wrapper: createWrapper() });

      // Connect wallet
      await user.click(screen.getByTestId('connect-wallet'));
      await waitFor(() => {
        expect(screen.getByTestId('capital-page')).toBeInTheDocument();
      });

      // Deposit stETH
      await user.click(screen.getByTestId('deposit-btn-stETH'));
      let input = screen.getByTestId('deposit-input');
      await user.clear(input);
      await user.type(input, '5');
      await user.click(screen.getByTestId('confirm-deposit'));

      await waitFor(() => {
        expect(screen.queryByTestId('deposit-modal')).not.toBeInTheDocument();
      });

      // Deposit LINK
      await user.click(screen.getByTestId('deposit-btn-LINK'));
      input = screen.getByTestId('deposit-input');
      await user.clear(input);
      await user.type(input, '100');
      await user.click(screen.getByTestId('confirm-deposit'));

      await waitFor(() => {
        expect(screen.queryByTestId('deposit-modal')).not.toBeInTheDocument();
      });

      // Verify both deposits
      expect(screen.getByTestId('deposit-stETH')).toHaveTextContent('5');
      expect(screen.getByTestId('deposit-LINK')).toHaveTextContent('100');
    });
  });

  describe('Error Handling', () => {
    it('should handle transaction failure gracefully', async () => {
      const user = userEvent.setup();

      // Set up error state
      transactionState.error = new Error('Transaction rejected by user');

      render(<CapitalPage />, { wrapper: createWrapper() });

      // Connect wallet
      await user.click(screen.getByTestId('connect-wallet'));
      await waitFor(() => {
        expect(screen.getByTestId('capital-page')).toBeInTheDocument();
      });

      // Attempt deposit
      await user.click(screen.getByTestId('deposit-btn-stETH'));
      await user.click(screen.getByTestId('confirm-deposit'));

      // Should show error status
      await waitFor(() => {
        expect(screen.getByTestId('tx-status')).toHaveAttribute(
          'data-status',
          'error'
        );
      });

      // No deposit should be recorded
      expect(screen.getByTestId('deposit-stETH')).toHaveTextContent('0');
    });
  });
});

describe('Wallet Connection E2E', () => {
  function createWrapper() {
    const queryClient = createTestQueryClient();
    return function Wrapper({ children }: { children: React.ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );
    };
  }

  it('should show different UI states based on wallet connection', async () => {
    const user = userEvent.setup();

    render(<CapitalPage />, { wrapper: createWrapper() });

    // Initially disconnected
    expect(screen.getByTestId('capital-page-disconnected')).toBeInTheDocument();
    expect(screen.queryByTestId('asset-list')).not.toBeInTheDocument();

    // Connect wallet
    await user.click(screen.getByTestId('connect-wallet'));

    // Now connected
    await waitFor(() => {
      expect(screen.getByTestId('capital-page')).toBeInTheDocument();
    });
    expect(screen.getByTestId('asset-list')).toBeInTheDocument();
    expect(screen.queryByTestId('capital-page-disconnected')).not.toBeInTheDocument();
  });
});
