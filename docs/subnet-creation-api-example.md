# Subnet Creation API Example

This document shows how to use the subnet creation API from an external application to create subnets on Base Sepolia.

## API Endpoints

### Get Subnet Creation Options
```
GET /api/create-subnet
```
Returns available options for subnet creation including skills, input/output types, and subnet types.

### Alternative Options Endpoint
```
GET /api/subnet-options
```
Dedicated endpoint for subnet creation options.

### Create Subnet
```
POST /api/create-subnet
```

## CORS Configuration

The API includes CORS headers to allow cross-origin requests:

- **Allowed Origins**: `*` (all origins)
- **Allowed Methods**: `GET, POST, OPTIONS`
- **Allowed Headers**: `Content-Type`

This enables external applications running on different ports/origins to call the API without CORS errors.

## Data Serialization

The API automatically handles BigInt serialization for blockchain data:

- **BigInt Values**: Automatically converted to strings in JSON responses
- **Transaction Data**: All numeric values (chainId, gas, etc.) are properly serialized
- **Contract Parameters**: BigInt values in contract calls are handled correctly

This ensures compatibility with JavaScript's JSON.stringify() limitations.

## Request Format

```typescript
interface CreateSubnetRequest {
  name: string;                    // Subnet name (required, min 1 char)
  minStake: number;                // Minimum stake in ETH (required, >= 0)
  withdrawLockPeriod: number;      // Lock period in days (required, >= 7)
  claimAdmin: string;              // Ethereum address for claim admin (required, valid address)
  description: string;             // Subnet description (required, 1-3000 chars)
  website: string;                 // Website URL (required, valid URL)
  image?: string;                  // Logo image URL (optional, valid URL)
  slug?: string;                   // URL slug (optional, lowercase alphanumeric with hyphens)
  adminAddress: string;            // Admin Ethereum address (required, valid address)
  metadata_?: {                    // Extended metadata for non-App subnets (Base Sepolia only)
    description?: string;          // Extended description
    endpointUrl?: string;          // API endpoint URL where the service can be accessed
    author?: string;               // Author name
    inputType?: 'text' | 'image' | 'audio' | 'video';  // Input type
    outputType?: 'text' | 'image' | 'audio' | 'video'; // Output type
    skills?: string[];             // Array of skills
    type?: string;                 // Subnet type (Agent, API, MCP server)
    category?: string;             // Category (AI Assistant, Data Processing, etc.)
  };
}
```

## Getting Available Options

Before creating a subnet, you can fetch the available options:

```javascript
// Get subnet creation options including skills
const optionsResponse = await fetch('/api/create-subnet');
const { options } = await optionsResponse.json();

console.log('Available skills:', options.skills);
console.log('Available input types:', options.inputTypes);
console.log('Available subnet types:', options.subnetTypes);
```

This returns:
```javascript
{
  options: {
    skills: [
      { label: 'image2text', value: 'image2text' },
      { label: 'text generation', value: 'text_generation' },
      // ... all available skills
    ],
    inputTypes: [
      { label: 'Text', value: 'text' },
      { label: 'Image', value: 'image' },
      // ... input/output type options
    ],
    subnetTypes: [
      { label: 'App', value: 'App' },
      { label: 'Agent', value: 'Agent' },
      // ... subnet type options
    ]
  },
  schema: { /* field information */ }
}
```

## Example Request

```javascript
const subnetData = {
  name: "My Awesome Subnet",
  minStake: 0.001,
  withdrawLockPeriod: 7,
  claimAdmin: "0x742d35Cc6469F1A1A5a2B2e5C5F5f5f5f5f5f5f",
  description: "A subnet for testing awesome features",
  website: "https://my-subnet.com",
  image: "https://my-subnet.com/logo.png",
  adminAddress: "0x742d35Cc6469F1A1A5a2B2e5C5F5f5f5f5f5f5f",
  // Optional: Extended metadata for Agent/API/MCP server subnets
  metadata_: {
    description: "An advanced AI assistant that helps with data processing",
    endpointUrl: "https://api.example.com/v1/chat",
    author: "My Team",
    inputType: "text",
    outputType: "text",
    skills: ["text_generation", "data_analysis"],
    type: "Agent",
    category: "AI Assistant"
  }
};

const response = await fetch('/api/create-subnet', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(subnetData)
});

const result = await response.json();
```

## Response Format

```typescript
interface CreateSubnetResponse {
  transaction: {
    to: string;      // Builders contract address
    data: string;    // Encoded function call data
    chainId: number; // Base Sepolia chain ID (84532)
    value: string;   // Always "0x0" (fee paid via token)
  };
  requirements: {
    network: {
      chainId: number;  // 84532
      name: string;     // "Base Sepolia"
    };
    tokenApproval: {
      tokenAddress: string;     // MOR token address
      spenderAddress: string;   // Builders contract address
      amount: string;           // Fee amount in wei (0.1 MOR)
    };
    gasEstimate: string;        // Suggested gas limit
  };
  signingUrls: {
    metaMask: string;  // MetaMask deep link URL
    eip681: string;    // EIP-681 URI (limited for complex tx)
  };
  instructions: string[];  // Step-by-step instructions
}
```

## Usage with WalletConnect

```javascript
import { EthereumProvider } from '@walletconnect/ethereum-provider';

// 1. Get transaction data from API
const result = await fetch('/api/create-subnet', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(subnetData)
});

const { transaction, requirements } = await result.json();

// 2. Check network (user must be on Base Sepolia)
if (window.ethereum.chainId !== `0x${requirements.network.chainId.toString(16)}`) {
  // Request network switch
  await window.ethereum.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: `0x${requirements.network.chainId.toString(16)}` }],
  });
}

// 3. Approve MOR token spending (required before subnet creation)
const approvalTx = {
  to: requirements.tokenApproval.tokenAddress,
  data: `0x095ea7b3${  // approve function signature
    requirements.tokenApproval.spenderAddress.slice(2).padStart(64, '0') +
    BigInt(requirements.tokenApproval.amount).toString(16).padStart(64, '0')
  }`,
  value: '0x0'
};

await window.ethereum.request({
  method: 'eth_sendTransaction',
  params: [approvalTx],
});

// 4. Create the subnet
const txHash = await window.ethereum.request({
  method: 'eth_sendTransaction',
  params: [transaction],
});

console.log('Subnet creation transaction:', txHash);
```

## Usage with MetaMask Deep Links

```javascript
// 1. Get the signing URL from API response
const { signingUrls } = await result.json();

// 2. Redirect user to MetaMask
window.location.href = signingUrls.metaMask;
```

## Usage with EIP-681 (Limited)

EIP-681 is not well-suited for complex smart contract calls like `createSubnet`, but here's how you could construct it manually:

```javascript
const eip681Url = `ethereum:${buildersContractAddress}@${baseSepolia.id}?function=createSubnet`;
window.location.href = eip681Url;
```

However, EIP-681 cannot handle complex struct parameters, so it's not recommended for this use case.

## Important Notes

1. **Network**: User must be on Base Sepolia (chain ID 84532)
2. **Token Approval**: MOR token approval is required before creating subnet
3. **Gas**: Transaction requires ~1M gas units
4. **Fee**: 0.1 MOR tokens on Base Sepolia (0 on Base mainnet)
5. **Validation**: All inputs are validated server-side
6. **Error Handling**: Check response status and handle validation errors

## Error Responses

```typescript
// Validation Error (400)
{
  error: 'Validation failed',
  details: {
    field: { _errors: ['Error message'] }
  }
}

// Server Error (500)
{
  error: 'Internal server error'
}
```