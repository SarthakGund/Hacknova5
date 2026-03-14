// ─── Replace these with your deployed contract addresses ────────────────────
// After running: cd blockchain && npx hardhat node && npx hardhat run scripts/deploy.ts --network localhost
// Addresses are saved to blockchain/deployments/localhost.json

export const CONTRACTS = {
  MissionRegistry: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  ProofOfRelief:   '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  PaymentChannel:  '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
} as const;

export const CHAIN_ID = 31337; // Hardhat local – change to 11155111 for Sepolia

export const RPC_URL = 'http://192.168.1.100:8545'; // Update to your machine's LAN IP for device testing

export const API_URL = 'http://192.168.1.100:5000'; // Backend Flask API

export const CLUSTER_RADIUS_KM = 1.5;

export const EMERGENCY_TYPES = [
  { id: 'medical',   label: 'Medical',   icon: '🏥', color: '#ef4444' },
  { id: 'fire',      label: 'Fire',      icon: '🔥', color: '#f97316' },
  { id: 'flood',     label: 'Flood',     icon: '🌊', color: '#3b82f6' },
  { id: 'food',      label: 'Food',      icon: '🍱', color: '#22c55e' },
  { id: 'shelter',   label: 'Shelter',   icon: '🏚️', color: '#a855f7' },
  { id: 'search',    label: 'Search',    icon: '🔍', color: '#eab308' },
  { id: 'evacuate',  label: 'Evacuate',  icon: '🚨', color: '#f43f5e' },
  { id: 'other',     label: 'Other',     icon: '⚠️', color: '#6b7280' },
] as const;

export const MISSION_STATUS_COLORS: Record<string, string> = {
  pending:     '#eab308',
  assigned:    '#3b82f6',
  in_progress: '#f97316',
  completed:   '#22c55e',
  cancelled:   '#6b7280',
};
