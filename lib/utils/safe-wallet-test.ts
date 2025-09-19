/**
 * Safe Wallet Testing Utility
 * 
 * This module provides testing utilities and known Safe wallet addresses
 * to help developers verify the Safe wallet integration functionality.
 */

import { isSafeWalletCached, getSafeWalletUrl } from './safe-wallet-detection';
import { mainnet, sepolia } from 'wagmi/chains';

/**
 * Known Safe wallet addresses for testing purposes
 * These are real Safe wallets that can be used to test the functionality
 */
export const KNOWN_SAFE_ADDRESSES = {
  // Gnosis Safe example addresses (these are real Safe wallets)
  mainnet: [
    '0xD9Db270c1B5E3Bd161E8c8503c55cEABeE709552', // AAVE Treasury Safe
    '0x464C71f6c2F760DdA6093dCB91C24c39e5d6e18c', // Curve Finance Safe  
    '0x10E6593CDda8c58a1d0f14C5164B376352a55f2F', // ENS Safe
  ],
  sepolia: [
    // Add Sepolia Safe addresses here as they become available
    // These would be test Safe addresses for development
  ]
};

/**
 * Test the Safe wallet detection functionality
 * 
 * @param address - The address to test
 * @param chainId - The chain ID to test on
 * @returns Test results
 */
export async function testSafeWalletDetection(address: string, chainId: number) {
  console.log(`Testing Safe wallet detection for ${address} on chain ${chainId}`);
  
  const startTime = Date.now();
  const isSafe = await isSafeWalletCached(address);
  const endTime = Date.now();
  
  const result = {
    address,
    chainId,
    isSafe,
    detectionTime: endTime - startTime,
    safeWalletUrl: isSafe ? getSafeWalletUrl(address, chainId) : null,
  };
  
  console.log('Safe detection result:', result);
  return result;
}

/**
 * Test multiple known Safe addresses
 */
export async function testKnownSafeAddresses() {
  console.log('Testing known Safe wallet addresses...');
  
  const results = [];
  
  // Test mainnet addresses
  for (const address of KNOWN_SAFE_ADDRESSES.mainnet) {
    const result = await testSafeWalletDetection(address, mainnet.id);
    results.push(result);
    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Test sepolia addresses
  for (const address of KNOWN_SAFE_ADDRESSES.sepolia) {
    const result = await testSafeWalletDetection(address, sepolia.id);
    results.push(result);
    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('All test results:', results);
  
  // Summarize results
  const safeCount = results.filter(r => r.isSafe).length;
  const totalCount = results.length;
  const averageTime = results.reduce((sum, r) => sum + r.detectionTime, 0) / totalCount;
  
  console.log(`Detection Summary:
    - Total addresses tested: ${totalCount}
    - Detected as Safe: ${safeCount}
    - False negatives: ${totalCount - safeCount}
    - Average detection time: ${averageTime.toFixed(2)}ms
  `);
  
  return results;
}

/**
 * Test a regular (non-Safe) address to ensure it's not detected as a Safe
 */
export async function testRegularAddress() {
  // Use Vitalik's address as a known EOA (Externally Owned Account)
  const vitalikAddress = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
  
  console.log('Testing regular address (should not be detected as Safe)...');
  const result = await testSafeWalletDetection(vitalikAddress, mainnet.id);
  
  if (result.isSafe) {
    console.warn('⚠️ WARNING: Regular address was detected as Safe - possible false positive');
  } else {
    console.log('✅ Regular address correctly identified as non-Safe');
  }
  
  return result;
}

/**
 * Run comprehensive Safe wallet tests
 */
export async function runComprehensiveTests() {
  console.log('🧪 Starting comprehensive Safe wallet detection tests...');
  
  try {
    // Test known Safe addresses
    const safeResults = await testKnownSafeAddresses();
    
    // Test a regular address
    const regularResult = await testRegularAddress();
    
    console.log('✅ All tests completed successfully');
    
    return {
      safeResults,
      regularResult,
      success: true
    };
  } catch (error) {
    console.error('❌ Tests failed:', error);
    return {
      error: error instanceof Error ? error.message : String(error),
      success: false
    };
  }
}

/**
 * Helper function to manually test the toast functionality in the browser console
 * 
 * Usage: Open browser console and run:
 * import { testToastFunctionality } from '@/lib/utils/safe-wallet-test';
 * testToastFunctionality('0xYourSafeAddress');
 */
export function testToastFunctionality(safeAddress: string) {
  console.log(`To test toast functionality with Safe address ${safeAddress}:
    
    1. Connect your wallet to ${safeAddress} (if it's your Safe)
    2. Try to perform any transaction (approve, deposit, stake, etc.)
    3. Observe if the toast shows the "Open Safe Wallet" action button
    4. Click the button to verify it opens the correct Safe URL
    
    If you want to test with a known Safe address without connecting:
    - Modify the userAddress in CapitalPageContext temporarily
    - Or add a test override in the getSafeWalletUrlIfApplicable function
  `);
  
  // Show what the Safe URL would look like
  const mainnetUrl = getSafeWalletUrl(safeAddress, mainnet.id);
  const sepoliaUrl = getSafeWalletUrl(safeAddress, sepolia.id);
  
  console.log('Expected Safe URLs:');
  console.log('Mainnet:', mainnetUrl);
  console.log('Sepolia:', sepoliaUrl);
}
