import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { AuthorizationResourceFamily } from "@domain/authorization/AuthorizationPermissionCatalog";
import { AuthorizationPermissionActionMatrix } from "@domain/authorization/AuthorizationPermissionCatalog";
import AuthorizationSharingManagementPanel from "@ui/components/authorization/AuthorizationSharingManagementPanel";
import { ROUTE_PATHS } from "@ui/routes/RouteConfig";
import { AuthorizationManagementService } from "@ui/services/AuthorizationManagementService";
import { StorageAdministrationService } from "@ui/services/StorageAdministrationService";
import {
  AdminReadonlyProperty,
  AdminSettingsField,
  AdminSettingsSection,
} from "@ui/shared/admin/AdminSettingsFormPrimitives";
import { SurfaceStatePanel } from "@ui/shared/components/presentation-state";
import { IdentityAuthSessionStore } from "@ui/shared/identity/IdentityAuthSessionStore";
import type {
  GetStorageInstanceDetailApiResponse,
  ListStorageInstancesApiResponse,
} from "@infrastructure/api/storage/sdk/PublicStorageManagementApiContract";

const resourceFamilyOptions = Object.freeze(Object.keys(AuthorizationPermissionActionMatrix) as AuthorizationResourceFamily[]);

type SharingPolicyScope = "workspace" | "platform";

export interface SecurityPolicyConfigurationPageProps {
  readonly authorizationService?: AuthorizationManagementService;
  readonly storageService?: StorageAdministrationService;
  readonly sessionStore?: IdentityAuthSessionStore;
}

interface SharingPolicyDraft {
  readonly scope: SharingPolicyScope;
  readonly workspaceId: string;
  readonly resourceFamily: AuthorizationResourceFamily;
  readonly resourceType: string;
  readonly resourceId: string;
}

interface SharingPolicySelection {
  readonly scope: SharingPolicyScope;
  readonly workspaceId?: string;
  readonly resourceFamily: AuthorizationResourceFamily;
  readonly resourceType: string;
  readonly resourceId: string;
}

interface StoragePolicyPreviewState {
  readonly isLoading: boolean;
  readonly error?: string;
  readonly selectedStorage?: GetStorageInstanceDetailApiResponse["storage"];
  readonly storageItems: ReadonlyArray<ListStorageInstancesApiResponse["items"][number]>;
}

export default function SecurityPolicyConfigurationPage(
  props: SecurityPolicyConfigurationPageProps = {},
): JSX.Element {
  const sessionStore = useMemo(() => props.sessionStore ?? new IdentityAuthSessionStore(), [props.sessionStore]);
  const authorizationService = useMemo(() => props.authorizationService ?? new AuthorizationManagementService(), [props.authorizationService]);
  const storageService = useMemo(() => props.storageService ?? new StorageAdministrationService(), [props.storageService]);
  const [session] = useState(() => sessionStore.getSession());
  const sessionToken = session?.sessionToken;
  const actorUserIdentityId = session?.userIdentityId;

  const resolvedWorkspaceId = session?.workspaceContext?.resolvedWorkspaceId
    ?? session?.workspaceContext?.requestedWorkspaceId
    ?? session?.initialCapabilityState?.workspaceId
    ?? "";

  const [sharingDraft, setSharingDraft] = useState<SharingPolicyDraft>(() => Object.freeze({
    scope: "workspace",
    workspaceId: resolvedWorkspaceId,
    resourceFamily: "asset",
    resourceType: "asset",
    resourceId: "",
  }));
  const [sharingSelection, setSharingSelection] = useState<SharingPolicySelection>();
  const [sharingSelectionError, setSharingSelectionError] = useState<string>();

  const [storageWorkspaceId, setStorageWorkspaceId] = useState(resolvedWorkspaceId);
  const [selectedStorageInstanceId, setSelectedStorageInstanceId] = useState<string>("");
  const [storagePolicyPreview, setStoragePolicyPreview] = useState<StoragePolicyPreviewState>(() => Object.freeze({
    isLoading: false,
    storageItems: Object.freeze([]),
  }));

  const roleKeys = useMemo(() => {
    const workspaceId = resolvedWorkspaceId;
    const workspaceRoles = workspaceId
      ? session?.workspaceContext?.workspaces.find((workspace) => workspace.workspaceId === workspaceId)?.effectiveRoles
      : undefined;
    return workspaceRoles ?? session?.initialCapabilityState?.effectiveRoles ?? Object.freeze([]);
  }, [resolvedWorkspaceId, session?.initialCapabilityState?.effectiveRoles, session?.workspaceContext?.workspaces]);

  const canEditSharingPolicy = roleKeys.includes("owner") || roleKeys.includes("admin");

  const trustScopeLabel = resolvedWorkspaceId || "No workspace resolved";
  const trustInvalidationReasons = session?.sessionTrustInvalidationReasons ?? Object.freeze([]);

  const applySharingPolicySelection = useCallback((): void => {
    const validation = validateSharingPolicySelection(sharingDraft);
    if (!validation.ok) {
      setSharingSelectionError(validation.message);
      setSharingSelection(undefined);
      return;
    }

    setSharingSelectionError(undefined);
    setSharingSelection(validation.selection);
  }, [sharingDraft]);

  const loadStoragePolicyVisibility = useCallback(async (): Promise<void> => {
    if (!sessionToken || !actorUserIdentityId) {
      return;
    }

    const workspaceId = storageWorkspaceId.trim();
    if (!workspaceId) {
      setStoragePolicyPreview(Object.freeze({
        isLoading: false,
        error: "Workspace id is required to inspect storage policy visibility.",
        storageItems: Object.freeze([]),
      }));
      return;
    }

    setStoragePolicyPreview((current) => Object.freeze({
      ...current,
      isLoading: true,
      error: undefined,
    }));

    try {
      const listResponse = await storageService.listStorageInstances({
        actorUserIdentityId,
        workspaceId,
        limit: 30,
      }, sessionToken);
      if (!listResponse.ok || !listResponse.data) {
        setStoragePolicyPreview(Object.freeze({
          isLoading: false,
          error: listResponse.error?.message ?? "Unable to load storage policy visibility for this workspace.",
          storageItems: Object.freeze([]),
        }));
        return;
      }

      const storageItems = listResponse.data.items;
      const preferredStorageId = selectedStorageInstanceId.trim();
      const selectedStorageId = preferredStorageId && storageItems.some((item) => item.storageInstanceId === preferredStorageId)
        ? preferredStorageId
        : storageItems[0]?.storageInstanceId;

      if (!selectedStorageId) {
        setStoragePolicyPreview(Object.freeze({
          isLoading: false,
          selectedStorage: undefined,
          storageItems,
        }));
        return;
      }

      const detailResponse = await storageService.getStorageInstanceDetail({
        actorUserIdentityId,
        workspaceId,
        storageInstanceId: selectedStorageId,
      }, sessionToken);
      if (!detailResponse.ok || !detailResponse.data) {
        setStoragePolicyPreview(Object.freeze({
          isLoading: false,
          error: detailResponse.error?.message ?? "Unable to load storage policy detail.",
          storageItems,
        }));
        return;
      }

      setSelectedStorageInstanceId(selectedStorageId);
      setStoragePolicyPreview(Object.freeze({
        isLoading: false,
        selectedStorage: detailResponse.data.storage,
        storageItems,
      }));
    } catch {
      setStoragePolicyPreview(Object.freeze({
        isLoading: false,
        error: "Storage policy visibility request failed.",
        storageItems: Object.freeze([]),
      }));
    }
  }, [actorUserIdentityId, selectedStorageInstanceId, sessionToken, storageService, storageWorkspaceId]);

  if (!sessionToken || !session || sessionStore.isSessionExpired(session)) {
    return (
      <section className="ui-page ui-security-policy-page">
        <SurfaceStatePanel
          state={Object.freeze({
            kind: "permission-denied",
            title: "Security and policy configuration",
            message: "Sign in with an authenticated administrative session before managing security and policy settings.",
          })}
          action={<Link className="ui-button ui-button--primary" to={ROUTE_PATHS.login}>Go to sign in</Link>}
        />
      </section>
    );
  }

  return (
    <section className="ui-page ui-security-policy-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Security and policy configuration</h1>
          <p className="ui-page__subtitle">
            Configure supported sharing policy controls and inspect current trust and storage policy posture without exposing unfinished or unsafe controls.
          </p>
        </div>
        <div className="ui-page__actions">
          <Link className="ui-button ui-button--secondary ui-button--sm" to={ROUTE_PATHS.settings}>Back to settings</Link>
          <Link className="ui-button ui-button--secondary ui-button--sm" to={ROUTE_PATHS.adminShell}>Desktop administration shell</Link>
        </div>
      </div>

      <AdminSettingsSection
        title="Sharing policy controls"
        description="Select a supported resource scope and configure current visibility/sharing policy state."
        mode={canEditSharingPolicy ? "editable" : "read-only"}
        scopeLabel={sharingDraft.scope === "workspace" ? (sharingDraft.workspaceId.trim() || "workspace (required)") : "platform"}
        permissionLabel={canEditSharingPolicy ? "owner/admin" : "read-only (insufficient role)"}
      >
        <div className="ui-security-policy-page__grid">
          <AdminSettingsField label="Policy scope" hint="Workspace scope requires a workspace id.">
            <select
              className="ui-select"
              value={sharingDraft.scope}
              disabled={!canEditSharingPolicy}
              onChange={(event) => {
                const scope = event.target.value as SharingPolicyScope;
                setSharingDraft((current) => Object.freeze({ ...current, scope }));
              }}
            >
              <option value="workspace">workspace</option>
              <option value="platform">platform</option>
            </select>
          </AdminSettingsField>
          <AdminSettingsField label="Workspace id" hint="Required when scope is workspace.">
            <input
              className="ui-input"
              value={sharingDraft.workspaceId}
              disabled={!canEditSharingPolicy}
              onChange={(event) => setSharingDraft((current) => Object.freeze({ ...current, workspaceId: event.target.value }))}
              placeholder="workspace-alpha"
            />
          </AdminSettingsField>
          <AdminSettingsField label="Resource family">
            <select
              className="ui-select"
              value={sharingDraft.resourceFamily}
              disabled={!canEditSharingPolicy}
              onChange={(event) => setSharingDraft((current) => Object.freeze({
                ...current,
                resourceFamily: event.target.value as AuthorizationResourceFamily,
              }))}
            >
              {resourceFamilyOptions.map((family) => <option key={family} value={family}>{family}</option>)}
            </select>
          </AdminSettingsField>
          <AdminSettingsField label="Resource type">
            <input
              className="ui-input"
              value={sharingDraft.resourceType}
              disabled={!canEditSharingPolicy}
              onChange={(event) => setSharingDraft((current) => Object.freeze({ ...current, resourceType: event.target.value }))}
              placeholder="asset"
            />
          </AdminSettingsField>
          <AdminSettingsField label="Resource id" hint="Use a concrete resource id to inspect and edit policy state.">
            <input
              className="ui-input"
              value={sharingDraft.resourceId}
              disabled={!canEditSharingPolicy}
              onChange={(event) => setSharingDraft((current) => Object.freeze({ ...current, resourceId: event.target.value }))}
              placeholder="asset:policy-target"
            />
          </AdminSettingsField>
        </div>

        {sharingSelectionError ? <p className="ui-security-policy-page__alert ui-security-policy-page__alert--error" role="alert">{sharingSelectionError}</p> : null}

        <div className="ui-page__actions">
          <button
            type="button"
            className="ui-button ui-button--primary ui-button--sm"
            disabled={!canEditSharingPolicy}
            onClick={applySharingPolicySelection}
          >
            Load policy controls
          </button>
          {!canEditSharingPolicy ? <span className="ui-text-secondary ui-text-small">Your role can inspect security posture but cannot edit sharing policy from this surface.</span> : null}
        </div>

        {sharingSelection ? (
          <AuthorizationSharingManagementPanel
            sessionToken={sessionToken}
            service={authorizationService}
            allowResourceEditing={false}
            initialResource={Object.freeze({
              resourceFamily: sharingSelection.resourceFamily,
              resourceType: sharingSelection.resourceType,
              resourceId: sharingSelection.resourceId,
              workspaceId: sharingSelection.workspaceId,
            })}
          />
        ) : (
          <p className="ui-text-secondary">Load a validated resource selection to inspect and manage supported sharing policy state.</p>
        )}
      </AdminSettingsSection>

      <AdminSettingsSection
        title="Trust posture"
        description="Inspect trust state and security consequences from the current authenticated session context."
        mode="read-only"
        scopeLabel={trustScopeLabel}
        permissionLabel="system.read"
      >
        <div className="ui-security-policy-page__property-grid">
          <AdminReadonlyProperty label="Session trust state" value={session.sessionTrustState ?? "unknown"} />
          <AdminReadonlyProperty label="Trust evaluated at" value={session.sessionTrustEvaluatedAt ?? "not available"} />
          <AdminReadonlyProperty label="Trusted device" value={session.trustedDeviceDisplayName ?? session.sessionTrustedDeviceId ?? "none"} />
          <AdminReadonlyProperty label="Trust invalidation reasons" value={trustInvalidationReasons.length > 0 ? trustInvalidationReasons.join(", ") : "none"} />
        </div>
        <p className="ui-text-secondary ui-text-small">
          Trust posture is inspect-only here. Use dedicated trust administration surfaces for revocation and enrollment review operations.
        </p>
        <div className="ui-page__actions">
          <Link className="ui-button ui-button--secondary ui-button--sm" to={ROUTE_PATHS.trustedDevices}>Open trusted devices</Link>
          <Link className="ui-button ui-button--secondary ui-button--sm" to={ROUTE_PATHS.nodeInventory}>Open node inventory</Link>
          <Link className="ui-button ui-button--secondary ui-button--sm" to={ROUTE_PATHS.nodeEnrollmentReview}>Open node enrollment review</Link>
        </div>
      </AdminSettingsSection>

      <AdminSettingsSection
        title="Storage policy visibility"
        description="Inspect encryption and retention policy posture for storage instances in a workspace."
        mode="read-only"
        scopeLabel={storageWorkspaceId.trim() || "workspace (required)"}
        permissionLabel="storage-instance.manage"
      >
        <div className="ui-security-policy-page__grid">
          <AdminSettingsField label="Workspace id">
            <input
              className="ui-input"
              value={storageWorkspaceId}
              onChange={(event) => setStorageWorkspaceId(event.target.value)}
              placeholder="workspace-alpha"
            />
          </AdminSettingsField>
          <AdminSettingsField label="Storage instance" hint="Optional. Empty selection defaults to the first available instance.">
            <select
              className="ui-select"
              value={selectedStorageInstanceId}
              onChange={(event) => setSelectedStorageInstanceId(event.target.value)}
            >
              <option value="">Auto-select first instance</option>
              {storagePolicyPreview.storageItems.map((item) => (
                <option key={item.storageInstanceId} value={item.storageInstanceId}>{item.display.displayName}</option>
              ))}
            </select>
          </AdminSettingsField>
        </div>

        <div className="ui-page__actions">
          <button
            type="button"
            className="ui-button ui-button--secondary ui-button--sm"
            disabled={storagePolicyPreview.isLoading}
            onClick={() => {
              void loadStoragePolicyVisibility();
            }}
          >
            {storagePolicyPreview.isLoading ? "Loading..." : "Inspect storage policy"}
          </button>
          <Link className="ui-button ui-button--secondary ui-button--sm" to={ROUTE_PATHS.storageAdmin}>Open storage administration</Link>
        </div>

        {storagePolicyPreview.error ? <p className="ui-security-policy-page__alert ui-security-policy-page__alert--error" role="alert">{storagePolicyPreview.error}</p> : null}

        {!storagePolicyPreview.selectedStorage ? (
          <p className="ui-text-secondary">No storage policy detail loaded yet.</p>
        ) : (
          <div className="ui-security-policy-page__property-grid">
            <AdminReadonlyProperty label="Storage" value={storagePolicyPreview.selectedStorage.display.displayName} />
            <AdminReadonlyProperty label="Policy id" value={storagePolicyPreview.selectedStorage.policy.policyId} />
            <AdminReadonlyProperty label="Encryption mode" value={storagePolicyPreview.selectedStorage.policy.encryptionMode} />
            <AdminReadonlyProperty label="Key scope" value={storagePolicyPreview.selectedStorage.policy.keyScope} />
            <AdminReadonlyProperty label="Content encryption required" value={storagePolicyPreview.selectedStorage.policy.contentEncryptionRequired ? "yes" : "no"} />
            <AdminReadonlyProperty label="Retention expiry action" value={storagePolicyPreview.selectedStorage.policy.retentionExpiryAction} />
            <AdminReadonlyProperty label="Purge grace period" value={storagePolicyPreview.selectedStorage.policy.purgeGracePeriodDays ?? "none"} />
            <AdminReadonlyProperty label="Preview decryption" value={storagePolicyPreview.selectedStorage.policy.allowPreviewDecryption ? "allowed" : "restricted"} />
            <AdminReadonlyProperty label="Worker decryption" value={storagePolicyPreview.selectedStorage.policy.allowWorkerDecryption ? "allowed" : "restricted"} />
          </div>
        )}
      </AdminSettingsSection>
    </section>
  );
}

export function validateSharingPolicySelection(
  draft: SharingPolicyDraft,
): { readonly ok: true; readonly selection: SharingPolicySelection } | { readonly ok: false; readonly message: string } {
  const resourceType = draft.resourceType.trim();
  if (!resourceType) {
    return Object.freeze({ ok: false, message: "Resource type is required." });
  }

  const resourceId = draft.resourceId.trim();
  if (!resourceId) {
    return Object.freeze({ ok: false, message: "Resource id is required." });
  }

  const workspaceId = draft.workspaceId.trim();
  if (draft.scope === "workspace" && !workspaceId) {
    return Object.freeze({ ok: false, message: "Workspace id is required for workspace scope." });
  }

  return Object.freeze({
    ok: true,
    selection: Object.freeze({
      scope: draft.scope,
      workspaceId: draft.scope === "workspace" ? workspaceId : undefined,
      resourceFamily: draft.resourceFamily,
      resourceType,
      resourceId,
    }),
  });
}
