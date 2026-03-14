// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IProofOfRelief {
    function mintRelief(
        address volunteer,
        uint256 missionId,
        string calldata location,
        string calldata aidType,
        uint256 timestamp
    ) external returns (uint256);
}

/**
 * @title MissionRegistry
 * @notice On-chain registry for ResQNet disaster relief missions.
 *         Every mission lifecycle event is immutably stored and verifiable.
 */
contract MissionRegistry is Ownable, ReentrancyGuard {
    // ─────────────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────────────

    enum MissionStatus {
        Created,    // 0 – AI generated, awaiting volunteer
        Assigned,   // 1 – volunteer accepted
        InProgress, // 2 – en route
        Completed,  // 3 – relief delivered, NFT minted
        Cancelled   // 4 – cancelled / unable to complete
    }

    enum EmergencyType {
        Medical,
        Food,
        Water,
        Shelter,
        Search,
        Evacuate,
        Other
    }

    struct Mission {
        uint256 id;
        string  location;          // human-readable location string
        int256  lat;               // latitude  × 1e6 (avoid floats)
        int256  lng;               // longitude × 1e6
        address volunteer;         // assigned volunteer wallet
        MissionStatus status;
        EmergencyType emergencyType;
        string  resourceType;      // e.g. "insulin", "drinking water"
        string  aiReasoning;       // explainable AI rationale
        uint256 createdAt;
        uint256 assignedAt;
        uint256 completedAt;
        uint256 porTokenId;        // Proof-of-Relief NFT id (set on completion)
        uint256 rewardWei;         // optional on-chain reward in wei
        bool    rewardClaimed;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    uint256 private _missionCounter;
    mapping(uint256 => Mission) public missions;

    // volunteer → list of mission ids
    mapping(address => uint256[]) private _volunteerMissions;

    // coordinator role – can create missions programmatically
    mapping(address => bool) public coordinators;

    IProofOfRelief public porContract;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event MissionCreated(
        uint256 indexed missionId,
        EmergencyType emergencyType,
        string location,
        string resourceType,
        uint256 rewardWei
    );
    event MissionAssigned(uint256 indexed missionId, address indexed volunteer);
    event MissionInProgress(uint256 indexed missionId, address indexed volunteer);
    event MissionCompleted(
        uint256 indexed missionId,
        address indexed volunteer,
        uint256 porTokenId
    );
    event MissionCancelled(uint256 indexed missionId, address indexed by);
    event CoordinatorUpdated(address indexed account, bool granted);
    event PorContractUpdated(address indexed newContract);

    // ─────────────────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────────────────

    modifier onlyCoordinator() {
        require(coordinators[msg.sender] || msg.sender == owner(), "Not coordinator");
        _;
    }

    modifier missionExists(uint256 id) {
        require(id > 0 && id <= _missionCounter, "Mission not found");
        _;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(address initialOwner) Ownable(initialOwner) {
        coordinators[initialOwner] = true;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    function setCoordinator(address account, bool granted) external onlyOwner {
        coordinators[account] = granted;
        emit CoordinatorUpdated(account, granted);
    }

    function setPorContract(address contractAddress) external onlyOwner {
        porContract = IProofOfRelief(contractAddress);
        emit PorContractUpdated(contractAddress);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Mission lifecycle
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Create a new relief mission. Called by AI coordinator or owner.
     * @param location  Human-readable location (e.g. "Building B, Sector 7")
     * @param lat       Latitude  × 1e6
     * @param lng       Longitude × 1e6
     * @param emergencyType  Emergency category
     * @param resourceType   Resource to deliver (e.g. "insulin")
     * @param aiReasoning    AI-generated explanation
     */
    function createMission(
        string calldata location,
        int256 lat,
        int256 lng,
        EmergencyType emergencyType,
        string calldata resourceType,
        string calldata aiReasoning
    ) external payable onlyCoordinator returns (uint256 missionId) {
        _missionCounter++;
        missionId = _missionCounter;

        missions[missionId] = Mission({
            id: missionId,
            location: location,
            lat: lat,
            lng: lng,
            volunteer: address(0),
            status: MissionStatus.Created,
            emergencyType: emergencyType,
            resourceType: resourceType,
            aiReasoning: aiReasoning,
            createdAt: block.timestamp,
            assignedAt: 0,
            completedAt: 0,
            porTokenId: 0,
            rewardWei: msg.value,
            rewardClaimed: false
        });

        emit MissionCreated(missionId, emergencyType, location, resourceType, msg.value);
    }

    /**
     * @notice Volunteer assigns themselves to a mission.
     */
    function assignMission(uint256 missionId) external missionExists(missionId) {
        Mission storage m = missions[missionId];
        require(m.status == MissionStatus.Created, "Mission not available");
        require(m.volunteer == address(0), "Already assigned");

        m.volunteer = msg.sender;
        m.status = MissionStatus.Assigned;
        m.assignedAt = block.timestamp;
        _volunteerMissions[msg.sender].push(missionId);

        emit MissionAssigned(missionId, msg.sender);
    }

    /**
     * @notice Volunteer marks mission as in-progress (en route).
     */
    function startMission(uint256 missionId) external missionExists(missionId) {
        Mission storage m = missions[missionId];
        require(m.volunteer == msg.sender, "Not assigned volunteer");
        require(m.status == MissionStatus.Assigned, "Not in Assigned state");

        m.status = MissionStatus.InProgress;
        emit MissionInProgress(missionId, msg.sender);
    }

    /**
     * @notice Volunteer completes mission. Mints Proof-of-Relief NFT.
     * @param aidType  Description of aid delivered (stored in NFT metadata)
     */
    function completeMission(
        uint256 missionId,
        string calldata aidType
    ) external nonReentrant missionExists(missionId) {
        Mission storage m = missions[missionId];
        require(m.volunteer == msg.sender, "Not assigned volunteer");
        require(
            m.status == MissionStatus.Assigned || m.status == MissionStatus.InProgress,
            "Invalid state"
        );

        m.status = MissionStatus.Completed;
        m.completedAt = block.timestamp;

        // Mint Proof-of-Relief NFT if contract is set
        if (address(porContract) != address(0)) {
            uint256 tokenId = porContract.mintRelief(
                msg.sender,
                missionId,
                m.location,
                aidType,
                block.timestamp
            );
            m.porTokenId = tokenId;
        }

        // Pay out reward if any
        if (m.rewardWei > 0 && !m.rewardClaimed) {
            m.rewardClaimed = true;
            (bool sent, ) = payable(msg.sender).call{value: m.rewardWei}("");
            require(sent, "Reward transfer failed");
        }

        emit MissionCompleted(missionId, msg.sender, m.porTokenId);
    }

    /**
     * @notice Coordinator or volunteer cancels mission.
     */
    function cancelMission(uint256 missionId) external missionExists(missionId) {
        Mission storage m = missions[missionId];
        require(
            m.status == MissionStatus.Created ||
            m.status == MissionStatus.Assigned ||
            m.status == MissionStatus.InProgress,
            "Cannot cancel"
        );
        require(
            msg.sender == m.volunteer ||
            coordinators[msg.sender] ||
            msg.sender == owner(),
            "Unauthorized"
        );

        m.status = MissionStatus.Cancelled;

        // Refund reward to owner if unclaimed
        if (m.rewardWei > 0 && !m.rewardClaimed) {
            m.rewardClaimed = true;
            (bool sent, ) = payable(owner()).call{value: m.rewardWei}("");
            require(sent, "Refund failed");
        }

        emit MissionCancelled(missionId, msg.sender);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────────────────

    function getMission(uint256 id) external view missionExists(id) returns (Mission memory) {
        return missions[id];
    }

    function totalMissions() external view returns (uint256) {
        return _missionCounter;
    }

    function getVolunteerMissions(address volunteer) external view returns (uint256[] memory) {
        return _volunteerMissions[volunteer];
    }

    /// @notice Returns all missions with status == Created (available to pick up)
    function getOpenMissions() external view returns (Mission[] memory) {
        uint256 count;
        for (uint256 i = 1; i <= _missionCounter; i++) {
            if (missions[i].status == MissionStatus.Created) count++;
        }
        Mission[] memory open = new Mission[](count);
        uint256 idx;
        for (uint256 i = 1; i <= _missionCounter; i++) {
            if (missions[i].status == MissionStatus.Created) {
                open[idx++] = missions[i];
            }
        }
        return open;
    }

    /// @notice Paginated mission list
    function getMissions(uint256 offset, uint256 limit)
        external
        view
        returns (Mission[] memory result, uint256 total)
    {
        total = _missionCounter;
        if (offset >= total) return (new Mission[](0), total);
        uint256 end = offset + limit > total ? total : offset + limit;
        result = new Mission[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = missions[i + 1];
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Receive ETH (for funding mission rewards separately)
    // ─────────────────────────────────────────────────────────────────────────

    receive() external payable {}
}
