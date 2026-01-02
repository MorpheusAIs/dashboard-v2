/**
 * Unit Tests: Transaction Utilities
 *
 * Tests for blockchain transaction-related utility functions.
 */

import { describe, it, expect } from 'vitest';
import {
  getTransactionUrl,
  isMainnetChain,
} from '@/lib/utils/transaction-utils';

describe('Transaction Utilities', () => {
  // ============================================================================
  // getTransactionUrl
  // ============================================================================
  describe('getTransactionUrl', () => {
    const mockTxHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

    describe('Mainnet chains', () => {
      it('should return Etherscan URL for Ethereum mainnet (chainId: 1)', () => {
        const result = getTransactionUrl(1, mockTxHash);
        expect(result).toBe(`https://etherscan.io/tx/${mockTxHash}`);
      });

      it('should return Arbiscan URL for Arbitrum One (chainId: 42161)', () => {
        const result = getTransactionUrl(42161, mockTxHash);
        expect(result).toBe(`https://arbiscan.io/tx/${mockTxHash}`);
      });

      it('should return Basescan URL for Base (chainId: 8453)', () => {
        const result = getTransactionUrl(8453, mockTxHash);
        expect(result).toBe(`https://basescan.org/tx/${mockTxHash}`);
      });
    });

    describe('Testnet chains', () => {
      it('should return Sepolia Etherscan URL for Sepolia (chainId: 11155111)', () => {
        const result = getTransactionUrl(11155111, mockTxHash);
        expect(result).toBe(`https://sepolia.etherscan.io/tx/${mockTxHash}`);
      });

      it('should return Sepolia Arbiscan URL for Arbitrum Sepolia (chainId: 421614)', () => {
        const result = getTransactionUrl(421614, mockTxHash);
        expect(result).toBe(`https://sepolia.arbiscan.io/tx/${mockTxHash}`);
      });

      it('should return Sepolia Basescan URL for Base Sepolia (chainId: 84532)', () => {
        const result = getTransactionUrl(84532, mockTxHash);
        expect(result).toBe(`https://sepolia.basescan.org/tx/${mockTxHash}`);
      });
    });

    describe('Edge cases', () => {
      it('should return null for unsupported chain ID', () => {
        const result = getTransactionUrl(999999, mockTxHash);
        expect(result).toBeNull();
      });

      it('should return null for zero chain ID', () => {
        const result = getTransactionUrl(0, mockTxHash);
        expect(result).toBeNull();
      });

      it('should return null for negative chain ID', () => {
        const result = getTransactionUrl(-1, mockTxHash);
        expect(result).toBeNull();
      });

      it('should handle empty transaction hash', () => {
        const result = getTransactionUrl(1, '');
        expect(result).toBe('https://etherscan.io/tx/');
      });

      it('should handle transaction hash with invalid format', () => {
        const result = getTransactionUrl(1, 'invalid-hash');
        // Should still construct URL, validation is not done here
        expect(result).toBe('https://etherscan.io/tx/invalid-hash');
      });
    });

    describe('URL construction', () => {
      it('should include full transaction hash in URL', () => {
        const result = getTransactionUrl(1, mockTxHash);
        expect(result).toContain(mockTxHash);
      });

      it('should use HTTPS protocol', () => {
        const result = getTransactionUrl(1, mockTxHash);
        expect(result).toMatch(/^https:\/\//);
      });
    });
  });

  // ============================================================================
  // isMainnetChain
  // ============================================================================
  describe('isMainnetChain', () => {
    describe('Mainnet chains', () => {
      it('should return true for Ethereum mainnet (1)', () => {
        expect(isMainnetChain(1)).toBe(true);
      });

      it('should return true for Arbitrum One (42161)', () => {
        expect(isMainnetChain(42161)).toBe(true);
      });

      it('should return true for Base (8453)', () => {
        expect(isMainnetChain(8453)).toBe(true);
      });
    });

    describe('Testnet chains', () => {
      it('should return false for Sepolia (11155111)', () => {
        expect(isMainnetChain(11155111)).toBe(false);
      });

      it('should return false for Arbitrum Sepolia (421614)', () => {
        expect(isMainnetChain(421614)).toBe(false);
      });

      it('should return false for Base Sepolia (84532)', () => {
        expect(isMainnetChain(84532)).toBe(false);
      });
    });

    describe('Edge cases', () => {
      it('should return false for unknown chain ID', () => {
        expect(isMainnetChain(999999)).toBe(false);
      });

      it('should return false for zero', () => {
        expect(isMainnetChain(0)).toBe(false);
      });

      it('should return false for negative chain ID', () => {
        expect(isMainnetChain(-1)).toBe(false);
      });

      it('should handle Goerli (deprecated testnet)', () => {
        expect(isMainnetChain(5)).toBe(false);
      });

      it('should handle Polygon mainnet (not in list)', () => {
        expect(isMainnetChain(137)).toBe(false);
      });
    });
  });
});
