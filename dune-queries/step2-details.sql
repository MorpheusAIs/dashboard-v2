-- STEP 2: Event Structure Analysis  
-- This shows the actual data structure of your most frequent events
-- Run this AFTER step1-overview.sql to understand the event parameters

SELECT 
  'Event Structure Analysis' as analysis,
  contract_address,
  topic0,
  topic1,
  topic2, 
  topic3,
  LENGTH(data) as data_length_bytes,
  data as raw_data,
  block_time,
  tx_hash
FROM sepolia.logs 
WHERE contract_address IN (
  0xFea33A23F97d785236F22693eDca564782ae98d0, -- stETH
  0x7f4f17be21219D7DA4C8E0d0B9be6a778354E5A5  -- LINK
)
AND topic0 IN (
  0x04575f52b6b30177fc1f54050c9bdd9be3a3e76421fe02757adf437a09763ae0, -- Top event (38 occurrences)
  0xe2f02dc2168917563b46b1f788ea74861c381103710158efe9976c0bb3333677  -- Second event (37 occurrences)
)
ORDER BY contract_address, topic0, block_time DESC
LIMIT 10;

-- Expected patterns:
-- If topic1 and topic2 have values = indexed parameters (like user address)
-- If data has length > 0 = non-indexed parameters (like amount)
-- 
-- Common patterns:
-- Deposit(address indexed user, uint256 amount) -> topic1=user, data=amount
-- Stake(uint256 indexed poolId, address indexed user, uint256 amount) -> topic1=poolId, topic2=user, data=amount
