import { apolloClients } from '@/lib/apollo-client';
import { GET_BUILDERS_PROJECT } from '@/lib/graphql/builders-queries';
import { GetBuildersProjectResponse } from '@/lib/types/graphql';

// Networks supported by the application
export type SupportedNetwork = 'Arbitrum' | 'Base' | 'Arbitrum_Sepolia';

/**
 * Detects which network a builder belongs to by querying both networks' subgraphs
 * @param builderId The ID of the builder to check
 * @returns The network the builder belongs to, or null if not found
 */
export async function detectBuilderNetwork(builderId: string): Promise<SupportedNetwork | null> {
  // Try Arbitrum first
  try {
    const { data } = await apolloClients.Arbitrum.query<GetBuildersProjectResponse>({
      query: GET_BUILDERS_PROJECT,
      variables: { id: builderId },
      fetchPolicy: 'no-cache',
    });
    
    if (data?.buildersProject) {
      console.log(`Builder ${builderId} found on Arbitrum`);
      return 'Arbitrum';
    }
  } catch (error) {
    console.error(`Error querying Arbitrum for builder ${builderId}:`, error);
  }
  
  // Try Base next
  try {
    const { data } = await apolloClients.Base.query<GetBuildersProjectResponse>({
      query: GET_BUILDERS_PROJECT,
      variables: { id: builderId },
      fetchPolicy: 'no-cache',
    });
    
    if (data?.buildersProject) {
      console.log(`Builder ${builderId} found on Base`);
      return 'Base';
    }
  } catch (error) {
    console.error(`Error querying Base for builder ${builderId}:`, error);
  }
  
  // Try Arbitrum Sepolia
  try {
    const { data } = await apolloClients.ArbitrumSepolia.query<GetBuildersProjectResponse>({
      query: GET_BUILDERS_PROJECT,
      variables: { id: builderId },
      fetchPolicy: 'no-cache',
    });
    
    if (data?.buildersProject) {
      console.log(`Builder ${builderId} found on Arbitrum Sepolia`);
      return 'Arbitrum_Sepolia';
    }
  } catch (error) {
    console.error(`Error querying Arbitrum Sepolia for builder ${builderId}:`, error);
  }
  
  // If we get here, the builder wasn't found on any network
  console.warn(`Builder ${builderId} not found on any network`);
  return null;
}

/**
 * Batch detect networks for multiple builders
 * @param builderIds Array of builder IDs to check
 * @returns Map of builder IDs to their networks
 */
export async function batchDetectBuilderNetworks(builderIds: string[]): Promise<Map<string, SupportedNetwork>> {
  const networkMap = new Map<string, SupportedNetwork>();
  
  // Process in batches to avoid too many concurrent requests
  const batchSize = 5;
  for (let i = 0; i < builderIds.length; i += batchSize) {
    const batch = builderIds.slice(i, i + batchSize);
    const promises = batch.map(async (id) => {
      const network = await detectBuilderNetwork(id);
      if (network) {
        networkMap.set(id, network);
      }
    });
    
    await Promise.all(promises);
  }
  
  return networkMap;
}

/**
 * Cache for builder networks to avoid repeated API calls
 */
const builderNetworkCache = new Map<string, SupportedNetwork>();

/**
 * Gets the network for a builder, using cache if available
 * @param builderId The ID of the builder
 * @returns The network the builder belongs to, or null if not found
 */
export async function getBuilderNetwork(builderId: string): Promise<SupportedNetwork | null> {
  // Check cache first
  if (builderNetworkCache.has(builderId)) {
    return builderNetworkCache.get(builderId) || null;
  }
  
  // If not in cache, detect the network
  const network = await detectBuilderNetwork(builderId);
  
  // Cache the result if found
  if (network) {
    builderNetworkCache.set(builderId, network);
  }
  
  return network;
}

/**
 * Preloads network information for all builders in the predefined list
 * @param builderIds Array of builder IDs to preload
 */
export async function preloadBuilderNetworks(builderIds: string[]): Promise<void> {
  const networkMap = await batchDetectBuilderNetworks(builderIds);
  
  // Update the cache with the results
  networkMap.forEach((network, id) => {
    builderNetworkCache.set(id, network);
  });
  
  console.log(`Preloaded network information for ${networkMap.size} builders`);
} 