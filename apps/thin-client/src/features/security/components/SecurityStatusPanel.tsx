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
      <p>Startup mode: {status?.mode ?? "loading"}</p>
      <p>TLS cert mode: {status?.tls?.mode ?? "n/a"}</p>
      <p>Certificate source: {status?.tls?.source ?? "n/a"}</p>
      {status?.tls?.hosts && status.tls.hosts.length > 0 ? <p>Hosts/SANs: {status.tls.hosts.join(", ")}</p> : null}
      {status?.tls?.expiresAt ? <p>Certificate expiration: {status.tls.expiresAt}</p> : null}
      {status?.requiresRestartToChangeTransportSecurity ? <p>Changing HTTP/HTTPS listener mode requires restarting dev:server.</p> : null}
      {status?.mode === "disabled-dev" && !status.httpsEnabled ? <p>Default dev is HTTP/no-auth. To test HTTPS in dev, restart dev:server with HTTPS enabled and a certificate mode.</p> : null}
      {status?.mode === "disabled-dev" && status.httpsEnabled ? <p>HTTPS is enabled for this dev server. Authentication is still controlled separately by dev security enforcement.</p> : null}
      {status?.mode === "lan-https-token" ? <p>LAN HTTPS token mode is active. HTTPS and bearer-token authentication are required.</p> : null}
      {status?.tls?.mode === "auto-self-signed" ? <p>Auto self-signed certificates can enable HTTPS transport, but your browser or mobile device may still show a trust warning unless you explicitly trust the certificate/CA.</p> : null}
      {status?.tls?.mode === "auto-local-ca" ? <div className="ui-stack"><p>Local CA available: {status?.tls?.localCa?.available ? "Yes" : "No"}</p>{status?.tls?.localCa?.downloadUrl ? <p><a href={status.tls.localCa.downloadUrl} target="_blank" rel="noreferrer">Download local CA certificate (PEM)</a></p> : null}<p>Manual trust required: install/trust this public CA certificate in your OS/browser/device trust store.</p><p>After trust installation, restart browser/app if needed. Never share private keys and do not commit generated TLS files.</p></div> : null}

      <div className="ui-stack">
        <h4>Development restart examples</h4>
        <pre><code>AI_SYSTEM_BUILDER_SECURITY_MODE=disabled-dev npm run dev:server</code></pre>
        <pre><code>{`AI_SYSTEM_BUILDER_SECURITY_MODE=disabled-dev \\
AI_SYSTEM_BUILDER_HTTPS_ENABLED=true \\
AI_SYSTEM_BUILDER_TLS_CERT_MODE=auto-local-ca \\
AI_SYSTEM_BUILDER_DEV_SECURITY_TOGGLE_ENABLED=true \\
npm run dev:server`}</code></pre>
        <pre><code>{`AI_SYSTEM_BUILDER_SECURITY_MODE=lan-https-token \\
AI_SYSTEM_BUILDER_TLS_CERT_MODE=auto-local-ca \\
SERVER_TOKEN_HASH_SECRET=<strong-random-secret> \\
npm run dev:server`}</code></pre>
        <pre><code>{`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`}</code></pre>
      </div>
    </div>
    {security.uiState === "disabled-dev" ? <p>Security is disabled/insecure. HTTP/no-auth dev mode is for local development only.</p> : null}
    {(security.uiState === "unpaired" || security.uiState === "pairing" || security.uiState === "pairing-failed") ? <LanPairingForm onSubmit={security.completePairing} busy={security.uiState === "pairing"} /> : null}
    {security.uiState === "paired" ? <div><p>Paired and authenticated.</p><p>{security.status?.currentPrincipal?.displayName ?? security.status?.currentPrincipal?.deviceName ?? ""}</p><button className="ui-button" onClick={security.clearLocalPairing}>Forget this device</button></div> : null}

    {status?.devSecurityToggleEnabled === true ? <label className="ui-stack">
      <span>Transport security (HTTP/HTTPS listener mode) is selected at server startup and requires restart to change.</span>
      <span>Dev security enforcement</span>
      <select value={status.devSecurityEnforcementMode ?? "disabled-dev"} onChange={(event) => { void security.setDevSecurityEnforcementMode(event.target.value as "disabled-dev" | "lan-token-enforced"); }}>
        <option value="disabled-dev">Disabled dev mode</option>
        <option value="lan-token-enforced">Require LAN bearer token</option>
      </select>
      <small>This control changes only development auth enforcement (no-auth vs bearer-token). It does not switch HTTP/HTTPS.</small>
    </label> : null}
    {security.devSecurityModeUpdateSuccess ? <p>{security.devSecurityModeUpdateSuccess}</p> : null}
    {security.devSecurityModeUpdateError ? <p>{security.devSecurityModeUpdateError}</p> : null}
    {security.guidance ? <p>{security.guidance}</p> : null}
    {security.uiState === "error" ? <p>{security.error?.message ?? "Security error."}</p> : null}
  </section>;
}
