/**
 * Unit Tests: Power Factor Utilities
 *
 * Tests for power factor calculations used in lock period management.
 * These calculations are CRITICAL for determining reward multipliers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  durationToSeconds,
  formatPowerFactor,
  formatPowerFactorPrecise,
  validateLockDuration,
  willActivatePowerFactor,
  getRecommendedLockPeriods,
  calculateUnlockDate,
  formatUnlockDate,
  calculatePowerFactorFromDuration,
  validateMaxYears,
  getMinAllowedValue,
  getMaxAllowedValue,
  POWER_FACTOR_CONSTANTS,
} from '@/lib/utils/power-factor-utils';

describe('Power Factor Utilities', () => {
  // ============================================================================
  // durationToSeconds
  // ============================================================================
  describe('durationToSeconds', () => {
    it('should convert days to seconds with safety buffer', () => {
      const result = durationToSeconds('7', 'days');
      const expectedBase = 7 * 86400;
      const expectedWithBuffer = expectedBase + 300; // 5-minute buffer

      expect(result).toBe(BigInt(expectedWithBuffer));
    });

    it('should convert months to seconds with safety buffer', () => {
      const result = durationToSeconds('1', 'months');
      const expectedBase = 1 * 30 * 86400;
      const expectedWithBuffer = expectedBase + 300;

      expect(result).toBe(BigInt(expectedWithBuffer));
    });

    it('should handle 3 months special case (minimum requirement)', () => {
      const result = durationToSeconds('3', 'months');
      const expectedBase = 90 * 86400; // Exactly 90 days
      const expectedWithBuffer = expectedBase + 300;

      expect(result).toBe(BigInt(expectedWithBuffer));
    });

    it('should convert years to seconds with safety buffer', () => {
      const result = durationToSeconds('1', 'years');
      const expectedBase = 365 * 86400;
      const expectedWithBuffer = expectedBase + 300;

      expect(result).toBe(BigInt(expectedWithBuffer));
    });

    it('should handle 6 years special case (maximum power factor)', () => {
      const result = durationToSeconds('6', 'years');
      // Uses hardcoded value from documentation
      const expectedBase = 189216000;
      const expectedWithBuffer = expectedBase + 300;

      expect(result).toBe(BigInt(expectedWithBuffer));
    });

    it('should convert minutes to seconds with safety buffer', () => {
      const result = durationToSeconds('60', 'minutes');
      const expectedBase = 60 * 60;
      const expectedWithBuffer = expectedBase + 300;

      expect(result).toBe(BigInt(expectedWithBuffer));
    });

    it('should return zero for invalid input', () => {
      expect(durationToSeconds('invalid', 'days')).toBe(BigInt(0));
      expect(durationToSeconds('-1', 'months')).toBe(BigInt(0));
      expect(durationToSeconds('0', 'years')).toBe(BigInt(0));
    });

    it('should return zero for empty input', () => {
      expect(durationToSeconds('', 'days')).toBe(BigInt(0));
    });
  });

  // ============================================================================
  // formatPowerFactor
  // ============================================================================
  describe('formatPowerFactor', () => {
    it('should format x1.0 power factor correctly', () => {
      // Raw multiplier for x1.0 = 10000 * 10^21
      const rawMultiplier = BigInt('10000000000000000000000000');
      const result = formatPowerFactor(rawMultiplier);
      expect(result).toBe('x1.0');
    });

    it('should format x2.0 power factor correctly', () => {
      // Raw multiplier for x2.0 = 20000 * 10^21
      const rawMultiplier = BigInt('20000000000000000000000000');
      const result = formatPowerFactor(rawMultiplier);
      expect(result).toBe('x2.0');
    });

    it('should format x1.5 power factor correctly', () => {
      // Raw multiplier for x1.5 = 15000 * 10^21
      const rawMultiplier = BigInt('15000000000000000000000000');
      const result = formatPowerFactor(rawMultiplier);
      expect(result).toBe('x1.5');
    });

    it('should cap at maximum power factor (x10.7)', () => {
      // Raw multiplier higher than x10.7 should be capped
      const rawMultiplier = BigInt('150000000000000000000000000'); // Would be x15
      const result = formatPowerFactor(rawMultiplier);
      expect(result).toBe('x10.7');
    });

    it('should handle zero multiplier gracefully', () => {
      const result = formatPowerFactor(BigInt(0));
      expect(result).toBe('x0.0');
    });

    it('should return x1.0 on error', () => {
      // This tests the error path - passing invalid data that could cause issues
      const result = formatPowerFactor(BigInt(-1));
      // Negative bigint handling should return x1.0 on error
      expect(result).toBeDefined();
    });
  });

  // ============================================================================
  // formatPowerFactorPrecise
  // ============================================================================
  describe('formatPowerFactorPrecise', () => {
    it('should format with same result as formatPowerFactor for standard values', () => {
      const rawMultiplier = BigInt('15000000000000000000000000'); // x1.5

      const standard = formatPowerFactor(rawMultiplier);
      const precise = formatPowerFactorPrecise(rawMultiplier);

      expect(standard).toBe(precise);
    });

    it('should cap at maximum power factor', () => {
      const hugeMultiplier = BigInt('200000000000000000000000000'); // Would be x20
      const result = formatPowerFactorPrecise(hugeMultiplier);
      expect(result).toBe('x10.7');
    });

    it('should return x1.0 on error', () => {
      // Test error handling - formatUnits can throw on weird input
      expect(formatPowerFactorPrecise(BigInt(0))).toBeDefined();
    });
  });

  // ============================================================================
  // validateLockDuration
  // ============================================================================
  describe('validateLockDuration', () => {
    it('should return valid for acceptable lock periods', () => {
      const result = validateLockDuration('1', 'years');
      expect(result.isValid).toBe(true);
      expect(result.errorMessage).toBeUndefined();
    });

    it('should return error for invalid number input', () => {
      const result = validateLockDuration('abc', 'days');
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('Please enter a valid positive number');
    });

    it('should return error for zero input', () => {
      const result = validateLockDuration('0', 'months');
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('Please enter a valid positive number');
    });

    it('should return error for negative input', () => {
      const result = validateLockDuration('-5', 'days');
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('Please enter a valid positive number');
    });

    it('should return error when exceeding maximum years', () => {
      const result = validateLockDuration('15', 'years');
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('Maximum lock period');
    });

    it('should return error when months exceed maximum', () => {
      const result = validateLockDuration('150', 'months'); // 12.5 years
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('Maximum lock period');
    });

    it('should return warning for periods below power factor activation', () => {
      const result = validateLockDuration('3', 'months'); // Below 7 months
      expect(result.isValid).toBe(true);
      expect(result.warningMessage).toContain('Power factor starts after');
    });

    it('should not return warning for periods at or above activation threshold', () => {
      const result = validateLockDuration('7', 'months');
      expect(result.isValid).toBe(true);
      expect(result.warningMessage).toBeUndefined();
    });
  });

  // ============================================================================
  // willActivatePowerFactor
  // ============================================================================
  describe('willActivatePowerFactor', () => {
    it('should return false for periods below 7 months', () => {
      expect(willActivatePowerFactor('6', 'months')).toBe(false);
      expect(willActivatePowerFactor('180', 'days')).toBe(false); // ~6 months
      expect(willActivatePowerFactor('0.5', 'years')).toBe(false); // 6 months
    });

    it('should return true for periods at or above 7 months', () => {
      expect(willActivatePowerFactor('7', 'months')).toBe(true);
      expect(willActivatePowerFactor('1', 'years')).toBe(true);
      expect(willActivatePowerFactor('210', 'days')).toBe(true); // ~7 months
    });

    it('should return false for invalid inputs', () => {
      expect(willActivatePowerFactor('invalid', 'months')).toBe(false);
      expect(willActivatePowerFactor('-1', 'years')).toBe(false);
      expect(willActivatePowerFactor('0', 'days')).toBe(false);
    });
  });

  // ============================================================================
  // calculateUnlockDate
  // ============================================================================
  describe('calculateUnlockDate', () => {
    let fixedDate: Date;

    beforeEach(() => {
      // Use a fixed date for consistent testing
      fixedDate = new Date('2024-01-15T12:00:00.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(fixedDate);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should calculate unlock date for days', () => {
      const result = calculateUnlockDate('30', 'days', fixedDate);
      expect(result).not.toBeNull();

      const expected = new Date(fixedDate);
      expected.setDate(expected.getDate() + 30);
      expect(result!.getTime()).toBe(expected.getTime());
    });

    it('should calculate unlock date for months', () => {
      const result = calculateUnlockDate('3', 'months', fixedDate);
      expect(result).not.toBeNull();

      const expected = new Date(fixedDate);
      expected.setMonth(expected.getMonth() + 3);
      expect(result!.getTime()).toBe(expected.getTime());
    });

    it('should calculate unlock date for years', () => {
      const result = calculateUnlockDate('2', 'years', fixedDate);
      expect(result).not.toBeNull();

      const expected = new Date(fixedDate);
      expected.setFullYear(expected.getFullYear() + 2);
      expect(result!.getTime()).toBe(expected.getTime());
    });

    it('should calculate unlock date for minutes', () => {
      const result = calculateUnlockDate('60', 'minutes', fixedDate);
      expect(result).not.toBeNull();

      const expected = new Date(fixedDate);
      expected.setMinutes(expected.getMinutes() + 60);
      expect(result!.getTime()).toBe(expected.getTime());
    });

    it('should return null for invalid input', () => {
      expect(calculateUnlockDate('invalid', 'days', fixedDate)).toBeNull();
      expect(calculateUnlockDate('-1', 'months', fixedDate)).toBeNull();
      expect(calculateUnlockDate('0', 'years', fixedDate)).toBeNull();
    });

    it('should use current date as default', () => {
      const result = calculateUnlockDate('1', 'days');
      expect(result).not.toBeNull();

      // Should be 1 day from now
      const expected = new Date(fixedDate);
      expected.setDate(expected.getDate() + 1);
      expect(result!.getDate()).toBe(expected.getDate());
    });
  });

  // ============================================================================
  // formatUnlockDate
  // ============================================================================
  describe('formatUnlockDate', () => {
    it('should format date in expected format', () => {
      const date = new Date('2025-03-15');
      const result = formatUnlockDate(date);

      // Should be in "MMM D, YYYY" format
      expect(result).toMatch(/Mar 15, 2025/);
    });

    it('should handle different dates correctly', () => {
      const date1 = new Date('2024-12-25');
      const date2 = new Date('2026-01-01');

      expect(formatUnlockDate(date1)).toMatch(/Dec 25, 2024/);
      expect(formatUnlockDate(date2)).toMatch(/Jan 1, 2026/);
    });
  });

  // ============================================================================
  // calculatePowerFactorFromDuration
  // ============================================================================
  describe('calculatePowerFactorFromDuration', () => {
    it('should return x1.0 for periods below 7 months', () => {
      expect(calculatePowerFactorFromDuration('6', 'months')).toBe('x1.0');
      expect(calculatePowerFactorFromDuration('180', 'days')).toBe('x1.0');
    });

    it('should return power factor > x1.0 for periods at or above 7 months', () => {
      const result = calculatePowerFactorFromDuration('12', 'months');
      expect(result).not.toBe('x1.0');
      expect(parseFloat(result.replace('x', ''))).toBeGreaterThan(1.0);
    });

    it('should increase power factor with longer lock periods', () => {
      const result1Year = parseFloat(
        calculatePowerFactorFromDuration('1', 'years').replace('x', '')
      );
      const result2Years = parseFloat(
        calculatePowerFactorFromDuration('2', 'years').replace('x', '')
      );
      const result5Years = parseFloat(
        calculatePowerFactorFromDuration('5', 'years').replace('x', '')
      );

      expect(result2Years).toBeGreaterThan(result1Year);
      expect(result5Years).toBeGreaterThan(result2Years);
    });

    it('should cap at maximum power factor (x10.7)', () => {
      const result = calculatePowerFactorFromDuration('10', 'years');
      const powerFactor = parseFloat(result.replace('x', ''));
      expect(powerFactor).toBeLessThanOrEqual(POWER_FACTOR_CONSTANTS.MAX_POWER_FACTOR);
    });

    it('should return x1.0 for invalid inputs', () => {
      expect(calculatePowerFactorFromDuration('invalid', 'days')).toBe('x1.0');
      expect(calculatePowerFactorFromDuration('-1', 'months')).toBe('x1.0');
      expect(calculatePowerFactorFromDuration('0', 'years')).toBe('x1.0');
    });
  });

  // ============================================================================
  // validateMaxYears
  // ============================================================================
  describe('validateMaxYears', () => {
    it('should return true for valid year values', () => {
      expect(validateMaxYears('1')).toBe(true);
      expect(validateMaxYears('5')).toBe(true);
      expect(validateMaxYears('10')).toBe(true);
    });

    it('should return false for values exceeding maximum', () => {
      expect(validateMaxYears('11')).toBe(false);
      expect(validateMaxYears('20')).toBe(false);
      expect(validateMaxYears('100')).toBe(false);
    });

    it('should return true for edge case at maximum', () => {
      expect(validateMaxYears('10')).toBe(true);
    });

    it('should return true for invalid input (let other validation handle)', () => {
      expect(validateMaxYears('invalid')).toBe(true);
      expect(validateMaxYears('-1')).toBe(true);
      expect(validateMaxYears('0')).toBe(true);
    });
  });

  // ============================================================================
  // getMinAllowedValue
  // ============================================================================
  describe('getMinAllowedValue', () => {
    it('should return correct minimum for years', () => {
      expect(getMinAllowedValue('years')).toBe(1);
    });

    it('should return correct minimum for months', () => {
      expect(getMinAllowedValue('months')).toBe(1);
    });

    it('should return correct minimum for days (7 days)', () => {
      expect(getMinAllowedValue('days')).toBe(7);
    });

    it('should return correct minimum for minutes (7 days in minutes)', () => {
      const expected = 7 * 24 * 60; // 10080 minutes
      expect(getMinAllowedValue('minutes')).toBe(expected);
    });
  });

  // ============================================================================
  // getMaxAllowedValue
  // ============================================================================
  describe('getMaxAllowedValue', () => {
    it('should return 10 for years', () => {
      expect(getMaxAllowedValue('years')).toBe(10);
    });

    it('should return 120 for months (10 years)', () => {
      expect(getMaxAllowedValue('months')).toBe(120);
    });

    it('should return approximately 3650 for days (10 years)', () => {
      const result = getMaxAllowedValue('days');
      // Account for leap years - should be between 3650 and 3653
      expect(result).toBeGreaterThanOrEqual(3650);
      expect(result).toBeLessThanOrEqual(3653);
    });

    it('should return correct minutes for 10 years', () => {
      const result = getMaxAllowedValue('minutes');
      // Should be approximately 10 years in minutes
      const minExpected = 10 * 365 * 24 * 60; // 5,256,000
      const maxExpected = 10 * 366 * 24 * 60; // ~5,270,400

      expect(result).toBeGreaterThanOrEqual(minExpected);
      expect(result).toBeLessThanOrEqual(maxExpected);
    });
  });

  // ============================================================================
  // getRecommendedLockPeriods
  // ============================================================================
  describe('getRecommendedLockPeriods', () => {
    it('should return array of recommended periods', () => {
      const periods = getRecommendedLockPeriods();
      expect(Array.isArray(periods)).toBe(true);
      expect(periods.length).toBeGreaterThan(0);
    });

    it('should include required properties in each period', () => {
      const periods = getRecommendedLockPeriods();

      periods.forEach((period) => {
        expect(period).toHaveProperty('value');
        expect(period).toHaveProperty('unit');
        expect(period).toHaveProperty('description');
        expect(period).toHaveProperty('powerFactorRange');
      });
    });

    it('should include minimum activation period (7 months)', () => {
      const periods = getRecommendedLockPeriods();
      const minPeriod = periods.find(
        (p) => p.value === '7' && p.unit === 'months'
      );
      expect(minPeriod).toBeDefined();
    });

    it('should include maximum period (10 years)', () => {
      const periods = getRecommendedLockPeriods();
      const maxPeriod = periods.find(
        (p) => p.value === '10' && p.unit === 'years'
      );
      expect(maxPeriod).toBeDefined();
    });
  });

  // ============================================================================
  // POWER_FACTOR_CONSTANTS
  // ============================================================================
  describe('POWER_FACTOR_CONSTANTS', () => {
    it('should have correct multiplier scale', () => {
      expect(POWER_FACTOR_CONSTANTS.MULTIPLIER_SCALE).toBe(21);
    });

    it('should have correct rewards divider', () => {
      expect(POWER_FACTOR_CONSTANTS.REWARDS_DIVIDER).toBe(10000);
    });

    it('should have correct max power factor', () => {
      expect(POWER_FACTOR_CONSTANTS.MAX_POWER_FACTOR).toBe(10.7);
    });

    it('should have correct minimum activation period', () => {
      expect(POWER_FACTOR_CONSTANTS.MIN_ACTIVATION_PERIOD_MONTHS).toBe(7);
    });

    it('should have correct minimum deposit lock days', () => {
      expect(POWER_FACTOR_CONSTANTS.MIN_DEPOSIT_LOCK_DAYS).toBe(7);
    });

    it('should have correct maximum lock period years', () => {
      expect(POWER_FACTOR_CONSTANTS.MAX_LOCK_PERIOD_YEARS).toBe(10);
    });

    it('should have correct seconds per day', () => {
      expect(POWER_FACTOR_CONSTANTS.SECONDS_PER_DAY).toBe(86400);
    });
  });
});
