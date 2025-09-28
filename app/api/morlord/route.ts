import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('https://morlord.com/data/sma.json', {
      headers: {
        'User-Agent': 'Morpheus Dashboard/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Validate the response structure
    const firstApr = data?.data?.aprs?.[1]?.apr;
    if (typeof firstApr !== 'number') {
      throw new Error('Invalid APR data format');
    }

    return NextResponse.json({
      apr: firstApr,
      success: true
    });
  } catch (error) {
    console.error('Failed to fetch Morlord data:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch data',
        success: false
      },
      { status: 500 }
    );
  }
}
