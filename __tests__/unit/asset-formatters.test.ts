/**
 * Unit Tests: Asset Formatter Utilities
 *
 * Tests for capital page asset formatting and display functions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseDepositAmount,
  formatAssetAmount,
  formatStakedAmount,
  isUnlockDateReached,
  formatUnlockDate,
  hasStakedAssets,
} from '@/components/capital/utils/asset-formatters';

// Mock the formatNumber function from lib/utils
vi.mock('@/lib/utils', () => ({
  formatNumber: (value: number) => {
    if (value >= 1000) {
      return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
    }
    return value.toLocaleString('en-US', {
      maximumFractionDigits: value < 1 ? 1 : 0,
    });
  },
}));

describe('Asset Formatter Utilities', () => {
  // ============================================================================
  // parseDepositAmount
  // ============================================================================
  describe('parseDepositAmount', () => {
    it('should parse simple numeric string', () => {
      expect(parseDepositAmount('100')).toBe(100);
    });

    it('should parse decimal string', () => {
      expect(parseDepositAmount('100.50')).toBe(100.5);
    });

    it('should parse string with commas', () => {
      expect(parseDepositAmount('1,000,000')).toBe(1000000);
    });

    it('should parse string with commas and decimals', () => {
      expect(parseDepositAmount('1,234.56')).toBe(1234.56);
    });

    it('should return 0 for undefined', () => {
      expect(parseDepositAmount(undefined)).toBe(0);
    });

    it('should return 0 for empty string', () => {
      expect(parseDepositAmount('')).toBe(0);
    });

    it('should return 0 for invalid string', () => {
      expect(parseDepositAmount('abc')).toBe(0);
    });

    it('should return 0 for null (as string type)', () => {
      // @ts-expect-error - Testing runtime behavior
      expect(parseDepositAmount(null)).toBe(0);
    });

    it('should handle very small decimals', () => {
      expect(parseDepositAmount('0.0001')).toBe(0.0001);
    });

    it('should handle very large numbers', () => {
      expect(parseDepositAmount('999,999,999.99')).toBe(999999999.99);
    });
  });

  // ============================================================================
  // formatAssetAmount
  // ============================================================================
  describe('formatAssetAmount', () => {
    describe('USDC/USDT (stablecoins)', () => {
      it('should format USDC with 2 decimals, removing trailing zeros', () => {
        expect(formatAssetAmount(100, 'USDC')).toBe('100');
        expect(formatAssetAmount(100.5, 'USDC')).toBe('100.5');
        expect(formatAssetAmount(100.50, 'USDC')).toBe('100.5');
        expect(formatAssetAmount(100.05, 'USDC')).toBe('100.05');
      });

      it('should format USDT with 2 decimals, removing trailing zeros', () => {
        expect(formatAssetAmount(50, 'USDT')).toBe('50');
        expect(formatAssetAmount(50.25, 'USDT')).toBe('50.25');
      });
    });

    describe('wETH/wBTC/stETH (crypto assets)', () => {
      it('should format wETH with 3 decimals when < 1', () => {
        expect(formatAssetAmount(0.123, 'wETH')).toBe('0.123');
        expect(formatAssetAmount(0.5, 'wETH')).toBe('0.5');
      });

      it('should format wETH with 2 decimals when >= 1', () => {
        expect(formatAssetAmount(1.5, 'wETH')).toBe('1.5');
        expect(formatAssetAmount(10.25, 'wETH')).toBe('10.25');
      });

      it('should format wBTC with 3 decimals when < 1', () => {
        expect(formatAssetAmount(0.001, 'wBTC')).toBe('0.001');
      });

      it('should format stETH correctly', () => {
        expect(formatAssetAmount(0.999, 'stETH')).toBe('0.999');
        expect(formatAssetAmount(1.0, 'stETH')).toBe('1');
      });
    });

    describe('Other assets (LINK, etc.)', () => {
      it('should use default formatting for LINK', () => {
        const result = formatAssetAmount(100.5, 'LINK');
        expect(result).toBeDefined();
      });

      it('should handle small values with 2 decimals', () => {
        expect(formatAssetAmount(0.5, 'LINK')).toBe('0.5');
      });
    });

    describe('Edge cases', () => {
      it('should handle zero', () => {
        expect(formatAssetAmount(0, 'USDC')).toBe('0');
        expect(formatAssetAmount(0, 'wETH')).toBe('0');
      });

      it('should handle undefined asset symbol', () => {
        const result = formatAssetAmount(100, undefined);
        expect(result).toBeDefined();
      });

      it('should remove trailing zeros after decimal', () => {
        expect(formatAssetAmount(1.00, 'USDC')).toBe('1');
        expect(formatAssetAmount(1.10, 'USDC')).toBe('1.1');
        expect(formatAssetAmount(1.100, 'wETH')).toBe('1.1');
      });
    });
  });

  // ============================================================================
  // formatStakedAmount
  // ============================================================================
  describe('formatStakedAmount', () => {
    describe('USDC/USDT (stablecoins)', () => {
      it('should always use 2 decimals for USDC', () => {
        expect(formatStakedAmount(100, 'USDC')).toBe('100.00');
        expect(formatStakedAmount(0.5, 'USDC')).toBe('0.50');
      });

      it('should always use 2 decimals for USDT', () => {
        expect(formatStakedAmount(100, 'USDT')).toBe('100.00');
      });
    });

    describe('wETH/wBTC/stETH (crypto assets)', () => {
      it('should use 4 decimals when < 0.01', () => {
        expect(formatStakedAmount(0.001, 'wETH')).toBe('0.0010');
        expect(formatStakedAmount(0.0001, 'wBTC')).toBe('0.0001');
        expect(formatStakedAmount(0.005, 'stETH')).toBe('0.0050');
      });

      it('should use 2 decimals when >= 0.01', () => {
        expect(formatStakedAmount(0.01, 'wETH')).toBe('0.01');
        expect(formatStakedAmount(0.5, 'wBTC')).toBe('0.50');
        expect(formatStakedAmount(1.25, 'stETH')).toBe('1.25');
      });
    });

    describe('Other assets', () => {
      it('should default to 1 decimal for unknown assets', () => {
        expect(formatStakedAmount(100.5, 'LINK')).toBe('100.5');
        expect(formatStakedAmount(0.75, 'LINK')).toBe('0.8'); // Rounded
      });
    });
  });

  // ============================================================================
  // isUnlockDateReached
  // ============================================================================
  describe('isUnlockDateReached', () => {
    let fixedDate: Date;

    beforeEach(() => {
      // Fixed date: June 15, 2024
      fixedDate = new Date('2024-06-15T12:00:00.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(fixedDate);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    describe('Valid unlock dates', () => {
      it('should return true when unlock date is in the past', () => {
        const pastDate = 'Jun 1, 2024, 12:00 PM';
        expect(isUnlockDateReached(pastDate, false)).toBe(true);
      });

      it('should return false when unlock date is in the future', () => {
        const futureDate = 'Dec 25, 2024, 12:00 PM';
        expect(isUnlockDateReached(futureDate, false)).toBe(false);
      });

      it('should return true when unlock date equals current date', () => {
        const currentDate = 'Jun 15, 2024, 12:00 PM';
        expect(isUnlockDateReached(currentDate, false)).toBe(true);
      });
    });

    describe('Invalid/special unlock dates', () => {
      it('should return false for null unlock date', () => {
        expect(isUnlockDateReached(null, false)).toBe(false);
      });

      it('should return false for "--- --, ----"', () => {
        expect(isUnlockDateReached('--- --, ----', false)).toBe(false);
      });

      it('should return false for "Never"', () => {
        expect(isUnlockDateReached('Never', false)).toBe(false);
      });

      it('should return false for "Invalid Date"', () => {
        expect(isUnlockDateReached('Invalid Date', false)).toBe(false);
      });

      it('should return false for "No lock set"', () => {
        expect(isUnlockDateReached('No lock set', false)).toBe(false);
      });

      it('should return false for "Assets unlocked"', () => {
        expect(isUnlockDateReached('Assets unlocked', false)).toBe(false);
      });

      it('should return false for "N/A"', () => {
        expect(isUnlockDateReached('N/A', false)).toBe(false);
      });
    });

    describe('Fallback behavior with staked assets', () => {
      it('should return true for null unlock date when user has staked assets', () => {
        expect(isUnlockDateReached(null, true)).toBe(true);
      });

      it('should return true for "--- --, ----" when user has staked assets', () => {
        expect(isUnlockDateReached('--- --, ----', true)).toBe(true);
      });

      it('should return true for "N/A" when user has staked assets', () => {
        expect(isUnlockDateReached('N/A', true)).toBe(true);
      });
    });

    describe('Date parsing edge cases', () => {
      it('should handle malformed date strings gracefully', () => {
        expect(isUnlockDateReached('not a date at all', false)).toBe(false);
      });

      it('should handle dates with different formats', () => {
        // ISO format
        expect(isUnlockDateReached('2024-01-01', false)).toBe(true);
      });
    });
  });

  // ============================================================================
  // formatUnlockDate
  // ============================================================================
  describe('formatUnlockDate', () => {
    it('should return formatted date as-is when valid', () => {
      const date = 'Aug 16, 2025, 5:30 PM';
      expect(formatUnlockDate(date, 'stETH')).toBe(date);
    });

    it('should return "Assets unlocked" for null date with LINK', () => {
      expect(formatUnlockDate(null, 'LINK')).toBe('Assets unlocked');
    });

    it('should return "N/A" for null date with non-LINK assets', () => {
      expect(formatUnlockDate(null, 'stETH')).toBe('N/A');
      expect(formatUnlockDate(null, 'wBTC')).toBe('N/A');
      expect(formatUnlockDate(null, 'USDC')).toBe('N/A');
    });
  });

  // ============================================================================
  // hasStakedAssets
  // ============================================================================
  describe('hasStakedAssets', () => {
    it('should return true when any asset has non-zero deposit', () => {
      const assets = {
        stETH: { userDepositedFormatted: '100' },
        LINK: { userDepositedFormatted: '0' },
        wBTC: { userDepositedFormatted: '0' },
        wETH: { userDepositedFormatted: '0' },
        USDC: { userDepositedFormatted: '0' },
        USDT: { userDepositedFormatted: '0' },
      };
      // @ts-expect-error - Simplified mock
      expect(hasStakedAssets(assets)).toBe(true);
    });

    it('should return false when all assets have zero deposit', () => {
      const assets = {
        stETH: { userDepositedFormatted: '0' },
        LINK: { userDepositedFormatted: '0' },
        wBTC: { userDepositedFormatted: '0' },
        wETH: { userDepositedFormatted: '0' },
        USDC: { userDepositedFormatted: '0' },
        USDT: { userDepositedFormatted: '0' },
      };
      // @ts-expect-error - Simplified mock
      expect(hasStakedAssets(assets)).toBe(false);
    });

    it('should return true for very small amounts', () => {
      const assets = {
        stETH: { userDepositedFormatted: '0.0001' },
        LINK: { userDepositedFormatted: '0' },
        wBTC: { userDepositedFormatted: '0' },
        wETH: { userDepositedFormatted: '0' },
        USDC: { userDepositedFormatted: '0' },
        USDT: { userDepositedFormatted: '0' },
      };
      // @ts-expect-error - Simplified mock
      expect(hasStakedAssets(assets)).toBe(true);
    });

    it('should return true when formatted value is not "0" or "0.00"', () => {
      const assets = {
        stETH: { userDepositedFormatted: '0.001' },
        LINK: { userDepositedFormatted: '0.00' },
        wBTC: { userDepositedFormatted: '0' },
        wETH: { userDepositedFormatted: '0' },
        USDC: { userDepositedFormatted: '0' },
        USDT: { userDepositedFormatted: '0' },
      };
      // @ts-expect-error - Simplified mock
      expect(hasStakedAssets(assets)).toBe(true);
    });

    it('should handle multiple assets with deposits', () => {
      const assets = {
        stETH: { userDepositedFormatted: '10' },
        LINK: { userDepositedFormatted: '50' },
        wBTC: { userDepositedFormatted: '0.5' },
        wETH: { userDepositedFormatted: '0' },
        USDC: { userDepositedFormatted: '0' },
        USDT: { userDepositedFormatted: '0' },
      };
      // @ts-expect-error - Simplified mock
      expect(hasStakedAssets(assets)).toBe(true);
    });

    it('should handle formatted values with commas', () => {
      const assets = {
        stETH: { userDepositedFormatted: '1,000' },
        LINK: { userDepositedFormatted: '0' },
        wBTC: { userDepositedFormatted: '0' },
        wETH: { userDepositedFormatted: '0' },
        USDC: { userDepositedFormatted: '0' },
        USDT: { userDepositedFormatted: '0' },
      };
      // @ts-expect-error - Simplified mock
      expect(hasStakedAssets(assets)).toBe(true);
    });
  });
});
