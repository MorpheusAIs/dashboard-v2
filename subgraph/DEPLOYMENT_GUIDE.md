# Quick Deployment Guide

## 🚀 5-Minute Setup

### 1. Deploy to The Graph Studio

```bash
# Install Graph CLI globally
npm install -g @graphprotocol/graph-cli

# Go to subgraph directory
cd subgraph

# Install dependencies
npm install

# Generate code and build
npm run codegen && npm run build

# Go to thegraph.com/studio and create new subgraph "morpheus-capital-claims"
# Copy your deployment key from the studio

# Authenticate
graph auth --studio YOUR_DEPLOY_KEY_HERE

# Deploy
npm run deploy
```

### 2. Test Your Subgraph

After deployment, test these queries in The Graph Studio playground:

**Check if indexing is working:**
```graphql
{
  userClaimEvents(first: 5) {
    id
    user
    amount
    poolType
    blockTimestamp
  }
}
```

**Get a specific user's data:**
```graphql
{
  userGlobalStats(id: "0xYOUR_USER_ADDRESS_LOWERCASE") {
    totalClaimedAmount
    totalClaimCount
    stETHPoolStats {
      totalClaimedAmount
    }
    linkPoolStats {
      totalClaimedAmount
    }
  }
}
```

### 3. Integrate with Frontend

Add to your React app:

```typescript
// Install dependencies first:
// npm install @apollo/client graphql

// In your component:
import { useUserLifetimeClaims } from './path/to/integration-example';

const { lifetimeEarned, loading } = useUserLifetimeClaims(userAddress);

// Use in your MetricCardMinimal:
<MetricCardMinimal
  title="Lifetime Earned"
  value={lifetimeEarned}
  label="MOR"
  isLoading={loading}
/>
```

## 🔧 Configuration Notes

### Start Blocks
Update `subgraph.yaml` start blocks based on actual deployment:

- **stETH Pool**: Find deployment tx on Etherscan, use that block
- **LINK Pool**: Find deployment tx on Etherscan, use that block

### Network Support
Currently configured for **Sepolia testnet** only. To add mainnet:

1. Get mainnet contract addresses
2. Add new data sources to `subgraph.yaml`
3. Update network to `mainnet`
4. Set correct start blocks

## 📊 Expected Data

Once running, your subgraph will provide:

- ✅ **Real lifetime claims** per user across all pools
- ✅ **Pool-specific statistics** (stETH vs LINK)
- ✅ **Historical claim events** with full transaction details  
- ✅ **Daily aggregated data** for charts
- ✅ **Global pool statistics**

## 🐛 Troubleshooting

**Subgraph not syncing?**
- Check start block is correct
- Verify contract addresses match deployed contracts
- Check network name matches (sepolia/mainnet)

**No data in queries?**
- Wait for initial sync (can take 10-30 minutes)
- Check if there are any actual UserClaimed events on the contracts
- Verify event signature matches ABI exactly

**Frontend integration issues?**
- Make sure Apollo Client is configured with correct subgraph URL
- Use lowercase addresses in queries
- Handle loading and error states

## 📈 Monitoring

Monitor your subgraph at:
- **Studio URL**: `https://thegraph.com/studio/subgraph/morpheus-capital-claims`
- **Query URL**: Will be provided after deployment
- **Status**: Check sync status and any indexing errors

---

🎉 **You're done!** Your subgraph will now provide real lifetime MOR claim data for your dashboard.
