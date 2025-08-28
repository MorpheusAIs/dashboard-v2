## 📁 Main Page Structure

### **Core File**: `app/capital/page.tsx`
- **Main Component**: `CapitalPage` (default export)
- **Content Component**: `CapitalPageContent` 
- **Context Provider**: `CapitalProvider` wraps the entire page
- **Suspense Wrapper**: Handles loading states

## 🏗️ Main Layout Components

### 1. **CapitalInfoPanel** (`components/capital/capital-info-panel.tsx`)
- **Function**: Asset selection and basic info display
- **Dependencies**:
  - `useCapitalContext` - Main context hook
  - `useCapitalPoolData` - Live pool data
  - `@number-flow/react` - Animated numbers
  - `@web3icons/react` - Token icons
  - `GlowingEffect` - UI enhancement
  - `Asset` type from `./types/asset.ts`
- **Features**: Asset table with APR, total deposited, and deposit buttons

### 2. **ChartSection** (`components/capital/chart-section.tsx`)
- **Function**: Historical data visualization and key metrics
- **Dependencies**:
  - `DepositStethChart` - Chart component
  - `MetricCardMinimal` - Metric display cards
  - `useCapitalChartData` - Chart data hook
  - `useCapitalMetrics` - Live metrics hook
  - `GlowingEffect` - UI enhancement
- **Features**: 4 metric cards + historical deposits chart

### 3. **UserAssetsPanel** (`components/capital/user-assets-panel.tsx`)
- **Function**: User's personal staking dashboard
- **Dependencies**:
  - `useCapitalContext` - Main context
  - `DataTable` - Table component
  - `useDailyEmissions` - Emissions calculation
  - `useTotalMorEarned` - Historical earnings
  - `getTokenPrice` - Price service
  - `MetricCardMinimal` - Metrics display
  - `UserAsset` type from `./types/user-asset.ts`
- **Features**: Personal metrics + asset management table

### 4. **ReferralPanel** (`components/capital/referral-panel.tsx`)
- **Function**: Referral system management
- **Dependencies**:
  - `useCapitalContext` - Main context
  - `MetricCardMinimal` - Metrics display
  - `toast` from `sonner` - Notifications
- **Features**: Referral link generation and rewards tracking

## 🎯 Modal Components

### Core Modals:
1. **DepositModal** - Asset deposits with lock periods
2. **WithdrawModal** - Asset withdrawals
3. **ClaimModal** - Reward claiming
4. **ClaimMorRewardsModal** - MOR reward claiming
5. **ChangeLockModal** - Lock period modifications
6. **StakeMorRewardsModal** - MOR staking

**Key Modal Dependencies**:
- `useCapitalContext` - State management
- `usePowerFactor` - Power factor calculations
- `useEstimatedRewards` - Reward estimates
- `useEnsAddress` - ENS resolution
- `Dialog` components from UI library

## 🔧 Context & State Management

### **CapitalPageContext** (`context/CapitalPageContext.tsx`)
This is the **central nervous system** of the capital page:

#### **Core State Management**:
- Multi-asset support (stETH, LINK)
- V2 protocol integration
- Network environment handling
- Modal state management

#### **Key Hooks Integration**:
- **wagmi hooks**: `useAccount`, `useChainId`, `useReadContract`, `useBalance`, `useWriteContract`
- **Custom hooks**: `useCapitalPoolData` for live data
- **Contract interactions**: Dynamic contract loading with `getContract`

#### **Transaction Management**:
- Asset-aware approval system
- Multi-step transaction flows
- Error handling with toast notifications
- Safe wallet detection

## 📊 Data Hooks

### 1. **useCapitalPoolData** (`hooks/use-capital-pool-data.ts`)
- **Function**: Live pool data from V2/V7 protocol contracts
- **Features**: APR calculation, total deposits, network-aware data
- **Dependencies**: Contract ABIs, network configuration

### 2. **useCapitalChartData** (`app/hooks/useCapitalChartData.ts`)  
- **Function**: Historical chart data via GraphQL
- **Features**: Mainnet historical data, testnet fallbacks
- **Dependencies**: GraphQL queries, ethers.js, token price service

### 3. **useCapitalMetrics** (`app/hooks/useCapitalMetrics.ts`)
- **Function**: Real-time metrics calculation
- **Features**: TVL calculation, active stakers via Dune API
- **Dependencies**: Token price service, pool data hook

### 4. **usePowerFactor** (`hooks/use-power-factor.ts`)
- **Function**: Power factor calculations for lock periods
- **Features**: Contract-based calculations, validation, unlock dates
- **Dependencies**: Power factor utilities, contract interactions

## 🛠️ Utility Libraries

### 1. **Power Factor Utils** (`lib/utils/power-factor-utils.ts`)
- Duration calculations
- Validation logic  
- Calendar-based date calculations
- Contract-specific constants

### 2. **Formatters** (`lib/utils/formatters.ts`)
- BigInt formatting
- Timestamp formatting
- Number display utilities

### 3. **Services**:
- **Token Price Service** (`app/services/token-price.service.ts`) - CoinGecko integration
- **Safe Wallet Detection** - Multi-sig wallet support

## 🔗 Type System

### Core Types:
- **Asset** (`components/capital/types/asset.ts`) - Basic asset info
- **UserAsset** (`components/capital/types/user-asset.ts`) - User-specific asset data
- **AssetSymbol** - Enum for supported assets ('stETH' | 'LINK')
- **TimeUnit** - Lock period units ('days' | 'months' | 'years')

### Context Types:
- **CapitalContextState** - Comprehensive context interface
- **NetworkEnvironment** - Network configuration
- **PowerFactorResult** - Power factor calculation results

## 🌐 External Dependencies

### **Blockchain Libraries**:
- **wagmi** - React hooks for Ethereum
- **viem** - TypeScript Ethereum library
- **Contract ABIs** - V2 protocol contracts

### **UI Libraries**:
- **@web3icons/react** - Token icons
- **@number-flow/react** - Animated numbers
- **sonner** - Toast notifications
- **Custom UI components** - Dialog, DataTable, etc.

### **Services**:
- **CoinGecko API** - Token prices
- **GraphQL** - Historical data
- **Dune Analytics API** - On-chain metrics

## 🎨 Key Features

### **Multi-Asset Support**:
- stETH and LINK deposits
- Asset-specific APR calculations
- Independent power factors per asset

### **Power Factor System**:
- Time-locked rewards multiplier
- Maximum 9.7x multiplier at 6 years
- Real-time contract calculations

### **V2 Protocol Integration**:
- Modern deposit pool contracts
- Cross-chain reward distribution
- Enhanced referral system

### **Network Awareness**:
- Testnet: Live contract data
- Mainnet: Placeholder data until deployment
- Automatic network switching

This architecture provides a robust, scalable foundation for the capital staking system with comprehensive state management, real-time data integration, and excellent user experience.