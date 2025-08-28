## 📁 Main Page Structure

### **Core File**: `app/builders/page.tsx`
- **Main Component**: `BuildersPage` (default export)
- **Sub-components**:
  - `BuilderModalWrapper` - Admin bulk registration and "Become a Builder" modal
- **Context Providers**: Uses existing global providers (BuildersProvider, AuthProvider, NetworkProvider)
- **Tab System**: Three main tabs with different data views

### **Additional Pages**:
- **Builder Detail**: `app/builders/[slug]/page.tsx` - Individual builder staking interface
- **Create Subnet**: `app/builders/newsubnet/page.tsx` - Subnet creation form

## 🏗️ Main Layout Components

### 1. **MetricCard Dashboard** (Top Section)
- **Function**: Displays overall builder ecosystem metrics
- **Dependencies**:
  - `MetricCard` from `@/components/metric-card`
  - `GlowingEffect` from `@/components/ui/glowing-effect`
  - `useBuilders` context for total metrics
  - `formatNumber` from `@/lib/utils`
- **Features**: Total staked, active builders, community stats with animated numbers

### 2. **Tab Navigation System**
- **Function**: Three-tab interface for different builder views
- **Dependencies**:
  - `Tabs, TabsContent, TabsList, TabsTrigger` from `@/components/ui/tabs`
  - URL parameter management via `useUrlParams`
- **Tabs**:
  - **Builders**: All available builders
  - **Staking in**: Builders user is participating in
  - **Your Subnets**: Subnets administered by user

### 3. **Builders Tab** (Main Builders List)
- **Function**: Searchable, filterable, sortable table of all builders
- **Dependencies**:
  - `DataTable` from `@/components/ui/data-table`
  - `DataFilters` from `@/components/ui/data-filters`
  - `HoverCard` components for builder preview
  - `Image` from Next.js for builder logos
  - `ArbitrumIcon, BaseIcon` network indicators
- **Features**: Name/network/reward type filtering, sorting by staked amounts

### 4. **Staking in Tab** (User Participation)
- **Function**: Shows builders where user has staked tokens
- **Dependencies**:
  - `useUserStakedBuilders` hook for mainnet data
  - `StakeVsTotalChart` component for visual representation
  - Same table/filtering infrastructure as Builders tab
- **Features**: User stake vs total visualization, personal staking dashboard

### 5. **Your Subnets Tab** (Admin View)
- **Function**: Management interface for user's administered subnets
- **Dependencies**:
  - `useAuth` context for admin verification
  - Filtered builders data based on admin addresses
  - Status calculation based on `startsAt` timestamps
- **Features**: Subnet status tracking, admin-specific actions

### 6. **StakeModal** (Universal Staking Interface)
- **Function**: Modal for staking actions across all tabs
- **Dependencies**:
  - `StakeModal` from `@/components/staking/stake-modal`
  - `useStakingContractInteractions` for blockchain operations
  - MOR token balance checking
- **Features**: Cross-tab staking functionality with approval flows

## 🎯 Builder Detail Page Components

### **Individual Builder Page** (`app/builders/[slug]/page.tsx`):

#### **Core Components**:
1. **ProjectHeader** - Builder information display
2. **MetricCard** - Builder-specific statistics  
3. **StakingFormCard** - MOR token staking interface
4. **WithdrawalPositionCard** - User withdrawal management
5. **ClaimFormCard** - Admin reward claiming (admin-only)
6. **StakingTable** - Active stakers list

#### **Key Dependencies**:
- `useParams, useRouter` from Next.js navigation
- `useBuilders` context for builder data
- `useStakingData` hook for staker information
- `useStakingContractInteractions` for blockchain operations
- `wagmi` hooks: `useAccount, useChainId, useReadContract`
- Contract ABIs: `BuildersAbi, BuilderSubnetsV2Abi`

## 🔧 Context & State Management

### **BuildersContext** (`context/builders-context.tsx`)
This is the **central data management system** for the builders page:

#### **Core State Management**:
- Multi-network support (Arbitrum, Base, Arbitrum Sepolia)
- Real-time filtering and sorting
- URL parameter synchronization
- Total metrics calculation

#### **Key Hooks Integration**:
- **useAllBuildersQuery**: Main data fetching hook
- **useUrlParams**: URL state synchronization
- **React Query**: Data caching and invalidation

#### **Filtering & Sorting System**:
- Name-based text filtering
- Network-based filtering (Arbitrum/Base)
- Reward type filtering
- Multi-column sorting with URL persistence

## 📊 Data Hooks

### 1. **useAllBuildersQuery** (`app/hooks/useAllBuildersQuery.ts`)
- **Function**: Master data fetching hook combining multiple sources
- **Features**: Supabase metadata + GraphQL on-chain data + Morlord API
- **Dependencies**: Multiple data source hooks, network detection

### 2. **useUserStakedBuilders** (`app/hooks/useUserStakedBuilders.ts`)
- **Function**: Fetches builders where user has staked tokens
- **Features**: Network-aware queries, stake amount calculation
- **Dependencies**: GraphQL clients, authentication context

### 3. **useSupabaseBuilders** (`app/hooks/useSupabaseBuilders.ts`)
- **Function**: Supabase metadata and real-time subscriptions
- **Features**: Initial load + real-time updates for builder metadata
- **Dependencies**: Supabase client, BuildersService

### 4. **useMorlordBuilders** (`app/hooks/useMorlordBuilders.ts`)
- **Function**: External API integration for additional builder names
- **Features**: CORS-friendly API proxy, error handling
- **Dependencies**: React Query, internal API route

### 5. **useStakingData** (`hooks/use-staking-data.ts`)
- **Function**: GraphQL queries for staking table data
- **Features**: Network-aware queries, pagination, sorting
- **Dependencies**: Apollo Client, GraphQL queries

### 6. **useStakingContractInteractions** (`hooks/useStakingContractInteractions.ts`)
- **Function**: Blockchain interaction management
- **Features**: Approval flows, staking/withdrawal/claiming operations
- **Dependencies**: wagmi hooks, contract ABIs, network configuration

## 🛠️ Utility Libraries

### 1. **Builder Data Adapter** (`lib/utils/builders-adapter.ts`)
- **Function**: Transforms GraphQL data to UI format
- **Features**: Network detection, timestamp formatting, wei conversion
- **Dependencies**: Time utilities, GraphQL types

### 2. **Supabase Utils** (`app/utils/supabase-utils.ts`)
- **Function**: Name/slug conversion utilities
- **Features**: URL-friendly slug generation, special character handling
- **Dependencies**: Builder database types

### 3. **URL Parameters** (`lib/utils/url-params.ts`)
- **Function**: URL state synchronization
- **Features**: Filter persistence, sorting persistence, tab state
- **Dependencies**: Next.js router, parameter converters

### 4. **Network Detection** (`lib/utils/network-detection.ts`)
- **Function**: Network-specific logic and identification
- **Features**: Testnet/mainnet detection, contract address mapping
- **Dependencies**: wagmi chain definitions

## 🔗 Type System

### Core Types:
- **Builder** (`app/builders/builders-data.ts`) - Extended builder interface
- **BuilderDB** (`app/lib/supabase.ts`) - Supabase database schema
- **BuilderProject** (`lib/types/graphql.ts`) - GraphQL response format
- **Column** (`components/ui/data-table.tsx`) - Table column definitions

### Context Types:
- **BuildersContextType** - Comprehensive builders context interface
- **UseStakingDataProps** - Staking data hook parameters
- **UseStakingContractInteractionsProps** - Contract interaction parameters

## 🌐 External Dependencies

### **Blockchain Libraries**:
- **wagmi** - React hooks for Ethereum interactions
- **viem** - TypeScript Ethereum library for low-level operations
- **Contract ABIs** - BuildersAbi, BuilderSubnetsV2Abi for contract interactions

### **Data Management**:
- **@tanstack/react-query** - Server state management and caching
- **@apollo/client** - GraphQL client for on-chain data
- **Supabase** - Metadata storage and real-time subscriptions

### **UI Libraries**:
- **@web3icons/react** - Network and token icons
- **lucide-react** - General UI icons
- **@number-flow/react** - Animated number displays
- **Custom UI components** - Shadcn-based component system

### **Services**:
- **GraphQL APIs** - On-chain data from multiple networks
- **Supabase API** - Builder metadata and admin information
- **Morlord API** - External builder name validation

## 🎨 Key Features

### **Multi-Network Architecture**:
- Unified interface for Arbitrum, Base, and testnet networks
- Network-aware data fetching and contract interactions
- Automatic network switching and detection

### **Advanced Filtering System**:
- Real-time text search across builder names
- Network-specific filtering with visual indicators  
- Reward type categorization and filtering
- URL-persistent filter state

### **User Role Management**:
- Admin-specific functionality for subnet owners
- Participant view for staked users
- Permission-based UI component rendering

### **Comprehensive Staking Interface**:
- Universal stake modal across all tabs
- Approval flow management for ERC-20 tokens
- Real-time balance and allowance checking
- Transaction state management with loading indicators

### **Data Source Integration**:
- Supabase for metadata and admin information
- GraphQL subgraphs for on-chain staking data
- External APIs for comprehensive builder lists
- Real-time subscriptions for live updates

This architecture provides a robust, scalable foundation for the builder ecosystem with comprehensive data management, multi-network support, and excellent user experience across different user roles and interaction patterns.
