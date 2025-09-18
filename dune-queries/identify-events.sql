-- Identify what events your contracts are actually emitting
-- This will help us map the correct event signatures to event names

SELECT 
  topic0,
  COUNT(*) as event_count,
  
  -- Try to identify common events by their signatures
  CASE 
    WHEN topic0 = 0x04575f52b6b30177fc1f54050c9bdd9be3a3e76421fe02757adf437a09763ae0 THEN 'Unknown Event 1 (Most frequent - 38 events)'
    WHEN topic0 = 0xe2f02dc2168917563b46b1f788ea74861c381103710158efe9976c0bb3333677 THEN 'Unknown Event 2 (37 events)'  
    WHEN topic0 = 0x183b75c4ecee34cfdcb8520dd19eb9399dd86946967052173b0dea7cd8e8c7b7 THEN 'Unknown Event 3 (10 events)'
    WHEN topic0 = 0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0 THEN 'OwnershipTransferred (Common ERC event)'
    ELSE 'Other Event'
  END as likely_event_name,
  
  -- Show first few occurrences with their data structure
  MIN(block_time) as first_occurrence,
  MAX(block_time) as latest_occurrence
  
FROM sepolia.logs 
WHERE contract_address IN (
  0xFea33A23F97d785236F22693eDca564782ae98d0, -- stETH
  0x7f4f17be21219D7DA4C8E0d0B9be6a778354E5A5  -- LINK  
)
GROUP BY topic0
ORDER BY event_count DESC;

-- SEPARATE QUERY: Let's also look at the actual data structure of the most frequent events
-- This will help us understand what parameters they have
-- (Run this as a second query after the first one)

/*
SELECT 
  'Most Frequent Event Analysis' as analysis,
  topic0,
  topic1,
  topic2, 
  topic3,
  LENGTH(data) as data_length,
  block_time,
  tx_hash
FROM sepolia.logs 
WHERE contract_address IN (
  0xFea33A23F97d785236F22693eDca564782ae98d0,
  0x7f4f17be21219D7DA4C8E0d0B9be6a778354E5A5
)
AND topic0 IN (
  0x04575f52b6b30177fc1f54050c9bdd9be3a3e76421fe02757adf437a09763ae0, -- Top event (38)
  0xe2f02dc2168917563b46b1f788ea74861c381103710158efe9976c0bb3333677  -- Second (37)
)
ORDER BY block_time DESC
LIMIT 10;
*/
