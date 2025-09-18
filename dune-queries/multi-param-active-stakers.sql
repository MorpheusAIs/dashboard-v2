-- Morpheus Capital: Active Stakers Count (MULTI-PARAMETER VERSION)
-- Handles events with multiple non-indexed parameters

-- Based on the 64-byte data field, these are likely events like:
-- UserClaimed(uint256,address,address,uint256) - indexed: poolId, user; data: receiver, amount
-- OR another event with 2 non-indexed parameters

WITH pool_contracts AS (
  SELECT 
    0xFea33A23F97d785236F22693eDca564782ae98d0 as contract_address,
    'stETH' as pool_type
  UNION ALL
  SELECT 
    0x7f4f17be21219D7DA4C8E0d0B9be6a778354E5A5 as contract_address,
    'LINK' as pool_type
),

-- Get all events from your most frequent signature
-- Decode multiple parameters from data field
stake_events AS (
  SELECT 
    p.pool_type,
    p.contract_address,
    logs.tx_hash,
    logs.block_time,
    logs.block_number,
    logs.topic1 as reward_pool_index, -- First indexed parameter
    logs.topic2 as user_address,      -- Second indexed parameter (user)
    -- For 64-byte data (2 parameters), split into 32-byte chunks
    bytearray_to_uint256(bytearray_substring(logs.data, 1, 32)) as first_param,   -- First 32 bytes  
    bytearray_to_uint256(bytearray_substring(logs.data, 33, 32)) as second_param  -- Second 32 bytes
  FROM sepolia.logs logs
  INNER JOIN pool_contracts p ON logs.contract_address = p.contract_address
  WHERE 
    logs.topic0 = 0x04575f52b6b30177fc1f54050c9bdd9be3a3e76421fe02757adf437a09763ae0 -- Most frequent event
    AND logs.block_time >= CAST('2024-01-01' as TIMESTAMP)
),

-- Get withdrawal/claim events from second signature  
withdrawal_events AS (
  SELECT 
    p.pool_type,
    p.contract_address,
    logs.tx_hash,
    logs.block_time,
    logs.block_number,
    logs.topic1 as reward_pool_index, -- First indexed parameter  
    logs.topic2 as user_address,      -- Second indexed parameter (user)
    -- For 64-byte data (2 parameters), split into 32-byte chunks
    bytearray_to_uint256(bytearray_substring(logs.data, 1, 32)) as first_param,   -- First 32 bytes
    bytearray_to_uint256(bytearray_substring(logs.data, 33, 32)) as second_param  -- Second 32 bytes
  FROM sepolia.logs logs
  INNER JOIN pool_contracts p ON logs.contract_address = p.contract_address
  WHERE 
    logs.topic0 = 0xe2f02dc2168917563b46b1f788ea74861c381103710158efe9976c0bb3333677 -- Second most frequent
    AND logs.block_time >= CAST('2024-01-01' as TIMESTAMP)
),

-- For now, let's just count unique stakers from both event types
-- We'll treat any user appearing in either event as a "staker"
all_stakers AS (
  SELECT DISTINCT user_address, pool_type
  FROM stake_events
  UNION
  SELECT DISTINCT user_address, pool_type  
  FROM withdrawal_events
)

-- Final results - Count unique active users
SELECT 
  COUNT(DISTINCT user_address) as total_active_stakers,
  
  -- Breakdown by pool
  COUNT(DISTINCT CASE WHEN pool_type = 'stETH' THEN user_address END) as steth_active_stakers,
  COUNT(DISTINCT CASE WHEN pool_type = 'LINK' THEN user_address END) as link_active_stakers,
  
  -- Users active in both pools
  COUNT(DISTINCT CASE 
    WHEN user_address IN (
      SELECT user_address FROM all_stakers WHERE pool_type = 'stETH'
    ) AND user_address IN (
      SELECT user_address FROM all_stakers WHERE pool_type = 'LINK'  
    ) THEN user_address 
  END) as multi_pool_stakers,
  
  -- Event counts for debugging
  (SELECT COUNT(*) FROM stake_events) as first_event_count,
  (SELECT COUNT(*) FROM withdrawal_events) as second_event_count

FROM all_stakers;
