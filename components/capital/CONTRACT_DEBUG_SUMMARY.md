# Capital Contract Debug Summary

## Current Status: Contract Calls Investigation

The APR values you're seeing (12.50% and 18.75%) were **fallback values**. I've now:

### ✅ **Fixed Fallback Issue**
- **Before**: Showed fallback percentages when contract calls failed
- **After**: Shows "N/A" when contract data is unavailable  
- **Visual Indicator**: Red "Contract Debug" badge appears when contracts fail

### 🔍 **Added Comprehensive Debugging** 
- **Contract addresses**: Logs all v7/v2 protocol addresses being used
- **Contract responses**: Shows actual data returned from each contract
- **Error details**: Specific error messages for each failed call
- **Loading states**: Shows which contracts are still loading

### 🔧 **Current Implementation Approach**
Since `totalVirtualStake` function doesn't exist in current v2 proxy contracts, I'm using:
- ✅ **`totalDepositedInPublicPools`** (working) - for deposit amounts
- ✅ **`RewardPoolV2.getPeriodRewards`** (testing) - for emission rates  
- ✅ **Simplified reward distribution** - split rewards evenly between pools as approximation

### 🎯 **Expected Behavior Now**
When you refresh the capital page:

1. **If contracts work**: You'll see calculated APR percentages (not N/A)
2. **If contracts fail**: You'll see "N/A" + red "Contract Debug" badge
3. **Console logs**: Detailed debugging info about each contract call

### 📊 **Debug Information Available**
Check browser console for:
```
🔍 Contract Call Debug: {
  networkEnvironment: "testnet",
  rewardPoolV2Address: "0x...",
  periodRewardsData: "123.45" | "undefined",
  stETHTotalDeposited: "67.89" | "undefined",
  errors: {...}
}
```

This will help us identify exactly which contract calls are failing and why.

### 🚀 **Next Steps**
1. Check console logs to see which contracts are responding
2. If RewardPoolV2 fails → investigate contract deployment/ABI issues
3. If all data loads → you should see real calculated APR values
4. If partial data → shows "N/A" until proper v7 distributor is available
