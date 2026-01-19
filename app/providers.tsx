"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Web3Providers } from "@/components/web3-providers";
import { BuildersProvider } from '@/context/builders-context';
import { AuthProvider } from '@/context/auth-context';
import { ComputeProvider } from '@/context/compute-context';
import { Toaster } from "@/components/ui/sonner";
import { type State } from 'wagmi'; // Import the State type
import { STALE_TIMES } from '@/lib/constants/refetch-intervals';
// RootLayoutContent is not used here, it's used in app/layout.tsx
// import { RootLayoutContent } from "@/components/root-layout";

// Dynamically import ReactQueryDevtools to exclude from production bundle (~80KB)
const ReactQueryDevtools = dynamic(
  () => import('@tanstack/react-query-devtools').then(mod => mod.ReactQueryDevtools),
  { ssr: false }
); 

// Create a new QueryClient instance here, within the client component module.
// This ensures it's created once per client session.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIMES.LONG,
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
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
} 