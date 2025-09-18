# Quick Start: Dune Analytics for Active Stakers

## 🚀 5-Minute Setup Guide

### Step 1: Create Dune Account & Queries

1. **Sign up** at [dune.com](https://dune.com) (free account works)
2. **Create 3 new queries** and copy-paste the SQL from:
   - `active-stakers.sql` → Get Query ID (e.g., 1234567)
   - `steth-active-stakers.sql` → Get Query ID (e.g., 2345678) 
   - `link-active-stakers.sql` → Get Query ID (e.g., 3456789)

### Step 2: Test Queries

Run each query in Dune to verify they work:
- Should return staker counts (may be 0 initially)
- Check for any SQL errors and fix if needed

### Step 3: Get API Key (Optional for Production)

- Go to [dune.com/settings/api](https://dune.com/settings/api)
- Create API key for automated queries
- Free tier: 100 queries/month, 1 query/minute

### Step 4: Add Environment Variables

Add to your `.env.local`:
```bash
# Dune Analytics
DUNE_API_KEY=your_api_key_here
DUNE_COMBINED_QUERY_ID=1234567  # Replace with actual IDs
DUNE_STETH_QUERY_ID=2345678
DUNE_LINK_QUERY_ID=3456789
```

### Step 5: Quick Integration Test

Create a simple API route to test:

```typescript
// pages/api/test-dune.ts
export default async function handler(req, res) {
  try {
    // Simple fetch without API key (public query)
    const response = await fetch(
      `https://api.dune.com/api/v1/query/YOUR_QUERY_ID/results`
    );
    const data = await response.json();
    
    res.json({
      success: true,
      activeStakers: data.result?.rows?.[0]?.total_active_stakers || 0
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
}
```

Test: `http://localhost:3001/api/test-dune`

## ✅ Expected Results

### Development Phase:
- **Active Stakers**: 0-10 (testing with team wallets)
- **Response Time**: 2-10 seconds (Dune query execution)

### Production Phase:
- **Active Stakers**: 100+ (real users staking)
- **Response Time**: 2-5 seconds (cached results)

## 🔧 Integration with Existing Code

Replace the "N/A" activeStakers in `useCapitalMetrics.ts`:

```typescript
// Before
const activeStakers = "N/A";

// After  
const [activeStakers, setActiveStakers] = useState("Loading...");

useEffect(() => {
  async function fetchStakers() {
    try {
      const response = await fetch('/api/test-dune');
      const data = await response.json();
      setActiveStakers(data.success ? data.activeStakers.toString() : "Error");
    } catch {
      setActiveStakers("N/A");
    }
  }
  
  fetchStakers();
  setInterval(fetchStakers, 5 * 60 * 1000); // Refresh every 5 minutes
}, []);
```

## 🎯 Success Metrics

You'll know it's working when:
- ✅ Chart section shows real numbers instead of "N/A"
- ✅ Numbers update when users stake/unstake
- ✅ API responses are fast (< 10 seconds)
- ✅ Data matches your expectations

## 🚨 Troubleshooting

### "No results" or "0 stakers"
- Check contract addresses in SQL match your deployed contracts
- Verify events exist: search contract on Etherscan for UserStaked events
- Confirm start date in query is after contract deployment

### "Query failed" errors  
- Check SQL syntax in Dune editor
- Verify event signatures match your contract ABI
- Try simplifying query to debug

### "API timeout" errors
- Use API key for faster execution
- Cache results in your backend
- Add error handling and fallbacks

## 💡 Pro Tips

1. **Start Simple**: Use the combined query first, add individual pool queries later
2. **Cache Results**: Store results for 5+ minutes to avoid rate limits  
3. **Add Fallbacks**: Show "N/A" if Dune is down, don't break the UI
4. **Monitor Usage**: Track Dune API usage to avoid hitting limits
5. **Test Locally**: Use Dune web interface to debug queries before API integration

## 🎉 You're Done!

Once set up, your dashboard will show **real active staker counts** instead of placeholder "N/A" values. This gives users confidence in the platform's adoption and growth! 🚀

---

**Need help?** Check the full `README.md` for detailed documentation and advanced features.
