This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Network Support

This project supports multiple networks including both mainnet and testnet environments:

### Supported Networks

#### Mainnet
- Ethereum
- Arbitrum One
- Base

#### Testnet
- Arbitrum Sepolia

### Features

- **Visual Indicators**: Clear testnet indicator in the navbar when using test networks
- **Network-Specific Balances**: Displays MOR token balances for the appropriate networks
- **Contract Address Management**: Centralized contract address configuration in `config/networks.ts`
- **Type Safety**: Fully typed with TypeScript for better developer experience

### Implementation Details

The network functionality is implemented using:

1. **Configuration**: A centralized configuration system in `config/networks.ts` that defines all networks and contract addresses
2. **Wagmi Integration**: Uses wagmi hooks for blockchain interactions and network state management
3. **UI Components**: 
   - `mor-balance.tsx`: Displays MOR token balances for relevant networks
   - `testnet-indicator.tsx`: Shows a clear visual indicator when on testnet

### Usage

To access network state and contract addresses in your components:

```tsx
import { useChainId } from 'wagmi'
import { morTokenContracts } from '@/lib/contracts'

function MyComponent() {
  const chainId = useChainId()
  const isTestnet = chainId === 421614 // Arbitrum Sepolia
  
  // Use the network state in your component
  // ...
}
```

### Best Practices

1. **Always check the current chainId** before making transactions
2. **Use the contract addresses from config** instead of hardcoding addresses
3. **Handle both mainnet and testnet** cases in your components
4. **Test thoroughly on testnets** before deploying to mainnet
