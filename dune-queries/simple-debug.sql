-- SIMPLE DEBUG: Start with basics
-- Run this first to see if contracts exist and have any activity

-- Check 1: Do these contracts exist on Ethereum mainnet?
SELECT 
  contract_address,
  COUNT(*) as total_logs,
  MIN(block_time) as first_activity,
  MAX(block_time) as latest_activity,
  COUNT(DISTINCT topic0) as unique_event_types
FROM ethereum.logs 
WHERE contract_address IN (
  0xFea33A23F97d785236F22693eDca564782ae98d0, -- stETH pool
  0x7f4f17be21219D7DA4C8E0d0B9be6a778354E5A5  -- LINK pool  
)
GROUP BY contract_address;

-- If above returns 0 rows, your contracts might be on:
-- 1. Sepolia testnet (try sepolia.logs if available)
-- 2. Arbitrum (try arbitrum.logs)
-- 3. Base (try base.logs)
-- 4. Or addresses might be wrong

-- Check 2: What events DO exist for these addresses?
-- SELECT 
--   contract_address,
--   topic0,
--   COUNT(*) as event_count
-- FROM ethereum.logs 
-- WHERE contract_address IN (
--   0xFea33A23F97d785236F22693eDca564782ae98d0,
--   0x7f4f17be21219D7DA4C8E0d0B9be6a778354E5A5
-- )
-- GROUP BY contract_address, topic0
-- ORDER BY event_count DESC;
