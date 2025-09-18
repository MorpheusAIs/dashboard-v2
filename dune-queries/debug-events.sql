-- Debug Query: Check if events exist at all
-- Run this to see what's actually in the logs for your contracts

-- Step 1: Check if ANY logs exist for these contracts
SELECT 
  'Total Logs Check' as check_type,
  contract_address,
  COUNT(*) as total_logs,
  MIN(block_time) as first_log,
  MAX(block_time) as latest_log
FROM sepolia.logs 
WHERE contract_address IN (
  0xFea33A23F97d785236F22693eDca564782ae98d0, -- stETH
  0x7f4f17be21219D7DA4C8E0d0B9be6a778354E5A5  -- LINK
)
GROUP BY contract_address

UNION ALL

-- Step 2: Check what event types (topic0) exist
SELECT 
  'Event Types Check' as check_type,
  contract_address,
  topic0,
  COUNT(*) as event_count
FROM sepolia.logs 
WHERE contract_address IN (
  0xFea33A23F97d785236F22693eDca564782ae98d0,
  0x7f4f17be21219D7DA4C8E0d0B9be6a778354E5A5
)
GROUP BY contract_address, topic0
ORDER BY contract_address, event_count DESC;

-- Step 3: Check if our specific events exist
/*
UserStaked: 0x9e71bc8eea02a63969f509818f2dafb9254532904319f9dbda79b67bd34a5f3d
UserWithdrawn: 0xf279e6a1f5e320cca91135676d9cb6e44ca8a08c0b88342bcdb1144f6511b568
*/
