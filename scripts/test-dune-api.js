// Test script to debug Dune API directly
// Run this with: node scripts/test-dune-api.js

const { DuneClient } = require('@duneanalytics/client-sdk');
require('dotenv').config({ path: '.env.local' });

async function testDuneAPI() {
  console.log('🧪 Testing Dune API directly...\n');
  
  try {
    // Check environment
    console.log('🔍 Environment check:');
    console.log('  - DUNE_API_KEY exists:', !!process.env.DUNE_API_KEY);
    console.log('  - API key length:', process.env.DUNE_API_KEY?.length || 0);
    console.log('  - API key first 10 chars:', process.env.DUNE_API_KEY?.substring(0, 10) || 'N/A');
    
    if (!process.env.DUNE_API_KEY) {
      throw new Error('DUNE_API_KEY not found in .env.local');
    }
    
    // Initialize client
    console.log('\n🔧 Initializing Dune client...');
    const dune = new DuneClient(process.env.DUNE_API_KEY);
    console.log('✅ DuneClient created successfully');
    
    // Test the query
    const queryId = 5650752; // Update this with your actual query ID
    console.log(`\n📊 Testing query ID: ${queryId}`);
    
    console.log('⏳ Calling getLatestResult...');
    const result = await dune.getLatestResult({ queryId });
    
    console.log('\n📥 Raw Result:');
    console.log(JSON.stringify(result, null, 2));
    
    console.log('\n🔍 Result Analysis:');
    console.log('  - Result type:', typeof result);
    console.log('  - Has result property:', 'result' in (result || {}));
    console.log('  - Result.result type:', typeof result?.result);
    console.log('  - Has rows:', 'rows' in (result?.result || {}));
    console.log('  - Rows length:', result?.result?.rows?.length);
    console.log('  - First row:', result?.result?.rows?.[0]);
    
    // Extract the data
    const activeStakers = result?.result?.rows?.[0]?.active_stakers;
    console.log('\n🎯 Final extracted value:', activeStakers);
    
    if (activeStakers !== undefined) {
      console.log('✅ SUCCESS! Active stakers count:', activeStakers);
    } else {
      console.log('❌ FAILED: No active_stakers field found');
      console.log('Available fields in first row:', Object.keys(result?.result?.rows?.[0] || {}));
    }
    
  } catch (error) {
    console.error('\n💥 Error occurred:');
    console.error('  - Type:', typeof error);
    console.error('  - Message:', error.message);
    console.error('  - Stack:', error.stack);
    console.error('  - Full error:', error);
  }
}

// Run the test
testDuneAPI()
  .then(() => console.log('\n🏁 Test completed'))
  .catch(error => console.error('\n💥 Test failed:', error));
