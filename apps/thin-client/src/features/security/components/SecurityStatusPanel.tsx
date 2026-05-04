import { LanPairingForm } from "./LanPairingForm";
import { useThinClientSecurity } from "../hooks/useThinClientSecurity";

export function SecurityStatusPanel() {
  const security = useThinClientSecurity();
  return <section className="ui-panel ui-stack"><h2>Security</h2>
    <p>Server mode: {security.status?.mode ?? "loading"}</p>
    {security.uiState === "disabled-dev" ? <p>Security is disabled/insecure. HTTP/no-auth dev mode is for local development only.</p> : null}
    {(security.uiState === "unpaired" || security.uiState === "pairing" || security.uiState === "pairing-failed") ? <LanPairingForm onSubmit={security.completePairing} busy={security.uiState === "pairing"} /> : null}
    {security.uiState === "paired" ? <div><p>Paired and authenticated.</p><p>{security.status?.currentPrincipal?.displayName ?? security.status?.currentPrincipal?.deviceName ?? ""}</p><button className="ui-button" onClick={security.clearLocalPairing}>Forget this device</button></div> : null}

    {security.status?.devSecurityToggleEnabled ? <label className="ui-stack">
      <span>Dev security enforcement</span>
      <select value={security.status.devSecurityEnforcementMode ?? "disabled-dev"} onChange={(event) => { void security.setDevSecurityEnforcementMode(event.target.value as "disabled-dev" | "lan-token-enforced"); }}>
        <option value="disabled-dev">Disabled dev mode</option>
        <option value="lan-token-enforced">Require LAN bearer token</option>
      </select>
      <small>This changes authentication enforcement for development testing. Changing real HTTP/HTTPS listener mode still requires restarting dev:server.</small>
    </label> : null}
    {security.guidance ? <p>{security.guidance}</p> : null}
    {security.uiState === "error" ? <p>{security.error?.message ?? "Security error."}</p> : null}
  </section>;
}
