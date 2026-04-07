import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type {
  GetStorageInstanceDetailApiResponse,
  GetStorageInstanceHealthApiResponse,
} from "@infrastructure/api/storage/sdk/PublicStorageManagementApiContract";
import {
  StorageBackendTypes,
  StorageLifecycleStates,
  type StorageBackendType,
  type StorageLifecycleState,
} from "@domain/storage/StorageDomain";
import { StorageSyncStatuses, type StorageSyncStatus } from "@shared/contracts/storage/StorageTransportContracts";
import type { StorageInstanceSummaryDto } from "@shared/contracts/storage/StorageTransportContracts";
import StorageInstanceWorkflowPanel from "../components/storage/StorageInstanceWorkflowPanel";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import { StorageAdministrationService } from "../services/StorageAdministrationService";
import { IdentityAuthSessionStore } from "@shared/identity/IdentityAuthSessionStore";
import type { IdentityAuthSessionStore as IdentityAuthSessionStoreContract } from "@shared/identity/IdentityAuthSessionStore";

interface StorageAdministrationPageProps {
  readonly service?: StorageAdministrationService;
  readonly sessionStore?: IdentityAuthSessionStoreContract;
}

interface StorageFilterState {
  readonly backendType: StorageBackendType | "";
  readonly lifecycleState: StorageLifecycleState | "";
}

interface StorageListInsight {
  readonly workspaceScope?: string;
  readonly policySummary?: string;
  readonly healthSummary?: string;
  readonly usabilitySummary?: string;
  readonly syncSummary?: string;
  readonly syncCapable?: boolean;
  readonly syncStatus?: StorageSyncStatus;
  readonly healthStatus?: GetStorageInstanceHealthApiResponse["operationalStatus"];
  readonly readinessState?: StorageReadinessState;
  readonly loading: boolean;
}

type StorageReadinessState = "healthy" | "degraded" | "inactive" | "unhealthy";

const defaultFilters: StorageFilterState = Object.freeze({
  backendType: "",
  lifecycleState: "",
});

export default function StorageAdministrationPage(props: StorageAdministrationPageProps = {}): JSX.Element {
  const service = useMemo(() => props.service ?? new StorageAdministrationService(), [props.service]);
  const sessionStore = useMemo(() => props.sessionStore ?? new IdentityAuthSessionStore(), [props.sessionStore]);
  const [session] = useState(() => sessionStore.getSession());
  const sessionToken = session?.sessionToken;
  const [searchParams] = useSearchParams();
  const initialWorkspaceId = normalizeWorkspaceId(searchParams.get("workspaceId")) ?? "workspace-1";
  const initialStorageInstanceId = normalizeOptional(searchParams.get("storageInstanceId"));

  const [workspaceId, setWorkspaceId] = useState(initialWorkspaceId);
  const [filters, setFilters] = useState<StorageFilterState>(defaultFilters);
  const [items, setItems] = useState<ReadonlyArray<StorageInstanceSummaryDto>>(Object.freeze([]));
  const [selectedStorageInstanceId, setSelectedStorageInstanceId] = useState<string | undefined>(initialStorageInstanceId);
  const [selectedDetail, setSelectedDetail] = useState<GetStorageInstanceDetailApiResponse["storage"]>();
  const [selectedHealth, setSelectedHealth] = useState<GetStorageInstanceHealthApiResponse>();
  const [insightsByStorageId, setInsightsByStorageId] = useState<Readonly<Record<string, StorageListInsight>>>({});
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isRefreshingInsights, setIsRefreshingInsights] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [detailErrorMessage, setDetailErrorMessage] = useState<string>();

  const selectedSummary = items.find((item) => item.storageInstanceId === selectedStorageInstanceId);

  const loadSelectionDetail = async (
    nextStorageInstanceId: string,
    targetWorkspaceId: string,
  ): Promise<void> => {
    if (!sessionToken) {
      return;
    }

    setIsLoadingDetail(true);
    setDetailErrorMessage(undefined);
    const [detailResult, healthResult] = await Promise.allSettled([
      service.getStorageInstanceDetail({
        workspaceId: targetWorkspaceId,
        storageInstanceId: nextStorageInstanceId,
        includeCapabilities: true,
      }, sessionToken),
      service.getStorageInstanceHealth({
        workspaceId: targetWorkspaceId,
        storageInstanceId: nextStorageInstanceId,
      }, sessionToken),
    ]);

    try {
      if (detailResult.status === "fulfilled" && detailResult.value.ok && detailResult.value.data) {
        setSelectedDetail(detailResult.value.data.storage);
      } else {
        setSelectedDetail(undefined);
        const message = detailResult.status === "fulfilled"
          ? detailResult.value.error?.message ?? "Unable to load storage instance detail."
          : "Storage detail request failed.";
        setDetailErrorMessage(message);
      }

      if (healthResult.status === "fulfilled" && healthResult.value.ok && healthResult.value.data) {
        setSelectedHealth(healthResult.value.data);
      } else {
        setSelectedHealth(undefined);
      }
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const loadListInsights = async (
    nextItems: ReadonlyArray<StorageInstanceSummaryDto>,
    targetWorkspaceId: string,
  ): Promise<void> => {
    if (!sessionToken || nextItems.length < 1) {
      setInsightsByStorageId({});
      return;
    }

    setIsRefreshingInsights(true);
    setInsightsByStorageId(Object.fromEntries(
      nextItems.map((item) => [item.storageInstanceId, Object.freeze({ loading: true } satisfies StorageListInsight)]),
    ));

    try {
      const entries = await Promise.all(nextItems.map(async (item) => {
        const [detailResult, healthResult] = await Promise.allSettled([
          service.getStorageInstanceDetail({
            workspaceId: targetWorkspaceId,
            storageInstanceId: item.storageInstanceId,
          }, sessionToken),
          service.getStorageInstanceHealth({
            workspaceId: targetWorkspaceId,
            storageInstanceId: item.storageInstanceId,
          }, sessionToken),
        ]);

        const detail = detailResult.status === "fulfilled" && detailResult.value.ok && detailResult.value.data
          ? detailResult.value.data.storage
          : undefined;
        const health = healthResult.status === "fulfilled" && healthResult.value.ok && healthResult.value.data
          ? healthResult.value.data
          : undefined;
        const fallbackError = detailResult.status === "rejected" || healthResult.status === "rejected";

        const insight: StorageListInsight = Object.freeze({
          workspaceScope: detail?.access.scope,
          policySummary: detail ? summarizePolicyForList(detail) : undefined,
          healthSummary: health ? summarizeHealthForList(health) : (fallbackError ? "Unavailable" : "Unavailable"),
          usabilitySummary: health ? summarizeUsabilityForList(health) : undefined,
          syncSummary: health ? summarizeSyncForList(health) : undefined,
          syncCapable: health?.synchronization.syncCapable,
          syncStatus: health?.synchronizationStatus,
          healthStatus: health?.operationalStatus,
          readinessState: health ? deriveReadinessState(health) : undefined,
          loading: false,
        });

        return [item.storageInstanceId, insight] as const;
      }));
      setInsightsByStorageId(Object.fromEntries(entries));
    } finally {
      setIsRefreshingInsights(false);
    }
  };

  const refresh = async (
    preferredStorageInstanceId?: string,
    nextFilters: StorageFilterState = filters,
  ): Promise<void> => {
    if (!sessionToken) {
      return;
    }

    const normalizedWorkspaceId = workspaceId.trim();
    if (!normalizedWorkspaceId) {
      setErrorMessage("Workspace id is required.");
      setItems(Object.freeze([]));
      setSelectedStorageInstanceId(undefined);
      setSelectedDetail(undefined);
      setSelectedHealth(undefined);
      setInsightsByStorageId({});
      return;
    }

    setIsLoadingList(true);
    setErrorMessage(undefined);
    setDetailErrorMessage(undefined);

    try {
      const response = await service.listStorageInstances({
        workspaceId: normalizedWorkspaceId,
        backendTypes: nextFilters.backendType ? Object.freeze([nextFilters.backendType]) : undefined,
        lifecycleStates: nextFilters.lifecycleState ? Object.freeze([nextFilters.lifecycleState]) : undefined,
        limit: 100,
      }, sessionToken);

      if (!response.ok || !response.data) {
        setItems(Object.freeze([]));
        setSelectedStorageInstanceId(undefined);
        setSelectedDetail(undefined);
        setSelectedHealth(undefined);
        setInsightsByStorageId({});
        setErrorMessage(response.error?.message ?? "Unable to load managed storage instances.");
        return;
      }

      setItems(response.data.items);
      const nextSelectedStorageInstanceId = preferredStorageInstanceId
        ?? (
          selectedStorageInstanceId && response.data.items.some((item) => item.storageInstanceId === selectedStorageInstanceId)
            ? selectedStorageInstanceId
            : response.data.items[0]?.storageInstanceId
        );

      setSelectedStorageInstanceId(nextSelectedStorageInstanceId);
      if (!nextSelectedStorageInstanceId) {
        setSelectedDetail(undefined);
        setSelectedHealth(undefined);
      } else {
        await loadSelectionDetail(nextSelectedStorageInstanceId, normalizedWorkspaceId);
      }
      void loadListInsights(response.data.items, normalizedWorkspaceId);
    } catch {
      setItems(Object.freeze([]));
      setSelectedStorageInstanceId(undefined);
      setSelectedDetail(undefined);
      setSelectedHealth(undefined);
      setInsightsByStorageId({});
      setErrorMessage("Managed storage request failed.");
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    if (!sessionToken) {
      return;
    }
    void refresh(initialStorageInstanceId);
  }, [sessionToken]);

  if (!sessionToken || !session || sessionStore.isSessionExpired(session)) {
    return (
      <section className="ui-page ui-storage-admin-page">
        <div className="ui-card">
          <div className="ui-card__header">
            <h1 className="ui-card__title">Managed storage administration</h1>
            <p className="ui-card__subtitle">
              Sign in with an authenticated admin account before reviewing managed storage instances and policy posture.
            </p>
          </div>
          <div className="ui-card__body">
            <Link className="ui-button ui-button--primary" to={ROUTE_PATHS.login}>Go to sign in</Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="ui-page ui-storage-admin-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Managed storage administration</h1>
          <p className="ui-page__subtitle">
            Inspect authoritative managed storage resources across backend types, lifecycle posture, policy controls, and operational health.
          </p>
        </div>
        <div className="ui-page__actions">
          <Link className="ui-button ui-button--secondary ui-button--sm" to={ROUTE_PATHS.settings}>Back to settings</Link>
          <button
            type="button"
            className="ui-button ui-button--secondary ui-button--sm"
            disabled={isLoadingList}
            onClick={() => {
              void refresh();
            }}
          >
            {isLoadingList ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {errorMessage ? <p className="ui-storage-admin-page__alert ui-storage-admin-page__alert--error" role="alert">{errorMessage}</p> : null}
      {detailErrorMessage ? <p className="ui-storage-admin-page__alert ui-storage-admin-page__alert--error" role="alert">{detailErrorMessage}</p> : null}

      <StorageInstanceWorkflowPanel
        workspaceId={workspaceId}
        onWorkspaceIdChange={setWorkspaceId}
        actorUserIdentityId={session.userIdentityId}
        sessionToken={sessionToken}
        service={service}
        selectedStorage={selectedDetail}
        onMutationComplete={(preferredStorageId) => refresh(preferredStorageId, filters)}
      />

      <section className="ui-card">
        <div className="ui-card__header">
          <h2 className="ui-card__title">List query</h2>
          <p className="ui-card__subtitle">Filter by backend and lifecycle to review the current managed storage fleet.</p>
        </div>
        <div className="ui-card__body ui-stack ui-stack--sm">
          <div className="ui-storage-admin-page__filters-grid">
            <label className="ui-field">
              <span className="ui-field__label">Workspace id</span>
              <input
                className="ui-input"
                value={workspaceId}
                onChange={(event) => setWorkspaceId(event.target.value)}
                placeholder="workspace-1"
              />
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Backend type</span>
              <select
                className="ui-select"
                value={filters.backendType}
                onChange={(event) => setFilters((current) => ({ ...current, backendType: event.target.value as StorageFilterState["backendType"] }))}
              >
                <option value="">All backend types</option>
                <option value={StorageBackendTypes.managedFilesystem}>managed-filesystem</option>
                <option value={StorageBackendTypes.objectStorage}>object-storage</option>
                <option value={StorageBackendTypes.networkShare}>network-share</option>
              </select>
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Lifecycle state</span>
              <select
                className="ui-select"
                value={filters.lifecycleState}
                onChange={(event) => setFilters((current) => ({ ...current, lifecycleState: event.target.value as StorageFilterState["lifecycleState"] }))}
              >
                <option value="">All lifecycle states</option>
                <option value={StorageLifecycleStates.provisioning}>provisioning</option>
                <option value={StorageLifecycleStates.active}>active</option>
                <option value={StorageLifecycleStates.suspended}>suspended</option>
                <option value={StorageLifecycleStates.degraded}>degraded</option>
                <option value={StorageLifecycleStates.archived}>archived</option>
                <option value={StorageLifecycleStates.deleting}>deleting</option>
                <option value={StorageLifecycleStates.deleted}>deleted</option>
                <option value={StorageLifecycleStates.failed}>failed</option>
              </select>
            </label>
          </div>
          <div className="ui-page__actions">
            <button
              type="button"
              className="ui-button ui-button--primary ui-button--sm"
              disabled={isLoadingList}
              onClick={() => {
                void refresh(undefined, filters);
              }}
            >
              {isLoadingList ? "Loading..." : "Apply filters"}
            </button>
            <button
              type="button"
              className="ui-button ui-button--secondary ui-button--sm"
              disabled={isLoadingList}
              onClick={() => {
                setFilters(defaultFilters);
                void refresh(undefined, defaultFilters);
              }}
            >
              Clear
            </button>
          </div>
        </div>
      </section>

      <div className="ui-storage-admin-page__grid">
        <section className="ui-card">
          <div className="ui-card__header">
            <h2 className="ui-card__title">Storage instances</h2>
            <p className="ui-card__subtitle">
              {isRefreshingInsights
                ? "Refreshing policy and health summaries..."
                : "Authoritative list of configured storage resources and policy posture."}
            </p>
          </div>
          <div className="ui-card__body">
            {isLoadingList && items.length === 0 ? <p className="ui-text-secondary">Loading managed storage instances...</p> : null}
            {!isLoadingList && items.length === 0 ? <p className="ui-text-secondary">No storage instances matched the current query.</p> : null}
            {items.length > 0 ? (
              <div className="ui-table-wrapper">
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Backend type</th>
                      <th scope="col">Workspace scope</th>
                      <th scope="col">Lifecycle</th>
                      <th scope="col">Health</th>
                      <th scope="col">Sync posture</th>
                      <th scope="col">Availability</th>
                      <th scope="col">Policy highlights</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const insight = insightsByStorageId[item.storageInstanceId];
                      return (
                        <tr
                          key={item.storageInstanceId}
                          className={item.storageInstanceId === selectedStorageInstanceId ? "ui-storage-admin-page__table-row--selected" : undefined}
                        >
                          <td>
                            <button
                              type="button"
                              className="ui-button ui-button--ghost ui-button--sm ui-storage-admin-page__select-button"
                              onClick={() => {
                                setSelectedStorageInstanceId(item.storageInstanceId);
                                void loadSelectionDetail(item.storageInstanceId, workspaceId.trim());
                              }}
                            >
                              {item.display.displayName}
                            </button>
                            <div className="ui-text-secondary ui-text-small">{item.storageInstanceId}</div>
                          </td>
                          <td>{item.backendType}</td>
                          <td>{insight?.loading ? "Loading..." : (insight?.workspaceScope ?? "Unavailable")}</td>
                          <td>
                            <span className={`ui-badge ${lifecycleBadgeClass(item.lifecycle.state)}`}>
                              {item.lifecycle.state}
                            </span>
                          </td>
                          <td>
                            {insight?.loading ? "Checking..." : (
                              <span className={`ui-badge ${readinessBadgeClass(insight?.readinessState, insight?.healthStatus)}`}>
                                {insight?.healthSummary ?? "Unavailable"}
                              </span>
                            )}
                          </td>
                          <td>
                            {insight?.loading ? "Checking..." : (
                              <span className={`ui-badge ${syncBadgeClass(insight?.syncCapable, insight?.syncStatus)}`}>
                                {insight?.syncSummary ?? "Unavailable"}
                              </span>
                            )}
                          </td>
                          <td>{insight?.loading ? "Checking..." : (insight?.usabilitySummary ?? "Unavailable")}</td>
                          <td>{insight?.loading ? "Loading..." : (insight?.policySummary ?? "Unavailable")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </section>

        <section className="ui-card">
          <div className="ui-card__header">
            <h2 className="ui-card__title">Storage detail</h2>
            <p className="ui-card__subtitle">Lifecycle, access posture, policy controls, and replication health for the selected instance.</p>
          </div>
          <div className="ui-card__body ui-stack ui-stack--md">
            {!selectedSummary ? <p className="ui-text-secondary">Select a storage instance to inspect detailed policy and health posture.</p> : null}
            {isLoadingDetail ? <p className="ui-text-secondary">Loading storage detail...</p> : null}
            {selectedDetail ? (
              <>
                <div className="ui-storage-admin-page__detail-grid">
                  <div>
                    <strong>Name</strong>
                    <div className="ui-text-secondary">{selectedDetail.display.displayName}</div>
                  </div>
                  <div>
                    <strong>Storage id</strong>
                    <div className="ui-text-secondary">{selectedDetail.storageInstanceId}</div>
                  </div>
                  <div>
                    <strong>Backend type</strong>
                    <div className="ui-text-secondary">{selectedDetail.backendType}</div>
                  </div>
                  <div>
                    <strong>Workspace id</strong>
                    <div className="ui-text-secondary">{selectedDetail.workspaceId}</div>
                  </div>
                  <div>
                    <strong>Workspace scope</strong>
                    <div className="ui-text-secondary">{selectedDetail.access.scope}</div>
                  </div>
                  <div>
                    <strong>Access mode</strong>
                    <div className="ui-text-secondary">{selectedDetail.access.mode}</div>
                  </div>
                  <div>
                    <strong>Lifecycle state</strong>
                    <div className="ui-text-secondary">
                      <span className={`ui-badge ${lifecycleBadgeClass(selectedDetail.lifecycle.state)}`}>
                        {selectedDetail.lifecycle.state}
                      </span>
                    </div>
                  </div>
                  <div>
                    <strong>Created</strong>
                    <div className="ui-text-secondary">{formatTimestamp(selectedDetail.lifecycle.createdAt)}</div>
                  </div>
                  <div>
                    <strong>Last modified</strong>
                    <div className="ui-text-secondary">{formatTimestamp(selectedDetail.lifecycle.lastModifiedAt)}</div>
                  </div>
                  <div>
                    <strong>Owner identity</strong>
                    <div className="ui-text-secondary">{selectedDetail.ownerUserIdentityId}</div>
                  </div>
                </div>

                <div className="ui-stack ui-stack--2xs">
                  <strong>Policy summary</strong>
                  <div className="ui-text-secondary">{summarizePolicyForList(selectedDetail)}</div>
                  <div className="ui-text-secondary ui-text-small">
                    Encryption: {selectedDetail.policy.encryptionMode}; key scope: {selectedDetail.policy.keyScope}; profile: {selectedDetail.policy.encryptionProfileId}.
                  </div>
                  <div className="ui-text-secondary ui-text-small">
                    Retention: {formatRetention(selectedDetail.policy.retentionDays, selectedDetail.policy.retentionExpiryAction)}.
                    {selectedDetail.policy.purgeGracePeriodDays ? ` Purge grace: ${selectedDetail.policy.purgeGracePeriodDays} days.` : ""}
                  </div>
                  <div className="ui-text-secondary ui-text-small">
                    Immutable writes: {selectedDetail.policy.immutableWrites ? "enabled" : "disabled"}.
                    Cross-workspace reads: {selectedDetail.policy.allowCrossWorkspaceReads ? "enabled" : "disabled"}.
                  </div>
                </div>

                <div className="ui-stack ui-stack--2xs">
                  <strong>Access and policy restrictions</strong>
                  <div className="ui-text-secondary">Decision source: {selectedDetail.access.source}</div>
                  <div className="ui-text-secondary">
                    Allowed actions: {selectedDetail.access.allowedActions.length > 0 ? selectedDetail.access.allowedActions.join(", ") : "none"}
                  </div>
                  <div className="ui-text-secondary">
                    Restricted capabilities: {formatRestrictedCapabilities(selectedDetail)}
                  </div>
                </div>

                <div className="ui-stack ui-stack--2xs">
                  <strong>Operational status</strong>
                  {selectedHealth ? (
                    <>
                      <div className="ui-text-secondary">
                        Availability: <span className={`ui-badge ${readinessBadgeClass(deriveReadinessState(selectedHealth), selectedHealth.operationalStatus)}`}>
                          {presentReadinessLabel(deriveReadinessState(selectedHealth))}
                        </span>
                      </div>
                      <div className="ui-text-secondary">
                        Operational status: <span className={`ui-badge ${healthBadgeClass(selectedHealth.operationalStatus)}`}>{selectedHealth.operationalStatus}</span>
                      </div>
                      <div className="ui-text-secondary">Usability summary: {describeUsability(selectedHealth)}</div>
                      <div className="ui-text-secondary">Health reason code: {selectedHealth.reasonCode}</div>
                      <div className="ui-text-secondary">Last checked: {formatTimestamp(selectedHealth.lastCheckedAt)}</div>
                      <div className="ui-text-secondary">
                        Notes: {selectedHealth.operationalNotes.length > 0 ? selectedHealth.operationalNotes.join(" ") : "No additional notes."}
                      </div>
                    </>
                  ) : (
                    <div className="ui-text-secondary">Health details unavailable for this selection.</div>
                  )}
                </div>

                <div className="ui-stack ui-stack--2xs">
                  <strong>Capability profile</strong>
                  {selectedHealth?.capabilities ? (
                    <>
                      <div className="ui-text-secondary">Managed lifecycle support: {yesNo(selectedHealth.capabilities.supportsManagedLifecycle)}</div>
                      <div className="ui-text-secondary">Asynchronous replication support: {yesNo(selectedHealth.capabilities.supportsAsyncReplication)}</div>
                      <div className="ui-text-secondary">Synchronous replication support: {yesNo(selectedHealth.capabilities.supportsSyncReplication)}</div>
                      <div className="ui-text-secondary">Active read-only support: {yesNo(selectedHealth.capabilities.supportsReadOnlyActive)}</div>
                      <div className="ui-text-secondary">Cross-workspace read support: {yesNo(selectedHealth.capabilities.supportsCrossWorkspaceReads)}</div>
                      <div className="ui-text-secondary">Max object size limit: {formatMaxObjectLimit(selectedHealth.capabilities.maxObjectBytesLimit)}</div>
                      <div className="ui-text-secondary">
                        Capability notes: {selectedHealth.capabilities.notes && selectedHealth.capabilities.notes.length > 0
                          ? selectedHealth.capabilities.notes.join(" ")
                          : "No additional capability notes."}
                      </div>
                    </>
                  ) : (
                    <div className="ui-text-secondary">Capability details are not available for this storage selection.</div>
                  )}
                </div>

                <div className="ui-stack ui-stack--2xs">
                  <strong>Synchronization posture</strong>
                  <div className="ui-text-secondary">
                    Sync capability: <span className={`ui-badge ${syncBadgeClass(selectedHealth?.synchronization.syncCapable, selectedHealth?.synchronizationStatus)}`}>
                      {selectedHealth ? summarizeSyncForList(selectedHealth) : "Unavailable"}
                    </span>
                  </div>
                  <div className="ui-text-secondary">
                    Sync status: <span className={`ui-badge ${syncStatusBadgeClass(selectedHealth?.synchronizationStatus)}`}>
                      {selectedHealth?.synchronizationStatus ?? "unknown"}
                    </span>
                  </div>
                  <div className="ui-text-secondary">
                    Deployment availability: {selectedHealth?.synchronization.deploymentAvailability ?? "unknown"}
                  </div>
                  <div className="ui-text-secondary">
                    Synchronization reason: {selectedHealth?.synchronization.reasonCode ?? "No additional synchronization reason."}
                  </div>
                  <div className="ui-text-secondary">Replication mode: {selectedDetail.replication.mode}</div>
                  <div className="ui-text-secondary">Last sync at: {formatTimestamp(selectedDetail.replication.lastSyncAt) ?? "n/a"}</div>
                  <div className="ui-text-secondary">Sync lag seconds: {selectedDetail.replication.syncLagSeconds ?? "n/a"}</div>
                </div>
              </>
            ) : null}
          </div>
        </section>
      </div>
    </section>
  );
}

function normalizeOptional(value: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeWorkspaceId(value: string | null): string | undefined {
  return normalizeOptional(value);
}

function summarizePolicyForList(storage: GetStorageInstanceDetailApiResponse["storage"]): string {
  const segments = [
    `encryption ${storage.policy.encryptionMode}`,
    storage.policy.immutableWrites ? "immutable writes" : "mutable writes",
    formatRetention(storage.policy.retentionDays, storage.policy.retentionExpiryAction),
  ];
  return segments.join(" | ");
}

function summarizeHealthForList(health: GetStorageInstanceHealthApiResponse): string {
  const readiness = deriveReadinessState(health);
  if (readiness === "healthy") {
    return "Healthy";
  }
  if (readiness === "degraded") {
    return "Degraded";
  }
  if (readiness === "inactive") {
    return "Inactive";
  }
  return health.operationalStatus === "unsupported" ? "Unsupported" : "Unhealthy";
}

function summarizeUsabilityForList(health: GetStorageInstanceHealthApiResponse): string {
  const readiness = deriveReadinessState(health);
  if (readiness === "healthy") {
    return "Ready";
  }
  if (readiness === "degraded") {
    return "Limited";
  }
  if (readiness === "inactive") {
    return "Not usable";
  }
  return "Blocked";
}

function summarizeSyncForList(health: GetStorageInstanceHealthApiResponse): string {
  if (!health.synchronization.syncCapable) {
    return "No sync support";
  }

  if (health.synchronization.deploymentAvailability === "configured-inactive") {
    return "Sync capable (inactive)";
  }
  if (health.synchronization.deploymentAvailability === "unavailable") {
    return "Sync unavailable";
  }

  switch (health.synchronizationStatus) {
    case StorageSyncStatuses.healthy:
      return "Sync healthy";
    case StorageSyncStatuses.running:
      return "Sync running";
    case StorageSyncStatuses.pending:
      return "Sync pending";
    case StorageSyncStatuses.degraded:
      return "Sync degraded";
    case StorageSyncStatuses.failed:
      return "Sync failed";
    case StorageSyncStatuses.disabled:
      return "Sync disabled";
    default:
      return "Sync status unknown";
  }
}

function formatRetention(retentionDays: number | undefined, expiryAction: string): string {
  if (!retentionDays) {
    return "no retention window";
  }
  return `${retentionDays} day retention (${expiryAction})`;
}

function formatRestrictedCapabilities(storage: GetStorageInstanceDetailApiResponse["storage"]): string {
  const restricted = storage.access.policyRestrictedCapabilities
    .filter((entry) => entry.restricted)
    .map((entry) => entry.capability);
  return restricted.length > 0 ? restricted.join(", ") : "none";
}

function formatTimestamp(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return new Date(parsed).toLocaleString();
}

function lifecycleBadgeClass(state: StorageLifecycleState): string {
  switch (state) {
    case StorageLifecycleStates.active:
      return "ui-badge--success";
    case StorageLifecycleStates.provisioning:
    case StorageLifecycleStates.suspended:
    case StorageLifecycleStates.degraded:
    case StorageLifecycleStates.archived:
      return "ui-badge--warning";
    case StorageLifecycleStates.deleting:
    case StorageLifecycleStates.deleted:
    case StorageLifecycleStates.failed:
      return "ui-badge--danger";
    default:
      return "ui-badge--neutral";
  }
}

function healthBadgeClass(
  operationalStatus?: GetStorageInstanceHealthApiResponse["operationalStatus"],
): string {
  switch (operationalStatus) {
    case "healthy":
      return "ui-badge--success";
    case "inactive":
    case "unsupported":
      return "ui-badge--warning";
    case "unhealthy":
      return "ui-badge--danger";
    default:
      return "ui-badge--neutral";
  }
}

function syncBadgeClass(syncCapable?: boolean, syncStatus?: StorageSyncStatus): string {
  if (!syncCapable) {
    return "ui-badge--neutral";
  }
  return syncStatusBadgeClass(syncStatus);
}

function syncStatusBadgeClass(syncStatus?: StorageSyncStatus): string {
  switch (syncStatus) {
    case StorageSyncStatuses.healthy:
      return "ui-badge--success";
    case StorageSyncStatuses.running:
    case StorageSyncStatuses.pending:
    case StorageSyncStatuses.disabled:
      return "ui-badge--warning";
    case StorageSyncStatuses.degraded:
      return "ui-badge--warning";
    case StorageSyncStatuses.failed:
      return "ui-badge--danger";
    default:
      return "ui-badge--neutral";
  }
}

function deriveReadinessState(health: GetStorageInstanceHealthApiResponse): StorageReadinessState {
  if (health.operationalStatus === "unsupported" || health.operationalStatus === "unhealthy") {
    return "unhealthy";
  }
  if (health.lifecycleState === StorageLifecycleStates.degraded) {
    return "degraded";
  }
  if (health.operationalStatus === "inactive" || health.lifecycleState !== StorageLifecycleStates.active) {
    return "inactive";
  }
  if (health.synchronization.syncCapable) {
    if (health.synchronizationStatus === StorageSyncStatuses.failed) {
      return "unhealthy";
    }
    if (health.synchronizationStatus === StorageSyncStatuses.degraded) {
      return "degraded";
    }
  }
  return "healthy";
}

function presentReadinessLabel(readiness: StorageReadinessState): string {
  switch (readiness) {
    case "healthy":
      return "Ready";
    case "degraded":
      return "Degraded";
    case "inactive":
      return "Inactive";
    default:
      return "Unavailable";
  }
}

function readinessBadgeClass(
  readiness?: StorageReadinessState,
  operationalStatus?: GetStorageInstanceHealthApiResponse["operationalStatus"],
): string {
  if (readiness === "healthy") {
    return "ui-badge--success";
  }
  if (readiness === "degraded") {
    return "ui-badge--warning";
  }
  if (readiness === "inactive") {
    return "ui-badge--warning";
  }
  return healthBadgeClass(operationalStatus);
}

function describeUsability(health: GetStorageInstanceHealthApiResponse): string {
  const readiness = deriveReadinessState(health);
  if (readiness === "healthy") {
    return "Ready for managed workloads.";
  }
  if (readiness === "degraded") {
    return "Usable with reduced reliability. Review operational notes before production use.";
  }
  if (readiness === "inactive") {
    return "Not usable because the instance is inactive.";
  }
  if (health.operationalStatus === "unsupported") {
    return "Not usable because this backend capability profile does not meet current storage requirements.";
  }
  return "Not usable because health inspection reports an operational failure.";
}

function yesNo(value: boolean): string {
  return value ? "supported" : "not supported";
}

function formatMaxObjectLimit(value?: number): string {
  if (typeof value !== "number" || value <= 0) {
    return "Not specified";
  }
  return `${value.toLocaleString()} bytes`;
}

export const StorageAdministrationPagePresentation = Object.freeze({
  summarizeHealthForList,
  summarizeUsabilityForList,
  summarizeSyncForList,
  deriveReadinessState,
  describeUsability,
  presentReadinessLabel,
});

