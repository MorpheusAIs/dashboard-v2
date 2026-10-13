import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { isAddress } from 'viem';
import { buildFeaturebaseMessage } from './verify-signature';

const FEATUREBASE_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const FEATUREBASE_JWT_TTL_SECONDS = 60 * 60;

interface FeaturebaseChallenge {
  walletAddress: string;
  nonce: string;
  message: string;
  expiresAt: number;
  challengeToken: string;
}

interface FeaturebaseJwtPayload {
  userId: string;
  name: string;
  iat: number;
  exp: number;
}

interface FeaturebaseJwt {
  token: string;
  expiresAt: number;
}

export class FeaturebaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeaturebaseConfigError';
  }
}

function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signChallenge(
  walletAddress: string,
  nonce: string,
  expiresAt: number,
  secret: string,
): string {
  const challengeBody = `${walletAddress.toLowerCase()}.${nonce}.${expiresAt}`;
  const signature = createHmac('sha256', secret).update(challengeBody).digest();

  return `${challengeBody}.${base64UrlEncode(signature)}`;
}

function verifyChallengeToken(challengeToken: string, secret: string): FeaturebaseChallenge {
  const [walletAddress, nonce, expiresAtValue, signature] = challengeToken.split('.');
  const expiresAt = Number(expiresAtValue);

  if (!walletAddress || !nonce || !expiresAtValue || !signature || !Number.isFinite(expiresAt)) {
    throw new Error('Invalid Featurebase challenge');
  }

  if (!isAddress(walletAddress)) {
    throw new Error('Invalid wallet address');
  }

  if (expiresAt <= Date.now()) {
    throw new Error('Featurebase challenge has expired. Please try again.');
  }

  const expectedToken = signChallenge(walletAddress, nonce, expiresAt, secret);
  const expectedSignature = expectedToken.split('.')[3];
  const signatureBuffer = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedSignatureBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
  ) {
    throw new Error('Invalid Featurebase challenge');
  }

  return {
    walletAddress: walletAddress.toLowerCase(),
    nonce,
    expiresAt,
    message: buildFeaturebaseMessage(walletAddress.toLowerCase(), nonce, expiresAt),
    challengeToken,
  };
}

export function createFeaturebaseChallenge(walletAddress: string): FeaturebaseChallenge {
  const secret = getFeaturebaseJwtSecret();

  if (!isAddress(walletAddress)) {
    throw new Error('Invalid wallet address');
  }

  const normalizedAddress = walletAddress.toLowerCase();
  const nonce = randomUUID();
  const expiresAt = Date.now() + FEATUREBASE_CHALLENGE_TTL_MS;
  const message = buildFeaturebaseMessage(normalizedAddress, nonce, expiresAt);
  const challengeToken = signChallenge(normalizedAddress, nonce, expiresAt, secret);

  return {
    walletAddress: normalizedAddress,
    nonce,
    message,
    expiresAt,
    challengeToken,
  };
}

export function verifyFeaturebaseChallenge(
  walletAddress: string,
  challengeToken: string,
): FeaturebaseChallenge {
  const secret = getFeaturebaseJwtSecret();

  if (!isAddress(walletAddress)) {
    throw new Error('Invalid wallet address');
  }

  const normalizedAddress = walletAddress.toLowerCase();
  const challenge = verifyChallengeToken(challengeToken, secret);

  if (challenge.walletAddress !== normalizedAddress) {
    throw new Error('Invalid Featurebase challenge');
  }

  return challenge;
}

function getFeaturebaseJwtSecret(): string {
  const secret = process.env.FEATUREBASE_JWT_SECRET;

  if (!secret) {
    throw new FeaturebaseConfigError('Featurebase JWT secret is not configured');
  }

  return secret;
}

export function createFeaturebaseJwt(walletAddress: string): FeaturebaseJwt {
  const secret = getFeaturebaseJwtSecret();

  if (!isAddress(walletAddress)) {
    throw new Error('Invalid wallet address');
  }

  const normalizedAddress = walletAddress.toLowerCase();
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + FEATUREBASE_JWT_TTL_SECONDS;
  const payload: FeaturebaseJwtPayload = {
    userId: normalizedAddress,
    name: `${normalizedAddress.slice(0, 6)}...${normalizedAddress.slice(-4)}`,
    iat: issuedAt,
    exp: expiresAt,
  };
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };
  const unsignedToken = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const signature = createHmac('sha256', secret).update(unsignedToken).digest();

  return {
    token: `${unsignedToken}.${base64UrlEncode(signature)}`,
    expiresAt,
  };
}
