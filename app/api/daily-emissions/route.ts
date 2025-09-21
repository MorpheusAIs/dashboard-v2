import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, formatUnits } from 'viem';
import { mainnet, sepolia } from 'wagmi/chains';
import { getContractAddress, NetworkEnvironment, testnetChains, mainnetChains } from '@/config/networks';

// Cache for daily emissions data
interface DailyEmissionsCache {
  dailyEmissions: number;
  timestamp: number;
  networkEnvironment: NetworkEnvironment;
  expiresAt: number; // When this cache entry expires (24 hours from creation)
}

// In-memory cache (in production, this should be Redis or similar)
let emissionsCache: DailyEmissionsCache | null = null;

const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function GET(request: NextRequest) {
  try {
    console.log('🎯 [DAILY EMISSIONS API] Starting daily emissions fetch...');

    // Get network environment from query params
    const { searchParams } = new URL(request.url);
    const networkEnv = searchParams.get('networkEnv') as NetworkEnvironment;

    if (!networkEnv || (networkEnv !== 'mainnet' && networkEnv !== 'testnet')) {
      console.log('❌ Invalid network environment:', networkEnv);
      return NextResponse.json(
        { error: 'Invalid or missing network environment. Must be "mainnet" or "testnet"' },
        { status: 400 }
      );
    }

    // Check cache first
    const now = Date.now();
    if (emissionsCache &&
        emissionsCache.networkEnvironment === networkEnv &&
        emissionsCache.expiresAt > now) {
      console.log('📦 [DAILY EMISSIONS API] Using cached data:', {
        dailyEmissions: emissionsCache.dailyEmissions,
        cachedAt: new Date(emissionsCache.timestamp).toISOString(),
        expiresAt: new Date(emissionsCache.expiresAt).toISOString(),
        cacheAgeMinutes: Math.floor((now - emissionsCache.timestamp) / (1000 * 60))
      });

      return NextResponse.json({
        success: true,
        dailyEmissions: emissionsCache.dailyEmissions,
        networkEnv,
        cached: true,
        timestamp: emissionsCache.timestamp,
        cacheExpiresAt: emissionsCache.expiresAt
      });
    }

    console.log('🔄 [DAILY EMISSIONS API] Cache miss or expired, fetching fresh data...');

    // Determine chain and RPC URLs based on network environment
    const chain = networkEnv === 'mainnet' ? mainnet : sepolia;
    const chains = networkEnv === 'mainnet' ? mainnetChains : testnetChains;
    const l1Chain = Object.values(chains).find(c => c.isL1);

    if (!l1Chain) {
      throw new Error(`No L1 chain found for network environment: ${networkEnv}`);
    }

    // Get reward pool contract address
    const rewardPoolAddress = getContractAddress(l1Chain.id, 'rewardPoolV2', networkEnv);
    if (!rewardPoolAddress) {
      throw new Error(`No reward pool contract address found for ${networkEnv}`);
    }

    console.log('🔗 [DAILY EMISSIONS API] Contract details:', {
      networkEnv,
      chainId: l1Chain.id,
      rewardPoolAddress,
      rpcUrls: l1Chain.rpcUrls.default.http.slice(0, 1) // Log first RPC URL only for security
    });

    // Create viem public client
    const publicClient = createPublicClient({
      chain,
      transport: http(l1Chain.rpcUrls.default.http[0]) // Use first RPC URL
    });

    // Calculate time range for last 24 hours
    const nowSeconds = Math.floor(now / 1000);
    const oneDayAgo = nowSeconds - (24 * 60 * 60);

    console.log('⏰ [DAILY EMISSIONS API] Time range:', {
      now: nowSeconds,
      oneDayAgo,
      rangeSeconds: nowSeconds - oneDayAgo
    });

    // Call RewardPoolV2.getPeriodRewards()
    console.log('🚀 [DAILY EMISSIONS API] Calling getPeriodRewards...');
    const startTime = Date.now();

    // Convert to uint128 (max value for uint128 is 2^128 - 1)
    const maxUint128 = BigInt('340282366920938463463374607431768211455');
    const startTimeUint128 = BigInt(Math.min(Number(oneDayAgo), Number(maxUint128)));
    const endTimeUint128 = BigInt(Math.min(Number(nowSeconds), Number(maxUint128)));

    console.log('🔢 [DAILY EMISSIONS API] Converted parameters:', {
      originalStart: oneDayAgo,
      originalEnd: nowSeconds,
      uint128Start: startTimeUint128,
      uint128End: endTimeUint128
    });

    const result = await publicClient.readContract({
      address: rewardPoolAddress as `0x${string}`,
      abi: [
        {
          inputs: [
            { name: 'index_', type: 'uint256' },
            { name: 'startTime_', type: 'uint128' },
            { name: 'endTime_', type: 'uint128' }
          ],
          name: 'getPeriodRewards',
          outputs: [{ name: '', type: 'uint256' }],
          stateMutability: 'view',
          type: 'function'
        }
      ],
      functionName: 'getPeriodRewards',
      args: [BigInt(0), startTimeUint128, endTimeUint128] // Pool index 0 (Capital)
    });

    const contractCallDuration = Date.now() - startTime;
    console.log(`⏱️ [DAILY EMISSIONS API] Contract call completed in ${contractCallDuration}ms`);

    // Format the result
    const dailyEmissionsRaw = result as bigint;
    const dailyEmissions = Number(formatUnits(dailyEmissionsRaw, 18)); // MOR token has 18 decimals

    console.log('💰 [DAILY EMISSIONS API] Contract result:', {
      rawValue: dailyEmissionsRaw.toString(),
      formattedValue: dailyEmissions,
      decimals: 18
    });

    // Cache the result
    emissionsCache = {
      dailyEmissions,
      timestamp: now,
      networkEnvironment: networkEnv,
      expiresAt: now + CACHE_DURATION_MS
    };

    console.log('✅ [DAILY EMISSIONS API] Data cached and ready for response');

    const response = {
      success: true,
      dailyEmissions,
      networkEnv,
      cached: false,
      timestamp: now,
      cacheExpiresAt: emissionsCache.expiresAt,
      debug: {
        contractCallDuration,
        rawValue: dailyEmissionsRaw.toString(),
        formattedValue: dailyEmissions
      }
    };

    console.log('📤 [DAILY EMISSIONS API] Sending response:', JSON.stringify(response, null, 2));
    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ [DAILY EMISSIONS API] Error details:');
    console.error('  - Error type:', typeof error);
    console.error('  - Error message:', error instanceof Error ? error.message : String(error));
    console.error('  - Error stack:', error instanceof Error ? error.stack : 'No stack available');

    const errorResponse = {
      success: false,
      dailyEmissions: 0,
      error: error instanceof Error ? error.message : 'Failed to fetch daily emissions data',
      timestamp: Date.now()
    };

    console.log('💥 [DAILY EMISSIONS API] Sending error response:', JSON.stringify(errorResponse, null, 2));
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
