import { NextRequest, NextResponse } from 'next/server';

interface CoinbasePriceResponse {
  data: {
    amount: string;
    base: string;
    currency: string;
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol')?.toUpperCase();
    
    // Map our asset symbols to Coinbase symbols
    const coinbaseSymbolMap: Record<string, string> = {
      'STETH': 'ETH', // stETH tracks ETH price closely
      'ETH': 'ETH',
      'WETH': 'ETH', // Wrapped ETH is same as ETH
      'BTC': 'BTC',
      'WBTC': 'BTC', // Wrapped BTC is same as BTC
      'USDC': 'USDC',
      'USDT': 'USDT'
    };

    if (!symbol || !coinbaseSymbolMap[symbol]) {
      return NextResponse.json(
        { error: 'Invalid or unsupported symbol. Supported: stETH, ETH, wETH, BTC, wBTC, USDC, USDT' },
        { status: 400 }
      );
    }

    const coinbaseSymbol = coinbaseSymbolMap[symbol];
    const url = `https://api.coinbase.com/v2/prices/${coinbaseSymbol}-USD/spot`;

    console.log(`💰 Fetching ${symbol} price from Coinbase API: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Morpheus-Dashboard/1.0'
      },
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`Coinbase API responded with status: ${response.status}`);
    }

    const data: CoinbasePriceResponse = await response.json();
    
    const price = parseFloat(data.data.amount);
    
    if (isNaN(price) || price <= 0) {
      throw new Error(`Invalid price data: ${data.data.amount}`);
    }

    console.log(`✅ ${symbol} price from Coinbase: $${price}`);

    return NextResponse.json({
      symbol: symbol,
      price: price,
      source: 'coinbase',
      timestamp: Date.now(),
      raw: data.data
    });

  } catch (error) {
    console.error('Error fetching price from Coinbase:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch price from Coinbase API',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
