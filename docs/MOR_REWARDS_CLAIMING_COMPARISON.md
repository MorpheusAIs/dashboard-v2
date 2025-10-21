# MOR Rewards Claiming Implementation Comparison

## Executive Summary

This document compares the MOR rewards claiming implementations between the `main` branch and the `capital-page-layout-refactor` branch, focusing on network switching functionality and user experience differences.

## Overview

The main difference between the branches is that **the main branch has a simple, direct claim implementation** that operates on the current network, while **the current branch has a more complex V2 implementation** with cross-chain functionality but lacks the network switching UI logic that would allow users to switch to Arbitrum (Sepolia for testnet) before claiming.

## Implementation Comparison

### Main Branch Implementation

#### 1. Capital Page Structure (`app/capital/page.tsx`)
- **Simple button-based UI**: Uses standard button in the "Your Position" section
- **Direct modal trigger**: Button calls `setActiveModal('claim')` directly
- **No network awareness in UI**: The button simply opens the modal without checking current network

```tsx
<Button
  variant="outline"
  size="sm"
  className="mt-4 w-full md:w-auto"
  onClick={() => setActiveModal('claim')}
  disabled={!userAddress || isUserSectionLoading || !canClaim}
>
  Claim MOR
</Button>
```

#### 2. ClaimModal Component (`components/capital/ClaimModal.tsx`)
- **Simple modal**: Shows claimable amount and has direct claim button
- **No network switching logic**: Just calls the `claim()` function from context
- **Basic validation**: Only checks if user can claim and has rewards

```tsx
<Button
  onClick={handleSubmit}
  className="bg-emerald-500 hover:bg-emerald-600 text-white"
  disabled={isProcessingClaim || !canClaim || !claimableAmount || parseFloat(claimableAmount) <= 0 || !userAddress}
>
  {isProcessingClaim ? "Claiming..." : "Confirm Claim"}
</Button>
```

#### 3. Context Implementation (`context/CapitalPageContext.tsx`)
- **Direct claim function**: Simple implementation that calls the contract directly
- **L1 only**: Claims happen on Ethereum mainnet/sepolia only
- **No cross-chain logic**: MOR tokens are minted directly on L1

```tsx
const claim = useCallback(async () => {
  if (!poolContractAddress || !l1ChainId || !userAddress || !canClaim) throw new Error("Claim prerequisites not met");
  await handleTransaction(() => claimAsync({
    address: poolContractAddress,
    abi: ERC1967ProxyAbi,
    functionName: 'claim',
    args: [PUBLIC_POOL_ID, userAddress],
    chainId: l1ChainId,
  }), {
    loading: "Requesting claim...",
    success: "Successfully claimed MOR!",
    error: "Claim failed"
  });
}, [claimAsync, poolContractAddress, l1ChainId, userAddress, canClaim, handleTransaction]);
```

### Current Branch Implementation (capital-page-layout-refactor)

#### 1. Capital Page Structure (`app/capital/page.tsx`)
- **New table-based UI**: Uses UserAssetsPanel with DataTable showing detailed asset information
- **"Claim all" button**: Generic button that triggers `setActiveModal('claimMorRewards')`
- **No network awareness**: Similar to main branch, no network switching logic in UI

```tsx
<button
  className="copy-button-secondary font-medium px-4 py-2 rounded-lg"
  onClick={() => setActiveModal('claimMorRewards')}
  disabled={!userAddress || isAnyActionProcessing}
>
  Claim all
</button>
```

#### 2. ClaimMorRewardsModal Component (`components/capital/claim-mor-rewards-modal.tsx`)
- **Complex modal**: Shows detailed breakdown by asset (stETH, LINK)
- **Multi-asset selection**: Users can select which assets to claim from
- **Lock rewards option**: Includes functionality to lock rewards for increased multiplier
- **Cross-chain awareness**: Shows warning about cross-chain gas fees

```tsx
<p className="text-xs text-gray-400 text-center">
  ⚠️ Claims require ~0.001 ETH for cross-chain gas to Arbitrum Sepolia
</p>
```

#### 3. Context Implementation (`context/CapitalPageContext.tsx`)
- **V2 cross-chain claim**: More sophisticated implementation with LayerZero integration
- **Cross-chain gas**: Includes ETH for L2 gas fees
- **Asset-specific claiming**: Separate claim functions for different assets

```tsx
const claimAssetRewards = useCallback(async (asset: AssetSymbol) => {
  if (!userAddress || !l1ChainId) throw new Error("Claim prerequisites not met");
  
  const targetAddress = asset === 'stETH' ? stETHDepositPoolAddress : linkDepositPoolAddress;
  const canAssetClaim = asset === 'stETH' ? stETHV2CanClaim : linkV2CanClaim;
  
  // For V2 claims, we need ETH for cross-chain gas fees to L2 (Arbitrum Sepolia)
  const ETH_FOR_CROSS_CHAIN_GAS = parseEther("0.01"); // 0.01 ETH for L2 gas

  await handleTransaction(() => claimAsync({
    address: targetAddress,
    abi: DepositPoolAbi,
    functionName: 'claim',
    args: [V2_REWARD_POOL_INDEX, userAddress],
    chainId: l1ChainId,
    value: ETH_FOR_CROSS_CHAIN_GAS, // Send ETH for cross-chain gas
    gas: BigInt(800000), // Higher gas limit for cross-chain operations
  }), {
    loading: `Claiming ${asset} rewards...`,
    success: `Successfully claimed ${asset} rewards! MOR tokens will be minted on Arbitrum Sepolia.`,
    error: `${asset} claim failed`
  });
}, [claimAsync, stETHDepositPoolAddress, linkDepositPoolAddress, stETHV2CanClaim, linkV2CanClaim, l1ChainId, userAddress, handleTransaction]);
```

## Key Differences

| Aspect | Main Branch | Current Branch |
|--------|-------------|----------------|
| **UI Complexity** | Simple button + basic modal | Complex table + multi-asset modal |
| **Network Switching** | ❌ None | ❌ None (but has cross-chain awareness) |
| **Claim Destination** | L1 (Ethereum) | L2 (Arbitrum via LayerZero) |
| **Asset Support** | Single pool | Multi-asset (stETH, LINK) |
| **Gas Handling** | Standard | Includes cross-chain gas |
| **User Experience** | Simple, direct | Complex, informative |

## Missing Network Switching Logic

### What's Missing in Current Branch

1. **Network Detection**: No logic to detect if user is on the correct network for claiming
2. **Network Switch UI**: No button or prompt to switch networks when on wrong network  
3. **Network Switch Logic**: No integration with the existing `useNetwork` context for switching
4. **Conditional Rendering**: Buttons don't change text/behavior based on current network

### What Should Be Implemented

#### 1. Network Detection in ClaimMorRewardsModal
```tsx
// Add to ClaimMorRewardsModal
const { currentChainId, switchToChain, isNetworkSwitching } = useNetwork();

// Detect if on correct network
const isOnCorrectNetwork = useMemo(() => {
  if (networkEnv === 'testnet') {
    return currentChainId === arbitrumSepolia.id;
  }
  return currentChainId === arbitrum.id;
}, [currentChainId, networkEnv]);

// Show network switch button if needed
const needsNetworkSwitch = !isOnCorrectNetwork && hasClaimableRewards;
```

#### 2. Conditional Button Rendering
```tsx
// In action buttons section
{needsNetworkSwitch ? (
  <button
    className="w-full copy-button-secondary px-4 py-2"
    onClick={() => switchToChain(networkEnv === 'testnet' ? arbitrumSepolia.id : arbitrum.id)}
    disabled={isNetworkSwitching}
  >
    {isNetworkSwitching ? "Switching..." : `Switch to ${networkEnv === 'testnet' ? 'Arbitrum Sepolia' : 'Arbitrum'}`}
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
```

#### 3. Network Switch Logic Integration
The current branch already has `useNetwork` context with `switchToChain` functionality that should be utilized.

## Testnet vs Mainnet Considerations

### Current Implementation Status
- **Mainnet**: Claims would mint MOR on Arbitrum One
- **Testnet**: Claims would mint MOR on Arbitrum Sepolia
- **Network Detection**: Currently missing for both environments

### Required Changes for Testnet Support
1. **Import network utilities**:
   ```tsx
   import { useNetwork } from "@/context/network-context";
   import { arbitrumSepolia, arbitrum } from 'wagmi/chains';
   ```

2. **Add network detection logic**
3. **Conditional network switching based on environment**
4. **Update UI to show appropriate network names**

## Recommendations

### Immediate Actions Needed

1. **Add Network Detection to ClaimMorRewardsModal**
   - Import and use `useNetwork` context
   - Add network detection logic
   - Show appropriate network switching UI

2. **Update Button Logic**
   - Make claim button conditional on network state
   - Add network switch button when on wrong network
   - Update button text based on current state

3. **Improve User Experience**
   - Add clear messaging about which network is needed
   - Show loading states during network switching
   - Provide feedback when network switch completes

4. **Test Both Environments**
   - Ensure testnet switches to Arbitrum Sepolia
   - Ensure mainnet switches to Arbitrum One
   - Verify gas estimation works correctly

### Code Implementation Priority

1. **High Priority**: Network detection and switching UI
2. **Medium Priority**: Improved error handling and user feedback
3. **Low Priority**: UI/UX refinements

## Conclusion

The current branch has a more sophisticated claiming system with cross-chain functionality and multi-asset support, but lacks the critical network switching UI that would guide users to the correct network before claiming. The main branch's simpler approach works because it operates entirely on L1, while the current branch's L2 destination requires explicit network management.

The solution is to integrate the existing `useNetwork` context into the `ClaimMorRewardsModal` component to provide network detection and switching capabilities, similar to how it's implemented in the builders page for subnet claiming.