# GraphQL Integration Knowledge

## Overview
GraphQL is used to fetch data from multiple subgraphs across different networks.

## Endpoints
- Arbitrum: https://api.studio.thegraph.com/query/73688/lumerin-node/version/latest
- Base: https://subgraph.satsuma-prod.com/8675f21b07ed/9iqb9f4qcmhosiruyg763--465704/morpheus-mainnet-base/api
- Arbitrum Sepolia: https://subgraph.satsuma-prod.com/8675f21b07ed/9iqb9f4qcmhosiruyg763--465704/morpheus-arbitrum-sepolia/api

## Query Organization
- Builders queries in builders.ts
- Compute queries in compute.ts
- Metrics queries in metrics.ts

## Best Practices
- Use fragments for shared fields
- Include __typename in queries
- Handle pagination with skip/first parameters
- Add proper error handling
- Use proper TypeScript types from types/graphql.ts

## Rate Limiting
- Implement debouncing for frequent queries
- Cache responses when possible
- Use batch queries when fetching multiple items

## Error Handling
- Always check for null data
- Provide fallback data for development
- Log errors with proper context
- Handle network-specific errors separately

## Query Patterns
```graphql
# Example pattern for entity queries
query getEntity($id: ID!) {
  entity(id: $id) {
    ...EntityFragment
  }
}

# Example pattern for list queries
query getEntities($first: Int!, $skip: Int!) {
  entities(
    first: $first
    skip: $skip
    orderBy: createdAt
    orderDirection: desc
  ) {
    ...EntityFragment
  }
}
```