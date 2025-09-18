# Dune Query Troubleshooting Guide

## 🔧 Fixed Common Issues

### ✅ **Issue 1: Address Format**
**Error**: SQL syntax errors with quoted addresses
```sql
-- ❌ WRONG: Quotes cause issues in Dune
'0xFea33A23F97d785236F22693eDca564782ae98d0'

-- ✅ CORRECT: No quotes for hex addresses
0xFea33A23F97d785236F22693eDca564782ae98d0
```

### ✅ **Issue 2: Data Field Casting**
**Error**: `Cannot cast varbinary to uint256`
```sql
-- ❌ WRONG: Cannot cast logs.data directly
CAST(logs.data as UINT256)

-- ✅ CORRECT: Use proper decoding function
bytearray_to_uint256(logs.data)
```

### ✅ **Issue 3: Topic Casting**  
**Error**: Unnecessary casting of topic fields
```sql
-- ❌ WRONG: Unnecessary casting
CAST(logs.topic2 as VARCHAR)

-- ✅ CORRECT: Topics are already properly typed
logs.topic2
```

---

## 🚨 Other Common Issues & Solutions

### **Issue: No Results Found**

**Possible Causes:**
1. **Wrong Contract Addresses**: Verify addresses match deployed contracts
2. **Wrong Network**: Ensure you're using the right table (`ethereum.logs` vs `ethereum_sepolia.logs`)
3. **Wrong Event Signatures**: Event hash doesn't match actual ABI
4. **Wrong Date Range**: Start date is after actual events

**Solutions:**
```sql
-- 1. Verify contract has events on Etherscan
-- 2. Check event signature matches ABI:
SELECT topic0, COUNT(*) FROM ethereum.logs 
WHERE contract_address = 0xYourContractAddress 
GROUP BY topic0 LIMIT 10;

-- 3. Adjust date range:
AND logs.block_time >= CAST('2023-01-01' as TIMESTAMP) -- Earlier date

-- 4. Remove date filter temporarily to test:
-- AND logs.block_time >= CAST('2024-01-01' as TIMESTAMP)
```

### **Issue: Query Timeout**

**Possible Causes:**
1. **Too Wide Date Range**: Querying too much historical data
2. **Missing Indexes**: Not using indexed fields efficiently
3. **Complex Joins**: Too many table joins without proper filtering

**Solutions:**
```sql
-- 1. Narrow date range:
AND logs.block_time >= NOW() - INTERVAL '30 days'

-- 2. Use indexed fields in WHERE clauses:
WHERE logs.contract_address = 0xYourAddress -- indexed
  AND logs.topic0 = 0xEventSignature       -- indexed

-- 3. Add LIMIT for testing:
ORDER BY logs.block_time DESC LIMIT 1000
```

### **Issue: Incorrect Event Signatures**

**How to Find Correct Signatures:**
1. Go to [4byte.directory](https://www.4byte.directory/)
2. Search for your event name (e.g., "UserStaked")
3. Or calculate manually:
```javascript
// In browser console or Node.js
const ethers = require('ethers');
ethers.utils.id('UserStaked(uint256,address,uint256)')
// Returns: 0x9e71bc8eea02a63969f509818f2dafb9254532904319f9dbda79b67bd34a5f3d
```

### **Issue: Wrong Topic Positions**

**Understanding Topics:**
```solidity
event UserStaked(uint256 indexed poolId, address indexed user, uint256 amount);
```

Maps to:
- `topic0` = Event signature hash
- `topic1` = poolId (first indexed parameter)  
- `topic2` = user (second indexed parameter)
- `data` = amount (non-indexed parameter)

**Fix:**
```sql
-- If user is topic1 instead of topic2:
logs.topic1 as user_address

-- If you need poolId:
logs.topic1 as pool_id
```

---

## 🧪 Testing Strategy

### **1. Start Simple**
```sql
-- Test 1: Just count logs
SELECT COUNT(*) FROM ethereum.logs 
WHERE contract_address = 0xYourAddress;

-- Test 2: See what events exist  
SELECT topic0, COUNT(*) FROM ethereum.logs 
WHERE contract_address = 0xYourAddress 
GROUP BY topic0;

-- Test 3: Look at raw data
SELECT * FROM ethereum.logs 
WHERE contract_address = 0xYourAddress 
LIMIT 5;
```

### **2. Verify Event Structure**
```sql
-- Check if your target event exists:
SELECT 
  topic0,
  topic1, 
  topic2,
  topic3,
  data,
  block_time
FROM ethereum.logs 
WHERE contract_address = 0xYourAddress
  AND topic0 = 0xYourEventSignature
LIMIT 5;
```

### **3. Test Data Decoding**
```sql
-- Test different decoding methods:
SELECT 
  logs.topic2,
  bytearray_to_uint256(logs.data) as decoded_amount,
  logs.data as raw_data
FROM ethereum.logs logs
WHERE contract_address = 0xYourAddress
  AND topic0 = 0xYourEventSignature  
LIMIT 5;
```

---

## 📋 Pre-Flight Checklist

Before running your query, verify:

- [ ] **Contract addresses** have no quotes
- [ ] **Event signatures** match your ABI exactly  
- [ ] **Date ranges** cover actual deployment period
- [ ] **Topic positions** match your event parameters
- [ ] **Data decoding** uses `bytearray_to_uint256()`
- [ ] **Network** matches where contracts are deployed

---

## 🆘 Getting Help

### **Debug Information to Collect:**
1. **Contract Address**: Where your events should be
2. **Event ABI**: Exact event definition from your contract  
3. **Expected vs Actual**: What you expect vs what you get
4. **Etherscan Link**: To verify events exist on-chain

### **Useful Dune Resources:**
- [Dune Docs](https://docs.dune.com/)
- [Dune Discord](https://discord.gg/dune)
- [Ethereum Data Tables](https://docs.dune.com/reference/tables/ethereum)

### **Example Debug Query:**
```sql
-- Send this with your help request:
SELECT 
  'Debug Info' as query_type,
  COUNT(*) as total_logs,
  MIN(block_time) as first_event,
  MAX(block_time) as last_event,
  COUNT(DISTINCT topic0) as unique_events
FROM ethereum.logs 
WHERE contract_address = 0xYourAddress;
```

---

## ✅ **Current Status: Fixed**

All three Morpheus Capital queries now use:
- ✅ Correct address format (no quotes)
- ✅ Proper data decoding (`bytearray_to_uint256`)
- ✅ Clean topic references (no unnecessary casting)

The queries should now run without the varbinary casting errors! 🎉
