// Only using DefiLlama for cached tokens (stETH, wBTC, wETH)
// No mapping for other assets - they will return null

// Tokens that are fetched from our DefiLlama API (updated via cron job)
const DEFILLAMA_CACHED_TOKENS = new Set(['staked-ether', 'wrapped-bitcoin', 'weth']);
const DEFILLAMA_SYMBOL_MAP: Record<string, 'stETH' | 'wBTC' | 'wETH'> = {
  'staked-ether': 'stETH',
  'wrapped-bitcoin': 'wBTC',
  'weth': 'wETH',
};


/**
 * Fetches price from our DefiLlama cache API (stETH, wBTC, wETH only)
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
 * ONLY supports: stETH, wBTC, wETH (via cached API updated every 5 minutes).
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
