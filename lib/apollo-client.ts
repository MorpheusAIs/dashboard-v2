"use client";

import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
import { onError } from '@apollo/client/link/error';

// Define the network endpoints for different chains
const NETWORK_ENDPOINTS = {
  Ethereum: 'https://api.studio.thegraph.com/query/67225/morpheus-dashboard/version/latest',
  Arbitrum: 'https://api.studio.thegraph.com/query/73688/lumerin-node/version/latest',
  Sepolia: 'https://api.studio.thegraph.com/query/73688/morpheus-ethereum-sepolia/version/latest',
  ArbitrumSepolia: 'https://api.studio.thegraph.com/query/73688/lumerin-node-testnet/version/latest',
  Base: 'https://subgraph.satsuma-prod.com/8675f21b07ed/9iqb9f4qcmhosiruyg763--465704/morpheus-mainnet-base/api',
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
  Ethereum: new ApolloClient({
    link: from([
      errorLink,
      new HttpLink({
        uri: NETWORK_ENDPOINTS.Ethereum,
      }),
    ]),
    cache: new InMemoryCache({
      addTypename: false // This can help with some GraphQL issues
    }),
    queryDeduplication: false,
    defaultOptions: {
      query: {
        fetchPolicy: 'no-cache',
        errorPolicy: 'all',
      },
    },
  }),
  Arbitrum: new ApolloClient({
    link: from([
      errorLink,
      new HttpLink({
        uri: NETWORK_ENDPOINTS.Arbitrum,
      }),
    ]),
    cache: new InMemoryCache({
      addTypename: false
    }),
    queryDeduplication: false,
    defaultOptions: {
      query: {
        fetchPolicy: 'no-cache',
        errorPolicy: 'all',
      },
    },
  }),
  Sepolia: new ApolloClient({
    link: from([
      errorLink,
      new HttpLink({
        uri: NETWORK_ENDPOINTS.Sepolia,
      }),
    ]),
    cache: new InMemoryCache({
      addTypename: false
    }),
    queryDeduplication: false,
    defaultOptions: {
      query: {
        fetchPolicy: 'no-cache',
        errorPolicy: 'all',
      },
    },
  }),
  ArbitrumSepolia: new ApolloClient({
    link: from([
      errorLink,
      new HttpLink({
        uri: NETWORK_ENDPOINTS.ArbitrumSepolia,
      }),
    ]),
    cache: new InMemoryCache({
      addTypename: false
    }),
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
    cache: new InMemoryCache({
      addTypename: false
    }),
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
let defaultClient = apolloClients.Ethereum;

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
  console.log(`Getting Apollo client for network: ${network}`);
  return apolloClients[network];
}; 