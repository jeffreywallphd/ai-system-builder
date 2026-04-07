import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  NodeApprovalStatuses,
  NodeEnrollmentRequestStatuses,
  NodeRevocationReasons,
  NodeRevocationStates,
  NodeRoleCapabilities,
  NodeTrustStates,
  type NodeRevocationReason,
  NodeTypes,
} from "@domain/nodes/NodeTrustDomain";
import {
  NodeInventoryOperationalStates,
  NodeInventoryPresenceStates,
  type NodeCapabilityProfileDto,
  type NodeInventoryDetailDto,
  type NodeInventorySummaryDto,
} from "@shared/contracts/nodes/NodeTrustApiContracts";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import { NodeInventoryService } from "../services/NodeInventoryService";
import { IdentityAuthSessionStore } from "@shared/identity/IdentityAuthSessionStore";
import type { IdentityAuthSessionStore as IdentityAuthSessionStoreContract } from "@shared/identity/IdentityAuthSessionStore";
import {
  SurfaceStatePanel,
  SurfaceStateBoundary,
  createEmptyState,
  createLoadingState,
  toDisconnectedState,
  toSurfacePresentationStateFromApiError,
  type SurfacePresentationState,
} from "../shared/components/presentation-state";
import {
  SurfaceActionButtonStrip,
  SurfaceActionMenu,
  createSurfaceActionContext,
  type SurfaceActionContext,
  type SurfaceActionDescriptor,
} from "../shared/actions";

interface NodeInventoryPageProps {
  readonly service?: NodeInventoryService;
  readonly sessionStore?: IdentityAuthSessionStoreContract;
}

interface InventoryFilterState {
  readonly nodeType: string;
  readonly approvalStatus: string;
  readonly operationalState: string;
  readonly enrollmentStatus: string;
  readonly presenceState: string;
  readonly capability: string;
  readonly deploymentTagCsv: string;
  readonly lastSeenAfter: string;
  readonly lastSeenBefore: string;
}

const defaultFilters: InventoryFilterState = Object.freeze({
  nodeType: "",
  approvalStatus: "",
  operationalState: "",
  enrollmentStatus: "",
  presenceState: "",
  capability: "",
  deploymentTagCsv: "",
  lastSeenAfter: "",
  lastSeenBefore: "",
});

export default function NodeInventoryPage(props: NodeInventoryPageProps = {}): JSX.Element {
  const navigate = useNavigate();
  const service = useMemo(() => props.service ?? new NodeInventoryService(), [props.service]);
  const sessionStore = useMemo(() => props.sessionStore ?? new IdentityAuthSessionStore(), [props.sessionStore]);
  const [session] = useState(() => sessionStore.getSession());
  const sessionToken = session?.sessionToken;

  const [filters, setFilters] = useState<InventoryFilterState>(defaultFilters);
  const [nodes, setNodes] = useState<ReadonlyArray<NodeInventorySummaryDto>>(Object.freeze([]));
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [selectedNodeDetail, setSelectedNodeDetail] = useState<NodeInventoryDetailDto>();
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [inventoryState, setInventoryState] = useState<SurfacePresentationState | undefined>(
    createLoadingState("Loading node inventory", "Loading trusted node inventory from the authoritative API."),
  );
  const [detailState, setDetailState] = useState<SurfacePresentationState | undefined>(
    createEmptyState("Select a node", "Select a node to inspect detailed trust and capability data."),
  );
  const [errorMessage, setErrorMessage] = useState<string>();
  const [statusMessage, setStatusMessage] = useState<string>();
  const [revocationReason, setRevocationReason] = useState<NodeRevocationReason>(NodeRevocationReasons.operatorAction);
  const [revocationNote, setRevocationNote] = useState("");
  const [revocationConfirmationNodeId, setRevocationConfirmationNodeId] = useState("");

  const actorPermissionIds = useMemo(
    () => Object.freeze(["node.inventory.view", "node.inventory.refresh", "node.trust.revoke"]),
    [],
  );
  const buildBaseActionContext = useCallback(
    (input: {
      readonly resource?: unknown;
      readonly selection?: unknown;
      readonly meta?: unknown;
      readonly surfaceCapabilities?: ReadonlyArray<string>;
    }): SurfaceActionContext => createSurfaceActionContext({
      actorPermissionIds,
      surface: "desktop",
      surfaceCapabilities: input.surfaceCapabilities ?? Object.freeze(["inline-actions", "menu-actions", "confirmations"]),
      resource: input.resource,
      selection: input.selection,
      meta: input.meta,
    }),
    [actorPermissionIds],
  );

  const loadDetail = async (nodeId: string): Promise<void> => {
    if (!sessionToken) {
      return;
    }
    setDetailState(createLoadingState("Loading node detail", "Loading node trust detail."));
    try {
      const detailResponse = await service.getNodeInventoryDetail({ nodeId }, sessionToken);
      if (!detailResponse.ok || !detailResponse.data) {
        setSelectedNodeDetail(undefined);
        setDetailState(toSurfacePresentationStateFromApiError(detailResponse.error, {
          fallbackTitle: "Unable to load node detail",
          fallbackMessage: "Node detail is currently unavailable.",
        }));
        return;
      }
      setSelectedNodeDetail(detailResponse.data.node);
      setDetailState(undefined);
    } catch {
      setSelectedNodeDetail(undefined);
      setDetailState(toDisconnectedState("Node detail unavailable", "Unable to reach the node inventory service."));
    }
  };

  const refresh = async (
    preferredNodeId?: string,
    nextFilters: InventoryFilterState = filters,
  ): Promise<void> => {
    if (!sessionToken) {
      return;
    }
    setIsLoadingInventory(true);
    setErrorMessage(undefined);
    if (nodes.length < 1) {
      setInventoryState(createLoadingState("Loading node inventory", "Loading trusted node inventory from the authoritative API."));
    }
    try {
      const response = await service.listNodeInventory({
        nodeTypes: toOptionalSingleValueArray(nextFilters.nodeType),
        approvalStatuses: toOptionalSingleValueArray(nextFilters.approvalStatus),
        operationalStates: toOptionalSingleValueArray(nextFilters.operationalState),
        enrollmentStatuses: toOptionalSingleValueArray(nextFilters.enrollmentStatus),
        presenceStates: toOptionalSingleValueArray(nextFilters.presenceState),
        capabilityAnyOf: toOptionalSingleValueArray(nextFilters.capability),
        deploymentTagAnyOf: parseCsv(nextFilters.deploymentTagCsv),
        lastSeenAfter: toIsoTimestamp(nextFilters.lastSeenAfter),
        lastSeenBefore: toIsoTimestamp(nextFilters.lastSeenBefore),
        limit: 200,
      }, sessionToken);

      if (!response.ok || !response.data) {
        setNodes(Object.freeze([]));
        setSelectedNodeId(undefined);
        setSelectedNodeDetail(undefined);
        setInventoryState(toSurfacePresentationStateFromApiError(response.error, {
          fallbackTitle: "Unable to load node inventory",
          fallbackMessage: "Node inventory is currently unavailable.",
        }));
        setDetailState(createEmptyState("Select a node", "Select a node to inspect detailed trust and capability data."));
        return;
      }

      setNodes(response.data.nodes);
      if (response.data.nodes.length < 1) {
        setInventoryState(createEmptyState("No nodes found", "No nodes matched the current inventory filters."));
      } else {
        setInventoryState(undefined);
      }
      const nextNodeId = preferredNodeId
        ?? (
          selectedNodeId && response.data.nodes.some((node) => node.nodeId === selectedNodeId)
            ? selectedNodeId
            : response.data.nodes[0]?.nodeId
        );
      setSelectedNodeId(nextNodeId);
      if (!nextNodeId) {
        setSelectedNodeDetail(undefined);
        setDetailState(createEmptyState("Select a node", "Select a node to inspect detailed trust and capability data."));
        return;
      }
      await loadDetail(nextNodeId);
    } catch {
      setNodes(Object.freeze([]));
      setSelectedNodeId(undefined);
      setSelectedNodeDetail(undefined);
      setInventoryState(toDisconnectedState("Node inventory unavailable", "Unable to reach the node inventory service."));
      setDetailState(createEmptyState("Select a node", "Select a node to inspect detailed trust and capability data."));
    } finally {
      setIsLoadingInventory(false);
    }
  };

  const executeNodeRevocation = useCallback(async (node: NodeInventoryDetailDto): Promise<void> => {
    if (!sessionToken) {
      return;
    }
    if (revocationConfirmationNodeId.trim() !== node.nodeId) {
      setErrorMessage("Type the exact node id to confirm revocation.");
      return;
    }
    setIsRevoking(true);
    setErrorMessage(undefined);
    setStatusMessage(undefined);
    try {
      const response = await service.revokeNodeTrust({
        nodeId: node.nodeId,
        reason: revocationReason,
        note: revocationNote.trim() || undefined,
      }, sessionToken);
      if (!response.ok || !response.data) {
        setErrorMessage(response.error?.message ?? "Unable to revoke node trust.");
        return;
      }
      setStatusMessage(
        `Revoked "${response.data.node.displayName}" at ${formatTimestamp(response.data.node.revocation.revokedAt) ?? "current time"}.`,
      );
      await refresh(node.nodeId);
    } catch {
      setErrorMessage("Node trust revocation request failed.");
    } finally {
      setIsRevoking(false);
    }
  }, [
    refresh,
    revocationConfirmationNodeId,
    revocationNote,
    revocationReason,
    service,
    sessionToken,
  ]);

  const pageActions = useMemo<ReadonlyArray<SurfaceActionDescriptor>>(
    () => Object.freeze([
      {
        id: "node-inventory-back-to-settings",
        label: "Back to settings",
        scope: "page",
        tone: "secondary",
        priority: 10,
        onInvoke: () => {
          navigate(ROUTE_PATHS.settings);
        },
      },
      {
        id: "node-inventory-refresh",
        label: isLoadingInventory ? "Refreshing..." : "Refresh",
        scope: "page",
        tone: "secondary",
        requiredPermissions: Object.freeze(["node.inventory.refresh"]),
        priority: 20,
        availability: () => (isLoadingInventory
          ? Object.freeze({ disabled: true, disabledReason: "Inventory refresh is already in progress." })
          : Object.freeze({})),
        telemetry: Object.freeze({ eventName: "ui.nodeInventory.refresh" }),
        onInvoke: async () => {
          await refresh();
        },
      },
    ]),
    [isLoadingInventory, navigate, refresh],
  );

  const pageActionContext = useMemo(
    () => buildBaseActionContext({
      selection: Object.freeze({ selectedNodeId }),
      meta: Object.freeze({ isLoadingInventory }),
    }),
    [buildBaseActionContext, isLoadingInventory, selectedNodeId],
  );

  useEffect(() => {
    if (!sessionToken) {
      return;
    }
    void refresh();
  }, [sessionToken]);

  useEffect(() => {
    setRevocationReason(NodeRevocationReasons.operatorAction);
    setRevocationNote("");
    setRevocationConfirmationNodeId("");
  }, [selectedNodeDetail?.nodeId]);

  if (!sessionToken || !session || sessionStore.isSessionExpired(session)) {
    return (
      <section className="ui-page ui-node-inventory-page">
        <SurfaceStatePanel
          state={Object.freeze({
            kind: "permission-denied",
            title: "Trusted node inventory",
            message: "Sign in with an authenticated admin account before inspecting trusted node inventory and presence status.",
          })}
          action={<Link className="ui-button ui-button--primary" to={ROUTE_PATHS.login}>Go to sign in</Link>}
        />
      </section>
    );
  }

  return (
    <section className="ui-page ui-node-inventory-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Trusted node inventory</h1>
          <p className="ui-page__subtitle">
            Browse enrolled nodes by approval, activation, and presence state. Inspect capability profiles and
            trust metadata before scheduling, revocation, or certificate lifecycle actions.
          </p>
        </div>
        <SurfaceActionButtonStrip
          actions={pageActions}
          context={pageActionContext}
          scope="page"
          className="ui-page__actions"
        />
      </div>

      {errorMessage ? <p className="ui-node-inventory-page__alert ui-node-inventory-page__alert--error" role="alert">{errorMessage}</p> : null}
      {statusMessage ? <p className="ui-node-inventory-page__alert ui-node-inventory-page__alert--success" role="status">{statusMessage}</p> : null}

      <section className="ui-card">
        <div className="ui-card__header">
          <h2 className="ui-card__title">Filters</h2>
          <p className="ui-card__subtitle">Narrow inventory by trust, approval, capability, and last-seen windows.</p>
        </div>
        <div className="ui-card__body ui-stack ui-stack--sm">
          <div className="ui-node-inventory-page__filters-grid">
            <label className="ui-field">
              <span className="ui-field__label">Operational state</span>
              <select
                className="ui-select"
                value={filters.operationalState}
                onChange={(event) => setFilters((current) => ({ ...current, operationalState: event.target.value }))}
              >
                <option value="">All</option>
                <option value={NodeInventoryOperationalStates.active}>active</option>
                <option value={NodeInventoryOperationalStates.pending}>pending</option>
                <option value={NodeInventoryOperationalStates.offline}>offline</option>
                <option value={NodeInventoryOperationalStates.revoked}>revoked</option>
                <option value={NodeInventoryOperationalStates.rejected}>rejected</option>
              </select>
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Presence state</span>
              <select
                className="ui-select"
                value={filters.presenceState}
                onChange={(event) => setFilters((current) => ({ ...current, presenceState: event.target.value }))}
              >
                <option value="">All</option>
                <option value={NodeInventoryPresenceStates.online}>online</option>
                <option value={NodeInventoryPresenceStates.degraded}>degraded</option>
                <option value={NodeInventoryPresenceStates.offline}>offline</option>
                <option value={NodeInventoryPresenceStates.unknown}>unknown</option>
              </select>
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Approval status</span>
              <select
                className="ui-select"
                value={filters.approvalStatus}
                onChange={(event) => setFilters((current) => ({ ...current, approvalStatus: event.target.value }))}
              >
                <option value="">All</option>
                <option value={NodeApprovalStatuses.pending}>pending</option>
                <option value={NodeApprovalStatuses.approved}>approved</option>
                <option value={NodeApprovalStatuses.rejected}>rejected</option>
                <option value={NodeApprovalStatuses.suspended}>suspended</option>
              </select>
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Enrollment status</span>
              <select
                className="ui-select"
                value={filters.enrollmentStatus}
                onChange={(event) => setFilters((current) => ({ ...current, enrollmentStatus: event.target.value }))}
              >
                <option value="">All</option>
                <option value={NodeEnrollmentRequestStatuses.submitted}>submitted</option>
                <option value={NodeEnrollmentRequestStatuses.underReview}>under-review</option>
                <option value={NodeEnrollmentRequestStatuses.approved}>approved</option>
                <option value={NodeEnrollmentRequestStatuses.rejected}>rejected</option>
                <option value={NodeEnrollmentRequestStatuses.withdrawn}>withdrawn</option>
                <option value={NodeEnrollmentRequestStatuses.expired}>expired</option>
              </select>
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Node type</span>
              <select
                className="ui-select"
                value={filters.nodeType}
                onChange={(event) => setFilters((current) => ({ ...current, nodeType: event.target.value }))}
              >
                <option value="">All</option>
                <option value={NodeTypes.compute}>compute</option>
                <option value={NodeTypes.hybrid}>hybrid</option>
                <option value={NodeTypes.edge}>edge</option>
              </select>
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Capability</span>
              <select
                className="ui-select"
                value={filters.capability}
                onChange={(event) => setFilters((current) => ({ ...current, capability: event.target.value }))}
              >
                <option value="">Any</option>
                <option value={NodeRoleCapabilities.api}>api</option>
                <option value={NodeRoleCapabilities.executor}>executor</option>
                <option value={NodeRoleCapabilities.scheduler}>scheduler</option>
                <option value={NodeRoleCapabilities.storageAccess}>storage-access</option>
                <option value={NodeRoleCapabilities.previewWorker}>preview-worker</option>
                <option value={NodeRoleCapabilities.ui}>ui</option>
              </select>
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Deployment tags</span>
              <input
                className="ui-input"
                value={filters.deploymentTagCsv}
                onChange={(event) => setFilters((current) => ({ ...current, deploymentTagCsv: event.target.value }))}
                placeholder="prod, us-east"
              />
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Last seen after</span>
              <input
                className="ui-input"
                type="datetime-local"
                value={filters.lastSeenAfter}
                onChange={(event) => setFilters((current) => ({ ...current, lastSeenAfter: event.target.value }))}
              />
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Last seen before</span>
              <input
                className="ui-input"
                type="datetime-local"
                value={filters.lastSeenBefore}
                onChange={(event) => setFilters((current) => ({ ...current, lastSeenBefore: event.target.value }))}
              />
            </label>
          </div>
          <div className="ui-page__actions">
            <button
              type="button"
              className="ui-button ui-button--primary ui-button--sm"
              disabled={isLoadingInventory}
              onClick={() => {
                void refresh();
              }}
            >
              {isLoadingInventory ? "Loading..." : "Apply filters"}
            </button>
            <button
              type="button"
              className="ui-button ui-button--secondary ui-button--sm"
              disabled={isLoadingInventory}
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

      <div className="ui-node-inventory-page__grid">
        <section className="ui-card">
          <div className="ui-card__header">
            <h2 className="ui-card__title">Inventory</h2>
            <p className="ui-card__subtitle">Pending, active, offline, and revoked nodes from the live trust inventory.</p>
          </div>
          <div className="ui-card__body">
            <SurfaceStateBoundary state={inventoryState}>
              <div className="ui-table-wrapper">
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th scope="col">Node</th>
                      <th scope="col">Operational</th>
                      <th scope="col">Presence</th>
                      <th scope="col">Approval</th>
                      <th scope="col">Capabilities</th>
                      <th scope="col">Last seen</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nodes.map((node) => (
                      <tr
                        key={node.nodeId}
                        className={node.nodeId === selectedNodeId ? "ui-node-inventory-page__table-row--selected" : undefined}
                      >
                        <td>
                          <button
                            type="button"
                            className="ui-button ui-button--ghost ui-button--sm ui-node-inventory-page__select-button"
                            onClick={() => {
                              setSelectedNodeId(node.nodeId);
                              setErrorMessage(undefined);
                              void loadDetail(node.nodeId);
                            }}
                          >
                            {node.displayName}
                          </button>
                          <div className="ui-text-secondary ui-text-small">{node.nodeId}</div>
                        </td>
                        <td><span className={`ui-badge ${operationalStateBadgeClass(node.operationalState)}`}>{node.operationalState}</span></td>
                        <td><span className={`ui-badge ${presenceStateBadgeClass(node.presenceState)}`}>{node.presenceState}</span></td>
                        <td><span className={`ui-badge ${approvalStatusBadgeClass(node.approvalStatus)}`}>{node.approvalStatus}</span></td>
                        <td>{formatCapabilities(node.capabilityProfile)}</td>
                        <td>{formatTimestamp(node.lastSeen?.lastSeenAt) ?? "Never"}</td>
                        <td>
                          <SurfaceActionMenu
                            triggerLabel="Row actions"
                            actions={Object.freeze([{
                              id: `node-row-inspect:${node.nodeId}`,
                              label: "Inspect node",
                              scope: "row",
                              tone: "secondary",
                              availability: () => (isLoadingInventory
                                ? Object.freeze({ disabled: true, disabledReason: "Inventory list is refreshing." })
                                : Object.freeze({})),
                              telemetry: Object.freeze({ eventName: "ui.nodeInventory.inspectRow" }),
                              onInvoke: async () => {
                                setSelectedNodeId(node.nodeId);
                                setErrorMessage(undefined);
                                await loadDetail(node.nodeId);
                              },
                            } satisfies SurfaceActionDescriptor])}
                            context={buildBaseActionContext({
                              resource: node,
                              selection: Object.freeze({ selectedNodeId }),
                              meta: Object.freeze({ isLoadingInventory }),
                              surfaceCapabilities: Object.freeze(["menu-actions"]),
                            })}
                            scope="row"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SurfaceStateBoundary>
          </div>
        </section>

        <section className="ui-card">
          <div className="ui-card__header">
            <h2 className="ui-card__title">Node detail</h2>
            <p className="ui-card__subtitle">Identity, trust state, enrollment context, capability profile, and revocation metadata.</p>
          </div>
          <div className="ui-card__body ui-stack ui-stack--md">
            <SurfaceStateBoundary state={detailState}>
              {selectedNodeDetail ? (
              <>
                <div className="ui-node-inventory-page__detail-grid">
                  <div>
                    <strong>Display name</strong>
                    <div className="ui-text-secondary">{selectedNodeDetail.displayName}</div>
                  </div>
                  <div>
                    <strong>Node id</strong>
                    <div className="ui-text-secondary">{selectedNodeDetail.nodeId}</div>
                  </div>
                  <div>
                    <strong>Node type</strong>
                    <div className="ui-text-secondary">{selectedNodeDetail.nodeType}</div>
                  </div>
                  <div>
                    <strong>Operational state</strong>
                    <div className="ui-text-secondary">
                      <span className={`ui-badge ${operationalStateBadgeClass(selectedNodeDetail.operationalState)}`}>
                        {selectedNodeDetail.operationalState}
                      </span>
                    </div>
                  </div>
                  <div>
                    <strong>Presence state</strong>
                    <div className="ui-text-secondary">
                      <span className={`ui-badge ${presenceStateBadgeClass(selectedNodeDetail.presenceState)}`}>
                        {selectedNodeDetail.presenceState}
                      </span>
                    </div>
                  </div>
                  <div>
                    <strong>Approval status</strong>
                    <div className="ui-text-secondary">
                      <span className={`ui-badge ${approvalStatusBadgeClass(selectedNodeDetail.approvalStatus)}`}>
                        {selectedNodeDetail.approvalStatus}
                      </span>
                    </div>
                  </div>
                  <div>
                    <strong>Trust state</strong>
                    <div className="ui-text-secondary">{selectedNodeDetail.trustState}</div>
                  </div>
                  <div>
                    <strong>Enrollment status</strong>
                    <div className="ui-text-secondary">{selectedNodeDetail.enrollmentStatus ?? "n/a"}</div>
                  </div>
                  <div>
                    <strong>Last seen</strong>
                    <div className="ui-text-secondary">{formatTimestamp(selectedNodeDetail.lastSeen?.lastSeenAt) ?? "Never"}</div>
                  </div>
                  <div>
                    <strong>Heartbeat</strong>
                    <div className="ui-text-secondary">{selectedNodeDetail.lastSeen?.heartbeatStatus ?? "unknown"}</div>
                  </div>
                  <div>
                    <strong>Observed by</strong>
                    <div className="ui-text-secondary">{selectedNodeDetail.lastSeen?.observedBy ?? "n/a"}</div>
                  </div>
                  <div>
                    <strong>Certificate ref</strong>
                    <div className="ui-text-secondary">{selectedNodeDetail.certificateRef ?? "not assigned"}</div>
                  </div>
                  <div>
                    <strong>Enrolled</strong>
                    <div className="ui-text-secondary">{formatTimestamp(selectedNodeDetail.enrolledAt) ?? "n/a"}</div>
                  </div>
                  <div>
                    <strong>Approved</strong>
                    <div className="ui-text-secondary">{formatTimestamp(selectedNodeDetail.approvedAt) ?? "n/a"}</div>
                  </div>
                  <div>
                    <strong>Revoked</strong>
                    <div className="ui-text-secondary">{formatTimestamp(selectedNodeDetail.revokedAt) ?? "n/a"}</div>
                  </div>
                  <div>
                    <strong>Pending request id</strong>
                    <div className="ui-text-secondary">{selectedNodeDetail.pendingEnrollmentRequestId ?? "n/a"}</div>
                  </div>
                </div>

                <div className="ui-stack ui-stack--2xs">
                  <strong>Capabilities</strong>
                  <div className="ui-text-secondary">{formatCapabilities(selectedNodeDetail.capabilityProfile)}</div>
                  <div className="ui-text-secondary ui-text-small">
                    Remote scheduling: {selectedNodeDetail.capabilityProfile.supportsRemoteScheduling ? "enabled" : "disabled"}.
                    {selectedNodeDetail.capabilityProfile.maxConcurrentWorkloads
                      ? ` Max concurrent workloads: ${selectedNodeDetail.capabilityProfile.maxConcurrentWorkloads}.`
                      : ""}
                  </div>
                </div>

                <div className="ui-stack ui-stack--2xs">
                  <strong>Deployment tags</strong>
                  <div className="ui-text-secondary">{selectedNodeDetail.deploymentTags.length > 0 ? selectedNodeDetail.deploymentTags.join(", ") : "none"}</div>
                </div>

                <div className="ui-stack ui-stack--2xs">
                  <strong>Revocation</strong>
                  <div className="ui-text-secondary">State: {selectedNodeDetail.revocation.state}</div>
                  <div className="ui-text-secondary">Reason: {selectedNodeDetail.revocation.reason ?? "n/a"}</div>
                  <div className="ui-text-secondary">Note: {selectedNodeDetail.revocation.note ?? "n/a"}</div>
                  <div className="ui-text-secondary">Revoked at: {formatTimestamp(selectedNodeDetail.revocation.revokedAt) ?? "n/a"}</div>
                </div>

                <div className="ui-stack ui-stack--2xs">
                  <strong>Trust actions</strong>
                  {selectedNodeDetail.revocation.state === NodeRevocationStates.revoked || selectedNodeDetail.trustState === NodeTrustStates.revoked
                    ? (
                      <p className="ui-text-secondary">
                        This node is already revoked and no longer treated as active.
                      </p>
                    )
                    : (
                      <>
                        <label className="ui-field">
                          <span className="ui-field__label">Revocation reason</span>
                          <select
                            className="ui-select"
                            value={revocationReason}
                            onChange={(event) => setRevocationReason(event.target.value as NodeRevocationReason)}
                            disabled={isRevoking}
                          >
                            <option value={NodeRevocationReasons.operatorAction}>operator-action</option>
                            <option value={NodeRevocationReasons.ownerRequest}>owner-request</option>
                            <option value={NodeRevocationReasons.policyViolation}>policy-violation</option>
                            <option value={NodeRevocationReasons.certificateCompromise}>certificate-compromise</option>
                            <option value={NodeRevocationReasons.decommissioned}>decommissioned</option>
                          </select>
                        </label>
                        <label className="ui-field">
                          <span className="ui-field__label">Administrative note (optional)</span>
                          <textarea
                            className="ui-textarea ui-node-inventory-page__revocation-note"
                            value={revocationNote}
                            maxLength={2000}
                            onChange={(event) => setRevocationNote(event.target.value)}
                            placeholder="Include ticket id, incident, or operator context"
                            disabled={isRevoking}
                          />
                        </label>
                        <label className="ui-field">
                          <span className="ui-field__label">Confirmation</span>
                          <input
                            className="ui-input"
                            value={revocationConfirmationNodeId}
                            onChange={(event) => setRevocationConfirmationNodeId(event.target.value)}
                            placeholder={`Type ${selectedNodeDetail.nodeId} to confirm`}
                            disabled={isRevoking}
                          />
                        </label>
                        <div className="ui-page__actions">
                          <SurfaceActionButtonStrip
                            scope="bulk"
                            actions={Object.freeze([{
                              id: "node-detail-revoke-trust",
                              label: isRevoking ? "Revoking..." : "Revoke node trust",
                              scope: "bulk",
                              tone: "danger",
                              requiredPermissions: Object.freeze(["node.trust.revoke"]),
                              requiredSurfaceCapabilities: Object.freeze(["confirmations"]),
                              telemetry: Object.freeze({
                                eventName: "ui.nodeInventory.revokeTrust",
                                auditCategory: "node-trust-administration",
                              }),
                              confirmation: Object.freeze({
                                title: "Revoke trusted node?",
                                message: `Revoke trust for ${selectedNodeDetail.displayName} (${selectedNodeDetail.nodeId}). This action is administrative and should follow your incident/change process.`,
                                confirmLabel: "Revoke node trust",
                                cancelLabel: "Cancel",
                                tone: "danger",
                              }),
                              availability: () => {
                                if (isRevoking) {
                                  return Object.freeze({ disabled: true, disabledReason: "A revocation request is already running." });
                                }
                                if (revocationConfirmationNodeId.trim() !== selectedNodeDetail.nodeId) {
                                  return Object.freeze({
                                    disabled: true,
                                    disabledReason: "Type the exact node id in the confirmation field.",
                                  });
                                }
                                return Object.freeze({});
                              },
                              onInvoke: async () => {
                                await executeNodeRevocation(selectedNodeDetail);
                              },
                            } satisfies SurfaceActionDescriptor])}
                            context={buildBaseActionContext({
                              resource: selectedNodeDetail,
                              selection: Object.freeze({ selectedNodeId }),
                              meta: Object.freeze({ isRevoking, revocationConfirmationNodeId }),
                              surfaceCapabilities: Object.freeze(["inline-actions", "confirmations"]),
                            })}
                          />
                        </div>
                        <p className="ui-text-secondary ui-text-small">
                          Revoked nodes remain visible in inventory and are blocked from active trusted participation.
                        </p>
                      </>
                    )}
                </div>

                {selectedNodeDetail.pendingEnrollment ? (
                  <div className="ui-stack ui-stack--2xs">
                    <strong>Pending enrollment</strong>
                    <div className="ui-text-secondary">Request: {selectedNodeDetail.pendingEnrollment.requestId}</div>
                    <div className="ui-text-secondary">Status: {selectedNodeDetail.pendingEnrollment.status}</div>
                    <div className="ui-text-secondary">Requested: {formatTimestamp(selectedNodeDetail.pendingEnrollment.requestedAt) ?? selectedNodeDetail.pendingEnrollment.requestedAt}</div>
                    <div className="ui-text-secondary">Reviewed: {formatTimestamp(selectedNodeDetail.pendingEnrollment.reviewedAt) ?? "n/a"}</div>
                    <div className="ui-text-secondary">Decision note: {selectedNodeDetail.pendingEnrollment.decisionNote ?? "n/a"}</div>
                  </div>
                ) : null}
              </>
              ) : null}
            </SurfaceStateBoundary>
          </div>
        </section>
      </div>
    </section>
  );
}

function toOptionalSingleValueArray<TValue extends string>(value: string): ReadonlyArray<TValue> | undefined {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  return Object.freeze([normalized as TValue]);
}

function parseCsv(value: string): ReadonlyArray<string> | undefined {
  const values = [...new Set(
    value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  )];
  return values.length > 0 ? Object.freeze(values) : undefined;
}

function toIsoTimestamp(value: string): string | undefined {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return new Date(parsed).toISOString();
}

function formatCapabilities(profile: NodeCapabilityProfileDto): string {
  if (profile.enabledCapabilities.length === 0) {
    return "none";
  }
  return profile.enabledCapabilities.join(", ");
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

function operationalStateBadgeClass(state: NodeInventorySummaryDto["operationalState"]): string {
  switch (state) {
    case NodeInventoryOperationalStates.active:
      return "ui-badge--success";
    case NodeInventoryOperationalStates.pending:
    case NodeInventoryOperationalStates.offline:
      return "ui-badge--warning";
    case NodeInventoryOperationalStates.rejected:
    case NodeInventoryOperationalStates.revoked:
      return "ui-badge--danger";
    default:
      return "ui-badge--neutral";
  }
}

function presenceStateBadgeClass(state: NodeInventorySummaryDto["presenceState"]): string {
  switch (state) {
    case NodeInventoryPresenceStates.online:
      return "ui-badge--success";
    case NodeInventoryPresenceStates.degraded:
      return "ui-badge--warning";
    case NodeInventoryPresenceStates.offline:
      return "ui-badge--danger";
    default:
      return "ui-badge--neutral";
  }
}

function approvalStatusBadgeClass(status: NodeInventorySummaryDto["approvalStatus"]): string {
  switch (status) {
    case NodeApprovalStatuses.approved:
      return "ui-badge--success";
    case NodeApprovalStatuses.pending:
    case NodeApprovalStatuses.suspended:
      return "ui-badge--warning";
    case NodeApprovalStatuses.rejected:
      return "ui-badge--danger";
    default:
      return "ui-badge--neutral";
  }
}


