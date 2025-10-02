import { NextRequest, NextResponse } from 'next/server';
import { updatePriceCache } from '../../token-prices/route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Vercel Cron Job endpoint
 * This runs every 5 minutes to update token prices from Llama.fi
 * 
 * Endpoint: /api/cron/update-prices
 * Schedule: Every 5 minutes (configured in vercel.json)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify the request is from Vercel Cron (optional but recommended)
    const authHeader = request.headers.get('authorization');
    
    // In production, verify the cron secret
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.warn('⚠️ Unauthorized cron job request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🕐 Cron job triggered: Updating token prices...');
    
    // Update the price cache
    await updatePriceCache();
    
    return NextResponse.json({
      success: true,
      message: 'Token prices updated successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Cron job failed:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update token prices',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

