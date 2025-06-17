"use client";

import React from 'react';
import { useGraphQLClientAdapter } from '@/app/services/graphql-client.adapter';
import { useNetwork } from '@/context/network-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDownIcon, RefreshCcwIcon } from 'lucide-react';

/**
 * Debug component to show local contract data when in local_test mode
 * Helps developers see what data is being read from local contracts
 */
export function LocalDataDebug() {
  const { isLocalTest } = useNetwork();
  const adapter = useGraphQLClientAdapter();
  
  // Only show in local test mode
  if (!isLocalTest || !adapter.isUsingLocalData) {
    return null;
  }

  const handleRefresh = async () => {
    await adapter.refresh();
  };

  const subnets = adapter.getBuilderSubnets();
  const projects = adapter.getBuilderProjects();

  return (
    <Card className="mb-6 bg-orange-50 border-orange-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🛠️ Local Contract Data Debug
          <Badge variant="secondary" className="bg-orange-100 text-orange-800">
            {adapter.dataSource}
          </Badge>
        </CardTitle>
        <CardDescription>
          Data read directly from your local Anvil contracts (Chain ID: {adapter.debug.chainId})
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${adapter.loading ? 'bg-yellow-400' : 'bg-green-400'}`} />
            <span className="text-sm">
              {adapter.loading ? 'Loading...' : 'Connected'}
            </span>
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleRefresh}
            disabled={adapter.loading}
          >
            <RefreshCcwIcon className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>

        {/* Error */}
        {adapter.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            ⚠️ {adapter.error}
          </div>
        )}

        {/* Data Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-white rounded border">
            <div className="text-2xl font-bold text-orange-600">{subnets.length}</div>
            <div className="text-sm text-gray-600">Subnets Found</div>
          </div>
          <div className="text-center p-3 bg-white rounded border">
            <div className="text-2xl font-bold text-orange-600">{projects.length}</div>
            <div className="text-sm text-gray-600">Builder Pools Found</div>
          </div>
        </div>

        {/* Subnets */}
        {subnets.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left p-2 hover:bg-white rounded">
              <ChevronDownIcon className="w-4 h-4" />
              <span className="font-medium">Discovered Subnets ({subnets.length})</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 mt-2">
              {subnets.map((subnet) => (
                <div key={subnet.id} className="p-3 bg-white rounded border text-sm">
                  <div className="font-medium">{subnet.name}</div>
                  <div className="text-gray-600">ID: {subnet.id}</div>
                  <div className="text-gray-600">Owner: {subnet.owner}</div>
                  <div className="text-gray-600">Min Stake: {subnet.minStake} MOR</div>
                  {subnet.description && (
                    <div className="text-gray-600 mt-1">{subnet.description}</div>
                  )}
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Builder Pools */}
        {projects.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left p-2 hover:bg-white rounded">
              <ChevronDownIcon className="w-4 h-4" />
              <span className="font-medium">Builder Pools ({projects.length})</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 mt-2">
              {projects.map((project) => (
                <div key={project.id} className="p-3 bg-white rounded border text-sm">
                  <div className="font-medium">{project.name}</div>
                  <div className="text-gray-600">ID: {project.id}</div>
                  <div className="text-gray-600">Admin: {project.admin}</div>
                  <div className="text-gray-600">Min Deposit: {project.minimalDeposit} MOR</div>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* No Data Message */}
        {!adapter.loading && subnets.length === 0 && projects.length === 0 && (
          <div className="text-center p-6 text-gray-500">
            <div className="text-lg mb-2">📭 No subnets or pools found</div>
            <div className="text-sm">
              Create a subnet on your local network to see it appear here!
            </div>
          </div>
        )}

        {/* Debug Info */}
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left p-2 hover:bg-white rounded">
            <ChevronDownIcon className="w-4 h-4" />
            <span className="font-medium text-gray-600">Debug Info</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto">
              {JSON.stringify(adapter.debug, null, 2)}
            </pre>
          </CollapsibleContent>
        </Collapsible>

      </CardContent>
    </Card>
  );
}