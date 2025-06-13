# Capital Page Current Implementation State

This document thoroughly documents the current state of the `/capital` page implementation as of the current codebase analysis. It covers the layout, components, calculations, functionality, and smart contract functions being used.

## Overview

The capital page has been fully implemented with a modern, responsive design that allows users to:
- View global pool statistics and their personal position
- Deposit stETH to earn MOR rewards
- Claim earned MOR rewards
- Withdraw deposited stETH
- Adjust lock periods to increase reward multipliers
- View historical deposit data through an interactive chart

## Architecture & Structure

### File Organization
```
app/capital/
├── page.tsx                           # Main page component (457 lines)

components/capital/
├── DepositModal.tsx                   # Deposit functionality (187 lines)
├── WithdrawModal.tsx                  # Withdraw functionality (161 lines) 
├── ClaimModal.tsx                     # Claim rewards functionality (115 lines)
├── ChangeLockModal.tsx                # Lock period adjustment (187 lines)
└── DepositStethChart.tsx              # Historical deposits chart (597 lines)

context/
└── CapitalPageContext.tsx             # State management context (743 lines)

lib/utils/
└── formatters.ts                      # Data formatting utilities (65 lines)
```

## Layout & UI Implementation

### Page Structure
The page uses a **3-column responsive grid layout**:

1. **Column 1 (1/3 width)**: Capital Info Panel
   - Project title and description
   - Primary deposit button
   - Global pool statistics (stacked vertically)
   - Glowing border effect on hover

2. **Column 2-3 (2/3 width)**: Interactive Deposit Chart
   - Real-time historical deposit data visualization
   - Zoom and pan functionality
   - Time range selection (7d, 1m, 3m, Max)
   - Network-aware chart (testnet shows placeholder)

3. **Bottom Section**: User Position Dashboard
   - 3-column grid showing user's specific data
   - Action buttons for each metric
   - Lock period information with tooltips

### Visual Components

#### Global Statistics Cards
- **Total Deposits**: Shows pool-wide stETH deposits with NumberFlow animations
- **Current Daily Reward**: Calculated MOR distribution rate
- **Pool Start Time**: Formatted timestamp of pool activation

#### User Position Cards  
- **Your Deposit**: Personal stETH contribution with withdraw button
- **Available to Claim**: Claimable MOR rewards with claim button
- **Your Power Factor**: Reward multiplier with lock adjustment button

#### Interactive Elements
- **Glowing Effects**: Applied to major sections using `GlowingEffect` component
- **NumberFlow Animations**: Smooth number transitions for all numeric displays
- **Tooltips**: Info icons with explanatory text using shadcn/ui Tooltip
- **Responsive Design**: Adapts layout for mobile/tablet/desktop

## Context-Based State Management

### CapitalPageContext Architecture
The implementation uses a centralized React Context (`CapitalPageContext`) that manages:

#### Data Categories
1. **Static Configuration**
   - Contract addresses (ERC1967Proxy, stETH, MOR token)
   - Network environment detection (mainnet/testnet)
   - Chain IDs for L1 (Ethereum) and L2 (Arbitrum)

2. **Real-time Contract Data**
   - Pool configuration and limits
   - User-specific data (deposits, rewards, multipliers)
   - Global pool statistics
   - Token balances and allowances

3. **Calculated Values**
   - Current daily reward rates
   - Lock period timestamps
   - Eligibility flags for actions

4. **Formatted Display Data**
   - Human-readable numbers with proper decimals
   - Formatted timestamps and dates
   - Loading state placeholders ("---")

#### State Management Features
- **Automatic Refetching**: Data updates after successful transactions
- **Loading States**: Granular loading indicators for different data types  
- **Error Handling**: Comprehensive error catching and user feedback
- **Transaction Monitoring**: Real-time transaction status tracking

## Smart Contract Integration

### Contract Architecture
The implementation interacts with multiple smart contracts across different networks:

#### L1 (Ethereum) Contracts
1. **ERC1967Proxy** (Main Pool Contract)
   - **Mainnet**: `0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790`
   - **Sepolia**: `0x7c46d6bebf3dcd902eb431054e59908a02aba524`

2. **stETH Token Contract**
   - **Mainnet**: `0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84`
   - **Sepolia**: `0xa878Ad6fF38d6fAE81FBb048384cE91979d448DA`

#### L2 (Arbitrum) Contracts  
1. **MOR Token Contract**
   - **Arbitrum One**: `0x092baadb7def4c3981454dd9c0a0d7ff07bcfc86`
   - **Arbitrum Sepolia**: `0x34a285A1B1C166420Df5b6630132542923B5b27E`

### Smart Contract Functions Used

#### Read Functions (ERC1967Proxy)

1. **`pools(uint256 poolId)`** - Returns pool configuration:
   ```solidity
   struct Pool {
     uint128 payoutStart;           // Pool activation timestamp
     uint128 decreaseInterval;      // Reward decrease interval  
     uint128 withdrawLockPeriod;    // Global withdraw lock duration
     uint128 claimLockPeriod;       // Global claim lock duration
     uint128 withdrawLockPeriodAfterStake; // Post-stake withdraw lock
     uint256 initialReward;         // Starting reward rate
     uint256 rewardDecrease;        // Reward decrease amount
     uint256 minimalStake;          // Minimum deposit requirement
     bool isPublic;                 // Pool accessibility
   }
   ```

2. **`poolsLimits(uint256 poolId)`** - Returns additional limits:
   ```solidity
   struct PoolLimits {
     uint128 claimLockPeriodAfterStake;  // Post-stake claim lock
     uint128 claimLockPeriodAfterClaim;  // Post-claim lock period
   }
   ```

3. **`usersData(address user, uint256 poolId)`** - Returns user-specific data:
   ```solidity
   struct UserData {
     uint128 lastStake;        // Last stake timestamp
     uint256 deposited;        // Total deposited amount
     uint256 rate;            // User's reward rate
     uint256 pendingRewards;  // Accumulated rewards
     uint128 claimLockStart;  // Claim lock start time
     uint128 claimLockEnd;    // Claim lock end time  
     uint256 virtualDeposited; // Virtual deposit amount
     uint128 lastClaim;       // Last claim timestamp
     address referrer;        // Referrer address
   }
   ```

4. **`totalDepositedInPublicPools()`** - Returns total pool deposits
5. **`getCurrentUserReward(uint256 poolId, address user)`** - Returns claimable rewards
6. **`getCurrentUserMultiplier(uint256 poolId, address user)`** - Returns reward multiplier
7. **`getClaimLockPeriodMultiplier(uint256 poolId, uint128 start, uint128 end)`** - Simulates multiplier

#### Write Functions (ERC1967Proxy)

1. **`stake(uint256 poolId, uint256 amount, address referrer)`**
   - Deposits stETH into the pool
   - Requires prior ERC20 approval
   - Uses pool ID `0` (public pool)

2. **`claim(uint256 poolId, address receiver)`** 
   - Claims accumulated MOR rewards
   - Mints MOR on Arbitrum L2
   - Subject to claim lock periods

3. **`withdraw(uint256 poolId, uint256 amount)`**
   - Withdraws deposited stETH
   - Subject to withdraw lock periods
   - Partial withdrawals supported

4. **`lockClaim(uint256 poolId, uint128 claimLockEnd)`**
   - Sets claim lock period for multiplier boost
   - Timestamp must be in the future
   - Affects reward multiplier calculation

#### ERC20 Functions (stETH)

1. **`approve(address spender, uint256 amount)`** - Approves pool contract to spend stETH
2. **`allowance(address owner, address spender)`** - Checks current allowance
3. **`balanceOf(address account)`** - Returns user's stETH balance

## Mathematical Calculations

### Frontend Calculations

#### 1. Current Daily Reward Rate
```typescript
const currentDailyReward = useMemo(() => {
  if (!poolInfo?.payoutStart || !poolInfo.initialReward || 
      !poolInfo.rewardDecrease || !poolInfo.decreaseInterval) return undefined;
  
  if (currentTimestampSeconds < poolInfo.payoutStart) return BigInt(0);
  
  const intervalsPassed = (currentTimestampSeconds - poolInfo.payoutStart) / poolInfo.decreaseInterval;
  const currentRewardRate = poolInfo.initialReward - (intervalsPassed * poolInfo.rewardDecrease);
  const effectiveRewardRate = currentRewardRate > BigInt(0) ? currentRewardRate : BigInt(0);
  
  return (effectiveRewardRate * SECONDS_PER_DAY) / poolInfo.decreaseInterval;
}, [poolInfo, currentTimestampSeconds]);
```

#### 2. Withdraw Unlock Timestamp
```typescript
const withdrawUnlockTimestamp = useMemo(() => {
  if (!poolInfo?.payoutStart || !poolInfo.withdrawLockPeriod || 
      !userData?.lastStake || !poolInfo.withdrawLockPeriodAfterStake) return undefined;
  
  return maxBigInt(
    poolInfo.payoutStart + poolInfo.withdrawLockPeriod,
    userData.lastStake + poolInfo.withdrawLockPeriodAfterStake
  );
}, [poolInfo, userData]);
```

#### 3. Claim Unlock Timestamp  
```typescript
const claimUnlockTimestamp = useMemo(() => {
  if (!poolInfo?.payoutStart || !poolInfo.claimLockPeriod || 
      !poolLimits?.claimLockPeriodAfterClaim || !poolLimits.claimLockPeriodAfterStake ||
      !userData?.lastStake || !userData.lastClaim || userData.claimLockEnd === undefined) return undefined;
  
  return maxBigInt(
    userData.claimLockEnd,
    poolInfo.payoutStart + poolInfo.claimLockPeriod,
    userData.lastClaim + poolLimits.claimLockPeriodAfterClaim,
    userData.lastStake + poolLimits.claimLockPeriodAfterStake
  );
}, [poolInfo, poolLimits, userData]);
```

### Data Formatting

#### Number Formatting
- **BigInt to Decimal**: Uses `viem`'s `formatUnits(value, 18)` for 18-decimal tokens
- **Display Precision**: Different precision levels (0-4 decimals) based on context
- **Localization**: Uses `toLocaleString()` with appropriate formatting options
- **Loading States**: Shows "---" placeholders during data loading

#### Timestamp Formatting
- **Duration Display**: Converts seconds to human-readable format (days, hours, minutes)
- **Absolute Timestamps**: Displays full date/time for unlock periods
- **Special Cases**: Handles "Never", "Unlocked", and invalid timestamps

## Modal Components

### 1. DepositModal.tsx
**Purpose**: Handle stETH deposits into the pool

**Features**:
- Input validation against balance and minimum stake
- Two-step process: Approval → Deposit
- Real-time balance display
- Form error handling and user feedback
- Automatic modal closing on successful deposit

**Key Validations**:
- Minimum deposit amount check
- Sufficient balance verification
- Approval requirement detection

### 2. WithdrawModal.tsx  
**Purpose**: Withdraw deposited stETH from the pool

**Features**:
- Amount input with balance validation
- Lock period eligibility checking
- Partial withdrawal support
- Real-time unlock timestamp display

### 3. ClaimModal.tsx
**Purpose**: Claim accumulated MOR rewards

**Features**:
- Display claimable amount
- Lock period status checking
- Single-click claiming process
- Cross-chain reward minting (L2)

### 4. ChangeLockModal.tsx
**Purpose**: Adjust claim lock period for multiplier boost

**Features**:
- Duration input (days/months/years)
- Real-time multiplier simulation using contract calls
- Visual representation of multiplier changes
- Timestamp conversion and validation

## Chart Implementation

### DepositStethChart.tsx
**Purpose**: Display historical stETH deposit data with interactive features

#### Data Source
- **GraphQL Integration**: Fetches data from subgraph using Apollo Client
- **Query Structure**: Multi-alias queries for end-of-day snapshots
- **Data Processing**: Handles missing data points and error states
- **Network Awareness**: Shows placeholder on testnet, live data on mainnet

#### Chart Features
1. **Interactive Zoom**: Mouse wheel and drag selection
2. **Time Range Selection**: Toggle buttons (7d, 1m, 3m, Max)
3. **Responsive Design**: Adapts height based on container width
4. **Custom Tooltips**: Formatted timestamps and values
5. **Axis Formatting**: Dynamic date/time formatting based on zoom level

#### Technical Implementation
- **Recharts Library**: Uses `ComposedChart` with `Area` component
- **Real-time Updates**: Automatic data refresh
- **Performance Optimization**: Memo hooks and efficient re-rendering
- **Error Handling**: Graceful fallbacks for data loading failures

## Network Configuration

### Multi-Chain Support
The implementation supports both mainnet and testnet environments:

#### Mainnet Configuration
- **L1**: Ethereum Mainnet (Chain ID: 1)
- **L2**: Arbitrum One (Chain ID: 42161) 
- **GraphQL**: Production subgraph endpoints

#### Testnet Configuration  
- **L1**: Ethereum Sepolia (Chain ID: 11155111)
- **L2**: Arbitrum Sepolia (Chain ID: 421614)
- **GraphQL**: Testnet subgraph endpoints

### Network Detection
```typescript
const networkEnv = useMemo((): NetworkEnvironment => {
  return [1, 42161, 8453].includes(chainId) ? 'mainnet' : 'testnet';
}, [chainId]);
```

## Transaction Handling

### Transaction Flow
1. **Initiation**: User clicks action button
2. **Validation**: Check eligibility and input validity
3. **Approval** (if needed): ERC20 token approval for deposits
4. **Execution**: Contract write operation
5. **Monitoring**: Transaction status tracking
6. **Confirmation**: Success feedback and data refresh
7. **Cleanup**: Modal closing and state reset

### Error Handling
- **Transaction Failures**: Display specific error messages
- **Network Issues**: Handle RPC failures gracefully
- **User Rejections**: Distinguish between errors and cancellations
- **Loading States**: Prevent duplicate transactions

### User Feedback
- **Toast Notifications**: Real-time status updates using Sonner
- **Loading Indicators**: Button state changes during processing
- **Success Messages**: Confirmation of completed actions
- **Error Messages**: Detailed failure explanations

## Implementation Completeness

### Fully Implemented Features
✅ **UI Components**: All modals, charts, and display elements  
✅ **Smart Contract Integration**: Complete read/write operations  
✅ **State Management**: Centralized context with comprehensive data  
✅ **Transaction Handling**: Full approval/execution/monitoring flow  
✅ **Mathematical Calculations**: All reward and lock period calculations  
✅ **Data Formatting**: Human-readable displays with proper precision  
✅ **Network Support**: Multi-chain configuration and detection  
✅ **Chart Visualization**: Interactive historical data display  
✅ **Responsive Design**: Mobile and desktop optimized layouts  
✅ **Error Handling**: Comprehensive error states and user feedback

### Advanced Features Beyond Original Plan
🚀 **Interactive Chart**: Advanced zoom, pan, and time range selection  
🚀 **Real-time Multiplier Simulation**: Live contract calls for lock period changes  
🚀 **Cross-chain Balance Display**: Token balances from multiple networks  
🚀 **Advanced State Management**: Context-based architecture with automatic refetching  
🚀 **NumberFlow Animations**: Smooth transitions for numeric displays  
🚀 **Glowing UI Effects**: Enhanced visual appeal with hover effects  
🚀 **Network Environment Detection**: Automatic mainnet/testnet switching  
🚀 **GraphQL Integration**: Sophisticated historical data fetching

## Technical Dependencies

### Core Technologies
- **Next.js 14**: App router and React Server Components
- **React 18**: Hooks, Context, and concurrent features
- **TypeScript**: Full type safety and developer experience
- **Tailwind CSS**: Utility-first styling system

### Blockchain Integration
- **Wagmi v2**: React hooks for Ethereum interactions
- **Viem**: Low-level Ethereum utilities and formatting
- **WalletConnect**: Multi-wallet support

### UI Components
- **shadcn/ui**: Pre-built accessible components
- **Recharts**: Chart visualization library
- **NumberFlow**: Animated number transitions
- **Sonner**: Toast notification system

### Data Management
- **Apollo Client**: GraphQL data fetching and caching
- **React Hook Form**: Form state management
- **React Context**: Global state management

## Performance Optimizations

### Efficient Data Fetching
- **Parallel Queries**: Multiple contract reads executed simultaneously
- **Caching**: Apollo Client and Wagmi cache management
- **Conditional Fetching**: Queries only execute when prerequisites are met
- **Automatic Refetching**: Smart invalidation after transactions

### UI Performance  
- **Memoized Calculations**: Heavy computations cached with useMemo
- **Optimized Re-renders**: Careful dependency management
- **Lazy Loading**: Chart data loaded on demand
- **Debounced Inputs**: Reduced API calls during user interaction

## Security Considerations

### Input Validation
- **Amount Limits**: Minimum/maximum deposit validation
- **Balance Checks**: Prevent overdraft transactions
- **Approval Amounts**: Safe approval patterns using max uint256
- **Timestamp Validation**: Future timestamp requirements for locks

### Smart Contract Safety
- **Read-only Operations**: Separate read/write function calls
- **Transaction Monitoring**: Full confirmation tracking
- **Error Recovery**: Graceful handling of failed transactions
- **Approval Management**: Efficient approval checking and updating

This implementation represents a production-ready capital page that exceeds the original plan in both functionality and user experience, providing a comprehensive interface for stETH staking and MOR reward earning. 