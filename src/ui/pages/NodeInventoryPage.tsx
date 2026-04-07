import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  NodeApprovalStatuses,
  NodeEnrollmentRequestStatuses,
  NodeRevocationReasons,
  NodeRoleCapabilities,
  NodeTypes,
  type NodeRevocationReason,
} from "@domain/nodes/NodeTrustDomain";
import {
  NodeInventoryOperationalStates,
  NodeInventoryPresenceStates,
  type NodeInventoryDetailDto,
  type NodeInventorySummaryDto,
} from "@shared/contracts/nodes/NodeTrustApiContracts";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import { NodeInventoryService } from "../services/NodeInventoryService";
import { IdentityAuthSessionStore } from "@shared/identity/IdentityAuthSessionStore";
import type {
  IdentityAuthPersistedSession,
  IdentityAuthSessionStore as IdentityAuthSessionStoreContract,
} from "@shared/identity/IdentityAuthSessionStore";
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
  createSurfaceActionContext,
  type SurfaceActionDescriptor,
} from "../shared/actions";
import {
  NodeInventoryDetailPanel,
  NodeInventoryListPanel,
  type NodeAdministrationSurface,
} from "@ui/shared/nodes/NodeTrustAdministrationPanels";

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

  const surface = useMemo<NodeAdministrationSurface>(
    () => (session?.sessionAccessChannel === "desktop" ? "desktop" : "thin-client"),
    [session?.sessionAccessChannel],
  );

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

  const actorPermissionIds = useMemo(() => {
    const permissions = ["node.inventory.view", "node.inventory.refresh"];
    if (isNodeTrustAdminSession(session)) {
      permissions.push("node.trust.revoke", "node.enrollment.review");
    }
    return Object.freeze(permissions);
  }, [session]);

  const loadDetail = useCallback(async (nodeId: string): Promise<void> => {
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
  }, [service, sessionToken]);

  const refresh = useCallback(async (preferredNodeId?: string, nextFilters: InventoryFilterState = filters): Promise<void> => {
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
      setInventoryState(response.data.nodes.length < 1
        ? createEmptyState("No nodes found", "No nodes matched the current inventory filters.")
        : undefined);

      const nextNodeId = preferredNodeId
        ?? (selectedNodeId && response.data.nodes.some((node) => node.nodeId === selectedNodeId)
          ? selectedNodeId
          : response.data.nodes[0]?.nodeId);
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
  }, [filters, loadDetail, nodes.length, selectedNodeId, service, sessionToken]);

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
      setStatusMessage(`Disabled \"${response.data.node.displayName}\" at ${formatTimestamp(response.data.node.revocation.revokedAt) ?? "current time"}.`);
      await refresh(node.nodeId);
    } catch {
      setErrorMessage("Node trust revocation request failed.");
    } finally {
      setIsRevoking(false);
    }
  }, [refresh, revocationConfirmationNodeId, revocationNote, revocationReason, service, sessionToken]);

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
        onInvoke: async () => {
          await refresh();
        },
      },
    ]),
    [isLoadingInventory, navigate, refresh],
  );

  const pageActionContext = useMemo(
    () => createSurfaceActionContext({
      actorPermissionIds,
      surface,
      surfaceCapabilities: Object.freeze(["inline-actions", "menu-actions", "confirmations"]),
      selection: Object.freeze({ selectedNodeId }),
      meta: Object.freeze({ isLoadingInventory }),
    }),
    [actorPermissionIds, isLoadingInventory, selectedNodeId, surface],
  );

  useEffect(() => {
    if (!sessionToken) {
      return;
    }
    void refresh();
  }, [refresh, sessionToken]);

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
            trust metadata before scheduling and policy-driven node disable operations.
          </p>
        </div>
        <SurfaceActionButtonStrip actions={pageActions} context={pageActionContext} scope="page" className="ui-page__actions" />
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
              <select className="ui-select" value={filters.operationalState} onChange={(event) => setFilters((current) => ({ ...current, operationalState: event.target.value }))}>
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
              <select className="ui-select" value={filters.presenceState} onChange={(event) => setFilters((current) => ({ ...current, presenceState: event.target.value }))}>
                <option value="">All</option>
                <option value={NodeInventoryPresenceStates.online}>online</option>
                <option value={NodeInventoryPresenceStates.degraded}>degraded</option>
                <option value={NodeInventoryPresenceStates.offline}>offline</option>
                <option value={NodeInventoryPresenceStates.unknown}>unknown</option>
              </select>
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Approval status</span>
              <select className="ui-select" value={filters.approvalStatus} onChange={(event) => setFilters((current) => ({ ...current, approvalStatus: event.target.value }))}>
                <option value="">All</option>
                <option value={NodeApprovalStatuses.pending}>pending</option>
                <option value={NodeApprovalStatuses.approved}>approved</option>
                <option value={NodeApprovalStatuses.rejected}>rejected</option>
                <option value={NodeApprovalStatuses.suspended}>suspended</option>
              </select>
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Enrollment status</span>
              <select className="ui-select" value={filters.enrollmentStatus} onChange={(event) => setFilters((current) => ({ ...current, enrollmentStatus: event.target.value }))}>
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
              <select className="ui-select" value={filters.nodeType} onChange={(event) => setFilters((current) => ({ ...current, nodeType: event.target.value }))}>
                <option value="">All</option>
                <option value={NodeTypes.compute}>compute</option>
                <option value={NodeTypes.hybrid}>hybrid</option>
                <option value={NodeTypes.edge}>edge</option>
              </select>
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Capability</span>
              <select className="ui-select" value={filters.capability} onChange={(event) => setFilters((current) => ({ ...current, capability: event.target.value }))}>
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
              <input className="ui-input" value={filters.deploymentTagCsv} onChange={(event) => setFilters((current) => ({ ...current, deploymentTagCsv: event.target.value }))} placeholder="prod, us-east" />
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Last seen after</span>
              <input className="ui-input" type="datetime-local" value={filters.lastSeenAfter} onChange={(event) => setFilters((current) => ({ ...current, lastSeenAfter: event.target.value }))} />
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Last seen before</span>
              <input className="ui-input" type="datetime-local" value={filters.lastSeenBefore} onChange={(event) => setFilters((current) => ({ ...current, lastSeenBefore: event.target.value }))} />
            </label>
          </div>
          <div className="ui-page__actions">
            <button type="button" className="ui-button ui-button--primary ui-button--sm" disabled={isLoadingInventory} onClick={() => { void refresh(); }}>
              {isLoadingInventory ? "Applying..." : "Apply filters"}
            </button>
            <button type="button" className="ui-button ui-button--secondary ui-button--sm" disabled={isLoadingInventory} onClick={() => {
              const cleared = defaultFilters;
              setFilters(cleared);
              void refresh(undefined, cleared);
            }}>
              Reset
            </button>
          </div>
        </div>
      </section>

      <div className="ui-node-inventory-page__grid">
        <section className="ui-card">
          <div className="ui-card__header">
            <h2 className="ui-card__title">Inventory</h2>
            <p className="ui-card__subtitle">Operational state, capabilities, and recent heartbeat telemetry.</p>
          </div>
          <div className="ui-card__body">
            <SurfaceStateBoundary state={inventoryState}>
              <NodeInventoryListPanel
                surface={surface}
                nodes={nodes}
                selectedNodeId={selectedNodeId}
                isLoadingInventory={isLoadingInventory}
                actorPermissionIds={actorPermissionIds}
                onSelectNode={async (nodeId) => {
                  setSelectedNodeId(nodeId);
                  setErrorMessage(undefined);
                  await loadDetail(nodeId);
                }}
              />
            </SurfaceStateBoundary>
          </div>
        </section>

        <section className="ui-card">
          <div className="ui-card__header">
            <h2 className="ui-card__title">Node detail</h2>
            <p className="ui-card__subtitle">Identity, trust state, enrollment context, capability profile, and disable actions.</p>
          </div>
          <div className="ui-card__body ui-stack ui-stack--md">
            <SurfaceStateBoundary state={detailState}>
              {selectedNodeDetail ? (
                <NodeInventoryDetailPanel
                  surface={surface}
                  actorPermissionIds={actorPermissionIds}
                  node={selectedNodeDetail}
                  selectedNodeId={selectedNodeId}
                  isRevoking={isRevoking}
                  revocationReason={revocationReason}
                  revocationNote={revocationNote}
                  revocationConfirmationNodeId={revocationConfirmationNodeId}
                  onRevocationReasonChange={setRevocationReason}
                  onRevocationNoteChange={setRevocationNote}
                  onRevocationConfirmationNodeIdChange={setRevocationConfirmationNodeId}
                  onRevokeNodeTrust={executeNodeRevocation}
                  onOpenEnrollmentReview={() => {
                    navigate(ROUTE_PATHS.nodeEnrollmentReview);
                  }}
                />
              ) : null}
            </SurfaceStateBoundary>
          </div>
        </section>
      </div>
    </section>
  );
}

function isNodeTrustAdminSession(session?: IdentityAuthPersistedSession): boolean {
  const workspaceId = session?.workspaceContext?.resolvedWorkspaceId ?? session?.workspaceContext?.requestedWorkspaceId;
  const workspaceRoles = workspaceId
    ? session?.workspaceContext?.workspaces.find((workspace) => workspace.workspaceId === workspaceId)?.effectiveRoles
    : undefined;
  const fallbackRoles = session?.initialCapabilityState?.effectiveRoles ?? Object.freeze([]);
  const roles = workspaceRoles ?? fallbackRoles;
  return roles.includes("owner") || roles.includes("admin");
}

function toOptionalSingleValueArray<TValue extends string>(value: string): ReadonlyArray<TValue> | undefined {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  return Object.freeze([normalized as TValue]);
}

function parseCsv(value: string): ReadonlyArray<string> | undefined {
  const values = [...new Set(value.split(",").map((item) => item.trim()).filter((item) => item.length > 0))];
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
