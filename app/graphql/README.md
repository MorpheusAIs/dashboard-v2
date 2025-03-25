# GraphQL API Module

This directory contains GraphQL queries, utility functions, and type definitions for interacting with various GraphQL APIs in the application.

## Directory Structure

- `/client.ts` - Contains the GraphQL client utility functions and endpoint configurations
- `/types.ts` - Contains TypeScript interfaces and types for GraphQL responses and UI components
- `/queries/` - Contains GraphQL query definitions split by module
  - `builders.ts` - Queries for Builders module
  - `compute.ts` - Queries for Compute module
- `/examples/` - Contains example GraphQL queries in JSON format for testing and documentation
  - `builders-examples.json` - Example queries for Builders module
  - `compute-examples.json` - Example queries for Compute module

## Usage

To use these GraphQL utilities in your components:

```typescript
import { GRAPHQL_ENDPOINTS, fetchGraphQL } from "@/app/graphql/client";
import { GET_BUILDERS_PROJECT_BY_NAME } from "@/app/graphql/queries/builders";
import { BuildersResponse } from "@/app/graphql/types";

// Get the correct endpoint for the network
const endpoint = GRAPHQL_ENDPOINTS.Base;

// Make the GraphQL request
const response = await fetchGraphQL<BuildersResponse>(
  endpoint,
  "getBuildersProjectsByName",
  GET_BUILDERS_PROJECT_BY_NAME,
  { name: "ExampleProject" }
);

// Access the data
const projects = response.data?.buildersProjects;
```

## Adding New Queries

To add a new GraphQL query:

1. Add the query string to the appropriate file in the `/queries` directory
2. Update or add relevant TypeScript interfaces in `/types.ts`
3. Add an example of the query to the appropriate file in the `/examples` directory

## Available Networks

The GraphQL endpoints are configured for the following networks:

- Base: `https://subgraph.satsuma-prod.com/8675f21b07ed/9iqb9f4qcmhosiruyg763--465704/morpheus-mainnet-base/api`
- Arbitrum: `https://api.studio.thegraph.com/query/73688/lumerin-node/version/latest` 