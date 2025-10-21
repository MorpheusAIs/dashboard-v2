# Network Switching Implementation Guide for MOR Rewards Claiming

## Overview

This guide provides step-by-step instructions to implement network switching functionality in the `ClaimMorRewardsModal` component, allowing users to switch to the appropriate Arbitrum network (Arbitrum Sepolia for testnet, Arbitrum One for mainnet) before claiming MOR rewards.

## Current State Analysis

### What We Have
- ✅ Cross-chain claiming logic with LayerZero integration
- ✅ `useNetwork` context with `switchToChain` functionality  
- ✅ Network environment detection (`networkEnv` from context)
- ✅ Multi-asset claiming with stETH and LINK support

### What's Missing
- ❌ Network detection in the claim modal
- ❌ Conditional UI based on current network
- ❌ Network switching button
- ❌ User guidance for network requirements

## Implementation Steps

### Step 1: Update ClaimMorRewardsModal Imports

Add the following imports to `components/capital/claim-mor-rewards-modal.tsx`:

```tsx
import { useNetwork } from "@/context/network-context";
import { arbitrumSepolia, arbitrum } from 'wagmi/chains';
import { useMemo } from "react"; // Add to existing React imports
```

### Step 2: Add Network Detection Logic

Add this logic inside the `ClaimMorRewardsModal` component, after the existing context destructuring:

```tsx
export function ClaimMorRewardsModal() {
  const {
    activeModal,
    setActiveModal,
    assets,
    stETHV2CanClaim,
    linkV2CanClaim,
    claimAssetRewards,
    lockAssetRewards,
    isProcessingClaim,
    isProcessingChangeLock,
    networkEnv, // Add this if not already present
  } = useCapitalContext();

  // Add network detection
  const { currentChainId, switchToChain, isNetworkSwitching } = useNetwork();

  // Determine correct network based on environment
  const correctChainId = useMemo(() => {
    return networkEnv === 'testnet' ? arbitrumSepolia.id : arbitrum.id;
  }, [networkEnv]);

  // Check if user is on correct network
  const isOnCorrectNetwork = useMemo(() => {
    return currentChainId === correctChainId;
  }, [currentChainId, correctChainId]);

  // Determine if network switch is needed
  const needsNetworkSwitch = useMemo(() => {
    return !isOnCorrectNetwork && claimableAssets.length > 0;
  }, [isOnCorrectNetwork, claimableAssets.length]);

  // Get network name for display
  const networkName = useMemo(() => {
    return networkEnv === 'testnet' ? 'Arbitrum Sepolia' : 'Arbitrum One';
  }, [networkEnv]);

  // ... rest of existing component logic
```

### Step 3: Add Network Switch Handler

Add this handler function before the existing `handleClaim` function:

```tsx
const handleNetworkSwitch = async () => {
  try {
    await switchToChain(correctChainId);
  } catch (error) {
    console.error('Network switching failed:', error);
    // Error handling is done in the context via toast notifications
  }
};
```

### Step 4: Update Action Buttons Section

Replace the existing action buttons section (around line 292) with this enhanced version:

```tsx
{/* Action Buttons */}
<div className="space-y-3">
  <button
    className="w-full copy-button flex items-center justify-center gap-2"
    onClick={handleLockRewards}
    disabled={selectedTotals.selectedAssets.length === 0 || isProcessingChangeLock || isProcessingClaim || needsNetworkSwitch}
  >
    {isProcessingChangeLock ? "Locking..." : "Lock MOR Rewards"}
    <ChevronRight className="h-4 w-4" />
  </button>

  {needsNetworkSwitch ? (
    <button
      className="w-full copy-button-secondary px-4 py-2"
      onClick={handleNetworkSwitch}
      disabled={isNetworkSwitching}
    >
      {isNetworkSwitching ? "Switching..." : `Switch to ${networkName}`}
    </button>
  ) : (
    <button
      className="w-full copy-button-secondary px-4 py-2"
      onClick={handleClaim}
      disabled={selectedTotals.selectedAssets.length === 0 || isProcessingClaim || isProcessingChangeLock}
    >
      {isProcessingClaim ? "Claiming..." : "Claim MOR Rewards"}
    </button>
  )}
  
  <p className="text-xs text-gray-400 text-center">
    {needsNetworkSwitch ? (
      <>⚠️ Switch to {networkName} network to claim rewards</>
    ) : (
      <>⚠️ Claims require ~0.001 ETH for cross-chain gas to {networkName}</>
    )}
  </p>
</div>
```

### Step 5: Update Asset Selection Logic

Disable asset selection when on wrong network by updating the checkbox:

```tsx
<Checkbox
  checked={selectedAssets.has(asset.symbol)}
  onCheckedChange={(checked) => handleAssetToggle(asset.symbol, checked)}
  disabled={!asset.canClaim || needsNetworkSwitch}
/>
```

### Step 6: Add Network Status Indicator

Add this section after the description and before the claimable assets section:

```tsx
{claimableAssets.length > 0 && (
  <>
    {/* Network Status Indicator */}
    <div className={`mb-4 p-3 rounded-lg border ${
      isOnCorrectNetwork 
        ? 'border-emerald-400 bg-emerald-400/10' 
        : 'border-yellow-400 bg-yellow-400/10'
    }`}>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${
          isOnCorrectNetwork ? 'bg-emerald-400' : 'bg-yellow-400'
        }`} />
        <span className={`text-sm font-medium ${
          isOnCorrectNetwork ? 'text-emerald-400' : 'text-yellow-400'
        }`}>
          {isOnCorrectNetwork 
            ? `Connected to ${networkName}` 
            : `Please switch to ${networkName}`
          }
        </span>
      </div>
      {!isOnCorrectNetwork && (
        <p className="text-xs text-yellow-300 mt-1">
          MOR rewards will be minted on {networkName}. Switch networks to proceed.
        </p>
      )}
    </div>

    {/* Select Rewards to Claim */}
    {/* ... existing claimable assets section ... */}
  </>
)}
```

## Testing Checklist

### Manual Testing Steps

1. **Testnet Environment**
   - [ ] Connect to Ethereum Sepolia
   - [ ] Open claim modal with available rewards
   - [ ] Verify "Switch to Arbitrum Sepolia" button appears
   - [ ] Click switch button and verify network changes
   - [ ] Verify claim button appears after network switch
   - [ ] Test actual claiming process

2. **Mainnet Environment**  
   - [ ] Connect to Ethereum Mainnet
   - [ ] Open claim modal with available rewards
   - [ ] Verify "Switch to Arbitrum One" button appears
   - [ ] Click switch button and verify network changes
   - [ ] Verify claim button appears after network switch

3. **Edge Cases**
   - [ ] Test with no claimable rewards (should not show network switch)
   - [ ] Test network switching failure scenarios
   - [ ] Test when already on correct network (should show claim button directly)

## Security Considerations

1. **Network Validation**: Always validate the current network before allowing claims
2. **Gas Estimation**: Ensure cross-chain gas is properly estimated for the target network
3. **Error Handling**: Provide clear error messages for network switching failures
4. **State Management**: Ensure UI state is properly updated after network switches

## Performance Considerations

1. **Memoization**: Network detection logic is properly memoized to prevent unnecessary re-renders
2. **Loading States**: Proper loading states during network switching prevent user confusion
3. **Debouncing**: Network switch operations should not be triggered multiple times simultaneously

## Future Enhancements

1. **Auto-Detection**: Automatically detect when user manually switches networks
2. **Gas Estimation**: Show estimated gas costs for the network switch
3. **Network History**: Remember user's preferred network for claiming
4. **Batch Operations**: Allow claiming from multiple assets after single network switch

## Troubleshooting

### Common Issues

1. **Switch Button Not Appearing**: Check that `networkEnv` is properly set in context
2. **Wrong Network Detected**: Verify chain IDs match expected values
3. **Switch Fails**: Check wallet connectivity and supported networks
4. **UI Not Updating**: Ensure proper dependency arrays in useMemo hooks

### Debug Steps

1. Add console logs to network detection logic
2. Verify `currentChainId` and `correctChainId` values
3. Check network context initialization
4. Verify wagmi chain configurations

## Implementation Checklist

- [ ] Add imports for network context and chain configs
- [ ] Implement network detection logic
- [ ] Add network switch handler
- [ ] Update action buttons with conditional rendering
- [ ] Add network status indicator
- [ ] Update asset selection to respect network state
- [ ] Test in both testnet and mainnet environments
- [ ] Verify error handling and loading states
- [ ] Update documentation and comments

This implementation will provide a seamless user experience for claiming MOR rewards across different networks while maintaining the existing functionality and adding the missing network switching capabilities.