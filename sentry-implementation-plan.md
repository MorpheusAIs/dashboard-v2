# Sentry Implementation Plan for Builders Functionality

## Overview
This plan outlines the implementation of Sentry monitoring for the builders-related functionality in the dashboard, including API routes, hooks, contract interactions, and UI components.

## 1. API Routes Monitoring

### `/app/api/builders/route.ts`

#### GET Endpoint
- **Operation**: External API call to fetch builders data
- **Monitoring Points**:
  - API response time and success/failure
  - External service availability
  - Data parsing errors

```typescript
// Add to GET function
return Sentry.startSpan(
  {
    op: "http.server",
    name: "GET /api/builders",
  },
  async (span) => {
    try {
      span.setAttribute("api.endpoint", "builders");
      span.setAttribute("api.method", "GET");
      
      // External API call span
      const data = await Sentry.startSpan(
        {
          op: "http.client",
          name: "GET https://morlord.com/data/builders.json",
        },
        async (httpSpan) => {
          httpSpan.setAttribute("http.url", "https://morlord.com/data/builders.json");
          httpSpan.setAttribute("http.method", "GET");
          httpSpan.setAttribute("http.timeout", 5000);
          
          const response = await fetch('https://morlord.com/data/builders.json', {
            signal: AbortSignal.timeout(5000)
          });
          
          httpSpan.setAttribute("http.status_code", response.status);
          httpSpan.setAttribute("http.response.ok", response.ok);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
          }
          
          return await response.json();
        }
      );
      
      const builderNames = Object.values(data).map(builder => builder.name);
      span.setAttribute("builders.count", builderNames.length);
      
      return NextResponse.json(builderNames, { headers: corsHeaders });
      
    } catch (error) {
      Sentry.captureException(error);
      span.setStatus({ code: 2, message: error.message });
      return NextResponse.json([], { status: 500, headers: corsHeaders });
    }
  }
);
```

#### POST Endpoint
- **Operation**: Create new builder
- **Monitoring Points**:
  - Input validation errors
  - Database insertion success/failure
  - Data validation errors

```typescript
// Add to POST function
return Sentry.startSpan(
  {
    op: "http.server",
    name: "POST /api/builders",
  },
  async (span) => {
    try {
      const builderData = await request.json();
      
      span.setAttribute("builder.name", builderData.name);
      span.setAttribute("builder.networks", builderData.networks?.join(',') || '');
      
      // Validation span
      await Sentry.startSpan(
        {
          op: "validation",
          name: "Validate Builder Data",
        },
        async (validationSpan) => {
          if (!builderData.name || !builderData.networks || builderData.networks.length === 0) {
            validationSpan.setStatus({ code: 2, message: "Missing required fields" });
            throw new Error("Builder name and networks are required.");
          }
          validationSpan.setAttribute("validation.passed", true);
        }
      );
      
      // Database insertion span
      const data = await Sentry.startSpan(
        {
          op: "db.query",
          name: "Insert Builder",
        },
        async (dbSpan) => {
          dbSpan.setAttribute("db.operation", "insert");
          dbSpan.setAttribute("db.table", "builders");
          
          const { data, error } = await supabaseService
            .from('builders')
            .insert(dataToInsert)
            .select()
            .single();
            
          if (error) {
            dbSpan.setStatus({ code: 2, message: error.message });
            throw error;
          }
          
          dbSpan.setAttribute("db.rows_affected", 1);
          return data;
        }
      );
      
      span.setAttribute("operation.success", true);
      return NextResponse.json(data);
      
    } catch (error) {
      Sentry.captureException(error);
      span.setStatus({ code: 2, message: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
);
```

#### PATCH Endpoint
- **Operation**: Update existing builder
- **Monitoring Points**:
  - Update operation success/failure
  - Data validation
  - Database transaction monitoring

```typescript
// Add to PATCH function
return Sentry.startSpan(
  {
    op: "http.server",
    name: "PATCH /api/builders",
  },
  async (span) => {
    try {
      const requestData = await request.json();
      const { id, ...updateData } = requestData;
      
      span.setAttribute("builder.id", id);
      span.setAttribute("update.fields", Object.keys(updateData).join(','));
      
      if (!id) {
        throw new Error("Builder ID is required for updates.");
      }
      
      const data = await Sentry.startSpan(
        {
          op: "db.query",
          name: "Update Builder",
        },
        async (dbSpan) => {
          dbSpan.setAttribute("db.operation", "update");
          dbSpan.setAttribute("db.table", "builders");
          dbSpan.setAttribute("db.where", `id=${id}`);
          
          const { data, error } = await supabaseService
            .from('builders')
            .update(dataToUpdate)
            .eq('id', id)
            .select()
            .single();
            
          if (error) {
            dbSpan.setStatus({ code: 2, message: error.message });
            throw error;
          }
          
          return data;
        }
      );
      
      span.setAttribute("operation.success", true);
      return NextResponse.json(data);
      
    } catch (error) {
      Sentry.captureException(error);
      span.setStatus({ code: 2, message: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
);
```

## 2. Hooks Monitoring

### `/hooks/use-builders-data.ts`

#### GraphQL Query Operations
- **Operation**: Fetch builders data from GraphQL
- **Monitoring Points**:
  - Query performance
  - Network errors
  - Data parsing errors

```typescript
// Add to fetchData function
const fetchData = async () => {
  return Sentry.startSpan(
    {
      op: "graphql.query",
      name: "Fetch Builders Data",
    },
    async (span) => {
      try {
        setData(prev => ({ ...prev, isLoading: true, error: null }));
        
        span.setAttribute("graphql.operation.type", "query");
        span.setAttribute("graphql.operation.name", nameFilter ? "CombinedBuildersListFiltered" : "CombinedBuildersList");
        span.setAttribute("query.page", page);
        span.setAttribute("query.orderBy", orderBy);
        span.setAttribute("query.nameFilter", nameFilter?.join(',') || '');
        
        const client = getDefaultClient();
        
        if (nameFilter && nameFilter.length > 0) {
          const { data: filteredData } = await client.query({
            query: COMBINED_BUILDERS_LIST_FILTERED_BY_PREDEFINED_BUILDERS,
            variables: { /* variables */ },
            fetchPolicy: 'network-only'
          });
          
          span.setAttribute("response.buildersCount", filteredData.buildersProjects.length);
          span.setAttribute("response.userBuildersCount", filteredData.buildersUsers.length);
          
          setData({ /* data */ });
        } else {
          const { data: combinedData } = await client.query({
            query: COMBINED_BUILDERS_LIST,
            variables: { /* variables */ },
            fetchPolicy: 'network-only'
          });
          
          span.setAttribute("response.buildersCount", combinedData.buildersProjects.length);
          span.setAttribute("response.userBuildersCount", combinedData.buildersUsers.length);
          span.setAttribute("response.totalCount", combinedData.counters[0]?.total || 0);
          
          setData({ /* data */ });
        }
        
        span.setAttribute("operation.success", true);
        
      } catch (error) {
        Sentry.captureException(error);
        span.setStatus({ code: 2, message: error.message });
        setData(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error : new Error('An unknown error occurred')
        }));
      }
    }
  );
};
```

### `/app/hooks/useAllBuildersQuery.ts`

#### Complex Data Fetching Operations
- **Operation**: Fetch and merge builder data from multiple sources
- **Monitoring Points**:
  - Data fetching performance
  - Data merging operations
  - External API calls

```typescript
// Add to queryFn
queryFn: async () => {
  return Sentry.startSpan(
    {
      op: "data.fetch",
      name: "Fetch All Builders Query",
    },
    async (span) => {
      try {
        span.setAttribute("query.isTestnet", isTestnet);
        span.setAttribute("query.supabaseBuildersCount", supabaseBuildersLength);
        span.setAttribute("query.morlordBuildersCount", morlordNamesLength);
        span.setAttribute("query.newlyCreatedCount", newlyCreatedNamesLength);
        span.setAttribute("query.userAddress", isAuthenticated ? userAddress : null);
        
        if (!isTestnet && supabaseError) {
          Sentry.captureException(supabaseError);
          span.setAttribute("supabase.error", true);
        }
        
        // Data merging operations
        const result = await Sentry.startSpan(
          {
            op: "data.merge",
            name: "Merge Builder Data Sources",
          },
          async (mergeSpan) => {
            let combinedBuilders = supabaseBuilders ? [...supabaseBuilders] : [];
            
            if (!isTestnet && Array.isArray(morlordBuilderNames) && morlordBuilderNames.length > 0) {
              // Complex merging logic
              mergeSpan.setAttribute("merge.officialNames", morlordBuilderNames.length);
              mergeSpan.setAttribute("merge.newlyCreated", newlyCreatedNames.length);
              
              // Add missing builders logic
              const officialOnlyNames = /* logic */;
              if (officialOnlyNames.length > 0) {
                mergeSpan.setAttribute("merge.addedBuilders", officialOnlyNames.length);
              }
            }
            
            return await fetchBuildersAPI(/* params */);
          }
        );
        
        span.setAttribute("result.buildersCount", result.length);
        span.setAttribute("operation.success", true);
        
        return result;
        
      } catch (error) {
        Sentry.captureException(error);
        span.setStatus({ code: 2, message: error.message });
        throw error;
      }
    }
  );
}
```

### `/app/hooks/useUserStakedBuilders.ts`

#### User-Specific Data Operations
- **Operation**: Fetch user's staked builders
- **Monitoring Points**:
  - Multi-network queries
  - Data processing performance
  - User-specific errors

```typescript
// Add to queryFn
queryFn: async () => {
  return Sentry.startSpan(
    {
      op: "user.query",
      name: "Fetch User Staked Builders",
    },
    async (span) => {
      try {
        if (!userAddress) {
          span.setAttribute("user.authenticated", false);
          return [];
        }
        
        span.setAttribute("user.address", userAddress);
        span.setAttribute("query.isTestnet", isTestnet);
        
        if (isTestnet) {
          // Testnet logic
          span.setAttribute("data.source", "testnet_context");
          span.setAttribute("builders.available", builders?.length || 0);
          
          const userStakedBuilders = builders.filter(/* filter logic */);
          span.setAttribute("result.stakedBuilders", userStakedBuilders.length);
          
          return userStakedBuilders;
        }
        
        // Mainnet multi-network query
        const [baseResponse, arbitrumResponse] = await Promise.all([
          Sentry.startSpan(
            {
              op: "graphql.query",
              name: "Fetch Base Staked Builders",
            },
            async (baseSpan) => {
              baseSpan.setAttribute("network", "Base");
              baseSpan.setAttribute("query.address", userAddress);
              
              const response = await baseClient.query({
                query: GET_ACCOUNT_USER_BUILDERS_PROJECTS,
                variables: { address: userAddress },
                fetchPolicy: 'no-cache',
              });
              
              baseSpan.setAttribute("response.buildersCount", response.data?.buildersUsers?.length || 0);
              return response;
            }
          ),
          Sentry.startSpan(
            {
              op: "graphql.query", 
              name: "Fetch Arbitrum Staked Builders",
            },
            async (arbitrumSpan) => {
              arbitrumSpan.setAttribute("network", "Arbitrum");
              arbitrumSpan.setAttribute("query.address", userAddress);
              
              const response = await arbitrumClient.query({
                query: GET_ACCOUNT_USER_BUILDERS_PROJECTS,
                variables: { address: userAddress },
                fetchPolicy: 'no-cache',
              });
              
              arbitrumSpan.setAttribute("response.buildersCount", response.data?.buildersUsers?.length || 0);
              return response;
            }
          )
        ]);
        
        const baseBuilderUsers = baseResponse.data?.buildersUsers || [];
        const arbitrumBuilderUsers = arbitrumResponse.data?.buildersUsers || [];
        
        span.setAttribute("result.baseBuilders", baseBuilderUsers.length);
        span.setAttribute("result.arbitrumBuilders", arbitrumBuilderUsers.length);
        
        // Process and merge data
        const stakedBuilders = await Sentry.startSpan(
          {
            op: "data.process",
            name: "Process Staked Builders Data",
          },
          async (processSpan) => {
            const processed = [];
            
            // Processing logic for both networks
            processSpan.setAttribute("processing.totalUsers", baseBuilderUsers.length + arbitrumBuilderUsers.length);
            
            return processed;
          }
        );
        
        span.setAttribute("result.totalStakedBuilders", stakedBuilders.length);
        return stakedBuilders;
        
      } catch (error) {
        Sentry.captureException(error);
        span.setStatus({ code: 2, message: error.message });
        throw error;
      }
    }
  );
}
```

## 3. Contract Interactions Monitoring

### `/hooks/useStakingContractInteractions.ts`

#### Blockchain Operations
- **Operation**: Smart contract interactions
- **Monitoring Points**:
  - Transaction success/failure
  - Gas estimation errors
  - Network switching
  - Contract read/write operations

```typescript
// Add to contract write operations
const handleStake = useCallback((amount: string) => {
  return Sentry.startSpan(
    {
      op: "blockchain.transaction",
      name: "Stake Tokens",
    },
    async (span) => {
      try {
        span.setAttribute("contract.operation", "stake");
        span.setAttribute("contract.address", contractAddress);
        span.setAttribute("contract.network", getNetworkName(networkChainId));
        span.setAttribute("transaction.amount", amount);
        span.setAttribute("user.address", connectedAddress);
        
        if (!isCorrectNetwork()) {
          span.setAttribute("network.switchRequired", true);
          await switchToChain(networkChainId);
        }
        
        // Check approval first
        const approvalNeeded = await Sentry.startSpan(
          {
            op: "contract.read",
            name: "Check Token Approval",
          },
          async (approvalSpan) => {
            approvalSpan.setAttribute("token.address", tokenAddress);
            approvalSpan.setAttribute("spender.address", contractAddress);
            
            const currentAllowance = await getAllowance();
            const amountBigInt = parseEther(amount);
            const needsApproval = currentAllowance < amountBigInt;
            
            approvalSpan.setAttribute("allowance.current", formatEther(currentAllowance));
            approvalSpan.setAttribute("allowance.needed", needsApproval);
            
            return needsApproval;
          }
        );
        
        if (approvalNeeded) {
          await Sentry.startSpan(
            {
              op: "contract.write",
              name: "Approve Token Spending",
            },
            async (approvalSpan) => {
              approvalSpan.setAttribute("approval.amount", amount);
              await writeApprove({
                address: tokenAddress,
                abi: ERC20Abi,
                functionName: 'approve',
                args: [contractAddress, parseEther(amount)],
                chainId: networkChainId,
              });
            }
          );
        }
        
        // Execute staking
        await Sentry.startSpan(
          {
            op: "contract.write",
            name: "Execute Stake Transaction",
          },
          async (stakeSpan) => {
            stakeSpan.setAttribute("subnet.id", subnetId);
            stakeSpan.setAttribute("stake.amount", amount);
            
            await writeStake({
              address: contractAddress,
              abi: getAbi(),
              functionName: isTestnet ? 'deposit' : 'stake',
              args: isTestnet ? [subnetId, parseEther(amount)] : [subnetId, parseEther(amount)],
              chainId: networkChainId,
            });
          }
        );
        
        span.setAttribute("operation.success", true);
        
      } catch (error) {
        Sentry.captureException(error);
        span.setStatus({ code: 2, message: error.message });
        
        // Capture additional context for contract errors
        if (error.message.includes('revert')) {
          span.setAttribute("error.type", "contract_revert");
        } else if (error.message.includes('gas')) {
          span.setAttribute("error.type", "gas_error");
        } else if (error.message.includes('network')) {
          span.setAttribute("error.type", "network_error");
        }
        
        throw error;
      }
    }
  );
}, [/* dependencies */]);
```

#### Contract Read Operations
- **Operation**: Reading blockchain state
- **Monitoring Points**:
  - RPC call performance
  - Network connectivity
  - Data accuracy

```typescript
// Add to contract read effects
useEffect(() => {
  if (tokenAddressError || tokenSymbolError || balanceError || allowanceError) {
    Sentry.captureException(new Error('Contract read operation failed'), {
      extra: {
        tokenAddressError: tokenAddressError?.message,
        tokenSymbolError: tokenSymbolError?.message,
        balanceError: balanceError?.message,
        allowanceError: allowanceError?.message,
        networkChainId,
        contractAddress,
        tokenAddress,
        networkName: getNetworkName(networkChainId)
      },
      tags: {
        operation: 'contract_read',
        network: networkChainId === 8453 ? 'Base' : networkChainId === 42161 ? 'Arbitrum' : 'Unknown'
      }
    });
  }
}, [tokenAddressError, tokenSymbolError, balanceError, allowanceError, networkChainId]);
```

## 4. UI Component Monitoring

### `/app/builders/page.tsx`

#### User Interactions
- **Operation**: User interface interactions
- **Monitoring Points**:
  - Button clicks
  - Tab changes
  - Modal operations
  - Data filtering/sorting

```typescript
// Add to tab change handler
const handleTabChange = useCallback((newTab: string) => {
  Sentry.startSpan(
    {
      op: "ui.click",
      name: "Tab Change",
    },
    (span) => {
      span.setAttribute("tab.from", activeTab);
      span.setAttribute("tab.to", newTab);
      span.setAttribute("user.authenticated", isAuthenticated);
      
      setParam('tab', newTab);
      setActiveTab(newTab);
      
      // Track which tab is most popular
      span.setAttribute("navigation.pattern", `${activeTab}_to_${newTab}`);
    }
  );
}, [activeTab, setParam, isAuthenticated]);

// Add to stake modal handler
const handleOpenStakeModal = useCallback((builder: Builder) => {
  Sentry.startSpan(
    {
      op: "ui.click",
      name: "Open Stake Modal",
    },
    (span) => {
      span.setAttribute("builder.id", builder.id);
      span.setAttribute("builder.name", builder.name);
      span.setAttribute("builder.network", builder.network);
      span.setAttribute("builder.totalStaked", builder.totalStaked);
      span.setAttribute("user.address", userAddress || 'anonymous');
      
      setSelectedBuilder(builder);
      setStakeModalOpen(true);
    }
  );
}, [userAddress]);

// Add to bulk registration handler
const handleBulkRegistration = useCallback(() => {
  Sentry.startSpan(
    {
      op: "ui.click",
      name: "Open Bulk Registration Modal",
    },
    (span) => {
      span.setAttribute("user.isAdmin", isAdmin);
      span.setAttribute("action", "bulk_registration");
      
      setIsBulkModalOpen(true);
    }
  );
}, [isAdmin]);

// Add to filtering operations
const handleFilterChange = useCallback((filterType: string, value: string) => {
  Sentry.startSpan(
    {
      op: "ui.filter",
      name: "Apply Data Filter",
    },
    (span) => {
      span.setAttribute("filter.type", filterType);
      span.setAttribute("filter.value", value);
      span.setAttribute("builders.total", builders?.length || 0);
      span.setAttribute("builders.filtered", filteredBuilders?.length || 0);
      
      // Apply filter logic
      switch (filterType) {
        case 'name':
          setNameFilter(value);
          break;
        case 'network':
          setNetworkFilter(value);
          break;
        case 'rewardType':
          setRewardTypeFilter(value);
          break;
      }
    }
  );
}, [builders, filteredBuilders, setNameFilter, setNetworkFilter, setRewardTypeFilter]);
```

#### Data Loading and Error States
- **Operation**: Component lifecycle events
- **Monitoring Points**:
  - Initial load performance
  - Error boundary events
  - Data refresh operations

```typescript
// Add to data refresh handler
const handleDataRefresh = useCallback(() => {
  Sentry.startSpan(
    {
      op: "data.refresh",
      name: "Refresh Builders Data",
    },
    async (span) => {
      try {
        span.setAttribute("trigger", "manual_refresh");
        span.setAttribute("user.address", userAddress || 'anonymous');
        
        const startTime = Date.now();
        await refreshData();
        const endTime = Date.now();
        
        span.setAttribute("refresh.duration", endTime - startTime);
        span.setAttribute("refresh.success", true);
        
      } catch (error) {
        Sentry.captureException(error);
        span.setStatus({ code: 2, message: error.message });
        span.setAttribute("refresh.success", false);
      }
    }
  );
}, [refreshData, userAddress]);

// Add to new subnet detection
useEffect(() => {
  const newSubnetData = localStorage.getItem('new_subnet_created');
  if (newSubnetData) {
    try {
      const { name, timestamp } = JSON.parse(newSubnetData);
      
      Sentry.startSpan(
        {
          op: "data.sync",
          name: "Process New Subnet Creation",
        },
        (span) => {
          span.setAttribute("subnet.name", name);
          span.setAttribute("subnet.timestamp", timestamp);
          span.setAttribute("subnet.age", Date.now() - timestamp);
          
          if (Date.now() - timestamp < 5 * 60 * 1000) {
            span.setAttribute("subnet.processed", true);
            localStorage.removeItem('new_subnet_created');
            refreshData();
          } else {
            span.setAttribute("subnet.processed", false);
            span.setAttribute("subnet.reason", "stale_data");
            localStorage.removeItem('new_subnet_created');
          }
        }
      );
      
    } catch (e) {
      Sentry.captureException(e, {
        extra: { 
          newSubnetData,
          action: 'parsing_new_subnet_data'
        }
      });
      localStorage.removeItem('new_subnet_created');
    }
  }
}, [refreshData]);
```

## 5. Error Handling and Performance Monitoring

### Global Error Boundaries
- **Operation**: Catch unhandled errors
- **Monitoring Points**:
  - Component render errors
  - Async operation failures
  - Network timeouts

```typescript
// Add to error boundary or global error handler
const handleGlobalError = (error: Error, errorInfo?: any) => {
  Sentry.captureException(error, {
    extra: {
      errorInfo,
      component: 'BuildersPage',
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      buildersCount: builders?.length || 0,
      activeTab,
      isAuthenticated,
      userAddress,
      networkChainId,
    },
    tags: {
      section: 'builders',
      error_boundary: true,
    }
  });
};
```

### Performance Monitoring
- **Operation**: Track component performance
- **Monitoring Points**:
  - Initial render time
  - Data fetching duration
  - Filter/sort performance

```typescript
// Add to component mount
useEffect(() => {
  const startTime = performance.now();
  
  return () => {
    const endTime = performance.now();
    const renderTime = endTime - startTime;
    
    // Track performance metrics
    if (renderTime > 1000) { // Only track if render took more than 1 second
      Sentry.addBreadcrumb({
        category: 'performance',
        message: 'Builders page render time',
        level: 'info',
        data: {
          renderTime,
          buildersCount: builders?.length || 0,
          isLoading,
          activeTab,
        }
      });
    }
  };
}, []);
```

## 6. Implementation Priority

### High Priority (Critical Paths)
1. **Contract Interactions** - Staking, claiming, withdrawing operations
2. **API Routes** - External data fetching and database operations
3. **User Authentication** - Wallet connection and network switching

### Medium Priority (User Experience)
1. **Data Fetching Hooks** - Performance monitoring for GraphQL queries
2. **UI Interactions** - Button clicks and navigation patterns
3. **Error Boundaries** - Graceful error handling

### Low Priority (Analytics)
1. **Performance Metrics** - Component render times
2. **User Behavior** - Tab usage patterns
3. **Data Insights** - Filter usage statistics

## 7. Configuration Requirements

### Sentry Initialization
```typescript
// In instrumentation files
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://10fec7c6a14c67e9406d4444545925d5@o4509445712445440.ingest.us.sentry.io/4509445713690624",
  _experiments: {
    enableLogs: true,
  },
  integrations: [
    Sentry.consoleLoggingIntegration({ 
      levels: ["error", "warn"] 
    }),
  ],
  tracesSampleRate: 1.0, // Adjust based on traffic
  environment: process.env.NODE_ENV,
});
```

### Environment Variables
```bash
SENTRY_DSN=https://10fec7c6a14c67e9406d4444545925d5@o4509445712445440.ingest.us.sentry.io/4509445713690624
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=builders-dashboard-v2
```

This comprehensive plan covers all major interaction points in the builders functionality with appropriate Sentry monitoring to track performance, errors, and user behavior patterns.