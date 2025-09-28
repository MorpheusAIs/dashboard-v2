# 🎯 Contract Address Mapping - Tenderly Virtual TestNet

This document provides the complete mapping between contract names and their deployed addresses on Tenderly Virtual TestNet.

## 📚 Library Contracts

| Contract Name | Virtual TestNet Address | Original File |
|---------------|-------------------------|---------------|
| **LogExpMath** | `0x08705b159dbBcD62945B306A80c0F9643B2C01d1` | `contracts/libs/LogExpMath.sol` |
| **LockMultiplierMath** | `0x7b82E807A322af106fE4DeFc8a17C5bF6C4d0de4` | `contracts/libs/LockMultiplierMath.sol` |
| **LinearDistributionIntervalDecrease** | `0x9d536453facC2A86296C7F801960882eaABE1673` | `contracts/libs/LinearDistributionIntervalDecrease.sol` |
| **ReferrerLib** | `0x6F1f14977fB28F7Fd31e62d6e14dd8bfb943A138` | `contracts/libs/ReferrerLib.sol` |

## 🏗️ Core Protocol Contracts

| Contract Name | Virtual TestNet Address | Original File |
|---------------|-------------------------|---------------|
| **ChainLinkDataConsumer** | `0x2294BF37f518A06b4aA7c2677c554B9E6A71Cb35` | `contracts/capital-protocol/ChainLinkDataConsumer.sol` |
| **RewardPool** | `0x76410BC3C45f7805103aCD8032894947FcDc8cE6` | `contracts/capital-protocol/RewardPool.sol` |
| **L1SenderV2** | `0xFca822Eb89067d44e60538125A850861D791720c` | `contracts/capital-protocol/L1SenderV2.sol` |
| **DistributorV2** | `0x417596F7453fB2d07abF0B3afD15e111b6D56A02` | `contracts/capital-protocol/DistributorV2.sol` |

## 💰 DepositPool Contracts

| Contract Name | Token Type | Virtual TestNet Address | Original File |
|---------------|------------|-------------------------|---------------|
| **DepositPool (stETH)** | Lido Staked ETH | `0x32f3F70Ec63cd1b7b5cc3Db4017f0a831bcFFFA0` | `contracts/capital-protocol/DepositPool.sol` |
| **DepositPool (wETH)** | Wrapped ETH | `0x9305E8508B8004362282B7D9227b3b4a84D42F06` | `contracts/capital-protocol/DepositPool.sol` |
| **DepositPool (wBTC)** | Wrapped BTC | `0x91410DF473Ed15Fc66E29FcA0e9c480694DfcEf0` | `contracts/capital-protocol/DepositPool.sol` |
| **DepositPool (USDC)** | USD Coin | `0x4ebbD77Ab4BBdB94922A705a02FfcDf5E4597889` | `contracts/capital-protocol/DepositPool.sol` |
| **DepositPool (USDT)** | Tether USD | `0x57EC92E53135D16eBa9d661713Bd7863983ff02C` | `contracts/capital-protocol/DepositPool.sol` |

## 🔗 Network Information

- **Network**: Tenderly Virtual TestNet
- **Chain ID**: `112121212121212`  
- **RPC URL**: `https://virtual.mainnet.us-east.rpc.tenderly.co/47e606bb-267c-4bc3-bda1-ea9ee54d2d0b`
- **Block Explorer**: Available in Tenderly Dashboard

## 📝 Notes

1. **Libraries** are deployed once and linked to multiple contracts that depend on them
2. **Core Contracts** form the main protocol infrastructure  
3. **DepositPools** are separate instances for different token types (all use the same contract code)
4. All contracts are **verified** (though verification shows warnings due to Tenderly API access)
5. All addresses are **unique to your Virtual TestNet** and different from mainnet

## 🔍 How to Use

### In Scripts/Tests
```javascript
const chainLinkConsumer = "0x2294BF37f518A06b4aA7c2677c554B9E6A71Cb35";
const rewardPool = "0x76410BC3C45f7805103aCD8032894947FcDc8cE6";
const stETHDepositPool = "0x32f3F70Ec63cd1b7b5cc3Db4017f0a831bcFFFA0";
// ... etc
```

### In Environment Files
```bash
source tenderly-deploy/deployed_libraries.txt
source tenderly-deploy/deployed_core.txt  
source tenderly-deploy/deployed_deposit_pools.txt
```

## 📊 Comparison with Mainnet

For mainnet addresses comparison, refer to: [Morpheus Deployed Contracts](https://gitbook.mor.org/smart-contracts/documentation/distribution-protocol/deployed-contracts)

**Note**: These Virtual TestNet addresses are completely different from mainnet addresses - they represent fresh deployments on the virtual network.
