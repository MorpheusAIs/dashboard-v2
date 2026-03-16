/**
 * scripts/backfill-wallet-addresses.ts
 *
 * Populates the `wallet_address` column on every `builders` row by matching
 * the row's name against the on-chain `admin` field from both:
 *   • Goldsky V4 Base mainnet subgraph
 *   • Goldsky V4 Arbitrum mainnet subgraph
 *
 * Only rows that currently have wallet_address IS NULL are touched.
 * Rows that already have a wallet_address are left unchanged.
 *
 * Run with:
 *   npx tsx scripts/backfill-wallet-addresses.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// ─── config ──────────────────────────────────────────────────────────────────

const ENDPOINTS: Record<string, string> = {
  Base: 'https://api.goldsky.com/api/public/project_cmgzm6igw009l5np264iw7obk/subgraphs/morpheus-mainnet-base-compatible/v0.0.1/gn',
  Arbitrum: 'https://api.goldsky.com/api/public/project_cmgzm6igw009l5np264iw7obk/subgraphs/morpheus-mainnet-arbitrum-compatible/v0.0.1/gn',
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── types ───────────────────────────────────────────────────────────────────

interface OnChainSubnet {
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

async function fetchSubnets(label: string, endpoint: string): Promise<OnChainSubnet[]> {
  const query = `{ buildersProjects(first: 1000, orderBy: totalStaked, orderDirection: desc) { name admin } }`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`[${label}] HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(`[${label}] GraphQL errors: ${JSON.stringify(json.errors)}`);
  return (json.data?.buildersProjects ?? []) as OnChainSubnet[];
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Fetch on-chain data from both networks
  const allOnChain = new Map<string, string>(); // lowercase name → admin address

  for (const [label, endpoint] of Object.entries(ENDPOINTS)) {
    console.log(`🔍  Fetching ${label} subnets from Goldsky V4…`);
    const subnets = await fetchSubnets(label, endpoint);
    console.log(`    Found ${subnets.length} on-chain subnets on ${label}`);
    for (const s of subnets) {
      if (s.name && s.admin) {
        const key = s.name.toLowerCase().trim();
        // Base takes priority if the same name exists on both chains
        if (!allOnChain.has(key)) {
          allOnChain.set(key, s.admin.toLowerCase());
        }
      }
    }
  }
  console.log(`\n    Combined on-chain index: ${allOnChain.size} unique subnet names\n`);

  // 2. Fetch ALL Supabase builders that are missing wallet_address
  console.log('🗄   Fetching builders missing wallet_address from Supabase…');
  const { data, error } = await supabase
    .from('builders')
    .select('id, name, networks, wallet_address')
    .is('wallet_address', null);

  if (error) throw new Error(`Supabase fetch failed: ${error.message}`);

  const rows = (data ?? []) as BuilderRow[];
  console.log(`    Found ${rows.length} rows missing wallet_address\n`);

  // 3. Match and update
  let updated = 0;
  let skippedNoMatch = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const key = row.name?.toLowerCase().trim();
    const adminAddress = allOnChain.get(key);

    if (!adminAddress) {
      console.log(`  ⚠️   No on-chain match for "${row.name}"`);
      skippedNoMatch++;
      continue;
    }

    console.log(`  ✏️   Updating "${row.name}" → ${adminAddress}`);

    const { error: updateError } = await supabase
      .from('builders')
      .update({ wallet_address: adminAddress, updated_at: new Date().toISOString() })
      .eq('id', row.id);

    if (updateError) {
      console.error(`  ❌  Failed to update "${row.name}": ${updateError.message}`);
      errors.push(`${row.name}: ${updateError.message}`);
    } else {
      updated++;
    }
  }

  // 4. Summary
  console.log('\n─────────────────────────────────────────');
  console.log(`✅  Updated:           ${updated}`);
  console.log(`🔍  No on-chain match: ${skippedNoMatch}`);
  if (errors.length > 0) {
    console.log(`❌  Errors:           ${errors.length}`);
    errors.forEach((e) => console.log(`     • ${e}`));
  }
  console.log('─────────────────────────────────────────\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
