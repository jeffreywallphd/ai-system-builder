import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AuthorizationAccessStateApiResponse,
  AuthorizationManagementApiError,
  AuthorizationSharingGrantApiRecord,
} from "../../../infrastructure/api/authorization/sdk/PublicAuthorizationManagementApiContract";
import { AuthorizationPermissionActionMatrix } from "../../../src/domain/authorization/AuthorizationPermissionCatalog";
import type { AuthorizationResourceFamily } from "../../../src/domain/authorization/AuthorizationPermissionCatalog";
import type { AuthorizationRoleKey, ResourceVisibility, SharingPolicyMode } from "../../../src/domain/authorization/AuthorizationDomain";
import { AuthorizationManagementService } from "../../services/AuthorizationManagementService";
import type { AuthorizationSharingTargetDraft } from "../../shared/authorization/AuthorizationManagementClient";

const resourceFamilyOptions = Object.freeze(Object.keys(AuthorizationPermissionActionMatrix) as AuthorizationResourceFamily[]);
const visibilityOptions = Object.freeze([
  { value: "private", label: "Private (only owner and explicit admins)" },
  { value: "workspace", label: "Workspace members" },
  { value: "shared", label: "Shared with selected people or roles" },
  { value: "published", label: "Published" },
] as const);
const sharingPolicyOptions = Object.freeze([
  { value: "owner-only", label: "Owner only" },
  { value: "workspace-members", label: "Workspace members" },
  { value: "explicit", label: "Explicit grants" },
  { value: "published", label: "Published access" },
] as const);
const sharingRoleOptions = Object.freeze(["owner", "admin", "member", "viewer"] as const);

export interface AuthorizationSharingManagementPanelProps {
  readonly sessionToken: string;
  readonly service?: AuthorizationManagementService;
  readonly initialResource?: Readonly<{
    resourceFamily: AuthorizationResourceFamily;
    resourceType: string;
    resourceId: string;
    workspaceId?: string;
  }>;
  readonly allowResourceEditing?: boolean;
  readonly compact?: boolean;
}

export default function AuthorizationSharingManagementPanel({
  sessionToken,
  service,
  initialResource,
  allowResourceEditing = true,
  compact = false,
}: AuthorizationSharingManagementPanelProps): JSX.Element {
  const authorizationService = useMemo(() => service ?? new AuthorizationManagementService(), [service]);

  const [resourceFamily, setResourceFamily] = useState<AuthorizationResourceFamily>(initialResource?.resourceFamily ?? "asset");
  const [resourceType, setResourceType] = useState(initialResource?.resourceType ?? "asset");
  const [resourceId, setResourceId] = useState(initialResource?.resourceId ?? "");
  const [workspaceId, setWorkspaceId] = useState(initialResource?.workspaceId ?? "");
  const [includeDeniedPermissions, setIncludeDeniedPermissions] = useState(true);
  const [includeRevokedSharingGrants, setIncludeRevokedSharingGrants] = useState(false);

  const [accessState, setAccessState] = useState<AuthorizationAccessStateApiResponse>();
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [validationMessages, setValidationMessages] = useState<ReadonlyArray<string>>(Object.freeze([]));
  const [statusMessage, setStatusMessage] = useState<string>();

  const [visibilityDraft, setVisibilityDraft] = useState<ResourceVisibility>("private");
  const [sharingPolicyDraft, setSharingPolicyDraft] = useState<SharingPolicyMode>("owner-only");
  const [allowResharingDraft, setAllowResharingDraft] = useState(false);
  const [publishedAtDraft, setPublishedAtDraft] = useState("");

  const [grantIdDraft, setGrantIdDraft] = useState("");
  const [grantTargetKindDraft, setGrantTargetKindDraft] = useState<AuthorizationSharingTargetDraft["kind"]>("user");
  const [grantTargetUserIdDraft, setGrantTargetUserIdDraft] = useState("");
  const [grantTargetWorkspaceIdDraft, setGrantTargetWorkspaceIdDraft] = useState("");
  const [grantTargetRoleKeyDraft, setGrantTargetRoleKeyDraft] = useState<AuthorizationRoleKey>("member");
  const [grantPermissionModeDraft, setGrantPermissionModeDraft] = useState<"read" | "manage" | "custom">("read");
  const [grantPermissionCsvDraft, setGrantPermissionCsvDraft] = useState("");

  const resolvedResource = useMemo(() => {
    const normalizedType = resourceType.trim();
    const normalizedId = resourceId.trim();
    if (!normalizedType || !normalizedId) {
      return undefined;
    }

    return Object.freeze({
      resourceFamily,
      resourceType: normalizedType,
      resourceId: normalizedId,
    });
  }, [resourceFamily, resourceId, resourceType]);

  const loadAccessState = useCallback(async (): Promise<void> => {
    if (!resolvedResource) {
      setErrorMessage("Resource type and resource id are required.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(undefined);
    setValidationMessages(Object.freeze([]));
    setStatusMessage(undefined);

    try {
      const response = await authorizationService.readAccessState({
        resourceFamily: resolvedResource.resourceFamily,
        resourceType: resolvedResource.resourceType,
        resourceId: resolvedResource.resourceId,
        includeDenied: includeDeniedPermissions,
        includeRevokedSharingGrants,
      }, sessionToken);

      if (!response.ok || !response.data) {
        setAccessState(undefined);
        applyApiError(response.error, setErrorMessage, setValidationMessages);
        return;
      }

      setAccessState(response.data);
      setVisibilityDraft(response.data.resourcePolicyMetadata.visibility);
      setSharingPolicyDraft(response.data.resourcePolicyMetadata.sharingPolicyMode);
      setAllowResharingDraft(response.data.resourcePolicyMetadata.allowResharing);
      setWorkspaceId(response.data.resourcePolicyMetadata.workspaceId ?? "");
      setPublishedAtDraft(response.data.resourcePolicyMetadata.publishedAt ?? "");
    } catch {
      setErrorMessage("Unable to load sharing and visibility state.");
    } finally {
      setIsLoading(false);
    }
  }, [
    authorizationService,
    includeDeniedPermissions,
    includeRevokedSharingGrants,
    resolvedResource,
    sessionToken,
  ]);

  useEffect(() => {
    if (!resolvedResource || !initialResource) {
      return;
    }
    void loadAccessState();
  }, [initialResource, loadAccessState, resolvedResource]);

  const runMutation = async (operation: () => Promise<void>): Promise<void> => {
    setIsMutating(true);
    setErrorMessage(undefined);
    setValidationMessages(Object.freeze([]));
    setStatusMessage(undefined);
    try {
      await operation();
    } finally {
      setIsMutating(false);
    }
  };

  const handleSaveVisibility = (): void => {
    void runMutation(async () => {
      if (!resolvedResource) {
        setErrorMessage("Resource type and resource id are required.");
        return;
      }

      const response = await authorizationService.updateVisibility({
        resourceFamily: resolvedResource.resourceFamily,
        resourceType: resolvedResource.resourceType,
        resourceId: resolvedResource.resourceId,
        workspaceId: workspaceId.trim() || undefined,
        visibility: visibilityDraft,
        sharingPolicyMode: sharingPolicyDraft,
        allowResharing: allowResharingDraft,
        isPublishedCapable: accessState?.resourcePolicyMetadata.isPublishedCapable,
        publishedAt: publishedAtDraft.trim() || undefined,
        expectedRevision: accessState?.resourcePolicyMetadata.revision,
      }, sessionToken);

      if (!response.ok || !response.data) {
        applyApiError(response.error, setErrorMessage, setValidationMessages);
        return;
      }

      setStatusMessage(response.data.metadataChanged ? "Visibility and policy were updated." : "No visibility changes were needed.");
      await loadAccessState();
    });
  };

  const handleAddGrant = (): void => {
    void runMutation(async () => {
      if (!resolvedResource) {
        setErrorMessage("Resource type and resource id are required.");
        return;
      }

      const normalizedGrantId = grantIdDraft.trim();
      if (!normalizedGrantId) {
        setErrorMessage("Grant id is required.");
        return;
      }

      const target = toSharingTarget({
        kind: grantTargetKindDraft,
        userId: grantTargetUserIdDraft,
        workspaceId: grantTargetWorkspaceIdDraft,
        roleKey: grantTargetRoleKeyDraft,
      });
      if (!target.ok) {
        setErrorMessage(target.message);
        return;
      }

      const permissionKeys = toPermissionKeys({
        family: resolvedResource.resourceFamily,
        mode: grantPermissionModeDraft,
        customCsv: grantPermissionCsvDraft,
      });
      if (!permissionKeys.ok) {
        setErrorMessage(permissionKeys.message);
        return;
      }

      const response = await authorizationService.grantSharingAccess({
        resourceFamily: resolvedResource.resourceFamily,
        resourceType: resolvedResource.resourceType,
        resourceId: resolvedResource.resourceId,
        workspaceId: workspaceId.trim() || undefined,
        visibility: visibilityDraft,
        grant: {
          id: normalizedGrantId,
          target: target.value,
          permissionKeys: permissionKeys.permissionKeys,
        },
      }, sessionToken);

      if (!response.ok || !response.data) {
        applyApiError(response.error, setErrorMessage, setValidationMessages);
        return;
      }

      setStatusMessage(response.data.changed ? `Grant "${normalizedGrantId}" was saved.` : `Grant "${normalizedGrantId}" was already up to date.`);
      setGrantIdDraft("");
      if (grantPermissionModeDraft === "custom") {
        setGrantPermissionCsvDraft("");
      }
      await loadAccessState();
    });
  };

  const handleRevokeGrant = (grant: AuthorizationSharingGrantApiRecord): void => {
    void runMutation(async () => {
      if (!resolvedResource) {
        setErrorMessage("Resource type and resource id are required.");
        return;
      }

      const response = await authorizationService.revokeSharingAccess({
        resourceFamily: resolvedResource.resourceFamily,
        resourceType: resolvedResource.resourceType,
        resourceId: resolvedResource.resourceId,
        grantId: grant.grantId,
        workspaceId: workspaceId.trim() || undefined,
        visibility: visibilityDraft,
        expectedRevision: grant.revision,
      }, sessionToken);

      if (!response.ok || !response.data) {
        applyApiError(response.error, setErrorMessage, setValidationMessages);
        return;
      }

      setStatusMessage(response.data.changed ? `Grant "${grant.grantId}" was removed.` : `Grant "${grant.grantId}" was already removed.`);
      await loadAccessState();
    });
  };

  const permissionRows = useMemo(() => {
    const permissions = accessState?.permissions ?? [];
    return [...permissions].sort((left, right) => left.permissionKey.localeCompare(right.permissionKey));
  }, [accessState?.permissions]);
  const activeGrants = useMemo(() => {
    const grants = accessState?.sharingGrants ?? [];
    return grants.filter((grant) => !grant.revokedAt);
  }, [accessState?.sharingGrants]);

  return (
    <div className={`ui-stack ui-stack--md ui-authorization-sharing ${compact ? "ui-authorization-sharing--compact" : ""}`}>
      {!compact ? (
        <p className="ui-text-secondary">
          Review who can access this resource, adjust visibility, and manage direct sharing grants.
        </p>
      ) : null}

      {errorMessage ? <p className="ui-authorization-sharing__alert ui-authorization-sharing__alert--error" role="alert">{errorMessage}</p> : null}
      {statusMessage ? <p className="ui-authorization-sharing__alert ui-authorization-sharing__alert--success" role="status">{statusMessage}</p> : null}
      {validationMessages.length > 0 ? (
        <ul className="ui-authorization-sharing__validation-list">
          {validationMessages.map((message) => <li key={message}>{message}</li>)}
        </ul>
      ) : null}

      <section className="ui-card">
        <div className="ui-card__header">
          <h2 className="ui-card__title">Resource selection</h2>
        </div>
        <div className="ui-card__body ui-stack ui-stack--sm">
          {allowResourceEditing ? (
            <div className="ui-authorization-sharing__field-grid">
              <label className="ui-field">
                <span className="ui-field__label">Resource family</span>
                <select
                  className="ui-select"
                  value={resourceFamily}
                  onChange={(event) => setResourceFamily(event.target.value as AuthorizationResourceFamily)}
                >
                  {resourceFamilyOptions.map((family) => <option key={family} value={family}>{family}</option>)}
                </select>
              </label>
              <label className="ui-field">
                <span className="ui-field__label">Resource type</span>
                <input className="ui-input" value={resourceType} onChange={(event) => setResourceType(event.target.value)} />
              </label>
              <label className="ui-field">
                <span className="ui-field__label">Resource id</span>
                <input className="ui-input" value={resourceId} onChange={(event) => setResourceId(event.target.value)} />
              </label>
            </div>
          ) : (
            <dl className="ui-meta-grid">
              <div className="ui-meta-item">
                <dt className="ui-meta-label">Resource family</dt>
                <dd className="ui-meta-value">{resourceFamily}</dd>
              </div>
              <div className="ui-meta-item">
                <dt className="ui-meta-label">Resource type</dt>
                <dd className="ui-meta-value">{resourceType}</dd>
              </div>
              <div className="ui-meta-item">
                <dt className="ui-meta-label">Resource id</dt>
                <dd className="ui-meta-value">{resourceId}</dd>
              </div>
            </dl>
          )}

          <div className="ui-page__actions">
            <label className="ui-row ui-row--sm ui-settings-page__checkbox" htmlFor="authorization-include-denied">
              <input
                id="authorization-include-denied"
                className="ui-checkbox"
                type="checkbox"
                checked={includeDeniedPermissions}
                onChange={(event) => setIncludeDeniedPermissions(event.target.checked)}
              />
              <span className="ui-field__hint">Show denied permissions</span>
            </label>
            <label className="ui-row ui-row--sm ui-settings-page__checkbox" htmlFor="authorization-include-revoked">
              <input
                id="authorization-include-revoked"
                className="ui-checkbox"
                type="checkbox"
                checked={includeRevokedSharingGrants}
                onChange={(event) => setIncludeRevokedSharingGrants(event.target.checked)}
              />
              <span className="ui-field__hint">Show revoked grants</span>
            </label>
            <button type="button" className="ui-button ui-button--secondary ui-button--sm" disabled={isLoading} onClick={() => { void loadAccessState(); }}>
              {isLoading ? "Loading..." : "Load access state"}
            </button>
          </div>
        </div>
      </section>

      <section className="ui-card">
        <div className="ui-card__header">
          <h2 className="ui-card__title">Visibility and policy</h2>
        </div>
        <div className="ui-card__body ui-stack ui-stack--sm">
          <div className="ui-authorization-sharing__field-grid">
            <label className="ui-field">
              <span className="ui-field__label">Visibility</span>
              <select className="ui-select" value={visibilityDraft} onChange={(event) => setVisibilityDraft(event.target.value as ResourceVisibility)}>
                {visibilityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Sharing policy</span>
              <select className="ui-select" value={sharingPolicyDraft} onChange={(event) => setSharingPolicyDraft(event.target.value as SharingPolicyMode)}>
                {sharingPolicyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Workspace id (optional)</span>
              <input
                className="ui-input"
                placeholder="workspace:team-alpha"
                value={workspaceId}
                onChange={(event) => setWorkspaceId(event.target.value)}
              />
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Published at (ISO-8601, optional)</span>
              <input
                className="ui-input"
                placeholder="2026-04-05T16:30:00.000Z"
                value={publishedAtDraft}
                onChange={(event) => setPublishedAtDraft(event.target.value)}
              />
            </label>
          </div>

          <label className="ui-row ui-row--sm ui-settings-page__checkbox" htmlFor="authorization-allow-resharing">
            <input
              id="authorization-allow-resharing"
              className="ui-checkbox"
              type="checkbox"
              checked={allowResharingDraft}
              onChange={(event) => setAllowResharingDraft(event.target.checked)}
            />
            <span className="ui-field__hint">Allow shared users to share again.</span>
          </label>

          <button
            type="button"
            className="ui-button ui-button--primary ui-button--sm"
            disabled={!resolvedResource || isMutating}
            onClick={handleSaveVisibility}
          >
            {isMutating ? "Saving..." : "Save visibility"}
          </button>
        </div>
      </section>

      <section className="ui-card">
        <div className="ui-card__header">
          <h2 className="ui-card__title">Current sharing grants</h2>
        </div>
        <div className="ui-card__body ui-stack ui-stack--sm">
          {activeGrants.length === 0 ? <p className="ui-text-secondary">No active sharing grants.</p> : null}
          {activeGrants.map((grant) => (
            <article key={grant.grantId} className="ui-authorization-sharing__grant-card">
              <div className="ui-stack ui-stack--2xs">
                <strong>{grant.grantId}</strong>
                <span className="ui-text-secondary ui-text-small">{formatSharingTarget(grant)}</span>
                <span className="ui-text-secondary ui-text-small">Permissions: {grant.permissionKeys.join(", ")}</span>
              </div>
              <button
                type="button"
                className="ui-button ui-button--danger ui-button--sm"
                disabled={isMutating}
                onClick={() => handleRevokeGrant(grant)}
              >
                Remove access
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="ui-card">
        <div className="ui-card__header">
          <h2 className="ui-card__title">Add sharing grant</h2>
        </div>
        <div className="ui-card__body ui-stack ui-stack--sm">
          <div className="ui-authorization-sharing__field-grid">
            <label className="ui-field">
              <span className="ui-field__label">Grant id</span>
              <input className="ui-input" value={grantIdDraft} placeholder="grant-user-jamie-read" onChange={(event) => setGrantIdDraft(event.target.value)} />
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Target type</span>
              <select
                className="ui-select"
                value={grantTargetKindDraft}
                onChange={(event) => setGrantTargetKindDraft(event.target.value as AuthorizationSharingTargetDraft["kind"])}
              >
                <option value="user">Person</option>
                <option value="workspace-role">Workspace role</option>
                <option value="workspace">Workspace</option>
                <option value="public">Public (published only)</option>
              </select>
            </label>
            {grantTargetKindDraft === "user" ? (
              <label className="ui-field">
                <span className="ui-field__label">User identity id</span>
                <input className="ui-input" value={grantTargetUserIdDraft} placeholder="user:jamie" onChange={(event) => setGrantTargetUserIdDraft(event.target.value)} />
              </label>
            ) : null}
            {grantTargetKindDraft === "workspace" || grantTargetKindDraft === "workspace-role" ? (
              <label className="ui-field">
                <span className="ui-field__label">Workspace id</span>
                <input className="ui-input" value={grantTargetWorkspaceIdDraft} placeholder="workspace:team-alpha" onChange={(event) => setGrantTargetWorkspaceIdDraft(event.target.value)} />
              </label>
            ) : null}
            {grantTargetKindDraft === "workspace-role" ? (
              <label className="ui-field">
                <span className="ui-field__label">Workspace role</span>
                <select
                  className="ui-select"
                  value={grantTargetRoleKeyDraft}
                  onChange={(event) => setGrantTargetRoleKeyDraft(event.target.value as AuthorizationRoleKey)}
                >
                  {sharingRoleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </label>
            ) : null}
            <label className="ui-field">
              <span className="ui-field__label">Permission set</span>
              <select
                className="ui-select"
                value={grantPermissionModeDraft}
                onChange={(event) => setGrantPermissionModeDraft(event.target.value as "read" | "manage" | "custom")}
              >
                <option value="read">View only</option>
                <option value="manage">Manage resource</option>
                <option value="custom">Custom keys</option>
              </select>
            </label>
            {grantPermissionModeDraft === "custom" ? (
              <label className="ui-field">
                <span className="ui-field__label">Custom permission keys (CSV)</span>
                <input
                  className="ui-input"
                  value={grantPermissionCsvDraft}
                  placeholder={`${resourceFamily}.read, ${resourceFamily}.share`}
                  onChange={(event) => setGrantPermissionCsvDraft(event.target.value)}
                />
              </label>
            ) : null}
          </div>

          <button
            type="button"
            className="ui-button ui-button--primary ui-button--sm"
            disabled={!resolvedResource || isMutating}
            onClick={handleAddGrant}
          >
            {isMutating ? "Saving..." : "Add grant"}
          </button>
        </div>
      </section>

      <section className="ui-card">
        <div className="ui-card__header">
          <h2 className="ui-card__title">Permission feedback</h2>
        </div>
        <div className="ui-card__body">
          {permissionRows.length === 0 ? <p className="ui-text-secondary">Load access state to see permission decisions.</p> : (
            <div className="ui-table-wrapper">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th scope="col">Permission</th>
                    <th scope="col">Decision</th>
                    <th scope="col">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {permissionRows.map((permission) => (
                    <tr key={permission.permissionKey}>
                      <td>{permission.permissionKey}</td>
                      <td>{permission.isAllowed ? "Allowed" : "Denied"}</td>
                      <td>{permission.reason || permission.denialReason || permission.reasonCode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function toSharingTarget(input: {
  readonly kind: AuthorizationSharingTargetDraft["kind"];
  readonly userId: string;
  readonly workspaceId: string;
  readonly roleKey: AuthorizationRoleKey;
}): { readonly ok: true; readonly value: AuthorizationSharingTargetDraft } | { readonly ok: false; readonly message: string } {
  if (input.kind === "user") {
    const userId = input.userId.trim();
    if (!userId) {
      return Object.freeze({ ok: false, message: "User identity id is required for a person grant." });
    }
    return Object.freeze({
      ok: true,
      value: Object.freeze({
        kind: "user",
        userId,
      }),
    });
  }

  if (input.kind === "workspace-role") {
    const workspaceId = input.workspaceId.trim();
    if (!workspaceId) {
      return Object.freeze({ ok: false, message: "Workspace id is required for a workspace role grant." });
    }
    return Object.freeze({
      ok: true,
      value: Object.freeze({
        kind: "workspace-role",
        workspaceId,
        roleKey: input.roleKey,
      }),
    });
  }

  if (input.kind === "workspace") {
    const workspaceId = input.workspaceId.trim();
    if (!workspaceId) {
      return Object.freeze({ ok: false, message: "Workspace id is required for a workspace grant." });
    }
    return Object.freeze({
      ok: true,
      value: Object.freeze({
        kind: "workspace",
        workspaceId,
      }),
    });
  }

  return Object.freeze({
    ok: true,
    value: Object.freeze({
      kind: "public",
    }),
  });
}

function toPermissionKeys(input: {
  readonly family: AuthorizationResourceFamily;
  readonly mode: "read" | "manage" | "custom";
  readonly customCsv: string;
}): { readonly ok: true; readonly permissionKeys: ReadonlyArray<string> } | { readonly ok: false; readonly message: string } {
  if (input.mode === "read") {
    return Object.freeze({ ok: true, permissionKeys: Object.freeze([`${input.family}.read`]) });
  }

  if (input.mode === "manage") {
    return Object.freeze({ ok: true, permissionKeys: Object.freeze([`${input.family}.manage`]) });
  }

  const keys = [...new Set(input.customCsv.split(",").map((entry) => entry.trim()).filter((entry) => entry.length > 0))];
  if (keys.length === 0) {
    return Object.freeze({ ok: false, message: "At least one permission key is required for custom permission mode." });
  }
  return Object.freeze({ ok: true, permissionKeys: Object.freeze(keys) });
}

function formatSharingTarget(grant: AuthorizationSharingGrantApiRecord): string {
  if (grant.target.kind === "user") {
    return `Shared with person ${grant.target.userId}`;
  }
  if (grant.target.kind === "workspace-role") {
    return `Shared with workspace role ${grant.target.roleKey} in ${grant.target.workspaceId}`;
  }
  if (grant.target.kind === "workspace") {
    return `Shared with workspace ${grant.target.workspaceId}`;
  }
  return "Shared publicly";
}

function applyApiError(
  error: AuthorizationManagementApiError | undefined,
  setErrorMessage: (message: string | undefined) => void,
  setValidationMessages: (messages: ReadonlyArray<string>) => void,
): void {
  setErrorMessage(error?.message ?? "Authorization management request failed.");
  const validationMessages = (error?.validationErrors ?? Object.freeze([])).map((entry) => `${entry.path}: ${entry.message}`);
  setValidationMessages(Object.freeze(validationMessages));
}
