# Capital APR, Daily MOR, and Virtual Stake: Explanation for Product and Engineering

Last updated: May 27, 2026

## Short Version

The team is right to be cautious: pool APR, user APR, and MOR/day are currently easy to confuse, and parts of the dashboard calculation appear to use **actual deposits** where the contracts distribute rewards by **virtual deposits**.

In the Capital protocol there are two separate steps:

1. **Across asset pools**: the Distributor decides how much MOR each asset pool receives based on the pool's generated yield, normalized to USD.
2. **Within one asset pool**: the DepositPool splits that pool's MOR among users by **virtual deposited amount**, not raw deposited amount.

Virtual deposited amount is the user's deposit after multipliers such as Power Factor are applied. A new depositor with `PF = x1.0` competes against the whole pool's `totalVirtualDeposited`, which can be much larger than `totalDepositedInPublicPools` when other users have long locks.

That means a headline APR calculated with actual TVL can be meaningfully higher than what a new `x1.0` depositor should expect.

## Why This Matters

If the dashboard says a pool has `30% APR`, users may reasonably expect their MOR/day estimate to annualize to something close to 30% for a new deposit. But if the displayed APR divides rewards by actual TVL while the contract divides them by virtual TVL, the displayed APR is inflated by roughly:

```text
inflation factor = totalVirtualDeposited / totalDepositedInPublicPools
```

Example:

```text
actual deposited = 77,000 USDC
virtual deposited = 164,000 USDC-equivalent
virtual / actual = 2.13x

APR using actual denominator = 30.35%
APR for a new PF=1.0 depositor ~= 30.35% / 2.13 = 14.25%
```

This explains why a small position's MOR/day can back-solve to an APR much lower than the asset card APR.

## Plain-English Model

Think of each asset pool as a bucket:

- The protocol first decides how much MOR goes into each bucket.
- Then each bucket splits its MOR among users.
- The split inside a bucket is not based only on deposited dollars or tokens.
- It is based on **weighted deposits**.
- Power Factor increases a user's weight.

So a pool can have:

```text
$100 actual deposits
$230 virtual deposits
```

A new user depositing `$1` with `PF = x1.0` has `$1` of virtual weight. They are not earning against `$100`; they are competing against `$230` of existing virtual weight.

## What the Protocol Documentation Says

### RewardPool: emissions over time

The RewardPool contract defines MOR emissions for each bucket and exposes `getPeriodRewards(index, startTime, endTime)`.

Reference: [RewardPool docs](https://gitbook.mor.org/smart-contracts/documentation/distribution-protocol/v7-protocol/contracts/rewardpool)

Relevant concept:

```text
RewardPool.getPeriodRewards(...) returns total MOR emitted over a time range.
Pool #0 is the Capital reward pool.
```

### Distributor: split Capital emissions across asset pools

The Distributor assigns the Capital bucket's MOR emissions across deposit pools according to yield:

```solidity
uint256 yield = (tokenBalance - lastUnderlyingBalance).to18(decimals) * tokenPrice;
uint256 rewardShare = (poolYield * totalRewards) / totalYield;
distributedRewards[rewardPoolIndex][depositPoolAddress] += rewardShare;
```

Reference: [MOR distribution step #1](https://gitbook.mor.org/smart-contracts/documentation/distribution-protocol/v7-protocol/guides/mor-distribution.-step-1)

This supports Kyle's framing that the asset pool's share is about contributed yield, not a fixed bucket allocation like "USDC always gets 25%".

### DepositPool: split one asset pool's MOR across users

The DepositPool docs define:

```solidity
struct RewardPoolData {
  uint128 lastUpdate;
  uint256 rate;
  uint256 totalVirtualDeposited;
}
```

The docs describe `totalVirtualDeposited` as:

```text
The total amount deposited in the pool with multiplier.
```

They also define user data:

```solidity
struct UserData {
  uint128 lastStake;
  uint256 deposited;
  uint256 rate;
  uint256 pendingRewards;
  uint128 claimLockStart;
  uint128 claimLockEnd;
  uint256 virtualDeposited;
  uint128 lastClaim;
  address referrer;
}
```

The docs describe `virtualDeposited` as:

```text
The amount staked, with multipliers.
```

Reference: [DepositPool docs](https://gitbook.mor.org/smart-contracts/documentation/distribution-protocol/v7-protocol/contracts/depositpool)

This supports Anton's concern: once rewards are assigned to a pool, users inside that pool should be compared by virtual weight.

## The Math

### Step 1: MOR emitted for the Capital bucket

For a time period:

```text
R_total = RewardPool.getPeriodRewards(0, start, end)
```

For APR:

```text
R_annual = RewardPool.getPeriodRewards(0, now, now + 365 days)
```

### Step 2: asset pool reward share

Protocol documentation:

```text
yieldUSD_asset = yieldTokens_asset * tokenPrice_asset
share_asset = yieldUSD_asset / sum(yieldUSD_all_assets)
R_asset = R_total * share_asset
```

In the current dashboard code, `use-capital-pool-data.ts` attempts to use `distributedRewards` deltas as "protocol truth" and falls back to yield share:

```text
share_asset = distributedRewardsDelta_asset / sum(distributedRewardsDelta_all_assets)
```

That is directionally reasonable if the deltas are fresh and reliable because it mirrors what the Distributor actually assigned.

### Step 3: user share inside a pool

The DepositPool rate model can be simplified as:

```text
deltaRate = R_asset / totalVirtualDeposited
userReward = userVirtualDeposited * deltaRate
```

And:

```text
userVirtualDeposited = userDeposited * userMultiplier
```

So:

```text
userReward = R_asset * userVirtualDeposited / totalVirtualDeposited
```

For a new depositor with `PF = x1.0`:

```text
newUserVirtualDeposited = newUserDeposited
```

They receive:

```text
newUserReward = R_asset * newUserDeposited / totalVirtualDeposited
```

Not:

```text
R_asset * newUserDeposited / totalDepositedInPublicPools
```

### Step 4: new-deposit APR

For a new `x1.0` depositor:

```text
newDepositAPR =
  (R_asset_annual * MOR_price) / (totalVirtualDeposited * asset_price) * 100
```

If showing APR for a specific user with multiplier:

```text
userEffectiveAPR =
  newDepositAPR * userMultiplier
```

This is the intuitive meaning of Power Factor: if the base pool rate for a new `x1.0` user is 14%, a user with `x2.0` virtual weight may see roughly 28%, all else equal.

## What the Current Dashboard Code Does

### Asset card APR

File: `hooks/use-capital-pool-data.ts`

The code reads `totalVirtualDeposited` from `rewardPoolsData`, but then chooses actual deposits when available:

```typescript
const [, , totalVirtualDeposited] = rateData.data;

const totalActualDeposited = contract?.data
  ? Number(formatUnits(contract.data as bigint, decimals))
  : 0;

const totalVirtual = Number(formatUnits(totalVirtualDeposited as bigint, decimals));
const tvlForAPR = totalActualDeposited > 0 ? totalActualDeposited : totalVirtual;
```

Then APR is calculated with:

```typescript
const annualRewardsUSD = assetAnnualShareMOR * morPriceOption;
const tvlUSD = tvlForAPR * assetPriceUSD;
aprPercentage = tvlUSD > 0 ? (annualRewardsUSD / tvlUSD) * 100 : 0;
```

Problem:

```text
tvlForAPR uses actual deposits whenever actual deposits exist.
```

But the contract's user distribution uses `totalVirtualDeposited`.

### My Position APR

File: `components/capital/user-assets-panel.tsx`

The My Position APR currently uses the pool APR and multiplies by the user's Power Factor:

```text
effectiveApr = poolApr * userPowerFactor
```

If `poolApr` is already inflated because it used actual deposits instead of virtual deposits, this user APR inherits the same issue.

### Deposit modal MOR/day and My Position MOR/day

File: `components/capital/hooks/use-daily-emissions.ts`

The current user-level daily emissions estimate uses actual pool USD share and actual user stake:

```typescript
poolUSDShare = poolUSDValue / totalUSDValueAllPools;
userShareOfPool = userStake / totalStake;
userDailyEmissions = totalDailyRewards * poolUSDShare * userShareOfPool;
```

Problem:

1. Across pools, the protocol docs say pool share should be based on generated yield or actual `distributedRewards`, not raw pool USD share.
2. Within a pool, the contract distributes by virtual deposits, not actual deposits.

The user-facing estimate should be closer to:

```text
userDailyMOR =
  dailyMORForAssetPool * userVirtualDeposited / totalVirtualDeposited
```

Where:

```text
dailyMORForAssetPool =
  totalDailyMOR * assetRewardShare
```

And `assetRewardShare` should come from current/past `distributedRewards` deltas when reliable, or yield share when calculating forward-looking estimates.

## How to Read the Team Discussion

### Kyle's point

> "If 1 more of x was deposited, what would the yield be on that deposit?"

This framing is useful. A pool APR should answer: "What would a marginal new deposit earn at current conditions?"

But to answer it correctly, the marginal deposit's reward share must be calculated against the pool's virtual denominator:

```text
marginalReward = R_asset * newVirtualDeposit / (totalVirtualDeposited + newVirtualDeposit)
```

For a tiny marginal deposit, this approximates:

```text
marginalReward ~= R_asset * newVirtualDeposit / totalVirtualDeposited
```

### Anton's point

> "Within a pool, the contract doesn't track per-user yield. An individual account's share within the same pool is userVirtualDeposited / totalVirtualDeposited."

This is consistent with the DepositPool docs and with how `rate` and `virtualDeposited` are stored.

### Christopher's point

> "The dashboard should reveal the current algebra of the contracts."

This is the right product direction. The UI should separate:

- current pool conditions,
- the user's own weight / Power Factor,
- what has already been earned,
- when rewards are claimable,
- and how dynamic estimates can change.

## Mainnet Ratios and Interpretation

Anton reported these direct `eth_call` ratios:

| Pool | `totalVirtualDeposited / totalDepositedInPublicPools` | What it means if APR uses actual TVL |
| --- | ---: | --- |
| stETH | 2.13x | displayed APR is about 2.1x too high for a new `x1.0` depositor |
| USDC | 2.13x | displayed APR is about 2.1x too high for a new `x1.0` depositor |
| USDT | 2.31x | displayed APR is about 2.3x too high |
| wETH | 7.57x | displayed APR is about 7.6x too high |

These ratios are exactly the kind of gap we would expect when actual deposits are used in the denominator but rewards are split by virtual deposits.

## Example: Why `0.0004 MOR/day` on `$2` Does Not Feel Like `30% APR`

Suppose:

```text
USDC displayed APR = 30.35%
USDC V/A ratio = 2.13x
MOR price = $2.50
User deposit = $2
Power Factor = x1.0
```

Corrected new-depositor APR:

```text
30.35% / 2.13 = 14.25%
```

Expected annual dollar rewards:

```text
$2 * 14.25% = $0.285/year
```

Expected annual MOR:

```text
$0.285 / $2.50 = 0.114 MOR/year
```

Expected daily MOR:

```text
0.114 / 365 = 0.00031 MOR/day
```

This is in the same ballpark as `0.0004 MOR/day`.

If the displayed APR really were 30.35% for a new `x1.0` user:

```text
$2 * 30.35% = $0.607/year
$0.607 / $2.50 = 0.243 MOR/year
0.243 / 365 = 0.00067 MOR/day
```

So the team's sanity check is valid: the MOR/day number suggests a lower APR than the currently displayed USDC headline APR.

## Suggested Product Model

The dashboard should show three separate concepts:

### 1. Pool APR

Question answered:

```text
If I deposit now with x1.0 Power Factor, what annualized MOR return should I expect under current conditions?
```

Calculation:

```text
poolAprForNewX1 =
  (assetAnnualMORShare * MOR_price) / (totalVirtualDeposited * asset_price) * 100
```

### 2. Your APR

Question answered:

```text
Given my current Power Factor, what annualized MOR return do I expect on my current position?
```

Calculation:

```text
yourApr =
  poolAprForNewX1 * yourPowerFactor
```

But only if the user's multiplier is already reflected in `userVirtualDeposited`. If using direct user reward deltas, the calculation should use those deltas rather than re-multiplying.

### 3. MOR Daily Rewards

Question answered:

```text
If rewards were distributed at current conditions, how much MOR/day would this position earn?
```

Calculation:

```text
yourDailyMOR =
  dailyMORForAssetPool * userVirtualDeposited / totalVirtualDeposited
```

This is the most concrete user-facing number, but it is still dynamic.

## Suggested UI Labels

### Capital asset cards

Current:

```text
APR
```

Recommended:

```text
Est. APR
```

Or:

```text
Pool APR
```

If the number is corrected to represent a new x1.0 depositor, use:

```text
New Deposit APR
```

### My Position table

Current:

```text
APR
```

Recommended:

```text
Your APR
```

This makes it clear the number can differ from the pool card because it includes the user's Power Factor.

### Deposit modal

Recommended:

```text
Estimated MOR/day
```

And:

```text
Estimated APR
```

Make both dynamic estimates, not promises.

## Suggested Tooltip Copy

These should be short and avoid showing formulas in the UI.

### Pool / asset card APR tooltip

```text
Estimated annual MOR return for a new deposit with x1.0 Power Factor, based on current reward flow, MOR price, and the pool's total virtual deposits. Actual rewards change as emissions, yields, prices, and Power Factors change.
```

If we keep displaying the current uncorrected value temporarily, use a more cautious tooltip:

```text
Estimated pool-level APR based on current reward flow and pool deposits. This is a protocol estimate and may differ from a new depositor's realized APR because existing locked positions have higher reward weight.
```

### My Position APR tooltip

```text
Estimated annual MOR return for your current position. This includes your current Power Factor and can differ from the pool APR shown above.
```

### Average APR tooltip

```text
Deposit-weighted average of your estimated position APRs. It blends your assets by deposit value and includes each position's Power Factor.
```

### MOR Daily Emissions tooltip

```text
Estimated MOR earned per day at current conditions. This depends on Capital emissions, the asset pool's current reward share, your Power Factor, total virtual deposits, MOR price, and future pool activity.
```

### Deposit modal "Estimated MOR/day" tooltip

```text
Estimated MOR/day for this deposit if current reward conditions continued. The estimate uses current emissions and pool weights, and will change as other users deposit, withdraw, or change lock periods.
```

### Deposit modal Power Factor tooltip

```text
Power Factor increases your virtual weight in the pool. Higher Power Factor can increase rewards, but it delays when MOR rewards become claimable.
```

### Earned / Total Earned tooltip

```text
MOR rewards accrued so far. Some earned rewards may not be claimable until the unlock date.
```

### Inactive / stale pool tooltip

```text
This pool has little or no recent reward activity, so APR may be unavailable or not meaningful.
```

## Engineering Recommendations

### Recommendation 1: Fix the APR denominator

Use `totalVirtualDeposited` for the denominator when computing APR for a new `x1.0` depositor.

Current code:

```typescript
const tvlForAPR = totalActualDeposited > 0 ? totalActualDeposited : totalVirtual;
```

Recommended direction:

```typescript
const tvlForAPR = totalVirtual;
```

If we need a marginal deposit estimate:

```text
tvlForAPR = totalVirtual + newDepositVirtual
```

For displayed pool cards, the marginal deposit is usually small enough that `totalVirtual` is fine.

### Recommendation 2: Fix user daily MOR estimates

Use:

```text
dailyMORForAssetPool * userVirtualDeposited / totalVirtualDeposited
```

instead of:

```text
totalDailyRewards * poolUSDShare * userStake / totalStake
```

The pool share should come from current `distributedRewards` deltas where possible, not raw TVL share.

### Recommendation 3: Separate "pool APR" and "your APR"

Pool card:

```text
New Deposit APR
```

My Position:

```text
Your APR
```

Deposit modal:

```text
Estimated APR for this deposit
```

### Recommendation 4: Add a small "Advanced details" debug block for internal QA

Not necessarily user-facing, but useful during audit:

```text
Actual deposited
Virtual deposited
Average pool multiplier = virtual / actual
Recent distributedRewards delta
Last pool update timestamp
MOR price used
Asset price used
```

This would make future discrepancies much easier to diagnose.

### Recommendation 5: Avoid hardcoded APR floors for stale pools

For stale or inactive pools, prefer:

```text
N/A
No recent rewards
Inactive
```

over a hardcoded positive APR.

## Suggested Copy for a Team Decision

If the team wants a product rule, use this:

```text
Pool APR should represent the estimated annual MOR return for a new x1.0 depositor under current conditions. It should use each asset pool's current MOR reward share and divide by total virtual deposits, because that is the denominator used by the contracts to split rewards inside the pool.

User APR should represent the user's estimated annual MOR return after their current Power Factor.

MOR/day should be the user's current daily MOR estimate using the user's virtual deposit share of the pool, not the user's actual deposit share.
```

## Relevant Files

| File | Why it matters |
| --- | --- |
| `docs/APR_CALCULATION_EXPLANATION.md` | Existing APR explanation; already states `assetTVL` should be `totalVirtualDeposited` |
| `docs/CAPITAL_APR_CALCULATION_TECHNICAL_REFERENCE.md` | Technical reference for current APR architecture |
| `docs/v7 APR and distribution.md` | Existing protocol summary: pool rewards by yield, user rewards by virtual stake |
| `docs/Power_Factor_Calculation_Documentation.md` | Power Factor and virtual multiplier background |
| `hooks/use-capital-pool-data.ts` | Current pool APR implementation |
| `components/capital/hooks/use-daily-emissions.ts` | Current user MOR/day implementation |
| `components/capital/user-assets-panel.tsx` | Current My Position APR and Average APR display |
| `app/abi/DepositPool.json` | ABI exposing `rewardPoolsData`, `usersData`, `totalDepositedInPublicPools` |
| `app/abi/DistributorV2.json` | ABI exposing `depositPools`, `distributedRewards`, `distributeRewards` |

## External References

- [Morpheus V7 RewardPool docs](https://gitbook.mor.org/smart-contracts/documentation/distribution-protocol/v7-protocol/contracts/rewardpool)
- [Morpheus V7 DepositPool docs](https://gitbook.mor.org/smart-contracts/documentation/distribution-protocol/v7-protocol/contracts/depositpool)
- [Morpheus Protocol yield generation docs](https://gitbook.mor.org/smart-contracts/documentation/distribution-protocol/v7-protocol/guides/protocol-yield-generation)
- [Morpheus MOR distribution step #1 docs](https://gitbook.mor.org/smart-contracts/documentation/distribution-protocol/v7-protocol/guides/mor-distribution.-step-1)

## Open Questions Before Implementation

1. Should pool cards show **new x1.0 deposit APR** or **average existing pool APR**?
2. Should My Position APR be computed from current user reward rate deltas directly, or as pool APR multiplied by user Power Factor?
3. Should Deposit modal estimates include the new deposit's marginal impact on `totalVirtualDeposited`, or ignore it for simplicity?
4. What freshness threshold should mark a pool as stale or inactive?
5. Should `distributedRewards` deltas be measured over 24h, 7d, or latest distribution interval?
6. Should we expose an "Advanced calculation details" panel for internal QA or power users?

## Working Conclusion

Anton is likely reading the contract model correctly. Kyle's marginal-deposit framing is also correct, but the marginal calculation must use the virtual denominator inside a pool. Christopher's "current algebra of the contracts" framing is the best product direction.

The cleanest dashboard model is:

```text
Pool share across assets: yield / distributedRewards based
User share within asset: virtualDeposited / totalVirtualDeposited
Pool APR: new x1.0 depositor estimate
User APR: user's current Power Factor estimate
MOR/day: current dynamic user estimate
Earned: accrued historical rewards
Claimable: earned rewards currently claimable after unlock rules
```

## Verified Findings: 7-Day Window and Stale Pools

Added May 27, 2026 after checking the implementation, ABIs, protocol docs, and live Ethereum mainnet reads.

### Finding 1: The dashboard intentionally uses a 7-day smoothing window

The current implementation definitely uses a 7-day lookback:

```typescript
// hooks/use-capital-pool-data.ts
const WINDOW_DAYS = 7;
```

The hook then:

1. Finds a block approximately 7 days ago.
2. Reads `DistributorV2.distributedRewards(0, depositPoolAddress)` at the current block.
3. Reads the same value at the past block.
4. Uses `current - past` as the pool's recent reward delta.

Relevant implementation locations:

```text
hooks/use-capital-pool-data.ts
- WINDOW_DAYS = 7
- "Discover a block ~7 days ago"
- "HISTORICAL DISTRIBUTOR SNAPSHOTS (~7d ago)"
- "Compute protocol-truth shares from distributedRewards deltas (7d window)"
```

The contract-level minimum is not 7 days. The live `DistributorV2.minRewardsDistributePeriod()` value is:

```text
86,400 seconds = 1 day
```

The protocol docs also describe a daily-style constraint:

> Public pools must respect `minRewardsDistributePeriod` (e.g., once per day). This is enforced because `stETH` yield is not readable on-chain per second or block. It's accrued slowly, and daily intervals allow consistent accounting.

Source: [Protocol yield generation docs](https://gitbook.mor.org/smart-contracts/documentation/distribution-protocol/v7-protocol/guides/protocol-yield-generation)

So the precise conclusion is:

```text
The contract has a minimum distribution period of roughly 1 day.
The dashboard uses 7 days as a smoothing / stability window on top of that.
```

### Why the 7-day smoothing window was introduced

From a UI standpoint, a 1-day window is too noisy for a headline APR.

Capital rewards are not a smooth stream that updates every second. They are assigned when `distributeRewards()` runs, and pool-level yield can be lumpy because:

- distributions are constrained by `minRewardsDistributePeriod`;
- some yield sources update slowly;
- pool actions can trigger updates at uneven times;
- daily yield for smaller pools can be tiny, near zero, or concentrated into one distribution event;
- a single day can produce an unusually high or unusually low reward share.

When APR was based on short daily windows, the UI could swing between extreme values:

```text
Very high APR: one pool happened to receive a meaningful reward delta in that daily window.
Very low / zero APR: the pool had little or no reward delta in that daily window.
```

The 7-day window was introduced to make the displayed APR less jumpy. It averages the recent reward-share signal across a longer period, which makes the UI more readable and less likely to show misleading spikes or dips from one daily distribution.

Tradeoff:

```text
7-day window = smoother, more stable UI
1-day window = more current, but much noisier
```

The drawback is that a 7-day historical share is still backward-looking. The dashboard currently applies that recent historical share to a forward-looking annual emissions projection. During a decaying emission schedule, or when pool activity changes quickly, this can introduce drift.

### Finding 2: Some visible pools can be stale

This is confirmed by live mainnet reads.

Snapshot:

```text
Latest block: 25187197
Latest timestamp: 2026-05-27T14:14:11Z
7-day lookback block: 25136974
7-day lookback timestamp: 2026-05-20T14:14:11Z
Distributor rewardPoolLastCalculatedTimestamp(0): 2026-05-26T12:59:47Z
Distributor minRewardsDistributePeriod(): 86400 seconds
```

Mainnet pool reads for UI-visible pools:

| Pool | `rewardPoolsData.lastUpdate` | Age at snapshot | Actual deposited | Virtual deposited | V/A ratio | 7d `distributedRewards` delta | 7d share |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| stETH | 2026-05-27T09:28:47Z | 0.20 days | 8,164.0095 | 17,376.0182 | 2.1284x | 19,253.8538 MOR | 98.6538% |
| USDC | 2026-05-25T00:43:35Z | 2.56 days | 94,556.2640 | 201,312.5660 | 2.1290x | 189.5086 MOR | 0.9710% |
| USDT | 2026-05-27T09:30:11Z | 0.20 days | 55,329.5423 | 87,700.1425 | 1.5851x | 55.1497 MOR | 0.2826% |
| wETH | 2026-05-10T21:48:11Z | 16.68 days | 10.9322 | 82.7275 | 7.5674x | 18.0414 MOR | 0.0924% |

The key findings:

1. **wETH is meaningfully stale**: `rewardPoolsData.lastUpdate` was ~17 days old at the snapshot.
2. stETH and USDT were fresh at the snapshot (~0.2 days).
3. USDC was moderately fresh (~2.6 days), so it is not stale by a strict standard, but it is not as fresh as stETH/USDT.
4. The global Distributor timestamp was fresh (~1 day), but individual DepositPool timestamps can still lag.

### Why stale pools happen in this model

The protocol docs say distribution and yield withdrawal are triggered by pool actions:

> At the end of a yield cycle, when any function (e.g. `supply`, `withdraw`, or `withdrawYield`) is called on a given deposit pool, the `Distributor` contract calls `distributeRewards` and then withdraws yield only for the involved pool.

Source: [Protocol yield generation docs](https://gitbook.mor.org/smart-contracts/documentation/distribution-protocol/v7-protocol/guides/protocol-yield-generation)

That means a pool can be economically present but operationally stale if no one has interacted with it recently. Its `rewardPoolsData.lastUpdate` may lag far behind the global Distributor's `rewardPoolLastCalculatedTimestamp`.

### Implication for APR display

We should not treat every pool APR as equally fresh.

Recommended freshness rules:

| Condition | Suggested UI |
| --- | --- |
| `lastUpdate <= 2 days old` | Show APR normally |
| `2 < lastUpdate <= 7 days old` | Show APR with "data may lag" tooltip |
| `lastUpdate > 7 days old` | Show `Stale` / `No recent activity` instead of a normal APR, or show APR with a strong warning |
| `lastUpdate > 30 days old` | Prefer hiding APR behind `N/A` or `Inactive` |

### Updated engineering recommendations after verification

1. Keep the 7-day `distributedRewards` delta if we want a stable headline APR, but label it as a recent estimate rather than an instantaneous rate.
2. Do not imply the 7-day window is a hard contract constraint. The hard constraint observed onchain is 1 day.
3. Use `rewardPoolsData.lastUpdate` per pool as a freshness signal.
4. Add staleness handling before showing APR.
5. For Deposit modal projections, use the current pool's virtual denominator and mark projections stale if that pool's `lastUpdate` is old.
6. Consider showing `Last updated` in tooltips for APR and MOR/day.

### Suggested tooltip additions after verification

#### Fresh APR

```text
Estimated APR based on recent reward flow, MOR price, and total virtual deposits. This pool was updated recently, but the estimate can change as yields, emissions, prices, deposits, and lock weights change.
```

#### Smoothed APR

```text
This APR uses a recent multi-day reward window to reduce daily spikes and dips. It is an estimate, not a guaranteed rate.
```

#### Lagging APR

```text
Estimated APR based on recent reward data. This pool has not updated in a few days, so the number may lag current conditions.
```

#### Stale / inactive APR

```text
This pool has not updated recently, so APR is not currently reliable. Rewards may resume after new pool activity or a reward distribution.
```

#### Deposit modal projection when pool is stale

```text
Projection unavailable or unreliable because this pool has not updated recently. Estimates will become more reliable after new pool activity.
```

### Updated conclusion

The verified findings are:

```text
The 7-day delta is real in the implementation, and it exists as a dashboard smoothing choice layered on top of a 1-day contract minimum distribution period.

Pool staleness is real on mainnet. At the checked snapshot, wETH was ~17 days stale by DepositPool rewardPoolsData.lastUpdate, while USDC was moderately lagging at ~2.6 days.
```

This strengthens the case for replacing a single APR display with a more explicit model:

```text
New Deposit APR = current/recent pool reward share ÷ total virtual deposits
Your APR = New Deposit APR × your current Power Factor
MOR/day = daily asset-pool MOR × your virtual share
Freshness = show whether the pool reward data is recent enough to trust
Smoothing = explain that APR uses a multi-day recent window to reduce noisy daily spikes
```

