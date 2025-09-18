-- Morpheus Capital: Active Stakers Count (CORRECTED VERSION)
-- Using your actual DepositPool ABI event signatures

-- Based on your DepositPool.json ABI:
-- UserStaked(uint256,address,uint256) - indexed: rewardPoolIndex, user; data: amount  
-- UserWithdrawn(uint256,address,uint256) - indexed: rewardPoolIndex, user; data: amount

-- Your Dune results show:
-- 0x04575f52b6b30177fc1f54050c9bdd9be3a3e76421fe02757adf437a09763ae0 = 61 events (likely UserStaked)
-- 0xe2f02dc2168917563b46b1f788ea74861c381103710158efe9976c0bb3333677 = 58 events (likely UserWithdrawn)

WITH pool_contracts AS (
  SELECT 
    0xFea33A23F97d785236F22693eDca564782ae98d0 as contract_address,
    'stETH' as pool_type
  UNION ALL
  SELECT 
    0x7f4f17be21219D7DA4C8E0d0B9be6a778354E5A5 as contract_address,
    'LINK' as pool_type
),

-- Get all UserStaked events - using your most frequent event signature
stake_events AS (
  SELECT 
    p.pool_type,
    p.contract_address,
    logs.tx_hash,
    logs.block_time,
    logs.block_number,
    logs.topic1 as reward_pool_index, -- First indexed parameter
    logs.topic2 as user_address,      -- Second indexed parameter (user)
    bytearray_to_uint256(logs.data) as amount_staked -- Non-indexed parameter (amount)
  FROM sepolia.logs logs
  INNER JOIN pool_contracts p ON logs.contract_address = p.contract_address
  WHERE 
    logs.topic0 = 0x04575f52b6b30177fc1f54050c9bdd9be3a3e76421fe02757adf437a09763ae0 -- UserStaked event (most frequent)
    AND logs.block_time >= CAST('2024-01-01' as TIMESTAMP)
),

-- Get all UserWithdrawn events - using your second most frequent event signature  
withdrawal_events AS (
  SELECT 
    p.pool_type,
    p.contract_address,
    logs.tx_hash,
    logs.block_time,
    logs.block_number,
    logs.topic1 as reward_pool_index, -- First indexed parameter  
    logs.topic2 as user_address,      -- Second indexed parameter (user)
    bytearray_to_uint256(logs.data) as amount_withdrawn -- Non-indexed parameter (amount)
  FROM sepolia.logs logs
  INNER JOIN pool_contracts p ON logs.contract_address = p.contract_address
  WHERE 
    logs.topic0 = 0xe2f02dc2168917563b46b1f788ea74861c381103710158efe9976c0bb3333677 -- UserWithdrawn event (second most frequent)
    AND logs.block_time >= CAST('2024-01-01' as TIMESTAMP)
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
