import { NextRequest, NextResponse } from 'next/server';
import {
  createFeaturebaseJwt,
  FeaturebaseConfigError,
  verifyFeaturebaseChallenge,
} from '@/app/lib/utils/featurebase-auth';
import { verifyWalletSignature } from '@/app/lib/utils/verify-signature';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface FeaturebaseTokenRequest {
  walletAddress: string;
  challengeToken: string;
  signature: string;
}

function getTokenRequest(body: unknown): FeaturebaseTokenRequest | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const data = body as Record<string, unknown>;
  const walletAddress = data.walletAddress;
  const challengeToken = data.challengeToken;
  const signature = data.signature;

  if (
    typeof walletAddress !== 'string' ||
    typeof challengeToken !== 'string' ||
    typeof signature !== 'string'
  ) {
    return null;
  }

  return { walletAddress, challengeToken, signature };
}

export async function POST(request: NextRequest) {
  try {
    const tokenRequest = getTokenRequest(await request.json());

    if (!tokenRequest) {
      return NextResponse.json(
        { error: 'walletAddress, challengeToken, and signature are required.' },
        { status: 400 },
      );
    }

    const challenge = verifyFeaturebaseChallenge(
      tokenRequest.walletAddress,
      tokenRequest.challengeToken,
    );

    try {
      await verifyWalletSignature({
        walletAddress: challenge.walletAddress,
        signature: tokenRequest.signature,
        message: challenge.message,
        timestamp: challenge.expiresAt - 5 * 60 * 1000,
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Unauthorized' },
        { status: 401 },
      );
    }

    const featurebaseJwt = createFeaturebaseJwt(challenge.walletAddress);

    return NextResponse.json(
      {
        featurebaseJwt: featurebaseJwt.token,
        expiresAt: featurebaseJwt.expiresAt,
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
      { error: isConfigError ? 'Featurebase is not configured.' : 'Unable to create Featurebase token' },
      { status: isConfigError ? 500 : 400 },
    );
  }
}
