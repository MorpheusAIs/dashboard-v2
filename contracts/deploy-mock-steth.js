const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying MockStETH with account:", deployer.address);
    
    const balance = await deployer.getBalance();
    console.log("Account balance:", ethers.utils.formatEther(balance), "ETH");
    
    const MockStETH = await ethers.getContractFactory("MockStETH");
    const mockStETH = await MockStETH.deploy();
    
    await mockStETH.deployed();
    console.log("MockStETH deployed to:", mockStETH.address);
    
    // Give the deployer some test tokens
    await mockStETH.faucet();
    console.log("Minted 100 stETH test tokens to deployer");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 