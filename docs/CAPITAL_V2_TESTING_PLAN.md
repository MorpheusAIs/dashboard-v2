# Capital V2 Manual Testing Plan

## Overview

This document provides a comprehensive manual testing plan for the Capital V2 page implementation. The testing focuses on validating the UI integration with new V2 contracts on Sepolia testnet, ensuring all user flows work correctly with multi-asset support (stETH and LINK), and verifying cross-chain claiming functionality.

## Prerequisites

### Environment Setup
- **Network**: Ethereum Sepolia testnet
- **Wallet**: MetaMask or compatible wallet with Sepolia ETH and test tokens
- **Test Tokens**: Test stETH and LINK tokens on Sepolia (addresses below)
- **Cross-chain**: Arbitrum Sepolia for MOR rewards claiming

### Test Token Addresses (Sepolia)
Add these token contracts to your wallet to view balances:

**Test stETH (Lido Staked Ether)**
- Address: `0xa878Ad6fF38d6fAE81FBb048384cE91979d448DA`
- Symbol: stETH
- Decimals: 18

**Test LINK (Chainlink Token)**
- Address: `0xf8Fb3713D459D7C1018BD0A49D19b4C44290EBE5`
- Symbol: LINK
- Decimals: 18

**MOR Token (Arbitrum Sepolia - for viewing claimed rewards)**
- Address: `0x34a285A1B1C166420Df5b6630132542923B5b27E`
- Symbol: MOR
- Decimals: 18
- Network: Arbitrum Sepolia

### Adding Tokens to MetaMask
1. Open MetaMask and ensure you're on Sepolia testnet
2. Click "Import tokens" at the bottom of the assets list
3. Select "Custom token"
4. Enter the token contract address from above
5. Symbol and decimals should auto-populate
6. Click "Add Custom Token" and confirm

### Contract Addresses (Sepolia)
The following V2 contracts should be configured in the application:
- stETH Deposit Pool V2
- LINK Deposit Pool V2  
- Distributor V2
- Reward Pool V2
- L1 Sender V2

### Test Token Acquisition
Before testing, ensure you have:

1. **Sepolia ETH**: For transaction fees (~0.1 ETH recommended)
   - Get from [Sepolia Faucet](https://sepoliafaucet.com/) or [Alchemy Faucet](https://sepoliafaucet.com/)

2. **Test stETH**: From test contract on Sepolia
   - Contract: `0xa878Ad6fF38d6fAE81FBb048384cE91979d448DA`
   - May require minting from contract or faucet (check with development team)

3. **Test LINK**: From test contract on Sepolia  
   - Contract: `0xf8Fb3713D459D7C1018BD0A49D19b4C44290EBE5`
   - May require minting from contract or faucet (check with development team)

4. **Cross-chain gas**: Extra ETH for L1→L2 claiming (~0.01 ETH per claim)

**Note**: If you cannot acquire test tokens through faucets, contact the development team for direct token distribution to your test wallet.

## Testing Sections

**Testing Priority Order**: This plan is organized with core functionality testing first, followed by edge cases and performance testing. Focus on sections 1-6 for essential functionality validation before moving to advanced scenarios.

---

## 1. Core Contract Functionality Testing

### 1.1 Deposit Functionality (stETH)
**Objective**: Test core deposit functionality for stETH

**Test Steps**:
1. Navigate to `/capital` page and connect wallet
2. Click "Stake" button for stETH
3. Enter valid deposit amount (e.g., 0.1 stETH)
4. Select lock duration (e.g., 30 days)
5. Submit deposit transaction
6. Confirm approval if needed, then confirm deposit

**Expected Results**:
- ✅ Deposit modal opens correctly
- ✅ Token approval prompts when needed
- ✅ Deposit transaction succeeds
- ✅ Success toast notification appears
- ✅ User balance decreases by deposit amount
- ✅ Staked position increases in User Assets Panel
- ✅ Multiplier applies correctly based on lock duration

**Failure Scenarios**:
- ❌ Deposit transaction fails
- ❌ Balances don't update
- ❌ No success notification
- ❌ Incorrect multiplier calculation

### 1.2 Deposit Functionality (LINK)
**Objective**: Test core deposit functionality for LINK

**Test Steps**:
1. Switch to LINK asset in deposit modal
2. Enter valid deposit amount (e.g., 10 LINK)
3. Select lock duration (e.g., 90 days)
4. Submit deposit transaction
5. Confirm approval if needed, then confirm deposit

**Expected Results**:
- ✅ Asset switching works correctly
- ✅ LINK deposit transaction succeeds
- ✅ Success toast notification appears
- ✅ LINK balance and position update correctly
- ✅ Both stETH and LINK positions show in User Assets Panel

**Failure Scenarios**:
- ❌ Asset switching broken
- ❌ LINK deposit fails
- ❌ Incorrect balance updates
- ❌ Multi-asset display issues

### 1.3 MOR Rewards Claiming
**Objective**: Test MOR rewards claiming functionality

**Test Steps**:
1. Wait for claimable rewards to accumulate (or use existing position)
2. Click "Claim all" or individual asset claim buttons
3. Review claimable amounts in ClaimMorRewardsModal
4. Select assets to claim from
5. Submit claim transaction (should include cross-chain gas)
6. Switch to Arbitrum Sepolia if prompted
7. Verify MOR tokens appear in L2 wallet

**Expected Results**:
- ✅ Claim modal shows correct claimable amounts
- ✅ Network switching prompt appears when needed
- ✅ Claim transaction succeeds on L1 (Sepolia)
- ✅ MOR tokens are minted on L2 (Arbitrum Sepolia)
- ✅ Success toast notification appears
- ✅ Claimable amounts reset to zero after claim
- ✅ Cross-chain gas fees are properly included

**Failure Scenarios**:
- ❌ Incorrect claimable amounts
- ❌ Network switching fails
- ❌ Claim transaction fails
- ❌ MOR tokens don't appear on L2
- ❌ Claimable amounts don't reset

### 1.4 Withdrawal Functionality
**Objective**: Test withdrawal from deposit pools

**Test Steps**:
1. Click withdraw button for asset with staked amount
2. Enter withdrawal amount (within available limits)
3. Check for lock period warnings
4. Submit withdrawal transaction when eligible

**Expected Results**:
- ✅ Withdraw modal opens with correct asset info
- ✅ Available withdrawal amount is accurate
- ✅ Lock period warnings show when applicable
- ✅ Withdrawal transaction succeeds when eligible
- ✅ Success toast notification appears
- ✅ Balances update correctly after withdrawal

**Failure Scenarios**:
- ❌ Incorrect available amounts
- ❌ Missing lock period warnings
- ❌ Withdrawal fails when should succeed
- ❌ Balances don't update correctly

### 1.5 Lock Period Management
**Objective**: Test lock period changes and multiplier updates

**Test Steps**:
1. Open Change Lock modal for existing position
2. Try increasing lock duration
3. Submit lock change transaction
4. Verify multiplier increase
5. Test lock rewards option during claiming

**Expected Results**:
- ✅ Lock change modal displays current lock info
- ✅ Lock duration increase is allowed
- ✅ Transaction succeeds for valid changes
- ✅ Multiplier increases as expected
- ✅ Lock rewards option works during claiming
- ✅ Success toast notifications appear

**Failure Scenarios**:
- ❌ Lock changes fail to process
- ❌ Incorrect multiplier calculations
- ❌ Lock rewards option doesn't work

---

## 2. Network Switching and Cross-Chain Functionality

### 2.1 Network Detection and Switching
**Objective**: Test network switching for cross-chain operations

**Test Steps**:
1. Ensure wallet is connected to Sepolia testnet
2. Attempt to claim MOR rewards
3. Observe network switching prompt for Arbitrum Sepolia
4. Click network switch button
5. Confirm network switch in wallet
6. Complete claim transaction on correct network

**Expected Results**:
- ✅ Network switching prompt appears when needed
- ✅ Clear messaging about Arbitrum Sepolia requirement
- ✅ Network switch functionality works correctly
- ✅ Claim proceeds after successful network switch
- ✅ Cross-chain gas fee information is clear
- ✅ Success notifications for network switch

**Failure Scenarios**:
- ❌ No network switching prompt appears
- ❌ Network switch fails or times out
- ❌ Unclear messaging about network requirements
- ❌ Claim fails after network switch
- ❌ Missing or incorrect gas fee information

### 2.2 Cross-Chain Transaction Validation
**Objective**: Verify cross-chain transactions complete properly

**Test Steps**:
1. Complete a claim transaction on L1 (Sepolia)
2. Monitor transaction completion
3. Switch to Arbitrum Sepolia
4. Verify MOR tokens appear in wallet
5. Check transaction history on both networks

**Expected Results**:
- ✅ L1 transaction completes successfully
- ✅ Cross-chain message is sent
- ✅ MOR tokens appear on L2 (Arbitrum Sepolia)
- ✅ Transaction hashes are valid on both networks
- ✅ Proper confirmation notifications

**Failure Scenarios**:
- ❌ L1 transaction fails
- ❌ Cross-chain bridging fails
- ❌ MOR tokens don't appear on L2
- ❌ Invalid or missing transaction hashes

---

## 3. UI Components and Data Display Testing

### 3.1 Page Load and Basic Display
**Objective**: Verify page loads and displays core information correctly

**Test Steps**:
1. Navigate to `/capital` page
2. Connect wallet to Sepolia testnet
3. Wait for page to fully load
4. Observe Capital Info Panel asset display
5. Check User Assets Panel for existing positions

**Expected Results**:
- ✅ Page loads without errors
- ✅ Wallet connection works properly
- ✅ Both stETH and LINK assets are displayed in Capital Info Panel
- ✅ APY values and total staked amounts are accurate (not placeholder data)
- ✅ Asset icons display correctly
- ✅ User positions show in User Assets Panel if any exist
- ✅ Network indicator shows "Sepolia" or testnet status

**Failure Scenarios**:
- ❌ Page crashes or shows blank screen
- ❌ Console errors related to contract calls
- ❌ Missing assets or placeholder data
- ❌ Incorrect APY or staking amounts
- ❌ Broken asset icons

### 3.2 Modal Functionality and Asset Selection
**Objective**: Test modal opening and asset switching

**Test Steps**:
1. Click "Stake" button for stETH (should open deposit modal)
2. Verify modal opens with stETH selected
3. Click asset dropdown and switch to LINK
4. Verify information updates correctly
5. Test "Max" button functionality
6. Close and reopen modal with LINK stake button

**Expected Results**:
- ✅ Deposit modal opens when stake buttons are clicked
- ✅ Correct asset is pre-selected based on button clicked
- ✅ Asset dropdown opens and shows both options
- ✅ Balance information updates when switching assets
- ✅ Available balance shows accurate amounts
- ✅ "Max" button fills available balance
- ✅ Modal displays appropriate asset information

**Failure Scenarios**:
- ❌ Modal doesn't open or opens with errors
- ❌ Wrong asset selected in modal
- ❌ Dropdown doesn't work properly
- ❌ Balance information doesn't update
- ❌ "Max" button sets incorrect amount

---

## 4. Input Validation and Error Handling

### 4.1 Amount Input Validation
**Objective**: Test input validation and balance checks

**Test Steps**:
1. Try entering amount greater than available balance
2. Try entering amount less than minimum stake
3. Try entering invalid characters (letters, special chars)
4. Test decimal precision limits
5. Test edge cases (0, negative numbers, very large numbers)

**Expected Results**:
- ✅ Error message for insufficient balance
- ✅ Error message for below minimum stake
- ✅ Invalid characters are rejected or filtered
- ✅ Decimal precision is limited appropriately
- ✅ Submit button disabled for invalid amounts
- ✅ Clear, helpful error messages displayed
- ✅ Error messages disappear when input becomes valid

**Failure Scenarios**:
- ❌ Invalid amounts allowed through
- ❌ Missing or unclear error messages
- ❌ Submit button enabled for invalid inputs
- ❌ Error messages don't clear when fixed

### 4.2 Transaction Error Handling
**Objective**: Test error handling for failed transactions

**Test Steps**:
1. Attempt deposit with insufficient ETH for gas
2. Reject approval transaction in wallet
3. Reject deposit transaction in wallet
4. Test with disconnected wallet during transaction
5. Test transaction during network congestion

**Expected Results**:
- ✅ Clear error messages for insufficient gas
- ✅ Graceful handling of rejected transactions
- ✅ Proper error handling for wallet disconnection
- ✅ Retry options where appropriate
- ✅ Error toast notifications appear
- ✅ UI returns to proper state after errors

**Failure Scenarios**:
- ❌ Cryptic or missing error messages
- ❌ App crashes on transaction failures
- ❌ UI gets stuck in loading state
- ❌ No recovery options provided

### 4.3 Network and Wallet Error Handling
**Objective**: Test handling of network and wallet issues

**Test Steps**:
1. Switch networks unexpectedly during transaction
2. Use unsupported network
3. Disconnect wallet during operation
4. Test with wallet that has no test tokens
5. Test rejected network switching

**Expected Results**:
- ✅ Graceful handling of network switches
- ✅ Clear messaging for unsupported networks
- ✅ Proper handling of wallet disconnection
- ✅ Clear insufficient funds messages
- ✅ Helpful guidance for network switching
- ✅ Error toast notifications with actionable information

**Failure Scenarios**:
- ❌ App breaks when networks switch
- ❌ Unclear or missing error messages
- ❌ No guidance for resolving issues
- ❌ App becomes unusable after errors

---

## 5. Toast Notifications and State Updates

### 5.1 Success Notifications
**Objective**: Verify success toast notifications appear for all operations

**Test Steps**:
1. Complete successful deposit transaction
2. Complete successful withdrawal transaction
3. Complete successful claim transaction
4. Complete successful lock change transaction
5. Complete successful network switch

**Expected Results**:
- ✅ Success toast appears for each completed operation
- ✅ Toast messages are clear and specific to the operation
- ✅ Toast includes relevant transaction details (amount, asset, etc.)
- ✅ Toast appears at the right time (after transaction confirmation)
- ✅ Toast auto-dismisses after appropriate time
- ✅ Multiple toasts don't overlap confusingly

**Failure Scenarios**:
- ❌ No success notifications appear
- ❌ Generic or unclear toast messages
- ❌ Toast appears too early or too late
- ❌ Toast doesn't auto-dismiss
- ❌ Multiple toasts create confusion

### 5.2 Real-Time State Updates
**Objective**: Test that UI updates immediately after transactions

**Test Steps**:
1. Note balances before deposit transaction
2. Complete deposit and verify balance updates
3. Note staked amounts before withdrawal
4. Complete withdrawal and verify updates
5. Note claimable amounts before claim
6. Complete claim and verify amounts reset

**Expected Results**:
- ✅ User token balances update immediately after transactions
- ✅ Staked positions update in User Assets Panel
- ✅ Claimable amounts update after claims
- ✅ Multipliers update after lock changes
- ✅ Total USD values recalculate correctly
- ✅ All UI components reflect new state consistently

**Failure Scenarios**:
- ❌ Balances don't update after transactions
- ❌ Staked positions show stale data
- ❌ Claimable amounts don't reset after claims
- ❌ Inconsistent state across UI components
- ❌ Manual page refresh required to see updates

### 5.3 Loading States and Button Management
**Objective**: Test loading states and button behavior during transactions

**Test Steps**:
1. Start deposit transaction and observe button states
2. Test button behavior during approval process
3. Observe loading states during network switching
4. Test button states during claim transactions
5. Verify buttons re-enable after transaction completion

**Expected Results**:
- ✅ Submit buttons show loading state during transactions
- ✅ Buttons are disabled during processing to prevent double-clicks
- ✅ Loading text is clear about current operation
- ✅ Buttons re-enable after transaction completion
- ✅ Loading states are consistent across all modals
- ✅ Cancel buttons work during loading states where appropriate

**Failure Scenarios**:
- ❌ Buttons don't show loading states
- ❌ Double-clicking causes multiple transactions
- ❌ Buttons don't re-enable after completion
- ❌ Unclear or missing loading indicators
- ❌ Cancel functionality broken during loading

---

## 6. Multi-Asset Integration Testing

### 6.1 Complete Multi-Asset Workflow
**Objective**: Test full workflow with both stETH and LINK

**Test Steps**:
1. Deposit both stETH and LINK with different lock periods
2. Wait for rewards to accumulate on both assets
3. Claim rewards from individual assets separately
4. Claim rewards from both assets together
5. Modify lock periods for each asset independently
6. Withdraw from both assets

**Expected Results**:
- ✅ Multi-asset deposits work correctly without interference
- ✅ Rewards accumulate independently for both assets
- ✅ Individual asset claims work properly
- ✅ Combined asset claims work properly
- ✅ Lock modifications work per asset without affecting the other
- ✅ Withdrawals work independently for each asset
- ✅ Total values aggregate correctly across assets

**Failure Scenarios**:
- ❌ Cross-asset interference or conflicts
- ❌ Incorrect reward calculations for multiple assets
- ❌ Lock modifications affect wrong assets
- ❌ Withdrawal from one asset affects the other
- ❌ Incorrect total value calculations

### 6.2 State Consistency Across Operations
**Objective**: Verify UI state remains consistent across multiple operations

**Test Steps**:
1. Perform deposit, claim, and withdrawal in sequence
2. Refresh page and verify state persistence
3. Open multiple modals and verify data consistency
4. Switch between assets and verify independent state
5. Test concurrent operations where possible

**Expected Results**:
- ✅ UI state updates correctly after each operation
- ✅ Page refresh maintains correct state
- ✅ Data consistency across all UI components
- ✅ Asset-specific state remains independent
- ✅ No race conditions or state conflicts
- ✅ Position data matches contract state

**Failure Scenarios**:
- ❌ UI state becomes inconsistent between operations
- ❌ Page refresh loses or corrupts state
- ❌ Data conflicts between UI components
- ❌ Asset state interference
- ❌ Race conditions cause incorrect data display

---

## 7. Secondary Testing (Edge Cases and Performance)

### 7.1 Lock Duration and Multiplier Edge Cases
**Objective**: Test edge cases in lock duration and multiplier calculations

**Test Steps**:
1. Test minimum and maximum lock durations
2. Test custom duration input with edge values
3. Verify multiplier calculations for extreme values
4. Test lock duration changes with existing locks

**Expected Results**:
- ✅ All lock duration options work within valid ranges
- ✅ Multiplier estimation handles edge cases correctly
- ✅ Custom duration input validates properly
- ✅ Multiplier calculations are accurate for all scenarios

**Failure Scenarios**:
- ❌ Edge case lock durations cause errors
- ❌ Multiplier calculations break with extreme values
- ❌ Custom duration input allows invalid values

### 7.2 Performance Testing
**Objective**: Evaluate page and component performance

**Test Steps**:
1. Measure initial page load time
2. Test data refresh performance
3. Evaluate modal opening speed
4. Test with slow network conditions
5. Check transaction status update speed

**Expected Results**:
- ✅ Page loads within 3 seconds
- ✅ Data refreshes smoothly
- ✅ Modals open quickly (<500ms)
- ✅ Graceful handling of slow networks
- ✅ Real-time transaction updates work properly

**Performance Benchmarks**:
- Initial load: < 3 seconds
- Modal opening: < 500ms
- Data refresh: < 2 seconds
- Transaction status updates: < 5 seconds

### 7.3 Mobile Responsiveness
**Objective**: Test mobile device compatibility

**Test Steps**:
1. Test on various mobile screen sizes
2. Verify touch interactions work
3. Check modal display on mobile
4. Test wallet connection on mobile
5. Verify all buttons are accessible

**Expected Results**:
- ✅ Responsive design works on all screen sizes
- ✅ Touch interactions are reliable
- ✅ Modals display properly on mobile
- ✅ Mobile wallet integration works
- ✅ All functionality accessible on mobile

**Failure Scenarios**:
- ❌ Layout breaks on small screens
- ❌ Touch interactions don't work
- ❌ Modals are unusable on mobile
- ❌ Mobile wallet connection issues

### 7.4 Network Congestion and Edge Cases
**Objective**: Test behavior under adverse network conditions

**Test Steps**:
1. Test during high network congestion
2. Disconnect internet during transaction
3. Test with very slow network
4. Test transaction timeout scenarios
5. Test recovery from network failures

**Expected Results**:
- ✅ Appropriate handling of network congestion
- ✅ Clear error messages for network issues
- ✅ Retry mechanisms where appropriate
- ✅ Graceful timeout handling
- ✅ Recovery options provided

**Failure Scenarios**:
- ❌ App crashes during network issues
- ❌ No recovery from network failures
- ❌ Unclear error messages
- ❌ Transactions get stuck indefinitely

---

## 8. Advanced Error Scenarios

### 8.1 Contract Interaction Failures
**Objective**: Test handling of complex contract failures

**Test Steps**:
1. Test with contracts paused (if applicable)
2. Test with invalid contract parameters
3. Test during contract upgrade scenarios
4. Test with insufficient gas for complex operations
5. Test with contract state changes during transaction

**Expected Results**:
- ✅ Clear error messages for contract failures
- ✅ Graceful handling of paused contracts
- ✅ Proper validation of contract parameters
- ✅ Appropriate gas estimation warnings
- ✅ Recovery guidance for contract issues

**Failure Scenarios**:
- ❌ Cryptic contract error messages
- ❌ App crashes on contract failures
- ❌ No guidance for resolving contract issues
- ❌ Transactions proceed with invalid parameters

### 8.2 Wallet Compatibility Edge Cases
**Objective**: Test with various wallet types and scenarios

**Test Steps**:
1. Test with different wallet types (MetaMask, WalletConnect, etc.)
2. Test wallet switching during operations
3. Test with hardware wallets
4. Test with wallets that have signing delays
5. Test wallet disconnection recovery

**Expected Results**:
- ✅ Compatibility with major wallet types
- ✅ Graceful handling of wallet switches
- ✅ Support for hardware wallet workflows
- ✅ Proper handling of signing delays
- ✅ Clear recovery options for wallet issues

**Failure Scenarios**:
- ❌ Poor wallet compatibility
- ❌ App breaks when wallets switch
- ❌ Hardware wallet integration issues
- ❌ Timeout issues with slow signing

---

---

## Test Reporting

### Test Execution Log
For each test section, document:

```
Test Section: [Section Name]
Date/Time: [Timestamp]
Tester: [Name]
Environment: Sepolia Testnet
Wallet: [Wallet Type & Address]

Results:
✅ [Passed Test Description]
❌ [Failed Test Description] - [Error Details]
⚠️ [Issue/Warning] - [Description]

Screenshots: [Attach relevant screenshots]
Transaction Hashes: [List relevant tx hashes]
```

### Issue Tracking
For any failures or issues found:

```
Issue ID: [Unique ID]
Severity: [Critical/High/Medium/Low]
Component: [Affected Component]
Description: [Detailed description]
Steps to Reproduce: [Step by step]
Expected vs Actual: [What should happen vs what happens]
Environment: [Network, wallet, etc.]
Screenshots/Videos: [Attach if relevant]
```

### Success Criteria
The testing is considered successful when:

1. **Core Functionality**: All deposit, withdrawal, and claiming flows work correctly
2. **Multi-Asset Support**: Both stETH and LINK assets function independently and together
3. **Cross-Chain**: MOR claiming works properly across L1→L2
4. **Error Handling**: All error scenarios are handled gracefully
5. **Performance**: Page meets performance benchmarks
6. **UX**: User experience is intuitive and responsive

### Sign-off
```
Testing completed by: [Name]
Date: [Date]
Overall Status: [Pass/Fail/Pass with Issues]
Critical Issues: [Number]
Total Issues Found: [Number]
Recommendation: [Ready for deployment/Needs fixes/etc.]
```

---

## Appendix

### Useful Commands
```bash
# Check transaction status
cast tx [TX_HASH] --rpc-url https://sepolia.infura.io/v3/[KEY]

# Check contract state
cast call [CONTRACT_ADDRESS] "balanceOf(address)(uint256)" [USER_ADDRESS] --rpc-url https://sepolia.infura.io/v3/[KEY]

# Monitor events
cast logs --from-block latest --address [CONTRACT_ADDRESS] --rpc-url https://sepolia.infura.io/v3/[KEY]
```

### Bug reports table

### Test Data Tracking
Keep a spreadsheet or document tracking:
- Test wallet addresses used
- Transaction hashes for each test
- Token balances before/after each test
- Timestamps of test execution
- Any anomalies or unexpected behavior

This comprehensive testing plan ensures all aspects of the Capital V2 implementation are thoroughly validated before deployment to production.