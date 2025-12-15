import { useState, useEffect, useMemo } from 'react';
import { getDefaultClient } from '@/lib/apollo-client';
import { 
  COMBINED_BUILDERS_LIST, 
  COMBINED_BUILDERS_LIST_FILTERED_BY_PREDEFINED_BUILDERS 
} from '@/lib/graphql/builders-queries';
import { 
  BuilderProject, 
  BuildersCounter, 
  BuildersProject_OrderBy,
  BuildersUser_OrderBy,
  OrderDirection,
  CombinedBuildersListResponse,
  CombinedBuildersListFilteredByPredefinedBuildersResponse,
  BuilderUser
} from '@/lib/types/graphql';

const DEFAULT_BUILDERS_PAGE_LIMIT = 10;

interface BuildersData {
  buildersProjects: BuilderProject[];
  userAccountBuildersProjects: BuilderProject[];
  buildersCounters?: BuildersCounter;
  isLoading: boolean;
  error: Error | null;
}

interface UseBuilderDataProps {
  page?: number;
  orderBy?: BuildersProject_OrderBy;
  orderDirection?: OrderDirection;
  usersOrderBy?: BuildersUser_OrderBy;
  usersDirection?: OrderDirection;
  address?: string;
  nameFilter?: string[];
  isMainnet?: boolean;
}

export function useBuilderData({
  page = 1,
  orderBy = BuildersProject_OrderBy.TotalStaked,
  orderDirection = OrderDirection.Desc,
  usersOrderBy = BuildersUser_OrderBy.Staked,
  usersDirection = OrderDirection.Desc,
  address = '',
  nameFilter,
  isMainnet = true
}: UseBuilderDataProps = {}): BuildersData {
  const [data, setData] = useState<BuildersData>({
    buildersProjects: [],
    userAccountBuildersProjects: [],
    buildersCounters: undefined,
    isLoading: true,
    error: null
  });

  // Note: Ponder doesn't support skip-based pagination
  // Using limit only for now - cursor-based pagination can be added if needed

  useEffect(() => {
    const fetchData = async () => {
      try {
        setData(prev => ({ ...prev, isLoading: true, error: null }));
        
        const client = getDefaultClient();
        
        if (nameFilter && nameFilter.length > 0) {
          // Use filtered query if nameFilter is provided
          const { data: filteredData } = await client.query<CombinedBuildersListFilteredByPredefinedBuildersResponse>({
            query: COMBINED_BUILDERS_LIST_FILTERED_BY_PREDEFINED_BUILDERS,
            variables: {
              orderBy,
              orderDirection,
              usersOrderBy,
              usersDirection,
              address: address || undefined
            },
            fetchPolicy: 'network-only'
          });

          setData({
            buildersProjects: filteredData.buildersProjects.items,
            userAccountBuildersProjects: filteredData.buildersUsers.items.map((user: BuilderUser) => user.builderSubnet as unknown as BuilderProject),
            isLoading: false,
            error: null
          });
        } else {
          // Use regular query
          const { data: combinedData } = await client.query<CombinedBuildersListResponse>({
            query: COMBINED_BUILDERS_LIST,
            variables: {
              limit: DEFAULT_BUILDERS_PAGE_LIMIT,
              orderBy,
              orderDirection,
              usersOrderBy,
              usersDirection,
              address: address || undefined
            },
            fetchPolicy: 'network-only'
          });

          setData({
            buildersProjects: combinedData.buildersProjects.items,
            userAccountBuildersProjects: combinedData.buildersUsers.items.map((user: BuilderUser) => user.builderSubnet as unknown as BuilderProject),
            buildersCounters: combinedData.counters[0],
            isLoading: false,
            error: null
          });
        }
      } catch (error) {
        setData(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error : new Error('An unknown error occurred')
        }));
      }
    };

    fetchData();
  }, [
    page, 
    orderBy, 
    orderDirection, 
    usersOrderBy, 
    usersDirection, 
    address, 
    nameFilter, 
    isMainnet
  ]);

  return data;
} 