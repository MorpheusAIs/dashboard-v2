"use client";

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Web3Providers } from "@/components/web3-providers";
import { BuildersProvider } from '@/context/builders-context';
import { AuthProvider } from '@/context/auth-context';
import { ComputeProvider } from '@/context/compute-context';
import { Toaster } from "@/components/ui/sonner";
import { type State } from 'wagmi'; // Import the State type
// RootLayoutContent is not used here, it's used in app/layout.tsx
// import { RootLayoutContent } from "@/components/root-layout"; 

// Create a new QueryClient instance here, within the client component module.
// This ensures it's created once per client session.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

export function Providers({
  children,
  initialState // For Web3Providers
}: {
  children: React.ReactNode;
  initialState?: State | undefined; // Changed from any to State | undefined
}) {

  return (
    <QueryClientProvider client={queryClient}>
      <Web3Providers initialState={initialState}>
        <ComputeProvider>
          <BuildersProvider>
            <AuthProvider>
              {/*
                If RootLayoutContent itself has server-only dependencies or is complex,
                it might be better to keep it in layout.tsx and pass {children} directly.
                For now, let's assume it's primarily client-side UI structure.
                If issues persist, we might pass {children} directly to AuthProvider
                and keep RootLayoutContent in layout.tsx.
              */}
              {children}
              <Toaster />
            </AuthProvider>
          </BuildersProvider>
        </ComputeProvider>
      </Web3Providers>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
} 