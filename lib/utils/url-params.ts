import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';

/**
 * A hook to manage URL search parameters
 * @returns Object with methods to get and set URL params
 */
export function useUrlParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Get a specific param
  const getParam = useCallback((key: string): string | null => {
    return searchParams.get(key);
  }, [searchParams]);
  
  // Set a single param (adds or updates)
  const setParam = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams);
    
    if (value === null || value === '') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    
    const newQuery = params.toString();
    const queryString = newQuery.length > 0 ? `?${newQuery}` : '';
    router.replace(`${pathname}${queryString}`, { scroll: false });
  }, [pathname, router, searchParams]);
  
  // Set multiple params at once
  const setParams = useCallback((paramsToSet: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams);
    
    Object.entries(paramsToSet).forEach(([key, value]) => {
      if (value === null || value === '') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    
    const newQuery = params.toString();
    const queryString = newQuery.length > 0 ? `?${newQuery}` : '';
    router.replace(`${pathname}${queryString}`, { scroll: false });
  }, [pathname, router, searchParams]);
  
  // Reset all params (clear URL)
  const resetParams = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);
  
  return {
    getParam,
    setParam,
    setParams,
    resetParams,
    searchParams,
  };
}

/**
 * Hook to initialize state from URL parameters only on initial render
 * Does NOT update URL when state changes - this is a one-way sync
 * Only sets state if the parameter exists in the URL
 */
export function useInitStateFromUrl<T>(
  paramName: string,
  setState: (value: T) => void,
  deserialize: (param: string | null) => T
) {
  const { getParam } = useUrlParams();
  const initialized = useRef(false);
  
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      const urlValue = getParam(paramName);
      
      // Only update state if the parameter exists in the URL
      if (urlValue !== null) {
        const deserializedValue = deserialize(urlValue);
        setState(deserializedValue);
      }
    }
  }, [getParam, paramName, setState, deserialize]);
}

/**
 * Utility functions for converting between URL param values and typed state values
 */
export const ParamConverters = {
  string: {
    serialize: (value: string): string | null => value || null,
    deserialize: (param: string | null): string => param || '',
  },
  
  stringOrNull: {
    serialize: (value: string | null): string | null => value,
    deserialize: (param: string | null): string | null => param,
  },
  
  number: {
    serialize: (value: number): string | null => isNaN(value) ? null : value.toString(),
    deserialize: (param: string | null): number => param ? Number(param) : 0,
  },
  
  boolean: {
    serialize: (value: boolean): string | null => value ? 'true' : null,
    deserialize: (param: string | null): boolean => param === 'true',
  },
  
  // For sorting
  sorting: {
    serialize: (value: { column: string | null, direction: 'asc' | 'desc' | null }): string | null => {
      if (!value.column || !value.direction) return null;
      return `${value.column}-${value.direction}`;
    },
    deserialize: (param: string | null): { column: string | null, direction: 'asc' | 'desc' | null } => {
      if (!param) return { column: null, direction: null };
      const [column, direction] = param.split('-');
      return {
        column: column || null,
        direction: (direction as 'asc' | 'desc') || null
      };
    }
  }
}; 