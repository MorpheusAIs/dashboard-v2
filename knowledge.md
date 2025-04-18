# Morpheus Dashboard Knowledge

## Project Overview
- Next.js dashboard for Morpheus protocol
- Handles builder subnets, compute nodes, and metrics
- Multi-network support (Arbitrum, Base, Arbitrum Sepolia)
- Uses Web3Modal for wallet connections
- GraphQL integration with multiple subgraphs

## Key Technologies
- Next.js 14 with App Router
- TypeScript
- Wagmi/Viem for Web3
- GraphQL with Apollo Client
- Tailwind CSS
- Supabase for builder data

## Network Support
- Mainnet networks: Arbitrum One, Base
- Testnet: Arbitrum Sepolia
- Each network has its own contract addresses and GraphQL endpoints

## Development Guidelines
- Run tests and type checking after changes:
  ```bash
  npm run typecheck && npm run test
  ```
- Use pnpm as package manager
- Keep GraphQL queries in their respective files under app/graphql/queries/
- Follow existing patterns for context providers
- Use the UI components from components/ui/

## Architecture
- Context-based state management
- Separate contexts for builders, compute, and network state
- GraphQL queries centralized in app/graphql/
- Reusable UI components in components/ui/
- Network configuration in config/networks.ts

## Common Tasks
- Adding new networks: Update config/networks.ts
- Adding GraphQL queries: Add to app/graphql/queries/
- New UI components: Add to components/ui/ using shadcn patterns
- Contract interactions: Use hooks/useContractAddress.ts

## Best Practices
- Use TypeScript strictly
- Follow existing component patterns
- Keep GraphQL queries organized by domain
- Handle loading and error states consistently
- Use proper type imports from wagmi/viem