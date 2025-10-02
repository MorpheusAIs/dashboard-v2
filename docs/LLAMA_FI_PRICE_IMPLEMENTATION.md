# Llama.fi Price Implementation

## Overview

This document describes the implementation of token price fetching using Llama.fi API instead of CoinGecko/CoinMarketCap for stETH, wBTC, and wETH.

## Architecture

### Components

1. **Price Cache API** (`/api/token-prices`)
   - Serves cached token prices from an in-memory store
   - Auto-refreshes stale data (older than 10 minutes)
   - Returns prices for: stETH, wBTC, wETH

2. **Cron Job** (`/api/cron/update-prices`)
   - Runs every 5 minutes via Vercel Cron Jobs
   - Fetches fresh prices from Llama.fi
   - Updates the in-memory cache

3. **Token Price Service** (`app/services/token-price.service.ts`)
   - Updated to fetch stETH, wBTC, wETH from `/api/token-prices` first
   - Falls back to CoinGecko/Coinbase if Llama.fi fails
   - Other tokens continue using existing CoinGecko/Coinbase logic

### Data Flow

```
┌─────────────────┐
│  Vercel Cron    │  Every 5 minutes
│  (scheduled)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ /api/cron/      │  Fetches from Llama.fi
│ update-prices   │  Updates cache
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  In-Memory      │  Stores: stETH, wBTC, wETH
│  Price Cache    │  + lastUpdated timestamp
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ /api/           │  Serves cached prices
│ token-prices    │  to frontend
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Frontend       │  TanStack Query
│  Components     │  Fetches prices
└─────────────────┘
```

## Llama.fi API Details

### Endpoint
```
https://coins.llama.fi/prices/current/ethereum:0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84,ethereum:0x2260fac5e5542a773aa44fbcfedf7c193bc2c599,ethereum:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2
```

### Token Addresses (direct in URL)
- **stETH**: `ethereum:0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84`
- **wBTC**: `ethereum:0x2260fac5e5542a773aa44fbcfedf7c193bc2c599`
- **wETH**: `ethereum:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2`

### Price Source Priority
- **stETH, wBTC, wETH**: DefiLlama ONLY (cached API with 3-retry mechanism)
- **USDC, USDT**: Hardcoded $1.00 (stablecoins)
- **All other tokens**: null (not supported)

### Response Format
```json
{
  "coins": {
    "ethereum:0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84": {
      "decimals": 18,
      "symbol": "stETH",
      "price": 4447.932242468375,
      "timestamp": 1759421477,
      "confidence": 0.99
    },
    "ethereum:0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": {
      "decimals": 8,
      "symbol": "WBTC",
      "price": 119947.1132102704,
      "timestamp": 1759422426,
      "confidence": 0.99
    },
    "ethereum:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": {
      "decimals": 18,
      "symbol": "WETH",
      "price": 4459.403618211898,
      "timestamp": 1759422145,
      "confidence": 0.99
    }
  }
}
```

## Configuration

### Vercel Cron Jobs

Configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/update-prices",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**Schedule**: `*/5 * * * *` (every 5 minutes)
**Location**: `vercel.json` in project root

### Optional: Cron Secret

For production security, you can add a `CRON_SECRET` environment variable:

1. Add to Vercel Environment Variables:
   ```
   CRON_SECRET=your-random-secret-here
   ```

2. Configure Vercel Cron to include the secret:
   - Go to Vercel Dashboard → Project → Settings → Cron Jobs
   - The authorization header will be automatically set

The cron endpoint will verify this secret before executing.

## Benefits

### ✅ Advantages Over Previous Implementation

1. **Simpler Architecture**
   - No external database needed (Supabase)
   - No websocket connections to manage
   - Uses built-in Next.js and Vercel features

2. **Better Performance**
   - Cached prices served instantly
   - No client-side API calls to external services
   - Reduced rate limit issues with CoinGecko

3. **More Reliable**
   - Fallback to CoinGecko/Coinbase if Llama.fi fails
   - Stale cache served if cron job fails temporarily
   - Multiple layers of redundancy

4. **Cost Effective**
   - No additional infrastructure costs
   - Vercel Cron Jobs included in hosting
   - Reduced API calls to external services

5. **Easy to Maintain**
   - Simple in-memory cache
   - Clear data flow
   - Easy to debug with console logs

## Frontend Integration

No changes needed! The existing `useTokenPrices` hook and `getTokenPrice` service function work exactly as before. The only difference is:

- **stETH, wBTC, wETH**: Fetched from `/api/token-prices` (Llama.fi cache)
- **Other tokens**: Continue using CoinGecko/Coinbase

Example usage in components:

```tsx
import { getTokenPrice } from '@/app/services/token-price.service';

// This will automatically use Llama.fi for stETH
const stETHPrice = await getTokenPrice('staked-ether', 'usd');

// This will automatically use Llama.fi for wBTC
const wBTCPrice = await getTokenPrice('wrapped-bitcoin', 'usd');

// This will use CoinGecko/Coinbase (not affected)
const linkPrice = await getTokenPrice('chainlink', 'usd');
```

## Testing

### 1. Test the Price Cache API

```bash
curl http://localhost:3000/api/token-prices
```

Expected response:
```json
{
  "prices": {
    "stETH": 2456.78,
    "wBTC": 45678.90,
    "wETH": 2450.00
  },
  "lastUpdated": 1759420817000,
  "cacheAge": 45000,
  "source": "llama.fi"
}
```

### 2. Test the Cron Job (Local)

```bash
curl http://localhost:3000/api/cron/update-prices
```

Expected response:
```json
{
  "success": true,
  "message": "Token prices updated successfully",
  "timestamp": "2025-10-02T12:00:00.000Z"
}
```

### 3. Test in Production

After deploying to Vercel:

1. Check cron job logs in Vercel Dashboard
2. Verify prices are updating every 5 minutes
3. Monitor for any errors in the logs

## Monitoring

### Console Logs

The implementation includes detailed logging:

- `🦙` Llama.fi API calls
- `✅` Successful price fetches
- `⚠️` Warnings and fallbacks
- `❌` Errors

### Key Metrics to Monitor

1. **Cache Hit Rate**: How often the cache serves valid data
2. **Llama.fi Success Rate**: How often Llama.fi API succeeds
3. **Fallback Usage**: How often CoinGecko/Coinbase fallbacks are used
4. **Cache Staleness**: How long prices take to update

## Future Improvements

1. **Persistent Cache**: Move to Vercel KV or Redis for multi-instance support
2. **More Tokens**: Add more tokens to Llama.fi API
3. **Historical Data**: Store price history for charts
4. **Alerting**: Set up alerts for price fetch failures
5. **Rate Limiting**: Add rate limiting to the price API endpoint

## Troubleshooting

### Problem: Prices not updating

**Check**:
1. Vercel cron job is configured correctly
2. Cron job logs show successful execution
3. API endpoint returns fresh data

**Solution**: Manually trigger the cron endpoint to refresh

### Problem: Old prices being served

**Check**:
1. `lastUpdated` timestamp in API response
2. `cacheAge` in API response

**Solution**: The cache auto-refreshes when older than 10 minutes. If needed, restart the Vercel deployment.

### Problem: Cron job failing

**Check**:
1. Llama.fi API is accessible
2. Network connectivity
3. Environment variables are set correctly

**Solution**: Fallback mechanisms will use CoinGecko/Coinbase automatically

## Related Files

- `/app/api/token-prices/route.ts` - Price cache API
- `/app/api/cron/update-prices/route.ts` - Cron job endpoint
- `/app/services/token-price.service.ts` - Token price service
- `/vercel.json` - Cron job configuration
- `/components/capital/hooks/use-token-prices.ts` - Frontend hook

