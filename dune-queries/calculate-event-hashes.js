// Quick Event Hash Calculator - Based on Your DepositPool ABI
// Run this to get the exact event signatures for your Dune queries

// Manual calculation (can run in browser console)
console.log('🎯 CALCULATING EVENT SIGNATURES FROM YOUR ABI:\n');

// From your DepositPool.json ABI, the main events are:
const events = {
  'UserStaked(uint256,address,uint256)': 'Main staking event - indexed: poolId, user; data: amount',
  'UserWithdrawn(uint256,address,uint256)': 'Main withdrawal event - indexed: poolId, user; data: amount', 
  'UserClaimed(uint256,address,address,uint256)': 'Claim event - indexed: poolId, user; data: receiver, amount',
  'ReferrerClaimed(uint256,address,address,uint256)': 'Referrer claim - indexed: poolId, user; data: receiver, amount',
  'UserReferred(uint256,address,address,uint256)': 'Referral event - indexed: poolId, user, referrer; data: amount',
  'UserClaimLocked(uint256,address,uint128,uint128)': 'Claim lock event - indexed: poolId, user; data: start, end',
  'OwnershipTransferred(address,address)': 'Standard ownership event - indexed: previous, new'
};

// Calculate hashes (if you have ethers.js available)
if (typeof ethers !== 'undefined') {
  console.log('Using ethers.js to calculate hashes:\n');
  Object.entries(events).forEach(([signature, description]) => {
    const hash = ethers.utils.id(signature);
    console.log(`${signature}`);
    console.log(`  Hash: ${hash}`);
    console.log(`  Description: ${description}\n`);
  });
} else {
  console.log('Manual hash calculation needed. Event signatures:');
  Object.entries(events).forEach(([signature, description]) => {
    console.log(`${signature} - ${description}`);
  });
}

// Your Dune results for comparison
const duneResults = {
  '0x04575f52b6b30177fc1f54050c9bdd9be3a3e76421fe02757adf437a09763ae0': 61, // Most frequent
  '0xe2f02dc2168917563b46b1f788ea74861c381103710158efe9976c0bb3333677': 58, // Second most  
  '0x183b75c4ecee34cfdcb8520dd19eb9399dd86946967052173b0dea7cd8e8c7b7': 24, // Third most
};

console.log('\n🔍 YOUR DUNE RESULTS TO MATCH:');
Object.entries(duneResults).forEach(([hash, count]) => {
  console.log(`${hash} - ${count} events`);
});

console.log('\n💡 NEXT STEPS:');
console.log('1. Calculate keccak256 of each event signature above');
console.log('2. Match them to your Dune results'); 
console.log('3. Update your Dune queries with correct topic0 values');
console.log('4. Remember: topic1=rewardPoolIndex, topic2=user, data=amount');

// Quick online calculation guide
console.log('\n🌐 ONLINE CALCULATION:');
console.log('Go to: https://emn178.github.io/online-tools/keccak_256.html');
console.log('Input: UserStaked(uint256,address,uint256)');
console.log('Input: UserWithdrawn(uint256,address,uint256)');
console.log('Compare the results to your Dune topic0 values above');
