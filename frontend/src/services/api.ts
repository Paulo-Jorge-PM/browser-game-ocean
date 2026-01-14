const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ============================================
// Type Definitions
// ============================================

export interface ServerCityState {
  city_id: string;
  name: string;
  grid: ServerGridCell[][];
  resources: Record<string, number>;
  resource_capacity?: Record<string, number>;
  unlocked_techs?: string[];
  current_research?: string | null;
}

export interface ServerGridCell {
  position: { x: number; y: number };
  base: ServerBase | null;
  is_unlocked: boolean;
  depth: number;
}

export interface ServerBase {
  id: string;
  type: string;
  position: { x: number; y: number };
  level: number;
  construction_progress: number;
  is_operational: boolean;
  workers: number;
  action_id?: string | null;
  construction_started_at?: string | null;
  construction_ends_at?: string | null;
}

export interface SyncConfig {
  resource_sync_interval_seconds: number;
  error_tolerance_seconds: number;
  action_complete_retry_seconds: number;
}

export interface ProductionRates {
  production: Record<string, number>;
  consumption: Record<string, number>;
  net: Record<string, number>;
}

export interface BootstrapV2Response {
  city: ServerCityState;
  pending_actions: PendingAction[];
  sync_config: SyncConfig;
  production_rates: ProductionRates;
}

export interface PendingAction {
  action_id: string;
  action_type: string;
  started_at: string;
  ends_at: string;
  duration_seconds: number;
  data: {
    base_type?: string;
    position?: { x: number; y: number };
    base_id?: string;
    tech_id?: string;
  };
  status: string;
}

export interface ActionStartResponse {
  action_id: string;
  action_type: string;
  started_at: string;
  ends_at: string;
  duration_seconds: number;
  resources: Record<string, number>;
}

export interface ActionCompleteResponse {
  status: 'completed' | 'pending' | 'failed';
  remaining_seconds?: number;
  error?: string;
  action_id?: string;
  completed_at?: string;
}

export interface ResourceSyncResponse {
  resources: Record<string, number>;
  capacity: Record<string, number>;
  production_rates: ProductionRates;
  last_synced_at: string;
  drift_detected: boolean;
  drift_details?: Record<string, { client: number; expected: number; difference: number; tolerance: number }>;
}

// ============================================
// HTTP Helper
// ============================================

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    const error = new Error(text || response.statusText);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return response.json() as Promise<T>;
}

// ============================================
// Bootstrap Endpoints
// ============================================

export async function bootstrapDevCity(): Promise<ServerCityState> {
  const data = await requestJson<{ city: ServerCityState }>(`${API_URL}/api/v1/dev/bootstrap`);
  return data.city;
}

export async function bootstrapDevCityV2(): Promise<BootstrapV2Response> {
  return requestJson<BootstrapV2Response>(`${API_URL}/api/v1/dev/bootstrap/v2`);
}

// ============================================
// Event-Driven Action Endpoints (New)
// ============================================

export async function startAction(
  cityId: string,
  actionType: string,
  data: Record<string, unknown>
): Promise<ActionStartResponse> {
  return requestJson<ActionStartResponse>(`${API_URL}/api/v1/actions/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ city_id: cityId, action_type: actionType, data }),
  });
}

export async function completeAction(actionId: string): Promise<ActionCompleteResponse> {
  return requestJson<ActionCompleteResponse>(`${API_URL}/api/v1/actions/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action_id: actionId }),
  });
}

export async function getPendingActions(cityId: string): Promise<{ actions: PendingAction[] }> {
  return requestJson<{ actions: PendingAction[] }>(`${API_URL}/api/v1/actions/pending/${cityId}`);
}

export async function cancelAction(actionId: string): Promise<{ status: string; action_id: string }> {
  return requestJson<{ status: string; action_id: string }>(`${API_URL}/api/v1/actions/cancel/${actionId}`, {
    method: 'POST',
  });
}

// ============================================
// Resource Sync Endpoints (New)
// ============================================

export async function syncResources(
  cityId: string,
  clientResources: Record<string, number>,
  options?: { signal?: AbortSignal; requestId?: string }
): Promise<ResourceSyncResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options?.requestId) {
    headers['X-Request-Id'] = options.requestId;
  }
  return requestJson<ResourceSyncResponse>(`${API_URL}/api/v1/resources/sync`, {
    method: 'POST',
    headers,
    signal: options?.signal,
    body: JSON.stringify({ city_id: cityId, client_resources: clientResources }),
  });
}

export async function getResources(cityId: string): Promise<{
  resources: Record<string, number>;
  capacity: Record<string, number>;
  production_rates: ProductionRates;
  calculated_at: string;
}> {
  return requestJson(`${API_URL}/api/v1/resources/${cityId}`);
}

// ============================================
// Legacy Build Endpoints (for backwards compatibility)
// ============================================

export async function startBuildAction(cityId: string, baseType: string, position: { x: number; y: number }) {
  return requestJson<ServerCityState>(`${API_URL}/api/v1/actions/build/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ city_id: cityId, base_type: baseType, position }),
  });
}

export async function completeBuildAction(cityId: string, baseId: string, position: { x: number; y: number }) {
  return requestJson<ServerCityState>(`${API_URL}/api/v1/actions/build/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ city_id: cityId, base_id: baseId, position }),
  });
}

// ============================================
// Admin Endpoints
// ============================================

export async function resetDevCity() {
  return requestJson<{ status: string }>(`${API_URL}/api/v1/admin/reset`, {
    method: 'POST',
  });
}
