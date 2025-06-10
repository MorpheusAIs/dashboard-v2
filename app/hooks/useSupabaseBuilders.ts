import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BuildersService } from '@/app/services/builders.service';
import { BuilderDB } from '@/app/lib/supabase';
import { Builder } from '@/app/builders/builders-data';

export interface SupabaseBuildersData {
  supabaseBuilders: BuilderDB[];
  supabaseBuildersLoaded: boolean;
  error: Error | null;
}

export const useSupabaseBuilders = (): SupabaseBuildersData => {
  const queryClient = useQueryClient();
  const [supabaseBuilders, setSupabaseBuilders] = useState<BuilderDB[]>([]);
  const [supabaseBuildersLoaded, setSupabaseBuildersLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Effect for initial load from Supabase
  useEffect(() => {
    let isMounted = true;
    const loadBuilders = async () => {
      try {
        const builders = await BuildersService.getAllBuilders();
        if (isMounted) {
          setSupabaseBuilders(builders);
          setSupabaseBuildersLoaded(true);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error loading builders from Supabase:', err);
          setSupabaseBuilders([]);
          setSupabaseBuildersLoaded(true); // Still true, as the attempt was made
          setError(err instanceof Error ? err : new Error('Failed to load builders from Supabase'));
        }
      }
    };
    
    loadBuilders();
    return () => {
      isMounted = false;
    };
  }, []); // Empty dependency array for initial load

  // Effect for real-time subscription
  useEffect(() => {
    if (!supabaseBuildersLoaded) {
      return;
    }

    // BuildersService.subscribeToBuilders returns the unsubscribe function directly
    const unsubscribe = BuildersService.subscribeToBuilders((updatedBuilders) => {
      console.log(`[useSupabaseBuilders] Real-time builder update received at ${new Date().toISOString()}, count:`, updatedBuilders.length);
      setSupabaseBuilders(updatedBuilders);
      
      // Instead of invalidating the cache (which triggers expensive refetch),
      // update the cache directly with the fresh Supabase data
      console.log(`[useSupabaseBuilders] Updating builders cache with real-time data at ${new Date().toISOString()}...`);
      
      try {
        // Update all builders queries with fresh data based on the new Supabase builders
        queryClient.setQueriesData(
          { queryKey: ['builders'] },
          (oldData: unknown) => {
            if (!oldData || !Array.isArray(oldData)) {
              console.log('[useSupabaseBuilders] No existing cache data to update');
              return oldData;
            }
            
            // Map over existing builders and update any that match the Supabase data
            const updatedCache = (oldData as Builder[]).map(existingBuilder => {
              // Find matching builder in the fresh Supabase data
              const updatedSupabaseBuilder = updatedBuilders.find(sb => sb.id === existingBuilder.id);
              
              if (updatedSupabaseBuilder) {
                // Merge the fresh Supabase data with the existing builder data
                return {
                  ...existingBuilder,
                  description: updatedSupabaseBuilder.description,
                  website: updatedSupabaseBuilder.website,
                  image_src: updatedSupabaseBuilder.image_src,
                  reward_types: updatedSupabaseBuilder.reward_types,
                  updated_at: updatedSupabaseBuilder.updated_at,
                  // Keep other fields from the existing cache (like computed fields)
                };
              }
              
              return existingBuilder;
            });
            
            console.log(`[useSupabaseBuilders] Successfully updated builders cache with real-time data at ${new Date().toISOString()}`);
            return updatedCache;
          }
        );
        
        // Optional: Still invalidate for next fetch to ensure consistency, but don't wait for it
        // This ensures fresh data on the next query without blocking the UI
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['builders'], exact: false });
        }, 5000); // Delay invalidation by 5 seconds
        
      } catch (error) {
        console.error('[useSupabaseBuilders] Error updating cache with real-time data:', error);
        // Fallback to invalidation if cache update fails
        queryClient.invalidateQueries({ queryKey: ['builders'] });
      }
    });

    return () => {
      // unsubscribe is a function, call it directly if it exists
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [supabaseBuildersLoaded, queryClient]);

  return { supabaseBuilders, supabaseBuildersLoaded, error };
}; 