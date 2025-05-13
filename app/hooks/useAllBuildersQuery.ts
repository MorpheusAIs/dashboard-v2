import { useQuery, QueryKey } from '@tanstack/react-query';
import { fetchBuildersAPI } from '@/app/services/buildersService';
import { useNetworkInfo } from './useNetworkInfo';
import { useSupabaseBuilders } from './useSupabaseBuilders';
import { Builder } from '@/app/builders/builders-data'; // For return type

export const useAllBuildersQuery = () => {
  const { isTestnet } = useNetworkInfo();
  const { supabaseBuilders, supabaseBuildersLoaded, error: supabaseError } = useSupabaseBuilders();

  const queryKey: QueryKey = ['builders', { isTestnet, supabaseBuildersLoaded }];

  // The query is enabled if:
  // 1. It's testnet (doesn't need supabase data pre-loaded for its core fetch)
  // 2. It's mainnet AND supabase builders have been loaded (or attempted to load)
  const isEnabled = isTestnet ? true : supabaseBuildersLoaded;

  return useQuery<Builder[], Error>({ 
    queryKey: queryKey,
    queryFn: async () => {
      if (!isTestnet && supabaseError) {
        // If Supabase had an error on mainnet, fetchBuildersAPI might still proceed if supabaseBuildersLoaded is true
        // but supabaseBuilders is empty. fetchBuildersAPI handles this by returning [].
        // If supabaseError itself should halt the query, we could throw here.
        // For now, logging and letting fetchBuildersAPI run its course based on its params.
        console.warn('Supabase error detected by useAllBuildersQuery on mainnet, fetch will proceed based on loaded data:', supabaseError);
      }
      return fetchBuildersAPI(isTestnet, supabaseBuilders, supabaseBuildersLoaded);
    },
    enabled: isEnabled,
    // Default staleTime/cacheTime will be used from QueryClientProvider setup.
    // Add specific options here if needed for this query.
    // Example: staleTime: 1000 * 60 * 1, // 1 minute for this specific query
  });
}; 