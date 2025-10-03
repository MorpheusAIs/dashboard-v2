# Local Price Testing Guide

## Problem
The frontend shows `---%` for APR because prices are `null`. This happens because:
1. Server-side cache is empty (cron job doesn't run in local dev)
2. Frontend waits for prices before calculating TVL and APR

## Solution: Manual Price Cache Population

### Step 1: Start Your Dev Server
```bash
npm run dev
```

### Step 2: Populate Price Cache (One-Time Setup)
```bash
# Trigger the cron job manually to fetch prices
curl -X GET "http://localhost:3000/api/cron/update-prices"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Token prices updated successfully",
  "timestamp": "2025-10-03T07:35:17.829Z"
}
```

### Step 3: Verify Prices Are Cached
```bash
# Check the cached prices
curl "http://localhost:3000/api/token-prices" | jq '.'
```

**Expected Response:**
```json
{
  "prices": {
    "stETH": 4459.90,
    "wBTC": 119804.30,
    "wETH": 4460.09,
    "LINK": 22.37,
    "MOR": 3.72
  },
  "lastUpdated": 1759476470616,
  "cacheAge": 452868
}
```

✅ **MOR price should be ~$3.72** (correct!)

### Step 4: Refresh Frontend
1. Refresh your browser (Cmd+R or F5)
2. Open DevTools Console
3. Look for these logs:

```
⏳ Waiting for data before calculating metrics: {
  isPriceUpdating: false,
  isLoadingDailyEmissions: false,
  hasRequiredPrices: true,
  prices: { 
    stethPrice: 4459.90, 
    morPrice: 3.72, 
    wbtcPrice: 119804.30, 
    wethPrice: 4460.09 
  }
}
```

When `hasRequiredPrices: true`, the calculations will proceed!

## Data Flow Sequence

Now the correct flow is enforced:

```
1. Fetch Prices (DefiLlama + CoinGecko)
   ↓
2. Wait for hasRequiredPrices = true
   ↓
3. Calculate TVL (using all asset prices)
   ↓
4. Fetch Daily Emissions
   ↓
5. Calculate APR = (emissions * morPrice * 365) / TVL * 100
```

## Troubleshooting

### Issue: Prices still null
**Solution:** Make sure step 2 completed successfully. Check dev server logs for errors.

### Issue: APR still shows ---%
**Check console logs for:**
- `hasRequiredPrices: false` → Prices not loaded yet
- `morPrice: null` → MOR price not fetched
- `currentDailyRewardMOR: 'N/A'` → Daily emissions not fetched

### Issue: Daily Emissions shows N/A
**Solution:** Check that `/api/daily-emissions?networkEnv=mainnet` endpoint works:
```bash
curl "http://localhost:3000/api/daily-emissions?networkEnv=mainnet"
```

## Changes Made

### 1. Cron Endpoint (`app/api/cron/update-prices/route.ts`)
- ✅ Bypasses auth check in development
- ✅ Allows manual triggering locally

### 2. Capital Metrics Hook (`app/hooks/useCapitalMetrics.ts`)
- ✅ Added `hasRequiredPrices` check
- ✅ Waits for stETH and MOR prices before calculating
- ✅ Shows loading state until prices are available
- ✅ Added debug logging for troubleshooting

### 3. Token Price Service (`app/services/token-price.service.ts`)
- ✅ Uses correct MOR token ID: `morpheusai`
- ✅ Fetches from DefiLlama (stETH, wBTC, wETH, LINK)
- ✅ Fetches from CoinGecko (MOR)
- ✅ Server-side caching with `updatePriceCache()`

## Expected Results

After following these steps:
- **MOR Price**: ~$3.72 ✅
- **TVL**: Includes all assets with correct prices ✅
- **Daily Emissions**: Real value from contract ✅
- **APR**: Calculated correctly (not ---%) ✅

## Cache Expiry

The cache expires after **10 minutes**. To refresh prices:
```bash
curl -X GET "http://localhost:3000/api/cron/update-prices"
```

In production, Vercel Cron will automatically refresh every 5 minutes.
