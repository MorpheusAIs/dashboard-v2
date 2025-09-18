-- Morpheus Capital: Active Stakers Count
-- This query gets the count of unique active stakers across stETH and LINK deposit pools
-- An "active staker" is someone who currently has a positive balance in any pool

-- Combined Query: Unique Stakers Across All Pools
WITH pool_contracts AS (
  SELECT 
    0xFea33A23F97d785236F22693eDca564782ae98d0 as contract_address,
    'stETH' as pool_type
  UNION ALL
  SELECT 
    0x7f4f17be21219D7DA4C8E0d0B9be6a778354E5A5 as contract_address,
    'LINK' as pool_type
),

-- Get all stake events (deposits)
stake_events AS (
  SELECT 
    p.pool_type,
    p.contract_address,
    logs.tx_hash,
    logs.block_time,
    logs.block_number,
    logs.topic2 as user_address, -- topic2 is the indexed user address
    bytearray_to_uint256(logs.data) as amount_staked -- Properly decode the data field
  FROM sepolia.logs logs
  INNER JOIN pool_contracts p ON logs.contract_address = p.contract_address
  WHERE 
    logs.topic0 = 0x9e71bc8eea02a63969f509818f2dafb9254532904319f9dbda79b67bd34a5f3d -- UserStaked event signature
    AND logs.block_time >= CAST('2024-01-01' as TIMESTAMP) -- Adjust start date as needed
),

-- Get all withdrawal events
withdrawal_events AS (
  SELECT 
    p.pool_type,
    p.contract_address,
    logs.tx_hash,
    logs.block_time,
    logs.block_number,
    logs.topic2 as user_address, -- topic2 is the indexed user address
    bytearray_to_uint256(logs.data) as amount_withdrawn -- Properly decode the data field
  FROM sepolia.logs logs
  INNER JOIN pool_contracts p ON logs.contract_address = p.contract_address
  WHERE 
    logs.topic0 = 0xf279e6a1f5e320cca91135676d9cb6e44ca8a08c0b88342bcdb1144f6511b568 -- UserWithdrawn event signature
    AND logs.block_time >= CAST('2024-01-01' as TIMESTAMP) -- Adjust start date as needed
),

-- Calculate net positions per user per pool
user_pool_balances AS (
  SELECT 
    pool_type,
    contract_address,
    user_address,
    COALESCE(total_staked, 0) - COALESCE(total_withdrawn, 0) as net_balance
  FROM (
    SELECT 
      pool_type,
      contract_address,
      user_address,
      SUM(amount_staked) as total_staked
    FROM stake_events
    GROUP BY pool_type, contract_address, user_address
  ) stakes
  FULL OUTER JOIN (
    SELECT 
      pool_type,
      contract_address, 
      user_address,
      SUM(amount_withdrawn) as total_withdrawn
    FROM withdrawal_events
    GROUP BY pool_type, contract_address, user_address
  ) withdrawals USING (pool_type, contract_address, user_address)
),

-- Get active stakers (those with positive balance in any pool)
active_stakers AS (
  SELECT DISTINCT user_address
  FROM user_pool_balances
  WHERE net_balance > 0
)

-- Final results
SELECT 
  COUNT(DISTINCT user_address) as total_active_stakers,
  
  -- Breakdown by pool (users can appear in multiple pools)
  COUNT(DISTINCT CASE WHEN EXISTS(
    SELECT 1 FROM user_pool_balances upb 
    WHERE upb.user_address = active_stakers.user_address 
    AND upb.pool_type = 'stETH' 
    AND upb.net_balance > 0
  ) THEN user_address END) as steth_active_stakers,
  
  COUNT(DISTINCT CASE WHEN EXISTS(
    SELECT 1 FROM user_pool_balances upb 
    WHERE upb.user_address = active_stakers.user_address 
    AND upb.pool_type = 'LINK' 
    AND upb.net_balance > 0
  ) THEN user_address END) as link_active_stakers,
  
  -- Users staking in both pools
  COUNT(DISTINCT CASE WHEN EXISTS(
    SELECT 1 FROM user_pool_balances upb1 
    WHERE upb1.user_address = active_stakers.user_address 
    AND upb1.pool_type = 'stETH' 
    AND upb1.net_balance > 0
  ) AND EXISTS(
    SELECT 1 FROM user_pool_balances upb2 
    WHERE upb2.user_address = active_stakers.user_address 
    AND upb2.pool_type = 'LINK' 
    AND upb2.net_balance > 0
  ) THEN user_address END) as multi_pool_stakers

FROM active_stakers;
