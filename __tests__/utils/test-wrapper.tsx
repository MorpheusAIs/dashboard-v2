/**
 * Test Wrapper Components
 * Reusable wrapper components for testing with all required providers.
 */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../mocks/react-query';

// ============================================================================
// BASIC WRAPPER (React Query Only)
// ============================================================================

interface BasicWrapperProps {
  children: React.ReactNode;
  queryClient?: QueryClient;
}

/**
 * Basic test wrapper with just React Query provider.
 * Use for testing hooks and components that only need React Query.
 */
export function BasicWrapper({
  children,
  queryClient,
}: BasicWrapperProps): React.ReactElement {
  const client = queryClient ?? createTestQueryClient();

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

// ============================================================================
// NETWORK CONTEXT WRAPPER
// ============================================================================

interface NetworkContextValue {
  environment: 'mainnet' | 'testnet';
  isMainnet: boolean;
  currentChainId: number;
  setEnvironment: (env: 'mainnet' | 'testnet') => void;
  supportedChains: number[];
}

const defaultNetworkContext: NetworkContextValue = {
  environment: 'mainnet',
  isMainnet: true,
  currentChainId: 42161, // Arbitrum One
  setEnvironment: () => {},
  supportedChains: [1, 42161, 8453],
};

const NetworkContext = React.createContext<NetworkContextValue>(defaultNetworkContext);

interface NetworkWrapperProps {
  children: React.ReactNode;
  networkContext?: Partial<NetworkContextValue>;
}

/**
 * Test wrapper with mock Network context.
 */
export function NetworkWrapper({
  children,
  networkContext = {},
}: NetworkWrapperProps): React.ReactElement {
  const value = { ...defaultNetworkContext, ...networkContext };
  return (
    <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
  );
}

// ============================================================================
// FULL WRAPPER (All Providers)
// ============================================================================

interface FullWrapperProps {
  children: React.ReactNode;
  queryClient?: QueryClient;
  networkContext?: Partial<NetworkContextValue>;
}

/**
 * Full test wrapper with all providers.
 * Use for testing components that need multiple contexts.
 */
export function FullWrapper({
  children,
  queryClient,
  networkContext = {},
}: FullWrapperProps): React.ReactElement {
  const client = queryClient ?? createTestQueryClient();
  const networkValue = { ...defaultNetworkContext, ...networkContext };

  return (
    <QueryClientProvider client={client}>
      <NetworkContext.Provider value={networkValue}>
        {children}
      </NetworkContext.Provider>
    </QueryClientProvider>
  );
}

// ============================================================================
// RENDER HELPERS
// ============================================================================

import { render, RenderOptions, RenderResult } from '@testing-library/react';

/**
 * Custom render function with all providers.
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & {
    queryClient?: QueryClient;
    networkContext?: Partial<NetworkContextValue>;
  }
): RenderResult {
  const { queryClient, networkContext, ...renderOptions } = options ?? {};

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <FullWrapper queryClient={queryClient} networkContext={networkContext}>
        {children}
      </FullWrapper>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

/**
 * Custom render function with just React Query.
 */
export function renderWithQueryClient(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & {
    queryClient?: QueryClient;
  }
): RenderResult {
  const { queryClient, ...renderOptions } = options ?? {};

  function Wrapper({ children }: { children: React.ReactNode }) {
    return <BasicWrapper queryClient={queryClient}>{children}</BasicWrapper>;
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// ============================================================================
// HOOK TESTING UTILITIES
// ============================================================================

import { renderHook, RenderHookOptions, RenderHookResult } from '@testing-library/react';

/**
 * Custom renderHook with React Query provider.
 */
export function renderHookWithQueryClient<TResult, TProps>(
  callback: (props: TProps) => TResult,
  options?: Omit<RenderHookOptions<TProps>, 'wrapper'> & {
    queryClient?: QueryClient;
  }
): RenderHookResult<TResult, TProps> {
  const { queryClient, ...renderOptions } = options ?? {};

  function Wrapper({ children }: { children: React.ReactNode }) {
    return <BasicWrapper queryClient={queryClient}>{children}</BasicWrapper>;
  }

  return renderHook(callback, { wrapper: Wrapper, ...renderOptions });
}

/**
 * Custom renderHook with all providers.
 */
export function renderHookWithProviders<TResult, TProps>(
  callback: (props: TProps) => TResult,
  options?: Omit<RenderHookOptions<TProps>, 'wrapper'> & {
    queryClient?: QueryClient;
    networkContext?: Partial<NetworkContextValue>;
  }
): RenderHookResult<TResult, TProps> {
  const { queryClient, networkContext, ...renderOptions } = options ?? {};

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <FullWrapper queryClient={queryClient} networkContext={networkContext}>
        {children}
      </FullWrapper>
    );
  }

  return renderHook(callback, { wrapper: Wrapper, ...renderOptions });
}
