-- PRODUCTION VERSION: Active Stakers Count for Morpheus Capital Dashboard
-- This is the final version to integrate into your useCapitalMetrics hook

WITH pool_contracts AS (
  SELECT 
    0xFea33A23F97d785236F22693eDca564782ae98d0 as contract_address,
    'stETH' as pool_type
  UNION ALL
  SELECT 
    0x7f4f17be21219D7DA4C8E0d0B9be6a778354E5A5 as contract_address,
    'LINK' as pool_type
),

-- Get all users from first event type (61 events)
first_event_users AS (
  SELECT DISTINCT 
    p.pool_type,
    logs.topic2 as user_address
  FROM sepolia.logs logs
  INNER JOIN pool_contracts p ON logs.contract_address = p.contract_address
  WHERE logs.topic0 = 0x04575f52b6b30177fc1f54050c9bdd9be3a3e76421fe02757adf437a09763ae0
),

-- Get all users from second event type (58 events)  
second_event_users AS (
  SELECT DISTINCT 
    p.pool_type,
    logs.topic2 as user_address
  FROM sepolia.logs logs
  INNER JOIN pool_contracts p ON logs.contract_address = p.contract_address
  WHERE logs.topic0 = 0xe2f02dc2168917563b46b1f788ea74861c381103710158efe9976c0bb3333677
),

-- Combine all active users
all_active_users AS (
  SELECT user_address, pool_type FROM first_event_users
  UNION
  SELECT user_address, pool_type FROM second_event_users
)

-- Final count for your dashboard
SELECT COUNT(DISTINCT user_address) as active_stakers
FROM all_active_users;
