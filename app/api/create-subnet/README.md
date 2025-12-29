# Subnet Creation API

This API endpoint allows external applications to create subnets on Base Sepolia by generating the necessary transaction data.

## Endpoint

```
POST /api/create-subnet
```

## Purpose

The simplest way for external applications to create subnets is through this API, which:

1. Validates input parameters
2. Generates the correct contract call data
3. Returns transaction objects that can be used with:
   - MetaMask (via deep links)
   - WalletConnect
   - Direct web3 calls

## Why This Approach?

- **EIP-681**: Too limited for complex smart contract calls with struct parameters
- **Direct ABI calls**: Requires external apps to maintain contract ABIs and handle encoding
- **This API**: Handles all the complexity server-side and returns ready-to-use transaction data

## Authentication

Currently, this endpoint is open (no authentication required). Consider adding API keys or other authentication if needed for production use.

## Rate Limiting

No rate limiting is currently implemented. Add as needed based on usage patterns.

## Error Handling

The API returns standard HTTP status codes:
- `200`: Success
- `400`: Validation error (check `details` field)
- `500`: Server error

## Contract Details

- **Network**: Base Sepolia (chain ID: 84532)
- **Contract**: BuildersV4 at `0x6C3401D71CEd4b4fEFD1033EA5F83e9B3E7e4381`
- **Function**: `createSubnet(subnet, metadata)`
- **Fee**: Dynamically queried from contract via `subnetCreationFeeAmount()` (paid via token approval)
- **Token**: MOR at `0x5c80ddd187054e1e4abbffcd750498e81d34ffa3`

> **Note**: The API automatically queries the current creation fee from the BuildersV4 contract. External applications should use the `requirements.tokenApproval.amount` value from the API response rather than hardcoding any fee amount.

## Flow for External Apps

1. Collect subnet parameters from user
2. POST to this API endpoint
3. Handle token approval (MOR spending)
4. Submit the returned transaction
5. Monitor for confirmation

See `docs/subnet-creation-api-example.md` for detailed usage examples.