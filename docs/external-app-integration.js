/**
 * External App Integration Example
 *
 * This example shows how an external application can integrate with the Morpheus
 * dashboard to create subnets on Base Sepolia using the API endpoint.
 *
 * Note: The API includes CORS headers, so it can be called from different origins/ports.
 */

/**
 * Get available subnet creation options including skills
 */
async function getSubnetOptions() {
  const response = await fetch('/api/create-subnet');
  const { options } = await response.json();
  return options;
}

// Configuration
const API_BASE_URL = 'https://your-morpheus-dashboard.com'; // Replace with your dashboard URL
const MOR_TOKEN_ADDRESS = '0x5c80ddd187054e1e4abbffcd750498e81d34ffa3';
const BUILDERS_CONTRACT = '0x6C3401D71CEd4b4fEFD1033EA5F83e9B3E7e4381';
const BASE_SEPOLIA_CHAIN_ID = 84532;

/**
 * Check if user is on the correct network
 */
async function checkNetwork() {
  if (!window.ethereum) {
    throw new Error('MetaMask not installed');
  }

  const chainId = await window.ethereum.request({ method: 'eth_chainId' });
  const currentChainId = parseInt(chainId, 16);

  if (currentChainId !== BASE_SEPOLIA_CHAIN_ID) {
    // Request network switch
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${BASE_SEPOLIA_CHAIN_ID.toString(16)}` }],
      });
    } catch (error) {
      throw new Error('Please switch to Base Sepolia network');
    }
  }
}

/**
 * Approve MOR token spending for subnet creation fee
 */
async function approveToken(amount) {
  const approvalTx = {
    to: MOR_TOKEN_ADDRESS,
    data: `0x095ea7b3${  // approve function signature
      BUILDERS_CONTRACT.slice(2).padStart(64, '0') +
      BigInt(amount).toString(16).padStart(64, '0')
    }`,
    value: '0x0'
  };

  return await window.ethereum.request({
    method: 'eth_sendTransaction',
    params: [approvalTx],
  });
}

/**
 * Create a subnet using the API
 */
async function createSubnet(subnetData) {
  try {
    // Step 1: Check network
    await checkNetwork();

    // Step 2: Get transaction data from API
    const response = await fetch(`${API_BASE_URL}/api/create-subnet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subnetData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API request failed');
    }

    const { transaction, requirements } = await response.json();

    // Step 3: Approve MOR token spending
    console.log('Approving MOR token spending...');
    await approveToken(requirements.tokenApproval.amount);

    // Step 4: Create the subnet
    console.log('Creating subnet...');
    const txHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [transaction],
    });

    console.log('Subnet created! Transaction hash:', txHash);
    return txHash;

  } catch (error) {
    console.error('Error creating subnet:', error);
    throw error;
  }
}

/**
 * Example usage
 */
async function exampleUsage() {
  try {
    // First, get available options
    const options = await getSubnetOptions();
    console.log('Available skills:', options.skills.map(s => s.value));

    const subnetData = {
      name: "My External App Subnet",
      minStake: 0.001, // 0.001 ETH
      withdrawLockPeriod: 7, // 7 days
      claimAdmin: "0x742d35Cc6469F1A1A5a2B2e5C5F5f5f5f5f5f5f", // User's address
      description: "A subnet created from an external application",
      website: "https://my-external-app.com",
      image: "https://my-external-app.com/logo.png",
      adminAddress: "0x742d35Cc6469F1A1A5a2B2e5C5F5f5f5f5f5f5f", // User's address
      // Optional: Extended metadata for Agent/API/MCP server subnets
      metadata_: {
        description: "An external application that creates subnets programmatically",
        endpointUrl: "https://external-app-api.com/v1/subnets",
        author: "External App Team",
        inputType: "text",
        outputType: "text",
        skills: ["automation", "api_integration"], // Use values from options.skills
        type: "API",
        category: "Automation"
      }
    };

    const txHash = await createSubnet(subnetData);
    console.log('Success! Transaction:', txHash);
  } catch (error) {
    console.error('Failed to create subnet:', error.message);
  }
}

/**
 * Alternative: Generate signing URL for mobile wallets
 */
async function generateSigningUrl(subnetData) {
  const response = await fetch(`${API_BASE_URL}/api/create-subnet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subnetData)
  });

  const { signingUrls } = await response.json();

  // Use MetaMask deep link
  window.location.href = signingUrls.metaMask;
}

/**
 * WalletConnect integration example
 */
async function createWithWalletConnect(subnetData) {
  // This would require WalletConnect SDK integration
  // For brevity, showing the concept

  const response = await fetch(`${API_BASE_URL}/api/create-subnet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subnetData)
  });

  const { transaction, requirements } = await response.json();

  // Use WalletConnect to send the transaction
  // (Implementation depends on your WalletConnect setup)
  // connector.sendTransaction(transaction);
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createSubnet,
    checkNetwork,
    approveToken,
    generateSigningUrl,
    createWithWalletConnect
  };
}