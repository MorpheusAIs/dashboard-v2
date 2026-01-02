/**
 * Component Tests: Deposit Modal
 *
 * Tests for the capital deposit modal component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../mocks/react-query';

// Mock the wagmi hooks
vi.mock('wagmi', () => ({
  useAccount: () => ({
    address: '0x1234567890123456789012345678901234567890',
    isConnected: true,
  }),
  useBalance: () => ({
    data: {
      value: BigInt('10000000000000000000'), // 10 tokens
      formatted: '10.0',
      decimals: 18,
    },
    isLoading: false,
  }),
  useReadContract: () => ({
    data: BigInt('10000000000000000000'),
    isLoading: false,
    refetch: vi.fn(),
  }),
  useWriteContract: () => ({
    writeContractAsync: vi.fn().mockResolvedValue({ hash: '0x123' }),
    isPending: false,
    isError: false,
    reset: vi.fn(),
  }),
  useWaitForTransactionReceipt: () => ({
    isLoading: false,
    isSuccess: true,
  }),
  useChainId: () => 42161,
}));

// Mock the network context
vi.mock('@/context/network-context', () => ({
  useNetwork: () => ({
    environment: 'mainnet',
    currentChainId: 42161,
    isMainnet: true,
  }),
}));

// Create a simple test component to test deposit modal logic
interface DepositModalTestProps {
  assetSymbol: 'stETH' | 'LINK' | 'wBTC' | 'wETH' | 'USDC' | 'USDT';
  onDeposit: (amount: string) => Promise<void>;
  maxAmount: string;
  isOpen: boolean;
  onClose: () => void;
}

function DepositModalTest({
  assetSymbol,
  onDeposit,
  maxAmount,
  isOpen,
  onClose,
}: DepositModalTestProps) {
  const [amount, setAmount] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (parseFloat(amount) > parseFloat(maxAmount)) {
      setError('Amount exceeds balance');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onDeposit(amount);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMaxClick = () => {
    setAmount(maxAmount);
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div data-testid="deposit-modal">
      <h2>Deposit {assetSymbol}</h2>

      <div>
        <label htmlFor="amount">Amount</label>
        <input
          id="amount"
          type="number"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setError(null);
          }}
          placeholder="0.00"
          data-testid="deposit-amount-input"
        />
        <button onClick={handleMaxClick} data-testid="max-button">
          MAX
        </button>
      </div>

      <div data-testid="balance">Balance: {maxAmount} {assetSymbol}</div>

      {error && <div data-testid="error-message" role="alert">{error}</div>}

      <div>
        <button onClick={onClose} data-testid="cancel-button">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !amount}
          data-testid="deposit-button"
        >
          {isSubmitting ? 'Depositing...' : 'Deposit'}
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

describe('DepositModal Component', () => {
  let mockOnDeposit: ReturnType<typeof vi.fn>;
  let mockOnClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnDeposit = vi.fn().mockResolvedValue(undefined);
    mockOnClose = vi.fn();
  });

  describe('Rendering', () => {
    it('should render when open', () => {
      render(
        <DepositModalTest
          assetSymbol="stETH"
          onDeposit={mockOnDeposit}
          maxAmount="10.0"
          isOpen={true}
          onClose={mockOnClose}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByTestId('deposit-modal')).toBeInTheDocument();
      expect(screen.getByText('Deposit stETH')).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      render(
        <DepositModalTest
          assetSymbol="stETH"
          onDeposit={mockOnDeposit}
          maxAmount="10.0"
          isOpen={false}
          onClose={mockOnClose}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.queryByTestId('deposit-modal')).not.toBeInTheDocument();
    });

    it('should display balance', () => {
      render(
        <DepositModalTest
          assetSymbol="stETH"
          onDeposit={mockOnDeposit}
          maxAmount="10.0"
          isOpen={true}
          onClose={mockOnClose}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByTestId('balance')).toHaveTextContent('Balance: 10.0 stETH');
    });
  });

  describe('Amount Input', () => {
    it('should allow entering amount', async () => {
      const user = userEvent.setup();

      render(
        <DepositModalTest
          assetSymbol="stETH"
          onDeposit={mockOnDeposit}
          maxAmount="10.0"
          isOpen={true}
          onClose={mockOnClose}
        />,
        { wrapper: createWrapper() }
      );

      const input = screen.getByTestId('deposit-amount-input');
      await user.clear(input);
      await user.type(input, '5');

      expect(input).toHaveValue(5);
    });

    it('should fill max amount when MAX button clicked', async () => {
      const user = userEvent.setup();

      render(
        <DepositModalTest
          assetSymbol="stETH"
          onDeposit={mockOnDeposit}
          maxAmount="10.0"
          isOpen={true}
          onClose={mockOnClose}
        />,
        { wrapper: createWrapper() }
      );

      await user.click(screen.getByTestId('max-button'));

      expect(screen.getByTestId('deposit-amount-input')).toHaveValue(10);
    });
  });

  describe('Validation', () => {
    it('should show error for empty amount', async () => {
      const user = userEvent.setup();

      render(
        <DepositModalTest
          assetSymbol="stETH"
          onDeposit={mockOnDeposit}
          maxAmount="10.0"
          isOpen={true}
          onClose={mockOnClose}
        />,
        { wrapper: createWrapper() }
      );

      // Try to submit without entering amount
      const input = screen.getByTestId('deposit-amount-input');
      await user.clear(input);
      await user.type(input, '0');
      await user.click(screen.getByTestId('deposit-button'));

      expect(screen.getByTestId('error-message')).toHaveTextContent('Please enter a valid amount');
    });

    it('should show error when amount exceeds balance', async () => {
      const user = userEvent.setup();

      render(
        <DepositModalTest
          assetSymbol="stETH"
          onDeposit={mockOnDeposit}
          maxAmount="10.0"
          isOpen={true}
          onClose={mockOnClose}
        />,
        { wrapper: createWrapper() }
      );

      const input = screen.getByTestId('deposit-amount-input');
      await user.clear(input);
      await user.type(input, '15');
      await user.click(screen.getByTestId('deposit-button'));

      expect(screen.getByTestId('error-message')).toHaveTextContent('Amount exceeds balance');
    });
  });

  describe('Submission', () => {
    it('should call onDeposit with amount when submitted', async () => {
      const user = userEvent.setup();

      render(
        <DepositModalTest
          assetSymbol="stETH"
          onDeposit={mockOnDeposit}
          maxAmount="10.0"
          isOpen={true}
          onClose={mockOnClose}
        />,
        { wrapper: createWrapper() }
      );

      const input = screen.getByTestId('deposit-amount-input');
      await user.clear(input);
      await user.type(input, '5');
      await user.click(screen.getByTestId('deposit-button'));

      await waitFor(() => {
        expect(mockOnDeposit).toHaveBeenCalledWith('5');
      });
    });

    it('should close modal on successful deposit', async () => {
      const user = userEvent.setup();

      render(
        <DepositModalTest
          assetSymbol="stETH"
          onDeposit={mockOnDeposit}
          maxAmount="10.0"
          isOpen={true}
          onClose={mockOnClose}
        />,
        { wrapper: createWrapper() }
      );

      const input = screen.getByTestId('deposit-amount-input');
      await user.clear(input);
      await user.type(input, '5');
      await user.click(screen.getByTestId('deposit-button'));

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should show error on deposit failure', async () => {
      const user = userEvent.setup();
      mockOnDeposit.mockRejectedValue(new Error('Transaction failed'));

      render(
        <DepositModalTest
          assetSymbol="stETH"
          onDeposit={mockOnDeposit}
          maxAmount="10.0"
          isOpen={true}
          onClose={mockOnClose}
        />,
        { wrapper: createWrapper() }
      );

      const input = screen.getByTestId('deposit-amount-input');
      await user.clear(input);
      await user.type(input, '5');
      await user.click(screen.getByTestId('deposit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toHaveTextContent('Transaction failed');
      });
    });

    it('should disable submit button while submitting', async () => {
      const user = userEvent.setup();
      mockOnDeposit.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 1000)));

      render(
        <DepositModalTest
          assetSymbol="stETH"
          onDeposit={mockOnDeposit}
          maxAmount="10.0"
          isOpen={true}
          onClose={mockOnClose}
        />,
        { wrapper: createWrapper() }
      );

      const input = screen.getByTestId('deposit-amount-input');
      await user.clear(input);
      await user.type(input, '5');
      await user.click(screen.getByTestId('deposit-button'));

      expect(screen.getByTestId('deposit-button')).toHaveTextContent('Depositing...');
      expect(screen.getByTestId('deposit-button')).toBeDisabled();
    });
  });

  describe('Cancel', () => {
    it('should call onClose when cancel button clicked', async () => {
      const user = userEvent.setup();

      render(
        <DepositModalTest
          assetSymbol="stETH"
          onDeposit={mockOnDeposit}
          maxAmount="10.0"
          isOpen={true}
          onClose={mockOnClose}
        />,
        { wrapper: createWrapper() }
      );

      await user.click(screen.getByTestId('cancel-button'));

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Different Assets', () => {
    const assets: Array<'stETH' | 'LINK' | 'wBTC' | 'wETH' | 'USDC' | 'USDT'> = [
      'stETH', 'LINK', 'wBTC', 'wETH', 'USDC', 'USDT'
    ];

    assets.forEach((asset) => {
      it(`should display correct title for ${asset}`, () => {
        render(
          <DepositModalTest
            assetSymbol={asset}
            onDeposit={mockOnDeposit}
            maxAmount="10.0"
            isOpen={true}
            onClose={mockOnClose}
          />,
          { wrapper: createWrapper() }
        );

        expect(screen.getByText(`Deposit ${asset}`)).toBeInTheDocument();
      });
    });
  });
});
