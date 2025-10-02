import { NextResponse } from 'next/server';

// In-memory cache for token prices
let priceCache: {
  stETH: number | null;
  wBTC: number | null;
  wETH: number | null;
  lastUpdated: number;
} = {
  stETH: null,
  wBTC: null,
  wETH: null,
  lastUpdated: 0,
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/token-prices
 * Returns cached token prices from Llama.fi
 */
export async function GET() {
  try {
    // If cache is empty or very old (older than 10 minutes), fetch fresh data
    const cacheAge = Date.now() - priceCache.lastUpdated;
    const CACHE_MAX_AGE = 10 * 60 * 1000; // 10 minutes

    if (cacheAge > CACHE_MAX_AGE || !priceCache.stETH) {
      console.log('⚠️ Price cache is stale or empty, fetching fresh data...');
      await updatePriceCache();
    }

    return NextResponse.json({
      prices: {
        stETH: priceCache.stETH,
        wBTC: priceCache.wBTC,
        wETH: priceCache.wETH,
      },
      lastUpdated: priceCache.lastUpdated,
      cacheAge: Date.now() - priceCache.lastUpdated,
      source: 'llama.fi',
    });
  } catch (error) {
    console.error('Error serving token prices:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to fetch token prices',
        details: error instanceof Error ? error.message : 'Unknown error',
        prices: priceCache, // Return cached data even if stale
      },
      { status: 500 }
    );
  }
}

/**
 * Updates the price cache by fetching from DefiLlama with retry mechanism
 * This function is called by the cron job and as a fallback
 */
export async function updatePriceCache(): Promise<void> {
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 DefiLlama cache update attempt ${attempt}/${maxRetries}...`);

      // DefiLlama API endpoint for stETH, wBTC, and wETH - using addresses directly in URL
      const defillamaUrl = new URL('https://coins.llama.fi/prices/current/ethereum:0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84,ethereum:0x2260fac5e5542a773aa44fbcfedf7c193bc2c599,ethereum:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2');

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

      const stETHData = data.coins['ethereum:0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84'];
      const wBTCData = data.coins['ethereum:0x2260fac5e5542a773aa44fbcfedf7c193bc2c599'];
      const wETHData = data.coins['ethereum:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'];

      priceCache = {
        stETH: stETHData?.price ?? null,
        wBTC: wBTCData?.price ?? null,
        wETH: wETHData?.price ?? null,
        lastUpdated: Date.now(),
      };

      console.log('✅ Token prices updated:', {
        stETH: priceCache.stETH,
        wBTC: priceCache.wBTC,
        wETH: priceCache.wETH,
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

