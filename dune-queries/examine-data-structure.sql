-- Examine the actual data structure of your events
-- This will help us understand what parameters are in the data field

SELECT 
  topic0,
  topic1,
  topic2,
  topic3,
  data,
  LENGTH(data) as data_length_bytes,
  LENGTH(data)/2 as data_length_hex_chars,
  contract_address,
  block_time,
  tx_hash
FROM sepolia.logs 
WHERE contract_address IN (
  0xFea33A23F97d785236F22693eDca564782ae98d0,  -- stETH pool
  0x7f4f17be21219D7DA4C8E0d0B9be6a778354E5A5   -- LINK pool
)
AND topic0 IN (
  0x04575f52b6b30177fc1f54050c9bdd9be3a3e76421fe02757adf437a09763ae0, -- Most frequent (61 events)
  0xe2f02dc2168917563b46b1f788ea74861c381103710158efe9976c0bb3333677  -- Second most (58 events)
)
ORDER BY topic0, block_time
LIMIT 10;

-- Expected results:
-- If LENGTH(data) = 64 hex chars = 32 bytes → 1 uint256 parameter  
-- If LENGTH(data) = 128 hex chars = 64 bytes → 2 parameters (address + uint256, or 2 uint256s)
-- If LENGTH(data) = 192 hex chars = 96 bytes → 3 parameters
