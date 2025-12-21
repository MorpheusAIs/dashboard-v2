"use client";

import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { SUBGRAPH_ENDPOINTS } from '@/app/config/subgraph-endpoints';

// Use the shared endpoint configuration
const NETWORK_ENDPOINTS = {
  Arbitrum: SUBGRAPH_ENDPOINTS.Arbitrum,
  // @deprecated - Arbitrum Sepolia is no longer used for Builders V4. Kept for backward compatibility.
  ArbitrumSepolia: SUBGRAPH_ENDPOINTS.ArbitrumSepolia,
  Base: SUBGRAPH_ENDPOINTS.Base,
  BaseSepolia: SUBGRAPH_ENDPOINTS.BaseSepolia,
  // Capital v2 subgraph endpoints
  CapitalV2Sepolia: SUBGRAPH_ENDPOINTS.CapitalV2Sepolia,
};

// Error handling link
const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path }) => {
      console.error(
        `[GraphQL error]: Message: ${message}, Location: ${JSON.stringify(locations)}, Path: ${path}`
      );
    });
  }
  if (networkError) {
    console.error(`[Network error]: ${networkError}`);
  }
});

// Create Apollo clients for each network
export const apolloClients = {
  Arbitrum: new ApolloClient({
    link: from([
      errorLink,
      new HttpLink({
        uri: NETWORK_ENDPOINTS.Arbitrum,
      }),
    ]),
    cache: new InMemoryCache(),
    queryDeduplication: false,
    defaultOptions: {
      query: {
        fetchPolicy: 'no-cache',
        errorPolicy: 'all',
      },
    },
  }),
  // @deprecated - Arbitrum Sepolia Apollo client. No longer used for Builders V4.
  ArbitrumSepolia: new ApolloClient({
    link: from([
      errorLink,
      new HttpLink({
        uri: NETWORK_ENDPOINTS.ArbitrumSepolia,
      }),
    ]),
    cache: new InMemoryCache(),
    queryDeduplication: false,
    defaultOptions: {
      query: {
        fetchPolicy: 'no-cache',
        errorPolicy: 'all',
      },
    },
  }),
  Base: new ApolloClient({
    link: from([
      errorLink,
      new HttpLink({
        uri: NETWORK_ENDPOINTS.Base,
      }),
    ]),
    cache: new InMemoryCache(),
    queryDeduplication: false,
    defaultOptions: {
      query: {
        fetchPolicy: 'no-cache',
        errorPolicy: 'all',
      },
    },
  }),
  BaseSepolia: new ApolloClient({
    link: from([
      errorLink,
      new HttpLink({
        uri: NETWORK_ENDPOINTS.BaseSepolia,
      }),
    ]),
    cache: new InMemoryCache(),
    queryDeduplication: false,
    defaultOptions: {
      query: {
        fetchPolicy: 'no-cache',
        errorPolicy: 'all',
      },
    },
  }),
  CapitalV2Sepolia: new ApolloClient({
    link: from([
      errorLink,
      new HttpLink({
        uri: NETWORK_ENDPOINTS.CapitalV2Sepolia,
      }),
    ]),
    cache: new InMemoryCache(),
    queryDeduplication: false,
    defaultOptions: {
      query: {
        fetchPolicy: 'no-cache',
        errorPolicy: 'all',
      },
    },
  }),
};

// Default client (can be changed based on the current network)
let defaultClient = apolloClients.Base;

// Function to set the default client
export const setDefaultClient = (network: keyof typeof apolloClients) => {
  console.log(`Setting default Apollo client to ${network}`);
  defaultClient = apolloClients[network];
  return defaultClient;
};

// Function to get the default client
export const getDefaultClient = () => {
  console.log('Getting default Apollo client');
  return defaultClient;
};

// Function to get a client for a specific network
export const getClientForNetwork = (network: keyof typeof apolloClients) => {
  // console.log(`Getting Apollo client for network: ${network}`);
  return apolloClients[network];
}; 