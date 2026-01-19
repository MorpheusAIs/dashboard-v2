import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
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
  // Collect logs for deferred output via after()
  const logs: Array<{ level: 'log' | 'error'; message: string; data?: unknown }> = [];
  const addLog = (level: 'log' | 'error', message: string, data?: unknown) => {
    logs.push({ level, message, data });
  };

  try {
    addLog('log', '🎯 [DAILY EMISSIONS API] Starting daily emissions fetch...');

    // Get network environment from query params, default to mainnet for safety
    const searchParams = request.nextUrl.searchParams;
    const networkEnvParam = searchParams.get('networkEnv') || searchParams.get('network');
    const networkEnv = (networkEnvParam === 'testnet' ? 'testnet' : 'mainnet') as NetworkEnvironment;

    addLog('log', '🌐 [DAILY EMISSIONS API] Network environment:', {
      param: networkEnvParam,
      resolved: networkEnv
    });

    // Check cache first
    const now = Date.now();
    if (emissionsCache &&
        emissionsCache.networkEnvironment === networkEnv &&
        emissionsCache.expiresAt > now) {
      addLog('log', '📦 [DAILY EMISSIONS API] Using cached data:', {
        dailyEmissions: emissionsCache.dailyEmissions,
        cachedAt: new Date(emissionsCache.timestamp).toISOString(),
        expiresAt: new Date(emissionsCache.expiresAt).toISOString(),
        cacheAgeMinutes: Math.floor((now - emissionsCache.timestamp) / (1000 * 60))
      });

      // Defer logging to after response is sent
      after(() => {
        logs.forEach(({ level, message, data }) => {
          if (data) console[level](message, data);
          else console[level](message);
        });
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

    addLog('log', '🔄 [DAILY EMISSIONS API] Cache miss or expired, fetching fresh data...');

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

    addLog('log', '🔗 [DAILY EMISSIONS API] Contract details:', {
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

    addLog('log', '⏰ [DAILY EMISSIONS API] Time range:', {
      now: nowSeconds,
      oneDayAgo,
      rangeSeconds: nowSeconds - oneDayAgo
    });

    // Call RewardPoolV2.getPeriodRewards()
    addLog('log', '🚀 [DAILY EMISSIONS API] Calling getPeriodRewards...');
    const startTime = Date.now();

    // Convert to uint128 (max value for uint128 is 2^128 - 1)
    const maxUint128 = BigInt('340282366920938463463374607431768211455');
    const startTimeUint128 = BigInt(Math.min(Number(oneDayAgo), Number(maxUint128)));
    const endTimeUint128 = BigInt(Math.min(Number(nowSeconds), Number(maxUint128)));

    addLog('log', '🔢 [DAILY EMISSIONS API] Converted parameters:', {
      originalStart: oneDayAgo,
      originalEnd: nowSeconds,
      uint128Start: startTimeUint128.toString(),
      uint128End: endTimeUint128.toString()
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
    addLog('log', `⏱️ [DAILY EMISSIONS API] Contract call completed in ${contractCallDuration}ms`);

    // Format the result
    const dailyEmissionsRaw = result as bigint;
    const dailyEmissions = Number(formatUnits(dailyEmissionsRaw, 18)); // MOR token has 18 decimals

    addLog('log', '💰 [DAILY EMISSIONS API] Contract result:', {
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

    addLog('log', '✅ [DAILY EMISSIONS API] Data cached and ready for response');

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

    // Defer logging to after response is sent (non-blocking)
    after(() => {
      logs.forEach(({ level, message, data }) => {
        if (data) console[level](message, data);
        else console[level](message);
      });
      console.log('📤 [DAILY EMISSIONS API] Response sent successfully');
    });

    return NextResponse.json(response);

  } catch (error) {
    addLog('error', '❌ [DAILY EMISSIONS API] Error details:');
    addLog('error', `  - Error type: ${typeof error}`);
    addLog('error', `  - Error message: ${error instanceof Error ? error.message : String(error)}`);

    const errorResponse = {
      success: false,
      dailyEmissions: 0,
      error: error instanceof Error ? error.message : 'Failed to fetch daily emissions data',
      timestamp: Date.now()
    };

    // Defer error logging to after response is sent
    after(() => {
      logs.forEach(({ level, message, data }) => {
        if (data) console[level](message, data);
        else console[level](message);
      });
      if (error instanceof Error && error.stack) {
        console.error('  - Error stack:', error.stack);
      }
    });

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
