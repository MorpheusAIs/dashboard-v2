-- FAST VERSION: Active Stakers Count (Optimized for Speed)
-- Simplified query to reduce execution time from 10-20 seconds

-- Just count unique users from the most recent events (last 30 days)
-- This should be much faster than scanning all historical data

SELECT COUNT(DISTINCT logs.topic2) as total_active_stakers
FROM sepolia.logs logs
WHERE logs.contract_address IN (
  0xFea33A23F97d785236F22693eDca564782ae98d0, -- stETH pool
  0x7f4f17be21219D7DA4C8E0d0B9be6a778354E5A5  -- LINK pool
)
AND logs.topic0 IN (
  0x04575f52b6b30177fc1f54050c9bdd9be3a3e76421fe02757adf437a09763ae0, -- First event type
  0xe2f02dc2168917563b46b1f788ea74861c381103710158efe9976c0bb3333677  -- Second event type
)
AND logs.block_time >= NOW() - INTERVAL '30 days'; -- Only recent activity for speed

-- This should execute in 1-2 seconds instead of 10-20 seconds
-- Trade-off: Shows recently active users, not all-time unique users
-- For a live dashboard, recent activity is often more relevant anyway
