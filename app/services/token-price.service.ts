const COINGECKO_API_URL = "https://api.coingecko.com/api/v3/simple/price";

// Map CoinGecko IDs to symbol names for Coinbase fallback
const COINGECKO_TO_SYMBOL_MAP: Record<string, string> = {
  'staked-ether': 'STETH',
  'ethereum': 'ETH',
  'weth': 'WETH',
  'bitcoin': 'BTC',
  'wrapped-bitcoin': 'WBTC',
  'usd-coin': 'USDC',
  'tether': 'USDT',
  'chainlink': 'LINK',
  'morpheus-network': 'MOR' // Note: Coinbase doesn't have MOR, will fail gracefully
};

/**
 * Fetches price from our Coinbase API route as a fallback
 * @param symbol The symbol to fetch (e.g., 'STETH', 'ETH')
 * @returns The price from Coinbase or null if failed
 */
async function getCoinbaseFallbackPrice(symbol: string): Promise<number | null> {
  try {
    console.log(`💰 Attempting Coinbase fallback for ${symbol}...`);
    
    const response = await fetch(`/api/coinbase-price?symbol=${symbol}`, {
      headers: {
        'Accept': 'application/json'
      },
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(8000) // 8 second timeout
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn(`Coinbase fallback failed for ${symbol}:`, errorData);
      return null;
    }

    const data = await response.json();
    
    if (typeof data.price === 'number' && data.price > 0) {
      console.log(`✅ Coinbase fallback successful for ${symbol}: $${data.price}`);
      return data.price;
    } else {
      console.warn(`Invalid Coinbase price data for ${symbol}:`, data);
      return null;
    }
    
  } catch (error) {
    console.warn(`Coinbase fallback error for ${symbol}:`, error);
    return null;
  }
}

/**
 * Fetches the current price of a given token with fallback to Coinbase API.
 * First tries CoinGecko, then falls back to Coinbase for supported assets.
 * @param tokenId The ID of the token on CoinGecko (e.g., 'staked-ether').
 * @param vsCurrency The currency to fetch the price in (e.g., 'usd').
 * @param useParallel Whether to fetch from both sources in parallel (default: false)
 * @returns The current price of the token, or null if all sources fail.
 */
export async function getTokenPrice(tokenId: string, vsCurrency: string, useParallel = false): Promise<number | null> {
    const symbol = COINGECKO_TO_SYMBOL_MAP[tokenId];
    
    // If parallel mode is enabled and we have Coinbase support
    if (useParallel && symbol && vsCurrency === 'usd') {
        return getTokenPriceParallel(tokenId, vsCurrency, symbol);
    }
    
    // Sequential mode (default): CoinGecko first, then Coinbase fallback
    // First attempt: CoinGecko API
    try {
        console.log(`💰 Fetching ${tokenId} price from CoinGecko...`);
        
        const response = await fetch(`${COINGECKO_API_URL}?ids=${tokenId}&vs_currencies=${vsCurrency}`, {
          // Add timeout to prevent hanging on CoinGecko
          signal: AbortSignal.timeout(8000) // 8 second timeout
        });
        
        if (!response.ok) {
            console.warn(`CoinGecko API responded with status: ${response.status} ${response.statusText}`);
        } else {
            const data = await response.json();
            
            if (data[tokenId] && data[tokenId][vsCurrency]) {
                const price = data[tokenId][vsCurrency];
                console.log(`✅ CoinGecko price for ${tokenId}: $${price}`);
                return price;
            } else {
                console.warn(`Price data not found for ${tokenId} in ${vsCurrency} on CoinGecko`);
            }
        }
        
    } catch (error) {
        console.warn(`CoinGecko fetch failed for ${tokenId}:`, error);
    }
    
    // Second attempt: Coinbase fallback for supported assets
    if (symbol && vsCurrency === 'usd') {
        console.log(`🔄 CoinGecko failed, trying Coinbase fallback for ${tokenId} (${symbol})...`);
        const fallbackPrice = await getCoinbaseFallbackPrice(symbol);
        
        if (fallbackPrice !== null) {
            return fallbackPrice;
        }
    }
    
    // All sources failed
    console.error(`❌ All price sources failed for ${tokenId} in ${vsCurrency}`);
    return null;
}

/**
 * Fetches price from both CoinGecko and Coinbase in parallel, returning the first successful result.
 * This provides faster response times when one API is slow.
 * @param tokenId The CoinGecko token ID
 * @param vsCurrency The currency (should be 'usd')
 * @param symbol The symbol for Coinbase API
 * @returns The first successful price, or null if both fail
 */
async function getTokenPriceParallel(tokenId: string, vsCurrency: string, symbol: string): Promise<number | null> {
    console.log(`⚡ Fetching ${tokenId} price from both CoinGecko and Coinbase in parallel...`);
    
    // Create promises for both API calls
    const coinGeckoPromise = fetch(`${COINGECKO_API_URL}?ids=${tokenId}&vs_currencies=${vsCurrency}`, {
        signal: AbortSignal.timeout(8000)
    }).then(async (response) => {
        if (!response.ok) throw new Error(`CoinGecko: ${response.status}`);
        const data = await response.json();
        if (data[tokenId] && data[tokenId][vsCurrency]) {
            const price = data[tokenId][vsCurrency];
            console.log(`✅ CoinGecko parallel result for ${tokenId}: $${price}`);
            return { price, source: 'coingecko' };
        }
        throw new Error('CoinGecko: Price not found');
    });
    
    const coinbasePromise = fetch(`/api/coinbase-price?symbol=${symbol}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000)
    }).then(async (response) => {
        if (!response.ok) throw new Error(`Coinbase: ${response.status}`);
        const data = await response.json();
        if (typeof data.price === 'number' && data.price > 0) {
            console.log(`✅ Coinbase parallel result for ${tokenId}: $${data.price}`);
            return { price: data.price, source: 'coinbase' };
        }
        throw new Error('Coinbase: Invalid price data');
    });
    
    try {
        // Wait for the first successful result
        const result = await Promise.any([coinGeckoPromise, coinbasePromise]);
        console.log(`⚡ Parallel fetch winner: ${result.source} ($${result.price})`);
        return result.price;
    } catch (error) {
        console.warn(`Both parallel price fetches failed for ${tokenId}:`, error);
        return null;
    }
} 