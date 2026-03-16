import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BuilderDB } from '@/app/lib/supabase';
import { safeJsonParse } from '@/app/lib/utils/safe-json';
import {
  verifyWalletSignature,
  buildCreateMessage,
  buildUpdateMessage,
  isAdminWallet,
} from '@/app/lib/utils/verify-signature';

const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

interface MorlordBuilder {
  name: string;
  [key: string]: string | number;
}

export async function GET() {
  try {
    const response = await fetch('https://morlord.com/data/builders.json', {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const builderNames = Object.values(data as Record<string, MorlordBuilder>).map(
      (builder) => builder.name,
    );

    return NextResponse.json(builderNames, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch {
    return NextResponse.json([], {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }
}

// ─── POST — create a builder record ──────────────────────────────────────────
// Required body fields: walletAddress, signature, timestamp, name, networks
export async function POST(request: NextRequest) {
  try {
    const body = await safeJsonParse(request);
    const { walletAddress, signature, timestamp, ...builderData } = body;

    // --- auth ---
    if (!walletAddress || !signature || !timestamp) {
      return NextResponse.json(
        { error: 'walletAddress, signature, and timestamp are required.' },
        { status: 401 },
      );
    }

    try {
      await verifyWalletSignature({
        walletAddress,
        signature,
        message: buildCreateMessage(walletAddress, timestamp),
        timestamp,
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Unauthorized' },
        { status: 401 },
      );
    }

    // --- validate payload ---
    if (!builderData.name || !builderData.networks || builderData.networks.length === 0) {
      return NextResponse.json(
        { error: 'Builder name and networks are required.' },
        { status: 400 },
      );
    }

    const dataToInsert: Omit<BuilderDB, 'id' | 'created_at' | 'updated_at'> = {
      name: builderData.name,
      networks: builderData.networks,
      description: builderData.description || null,
      long_description: builderData.long_description || builderData.description || null,
      image_src: builderData.image_src || null,
      tags: builderData.tags || [],
      github_url: builderData.github_url || null,
      twitter_url: builderData.twitter_url || null,
      discord_url: builderData.discord_url || null,
      contributors: builderData.contributors || 0,
      github_stars: builderData.github_stars || 0,
      reward_types: builderData.reward_types || [],
      reward_types_detail: builderData.reward_types_detail || [],
      website: builderData.website || null,
      wallet_address: walletAddress.toLowerCase(),
    };

    const { data, error } = await supabaseService
      .from('builders')
      .insert(dataToInsert)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH — update a builder record ─────────────────────────────────────────
// Required body fields: id, walletAddress, signature, timestamp
// Only the record's owner wallet (or an admin wallet) may update.
export async function PATCH(request: NextRequest) {
  try {
    const body = await safeJsonParse(request);
    const { id, walletAddress, signature, timestamp, ...updateData } = body;

    // --- validate required fields ---
    if (!id) {
      return NextResponse.json(
        { error: 'Builder ID is required for updates.' },
        { status: 400 },
      );
    }

    if (!walletAddress || !signature || !timestamp) {
      return NextResponse.json(
        { error: 'walletAddress, signature, and timestamp are required.' },
        { status: 401 },
      );
    }

    // --- verify signature ---
    try {
      await verifyWalletSignature({
        walletAddress,
        signature,
        message: buildUpdateMessage(id, walletAddress, timestamp),
        timestamp,
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Unauthorized' },
        { status: 401 },
      );
    }

    // --- fetch the record to check ownership ---
    const { data: existing, error: fetchError } = await supabaseService
      .from('builders')
      .select('wallet_address')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Builder not found.' }, { status: 404 });
    }

    const recordOwner: string | null = existing.wallet_address ?? null;
    const callerIsAdmin = isAdminWallet(walletAddress);

    if (recordOwner) {
      // Record has an owner — only the owner or an admin may update.
      if (
        recordOwner.toLowerCase() !== walletAddress.toLowerCase() &&
        !callerIsAdmin
      ) {
        return NextResponse.json(
          { error: 'You are not authorised to update this builder record.' },
          { status: 403 },
        );
      }
    } else {
      // Legacy record with no stored owner — require admin wallet.
      if (!callerIsAdmin) {
        return NextResponse.json(
          {
            error:
              'This is a legacy record with no registered owner. Only an admin wallet may update it.',
          },
          { status: 403 },
        );
      }
    }

    const dataToUpdate = {
      ...updateData,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseService
      .from('builders')
      .update(dataToUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
