# Testing Asset Yield Generation

## Problem: Some Assets Show Zero Yield

From your logs:
- **stETH**: Shows strategy "NONE", but should be "NO_YIELD" (rebasing)
- **wBTC**: currentBalance = lastBalance (no yield accumulated)
- **wETH**: currentBalance = lastBalance (no yield accumulated)

## Test #1: Verify stETH Strategy

### Check Distributor Contract:
https://etherscan.io/address/0xDf1AC1AC255d91F5f4B1E3B4Aef57c5350F64C7A#readContract

**Function**: `depositPools`
- poolId: `0`
- depositToken: `0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790` (stETH pool)

**Look at result[5] (strategy)**:
- 0 = NO_YIELD (rebasing, like stETH)
- 1 = NONE (disabled/private pools)
- 2 = AAVE (yield-generating)

**Expected**: Should be **0** for stETH (NO_YIELD/rebasing)

If it's 0, stETH WILL generate yield through Lido rebasing! ✅

## Test #2: Calculate Yield Since Pool Initialization

Instead of using `lastUnderlyingBalance`, let's calculate yield from pool start.

### Step 1: Get Pool Initialization Time

**Go to**: https://etherscan.io/address/0xb7994dE339AEe515C9b2792831CD83f3C9D8df87#readContract

**Function**: `rewardPools`
- Input: `0` (Capital pool)

**Look at result[3]**: `payoutStart` - This is when the pool started

### Step 2: Calculate Expected AAVE Yield

For **wBTC** example:
```javascript
// From your data:
depositedAmount = 0.14491895 wBTC (from depositedRaw)
currentBalance = 0.14491898 wBTC (from aToken)

// If pool started on: payoutStart = 1707393600 (Feb 8, 2024)
// Current time: Oct 3, 2025 ≈ 1727913600
// Elapsed time: 238 days

// Expected AAVE yield (assume 2% APY for wBTC):
expectedYield = 0.14491895 × 0.02 × (238/365)
             = 0.00189 wBTC

// Actual yield:
actualYield = 0.14491898 - 0.14491895 = 0.00000003 wBTC
             ≈ $0.0036 USD (at $120k/wBTC)
```

This is **WAY less** than expected! This suggests:
- Pool was recently created, OR
- Deposits were just made, OR
- lastUnderlyingBalance is wrong

### Step 3: Check When Deposits Were Made

**Go to**: https://etherscan.io/address/0xdE283F8309Fd1AA46c95d299f6B8310716277A42#readContract (wBTC pool)

**Function**: `depositPools` (if available) or check transaction history

**Or check events**:
https://etherscan.io/address/0xdE283F8309Fd1AA46c95d299f6B8310716277A42#events

Look for recent `Deposit` events to see when the 0.14 wBTC was deposited.

## Test #3: Check Last Distribution Timestamp

### For wBTC Pool:

**Go to**: https://etherscan.io/address/0xdE283F8309Fd1AA46c95d299f6B8310716277A42#readContract

**Function**: `rewardPoolsData`
- Input: `0` (reward pool index)

**Look at result[0]**: `lastUpdate` - When rewards were last distributed for this pool

**Convert timestamp to date**: Use https://www.unixtimestamp.com/

### Expected Results:

If `lastUpdate` was very recent (hours ago):
- Yield accumulation is low → Makes sense
- APR will be high when annualized

If `lastUpdate` was weeks/months ago:
- Should have significant yield → Something is wrong

## Test #4: Manual Yield Calculation from Etherscan

### For USDT (you verified has yield):

Current aToken balance: 4557.609978 USDT
Last recorded balance: 4557.426951 USDT
**Yield: 0.183027 USDT** ✅

Now check `lastUpdate` for USDT pool:
1. Go to: https://etherscan.io/address/0x3B51989212BEdaB926794D6bf8e9E991218cf116#readContract
2. Call `rewardPoolsData(0)`
3. Get `lastUpdate` timestamp
4. Calculate: `hoursElapsed = (now - lastUpdate) / 3600`

### Expected AAVE yield for USDT:

Assuming 4% AAVE APY:
```javascript
hourlyYield = 4557.426951 × 0.04 / 8760 hours/year
            = 0.0208 USDT/hour

// If 8.8 hours elapsed:
expectedYield = 0.0208 × 8.8 = 0.183 USDT ✅ Matches!
```

## Test #5: Check wETH Pool Data

### Verify wETH aToken Balance Calculation:

From your logs:
```
aToken result: "10161661608067915035" (18 decimals)
currentBalance: 10.161661608067915035 wETH
```

Now check on Etherscan:

1. **Get wETH aToken address**:
   - Go to Distributor: https://etherscan.io/address/0xDf1AC1AC255d91F5f4B1E3B4Aef57c5350F64C7A#readContract
   - Call `depositPools(0, 0x9380d72aBbD6e0Cc45095A2Ef8c2CA87d77Cb384)`
   - Get result[6] (aToken address)

2. **Check actual aToken balance**:
   - Go to that aToken contract
   - Call `balanceOf(0xDf1AC1AC255d91F5f4B1E3B4Aef57c5350F64C7A)`
   - Compare with your log value

3. **Check lastUnderlyingBalance**:
   - From same `depositPools` call above
   - Get result[4]
   - Should this match current balance?

## Summary of Tests

Run these checks and report:

1. **stETH strategy**: Is it 0 (NONE) or 1 (NO_YIELD)?
2. **wBTC lastUpdate**: When was it? Hours or weeks ago?
3. **wETH lastUpdate**: When was it?
4. **payoutStart**: When did pools actually start?

This will tell us if:
- ✅ Yield is low because it's recent (expected)
- ❌ Yield is missing because of a bug (needs fixing)
- ❌ stETH isn't configured correctly (strategy wrong)

Share those timestamps and I'll help calculate what the APR *should* be!

