import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { SecretMetadataApiRecord } from "@infrastructure/api/security/sdk/PublicSecretMetadataApiContract";
import { SecretKinds, SecretScopes, type SecretKind, type SecretScope } from "@domain/security/SecretDomain";
import { SecretClassificationIds, type SecretClassificationId } from "@shared/contracts/security/SecretClassificationContracts";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import { SecretMetadataManagementService } from "../services/SecretMetadataManagementService";
import { IdentityAuthSessionStore } from "@shared/identity/IdentityAuthSessionStore";

const classificationOptions = Object.freeze([
  SecretClassificationIds.providerCredential,
  SecretClassificationIds.personalApiKey,
  SecretClassificationIds.storageCredential,
  SecretClassificationIds.signingMaterial,
  SecretClassificationIds.integrationToken,
]);

const kindOptions = Object.freeze([
  SecretKinds.apiKey,
  SecretKinds.accessToken,
  SecretKinds.refreshToken,
  SecretKinds.password,
  SecretKinds.privateKey,
  SecretKinds.certificate,
  SecretKinds.connectionString,
  SecretKinds.generic,
]);

const scopeOptions = Object.freeze([SecretScopes.server, SecretScopes.workspace, SecretScopes.user]);

export default function SecretMetadataManagementPage(): JSX.Element {
  const service = useMemo(() => new SecretMetadataManagementService(), []);
  const sessionStore = useMemo(() => new IdentityAuthSessionStore(), []);
  const [session] = useState(() => sessionStore.getSession());
  const sessionToken = session?.sessionToken;

  const [scope, setScope] = useState<SecretScope>(SecretScopes.user);
  const [ownerWorkspaceId, setOwnerWorkspaceId] = useState("");
  const [ownerUserIdentityId, setOwnerUserIdentityId] = useState(() => session?.userIdentityId ?? "");
  const [includeDisabled, setIncludeDisabled] = useState(true);
  const [secrets, setSecrets] = useState<ReadonlyArray<SecretMetadataApiRecord>>(Object.freeze([]));
  const [selectedSecretId, setSelectedSecretId] = useState<string>();
  const [selectedSecret, setSelectedSecret] = useState<SecretMetadataApiRecord>();
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [statusMessage, setStatusMessage] = useState<string>();

  const [createSecretId, setCreateSecretId] = useState("");
  const [createName, setCreateName] = useState("personal.openai.api-key");
  const [createKind, setCreateKind] = useState<SecretKind>(SecretKinds.apiKey);
  const [createClassificationId, setCreateClassificationId] = useState<SecretClassificationId>(SecretClassificationIds.personalApiKey);
  const [createDisplayName, setCreateDisplayName] = useState("");
  const [createTagsCsv, setCreateTagsCsv] = useState("");
  const [createLabelsLines, setCreateLabelsLines] = useState("");
  const [createPlaintext, setCreatePlaintext] = useState("");

  const [rotatePlaintext, setRotatePlaintext] = useState("");
  const [rotateExpectedVersionId, setRotateExpectedVersionId] = useState("");

  useEffect(() => {
    if (!sessionToken || !session || sessionStore.isSessionExpired(session)) {
      return;
    }
    void refreshSecretList();
  }, [sessionToken]);

  const selectedScopeOwner = resolveOwner(scope, ownerWorkspaceId, ownerUserIdentityId, session?.userIdentityId);

  const refreshSecretList = async (preferredSecretId?: string): Promise<void> => {
    if (!sessionToken) {
      return;
    }
    setIsLoading(true);
    setErrorMessage(undefined);
    try {
      const owner = resolveOwner(scope, ownerWorkspaceId, ownerUserIdentityId, session?.userIdentityId);
      if (!owner) {
        setSecrets(Object.freeze([]));
        setSelectedSecretId(undefined);
        setSelectedSecret(undefined);
        setErrorMessage("Provide the required owner fields for the selected scope.");
        return;
      }
      const listResponse = await service.listSecrets({
        owner,
        includeDisabled,
        limit: 200,
      }, sessionToken);
      if (!listResponse.ok || !listResponse.data) {
        setSecrets(Object.freeze([]));
        setSelectedSecret(undefined);
        setSelectedSecretId(undefined);
        setErrorMessage(listResponse.error?.message ?? "Unable to load secret metadata.");
        return;
      }

      const items = listResponse.data.items;
      setSecrets(items);
      const nextSecretId = preferredSecretId
        ?? (selectedSecretId && items.some((item) => item.secretId === selectedSecretId) ? selectedSecretId : items[0]?.secretId);
      setSelectedSecretId(nextSecretId);
      if (!nextSecretId) {
        setSelectedSecret(undefined);
        return;
      }
      await loadSecretDetail(nextSecretId);
    } catch {
      setErrorMessage("Secret metadata request failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadSecretDetail = async (secretId: string): Promise<void> => {
    if (!sessionToken) {
      return;
    }
    const detailResponse = await service.getSecret({ secretId }, sessionToken);
    if (!detailResponse.ok || !detailResponse.data) {
      setSelectedSecret(undefined);
      setErrorMessage(detailResponse.error?.message ?? "Unable to load secret metadata detail.");
      return;
    }
    setSelectedSecret(detailResponse.data.secret);
    setRotateExpectedVersionId(detailResponse.data.secret.currentVersionId ?? "");
  };

  const runMutation = async (action: () => Promise<void>): Promise<void> => {
    setIsMutating(true);
    setErrorMessage(undefined);
    setStatusMessage(undefined);
    try {
      await action();
    } finally {
      setIsMutating(false);
    }
  };

  if (!sessionToken || !session || sessionStore.isSessionExpired(session)) {
    return (
      <section className="ui-page ui-secret-metadata-page">
        <div className="ui-card">
          <div className="ui-card__header">
            <h1 className="ui-card__title">Secret metadata management</h1>
            <p className="ui-card__subtitle">Sign in with an authenticated admin-capable account before managing secrets.</p>
          </div>
          <div className="ui-card__body">
            <Link className="ui-button ui-button--primary" to={ROUTE_PATHS.login}>Go to sign in</Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="ui-page ui-secret-metadata-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Secret metadata management</h1>
          <p className="ui-page__subtitle">Create, inspect, rotate, and disable scoped secrets without rendering stored plaintext values.</p>
        </div>
        <div className="ui-page__actions">
          <Link className="ui-button ui-button--secondary ui-button--sm" to={ROUTE_PATHS.settings}>Back to settings</Link>
          <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => { void refreshSecretList(); }} disabled={isLoading}>
            Refresh
          </button>
        </div>
      </div>

      {errorMessage ? <p className="ui-secret-metadata-page__alert ui-secret-metadata-page__alert--error" role="alert">{errorMessage}</p> : null}
      {statusMessage ? <p className="ui-secret-metadata-page__alert ui-secret-metadata-page__alert--success" role="status">{statusMessage}</p> : null}

      <div className="ui-secret-metadata-page__grid">
        <section className="ui-card ui-secret-metadata-page__card">
          <div className="ui-card__header"><h2 className="ui-card__title">Scope owner filter</h2></div>
          <div className="ui-card__body ui-stack ui-stack--sm">
            <label className="ui-field">
              <span className="ui-field__label">Scope</span>
              <select className="ui-select" value={scope} onChange={(event) => setScope(event.target.value as SecretScope)}>
                {scopeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            {scope === SecretScopes.workspace ? (
              <label className="ui-field">
                <span className="ui-field__label">Workspace ID</span>
                <input className="ui-input" value={ownerWorkspaceId} onChange={(event) => setOwnerWorkspaceId(event.target.value)} placeholder="workspace:alpha" />
              </label>
            ) : null}
            {scope === SecretScopes.user ? (
              <label className="ui-field">
                <span className="ui-field__label">User identity ID</span>
                <input className="ui-input" value={ownerUserIdentityId} onChange={(event) => setOwnerUserIdentityId(event.target.value)} placeholder="user:alpha" />
              </label>
            ) : null}
            <label className="ui-row ui-row--sm">
              <input className="ui-checkbox" type="checkbox" checked={includeDisabled} onChange={(event) => setIncludeDisabled(event.target.checked)} />
              <span className="ui-text-secondary ui-text-small">Include disabled records</span>
            </label>
            <button type="button" className="ui-button ui-button--primary ui-button--sm" onClick={() => { void refreshSecretList(); }} disabled={isLoading}>
              {isLoading ? "Loading..." : "Load secrets"}
            </button>
          </div>
        </section>

        <section className="ui-card ui-secret-metadata-page__card">
          <div className="ui-card__header"><h2 className="ui-card__title">Create secret</h2></div>
          <div className="ui-card__body ui-stack ui-stack--sm">
            <label className="ui-field"><span className="ui-field__label">Secret ID</span><input className="ui-input" value={createSecretId} onChange={(event) => setCreateSecretId(event.target.value)} placeholder="secret:user:openai" /></label>
            <label className="ui-field"><span className="ui-field__label">Name</span><input className="ui-input" value={createName} onChange={(event) => setCreateName(event.target.value)} placeholder="personal.openai.api-key" /></label>
            <label className="ui-field"><span className="ui-field__label">Kind</span><select className="ui-select" value={createKind} onChange={(event) => setCreateKind(event.target.value as SecretKind)}>{kindOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
            <label className="ui-field"><span className="ui-field__label">Classification</span><select className="ui-select" value={createClassificationId} onChange={(event) => setCreateClassificationId(event.target.value as SecretClassificationId)}>{classificationOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
            <label className="ui-field"><span className="ui-field__label">Display name (optional)</span><input className="ui-input" value={createDisplayName} onChange={(event) => setCreateDisplayName(event.target.value)} /></label>
            <label className="ui-field"><span className="ui-field__label">Tags CSV (optional)</span><input className="ui-input" value={createTagsCsv} onChange={(event) => setCreateTagsCsv(event.target.value)} placeholder="provider,prod" /></label>
            <label className="ui-field"><span className="ui-field__label">Labels (key=value per line)</span><textarea className="ui-textarea" value={createLabelsLines} onChange={(event) => setCreateLabelsLines(event.target.value)} rows={4} /></label>
            <label className="ui-field"><span className="ui-field__label">Secret value (submit only)</span><textarea className="ui-textarea" value={createPlaintext} onChange={(event) => setCreatePlaintext(event.target.value)} rows={3} /></label>
            <button
              type="button"
              className="ui-button ui-button--primary ui-button--sm"
              disabled={isMutating}
              onClick={() => {
                void runMutation(async () => {
                  if (!sessionToken) {
                    return;
                  }
                  const owner = selectedScopeOwner;
                  if (!owner) {
                    setErrorMessage("Provide the required owner fields for the selected scope.");
                    return;
                  }
                  const secretId = createSecretId.trim();
                  const name = createName.trim();
                  const plaintext = createPlaintext;
                  if (!secretId || !name || !plaintext.trim()) {
                    setErrorMessage("Secret ID, name, and secret value are required.");
                    return;
                  }
                  const metadata = buildMetadataInput(createDisplayName, createTagsCsv, createLabelsLines);
                  if (!metadata.ok) {
                    setErrorMessage(metadata.message);
                    return;
                  }
                  const response = await service.createSecret({
                    secretId,
                    name,
                    owner,
                    kind: createKind,
                    plaintext,
                    classificationId: createClassificationId,
                    metadata: metadata.value,
                  }, sessionToken);
                  if (!response.ok || !response.data) {
                    setErrorMessage(response.error?.message ?? "Unable to create secret.");
                    return;
                  }
                  setCreatePlaintext("");
                  setStatusMessage(`Secret "${response.data.secret.name}" created. Plaintext is accepted on submission and not returned.`);
                  await refreshSecretList(response.data.secret.secretId);
                });
              }}
            >
              {isMutating ? "Saving..." : "Create secret"}
            </button>
          </div>
        </section>

        <section className="ui-card ui-secret-metadata-page__card">
          <div className="ui-card__header"><h2 className="ui-card__title">Secrets</h2></div>
          <div className="ui-card__body">
            {secrets.length === 0 ? <p className="ui-text-secondary">{isLoading ? "Loading secrets..." : "No secret metadata found for this scope owner."}</p> : (
              <div className="ui-table-wrapper">
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Scope</th>
                      <th scope="col">State</th>
                      <th scope="col">Version</th>
                    </tr>
                  </thead>
                  <tbody>
                    {secrets.map((secret) => (
                      <tr key={secret.secretId} className={secret.secretId === selectedSecretId ? "ui-secret-metadata-page__table-row--selected" : undefined}>
                        <td>
                          <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={() => { setSelectedSecretId(secret.secretId); void loadSecretDetail(secret.secretId); }}>
                            {secret.name}
                          </button>
                          <div className="ui-text-secondary ui-text-small">{secret.secretId}</div>
                        </td>
                        <td>{formatScope(secret)}</td>
                        <td>{secret.state}</td>
                        <td>{secret.currentVersionId ?? "none"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="ui-card ui-secret-metadata-page__card">
          <div className="ui-card__header"><h2 className="ui-card__title">Metadata detail</h2></div>
          <div className="ui-card__body ui-stack ui-stack--sm">
            {!selectedSecret ? <p className="ui-text-secondary">Select a secret to inspect metadata details.</p> : (
              <>
                <div className="ui-meta-grid">
                  <div className="ui-meta-item"><span className="ui-meta-label">Secret ID</span><span className="ui-meta-value">{selectedSecret.secretId}</span></div>
                  <div className="ui-meta-item"><span className="ui-meta-label">Name</span><span className="ui-meta-value">{selectedSecret.name}</span></div>
                  <div className="ui-meta-item"><span className="ui-meta-label">Scope owner</span><span className="ui-meta-value">{formatScope(selectedSecret)}</span></div>
                  <div className="ui-meta-item"><span className="ui-meta-label">Kind</span><span className="ui-meta-value">{selectedSecret.kind}</span></div>
                  <div className="ui-meta-item"><span className="ui-meta-label">State</span><span className="ui-meta-value">{selectedSecret.state}</span></div>
                  <div className="ui-meta-item"><span className="ui-meta-label">Current version</span><span className="ui-meta-value">{selectedSecret.currentVersionId ?? "none"}</span></div>
                  <div className="ui-meta-item"><span className="ui-meta-label">Updated</span><span className="ui-meta-value">{formatDate(selectedSecret.updatedAt)}</span></div>
                  <div className="ui-meta-item"><span className="ui-meta-label">Plaintext</span><span className="ui-meta-value">Redacted by design</span></div>
                </div>
                <div className="ui-stack ui-stack--2xs">
                  <span className="ui-field__label">Metadata tags</span>
                  <span className="ui-text-secondary ui-text-small">{selectedSecret.metadata.tags.join(", ") || "none"}</span>
                </div>
                <div className="ui-stack ui-stack--2xs">
                  <span className="ui-field__label">Metadata labels</span>
                  {Object.keys(selectedSecret.metadata.labels).length === 0 ? <span className="ui-text-secondary ui-text-small">none</span> : (
                    <div className="ui-table-wrapper">
                      <table className="ui-table">
                        <thead><tr><th scope="col">Key</th><th scope="col">Value</th></tr></thead>
                        <tbody>{Object.entries(selectedSecret.metadata.labels).map(([key, value]) => <tr key={key}><td>{key}</td><td>{value}</td></tr>)}</tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </section>

        <section className="ui-card ui-secret-metadata-page__card">
          <div className="ui-card__header"><h2 className="ui-card__title">Rotate and disable</h2></div>
          <div className="ui-card__body ui-stack ui-stack--sm">
            {!selectedSecret ? <p className="ui-text-secondary">Select a secret before running administrative actions.</p> : (
              <>
                <label className="ui-field"><span className="ui-field__label">Expected current version (optional)</span><input className="ui-input" value={rotateExpectedVersionId} onChange={(event) => setRotateExpectedVersionId(event.target.value)} /></label>
                <label className="ui-field"><span className="ui-field__label">New secret value for rotation</span><textarea className="ui-textarea" value={rotatePlaintext} onChange={(event) => setRotatePlaintext(event.target.value)} rows={3} /></label>
                <div className="ui-page__actions">
                  <button
                    type="button"
                    className="ui-button ui-button--secondary ui-button--sm"
                    disabled={isMutating || selectedSecret.state === "disabled"}
                    onClick={() => {
                      void runMutation(async () => {
                        if (!sessionToken || !selectedSecret) {
                          return;
                        }
                        if (!rotatePlaintext.trim()) {
                          setErrorMessage("Provide a new secret value to rotate.");
                          return;
                        }
                        const response = await service.rotateSecret({
                          secretId: selectedSecret.secretId,
                          plaintext: rotatePlaintext,
                          expectedCurrentVersionId: rotateExpectedVersionId.trim() || undefined,
                        }, sessionToken);
                        if (!response.ok || !response.data) {
                          setErrorMessage(response.error?.message ?? "Unable to rotate secret.");
                          return;
                        }
                        setRotatePlaintext("");
                        setStatusMessage(`Secret "${response.data.secret.name}" rotated. New plaintext is not returned.`);
                        await refreshSecretList(response.data.secret.secretId);
                      });
                    }}
                  >
                    {isMutating ? "Saving..." : "Rotate secret"}
                  </button>
                  <button
                    type="button"
                    className="ui-button ui-button--danger ui-button--sm"
                    disabled={isMutating || selectedSecret.state === "disabled"}
                    onClick={() => {
                      void runMutation(async () => {
                        if (!sessionToken || !selectedSecret) {
                          return;
                        }
                        const response = await service.disableSecret({
                          secretId: selectedSecret.secretId,
                        }, sessionToken);
                        if (!response.ok || !response.data) {
                          setErrorMessage(response.error?.message ?? "Unable to disable secret.");
                          return;
                        }
                        setStatusMessage(`Secret "${response.data.secret.name}" disabled.`);
                        await refreshSecretList(response.data.secret.secretId);
                      });
                    }}
                  >
                    {isMutating ? "Saving..." : "Disable secret"}
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

function resolveOwner(
  scope: SecretScope,
  workspaceIdInput: string,
  userIdentityIdInput: string,
  fallbackUserIdentityId?: string,
): { readonly scope: SecretScope; readonly workspaceId?: string; readonly userIdentityId?: string } | undefined {
  if (scope === SecretScopes.server) {
    return Object.freeze({ scope });
  }
  if (scope === SecretScopes.workspace) {
    const workspaceId = workspaceIdInput.trim();
    return workspaceId ? Object.freeze({ scope, workspaceId }) : undefined;
  }
  const userIdentityId = (userIdentityIdInput.trim() || fallbackUserIdentityId || "").trim();
  return userIdentityId ? Object.freeze({ scope, userIdentityId }) : undefined;
}

function buildMetadataInput(
  displayName: string,
  tagsCsv: string,
  labelsLines: string,
): { readonly ok: true; readonly value?: Readonly<{ readonly displayName?: string; readonly tags?: ReadonlyArray<string>; readonly labels?: Readonly<Record<string, string>>; }> } | { readonly ok: false; readonly message: string } {
  const normalizedDisplayName = displayName.trim() || undefined;
  const tags = tagsCsv
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  const labelEntries = labelsLines
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const labels: Record<string, string> = {};
  for (const entry of labelEntries) {
    const separatorIndex = entry.indexOf("=");
    if (separatorIndex <= 0 || separatorIndex === entry.length - 1) {
      return Object.freeze({ ok: false, message: `Invalid label entry "${entry}". Use key=value format.` });
    }
    const key = entry.slice(0, separatorIndex).trim();
    const value = entry.slice(separatorIndex + 1).trim();
    if (!key || !value) {
      return Object.freeze({ ok: false, message: `Invalid label entry "${entry}". Use key=value format.` });
    }
    labels[key] = value;
  }
  if (!normalizedDisplayName && tags.length === 0 && Object.keys(labels).length === 0) {
    return Object.freeze({ ok: true });
  }
  return Object.freeze({
    ok: true,
    value: Object.freeze({
      displayName: normalizedDisplayName,
      tags: tags.length > 0 ? Object.freeze(tags) : undefined,
      labels: Object.keys(labels).length > 0 ? Object.freeze(labels) : undefined,
    }),
  });
}

function formatScope(secret: SecretMetadataApiRecord): string {
  if (secret.scope === SecretScopes.workspace) {
    return `${secret.scope}:${secret.workspaceId ?? "unknown"}`;
  }
  if (secret.scope === SecretScopes.user) {
    return `${secret.scope}:${secret.userIdentityId ?? "unknown"}`;
  }
  return secret.scope;
}

function formatDate(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return new Date(parsed).toLocaleString();
}

