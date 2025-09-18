# 🎉 **INTEGRATION READY: Active Stakers Count**

## ✅ **Success! Your Query Works**

Your corrected Dune query successfully returns **12 unique active stakers** across both stETH and LINK pools.

---

## 📊 **Final Results Breakdown:**

```
total_active_stakers: 12      ← Use this for your dashboard!
steth_active_stakers: 11
link_active_stakers: 9
multi_pool_stakers: 8         ← Users active in both pools
```

---

## 🚀 **Ready for Integration**

### **1. Production Query**
Use `production-active-stakers.sql` - it's the clean, optimized version that returns just the number you need.

### **2. Update Your useCapitalMetrics Hook**

In `app/hooks/useCapitalMetrics.ts`, replace the "N/A" with real data:

```typescript
// Add this function to call your Dune API
const fetchActiveStakersCount = async (): Promise<number> => {
  try {
    // Replace with your Dune API setup
    const response = await fetch('/api/dune/active-stakers');
    const data = await response.json();
    return data.active_stakers || 0;
  } catch (error) {
    console.error('Error fetching active stakers:', error);
    return 0;
  }
};

// In your useCapitalMetrics hook:
const [activeStakers, setActiveStakers] = useState<number>(0);

useEffect(() => {
  fetchActiveStakersCount().then(setActiveStakers);
}, []);

// Update the return object:
const activeStakers = activeStakers > 0 ? activeStakers.toString() : "N/A";
```

### **3. API Route Setup**

Create `pages/api/dune/active-stakers.ts`:

```typescript
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Call Dune API with your query
    const duneResponse = await fetch('https://api.dune.com/api/v1/query/YOUR_QUERY_ID/execute', {
      method: 'POST',
      headers: {
        'X-Dune-API-Key': process.env.DUNE_API_KEY!,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await duneResponse.json();
    
    res.status(200).json({
      active_stakers: result.result?.rows?.[0]?.active_stakers || 0
    });
  } catch (error) {
    console.error('Dune API error:', error);
    res.status(500).json({ active_stakers: 0 });
  }
}
```

---

## 🔧 **Dune API Setup Steps**

### **1. Save Your Query**
1. Go to Dune Analytics
2. Save `production-active-stakers.sql` as a new query
3. Note the query ID from the URL

### **2. Get API Key**
1. Go to Dune Settings → API Keys
2. Create a new API key
3. Add it to your `.env.local`:
   ```
   DUNE_API_KEY=your_api_key_here
   ```

### **3. Test Integration**
1. Run your query manually in Dune → should return `active_stakers: 12`
2. Test your API route → `/api/dune/active-stakers`
3. Check your dashboard → should show "12" instead of "N/A"

---

## 🎯 **Network Switching**

For production, you'll want to:
1. **Mainnet version**: Change `sepolia.logs` → `ethereum.logs`
2. **Update contract addresses** to mainnet versions
3. **Environment switching**:
   ```typescript
   const network = poolData.networkEnvironment === 'mainnet' ? 'ethereum' : 'sepolia';
   ```

---

## ✨ **You're Done!**

Your active stakers metric will now show **real blockchain data** instead of placeholder values. The number will update based on actual user activity in your deposit pools!

**Great work solving the event signature puzzle!** 🎉
