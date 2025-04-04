"use client";

import { useState, useEffect } from "react";
import { fetchGraphQL, getEndpointForNetwork, GRAPHQL_ENDPOINTS } from "@/app/graphql/client";
import { GET_LIQUIDITY_POOLS } from "@/app/graphql/queries/metrics";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DebugGraphQL() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [network, setNetwork] = useState("Base");
  
  const testEndpoint = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get the correct endpoint URL
      const endpoint = getEndpointForNetwork(network);
      console.log(`Testing GraphQL endpoint for ${network}: ${endpoint}`);
      
      // Try with direct fetch first to check connectivity
      try {
        const directResponse = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: "{ _meta { block { number } } }"
          }),
        });
        
        console.log("Direct fetch response:", directResponse);
        
        if (!directResponse.ok) {
          throw new Error(`Direct fetch failed: ${directResponse.status} ${directResponse.statusText}`);
        }
        
        const directData = await directResponse.json();
        console.log("Direct fetch result:", directData);
      } catch (directError) {
        console.error("Direct endpoint check failed:", directError);
      }
      
      // Test with our GraphQL client function
      const response = await fetchGraphQL(
        endpoint,
        "GetLiquidityPools",
        GET_LIQUIDITY_POOLS
      );
      
      console.log("GraphQL response:", response);
      setResult(response);
    } catch (err) {
      console.error("Error testing endpoint:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>GraphQL Debug Tool</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex space-x-2">
            <select 
              className="px-3 py-2 border rounded-md"
              value={network}
              onChange={(e) => setNetwork(e.target.value)}
            >
              {Object.keys(GRAPHQL_ENDPOINTS).map(net => (
                <option key={net} value={net}>{net}</option>
              ))}
            </select>
            <Button 
              onClick={testEndpoint} 
              disabled={loading}
            >
              {loading ? "Testing..." : "Test Endpoint"}
            </Button>
          </div>
          
          {error && (
            <div className="p-4 bg-red-50 text-red-500 rounded-md">
              <p className="font-semibold">Error:</p>
              <pre className="overflow-auto text-xs">{error}</pre>
            </div>
          )}
          
          {result && (
            <div className="space-y-2">
              <p className="font-semibold">Response:</p>
              <pre className="p-4 bg-gray-100 rounded-md overflow-auto max-h-96 text-xs">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 