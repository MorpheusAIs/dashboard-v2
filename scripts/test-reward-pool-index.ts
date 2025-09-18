/**
 * Script to test and discover rewardPoolIndex values for V2 DepositPools
 * 
 * Usage: npx tsx scripts/test-reward-pool-index.ts
 */

import { createPublicClient, http, parseAbi } from 'viem';
import { sepolia } from 'viem/chains';

// V2 Contract Addresses on Sepolia
const STETH_DEPOSIT_POOL = '0xFea33A23F97d785236F22693eDca564782ae98d0' as `0x${string}`;
const LINK_DEPOSIT_POOL = '0x7f4f17be21219D7DA4C8E0d0B9be6a778354E5A5' as `0x${string}`;

// Minimal DepositPool ABI for testing
const depositPoolAbi = parseAbi([
  'function rewardPoolsData(uint256 poolId) view returns (uint128 lastUpdate, uint256 rate, uint256 totalVirtualDeposited)',
  'function rewardPoolsProtocolDetails(uint256 poolId) view returns (uint128 withdrawLockPeriodAfterStake, uint128 claimLockPeriodAfterStake, uint128 claimLockPeriodAfterClaim, uint256 minimalStake, uint256 distributedRewards)',
  'function depositToken() view returns (address)',
  'function totalDepositedInPublicPools() view returns (uint256)',
]);

// Expected token addresses
const EXPECTED_STETH_TOKEN = '0xa878Ad6fF38d6fAE81FBb048384cE91979d448DA';
const EXPECTED_LINK_TOKEN = '0x779877A7B0D9E8603169DdbD7836e478b4624789';

// Create public client for Sepolia
const client = createPublicClient({
  chain: sepolia,
  transport: http('https://eth-sepolia.g.alchemy.com/v2/demo'), // Using public endpoint
});

async function testPoolIndex(contractAddress: `0x${string}`, poolName: string, poolIndex: number) {
  console.log(`\n🔍 Testing ${poolName} (${contractAddress}) - Pool Index ${poolIndex}`);
  
  try {
    // Test rewardPoolsData
    const poolData = await client.readContract({
      address: contractAddress,
      abi: depositPoolAbi,
      functionName: 'rewardPoolsData',
      args: [BigInt(poolIndex)],
    });
    
    console.log(`  ✅ rewardPoolsData(${poolIndex}):`, {
      lastUpdate: poolData[0].toString(),
      rate: poolData[1].toString(),
      totalVirtualDeposited: poolData[2].toString(),
    });
    
    // Test rewardPoolsProtocolDetails
    const protocolDetails = await client.readContract({
      address: contractAddress,
      abi: depositPoolAbi,
      functionName: 'rewardPoolsProtocolDetails',
      args: [BigInt(poolIndex)],
    });
    
    console.log(`  ✅ rewardPoolsProtocolDetails(${poolIndex}):`, {
      withdrawLockPeriodAfterStake: protocolDetails[0].toString(),
      claimLockPeriodAfterStake: protocolDetails[1].toString(),
      claimLockPeriodAfterClaim: protocolDetails[2].toString(),
      minimalStake: protocolDetails[3].toString(),
      distributedRewards: protocolDetails[4].toString(),
    });
    
    return true;
  } catch (error) {
    const err = error as Error & { shortMessage?: string };
    console.log(`  ❌ Pool Index ${poolIndex} failed:`, err.shortMessage || err.message);
    return false;
  }
}

async function getContractInfo(contractAddress: `0x${string}`, poolName: string) {
  console.log(`\n📄 Getting basic info for ${poolName} (${contractAddress})`);
  
  try {
    // Get deposit token
    const depositToken = await client.readContract({
      address: contractAddress,
      abi: depositPoolAbi,
      functionName: 'depositToken',
    });
    
    console.log(`  📍 Deposit Token:`, depositToken);
    
    // Check if token matches expected
    let expectedToken: string;
    if (poolName.includes('stETH')) {
      expectedToken = EXPECTED_STETH_TOKEN;
    } else if (poolName.includes('LINK')) {
      expectedToken = EXPECTED_LINK_TOKEN;
    } else {
      expectedToken = 'unknown';
    }
    
    if (expectedToken !== 'unknown') {
      const tokenMatches = (depositToken as string).toLowerCase() === expectedToken.toLowerCase();
      console.log(`  📍 Expected Token: ${expectedToken}`);
      console.log(`  ${tokenMatches ? '✅' : '❌'} Token Match:`, tokenMatches);
      
      if (!tokenMatches) {
        console.log(`  🚨 TOKEN MISMATCH! This may cause "transfer amount exceeds balance" errors.`);
        console.log(`  🔧 Update your config to use: ${depositToken}`);
      }
    }
    
    // Get total deposited
    const totalDeposited = await client.readContract({
      address: contractAddress,
      abi: depositPoolAbi,
      functionName: 'totalDepositedInPublicPools',
    });
    
    console.log(`  💰 Total Deposited:`, totalDeposited.toString());
    
  } catch (error) {
    const err = error as Error & { shortMessage?: string };
    console.log(`  ❌ Basic info failed:`, err.shortMessage || err.message);
  }
}

async function discoverRewardPoolIndex() {
  console.log('🚀 Starting rewardPoolIndex discovery for V2 DepositPools on Sepolia\n');
  
  const contracts = [
    { address: STETH_DEPOSIT_POOL, name: 'stETH DepositPool' },
    { address: LINK_DEPOSIT_POOL, name: 'LINK DepositPool' },
  ];
  
  for (const contract of contracts) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🧪 Testing ${contract.name}`);
    console.log(`${'='.repeat(60)}`);
    
    // Get basic contract info
    await getContractInfo(contract.address, contract.name);
    
    // Test pool indices 0-5 to find active pools
    const activeIndices = [];
    for (let i = 0; i <= 5; i++) {
      const success = await testPoolIndex(contract.address, contract.name, i);
      if (success) {
        activeIndices.push(i);
      }
    }
    
    console.log(`\n  📊 Active pool indices for ${contract.name}:`, activeIndices);
    
    if (activeIndices.length === 0) {
      console.log(`  ⚠️  No active pools found for ${contract.name}. Contract may not be initialized.`);
    } else if (activeIndices.includes(0)) {
      console.log(`  ✅ Pool index 0 is active for ${contract.name} - this is likely the main public pool.`);
    } else {
      console.log(`  ⚠️  Pool index 0 is not active for ${contract.name}. Main pool may use a different index.`);
    }
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('🏁 Discovery Complete');
  console.log(`${'='.repeat(60)}`);
  console.log('\n📝 Summary:');
  console.log('• If pool index 0 is active for both contracts, use PUBLIC_POOL_ID = BigInt(0)');
  console.log('• If different indices are active, update the code accordingly');
  console.log('• Check the minimalStake values for deposit minimums');
  console.log('• Verify depositToken addresses match expected stETH/LINK tokens');
}

// Run the discovery
discoverRewardPoolIndex()
  .then(() => {
    console.log('\n✅ Discovery script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Discovery script failed:', error);
    process.exit(1);
  }); 