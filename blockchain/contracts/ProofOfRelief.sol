// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

/**
 * @title ProofOfRelief
 * @notice Soulbound ERC-721 NFT issued to volunteers upon completing a relief mission.
 *         Non-transferable. Metadata is stored fully on-chain as a Base64-encoded SVG.
 */
contract ProofOfRelief is ERC721, ERC721URIStorage, Ownable {
    using Strings for uint256;

    // ─────────────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────────────

    struct ReliefMetadata {
        uint256 missionId;
        address volunteer;
        string  location;
        string  aidType;
        uint256 timestamp;
        uint256 tokenId;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    uint256 private _tokenCounter;

    // tokenId → metadata
    mapping(uint256 => ReliefMetadata) public reliefData;

    // Only MissionRegistry (or approved minters) can mint
    mapping(address => bool) public minters;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event ReliefMinted(
        uint256 indexed tokenId,
        uint256 indexed missionId,
        address indexed volunteer,
        string location,
        string aidType
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────

    error SoulboundToken();
    error NotMinter();

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(address initialOwner)
        ERC721("Proof of Relief", "POR")
        Ownable(initialOwner)
    {
        minters[initialOwner] = true;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    function setMinter(address account, bool granted) external onlyOwner {
        minters[account] = granted;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Mint
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Mint a Proof-of-Relief NFT. Called by MissionRegistry on completion.
     */
    function mintRelief(
        address volunteer,
        uint256 missionId,
        string calldata location,
        string calldata aidType,
        uint256 timestamp
    ) external returns (uint256 tokenId) {
        if (!minters[msg.sender] && msg.sender != owner()) revert NotMinter();

        _tokenCounter++;
        tokenId = _tokenCounter;

        reliefData[tokenId] = ReliefMetadata({
            missionId: missionId,
            volunteer: volunteer,
            location: location,
            aidType: aidType,
            timestamp: timestamp,
            tokenId: tokenId
        });

        _safeMint(volunteer, tokenId);
        _setTokenURI(tokenId, _buildTokenURI(tokenId));

        emit ReliefMinted(tokenId, missionId, volunteer, location, aidType);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Soulbound – block all transfers
    // ─────────────────────────────────────────────────────────────────────────

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721) returns (address) {
        address from = _ownerOf(tokenId);
        // Allow minting (from == address(0)) but block all transfers
        if (from != address(0) && to != address(0)) revert SoulboundToken();
        return super._update(to, tokenId, auth);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // On-chain SVG metadata
    // ─────────────────────────────────────────────────────────────────────────

    function _buildTokenURI(uint256 tokenId) internal view returns (string memory) {
        ReliefMetadata memory d = reliefData[tokenId];

        string memory svg = string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">',
            '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">',
            '<stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#1e3a5f"/></linearGradient></defs>',
            '<rect width="400" height="400" fill="url(#bg)" rx="20"/>',
            // Red cross emblem
            '<rect x="185" y="60" width="30" height="80" fill="#ef4444" rx="4"/>',
            '<rect x="160" y="85" width="80" height="30" fill="#ef4444" rx="4"/>',
            // Title
            '<text x="200" y="185" text-anchor="middle" font-family="Arial,sans-serif" ',
            'font-size="18" font-weight="bold" fill="#f1f5f9">PROOF OF RELIEF</text>',
            '<text x="200" y="210" text-anchor="middle" font-family="Arial,sans-serif" ',
            'font-size="11" fill="#94a3b8">ResQNet Protocol</text>',
            // Divider
            '<line x1="40" y1="225" x2="360" y2="225" stroke="#334155" stroke-width="1"/>',
            // Mission info
            '<text x="40" y="250" font-family="Arial,sans-serif" font-size="11" fill="#64748b">MISSION</text>',
            '<text x="40" y="268" font-family="Arial,sans-serif" font-size="13" fill="#e2e8f0">#',
            d.missionId.toString(),
            '</text>',
            '<text x="220" y="250" font-family="Arial,sans-serif" font-size="11" fill="#64748b">AID TYPE</text>',
            '<text x="220" y="268" font-family="Arial,sans-serif" font-size="12" fill="#e2e8f0">',
            _truncate(d.aidType, 14),
            '</text>',
            '<text x="40" y="295" font-family="Arial,sans-serif" font-size="11" fill="#64748b">LOCATION</text>',
            '<text x="40" y="313" font-family="Arial,sans-serif" font-size="11" fill="#e2e8f0">',
            _truncate(d.location, 30),
            '</text>',
            '<text x="40" y="340" font-family="Arial,sans-serif" font-size="11" fill="#64748b">COMPLETED</text>',
            '<text x="40" y="358" font-family="Arial,sans-serif" font-size="11" fill="#e2e8f0">',
            _formatTimestamp(d.timestamp),
            '</text>',
            // Soulbound badge
            '<rect x="270" y="330" width="90" height="25" fill="#1e3a5f" rx="12" stroke="#3b82f6" stroke-width="1"/>',
            '<text x="315" y="347" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" fill="#3b82f6">SOULBOUND</text>',
            '</svg>'
        ));

        string memory json = Base64.encode(bytes(string(abi.encodePacked(
            '{"name":"Proof of Relief #', tokenId.toString(), '",',
            '"description":"Verifiable on-chain credential for completing a ResQNet disaster relief mission.",',
            '"image":"data:image/svg+xml;base64,', Base64.encode(bytes(svg)), '",',
            '"attributes":[',
            '{"trait_type":"Mission ID","value":"', d.missionId.toString(), '"},',
            '{"trait_type":"Aid Type","value":"', d.aidType, '"},',
            '{"trait_type":"Location","value":"', d.location, '"},',
            '{"trait_type":"Timestamp","value":"', d.timestamp.toString(), '"},',
            '{"trait_type":"Soulbound","value":"true"}',
            ']}'
        ))));

        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    function _truncate(string memory s, uint256 maxLen) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        if (b.length <= maxLen) return s;
        bytes memory result = new bytes(maxLen - 3);
        for (uint256 i = 0; i < maxLen - 3; i++) result[i] = b[i];
        return string(abi.encodePacked(result, "..."));
    }

    function _formatTimestamp(uint256 ts) internal pure returns (string memory) {
        // Returns a simple epoch string – frontends can parse it
        return string(abi.encodePacked("epoch:", ts.toString()));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Required overrides
    // ─────────────────────────────────────────────────────────────────────────

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function totalSupply() external view returns (uint256) {
        return _tokenCounter;
    }
}
