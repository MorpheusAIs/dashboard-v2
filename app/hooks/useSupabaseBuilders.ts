import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BuildersService } from '@/app/services/builders.service';
import { BuilderDB } from '@/app/lib/supabase';

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
      console.log('Real-time builder update received via useSupabaseBuilders hook:', updatedBuilders);
      setSupabaseBuilders(updatedBuilders);
      queryClient.invalidateQueries({ queryKey: ['builders'] });
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