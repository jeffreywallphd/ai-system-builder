import { secureFetch } from "./secureFetch";
import type { ThinClientSecurityError } from "./securityErrors";

interface ApiEnvelope { ok: boolean; value?: unknown; error?: { code?: string; message?: string; details?: unknown; endpoint?: string } }

export interface SecurityStatusResult { mode: "disabled-dev" | "lan-https-token"; currentPrincipal?: { displayName?: string; deviceName?: string; deviceId?: string } }
export interface CompletePairingRequest { pairingCode: string; deviceName?: string }
export interface CompletePairingResult { bearerToken: string; deviceId?: string; deviceName?: string; grantedScopes?: string[] }

const apiUrl = (base: string, suffix: string) => `${base.trim().replace(/\/+$/, "") || "/api"}${suffix}`;

const toError = (status: number, endpoint: string, envelope?: ApiEnvelope): ThinClientSecurityError => ({
  status,
  code: envelope?.error?.code,
  message: envelope?.error?.message ?? `Security request failed (HTTP ${status}).`,
  details: envelope?.error?.details,
  endpoint: envelope?.error?.endpoint ?? endpoint,
});

async function send(baseUrl: string, path: string, init: RequestInit, secure = false): Promise<unknown> {
  const endpoint = apiUrl(baseUrl, path);
  const response = await (secure ? secureFetch : fetch)(endpoint, init);
  const raw = await response.json() as ApiEnvelope;
  if (!raw || typeof raw !== "object" || typeof raw.ok !== "boolean") throw toError(response.status, endpoint, undefined);
  if (!raw.ok) throw toError(response.status, endpoint, raw);
  return raw.value;
}

export function createSecurityApiClient(options: { apiBaseUrl?: string } = {}) {
  const apiBaseUrl = options.apiBaseUrl ?? "/api";
  return {
    getSecurityStatus: async (): Promise<SecurityStatusResult> => {
      const value = await send(apiBaseUrl, "/security/status", { method: "GET" }, false);
      return value as SecurityStatusResult;
    },
    completePairing: async (request: CompletePairingRequest): Promise<CompletePairingResult> => {
      const value = await send(apiBaseUrl, "/security/pairing/complete", { method: "POST", headers: { "content-type": "application/json", "x-client-source": "thin-client.security" }, body: JSON.stringify({ pairingCode: request.pairingCode, deviceName: request.deviceName }) }, false);
      return value as CompletePairingResult;
    },
    revokeCurrentToken: async (deviceId: string): Promise<{ revoked: boolean; deviceId: string }> => {
      const value = await send(apiBaseUrl, "/security/token/revoke", { method: "POST", headers: { "content-type": "application/json", "x-client-source": "thin-client.security" }, body: JSON.stringify({ deviceId }) }, true);
      return value as { revoked: boolean; deviceId: string };
    },
  };
}
