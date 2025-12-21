# Builder Subnets V1 vs V4: Comprehensive Comparison

## Executive Summary

This document provides a detailed comparison between the V1 and V4 implementations of builder subnets across multiple dimensions including schema differences, metadata storage, data retrieval patterns, and migration considerations.

**Current State:**
- **V1**: Active on Arbitrum One (mainnet) and Base (mainnet) - uses off-chain Supabase metadata
- **V4**: Active on Base Sepolia (testnet) - uses on-chain contract metadata
- **Migration Goal**: Migrate Base mainnet subnets from V1 to V4 while maintaining V1 support for Arbitrum One

---

## Product Manager Summary: Why NOT Migrating Base V1 Subnets Creates Major Problems

If we choose to **keep existing Base V1 subnets as-is** and simply add V4 support for new Base subnets (the "worst case scenario"), we're essentially creating a system where Base mainnet has **two completely different ways of storing and retrieving subnet data** running simultaneously. This creates a nightmare scenario from both a user experience and development perspective. Every time a user views the Base network, our system would need to figure out whether each subnet is V1 or V4, then use completely different code paths to fetch and display the data. For V1 subnets, we'd need to make two separate database calls (one to the blockchain, one to our Supabase database) and then manually match them up by name - a process that's already error-prone and has caused bugs when subnet names don't match exactly between systems. For V4 subnets, we'd use a single, clean query. This means every feature we build - displaying subnet lists, showing subnet details, handling user stakes, filtering, sorting - would need duplicate logic to handle both versions. The frontend code would be riddled with "if V1, do this; if V4, do that" conditions, making it fragile and difficult to maintain. On the backend, we'd be maintaining two separate query systems, two different data structures, and complex merging logic that's already proven to break when names don't match perfectly. Every bug fix would need to be tested twice, every new feature would take twice as long to build, and every time something breaks (which will happen frequently with name matching), users would see missing data, incorrect information, or broken pages.

The business impact of this approach is severe: **development velocity slows dramatically** because every change requires double the work and testing. **Bug rates increase** because we're maintaining two parallel systems with complex interaction points - we've already seen issues where V1 subnets don't display correctly due to name mismatches, and this problem would multiply. **User experience degrades** because the system is slower (making two queries for V1 subnets vs one for V4), less reliable (more points of failure), and inconsistent (some subnets load faster, some have different data available). **Technical debt accumulates rapidly** as we build more features on top of this fragile foundation, making future improvements exponentially harder. Most critically, **this approach doesn't solve the problem - it just postpones it**. We'd still need to migrate Base V1 subnets eventually, but by then we'd have built even more features on top of the dual-system architecture, making the migration even more painful and risky. The one-time migration effort now is far less costly than maintaining this dual-system complexity indefinitely, especially when the migration itself is straightforward - we're simply moving metadata that already exists in our database onto the blockchain where it belongs.

---

## 1. Subnet Schema and Naming Differences

### 1.1 Contract Structure Comparison

#### V1 Contract (Arbitrum One / Base Mainnet)
**Contract**: `Builders` (IBuilders.BuilderPool)

```solidity
struct BuilderPool {
    string name;
    address admin;
    uint128 poolStart;                    // Start timestamp
    uint128 withdrawLockPeriodAfterDeposit;
    uint128 claimLockEnd;                 // Claim lock end timestamp
    uint256 minimalDeposit;
}
```

**Key Characteristics:**
- Uses `BuilderPool` terminology
- No on-chain metadata storage
- Requires separate `createBuilderPool()` function
- Uses `deposit()` for staking
- Field naming: `minimalDeposit`, `poolStart`, `claimLockEnd`

#### V4 Contract (Base Sepolia / Base Mainnet)
**Contract**: `BuildersV4` (IBuildersV4.Subnet + IBuildersV4.SubnetMetadata)

```solidity
struct Subnet {
    string name;
    address admin;
    uint128 unusedStorage1_V4Update;     // Reserved for future use
    uint128 withdrawLockPeriodAfterDeposit;
    uint128 unusedStorage2_V4Update;     // Reserved for future use
    uint256 minimalDeposit;
    address claimAdmin;                   // Separate claim admin address
}

struct SubnetMetadata {
    string slug;                          // URL-friendly identifier
    string description;                   // Project description
    string website;                       // Project website URL
    string image;                         // Project image/logo URL
}
```

**Key Characteristics:**
- Uses `Subnet` terminology (more consistent naming)
- **On-chain metadata storage** via `SubnetMetadata` struct
- Single `createSubnet(subnet_, metadata_)` function
- Uses `deposit()` for staking (same as V1)
- Field naming: `minimalDeposit`, `withdrawLockPeriodAfterDeposit`
- Includes `claimAdmin` for separate claim management
- Metadata stored directly in contract via `subnetsMetadata(bytes32 subnetId)` view function

### 1.2 Field Naming Comparison Table

| Field Purpose | V1 (Arbitrum/Base Mainnet) | V4 (Base Sepolia/Base Mainnet) | Notes |
|---------------|---------------------------|--------------------------------|-------|
| Subnet Name | `name` (in BuilderPool) | `name` (in Subnet) | Same |
| Admin Address | `admin` | `admin` | Same |
| Start Time | `poolStart` | N/A | V4 doesn't track start time |
| Min Deposit | `minimalDeposit` | `minimalDeposit` | Same |
| Withdraw Lock | `withdrawLockPeriodAfterDeposit` | `withdrawLockPeriodAfterDeposit` | Same |
| Claim Lock End | `claimLockEnd` | N/A (handled separately) | V4 uses separate claim admin |
| Metadata Slug | N/A (off-chain only) | `slug` (in SubnetMetadata) | V4 only |
| Description | N/A (off-chain only) | `description` (in SubnetMetadata) | V4 only |
| Website | N/A (off-chain only) | `website` (in SubnetMetadata) | V4 only |
| Image | N/A (off-chain only) | `image` (in SubnetMetadata) | V4 only |

### 1.3 Contract Function Differences

| Function | V1 | V4 | Notes |
|----------|----|----|----|
| Create | `createBuilderPool(builderPool_)` | `createSubnet(subnet_, metadata_)` | V4 includes metadata in creation |
| Stake | `deposit(builderPoolId_, amount_)` | `deposit(subnetId_, amount_)` | Same function signature |
| Read Subnet | `builderPools(bytes32)` | `subnets(bytes32)` | Different naming |
| Read Metadata | N/A (off-chain) | `subnetsMetadata(bytes32)` | V4 only |
| Read Data | `builderPoolsData(bytes32)` | `subnetsData(bytes32)` | Different naming |

---

## 2. Subgraph Query Schema Differences

### 2.1 V1 Subgraph Schema (Arbitrum One / Base Mainnet)

**Entity**: `BuildersProject`

```graphql
type BuildersProject {
    id: Bytes!                    # Subnet ID (bytes32)
    admin: Bytes!                 # Admin address
    name: String!                 # Subnet name
    minimalDeposit: BigInt!       # Minimum deposit amount
    withdrawLockPeriodAfterDeposit: BigInt!
    startsAt: BigInt!             # Start timestamp
    claimLockEnd: BigInt!         # Claim lock end timestamp
    totalStaked: BigInt!          # Total staked amount
    totalClaimed: BigInt!         # Total claimed amount
    totalUsers: BigInt!           # Total number of stakers
    # NO metadata fields (description, website, image, slug)
}
```

**Query Example:**
```graphql
query combinedBuildersListFilteredByPredefinedBuilders(
    $name_in: [String!] = ""
) {
    buildersProjects(
        where: {name_in: $name_in}
    ) {
        id
        name
        admin
        minimalDeposit
        withdrawLockPeriodAfterDeposit
        totalStaked
        totalUsers
        # Metadata must be fetched separately from Supabase
    }
}
```

### 2.2 V4 Subgraph Schema (Base Sepolia)

**Entity**: `BuildersProject` (note: same name but different structure)

```graphql
type BuildersProject {
    id: Bytes!                    # Subnet ID (bytes32)
    admin: Bytes!                 # Admin address
    name: String!                 # Subnet name
    slug: String!                 # URL-friendly identifier
    description: String!          # Project description
    website: String!              # Project website URL
    image: String!                # Project image/logo URL
    minimalDeposit: BigInt!       # Minimum deposit amount
    withdrawLockPeriodAfterDeposit: BigInt!
    totalStaked: BigInt!          # Total staked amount
    totalClaimed: BigInt!         # Total claimed amount
    totalUsers: BigInt!           # Total number of stakers
    chainId: BigInt!              # Chain ID
    # All metadata fields included on-chain
}
```

**Query Example:**
```graphql
query combinedBuildersProjectsBaseSepolia {
    buildersProjects {
        items {
            id
            name
            slug
            description
            website
            image
            minimalDeposit
            withdrawLockPeriodAfterDeposit
            totalStaked
            totalUsers
            chainId
            # All metadata available directly from subgraph
        }
    }
}
```

### 2.3 Key Schema Differences

| Field | V1 Subgraph | V4 Subgraph | Source |
|-------|-------------|-------------|--------|
| `slug` | ❌ Not available | ✅ Available | On-chain (V4) |
| `description` | ❌ Not available | ✅ Available | On-chain (V4) |
| `website` | ❌ Not available | ✅ Available | On-chain (V4) |
| `image` | ❌ Not available | ✅ Available | On-chain (V4) |
| `startsAt` | ✅ Available | ❌ Not available | V1 only |
| `claimLockEnd` | ✅ Available | ❌ Not available | V1 only |
| `chainId` | ❌ Not available | ✅ Available | V4 only |

**Note**: V1 subgraphs return flat arrays (`buildersProjects: BuildersProject[]`), while V4 subgraph returns nested structure (`buildersProjects: { items: BuildersProject[] }`).

---

## 3. Metadata Storage: V1 vs V4

### 3.1 V1 Metadata Storage (Off-Chain in Supabase)

**Storage Location**: Supabase `builders` table

**Schema** (`BuilderDB` interface):
```typescript
interface BuilderDB {
    id: string;                    // UUID primary key (NOT subnet ID)
    name: string;                  // Subnet name (used for matching)
    description: string | null;
    long_description: string | null;
    image_src: string | null;
    tags: string[] | null;
    github_url: string | null;
    twitter_url: string | null;
    discord_url: string | null;
    contributors: number;
    github_stars: number;
    reward_types: string[];        // Reward type array
    reward_types_detail: string[];
    website: string | null;
    networks: string[];            // ["Arbitrum"] or ["Base"] or both
    created_at: string;
    updated_at: string;
}
```

**Complete List of V1 Metadata Fields:**
1. `name` - Subnet name (primary identifier for matching)
2. `description` - Short description
3. `long_description` - Extended description
4. `image_src` - Image/logo URL
5. `tags` - Array of tags
6. `github_url` - GitHub repository URL
7. `twitter_url` - Twitter/X profile URL
8. `discord_url` - Discord server URL
9. `contributors` - Number of contributors
10. `github_stars` - GitHub stars count
11. `reward_types` - Array of reward types (e.g., ["Token", "NFT", "TBA"])
12. `reward_types_detail` - Detailed reward type information
13. `website` - Project website URL
14. `networks` - Array of networks where subnet exists (e.g., ["Arbitrum", "Base"])

**Key Characteristics:**
- Metadata is **completely off-chain**
- Requires **separate Supabase query** to fetch metadata
- Matching done by **subnet name** (not ID)
- Supports **rich metadata** (social links, GitHub stats, etc.)
- Can have **multiple networks** per builder entry
- Supabase `id` is UUID, **different from on-chain subnet ID**

### 3.2 V4 Metadata Storage (On-Chain in Contract)

**Storage Location**: Smart contract `SubnetMetadata` struct

**Schema** (from contract ABI):
```solidity
struct SubnetMetadata {
    string slug;                   // URL-friendly identifier
    string description;             // Project description
    string website;                // Project website URL
    string image;                  // Project image/logo URL
}
```

**V4 Contract Metadata Fields:**
1. `slug` - URL-friendly identifier (e.g., "neptune-ai")
2. `description` - Project description (max ~800 chars based on form validation)
3. `website` - Project website URL
4. `image` - Project image/logo URL

**Key Characteristics:**
- Metadata is **stored on-chain** in the contract
- **Automatically indexed** by subgraph
- Available via **single subgraph query**
- **Limited fields** compared to V1 (no social links, GitHub stats, reward types)
- **No support for** discord_url, github_url, twitter_url, reward_types, etc.
- Metadata is **immutable** once set (unless contract allows updates)

### 3.3 Metadata Field Comparison

| Field | V1 (Supabase) | V4 (On-Chain) | Notes |
|-------|---------------|---------------|-------|
| `slug` | ❌ Not stored | ✅ Stored | V4 only |
| `description` | ✅ Stored | ✅ Stored | Both (but V4 is on-chain) |
| `website` | ✅ Stored | ✅ Stored | Both (but V4 is on-chain) |
| `image` | ✅ Stored (`image_src`) | ✅ Stored (`image`) | Both (different field names) |
| `long_description` | ✅ Stored | ❌ Not available | V1 only |
| `github_url` | ✅ Stored | ❌ Not available | V1 only |
| `twitter_url` | ✅ Stored | ❌ Not available | V1 only |
| `discord_url` | ✅ Stored | ❌ Not available | V1 only |
| `reward_types` | ✅ Stored | ❌ Not available | V1 only |
| `reward_types_detail` | ✅ Stored | ❌ Not available | V1 only |
| `contributors` | ✅ Stored | ❌ Not available | V1 only |
| `github_stars` | ✅ Stored | ❌ Not available | V1 only |
| `tags` | ✅ Stored | ❌ Not available | V1 only |

**Important Note**: V4 contract **does NOT support** storing additional metadata fields like Discord, GitHub, Twitter links, or reward types. These would need to be:
1. Stored separately in Supabase (hybrid approach)
2. Included in the `description` field as text
3. Stored in a separate metadata contract/registry

---

## 4. Data Retrieval Patterns

### 4.1 V1 Data Retrieval Flow (Arbitrum One / Base Mainnet)

**Current Implementation Flow:**

1. **Fetch Builder Names from Supabase + Morlord**
   ```typescript
   // Step 1: Fetch all builders from Supabase
   const supabaseBuilders = await supabase
       .from('builders')
       .select('*')
       .in('networks', ['Arbitrum', 'Base']);
   
   // Step 2: Fetch builder names from Morlord API
   const morlordResponse = await fetch('https://morlord.com/data/builders.json');
   const morlordBuilders = await morlordResponse.json();
   const morlordNames = Object.values(morlordBuilders).map(b => b.name);
   
   // Step 3: Combine names (Supabase + Morlord)
   const allBuilderNames = [
       ...supabaseBuilders.map(b => b.name),
       ...morlordNames
   ];
   ```

2. **Query Subgraph with Builder Names**
   ```typescript
   // Step 4: Query GraphQL for on-chain data
   const graphqlResponse = await client.query({
       query: COMBINED_BUILDERS_LIST_FILTERED_BY_PREDEFINED_BUILDERS,
       variables: {
           name_in: allBuilderNames,  // Filter by names
           address: userAddress
       }
   });
   
   // Returns: buildersProjects[] with on-chain data only
   // NO metadata fields (description, website, image, etc.)
   ```

3. **Merge On-Chain Data with Supabase Metadata**
   ```typescript
   // Step 5: Match and merge
   graphqlResponse.data.buildersProjects.forEach(onChainProject => {
       const matchingSupabaseBuilder = supabaseBuilders.find(
           b => b.name === onChainProject.name  // Match by NAME
       );
       
       if (matchingSupabaseBuilder) {
           // Merge on-chain data with Supabase metadata
           const builder = {
               ...matchingSupabaseBuilder,  // Supabase metadata
               id: onChainProject.id,       // On-chain subnet ID
               totalStaked: onChainProject.totalStaked,
               admin: onChainProject.admin,
               // ... other on-chain fields
           };
       }
   });
   ```

**Key Characteristics:**
- **Two-step process**: GraphQL query + Supabase query
- **Matching by name**: Subnet name used to match GraphQL data with Supabase metadata
- **ID mismatch**: Supabase `id` (UUID) ≠ On-chain subnet `id` (bytes32)
- **Network filtering**: Supabase `networks` array determines which subnets appear on which networks
- **Morlord integration**: Additional builder names fetched from Morlord endpoint
- **Fallback handling**: Subnets in Supabase without on-chain data still appear (with default values)

**Challenges:**
- Name mismatches between Morlord API and GraphQL (e.g., "Protection and Capital Incentive" vs "Protection and Capital Incentives Program")
- Requires manual name mapping/normalization
- Supabase must be queried separately for each subnet
- No single source of truth

### 4.2 V4 Data Retrieval Flow (Base Sepolia)

**Current Implementation Flow:**

1. **Single Subgraph Query**
   ```typescript
   // Step 1: Query GraphQL - everything in one query
   const response = await client.query({
       query: COMBINED_BUILDERS_PROJECTS_BASE_SEPOLIA,
       variables: {}
   });
   
   // Returns: buildersProjects.items[] with ALL data including metadata
   const projects = response.data?.buildersProjects?.items || [];
   ```

2. **Direct Usage (No Merging Required)**
   ```typescript
   // Step 2: Use data directly - no Supabase query needed
   const builders = projects.map(project => ({
       id: project.id,                    // On-chain subnet ID
       name: project.name,
       description: project.description,   // From contract metadata
       website: project.website,          // From contract metadata
       image: project.image,              // From contract metadata
       slug: project.slug,                // From contract metadata
       totalStaked: project.totalStaked,
       admin: project.admin,
       minimalDeposit: project.minimalDeposit,
       // ... all fields from single query
   }));
   ```

**Key Characteristics:**
- **Single query**: All data (including metadata) from subgraph
- **No Supabase dependency**: Metadata stored on-chain
- **Direct mapping**: Subgraph data maps directly to UI format
- **Consistent IDs**: Subnet ID from contract matches subgraph ID
- **No name matching**: No need to match by name across data sources

**Advantages:**
- Simpler data flow
- Single source of truth (on-chain)
- Faster data retrieval (one query vs two)
- No name matching issues
- Automatic consistency (metadata always matches on-chain state)

---

## 5. Subnet ID and Identification

### 5.1 V1 Identification

**Subnet ID Generation:**
- V1 uses `bytes32` subnet ID calculated from subnet name
- ID is derived from contract: `keccak256(abi.encodePacked(name))`
- Subnet name is the primary identifier

**Matching Process:**
- Supabase records use `name` field to match with on-chain subnets
- Supabase `id` (UUID) is **different** from on-chain subnet ID
- Matching done by string comparison: `supabaseBuilder.name === graphqlProject.name`

**Challenges:**
- Name variations cause mismatches
- Case sensitivity issues
- No direct ID mapping between Supabase and on-chain

### 5.2 V4 Identification

**Subnet ID Generation:**
- V4 uses `bytes32` subnet ID calculated from subnet name (same as V1)
- ID is derived from contract: `keccak256(abi.encodePacked(name))`
- Subnet name is the primary identifier

**Matching Process:**
- All data comes from subgraph (single source)
- No matching required - subgraph ID = contract ID
- Slug provides additional URL-friendly identifier

**Advantages:**
- Consistent IDs across all systems
- No matching logic needed
- Slug provides human-readable identifier

---

## 6. Migration Benefits: Base Mainnet V1 → V4

### 6.1 Why Migrate Base Mainnet Subnets to V4?

**Current Situation:**
- Base mainnet currently uses V1 contracts with off-chain Supabase metadata
- Base Sepolia uses V4 contracts with on-chain metadata
- Supporting both V1 and V4 on Base mainnet creates complexity

**Benefits of Migration:**

1. **Unified Architecture**
   - Single contract version for Base (mainnet + testnet)
   - Consistent data retrieval patterns
   - Simplified frontend code

2. **On-Chain Metadata**
   - Metadata stored directly in contract
   - No dependency on Supabase for Base subnets
   - Automatic subgraph indexing
   - Immutable metadata (unless contract allows updates)

3. **Simplified Data Flow**
   - Single GraphQL query instead of GraphQL + Supabase
   - No name matching logic required
   - Faster data retrieval
   - Reduced error surface

4. **Better Consistency**
   - Metadata always matches on-chain state
   - No sync issues between Supabase and contract
   - Single source of truth

5. **Future-Proofing**
   - V4 is the new standard
   - V1 is legacy/deprecated
   - Easier to maintain one version

### 6.2 Migration Process

**Required Steps:**

1. **Extract Metadata from Supabase**
   ```typescript
   // For each Base mainnet subnet in Supabase:
   const baseSubnets = await supabase
       .from('builders')
       .select('*')
       .contains('networks', ['Base']);
   
   baseSubnets.forEach(subnet => {
       const metadata = {
           slug: generateSlug(subnet.name),
           description: subnet.description || '',
           website: subnet.website || '',
           image: subnet.image_src || ''
       };
       // Store in contract via migration script
   });
   ```

2. **Register Metadata On-Chain**
   - Call `createSubnet()` with extracted metadata
   - Or use migration function to update existing subnets
   - Ensure metadata matches Supabase data

3. **Update Frontend**
   - Remove Base mainnet from V1 query logic
   - Add Base mainnet to V4 query logic
   - Update network detection

4. **Verify Data**
   - Compare on-chain metadata with Supabase
   - Ensure all subnets migrated correctly
   - Test frontend displays correctly

---

## 7. Architecture Scenarios and Complexity Analysis

### 7.1 Scenario 1: Keep V1 on Arbitrum/Base, Add V4 on Base

**Architecture:**
- Arbitrum One: V1 contracts + Supabase metadata
- Base Mainnet: V1 contracts + Supabase metadata
- Base Sepolia: V4 contracts + on-chain metadata
- Base Mainnet (new): V4 contracts + on-chain metadata

**Complexity Analysis:**

#### Frontend Complexity: **HIGH** ⚠️

**Required Changes:**

1. **Network Detection Logic**
   ```typescript
   const isV1Network = chainId === arbitrum.id || chainId === base.id;
   const isV4Network = chainId === baseSepolia.id || 
                      (chainId === base.id && isNewSubnet);
   // How to determine if Base subnet is V1 or V4?
   ```

2. **Dual Query System**
   ```typescript
   if (isV1Network) {
       // Query GraphQL for on-chain data
       const graphqlData = await queryV1Subgraph();
       // Query Supabase for metadata
       const supabaseData = await querySupabase();
       // Merge data
       const merged = mergeV1Data(graphqlData, supabaseData);
   } else if (isV4Network) {
       // Query GraphQL (includes metadata)
       const graphqlData = await queryV4Subgraph();
       // Use directly
       const builders = mapV4Data(graphqlData);
   }
   ```

3. **Property Name Mapping**
   ```typescript
   // V1 uses different property names
   const v1Builder = {
       image_src: supabaseData.image_src,  // V1
       // ...
   };
   
   // V4 uses different property names
   const v4Builder = {
       image: graphqlData.image,  // V4
       // ...
   };
   
   // UI must handle both
   const displayImage = builder.image_src || builder.image;
   ```

4. **Subnet ID Resolution**
   ```typescript
   // V1: Match by name
   const v1SubnetId = findSubnetByName(name);
   
   // V4: Use subgraph ID directly
   const v4SubnetId = project.id;
   ```

**Error-Prone Areas:**

1. **Name Matching Issues**
   - V1 requires name matching between GraphQL and Supabase
   - Case sensitivity problems
   - Name variations (e.g., "Protection and Capital Incentive" vs "Protection and Capital Incentives Program")

2. **Network Detection**
   - How to determine if a Base subnet is V1 or V4?
   - Requires additional logic or flag
   - Risk of querying wrong endpoint

3. **Data Merging Logic**
   - Complex merge logic for V1
   - Different data structures
   - Fallback handling for missing data

4. **Property Access**
   - Different property names (`image_src` vs `image`)
   - Null/undefined handling
   - Type safety issues

**Backend/Query Complexity: **HIGH** ⚠️

**Required Queries:**

1. **V1 Queries (Arbitrum + Base)**
   ```graphql
   # Query 1: GraphQL for on-chain data
   query getV1Builders($name_in: [String!]) {
       buildersProjects(where: {name_in: $name_in}) {
           id
           name
           totalStaked
           # NO metadata
       }
   }
   
   # Query 2: Supabase for metadata
   SELECT * FROM builders 
   WHERE networks @> ARRAY['Arbitrum'] 
      OR networks @> ARRAY['Base'];
   ```

2. **V4 Queries (Base Sepolia + Base Mainnet)**
   ```graphql
   # Query 1: GraphQL (includes metadata)
   query getV4Builders {
       buildersProjects {
           items {
               id
               name
               description
               website
               image
               slug
               totalStaked
           }
       }
   }
   ```

**Challenges:**
- Multiple query endpoints
- Different response structures
- Name-based filtering for V1
- Network-based routing
- Error handling for each query type

**Estimated Complexity Score: 8/10** 🔴

**Risks:**
- High maintenance burden
- Increased bug surface area
- Difficult to test all combinations
- Performance impact (multiple queries)

---

### 7.2 Scenario 2: Migrate Base to V4, Keep Arbitrum on V1

**Architecture:**
- Arbitrum One: V1 contracts + Supabase metadata
- Base Mainnet: V4 contracts + on-chain metadata (migrated)
- Base Sepolia: V4 contracts + on-chain metadata

**Complexity Analysis:**

#### Frontend Complexity: **MEDIUM** 🟡

**Required Changes:**

1. **Network-Based Routing**
   ```typescript
   const isV1Network = chainId === arbitrum.id;
   const isV4Network = chainId === base.id || chainId === baseSepolia.id;
   ```

2. **Separate Query Paths**
   ```typescript
   if (isV1Network) {
       // V1: GraphQL + Supabase
       const graphqlData = await queryV1Subgraph('Arbitrum');
       const supabaseData = await querySupabase(['Arbitrum']);
       return mergeV1Data(graphqlData, supabaseData);
   } else {
       // V4: GraphQL only
       const graphqlData = await queryV4Subgraph(chainId);
       return mapV4Data(graphqlData);
   }
   ```

3. **Property Name Normalization**
   ```typescript
   // Normalize to common interface
   interface NormalizedBuilder {
       id: string;
       name: string;
       description: string;
       website: string;
       image: string;  // Normalized from image_src (V1) or image (V4)
       // ...
   }
   
   const normalizeBuilder = (builder: V1Builder | V4Builder): NormalizedBuilder => {
       return {
           ...builder,
           image: builder.image_src || builder.image,  // Handle both
           // ...
       };
   };
   ```

**Error-Prone Areas:**

1. **Property Mapping**
   - Still need to handle `image_src` vs `image`
   - Different metadata field availability
   - Null handling

2. **Query Endpoint Selection**
   - Must correctly route to V1 vs V4 endpoints
   - Network-based detection is simpler than subnet-based

**Backend/Query Complexity: **MEDIUM** 🟡

**Required Queries:**

1. **V1 Queries (Arbitrum Only)**
   ```graphql
   # GraphQL for Arbitrum
   query getArbitrumBuilders($name_in: [String!]) {
       buildersProjects(where: {name_in: $name_in}) {
           # On-chain data only
       }
   }
   
   # Supabase for Arbitrum metadata
   SELECT * FROM builders WHERE networks @> ARRAY['Arbitrum'];
   ```

2. **V4 Queries (Base Mainnet + Base Sepolia)**
   ```graphql
   # GraphQL for Base (includes metadata)
   query getBaseBuilders {
       buildersProjects {
           items {
               # All data including metadata
           }
       }
   }
   ```

**Advantages:**
- Clear network-based separation
- No ambiguity about which version to use
- Simpler than Scenario 1
- Arbitrum V1 can remain unchanged

**Estimated Complexity Score: 5/10** 🟡

**Risks:**
- Still need to maintain V1 code path
- Property name differences
- Two query systems

---

## 8. Additional Challenges and Considerations

### 8.1 Metadata Field Limitations

**V4 Contract Limitations:**
- V4 contract only supports 4 metadata fields: `slug`, `description`, `website`, `image`
- **Missing fields** that exist in V1 Supabase:
  - `discord_url`
  - `github_url`
  - `twitter_url`
  - `reward_types`
  - `reward_types_detail`
  - `contributors`
  - `github_stars`
  - `tags`
  - `long_description`

**Solutions:**

1. **Hybrid Approach**
   - Store core metadata on-chain (V4 contract)
   - Store extended metadata in Supabase
   - Query both sources and merge

2. **Description Field Encoding**
   - Encode additional metadata in `description` field
   - Use JSON or structured format
   - Parse on frontend

3. **Separate Metadata Registry**
   - Create separate contract for extended metadata
   - Link to subnet via subnet ID
   - More complex but flexible

### 8.2 Name Matching and Normalization

**V1 Challenges:**
- Name mismatches between Morlord API and GraphQL
- Case sensitivity issues
- Special character handling
- Example: "Protection and Capital Incentive" vs "Protection and Capital Incentives Program"

**Current Solution:**
```typescript
const nameMapping: Record<string, string[]> = {
    "Protection and Capital Incentive": [
        "Protection and Capital Incentive",
        "Protection and Capital Incentives Program"
    ]
};
```

**V4 Advantage:**
- No name matching required
- Direct ID-based lookup
- Slug provides URL-friendly identifier

### 8.3 Backward Compatibility

**Considerations:**
- Existing V1 subnets on Base mainnet have users and stakes
- Migration must preserve all on-chain state
- Users should not be affected
- Stakes must remain valid

**Migration Strategy:**
- Option 1: Create new V4 subnets, migrate stakes (complex)
- Option 2: Update existing contracts to V4 (if possible)
- Option 3: Keep V1 subnets, only new subnets use V4 (transitional)

### 8.4 Testing Complexity

**Test Scenarios:**

1. **V1 Networks (Arbitrum)**
   - GraphQL query
   - Supabase query
   - Data merging
   - Name matching
   - Property mapping

2. **V4 Networks (Base)**
   - GraphQL query
   - Direct data usage
   - Property mapping

3. **Cross-Network**
   - Network detection
   - Query routing
   - Data consistency

**Testing Burden:**
- Multiple query paths
- Different data structures
- Edge cases (missing data, name mismatches)
- Network switching scenarios

### 8.5 Performance Considerations

**V1 Performance:**
- Two queries per load (GraphQL + Supabase)
- Name matching overhead
- Data merging overhead
- Network latency (two endpoints)

**V4 Performance:**
- Single query per load
- No matching/merging overhead
- Faster response time
- Single endpoint

**Impact:**
- V4 is significantly faster
- V1 has higher latency
- Multiple queries increase failure risk

### 8.6 Data Consistency

**V1 Consistency Issues:**
- Supabase metadata can drift from on-chain state
- Name mismatches cause missing data
- Manual sync required
- No automatic validation

**V4 Consistency:**
- Metadata always matches on-chain state
- Single source of truth
- Automatic subgraph indexing
- No sync issues

---

## 9. Recommendations

### 9.1 Recommended Approach: Migrate Base to V4, Keep Arbitrum on V1

**Rationale:**
1. **Clear Separation**: Network-based versioning is simpler than subnet-based
2. **Reduced Complexity**: Medium complexity vs High complexity
3. **Future-Proof**: Base uses modern V4 architecture
4. **Maintainability**: Easier to maintain than dual-version on same network
5. **Performance**: V4 is faster and more efficient

**Migration Steps:**

1. **Phase 1: Extract and Register Metadata**
   - Extract metadata from Supabase for Base mainnet subnets
   - Register metadata on-chain via V4 contract
   - Verify metadata matches

2. **Phase 2: Update Frontend**
   - Add Base mainnet to V4 query logic
   - Remove Base mainnet from V1 query logic
   - Update network detection
   - Test thoroughly

3. **Phase 3: Verify and Monitor**
   - Compare on-chain vs Supabase metadata
   - Monitor for issues
   - Gather user feedback

4. **Phase 4: Deprecate V1 on Base**
   - Mark V1 Base subnets as deprecated
   - Encourage migration to V4
   - Eventually remove V1 support for Base

### 9.2 Alternative: Hybrid Metadata Approach

**If Extended Metadata is Required:**

1. **Store Core Metadata On-Chain (V4)**
   - `slug`, `description`, `website`, `image`

2. **Store Extended Metadata in Supabase**
   - `discord_url`, `github_url`, `twitter_url`
   - `reward_types`, `contributors`, `github_stars`
   - Link by subnet name or slug

3. **Query Both Sources**
   - Primary: V4 subgraph (core metadata)
   - Secondary: Supabase (extended metadata)
   - Merge in frontend

**Trade-offs:**
- More flexible metadata
- Still requires Supabase query
- More complex than pure V4
- Better than pure V1 (core metadata on-chain)

---

## 10. Summary Tables

### 10.1 Contract Structure Comparison

| Aspect | V1 (Arbitrum/Base Mainnet) | V4 (Base Sepolia/Base Mainnet) |
|--------|---------------------------|--------------------------------|
| **Contract Name** | `Builders` | `BuildersV4` |
| **Struct Name** | `BuilderPool` | `Subnet` + `SubnetMetadata` |
| **Create Function** | `createBuilderPool(pool_)` | `createSubnet(subnet_, metadata_)` |
| **Metadata Storage** | Off-chain (Supabase) | On-chain (contract) |
| **Metadata Fields** | 14 fields in Supabase | 4 fields in contract |
| **Stake Function** | `deposit(poolId_, amount_)` | `deposit(subnetId_, amount_)` |
| **Read Metadata** | Supabase query | `subnetsMetadata(bytes32)` |

### 10.2 Subgraph Schema Comparison

| Field | V1 Subgraph | V4 Subgraph |
|-------|-------------|-------------|
| `id` | ✅ | ✅ |
| `name` | ✅ | ✅ |
| `admin` | ✅ | ✅ |
| `minimalDeposit` | ✅ | ✅ |
| `withdrawLockPeriodAfterDeposit` | ✅ | ✅ |
| `totalStaked` | ✅ | ✅ |
| `totalUsers` | ✅ | ✅ |
| `startsAt` | ✅ | ❌ |
| `claimLockEnd` | ✅ | ❌ |
| `slug` | ❌ | ✅ |
| `description` | ❌ | ✅ |
| `website` | ❌ | ✅ |
| `image` | ❌ | ✅ |
| `chainId` | ❌ | ✅ |

### 10.3 Metadata Fields Comparison

| Field | V1 (Supabase) | V4 (On-Chain) |
|-------|---------------|---------------|
| Core Fields | | |
| `slug` | ❌ | ✅ |
| `description` | ✅ | ✅ |
| `website` | ✅ | ✅ |
| `image` | ✅ (`image_src`) | ✅ (`image`) |
| Extended Fields | | |
| `long_description` | ✅ | ❌ |
| `github_url` | ✅ | ❌ |
| `twitter_url` | ✅ | ❌ |
| `discord_url` | ✅ | ❌ |
| `reward_types` | ✅ | ❌ |
| `reward_types_detail` | ✅ | ❌ |
| `contributors` | ✅ | ❌ |
| `github_stars` | ✅ | ❌ |
| `tags` | ✅ | ❌ |

### 10.4 Data Retrieval Comparison

| Aspect | V1 | V4 |
|--------|----|----|
| **Queries Required** | 2 (GraphQL + Supabase) | 1 (GraphQL only) |
| **Matching Logic** | Name-based matching | Direct ID mapping |
| **Metadata Source** | Supabase | Subgraph (from contract) |
| **Data Merging** | Required | Not required |
| **Performance** | Slower (2 queries) | Faster (1 query) |
| **Consistency** | Can drift | Always consistent |
| **Error Surface** | Higher (matching issues) | Lower (direct mapping) |

### 10.5 Complexity Scores

| Scenario | Frontend Complexity | Backend Complexity | Overall Risk |
|----------|-------------------|-------------------|--------------|
| **Keep V1 on Arbitrum/Base, Add V4 on Base** | 8/10 🔴 | 8/10 🔴 | HIGH |
| **Migrate Base to V4, Keep Arbitrum on V1** | 5/10 🟡 | 5/10 🟡 | MEDIUM |
| **Full Migration (All to V4)** | 2/10 🟢 | 2/10 🟢 | LOW |

---

## 11. Conclusion

The migration from V1 to V4 represents a significant architectural improvement:

1. **On-Chain Metadata**: V4 stores metadata directly in the contract, eliminating the need for Supabase queries and name matching
2. **Simplified Data Flow**: Single GraphQL query vs dual queries (GraphQL + Supabase)
3. **Better Performance**: Faster data retrieval and reduced latency
4. **Improved Consistency**: Single source of truth eliminates sync issues

**Recommended Path Forward:**
- Migrate Base mainnet subnets from V1 to V4
- Keep Arbitrum One on V1 (legacy support)
- This provides a clear network-based separation with manageable complexity
- Future: Consider migrating Arbitrum to V4 when feasible

**Key Challenges to Address:**
- Limited metadata fields in V4 contract (only 4 fields vs 14 in Supabase)
- Migration process for existing Base subnets
- Backward compatibility for existing stakes
- Testing across multiple network/version combinations

This migration will significantly improve the codebase maintainability and user experience while reducing the error surface area.

