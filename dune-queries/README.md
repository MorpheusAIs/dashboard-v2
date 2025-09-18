# Dune Analytics Queries for Morpheus Capital Active Stakers

This directory contains Dune Analytics queries to track unique active stakers across the Morpheus Capital deposit pools (stETH and LINK).

## 📊 Query Files

### 1. `active-stakers.sql` - Combined Query ⭐
**Best for: Single API call, overall metrics**
- Gets unique active stakers across **both** stETH and LINK pools
- Provides breakdown by pool type
- Handles users staking in multiple pools (counts as 1 unique staker)
- Returns: `total_active_stakers`, `steth_active_stakers`, `link_active_stakers`

### 2. `steth-active-stakers.sql` - stETH Pool Only
**Best for: Pool-specific analysis**
- Detailed analysis of stETH pool stakers
- Includes stake distribution analysis
- Activity metrics and recent user counts
- Returns: `active_stakers_count`, `total_steth_staked`, distribution data

### 3. `link-active-stakers.sql` - LINK Pool Only
**Best for: Pool-specific analysis**
- Detailed analysis of LINK pool stakers  
- Includes stake distribution analysis
- Activity metrics and recent user counts
- Returns: `active_stakers_count`, `total_link_staked`, distribution data

## 🔧 Setup & Usage

### Step 1: Create Dune Queries

1. Go to [Dune Analytics](https://dune.com)
2. Create a new query for each SQL file
3. Copy-paste the SQL content
4. Update contract addresses if needed:
   ```sql
   -- Sepolia Testnet (current)
   stETH: '0xFea33A23F97d785236F22693eDca564782ae98d0'
   LINK:  '0x7f4f17be21219D7DA4C8E0d0B9be6a778354E5A5'
   
   -- Mainnet (when deployed)
   stETH: '0x...' -- Update when mainnet contracts deployed
   LINK:  '0x...' -- Update when mainnet contracts deployed
   ```

### Step 2: Get Query IDs

After creating queries, note down the Query IDs:
```
Combined Query ID:    1234567  (replace with actual)
stETH Query ID:       2345678  (replace with actual)  
LINK Query ID:        3456789  (replace with actual)
```

### Step 3: API Integration

#### Option A: Use Dune API (Recommended)

```typescript
// utils/duneApi.ts
const DUNE_API_KEY = process.env.DUNE_API_KEY;
const DUNE_BASE_URL = 'https://api.dune.com/api/v1';

export async function getDuneQueryResult(queryId: number) {
  try {
    // Execute query
    const executeResponse = await fetch(
      `${DUNE_BASE_URL}/query/${queryId}/execute`,
      {
        method: 'POST',
        headers: {
          'X-Dune-API-Key': DUNE_API_KEY!,
          'Content-Type': 'application/json',
        },
      }
    );
    
    const { execution_id } = await executeResponse.json();
    
    // Poll for results
    let attempts = 0;
    const maxAttempts = 20;
    
    while (attempts < maxAttempts) {
      const resultResponse = await fetch(
        `${DUNE_BASE_URL}/execution/${execution_id}/results`,
        {
          headers: {
            'X-Dune-API-Key': DUNE_API_KEY!,
          },
        }
      );
      
      const result = await resultResponse.json();
      
      if (result.state === 'QUERY_STATE_COMPLETED') {
        return result.result.rows[0]; // Return first row of results
      }
      
      if (result.state === 'QUERY_STATE_FAILED') {
        throw new Error('Dune query failed');
      }
      
      // Wait 2 seconds before next attempt
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }
    
    throw new Error('Dune query timeout');
  } catch (error) {
    console.error('Dune API error:', error);
    throw error;
  }
}

// Get active stakers count
export async function getActiveStakersCount() {
  const COMBINED_QUERY_ID = 1234567; // Replace with actual query ID
  const result = await getDuneQueryResult(COMBINED_QUERY_ID);
  
  return {
    totalActiveStakers: result.total_active_stakers,
    stethActiveStakers: result.steth_active_stakers,
    linkActiveStakers: result.link_active_stakers,
    multiPoolStakers: result.multi_pool_stakers,
  };
}
```

#### Option B: Direct API Route

```typescript
// pages/api/active-stakers.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getActiveStakersCount } from '@/utils/duneApi';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const data = await getActiveStakersCount();
    
    res.status(200).json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching active stakers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch active stakers count',
    });
  }
}
```

### Step 4: Update useCapitalMetrics Hook

```typescript
// app/hooks/useCapitalMetrics.ts
import { useState, useEffect } from 'react';

export function useCapitalMetrics(): CapitalMetrics {
  const [activeStakers, setActiveStakers] = useState<string>("Loading...");
  const [isLoadingStakers, setIsLoadingStakers] = useState(true);

  // ... existing code ...

  // Fetch active stakers from Dune
  useEffect(() => {
    async function fetchActiveStakers() {
      try {
        const response = await fetch('/api/active-stakers');
        const result = await response.json();
        
        if (result.success) {
          setActiveStakers(result.data.totalActiveStakers.toString());
        } else {
          setActiveStakers("Error");
        }
      } catch (error) {
        console.error('Error fetching active stakers:', error);
        setActiveStakers("N/A");
      } finally {
        setIsLoadingStakers(false);
      }
    }

    fetchActiveStakers();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchActiveStakers, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return {
    // ... existing metrics ...
    activeStakers: isLoadingStakers ? "Loading..." : activeStakers,
    isLoading: isLoading || isLoadingStakers,
    error: error || (activeStakers === "Error" ? "Failed to load stakers" : null),
  };
}
```

## 🎯 Query Logic Explained

### What is an "Active Staker"?
An active staker is a user who currently has a **positive balance** in any deposit pool.

### How We Calculate Net Balance:
```sql
net_balance = SUM(UserStaked amounts) - SUM(UserWithdrawn amounts)
```

### Event Signatures Used:
- **UserStaked**: `0x9e71bc8eea02a63969f509818f2dafb9254532904319f9dbda79b67bd34a5f3d`
- **UserWithdrawn**: `0xf279e6a1f5e320cca91135676d9cb6e44ca8a08c0b88342bcdb1144f6511b568`

### Handling Multi-Pool Users:
- **Combined Query**: Counts users staking in both pools as **1 unique staker**
- **Individual Queries**: Count pool-specific stakers separately
- **Sum Approach**: `stETH_count + LINK_count` may double-count multi-pool users

## 🔄 Refresh Strategy

### Development:
- **Manual Refresh**: Run queries manually in Dune dashboard
- **API Calls**: Every time metrics are needed (with caching)

### Production:
- **Scheduled Refresh**: Every 5-10 minutes via cron job
- **Cache Results**: Store in Redis/database for fast frontend access
- **Fallback**: Show "N/A" if Dune API is unavailable

## 💡 Performance Optimization

### Query Optimization:
- **Date Filtering**: Adjust start date to reduce query time
- **Indexing**: Queries use indexed topics for efficiency
- **Result Caching**: Cache results for 5+ minutes

### Cost Management:
- **Dune Credits**: Each query execution costs credits
- **Batching**: Combine multiple metrics in single query when possible
- **Caching**: Reduce API calls by caching results

## 🚨 Important Notes

1. **Network Selection**: Queries are set for **Ethereum Mainnet** (`ethereum.logs`)
   - For Sepolia: Use `ethereum_sepolia.logs` (if available)
   - For other networks: Adjust table name accordingly

2. **Contract Addresses**: Update addresses when mainnet contracts are deployed

3. **Event Signatures**: Verify event signatures match your ABI if queries return no results

4. **Date Range**: Adjust start date (`2024-01-01`) based on actual deployment date

5. **Error Handling**: Always implement fallbacks in case Dune API is down

## 🎯 Expected Results

For the Morpheus Capital pools, you should expect:
- **Initial Phase**: 10-100 active stakers
- **Growth Phase**: 100-1000 active stakers  
- **Mature Phase**: 1000+ active stakers

The queries will provide real-time accurate counts to replace the "N/A" placeholder in your dashboard! 🚀
