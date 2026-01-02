/**
 * Global Test Setup
 * This file runs before all tests to configure the testing environment.
 */

import '@testing-library/jest-dom/vitest';
import { afterEach, beforeAll, afterAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './mocks/server';

// ============================================================================
// ENVIRONMENT SETUP
// ============================================================================

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.NEXT_PUBLIC_PROJECT_ID = 'test-project-id';
process.env.NEXT_PUBLIC_PROJECT_SECRET = 'test-secret';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.NEXT_PUBLIC_ALCHEMY_API_KEY = 'test-alchemy-key';
process.env.DUNE_API_KEY = 'test-dune-key';

// ============================================================================
// GLOBAL MOCKS
// ============================================================================

// Mock window.matchMedia for responsive components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver for lazy loading components
class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];

  constructor(_callback: IntersectionObserverCallback) {}

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn().mockReturnValue([]);
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
});

// Mock ResizeObserver for responsive components
class MockResizeObserver implements ResizeObserver {
  constructor(_callback: ResizeObserverCallback) {}

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: MockResizeObserver,
});

// Mock scrollTo for navigation tests
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: vi.fn(),
});

// Mock console methods for cleaner test output (optional)
// vi.spyOn(console, 'log').mockImplementation(() => {});
// vi.spyOn(console, 'warn').mockImplementation(() => {});
// vi.spyOn(console, 'error').mockImplementation(() => {});

// ============================================================================
// MSW SERVER SETUP
// ============================================================================

beforeAll(() => {
  // Start MSW server to intercept network requests
  server.listen({
    onUnhandledRequest: 'warn',
  });
});

afterAll(() => {
  // Stop MSW server
  server.close();
});

afterEach(() => {
  // Reset any request handlers that may be added during tests
  server.resetHandlers();

  // Cleanup rendered components
  cleanup();

  // Clear all mocks
  vi.clearAllMocks();
});

// ============================================================================
// CUSTOM MATCHERS
// ============================================================================

// Add custom matchers for BigInt testing
expect.extend({
  toBeBigInt(received: unknown) {
    const pass = typeof received === 'bigint';
    return {
      message: () =>
        pass
          ? `expected ${received} not to be a BigInt`
          : `expected ${received} to be a BigInt`,
      pass,
    };
  },
  toBeBigIntEqual(received: bigint, expected: bigint) {
    const pass = received === expected;
    return {
      message: () =>
        pass
          ? `expected ${received} not to equal ${expected}`
          : `expected ${received} to equal ${expected}`,
      pass,
    };
  },
});

// ============================================================================
// TYPE AUGMENTATION FOR CUSTOM MATCHERS
// ============================================================================

declare module 'vitest' {
  interface Assertion<T = unknown> {
    toBeBigInt(): T;
    toBeBigIntEqual(expected: bigint): T;
  }
  interface AsymmetricMatchersContaining {
    toBeBigInt(): unknown;
    toBeBigIntEqual(expected: bigint): unknown;
  }
}
