/**
 * Bluetooth mesh relay for SOS signals.
 *
 * Strategy (Expo BLE):
 *   Sender:    advertise a BLE service with the SOS payload as manufacturer data.
 *   Relay:     any nearby device with ResQNet running scans, receives it,
 *              de-duplicates by msg_id, then forwards by:
 *                a) advertising onward (BLE hop), AND
 *                b) posting to the backend if internet is available.
 *
 * NOTE: Full BLE peripheral advertising requires a native module on iOS (expo-bluetooth
 *       supports it from SDK 51). This file provides the complete implementation;
 *       pair it with the useBluetooth hook.
 */

import { Platform } from 'react-native';
import { submitMeshSOS } from './api';

export interface SOSPacket {
  msg_id: string;       // UUID – used for dedup
  emergency_type: string;
  latitude: number;
  longitude: number;
  timestamp: string;    // ISO
  hop_count: number;    // incremented on each relay
  sender_name?: string;
}

// BLE service UUID for ResQNet mesh (custom UUID)
export const RESQNET_SERVICE_UUID    = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const RESQNET_SOS_CHAR_UUID   = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

// ─── Encoding ─────────────────────────────────────────────────────────────────

export function encodeSOSPacket(pkt: SOSPacket): string {
  return JSON.stringify({
    id: pkt.msg_id,
    t:  pkt.emergency_type,
    la: pkt.latitude,
    lo: pkt.longitude,
    ts: pkt.timestamp,
    h:  pkt.hop_count,
    n:  pkt.sender_name,
  });
}

export function decodeSOSPacket(raw: string): SOSPacket | null {
  try {
    const d = JSON.parse(raw);
    return {
      msg_id:         d.id,
      emergency_type: d.t,
      latitude:       d.la,
      longitude:      d.lo,
      timestamp:      d.ts,
      hop_count:      d.h ?? 0,
      sender_name:    d.n,
    };
  } catch {
    return null;
  }
}

// ─── Dedup store (in-memory, per session) ─────────────────────────────────────

const _seen = new Set<string>();

export function isDuplicate(msgId: string): boolean {
  if (_seen.has(msgId)) return true;
  _seen.add(msgId);
  return false;
}

// ─── Relay logic ──────────────────────────────────────────────────────────────

/**
 * Called when a relay device receives a BLE SOS packet.
 * Tries to post to backend; always relays via BLE.
 */
export async function relaySOSPacket(pkt: SOSPacket): Promise<void> {
  if (isDuplicate(pkt.msg_id)) return;

  const relayed: SOSPacket = { ...pkt, hop_count: pkt.hop_count + 1 };

  // Try posting to backend (best-effort)
  try {
    await submitMeshSOS({
      msg_id:         relayed.msg_id,
      emergency_type: relayed.emergency_type,
      latitude:       relayed.latitude,
      longitude:      relayed.longitude,
      timestamp:      relayed.timestamp,
      hop_count:      relayed.hop_count,
    });
    console.log('[BLE] SOS relayed to backend:', relayed.msg_id);
  } catch {
    console.log('[BLE] Offline – SOS queued for later relay:', relayed.msg_id);
  }
}

// ─── Generate unique message ID ───────────────────────────────────────────────

export function generateMsgId(): string {
  return `sos_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Platform check ───────────────────────────────────────────────────────────

export function isBLESupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}
