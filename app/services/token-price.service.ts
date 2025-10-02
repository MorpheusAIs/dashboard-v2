// Only using DefiLlama for cached tokens (stETH, wBTC, wETH, MOR)
// No mapping for other assets - they will return null

// Tokens that are fetched from our DefiLlama API (updated via cron job)
const DEFILLAMA_CACHED_TOKENS = new Set(['staked-ether', 'wrapped-bitcoin', 'weth', 'morpheus-network']);
const DEFILLAMA_SYMBOL_MAP: Record<string, 'stETH' | 'wBTC' | 'wETH' | 'MOR'> = {
  'staked-ether': 'stETH',
  'wrapped-bitcoin': 'wBTC',
  'weth': 'wETH',
  'morpheus-network': 'MOR',
};

// In-memory cache for token prices
let priceCache: {
  stETH: number | null;
  wBTC: number | null;
  wETH: number | null;
  MOR: number | null;
  lastUpdated: number;
} = {
  stETH: null,
  wBTC: null,
  wETH: null,
  MOR: null,
  lastUpdated: 0,
};

/**
 * Updates the price cache by fetching from DefiLlama with retry mechanism
 * This function is called by the cron job and as a fallback
 */
export async function updatePriceCache(): Promise<void> {
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 DefiLlama cache update attempt ${attempt}/${maxRetries}...`);

      // DefiLlama API endpoint for stETH, wBTC, wETH, and MOR - using addresses directly in URL
      const defillamaUrl = new URL('https://coins.llama.fi/prices/current/ethereum:0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84,ethereum:0x2260fac5e5542a773aa44fbcfedf7c193bc2c599,ethereum:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2,arbitrum:0x092baadb7def4c3981454dd9c0a0e5c4f27ead9083c756cc2');

      const response = await fetch(defillamaUrl.toString(), {
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`DefiLlama API responded with status: ${response.status}`);
      }

      const data = await response.json();

      // Extract prices from the response using the exact addresses (case-sensitive)
      // stETH: ethereum:0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84
      // wBTC: ethereum:0x2260fac5e5542a773aa44fbcfedf7c193bc2c599
      // wETH: ethereum:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2
      // MOR: arbitrum:0x092baadb7def4c3981454dd9c0a0e5c4f27ead9083c756cc2

      const stETHData = data.coins['ethereum:0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84'];
      const wBTCData = data.coins['ethereum:0x2260fac5e5542a773aa44fbcfedf7c193bc2c599'];
      const wETHData = data.coins['ethereum:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'];
      const MORData = data.coins['arbitrum:0x092baadb7def4c3981454dd9c0a0e5c4f27ead9083c756cc2'];

      priceCache = {
        stETH: stETHData?.price ?? null,
        wBTC: wBTCData?.price ?? null,
        wETH: wETHData?.price ?? null,
        MOR: MORData?.price ?? null,
        lastUpdated: Date.now(),
      };

      console.log('✅ Token prices updated:', {
        stETH: priceCache.stETH,
        wBTC: priceCache.wBTC,
        wETH: priceCache.wETH,
        MOR: priceCache.MOR,
      });

      return; // Success, exit the retry loop

    } catch (error) {
      console.warn(`DefiLlama cache update attempt ${attempt}/${maxRetries} failed:`, error);

      // If this is the last attempt, don't retry
      if (attempt === maxRetries) {
        console.error(`❌ All ${maxRetries} DefiLlama cache update attempts failed`);
        throw error;
      }

      // Wait before retrying (exponential backoff: 1s, 2s, 4s...)
      const delayMs = Math.pow(2, attempt - 1) * 1000;
      console.log(`⏳ Waiting ${delayMs}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Gets the current price cache
 */
export function getPriceCache() {
  return {
    prices: {
      stETH: priceCache.stETH,
      wBTC: priceCache.wBTC,
      wETH: priceCache.wETH,
      MOR: priceCache.MOR,
    },
    lastUpdated: priceCache.lastUpdated,
    cacheAge: Date.now() - priceCache.lastUpdated,
    source: 'llama.fi',
  };
}


/**
 * Fetches price from our DefiLlama cache API (stETH, wBTC, wETH, MOR only)
 * @param tokenId The CoinGecko token ID
 * @returns The price from DefiLlama cache or null if failed
 */
async function getDefiLlamaCachedPrice(tokenId: string): Promise<number | null> {
  try {
    const symbol = DEFILLAMA_SYMBOL_MAP[tokenId];
    if (!symbol) return null;

    console.log(`🦙 Fetching ${tokenId} (${symbol}) price from DefiLlama cache API...`);

    const response = await fetch('/api/token-prices', {
      headers: {
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
      cache: 'no-store', // Don't cache on client side
    });

    if (!response.ok) {
      console.warn(`DefiLlama cache API responded with status: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const price = data.prices[symbol];

    if (typeof price === 'number' && price > 0) {
      console.log(`✅ DefiLlama cached price for ${tokenId}: $${price}`);
      return price;
    } else {
      console.warn(`Invalid DefiLlama cached price data for ${tokenId}:`, data);
      return null;
    }

  } catch (error) {
    console.warn(`DefiLlama cache fetch error for ${tokenId}:`, error);
    return null;
  }
}

/**
 * Fetches the current price of a given token using DefiLlama API only.
 * ONLY supports: stETH, wBTC, wETH, MOR (via cached API updated every 5 minutes).
 * For stablecoins (USDC, USDT), returns $1.00 directly without API calls.
 * For ALL other tokens: returns null (no DefiLlama support).
 * @param tokenId The ID of the token on CoinGecko (e.g., 'staked-ether').
 * @param vsCurrency The currency to fetch the price in (e.g., 'usd').
 * @returns The current price of the token, or null if not supported or API fails.
 */
export async function getTokenPrice(tokenId: string, vsCurrency: string): Promise<number | null> {
    // Hardcode stablecoin prices to $1.00 (no API calls needed)
    if (vsCurrency === 'usd' && (tokenId === 'usd-coin' || tokenId === 'tether')) {
        console.log(`💰 Using hardcoded price for ${tokenId}: $1.00 (stablecoin)`);
        return 1.0;
    }

    // For cached tokens (stETH, wBTC, wETH): use our cached DefiLlama API
    if (vsCurrency === 'usd' && DEFILLAMA_CACHED_TOKENS.has(tokenId)) {
        const cachedPrice = await getDefiLlamaCachedPrice(tokenId);
        if (cachedPrice !== null) {
            return cachedPrice;
        }
        // No fallback - return null if cache fails
        console.log(`❌ DefiLlama cache failed for ${tokenId} - no fallback available`);
        return null;
    }

    // For ALL other tokens: return null (not supported)
    console.log(`❌ Token ${tokenId} not supported by DefiLlama - only stETH, wBTC, wETH supported`);
    return null;
}
