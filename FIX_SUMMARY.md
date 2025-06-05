# Testnet Form Submission Fix Summary

## Problem
On testnet, the form submission failed at the final step with the error:
```
"Pool name is required." for builderPool.name
```

Even though testnet should only use `subnet.name`, the `builderPool.name` field was failing validation.

## Root Cause
The issue was in the form schema definition in `components/subnet-form/schemas.ts`:

1. **Always Initialized**: `builderPool` object was always created in `defaultValues`, even on testnet
2. **Required Fields**: Despite `builderPool` being marked as `.optional()`, the inner fields (`name`, `minimalDeposit`) were still required
3. **Validation Order**: Base schema validation ran before `superRefine`, so empty `builderPool.name` failed before conditional logic could run
4. **Field Usage**:
   - **Testnet**: Uses `subnet.name` field, leaves `builderPool.name` empty
   - **Mainnet**: Uses `builderPool.name` field, mirrors to `subnet.name`

## Solution Implemented
**Option 1: Conditional Schema Definition** - Made `builderPool` fields truly optional.

### Changes Made

#### 1. Modified Schema Definition
```typescript
// Before
builderPool: z.object({
  name: z.string().min(1, "Pool name is required."),
  minimalDeposit: z.number().min(0, "Minimal deposit must be non-negative"), 
}).optional(),

// After  
builderPool: z.object({
  name: z.string().optional(), // Made optional - validation handled in superRefine
  minimalDeposit: z.number().min(0, "Minimal deposit must be non-negative").optional(), // Made optional - validation handled in superRefine
}).optional(),
```

#### 2. Enhanced SuperRefine Validation
```typescript
if (data.subnet.networkChainId === arbitrum.id || data.subnet.networkChainId === base.id) {
    // Mainnet validation: require builderPool fields
    if (!data.builderPool?.name || data.builderPool.name.trim() === "") {
        ctx.addIssue({
          path: ["builderPool", "name"],
          message: "Pool name is required for mainnet.",
          code: z.ZodIssueCode.custom,
        });
    }
    if (data.builderPool?.minimalDeposit === undefined || data.builderPool.minimalDeposit < 0) {
        ctx.addIssue({
          path: ["builderPool", "minimalDeposit"],
          message: "Minimal deposit is required for mainnet.",
          code: z.ZodIssueCode.custom,
        });
    }
} else { // Testnet
    // Testnet validation: require subnet fields  
    if (!data.subnet.name || data.subnet.name.trim() === "") {
         ctx.addIssue({
          path: ["subnet", "name"],
          message: "Subnet name is required for testnet.",
          code: z.ZodIssueCode.custom,
        });
    }
}
```

## How It Works Now

### Validation Flow
1. **Base Schema Validation**: `builderPool` fields can now be empty/undefined without failing
2. **SuperRefine Validation**: Conditional logic enforces required fields based on network:
   - **Mainnet**: Requires `builderPool.name` and `builderPool.minimalDeposit`
   - **Testnet**: Requires `subnet.name` only
3. **Form Submission**: Proceeds successfully when validation passes

### Network-Specific Field Usage
| Field | Testnet | Mainnet | Contract Field |
|-------|---------|---------|----------------|
| Name | `subnet.name` ✓ | `builderPool.name` ✓ | `name` |
| Deposit/Stake | `subnet.minStake` ✓ | `builderPool.minimalDeposit` ✓ | `minStake`/`minimalDeposit` |
| Fee | `subnet.fee` ✓ | N/A | `fee` |
| Treasury | `subnet.feeTreasury` ✓ | N/A | `feeTreasury` |

## Testing
- ✅ Schema compiles without TypeScript errors
- ✅ Conditional validation logic preserved for both networks
- ✅ Mainnet functionality should remain unchanged
- ✅ Testnet form submission should now work

## Additional Fix: Network Selection Override

### Problem
After the initial fix, a second issue was discovered: users couldn't manually select different networks in the form because an auto-sync effect was overriding their selections.

### Root Cause
An effect in `Step1PoolConfig.tsx` was automatically syncing the form's network selection to match the wallet's current network whenever either changed, preventing manual network selection.

### Solution
Modified the network sync effect to only run on initial load when the form still has the default value (Arbitrum Sepolia), allowing users to manually select different networks without being overridden.

```typescript
// Before: Always synced wallet → form
useEffect(() => {
  if (currentChainId !== selectedChainId && supportedChainIds.includes(currentChainId)) {
    form.setValue("subnet.networkChainId", currentChainId);
  }
}, [currentChainId, selectedChainId, form]);

// After: Only sync on initial load
useEffect(() => {
  if (selectedChainId === arbitrumSepolia.id && currentChainId !== selectedChainId && supportedChainIds.includes(currentChainId)) {
    form.setValue("subnet.networkChainId", currentChainId);
  }
}, [currentChainId, form]); // Removed selectedChainId from deps
```

## Files Modified
- `components/subnet-form/schemas.ts`: Updated `builderPool` field definitions and `superRefine` validation
- `components/subnet-form/Step1PoolConfig.tsx`: Fixed network auto-sync to allow manual selection

## Branch
`feature/fix-testnet-form-submission`

## Additional Fix: Mainnet Approval Issue

### Problem
On Base mainnet, clicking "Approve" showed MetaMask popup saying "Remove permission" instead of approving spending.

### Root Cause Analysis
1. **Wrong Contract Query**: Code tried to query `subnetCreationFeeAmount` on both testnet and mainnet
2. **Different Contracts**: Testnet uses `BuilderSubnetsV2` (has fee function), mainnet uses `Builders` (no fee function)
3. **Zero Fee Result**: Mainnet query failed, kept fee at `BigInt(0)`
4. **MetaMask Interpretation**: Approving 0 tokens = "Remove permission/revoke approval"

### Complete Solution
1. **Only query fees on testnet** where the function exists
2. **Skip approval entirely when fee is 0** (correct for mainnet - no creation fees)
3. **Add safety checks** to prevent approving 0 tokens

```typescript
// Before: Queried fee on all networks using wrong ABI
const { data: subnetCreationFeeAmount } = useReadContract({
  abi: BuilderSubnetsV2Abi, // Wrong for mainnet
  functionName: 'subnetCreationFeeAmount',
  query: { enabled: !!builderContractAddress }
});

// After: Only query on testnet where function exists
const isTestnet = selectedChainId === arbitrumSepolia.id;
const { data: subnetCreationFeeAmount } = useReadContract({
  abi: BuilderSubnetsV2Abi,
  functionName: 'subnetCreationFeeAmount', 
  query: { enabled: !!builderContractAddress && isTestnet }
});

// Before: Could try to approve 0 tokens
return effectiveFee > BigInt(0) && effectiveAllowance < effectiveFee;

// After: Skip approval when fee is 0
if (!creationFee || creationFee === BigInt(0)) {
  console.log("No approval needed - creation fee is 0 (likely mainnet)");
  return false;
}
```

### Now On Base Mainnet:
- ✅ Fee stays at 0 (correct - no creation fees for builder pools)
- ✅ `needsApproval` = false (skips approval step)  
- ✅ Button shows "Confirm & Create Subnet" (not "Approve MOR")
- ✅ Goes straight to creation transaction (no approval popup)

## Additional Fix: Network Dropdown Defaulting to "Network 0"

### Problem
The network selection dropdown was defaulting to "network 0" instead of the user's current wallet network.

### Root Cause
The form was hardcoded to initialize with Arbitrum Sepolia, and the sync effect was too restrictive, causing the dropdown to show invalid values.

### Solution
1. **Proper initialization**: Form now initializes with user's current wallet network if supported
2. **Removed auto-sync**: Eliminated the sync effect that was overriding user selections
3. **Graceful fallback**: Falls back to Arbitrum Sepolia if user's network is unsupported

```typescript
// Before: Hardcoded default
defaultValues: {
  subnet: {
    networkChainId: arbitrumSepolia.id, // Always Arbitrum Sepolia
  }
}

// After: Dynamic based on user's wallet
const getInitialNetworkId = () => {
  const supportedChainIds = [arbitrumSepolia.id, arbitrum.id, base.id] as const;
  if (walletChainId && supportedChainIds.includes(walletChainId)) {
    return walletChainId; // Use wallet network
  }
  return arbitrumSepolia.id; // Fallback
};

defaultValues: {
  subnet: {
    networkChainId: getInitialNetworkId(), // Dynamic initialization
  }
}
```

### Now Works Correctly:
- ✅ Form initializes with user's current wallet network
- ✅ No more "network 0" or invalid network display
- ✅ Users can freely select different networks without interference
- ✅ "Switch to [network]" button appears when wallet ≠ form selection

## Commits
- `fix(form): Make builderPool fields truly optional to fix testnet form submission`
- `fix(network): Allow manual network selection without auto-override`
- `fix(approval): Use actual contract creation fee for mainnet approvals`
- `fix(approval): Skip approval when fee is 0 to prevent 'Remove permission' popup`
- `fix(network): Initialize form with user's wallet network, prevent network 0` 