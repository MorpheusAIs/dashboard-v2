/**
 * Mock Data Service for Capital Chart Development
 * 
 * This service provides mock data for development and testing purposes,
 * allowing visualization of the chart without needing live GraphQL data.
 */

import stethDeposits from './steth-deposits.json';
import usdtDeposits from './usdt-deposits.json';
import usdcDeposits from './usdc-deposits.json';
import wbtcDeposits from './wbtc-deposits.json';
import wethDeposits from './weth-deposits.json';
import linkDeposits from './link-deposits.json';

export interface MockDataPoint {
  date: string;
  deposits: number;
  timestamp: number;
}

export type TokenType = 'stETH' | 'USDT' | 'USDC' | 'wBTC' | 'wETH' | 'LINK';

/**
 * Get mock data for a specific token type
 */
export function getMockData(tokenType: TokenType): MockDataPoint[] {
  switch (tokenType) {
    case 'stETH':
      return stethDeposits as MockDataPoint[];
    case 'USDT':
      return usdtDeposits as MockDataPoint[];
    case 'USDC':
      return usdcDeposits as MockDataPoint[];
    case 'wBTC':
      return wbtcDeposits as MockDataPoint[];
    case 'wETH':
      return wethDeposits as MockDataPoint[];
    case 'LINK':
      return linkDeposits as MockDataPoint[];
    default:
      return stethDeposits as MockDataPoint[];
  }
}

/**
 * Get mock data in the format expected by the chart component
 * Removes timestamp field to match ChartDataPoint interface
 */
export function getFormattedMockData(tokenType: TokenType = 'stETH') {
  const rawData = getMockData(tokenType);
  return rawData.map(({ date, deposits }) => ({
    date,
    deposits
  }));
}

/**
 * Simulate the GraphQL response structure that the hook expects
 * This converts our mock data into the format that matches the real API response
 */
export function getMockGraphQLResponse(tokenType: TokenType = 'stETH') {
  const mockData = getMockData(tokenType);
  const responseData: Record<string, Array<{ totalStaked: string }>> = {};
  
  mockData.forEach((point, index) => {
    const dayKey = `d${index}`;
    // Convert deposits to Wei format (multiply by 10^18) as string
    const totalStakedWei = (point.deposits * Math.pow(10, 18)).toLocaleString('fullwide', { useGrouping: false });
    responseData[dayKey] = [{
      totalStaked: totalStakedWei
    }];
  });

  return {
    data: responseData,
    timestamps: mockData.map(point => point.timestamp)
  };
}

/**
 * Enable/disable mock data based on environment or configuration
 * Returns true if mock data should be used
 */
export function shouldUseMockData(): boolean {
  // IMPORTANT: Mock data should be disabled on production mainnet
  // This function should only be used for development/testing purposes
  
  // Environment-based override: Never use mock data if explicitly set to mainnet
  const envNetworkOverride = process.env.NEXT_PUBLIC_NETWORK_ENV;
  if (envNetworkOverride === 'mainnet') {
    console.log('🔒 Mock data disabled: NEXT_PUBLIC_NETWORK_ENV=mainnet (environment override)');
    return false;
  }
  
  // Production safety: Never use mock data in production
  if (process.env.NODE_ENV === 'production') {
    console.log('🔒 Mock data disabled: NODE_ENV=production');
    return false;
  }
  
  // Explicit opt-in via env flag
  const shouldUseMock = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';
                        
  console.log('🎭 Mock data decision:', {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_USE_MOCK_DATA: process.env.NEXT_PUBLIC_USE_MOCK_DATA,
    NEXT_PUBLIC_NETWORK_ENV: envNetworkOverride,
    shouldUseMock
  });
  
  return shouldUseMock;
}

/**
 * Get total metrics across all mock assets (for display in metrics cards)
 */
export function getTotalMockMetrics() {
  const allTokens: TokenType[] = ['stETH', 'LINK', 'wETH', 'USDC', 'USDT', 'wBTC'];
  const tokenConfig = {
    stETH: { price: 3500, dailyMOR: 3456, apr: 8.5, stakers: 1247 },
    wETH: { price: 3500, dailyMOR: 2834, apr: 7.8, stakers: 892 },
    LINK: { price: 25, dailyMOR: 4123, apr: 12.2, stakers: 2156 },
    wBTC: { price: 95000, dailyMOR: 1567, apr: 11.25, stakers: 734 },
    USDC: { price: 1, dailyMOR: 2789, apr: 10.67, stakers: 1834 },
    USDT: { price: 1, dailyMOR: 2456, apr: 9.8, stakers: 1623 }
  };
  
  let totalTVL = 0;
  let totalDailyMOR = 0;
  let totalActiveStakers = 0;
  let weightedAPR = 0;
  
  allTokens.forEach(tokenType => {
    const data = getMockData(tokenType);
    const latestDeposits = data[data.length - 1]?.deposits || 0;
    const config = tokenConfig[tokenType];
    
    // Calculate TVL for this token
    const tokenTVL = latestDeposits * config.price;
    totalTVL += tokenTVL;
    
    // Sum daily MOR emissions
    totalDailyMOR += config.dailyMOR;
    
    // Sum active stakers
    totalActiveStakers += config.stakers;
    
    // Weight APR by TVL for average calculation
    weightedAPR += (config.apr * tokenTVL);
  });
  
  // Calculate weighted average APR
  const avgAPR = totalTVL > 0 ? weightedAPR / totalTVL : 0;
  
  return {
    totalValueLockedUSD: Math.floor(totalTVL).toLocaleString(),
    currentDailyRewardMOR: Math.round(totalDailyMOR).toLocaleString(),
    avgApyRate: avgAPR.toFixed(2),
    activeStakers: totalActiveStakers.toLocaleString()
  };
}

/**
 * Get total TVL across all mock assets (for display in metrics cards)
 * @deprecated Use getTotalMockMetrics() instead for all metrics
 */
export function getTotalMockTVL(): string {
  return getTotalMockMetrics().totalValueLockedUSD;
}

/**
 * Get mock metrics data to accompany chart data
 */
export function getMockMetrics(tokenType: TokenType = 'stETH') {
  const data = getMockData(tokenType);
  const latestDeposits = data[data.length - 1]?.deposits || 0;
  
  // Simulate realistic metrics based on token type with approximate prices
  const tokenConfig = {
    stETH: { price: 3500, dailyMOR: '3,456', apr: '8.5', stakers: '1,247' },
    wETH: { price: 3500, dailyMOR: '2,834', apr: '7.8', stakers: '892' },
    LINK: { price: 25, dailyMOR: '4,123', apr: '12.2', stakers: '2,156' },
    wBTC: { price: 95000, dailyMOR: '1,567', apr: '11.25', stakers: '734' },
    USDC: { price: 1, dailyMOR: '2,789', apr: '10.67', stakers: '1,834' },
    USDT: { price: 1, dailyMOR: '2,456', apr: '9.8', stakers: '1,623' }
  };

  const config = tokenConfig[tokenType];
  
  return {
    totalValueLockedUSD: Math.floor(latestDeposits * config.price).toLocaleString(),
    currentDailyRewardMOR: config.dailyMOR,
    avgApyRate: config.apr,
    activeStakers: config.stakers
  };
}

/**
 * Get all available assets with their latest deposit amounts (for sorting)
 * Returns assets sorted by deposit amount in descending order
 */
export function getAvailableAssets(): Array<{ token: TokenType; deposits: number; }> {
  const allTokens: TokenType[] = ['stETH', 'LINK', 'wETH', 'USDC', 'USDT', 'wBTC'];
  
  const assetsWithDeposits = allTokens.map(token => {
    const data = getMockData(token);
    const latestDeposits = data[data.length - 1]?.deposits || 0;
    return { token, deposits: latestDeposits };
  })
  .filter(asset => asset.deposits > 0) // Only show assets with deposits
  .sort((a, b) => b.deposits - a.deposits); // Sort by deposits descending

  return assetsWithDeposits;
}

/**
 * Get asset colors for chart styling
 */
export function getAssetColor(tokenType: TokenType): { 
  primary: string; 
  gradient: { start: string; end: string; }; 
  buttonClass: string; 
} {
  const colors = {
    stETH: {
      primary: '#34d399',
      gradient: { start: '#34d399', end: '#10b981' },
      buttonClass: 'text-emerald-400 border-emerald-400'
    },
    LINK: {
      primary: '#2563eb',
      gradient: { start: '#3b82f6', end: '#1e40af' },
      buttonClass: 'text-blue-400 border-blue-400'
    },
    wETH: {
      primary: '#8b5cf6',
      gradient: { start: '#8b5cf6', end: '#7c3aed' },
      buttonClass: 'text-purple-400 border-purple-400'
    },
    USDC: {
      primary: '#06b6d4',
      gradient: { start: '#06b6d4', end: '#0891b2' },
      buttonClass: 'text-cyan-400 border-cyan-400'
    },
    USDT: {
      primary: '#10b981',
      gradient: { start: '#10b981', end: '#059669' },
      buttonClass: 'text-green-400 border-green-400'
    },
    wBTC: {
      primary: '#f59e0b',
      gradient: { start: '#f59e0b', end: '#d97706' },
      buttonClass: 'text-orange-400 border-orange-400'
    }
  };

  return colors[tokenType];
}

export default {
  getMockData,
  getFormattedMockData,
  getMockGraphQLResponse,
  shouldUseMockData,
  getMockMetrics,
  getTotalMockMetrics,
  getTotalMockTVL,
  getAvailableAssets,
  getAssetColor
};
