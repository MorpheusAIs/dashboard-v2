# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Basic Commands
```bash
npm run dev          # Start dev server with Turbo (http://localhost:3000)
npm run build        # Production build
npm start            # Start production server
npm run lint         # Run ESLint
```

### Supabase Commands
```bash
supabase start       # Start local Supabase instance
supabase status      # Check Supabase status
supabase stop        # Stop local Supabase
```

## Project Architecture

This is a Next.js 14 App Router application serving as the Morpheus dashboard - a Web3 platform for managing builders, capital pools, compute subnets, staking, and rewards on multiple blockchain networks.

### Technology Stack

**Frontend:**
- Next.js 14.2.16 (App Router)
- React 18 with TypeScript 5.9.2
- Tailwind CSS 3.4.1 with shadcn/ui components
- Framer Motion for animations
- React Query (TanStack) for data fetching
- React Hook Form with Zod validation

**Web3 Integration:**
- Wagmi v2.14.9 for blockchain interactions
- Reown AppKit v1.6.1 (formerly Web3Modal) for wallet connections
- Viem v2.22.14 for Ethereum operations
- Ethers.js v5.8.0 for contract ABIs

**Data Sources:**
- Apollo Client for GraphQL queries
- Goldsky V4 (primary subgraph indexer)
- TheGraph (fallback and legacy endpoints)
- Supabase for builder metadata storage
- Dune Analytics SDK for on-chain metrics

**External Services:**
- Alchemy (primary RPC provider)
- Infura (fallback RPC)
- LayerZero for cross-chain operations
- CoW Protocol and Uniswap widgets for swaps

### Network Support

**Mainnet:** Ethereum, Arbitrum One, Base
**Testnet:** Arbitrum Sepolia, Base Sepolia

Network configuration is centralized in `/config/networks.ts` with contract addresses for V1 (legacy) and V2 (current) deployments.

### Directory Structure

```
/app                    # Next.js app router
  /api                  # API route handlers
    /builders           # Builder-related endpoints
    /capital            # Capital pool endpoints
    /dune               # Dune Analytics proxies
    /morlord            # Morlord aggregation service
  /abi                  # Smart contract ABIs (18+ contracts)
  /graphql              # GraphQL queries and client setup
    /queries            # Query definitions by feature
  /services             # External service integrations
  /utils                # App-layer utilities

/components             # React components
  /capital              # Capital pool components (deposits, withdrawals, rewards)
  /staking              # Staking-related components
  /subnet-form          # Multi-step subnet creation form
  /ui                   # shadcn/ui component library (45+ components)

/config                 # Configuration files
  index.tsx             # Wagmi and Web3Modal config
  networks.ts           # Network and contract address config

/context                # React Context providers
  builders-context.tsx  # Global builders state
  capital-page-context.tsx  # Capital page state (117KB+)
  compute-context.tsx   # Compute/subnet state
  network-context.tsx   # Network environment switching
  auth-context.tsx      # Authentication state

/hooks                  # Custom React hooks (20+ hooks)
  useAllBuildersQuery   # Fetch all builders
  useCapitalPoolData    # Capital pool calculations
  useStakingData        # Staking metrics
  useMORBalances        # Token balance queries

/lib                    # Shared utilities
  /utils                # Data adapters and formatters
    goldsky-v4-adapter.ts         # V4 schema transformation
    goldsky-v1-to-v4-adapter.ts   # Schema migration
    reward-calculation-utils.ts   # Reward math
  apollo-client.ts      # Apollo Client instances per network
  contracts.ts          # Contract address lookups and ABIs
  supabase.ts           # Supabase client and types
```

### Provider Hierarchy

The app uses a nested provider structure defined in `/app/providers.tsx`:

```
QueryClientProvider (React Query)
  └─ Web3Providers (Wagmi + Web3Modal)
      └─ NetworkProvider (mainnet/testnet switching)
          └─ ComputeProvider
              └─ BuildersProvider
                  └─ AuthProvider
                      └─ Toaster (Sonner notifications)
```

When adding new global state, consider where it fits in this hierarchy.

### GraphQL Data Fetching

**Primary Endpoints:** Goldsky V4 for Base and Arbitrum mainnet
**Fallback:** TheGraph for Capital v2 on Ethereum and testnet endpoints

GraphQL configuration lives in `/app/graphql/`:
- `/queries/` - Query definitions by feature (builders, capital, compute, metrics)
- `/types.ts` - TypeScript types for GraphQL responses
- Custom `fetchGraphQL` function implements:
  - 2-second debouncing to prevent duplicate requests
  - Exponential backoff retry logic for rate limiting (HTTP 429)
  - Maximum 3 retries with configurable delays

**Data Adapters:**
- `goldsky-v4-adapter.ts` - Transform V4 GraphQL responses to UI models
- `goldsky-v1-to-v4-adapter.ts` - Migrate between schema versions

### Web3 Configuration

**Wagmi Setup** (`/config/index.tsx`):
- Cookie-based storage for SSR compatibility
- 30-second polling interval (reduced from 1s default) to minimize RPC calls
- Alchemy primary, Infura fallback
- Supports multiple chains with custom RPC endpoints

**Contract Interactions:**
- All contract addresses in `/config/networks.ts`
- ABIs in `/app/abi/` (18+ contracts including ERC20, pools, factories, builders)
- Use `useContractAddress` hook to get addresses for current chain
- Never hardcode contract addresses

**Wallet Support:**
- Web3Modal with Reown AppKit
- Supported: Coinbase, WalletConnect, Injected, EIP-6963
- Excluded: Phantom
- Error suppression for common WalletConnect issues in `/components/web3-providers.tsx`

### API Routes

All API routes use Next.js App Router pattern (`/app/api/*/route.ts`):

**Builders:**
- `/api/builders` - List all builders (proxies Morlord API)
- `/api/builders/[slug]` - Individual builder details
- `/api/builders/goldsky/[projectId]` - Fetch from Goldsky by project
- `/api/builders/goldsky/{arbitrum|base}` - Network-specific lists
- `/api/builders/goldsky/user-admin/[network]` - Admin data
- `/api/builders/goldsky/user-staked/[network]` - Staking data

**Data Aggregation:**
- `/api/dune/active-stakers-mainnet` - ISR cache: 3 hours
- `/api/dune/active-stakers-testnet` - Testnet stakers
- `/api/dune/cumulative-deposits` - Historical deposits
- `/api/morlord` - Builder data aggregation
- `/api/token-prices` - Token pricing
- `/api/daily-emissions` - Daily emission calculations

**ISR (Incremental Static Regeneration):**
- Dune Analytics endpoints use 3-hour cache (`revalidate: 10800`)
- Reduces API costs and improves performance

### Key Components

**Capital Module** (`/components/capital/`):
- Supports V2 protocol with multiple deposit pools: stETH, LINK, USDC, USDT, WBTC, WETH
- `DepositModal` - Multi-asset deposit management
- `WithdrawModal` - Withdrawal with lock period awareness
- `ClaimMorRewardsModal` - MOR reward claiming
- `ChangeLockModal` - Lock period modifications
- `CapitalInfoPanel` - Overview metrics
- `UserAssetsPanel` - User holdings (dynamically imported to avoid hydration issues)
- `ReferralPanel` - Referral tracking (dynamically imported)
- `ChartSection` - Historical data viz (dynamically imported)

**Builders Module:**
- `BuildersPage` - Main builders list with filtering/sorting
- Context-driven data fetching via `BuildersContext`
- Integrates Supabase metadata with on-chain data from Goldsky
- Staking tables show real-time on-chain positions

**Subnet Form** (`/components/subnet-form/`):
- Multi-step wizard for subnet creation
- Step 1: Network selection
- Step 2: Project metadata with V2 schema support
- Uses React Hook Form with Zod validation

**UI Components** (`/components/ui/`):
- 45+ Radix UI-based components following shadcn/ui pattern
- Custom components: `liquid-button` (animated), Tremor charts
- All components use Tailwind CSS with design tokens from `/app/globals.css`

### State Management Patterns

**React Context for Global State:**
- `BuildersContext` (117KB+) - Manages builders list, filters, sorting, lazy loading
- `CapitalPageContext` - Complex capital pool state with deposit history, user assets, referrals
- `ComputeContext` - Subnet data and user associations
- `NetworkContext` - Mainnet/testnet environment switching
- `AuthContext` - User identity and permissions

**React Query for Server State:**
- 5-minute stale time for all queries
- Conservative refetch settings to minimize RPC load
- 2 retries with exponential backoff
- Used in 20+ custom hooks for data fetching

**Custom Hooks Pattern:**
- Encapsulate complex data fetching logic
- Examples: `useCapitalPoolData`, `useStakingData`, `useMORBalances`
- Located in `/hooks/` directory
- Combine React Query, Wagmi hooks, and GraphQL clients

### Performance Optimizations

1. **RPC Call Reduction:**
   - 30-second polling interval (vs 1s default)
   - Disabled auto-refetch on window focus
   - Conservative React Query cache times

2. **GraphQL Optimizations:**
   - 2-second debouncing window for duplicate requests
   - Exponential backoff for rate limiting
   - `fetchPolicy: 'no-cache'` on Apollo clients to avoid stale data

3. **Component Loading:**
   - Dynamic imports for heavy components (charts, panels) to prevent hydration mismatches
   - Use pattern: `const Component = dynamic(() => import('./Component'), { ssr: false })`

4. **ISR Caching:**
   - 3-hour cache on Dune Analytics endpoints
   - Reduces external API costs

### Error Handling

**Error Boundaries:**
- `WalletErrorBoundary.tsx` - Catches wallet connection errors
- Suppresses known WalletConnect errors ("Proposal expired", "Session expired")
- Global error handler in `/app/global-error.tsx`

**Logging:**
- Console logs with context prefixes: `[DUNE API]`, `[GraphQL Request]`, etc.
- Apollo Client error link logs all GraphQL errors
- Debug mode available in GraphQL client config

**Rate Limiting:**
- GraphQL client retries with exponential backoff on HTTP 429
- Max 3 retries with configurable delays

### Environment Variables

Required environment variables (see `.env.example`):

```bash
# Web3Modal / Reown
NEXT_PUBLIC_PROJECT_ID=your_web3modal_project_id
NEXT_PUBLIC_PROJECT_SECRET=your_web3modal_secret

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# RPC Providers
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_key
NEXT_PUBLIC_INFURA_API_KEY=your_infura_key

# Analytics
DUNE_API_KEY=your_dune_api_key

# Internal
CRON_SECRET=your_cron_secret
NODE_OPTIONS=--max-old-space-size=4096
```

### Type Safety

**GraphQL Types** (`/app/graphql/types.ts`):
- All GraphQL responses are typed
- `BuildersUser`, `BuildersProject`, `SubnetUser`, `Subnet`
- Shared UI types like `StakingEntry`

**Database Types** (`/app/lib/supabase.ts`):
- `BuilderDB` interface matches Supabase schema (34+ columns)
- Extended with on-chain data: `totalStaked`, `minimalDeposit`, etc.

**Contract Types:**
- All ABIs are typed via TypeScript
- Use Wagmi's `useReadContract` and `useWriteContract` with proper typing

### Styling Guidelines

**Design System:**
- Tailwind CSS 3.4.1 with custom theme in `/app/globals.css`
- CSS variables for colors: `--background`, `--foreground`, `--primary`, etc.
- Dark mode support via `next-themes`

**Component Styling:**
- Use shadcn/ui components from `/components/ui/`
- Utility-first with Tailwind classes
- `cn()` helper from `/lib/utils.ts` for conditional classes

**Icons:**
- Lucide React (primary)
- Remixicon React (secondary)
- Web3Icons for token/chain logos

### Testing

Currently no automated tests are set up in this repository. When adding tests, consider:
- Unit tests for utility functions (`/lib/utils/`)
- Integration tests for hooks
- E2E tests for critical flows (deposits, staking, subnet creation)

### Common Development Workflows

**Adding a New Builder Feature:**
1. Update GraphQL query in `/app/graphql/queries/builders.ts`
2. Add/update types in `/app/graphql/types.ts`
3. Create or update hook in `/hooks/`
4. Update `BuildersContext` if needed
5. Implement UI component in `/components/`
6. Update API route if backend changes needed

**Adding Support for a New Asset:**
1. Add contract ABI to `/app/abi/`
2. Update network config in `/config/networks.ts` with contract address
3. Create deposit pool component in `/components/capital/`
4. Update `CapitalPageContext` with new asset logic
5. Add asset-specific calculations to reward utils

**Network Configuration Changes:**
1. Edit `/config/networks.ts` for contract addresses
2. Update `/config/index.tsx` if adding new chain to Wagmi
3. Update Apollo client config in `/lib/apollo-client.ts` if new subgraph needed
4. Test with testnet first, then deploy mainnet changes

**Working with GraphQL Endpoints:**
- Primary: Goldsky V4 (Base, Arbitrum mainnet)
- Fallback: TheGraph (Capital v2 Ethereum, testnets)
- Endpoint URLs in `/app/config/subgraph-endpoints.ts`
- To switch between V1/V4, use feature flags in code

### Debugging Tips

**Web3 Issues:**
- Check network in Web3Modal matches expected chain
- Verify contract addresses in `/config/networks.ts` for current chain
- Check RPC provider status (Alchemy/Infura dashboards)
- Review `WalletErrorBoundary` for suppressed errors

**GraphQL Issues:**
- Enable debug mode in Apollo client config
- Check console for `[GraphQL Request]` logs
- Verify endpoint availability (Goldsky/TheGraph status pages)
- Test with direct GraphQL Playground/curl

**Performance Issues:**
- Check React Query DevTools for stale queries
- Monitor RPC call frequency (should be ~30s intervals)
- Review Network tab for duplicate requests (should be debounced)
- Check for hydration mismatches (use dynamic imports for client-only components)

### Security Considerations

**Never commit:**
- Private keys or seed phrases
- API keys (use `.env.local`, not `.env`)
- Production secrets

**Smart Contract Interactions:**
- Always validate user input with Zod schemas
- Use `try/catch` blocks for contract calls
- Show clear error messages for failed transactions
- Implement proper allowance checks before transfers

**RPC Provider Keys:**
- Rotate API keys regularly
- Use separate keys for dev/prod
- Monitor usage to detect abuse

### Build Configuration

**Next.js Config** (`/next.config.mjs`):
- Allows all remote image hosts (consider restricting in production)
- Hidden source maps in production
- Ignores `/DashBoard` directory during build
- React Native async storage fallback disabled (MetaMask SDK compatibility)

**Webpack Customizations:**
- Custom watch options to ignore legacy directories
- Polyfills for crypto/stream for Web3 compatibility

### Deployment

**Vercel:**
- Connected to GitHub repository
- Automatic preview deployments on PRs
- Production deployment on main branch
- Environment variables configured in Vercel dashboard

**Cron Jobs:**
- `/api/cron/update-prices` - Scheduled price updates
- Requires `CRON_SECRET` header for authentication

### Additional Resources

**Documentation:**
- Next.js App Router: https://nextjs.org/docs/app
- Wagmi v2: https://wagmi.sh
- Reown AppKit: https://docs.reown.com/appkit
- React Query: https://tanstack.com/query/latest
- shadcn/ui: https://ui.shadcn.com

**Blockchain Resources:**
- Arbitrum docs: https://docs.arbitrum.io
- Base docs: https://docs.base.org
- LayerZero: https://layerzero.network/docs

**Subgraph Indexers:**
- Goldsky: https://goldsky.com
- The Graph: https://thegraph.com
