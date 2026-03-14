import { API_URL } from '@/constants/config';

type FetchOptions = RequestInit & { token?: string };

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { token, ...rest } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(rest.headers as Record<string, string> | undefined),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { ...rest, headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${path} → ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export const login = (username: string, password: string) =>
  apiFetch<{ token: string; user: Record<string, unknown> }>('/api/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

// ── Incidents (SOS) ───────────────────────────────────────────────────────────

export interface SOSPayload {
  title: string;
  type: string;
  severity: string;
  description: string;
  latitude: number;
  longitude: number;
  reporter_name?: string;
  reporter_contact?: string;
}

export const sendSOS = (payload: SOSPayload, token: string) =>
  apiFetch<{ success: boolean; incident_id: number }>('/api/incidents', {
    method: 'POST',
    body: JSON.stringify(payload),
    token,
  });

export const getIncidents = (token?: string) =>
  apiFetch<{ incidents: unknown[] }>('/api/incidents', { token });

// ── AI Missions ───────────────────────────────────────────────────────────────

export const getAIMissions = (status?: string) =>
  apiFetch<{ missions: unknown[]; count: number }>(
    `/api/ai/missions${status ? `?status=${status}` : ''}`
  );

export const triggerMissionGeneration = () =>
  apiFetch<{ missions_created: number; missions: unknown[] }>('/api/ai/generate-missions', {
    method: 'POST',
  });

export const getMissionReasoning = (id: number) =>
  apiFetch<Record<string, unknown>>(`/api/ai/reasoning/${id}`);

export const completeAIMission = (id: number, onChainId?: number) =>
  apiFetch<{ status: string }>(`/api/ai/mission/${id}/complete`, {
    method: 'POST',
    body: JSON.stringify({ on_chain_id: onChainId }),
  });

export const clusterSOS = () =>
  apiFetch<{ clusters: unknown[]; cluster_count: number }>('/api/ai/cluster-sos');

// ── Resources ─────────────────────────────────────────────────────────────────

export const getPublicResources = () =>
  apiFetch<{ resources: unknown[] }>('/api/resources?public=true');

// ── Alerts ────────────────────────────────────────────────────────────────────

export const getNearbyAlerts = (lat: number, lng: number, radius = 5) =>
  apiFetch<{ alerts: unknown[] }>(`/api/alerts/nearby?lat=${lat}&lng=${lng}&radius=${radius}`);

// ── SOS Mesh ──────────────────────────────────────────────────────────────────

export const submitMeshSOS = (payload: {
  msg_id: string;
  emergency_type: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  hop_count?: number;
}) =>
  apiFetch<{ success: boolean }>('/api/sosmesh', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
