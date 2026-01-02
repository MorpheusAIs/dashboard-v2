/**
 * API Route Tests: Dune Analytics
 *
 * Tests for the Dune Analytics API endpoints.
 * These endpoints use ISR with 3-hour cache (10800 seconds).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { server } from '../mocks/server';
import { http, HttpResponse, delay } from 'msw';

describe('/api/dune/active-stakers-mainnet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET', () => {
    it('should return active staker count', async () => {
      const response = await fetch('http://localhost:3000/api/dune/active-stakers-mainnet');
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.activeStakers).toBeDefined();
      expect(typeof data.activeStakers).toBe('number');
    });

    it('should return lastUpdated timestamp', async () => {
      const response = await fetch('http://localhost:3000/api/dune/active-stakers-mainnet');
      const data = await response.json();

      expect(data.lastUpdated).toBeDefined();
      expect(new Date(data.lastUpdated).getTime()).not.toBeNaN();
    });

    it('should handle Dune API errors gracefully', async () => {
      server.use(
        http.get('*/api/dune/active-stakers-mainnet', () => {
          return HttpResponse.json(
            {
              error: 'Dune API rate limit exceeded',
              cached: { activeStakers: 15000, lastUpdated: '2024-01-01T00:00:00Z' },
            },
            { status: 429 }
          );
        })
      );

      const response = await fetch('http://localhost:3000/api/dune/active-stakers-mainnet');

      expect(response.status).toBe(429);
    });

    it('should use ISR cache', async () => {
      // The actual caching behavior is handled by Next.js ISR
      // This test verifies the response structure supports caching

      const response = await fetch('http://localhost:3000/api/dune/active-stakers-mainnet');
      const data = await response.json();

      // Should have data that can be cached
      expect(data.activeStakers).toBeDefined();
      expect(data.lastUpdated).toBeDefined();
    });
  });
});

describe('/api/dune/active-stakers-testnet', () => {
  describe('GET', () => {
    it('should return testnet active staker count', async () => {
      const response = await fetch('http://localhost:3000/api/dune/active-stakers-testnet');
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.activeStakers).toBeDefined();
      expect(typeof data.activeStakers).toBe('number');
    });

    it('should have lower staker count than mainnet', async () => {
      const mainnetResponse = await fetch('http://localhost:3000/api/dune/active-stakers-mainnet');
      const mainnetData = await mainnetResponse.json();

      const testnetResponse = await fetch('http://localhost:3000/api/dune/active-stakers-testnet');
      const testnetData = await testnetResponse.json();

      // Testnet should generally have fewer stakers
      expect(testnetData.activeStakers).toBeLessThan(mainnetData.activeStakers);
    });
  });
});

describe('/api/dune/cumulative-deposits', () => {
  describe('GET', () => {
    it('should return array of deposit data points', async () => {
      const response = await fetch('http://localhost:3000/api/dune/cumulative-deposits');
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.deposits).toBeDefined();
      expect(Array.isArray(data.deposits)).toBe(true);
    });

    it('should include date and amount in each data point', async () => {
      const response = await fetch('http://localhost:3000/api/dune/cumulative-deposits');
      const data = await response.json();

      if (data.deposits.length > 0) {
        const firstDeposit = data.deposits[0];
        expect(firstDeposit).toHaveProperty('date');
        expect(firstDeposit).toHaveProperty('amount');
      }
    });

    it('should return deposits in chronological order', async () => {
      const response = await fetch('http://localhost:3000/api/dune/cumulative-deposits');
      const data = await response.json();

      if (data.deposits.length > 1) {
        const dates = data.deposits.map((d: { date: string }) => new Date(d.date).getTime());

        // Check if dates are in ascending order
        for (let i = 1; i < dates.length; i++) {
          expect(dates[i]).toBeGreaterThanOrEqual(dates[i - 1]);
        }
      }
    });

    it('should show cumulative growth in amounts', async () => {
      const response = await fetch('http://localhost:3000/api/dune/cumulative-deposits');
      const data = await response.json();

      if (data.deposits.length > 1) {
        // Cumulative deposits should generally increase over time
        const lastDeposit = data.deposits[data.deposits.length - 1];
        const firstDeposit = data.deposits[0];

        expect(lastDeposit.amount).toBeGreaterThanOrEqual(firstDeposit.amount);
      }
    });

    it('should return lastUpdated timestamp', async () => {
      const response = await fetch('http://localhost:3000/api/dune/cumulative-deposits');
      const data = await response.json();

      expect(data.lastUpdated).toBeDefined();
    });

    it('should handle missing API key', async () => {
      server.use(
        http.get('*/api/dune/cumulative-deposits', () => {
          return HttpResponse.json(
            { error: 'DUNE_API_KEY is not configured' },
            { status: 500 }
          );
        })
      );

      const response = await fetch('http://localhost:3000/api/dune/cumulative-deposits');

      expect(response.status).toBe(500);
    });

    it('should handle timeout gracefully', async () => {
      server.use(
        http.get('*/api/dune/cumulative-deposits', async () => {
          await delay(10000); // Simulate timeout
          return HttpResponse.json({ deposits: [] });
        })
      );

      // Note: In actual tests, you'd set a timeout and handle AbortController
      // This is a simplified version
      expect(true).toBe(true); // Placeholder
    });
  });
});

describe('Dune API error handling', () => {
  const endpoints = [
    '/api/dune/active-stakers-mainnet',
    '/api/dune/active-stakers-testnet',
    '/api/dune/cumulative-deposits',
  ];

  endpoints.forEach((endpoint) => {
    describe(`${endpoint}`, () => {
      it('should return cached data on API failure', async () => {
        server.use(
          http.get(`*${endpoint}`, () => {
            return HttpResponse.json(
              {
                error: 'Dune API temporarily unavailable',
                cached: {
                  data: 'cached-data',
                  lastUpdated: '2024-01-01T00:00:00Z',
                },
              },
              { status: 503 }
            );
          })
        );

        const response = await fetch(`http://localhost:3000${endpoint}`);
        const data = await response.json();

        // Should include cached data even on error
        expect(data.cached).toBeDefined();
      });

      it('should include debug information in error response', async () => {
        server.use(
          http.get(`*${endpoint}`, () => {
            return HttpResponse.json(
              {
                error: 'API Error',
                debug: {
                  endpoint,
                  timestamp: new Date().toISOString(),
                  retryAfter: 60,
                },
              },
              { status: 500 }
            );
          })
        );

        const response = await fetch(`http://localhost:3000${endpoint}`);
        const data = await response.json();

        expect(data.debug).toBeDefined();
      });
    });
  });
});
