// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title PaymentChannel
 * @notice Uni-directional state-channel for decentralized offline payments.
 *
 * FLOW
 * ────
 *  1. Payer (NGO / coordinator) calls openChannel(recipient, timeout) {value: totalFunds}.
 *  2. OFFLINE: Payer signs payment vouchers: hash(channelId, amount, nonce).
 *     Vouchers travel over Bluetooth, QR, or NFC – no internet required.
 *  3. Recipient calls closeChannel(channelId, amount, nonce, sig)  – submits
 *     the highest-value voucher.  Contract pays out `amount`, refunds rest.
 *  4. If payer is unresponsive, recipient can call initiateClose() to start
 *     the dispute window, then finalizeClose() after timeout.
 *  5. Payer can top-up a channel at any time by calling topUp(channelId).
 *
 * BATCH VOUCHERS
 * ──────────────
 *  A single channel can carry multiple payees via voucher fan-out –
 *  the recipient verifies the payer's signature off-chain before accepting
 *  goods/services, then settles on-chain later.
 */
contract PaymentChannel is ReentrancyGuard {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ─────────────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────────────

    enum ChannelState { Open, Closing, Closed }

    struct Channel {
        address payer;
        address recipient;
        uint256 balance;      // remaining ETH in channel
        uint256 timeout;      // seconds the recipient has to submit voucher after close initiated
        uint256 closingAt;    // block.timestamp when initiateClose was called (0 if not initiated)
        uint256 nonce;        // last settled nonce (prevents replay)
        ChannelState state;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    uint256 private _channelCounter;

    // channelId → Channel
    mapping(uint256 => Channel) public channels;

    // payer → list of channel ids
    mapping(address => uint256[]) private _payerChannels;

    // recipient → list of channel ids
    mapping(address => uint256[]) private _recipientChannels;

    // channelId → nonce → settled (prevents double-spend within a channel)
    mapping(uint256 => mapping(uint256 => bool)) private _usedNonces;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event ChannelOpened(
        uint256 indexed channelId,
        address indexed payer,
        address indexed recipient,
        uint256 amount,
        uint256 timeout
    );
    event ChannelToppedUp(uint256 indexed channelId, uint256 addedAmount, uint256 newBalance);
    event ChannelClosed(
        uint256 indexed channelId,
        address indexed recipient,
        uint256 paidOut,
        uint256 refunded
    );
    event CloseInitiated(uint256 indexed channelId, uint256 deadline);
    event ChannelExpired(uint256 indexed channelId, uint256 refunded);

    // ─────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────

    error ChannelNotFound();
    error ChannelNotOpen();
    error ChannelAlreadyClosing();
    error NotPayer();
    error NotRecipient();
    error AmountExceedsBalance();
    error InvalidSignature();
    error NonceTooLow();
    error NonceAlreadyUsed();
    error DisputeWindowActive();
    error DisputeWindowNotExpired();
    error ZeroAmount();
    error InvalidTimeout();

    // ─────────────────────────────────────────────────────────────────────────
    // Open / top-up
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Open a payment channel. msg.value is the total budget.
     * @param recipient  Who receives payments (volunteer, vendor, etc.)
     * @param timeout    Dispute window in seconds (min 300 = 5 min)
     */
    function openChannel(address recipient, uint256 timeout)
        external
        payable
        returns (uint256 channelId)
    {
        if (msg.value == 0) revert ZeroAmount();
        if (timeout < 300) revert InvalidTimeout();
        require(recipient != address(0), "Invalid recipient");
        require(recipient != msg.sender, "Payer cannot be recipient");

        _channelCounter++;
        channelId = _channelCounter;

        channels[channelId] = Channel({
            payer: msg.sender,
            recipient: recipient,
            balance: msg.value,
            timeout: timeout,
            closingAt: 0,
            nonce: 0,
            state: ChannelState.Open
        });

        _payerChannels[msg.sender].push(channelId);
        _recipientChannels[recipient].push(channelId);

        emit ChannelOpened(channelId, msg.sender, recipient, msg.value, timeout);
    }

    /**
     * @notice Top up an existing open channel with more ETH.
     */
    function topUp(uint256 channelId) external payable {
        if (msg.value == 0) revert ZeroAmount();
        Channel storage ch = _getOpenChannel(channelId);
        if (ch.payer != msg.sender) revert NotPayer();

        ch.balance += msg.value;
        emit ChannelToppedUp(channelId, msg.value, ch.balance);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Close (cooperative – recipient submits latest voucher)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Cooperative close: recipient submits a signed voucher from payer.
     *         This is the normal happy path – settles instantly.
     *
     * @param channelId  Channel to close
     * @param amount     Amount to pay recipient (from the voucher)
     * @param nonce      Strictly increasing nonce from the voucher
     * @param signature  Payer's signature over keccak256(channelId, amount, nonce, address(this), chainId)
     */
    function closeChannel(
        uint256 channelId,
        uint256 amount,
        uint256 nonce,
        bytes calldata signature
    ) external nonReentrant {
        Channel storage ch = channels[channelId];
        if (ch.payer == address(0)) revert ChannelNotFound();
        if (ch.state == ChannelState.Closed) revert ChannelNotOpen();
        if (ch.recipient != msg.sender) revert NotRecipient();
        if (amount == 0) revert ZeroAmount();
        if (amount > ch.balance) revert AmountExceedsBalance();
        if (nonce <= ch.nonce) revert NonceTooLow();
        if (_usedNonces[channelId][nonce]) revert NonceAlreadyUsed();

        // Verify payer's signature
        bytes32 msgHash = _voucherHash(channelId, amount, nonce);
        address signer = msgHash.toEthSignedMessageHash().recover(signature);
        if (signer != ch.payer) revert InvalidSignature();

        // Mark settled
        _usedNonces[channelId][nonce] = true;
        ch.nonce = nonce;

        uint256 refund = ch.balance - amount;
        ch.balance = 0;
        ch.state = ChannelState.Closed;

        // Pay recipient
        (bool sent, ) = payable(ch.recipient).call{value: amount}("");
        require(sent, "Payment failed");

        // Refund remainder to payer
        if (refund > 0) {
            (bool refunded, ) = payable(ch.payer).call{value: refund}("");
            require(refunded, "Refund failed");
        }

        emit ChannelClosed(channelId, ch.recipient, amount, refund);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Dispute path (payer unresponsive or connectivity unavailable)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Recipient starts dispute timer. After `timeout` seconds,
     *         they can call finalizeClose() to claim the full balance.
     *         Payer can still call closeChannel with a newer voucher to override.
     */
    function initiateClose(uint256 channelId) external {
        Channel storage ch = _getOpenChannel(channelId);
        if (ch.recipient != msg.sender) revert NotRecipient();
        if (ch.state == ChannelState.Closing) revert ChannelAlreadyClosing();

        ch.state = ChannelState.Closing;
        ch.closingAt = block.timestamp;

        emit CloseInitiated(channelId, block.timestamp + ch.timeout);
    }

    /**
     * @notice After dispute window expires, recipient claims full remaining balance.
     */
    function finalizeClose(uint256 channelId) external nonReentrant {
        Channel storage ch = channels[channelId];
        if (ch.payer == address(0)) revert ChannelNotFound();
        if (ch.state != ChannelState.Closing) revert ChannelNotOpen();
        if (ch.recipient != msg.sender) revert NotRecipient();
        if (block.timestamp < ch.closingAt + ch.timeout) revert DisputeWindowNotExpired();

        uint256 payout = ch.balance;
        ch.balance = 0;
        ch.state = ChannelState.Closed;

        (bool sent, ) = payable(ch.recipient).call{value: payout}("");
        require(sent, "Payment failed");

        emit ChannelClosed(channelId, ch.recipient, payout, 0);
    }

    /**
     * @notice Payer reclaims funds from an expired open channel (no activity).
     *         Can only be called by payer, and only if state is Open (no dispute pending).
     */
    function reclaimExpired(uint256 channelId) external nonReentrant {
        Channel storage ch = channels[channelId];
        if (ch.payer == address(0)) revert ChannelNotFound();
        if (ch.payer != msg.sender) revert NotPayer();
        if (ch.state != ChannelState.Open) revert ChannelNotOpen();
        // Payer can only reclaim after 30 days of inactivity
        require(
            block.timestamp > ch.closingAt + 30 days || ch.closingAt == 0,
            "Too early"
        );
        require(block.timestamp > ch.closingAt + ch.timeout, "Dispute window active");

        uint256 refund = ch.balance;
        ch.balance = 0;
        ch.state = ChannelState.Closed;

        (bool sent, ) = payable(ch.payer).call{value: refund}("");
        require(sent, "Refund failed");

        emit ChannelExpired(channelId, refund);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Voucher verification (pure – works off-chain via eth_call too)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Verify a payment voucher off-chain. Returns the signer address.
     *         Call this from mobile app (read-only, no gas) to validate vouchers
     *         received via Bluetooth/QR before accepting goods/services.
     */
    function verifyVoucher(
        uint256 channelId,
        uint256 amount,
        uint256 nonce,
        bytes calldata signature
    ) external view returns (address signer, bool valid) {
        Channel storage ch = channels[channelId];
        bytes32 msgHash = _voucherHash(channelId, amount, nonce);
        signer = msgHash.toEthSignedMessageHash().recover(signature);
        valid = (
            signer == ch.payer &&
            ch.state == ChannelState.Open &&
            amount <= ch.balance &&
            nonce > ch.nonce &&
            !_usedNonces[channelId][nonce]
        );
    }

    /**
     * @notice Hash a voucher the same way the contract does.
     *         Use this in web3.js/ethers off-chain to create signable hashes.
     */
    function voucherHash(uint256 channelId, uint256 amount, uint256 nonce)
        external
        view
        returns (bytes32)
    {
        return _voucherHash(channelId, amount, nonce);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────────────────

    function getChannel(uint256 channelId) external view returns (Channel memory) {
        return channels[channelId];
    }

    function getPayerChannels(address payer) external view returns (uint256[] memory) {
        return _payerChannels[payer];
    }

    function getRecipientChannels(address recipient) external view returns (uint256[] memory) {
        return _recipientChannels[recipient];
    }

    function totalChannels() external view returns (uint256) {
        return _channelCounter;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    function _voucherHash(uint256 channelId, uint256 amount, uint256 nonce)
        internal
        view
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(channelId, amount, nonce, address(this), block.chainid));
    }

    function _getOpenChannel(uint256 channelId) internal view returns (Channel storage ch) {
        ch = channels[channelId];
        if (ch.payer == address(0)) revert ChannelNotFound();
        if (ch.state == ChannelState.Closed) revert ChannelNotOpen();
    }
}
