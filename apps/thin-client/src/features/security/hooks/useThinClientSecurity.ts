import { useCallback, useEffect, useMemo, useState } from "react";
import { pairedDeviceTokenStore } from "../../../security/pairedDeviceTokenStore";
import { createSecurityApiClient } from "../../../security/securityApiClient";
import { FORBIDDEN_GUIDANCE, toSecurityGuidance, type ThinClientSecurityError } from "../../../security/securityErrors";

type SecurityUiState = "loading" | "disabled-dev" | "unpaired" | "paired" | "token-invalid" | "pairing" | "pairing-failed" | "unauthorized" | "error";

export function useThinClientSecurity() {
  const api = useMemo(() => createSecurityApiClient(), []);
  const [status, setStatus] = useState<any>();
  const [error, setError] = useState<ThinClientSecurityError>();
  const [pairingBusy, setPairingBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    try { setStatus(await api.getSecurityStatus()); setError(undefined); } catch (e) { setError(e as ThinClientSecurityError); }
  }, [api]);

  useEffect(() => { void loadStatus(); }, [loadStatus]);

  const completePairing = useCallback(async (pairingCode: string, deviceName?: string) => {
    setPairingBusy(true);
    try {
      const result = await api.completePairing({ pairingCode, deviceName });
      pairedDeviceTokenStore.setToken(result.bearerToken);
      await loadStatus();
      return true;
    } catch (e) { setError(e as ThinClientSecurityError); return false; }
    finally { setPairingBusy(false); }
  }, [api, loadStatus]);

  const clearLocalPairing = useCallback(() => { pairedDeviceTokenStore.clearToken(); setError(undefined); }, []);
  const guidance = toSecurityGuidance(error);
  const uiState: SecurityUiState = useMemo(() => {
    if (!status && !error) return "loading";
    if (pairingBusy) return "pairing";
    if (status?.mode === "disabled-dev") return "disabled-dev";
    const guidance = toSecurityGuidance(error);
    if (guidance === FORBIDDEN_GUIDANCE) return "unauthorized";
    if (guidance) return "unpaired";
    if (error && status?.mode === "lan-https-token") return "pairing-failed";
    if (status?.mode === "lan-https-token" && !pairedDeviceTokenStore.hasToken()) return "unpaired";
    if (status?.mode === "lan-https-token" && pairedDeviceTokenStore.hasToken() && status?.currentPrincipal) return "paired";
    if (status?.mode === "lan-https-token" && pairedDeviceTokenStore.hasToken() && guidance) { if (error?.status === 401) { pairedDeviceTokenStore.clearToken(); return "token-invalid"; } }
    return error ? "error" : "loading";
  }, [error, guidance, pairingBusy, status]);

  return { uiState, status, error, guidance, completePairing, clearLocalPairing, hasToken: pairedDeviceTokenStore.hasToken() };
}
