/**
 * Centralized error suppression patterns for wallet/Web3 related errors
 *
 * These patterns are commonly caused by:
 * - Conflicting wallet browser extensions
 * - Expired WalletConnect sessions/proposals
 * - User-rejected connection attempts
 * - Network connectivity issues
 */

// Console error patterns to suppress (for console.error override)
export const CONSOLE_SUPPRESS_PATTERNS = [
  'Cannot redefine property: ethereum',
  'Cannot set property ethereum',
  'Cannot read properties of undefined (reading \'id\')',
  'Unchecked runtime.lastError',
  'Proposal expired',
  'Session expired',
  'Connection proposal expired',
  'WalletConnect proposal expired',
] as const;

// Unhandled rejection patterns to suppress (case-insensitive)
export const REJECTION_SUPPRESS_PATTERNS = [
  'ethereum',
  'proposal expired',
  'session expired',
  'connection expired',
  'walletconnect',
  'user rejected',
  'connection request reset',
] as const;

// LocalStorage keys related to WalletConnect that may need clearing
export const WALLET_STORAGE_KEY_PATTERNS = [
  'walletconnect',
  'wc@2',
  '@walletconnect',
  'wcm-',
  'appkit-',
] as const;

/**
 * Check if an error message should be suppressed in console
 */
export function shouldSuppressConsoleError(errorMessage: string): boolean {
  return CONSOLE_SUPPRESS_PATTERNS.some(pattern =>
    errorMessage.includes(pattern)
  );
}

/**
 * Check if an unhandled rejection should be suppressed
 */
export function shouldSuppressRejection(errorMessage: string): boolean {
  const lowerMessage = errorMessage.toLowerCase();
  return REJECTION_SUPPRESS_PATTERNS.some(pattern =>
    lowerMessage.includes(pattern)
  );
}

/**
 * Check if a localStorage key is wallet-related
 */
export function isWalletStorageKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return WALLET_STORAGE_KEY_PATTERNS.some(pattern =>
    lowerKey.includes(pattern.toLowerCase())
  );
}

/**
 * Check if an error is a recoverable wallet connection error
 * Used by error boundaries to determine if auto-recovery is appropriate
 */
export function isRecoverableWalletError(error: Error): boolean {
  const message = (error.message || '').toLowerCase();
  return (
    message.includes('proposal expired') ||
    message.includes('session expired') ||
    message.includes('walletconnect') ||
    message.includes('user rejected')
  );
}

/**
 * Clear expired or stale WalletConnect data from localStorage
 */
export function clearExpiredWalletData(): void {
  try {
    const keysToCheck = Object.keys(localStorage);
    keysToCheck.forEach(key => {
      if (isWalletStorageKey(key)) {
        try {
          const data = localStorage.getItem(key);
          if (data) {
            const parsed = JSON.parse(data);
            if (parsed) {
              const now = Date.now();
              const expiry = parsed.expiry || parsed.proposal?.expiry || parsed.session?.expiry;
              if (expiry && expiry < now) {
                console.log('Clearing expired wallet data:', key);
                localStorage.removeItem(key);
              } else if (parsed.topic && !expiry) {
                // Clear sessions without expiry info as they might be stale
                console.log('Clearing stale wallet data (no expiry):', key);
                localStorage.removeItem(key);
              }
            }
          }
        } catch {
          // If we can't parse it, it's likely corrupt, so remove it
          console.log('Clearing corrupt wallet data:', key);
          localStorage.removeItem(key);
        }
      }
    });
  } catch (error) {
    console.warn('Error clearing expired wallet data:', error);
  }
}

/**
 * Clear all WalletConnect related data from localStorage
 */
export function clearAllWalletData(): void {
  try {
    Object.keys(localStorage).forEach(key => {
      if (isWalletStorageKey(key)) {
        localStorage.removeItem(key);
      }
    });

    // Also clear wagmi-specific keys
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('wagmi.connected');
      window.localStorage.removeItem('wagmi.wallet');
    }
  } catch (error) {
    console.warn('Error clearing wallet data:', error);
  }
}
