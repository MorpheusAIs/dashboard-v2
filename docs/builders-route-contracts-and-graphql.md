### Builders route: contracts, ABIs, GraphQL queries, and addresses

This document summarizes the smart contracts and ABIs used by the builders route, the GraphQL endpoints and queries per network, and the relevant contract addresses on Arbitrum and Base mainnet networks.

### Scope
- Builders route pages and hooks: `app/builders/page.tsx`, `app/builders/[slug]/page.tsx`, `app/builders/newsubnet/page.tsx`
- Contract interaction hooks: `hooks/useStakingContractInteractions.ts`, `hooks/useSubnetContractInteractions.ts`
- GraphQL queries and clients: `app/graphql/queries/builders.ts`, `lib/graphql/builders-queries.ts`, `lib/apollo-client.ts`, `app/graphql/client.ts`

### ABIs used by the builders route

- **Builders** (Arbitrum and Base mainnet)
  - File: `app/abi/Builders.json`
  - Purpose: Main staking pool contract used by the builders route for deposit/withdraw/claim operations and user position reads.
  - Key functions used:
    - `deposit(bytes32 builderPoolId_, uint256 amount_)`
    - `withdraw(bytes32 builderPoolId_, uint256 amount_)`
    - `claim(bytes32 builderPoolId_, address receiver_)`
    - `usersData(address user, bytes32 builderPoolId) -> [lastDeposit, claimLockStart, deposited, virtualDeposited]`
    - `getCurrentBuilderReward(bytes32 builderPoolId_) -> uint256`
    - `createBuilderPool(tuple)` - for creating new builder pools

- **BuilderSubnets** (legacy V1 interface, read-only fallback)
  - File: `app/abi/BuilderSubnets.json`
  - Purpose: Legacy ABI used for fallback token address reads in `useStakingContractInteractions`.
  - Key functions used: `token() -> address`

- **ERC20**
  - File: `app/abi/ERC20.json`
  - Purpose: Standard ERC20 interface for MOR token approvals and balance operations.
  - Key functions used: `symbol()`, `balanceOf(address)`, `allowance(address,address)`, `approve(address,uint256)`

**Factory Contracts (not directly used via ABIs, but referenced for completeness):**
- **L2 Factory** (Arbitrum only): `0x890bfa255e6ee8db5c67ab32dc600b14ebc4546c`
- **Subnet Factory** (Arbitrum only): `0x37b94bd80b6012fb214bb6790b31a5c40d6eb7a5`
- **Note**: Factory contracts are configured in `config/networks.ts` but builders route creates pools directly via the `Builders.createBuilderPool()` function rather than through factory contracts.

**Proxy Contracts (configured but not used by builders route):**
- **ERC1967 Proxy** contracts are defined in `config/networks.ts` but are **NOT used by the builders route**
- Mainnet Ethereum: `0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790` (used by capital module)
- **Important**: The builders route interacts directly with implementation contracts, not through proxies
- Proxy contracts are primarily used by the capital module for stETH deposits and reward distribution

Note: Other ABIs in `app/abi/` (e.g., `DepositPool.json`, `DistributorV2.json`, `RewardPoolV2.json`) are used by the capital module and are not used by the builders route.

### Contract usage by page/hook

- `app/builders/[slug]/page.tsx`
  - Reads user staking position via `usersData(address user, bytes32 builderPoolId)` using Builders ABI
  - Determines contract address from `config/networks.ts` based on active chain (Arbitrum or Base)
  - Uses `builderPoolId` (typically the `mainnetProjectId`) as the staking pool identifier

- `hooks/useStakingContractInteractions.ts`
  - **Arbitrum/Base mainnet**: `deposit`, `withdraw`, `claim` operations using `Builders.json`
  - **Token operations**: ERC20 approvals and balance checks via `ERC20.json`
  - **Fallback reads**: Uses `BuilderSubnets.json` for `token()` function when needed

- `hooks/useSubnetContractInteractions.ts`
  - **Pool creation**: Creates new builder pools via `Builders.createBuilderPool(tuple)` with parameters:
    - `name` (string) - Pool name
    - `admin` (address) - Pool administrator address  
    - `poolStart` (uint128) - Start timestamp
    - `withdrawLockPeriodAfterDeposit` (uint128) - Lock period in seconds
    - `claimLockEnd` (uint128) - Claim lock end timestamp
    - `minimalDeposit` (uint256) - Minimum deposit amount in wei
  - **ERC20 operations**: Handles MOR token approvals for staking transactions

### GraphQL endpoints per network

- **Base mainnet**
  - Endpoint: `https://subgraph.satsuma-prod.com/8675f21b07ed/9iqb9f4qcmhosiruyg763--465704/morpheus-mainnet-base/api`
  - Chain ID: 8453

- **Arbitrum mainnet**
  - Endpoint: `https://api.studio.thegraph.com/query/73688/lumerin-node/version/latest`
  - Chain ID: 42161

**Configuration files:**
- `lib/apollo-client.ts` (Apollo client setup with network endpoints)
- `app/graphql/client.ts` (GraphQL fetch utility with endpoint selection logic)

### GraphQL entities and key queries used

**Primary entities:** `BuildersProject`, `BuildersUser`, `counters`

**Core queries** (from `lib/graphql/builders-queries.ts` and `app/graphql/queries/builders.ts`):

**Main data fetching queries:**
- `COMBINED_BUILDERS_LIST` - Fetches all builders projects, user stakes, and counters in one query
- `COMBINED_BUILDERS_LIST_FILTERED_BY_PREDEFINED_BUILDERS` - Filtered version for specific builder names
- `GET_BUILDERS_PROJECTS` - All builders projects with pagination/ordering
- `GET_BUILDERS_PROJECT_BY_ID` - Single project by ID
- `GET_BUILDERS_PROJECT_BY_NAME` - Single project by name

**User-specific queries:**
- `GET_BUILDERS_PROJECT_USERS($buildersProjectId)` - Users staking in a specific project (used by `[slug]` page)
- `GET_ACCOUNT_USER_BUILDERS_PROJECTS` - All projects where a user has staked
- `GET_USER_STAKED_BUILDERS` - User's staking positions across all projects (used in "Staking in" tab)
- `GET_USER_ACCOUNT_BUILDERS_PROJECT` - User's staking info for a specific project

**Administrative queries:**
- `GET_BUILDERS_COUNTERS` - Global statistics (total projects, subnets)

**Data structure:**
- `BuildersProject` fields: `id`, `name`, `totalStaked`, `totalUsers`, `minimalDeposit`, `withdrawLockPeriodAfterDeposit`, `admin`, `claimLockEnd`, `startsAt`, `totalClaimed`
- `BuildersUser` fields: `id`, `address`, `staked`, `claimed`, `lastStake`, `claimLockEnd` (linked to `buildersProject`)
- `counters` fields: `totalBuildersProjects`, `totalSubnets`

### Relevant contract addresses

From `config/networks.ts`:

**Arbitrum mainnet (chainId 42161):**
- Builders (staking contract): `0xC0eD68f163d44B6e9985F0041fDf6f67c6BCFF3f`
- MOR20 token: `0x092bAaDB7DEf4C3981454dD9c0A0D7FF07bCFc86`
- L2 Factory: `0x890bfa255e6ee8db5c67ab32dc600b14ebc4546c`
- Subnet Factory: `0x37b94bd80b6012fb214bb6790b31a5c40d6eb7a5`

**Base mainnet (chainId 8453):**
- Builders (staking contract): `0x42BB446eAE6dca7723a9eBdb81EA88aFe77eF4B9`
- MOR20 token: `0x7431ADA8A591C955A994A21710752ef9B882B8E3`

**Address resolution in code:**
- Pages and hooks select appropriate chain's contract addresses from `mainnetChains` in `config/networks.ts`
- Address selection is based on the active `chainId` from wagmi
- Both `builders` and `morToken` addresses are used across the builders route functionality

### Operational notes

**Network-specific behavior:**
- On Base, `useStakingContractInteractions` skips reading `token()` from the Builders contract (function not present) and uses the configured MOR address directly from `config/networks.ts`
- Both Arbitrum and Base use the same transaction flow: `deposit/withdraw/claim` operations on the `Builders` contract
- All operations use `builderPoolId` (bytes32 identifier, typically the `mainnetProjectId` from GraphQL data) as the staking pool identifier

**Key transaction patterns:**
- **Pool Creation**: `Builders.createBuilderPool(tuple)` - Creates new staking pools with specified parameters
- **Deposits**: `ERC20.approve()` → `Builders.deposit(builderPoolId, amount)`
- **Withdrawals**: `Builders.withdraw(builderPoolId, amount)`
- **Claims**: `Builders.claim(builderPoolId, receiverAddress)`

**Builder Pool Creation Structure:**
The `createBuilderPool` function accepts a tuple with the following structure (defined in `lib/contracts.ts`):
```typescript
interface BuilderPoolParams {
  name: string;           // Pool name
  admin: `0x${string}`;   // Administrator address
  poolStart: bigint;      // Start timestamp
  withdrawLockPeriodAfterDeposit: bigint; // Lock period in seconds
  claimLockEnd: bigint;   // Claim lock end timestamp
  minimalDeposit: bigint; // Minimum deposit in wei
}
```

### File references

**ABI imports and usage:**
```24-25:app/builders/[slug]/page.tsx
import BuildersAbi from '@/app/abi/Builders.json';
import BuilderSubnetsV2Abi from '@/app/abi/BuilderSubnetsV2.json';
...
// User staking data reads
const { data: stakerData } = useReadContract({
  address: contractAddress,
  abi: BuildersAbi, // Main staking contract ABI for Arbitrum/Base
  functionName: 'usersData',
  args: [userAddress, builderPoolId],
});
```

**Hook ABI imports:**
```11-14:hooks/useStakingContractInteractions.ts
import BuilderSubnetsV2Abi from '@/app/abi/BuilderSubnetsV2.json';
import BuilderSubnetsAbi from '@/app/abi/BuilderSubnets.json';
import ERC20Abi from '@/app/abi/ERC20.json';
import BuildersAbi from '@/app/abi/Builders.json';
```

**GraphQL endpoints configuration:**
```lib/apollo-client.ts
const NETWORK_ENDPOINTS = {
  Arbitrum: 'https://api.studio.thegraph.com/query/73688/lumerin-node/version/latest',
  Base: 'https://subgraph.satsuma-prod.com/8675f21b07ed/9iqb9f4qcmhosiruyg763--465704/morpheus-mainnet-base/api',
};
```

**Contract addresses configuration:**
```152-185:config/networks.ts
export const mainnetChains: Record<string, ChainConfig> = {
  arbitrum: {
    contracts: {
      morToken: toContract('0x092baadb7def4c3981454dd9c0a0d7ff07bcfc86'),
      l2Factory: toContract('0x890bfa255e6ee8db5c67ab32dc600b14ebc4546c'),
      subnetFactory: toContract('0x37b94bd80b6012fb214bb6790b31a5c40d6eb7a5'),
      builders: toContract('0xc0ed68f163d44b6e9985f0041fdf6f67c6bcff3f')
    },
  },
  base: {
    contracts: {
      morToken: toContract('0x7431ada8a591c955a994a21710752ef9b882b8e3'),
      builders: toContract('0x42bb446eae6dca7723a9ebdb81ea88afe77ef4b9')
    }
  }
};
```