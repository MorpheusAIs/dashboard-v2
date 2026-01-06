# Builders API Documentation

Public API endpoints for accessing Morpheus builder/subnet staking data on BASE network.

## Base URL

```
https://dashboard.mor.org/api/builders
```

## Endpoints

### 1. Get All Subnets

Returns a list of all subnets on BASE network with their staking metrics.

```
GET /subnets
```

#### Request

No parameters required.

#### Response

```json
{
  "success": true,
  "network": "base",
  "timestamp": "2025-12-29T21:35:50.775Z",
  "data": {
    "subnets": [
      {
        "id": "0x96e624768600a7be0f2a82545d33c137ff3df2f377dc3fdf468308e5b977a72f",
        "name": "MySuperAgent",
        "admin": "0x67760bad63cc00294764ef7d1f6570e864c196c1",
        "totalStaked": "144531970800000000000000",
        "totalStakedFormatted": 144531.97,
        "totalUsers": 31,
        "minimalDeposit": "1000000000000000",
        "minimalDepositFormatted": 0.001,
        "startsAt": "1738684800"
      }
    ],
    "totals": {
      "totalSubnets": 97,
      "totalStaked": "492000000000000000000000",
      "totalStakedFormatted": 492000.00,
      "totalStakers": 850
    }
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Whether the request succeeded |
| `network` | string | Network identifier (always "base") |
| `timestamp` | string | ISO 8601 timestamp of the response |
| `data.subnets` | array | List of subnet objects |
| `data.totals` | object | Aggregate metrics across all subnets |

#### Subnet Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique subnet identifier (bytes32 hash) |
| `name` | string | Human-readable subnet name |
| `admin` | string | Admin wallet address |
| `totalStaked` | string | Total MOR staked in wei (raw value) |
| `totalStakedFormatted` | number | Total MOR staked (human-readable) |
| `totalUsers` | number | Number of unique stakers |
| `minimalDeposit` | string | Minimum deposit in wei (raw value) |
| `minimalDepositFormatted` | number | Minimum deposit in MOR (human-readable) |
| `startsAt` | string | Unix timestamp when subnet started |

#### Example

```bash
curl https://dashboard.mor.org/api/builders/subnets
```

```javascript
// JavaScript/TypeScript
const response = await fetch('https://dashboard.mor.org/api/builders/subnets');
const data = await response.json();

console.log(`Total subnets: ${data.data.totals.totalSubnets}`);
console.log(`Total MOR staked: ${data.data.totals.totalStakedFormatted}`);
```

```python
# Python
import requests

response = requests.get('https://dashboard.mor.org/api/builders/subnets')
data = response.json()

print(f"Total subnets: {data['data']['totals']['totalSubnets']}")
print(f"Total MOR staked: {data['data']['totals']['totalStakedFormatted']}")
```

---

### 2. Get Subnet Stakers

Returns a paginated list of all active stakers for a specific subnet.

```
GET /stakers?subnet_id={subnet_id}&limit={limit}&offset={offset}
```

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `subnet_id` | string | Yes | - | The subnet ID (from `/subnets` endpoint) |
| `limit` | number | No | 100 | Number of results per page (max: 1000) |
| `offset` | number | No | 0 | Number of results to skip |

#### Response

```json
{
  "success": true,
  "network": "base",
  "timestamp": "2025-12-29T21:37:01.416Z",
  "subnetId": "0xf8c784db930f5b824609b2a64bc7135b089666624ba6e3a8cca427eafcf572cd",
  "pagination": {
    "limit": 100,
    "offset": 0,
    "total": 92,
    "hasMore": false
  },
  "data": {
    "stakers": [
      {
        "address": "0x7ab874eeef0169ada0d225e9801a3ffffa26aac3",
        "staked": "1024000000000000000000",
        "stakedFormatted": 1024,
        "lastStake": "1738641221",
        "lastStakeDate": "2025-02-04T03:53:41.000Z"
      }
    ],
    "totals": {
      "totalStakers": 92,
      "totalStaked": "3663184725000000000000",
      "totalStakedFormatted": 3663.18
    }
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Whether the request succeeded |
| `network` | string | Network identifier (always "base") |
| `timestamp` | string | ISO 8601 timestamp of the response |
| `subnetId` | string | The queried subnet ID |
| `pagination` | object | Pagination metadata |
| `data.stakers` | array | List of staker objects |
| `data.totals` | object | Aggregate metrics for this subnet |

#### Pagination Object

| Field | Type | Description |
|-------|------|-------------|
| `limit` | number | Results per page |
| `offset` | number | Current offset |
| `total` | number | Total number of stakers |
| `hasMore` | boolean | Whether more results are available |

#### Staker Object

| Field | Type | Description |
|-------|------|-------------|
| `address` | string | Staker's wallet address |
| `staked` | string | Amount staked in wei (raw value) |
| `stakedFormatted` | number | Amount staked in MOR (human-readable) |
| `lastStake` | string | Unix timestamp of last stake action |
| `lastStakeDate` | string | ISO 8601 date of last stake action |

#### Examples

**Basic request:**
```bash
curl "https://dashboard.mor.org/api/builders/stakers?subnet_id=0xf8c784db930f5b824609b2a64bc7135b089666624ba6e3a8cca427eafcf572cd"
```

**With pagination:**
```bash
curl "https://dashboard.mor.org/api/builders/stakers?subnet_id=0xf8c784db930f5b824609b2a64bc7135b089666624ba6e3a8cca427eafcf572cd&limit=50&offset=50"
```

```javascript
// JavaScript/TypeScript - Fetch all stakers with pagination
async function getAllStakers(subnetId) {
  const stakers = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await fetch(
      `https://dashboard.mor.org/api/builders/stakers?subnet_id=${subnetId}&limit=${limit}&offset=${offset}`
    );
    const data = await response.json();

    stakers.push(...data.data.stakers);

    if (!data.pagination.hasMore) break;
    offset += limit;
  }

  return stakers;
}
```

```python
# Python - Fetch all stakers with pagination
import requests

def get_all_stakers(subnet_id):
    stakers = []
    offset = 0
    limit = 100

    while True:
        response = requests.get(
            'https://dashboard.mor.org/api/builders/stakers',
            params={'subnet_id': subnet_id, 'limit': limit, 'offset': offset}
        )
        data = response.json()

        stakers.extend(data['data']['stakers'])

        if not data['pagination']['hasMore']:
            break
        offset += limit

    return stakers
```

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "network": "base",
  "timestamp": "2025-12-29T21:36:03.458Z",
  "error": "Error message describing what went wrong",
  "data": null
}
```

### Common Errors

| Status Code | Error | Description |
|-------------|-------|-------------|
| 400 | Missing required parameter: subnet_id | The `subnet_id` query parameter is required for `/stakers` |
| 500 | GraphQL request failed | Backend service error - retry after a moment |

---

## Working with Wei Values

All staking amounts are provided in two formats:
- **Raw wei** (`totalStaked`, `staked`): Full precision as string (18 decimals)
- **Formatted** (`totalStakedFormatted`, `stakedFormatted`): Human-readable number in MOR

### Converting Wei to MOR

```javascript
// JavaScript
const weiToMor = (wei) => Number(BigInt(wei)) / 1e18;

// Example
const morAmount = weiToMor("1024000000000000000000"); // 1024
```

```python
# Python
def wei_to_mor(wei):
    return int(wei) / 10**18

# Example
mor_amount = wei_to_mor("1024000000000000000000")  # 1024.0
```

---

## Rate Limiting & Caching

- **Cache Duration**: Responses are cached for 60 seconds
- **Stale-While-Revalidate**: Stale data served for up to 300 seconds while refreshing
- **No Authentication Required**: These are public endpoints
- **CORS Enabled**: Cross-origin requests are allowed

---

## Use Cases

### Daily Staked Amount Tracking (API Billing)

```javascript
// Track daily staked amounts for billing
async function getDailyStakingSnapshot() {
  const response = await fetch('https://dashboard.mor.org/api/builders/subnets');
  const data = await response.json();

  return {
    date: new Date().toISOString().split('T')[0],
    totalStakedMOR: data.data.totals.totalStakedFormatted,
    totalStakers: data.data.totals.totalStakers,
    subnets: data.data.subnets.map(s => ({
      id: s.id,
      name: s.name,
      stakedMOR: s.totalStakedFormatted,
      stakers: s.totalUsers
    }))
  };
}
```

### Find Top Stakers for a Subnet

```javascript
async function getTopStakers(subnetId, count = 10) {
  const response = await fetch(
    `https://dashboard.mor.org/api/builders/stakers?subnet_id=${subnetId}&limit=${count}`
  );
  const data = await response.json();

  // Results are already sorted by staked amount (descending)
  return data.data.stakers;
}
```

### Calculate User's Share of Subnet

```javascript
async function getUserShare(subnetId, userAddress) {
  const response = await fetch(
    `https://dashboard.mor.org/api/builders/stakers?subnet_id=${subnetId}&limit=1000`
  );
  const data = await response.json();

  const user = data.data.stakers.find(
    s => s.address.toLowerCase() === userAddress.toLowerCase()
  );

  if (!user) return { found: false };

  const totalStaked = data.data.totals.totalStakedFormatted;
  const userStaked = user.stakedFormatted;
  const sharePercent = (userStaked / totalStaked) * 100;

  return {
    found: true,
    stakedMOR: userStaked,
    sharePercent: sharePercent.toFixed(4),
    totalSubnetStaked: totalStaked
  };
}
```

---

## TypeScript Types

```typescript
interface SubnetsResponse {
  success: boolean;
  network: 'base';
  timestamp: string;
  data: {
    subnets: Subnet[];
    totals: {
      totalSubnets: number;
      totalStaked: string;
      totalStakedFormatted: number;
      totalStakers: number;
    };
  };
}

interface Subnet {
  id: string;
  name: string;
  admin: string;
  totalStaked: string;
  totalStakedFormatted: number;
  totalUsers: number;
  minimalDeposit: string;
  minimalDepositFormatted: number;
  startsAt: string;
}

interface StakersResponse {
  success: boolean;
  network: 'base';
  timestamp: string;
  subnetId: string;
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
  data: {
    stakers: Staker[];
    totals: {
      totalStakers: number;
      totalStaked: string;
      totalStakedFormatted: number;
    };
  };
}

interface Staker {
  address: string;
  staked: string;
  stakedFormatted: number;
  lastStake: string;
  lastStakeDate: string | null;
}

interface ErrorResponse {
  success: false;
  network: 'base';
  timestamp: string;
  error: string;
  data: null;
}
```

---

### 3. Get Full Subnet Data

Returns comprehensive subnet data including metadata and all stakers in a single response.

```
GET /api/builders/goldsky/[projectId]/full?network=base&limit=50&skip=0
```

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `network` | string | No | "base" | Network identifier ("base" or "arbitrum") |
| `limit` | number | No | 50 | Number of stakers per page (max: 1000) |
| `skip` | number | No | 0 | Number of results to skip |

#### Response

```json
{
  "success": true,
  "data": {
    "project": {
      "id": "0xf8c784db930f5b824609b2a64bc7135b089666624ba6e3a8cca427eafcf572cd",
      "name": "MySuperAgent",
      "admin": "0x67760bad63cc00294764ef7d1f6570e864c196c1",
      "totalStaked": "144531970800000000000000",
      "totalUsers": "31",
      "totalClaimed": "89456789123456789",
      "minimalDeposit": "1000000000000000",
      "withdrawLockPeriodAfterDeposit": "2592000",
      "startsAt": "1738684800",
      "claimLockEnd": "1743254400"
    },
    "metadata": {
      "id": "uuid-xxx-xxx-xxx",
      "name": "MySuperAgent",
      "description": "A powerful AI agent...",
      "longDescription": "Detailed description...",
      "imageSrc": "https://...",
      "website": "https://example.com",
      "tags": ["AI", "Blockchain"],
      "githubUrl": "https://github.com/...",
      "twitterUrl": "https://twitter.com/...",
      "discordUrl": "https://discord.gg/...",
      "contributors": 42,
      "githubStars": 1250,
      "rewardTypes": ["tokens"],
      "rewardTypesDetail": [...],
      "networks": ["Base", "Arbitrum"],
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-15T12:34:56.789Z"
    },
    "stakers": [
      {
        "id": "0x7ab874eeef0169ada0d225e9801a3ffffa26aac3",
        "address": "0x7ab874eeef0169ada0d225e9801a3ffffa26aac3",
        "staked": "1024000000000000000000",
        "lastStake": "1738641221",
        "projectName": "MySuperAgent"
      },
      ...
    ],
    "pagination": {
      "totalCount": 92,
      "limit": 50,
      "skip": 0,
      "hasMore": true
    },
    "queryParams": {
      "network": "base",
      "limit": "50",
      "skip": "0"
    }
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Whether the request succeeded |
| `data.project` | object | On-chain subnet data from Goldsky V4 |
| `data.metadata` | object | Enrichment data from Supabase (null if not found) |
| `data.stakers` | array | Full list of stakers with pagination support |
| `data.pagination` | object | Pagination metadata for stakers list |
| `data.queryParams` | object | Echo of query parameters for reference |

#### Project Object (On-chain Data)

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique subnet identifier (bytes32 hash) |
| `name` | string | Human-readable subnet name |
| `admin` | string | Subnet admin wallet address |
| `totalStaked` | string | Total MOR staked in wei (raw value) |
| `totalUsers` | string | Number of unique stakers |
| `totalClaimed` | string | Total MOR claimed in wei |
| `minimalDeposit` | string | Minimum deposit in wei |
| `withdrawLockPeriodAfterDeposit` | string | Withdrawal lock period in seconds |
| `startsAt` | string | Unix timestamp when subnet started |
| `claimLockEnd` | string | Unix timestamp when claim lock ends |

#### Metadata Object (Supabase Enrichment)

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Supabase record ID |
| `name` | string | Project name from database |
| `description` | string | Short project description |
| `longDescription` | string | Detailed description (markdown) |
| `imageSrc` | string | Project logo/image URL |
| `website` | string | Project website URL |
| `tags` | array | List of technology tags |
| `githubUrl` | string | GitHub repository URL |
| `twitterUrl` | string | Twitter/X profile URL |
| `discordUrl` | string | Discord server invite URL |
| `contributors` | number | Number of GitHub contributors |
| `githubStars` | number | Number of GitHub stars |
| `rewardTypes` | array | List of reward type tags |
| `rewardTypesDetail` | array | Detailed reward information |
| `networks` | array | List of supported networks |
| `createdAt` | string | ISO 8601 timestamp when record was created |
| `updatedAt` | string | ISO 8601 timestamp when record was last updated |

#### Staker Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Staker record ID |
| `address` | string | Staker's wallet address |
| `staked` | string | Amount staked in wei (raw value) |
| `lastStake` | string | Unix timestamp of last stake action |
| `projectName` | string | Associated project name (for reference) |

#### Pagination Object

| Field | Type | Description |
|-------|------|-------------|
| `totalCount` | number | Total number of stakers |
| `limit` | number | Results per page (from request) |
| `skip` | number | Current offset (from request) |
| `hasMore` | boolean | Whether more results are available |

#### Examples

**Basic request:**
```bash
curl "https://dashboard.mor.org/api/builders/goldsky/0xf8c784db930f5b824609b2a64bc7135b089666624ba6e3a8cca427eafcf572cd/full"
```

**With pagination:**
```bash
curl "https://dashboard.mor.org/api/builders/goldsky/0xf8c784db930f5b824609b2a64bc7135b089666624ba6e3a8cca427eafcf572cd/full?network=base&limit=50&skip=0"
```

**With network parameter:**
```bash
curl "https://dashboard.mor.org/api/builders/goldsky/0xf8c784db930f5b824609b2a64bc7135b089666624ba6e3a8cca427eafcf572cd/full?network=arbitrum"
```

```javascript
// JavaScript/TypeScript
const response = await fetch('https://dashboard.mor.org/api/builders/goldsky/0xf8c.../full');
const data = await response.json();

console.log(`Project: ${data.data.metadata.name}`);
console.log(`Total staked: ${data.data.project.totalStakedFormatted}`);
console.log(`Stakers count: ${data.data.stakers.length}`);
console.log(`Total stakers: ${data.data.pagination.totalCount}`);

// Access all stakers with pagination
const { stakers, pagination } = data.data;
console.log(`Page ${pagination.skip / pagination.limit + 1} of ${Math.ceil(pagination.totalCount / pagination.limit)}`);
```

```python
# Python
import requests

response = requests.get(
    'https://dashboard.mor.org/api/builders/goldsky/0xf8c784db930f5b824609b2a64bc7135b089666624ba6e3a8cca427eafcf572cd/full'
)

data = response.json()

print(f"Project: {data['data']['metadata']['name']}")
print(f"Total staked: {data['data']['project']['totalStakedFormatted']}")
print(f"Stakers: {len(data['data']['stakers'])} of {data['data']['pagination']['totalCount']}")
```

---

## Support

For questions or issues with these APIs, please open an issue at:
https://github.com/MorpheusAIs/dashboard/issues
