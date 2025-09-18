# Morpheus Capital Claims Indexer with Ponder.sh

## 📋 Overview

This document outlines a plan to implement a self-hosted blockchain indexer using [Ponder.sh](https://ponder.sh) for tracking MOR token claims from the Morpheus Capital deposit pools. This provides an alternative to The Graph subgraph with full control over infrastructure and data.

## 🎯 Goals

- **Track UserClaimed events** from stETH and LINK deposit pools
- **Provide GraphQL API** for querying lifetime claim data
- **Self-hosted solution** with full control over data and performance
- **Real-time indexing** with sub-second latency
- **Production-ready** with PostgreSQL backend

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Blockchain    │    │  Ponder Indexer │    │   PostgreSQL    │
│                 │    │                 │    │    Database     │
│ stETH Pool ────►│────┤ Event Handlers  ├────┤   Tables        │
│ LINK Pool ─────►│    │ Schema & Logic  │    │   Indexed Data  │
└─────────────────┘    └─────────┬───────┘    └─────────────────┘
                                 │
                         ┌───────▼───────┐
                         │  GraphQL API  │
                         │  REST API     │
                         │ (Auto-generated)
                         └───────┬───────┘
                                 │
                         ┌───────▼───────┐
                         │ Frontend App  │
                         │ React Hooks   │
                         └───────────────┘
```

## 🆚 Ponder vs The Graph Comparison

| Feature | Ponder.sh | The Graph |
|---------|-----------|-----------|
| **Hosting** | Self-hosted | Decentralized network |
| **Control** | Full control | Limited customization |
| **Latency** | ~1-3 seconds | ~30-60 seconds |
| **Database** | PostgreSQL (direct access) | Managed (GraphQL only) |
| **Cost** | Infrastructure costs | Query fees + dev costs |
| **Setup Complexity** | Medium | Low |
| **Maintenance** | Self-managed | Managed service |
| **Customization** | High | Limited |

## 🚀 Implementation Plan

### Phase 1: Project Setup & Configuration

#### 1.1 Initialize Ponder Project
```bash
cd /Users/prometheus/Documents/Morpheus/dashboard-v2
mkdir ponder-indexer && cd ponder-indexer
pnpm create ponder
```

**Project Configuration:**
- **Name**: `morpheus-capital-claims`
- **Template**: Custom (we'll build from scratch)
- **Database**: PostgreSQL
- **Networks**: Sepolia (testnet), Ethereum Mainnet (future)

#### 1.2 Environment Setup
Create `.env.local`:
```bash
# RPC URLs
PONDER_RPC_URL_1="https://eth.drpc.org" # Ethereum Mainnet
PONDER_RPC_URL_11155111="https://sepolia.drpc.org" # Sepolia Testnet

# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/ponder_morpheus"

# Optional: Etherscan API for contract verification
ETHERSCAN_API_KEY="your_etherscan_api_key"
```

#### 1.3 Docker Compose for PostgreSQL
```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:15
    container_name: ponder-postgres
    environment:
      POSTGRES_DB: ponder_morpheus
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    
volumes:
  postgres_data:
```

### Phase 2: Schema Definition

#### 2.1 Database Schema (`ponder.schema.ts`)
```typescript
import { onchainTable, relations } from "ponder";

// Individual claim events
export const userClaimEvents = onchainTable("user_claim_events", (t) => ({
  // Primary key: txHash-logIndex
  id: t.text().primaryKey(),
  
  // Event data
  user: t.hex().notNull(),
  receiver: t.hex().notNull(),
  amount: t.bigint().notNull(),
  poolId: t.bigint().notNull(),
  
  // Pool context
  poolAddress: t.hex().notNull(),
  poolType: t.text().notNull(), // "STETH" or "LINK"
  
  // Transaction context
  transactionHash: t.hex().notNull(),
  blockNumber: t.bigint().notNull(),
  blockTimestamp: t.timestamp().notNull(),
  logIndex: t.integer().notNull(),
}));

// User statistics per pool
export const userPoolStats = onchainTable("user_pool_stats", (t) => ({
  // Primary key: user-poolAddress
  id: t.text().primaryKey(),
  
  // Identifiers
  user: t.hex().notNull(),
  poolAddress: t.hex().notNull(),
  poolType: t.text().notNull(),
  
  // Aggregated data
  totalClaimedAmount: t.bigint().notNull().default(0n),
  claimCount: t.integer().notNull().default(0),
  firstClaimTimestamp: t.timestamp(),
  lastClaimTimestamp: t.timestamp(),
}));

// User global statistics (across all pools)
export const userGlobalStats = onchainTable("user_global_stats", (t) => ({
  // Primary key: user address
  id: t.hex().primaryKey(),
  
  // Aggregated data
  totalClaimedAmount: t.bigint().notNull().default(0n),
  totalClaimCount: t.integer().notNull().default(0),
  firstClaimTimestamp: t.timestamp(),
  lastClaimTimestamp: t.timestamp(),
  
  // Pool breakdowns
  stethTotalClaimed: t.bigint().notNull().default(0n),
  linkTotalClaimed: t.bigint().notNull().default(0n),
  activePoolsCount: t.integer().notNull().default(0),
}));

// Pool global statistics
export const poolGlobalStats = onchainTable("pool_global_stats", (t) => ({
  // Primary key: pool address
  id: t.hex().primaryKey(),
  
  // Pool info
  poolAddress: t.hex().notNull(),
  poolType: t.text().notNull(),
  
  // Aggregated data
  totalClaimedAmount: t.bigint().notNull().default(0n),
  totalClaimCount: t.integer().notNull().default(0),
  uniqueClaimers: t.integer().notNull().default(0),
  firstClaimTimestamp: t.timestamp(),
  lastClaimTimestamp: t.timestamp(),
}));

// Daily statistics for charts
export const dailyClaimStats = onchainTable("daily_claim_stats", (t) => ({
  // Primary key: YYYY-MM-DD-poolAddress
  id: t.text().primaryKey(),
  
  // Identifiers
  date: t.text().notNull(), // YYYY-MM-DD
  poolAddress: t.hex().notNull(),
  poolType: t.text().notNull(),
  
  // Daily aggregates
  dailyClaimedAmount: t.bigint().notNull().default(0n),
  dailyClaimCount: t.integer().notNull().default(0),
  uniqueDailyClaimers: t.integer().notNull().default(0),
  
  // Running totals
  cumulativeClaimedAmount: t.bigint().notNull().default(0n),
  cumulativeClaimCount: t.integer().notNull().default(0),
}));

// Define relations for better querying
export const userClaimEventsRelations = relations(userClaimEvents, ({ one }) => ({
  userPoolStats: one(userPoolStats, {
    fields: [userClaimEvents.user, userClaimEvents.poolAddress],
    references: [userPoolStats.user, userPoolStats.poolAddress],
  }),
}));
```

#### 2.2 Contract Configuration (`ponder.config.ts`)
```typescript
import { createConfig } from "ponder";
import { ERC1967ProxyAbi } from "./abis/ERC1967Proxy";

export default createConfig({
  database: {
    kind: "postgres",
    connectionString: process.env.DATABASE_URL!,
  },
  
  chains: {
    sepolia: {
      chainId: 11155111,
      rpcUrls: [process.env.PONDER_RPC_URL_11155111!],
    },
    mainnet: {
      chainId: 1, 
      rpcUrls: [process.env.PONDER_RPC_URL_1!],
    },
  },
  
  contracts: {
    // stETH Deposit Pool (Sepolia)
    StETHDepositPool: {
      abi: ERC1967ProxyAbi,
      network: "sepolia",
      address: "0xFea33A23F97d785236F22693eDca564782ae98d0",
      startBlock: 5500000, // Adjust to actual deployment block
    },
    
    // LINK Deposit Pool (Sepolia) 
    LINKDepositPool: {
      abi: ERC1967ProxyAbi,
      network: "sepolia",
      address: "0x7f4f17be21219D7DA4C8E0d0B9be6a778354E5A5",
      startBlock: 5500000, // Adjust to actual deployment block
    },
    
    // Future: Mainnet contracts
    // StETHDepositPoolMainnet: { ... },
    // LINKDepositPoolMainnet: { ... },
  },
});
```

### Phase 3: Event Processing Logic

#### 3.1 Event Handlers (`src/index.ts`)
```typescript
import { ponder } from "ponder:registry";
import { 
  userClaimEvents,
  userPoolStats, 
  userGlobalStats,
  poolGlobalStats,
  dailyClaimStats
} from "ponder:schema";

// Contract address constants
const STETH_POOL_ADDRESS = "0xFea33A23F97d785236F22693eDca564782ae98d0";
const LINK_POOL_ADDRESS = "0x7f4f17be21219D7DA4C8E0d0B9be6a778354E5A5";

// Helper to determine pool type
function getPoolType(address: string): "STETH" | "LINK" | null {
  const addr = address.toLowerCase();
  if (addr === STETH_POOL_ADDRESS.toLowerCase()) return "STETH";
  if (addr === LINK_POOL_ADDRESS.toLowerCase()) return "LINK"; 
  return null;
}

// Helper to format date as YYYY-MM-DD
function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toISOString().split('T')[0];
}

// Handle UserClaimed events from both pools
ponder.on("StETHDepositPool:UserClaimed", handleUserClaimed);
ponder.on("LINKDepositPool:UserClaimed", handleUserClaimed);

async function handleUserClaimed({ event, context }) {
  const poolType = getPoolType(event.log.address);
  if (!poolType) return;

  const eventId = `${event.transactionHash}-${event.logIndex}`;
  const userPoolStatsId = `${event.args.user}-${event.log.address}`;
  const date = formatDate(Number(event.blockTimestamp));
  const dailyStatsId = `${date}-${event.log.address}`;

  // 1. Insert individual claim event
  await context.db.insert(userClaimEvents).values({
    id: eventId,
    user: event.args.user,
    receiver: event.args.receiver,
    amount: event.args.amount,
    poolId: event.args.poolId,
    poolAddress: event.log.address,
    poolType,
    transactionHash: event.transactionHash,
    blockNumber: event.blockNumber,
    blockTimestamp: new Date(Number(event.blockTimestamp) * 1000),
    logIndex: Number(event.logIndex),
  });

  // 2. Upsert user pool stats
  await context.db
    .insert(userPoolStats)
    .values({
      id: userPoolStatsId,
      user: event.args.user,
      poolAddress: event.log.address,
      poolType,
      totalClaimedAmount: event.args.amount,
      claimCount: 1,
      firstClaimTimestamp: new Date(Number(event.blockTimestamp) * 1000),
      lastClaimTimestamp: new Date(Number(event.blockTimestamp) * 1000),
    })
    .onConflictDoUpdate({
      target: "id",
      update: {
        totalClaimedAmount: (prev) => prev.totalClaimedAmount + event.args.amount,
        claimCount: (prev) => prev.claimCount + 1,
        lastClaimTimestamp: new Date(Number(event.blockTimestamp) * 1000),
      },
    });

  // 3. Upsert user global stats
  const poolClaimedField = poolType === "STETH" ? "stethTotalClaimed" : "linkTotalClaimed";
  
  await context.db
    .insert(userGlobalStats)
    .values({
      id: event.args.user,
      totalClaimedAmount: event.args.amount,
      totalClaimCount: 1,
      firstClaimTimestamp: new Date(Number(event.blockTimestamp) * 1000),
      lastClaimTimestamp: new Date(Number(event.blockTimestamp) * 1000),
      [poolClaimedField]: event.args.amount,
      activePoolsCount: 1,
    })
    .onConflictDoUpdate({
      target: "id", 
      update: {
        totalClaimedAmount: (prev) => prev.totalClaimedAmount + event.args.amount,
        totalClaimCount: (prev) => prev.totalClaimCount + 1,
        lastClaimTimestamp: new Date(Number(event.blockTimestamp) * 1000),
        [poolClaimedField]: (prev) => prev[poolClaimedField] + event.args.amount,
      },
    });

  // 4. Continue with pool global stats and daily stats...
  // (Similar upsert patterns)
}
```

### Phase 4: Frontend Integration

#### 4.1 GraphQL Client Setup
```typescript
// lib/ponder-client.ts
import { GraphQLClient } from 'graphql-request';

export const ponderClient = new GraphQLClient(
  process.env.NEXT_PUBLIC_PONDER_URL || 'http://localhost:42069/graphql'
);

// GraphQL queries
export const GET_USER_LIFETIME_CLAIMS = `
  query GetUserLifetimeClaims($userAddress: String!) {
    userGlobalStats(where: { id: $userAddress }) {
      items {
        id
        totalClaimedAmount
        totalClaimCount
        stethTotalClaimed
        linkTotalClaimed
        firstClaimTimestamp
        lastClaimTimestamp
      }
    }
  }
`;
```

#### 4.2 React Hook for Lifetime Claims
```typescript
// hooks/usePonderLifetimeClaims.ts
import { useQuery } from '@tanstack/react-query';
import { ponderClient, GET_USER_LIFETIME_CLAIMS } from '@/lib/ponder-client';
import { formatUnits } from 'viem';

export function usePonderLifetimeClaims(userAddress?: string) {
  return useQuery({
    queryKey: ['ponder-lifetime-claims', userAddress],
    queryFn: async () => {
      if (!userAddress) return null;
      
      const data = await ponderClient.request(GET_USER_LIFETIME_CLAIMS, {
        userAddress: userAddress.toLowerCase()
      });
      
      const stats = data.userGlobalStats.items[0];
      if (!stats) return null;
      
      return {
        totalClaimedAmount: stats.totalClaimedAmount,
        totalClaimedFormatted: formatUnits(BigInt(stats.totalClaimedAmount), 18),
        totalClaimCount: stats.totalClaimCount,
        stethClaimed: formatUnits(BigInt(stats.stethTotalClaimed), 18),
        linkClaimed: formatUnits(BigInt(stats.linkTotalClaimed), 18),
        firstClaimDate: new Date(stats.firstClaimTimestamp),
        lastClaimDate: new Date(stats.lastClaimTimestamp),
      };
    },
    enabled: !!userAddress,
    refetchInterval: 10000, // Refetch every 10 seconds
  });
}
```

### Phase 5: Deployment & Production

#### 5.1 Local Development
```bash
# Start PostgreSQL
docker-compose up -d

# Install dependencies
pnpm install

# Start Ponder development server
pnpm dev

# Access GraphQL playground
# http://localhost:42069/graphql
```

#### 5.2 Production Deployment Options

**Option A: VPS/Cloud Server**
- **Hosting**: DigitalOcean, Linode, AWS EC2
- **Database**: Managed PostgreSQL (AWS RDS, DO Managed DB)
- **Process Manager**: PM2 or Docker Compose
- **Reverse Proxy**: Nginx
- **SSL**: Let's Encrypt

**Option B: Container Platform**
- **Platform**: Railway, Render, Fly.io
- **Benefits**: Auto-scaling, managed infrastructure
- **Database**: Platform-provided PostgreSQL
- **Deployment**: Git-based deployments

#### 5.3 Production Configuration
```typescript
// ponder.config.ts (production)
export default createConfig({
  database: {
    kind: "postgres",
    connectionString: process.env.DATABASE_URL!,
    poolConfig: {
      max: 30, // Connection pool size
    },
  },
  
  chains: {
    mainnet: {
      chainId: 1,
      rpcUrls: [
        process.env.MAINNET_RPC_1!,
        process.env.MAINNET_RPC_2!, // Fallback RPC
      ],
      pollingInterval: 2000, // 2 second polling
    },
  },
  
  // Production optimizations
  options: {
    maxHealthcheckDuration: 240,
    telemetryEnabled: true,
  },
});
```

### Phase 6: Monitoring & Maintenance

#### 6.1 Monitoring Setup
- **Health Checks**: Built-in `/health` endpoint
- **Metrics**: Prometheus metrics export
- **Logging**: Structured logs with Winston/Pino
- **Alerts**: Discord/Slack webhooks for errors

#### 6.2 Performance Optimization
- **Database Indexing**: Add indexes on frequently queried fields
- **Caching**: Redis for GraphQL query caching  
- **Rate Limiting**: Prevent API abuse
- **Archive Strategy**: Archive old data to separate tables

## 🕐 Timeline Estimate

| Phase | Duration | Description |
|-------|----------|-------------|
| **Phase 1** | 2-3 days | Project setup, configuration |
| **Phase 2** | 1-2 days | Schema definition, contracts config |
| **Phase 3** | 3-4 days | Event handlers, business logic |
| **Phase 4** | 2-3 days | Frontend integration, testing |
| **Phase 5** | 2-3 days | Production deployment, monitoring |
| **Phase 6** | 1-2 days | Performance tuning, documentation |

**Total**: ~2-3 weeks for full production deployment

## 💰 Cost Estimates (Monthly)

**Self-Hosted VPS:**
- **Server**: $20-50/month (2-4GB RAM)
- **Database**: $15-30/month (managed PostgreSQL)
- **RPC Calls**: $10-30/month (depending on volume)
- **Total**: $45-110/month

**vs The Graph:**
- **Query Fees**: $0.0001 per query
- **Dev/Deploy**: ~$50-100/month
- **Estimate**: $50-200/month (depending on usage)

## ✅ Benefits of Ponder Approach

1. **Real-time Data**: 1-3 second latency vs 30-60 seconds with The Graph
2. **Full Control**: Direct PostgreSQL access, custom queries
3. **Cost Effective**: Predictable infrastructure costs
4. **Performance**: Optimized for your specific use case
5. **Privacy**: Self-hosted, no third-party data sharing
6. **Flexibility**: Easy to add custom logic and aggregations

## 🚨 Considerations

1. **Infrastructure Management**: Need to manage servers, database, monitoring
2. **RPC Reliability**: Need reliable Ethereum RPC providers  
3. **Scaling**: Manual scaling vs automatic with The Graph
4. **Maintenance**: Updates, security patches, backups
5. **Development Time**: More initial setup vs plug-and-play subgraph

## 🎯 Recommendation

**Start with Ponder.sh** for the Morpheus Capital Claims indexer because:

- ✅ **Real-time requirements**: Users expect instant claim data updates
- ✅ **Control needs**: Direct database access for complex queries  
- ✅ **Cost predictability**: Known infrastructure costs vs variable query fees
- ✅ **Future expansion**: Easy to add more contracts and data sources
- ✅ **Self-sovereignty**: Aligns with decentralized ethos of the project

The additional development time (2-3 weeks) is justified by the long-term benefits of having full control over this critical data infrastructure.
