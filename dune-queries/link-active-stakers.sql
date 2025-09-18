-- Morpheus Capital: LINK Pool Active Stakers Count
-- This query gets the count of unique active stakers in the LINK deposit pool
-- An "active staker" is someone who currently has a positive balance

WITH 
-- LINK Pool contract
link_pool AS (
  SELECT 0x7f4f17be21219D7DA4C8E0d0B9be6a778354E5A5 as contract_address
),

-- Get all stake events (deposits) for LINK pool
stake_events AS (
  SELECT 
    logs.tx_hash,
    logs.block_time,
    logs.block_number,
    logs.topic2 as user_address, -- topic2 is the indexed user address
    bytearray_to_uint256(logs.data) as amount_staked -- Properly decode the data field
  FROM sepolia.logs logs
  CROSS JOIN link_pool lp
  WHERE 
    logs.contract_address = lp.contract_address
    AND logs.topic0 = 0x9e71bc8eea02a63969f509818f2dafb9254532904319f9dbda79b67bd34a5f3d -- UserStaked event signature
    AND logs.block_time >= CAST('2024-01-01' as TIMESTAMP) -- Adjust start date as needed
),

-- Get all withdrawal events for LINK pool
withdrawal_events AS (
  SELECT 
    logs.tx_hash,
    logs.block_time,
    logs.block_number,
    logs.topic2 as user_address, -- topic2 is the indexed user address
    bytearray_to_uint256(logs.data) as amount_withdrawn -- Properly decode the data field
  FROM sepolia.logs logs
  CROSS JOIN link_pool lp
  WHERE 
    logs.contract_address = lp.contract_address
    AND logs.topic0 = 0xf279e6a1f5e320cca91135676d9cb6e44ca8a08c0b88342bcdb1144f6511b568 -- UserWithdrawn event signature
    AND logs.block_time >= CAST('2024-01-01' as TIMESTAMP) -- Adjust start date as needed
),

-- Calculate net positions per user
user_balances AS (
  SELECT 
    user_address,
    COALESCE(total_staked, 0) - COALESCE(total_withdrawn, 0) as net_balance,
    COALESCE(total_staked, 0) as total_ever_staked,
    COALESCE(total_withdrawn, 0) as total_ever_withdrawn,
    stake_count,
    withdrawal_count
  FROM (
    SELECT 
      user_address,
      SUM(amount_staked) as total_staked,
      COUNT(*) as stake_count
    FROM stake_events
    GROUP BY user_address
  ) stakes
  FULL OUTER JOIN (
    SELECT 
      user_address,
      SUM(amount_withdrawn) as total_withdrawn,
      COUNT(*) as withdrawal_count
    FROM withdrawal_events
    GROUP BY user_address
  ) withdrawals USING (user_address)
),

-- Get active stakers (those with positive balance)
active_stakers AS (
  SELECT *
  FROM user_balances
  WHERE net_balance > 0
)

-- Final results
SELECT 
  -- Main metric: count of active stakers
  COUNT(*) as active_stakers_count,
  
  -- Additional useful metrics
  SUM(net_balance) / 1e18 as total_link_staked,
  AVG(net_balance) / 1e18 as avg_stake_per_user,
  
  -- Distribution analysis
  COUNT(CASE WHEN net_balance >= 1e18 THEN 1 END) as stakers_1_plus_link,
  COUNT(CASE WHEN net_balance >= 10e18 THEN 1 END) as stakers_10_plus_link,
  COUNT(CASE WHEN net_balance >= 100e18 THEN 1 END) as stakers_100_plus_link,
  COUNT(CASE WHEN net_balance >= 1000e18 THEN 1 END) as stakers_1000_plus_link,
  
  -- Activity metrics
  COUNT(CASE WHEN stake_count > 1 THEN 1 END) as multi_deposit_users,
  COUNT(CASE WHEN withdrawal_count > 0 THEN 1 END) as users_who_withdrew,
  
  -- Time-based metrics (last 30 days activity)
  COUNT(CASE WHEN EXISTS(
    SELECT 1 FROM stake_events se 
    WHERE se.user_address = active_stakers.user_address 
    AND se.block_time >= NOW() - INTERVAL '30 days'
  ) THEN 1 END) as recently_active_stakers

FROM active_stakers;

-- Optional: Get detailed breakdown by stake size ranges  
/*
SELECT 
  CASE 
    WHEN net_balance < 1e18 THEN '< 1 LINK'
    WHEN net_balance < 10e18 THEN '1-10 LINK'  
    WHEN net_balance < 100e18 THEN '10-100 LINK'
    WHEN net_balance < 1000e18 THEN '100-1000 LINK'
    WHEN net_balance < 10000e18 THEN '1000-10000 LINK'
    ELSE '10000+ LINK'
  END as stake_range,
  COUNT(*) as staker_count,
  SUM(net_balance) / 1e18 as total_staked_in_range
FROM active_stakers
GROUP BY 1
ORDER BY MIN(net_balance);
*/
