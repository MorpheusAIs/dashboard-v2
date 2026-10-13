import { NextRequest, NextResponse } from 'next/server';
import {
  createFeaturebaseChallenge,
  FeaturebaseConfigError,
} from '@/app/lib/utils/featurebase-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getWalletAddress(body: unknown): string | null {
  if (!body || typeof body !== 'object' || !('walletAddress' in body)) {
    return null;
  }

  const data = body as Record<string, unknown>;
  const walletAddress = data.walletAddress;
  return typeof walletAddress === 'string' ? walletAddress : null;
}

export async function POST(request: NextRequest) {
  try {
    const walletAddress = getWalletAddress(await request.json());

    if (!walletAddress) {
      return NextResponse.json({ error: 'walletAddress is required.' }, { status: 400 });
    }

    const challenge = createFeaturebaseChallenge(walletAddress);

    return NextResponse.json(
      {
        nonce: challenge.nonce,
        message: challenge.message,
        expiresAt: challenge.expiresAt,
        challengeToken: challenge.challengeToken,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (err) {
    const isConfigError = err instanceof FeaturebaseConfigError;

    return NextResponse.json(
      { error: isConfigError ? 'Featurebase is not configured.' : 'Unable to create Featurebase challenge' },
      { status: isConfigError ? 500 : 400 },
    );
  }
}
