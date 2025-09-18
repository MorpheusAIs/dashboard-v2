# Morpheus Capital Claims Subgraph

This subgraph indexes `UserClaimed` events from the Morpheus Capital deposit pools (stETH and LINK) on Ethereum Sepolia testnet. It tracks lifetime MOR token claims for all users, enabling accurate "lifetime earned" calculations in the dashboard.

## 📋 What It Tracks

- **Individual Claims**: Every `UserClaimed` event with full transaction details
- **User Pool Stats**: Per-user aggregated stats for each pool (stETH/LINK)  
- **User Global Stats**: Per-user stats across all pools
- **Pool Global Stats**: Overall pool statistics
- **Daily Statistics**: Daily aggregated claim data for charts

## 🏗️ Setup & Deployment

### Prerequisites

1. Install The Graph CLI:
```bash
npm install -g @graphprotocol/graph-cli
```

2. Create account at [The Graph Studio](https://thegraph.com/studio/)

### Installation

1. Navigate to the subgraph directory:
```bash
cd subgraph
```

2. Install dependencies:
```bash
npm install
```

3. Generate code from schema:
```bash
npm run codegen
```

4. Build the subgraph:
```bash
npm run build
```

### Deployment to The Graph Studio

1. Go to [The Graph Studio](https://thegraph.com/studio/)
2. Create a new subgraph named `morpheus-capital-claims`
3. Get your deploy key from the studio
4. Authenticate:
```bash
graph auth --studio YOUR_DEPLOY_KEY
```

5. Deploy:
```bash
npm run deploy
```

### Local Development (Optional)

For local development with Graph Node:

```bash
# Start local Graph Node (requires Docker)
git clone https://github.com/graphprotocol/graph-node/
cd graph-node/docker
docker-compose up

# Deploy locally
npm run create-local
npm run deploy-local
```

## 📊 GraphQL Queries

### Get User's Total Lifetime Claims

```graphql
query GetUserLifetimeClaims($userAddress: String!) {
  userGlobalStats(id: $userAddress) {
    id
    totalClaimedAmount
    totalClaimCount
    firstClaimTimestamp
    lastClaimTimestamp
    activePools
    stETHPoolStats {
      totalClaimedAmount
      claimCount
    }
    linkPoolStats {
      totalClaimedAmount
      claimCount
    }
  }
}
```

### Get User's Pool-Specific Stats

```graphql
query GetUserPoolStats($userAddress: String!) {
  userPoolStats(where: { user: $userAddress }) {
    id
    poolType
    totalClaimedAmount
    claimCount
    firstClaimTimestamp
    lastClaimTimestamp
  }
}
```

### Get Recent Claims for a User

```graphql
query GetUserRecentClaims($userAddress: String!, $first: Int = 10) {
  userClaimEvents(
    where: { user: $userAddress }
    orderBy: blockTimestamp
    orderDirection: desc
    first: $first
  ) {
    id
    amount
    poolType
    blockTimestamp
    transactionHash
  }
}
```

### Get Pool Statistics

```graphql
query GetPoolStats {
  poolGlobalStats {
    id
    poolType
    totalClaimedAmount
    totalClaimCount
    uniqueClaimers
    firstClaimTimestamp
    lastClaimTimestamp
  }
}
```

### Get Daily Claim Statistics (for charts)

```graphql
query GetDailyClaimStats($poolType: PoolType!, $days: Int = 30) {
  dailyClaimStats(
    where: { poolType: $poolType }
    orderBy: date
    orderDirection: desc
    first: $days
  ) {
    date
    dailyClaimedAmount
    dailyClaimCount
    uniqueDailyClaimers
    cumulativeClaimedAmount
    cumulativeClaimCount
  }
}
```

## 🔌 Frontend Integration

### 1. Install GraphQL dependencies

```bash
npm install graphql @apollo/client
# or
npm install graphql-request
```

### 2. Update your React component

```typescript
// hooks/useUserLifetimeClaims.ts
import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';

const GET_USER_LIFETIME_CLAIMS = gql`
  query GetUserLifetimeClaims($userAddress: String!) {
    userGlobalStats(id: $userAddress) {
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
`;

export function useUserLifetimeClaims(userAddress: string) {
  const { data, loading, error } = useQuery(GET_USER_LIFETIME_CLAIMS, {
    variables: { userAddress: userAddress.toLowerCase() },
    skip: !userAddress,
  });

  return {
    lifetimeClaimed: data?.userGlobalStats?.totalClaimedAmount || '0',
    loading,
    error,
  };
}
```

### 3. Update user-assets-panel.tsx

```typescript
// In components/capital/user-assets-panel.tsx
import { useUserLifetimeClaims } from '@/hooks/useUserLifetimeClaims';

export function UserAssetsPanel() {
  const { userAddress, assets } = useCapitalContext();
  
  // Get lifetime claims from subgraph
  const { lifetimeClaimed, loading: lifetimeLoading } = useUserLifetimeClaims(userAddress);
  
  // Calculate current claimable
  const currentClaimable = parseDepositAmount(assets.stETH?.claimableAmountFormatted || '0') +
                          parseDepositAmount(assets.LINK?.claimableAmountFormatted || '0');
  
  // True lifetime earned = current claimable + already claimed
  const trueLifetimeEarned = currentClaimable + parseFloat(formatUnits(lifetimeClaimed || '0', 18));

  return (
    // ... your component JSX
    <MetricCardMinimal
      title="Lifetime Earned" 
      value={formatNumber(trueLifetimeEarned)}
      label="MOR"
      isLoading={lifetimeLoading}
    />
  );
}
```

## 🔧 Configuration

### Network Addresses

The subgraph is currently configured for **Sepolia testnet**:

- **stETH Deposit Pool**: `0xFea33A23F97d785236F22693eDca564782ae98d0`
- **LINK Deposit Pool**: `0x7f4f17be21219D7DA4C8E0d0B9be6a778354E5A5`
- **Start Block**: `5500000` (adjust as needed)

### Adding Mainnet Support

To add mainnet support, update `subgraph.yaml`:

1. Add new data sources for mainnet contracts
2. Update network from `sepolia` to `mainnet` 
3. Add mainnet contract addresses
4. Update start blocks to deployment blocks

## 🧪 Testing

The subgraph includes entity tests. Run them with:

```bash
npm test
```

## 📈 Monitoring

Once deployed, monitor your subgraph at:
- **Studio Dashboard**: `https://thegraph.com/studio/subgraph/morpheus-capital-claims`
- **Playground**: Test queries directly in the studio
- **Analytics**: View indexing status and query performance

## 🔍 Troubleshooting

### Common Issues

1. **Build Errors**: Make sure all ABIs are in `abis/` directory
2. **Sync Issues**: Check start block is correct for your network
3. **Missing Events**: Verify event signatures match ABI exactly
4. **Performance**: Use indexed fields in queries when possible

### Debugging

Enable debug logging by adding to `subgraph.yaml`:
```yaml
features:
  - nonFatalErrors
  - fullTextSearch
```

## 📝 Schema Updates

When updating the GraphQL schema:

1. Update `schema.graphql`
2. Run `npm run codegen` to regenerate types
3. Update mapping logic in `src/mapping.ts`
4. Test and redeploy

## 🚀 Next Steps

1. **Deploy the subgraph** to The Graph Studio
2. **Test queries** in the playground 
3. **Integrate frontend** hooks to fetch lifetime claims
4. **Add mainnet support** when ready for production
5. **Add more metrics** (daily/weekly aggregations, etc.)

---

With this subgraph, you'll have accurate, real-time data about user claims history, enabling proper "lifetime earned" calculations in your dashboard! 🎉
