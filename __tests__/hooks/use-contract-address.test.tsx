/**
 * Hook Tests: useContractAddress
 *
 * Tests for the contract address lookup hook.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';

// Mock the network context
const mockUseNetwork = vi.fn();

vi.mock('@/context/network-context', () => ({
  useNetwork: () => mockUseNetwork(),
}));

// Mock the getContractAddress function
const mockGetContractAddress = vi.fn();

vi.mock('@/config/networks', () => ({
  getContractAddress: (chainId: number, contractName: string, environment: string) =>
    mockGetContractAddress(chainId, contractName, environment),
}));

// Import the hook after mocking
import { useContractAddress } from '@/hooks/use-contract-address';

describe('useContractAddress Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for useNetwork
    mockUseNetwork.mockReturnValue({
      currentChainId: 42161, // Arbitrum One
      environment: 'mainnet',
    });

    // Default mock for getContractAddress
    mockGetContractAddress.mockImplementation(
      (chainId: number, contractName: string, environment: string) => {
        const addresses: Record<string, Record<string, string>> = {
          erc1967Proxy: {
            '42161-mainnet': '0x1234567890123456789012345678901234567890',
            '8453-mainnet': '0x0987654321098765432109876543210987654321',
          },
          stETH: {
            '42161-mainnet': '0xstETH1234567890123456789012345678901234',
            '8453-mainnet': '0xstETH0987654321098765432109876543210987',
          },
          morToken: {
            '42161-mainnet': '0xMOR1234567890123456789012345678901234567',
            '8453-mainnet': '0xMOR0987654321098765432109876543210987654',
          },
        };

        const key = `${chainId}-${environment}`;
        return addresses[contractName]?.[key] || '';
      }
    );
  });

  describe('getAddress', () => {
    it('should return contract address for current chain', () => {
      const { result } = renderHook(() => useContractAddress());

      const address = result.current.getAddress('erc1967Proxy');
      expect(address).toBe('0x1234567890123456789012345678901234567890');
    });

    it('should return empty string when chainId is not set', () => {
      mockUseNetwork.mockReturnValue({
        currentChainId: undefined,
        environment: 'mainnet',
      });

      const { result } = renderHook(() => useContractAddress());

      const address = result.current.getAddress('erc1967Proxy');
      expect(address).toBe('');
    });

    it('should use correct environment from context', () => {
      mockUseNetwork.mockReturnValue({
        currentChainId: 42161,
        environment: 'testnet',
      });

      const { result } = renderHook(() => useContractAddress());

      result.current.getAddress('erc1967Proxy');

      expect(mockGetContractAddress).toHaveBeenCalledWith(
        42161,
        'erc1967Proxy',
        'testnet'
      );
    });
  });

  describe('getAddressForChain', () => {
    it('should return contract address for specific chain', () => {
      const { result } = renderHook(() => useContractAddress());

      // Get address for Base (different from current chain)
      const address = result.current.getAddressForChain(8453, 'erc1967Proxy');
      expect(address).toBe('0x0987654321098765432109876543210987654321');
    });

    it('should use environment from context', () => {
      mockUseNetwork.mockReturnValue({
        currentChainId: 42161,
        environment: 'mainnet',
      });

      const { result } = renderHook(() => useContractAddress());

      result.current.getAddressForChain(8453, 'stETH');

      expect(mockGetContractAddress).toHaveBeenCalledWith(
        8453,
        'stETH',
        'mainnet'
      );
    });
  });

  describe('Convenience getters', () => {
    it('should provide erc1967Proxy address', () => {
      const { result } = renderHook(() => useContractAddress());
      expect(result.current.erc1967Proxy).toBe(
        '0x1234567890123456789012345678901234567890'
      );
    });

    it('should provide stETH address', () => {
      const { result } = renderHook(() => useContractAddress());
      expect(result.current.stETH).toBe(
        '0xstETH1234567890123456789012345678901234'
      );
    });

    it('should provide morToken address', () => {
      const { result } = renderHook(() => useContractAddress());
      expect(result.current.morToken).toBe(
        '0xMOR1234567890123456789012345678901234567'
      );
    });
  });

  describe('Network changes', () => {
    it('should update addresses when network changes', () => {
      // Start with Arbitrum
      mockUseNetwork.mockReturnValue({
        currentChainId: 42161,
        environment: 'mainnet',
      });

      const { result, rerender } = renderHook(() => useContractAddress());

      expect(result.current.erc1967Proxy).toBe(
        '0x1234567890123456789012345678901234567890'
      );

      // Switch to Base
      mockUseNetwork.mockReturnValue({
        currentChainId: 8453,
        environment: 'mainnet',
      });

      rerender();

      expect(result.current.erc1967Proxy).toBe(
        '0x0987654321098765432109876543210987654321'
      );
    });
  });
});
