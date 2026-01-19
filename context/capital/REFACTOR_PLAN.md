# CapitalPageContext Refactoring Plan

## Implementation Progress

| Context | Status | Commit |
|---------|--------|--------|
| `CapitalNetworkContext` | ✅ Complete | c6a8607 |
| `CapitalUIContext` | ✅ Complete | c6a8607 |
| `CapitalAssetsContext` | ✅ Complete | ead1cc7 |
| `CapitalMORBalanceContext` | ✅ Complete | ead1cc7 |
| `CapitalReferralContext` | ✅ Complete | 5653f94 |
| `CapitalTransactionsContext` | 🚧 Pending | - |
| Component Migration | 🚧 Pending | - |

## Current State
- **File**: `context/CapitalPageContext.tsx`
- **Lines**: 2856
- **Properties**: ~156 in context value
- **Problem**: Monolithic context causes unnecessary re-renders across all consumers

## Proposed Architecture

### 1. CapitalNetworkContext (Foundation Layer)
**Purpose**: Network configuration and contract addresses
**Re-render frequency**: Rare (only on network switch)

```typescript
// context/capital/CapitalNetworkContext.tsx
interface CapitalNetworkState {
  networkEnv: NetworkEnvironment;
  l1ChainId?: number;
  l2ChainId?: number;
  userAddress?: `0x${string}`;

  // Contract addresses
  distributorV2Address?: `0x${string}`;
  rewardPoolV2Address?: `0x${string}`;
  l1SenderV2Address?: `0x${string}`;
  stETHDepositPoolAddress?: `0x${string}`;
  linkDepositPoolAddress?: `0x${string}`;
  stEthContractAddress?: `0x${string}`;
  linkTokenAddress?: `0x${string}`;
  morContractAddress?: `0x${string}`;

  // Dynamic contracts for all assets
  dynamicContracts: Record<string, DynamicContract>;
}
```

### 2. CapitalAssetsContext (Asset Configuration)
**Purpose**: Asset configuration and selection
**Depends on**: CapitalNetworkContext
**Re-render frequency**: On asset selection change

```typescript
// context/capital/CapitalAssetsContext.tsx
interface CapitalAssetsState {
  assets: Record<AssetSymbol, AssetData>;
  selectedAsset: AssetSymbol;
  setSelectedAsset: (asset: AssetSymbol) => void;

  // Asset-specific loading states
  isLoadingAssetData: boolean;
}
```

### 3. CapitalBalancesContext (User Balances)
**Purpose**: Token balances and allowances
**Depends on**: CapitalNetworkContext
**Re-render frequency**: On balance change (polling)

```typescript
// context/capital/CapitalBalancesContext.tsx
interface CapitalBalancesState {
  morBalance?: bigint;
  morBalanceFormatted: string;

  // Loading states
  isLoadingBalances: boolean;
  isLoadingAllowances: boolean;

  // Approval checking
  needsApproval: (asset: AssetSymbol, amount: string) => boolean;
  checkAndUpdateApprovalNeeded: (asset: AssetSymbol, amount: string) => Promise<boolean>;
}
```

### 4. CapitalDepositsContext (User Deposits)
**Purpose**: User deposit data and pool information
**Depends on**: CapitalNetworkContext, CapitalAssetsContext
**Re-render frequency**: On deposit/withdrawal

```typescript
// context/capital/CapitalDepositsContext.tsx
interface CapitalDepositsState {
  // Aggregated
  totalDepositedUSD: bigint;
  totalDepositedUSDFormatted: string;

  // Pool data
  poolInfo?: PoolInfoData;
  userData?: UserPoolData;

  // Selected asset specifics
  selectedAssetDepositedFormatted: string;
  selectedAssetUserBalanceFormatted: string;
  selectedAssetTotalStakedFormatted: string;
  selectedAssetMinimalStakeFormatted: string;

  // Timestamps
  withdrawUnlockTimestamp?: bigint;
  withdrawUnlockTimestampFormatted: string;
  canWithdraw: boolean;

  // Loading
  isLoadingUserData: boolean;
  isLoadingTotalDeposits: boolean;
}
```

### 5. CapitalRewardsContext (Rewards & Claims)
**Purpose**: Claimable rewards, multipliers, emissions
**Depends on**: CapitalNetworkContext, CapitalAssetsContext
**Re-render frequency**: On claim or periodic refresh

```typescript
// context/capital/CapitalRewardsContext.tsx
interface CapitalRewardsState {
  // Aggregated
  totalClaimableAmount: bigint;
  totalClaimableAmountFormatted: string;

  // Selected asset
  selectedAssetClaimableFormatted: string;
  selectedAssetMultiplierFormatted: string;
  selectedAssetCanClaim: boolean;

  // Multiplier simulation
  multiplierSimArgs: {value: string, unit: TimeUnit} | null;
  triggerMultiplierEstimation: (lockValue: string, lockUnit: TimeUnit) => void;
  estimatedMultiplierValue: string;
  isSimulatingMultiplier: boolean;

  // Timestamps
  claimUnlockTimestamp?: bigint;
  claimUnlockTimestampFormatted: string;
  canClaim: boolean;

  // Loading
  isLoadingRewards: boolean;

  // Legacy (deprecated)
  currentUserMultiplierData?: bigint;
}
```

### 6. CapitalReferralContext (Referral System)
**Purpose**: All referral-related data and actions
**Depends on**: CapitalNetworkContext, CapitalAssetsContext
**Re-render frequency**: On referral actions

```typescript
// context/capital/CapitalReferralContext.tsx
interface CapitalReferralState {
  referralData: {
    totalReferrals: string;
    totalReferralAmount: string;
    lifetimeRewards: string;
    claimableRewards: string;
    isLoadingReferralData: boolean;

    rewardsByAsset: Partial<Record<AssetSymbol, bigint>>;
    referrerDetailsByAsset: Partial<Record<AssetSymbol, ReferralContractData | null>>;
    assetsWithClaimableRewards: AssetSymbol[];
    availableReferralAssets: AssetSymbol[];
    referralAmountsByAsset: ReferralAmountByAsset[];
  };

  // Pre-populated referrer
  preReferrerAddress: string;
  setPreReferrerAddress: (address: string) => void;

  // Action
  claimReferralRewards: (asset?: AssetSymbol) => Promise<void>;
}
```

### 7. CapitalTransactionsContext (Actions & State)
**Purpose**: Transaction execution and status tracking
**Depends on**: All other contexts
**Re-render frequency**: During transactions

```typescript
// context/capital/CapitalTransactionsContext.tsx
interface CapitalTransactionsState {
  // Action functions
  deposit: (asset: AssetSymbol, amount: string, lockDurationSeconds?: bigint, referrerAddress?: string) => Promise<void>;
  withdraw: (asset: AssetSymbol, amount: string) => Promise<void>;
  claim: () => Promise<void>;
  changeLock: (lockValue: string, lockUnit: TimeUnit) => Promise<void>;
  approveToken: (asset: AssetSymbol) => Promise<void>;
  claimAssetRewards: (asset: AssetSymbol) => Promise<void>;
  lockAssetRewards: (asset: AssetSymbol, lockDurationSeconds: bigint) => Promise<void>;

  // Processing states
  isProcessingDeposit: boolean;
  isProcessingClaim: boolean;
  isProcessingWithdraw: boolean;
  isProcessingChangeLock: boolean;
  isApprovalSuccess: boolean;
  isClaimSuccess: boolean;

  // Transaction hashes
  claimHash?: `0x${string}`;
}
```

### 8. CapitalUIContext (UI State)
**Purpose**: Modal and UI state
**Depends on**: None
**Re-render frequency**: On modal open/close

```typescript
// context/capital/CapitalUIContext.tsx
interface CapitalUIState {
  activeModal: ActiveModal;
  setActiveModal: (modal: ActiveModal) => void;
}
```

## File Structure

```
context/
├── capital/
│   ├── index.ts                    # Re-exports all contexts + combined provider
│   ├── CapitalNetworkContext.tsx   # Network & addresses
│   ├── CapitalAssetsContext.tsx    # Asset configuration
│   ├── CapitalBalancesContext.tsx  # Token balances
│   ├── CapitalDepositsContext.tsx  # User deposits
│   ├── CapitalRewardsContext.tsx   # Rewards & claims
│   ├── CapitalReferralContext.tsx  # Referral system
│   ├── CapitalTransactionsContext.tsx # Transaction actions
│   ├── CapitalUIContext.tsx        # UI state
│   └── types.ts                    # Shared types
├── CapitalPageContext.tsx          # Deprecated - re-exports from capital/
```

## Migration Strategy

### Phase 1: Create New Structure (Non-Breaking)
1. Create `context/capital/` directory
2. Create `types.ts` with shared types
3. Create each context file with its own provider
4. Create `index.ts` that composes all providers

### Phase 2: Create Combined Provider
```typescript
// context/capital/index.ts
export function CapitalProvider({ children }: { children: React.ReactNode }) {
  return (
    <CapitalNetworkProvider>
      <CapitalAssetsProvider>
        <CapitalBalancesProvider>
          <CapitalDepositsProvider>
            <CapitalRewardsProvider>
              <CapitalReferralProvider>
                <CapitalTransactionsProvider>
                  <CapitalUIProvider>
                    {children}
                  </CapitalUIProvider>
                </CapitalTransactionsProvider>
              </CapitalReferralProvider>
            </CapitalRewardsProvider>
          </CapitalDepositsProvider>
        </CapitalBalancesProvider>
      </CapitalAssetsProvider>
    </CapitalNetworkProvider>
  );
}
```

### Phase 3: Create Backward-Compatible Hook
```typescript
// Maintains existing API during migration
export function useCapitalPage() {
  const network = useCapitalNetwork();
  const assets = useCapitalAssets();
  const balances = useCapitalBalances();
  const deposits = useCapitalDeposits();
  const rewards = useCapitalRewards();
  const referral = useCapitalReferral();
  const transactions = useCapitalTransactions();
  const ui = useCapitalUI();

  return {
    ...network,
    ...assets,
    ...balances,
    ...deposits,
    ...rewards,
    ...referral,
    ...transactions,
    ...ui,
  };
}
```

### Phase 4: Gradual Component Migration
1. Update components to use specific context hooks
2. Example: `DepositModal` only needs `useCapitalAssets`, `useCapitalBalances`, `useCapitalTransactions`
3. Components no longer re-render on unrelated state changes

### Phase 5: Deprecate Original Context
1. Mark `CapitalPageContext.tsx` as deprecated
2. Update imports in consuming components
3. Eventually remove original file

## Benefits

1. **Reduced Re-renders**: Components only subscribe to relevant state
2. **Better Code Organization**: Clear separation of concerns
3. **Easier Testing**: Each context can be tested in isolation
4. **Smaller Bundle Per Route**: Code splitting possible per context
5. **Clearer Dependencies**: Explicit context hierarchy

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing components | Backward-compatible `useCapitalPage()` hook |
| Complex provider nesting | Single `CapitalProvider` wrapper |
| State synchronization issues | Careful dependency management |
| Increased file count | Clear naming and organization |

## Estimated Impact

- **Before**: All 156 properties trigger re-renders in all consumers
- **After**: Components only re-render for their subscribed context
- **Expected improvement**: 60-80% reduction in unnecessary re-renders for most components
