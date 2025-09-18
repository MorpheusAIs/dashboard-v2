-- STEP 1: Event Overview
-- This shows what events exist in your contracts and how frequent they are

SELECT 
  topic0,
  COUNT(*) as event_count,
  
  -- Try to identify common events by their signatures
  CASE 
    WHEN topic0 = 0x04575f52b6b30177fc1f54050c9bdd9be3a3e76421fe02757adf437a09763ae0 THEN 'Unknown Event 1 (Most frequent - likely deposit/stake)'
    WHEN topic0 = 0xe2f02dc2168917563b46b1f788ea74861c381103710158efe9976c0bb3333677 THEN 'Unknown Event 2 (Second most - likely withdrawal/claim)'  
    WHEN topic0 = 0x183b75c4ecee34cfdcb8520dd19eb9399dd86946967052173b0dea7cd8e8c7b7 THEN 'Unknown Event 3 (10 events)'
    WHEN topic0 = 0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0 THEN 'OwnershipTransferred (Common ERC event)'
    ELSE 'Other Event'
  END as likely_event_name,
  
  -- Show first and last occurrence 
  MIN(block_time) as first_occurrence,
  MAX(block_time) as latest_occurrence
  
FROM sepolia.logs 
WHERE contract_address IN (
  0xFea33A23F97d785236F22693eDca564782ae98d0, -- stETH
  0x7f4f17be21219D7DA4C8E0d0B9be6a778354E5A5  -- LINK  
)
GROUP BY topic0
ORDER BY event_count DESC;
