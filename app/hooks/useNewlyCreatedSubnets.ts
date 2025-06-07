import { useEffect, useState } from 'react';

interface NewlyCreatedSubnet {
  name: string;
  createdAt: number; // timestamp
  network: string;
}

const STORAGE_KEY = 'newly_created_subnets';
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

/**
 * Hook to manage newly created subnet names locally until they appear in morlord data
 * This helps ensure immediate visibility of newly created subnets
 */
export const useNewlyCreatedSubnets = () => {
  const [newlyCreatedSubnets, setNewlyCreatedSubnets] = useState<NewlyCreatedSubnet[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: NewlyCreatedSubnet[] = JSON.parse(stored);
        // Filter out expired entries (older than 15 minutes)
        const now = Date.now();
        const validEntries = parsed.filter(entry => 
          now - entry.createdAt < CACHE_DURATION
        );
        
        if (validEntries.length !== parsed.length) {
          // Some entries expired, update storage
          localStorage.setItem(STORAGE_KEY, JSON.stringify(validEntries));
        }
        
        setNewlyCreatedSubnets(validEntries);
        console.log(`[useNewlyCreatedSubnets] Loaded ${validEntries.length} cached subnet names from localStorage`);
      }
    } catch (error) {
      console.error('[useNewlyCreatedSubnets] Error loading from localStorage:', error);
    }
  }, []);

  // Add a new subnet name to the cache
  const addNewlyCreatedSubnet = (name: string, network: string) => {
    const newEntry: NewlyCreatedSubnet = {
      name,
      createdAt: Date.now(),
      network
    };

    setNewlyCreatedSubnets(prev => {
      // Check if this subnet name already exists
      const exists = prev.some(subnet => subnet.name === name);
      if (exists) {
        console.log(`[useNewlyCreatedSubnets] Subnet "${name}" already in cache, skipping`);
        return prev;
      }

      const updated = [...prev, newEntry];
      
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        console.log(`[useNewlyCreatedSubnets] Added "${name}" to cache (${network})`);
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
          const removedCount = prev.length - toKeep.length;
          console.log(`[useNewlyCreatedSubnets] Cleaned up ${removedCount} subnet names that now appear in official data`);
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

  return {
    newlyCreatedSubnets,
    addNewlyCreatedSubnet,
    cleanupExistingSubnets,
    getNewlyCreatedSubnetNames
  };
}; 