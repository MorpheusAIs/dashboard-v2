# Buy MOR LiFi Widget Setup Guide

This comprehensive guide contains all the configuration files, libraries, and setup required to implement the `/buy-mor` page with the LiFi widget integration for Morpheus token bridging and swapping.

## 📦 Required Libraries

Install the following packages using npm or yarn:

```bash
npm install @lifi/widget@^3.33.1 wagmi@^2.18.1 @tanstack/react-query@^5.90.5 viem@^2.38.3
```

### Complete Dependencies List (from package.json)

```json
{
  "@lifi/widget": "^3.33.1",
  "wagmi": "^2.18.1",
  "@tanstack/react-query": "^5.90.5",
  "viem": "^2.38.3",
  "@bigmi/client": "^0.6.0",
  "@bigmi/core": "^0.6.0",
  "@bigmi/react": "^0.6.0",
  "@mysten/dapp-kit": "^0.19.5",
  "@mysten/sui": "^1.43.0",
  "@solana/wallet-adapter-react": "^0.15.39",
  "@solana/web3.js": "^1.98.4"
}
```

## ⚙️ Environment Variables

Create a `.env.local` file with the following variables:

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id_here
```

> **Note**: If not provided, a placeholder ID will be used. For production, get a project ID from [WalletConnect Cloud](https://cloud.walletconnect.com/).

## 🏗️ Next.js Configuration

### next.config.ts (Required for LiFi compatibility)

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'],
  webpack: (config) => {
    // Ignore optional dependencies that are not needed in browser
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      encoding: false,
      'pino-pretty': false,
      '@react-native-async-storage/async-storage': false,
    }

    // Suppress warnings for these optional dependencies
    config.ignoreWarnings = [
      { module: /node_modules\/@metamask\/sdk/ },
      { module: /node_modules\/pino/ },
    ]

    return config
  },
}

export default nextConfig
```

## 📁 File Structure

```
app/
├── (marketing)/
│   └── buy-mor/
│       └── page.tsx                    # Main buy/bridge page
components/
├── lifi/
│   ├── index.ts                        # Barrel exports
│   ├── ClientOnly.tsx                  # SSR wrapper component
│   ├── WalletProvider.tsx              # Wagmi wallet provider
│   ├── LiFiWidgetComponent.tsx         # Main widget component
│   └── README.md                       # Component documentation
```

## 📄 Configuration Files

### 1. Main Page (`app/(marketing)/buy-mor/page.tsx`)

```tsx
'use client'

import { Box, Container, Heading, Stack, Text } from '@chakra-ui/react'

import { LiFiWalletProvider } from '@/components/lifi/WalletProvider'
import { LiFiWidgetComponent } from '@/components/lifi/LiFiWidgetComponent'

export default function BuyMorPage() {
  return (
    <Container maxW='container.xl' py={12}>
      <Stack spacing={8} align='center'>
        <Stack spacing={4} textAlign='center' maxW='2xl'>
          <Heading as='h1' size='2xl'>
            Buy / Bridge MOR
          </Heading>
          <Text fontSize='lg' color='gray.300'>
            Swap tokens for MOR or bridge MOR across multiple networks including Ethereum, Arbitrum,
            and Base. Powered by LI.FI for the best rates and seamless cross-chain experience.
          </Text>
        </Stack>

        <Box w='full' maxW='600px' minH='686px'>
          <LiFiWalletProvider>
            <LiFiWidgetComponent />
          </LiFiWalletProvider>
        </Box>

        <Stack spacing={2} textAlign='center' maxW='xl' pt={4}>
          <Text fontSize='sm' color='gray.400'>
            MOR Token Addresses:
          </Text>
          <Text fontSize='xs' color='gray.500'>
            Ethereum: 0xcbb8f1bda10b9696c57e13bc128fe674769dcec0
          </Text>
          <Text fontSize='xs' color='gray.500'>
            Arbitrum: 0x092baadb7def4c3981454dd9c0a0d7ff07bcfc86
          </Text>
          <Text fontSize='xs' color='gray.500'>
            Base: 0x7431ada8a591c955a994a21710752ef9b882b8e3
          </Text>
        </Stack>
      </Stack>
    </Container>
  )
}
```

### 2. LiFi Components Index (`components/lifi/index.ts`)

```typescript
export { ClientOnly } from './ClientOnly'
export { LiFiWalletProvider } from './WalletProvider'
export { LiFiWidgetComponent } from './LiFiWidgetComponent'
```

### 3. ClientOnly Component (`components/lifi/ClientOnly.tsx`)

```tsx
'use client'

import { useEffect, useState } from 'react'

interface ClientOnlyProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    setHasMounted(true)
  }, [])

  if (!hasMounted) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
```

### 4. Wallet Provider (`components/lifi/WalletProvider.tsx`)

```tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useMemo } from 'react'
import { createClient, http } from 'viem'
import { createConfig, WagmiProvider } from 'wagmi'
import { arbitrum, base, mainnet } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

interface LiFiWalletProviderProps {
  children: ReactNode
}

export function LiFiWalletProvider({ children }: LiFiWalletProviderProps) {
  const queryClient = useMemo(() => new QueryClient(), [])

  const wagmiConfig = useMemo(() => {
    return createConfig({
      chains: [mainnet, arbitrum, base],
      connectors: [
        injected(),
        walletConnect({
          projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '0000000000000000000000000000000',
        }),
      ],
      client({ chain }) {
        return createClient({ chain, transport: http() })
      },
    })
  }, [])

  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}
```

### 5. LiFi Widget Component (`components/lifi/LiFiWidgetComponent.tsx`)

```tsx
'use client'

import type { WidgetConfig } from '@lifi/widget'
import { ChainType, LiFiWidget, WidgetSkeleton } from '@lifi/widget'
import { createConfig } from '@lifi/sdk'
import { useMemo } from 'react'

import { ClientOnly } from './ClientOnly'

export function LiFiWidgetComponent() {
  // Initialize LiFi SDK globally with fee: 0 BEFORE creating widget config
  // This ensures the SDK is configured before the widget makes any API calls
  useMemo(() => {
    if (typeof window !== 'undefined') {
      try {
        createConfig({
          integrator: 'Morpheus-NoFee',
          routeOptions: {
            fee: 0, // Explicitly disable integrator fees at global SDK level
          },
        })
      } catch (error) {
        // SDK might already be initialized, that's okay
        console.warn('LiFi SDK initialization:', error)
      }
    }
  }, [])

  const widgetConfig: WidgetConfig = useMemo(
    () => ({
      variant: 'wide',
      appearance: 'dark',
      // Try using a test integrator name to see if backend fees are the issue
      // If this works, then "Morpheus" likely has backend fees configured
      integrator: 'Morpheus-NoFee',
      // Do NOT set sdkConfig.routeOptions.fee at all
      // Setting it to 0 might still trigger fee logic
      // Omitting it entirely should prevent any fees from being applied
      // sdkConfig: {
      //   routeOptions: {
      //     fee: 0, // Removed - omitting fee entirely
      //   },
      // },
      // Hide integrator fee UI since we're not charging fees
      hiddenUI: ['integratorStepDetails'],
      // Default bridge: MOR on Arbitrum -> MOR on Base
      fromChain: 42161, // Arbitrum One
      toChain: 8453, // Base
      fromToken: '0x092baadb7def4c3981454dd9c0a0d7ff07bcfc86', // MOR on Arbitrum
      toToken: '0x7431ada8a591c955a994a21710752ef9b882b8e3', // MOR on Base
      buildUrl: true, // keep URL in sync with initialized values
      // Restrict to only EVM chains - Ethereum, Arbitrum, and Base
      // This configuration ensures only EVM wallets are shown
      chains: {
        allow: [1, 42161, 8453], // Ethereum Mainnet, Arbitrum One, Base
      },
      theme: {
        colorSchemes: {
          light: {
            palette: {
              primary: {
                main: '#5C67FF',
              },
              secondary: {
                main: '#F7C2FF',
              },
            },
          },
          dark: {
            palette: {
              primary: {
                main: '#20dc8e',
              },
              secondary: {
                main: '#179c65',
              },
              success: {
                main: '#20dc8e',
              },
              info: {
                main: '#29ffc9',
              },
            },
          },
        },
        typography: {
          fontFamily: 'Inter, sans-serif',
        },
        container: {
          boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.08)',
          borderRadius: '16px',
        },
        shape: {
          borderRadius: 8,
        },
      },
      // Add custom tokens for MOR across networks - ensure they are featured prominently
      tokens: {
        featured: [
          {
            address: '0x092baadb7def4c3981454dd9c0a0d7ff07bcfc86',
            chainId: 42161,
            name: 'MorpheusAI',
            symbol: 'MOR',
            decimals: 18,
            logoURI:
              'https://assets.coingecko.com/coins/images/37969/standard/MOR200X200.png?1716327119',
          },
          {
            address: '0x7431ada8a591c955a994a21710752ef9b882b8e3',
            chainId: 8453,
            name: 'MorpheusAI',
            symbol: 'MOR',
            decimals: 18,
            logoURI:
              'https://assets.coingecko.com/coins/images/37969/standard/MOR200X200.png?1716327119',
          },
          {
            address: '0xcbb8f1bda10b9696c57e13bc128fe674769dcec0',
            chainId: 1,
            name: 'MorpheusAI',
            symbol: 'MOR',
            decimals: 18,
            logoURI:
              'https://assets.coingecko.com/coins/images/37969/standard/MOR200X200.png?1716327119',
          },
        ],
      },
      // Wallet configuration for EVM chains ONLY
      walletConfig: {
        // Explicitly configure wallet ecosystem order to prevent Solana prompts
        // This tells MetaMask and other multi-chain wallets to ONLY use EVM
        walletEcosystemsOrder: {
          MetaMask: [ChainType.EVM], // Only EVM, explicitly omit SVM (Solana)
          'Coinbase Wallet': [ChainType.EVM],
          Phantom: [ChainType.EVM], // If Phantom is detected, use only EVM mode
          Trust: [ChainType.EVM],
          'Rabby Wallet': [ChainType.EVM],
          Brave: [ChainType.EVM],
        },
        // Force using EVM connect flow by delegating to injected provider
        // This bypasses any internal multi-ecosystem prompts
        async onConnect() {
          try {
            if (typeof window !== 'undefined') {
              const eth = (window as unknown as { ethereum?: { request: (args: { method: string }) => Promise<unknown> } }).ethereum
              if (eth?.request) {
                await eth.request({ method: 'eth_requestAccounts' })
              }
            }
          } catch (_err) {
            // no-op; widget will still show its menu if this fails
          }
        },
        walletConnect: {
          projectId:
            process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '0000000000000000000000000000000',
        },
      },
    }),
    [],
  )

  return (
    <ClientOnly fallback={<WidgetSkeleton config={widgetConfig} />}>
      <LiFiWidget config={widgetConfig} integrator='Morpheus-NoFee' />
    </ClientOnly>
  )
}
```

## 🧭 Navigation Update

Update the navigation component (`components/nav.tsx`) to include the Buy/Bridge MOR button:

**Find the existing "Buy MOR" button and replace it with:**

```tsx
// Replace the existing CoinGecko button with internal route
<Button
  as={Link}
  href="/buy-mor"
  variant="outline"
  colorScheme="green"
  size="sm"
  mr={4}
>
  Buy / Bridge MOR
</Button>
```

## 🚀 Setup Steps

### 1. Install Dependencies
```bash
npm install @lifi/widget@^3.33.1 wagmi@^2.18.1 @tanstack/react-query@^5.90.5 viem@^2.38.3
```

### 2. Configure Next.js
Update `next.config.ts` with the webpack configuration shown above to handle optional dependencies.

### 3. Set Environment Variables
Create `.env.local` with your WalletConnect project ID.

### 4. Create Component Files
Create all the component files in `components/lifi/` directory as shown above.

### 5. Create the Page
Create the `/buy-mor` route in `app/(marketing)/buy-mor/page.tsx`.

### 6. Update Navigation
Modify `components/nav.tsx` to link to the new `/buy-mor` page instead of external CoinGecko.

### 7. Test the Integration
- Run the development server: `npm run dev`
- Navigate to `/buy-mor`
- Test wallet connection and token swapping/bridging

## 🔧 MOR Token Configuration

| Network   | Chain ID | Address                                      |
|-----------|----------|----------------------------------------------|
| Ethereum  | 1        | `0xcbb8f1bda10b9696c57e13bc128fe674769dcec0` |
| Arbitrum  | 42161    | `0x092baadb7def4c3981454dd9c0a0d7ff07bcfc86` |
| Base      | 8453     | `0x7431ada8a591c955a994a21710752ef9b882b8e3` |

## 🎨 Theme Configuration

The widget uses a custom dark theme with Morpheus brand colors:
- **Primary**: `#20dc8e`
- **Secondary**: `#179c65`
- **Success**: `#20dc8e`
- **Info**: `#29ffc9`
- **Font**: `Inter, sans-serif`

## 🔗 Supported Chains

The widget is configured to work with:
- **Ethereum Mainnet** (Chain ID: 1)
- **Arbitrum One** (Chain ID: 42161)
- **Base** (Chain ID: 8453)

## 💰 Fee Configuration

The widget is configured to avoid integrator fees by:
1. Setting `integrator: 'Morpheus-NoFee'` (test integrator name)
2. Initializing LiFi SDK with `fee: 0` globally
3. Omitting `sdkConfig.routeOptions.fee` entirely
4. Hiding integrator fee UI with `hiddenUI: ['integratorStepDetails']`

## 📚 Additional Resources

- [LiFi Widget Documentation](https://docs.li.fi/widget/overview)
- [LiFi SDK Documentation](https://docs.li.fi/li.fi-sdk/overview)
- [Wagmi Documentation](https://wagmi.sh/)
- [WalletConnect Cloud](https://cloud.walletconnect.com/)

## 🐛 Troubleshooting

### Common Issues:
1. **SSR Errors**: Ensure `ClientOnly` wrapper is used
2. **Wallet Connection Issues**: Check WalletConnect project ID
3. **Styling Issues**: Widget styles are bundled, no additional CSS needed
4. **Fee Issues**: Use the "Morpheus-NoFee" integrator name

### Support:
- LiFi Discord: https://discord.gg/lifi
- LiFi Documentation: https://docs.li.fi
