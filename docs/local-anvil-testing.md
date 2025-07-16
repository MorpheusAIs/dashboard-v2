# Local Anvil Testing Setup

This feature allows you to test the Morpheus Dashboard against local Anvil forks of Arbitrum and Base networks with your deployed contracts.

## Features

- **Auto-detection**: The app automatically detects when you're connected to localhost RPCs and switches to local test mode
- **Visual indicators**: Clear UI indicators show when you're in local test mode
- **Contract mapping**: Automatically uses your local contract addresses when connected to local RPCs
- **Seamless switching**: Switch between mainnet, testnet, and local test environments
- **Local Data Indexing**: Reads data directly from local contracts, replacing GraphQL queries
- **Real-time Updates**: Automatically discovers new subnets/pools created on local networks

## Local Data Indexing

### Problem Solved
When using local Anvil forks, the remote GraphQL endpoints won't have data about your local activities (subnet creation, staking, withdrawals). This feature automatically switches to reading data directly from your local contracts.

### How It Works
1. **Event Discovery**: Scans for `SubnetCreated` and `BuilderPoolCreated` events
2. **Contract Reading**: Reads current state from local contracts using wagmi/viem
3. **Data Transformation**: Converts contract data to GraphQL-compatible format
4. **Seamless Integration**: Existing UI components work without changes

### Supported Contract Functions
- **BuilderSubnetsV2**: `subnets()`, `subnetsMetadata()`, `subnetsData()`, `stakers()`
- **Builders**: `builderPools()`, `buildersPoolData()`, `usersData()`
- **Event Listening**: Creation, staking, withdrawal events

## Setup

### 1. Start Anvil Forks

Start your Arbitrum and Base forks with the contract addresses you provided:

```bash
# Terminal 1 - Arbitrum Fork (Port 8545)
anvil --fork-url https://arb1.arbitrum.io/rpc --port 8545

# Terminal 2 - Base Fork (Port 8546)  
anvil --fork-url https://mainnet.base.org --port 8546
```

### 2. Deploy Your Contracts

Deploy your contracts to the local forks using the addresses you provided:

**Arbitrum (127.0.0.1:8545):**
- MOR Token: `0x36fE2E7a1c19F7Be268272540E9A4aB306686506`
- Builders: `0xEA02B7528F2f07B0F6Eb485C56d182B311B80284`

**Base (127.0.0.1:8546):**
- MOR Token: `0x7511fAE41153Fad8A569d7Ebdcc76c120D3d5AAb`
- Builders: `0x17073Da1E92008eAE64cd5D3e8129F7928D3b362`

### 3. Connect Your Wallet

1. In MetaMask or your wallet, add the local networks:
   - **Local Arbitrum**: RPC URL `http://127.0.0.1:8545`, Chain ID `42161`
   - **Local Base**: RPC URL `http://127.0.0.1:8546`, Chain ID `8453`

2. Import one of the Anvil test accounts using the private keys provided

3. Switch your wallet to one of the local networks

### 4. Auto-Detection & Data Indexing

When you connect to a local RPC, the dashboard will:
- ✅ Automatically detect the local environment
- ✅ Switch to `local_test` mode
- ✅ Use your local contract addresses
- ✅ Show "LOCAL TEST MODE" indicator
- ✅ **Scan for existing subnets/pools** from contract events
- ✅ **Read live data** from local contracts
- ✅ **Display local data** in existing UI components

## Local Data Features

### Debug Component
The app includes a debug component that shows:
- **Real-time Contract Data**: Subnets and pools discovered from your local contracts
- **Event Discovery**: Shows what the indexer found from blockchain events
- **Data Refresh**: Manual refresh button to re-scan contracts
- **Debug Information**: Raw contract data and discovery logs

### Data Sources
- **Mainnet/Testnet**: Remote GraphQL APIs (existing behavior)
- **Local Test**: Direct contract reading with event discovery
- **Automatic Switching**: No code changes needed in UI components

### Supported Operations
- ✅ **Create Subnet**: Automatically appears in UI after creation
- ✅ **Stake/Withdraw**: Real-time balance updates
- ✅ **View Subnet Details**: Full metadata and staking data
- ✅ **User Data**: Your staking positions and history
- 🚧 **Event History**: Partial support (TODO: full event parsing)

## Usage

### Viewing Local Data
1. Navigate to `/builders` page
2. When connected to local RPC, you'll see:
   - **Orange debug panel** showing discovered contracts
   - **Real data** from your local blockchain
   - **Live updates** when you create/modify subnets

### Creating Subnets
1. Use the "Create Subnet" button as normal
2. After transaction confirms, subnet appears automatically
3. Debug panel shows the new subnet immediately

### Manual Environment Switching

You can also manually switch environments in the network context:

```typescript
const { switchToEnvironment } = useNetwork();

// Switch to local test mode
await switchToEnvironment('local_test');
```

### Environment Detection

The app detects environments based on:
- **Local Test**: RPC contains `localhost` or `127.0.0.1`
- **Testnet**: Chain ID matches known testnets (Sepolia, etc.)
- **Mainnet**: Default for all other cases

### Available Environments

- `mainnet`: Production networks (Arbitrum, Base, Ethereum)
- `testnet`: Test networks (Arbitrum Sepolia, etc.)
- `local_test`: Local Anvil forks

## Development

### Local Data Service
Key files:
- `app/services/local-data.service.ts` - Contract reading and event discovery
- `app/services/graphql-client.adapter.ts` - Switches between data sources
- `components/debug/local-data-debug.tsx` - Debug UI component

### Adding New Local Contracts

To add more local contracts, update `config/networks.ts`:

```typescript
export const localTestChains: Record<string, ChainConfig> = {
  arbitrum: {
    // ... existing config
    contracts: {
      morToken: toContract('0x36fE2E7a1c19F7Be268272540E9A4aB306686506'),
      builders: toContract('0xEA02B7528F2f07B0F6Eb485C56d182B311B80284'),
      // Add your new contract here
      newContract: toContract('0xYourNewContractAddress'),
    },
  },
};
```

### Extending Data Discovery

To add new event types or contract functions:

```typescript
// In local-data.service.ts
const discoverNewEventType = async () => {
  const logs = await publicClient.getLogs({
    address: contractAddress,
    event: {
      type: 'event', 
      name: 'YourNewEvent',
      inputs: [/* your event signature */]
    },
    fromBlock: 'earliest',
    toBlock: 'latest',
  });
  // Process logs...
};
```

### Debugging

The app logs environment changes and data discovery to the console:
```
🔄 Auto-detected environment change: mainnet → local_test
🔗 Connected to RPC: http://127.0.0.1:8545
🏷️  Chain ID: 42161
🔍 Discovering created subnets/pools from events...
📝 Found subnet: My Test Subnet (0x1234...)
✅ Loaded 1 subnets and 0 pools
```

## Troubleshooting

### Data Issues
1. **No subnets showing**: Check debug panel for discovery logs
2. **Stale data**: Use refresh button in debug panel
3. **Missing events**: Ensure contracts deployed correctly

### Connection Issues
1. **Not switching automatically**: Ensure your wallet is connected to `127.0.0.1` or `localhost` RPC
2. **Wrong contracts**: Verify the contract addresses in `config/networks.ts` match your deployments
3. **Connection issues**: Check that Anvil is running on the correct ports (8545/8546)

### Contract Issues
1. **Contract not found**: Verify deployment addresses match configuration
2. **Function call fails**: Check that contract ABIs match deployed contracts
3. **No events found**: Ensure you've created at least one subnet/pool

## Test Accounts

Use these Anvil test accounts (same for both forks):
```
Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   UI Components │    │  GraphQL Adapter │    │ Data Sources    │
│                 │    │                  │    │                 │
│ - Builders Page │───▶│ - Auto-detects   │───▶│ - GraphQL API   │
│ - Subnet Detail │    │   environment    │    │ - Local Contracts│
│ - Debug Panel   │    │ - Switches source│    │ - Event Indexing│
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

The system seamlessly switches between remote GraphQL APIs and local contract reading based on your network connection, providing a unified development experience.