import { useQuery, QueryKey } from '@tanstack/react-query';
import { fetchBuildersAPI } from '@/app/services/buildersService';
import { useNetworkInfo } from './useNetworkInfo';
import { useSupabaseBuilders } from './useSupabaseBuilders';
import { Builder } from '@/app/builders/builders-data'; // For return type
import { useAuth } from '@/context/auth-context'; // Added to get userAddress
import { useMorlordBuilders } from './useMorlordBuilders'; // Import the new hook
import { BuilderDB } from '@/app/lib/supabase';
import { useNewlyCreatedSubnets } from './useNewlyCreatedSubnets';
import { useMemo } from 'react';

/**
 * Validates if a string is a legitimate builder name and not an error/debug message
 * @param name - The name to validate
 * @returns true if the name appears to be a valid builder name
 */
const isValidBuilderName = (name: string): boolean => {
  if (!name || typeof name !== 'string') {
    return false;
  }
  
  // Trim whitespace
  const trimmed = name.trim();
  
  // Must be at least 2 characters long
  if (trimmed.length < 2) {
    return false;
  }
  
  // Must not be longer than 100 characters (reasonable max for builder names)
  if (trimmed.length > 100) {
    return false;
  }
  
  // Convert to lowercase for pattern matching
  const lower = trimmed.toLowerCase();
  
  // Filter out obvious error/debug strings
  const invalidPatterns = [
    'error', 'fail', 'exception', 'warning', 'debug', 'log', 'test',
    'undefined', 'null', 'none', 'empty', 'missing', 'invalid',
    'timeout', 'cancelled', 'aborted', 'rejected', 'denied',
    'cors', 'network', 'connection', 'fetch', 'xhr', 'http',
    'api', 'endpoint', 'response', 'request', 'status',
    'sync', 'async', 'promise', 'callback', 'function',
    'object', 'array', 'string', 'number', 'boolean',
    'temp', 'tmp', 'placeholder', 'sample', 'example',
    'lorem', 'ipsum', 'dolor', 'amet'
  ];
  
  // Check if the name contains any invalid patterns
  const containsInvalidPattern = invalidPatterns.some(pattern => 
    lower.includes(pattern)
  );
  
  if (containsInvalidPattern) {
    console.warn(`[useAllBuildersQuery] Filtered out invalid builder name: "${name}" (contains invalid pattern)`);
    return false;
  }
  
  // Filter out names that are mostly special characters or numbers
  const alphaCharCount = (trimmed.match(/[a-zA-Z]/g) || []).length;
  const minAlphaChars = Math.max(2, trimmed.length * 0.5); // At least 50% alphabetic chars
  
  if (alphaCharCount < minAlphaChars) {
    console.warn(`[useAllBuildersQuery] Filtered out invalid builder name: "${name}" (insufficient alphabetic characters)`);
    return false;
  }
  
  // Filter out names that look like file paths or URLs
  if (lower.includes('/') || lower.includes('\\') || lower.includes('http') || lower.includes('www.')) {
    console.warn(`[useAllBuildersQuery] Filtered out invalid builder name: "${name}" (looks like URL or file path)`);
    return false;
  }
  
  // Filter out names that look like JSON or code
  if (lower.includes('{') || lower.includes('}') || lower.includes('[') || lower.includes(']') || 
      lower.includes('=') || lower.includes('&&') || lower.includes('||')) {
    console.warn(`[useAllBuildersQuery] Filtered out invalid builder name: "${name}" (looks like code/JSON)`);
    return false;
  }
  
  console.log(`[useAllBuildersQuery] Validated builder name: "${name}" ✓`);
  return true;
};

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

  // Create a hash of supabase builder names to detect changes
  const supabaseBuilderNamesHash = useMemo(() => {
    if (!supabaseBuilders?.length) return '';
    const names = supabaseBuilders.map(b => b.name).sort().join(',');
    return btoa(names); // Simple base64 encoding as hash
  }, [supabaseBuilders]);

  console.log(`[useAllBuildersQuery] Dependencies: 
    isTestnet: ${isTestnet}
    supabaseBuildersLoaded: ${supabaseBuildersLoaded}
    isLoadingMorlordBuilders: ${isLoadingMorlordBuilders}
    morlordBuilderNames length: ${morlordNamesLength}
    supabaseBuilders length: ${supabaseBuildersLength}
    newlyCreatedNames length: ${newlyCreatedNamesLength}
    supabaseBuilderNamesHash: ${supabaseBuilderNamesHash.substring(0, 8)}...
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
      newlyCreatedSubnets: newlyCreatedNames.join(','), // Include newly created subnets in key
      supabaseBuilderNamesHash, // Include hash of supabase builder names
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
      
      // Collect ALL available builder names for GraphQL query
      let allAvailableBuilderNames: string[] = [];
      
      if (!isTestnet && Array.isArray(morlordBuilderNames) && morlordBuilderNames.length > 0) {
        const newlyCreatedNames = getNewlyCreatedSubnetNames();
        
        // Validate and filter all official names before using them
        const validMorlordNames = morlordBuilderNames.filter(isValidBuilderName);
        const validNewlyCreatedNames = newlyCreatedNames.filter(isValidBuilderName);
        
        if (validMorlordNames.length !== morlordBuilderNames.length) {
          console.warn(`[useAllBuildersQuery] Filtered out ${morlordBuilderNames.length - validMorlordNames.length} invalid Morlord builder names`);
        }
        
        if (validNewlyCreatedNames.length !== newlyCreatedNames.length) {
          console.warn(`[useAllBuildersQuery] Filtered out ${newlyCreatedNames.length - validNewlyCreatedNames.length} invalid newly created names`);
        }
        
        // Combine ALL sources of builder names for GraphQL query (only valid names)
        const supabaseNames = supabaseBuilders?.map(b => b.name) || [];
        const allOfficialNames = [...validMorlordNames, ...validNewlyCreatedNames];
        
        // Create comprehensive list for GraphQL query (no duplicates)
        allAvailableBuilderNames = Array.from(new Set([
          ...supabaseNames,
          ...allOfficialNames
        ]));
        
        console.log(`[useAllBuildersQuery] Collected all available names for GraphQL query:`, {
          supabaseNames: supabaseNames.length,
          validMorlordNames: validMorlordNames.length,
          validNewlyCreatedNames: validNewlyCreatedNames.length,
          totalUnique: allAvailableBuilderNames.length,
          allNames: allAvailableBuilderNames
        });
        
        // Combine morlord names with newly created names (using validated names)
        const allOfficialNamesForCombining = [...validMorlordNames, ...validNewlyCreatedNames];
        
        // console.log(`[useAllBuildersQuery] Analyzing ${supabaseBuildersLength} Supabase builders with ${morlordBuilderNames.length} Morlord builder names and ${newlyCreatedNames.length} newly created names`);
        
        // Clean up any newly created names that now appear in morlord data (use validated names)
        if (validNewlyCreatedNames.length > 0) {
          cleanupExistingSubnets(validMorlordNames);
        }
        
        // Log the names from Supabase
        // console.log(`[useAllBuildersQuery] Supabase builder names:`, supabaseNames);
        
        // Identify which builders are in the official list but not in Supabase (using validated names)
        const officialOnlyNames = allOfficialNamesForCombining.filter(name => 
          !supabaseNames.some(supabaseName => supabaseName.toLowerCase() === name.toLowerCase())
        );
        
        if (officialOnlyNames.length > 0) {
          console.log(`[useAllBuildersQuery] Found ${officialOnlyNames.length} valid builders in official list that are NOT in Supabase:`, officialOnlyNames);
          
          // Create basic builder objects for these missing builders and add them to the combined list
          const currentDate = new Date().toISOString();
          const officialOnlyBuilders = officialOnlyNames.map((name: string) => {
            // Create a minimal BuilderDB object for each missing builder (names are already validated)
            const tempId = `morlord-${name.replace(/\s+/g, '-').toLowerCase()}`;
            console.log(`[useAllBuildersQuery] Creating temporary builder for validated name "${name}" with ID: ${tempId}`);
            
            const builder: BuilderDB = {
              id: tempId, // Generate a temporary ID
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
          console.log(`[useAllBuildersQuery] Added ${officialOnlyBuilders.length} temporary builders from validated official API names that weren't in Supabase`);
        } else {
          console.log('[useAllBuildersQuery] All valid official builders are also in Supabase');
        }
      } else {
        console.log('[useAllBuildersQuery] Not enough data to analyze builders (either official data or Supabase data missing)');
        // For testnet or when no morlord data, just use supabase names
        allAvailableBuilderNames = supabaseBuilders?.map(b => b.name) || [];
      }
      
      // Pass the COMBINED list of builders and ALL available names to fetchBuildersAPI
      console.log(`[useAllBuildersQuery] Calling fetchBuildersAPI with ${combinedBuilders.length} combined builders and ${allAvailableBuilderNames.length} names for GraphQL query`);
      
      const result = await fetchBuildersAPI(
        isTestnet, 
        combinedBuilders, 
        supabaseBuildersLoaded, 
        isAuthenticated ? userAddress : "",
        getNewlyCreatedSubnetAdmin, // Pass the function to get admin addresses for newly created subnets
        allAvailableBuilderNames // Pass all available names for GraphQL query
      );
      
      console.log(`[useAllBuildersQuery] fetchBuildersAPI returned ${result.length} builders`);
      return result;
    },
    enabled: isEnabled,
  });
}; 