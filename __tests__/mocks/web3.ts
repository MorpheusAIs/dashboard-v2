/**
 * Web3 Mocks for Testing
 * Mock implementations for Wagmi, Viem, and Web3 providers.
 */

import { vi } from 'vitest';

// ============================================================================
// WAGMI MOCKS
// ============================================================================

export const mockWagmiConfig = {
  chains: [
    {
      id: 1,
      name: 'Ethereum',
      network: 'homestead',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: ['https://eth.example.com'] } },
    },
    {
      id: 42161,
      name: 'Arbitrum One',
      network: 'arbitrum',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: ['https://arb.example.com'] } },
    },
    {
      id: 8453,
      name: 'Base',
      network: 'base',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: ['https://base.example.com'] } },
    },
  ],
};

export const mockAccount = {
  address: '0x1234567890123456789012345678901234567890' as const,
  isConnecting: false,
  isConnected: true,
  isDisconnected: false,
  isReconnecting: false,
  status: 'connected' as const,
};

export const mockDisconnectedAccount = {
  address: undefined,
  isConnecting: false,
  isConnected: false,
  isDisconnected: true,
  isReconnecting: false,
  status: 'disconnected' as const,
};

export const createMockUseAccount = (connected = true) => {
  return vi.fn().mockReturnValue(connected ? mockAccount : mockDisconnectedAccount);
};

export const createMockUseChainId = (chainId = 42161) => {
  return vi.fn().mockReturnValue(chainId);
};

export const createMockUseBalance = (balance = '1000000000000000000') => {
  return vi.fn().mockReturnValue({
    data: {
      value: BigInt(balance),
      formatted: '1.0',
      decimals: 18,
      symbol: 'ETH',
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
};

export const createMockUseReadContract = <T>(result: T) => {
  return vi.fn().mockReturnValue({
    data: result,
    isLoading: false,
    isError: false,
    isSuccess: true,
    refetch: vi.fn(),
  });
};

export const createMockUseWriteContract = () => {
  const writeAsync = vi.fn().mockResolvedValue({
    hash: '0xmocktxhash123456789012345678901234567890123456789012345678901234',
  });

  return vi.fn().mockReturnValue({
    writeContract: vi.fn(),
    writeContractAsync: writeAsync,
    data: undefined,
    isLoading: false,
    isError: false,
    isSuccess: false,
    isPending: false,
    reset: vi.fn(),
  });
};

export const createMockUseContractReads = <T>(results: T[]) => {
  return vi.fn().mockReturnValue({
    data: results.map((result) => ({ result, status: 'success' })),
    isLoading: false,
    isError: false,
    isSuccess: true,
    refetch: vi.fn(),
  });
};

// ============================================================================
// VIEM MOCKS
// ============================================================================

export const mockPublicClient = {
  getBalance: vi.fn().mockResolvedValue(BigInt('1000000000000000000')),
  getBlockNumber: vi.fn().mockResolvedValue(BigInt(18500000)),
  readContract: vi.fn().mockResolvedValue(undefined),
  getCode: vi.fn().mockResolvedValue('0x'),
  estimateGas: vi.fn().mockResolvedValue(BigInt(21000)),
  getGasPrice: vi.fn().mockResolvedValue(BigInt('20000000000')),
  waitForTransactionReceipt: vi.fn().mockResolvedValue({
    status: 'success',
    blockNumber: BigInt(18500001),
  }),
};

export const mockWalletClient = {
  writeContract: vi.fn().mockResolvedValue('0xmocktxhash'),
  sendTransaction: vi.fn().mockResolvedValue('0xmocktxhash'),
  signMessage: vi.fn().mockResolvedValue('0xmocksignature'),
};

// ============================================================================
// NETWORK CONTEXT MOCK
// ============================================================================

export const createMockNetworkContext = (environment: 'mainnet' | 'testnet' = 'mainnet') => {
  const isMainnet = environment === 'mainnet';
  return {
    environment,
    isMainnet,
    currentChainId: isMainnet ? 42161 : 421614,
    setEnvironment: vi.fn(),
    supportedChains: isMainnet ? [1, 42161, 8453] : [11155111, 421614, 84532],
  };
};

// ============================================================================
// TRANSACTION MOCKS
// ============================================================================

export const mockSuccessfulTransaction = {
  hash: '0x1234567890123456789012345678901234567890123456789012345678901234',
  blockNumber: BigInt(18500000),
  status: 'success' as const,
  gasUsed: BigInt(150000),
};

export const mockFailedTransaction = {
  hash: '0x0987654321098765432109876543210987654321098765432109876543210987',
  blockNumber: BigInt(18500001),
  status: 'reverted' as const,
  gasUsed: BigInt(50000),
};

// ============================================================================
// CONTRACT DATA MOCKS
// ============================================================================

export const mockPoolsData = {
  lastUpdate: BigInt(1704067200),
  rate: BigInt('1000000000000000000000000000'), // 10^27 (high pool rate)
  totalVirtualDeposited: BigInt('10000000000000000000000000'), // 10M tokens
};

export const mockUsersData = {
  lastStake: BigInt(1704067200),
  deposited: BigInt('1000000000000000000'), // 1 token
  rate: BigInt('500000000000000000000000000'), // Half of pool rate
  pendingRewards: BigInt('100000000000000000'), // 0.1 MOR
  claimLockStart: BigInt(1704067200),
  claimLockEnd: BigInt(1735689600),
  virtualDeposited: BigInt('1500000000000000000'), // 1.5 virtual tokens
  lastClaim: BigInt(0),
  referrer: '0x0000000000000000000000000000000000000000' as const,
};

// ============================================================================
// ERC20 MOCKS
// ============================================================================

export const mockERC20Balance = (amount = '1000000000000000000000') => ({
  value: BigInt(amount),
  formatted: '1000.0',
  decimals: 18,
  symbol: 'MOR',
});

export const mockERC20Allowance = (amount = '0') => BigInt(amount);

// ============================================================================
// BUILDER MOCKS
// ============================================================================

export const mockBuilderProject = {
  id: '0x1234567890123456789012345678901234567890',
  name: 'Test Builder',
  admin: '0xadmin1234567890123456789012345678901234',
  totalStaked: BigInt('1000000000000000000000'),
  minimalDeposit: BigInt('100000000000000000'),
  startsAt: BigInt(1704067200),
  endsAt: BigInt(1735689600),
  claimLockPeriod: BigInt(2592000), // 30 days
  withdrawLockPeriod: BigInt(604800), // 7 days
};

export const mockBuilderUser = {
  id: '0xuser-0xproject',
  staked: BigInt('500000000000000000000'),
  user: '0x1111111111111111111111111111111111111111' as const,
  project: '0x1234567890123456789012345678901234567890' as const,
  lastClaimTime: BigInt(1704067200),
  pendingRewards: BigInt('10000000000000000000'),
};
