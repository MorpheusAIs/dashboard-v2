# Tenderly Virtual Testnet Integration

This document provides instructions for setting up and using Tenderly Virtual Testnets with the Morpheus Dashboard.

## Overview

The Tenderly Virtual Testnet integration allows you to use a Virtual Testnet as a chain for UI development, testing, and dapp demo mode. This integration is based on the [official Tenderly documentation](https://docs.tenderly.co/virtual-testnets/dapp-ui/reown-app-kit).

## Prerequisites

1. A Tenderly account and Virtual TestNet created in Tenderly Dashboard
2. Environment variables configured in your `.env.local` file

## Setup Instructions

### 1. Create a Virtual TestNet

In your Tenderly Dashboard:

1. Create a new Virtual TestNet
2. Select **Mainnet** as the base network
3. Name it (e.g., `Morpheus Virtual TestNet`)
4. Choose a unique chain ID (e.g., `73571`)
5. Turn on the **Public Explorer**
6. Copy the **Testnet RPC URL** and **Block Explorer URL**

### 2. Configure Environment Variables

Add the following variables to your `.env.local` file:

```env
# Tenderly Virtual TestNet Configuration
TENDERLY_VIRTUAL_TESTNET_RPC="https://virtual.mainnet.rpc.tenderly.co/your-rpc-url"
NEXT_PUBLIC_TENDERLY_VNETS_ENABLED=true
```

Replace `your-rpc-url` with the actual RPC URL from your Tenderly Virtual TestNet.

### 3. Update Tenderly Configuration

Edit `config/tenderly.ts` to match your Virtual TestNet settings:

```typescript
export const tenderlyVirtualTestnet = defineChain({
  id: 73571, // Replace with your actual Virtual TestNet chain ID
  name: 'Morpheus Virtual Testnet', // Update the name
  // ... other configuration
  rpcUrls: {
    default: {
      http: [process.env.TENDERLY_VIRTUAL_TESTNET_RPC || 'your-fallback-rpc-url'],
    }
  },
  blockExplorers: {
    default: {
      name: 'Tenderly Explorer',
      url: 'https://dashboard.tenderly.co/explorer/vnet/your-virtual-testnet-id', // Replace with your actual explorer URL
    }
  }
});
```

## Usage

### Enabling/Disabling Tenderly Virtual Testnet

The Tenderly Virtual Testnet is conditionally enabled based on environment variables:

- **To Enable**: Set `NEXT_PUBLIC_TENDERLY_VNETS_ENABLED=true` and provide a valid `TENDERLY_VIRTUAL_TESTNET_RPC`
- **To Disable**: Set `NEXT_PUBLIC_TENDERLY_VNETS_ENABLED=false` or remove the environment variables

### Running the Application

```bash
# With Tenderly Virtual Testnet enabled
NEXT_PUBLIC_TENDERLY_VNETS_ENABLED=true \
TENDERLY_VIRTUAL_TESTNET_RPC="your-rpc-url" \
npm run dev
```

### Switching Networks

When Tenderly Virtual Testnet is enabled:

1. The Virtual TestNet will be available in the network switcher
2. The Virtual TestNet will be set as the default chain when enabled
3. Users can switch between mainnet, testnets, and the Virtual TestNet

## Integration Details

### Files Modified

1. **`config/tenderly.ts`** - Tenderly chain configuration
2. **`config/networks.ts`** - Updated to include Tenderly in testnet chains
3. **`config/index.tsx`** - Updated Wagmi configuration to include Tenderly
4. **`context/index.tsx`** - Updated Web3Modal context to support Tenderly

### Key Features

- **Conditional Loading**: Virtual TestNet is only loaded when enabled via environment variables
- **Dynamic Configuration**: RPC URLs and explorer URLs are configurable via environment variables
- **Seamless Integration**: Works with existing network switching and wallet connection logic
- **Type Safety**: Full TypeScript support with proper type definitions

## Testing

### Local Development

1. Set up your Virtual TestNet in Tenderly Dashboard
2. Configure environment variables
3. Run the development server
4. Connect your wallet and switch to the Virtual TestNet
5. Test your DApp functionality

### Demo Mode

The Virtual TestNet is particularly useful for:

- **UI Development**: Test UI components without spending real ETH
- **Demo Presentations**: Show your DApp functionality without mainnet costs
- **User Testing**: Allow users to test features without financial risk
- **Integration Testing**: Test contract interactions in a controlled environment

## Troubleshooting

### Common Issues

1. **Virtual TestNet not appearing in network list**
   - Verify `NEXT_PUBLIC_TENDERLY_VNETS_ENABLED=true`
   - Check that `TENDERLY_VIRTUAL_TESTNET_RPC` is set correctly
   - Restart the development server

2. **RPC connection errors**
   - Verify the RPC URL is correct and accessible
   - Check that your Virtual TestNet is running in Tenderly Dashboard
   - Ensure there are no network connectivity issues

3. **Transaction failures**
   - Ensure your Virtual TestNet has sufficient balance
   - Check that contract addresses are correct for the Virtual TestNet
   - Verify gas settings are appropriate

### Debug Information

You can check if Tenderly is enabled by looking at the console logs or checking the network switcher in the UI.

## Advanced Configuration

### Adding Morpheus Contracts

If you deploy Morpheus contracts to your Virtual TestNet, update the configuration:

```typescript
// In config/tenderly.ts
export const tenderlyVirtualTestnetConfig = {
  ...tenderlyVirtualTestnet,
  contracts: {
    morToken: toContract('0x...'), // Your deployed MOR token address
    l1Factory: toContract('0x...'), // Your deployed factory address
    // ... other contract addresses
  },
  isL1: true,
  layerZeroEndpointId: undefined, // Set if LayerZero is available
};
```

### Multiple Virtual TestNets

To support multiple Virtual TestNets, you can:

1. Create additional chain configurations in `config/tenderly.ts`
2. Add additional environment variables for each testnet
3. Update the conditional logic in `networks.ts` to include multiple testnets

## Resources

- [Tenderly Virtual TestNets Documentation](https://docs.tenderly.co/virtual-testnets)
- [Reown AppKit Documentation](https://docs.reown.com/appkit)
- [Wagmi Documentation](https://wagmi.sh)

## Support

If you encounter issues with the Tenderly Virtual TestNet integration:

1. Check the Tenderly Dashboard for Virtual TestNet status
2. Verify environment variable configuration
3. Review the browser console for error messages
4. Check the network tab for RPC connection issues
