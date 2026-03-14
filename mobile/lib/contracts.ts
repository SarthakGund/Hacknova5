import { ethers } from 'ethers';
import { CONTRACTS, RPC_URL } from '@/constants/config';
import { MISSION_REGISTRY_ABI, PROOF_OF_RELIEF_ABI, PAYMENT_CHANNEL_ABI } from '@/constants/abis';

// ─── Provider ────────────────────────────────────────────────────────────────

export function getProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(RPC_URL);
}

export function getSigner(privateKey: string): ethers.Wallet {
  return new ethers.Wallet(privateKey, getProvider());
}

// ─── Contract factories ───────────────────────────────────────────────────────

export function getMissionRegistry(signerOrProvider?: ethers.Signer | ethers.Provider) {
  return new ethers.Contract(
    CONTRACTS.MissionRegistry,
    MISSION_REGISTRY_ABI,
    signerOrProvider ?? getProvider()
  );
}

export function getProofOfRelief(signerOrProvider?: ethers.Signer | ethers.Provider) {
  return new ethers.Contract(
    CONTRACTS.ProofOfRelief,
    PROOF_OF_RELIEF_ABI,
    signerOrProvider ?? getProvider()
  );
}

export function getPaymentChannelContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
  return new ethers.Contract(
    CONTRACTS.PaymentChannel,
    PAYMENT_CHANNEL_ABI,
    signerOrProvider ?? getProvider()
  );
}

// ─── Mission helpers ──────────────────────────────────────────────────────────

export interface OnChainMission {
  id: bigint;
  location: string;
  lat: bigint;
  lng: bigint;
  volunteer: string;
  status: number;
  emergencyType: number;
  resourceType: string;
  aiReasoning: string;
  createdAt: bigint;
  assignedAt: bigint;
  completedAt: bigint;
  porTokenId: bigint;
  rewardWei: bigint;
  rewardClaimed: boolean;
}

export async function fetchOpenMissions(provider?: ethers.Provider): Promise<OnChainMission[]> {
  const contract = getMissionRegistry(provider);
  const raw: OnChainMission[] = await contract.getOpenMissions();
  return raw;
}

export async function fetchVolunteerMissions(
  address: string,
  provider?: ethers.Provider
): Promise<bigint[]> {
  const contract = getMissionRegistry(provider);
  return contract.getVolunteerMissions(address);
}

export async function assignMissionOnChain(missionId: bigint, signer: ethers.Signer) {
  const contract = getMissionRegistry(signer);
  const tx = await contract.assignMission(missionId);
  return tx.wait();
}

export async function completeMissionOnChain(
  missionId: bigint,
  aidType: string,
  signer: ethers.Signer
) {
  const contract = getMissionRegistry(signer);
  const tx = await contract.completeMission(missionId, aidType);
  return tx.wait();
}

// ─── PoR NFT helpers ──────────────────────────────────────────────────────────

export interface ReliefBadge {
  tokenId: bigint;
  missionId: bigint;
  volunteer: string;
  location: string;
  aidType: string;
  timestamp: bigint;
  tokenURI: string;
}

export async function fetchVolunteerBadges(
  address: string,
  provider?: ethers.Provider
): Promise<ReliefBadge[]> {
  const por = getProofOfRelief(provider);
  const balance: bigint = await por.balanceOf(address);
  if (balance === 0n) return [];

  // Fetch from events (Transfer from address(0) to address)
  const filter = por.filters.ReliefMinted(undefined, undefined, address);
  const events = await por.queryFilter(filter);

  const badges: ReliefBadge[] = [];
  for (const e of events) {
    const tokenId = (e as ethers.EventLog).args[0] as bigint;
    try {
      const data = await por.reliefData(tokenId);
      const uri  = await por.tokenURI(tokenId);
      badges.push({
        tokenId,
        missionId: data[0] as bigint,
        volunteer: data[1] as string,
        location:  data[2] as string,
        aidType:   data[3] as string,
        timestamp: data[4] as bigint,
        tokenURI:  uri as string,
      });
    } catch {}
  }
  return badges;
}
