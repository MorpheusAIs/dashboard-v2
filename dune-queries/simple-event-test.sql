-- Simple test to understand your event structure
-- Run this first to see what we're dealing with

-- Test the most frequent event signature
SELECT 
  'Most Frequent Event' as event_type,
  topic0,
  COUNT(*) as event_count,
  -- Check data field structure  
  MIN(LENGTH(data)) as min_data_length,
  MAX(LENGTH(data)) as max_data_length,
  MODE(LENGTH(data)) as typical_data_length,
  -- Sample data to examine
  ARRAY_AGG(data) as sample_data_values
FROM sepolia.logs 
WHERE topic0 = 0x04575f52b6b30177fc1f54050c9bdd9be3a3e76421fe02757adf437a09763ae0
  AND contract_address IN (
    0xFea33A23F97d785236F22693eDca564782ae98d0,
    0x7f4f17be21219D7DA4C8E0d0B9be6a778354E5A5
  )

UNION ALL

-- Test the second most frequent event signature  
SELECT 
  'Second Most Frequent Event' as event_type,
  topic0,
  COUNT(*) as event_count,
  MIN(LENGTH(data)) as min_data_length,
  MAX(LENGTH(data)) as max_data_length,
  MODE(LENGTH(data)) as typical_data_length,
  ARRAY_AGG(data) as sample_data_values
FROM sepolia.logs 
WHERE topic0 = 0xe2f02dc2168917563b46b1f788ea74861c381103710158efe9976c0bb3333677
  AND contract_address IN (
    0xFea33A23F97d785236F22693eDca564782ae98d0,
    0x7f4f17be21219D7DA4C8E0d0B9be6a778354E5A5
  );

-- Expected results:
-- typical_data_length = 66 (0x + 64 hex chars = 32 bytes) → 1 uint256 parameter
-- typical_data_length = 130 (0x + 128 hex chars = 64 bytes) → 2 parameters  
-- typical_data_length = 194 (0x + 192 hex chars = 96 bytes) → 3 parameters
