"use client";

import { useState, useEffect } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartConfig, ChartContainer } from "@/components/ui/chart";

// Safely fetch token prices from CoinGecko
const fetchTokenPrices = async (contractAddresses: string[]) => {
  if (!contractAddresses || contractAddresses.length === 0) {
    throw new Error("No contract addresses provided for price fetching");
  }
  
  // Clean addresses to make sure they're valid
  const validAddresses = contractAddresses.filter(addr => 
    addr && typeof addr === 'string' && /^0x[a-fA-F0-9]{40}$/.test(addr)
  );
  
  if (validAddresses.length === 0) {
    throw new Error("No valid contract addresses found");
  }
  
  console.log("Fetching prices for tokens:", validAddresses);
  
  try {
    const platformId = "arbitrum-one";
    const url = `https://api.coingecko.com/api/v3/simple/token_price/${platformId}?contract_addresses=${validAddresses.join(",")}&vs_currencies=usd`;
    
    console.log("CoinGecko API URL:", url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        // Add CoinGecko API key header if you have one
        // 'x-cg-pro-api-key': 'YOUR_API_KEY_HERE', 
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`CoinGecko API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log("CoinGecko API response:", data);
    
    // Check if we got any prices back
    const fetchedPrices = Object.keys(data).length;
    if (fetchedPrices === 0) {
      throw new Error("CoinGecko returned no prices");
    }
    
    console.log(`Successfully fetched prices for ${fetchedPrices} tokens`);
    return data;
  } catch (error) {
    console.error("Error fetching token prices:", error);
    throw error; // Propagate the error upward instead of using fallback prices
  }
};

// Extract unique token addresses from the GraphQL response safely
const getUniqueTokenAddresses = (poolsData: any) => {
  if (!poolsData || (!poolsData.poolsToken0 && !poolsData.poolsToken1)) {
    return [];
  }

  try {
    // Safely collect pools, filtering out any malformed data
    const allPools = [
      ...(Array.isArray(poolsData.poolsToken0) ? poolsData.poolsToken0 : []),
      ...(Array.isArray(poolsData.poolsToken1) ? poolsData.poolsToken1 : []),
    ].filter(pool => 
      pool && 
      pool.token0 && 
      typeof pool.token0.id === 'string' &&
      pool.token1 && 
      typeof pool.token1.id === 'string'
    );

    const tokenAddresses = new Set<string>();
    
    allPools.forEach((pool) => {
      try {
        const token0Id = pool.token0.id.toLowerCase();
        const token1Id = pool.token1.id.toLowerCase();
        
        if (token0Id && /^0x[a-fA-F0-9]{40}$/.test(token0Id)) {
          tokenAddresses.add(token0Id);
        }
        
        if (token1Id && /^0x[a-fA-F0-9]{40}$/.test(token1Id)) {
          tokenAddresses.add(token1Id);
        }
      } catch (err) {
        console.error("Error processing pool tokens:", err);
      }
    });

    return Array.from(tokenAddresses);
  } catch (error) {
    console.error("Error extracting token addresses:", error);
    return [];
  }
};

// Transform the GraphQL response into chart data with USD values
const transformPoolData = (poolsData: any, tokenPrices: Record<string, { usd: number }>) => {
  if (!poolsData || (!poolsData.poolsToken0 && !poolsData.poolsToken1)) {
    return [];
  }

  try {
    console.log("Transforming pool data with token prices:", tokenPrices);

    // Safely collect pools, filtering out any malformed data
    const allPools = [
      ...(Array.isArray(poolsData.poolsToken0) ? poolsData.poolsToken0 : []),
      ...(Array.isArray(poolsData.poolsToken1) ? poolsData.poolsToken1 : []),
    ].filter(pool => 
      pool && 
      pool.token0 && 
      pool.token0.id && 
      pool.token0.symbol &&
      pool.token1 && 
      pool.token1.id && 
      pool.token1.symbol &&
      !isNaN(parseFloat(pool.totalValueLockedToken0)) &&
      !isNaN(parseFloat(pool.totalValueLockedToken1))
    );

    return allPools.map((pool) => {
      try {
        const pairName = `${pool.token0.symbol}-${pool.token1.symbol}`;
        const morAmount = parseFloat(pool.totalValueLockedToken0);
        const pairedTokenAmount = parseFloat(pool.totalValueLockedToken1);

        const token0Address = pool.token0.id.toLowerCase();
        const token1Address = pool.token1.id.toLowerCase();

        const morPriceUSD = tokenPrices[token0Address]?.usd || 0;
        const pairedTokenPriceUSD = tokenPrices[token1Address]?.usd || 0;

        console.log(`Pool ${pairName}: ${pool.token0.symbol} price = $${morPriceUSD}, ${pool.token1.symbol} price = $${pairedTokenPriceUSD}`);

        const morValueUSD = morAmount * morPriceUSD;
        const pairedTokenValueUSD = pairedTokenAmount * pairedTokenPriceUSD;

        return {
          pool: pairName,
          MOR: morValueUSD,
          morAmount,
          morPriceUSD,
          pairedToken: pairedTokenValueUSD,
          pairedTokenAmount,
          pairedTokenPriceUSD,
          pairedTokenSymbol: pool.token1.symbol,
        };
      } catch (err) {
        console.error("Error transforming pool:", err, pool);
        return null;
      }
    }).filter(Boolean); // Remove any null entries
  } catch (error) {
    console.error("Error transforming pool data:", error);
    return [];
  }
};

// Chart configuration
const chartConfig = {
  MOR: {
    label: "MOR",
    color: "hsl(var(--chart-1))",
  },
  pairedToken: {
    label: "Paired Token",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length || !payload[0] || !payload[1]) {
    return null;
  }
  
  try {
    const morValueUSD = payload[0].value || 0;
    const pairedTokenValueUSD = payload[1].value || 0;
    const pairedTokenSymbol = payload[1].payload?.pairedTokenSymbol || "Token";
    const morAmount = payload[1].payload?.morAmount || 0;
    const pairedTokenAmount = payload[1].payload?.pairedTokenAmount || 0;
    const total = morValueUSD + pairedTokenValueUSD;

    return (
      <div className="bg-background border rounded p-2 shadow-md text-xs">
        <div className="mb-1 font-medium">{label}</div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center">
            <div className="h-2.5 w-2.5 mr-1.5 rounded-[2px] bg-[var(--chart-1)]" />
            <span>MOR</span>
          </div>
          <div className="font-mono">
            ${morValueUSD.toFixed(2)} <span className="text-muted-foreground">({morAmount.toFixed(2)} tokens)</span>
          </div>
        </div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center">
            <div className="h-2.5 w-2.5 mr-1.5 rounded-[2px] bg-[var(--chart-2)]" />
            <span>{pairedTokenSymbol}</span>
          </div>
          <div className="font-mono">
            ${pairedTokenValueUSD.toFixed(2)} <span className="text-muted-foreground">({pairedTokenAmount.toFixed(2)} tokens)</span>
          </div>
        </div>
        <div className="border-t mt-1 pt-1 flex items-center justify-between font-medium">
          <span>Total</span>
          <div className="font-mono">
            ${total.toFixed(2)}
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error("Error rendering tooltip:", error);
    return null;
  }
};

export interface Pool {
  id: string;
  liquidity: string;
  token0: {
    id: string;
    symbol: string;
  };
  token1: {
    id: string;
    symbol: string;
  };
  totalValueLockedToken0: string;
  totalValueLockedToken1: string;
}

export interface LiquidityPoolsData {
  poolsToken0?: Pool[];
  poolsToken1?: Pool[];
}

interface LiquidityPoolsChartProps {
  data: LiquidityPoolsData;
}

export function LiquidityPoolsChart({ data }: LiquidityPoolsChartProps) {
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log("LiquidityPoolsChart received data:", data);
        
        if (!data || (!data.poolsToken0?.length && !data.poolsToken1?.length)) {
          console.error("No valid pool data provided");
          setError("No valid pool data available");
          setLoading(false);
          return;
        }
        
        // Step 1: Get unique token addresses
        const tokenAddresses = getUniqueTokenAddresses(data);
        console.log("Unique token addresses:", tokenAddresses);
        
        if (tokenAddresses.length === 0) {
          setError("No valid token addresses found in pool data");
          setLoading(false);
          return;
        }
        
        // Step 2: Fetch token prices from CoinGecko
        try {
          const tokenPrices = await fetchTokenPrices(tokenAddresses);
          
          // Step 3: Transform the data with USD values
          const transformedData = transformPoolData(data, tokenPrices);
          console.log("Transformed chart data:", transformedData);
          
          if (transformedData.length === 0) {
            setError("Failed to transform pool data into chart format");
          } else {
            setChartData(transformedData);
          }
        } catch (priceError) {
          console.error("Error fetching token prices:", priceError);
          setError(`Failed to retrieve token prices: ${priceError instanceof Error ? priceError.message : "Unknown error"}`);
        }
      } catch (error) {
        console.error("Error processing data:", error);
        setError(`Failed to process liquidity pool data: ${error instanceof Error ? error.message : "Unknown error"}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [data]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Liquidity by Pool</CardTitle>
          <CardDescription>Total Value Locked in Each Pool (USD)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Loading liquidity pool data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Liquidity by Pool</CardTitle>
          <CardDescription>Error</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 text-red-500">
            <p className="text-lg mb-2">Failed to retrieve data</p>
            <p className="text-sm text-center">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Liquidity by Pool</CardTitle>
          <CardDescription>Total Value Locked in Each Pool (USD)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">No liquidity pool data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Liquidity by Pool</CardTitle>
        <CardDescription>Total Value Locked in Each Pool (USD)</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData}>
              <XAxis
                dataKey="pool"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="MOR"
                stackId="a"
                fill="hsl(var(--chart-1))"
                radius={[0, 0, 4, 4]}
              />
              <Bar
                dataKey="pairedToken"
                stackId="a" 
                fill="hsl(var(--chart-2))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
} 