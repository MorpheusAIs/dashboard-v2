/**
 * scripts/backfill-wallet-addresses.ts
 *
 * One-off migration: reads every subnet on the Base mainnet from the Goldsky V4
 * subgraph, matches each one to a row in the Supabase `builders` table by name,
 * and writes the subnet's `admin` address into the `wallet_address` column.
 *
 * Only rows that:
 *   - belong to the "Base" network, AND
 *   - currently have wallet_address IS NULL
 * are touched.  Rows that already have a wallet_address are left unchanged.
 *
 * Run with:
 *   npx tsx scripts/backfill-wallet-addresses.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local from the project root
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// ─── config ──────────────────────────────────────────────────────────────────

const GOLDSKY_ENDPOINT =
  'https://api.goldsky.com/api/public/project_cmgzm6igw009l5np264iw7obk/subgraphs/morpheus-mainnet-base-compatible/v0.0.1/gn';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    '❌  Missing required env vars: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_KEY',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── types ───────────────────────────────────────────────────────────────────

interface OnChainSubnet {
  id: string;
  name: string;
  admin: string;
}

interface BuilderRow {
  id: string;
  name: string;
  networks: string[];
  wallet_address: string | null;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

async function fetchBaseSubnets(): Promise<OnChainSubnet[]> {
  const query = `
    query BackfillBaseSubnets {
      buildersProjects(first: 1000, orderBy: totalStaked, orderDirection: desc) {
        id
        name
        admin
      }
    }
  `;

  const response = await fetch(GOLDSKY_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`Goldsky request failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();

  if (result.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
  }

  return (result.data?.buildersProjects ?? []) as OnChainSubnet[];
}

async function fetchBaseBuilders(): Promise<BuilderRow[]> {
  // Fetch all builders — we'll filter by network client-side to avoid
  // relying on Supabase array-contains syntax differences across versions.
  const { data, error } = await supabase
    .from('builders')
    .select('id, name, networks, wallet_address');

  if (error) throw new Error(`Supabase fetch failed: ${error.message}`);

  // Keep only rows whose networks array contains "Base" (case-insensitive)
  return (data ?? []).filter((row: BuilderRow) =>
    row.networks?.some((n: string) => n.toLowerCase() === 'base'),
  );
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍  Fetching Base subnets from Goldsky V4…');
  const subnets = await fetchBaseSubnets();
  console.log(`    Found ${subnets.length} on-chain subnets on Base\n`);

  console.log('🗄   Fetching Base builders from Supabase…');
  const builders = await fetchBaseBuilders();
  console.log(`    Found ${builders.length} Supabase builder rows on Base\n`);

  // Build a lookup: lowercase name → on-chain subnet
  const subnetByName = new Map<string, OnChainSubnet>();
  for (const s of subnets) {
    if (s.name) subnetByName.set(s.name.toLowerCase().trim(), s);
  }

  let updated = 0;
  let skippedAlreadySet = 0;
  let skippedNoMatch = 0;
  let skippedNoAdmin = 0;
  const errors: string[] = [];

  for (const builder of builders) {
    const key = builder.name?.toLowerCase().trim();

    // Skip if wallet_address is already set
    if (builder.wallet_address) {
      skippedAlreadySet++;
      continue;
    }

    const match = subnetByName.get(key);

    if (!match) {
      console.log(`  ⚠️   No on-chain match for "${builder.name}" (id: ${builder.id})`);
      skippedNoMatch++;
      continue;
    }

    if (!match.admin) {
      console.log(`  ⚠️   On-chain subnet "${match.name}" has no admin address`);
      skippedNoAdmin++;
      continue;
    }

    const adminAddress = match.admin.toLowerCase();
    console.log(`  ✏️   Updating "${builder.name}" → wallet_address = ${adminAddress}`);

    const { error } = await supabase
      .from('builders')
      .update({
        wallet_address: adminAddress,
        updated_at: new Date().toISOString(),
      })
      .eq('id', builder.id);

    if (error) {
      console.error(`  ❌  Failed to update "${builder.name}": ${error.message}`);
      errors.push(`${builder.name}: ${error.message}`);
    } else {
      updated++;
    }
  }

  console.log('\n─────────────────────────────────────────');
  console.log(`✅  Updated:              ${updated}`);
  console.log(`⏭   Already had address:  ${skippedAlreadySet}`);
  console.log(`🔍  No on-chain match:    ${skippedNoMatch}`);
  console.log(`⚠️   No admin on chain:   ${skippedNoAdmin}`);
  if (errors.length > 0) {
    console.log(`❌  Errors:              ${errors.length}`);
    errors.forEach((e) => {
      console.log(`     • ${e}`);
    });
  }
  console.log('─────────────────────────────────────────\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
