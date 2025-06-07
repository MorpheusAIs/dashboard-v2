import { useQuery, QueryKey } from '@tanstack/react-query';
import { fetchBuildersAPI } from '@/app/services/buildersService';
import { useNetworkInfo } from './useNetworkInfo';
import { useSupabaseBuilders } from './useSupabaseBuilders';
import { Builder } from '@/app/builders/builders-data'; // For return type
import { useAuth } from '@/context/auth-context'; // Added to get userAddress
import { useMorlordBuilders } from './useMorlordBuilders'; // Import the new hook
import { BuilderDB } from '@/app/lib/supabase';
import { useNewlyCreatedSubnets } from './useNewlyCreatedSubnets';

export const useAllBuildersQuery = () => {
  console.log('[useAllBuildersQuery] Hook initialized');
  
  const { isTestnet } = useNetworkInfo();
  const { supabaseBuilders, supabaseBuildersLoaded, error: supabaseError } = useSupabaseBuilders();
  const { userAddress, isAuthenticated } = useAuth(); // Get userAddress and isAuthenticated
  const { data: morlordBuilderNames, isLoading: isLoadingMorlordBuilders } = useMorlordBuilders(); // Add the Morlord hook
  const { getNewlyCreatedSubnetNames, cleanupExistingSubnets, getNewlyCreatedSubnetAdmin } = useNewlyCreatedSubnets(); // Add the newly created subnets hook

  // Safe access to lengths for logging
  const morlordNamesLength = Array.isArray(morlordBuilderNames) ? morlordBuilderNames.length : 0;
  const supabaseBuildersLength = Array.isArray(supabaseBuilders) ? supabaseBuilders.length : 0;
  const newlyCreatedNamesLength = getNewlyCreatedSubnetNames().length;

  console.log(`[useAllBuildersQuery] Dependencies: 
    isTestnet: ${isTestnet}
    supabaseBuildersLoaded: ${supabaseBuildersLoaded}
    isLoadingMorlordBuilders: ${isLoadingMorlordBuilders}
    morlordBuilderNames length: ${morlordNamesLength}
    supabaseBuilders length: ${supabaseBuildersLength}
    newlyCreatedNames length: ${newlyCreatedNamesLength}
  `);

  // Include userAddress, morlordBuilderNames, and newly created subnets in the queryKey for refetching
  const newlyCreatedNames = getNewlyCreatedSubnetNames();
  const queryKey: QueryKey = [
    'builders', 
    { 
      isTestnet, 
      supabaseBuildersLoaded, 
      userAddress: isAuthenticated ? userAddress : null,
      morlordBuilderNamesLoaded: !isLoadingMorlordBuilders && !!morlordBuilderNames,
      newlyCreatedSubnets: newlyCreatedNames.join(',') // Include newly created subnets in key
    }
  ];

  // The query is enabled if:
  // 1. It's testnet (doesn't need supabase data pre-loaded for its core fetch)
  // 2. It's mainnet AND supabase builders have been loaded AND Morlord builder names have been loaded
  const isEnabled = isTestnet ? true : (supabaseBuildersLoaded && !isLoadingMorlordBuilders);
  
  console.log(`[useAllBuildersQuery] Query enabled: ${isEnabled}`);

  return useQuery<Builder[], Error>({ 
    queryKey: queryKey,
    queryFn: async () => {
      // console.log('[useAllBuildersQuery] Query function executing with key:', JSON.stringify(queryKey));
      // console.log('[useAllBuildersQuery] Current newly created subnets:', newlyCreatedNames);
      
      if (!isTestnet && supabaseError) {
        console.warn('[useAllBuildersQuery] Supabase error detected on mainnet:', supabaseError);
      }

      // Start with supabase builders
      let combinedBuilders = supabaseBuilders ? [...supabaseBuilders] : [];
      
      if (!isTestnet && Array.isArray(morlordBuilderNames) && morlordBuilderNames.length > 0) {
        const newlyCreatedNames = getNewlyCreatedSubnetNames();
        
        // Combine morlord names with newly created names
        const allOfficialNames = [...morlordBuilderNames, ...newlyCreatedNames];
        
        // console.log(`[useAllBuildersQuery] Analyzing ${supabaseBuildersLength} Supabase builders with ${morlordBuilderNames.length} Morlord builder names and ${newlyCreatedNames.length} newly created names`);
        
        // Clean up any newly created names that now appear in morlord data
        if (newlyCreatedNames.length > 0) {
          cleanupExistingSubnets(morlordBuilderNames);
        }
        
        // Log the names from Supabase
        const supabaseNames = supabaseBuilders?.map(b => b.name) || [];
        // console.log(`[useAllBuildersQuery] Supabase builder names:`, supabaseNames);
        
        // Identify which builders are in Supabase but not in the combined official list (Morlord + newly created)
        // const supabaseOnlyBuilders = supabaseBuilders?.filter(builder => 
        //   !allOfficialNames.includes(builder.name)
        // ) || [];
        
        // if (supabaseOnlyBuilders.length > 0) {
        //   const supabaseOnlyNames = supabaseOnlyBuilders.map(b => b.name);
        //   console.log(`[useAllBuildersQuery] Found ${supabaseOnlyBuilders.length} builders in Supabase that are NOT in official list:`, supabaseOnlyNames);
        // } else {
        //   console.log('[useAllBuildersQuery] All Supabase builders are also in the official list');
        // }
        
        // Identify which builders are in the official list but not in Supabase
        const officialOnlyNames = allOfficialNames.filter(name => 
          !supabaseNames.includes(name)
        );
        
        if (officialOnlyNames.length > 0) {
          // console.log(`[useAllBuildersQuery] Found ${officialOnlyNames.length} builders in official list that are NOT in Supabase:`, officialOnlyNames);
          
          // Create basic builder objects for these missing builders and add them to the combined list
          const currentDate = new Date().toISOString();
          const officialOnlyBuilders = officialOnlyNames.map((name: string) => {
            // Create a minimal BuilderDB object for each missing builder
            const builder: BuilderDB = {
              id: `morlord-${name.replace(/\s+/g, '-').toLowerCase()}`, // Generate a temporary ID
              name: name,
              description: ``,
              long_description: '',
              website: '',
              image_src: '',
              tags: [],
              github_url: '',
              twitter_url: '',
              discord_url: '',
              contributors: 0,
              github_stars: 0,
              reward_types: ['TBA'],
              reward_types_detail: [],
              created_at: currentDate,
              updated_at: currentDate,
              networks: [],
            };
            return builder;
          });
          
          // Add these to the combined list
          combinedBuilders = [...combinedBuilders, ...officialOnlyBuilders];
          // console.log(`[useAllBuildersQuery] Added ${officialOnlyBuilders.length} builders from official API that weren't in Supabase`);
        } else {
          console.log('[useAllBuildersQuery] All official builders are also in Supabase');
        }
      } else {
        console.log('[useAllBuildersQuery] Not enough data to analyze builders (either official data or Supabase data missing)');
      }
      
      // Pass the COMBINED list of builders to fetchBuildersAPI
      // console.log(`[useAllBuildersQuery] Calling fetchBuildersAPI with ${combinedBuilders.length} COMBINED builders from both Supabase and Morlord`);
      
      const result = await fetchBuildersAPI(
        isTestnet, 
        combinedBuilders, 
        supabaseBuildersLoaded, 
        isAuthenticated ? userAddress : "",
        getNewlyCreatedSubnetAdmin // Pass the function to get admin addresses for newly created subnets
      );
      
      // console.log(`[useAllBuildersQuery] fetchBuildersAPI returned ${result.length} builders`);
      return result;
    },
    enabled: isEnabled,
  });
}; 