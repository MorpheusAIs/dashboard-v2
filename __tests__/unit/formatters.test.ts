/**
 * Unit Tests: Formatting Utilities
 *
 * Tests for number formatting, timestamp formatting, and display utilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatTimestamp,
  formatBigInt,
} from '@/lib/utils/formatters';
import { cn, formatNumber, parseBuilderDescription } from '@/lib/utils';

describe('Formatting Utilities', () => {
  // ============================================================================
  // formatTimestamp
  // ============================================================================
  describe('formatTimestamp', () => {
    let fixedDate: Date;

    beforeEach(() => {
      // Use a fixed date for consistent testing
      fixedDate = new Date('2024-06-15T12:00:00.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(fixedDate);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should format a valid timestamp correctly', () => {
      // January 1, 2024, 12:00:00 UTC = 1704110400
      const timestamp = BigInt(1704110400);
      const result = formatTimestamp(timestamp);

      // Should contain date parts
      expect(result).toContain('2024');
      expect(result).toContain('Jan');
    });

    it('should handle number timestamps', () => {
      const timestamp = 1704110400;
      const result = formatTimestamp(timestamp);
      expect(result).toContain('2024');
    });

    it('should return placeholder for undefined', () => {
      const result = formatTimestamp(undefined);
      expect(result).toBe('--- --, ----');
    });

    it('should return "Never" for zero timestamp', () => {
      const result = formatTimestamp(0);
      expect(result).toBe('Never');
    });

    it('should return "Never" for BigInt zero', () => {
      const result = formatTimestamp(BigInt(0));
      expect(result).toBe('Never');
    });

    it('should format small numbers as duration (days)', () => {
      const oneDay = 86400;
      const result = formatTimestamp(oneDay);
      expect(result).toBe('1 day');
    });

    it('should format multiple days correctly', () => {
      const sevenDays = 86400 * 7;
      const result = formatTimestamp(sevenDays);
      expect(result).toBe('7 days');
    });

    it('should format hours correctly', () => {
      const twoHours = 3600 * 2;
      const result = formatTimestamp(twoHours);
      expect(result).toBe('2 hours');
    });

    it('should format single hour correctly', () => {
      const oneHour = 3600;
      const result = formatTimestamp(oneHour);
      expect(result).toBe('1 hour');
    });

    it('should format minutes correctly', () => {
      const thirtyMinutes = 60 * 30;
      const result = formatTimestamp(thirtyMinutes);
      expect(result).toBe('30 minutes');
    });

    it('should format single minute correctly', () => {
      const oneMinute = 60;
      const result = formatTimestamp(oneMinute);
      expect(result).toBe('1 minute');
    });

    it('should format seconds for very short durations', () => {
      const thirtySeconds = 30;
      const result = formatTimestamp(thirtySeconds);
      expect(result).toBe('30 seconds');
    });

    it('should handle NaN input gracefully', () => {
      const result = formatTimestamp(NaN);
      expect(result).toBe('Invalid Number');
    });
  });

  // ============================================================================
  // formatBigInt
  // ============================================================================
  describe('formatBigInt', () => {
    it('should format BigInt with default decimals (18)', () => {
      const value = BigInt('1000000000000000000'); // 1 ETH
      const result = formatBigInt(value);
      expect(result).toBe('1.00');
    });

    it('should format BigInt with custom decimals', () => {
      const value = BigInt('100000000'); // 1 USDC (6 decimals)
      const result = formatBigInt(value, 6);
      expect(result).toBe('100.00');
    });

    it('should format with custom precision', () => {
      const value = BigInt('1234567890000000000'); // 1.23456789 ETH
      const result = formatBigInt(value, 18, 4);
      expect(result).toBe('1.2346'); // Rounded to 4 decimals
    });

    it('should return placeholder for undefined', () => {
      const result = formatBigInt(undefined);
      expect(result).toBe('---');
    });

    it('should format large numbers with comma separators', () => {
      const value = BigInt('1000000000000000000000'); // 1000 ETH
      const result = formatBigInt(value);
      expect(result).toBe('1,000.00');
    });

    it('should format very large numbers correctly', () => {
      const value = BigInt('1000000000000000000000000'); // 1M ETH
      const result = formatBigInt(value);
      expect(result).toBe('1,000,000.00');
    });

    it('should format zero correctly', () => {
      const result = formatBigInt(BigInt(0));
      expect(result).toBe('0.00');
    });

    it('should handle 8 decimals (wBTC)', () => {
      const value = BigInt('100000000'); // 1 wBTC
      const result = formatBigInt(value, 8);
      expect(result).toBe('1.00');
    });

    it('should handle precision of 0', () => {
      const value = BigInt('1500000000000000000'); // 1.5 ETH
      const result = formatBigInt(value, 18, 0);
      expect(result).toBe('2'); // Rounded up
    });
  });

  // ============================================================================
  // cn (className utility)
  // ============================================================================
  describe('cn', () => {
    it('should merge simple class names', () => {
      const result = cn('class1', 'class2');
      expect(result).toBe('class1 class2');
    });

    it('should handle conditional classes', () => {
      const isActive = true;
      const result = cn('base', isActive && 'active');
      expect(result).toBe('base active');
    });

    it('should filter out falsy values', () => {
      const result = cn('base', false, null, undefined, 'valid');
      expect(result).toBe('base valid');
    });

    it('should merge Tailwind classes intelligently', () => {
      // tailwind-merge should prefer the last conflicting class
      const result = cn('p-2', 'p-4');
      expect(result).toBe('p-4');
    });

    it('should handle arrays of classes', () => {
      const result = cn(['class1', 'class2'], 'class3');
      expect(result).toBe('class1 class2 class3');
    });

    it('should handle object notation', () => {
      const result = cn({
        base: true,
        active: true,
        disabled: false,
      });
      expect(result).toBe('base active');
    });

    it('should handle empty input', () => {
      const result = cn();
      expect(result).toBe('');
    });
  });

  // ============================================================================
  // formatNumber
  // ============================================================================
  describe('formatNumber', () => {
    it('should format numbers >= 1 without decimals', () => {
      expect(formatNumber(1)).toBe('1');
      expect(formatNumber(100)).toBe('100');
      expect(formatNumber(1234)).toBe('1,234');
    });

    it('should format numbers < 1 with 1 decimal place', () => {
      expect(formatNumber(0.5)).toBe('0.5');
      expect(formatNumber(0.123)).toBe('0.1');
    });

    it('should format exactly 1 without decimals', () => {
      expect(formatNumber(1)).toBe('1');
    });

    it('should handle zero', () => {
      expect(formatNumber(0)).toBe('0');
    });

    it('should return "0" for NaN', () => {
      expect(formatNumber(NaN)).toBe('0');
    });

    it('should format large numbers with commas', () => {
      expect(formatNumber(1000000)).toBe('1,000,000');
    });

    it('should handle very small numbers', () => {
      const result = formatNumber(0.01);
      expect(result).toBe('0.0');
    });
  });

  // ============================================================================
  // parseBuilderDescription
  // ============================================================================
  describe('parseBuilderDescription', () => {
    it('should return plain string as-is', () => {
      const description = 'This is a plain description';
      expect(parseBuilderDescription(description)).toBe(description);
    });

    it('should extract description from JSON metadata structure', () => {
      const jsonDescription = JSON.stringify({
        metadata_: {
          description: 'Extracted description',
        },
      });
      expect(parseBuilderDescription(jsonDescription)).toBe('Extracted description');
    });

    it('should return original if JSON but no metadata_ structure', () => {
      const jsonData = JSON.stringify({
        name: 'Test',
        value: 123,
      });
      expect(parseBuilderDescription(jsonData)).toBe(jsonData);
    });

    it('should return original if metadata_.description is not a string', () => {
      const jsonData = JSON.stringify({
        metadata_: {
          description: { nested: 'object' },
        },
      });
      expect(parseBuilderDescription(jsonData)).toBe(jsonData);
    });

    it('should return empty string for null', () => {
      expect(parseBuilderDescription(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(parseBuilderDescription(undefined)).toBe('');
    });

    it('should return empty string for empty string', () => {
      expect(parseBuilderDescription('')).toBe('');
    });

    it('should handle malformed JSON gracefully', () => {
      const malformedJson = '{ invalid json }';
      expect(parseBuilderDescription(malformedJson)).toBe(malformedJson);
    });

    it('should handle JSON with whitespace prefix', () => {
      const jsonWithWhitespace = '  { "metadata_": { "description": "Test" } }';
      expect(parseBuilderDescription(jsonWithWhitespace)).toBe('Test');
    });
  });
});
