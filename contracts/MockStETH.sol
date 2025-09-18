// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockStETH is ERC20 {
    constructor() ERC20("Mock Liquid Staked Ether", "stETH") {
        // Mint some tokens to the deployer for testing
        _mint(msg.sender, 1000000 * 10**18);
    }
    
    // Allow anyone to mint tokens for testing
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    
    // Allow anyone to get free tokens for testing
    function faucet() external {
        _mint(msg.sender, 100 * 10**18);
    }
} 