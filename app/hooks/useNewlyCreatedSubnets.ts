import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface NewlyCreatedSubnet {
  name: string;
  createdAt: number; // timestamp
  network: string;
  adminAddress: string; // Store the creator's address
}

const STORAGE_KEY = 'newly_created_subnets';
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

/**
 * Hook to manage newly created subnet names locally until they appear in morlord data
 * This helps ensure immediate visibility of newly created subnets
 */
export const useNewlyCreatedSubnets = () => {
  const [newlyCreatedSubnets, setNewlyCreatedSubnets] = useState<NewlyCreatedSubnet[]>([]);
  const queryClient = useQueryClient();

  // Load from localStorage on mount
  useEffect(() => {
      // console.log('[useNewlyCreatedSubnets] Hook mounted, attempting to load from localStorage');
      // console.log('[useNewlyCreatedSubnets] Storage key:', STORAGE_KEY);
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      // console.log('[useNewlyCreatedSubnets] Raw localStorage value:', stored);
      
      if (stored) {
        const parsed: NewlyCreatedSubnet[] = JSON.parse(stored);
        // console.log('[useNewlyCreatedSubnets] Parsed data:', parsed);
        
        // Filter out expired entries (older than 15 minutes)
        const now = Date.now();
        const validEntries = parsed.filter(entry => {
          const age = now - entry.createdAt;
          const isValid = age < CACHE_DURATION;
          // console.log(`[useNewlyCreatedSubnets] Entry "${entry.name}": age=${Math.round(age/1000)}s, valid=${isValid}`);
          return isValid;
        });
        
        // console.log('[useNewlyCreatedSubnets] Valid entries after filtering:', validEntries);
        
        if (validEntries.length !== parsed.length) {
          // Some entries expired, update storage
          localStorage.setItem(STORAGE_KEY, JSON.stringify(validEntries));
          // console.log('[useNewlyCreatedSubnets] Updated localStorage after filtering expired entries');
        }
        
        setNewlyCreatedSubnets(validEntries);
        // console.log(`[useNewlyCreatedSubnets] Loaded ${validEntries.length} cached subnet names from localStorage`);
      } else {
        console.log('[useNewlyCreatedSubnets] No stored data found in localStorage');
      }
    } catch (error) {
      console.error('[useNewlyCreatedSubnets] Error loading from localStorage:', error);
    }
  }, []);

  // Add a new subnet name to the cache
  const addNewlyCreatedSubnet = (name: string, network: string, adminAddress: string) => {
    const newEntry: NewlyCreatedSubnet = {
      name,
      createdAt: Date.now(),
      network,
      adminAddress
    };

    setNewlyCreatedSubnets(prev => {
      // Check if this subnet name already exists
      const exists = prev.some(subnet => subnet.name === name);
      if (exists) {
        // console.log(`[useNewlyCreatedSubnets] Subnet "${name}" already in cache, skipping`);
        return prev;
      }

      const updated = [...prev, newEntry];
      
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        console.log(`[useNewlyCreatedSubnets] Added "${name}" to cache (${network})`);
        
        // Trigger query invalidation to refetch data with new subnet
        queryClient.invalidateQueries({ queryKey: ['builders'] });
        console.log(`[useNewlyCreatedSubnets] Invalidated builders queries for new subnet "${name}"`);
      } catch (error) {
        console.error('[useNewlyCreatedSubnets] Error saving to localStorage:', error);
      }
      
      return updated;
    });
  };

  // Remove subnet names that now appear in the official list (morlord data)
  const cleanupExistingSubnets = (officialNames: string[]) => {
    setNewlyCreatedSubnets(prev => {
      const toKeep = prev.filter(subnet => !officialNames.includes(subnet.name));
      
      if (toKeep.length !== prev.length) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(toKeep));
          // const removedCount = prev.length - toKeep.length;
          // console.log(`[useNewlyCreatedSubnets] Cleaned up ${removedCount} subnet names that now appear in official data`);
        } catch (error) {
          console.error('[useNewlyCreatedSubnets] Error updating localStorage:', error);
        }
      }
      
      return toKeep;
    });
  };

  // Get just the subnet names for use in queries
  const getNewlyCreatedSubnetNames = (): string[] => {
    return newlyCreatedSubnets.map(subnet => subnet.name);
  };

  // Get the admin address for a specific subnet name
  const getNewlyCreatedSubnetAdmin = (subnetName: string): string | null => {
    const subnet = newlyCreatedSubnets.find(s => s.name === subnetName);
    return subnet?.adminAddress || null;
  };

  return {
    newlyCreatedSubnets,
    addNewlyCreatedSubnet,
    cleanupExistingSubnets,
    getNewlyCreatedSubnetNames,
    getNewlyCreatedSubnetAdmin
  };
}; 