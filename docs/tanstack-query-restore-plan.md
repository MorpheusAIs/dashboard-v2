# TanStack Query Restoration Plan

## 1. Current Situation Analysis

### 1.1 Missing Files/Components
From analyzing PR-2 diff and previous conversations, the following critical files were lost:

- `app/hooks/useAllBuildersQuery.ts`
- `app/hooks/useNetworkInfo.ts`
- `app/hooks/useSupabaseBuilders.ts`
- `app/services/buildersService.ts`
- `app/providers.tsx`

### 1.2 Key Functionality Lost
1. **TanStack Query Integration**
   - Query client setup and configuration
   - React Query DevTools
   - Caching and state management for builder data

2. **Network Information Management**
   - Network type detection (mainnet vs testnet)
   - Chain ID management
   - Network switching behavior

3. **Supabase Integration**
   - Real-time subscription handling
   - Builder data synchronization
   - Cache invalidation on updates

4. **URL Parameter Handling**
   - ProjectID in URL for mainnet networks
   - Proper staker data retrieval
   - Slug-based navigation enhancement

## 2. Impact Analysis

### 2.1 Performance Issues
- Excessive API calls without proper caching
- Race conditions in data fetching
- Inefficient state management

### 2.2 User Experience Impact
- Slower page loads
- Potential data inconsistencies
- Network switching issues

## 3. Action Plan

### 3.1 File Restoration
1. **Restore Core Files**
   - Recreate `useAllBuildersQuery.ts` with proper TypeScript types
   - Restore `useNetworkInfo.ts` with enhanced network detection
   - Rebuild `useSupabaseBuilders.ts` with real-time capabilities
   - Restore `buildersService.ts` with improved error handling
   - Recreate `providers.tsx` with proper configuration

2. **Enhance Query Client Setup**
   ```typescript
   const queryClient = new QueryClient({
     defaultOptions: {
       queries: {
         staleTime: 1000 * 60 * 5, // 5 minutes
         cacheTime: 1000 * 60 * 30, // 30 minutes
         retry: 3,
         refetchOnWindowFocus: true,
       },
     },
   });
   ```

### 3.2 Feature Implementation

1. **Builder Data Management**
   - Implement proper caching strategy
   - Add background data updates
   - Handle stale data invalidation
   - Implement optimistic updates

2. **Network Handling**
   - Add network change detection
   - Implement proper redirection logic
   - Handle chain ID changes gracefully
   - Add network-specific error handling

3. **URL Parameter Enhancement**
   - Add projectID to URL structure
   - Implement proper parameter extraction
   - Add validation and error handling
   - Enhance navigation logic

### 3.3 Testing Strategy

1. **Unit Tests**
   - Test all hooks individually
   - Verify network detection logic
   - Test URL parameter handling
   - Validate data transformation

2. **Integration Tests**
   - Test TanStack Query integration
   - Verify Supabase real-time updates
   - Test network switching behavior
   - Validate builder data flow

3. **End-to-End Tests**
   - Test complete user flows
   - Verify network redirections
   - Test data persistence
   - Validate error scenarios

## 4. Implementation Order

1. **Phase 1: Core Infrastructure**
   - Restore TanStack Query setup
   - Implement network detection
   - Restore Supabase integration

2. **Phase 2: Data Management**
   - Implement builder data fetching
   - Add caching logic
   - Restore real-time updates

3. **Phase 3: URL Enhancement**
   - Add projectID handling
   - Implement parameter extraction
   - Enhance navigation

4. **Phase 4: Testing & Optimization**
   - Add comprehensive tests
   - Optimize performance
   - Add error handling

## 5. Potential Risks

1. **Data Consistency**
   - Multiple data sources synchronization
   - Cache invalidation timing
   - Real-time update conflicts

2. **Network Handling**
   - Race conditions during network switches
   - Chain ID detection issues
   - Redirect loops

3. **Performance**
   - Query client configuration impact
   - Cache size management
   - Real-time subscription overhead

## 6. Mitigation Strategies

1. **Data Management**
   - Implement proper error boundaries
   - Add retry mechanisms
   - Use optimistic updates
   - Implement proper loading states

2. **Network Handling**
   - Add proper debouncing
   - Implement fallback mechanisms
   - Add proper error messages
   - Use proper TypeScript types

3. **Performance**
   - Implement proper caching
   - Add background updates
   - Use proper query invalidation
   - Implement proper loading states

## 7. Success Criteria

1. **Performance**
   - Page load time under 2 seconds
   - Smooth network switching
   - No unnecessary API calls

2. **Functionality**
   - Proper data caching
   - Real-time updates working
   - Network switching working
   - URL parameters working

3. **User Experience**
   - No visible loading states
   - Proper error messages
   - Smooth navigation
   - Consistent data display

## 8. Monitoring & Maintenance

1. **Performance Monitoring**
   - Add proper logging
   - Monitor API calls
   - Track cache hits/misses
   - Monitor real-time updates

2. **Error Tracking**
   - Add proper error tracking
   - Monitor network issues
   - Track data inconsistencies
   - Monitor user reports

3. **Maintenance Plan**
   - Regular cache cleanup
   - Update dependencies
   - Monitor performance metrics
   - Regular code reviews 