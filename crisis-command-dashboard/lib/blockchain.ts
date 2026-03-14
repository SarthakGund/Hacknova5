import { ethers, BrowserProvider, Contract, JsonRpcProvider } from "ethers"

// ── Contract Addresses ──────────────────────────────────────────────────────
export const CONTRACTS = {
  ProofOfRelief:   process.env.NEXT_PUBLIC_PROOF_OF_RELIEF   ?? "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  MissionRegistry: process.env.NEXT_PUBLIC_MISSION_REGISTRY  ?? "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  PaymentChannel:  process.env.NEXT_PUBLIC_PAYMENT_CHANNEL   ?? "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
}

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 31337)
export const RPC_URL  = process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545"

// ── Mission struct tuple ─────────────────────────────────────────────────────
const MISSION_TUPLE =
  "tuple(uint256 id, string location, int256 lat, int256 lng, address volunteer, uint8 status, uint8 emergencyType, string resourceType, string aiReasoning, uint256 createdAt, uint256 assignedAt, uint256 completedAt, uint256 porTokenId, uint256 rewardWei, bool rewardClaimed)"

// ── ABIs ─────────────────────────────────────────────────────────────────────
export const MISSION_REGISTRY_ABI = [
  `function assignMission(uint256 missionId) external`,
  `function startMission(uint256 missionId) external`,
  `function completeMission(uint256 missionId, string calldata aidType) external`,
  `function cancelMission(uint256 missionId) external`,
  `function createMission(string calldata location, int256 lat, int256 lng, uint8 emergencyType, string calldata resourceType, string calldata aiReasoning) external payable returns (uint256)`,
  `function getMission(uint256 id) external view returns (${MISSION_TUPLE})`,
  `function getOpenMissions() external view returns (${MISSION_TUPLE}[])`,
  `function getMissions(uint256 offset, uint256 limit) external view returns (${MISSION_TUPLE}[] result, uint256 total)`,
  `function getVolunteerMissions(address volunteer) external view returns (uint256[])`,
  `function totalMissions() external view returns (uint256)`,
  `event MissionCreated(uint256 indexed missionId, uint8 emergencyType, string location, string resourceType, uint256 rewardWei)`,
  `event MissionAssigned(uint256 indexed missionId, address indexed volunteer)`,
  `event MissionInProgress(uint256 indexed missionId, address indexed volunteer)`,
  `event MissionCompleted(uint256 indexed missionId, address indexed volunteer, uint256 porTokenId)`,
  `event MissionCancelled(uint256 indexed missionId, address indexed by)`,
]

export const PROOF_OF_RELIEF_ABI = [
  `function balanceOf(address owner) view returns (uint256)`,
  `function tokenURI(uint256 tokenId) view returns (string)`,
  `function reliefData(uint256 tokenId) view returns (uint256 missionId, address volunteer, string location, string aidType, uint256 timestamp, uint256 tokenId_)`,
  `function totalSupply() view returns (uint256)`,
  `event ReliefMinted(uint256 indexed tokenId, uint256 indexed missionId, address indexed volunteer, string location, string aidType)`,
]

// ── Helpers ──────────────────────────────────────────────────────────────────
export function getReadProvider(): JsonRpcProvider {
  return new JsonRpcProvider(RPC_URL)
}

export function getMissionRegistry(signerOrProvider: any): Contract {
  return new Contract(CONTRACTS.MissionRegistry, MISSION_REGISTRY_ABI, signerOrProvider)
}

export function getProofOfRelief(signerOrProvider: any): Contract {
  return new Contract(CONTRACTS.ProofOfRelief, PROOF_OF_RELIEF_ABI, signerOrProvider)
}

export const EMERGENCY_TYPES = ["Medical", "Food", "Water", "Shelter", "Search", "Evacuate", "Other"] as const
export const MISSION_STATUSES = ["Created", "Assigned", "InProgress", "Completed", "Cancelled"] as const

export const STATUS_COLORS: Record<number, string> = {
  0: "text-blue-400",    // Created
  1: "text-yellow-400",  // Assigned
  2: "text-orange-400",  // InProgress
  3: "text-green-400",   // Completed
  4: "text-muted-foreground", // Cancelled
}
// alias used by chain-ledger
export const STATUS_COLOR = STATUS_COLORS

export const STATUS_BG: Record<number, string> = {
  0: "bg-blue-500/10 border-blue-500/30",
  1: "bg-yellow-500/10 border-yellow-500/30",
  2: "bg-orange-500/10 border-orange-500/30",
  3: "bg-green-500/10 border-green-500/30",
  4: "bg-muted/30 border-border",
}

export function formatAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}
export const shortAddr = formatAddress

export function formatTime(epochSeconds: bigint | number): string {
  const ts = typeof epochSeconds === "bigint" ? Number(epochSeconds) : epochSeconds
  if (!ts) return "—"
  return new Date(ts * 1000).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}
export const fmtTime = formatTime
