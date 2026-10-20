import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, fallback, http, formatUnits, type PublicClient } from 'viem';
import { mainnet, sepolia } from 'wagmi/chains';
import { getContractAddress, mainnetChains, testnetChains, type NetworkEnvironment } from '@/config/networks';
import { getAssetsForNetwork, type AssetSymbol } from '@/components/capital/constants/asset-config';

export const dynamic = 'force-dynamic';

/**
 * GET /api/capital/unlocked-apr?network=mainnet|testnet
 *
 * MOR credited per deposited token per year to an unlocked (1×) depositor, measured over the
 * last ~30 days for each capital deposit pool. The client turns this into an APR with live
 * MOR and asset prices.
 *
 * DepositPool.rewardPoolsData(0).rate is the cumulative MOR per virtual deposit unit (scaled by
 * 1e25). A 1× depositor holds one virtual unit per token, so the change in `rate` between two
 * contract updates is exactly what an unlocked deposit earned, independent of lockers.
 *
 * Reads past blocks, so it needs an archive RPC. Results are cached for an hour.
 */

const WINDOW_DAYS = 30;
// If a pool had no contract update inside the window, widen it rather than show nothing.
const FALLBACK_WINDOW_DAYS = [60, 90, 180];
const CACHE_TTL_MS = 60 * 60 * 1000;
const SECONDS_PER_YEAR = BigInt(365 * 24 * 60 * 60);
const RATE_PRECISION = BigInt(10) ** BigInt(25);

const ASSET_TO_DEPOSIT_POOL_KEY: Partial<Record<AssetSymbol, keyof import('@/config/networks').ContractAddresses>> = {
  stETH: 'stETHDepositPool',
  LINK: 'linkDepositPool',
  USDC: 'usdcDepositPool',
  USDT: 'usdtDepositPool',
  wBTC: 'wbtcDepositPool',
  wETH: 'wethDepositPool',
};

const rewardPoolsDataAbi = [
  {
    inputs: [{ name: '', type: 'uint256' }],
    name: 'rewardPoolsData',
    outputs: [
      { name: 'lastUpdate', type: 'uint128' },
      { name: 'rate', type: 'uint256' },
      { name: 'totalVirtualDeposited', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export interface UnlockedRate {
  morPerTokenPerYear: number; // MOR credited per whole deposited token per year at 1×
  windowStart: number; // lastUpdate (unix seconds) at the start of the measured window
  windowEnd: number; // lastUpdate (unix seconds) at the end of the measured window
  lookbackDays: number; // how far back the start block was taken (30 unless widened)
}

export interface UnlockedRatesResponse {
  network: NetworkEnvironment;
  computedAt: number;
  pools: Partial<Record<AssetSymbol, UnlockedRate>>;
}

const cache: Partial<Record<NetworkEnvironment, { data: UnlockedRatesResponse; expiresAt: number }>> = {};
const inFlight: Partial<Record<NetworkEnvironment, Promise<UnlockedRatesResponse>>> = {};

function getL1Client(network: NetworkEnvironment): PublicClient {
  const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  const hasAlchemyKey = !!alchemyKey && !alchemyKey.startsWith('your');
  const alchemyUrl = network === 'mainnet'
    ? `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`
    : `https://eth-sepolia.g.alchemy.com/v2/${alchemyKey}`;
  const configuredUrls = (network === 'mainnet' ? mainnetChains.mainnet : testnetChains.sepolia).rpcUrls.default.http
    .filter((url) => !url.endsWith('/undefined'));
  const urls = hasAlchemyKey ? [alchemyUrl, ...configuredUrls] : configuredUrls;

  return createPublicClient({
    chain: network === 'mainnet' ? mainnet : sepolia,
    transport: fallback(urls.map((url) => http(url))),
  }) as PublicClient;
}

// First block at or after targetTs, by binary search on timestamps.
async function findBlockAtOrAfter(client: PublicClient, targetTs: number, latest: { number: bigint; timestamp: bigint }): Promise<bigint> {
  const avgBlockTime = 12;
  let low = latest.number - BigInt(Math.ceil(((Number(latest.timestamp) - targetTs) / avgBlockTime) * 1.25));
  if (low < BigInt(0)) low = BigInt(0);
  // Make sure `low` is before the target; step further back if blocks were faster than assumed.
  while (low > BigInt(0) && Number((await client.getBlock({ blockNumber: low })).timestamp) >= targetTs) {
    const gap = latest.number - low;
    low = low > gap ? low - gap : BigInt(0);
  }
  let high = latest.number;
  while (high - low > BigInt(1)) {
    const mid = (low + high) / BigInt(2);
    const block = await client.getBlock({ blockNumber: mid });
    if (Number(block.timestamp) >= targetTs) high = mid; else low = mid;
  }
  return high;
}

async function readPoolData(client: PublicClient, pools: `0x${string}`[], blockNumber: bigint) {
  return client.multicall({
    contracts: pools.map((address) => ({
      address,
      abi: rewardPoolsDataAbi,
      functionName: 'rewardPoolsData' as const,
      args: [BigInt(0)] as const,
    })),
    allowFailure: true,
    blockNumber,
  });
}

async function computeUnlockedRates(network: NetworkEnvironment): Promise<UnlockedRatesResponse> {
  const client = getL1Client(network);
  const l1ChainId = network === 'mainnet' ? mainnet.id : sepolia.id;

  const pools = getAssetsForNetwork(network)
    .map((asset) => {
      const key = ASSET_TO_DEPOSIT_POOL_KEY[asset.metadata.symbol];
      const address = key ? getContractAddress(l1ChainId, key, network) : undefined;
      return address ? { symbol: asset.metadata.symbol, decimals: asset.metadata.decimals, address: address as `0x${string}` } : null;
    })
    .filter((pool): pool is { symbol: AssetSymbol; decimals: number; address: `0x${string}` } => pool !== null);

  const latest = await client.getBlock();
  const nowResults = await readPoolData(client, pools.map((p) => p.address), latest.number);

  const result: UnlockedRatesResponse = { network, computedAt: Date.now(), pools: {} };
  let pending = pools.map((pool, i) => ({ pool, now: nowResults[i] }))
    .filter(({ now }) => now.status === 'success');

  for (const windowDays of [WINDOW_DAYS, ...FALLBACK_WINDOW_DAYS]) {
    if (pending.length === 0) break;
    const targetTs = Number(latest.timestamp) - windowDays * 24 * 60 * 60;
    const pastBlock = await findBlockAtOrAfter(client, targetTs, latest);
    const pastResults = await readPoolData(client, pending.map(({ pool }) => pool.address), pastBlock);

    const stillPending: typeof pending = [];
    pending.forEach((entry, i) => {
      const past = pastResults[i];
      if (past.status !== 'success' || entry.now.status !== 'success') return;
      const [tNow, rNow] = entry.now.result;
      const [tPast, rPast] = past.result;
      if (tNow <= tPast) {
        stillPending.push(entry);
        return;
      }
      const morWeiPerTokenPerYear = ((rNow - rPast) * BigInt(10) ** BigInt(entry.pool.decimals) * SECONDS_PER_YEAR)
        / (RATE_PRECISION * (tNow - tPast));
      result.pools[entry.pool.symbol] = {
        morPerTokenPerYear: Number(formatUnits(morWeiPerTokenPerYear, 18)),
        windowStart: Number(tPast),
        windowEnd: Number(tNow),
        lookbackDays: windowDays,
      };
    });
    pending = stillPending;
  }

  return result;
}

export async function GET(request: NextRequest) {
  const networkParam = request.nextUrl.searchParams.get('network');
  const network: NetworkEnvironment = networkParam === 'testnet' ? 'testnet' : 'mainnet';
  const headers = { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600' };

  const cached = cache[network];
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data, { headers });
  }

  try {
    if (!inFlight[network]) {
      inFlight[network] = computeUnlockedRates(network).finally(() => {
        delete inFlight[network];
      });
    }
    const data = await inFlight[network]!;
    cache[network] = { data, expiresAt: Date.now() + CACHE_TTL_MS };
    return NextResponse.json(data, { headers });
  } catch (error) {
    console.error('[UNLOCKED APR API] Failed to compute credited rates:', error);
    if (cached) {
      return NextResponse.json(cached.data, { headers });
    }
    return NextResponse.json(
      { error: 'Failed to compute credited rates', details: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }
}
