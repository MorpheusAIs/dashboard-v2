# Rabby Wallet Connection Troubleshooting Guide

## Issue: "Wallet not connected" but reading from address / WalletConnect timeout

### Problem Description
Users experience connection issues with Rabby wallet where:
- The app shows "wallet not connected" but can detect the address
- WalletConnect connection attempts timeout
- Connection state is inconsistent

### Root Causes

1. **Multiple Wallet Extensions**: Rabby competes with other browser wallet extensions (MetaMask, Coinbase Wallet, etc.) for the `window.ethereum` object
2. **Provider Priority**: When multiple wallets are installed, the browser may prioritize one over Rabby
3. **WalletConnect Confusion**: Rabby is an injected wallet, not a WalletConnect wallet - selecting WalletConnect will fail

## Solutions

### Option 1: Disable Competing Wallet Extensions (Recommended)

1. **Open your browser's extension settings**:
   - Chrome: `chrome://extensions`
   - Brave: `brave://extensions`
   - Edge: `edge://extensions`

2. **Temporarily disable other wallet extensions**:
   - MetaMask
   - Coinbase Wallet
   - Trust Wallet
   - Any other Web3 wallets

3. **Keep only Rabby enabled**

4. **Refresh the page** and try connecting again

### Option 2: Use Web3Modal's Wallet Selection

1. **Click "Connect Wallet" button**
2. **Select "Injected" or "Browser Wallet"** (NOT WalletConnect)
3. **Choose Rabby** from the list if multiple options appear
4. **Approve the connection** in Rabby's popup

### Option 3: Clear Browser Data

If the above doesn't work, clear cached wallet data:

1. **Open browser DevTools** (F12 or Right-click → Inspect)
2. **Go to Application/Storage tab**
3. **Clear these localStorage items**:
   - All items starting with `walletconnect`
   - All items starting with `wc@2`
   - All items starting with `@walletconnect`
   - All items starting with `wagmi`
   - All items starting with `appkit`

4. **Refresh the page** and reconnect

### Option 4: Use Rabby's Wallet Management

Rabby has built-in conflict resolution:

1. **Open Rabby extension**
2. **Go to Settings → Advanced**
3. **Enable "Prefer Rabby" or "Set as Default Wallet"**
4. **Refresh the page**

## Technical Details

### Why This Happens

When multiple wallet extensions are installed, they all try to inject themselves into `window.ethereum`. The browser can only have one active provider at a time, leading to conflicts.

### How We Fixed It

The app now includes:

1. **Better Wallet Detection**: Logs which wallets are detected on connection
2. **Rabby-Specific Configuration**: Explicitly includes Rabby in supported wallets list
3. **Multi-Provider Discovery**: Enables detection of multiple injected providers
4. **Clear Error Messages**: Console logs help identify which wallet is active

### Debugging Steps

1. **Open browser console** (F12 → Console tab)
2. **Look for wallet detection logs**:
   ```
   🦊 Wallet detection: {
     isRabby: true/false,
     isMetaMask: true/false,
     ...
   }
   ```

3. **Check the messages**:
   - ✅ "Rabby wallet detected and active" - Good, Rabby is working
   - ⚠️ "Rabby wallet detected but not active" - Conflict with another wallet
   - No Rabby message - Rabby extension may not be installed/enabled

## Best Practices

1. **One Wallet Extension**: Keep only one wallet extension enabled at a time
2. **Use Injected Connection**: Always select "Browser Wallet" or "Injected", never "WalletConnect" for Rabby
3. **Clear Cache**: If switching between wallets, clear localStorage first
4. **Update Rabby**: Keep Rabby wallet extension up to date

## Still Having Issues?

If none of the above solutions work:

1. **Check Rabby is installed and updated**: Visit [Rabby Wallet](https://rabby.io/)
2. **Try a different browser**: Test if the issue is browser-specific
3. **Check Rabby's status**: Visit Rabby's documentation or Discord for known issues
4. **Use an alternative wallet**: MetaMask, Coinbase Wallet, or WalletConnect-compatible wallets

## Technical Support Info

When reporting issues, include:
- Browser and version
- Rabby wallet version
- Other installed wallet extensions
- Console logs from the "Wallet detection" message
- Screenshot of the connection error

---

**Note**: These connection improvements were added in the latest update. Make sure you're running the latest version of the app.
