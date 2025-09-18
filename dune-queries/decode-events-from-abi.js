// Event Signature Decoder - Using Your Contract ABIs
// This will identify your unknown events using the actual ABI files

const ethers = require('ethers'); // npm install ethers if running locally

// Your unknown events from Dune query results
const unknownEvents = {
  '0x04575f52b6b30177fc1f54050c9bdd9be3a3e76421fe02757adf437a09763ae0': { count: 61, description: 'Most frequent' },
  '0xe2f02dc2168917563b46b1f788ea74861c381103710158efe9976c0bb3333677': { count: 58, description: 'Second most' },
  '0x183b75c4ecee34cfdcb8520dd19eb9399dd86946967052173b0dea7cd8e8c7b7': { count: 24, description: 'Third most' },
  '0xace6f3f8956413e2875b9070e2616d13687dfb251cf63b343028c32822dfa263': { count: 15, description: 'Other' },
  '0xc58ee088a46c9f0489c976c90d228e4c3878985b4bddcc82ee960e0110d94e5a': { count: 10, description: 'Other' },
  '0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0': { count: 4, description: 'OwnershipTransferred' },
};

// Events from DepositPool ABI (from your @abi/DepositPool.json)
const depositPoolEvents = [
  // Main events we're looking for
  'UserStaked(uint256,address,uint256)',           // indexed: rewardPoolIndex, user; non-indexed: amount
  'UserWithdrawn(uint256,address,uint256)',        // indexed: rewardPoolIndex, user; non-indexed: amount  
  'UserClaimed(uint256,address,address,uint256)',  // indexed: rewardPoolIndex, user; non-indexed: receiver, amount
  'ReferrerClaimed(uint256,address,address,uint256)', // indexed: rewardPoolIndex, user; non-indexed: receiver, amount
  'UserReferred(uint256,address,address,uint256)', // indexed: rewardPoolIndex, user, referrer; non-indexed: amount
  
  // Other events from the ABI
  'UserClaimLocked(uint256,address,uint128,uint128)', // indexed: rewardPoolIndex, user; non-indexed: claimLockStart, claimLockEnd
  'OwnershipTransferred(address,address)',          // indexed: previousOwner, newOwner
  'RewardPoolsDataSet(uint256,uint128,uint128,uint128,uint256)',
  'ReferrerTiersEdited(uint256,tuple[])',
  'AddressAllowedToClaimSet(address,address,bool)',
  'DistributorSet(address)',
  'Migrated(uint256)',
  'AdminChanged(address,address)',
  'BeaconUpgraded(address)',
  'Upgraded(address)',
  'Initialized(uint8)',
];

// Additional events from other ABIs that might be relevant
const otherEvents = [
  // From ERC1967Proxy.json
  'PoolCreated(uint256,tuple)',
  'PoolEdited(uint256,tuple)',
  'PoolLimitsEdited(uint256,tuple)',
  'OverplusBridged(uint256,bytes)',
  
  // From other contracts
  'Staked(address,uint256,uint256,uint256)',        // BuilderSubnets events
  'Claimed(address,uint256,uint256)',
  'Withdrawn(uint256,address,tuple,uint256)',
  'UserDeposited(bytes32,address,uint256)',         // Builders events  
  'UserWithdrawn(bytes32,address,uint256)',
];

console.log('🔍 DECODING YOUR CONTRACT EVENTS\n');
console.log('='.repeat(80));

// Function to calculate event signature hash
function getEventHash(eventSignature) {
  try {
    return ethers.utils.id(eventSignature);
  } catch (error) {
    return null;
  }
}

// Check DepositPool events first (most likely)
console.log('\n📋 DEPOSIT POOL EVENTS (Most Likely):');
console.log('-'.repeat(50));

let foundMatches = [];

depositPoolEvents.forEach(eventSig => {
  const hash = getEventHash(eventSig);
  if (hash && unknownEvents[hash]) {
    console.log(`✅ MATCH FOUND: ${eventSig}`);
    console.log(`   Hash: ${hash}`);
    console.log(`   Count: ${unknownEvents[hash].count} events`);
    console.log(`   This explains your "${unknownEvents[hash].description}" event!\n`);
    foundMatches.push(hash);
  }
});

// Check other events
console.log('🔄 OTHER CONTRACT EVENTS:');
console.log('-'.repeat(50));

otherEvents.forEach(eventSig => {
  const hash = getEventHash(eventSig);
  if (hash && unknownEvents[hash] && !foundMatches.includes(hash)) {
    console.log(`✅ MATCH FOUND: ${eventSig}`);
    console.log(`   Hash: ${hash}`);
    console.log(`   Count: ${unknownEvents[hash].count} events\n`);
    foundMatches.push(hash);
  }
});

// Show unidentified events
console.log('❓ STILL UNIDENTIFIED:');
console.log('-'.repeat(50));

Object.entries(unknownEvents).forEach(([hash, info]) => {
  if (!foundMatches.includes(hash) && hash !== '0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0') {
    console.log(`   ${hash} - ${info.count} events (${info.description})`);
  }
});

console.log('\n' + '='.repeat(80));
console.log('🎯 NEXT STEPS:');
console.log('1. Use the identified event signatures in your Dune queries');
console.log('2. Update topic positions based on indexed parameters');
console.log('3. For UserStaked: topic1=rewardPoolIndex, topic2=user, data=amount');
console.log('4. For UserWithdrawn: topic1=rewardPoolIndex, topic2=user, data=amount');

// Generate corrected event signatures for your queries
console.log('\n🔧 CORRECTED SIGNATURES FOR YOUR QUERIES:');
foundMatches.forEach(hash => {
  console.log(`'${hash}' -- ${getEventNameFromHash(hash)}`);
});

function getEventNameFromHash(hash) {
  const allEvents = [...depositPoolEvents, ...otherEvents];
  for (const eventSig of allEvents) {
    if (getEventHash(eventSig) === hash) {
      return eventSig;
    }
  }
  return 'Unknown';
}
