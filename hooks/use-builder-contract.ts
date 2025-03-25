import { useCallback } from 'react';
import { 
  useAccount, 
  useWalletClient, 
  useChainId 
} from 'wagmi';
import { toast } from 'sonner';
import { parseEther } from 'viem';

import { 
  createBuilderPool, 
  BuilderPoolParams, 
  daysToSeconds,
  networkNameToChainId 
} from '@/lib/contracts';

interface SubnetData {
  controllingAddress: string;
  subnetName: string;
  minTime: string;
  minStake: string;
}

export function useBuilderContract() {
  const { data: walletClient } = useWalletClient();
  const { isConnected } = useAccount();
  const chainId = useChainId();

  // Function to convert a subnet from CSV to contract parameters
  const prepareBuilderPoolFromSubnet = useCallback((subnet: SubnetData): BuilderPoolParams => {
    // Extract days from minTime and convert to seconds
    const dayMatch = subnet.minTime.match(/(\d+)/);
    const days = dayMatch ? parseInt(dayMatch[1], 10) : 1; // Default to 1 day
    
    // Current timestamp in seconds
    const now = Math.floor(Date.now() / 1000);
    
    // Claim lock end (30 days from now)
    const claimLockEnd = now + daysToSeconds(30);
    
    return {
      name: subnet.subnetName,
      admin: subnet.controllingAddress as `0x${string}`,
      poolStart: BigInt(now),
      withdrawLockPeriodAfterDeposit: BigInt(daysToSeconds(days)),
      claimLockEnd: BigInt(claimLockEnd),
      minimalDeposit: parseEther(subnet.minStake || '0')
    };
  }, []);
  
  // Function to create a single builder pool
  const createSubnet = useCallback(async (subnet: SubnetData): Promise<boolean> => {
    if (!isConnected || !walletClient) {
      toast.error('Wallet not connected');
      return false;
    }
    
    try {
      const poolParams = prepareBuilderPoolFromSubnet(subnet);
      
      const result = await createBuilderPool(
        walletClient,
        chainId,
        poolParams
      );
      
      if (result.success) {
        toast.success(`Subnet ${subnet.subnetName} created successfully`);
        return true;
      } else {
        toast.error(`Failed to create subnet: ${(result.error as any)?.message || 'Unknown error'}`);
        return false;
      }
    } catch (error: any) {
      toast.error(`Error creating subnet: ${error.message}`);
      return false;
    }
  }, [isConnected, walletClient, chainId, prepareBuilderPoolFromSubnet]);
  
  // Switch network and create subnet
  const createSubnetOnNetwork = useCallback(async (
    subnet: SubnetData, 
    network: 'Arbitrum' | 'Base',
    onNetworkSwitch: () => Promise<void>
  ): Promise<boolean> => {
    const targetChainId = networkNameToChainId[network];
    
    // If not on the correct network, request switch
    if (chainId !== targetChainId) {
      toast.info(`Switching to ${network} network...`);
      await onNetworkSwitch();
      return false; // Will retry after network switch
    }
    
    return createSubnet(subnet);
  }, [chainId, createSubnet]);
  
  return {
    createSubnet,
    createSubnetOnNetwork,
    prepareBuilderPoolFromSubnet,
    isConnected,
    currentChainId: chainId
  };
} 