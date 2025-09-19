import { useQuery } from '@tanstack/react-query';
// import { useEffect } from 'react';


/**
 * Hook to fetch builder data from Morlord API via our proxy API route
 */
export const useMorlordBuilders = () => {
  // console.log('[useMorlordBuilders] Hook initialized');
  
  const query = useQuery<string[]>({
    queryKey: ['morlordBuilders'],
    queryFn: async () => {
      // console.log('[useMorlordBuilders] Query function executing');
      try {
        // Use our API route instead of calling the external API directly
        // This helps avoid CORS issues
        // console.log('[useMorlordBuilders] Fetching data from /api/builders');
        const response = await fetch('/api/builders');
        
        if (!response.ok) {
          // console.error(`[useMorlordBuilders] API responded with status: ${response.status} ${response.statusText}`);
          throw new Error('Failed to fetch builders from API route');
        }
        
        const builderNames: string[] = await response.json();
        
        // console.log(`[useMorlordBuilders] Fetched ${builderNames.length} builder names:`, builderNames);
        return builderNames;
      } catch (error) {
        console.error('[useMorlordBuilders] Error fetching builders:', error);
        // Return an empty array to avoid breaking the app
        console.log('[useMorlordBuilders] Returning empty array due to error');
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 3 // Retry 3 times if the request fails
  });

  // Use useEffect for the callbacks instead
  // useEffect(() => {
  //   if (query.data) {
  //     console.log(`[useMorlordBuilders] Query successful with ${query.data.length} names`);
  //   }
  // }, [query.data]);

  // useEffect(() => {
  //   if (query.error) {
  //     console.error('[useMorlordBuilders] Query failed:', query.error);
  //   }
  // }, [query.error]);

  return query;
}; 