import { NextResponse } from 'next/server';
import { getPriceCache, updatePriceCache } from '../../services/token-price.service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/token-prices
 * Returns cached token prices from Llama.fi
 */
export async function GET() {
  try {
    const cache = getPriceCache();

    // If cache is empty or very old (older than 10 minutes), fetch fresh data
    const CACHE_MAX_AGE = 10 * 60 * 1000; // 10 minutes

    if (cache.cacheAge > CACHE_MAX_AGE || !cache.prices.stETH) {
      console.log('⚠️ Price cache is stale or empty, fetching fresh data...');
      await updatePriceCache();
      // Get updated cache after refresh
      const updatedCache = getPriceCache();
      return NextResponse.json(updatedCache);
    }

    return NextResponse.json(cache);
  } catch (error) {
    console.error('Error serving token prices:', error);

    const cache = getPriceCache();
    return NextResponse.json(
      {
        error: 'Failed to fetch token prices',
        details: error instanceof Error ? error.message : 'Unknown error',
        ...cache, // Return cached data even if stale
      },
      { status: 500 }
    );
  }
}


