/**
 * MSW Request Handlers
 * Define mock responses for API requests used in tests.
 */

import { http, HttpResponse, delay } from 'msw';

// ============================================================================
// TOKEN PRICE HANDLERS
// ============================================================================

const tokenPriceHandlers = [
  // DefiLlama API for token prices
  http.get('https://coins.llama.fi/prices/current/*', async () => {
    await delay(50); // Simulate network delay
    return HttpResponse.json({
      coins: {
        'ethereum:0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84': {
          symbol: 'stETH',
          price: 2850.50,
          decimals: 18,
          timestamp: Date.now() / 1000,
        },
        'ethereum:0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599': {
          symbol: 'WBTC',
          price: 65000.00,
          decimals: 8,
          timestamp: Date.now() / 1000,
        },
        'ethereum:0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': {
          symbol: 'WETH',
          price: 2850.00,
          decimals: 18,
          timestamp: Date.now() / 1000,
        },
        'ethereum:0x514910771AF9Ca656af840dff83E8264EcF986CA': {
          symbol: 'LINK',
          price: 18.50,
          decimals: 18,
          timestamp: Date.now() / 1000,
        },
      },
    });
  }),

  // CoinGecko API for MOR token
  http.get('https://api.coingecko.com/api/v3/simple/price', async ({ request }) => {
    const url = new URL(request.url);
    const ids = url.searchParams.get('ids');

    await delay(50);

    if (ids?.includes('morpheus')) {
      return HttpResponse.json({
        morpheus: {
          usd: 25.50,
        },
      });
    }

    return HttpResponse.json({});
  }),
];

// ============================================================================
// DUNE ANALYTICS HANDLERS
// ============================================================================

const duneHandlers = [
  // Active stakers mainnet
  http.get('*/api/dune/active-stakers-mainnet', async () => {
    await delay(50);
    return HttpResponse.json({
      activeStakers: 15420,
      lastUpdated: new Date().toISOString(),
    });
  }),

  // Active stakers testnet
  http.get('*/api/dune/active-stakers-testnet', async () => {
    await delay(50);
    return HttpResponse.json({
      activeStakers: 850,
      lastUpdated: new Date().toISOString(),
    });
  }),

  // Cumulative deposits
  http.get('*/api/dune/cumulative-deposits', async () => {
    await delay(50);
    return HttpResponse.json({
      deposits: [
        { date: '2024-01-01', amount: 1000000 },
        { date: '2024-02-01', amount: 2500000 },
        { date: '2024-03-01', amount: 4200000 },
        { date: '2024-04-01', amount: 6800000 },
        { date: '2024-05-01', amount: 9500000 },
      ],
      lastUpdated: new Date().toISOString(),
    });
  }),
];

// ============================================================================
// BUILDERS API HANDLERS
// ============================================================================

const buildersHandlers = [
  // Get all builders
  http.get('*/api/builders', async () => {
    await delay(50);
    return HttpResponse.json({
      builders: [
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
      ],
    });
  }),

  // Get builder by slug
  http.get('*/api/builders/:slug', async ({ params }) => {
    await delay(50);
    const { slug } = params;

    return HttpResponse.json({
      id: 'builder-1',
      name: 'Test Builder 1',
      slug,
      description: 'A test builder for testing',
      totalStaked: '1000000000000000000000',
      minimalDeposit: '100000000000000000',
      network: 'arbitrum',
      projectId: '0x1234567890123456789012345678901234567890',
    });
  }),
];

// ============================================================================
// GOLDSKY GRAPHQL HANDLERS
// ============================================================================

const goldskyHandlers = [
  // Goldsky GraphQL endpoint
  http.post('https://api.goldsky.com/api/public/*', async ({ request }) => {
    await delay(50);

    const body = await request.json() as { query?: string };
    const query = body?.query || '';

    // Check for specific query types
    if (query.includes('buildersProjects')) {
      return HttpResponse.json({
        data: {
          buildersProjects: [
            {
              id: '0x1234567890123456789012345678901234567890',
              name: 'Test Project',
              totalStaked: '1000000000000000000000',
              minimalDeposit: '100000000000000000',
              startsAt: '1704067200',
              endsAt: '1735689600',
            },
          ],
        },
      });
    }

    if (query.includes('buildersUsers')) {
      return HttpResponse.json({
        data: {
          buildersUsers: [
            {
              id: '0xuser1-0xproject1',
              staked: '500000000000000000000',
              user: '0x1111111111111111111111111111111111111111',
              project: '0x1234567890123456789012345678901234567890',
            },
          ],
        },
      });
    }

    return HttpResponse.json({ data: {} });
  }),
];

// ============================================================================
// SUPABASE HANDLERS
// ============================================================================

const supabaseHandlers = [
  http.get('https://test.supabase.co/rest/v1/*', async () => {
    await delay(50);
    return HttpResponse.json([]);
  }),

  http.post('https://test.supabase.co/rest/v1/*', async () => {
    await delay(50);
    return HttpResponse.json({ success: true });
  }),
];

// ============================================================================
// RPC HANDLERS (For Safe Wallet Detection)
// ============================================================================

const rpcHandlers = [
  // Alchemy RPC endpoint
  http.post('https://eth-mainnet.g.alchemy.com/v2/*', async ({ request }) => {
    const body = await request.json() as { method?: string; params?: unknown[] };

    // Handle eth_getCode for Safe wallet detection
    if (body.method === 'eth_getCode') {
      // Return empty code for regular wallets
      return HttpResponse.json({
        jsonrpc: '2.0',
        id: 1,
        result: '0x',
      });
    }

    // Handle other RPC methods
    return HttpResponse.json({
      jsonrpc: '2.0',
      id: 1,
      result: null,
    });
  }),
];

// ============================================================================
// TOKEN PRICES API HANDLER
// ============================================================================

const tokenPricesApiHandler = [
  http.get('*/api/token-prices', async () => {
    await delay(50);
    return HttpResponse.json({
      prices: {
        stETH: 2850.50,
        wBTC: 65000.00,
        wETH: 2850.00,
        LINK: 18.50,
        MOR: 25.50,
        USDC: 1.00,
        USDT: 1.00,
      },
      cacheAge: 0,
      lastUpdated: new Date().toISOString(),
    });
  }),
];

// ============================================================================
// DAILY EMISSIONS HANDLER
// ============================================================================

const dailyEmissionsHandler = [
  http.get('*/api/daily-emissions', async () => {
    await delay(50);
    return HttpResponse.json({
      emissions: {
        stETH: 1250.5,
        LINK: 850.25,
        wBTC: 450.75,
        wETH: 650.00,
        USDC: 200.00,
        USDT: 150.00,
      },
      totalDaily: 3551.50,
      lastUpdated: new Date().toISOString(),
    });
  }),
];

// ============================================================================
// MORLORD API HANDLER
// ============================================================================

const morlordHandler = [
  http.get('*/api/morlord', async () => {
    await delay(50);
    return HttpResponse.json({
      builders: [],
      lastUpdated: new Date().toISOString(),
    });
  }),
];

// ============================================================================
// EXPORT ALL HANDLERS
// ============================================================================

export const handlers = [
  ...tokenPriceHandlers,
  ...duneHandlers,
  ...buildersHandlers,
  ...goldskyHandlers,
  ...supabaseHandlers,
  ...rpcHandlers,
  ...tokenPricesApiHandler,
  ...dailyEmissionsHandler,
  ...morlordHandler,
];
