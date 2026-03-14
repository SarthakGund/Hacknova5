/**
 * Payment Channel library – offline-first state-channel payments.
 *
 * How it works:
 *   1. Payer opens a channel on-chain (openChannel).
 *   2. Payer creates signed vouchers OFF-CHAIN (createVoucher).
 *      These are just signatures – no transaction, no internet needed.
 *   3. Recipient receives voucher via BLE / QR / NFC.
 *   4. Recipient verifies signature locally (verifyVoucherOffline).
 *   5. When online, recipient calls closeChannel to claim payment.
 */

import { ethers } from 'ethers';
import { getPaymentChannelContract } from './contracts';
import { CONTRACTS } from '@/constants/config';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaymentVoucher {
  channelId: string;    // bigint serialised as string for easy JSON transfer
  amount: string;       // wei as string
  nonce: string;
  signature: string;    // payer's EIP-191 signature
  payerAddress: string;
  timestamp: number;    // unix ms – informational, not verified on-chain
  chainId: number;
  contractAddress: string;
}

export interface Channel {
  payer: string;
  recipient: string;
  balance: bigint;
  timeout: bigint;
  closingAt: bigint;
  nonce: bigint;
  state: number; // 0=Open 1=Closing 2=Closed
}

// ─── Create / sign a voucher (payer side, offline) ────────────────────────────

/**
 * Sign a payment voucher. This does NOT send a transaction.
 * The signer must match the payer of the channel.
 */
export async function createVoucher(
  signer: ethers.Signer,
  channelId: bigint,
  amount: bigint,
  nonce: bigint,
  chainId: number
): Promise<PaymentVoucher> {
  // Replicate the on-chain hash: keccak256(abi.encodePacked(channelId, amount, nonce, contractAddress, chainId))
  const hash = ethers.solidityPackedKeccak256(
    ['uint256', 'uint256', 'uint256', 'address', 'uint256'],
    [channelId, amount, nonce, CONTRACTS.PaymentChannel, chainId]
  );

  // EIP-191 personal_sign (adds "\x19Ethereum Signed Message:\n32" prefix)
  const signature   = await signer.signMessage(ethers.getBytes(hash));
  const payerAddress = await signer.getAddress();

  return {
    channelId:       channelId.toString(),
    amount:          amount.toString(),
    nonce:           nonce.toString(),
    signature,
    payerAddress,
    timestamp:       Date.now(),
    chainId,
    contractAddress: CONTRACTS.PaymentChannel,
  };
}

// ─── Verify a voucher (recipient side, fully offline) ─────────────────────────

/**
 * Verify a voucher signature WITHOUT any network call.
 * Returns `true` if the signature is from the expected payer.
 */
export function verifyVoucherOffline(
  voucher: PaymentVoucher,
  expectedPayer: string
): boolean {
  try {
    const hash = ethers.solidityPackedKeccak256(
      ['uint256', 'uint256', 'uint256', 'address', 'uint256'],
      [
        BigInt(voucher.channelId),
        BigInt(voucher.amount),
        BigInt(voucher.nonce),
        voucher.contractAddress,
        voucher.chainId,
      ]
    );
    const recovered = ethers.verifyMessage(ethers.getBytes(hash), voucher.signature);
    return recovered.toLowerCase() === expectedPayer.toLowerCase();
  } catch {
    return false;
  }
}

// ─── Encode / decode voucher for BLE / QR transfer ───────────────────────────

/** Encode voucher to a compact JSON string (for QR code or BLE advertisement) */
export function encodeVoucher(v: PaymentVoucher): string {
  return JSON.stringify({
    c: v.channelId,
    a: v.amount,
    n: v.nonce,
    s: v.signature,
    p: v.payerAddress,
    t: v.timestamp,
    ch: v.chainId,
    ct: v.contractAddress,
  });
}

/** Decode a compact voucher string back to PaymentVoucher */
export function decodeVoucher(raw: string): PaymentVoucher {
  const d = JSON.parse(raw);
  return {
    channelId:       d.c,
    amount:          d.a,
    nonce:           d.n,
    signature:       d.s,
    payerAddress:    d.p,
    timestamp:       d.t,
    chainId:         d.ch,
    contractAddress: d.ct,
  };
}

// ─── On-chain operations (require network) ────────────────────────────────────

export async function openChannel(
  signer: ethers.Signer,
  recipientAddress: string,
  amountEth: string,
  timeoutSeconds = 3600
): Promise<bigint> {
  const contract = getPaymentChannelContract(signer);
  const tx = await (contract as any).openChannel(
    recipientAddress,
    BigInt(timeoutSeconds),
    { value: ethers.parseEther(amountEth) }
  );
  const receipt = await tx.wait();
  // Parse ChannelOpened event to get channelId
  const iface = new ethers.Interface([
    'event ChannelOpened(uint256 indexed channelId, address indexed payer, address indexed recipient, uint256 amount, uint256 timeout)',
  ]);
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === 'ChannelOpened') return parsed.args[0] as bigint;
    } catch {}
  }
  throw new Error('ChannelOpened event not found');
}

export async function closeChannelOnChain(
  signer: ethers.Signer,
  voucher: PaymentVoucher
): Promise<ethers.TransactionReceipt> {
  const contract = getPaymentChannelContract(signer);
  const tx = await (contract as any).closeChannel(
    BigInt(voucher.channelId),
    BigInt(voucher.amount),
    BigInt(voucher.nonce),
    voucher.signature
  );
  return tx.wait();
}

export async function getChannel(
  channelId: bigint,
  provider: ethers.Provider
): Promise<Channel> {
  const contract = getPaymentChannelContract(provider);
  const raw = await (contract as any).getChannel(channelId);
  return {
    payer:     raw[0] as string,
    recipient: raw[1] as string,
    balance:   raw[2] as bigint,
    timeout:   raw[3] as bigint,
    closingAt: raw[4] as bigint,
    nonce:     raw[5] as bigint,
    state:     Number(raw[6]),
  };
}

/** Format wei balance as readable ETH string */
export function formatBalance(wei: bigint): string {
  return ethers.formatEther(wei);
}
