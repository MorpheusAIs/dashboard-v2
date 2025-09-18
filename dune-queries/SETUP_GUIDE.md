# 🚀 **Dune API Integration Setup Guide**

## 📦 **1. Install Dune Client SDK**

Run this command to install the Dune Analytics client:

```bash
pnpm add @duneanalytics/client-sdk
```

## 🔑 **2. Get Your Dune API Key**

1. Go to [Dune Analytics](https://dune.com/settings/api)
2. Sign in and navigate to **Settings → API Keys**
3. Create a new API key
4. Copy the API key

## ⚙️ **3. Add Environment Variable**

Add your Dune API key to your `.env.local` file:

```env
DUNE_API_KEY=your_actual_api_key_here
```

## 📝 **4. Save Your Query in Dune**

1. Go to [Dune Analytics](https://dune.com/)
2. Create a new query
3. Copy and paste the content from `production-active-stakers.sql`
4. Save the query
5. Note the **Query ID** from the URL (e.g., if URL is `https://dune.com/queries/5650752`, then ID is `5650752`)

## 🔧 **5. Update the API Route**

In `app/api/dune/active-stakers-testnet/route.ts`, update the query ID:

```typescript
const queryId = YOUR_ACTUAL_QUERY_ID; // Replace with your query ID from step 4
```

## 🧪 **6. Test the Integration**

### Test the API route directly:
```bash
curl http://localhost:3000/api/dune/active-stakers-testnet
```

Expected response:
```json
{
  "success": true,
  "active_stakers": 12,
  "network": "testnet",
  "timestamp": "2025-01-23T..."
}
```

### Test in your frontend:
1. Switch to Sepolia testnet in your wallet
2. Go to the capital page
3. Check the "Active Stakers" metric in the chart section
4. It should show "12" instead of "N/A"

## 🌍 **7. Network Behavior**

- **Sepolia Testnet**: Shows real data from Dune (e.g., "12")
- **Arbitrum Sepolia**: Shows real data from Dune (e.g., "12")  
- **Mainnet/Arbitrum/Base**: Shows "N/A" (no mainnet query yet)

## 🚨 **8. Troubleshooting**

### If you get "Error" in the UI:
1. Check browser console for error messages
2. Check your `.env.local` has the correct API key
3. Verify your query ID is correct
4. Test the API route directly

### If you get "..." (loading forever):
1. Check if the Dune query is public and saved
2. Verify your API key has permissions
3. Check network tab in browser for failed requests

### Common errors:
```typescript
// ❌ Wrong query ID
const queryId = 123456; // Make sure this matches your saved query

// ❌ Missing API key
DUNE_API_KEY= // Make sure you have a value here

// ❌ Private query
// Make sure your Dune query is public or accessible with your API key
```

## ✅ **9. Success!**

Once everything is set up correctly, you'll see:
- **Loading state**: "..." while fetching data
- **Success state**: "12" (or whatever your actual count is)
- **Error state**: "Error" if something goes wrong
- **Mainnet**: "N/A" as expected

Your active stakers metric is now powered by real blockchain data! 🎉
