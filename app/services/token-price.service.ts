// DefiLlama for stETH, wBTC, wETH, LINK (testnet)
// CoinGecko for MOR token (not available on DefiLlama)
// Stablecoins (USDC, USDT) are hardcoded to $1.00

// DefiLlama token addresses for direct API calls (Ethereum mainnet + LINK)
const DEFILLAMA_TOKEN_ADDRESSES = {
  stETH: 'ethereum:0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
  wBTC: 'ethereum:0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
  wETH: 'ethereum:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  LINK: 'ethereum:0x514910771AF9Ca656af840dff83E8264EcF986CA',
} as const;

// CoinGecko token IDs (for tokens not available on DefiLlama)
const COINGECKO_TOKEN_IDS = {
  MOR: 'morpheusai', // Correct CoinGecko ID for MOR token
} as const;

// Legacy token ID map (kept for backward compatibility)
const DEFILLAMA_CACHED_TOKENS = new Set(['staked-ether', 'wrapped-bitcoin', 'weth', 'chainlink']);
const DEFILLAMA_SYMBOL_MAP: Record<string, 'stETH' | 'wBTC' | 'wETH' | 'LINK'> = {
  'staked-ether': 'stETH',
  'wrapped-bitcoin': 'wBTC',
  'weth': 'wETH',
  'chainlink': 'LINK',
};

// Shared in-memory cache for token prices (solves hook isolation issue)
interface PriceCache {
  stETH: number | null;
  wBTC: number | null;
  wETH: number | null;
  MOR: number | null;
  LINK: number | null;
  lastUpdated: number;
}

// Global shared state - this ensures all hooks use the same data
const sharedPriceCache: PriceCache = {
  stETH: null,
  wBTC: null,
  wETH: null,
  MOR: null,
  LINK: null,
  lastUpdated: 0,
};


// Shared price management functions (simplified approach)
export function getSharedPrices() {
  return sharedPriceCache;
}

export function updateSharedPrices(prices: Partial<Omit<PriceCache, 'lastUpdated'>>) {
  // Create a new object with updated values and timestamp
  Object.assign(sharedPriceCache, prices, { lastUpdated: Date.now() });
}

// Server-side price cache with timestamps (for API routes and cron jobs)
interface ServerPriceCache {
  prices: {
    stETH: number | null;
    wBTC: number | null;
    wETH: number | null;
    MOR: number | null;
    LINK: number | null;
  };
  lastUpdated: number;
  cacheAge: number; // milliseconds since last update
}

// Server-side cache (separate from client-side shared cache)
let serverPriceCache: ServerPriceCache = {
  prices: {
    stETH: null,
    wBTC: null,
    wETH: null,
    MOR: null,
    LINK: null,
  },
  lastUpdated: 0,
  cacheAge: Infinity,
};

// Get server-side price cache (for API routes)
export function getPriceCache(): ServerPriceCache {
  const now = Date.now();
  return {
    ...serverPriceCache,
    cacheAge: now - serverPriceCache.lastUpdated,
  };
}

// Update server-side price cache by fetching from DefiLlama and CoinGecko
export async function updatePriceCache(): Promise<void> {
  try {
    // Fetch from DefiLlama (stETH, wBTC, wETH, LINK)
    const tokenAddresses = Object.values(DEFILLAMA_TOKEN_ADDRESSES).join(',');
    const defiLlamaUrl = `https://coins.llama.fi/prices/current/${tokenAddresses}`;
    
    console.log('🦙 Fetching prices from DefiLlama:', defiLlamaUrl);
    
    const defiLlamaResponse = await fetch(defiLlamaUrl, {
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });
    
    if (!defiLlamaResponse.ok) {
      throw new Error(`DefiLlama API error: ${defiLlamaResponse.status}`);
    }
    
    const defiLlamaData = await defiLlamaResponse.json();
    
    // Fetch from CoinGecko (MOR)
    const coinGeckoUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${COINGECKO_TOKEN_IDS.MOR}&vs_currencies=usd`;
    
    console.log('🦎 Fetching MOR price from CoinGecko:', coinGeckoUrl);
    
    const coinGeckoResponse = await fetch(coinGeckoUrl, {
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });
    
    if (!coinGeckoResponse.ok) {
      console.warn(`CoinGecko API error: ${coinGeckoResponse.status}`);
    }
    
    const coinGeckoData = coinGeckoResponse.ok ? await coinGeckoResponse.json() : null;
    
    // Parse prices from both sources
    const prices = {
      stETH: defiLlamaData.coins[DEFILLAMA_TOKEN_ADDRESSES.stETH]?.price || null,
      wBTC: defiLlamaData.coins[DEFILLAMA_TOKEN_ADDRESSES.wBTC]?.price || null,
      wETH: defiLlamaData.coins[DEFILLAMA_TOKEN_ADDRESSES.wETH]?.price || null,
      LINK: defiLlamaData.coins[DEFILLAMA_TOKEN_ADDRESSES.LINK]?.price || null,
      MOR: coinGeckoData?.[COINGECKO_TOKEN_IDS.MOR]?.usd || null,
    };
    
    // Update server cache
    serverPriceCache = {
      prices,
      lastUpdated: Date.now(),
      cacheAge: 0,
    };
    
    // Also update shared client-side cache
    updateSharedPrices(prices);
    
    console.log('✅ Price cache updated successfully:', prices);
  } catch (error) {
    console.error('❌ Failed to update price cache:', error);
    throw error;
  }
}

// Enhanced getTokenPrice function that uses shared state
export async function getTokenPrice(tokenId: string, vsCurrency: string): Promise<number | null> {
  // Hardcode stablecoin prices to $1.00 (no API calls needed)
  if (vsCurrency === 'usd' && (tokenId === 'usd-coin' || tokenId === 'tether')) {
    console.log(`💰 Using hardcoded price for ${tokenId}: $1.00 (stablecoin)`);
    return 1.0;
  }

  // For MOR token (from CoinGecko via server cache)
  if (vsCurrency === 'usd' && tokenId === 'morpheusai') {
    // Check shared cache first
    const cachedPrice = sharedPriceCache.MOR;
    if (cachedPrice !== null && cachedPrice > 0) {
      console.log(`✅ Using shared cached MOR price: $${cachedPrice}`);
      return cachedPrice;
    }

    // Fallback to API call if not in shared cache
    console.log(`🦎 Fetching MOR price from server cache API...`);
    try {
      const response = await fetch('/api/token-prices', {
        headers: {
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
        cache: 'no-store', // Don't cache on client side
      });

      // Even on non-2xx, the API returns any available cached data in body
      const data = await response.json().catch(() => null);
      if (!response.ok && !data) {
        console.warn(`Server cache API responded with status: ${response.status}`);
        return null;
      }
      const price = data?.prices?.MOR;

      if (typeof price === 'number' && price > 0) {
        console.log(`✅ MOR price from server cache: $${price}`);

        // Update shared cache
        updateSharedPrices({ MOR: price });

        return price;
      } else {
        console.warn(`Invalid MOR price data:`, data);
        return null;
      }
    } catch (error) {
      console.warn(`Server cache fetch error for MOR:`, error);
      return null;
    }
  }

  // For DefiLlama tokens (stETH, wBTC, wETH, LINK)
  if (vsCurrency === 'usd' && DEFILLAMA_CACHED_TOKENS.has(tokenId)) {
    const symbol = DEFILLAMA_SYMBOL_MAP[tokenId];
    if (!symbol) {
      console.log(`❌ Token ${tokenId} not in symbol map`);
      return null;
    }

    // Check shared cache first
    const cachedPrice = sharedPriceCache[symbol as keyof typeof sharedPriceCache];
    if (cachedPrice !== null && cachedPrice > 0) {
      console.log(`✅ Using shared cached price for ${tokenId}: $${cachedPrice}`);
      return cachedPrice;
    }

    // Fallback to API call if not in shared cache
    console.log(`🦙 Fetching ${tokenId} (${symbol}) price from server cache API...`);
    try {
      const response = await fetch('/api/token-prices', {
        headers: {
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
        cache: 'no-store', // Don't cache on client side
      });

      // Even on non-2xx, the API returns any available cached data in body
      const data = await response.json().catch(() => null);
      if (!response.ok && !data) {
        console.warn(`Server cache API responded with status: ${response.status}`);
        return null;
      }
      const price = data?.prices?.[symbol];

      if (typeof price === 'number' && price > 0) {
        console.log(`✅ Cached price for ${tokenId}: $${price}`);

        // Update shared cache
        updateSharedPrices({ [symbol]: price });

        return price;
      } else {
        console.warn(`Invalid price data for ${tokenId}:`, data);
        return null;
      }
    } catch (error) {
      console.warn(`Server cache fetch error for ${tokenId}:`, error);
      return null;
    }
  }

  // For ALL other tokens: return null (not supported)
  console.log(`❌ Token ${tokenId} not supported - only stETH, wBTC, wETH, LINK, MOR supported`);
  return null;
}
