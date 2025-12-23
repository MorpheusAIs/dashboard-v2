// Layer 0 Bridge Code for MOR Token - Extracted from morlord.com
// This code allows bridging MOR tokens between Arbitrum One and Base networks

// Bridge function that handles cross-chain transfers using LayerZero
async function ProcessTransfer() {
    // Get destination address and validate
    var toAddr = $("#txtTransferAddrTo").val();
    var maxMOR = $("#lblTransferBalance").attr("data-value") / 1000000000000000000;

    var isValidAddress = false;

    try {
        _eth.web3.utils.toChecksumAddress(toAddr)
        isValidAddress = true;
    }
    catch (err) {
        isValidAddress = false;
    }

    if (toAddr == "" || !isValidAddress) {
        toastr.error("Invalid destination address entered.");
        return;
    }

    // Validate and format amount
    var a = $("#txtTransferAmt").val().replace(",", "") * 1;
    a = isNaN(a) ? 0 : a;

    if (a <= 0) {
        toastr.error("Invalid MOR amount entered.");
        return;
    }

    if (a > maxMOR) {
        toastr.error("Amount entered is greater than balance.");
        return;
    }

    // Convert amount to wei (18 decimals)
    var tmpA = (a + "").split(".");
    var amt = (tmpA[0] == 0 ? "" : tmpA[0]) + (tmpA.length > 1 ? tmpA[1].padEnd(18, "0") : "000000000000000000");

    //-----------------------------------
    // Determine source chain and get LayerZero endpoint ID
    var id, curr, qs;

    id = $("#ddTransferTo").val() * 1; // LayerZero endpoint ID for destination chain

    // Select the current chain's token contract
    if (chain.name == "Ethereum") {
        curr = _eth;
    }

    if (chain.name == "Arbitrum") {
        curr = _arb;
    }

    if (chain.name == "Base") {
        curr = _base;
    }

    //--------------------------------------
    // Prepare payload for LayerZero send
    var toAddr = $("#txtTransferAddrTo").val().replace("0x", "");

    $("#btnTransfer").prop("disabled", "true");
    $("#btnTransfer").html("Submitting Transfer...");

    // Payload structure for LayerZero OFT send:
    // [destinationEid, receiver, amountLD, minAmountLD, extraData, composeMsg, oftCmd]
    var payload = [id, "0x000000000000000000000000" + toAddr, amt, amt, "0x", "0x", "0x"];

    console.log(payload);

    //--------------------------------------
    // Step 1: Quote the fee for the cross-chain transfer
    await curr.token.methods.quoteSend(payload, false).call(function (err, res) {
        qs = res; // qs contains [nativeFee, lzTokenFee]

        console.log(res);

        if (err !== null) {
            toastr.error(err);

            $("#btnTransfer").removeAttr("disabled");
            $("#btnTransfer").html("Transfer");

            return;
        }
    });

    //--------------------------------------
    // Step 2: Execute the send transaction with LayerZero
    // The send function burns tokens on source chain and sends message to destination chain
    var d = curr.token.methods.send(payload, qs, $("#txtTransferAddrFrom").val()).encodeABI();

    ethereum.request({
        method: "eth_sendTransaction",
        params: [{ 
            from: accounts[0], 
            to: chain.token, // MOR token contract address on current chain
            value: "0x" + (qs[0] * 1).toString(16), // Native fee for LayerZero
            data: d 
        }]
    }).then((result) => {
        $("#pane-transfer .ldr").show();
        $("#secTransfer").hide();

        toastr.success("Transfer was successfully submitted. Transfers can take up to 15 minutes.");

        WaitForTransfer(result);

    }).catch((err) => {
        toastr.error("Transfer was rejected.");

        $("#btnTransfer").removeAttr("disabled");
        $("#btnTransfer").html("Transfer");
    });
}

// Wait for transfer transaction to be confirmed
async function WaitForTransfer(txHash) {
    $("#pane-transfer .ldr .ldrMsg").html("Processing transfer, please wait...");

    var receipt = await web3.eth.getTransactionReceipt(txHash);
    if (receipt == null) {
        setTimeout(await WaitForTransfer(txHash), 2000);
    } else {
        if (receipt.status) {
            $("#btnTransfer").removeAttr("disabled");
            $("#btnTransfer").html("Transfer");

            toastr.success("Transfer completed successfully.");
        } else {
            toastr.error("Transfer failed to complete.");
        }

        $("#pane-transfer .ldr .ldrMsg").html("Loading Data...");
        initialize(true);
    }
}

// ============================================================
// CHAIN CONFIGURATION (from chains.js)
// ============================================================

// LayerZero Endpoint IDs (LzId) - used as destination endpoint ID in payload:
// - Ethereum: 30101
// - Arbitrum: 30110  
// - Base: 30184

// MOR Token Contract Addresses (OFT contracts):
// - Arbitrum One: 0x092baadb7def4c3981454dd9c0a0d7ff07bcfc86
// - Base: 0x7431ada8a591c955a994a21710752ef9b882b8e3
// - Ethereum: 0xcBB8f1BDA10b9696c57E13BC128Fe674769DCEc0

// Chain IDs:
// - Ethereum: 1
// - Arbitrum One: 42161
// - Base: 8453

// ============================================================
// HOW THE BRIDGE WORKS
// ============================================================

// The bridge uses LayerZero's OFT (Omnichain Fungible Token) standard:
// 
// 1. quoteSend(payload, payInLzToken) 
//    - Gets the fee estimate for cross-chain transfer
//    - Returns: [nativeFee, lzTokenFee] - fees required for the transfer
//    - nativeFee: Amount of native token (ETH) needed for LayerZero messaging
//    - lzTokenFee: Amount of LZ token needed (if payInLzToken is true)
//
// 2. send(payload, fee, refundAddress)
//    - Burns tokens on source chain
//    - Sends LayerZero message to destination chain via LayerZero endpoint
//    - Payload structure: [destinationEid, receiver, amountLD, minAmountLD, extraData, composeMsg, oftCmd]
//      - destinationEid: LayerZero endpoint ID of destination chain (30110 for Arbitrum, 30184 for Base)
//      - receiver: Address to receive tokens on destination chain (padded to 32 bytes)
//      - amountLD: Amount to send in local decimals (wei for 18 decimals)
//      - minAmountLD: Minimum amount to receive (for slippage protection)
//      - extraData: Additional data (empty "0x")
//      - composeMsg: Compose message (empty "0x")
//      - oftCmd: OFT command (empty "0x")
//
// 3. Destination chain receives LayerZero message
//    - LayerZero endpoint on destination chain receives the message
//    - MOR token contract on destination chain mints tokens to recipient
//    - Process typically takes 5-15 minutes

// ============================================================
// EXAMPLE USAGE
// ============================================================

// To bridge from Arbitrum to Base:
// 1. User is connected to Arbitrum network (chainId: 42161)
// 2. User calls ProcessTransfer() with:
//    - Destination chain: Base (LzId: 30184)
//    - Amount: Amount of MOR tokens to bridge
//    - Recipient: Address on Base network
// 3. quoteSend() calculates fees
// 4. send() burns tokens on Arbitrum and sends message to Base
// 5. Base chain receives message and mints tokens to recipient

// To bridge from Base to Arbitrum:
// 1. User is connected to Base network (chainId: 8453)
// 2. User calls ProcessTransfer() with:
//    - Destination chain: Arbitrum (LzId: 30110)
//    - Amount: Amount of MOR tokens to bridge
//    - Recipient: Address on Arbitrum network
// 3. Same process as above, but in reverse direction
