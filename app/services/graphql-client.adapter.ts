import { useNetwork } from '@/context/network-context';
import { useNetworkInfo } from '@/app/hooks/useNetworkInfo';
import { useLocalContractData } from './local-data.service';
import { 
  CombinedBuilderSubnetsResponse,
  BuilderSubnet,
  BuilderProject 
} from '@/lib/types/graphql';

/**
 * GraphQL Client Adapter that automatically switches between:
 * - Remote GraphQL API for mainnet/testnet 
 * - Local contract reading for local_test environment
 */
export function useGraphQLClientAdapter() {
  const { environment } = useNetwork();
  const { chainId } = useNetworkInfo();
  
  // Local contract data for local_test
  const localData = useLocalContractData(environment, chainId);
  
  // Determine which data source to use
  const isUsingLocalData = environment === 'local_test';

  /**
   * Get combined builder subnets data
   * For local_test: reads from contracts
   * For mainnet/testnet: should use existing GraphQL queries
   */
  const getCombinedBuilderSubnets = (): CombinedBuilderSubnetsResponse | null => {
    if (isUsingLocalData) {
      return localData.getCombinedBuilderSubnets();
    }
    
    // For remote data, the calling component should use its existing GraphQL hooks
    // This adapter just provides the interface
    return null;
  };

  /**
   * Get all builder subnets
   */
  const getBuilderSubnets = (): BuilderSubnet[] => {
    if (isUsingLocalData) {
      return localData.subnets;
    }
    
    return [];
  };

  /**
   * Get all builder projects (mainnet-style pools)
   */
  const getBuilderProjects = (): BuilderProject[] => {
    if (isUsingLocalData) {
      return localData.pools;
    }
    
    return [];
  };

  /**
   * Get subnet by ID
   */
  const getSubnetById = (id: string): BuilderSubnet | null => {
    if (isUsingLocalData) {
      return localData.subnets.find(subnet => subnet.id === id) || null;
    }
    
    return null;
  };

  /**
   * Get project by ID
   */
  const getProjectById = (id: string): BuilderProject | null => {
    if (isUsingLocalData) {
      return localData.pools.find(pool => pool.id === id) || null;
    }
    
    return null;
  };

  /**
   * Check if we have data available
   */
  const hasData = (): boolean => {
    if (isUsingLocalData) {
      return localData.subnets.length > 0 || localData.pools.length > 0;
    }
    
    return false; // For remote data, this should be handled by the calling component
  };

  /**
   * Refresh data
   */
  const refresh = async (): Promise<void> => {
    if (isUsingLocalData) {
      await localData.refresh();
    }
    
    // For remote data, the calling component should handle refresh
  };

  return {
    // Data source info
    isUsingLocalData,
    dataSource: isUsingLocalData ? 'local_contracts' : 'graphql_api',
    
    // Data access methods
    getCombinedBuilderSubnets,
    getBuilderSubnets,
    getBuilderProjects,
    getSubnetById,
    getProjectById,
    hasData,
    
    // State
    loading: isUsingLocalData ? localData.loading : false,
    error: isUsingLocalData ? localData.error : null,
    
    // Actions
    refresh,
    
    // Debug info
    debug: {
      environment,
      chainId,
      isLocalTest: localData.isLocalTest,
      localRawData: isUsingLocalData ? localData.raw : null,
    }
  };
}

/**
 * Higher-order component that wraps GraphQL queries to automatically 
 * use local data when in local_test environment
 */
export function withLocalDataFallback<T>(
  useGraphQLQuery: () => T,
  localDataSelector: (adapter: ReturnType<typeof useGraphQLClientAdapter>) => T | null
) {
  return function useAdaptedQuery(): T | null {
    const adapter = useGraphQLClientAdapter();
    const graphqlResult = useGraphQLQuery();
    
    if (adapter.isUsingLocalData) {
      return localDataSelector(adapter);
    }
    
    return graphqlResult;
  };
}