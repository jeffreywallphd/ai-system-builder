import { useEffect, useMemo, useState } from "react";
import type {
  GetStorageInstanceDetailApiResponse,
  StorageManagementApiError,
} from "../../../infrastructure/api/storage/sdk/PublicStorageManagementApiContract";
import {
  StorageAccessModes,
  StorageAccessScopes,
  StorageBackendTypes,
  StorageEncryptionKeyScopes,
  StorageEncryptionModes,
  StorageLifecycleStates,
  StorageManagedActions,
  type StorageAccessMode,
  type StorageAccessScope,
  type StorageBackendType,
  type StorageEncryptionKeyScope,
  type StorageEncryptionMode,
} from "../../../domain/storage/StorageDomain";
import {
  StorageTransportSchemaValidationError,
  parseCreateStorageInstanceRequestDto,
  parseUpdateStorageInstanceRequestDto,
} from "../../../shared/schemas/storage/StorageTransportSchemaContracts";
import type { StorageAdministrationService } from "../../services/StorageAdministrationService";

interface StorageInstanceWorkflowPanelProps {
  readonly workspaceId: string;
  readonly onWorkspaceIdChange: (value: string) => void;
  readonly actorUserIdentityId: string;
  readonly sessionToken: string;
  readonly service: StorageAdministrationService;
  readonly selectedStorage?: GetStorageInstanceDetailApiResponse["storage"];
  readonly onMutationComplete: (preferredStorageId?: string) => Promise<void>;
}

export default function StorageInstanceWorkflowPanel(props: StorageInstanceWorkflowPanelProps): JSX.Element {
  const [createStorageId, setCreateStorageId] = useState("");
  const [createDisplayName, setCreateDisplayName] = useState("");
  const [createOwnerUserIdentityId, setCreateOwnerUserIdentityId] = useState(props.actorUserIdentityId);
  const [createBackendType, setCreateBackendType] = useState<StorageBackendType>(StorageBackendTypes.managedFilesystem);
  const [createAccessMode, setCreateAccessMode] = useState<StorageAccessMode>(StorageAccessModes.readWrite);
  const [createAccessScope, setCreateAccessScope] = useState<StorageAccessScope>(StorageAccessScopes.workspaceMembers);
  const [createPolicyId, setCreatePolicyId] = useState("");
  const [createEncryptionProfileId, setCreateEncryptionProfileId] = useState("");
  const [createEncryptionMode, setCreateEncryptionMode] = useState<StorageEncryptionMode>(StorageEncryptionModes.platformManaged);
  const [createKeyScope, setCreateKeyScope] = useState<StorageEncryptionKeyScope>(StorageEncryptionKeyScopes.workspace);
  const [createRetentionDays, setCreateRetentionDays] = useState("");
  const [createLabelsText, setCreateLabelsText] = useState("");
  const [createImmutableWrites, setCreateImmutableWrites] = useState(true);
  const [createAllowCrossWorkspaceReads, setCreateAllowCrossWorkspaceReads] = useState(false);
  const [createRequestBackendProvisioning, setCreateRequestBackendProvisioning] = useState(false);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  const [editDisplayName, setEditDisplayName] = useState("");
  const [editLabelsText, setEditLabelsText] = useState("");
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [isSubmittingLifecycleAction, setIsSubmittingLifecycleAction] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string>();
  const [statusMessage, setStatusMessage] = useState<string>();
  const [validationMessages, setValidationMessages] = useState<ReadonlyArray<string>>(Object.freeze([]));

  useEffect(() => {
    if (!props.selectedStorage) {
      setEditDisplayName("");
      setEditLabelsText("");
      return;
    }
    setEditDisplayName(props.selectedStorage.display.displayName);
    setEditLabelsText(
      Object.entries(props.selectedStorage.policy.labels)
        .map(([key, value]) => `${key}=${value}`)
        .join("\n"),
    );
  }, [props.selectedStorage?.storageInstanceId, props.selectedStorage?.display.displayName, props.selectedStorage?.policy.labels]);

  const canSubmitCreate = useMemo(
    () => !isSubmittingCreate && props.workspaceId.trim().length > 0,
    [isSubmittingCreate, props.workspaceId],
  );
  const lifecycleActionAvailability = useMemo(
    () => evaluateLifecycleActionAvailability(props.selectedStorage),
    [props.selectedStorage],
  );

  const clearNotices = (): void => {
    setErrorMessage(undefined);
    setStatusMessage(undefined);
    setValidationMessages(Object.freeze([]));
  };

  const submitCreate = async (): Promise<void> => {
    clearNotices();
    const labels = parseLabelRows(createLabelsText);
    if (!labels.ok) {
      setErrorMessage("Create form validation failed.");
      setValidationMessages(Object.freeze([labels.message]));
      return;
    }

    const retentionDays = parseOptionalPositiveInteger(createRetentionDays);
    if (!retentionDays.ok) {
      setErrorMessage("Create form validation failed.");
      setValidationMessages(Object.freeze([retentionDays.message]));
      return;
    }

    let request: ReturnType<typeof parseCreateStorageInstanceRequestDto>;
    try {
      request = parseCreateStorageInstanceRequestDto({
        actorUserIdentityId: props.actorUserIdentityId,
        workspaceId: props.workspaceId.trim(),
        storageInstanceId: createStorageId.trim(),
        backendType: createBackendType,
        display: {
          displayName: createDisplayName.trim(),
        },
        ownerUserIdentityId: createOwnerUserIdentityId.trim(),
        access: {
          mode: createAccessMode,
          scope: createAccessScope,
        },
        policy: {
          policyId: createPolicyId.trim(),
          retentionDays: retentionDays.value,
          immutableWrites: createImmutableWrites,
          allowCrossWorkspaceReads: createAllowCrossWorkspaceReads,
          labels: labels.value,
          encryptionMode: createEncryptionMode,
          contentEncryptionRequired: true,
          keyScope: createKeyScope,
          allowPreviewDecryption: false,
          allowWorkerDecryption: false,
          retentionExpiryAction: "none",
          encryptionProfileId: createEncryptionProfileId.trim(),
          envelopeRequired: true,
        },
      });
    } catch (error) {
      if (error instanceof StorageTransportSchemaValidationError) {
        setErrorMessage("Create form validation failed.");
        setValidationMessages(Object.freeze(error.issues.map((issue) => `${issue.path}: ${issue.message}`)));
        return;
      }
      throw error;
    }

    if (!confirmAction("Create this managed storage instance?")) {
      return;
    }

    setIsSubmittingCreate(true);
    try {
      const response = await props.service.createStorageInstance({
        workspaceId: props.workspaceId.trim(),
        storageInstanceId: request.storageInstanceId,
        backendType: request.backendType,
        display: request.display,
        ownerUserIdentityId: request.ownerUserIdentityId,
        access: request.access,
        policy: request.policy,
        requestBackendProvisioning: createRequestBackendProvisioning,
        includeCapabilities: true,
      }, props.sessionToken);
      if (!response.ok || !response.data) {
        applyApiError(response.error, setErrorMessage, setValidationMessages);
        return;
      }

      setStatusMessage(`Created storage instance '${response.data.storage.storageInstanceId}'.`);
      setCreateStorageId("");
      setCreateDisplayName("");
      setCreatePolicyId("");
      setCreateEncryptionProfileId("");
      setCreateRetentionDays("");
      setCreateLabelsText("");
      await props.onMutationComplete(response.data.storage.storageInstanceId);
    } catch {
      setErrorMessage("Unable to create storage instance.");
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const submitEdit = async (): Promise<void> => {
    if (!props.selectedStorage) {
      setErrorMessage("Select a storage instance to edit metadata.");
      return;
    }
    clearNotices();

    const labels = parseLabelRows(editLabelsText);
    if (!labels.ok) {
      setErrorMessage("Edit form validation failed.");
      setValidationMessages(Object.freeze([labels.message]));
      return;
    }

    let request: ReturnType<typeof parseUpdateStorageInstanceRequestDto>;
    try {
      request = parseUpdateStorageInstanceRequestDto({
        actorUserIdentityId: props.actorUserIdentityId,
        workspaceId: props.workspaceId.trim(),
        storageInstanceId: props.selectedStorage.storageInstanceId,
        display: {
          displayName: editDisplayName.trim(),
        },
        policy: {
          labels: labels.value,
        },
      });
    } catch (error) {
      if (error instanceof StorageTransportSchemaValidationError) {
        setErrorMessage("Edit form validation failed.");
        setValidationMessages(Object.freeze(error.issues.map((issue) => `${issue.path}: ${issue.message}`)));
        return;
      }
      throw error;
    }

    if (!confirmAction("Save storage metadata updates?")) {
      return;
    }

    setIsSubmittingEdit(true);
    try {
      const response = await props.service.updateStorageMetadata({
        workspaceId: props.workspaceId.trim(),
        storageInstanceId: request.storageInstanceId,
        display: request.display,
        policy: request.policy,
        includeCapabilities: true,
      }, props.sessionToken);
      if (!response.ok || !response.data) {
        applyApiError(response.error, setErrorMessage, setValidationMessages);
        return;
      }

      setStatusMessage(`Updated metadata for '${response.data.storage.storageInstanceId}'.`);
      await props.onMutationComplete(response.data.storage.storageInstanceId);
    } catch {
      setErrorMessage("Unable to update storage metadata.");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const submitLifecycleAction = async (action: "activate" | "deactivate"): Promise<void> => {
    if (!props.selectedStorage) {
      setErrorMessage("Select a storage instance before running lifecycle actions.");
      return;
    }

    clearNotices();
    const confirmation = createLifecycleActionConfirmation(props.selectedStorage, action);
    if (!confirmAction(confirmation)) {
      return;
    }

    setIsSubmittingLifecycleAction(true);
    try {
      const response = action === "activate"
        ? await props.service.activateStorageInstance({
          workspaceId: props.workspaceId.trim(),
          storageInstanceId: props.selectedStorage.storageInstanceId,
          includeCapabilities: true,
        }, props.sessionToken)
        : await props.service.deactivateStorageInstance({
          workspaceId: props.workspaceId.trim(),
          storageInstanceId: props.selectedStorage.storageInstanceId,
          targetLifecycleState: "suspended",
          includeCapabilities: true,
        }, props.sessionToken);

      if (!response.ok || !response.data) {
        setErrorMessage(formatLifecycleMutationError(action, response.error));
        setValidationMessages(Object.freeze(
          (response.error?.validationErrors ?? Object.freeze([]))
            .map((entry) => `${entry.path}: ${entry.message}`),
        ));
        return;
      }

      const transitionedState = response.data.storage.lifecycle.state;
      setStatusMessage(
        `${action === "activate" ? "Activated" : "Deactivated"} '${response.data.storage.storageInstanceId}' `
        + `(state: ${transitionedState}).`,
      );
      await props.onMutationComplete(response.data.storage.storageInstanceId);
    } catch {
      setErrorMessage(`Unable to ${action} storage instance.`);
    } finally {
      setIsSubmittingLifecycleAction(false);
    }
  };

  return (
    <section className="ui-card">
      <div className="ui-card__header">
        <h2 className="ui-card__title">Create and edit workflows</h2>
        <p className="ui-card__subtitle">Provision storage using policy-aware inputs and update metadata through guarded workflows.</p>
      </div>
      <div className="ui-card__body ui-stack ui-stack--sm">
        {errorMessage ? <p className="ui-storage-admin-page__alert ui-storage-admin-page__alert--error" role="alert">{errorMessage}</p> : null}
        {statusMessage ? <p className="ui-storage-admin-page__alert ui-storage-admin-page__alert--success" role="status">{statusMessage}</p> : null}
        {validationMessages.length > 0 ? (
          <ul className="ui-storage-admin-page__validation-list">
            {validationMessages.map((message) => <li key={message}>{message}</li>)}
          </ul>
        ) : null}

        <div className="ui-storage-admin-page__forms-grid">
          <label className="ui-field"><span className="ui-field__label">Workspace id</span><input className="ui-input" value={props.workspaceId} onChange={(event) => props.onWorkspaceIdChange(event.target.value)} /></label>
          <label className="ui-field"><span className="ui-field__label">Storage id</span><input className="ui-input" value={createStorageId} onChange={(event) => setCreateStorageId(event.target.value)} /></label>
          <label className="ui-field"><span className="ui-field__label">Display name</span><input className="ui-input" value={createDisplayName} onChange={(event) => setCreateDisplayName(event.target.value)} /></label>
          <label className="ui-field"><span className="ui-field__label">Owner identity</span><input className="ui-input" value={createOwnerUserIdentityId} onChange={(event) => setCreateOwnerUserIdentityId(event.target.value)} /></label>
          <label className="ui-field"><span className="ui-field__label">Backend type</span><select className="ui-select" value={createBackendType} onChange={(event) => setCreateBackendType(event.target.value as StorageBackendType)}><option value={StorageBackendTypes.managedFilesystem}>managed-filesystem</option><option value={StorageBackendTypes.objectStorage}>object-storage</option><option value={StorageBackendTypes.networkShare}>network-share</option></select></label>
          <label className="ui-field"><span className="ui-field__label">Access mode</span><select className="ui-select" value={createAccessMode} onChange={(event) => setCreateAccessMode(event.target.value as StorageAccessMode)}><option value={StorageAccessModes.readWrite}>read-write</option><option value={StorageAccessModes.readOnly}>read-only</option><option value={StorageAccessModes.appendOnly}>append-only</option></select></label>
          <label className="ui-field"><span className="ui-field__label">Access scope</span><select className="ui-select" value={createAccessScope} onChange={(event) => setCreateAccessScope(event.target.value as StorageAccessScope)}><option value={StorageAccessScopes.workspace}>workspace</option><option value={StorageAccessScopes.workspaceMembers}>workspace-members</option><option value={StorageAccessScopes.platformManaged}>platform-managed</option></select></label>
          <label className="ui-field"><span className="ui-field__label">Policy id</span><input className="ui-input" value={createPolicyId} onChange={(event) => setCreatePolicyId(event.target.value)} /></label>
          <label className="ui-field"><span className="ui-field__label">Encryption profile id</span><input className="ui-input" value={createEncryptionProfileId} onChange={(event) => setCreateEncryptionProfileId(event.target.value)} /></label>
          <label className="ui-field"><span className="ui-field__label">Encryption mode</span><select className="ui-select" value={createEncryptionMode} onChange={(event) => setCreateEncryptionMode(event.target.value as StorageEncryptionMode)}><option value={StorageEncryptionModes.platformManaged}>platform-managed</option><option value={StorageEncryptionModes.customerManaged}>customer-managed</option><option value={StorageEncryptionModes.none}>none</option></select></label>
          <label className="ui-field"><span className="ui-field__label">Key scope</span><select className="ui-select" value={createKeyScope} onChange={(event) => setCreateKeyScope(event.target.value as StorageEncryptionKeyScope)}><option value={StorageEncryptionKeyScopes.workspace}>workspace</option><option value={StorageEncryptionKeyScopes.storageInstance}>storage-instance</option><option value={StorageEncryptionKeyScopes.platform}>platform</option></select></label>
          <label className="ui-field"><span className="ui-field__label">Retention days (optional)</span><input className="ui-input" value={createRetentionDays} onChange={(event) => setCreateRetentionDays(event.target.value)} /></label>
          <label className="ui-field ui-storage-admin-page__field--full"><span className="ui-field__label">Policy labels (key=value per line)</span><textarea className="ui-input" rows={3} value={createLabelsText} onChange={(event) => setCreateLabelsText(event.target.value)} /></label>
          <label className="ui-field"><span className="ui-field__label">Edit selected display name</span><input className="ui-input" value={editDisplayName} onChange={(event) => setEditDisplayName(event.target.value)} /></label>
          <label className="ui-field ui-storage-admin-page__field--full"><span className="ui-field__label">Edit selected policy labels</span><textarea className="ui-input" rows={3} value={editLabelsText} onChange={(event) => setEditLabelsText(event.target.value)} /></label>
        </div>

        <div className="ui-storage-admin-page__checkbox-grid">
          <label className="ui-row ui-row--sm ui-settings-page__checkbox"><input className="ui-checkbox" type="checkbox" checked={createImmutableWrites} onChange={(event) => setCreateImmutableWrites(event.target.checked)} /><span className="ui-field__hint">Immutable writes</span></label>
          <label className="ui-row ui-row--sm ui-settings-page__checkbox"><input className="ui-checkbox" type="checkbox" checked={createAllowCrossWorkspaceReads} onChange={(event) => setCreateAllowCrossWorkspaceReads(event.target.checked)} /><span className="ui-field__hint">Allow cross-workspace reads</span></label>
          <label className="ui-row ui-row--sm ui-settings-page__checkbox"><input className="ui-checkbox" type="checkbox" checked={createRequestBackendProvisioning} onChange={(event) => setCreateRequestBackendProvisioning(event.target.checked)} /><span className="ui-field__hint">Request backend provisioning now</span></label>
        </div>

        <div className="ui-page__actions">
          <button type="button" className="ui-button ui-button--primary ui-button--sm" disabled={!canSubmitCreate} onClick={() => { void submitCreate(); }}>
            {isSubmittingCreate ? "Creating..." : "Create storage"}
          </button>
          <button type="button" className="ui-button ui-button--secondary ui-button--sm" disabled={!props.selectedStorage || isSubmittingEdit} onClick={() => { void submitEdit(); }}>
            {isSubmittingEdit ? "Saving..." : "Save selected metadata"}
          </button>
        </div>

        <div className="ui-stack ui-stack--2xs">
          <strong>Lifecycle actions</strong>
          {!props.selectedStorage ? (
            <p className="ui-text-secondary">Select a storage instance to review activation and deactivation actions.</p>
          ) : (
            <>
              <p className="ui-text-secondary ui-text-small">
                Current state: <strong>{props.selectedStorage.lifecycle.state}</strong>.
                Activation makes storage available for managed workloads.
                Deactivation suspends workload usage until reactivated.
              </p>
              <div className="ui-page__actions">
                {lifecycleActionAvailability.canActivate ? (
                  <button
                    type="button"
                    className="ui-button ui-button--primary ui-button--sm"
                    disabled={isSubmittingLifecycleAction}
                    onClick={() => { void submitLifecycleAction("activate"); }}
                  >
                    {isSubmittingLifecycleAction ? "Applying..." : "Activate storage"}
                  </button>
                ) : null}
                {lifecycleActionAvailability.canDeactivate ? (
                  <button
                    type="button"
                    className="ui-button ui-button--secondary ui-button--sm"
                    disabled={isSubmittingLifecycleAction}
                    onClick={() => { void submitLifecycleAction("deactivate"); }}
                  >
                    {isSubmittingLifecycleAction ? "Applying..." : "Deactivate storage"}
                  </button>
                ) : null}
              </div>
              {!lifecycleActionAvailability.canActivate && !lifecycleActionAvailability.canDeactivate ? (
                <p className="ui-text-secondary ui-text-small">
                  Lifecycle actions are unavailable for the selected storage because current access permissions and lifecycle rules do not allow activation or deactivation.
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function parseLabelRows(value: string): { readonly ok: true; readonly value: Readonly<Record<string, string>> } | { readonly ok: false; readonly message: string } {
  const rows = value.split(/\r?\n/).map((row) => row.trim()).filter((row) => row.length > 0);
  const labels: Record<string, string> = {};
  for (const row of rows) {
    const separatorIndex = row.indexOf("=");
    if (separatorIndex < 1 || separatorIndex === row.length - 1) {
      return Object.freeze({ ok: false, message: `Invalid label row '${row}'. Use key=value.` });
    }
    const key = row.slice(0, separatorIndex).trim();
    const entryValue = row.slice(separatorIndex + 1).trim();
    if (!key || !entryValue) {
      return Object.freeze({ ok: false, message: `Invalid label row '${row}'.` });
    }
    labels[key] = entryValue;
  }
  return Object.freeze({ ok: true, value: Object.freeze(labels) });
}

function parseOptionalPositiveInteger(value: string): { readonly ok: true; readonly value?: number } | { readonly ok: false; readonly message: string } {
  const normalized = value.trim();
  if (!normalized) {
    return Object.freeze({ ok: true, value: undefined });
  }
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return Object.freeze({ ok: false, message: "Expected a positive integer." });
  }
  return Object.freeze({ ok: true, value: parsed });
}

function applyApiError(
  error: StorageManagementApiError | undefined,
  setErrorMessage: (value: string | undefined) => void,
  setValidationMessages: (value: ReadonlyArray<string>) => void,
): void {
  setErrorMessage(error?.message ?? "Storage request failed.");
  setValidationMessages(Object.freeze((error?.validationErrors ?? Object.freeze([])).map((entry) => `${entry.path}: ${entry.message}`)));
}

type LifecycleActionAvailability = {
  readonly canActivate: boolean;
  readonly canDeactivate: boolean;
};

function evaluateLifecycleActionAvailability(
  storage: GetStorageInstanceDetailApiResponse["storage"] | undefined,
): LifecycleActionAvailability {
  if (!storage) {
    return Object.freeze({ canActivate: false, canDeactivate: false });
  }

  const allowedActions = new Set(storage.access.allowedActions);
  const lifecycleState = storage.lifecycle.state;
  const canActivate = allowedActions.has(StorageManagedActions.activate)
    && lifecycleCanActivate(lifecycleState);
  const canDeactivate = allowedActions.has(StorageManagedActions.deactivate)
    && lifecycleCanDeactivate(lifecycleState);
  return Object.freeze({ canActivate, canDeactivate });
}

function lifecycleCanActivate(state: GetStorageInstanceDetailApiResponse["storage"]["lifecycle"]["state"]): boolean {
  return state === StorageLifecycleStates.suspended
    || state === StorageLifecycleStates.degraded
    || state === StorageLifecycleStates.archived
    || state === StorageLifecycleStates.provisioning;
}

function lifecycleCanDeactivate(state: GetStorageInstanceDetailApiResponse["storage"]["lifecycle"]["state"]): boolean {
  return state === StorageLifecycleStates.active || state === StorageLifecycleStates.degraded;
}

function createLifecycleActionConfirmation(
  storage: GetStorageInstanceDetailApiResponse["storage"],
  action: "activate" | "deactivate",
): string {
  if (action === "activate") {
    return `Activate storage '${storage.display.displayName}' (${storage.storageInstanceId})? `
      + "This enables managed workloads and storage access checks for the instance.";
  }
  return `Deactivate storage '${storage.display.displayName}' (${storage.storageInstanceId}) to suspended state? `
    + "Managed workloads depending on this storage may stop until it is reactivated.";
}

function formatLifecycleMutationError(
  action: "activate" | "deactivate",
  error: StorageManagementApiError | undefined,
): string {
  if (!error) {
    return `Unable to ${action} storage instance.`;
  }
  if (error.code === "forbidden") {
    return `You are not authorized to ${action} this storage instance.`;
  }
  if (error.code === "not-found") {
    return "Storage instance was not found. Refresh to review the latest list.";
  }
  if (error.code === "conflict" || error.code === "invalid-state") {
    return `Cannot ${action} storage instance because server lifecycle validation rejected the transition. Refresh and retry from the latest state.`;
  }
  return error.message || `Unable to ${action} storage instance.`;
}

function confirmAction(message: string): boolean {
  const fn = (globalThis as typeof globalThis & { readonly confirm?: (prompt: string) => boolean }).confirm;
  return typeof fn === "function" ? fn(message) : true;
}

export const StorageInstanceWorkflowPanelPresentation = Object.freeze({
  evaluateLifecycleActionAvailability,
  createLifecycleActionConfirmation,
});
