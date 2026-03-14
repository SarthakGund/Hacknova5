// Minimal ABIs – only the functions called from the mobile app

export const MISSION_REGISTRY_ABI = [
  // Read
  'function totalMissions() view returns (uint256)',
  'function getMission(uint256 id) view returns (tuple(uint256 id, string location, int256 lat, int256 lng, address volunteer, uint8 status, uint8 emergencyType, string resourceType, string aiReasoning, uint256 createdAt, uint256 assignedAt, uint256 completedAt, uint256 porTokenId, uint256 rewardWei, bool rewardClaimed))',
  'function getOpenMissions() view returns (tuple(uint256 id, string location, int256 lat, int256 lng, address volunteer, uint8 status, uint8 emergencyType, string resourceType, string aiReasoning, uint256 createdAt, uint256 assignedAt, uint256 completedAt, uint256 porTokenId, uint256 rewardWei, bool rewardClaimed)[])',
  'function getVolunteerMissions(address volunteer) view returns (uint256[])',
  'function getMissions(uint256 offset, uint256 limit) view returns (tuple(uint256 id, string location, int256 lat, int256 lng, address volunteer, uint8 status, uint8 emergencyType, string resourceType, string aiReasoning, uint256 createdAt, uint256 assignedAt, uint256 completedAt, uint256 porTokenId, uint256 rewardWei, bool rewardClaimed)[], uint256)',
  // Write
  'function assignMission(uint256 missionId)',
  'function startMission(uint256 missionId)',
  'function completeMission(uint256 missionId, string calldata aidType)',
  'function cancelMission(uint256 missionId)',
  // Events
  'event MissionCreated(uint256 indexed missionId, uint8 emergencyType, string location, string resourceType, uint256 rewardWei)',
  'event MissionAssigned(uint256 indexed missionId, address indexed volunteer)',
  'event MissionCompleted(uint256 indexed missionId, address indexed volunteer, uint256 porTokenId)',
] as const;

export const PROOF_OF_RELIEF_ABI = [
  'function totalSupply() view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function balanceOf(address owner) view returns (uint256)',
  'function reliefData(uint256 tokenId) view returns (uint256 missionId, address volunteer, string location, string aidType, uint256 timestamp, uint256 tokenId)',
  'event ReliefMinted(uint256 indexed tokenId, uint256 indexed missionId, address indexed volunteer, string location, string aidType)',
] as const;

export const PAYMENT_CHANNEL_ABI = [
  // Read
  'function getChannel(uint256 channelId) view returns (tuple(address payer, address recipient, uint256 balance, uint256 timeout, uint256 closingAt, uint256 nonce, uint8 state))',
  'function getPayerChannels(address payer) view returns (uint256[])',
  'function getRecipientChannels(address recipient) view returns (uint256[])',
  'function verifyVoucher(uint256 channelId, uint256 amount, uint256 nonce, bytes calldata signature) view returns (address signer, bool valid)',
  'function voucherHash(uint256 channelId, uint256 amount, uint256 nonce) view returns (bytes32)',
  'function totalChannels() view returns (uint256)',
  // Write
  'function openChannel(address recipient, uint256 timeout) payable returns (uint256 channelId)',
  'function topUp(uint256 channelId) payable',
  'function closeChannel(uint256 channelId, uint256 amount, uint256 nonce, bytes calldata signature)',
  'function initiateClose(uint256 channelId)',
  'function finalizeClose(uint256 channelId)',
  'function reclaimExpired(uint256 channelId)',
  // Events
  'event ChannelOpened(uint256 indexed channelId, address indexed payer, address indexed recipient, uint256 amount, uint256 timeout)',
  'event ChannelClosed(uint256 indexed channelId, address indexed recipient, uint256 paidOut, uint256 refunded)',
] as const;
