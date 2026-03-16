import { verifyMessage, isAddress } from 'viem';

// Addresses that can edit any record regardless of wallet_address ownership.
// Keep in sync with ADMIN_WALLETS in /context/auth-context.tsx.
const ADMIN_WALLETS = [
  '0x76CC9bCcDaf5cD6b6738c706F0611a2fF1EfB13e',
].map((a) => a.toLowerCase());

/** Maximum age of a signed request before it is rejected (5 minutes). */
const MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000;

/**
 * Builds the canonical EIP-191 message that the client must sign for a
 * "create builder" request.
 */
export function buildCreateMessage(walletAddress: string, timestamp: number): string {
  return `Morpheus Dashboard: Authorize builder creation\nWallet: ${walletAddress}\nTimestamp: ${timestamp}`;
}

/**
 * Builds the canonical EIP-191 message that the client must sign for an
 * "update builder" request.
 */
export function buildUpdateMessage(
  builderId: string,
  walletAddress: string,
  timestamp: number,
): string {
  return `Morpheus Dashboard: Authorize builder update\nBuilder ID: ${builderId}\nWallet: ${walletAddress}\nTimestamp: ${timestamp}`;
}

/**
 * Verifies that `signature` was produced by `walletAddress` signing `message`,
 * and that `timestamp` is within the allowed age window.
 *
 * Throws with a human-readable message on any failure.
 */
export async function verifyWalletSignature({
  walletAddress,
  signature,
  message,
  timestamp,
}: {
  walletAddress: string;
  signature: string;
  message: string;
  timestamp: number;
}): Promise<void> {
  if (!isAddress(walletAddress)) {
    throw new Error('Invalid wallet address');
  }

  const age = Date.now() - timestamp;
  if (age < 0 || age > MAX_SIGNATURE_AGE_MS) {
    throw new Error('Signature has expired — please sign again');
  }

  let valid = false;
  try {
    valid = await verifyMessage({
      address: walletAddress as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
  } catch {
    throw new Error('Signature verification failed');
  }

  if (!valid) {
    throw new Error('Signature does not match the provided wallet address');
  }
}

/** Returns true if `walletAddress` is in the hardcoded admin list. */
export function isAdminWallet(walletAddress: string): boolean {
  return ADMIN_WALLETS.includes(walletAddress.toLowerCase());
}
