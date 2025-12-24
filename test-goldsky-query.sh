#!/bin/bash

echo "Testing Base Network Goldsky Query..."
echo "======================================"
curl -X POST \
  https://api.goldsky.com/api/public/project_cmgzm6igw009l5np264iw7obk/subgraphs/morpheus-mainnet-base-compatible/v0.0.1/gn \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { buildersProjects(first: 5, orderBy: totalStaked, orderDirection: desc) { id name admin totalStaked totalClaimed totalUsers minimalDeposit withdrawLockPeriodAfterDeposit startsAt claimLockEnd __typename } }"
  }' | jq '.'

echo ""
echo "Testing Arbitrum Network Goldsky Query..."
echo "=========================================="
curl -X POST \
  https://api.goldsky.com/api/public/project_cmgzm6igw009l5np264iw7obk/subgraphs/morpheus-mainnet-arbitrum-compatible/v0.0.1/gn \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { buildersProjects(first: 5, orderBy: totalStaked, orderDirection: desc) { id name admin totalStaked totalClaimed totalUsers minimalDeposit withdrawLockPeriodAfterDeposit startsAt claimLockEnd __typename } }"
  }' | jq '.'
