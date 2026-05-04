import { LanPairingForm } from "./LanPairingForm";
import { useThinClientSecurity } from "../hooks/useThinClientSecurity";

export function SecurityStatusPanel() {
  const security = useThinClientSecurity();
  const status = security.status;
  const listenerLabel = status?.httpsEnabled ? "HTTPS enabled" : "HTTP only";
  return <section className="ui-panel ui-stack"><h2>Security</h2>
    <p>Server mode: {status?.mode ?? "loading"}</p>
    <div className="ui-stack">
      <h3>Transport security</h3>
      <p>Current listener: {listenerLabel}</p>
      <p>HTTPS required: {status?.httpsRequired ? "Yes" : "No"}</p>
      {status?.requiresRestartToChangeTransportSecurity ? <p>Changing HTTP/HTTPS requires restarting dev:server.</p> : null}
      {status?.mode === "disabled-dev" && !status.httpsEnabled ? <p>To test HTTPS in dev mode, restart dev:server with AI_SYSTEM_BUILDER_HTTPS_ENABLED=true plus AI_SYSTEM_BUILDER_TLS_CERT_PATH and AI_SYSTEM_BUILDER_TLS_KEY_PATH.</p> : null}
      {status?.mode === "disabled-dev" && status.httpsEnabled ? <p>HTTPS is enabled for this dev server. Authentication is still controlled by Dev security enforcement below.</p> : null}
      {status?.mode === "lan-https-token" ? <p>LAN HTTPS token mode is active. HTTPS and bearer-token auth are required.</p> : null}
    </div>
    {security.uiState === "disabled-dev" ? <p>Security is disabled/insecure. HTTP/no-auth dev mode is for local development only.</p> : null}
    {(security.uiState === "unpaired" || security.uiState === "pairing" || security.uiState === "pairing-failed") ? <LanPairingForm onSubmit={security.completePairing} busy={security.uiState === "pairing"} /> : null}
    {security.uiState === "paired" ? <div><p>Paired and authenticated.</p><p>{security.status?.currentPrincipal?.displayName ?? security.status?.currentPrincipal?.deviceName ?? ""}</p><button className="ui-button" onClick={security.clearLocalPairing}>Forget this device</button></div> : null}

    {status?.devSecurityToggleEnabled === true ? <label className="ui-stack">
      <span>Startup transport mode (HTTP/HTTPS) is selected at server startup. Dev security enforcement below only changes auth behavior for development testing.</span>
      <span>Dev security enforcement</span>
      <select value={status.devSecurityEnforcementMode ?? "disabled-dev"} onChange={(event) => { void security.setDevSecurityEnforcementMode(event.target.value as "disabled-dev" | "lan-token-enforced"); }}>
        <option value="disabled-dev">Disabled dev mode</option>
        <option value="lan-token-enforced">Require LAN bearer token</option>
      </select>
      <small>This changes authentication enforcement for development testing. Changing real HTTP/HTTPS listener mode still requires restarting dev:server.</small>
    </label> : null}
    {security.devSecurityModeUpdateSuccess ? <p>{security.devSecurityModeUpdateSuccess}</p> : null}
    {security.devSecurityModeUpdateError ? <p>{security.devSecurityModeUpdateError}</p> : null}
    {security.guidance ? <p>{security.guidance}</p> : null}
    {security.uiState === "error" ? <p>{security.error?.message ?? "Security error."}</p> : null}
  </section>;
}
