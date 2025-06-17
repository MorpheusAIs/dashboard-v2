import { usePublicClient } from 'wagmi';
import { Address } from 'viem';
import { useEffect, useState, useCallback } from 'react';
import { NetworkEnvironment, getContractAddress } from '@/config/networks';
import { 
  BuilderProject, 
  BuilderSubnet, 
  CombinedBuilderSubnetsResponse 
} from '@/lib/types/graphql';

// Import ABIs
import BuildersAbi from '@/app/abi/Builders.json';
import BuilderSubnetsV2Abi from '@/app/abi/BuilderSubnetsV2.json';

interface LocalSubnet {
  id: string;
  name: string;
  owner: Address;
  minStake: bigint;
  fee: bigint;
  feeTreasury: Address;
  startsAt: bigint;
  withdrawLockPeriodAfterStake: bigint;
  maxClaimLockEnd: bigint;
  slug?: string;
  description?: string;
  website?: string;
  image?: string;
  totalStaked?: bigint;
  totalUsers?: number;
  stakers?: LocalStaker[];
}

interface LocalStaker {
  address: Address;
  staked: bigint;
  virtualStaked: bigint;
  pendingRewards: bigint;
  rate: bigint;
  lastStake: bigint;
  claimLockEnd: bigint;
}

interface LocalPool {
  id: string;
  name: string;
  admin: Address;
  poolStart: bigint;
  withdrawLockPeriodAfterDeposit: bigint;
  claimLockEnd: bigint;
  minimalDeposit: bigint;
  totalStaked?: bigint;
  totalUsers?: number;
  users?: LocalUser[];
}

interface LocalUser {
  address: Address;
  lastDeposit: bigint;
  claimLockStart: bigint;
  deposited: bigint;
  virtualDeposited: bigint;
}

// Event log types
interface SubnetCreatedLog {
  args?: {
    subnetId?: string;
    name?: string;
  };
}

interface BuilderPoolCreatedLog {
  args?: {
    builderPoolId?: string;
  };
}

/**
 * Hook to read data from local contracts for testing
 * Provides data in GraphQL-compatible format
 */
export function useLocalContractData(environment: NetworkEnvironment, chainId?: number) {
  const [subnets, setSubnets] = useState<LocalSubnet[]>([]);
  const [pools, setPools] = useState<LocalPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const publicClient = usePublicClient({ chainId });
  const isLocalTest = environment === 'local_test';
  
  // Get contract addresses
  const buildersAddress = chainId ? getContractAddress(chainId, 'builders', environment) : '';
  
  // Track discovered subnet/pool IDs
  const [discoveredSubnetIds, setDiscoveredSubnetIds] = useState<Set<string>>(new Set());
  const [discoveredPoolIds, setDiscoveredPoolIds] = useState<Set<string>>(new Set());

  // Listen for creation events to discover subnets/pools
  const discoverCreatedItems = useCallback(async () => {
    if (!publicClient || !buildersAddress || !isLocalTest) return;

    try {
      setLoading(true);
      console.log('🔍 Discovering created subnets/pools from events...');

      // For BuilderSubnetsV2 (testnet-style), listen for SubnetCreated events
      if (chainId === 42161 || chainId === 8453) { // Arbitrum or Base
        try {
          // Get subnet creation events
          const subnetLogs = await publicClient.getLogs({
            address: buildersAddress as Address,
            event: {
              type: 'event',
              name: 'SubnetCreated',
              inputs: [
                { type: 'bytes32', name: 'subnetId', indexed: true },
                { type: 'string', name: 'name', indexed: false },
              ]
            },
            fromBlock: 'earliest',
            toBlock: 'latest',
          });

          subnetLogs.forEach((log: SubnetCreatedLog) => {
            const subnetId = log.args?.subnetId;
            if (subnetId) {
              setDiscoveredSubnetIds(prev => {
                if (prev.has(subnetId)) return prev; // no change
                const updated = new Set(prev);
                updated.add(subnetId);
                return updated;
              });

              // Safely log the name if present
              const namePart = log.args?.name ? `: ${log.args.name}` : '';
              console.log(`📝 Found subnet${namePart} (${subnetId})`);
            }
          });

        } catch (subnetErr) {
          console.log('ℹ️ No SubnetCreated events found, trying BuilderPoolCreated...', subnetErr);
          
          // Try for BuilderPoolCreated events (mainnet-style)
          const poolLogs = await publicClient.getLogs({
            address: buildersAddress as Address,
            event: {
              type: 'event',
              name: 'BuilderPoolCreated',
              inputs: [
                { type: 'bytes32', name: 'builderPoolId', indexed: true },
              ]
            },
            fromBlock: 'earliest',
            toBlock: 'latest',
          });

          poolLogs.forEach((log: BuilderPoolCreatedLog) => {
            const poolId = log.args?.builderPoolId;
            if (poolId) {
              setDiscoveredPoolIds(prev => {
                if (prev.has(poolId)) return prev;
                const updated = new Set(prev);
                updated.add(poolId);
                return updated;
              });
              console.log(`📝 Found pool: ${poolId}`);
            }
          });
        }
      }
    } catch (err) {
      console.error('Error discovering created items:', err);
      setError('Failed to discover subnets/pools');
    } finally {
      setLoading(false);
    }
  }, [publicClient, buildersAddress, isLocalTest, chainId]);

  // Read subnet data from contract
  const readSubnetData = useCallback(async (subnetId: string): Promise<LocalSubnet | null> => {
    if (!publicClient || !buildersAddress) return null;

    try {
      // Read basic subnet info
      const subnetInfo = await publicClient.readContract({
        address: buildersAddress as Address,
        abi: BuilderSubnetsV2Abi,
        functionName: 'subnets',
        args: [subnetId],
      }) as [string, Address, bigint, bigint, Address, bigint, bigint, bigint];

      // Read subnet metadata
      const subnetMetadata = await publicClient.readContract({
        address: buildersAddress as Address,
        abi: BuilderSubnetsV2Abi,
        functionName: 'subnetsMetadata',
        args: [subnetId],
      }) as [string, string, string, string];

      // Read subnet staking data
      const subnetData = await publicClient.readContract({
        address: buildersAddress as Address,
        abi: BuilderSubnetsV2Abi,
        functionName: 'subnetsData',
        args: [subnetId],
      }) as [bigint, bigint];

      return {
        id: subnetId,
        name: subnetInfo[0],
        owner: subnetInfo[1],
        minStake: subnetInfo[2],
        fee: subnetInfo[3],
        feeTreasury: subnetInfo[4],
        startsAt: subnetInfo[5],
        withdrawLockPeriodAfterStake: subnetInfo[6],
        maxClaimLockEnd: subnetInfo[7],
        slug: subnetMetadata[0],
        description: subnetMetadata[1],
        website: subnetMetadata[2],
        image: subnetMetadata[3],
        totalStaked: subnetData[0],
        totalUsers: 0, // We'll count this separately
        stakers: [],
      };
    } catch (err) {
      console.error(`Error reading subnet ${subnetId}:`, err);
      return null;
    }
  }, [publicClient, buildersAddress]);

  // Read pool data from contract
  const readPoolData = useCallback(async (poolId: string): Promise<LocalPool | null> => {
    if (!publicClient || !buildersAddress) return null;

    try {
      // Read pool info
      const poolInfo = await publicClient.readContract({
        address: buildersAddress as Address,
        abi: BuildersAbi,
        functionName: 'builderPools',
        args: [poolId],
      }) as [string, Address, bigint, bigint, bigint, bigint];

      return {
        id: poolId,
        name: poolInfo[0],
        admin: poolInfo[1],
        poolStart: poolInfo[2],
        withdrawLockPeriodAfterDeposit: poolInfo[3],
        claimLockEnd: poolInfo[4],
        minimalDeposit: poolInfo[5],
        totalUsers: 0,
        users: [],
      };
    } catch (err) {
      console.error(`Error reading pool ${poolId}:`, err);
      return null;
    }
  }, [publicClient, buildersAddress]);

  // Load all subnet/pool data
  useEffect(() => {
    if (!isLocalTest) return;

    const loadData = async () => {
      try {
        setLoading(true);

        // Load subnets
        const subnetPromises = Array.from(discoveredSubnetIds).map(readSubnetData);
        const subnetResults = await Promise.all(subnetPromises);
        const validSubnets = subnetResults.filter((s): s is LocalSubnet => s !== null);
        setSubnets(validSubnets);

        // Load pools
        const poolPromises = Array.from(discoveredPoolIds).map(readPoolData);
        const poolResults = await Promise.all(poolPromises);
        const validPools = poolResults.filter((p): p is LocalPool => p !== null);
        setPools(validPools);

        console.log(`✅ Loaded ${validSubnets.length} subnets and ${validPools.length} pools`);
      } catch (err) {
        console.error('Error loading contract data:', err);
        setError('Failed to load contract data');
      } finally {
        setLoading(false);
      }
    };

    if (discoveredSubnetIds.size > 0 || discoveredPoolIds.size > 0) {
      loadData();
    }
  }, [discoveredSubnetIds, discoveredPoolIds, readSubnetData, readPoolData, isLocalTest]);

  // Initial discovery
  useEffect(() => {
    if (isLocalTest && publicClient && buildersAddress) {
      discoverCreatedItems();
    }
  }, [isLocalTest, publicClient, buildersAddress, discoverCreatedItems]);

  // Transform to GraphQL format
  const getBuilderSubnets = useCallback((): BuilderSubnet[] => {
    return subnets.map(subnet => ({
      id: subnet.id,
      name: subnet.name,
      owner: subnet.owner,
      minStake: subnet.minStake.toString(),
      fee: subnet.fee.toString(),
      feeTreasury: subnet.feeTreasury,
      startsAt: subnet.startsAt.toString(),
      withdrawLockPeriodAfterStake: subnet.withdrawLockPeriodAfterStake.toString(),
      maxClaimLockEnd: subnet.maxClaimLockEnd.toString(),
      slug: subnet.slug || '',
      description: subnet.description || '',
      website: subnet.website || '',
      image: subnet.image || '',
      totalStaked: subnet.totalStaked?.toString() || '0',
      totalClaimed: '0', // TODO: Calculate from events
      totalUsers: subnet.totalUsers?.toString() || '0',
      builderUsers: subnet.stakers?.map(staker => ({
        id: `${subnet.id}-${staker.address}`,
        address: staker.address,
        staked: staker.staked.toString(),
        claimed: '0', // TODO: Calculate from events
        claimLockEnd: staker.claimLockEnd.toString(),
        lastStake: staker.lastStake.toString(),
      })) || [],
    }));
  }, [subnets]);

  const getBuilderProjects = useCallback((): BuilderProject[] => {
    return pools.map(pool => ({
      id: pool.id,
      name: pool.name,
      admin: pool.admin,
      claimLockEnd: pool.claimLockEnd.toString(),
      minimalDeposit: pool.minimalDeposit.toString(),
      startsAt: pool.poolStart.toString(),
      totalClaimed: '0', // TODO: Calculate
      totalStaked: pool.totalStaked?.toString() || '0',
      totalUsers: pool.totalUsers?.toString() || '0',
      withdrawLockPeriodAfterDeposit: pool.withdrawLockPeriodAfterDeposit.toString(),
    }));
  }, [pools]);

  // API-compatible functions
  const getCombinedBuilderSubnets = useCallback((): CombinedBuilderSubnetsResponse => {
    return {
      builderSubnets: getBuilderSubnets(),
      builderUsers: [], // TODO: Implement user queries
      counters: [{
        id: 'local',
        totalSubnets: subnets.length.toString(),
        totalBuilderProjects: pools.length.toString(),
      }],
    };
  }, [getBuilderSubnets, subnets.length, pools.length]);

  return {
    // Data
    subnets: getBuilderSubnets(),
    pools: getBuilderProjects(),
    
    // API-compatible responses
    getCombinedBuilderSubnets,
    
    // State
    loading,
    error,
    isLocalTest,
    
    // Actions
    refresh: discoverCreatedItems,
    
    // Raw data for debugging
    raw: {
      subnets,
      pools,
      discoveredSubnetIds: Array.from(discoveredSubnetIds),
      discoveredPoolIds: Array.from(discoveredPoolIds),
    }
  };
}