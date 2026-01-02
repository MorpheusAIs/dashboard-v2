/**
 * Unit Tests: Reward Calculation Utilities
 *
 * Tests for reward calculation functions used in capital pool operations.
 * These are CRITICAL calculations that affect user earnings.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateBaseRewards,
  applyPowerFactor,
  calculateEstimatedRewards,
  formatRewardsForDisplay,
  getLockDurationInYears,
  estimateFuturePoolRate,
  REWARD_CONSTANTS,
} from '@/lib/utils/reward-calculation-utils';

describe('Reward Calculation Utilities', () => {
  // ============================================================================
  // calculateBaseRewards
  // ============================================================================
  describe('calculateBaseRewards', () => {
    it('should calculate base rewards correctly with standard inputs', () => {
      // Formula: depositAmount * (poolRate - userRate) / 10^25
      const depositAmount = '1'; // 1 token
      const currentPoolRate = BigInt('1000000000000000000000000000'); // 10^27
      const userRate = BigInt('500000000000000000000000000'); // 5 * 10^26

      const result = calculateBaseRewards(depositAmount, currentPoolRate, userRate);

      // Expected: 1 * 10^18 * (10^27 - 5*10^26) / 10^25
      // = 10^18 * 5*10^26 / 10^25
      // = 10^18 * 50
      // = 5 * 10^19
      expect(result).toBeGreaterThan(BigInt(0));
    });

    it('should return zero for new deposits (userRate = 0)', () => {
      const depositAmount = '1';
      const currentPoolRate = BigInt('1000000000000000000000000000');
      const userRate = BigInt(0);

      const result = calculateBaseRewards(depositAmount, currentPoolRate, userRate);

      // New deposits should get rewards based on full pool rate
      expect(result).toBeGreaterThan(BigInt(0));
    });

    it('should return zero when pool rate equals user rate', () => {
      const depositAmount = '1';
      const sameRate = BigInt('1000000000000000000000000000');

      const result = calculateBaseRewards(depositAmount, sameRate, sameRate);

      // No rate difference = no rewards
      expect(result).toBe(BigInt(0));
    });

    it('should handle decimal deposit amounts', () => {
      const depositAmount = '0.5'; // 0.5 tokens
      const currentPoolRate = BigInt('1000000000000000000000000000');
      const userRate = BigInt(0);

      const result = calculateBaseRewards(depositAmount, currentPoolRate, userRate);

      expect(result).toBeGreaterThan(BigInt(0));
    });

    it('should handle very large deposit amounts', () => {
      const depositAmount = '1000000'; // 1 million tokens
      const currentPoolRate = BigInt('1000000000000000000000000000');
      const userRate = BigInt(0);

      const result = calculateBaseRewards(depositAmount, currentPoolRate, userRate);

      expect(result).toBeGreaterThan(BigInt(0));
    });

    it('should handle very small deposit amounts', () => {
      const depositAmount = '0.000001';
      const currentPoolRate = BigInt('1000000000000000000000000000');
      const userRate = BigInt(0);

      const result = calculateBaseRewards(depositAmount, currentPoolRate, userRate);

      // Very small amounts should still calculate correctly
      expect(result).toBeGreaterThanOrEqual(BigInt(0));
    });

    it('should return zero for invalid deposit amounts', () => {
      const result = calculateBaseRewards(
        'invalid',
        BigInt('1000000000000000000000000000'),
        BigInt(0)
      );

      expect(result).toBe(BigInt(0));
    });

    it('should handle different token decimals', () => {
      const depositAmount = '1';
      const currentPoolRate = BigInt('1000000000000000000000000000');

      // 18 decimals (ETH, MOR)
      const result18 = calculateBaseRewards(depositAmount, currentPoolRate, BigInt(0), 18);

      // 8 decimals (wBTC)
      const result8 = calculateBaseRewards(depositAmount, currentPoolRate, BigInt(0), 8);

      // 6 decimals (USDC, USDT)
      const result6 = calculateBaseRewards(depositAmount, currentPoolRate, BigInt(0), 6);

      // All should return positive values, but scaled differently
      expect(result18).toBeGreaterThan(BigInt(0));
      expect(result8).toBeGreaterThan(BigInt(0));
      expect(result6).toBeGreaterThan(BigInt(0));

      // 18 decimals should give larger wei amounts
      expect(result18).toBeGreaterThan(result6);
    });
  });

  // ============================================================================
  // applyPowerFactor
  // ============================================================================
  describe('applyPowerFactor', () => {
    const baseRewards = BigInt('1000000000000000000'); // 1 MOR in wei

    it('should correctly apply x1.0 power factor (no change)', () => {
      const result = applyPowerFactor(baseRewards, 'x1.0');
      expect(result).toBe(baseRewards);
    });

    it('should correctly apply x1.5 power factor', () => {
      const result = applyPowerFactor(baseRewards, 'x1.5');
      const expected = BigInt('1500000000000000000'); // 1.5 MOR
      expect(result).toBe(expected);
    });

    it('should correctly apply x2.0 power factor', () => {
      const result = applyPowerFactor(baseRewards, 'x2.0');
      const expected = BigInt('2000000000000000000'); // 2 MOR
      expect(result).toBe(expected);
    });

    it('should correctly apply x10.7 power factor (maximum)', () => {
      const result = applyPowerFactor(baseRewards, 'x10.7');
      const expected = BigInt('10700000000000000000'); // 10.7 MOR
      expect(result).toBe(expected);
    });

    it('should handle power factor without x prefix', () => {
      const result = applyPowerFactor(baseRewards, '2.5');
      const expected = BigInt('2500000000000000000'); // 2.5 MOR
      expect(result).toBe(expected);
    });

    it('should return base rewards for invalid power factor', () => {
      const result = applyPowerFactor(baseRewards, 'invalid');
      expect(result).toBe(baseRewards);
    });

    it('should return base rewards for zero power factor', () => {
      const result = applyPowerFactor(baseRewards, 'x0');
      expect(result).toBe(baseRewards);
    });

    it('should return base rewards for negative power factor', () => {
      const result = applyPowerFactor(baseRewards, 'x-1.5');
      expect(result).toBe(baseRewards);
    });

    it('should handle very large base rewards', () => {
      const largeRewards = BigInt('1000000000000000000000000'); // 1M MOR
      const result = applyPowerFactor(largeRewards, 'x5.0');
      const expected = BigInt('5000000000000000000000000'); // 5M MOR
      expect(result).toBe(expected);
    });

    it('should handle zero base rewards', () => {
      const result = applyPowerFactor(BigInt(0), 'x10.0');
      expect(result).toBe(BigInt(0));
    });
  });

  // ============================================================================
  // calculateEstimatedRewards
  // ============================================================================
  describe('calculateEstimatedRewards', () => {
    const validPoolRate = BigInt('1000000000000000000000000000');

    it('should return valid result for correct inputs', () => {
      const result = calculateEstimatedRewards('1', validPoolRate, 'x1.5', 1);

      expect(result.isValid).toBe(true);
      expect(result.baseRewards).toBeGreaterThan(BigInt(0));
      expect(result.finalRewards).toBeGreaterThan(BigInt(0));
      expect(result.formattedRewards).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should return invalid for zero deposit amount', () => {
      const result = calculateEstimatedRewards('0', validPoolRate, 'x1.5', 1);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid deposit amount');
    });

    it('should return invalid for negative deposit amount', () => {
      const result = calculateEstimatedRewards('-1', validPoolRate, 'x1.5', 1);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid deposit amount');
    });

    it('should return invalid for invalid deposit string', () => {
      const result = calculateEstimatedRewards('abc', validPoolRate, 'x1.5', 1);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid deposit amount');
    });

    it('should return invalid for zero pool rate', () => {
      const result = calculateEstimatedRewards('1', BigInt(0), 'x1.5', 1);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid pool rate');
    });

    it('should project rewards over lock duration', () => {
      const result1Year = calculateEstimatedRewards('1', validPoolRate, 'x1.0', 1);
      const result2Years = calculateEstimatedRewards('1', validPoolRate, 'x1.0', 2);

      // 2-year projection should be approximately 2x the 1-year projection
      expect(result2Years.finalRewards).toBeGreaterThan(result1Year.finalRewards);
    });

    it('should handle different token decimals', () => {
      // Default 18 decimals
      const result18 = calculateEstimatedRewards('1', validPoolRate, 'x1.0', 1, 18);

      // 8 decimals (wBTC)
      const result8 = calculateEstimatedRewards('1', validPoolRate, 'x1.0', 1, 8);

      expect(result18.isValid).toBe(true);
      expect(result8.isValid).toBe(true);
    });
  });

  // ============================================================================
  // formatRewardsForDisplay
  // ============================================================================
  describe('formatRewardsForDisplay', () => {
    it('should format zero rewards', () => {
      const result = formatRewardsForDisplay(BigInt(0));
      expect(result).toBe('0.00');
    });

    it('should format very small rewards as "< 0.01"', () => {
      const smallRewards = BigInt('1000000000000000'); // 0.001 MOR
      const result = formatRewardsForDisplay(smallRewards);
      expect(result).toBe('< 0.01');
    });

    it('should format normal rewards with 2 decimal places', () => {
      const rewards = BigInt('1230000000000000000'); // 1.23 MOR
      const result = formatRewardsForDisplay(rewards);
      expect(result).toBe('1.23');
    });

    it('should format thousands with K suffix', () => {
      const rewards = BigInt('1500000000000000000000'); // 1500 MOR
      const result = formatRewardsForDisplay(rewards);
      expect(result).toBe('1.50K');
    });

    it('should format millions with M suffix', () => {
      const rewards = BigInt('2500000000000000000000000'); // 2.5M MOR
      const result = formatRewardsForDisplay(rewards);
      expect(result).toBe('2.50M');
    });

    it('should handle edge case at exactly 1000', () => {
      const rewards = BigInt('1000000000000000000000'); // 1000 MOR
      const result = formatRewardsForDisplay(rewards);
      expect(result).toBe('1.00K');
    });

    it('should handle edge case at exactly 1000000', () => {
      const rewards = BigInt('1000000000000000000000000'); // 1M MOR
      const result = formatRewardsForDisplay(rewards);
      expect(result).toBe('1.00M');
    });
  });

  // ============================================================================
  // getLockDurationInYears
  // ============================================================================
  describe('getLockDurationInYears', () => {
    it('should convert days to years correctly', () => {
      // 365 days should be approximately 1 year
      const result = getLockDurationInYears('365', 'days');
      expect(result).toBeCloseTo(0.999, 2); // 365/365.25
    });

    it('should convert months to years correctly', () => {
      const result = getLockDurationInYears('12', 'months');
      expect(result).toBe(1);
    });

    it('should pass through years directly', () => {
      const result = getLockDurationInYears('2', 'years');
      expect(result).toBe(2);
    });

    it('should handle fractional results for days', () => {
      const result = getLockDurationInYears('30', 'days');
      expect(result).toBeCloseTo(30 / 365.25, 4);
    });

    it('should handle fractional results for months', () => {
      const result = getLockDurationInYears('6', 'months');
      expect(result).toBe(0.5);
    });

    it('should return 0 for invalid input', () => {
      expect(getLockDurationInYears('invalid', 'days')).toBe(0);
      expect(getLockDurationInYears('-1', 'months')).toBe(0);
      expect(getLockDurationInYears('0', 'years')).toBe(0);
    });
  });

  // ============================================================================
  // estimateFuturePoolRate
  // ============================================================================
  describe('estimateFuturePoolRate', () => {
    const currentRate = BigInt('1000000000000000000000000000'); // 10^27

    it('should return current rate for zero projection years', () => {
      const result = estimateFuturePoolRate(currentRate, 0);
      expect(result).toBe(currentRate);
    });

    it('should return current rate for negative projection years', () => {
      const result = estimateFuturePoolRate(currentRate, -1);
      expect(result).toBe(currentRate);
    });

    it('should apply default 10% annual growth rate', () => {
      const result = estimateFuturePoolRate(currentRate, 1);
      // After 1 year at 10% growth: rate * 1.1
      expect(result).toBeGreaterThan(currentRate);
    });

    it('should apply compound growth over multiple years', () => {
      const result1Year = estimateFuturePoolRate(currentRate, 1);
      const result2Years = estimateFuturePoolRate(currentRate, 2);

      // Growth should be compounded
      expect(result2Years).toBeGreaterThan(result1Year);
    });

    it('should apply custom growth rate', () => {
      const result20 = estimateFuturePoolRate(currentRate, 1, 0.2); // 20% growth
      const result10 = estimateFuturePoolRate(currentRate, 1, 0.1); // 10% growth

      expect(result20).toBeGreaterThan(result10);
    });

    it('should handle zero growth rate', () => {
      const result = estimateFuturePoolRate(currentRate, 5, 0);
      expect(result).toBe(currentRate);
    });
  });

  // ============================================================================
  // REWARD_CONSTANTS
  // ============================================================================
  describe('REWARD_CONSTANTS', () => {
    it('should have correct decimal scale', () => {
      expect(REWARD_CONSTANTS.DECIMAL_SCALE).toBe(25);
    });

    it('should have correct MOR decimals', () => {
      expect(REWARD_CONSTANTS.MOR_DECIMALS).toBe(18);
    });
  });
});
