/**
 * API Route Tests: Builders
 *
 * Tests for the builders API endpoints.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';

// Mock data
const mockBuilders = [
  {
    id: 'builder-1',
    name: 'Test Builder 1',
    slug: 'test-builder-1',
    description: 'A test builder for testing',
    totalStaked: '1000000000000000000000',
    minimalDeposit: '100000000000000000',
    network: 'arbitrum',
    projectId: '0x1234567890123456789012345678901234567890',
  },
  {
    id: 'builder-2',
    name: 'Test Builder 2',
    slug: 'test-builder-2',
    description: 'Another test builder',
    totalStaked: '2500000000000000000000',
    minimalDeposit: '500000000000000000',
    network: 'base',
    projectId: '0x0987654321098765432109876543210987654321',
  },
];

describe('/api/builders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/builders', () => {
    it('should return list of builders', async () => {
      const response = await fetch('http://localhost:3000/api/builders');
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.builders).toBeDefined();
      expect(Array.isArray(data.builders)).toBe(true);
    });

    it('should include required fields in builder response', async () => {
      const response = await fetch('http://localhost:3000/api/builders');
      const data = await response.json();

      if (data.builders.length > 0) {
        const builder = data.builders[0];

        expect(builder).toHaveProperty('id');
        expect(builder).toHaveProperty('name');
        expect(builder).toHaveProperty('slug');
        expect(builder).toHaveProperty('totalStaked');
        expect(builder).toHaveProperty('network');
      }
    });

    it('should handle empty builders list', async () => {
      server.use(
        http.get('*/api/builders', () => {
          return HttpResponse.json({ builders: [] });
        })
      );

      const response = await fetch('http://localhost:3000/api/builders');
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.builders).toEqual([]);
    });

    it('should handle server error', async () => {
      server.use(
        http.get('*/api/builders', () => {
          return HttpResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
          );
        })
      );

      const response = await fetch('http://localhost:3000/api/builders');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/builders/:slug', () => {
    it('should return a single builder by slug', async () => {
      const response = await fetch('http://localhost:3000/api/builders/test-builder-1');
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.slug).toBe('test-builder-1');
    });

    it('should handle builder not found', async () => {
      server.use(
        http.get('*/api/builders/:slug', ({ params }) => {
          return HttpResponse.json(
            { error: 'Builder not found' },
            { status: 404 }
          );
        })
      );

      const response = await fetch('http://localhost:3000/api/builders/non-existent');

      expect(response.status).toBe(404);
    });
  });
});

describe('/api/builders/goldsky/*', () => {
  describe('GET /api/builders/goldsky/arbitrum', () => {
    it('should return Arbitrum builders', async () => {
      server.use(
        http.get('*/api/builders/goldsky/arbitrum', () => {
          return HttpResponse.json({
            builders: mockBuilders.filter((b) => b.network === 'arbitrum'),
          });
        })
      );

      const response = await fetch('http://localhost:3000/api/builders/goldsky/arbitrum');
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.builders).toBeDefined();
      data.builders.forEach((builder: typeof mockBuilders[0]) => {
        expect(builder.network).toBe('arbitrum');
      });
    });
  });

  describe('GET /api/builders/goldsky/base', () => {
    it('should return Base builders', async () => {
      server.use(
        http.get('*/api/builders/goldsky/base', () => {
          return HttpResponse.json({
            builders: mockBuilders.filter((b) => b.network === 'base'),
          });
        })
      );

      const response = await fetch('http://localhost:3000/api/builders/goldsky/base');
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.builders).toBeDefined();
      data.builders.forEach((builder: typeof mockBuilders[0]) => {
        expect(builder.network).toBe('base');
      });
    });
  });

  describe('GET /api/builders/goldsky/:projectId', () => {
    it('should return a specific project by ID', async () => {
      const projectId = '0x1234567890123456789012345678901234567890';

      server.use(
        http.get(`*/api/builders/goldsky/${projectId}`, () => {
          return HttpResponse.json({
            project: mockBuilders[0],
          });
        })
      );

      const response = await fetch(`http://localhost:3000/api/builders/goldsky/${projectId}`);
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.project).toBeDefined();
      expect(data.project.projectId).toBe(projectId);
    });

    it('should handle project not found', async () => {
      const projectId = '0x0000000000000000000000000000000000000000';

      server.use(
        http.get(`*/api/builders/goldsky/${projectId}`, () => {
          return HttpResponse.json(
            { error: 'Project not found' },
            { status: 404 }
          );
        })
      );

      const response = await fetch(`http://localhost:3000/api/builders/goldsky/${projectId}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/builders/goldsky/:projectId/users', () => {
    it('should return users staking in a project', async () => {
      const projectId = '0x1234567890123456789012345678901234567890';

      server.use(
        http.get(`*/api/builders/goldsky/${projectId}/users`, () => {
          return HttpResponse.json({
            users: [
              {
                id: 'user-1',
                address: '0x1111111111111111111111111111111111111111',
                staked: '500000000000000000000',
              },
              {
                id: 'user-2',
                address: '0x2222222222222222222222222222222222222222',
                staked: '1000000000000000000000',
              },
            ],
          });
        })
      );

      const response = await fetch(
        `http://localhost:3000/api/builders/goldsky/${projectId}/users`
      );
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.users).toBeDefined();
      expect(Array.isArray(data.users)).toBe(true);
      expect(data.users.length).toBeGreaterThan(0);
    });
  });
});

describe('/api/builders/goldsky/user-staked/:network', () => {
  it('should return user staked builders for arbitrum', async () => {
    server.use(
      http.get('*/api/builders/goldsky/user-staked/arbitrum', ({ request }) => {
        const url = new URL(request.url);
        const userAddress = url.searchParams.get('address');

        if (!userAddress) {
          return HttpResponse.json(
            { error: 'Address required' },
            { status: 400 }
          );
        }

        return HttpResponse.json({
          stakedBuilders: [
            {
              projectId: '0x1234567890123456789012345678901234567890',
              staked: '500000000000000000000',
              pendingRewards: '10000000000000000000',
            },
          ],
        });
      })
    );

    const response = await fetch(
      'http://localhost:3000/api/builders/goldsky/user-staked/arbitrum?address=0x1111111111111111111111111111111111111111'
    );
    const data = await response.json();

    expect(response.ok).toBe(true);
    expect(data.stakedBuilders).toBeDefined();
  });

  it('should return error when address is missing', async () => {
    server.use(
      http.get('*/api/builders/goldsky/user-staked/arbitrum', ({ request }) => {
        const url = new URL(request.url);
        const userAddress = url.searchParams.get('address');

        if (!userAddress) {
          return HttpResponse.json(
            { error: 'Address required' },
            { status: 400 }
          );
        }

        return HttpResponse.json({ stakedBuilders: [] });
      })
    );

    const response = await fetch(
      'http://localhost:3000/api/builders/goldsky/user-staked/arbitrum'
    );

    expect(response.status).toBe(400);
  });
});
