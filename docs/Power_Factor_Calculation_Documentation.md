# Power Factor Calculation for Staking in Morpheus Capital Page

## Overview

The **Power Factor** is a rewards multiplier mechanism in the Morpheus protocol that incentivizes users to lock their MOR token claims for extended periods. By extending their claim lock period, users receive a multiplier that increases their rewards proportionally. This document provides a comprehensive technical breakdown of how the power factor is calculated, displayed, and managed.

## Key Concepts

### What is Power Factor?
- **Definition**: A reward multiplier that increases based on how long users are willing to lock their claim period
- **Purpose**: Incentivizes long-term commitment to the protocol by providing higher rewards
- **Display**: Shown as "Your Power Factor" with format `x{multiplier}` (e.g., "x1.5000")
- **Scope**: Only displayed on `/capital` page, not on `/dashboard/capital`

### Core Architecture

The power factor system is built around three main components:
1. **Smart Contract Functions**: Handle the core calculation logic
2. **Frontend Composables**: Manage data fetching and state
3. **UI Components**: Display and allow user interaction

## Smart Contract Integration

### Contract Details

The power factor system is implemented through the **ERC1967 Proxy contract** which acts as the main interface for the Morpheus protocol:

#### Contract Addresses
- **Ethereum Mainnet**: `0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790`
- **Sepolia Testnet**: `0x7c46d6bebf3dcd902eb431054e59908a02aba524`

#### Contract Name
- **Contract Type**: ERC1967 Proxy (upgradeable contract)
- **Interface**: `Erc1967ProxyType` or `Mor1967ProxyType`
- **ABI File**: `src/abi/ERC1967Proxy.json`

### Primary Contract Functions

#### 1. `getClaimLockPeriodMultiplier`
```typescript
// Function signature
getClaimLockPeriodMultiplier(
  poolId: BigNumberish,
  claimLockStart: BigNumberish,
  claimLockEnd: BigNumberish
): Promise<BigNumber>
```

**Purpose**: Preview the expected multiplier for a given lock period without committing to it.

**Parameters**:
- `poolId` (BigNumberish): The pool identifier (typically `0` for main capital pool)
- `claimLockStart` (BigNumberish): Timestamp when the lock period starts (Unix timestamp in seconds)
- `claimLockEnd` (BigNumberish): Timestamp when the lock period ends (Unix timestamp in seconds)

**Returns**: Raw multiplier value (BigNumber) that needs to be processed for display

**Frontend Usage**: Used in the ChangeLockModal to show users what their power factor would be for different lock periods.

#### 2. `getCurrentUserMultiplier`
```typescript
// Function signature
getCurrentUserMultiplier(
  poolId: BigNumberish,
  user: string
): Promise<BigNumber>
```

**Purpose**: Get the current active multiplier for a specific user.

**Parameters**:
- `poolId` (BigNumberish): The pool identifier (typically `0` for main capital pool)
- `user` (string): User's wallet address

**Returns**: Raw multiplier value (BigNumber) for the specified user

**Frontend Usage**: Used to display the user's current power factor and calculate current rewards.

#### 3. `lockClaim`
```typescript
// Function signature
lockClaim(
  poolId: BigNumberish,
  claimLockEnd: BigNumberish
): Promise<ContractTransaction>
```

**Purpose**: Set a new claim lock period for the calling user.

**Parameters**:
- `poolId` (BigNumberish): The pool identifier (typically `0` for main capital pool)
- `claimLockEnd` (BigNumberish): New timestamp when claims will be unlocked (Unix timestamp in seconds)

**Returns**: Transaction object for confirmation

**Frontend Usage**: Called when users confirm a new lock period in the ChangeLockModal.

## Frontend Integration Guide

### Complete Function Specifications for External Integration

This section provides all the details needed to implement power factor functionality in any frontend application.

#### Contract ABI Requirements

```json
[
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "poolId_",
        "type": "uint256"
      },
      {
        "internalType": "uint128",
        "name": "claimLockStart_",
        "type": "uint128"
      },
      {
        "internalType": "uint128",
        "name": "claimLockEnd_",
        "type": "uint128"
      }
    ],
    "name": "getClaimLockPeriodMultiplier",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "poolId_",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "user_",
        "type": "address"
      }
    ],
    "name": "getCurrentUserMultiplier",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "poolId_",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "claimLockEnd_",
        "type": "uint256"
      }
    ],
    "name": "lockClaim",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
]
```

#### 1. Preview Expected Multiplier

**Function**: `getClaimLockPeriodMultiplier(uint256 poolId_, uint128 claimLockStart_, uint128 claimLockEnd_)`

**Parameters**:
- `poolId_`: Pool identifier (typically `0` for main capital pool)
- `claimLockStart_`: Lock start timestamp in seconds (Unix timestamp)
- `claimLockEnd_`: Lock end timestamp in seconds (Unix timestamp)

**Response Format**: 
- Raw uint256 value (e.g., 15000000000000000000000)

**Response Processing**:
```typescript
// Convert raw contract value to display value
const rawMultiplier = await contract.getClaimLockPeriodMultiplier(poolId, lockStart, lockEnd);
const displayMultiplier = Number(rawMultiplier) / Math.pow(10, 21);
const powerFactor = (displayMultiplier / 10000).toFixed(4);
// Result: "1.5000" for 1.5x multiplier
```

**Example Call**:
```typescript
// Preview multiplier for 1 year lock starting now
const poolId = 0; // Main capital pool
const lockStart = Math.floor(Date.now() / 1000); // Current timestamp
const lockEnd = lockStart + 31536000; // 1 year from now
const expectedMultiplier = await contract.getClaimLockPeriodMultiplier(poolId, lockStart, lockEnd);
```

#### 2. Get Current User Multiplier

**Function**: `getCurrentUserMultiplier(uint256 poolId_, address user_)`

**Parameters**:
- `poolId_`: Pool identifier (typically `0` for main capital pool)
- `user_`: User's wallet address

**Response Format**: 
- Raw uint256 value representing current multiplier

**Response Processing**:
```typescript
// Same processing as preview function
const rawCurrentMultiplier = await contract.getCurrentUserMultiplier(poolId, userAddress);
const displayCurrentMultiplier = Number(rawCurrentMultiplier) / Math.pow(10, 21);
const currentPowerFactor = (displayCurrentMultiplier / 10000).toFixed(4);
```

**Example Call**:
```typescript
// Get user's current power factor
const poolId = 0;
const userAddress = "0x1234..."; // User's wallet address
const currentMultiplier = await contract.getCurrentUserMultiplier(poolId, userAddress);
```

#### 3. Set New Lock Period

**Function**: `lockClaim(uint256 poolId_, uint256 claimLockEnd_)`

**Parameters**:
- `poolId_`: Pool identifier (typically `0` for main capital pool)
- `claimLockEnd_`: New lock end timestamp in seconds (Unix timestamp)

**Response Format**: Transaction hash (string)

**Example Call**:
```typescript
// Lock claims for 2 years from now
const poolId = 0;
const lockEnd = Math.floor(Date.now() / 1000) + 63072000; // 2 years from now
const tx = await contract.lockClaim(poolId, lockEnd);
await tx.wait(); // Wait for confirmation
```

### Complete Integration Example

```typescript
import { ethers } from 'ethers';

class MorpheusPowerFactor {
  private contract: ethers.Contract;
  private poolId: number;
  
  constructor(provider: ethers.providers.Provider, signer: ethers.Signer, poolId: number = 0) {
    const contractAddress = '0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790'; // Mainnet
    const abi = [/* ABI from above */];
    
    this.contract = new ethers.Contract(contractAddress, abi, signer);
    this.poolId = poolId;
  }
  
  // Preview multiplier for a lock period
  async previewMultiplier(lockStartSeconds: number, lockEndSeconds: number): Promise<string> {
    try {
      const rawMultiplier = await this.contract.getClaimLockPeriodMultiplier(
        this.poolId, 
        lockStartSeconds, 
        lockEndSeconds
      );
      const displayMultiplier = Number(rawMultiplier) / Math.pow(10, 21);
      const powerFactor = (displayMultiplier / 10000).toFixed(4);
      return powerFactor;
    } catch (error) {
      console.error('Error previewing multiplier:', error);
      throw error;
    }
  }
  
  // Get current user multiplier
  async getCurrentMultiplier(userAddress: string): Promise<string> {
    try {
      const rawMultiplier = await this.contract.getCurrentUserMultiplier(this.poolId, userAddress);
      const displayMultiplier = Number(rawMultiplier) / Math.pow(10, 21);
      const powerFactor = (displayMultiplier / 10000).toFixed(4);
      return powerFactor;
    } catch (error) {
      console.error('Error getting current multiplier:', error);
      throw error;
    }
  }
  
  // Set new lock period
  async setLockPeriod(lockEndSeconds: number): Promise<string> {
    try {
      const tx = await this.contract.lockClaim(this.poolId, lockEndSeconds);
      const receipt = await tx.wait();
      return receipt.transactionHash;
    } catch (error) {
      console.error('Error setting lock period:', error);
      throw error;
    }
  }
  
  // Helper: Convert months to seconds
  monthsToSeconds(months: number): number {
    return months * 30 * 24 * 60 * 60; // Approximate
  }
  
  // Helper: Convert years to seconds
  yearsToSeconds(years: number): number {
    return years * 365 * 24 * 60 * 60; // Approximate
  }
  
  // Helper: Get current timestamp
  getCurrentTimestamp(): number {
    return Math.floor(Date.now() / 1000);
  }
}

// Usage example
const powerFactor = new MorpheusPowerFactor(provider, signer, 0);

// Preview 1 year lock starting now
const now = powerFactor.getCurrentTimestamp();
const oneYearFromNow = now + powerFactor.yearsToSeconds(1);
const oneYearMultiplier = await powerFactor.previewMultiplier(now, oneYearFromNow);
console.log(`1 year lock gives: x${oneYearMultiplier} power factor`);

// Get current multiplier
const currentMultiplier = await powerFactor.getCurrentMultiplier(userAddress);
console.log(`Current power factor: x${currentMultiplier}`);

// Set 2 year lock
const twoYearsFromNow = now + powerFactor.yearsToSeconds(2);
const txHash = await powerFactor.setLockPeriod(twoYearsFromNow);
console.log(`Lock period set: ${txHash}`);
```

### Error Handling

**Common Errors**:
- `INSUFFICIENT_FUNDS`: User doesn't have enough MOR tokens
- `INVALID_LOCK_PERIOD`: Lock period is outside allowed range
- `LOCK_PERIOD_TOO_SHORT`: Period is less than minimum (6 months)
- `LOCK_PERIOD_TOO_LONG`: Period exceeds maximum (6 years)

**Recommended Error Handling**:
```typescript
try {
  const multiplier = await contract.getClaimLockPeriodMultiplier(poolId, lockStart, lockEnd);
  // Process result
} catch (error) {
  if (error.code === 'INSUFFICIENT_FUNDS') {
    // Handle insufficient funds
  } else if (error.message.includes('INVALID_LOCK_PERIOD')) {
    // Handle invalid lock period
  } else {
    // Handle other errors
    console.error('Unexpected error:', error);
  }
}
```

### Network Considerations

**Supported Networks**:
- **Ethereum Mainnet**: Primary network with full functionality
- **Sepolia Testnet**: For testing and development

**Gas Estimation**:
- `getClaimLockPeriodMultiplier`: ~21,000 gas (view function)
- `getCurrentUserMultiplier`: ~21,000 gas (view function)  
- `lockClaim`: ~100,000-200,000 gas (state-changing function)

**Recommended Gas Limits**:
- View functions: 50,000 gas
- Lock function: 300,000 gas

## Frontend Implementation

### Core Composable: `usePool`

Located in `src/composables/use-pool.ts`, this composable manages all pool-related functionality including power factor calculations.

#### Key Constants
```typescript
const MULTIPLIER_SCALE = 21 // digits
const REWARDS_DIVIDER = 10000
```

#### Multiplier Conversion Function
```typescript
const humanizeRewards = (reward: BigNumber) => {
  const scaleFactor = ethers.BigNumber.from(10).pow(MULTIPLIER_SCALE)
  const scaledNumber = reward.div(scaleFactor)
  return (scaledNumber.toNumber() / REWARDS_DIVIDER).toFixed(4)
}
```

**Process**:
1. Contract returns raw multiplier (scaled by 10^21)
2. Divide by `10^21` to get base number
3. Divide by `10000` to get final multiplier
4. Format to 4 decimal places for display

#### State Management
```typescript
const rewardsMultiplier = ref('1')        // Current user's multiplier
const expectedRewardsMultiplier = ref('1') // Preview multiplier for new lock periods
```

### Fetching Expected Multiplier

The `fetchExpectedMultiplier` function previews the multiplier for a proposed lock period:

```typescript
const fetchExpectedMultiplier = async (lockPeriod: string) => {
  try {
    if (!lockPeriod) return

    // Determine lock start time
    const lockStart = new Time().isAfter(
      userPoolData.value?.claimLockStart?.toString()
    )
      ? new Time().timestamp  // Use current time if no existing lock
      : userPoolData.value?.claimLockStart?.toString() // Use existing lock start

    if ('getClaimLockPeriodMultiplier' in erc1967ProxyContract.value) {
      const multiplier = await erc1967ProxyContract.value.getClaimLockPeriodMultiplier(
        poolId.value,
        lockStart || 0,
        lockPeriod || 0
      )

      expectedRewardsMultiplier.value = humanizeRewards(multiplier)
    }
  } catch (error) {
    ErrorHandler.processWithoutFeedback(error)
  }
}
```

### Updating Current Multiplier

The `updateUserReward` function fetches the user's current active multiplier:

```typescript
const updateUserReward = async (): Promise<void> => {
  if (route.query.address) return

  isUserDataUpdating.value = true

  try {
    if ('getCurrentUserMultiplier' in erc1967ProxyContract.value) {
      const response = await erc1967ProxyContract.value.getCurrentUserMultiplier(
        poolId.value,
        web3ProvidersStore.provider.selectedAddress
      )

      rewardsMultiplier.value = humanizeRewards(response)
    }
  } catch (e) {
    ErrorHandler.processWithoutFeedback(e)
  }
  isUserDataUpdating.value = false
}
```

## UI Components

### Main Display: PublicPoolView

Located in `src/pages/HomePage/views/PublicPoolView.vue`, this component displays the power factor in the dashboard indicators.

#### Power Factor Display Logic
```typescript
const dashboardIndicators = computed<InfoDashboardType.Indicator[]>(() => [
  {
    iconName: ICON_NAMES.ethereum,
    title: t('home-page.public-pool-view.user-deposit-title'),
    value: userPoolData.value
      ? `${formatEther(userPoolData.value.deposited)} ${web3ProvidersStore.depositTokenSymbol}`
      : '',
  },
  {
    iconName: ICON_NAMES.arbitrum,
    title: t('home-page.public-pool-view.available-to-claim-title'),
    value: currentUserReward.value
      ? `${formatEther(currentUserReward.value)} ${web3ProvidersStore.rewardsTokenSymbol}`
      : '',
  },
  // Power Factor - only shown on /capital, not /dashboard/capital
  ...(isChangeLockEnabled.value
    ? [
        {
          title: t('home-page.public-pool-view.multiplier-title'), // "Your Power Factor"
          value: `x${rewardsMultiplier.value}`,
        },
      ]
    : []),
])
```

#### Conditional Display
```typescript
const isChangeLockEnabled = computed(
  () => route.name !== ROUTE_NAMES.appDashboardCapital
)
```

The power factor is only displayed when `isChangeLockEnabled` is true, which excludes the `/dashboard/capital` route.

### ChangeLockModal Component

Located in `src/common/modals/compositions/ChangeLockModal.vue`, this modal allows users to extend their claim lock period.

#### Multiplier Preview Logic
```typescript
const userMultiplier = computed(() =>
  Number(rewardsMultiplier.value) > Number(expectedRewardsMultiplier.value)
    ? rewardsMultiplier.value  // Keep current if higher
    : expectedRewardsMultiplier.value  // Show new expected multiplier
)
```

#### Lock Period Validation
```typescript
const minLockTime = computed(() => {
  const claimLockTimestamp = userPoolData.value?.claimLockEnd?.toNumber() ?? 0
  const timeNow = time().timestamp
  return claimLockTimestamp > timeNow ? claimLockTimestamp : timeNow
})
```

Users can only extend their lock period, not reduce it. The minimum lock time is either their current lock end time or the current timestamp, whichever is later.

#### Transaction Submission
```typescript
const submit = async () => {
  if (!isFieldsValid.value) return
  
  try {
    await web3ProvidersStore.provider.switchChain(
      web3ProvidersStore.erc1967ProxyContractDetails.targetChainId
    )
    
    await sleep(500)
    
    const tx = await web3ProvidersStore.erc1967ProxyContract.signerBased.value.lockClaim(
      props.poolId,
      form.lockPeriod
    )

    // Handle transaction confirmation and UI updates
    await tx.wait()
    bus.emit(BUS_EVENTS.changedPoolData) // Trigger data refresh
    
  } catch (e) {
    ErrorHandler.process(e)
  }
}
```

### DepositForm Integration

Located in `src/forms/DepositForm.vue`, this form shows the expected multiplier when users deposit with a lock period.

#### Multiplier Display Control
```typescript
const isMultiplierShown = computed(
  () => route.name !== ROUTE_NAMES.appDashboardCapital
)
```

#### Auto-calculation on Form Changes
```typescript
watch(
  () => [
    props.poolId,
    web3ProvidersStore.provider.selectedAddress,
    form.lockPeriod,
    userPoolData.value?.claimLockEnd,
  ],
  async () => {
    if (!form.lockPeriod) {
      form.lockPeriod = getLockPeriodMinValue().timestamp.toString()
    }
    if (isMultiplierShown.value) {
      await fetchExpectedMultiplier(form.lockPeriod)
    }
  }
)
```

## Time Period Relationships

### Lock Period Constraints

#### Minimum Lock Period
```typescript
const getLockPeriodMinValue = () => {
  const userLockPeriod = time(userPoolData.value?.claimLockEnd?.toNumber() || 0)
  
  if (userLockPeriod.isAfter(time())) {
    return userLockPeriod  // Use existing lock end if still active
  }
  
  return time().add(1, 'minute')  // Minimum 1 minute from now
}
```

#### Lock Start Determination
The lock start time is determined based on existing user state:
- If user has an existing active lock: use `claimLockStart`
- If no existing lock or expired: use current timestamp

### Multiple Lock Period Types

The protocol manages several types of lock periods:

1. **User-Defined Lock (`claimLockEnd`)**: Set by users to earn multipliers
2. **Global Pool Locks**: Affect all users in the pool
   - `claimLockPeriod`: Global claim lock after pool start
   - `withdrawLockPeriod`: Global withdrawal lock after pool start
3. **Action-Based Locks**: Triggered by user actions
   - `claimLockPeriodAfterClaim`: Additional lock after claiming rewards
   - `claimLockPeriodAfterStake`: Additional lock after staking
   - `withdrawLockPeriodAfterStake`: Withdrawal lock after staking

## Mathematical Calculation Details

### Raw Multiplier Processing
1. **Contract Output**: Returns BigNumber scaled by 10^21
2. **Scale Down**: Divide by `10^MULTIPLIER_SCALE` (10^21)
3. **Final Division**: Divide by `REWARDS_DIVIDER` (10000)
4. **Formatting**: Fixed to 4 decimal places

### Example Calculation
```typescript
// Assume contract returns: 15000000000000000000000 (1.5 * 10^21)
const rawMultiplier = BigNumber.from("15000000000000000000000")
const scaleFactor = ethers.BigNumber.from(10).pow(21)
const scaledNumber = rawMultiplier.div(scaleFactor) // = 15000
const finalMultiplier = (scaledNumber.toNumber() / 10000).toFixed(4) // = "1.5000"
```

### Multiplier Comparison Logic
In the ChangeLockModal, the system uses the higher of:
- Current active multiplier (`rewardsMultiplier`)
- Expected new multiplier (`expectedRewardsMultiplier`)

This ensures users always see the best possible multiplier value.

## Data Flow and Updates

### Initialization Sequence
1. Component loads and calls `usePool(poolId)`
2. `init()` function fetches pool data and user data in parallel
3. If user connected, calls `updateUserReward()` to get current multiplier
4. UI displays current multiplier in dashboard indicators

### Real-time Updates
The system updates multiplier data through several mechanisms:

#### Automatic Refresh
```typescript
// 30-second interval for current user reward updates
setInterval(async () => {
  if (!web3ProvidersStore.isConnected || !web3ProvidersStore.provider.selectedAddress) return
  
  try {
    currentUserReward.value = await fetchCurrentUserReward()
  } catch (error) {
    ErrorHandler.process(error)
  }
}, 30000)
```

#### Event-Driven Updates
```typescript
// Bus events trigger data refresh
bus.on(BUS_EVENTS.changedPoolData, onChangePoolData)
bus.on(BUS_EVENTS.changedCurrentUserReward, onChangeCurrentUserReward)
```

#### Reactive Form Updates
Form changes trigger immediate multiplier recalculation:
```typescript
watch(
  () => [props.poolId, form.lockPeriod, userPoolData.value?.claimLockEnd],
  () => fetchExpectedMultiplier(form.lockPeriod),
  { immediate: true }
)
```

## Error Handling and Edge Cases

### Contract Call Failures
- All contract calls are wrapped in try-catch blocks
- Errors are processed through `ErrorHandler.processWithoutFeedback()` for non-critical calls
- Critical errors (like transaction failures) show user feedback

### Missing Data Handling
- Multiplier defaults to `'1'` if contract calls fail
- Form validation prevents invalid lock periods
- UI gracefully handles loading states and empty data

### Network Issues
- Automatic chain switching for transactions
- Retry logic for failed contract calls
- Loading indicators during network operations

## Integration with Reward Calculations

### Actual Reward Calculation Formula

Based on the codebase analysis, the reward calculation formula is **NOT simply `stakedAmount * powerFactor`**. Instead, it follows a more sophisticated rate-based system:

#### Core Reward Formula

```typescript
// From src/common/InfoDashboard/helpers.ts lines 234-242
const rateDiff = BigNumber.from(poolInteraction.rate).sub(userInteraction.rate)
const periodReward = BigNumber.from(userInteraction.deposited)
  .mul(rateDiff)
  .div(DECIMAL) // DECIMAL = 10^25
```

**Formula**: `periodReward = depositedAmount * (currentPoolRate - userRate) / 10^25`

#### How This Works

1. **User Rate**: When you deposit stETH, you get assigned a `rate` value representing the pool's state at deposit time
2. **Pool Rate**: The pool's rate increases over time as rewards accumulate
3. **Rate Difference**: Your rewards come from the difference between current pool rate and your deposit rate
4. **Deposited Amount**: Your stETH deposit amount acts as the multiplier
5. **Power Factor**: Applied on top of this base calculation through the contract's reward multiplier system

#### Power Factor Integration

The power factor multiplies the **base rewards**, not the deposited amount:

```typescript
// Conceptual flow
const baseRewards = depositedAmount * (currentPoolRate - userRate) / 10^25
const finalRewards = baseRewards * powerFactor
```

#### Contract Data Structure

From the user data structure (`src/types/erc1967-proxy.types.ts`):

```typescript
export type UserData = {
  deposited: BigNumber        // Your stETH deposit amount
  rate: BigNumber            // Pool rate when you deposited
  pendingRewards: BigNumber  // Accumulated but unclaimed rewards
  // ... other fields
}
```

#### Why This System

This rate-based system ensures:
- **Fair Distribution**: Early depositors don't get unfair advantages
- **Time-Based Rewards**: Longer staking periods naturally earn more rewards
- **Power Factor Enhancement**: Lock periods multiply the reward rate, not just the deposit amount
- **Contract Precision**: All calculations handled at the smart contract level for accuracy

#### Estimated Rewards Calculation

When the UI shows "Est. Rewards Earned", it calculates:

1. **Get Current Pool Rate**: From contract state
2. **Get User Rate**: From user's deposit data  
3. **Calculate Rate Difference**: `currentPoolRate - userRate`
4. **Apply Deposit Amount**: `rateDistance * depositedAmount / 10^25`
5. **Apply Power Factor**: `baseRewards * powerFactor`
6. **Project Forward**: Estimate future rate increases over lock period

This is why estimated rewards show as "--- MOR" until the system has enough data to make projections.

## Maximum Power Factor Values and Scaling

### Maximum Lock Period: 6 Years

Based on the UI text in the ChangeLockModal, the protocol has a **maximum lock period of 6 years**:

```typescript
// From src/localization/resources/en.json
"change-lock-modal": {
  "subtitle": "You can postpone the claim of MOR tokens for a period of your choice and get increased MOR rewards. The longer the period, the higher the Power factor, up to 6 years."
}
```

This establishes the theoretical upper bound for power factor calculations.

### Official Power Factor Specifications

According to the [official Morpheus documentation](https://gitbook.mor.org/faqs/mor-rewards-staking#how-is-the-power-factor-determined), the power factor system has the following precise characteristics:

#### Maximum Power Factor: 10.7x

The **maximum Power Factor multiplier is 10.7x** if staked for 6 years. This represents the absolute ceiling for reward amplification in the system.

#### Minimum Period Before Power Factor Activation: 6 Months

**Power Factor starts to grow from 1x after approximately six months of staking**. This means:
- **0-6 months**: Power Factor remains at 1.0x (no multiplier benefit)
- **6+ months**: Power Factor begins to increase progressively
- **6 years**: Power Factor reaches maximum of 10.7x

#### Reasonable Staking Range

While there are no hard limits on staking duration, the **reasonable range is from six months to six years**:
- **Below 6 months**: No power factor benefits
- **6 months to 6 years**: Progressive power factor increases
- **Beyond 6 years**: Diminishing returns with minimal additional benefits

### Scaling Mechanism and Theoretical Bounds

#### Lock Duration to Multiplier Relationship

The power factor scales based on the **duration** of the lock period, not the absolute timestamp. The relationship follows this pattern:

1. **Base Multiplier**: `1.0000` (no lock period or under 6 months)
2. **Activation Threshold**: 6 months minimum before power factor begins to grow
3. **Progressive Scaling**: Multiplier increases as lock duration extends beyond 6 months
4. **Maximum Duration**: 6 years (approximately 189,216,000 seconds)
5. **Theoretical Maximum**: 10.7x multiplier achievable with a 6-year lock

#### Mathematical Scaling Formula

According to [MRC42](https://raw.githubusercontent.com/MorpheusAIs/MRC/refs/heads/main/IN%20PROGRESS/MRC42.md), the Power Factor mirrors the dilution rate contributors experience while staking MOR rewards. The equation can be found in the MRC42 document.

The scaling follows these principles:

```typescript
// Conceptual scaling relationship
const lockDuration = lockEnd - lockStart // in seconds
const minActivationPeriod = 6 * 30 * 24 * 60 * 60 // 6 months in seconds
const maxDuration = 6 * 365 * 24 * 60 * 60 // 6 years in seconds

// Power Factor calculation logic
if (lockDuration < minActivationPeriod) {
  powerFactor = 1.0 // No multiplier benefit
} else if (lockDuration >= maxDuration) {
  powerFactor = 10.7 // Maximum multiplier
} else {
  // Progressive scaling between 6 months and 6 years
  powerFactor = calculateProgressiveMultiplier(lockDuration)
}
```

#### Diminishing Returns Analysis

The system implements **diminishing returns** to prevent exponential multiplier growth:

- **0-6 months**: No power factor benefits (stays at 1.0x)
- **6 months to 1 year**: Significant multiplier increases for early lock periods
- **1-3 years**: Moderate incremental increases
- **3-6 years**: Smaller incremental increases
- **6+ years**: Minimal or no additional multiplier benefits (capped at 10.7x)

### Contract-Level Limits and Caps

#### Hardcoded Limits

The smart contract implements several types of limits:

1. **Maximum Lock Duration**: 6 years (as indicated by UI text)
2. **Multiplier Ceiling**: 10.7x maximum power factor
3. **Activation Threshold**: 6 months minimum before power factor begins
4. **Rate Limiting**: How quickly multipliers can increase with time

#### Validation and Enforcement

```typescript
// Contract-level validation (conceptual)
function validateLockPeriod(lockEnd: uint256) {
  require(lockEnd <= block.timestamp + MAX_LOCK_PERIOD, "Lock period too long")
  require(lockEnd > block.timestamp, "Lock period must be in the future")
}

function calculatePowerFactor(lockStart: uint256, lockEnd: uint256) {
  uint256 duration = lockEnd - lockStart;
  uint256 minPeriod = 6 * 30 * 24 * 60 * 60; // 6 months
  
  if (duration < minPeriod) {
    return 1.0 * MULTIPLIER_SCALE; // No multiplier benefit
  }
  
  // Calculate progressive scaling up to 10.7x maximum
  return calculateProgressiveMultiplier(duration);
}
```

### Testing Maximum Values

To determine the actual maximum power factor, you would need to:

#### 1. Smart Contract Analysis
- Review the `getClaimLockPeriodMultiplier` function implementation
- Look for hardcoded constants like `MAX_MULTIPLIER = 10.7`
- Check for the 6-month activation threshold
- Examine the mathematical formulas from MRC42

#### 2. Empirical Testing
- Test with progressively longer lock periods starting from 6 months
- Monitor when multiplier increases plateau at 10.7x
- Identify the point of diminishing returns around 6 years

#### 3. Contract Documentation
- Check for mathematical formulas in contract comments
- Review MRC42 for the exact power factor calculation equation
- Look for any whitepapers or technical specifications

### Example Maximum Lock Scenarios

#### 6-Month Activation Threshold
```typescript
// Minimum period before power factor starts to grow
const minActivationPeriod = 6 * 30 * 24 * 60 * 60 // 6 months
const activationTimestamp = currentTimestamp + minActivationPeriod

// This would yield the first power factor increase above 1.0x
const firstMultiplier = await contract.getClaimLockPeriodMultiplier(
  poolId,
  currentTimestamp,
  activationTimestamp
)
```

#### 6-Year Maximum Lock
```typescript
// Maximum possible lock period
const maxLockPeriod = 6 * 365 * 24 * 60 * 60 // 189,216,000 seconds
const maxLockEnd = currentTimestamp + maxLockPeriod

// This would yield the maximum power factor of 10.7x
const maxMultiplier = await contract.getClaimLockPeriodMultiplier(
  poolId,
  currentTimestamp,
  maxLockEnd
)
// Expected result: 10.7x (or 107000 in raw contract units)
```

#### Progressive Lock Periods
```typescript
// Test different lock durations to understand scaling
const testPeriods = [
  3 * 30 * 24 * 60 * 60,    // 3 months (below threshold - should be 1.0x)
  6 * 30 * 24 * 60 * 60,    // 6 months (activation threshold)
  1 * 365 * 24 * 60 * 60,   // 1 year
  3 * 365 * 24 * 60 * 60,   // 3 years
  6 * 365 * 24 * 60 * 60    // 6 years (maximum - should be 10.7x)
]

// Each period would yield progressively higher multipliers
// starting from 1.0x at 6 months up to 10.7x at 6 years
```

### Practical Implications

#### User Strategy Considerations

1. **Short-term Locks (0-6 months)**: No power factor benefits, maximum flexibility
2. **Medium-term Locks (6 months - 2 years)**: Moderate multiplier increases with reasonable commitment
3. **Long-term Locks (2-5 years)**: Significant multiplier benefits with substantial commitment
4. **Maximum Locks (6 years)**: Highest possible rewards (10.7x) but maximum commitment

#### Risk vs. Reward Analysis

- **Below 6 months**: No multiplier benefits, maximum liquidity
- **6 months to 1 year**: Small multiplier increases with moderate commitment
- **1-3 years**: Balanced multiplier benefits vs. commitment
- **3-6 years**: High multiplier benefits but significant commitment
- **6+ years**: Maximum rewards (10.7x) but maximum illiquidity

#### Optimal Strategy

Users must balance multiplier benefits against their liquidity needs:
- **Conservative**: 6 months to 1 year for minimal commitment with some benefits
- **Balanced**: 1-3 years for moderate commitment with good benefits
- **Aggressive**: 3-6 years for high commitment with maximum benefits
- **Maximum**: 6 years for highest possible rewards (10.7x)

### Future Protocol Updates

The power factor system may be subject to protocol governance:

1. **Governance Control**: Maximum lock periods and multipliers could be adjusted by DAO votes
2. **Protocol Evolution**: New multiplier mechanisms or activation thresholds could be introduced
3. **Market Conditions**: Limits might be adjusted based on economic factors and community feedback
4. **MRC Updates**: The MRC42 proposal could be modified or replaced by future governance decisions

## Conclusion

The Power Factor system is a sophisticated mechanism that incentivizes long-term participation in the Morpheus protocol. By extending claim lock periods, users can significantly increase their rewards through multipliers that scale based on their commitment duration.

The implementation spans multiple layers:
- **Smart contracts** handle core calculations and enforce lock periods
- **Frontend composables** manage state and data fetching
- **UI components** provide intuitive interaction and real-time feedback
- **Mathematical precision** ensures accurate multiplier calculations

This system effectively aligns user incentives with protocol growth, rewarding those who demonstrate long-term commitment with proportionally higher rewards.
