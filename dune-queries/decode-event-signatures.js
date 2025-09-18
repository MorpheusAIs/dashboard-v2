// Event Signature Decoder
// Run this in Node.js or browser console to identify your events

const ethers = require('ethers'); // npm install ethers

// Your actual event signatures from Dune results
const eventSignatures = {
  '0x04575f52b6b30177fc1f54050c9bdd9be3a3e76421fe02757adf437a09763ae0': 'Most frequent (38 events)',
  '0xe2f02dc2168917563b46b1f788ea74861c381103710158efe9976c0bb3333677': 'Second most (37 events)', 
  '0x183b75c4ecee34cfdcb8520dd19eb9399dd86946967052173b0dea7cd8e8c7b7': '10 events',
  '0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0': 'OwnershipTransferred (confirmed)'
};

// Common event signatures to test against
const commonEvents = [
  // Potential staking/deposit events
  'Transfer(address,address,uint256)',
  'Deposit(address,uint256)', 
  'Stake(address,uint256)',
  'UserDeposit(address,uint256)',
  'Staked(address,uint256)',
  'DepositMade(address,uint256)',
  
  // Potential withdrawal events  
  'Withdraw(address,uint256)',
  'Withdrawal(address,uint256)',
  'UserWithdraw(address,uint256)',
  'Unstaked(address,uint256)',
  
  // With additional parameters
  'Deposit(address,uint256,uint256)', // address, amount, timestamp
  'Stake(address,uint256,uint256)', // address, amount, pool_id
  'UserDeposit(uint256,address,uint256)', // pool_id, user, amount
  
  // ERC20/Contract events
  'Transfer(address,address,uint256)',
  'Approval(address,address,uint256)', 
  'OwnershipTransferred(address,address)',
  
  // Reward/Claim events
  'RewardClaimed(address,uint256)',
  'Claimed(address,uint256)',
  'UserClaimed(address,uint256)',
];

console.log('=== DECODING YOUR EVENT SIGNATURES ===\n');

// Calculate hashes for common events
console.log('Testing against common event patterns:');
commonEvents.forEach(eventSig => {
  const hash = ethers.utils.id(eventSig);
  const isMatch = Object.keys(eventSignatures).includes(hash);
  
  if (isMatch) {
    console.log(`✅ MATCH FOUND: ${eventSig} -> ${hash}`);
    console.log(`   This is your: ${eventSignatures[hash]}\n`);
  }
});

console.log('\n=== YOUR UNKNOWN SIGNATURES ===');
Object.entries(eventSignatures).forEach(([hash, description]) => {
  const isKnown = hash === '0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0';
  if (!isKnown) {
    console.log(`❓ ${hash} - ${description}`);
  }
});

console.log('\n=== NEXT STEPS ===');
console.log('1. Check your contract ABI for exact event definitions');
console.log('2. Look at Etherscan/Sepoliascan for your contract addresses:');
console.log('   - stETH: https://sepolia.etherscan.io/address/0xFea33A23F97d785236F22693eDca564782ae98d0');
console.log('   - LINK:  https://sepolia.etherscan.io/address/0x7f4f17be21219D7DA4C8E0d0B9be6a778354E5A5');
console.log('3. Copy the exact event signatures from the ABI');
console.log('4. Calculate their keccak256 hashes using this script');

// If running in browser console, use this instead:
console.log('\n=== BROWSER VERSION (if no Node.js) ===');
console.log('Visit: https://emn178.github.io/online-tools/keccak_256.html');
console.log('Input your event signature (e.g., "Deposit(address,uint256)")');
console.log('Get the hash and compare to your Dune results');
