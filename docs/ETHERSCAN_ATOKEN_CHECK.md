# Manual Etherscan aToken Balance Check

## Contract Addresses

### Main Contracts
- **Distributor V2**: `0xDf1AC1AC255d91F5f4B1E3B4Aef57c5350F64C7A`
- **Reward Pool V2**: `0xb7994dE339AEe515C9b2792831CD83f3C9D8df87`

### Deposit Pool Addresses (Mainnet)
- **stETH**: `0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790`
- **USDC**: `0x6cCE082851Add4c535352f596662521B4De4750E`
- **USDT**: `0x3B51989212BEdaB926794D6bf8e9E991218cf116`
- **wBTC**: `0xdE283F8309Fd1AA46c95d299f6B8310716277A42`
- **wETH**: `0x9380d72aBbD6e0Cc45095A2Ef8c2CA87d77Cb384`

### aToken Addresses (AAVE v3)
- **USDC aToken**: `0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c`
- **USDT aToken**: `0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a`
- **wBTC aToken**: `0x5Ee5bf7ae06D1Be5997A1A72006FE6C607eC6DE8`
- **wETH aToken**: Need to query from Distributor

## Check #1: Current aToken Balances

### USDC aToken Balance

1. **Go to**: https://etherscan.io/address/0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c#readContract
2. **Find function**: `balanceOf`
3. **Input**: `0xDf1AC1AC255d91F5f4B1E3B4Aef57c5350F64C7A`
4. **Click**: Query
5. **Result**: Current balance in aUSDC (use 6 decimals for USDC)

**Example**:
```
Result: 4771864316000000000000 (raw with 18 decimals)
Divide by 10^18 = 4771.864316 aUSDC
```

### USDT aToken Balance

1. **Go to**: https://etherscan.io/address/0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a#readContract
2. **Function**: `balanceOf`
3. **Input**: `0xDf1AC1AC255d91F5f4B1E3B4Aef57c5350F64C7A`
4. **Click**: Query

### wBTC aToken Balance

1. **Go to**: https://etherscan.io/address/0x5Ee5bf7ae06D1Be5997A1A72006FE6C607eC6DE8#readContract
2. **Function**: `balanceOf`
3. **Input**: `0xDf1AC1AC255d91F5f4B1E3B4Aef57c5350F64C7A`
4. **Click**: Query

### wETH aToken Balance

First, get the aToken address:
1. **Go to**: https://etherscan.io/address/0xDf1AC1AC255d91F5f4B1E3B4Aef57c5350F64C7A#readContract
2. **Function**: `depositPools`
   - poolId: `0`
   - depositToken: `0x9380d72aBbD6e0Cc45095A2Ef8c2CA87d77Cb384` (wETH Deposit Pool)
3. **Look at result[6]**: This is the aToken address
4. Then check `balanceOf` on that aToken contract

## Check #2: Last Recorded Balances

### For ALL Assets

1. **Go to**: https://etherscan.io/address/0xDf1AC1AC255d91F5f4B1E3B4Aef57c5350F64C7A#readContract
2. **Function**: `depositPools`
3. **Inputs**:
   - poolId: `0` (Capital pool)
   - depositToken: (use deposit pool address from table above)

### Read Results:

The function returns 8 values:

```solidity
struct DepositPoolData {
  0: address token;                    // Underlying token address
  1: string chainLinkPath;             // Price feed path
  2: uint256 tokenPrice;               // Token price (18 decimals)
  3: uint256 deposited;                // Total deposited
  4: uint256 lastUnderlyingBalance;    // ← LAST RECORDED BALANCE
  5: uint8 strategy;                   // 0=NO_YIELD, 1=NONE, 2=AAVE
  6: address aToken;                   // aToken address
  7: bool isExist;                     // Pool exists
}
```

**Focus on field [4]**: `lastUnderlyingBalance`

### Example for USDC:

**Inputs**:
- poolId: `0`
- depositToken: `0x6cCE082851Add4c535352f596662521B4De4750E`

**Expected Results**:
```
[0]: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 (USDC token)
[1]: "USDC/USD"
[2]: 999725600000000000 (≈ $1.00)
[3]: 4771864316 (total deposited, 6 decimals)
[4]: 4773669158 ← LAST RECORDED BALANCE (6 decimals)
[5]: 2 (AAVE strategy)
[6]: 0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c (aUSDC)
[7]: true
```

## Calculate Yield

### Formula Per Asset:

```
1. Get current aToken balance (Check #1)
   → Convert to asset decimals (6 for USDC/USDT, 8 for wBTC, 18 for wETH)

2. Get lastUnderlyingBalance (Check #2, field [4])
   → Already in asset decimals

3. Calculate yield:
   yield = currentBalance - lastUnderlyingBalance

4. Calculate yield in USD:
   yieldUSD = yield * tokenPrice (from field [2], divide by 10^18)
```

### Example Calculation for USDC:

From your logs:
```
lastUnderlyingBalance: 4773.669158 USDC
```

Let's say current balance is:
```
Current aToken balance: 4775.123456 USDC (example)
```

**Yield Calculation**:
```
yield = 4775.123456 - 4773.669158 = 1.454298 USDC
yieldUSD = 1.454298 * $1.00 = $1.45
```

If current balance equals last balance:
```
yield = 4773.669158 - 4773.669158 = 0 USDC
yieldUSD = $0.00
```

This means **no yield has accrued since last distribution!**

## Why No Yield Might Show

### Possibility 1: Recent Distribution
If `distributeRewards()` was just called, it updates `lastUnderlyingBalance` to match current balance, resetting yield to zero.

### Possibility 2: Low AAVE APY
AAVE yields are low right now, so yield accumulates slowly. Check elapsed time since last distribution.

### Possibility 3: Small Deposits
With small TVL (like 10.16 wETH), absolute yield in tokens is tiny, making it hard to see short-term.

## Quick Check: When Was Last Distribution?

1. **Go to**: https://etherscan.io/address/0xDf1AC1AC255d91F5f4B1E3B4Aef57c5350F64C7A#readContract
2. **Function**: `depositPools` (same as above)
3. **Look at the Distributor contract events** to see when `RewardsDistributed` was last emitted

Or check:

1. **Go to**: https://etherscan.io/address/0xb7994dE339AEe515C9b2792831CD83f3C9D8df87#readContract (RewardPool)
2. **Function**: `pools` 
3. **Input**: `0` (Capital pool index)
4. **Look at**: `lastUpdate` timestamp - shows when rewards were last distributed

## Expected Findings

If you find:
- ✅ **aToken balance > lastUnderlyingBalance**: Yield exists, our code should calculate APR
- ⚠️ **aToken balance = lastUnderlyingBalance**: No yield yet, APR will show N/A (correct behavior)
- ❌ **aToken balance < lastUnderlyingBalance**: Impossible, something is wrong

## Report Back

After checking, please share:

1. **USDC**:
   - Current aToken balance: `_______`
   - Last recorded balance: `_______`
   - Yield: `_______`

2. **USDT**:
   - Current aToken balance: `_______`
   - Last recorded balance: `_______`
   - Yield: `_______`

3. **wBTC**:
   - Current aToken balance: `_______`
   - Last recorded balance: `_______`
   - Yield: `_______`

4. **wETH**:
   - Current aToken balance: `_______`
   - Last recorded balance: `_______`
   - Yield: `_______`

This will tell us if the issue is:
- **No yield exists** (expected if recent distribution)
- **Yield exists but we're not reading it** (our bug to fix)

