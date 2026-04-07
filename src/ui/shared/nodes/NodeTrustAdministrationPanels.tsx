import { useMemo } from "react";
import {
  NodeApprovalStatuses,
  NodeEnrollmentRequestStatuses,
  NodeRevocationReasons,
  NodeRevocationStates,
  NodeTrustStates,
  type NodeRevocationReason,
} from "@domain/nodes/NodeTrustDomain";
import {
  NodeInventoryOperationalStates,
  NodeInventoryPresenceStates,
  type NodeCapabilityProfileDto,
  type NodeEnrollmentDetailDto,
  type NodeInventoryDetailDto,
  type NodeInventorySummaryDto,
  type NodePendingEnrollmentSummaryDto,
} from "@shared/contracts/nodes/NodeTrustApiContracts";
import {
  SurfaceActionButtonStrip,
  SurfaceActionList,
  SurfaceActionMenu,
  createSurfaceActionContext,
  type SurfaceActionDescriptor,
} from "@ui/shared/actions";
import { SurfaceResponsiveTableContainer } from "@ui/shared/components/shell/SurfaceResponsiveConventions";

export type NodeAdministrationSurface = "desktop" | "thin-client";

interface NodeInventoryListPanelProps {
  readonly surface: NodeAdministrationSurface;
  readonly nodes: ReadonlyArray<NodeInventorySummaryDto>;
  readonly selectedNodeId?: string;
  readonly isLoadingInventory: boolean;
  readonly actorPermissionIds: ReadonlyArray<string>;
  readonly onSelectNode: (nodeId: string) => Promise<void> | void;
}

export function NodeInventoryListPanel({
  surface,
  nodes,
  selectedNodeId,
  isLoadingInventory,
  actorPermissionIds,
  onSelectNode,
}: NodeInventoryListPanelProps): JSX.Element {
  if (nodes.length < 1) {
    return <p className="ui-text-secondary">No nodes matched the current inventory filters.</p>;
  }

  return surface === "desktop"
    ? (
      <SurfaceResponsiveTableContainer>
        <div className="ui-table-wrapper">
          <table className="ui-table ui-responsive-table__table">
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
                  <td data-label="Node">
                    <button
                      type="button"
                      className="ui-button ui-button--ghost ui-button--sm ui-node-inventory-page__select-button"
                      onClick={() => {
                        void onSelectNode(node.nodeId);
                      }}
                    >
                      {node.displayName}
                    </button>
                    <div className="ui-text-secondary ui-text-small">{node.nodeId}</div>
                  </td>
                  <td data-label="Operational"><span className={`ui-badge ${operationalStateBadgeClass(node.operationalState)}`}>{node.operationalState}</span></td>
                  <td data-label="Presence"><span className={`ui-badge ${presenceStateBadgeClass(node.presenceState)}`}>{node.presenceState}</span></td>
                  <td data-label="Approval"><span className={`ui-badge ${approvalStatusBadgeClass(node.approvalStatus)}`}>{node.approvalStatus}</span></td>
                  <td data-label="Capabilities">{formatCapabilities(node.capabilityProfile)}</td>
                  <td data-label="Last seen">{formatTimestamp(node.lastSeen?.lastSeenAt) ?? "Never"}</td>
                  <td data-label="Actions">
                    <NodeInventoryRowActions
                      surface={surface}
                      actorPermissionIds={actorPermissionIds}
                      node={node}
                      selectedNodeId={selectedNodeId}
                      isLoadingInventory={isLoadingInventory}
                      onSelectNode={onSelectNode}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SurfaceResponsiveTableContainer>
    )
    : (
      <div className="ui-stack ui-stack--xs">
        {nodes.map((node) => (
          <article key={node.nodeId} className="ui-node-admin-shared__inventory-card">
            <div className="ui-stack ui-stack--2xs">
              <strong>{node.displayName}</strong>
              <span className="ui-text-secondary ui-text-small">{node.nodeId}</span>
              <span className="ui-text-secondary ui-text-small">
                operational: {node.operationalState} | presence: {node.presenceState}
              </span>
              <span className="ui-text-secondary ui-text-small">
                approval: {node.approvalStatus} | last seen: {formatTimestamp(node.lastSeen?.lastSeenAt) ?? "never"}
              </span>
              <span className="ui-text-secondary ui-text-small">capabilities: {formatCapabilities(node.capabilityProfile)}</span>
            </div>
            <NodeInventoryRowActions
              surface={surface}
              actorPermissionIds={actorPermissionIds}
              node={node}
              selectedNodeId={selectedNodeId}
              isLoadingInventory={isLoadingInventory}
              onSelectNode={onSelectNode}
            />
          </article>
        ))}
      </div>
    );
}

interface NodeInventoryDetailPanelProps {
  readonly surface: NodeAdministrationSurface;
  readonly actorPermissionIds: ReadonlyArray<string>;
  readonly node: NodeInventoryDetailDto;
  readonly selectedNodeId?: string;
  readonly isRevoking: boolean;
  readonly revocationReason: NodeRevocationReason;
  readonly revocationNote: string;
  readonly revocationConfirmationNodeId: string;
  readonly onRevocationReasonChange: (reason: NodeRevocationReason) => void;
  readonly onRevocationNoteChange: (value: string) => void;
  readonly onRevocationConfirmationNodeIdChange: (value: string) => void;
  readonly onRevokeNodeTrust: (node: NodeInventoryDetailDto) => Promise<void> | void;
  readonly onOpenEnrollmentReview: (node: NodeInventoryDetailDto) => void;
}
export function NodeInventoryDetailPanel({
  surface,
  actorPermissionIds,
  node,
  selectedNodeId,
  isRevoking,
  revocationReason,
  revocationNote,
  revocationConfirmationNodeId,
  onRevocationReasonChange,
  onRevocationNoteChange,
  onRevocationConfirmationNodeIdChange,
  onRevokeNodeTrust,
  onOpenEnrollmentReview,
}: NodeInventoryDetailPanelProps): JSX.Element {
  const detailActionContext = useMemo(
    () => createSurfaceActionContext({
      actorPermissionIds,
      surface,
      surfaceCapabilities: Object.freeze(["inline-actions", "menu-actions", "confirmations"]),
      resource: node,
      selection: Object.freeze({ selectedNodeId }),
      meta: Object.freeze({ isRevoking, revocationConfirmationNodeId }),
    }),
    [actorPermissionIds, isRevoking, node, revocationConfirmationNodeId, selectedNodeId, surface],
  );

  const detailActions = useMemo<ReadonlyArray<SurfaceActionDescriptor>>(
    () => Object.freeze([
      {
        id: "node-detail-open-enrollment-review",
        label: "Open enrollment review",
        scope: "bulk",
        tone: "secondary",
        availability: () => {
          if (!node.pendingEnrollmentRequestId && !node.pendingEnrollment) {
            return Object.freeze({ disabled: true, disabledReason: "No pending enrollment request is associated with this node." });
          }
          return Object.freeze({});
        },
        onInvoke: () => {
          onOpenEnrollmentReview(node);
        },
      } satisfies SurfaceActionDescriptor,
      {
        id: "node-detail-revoke-trust",
        label: isRevoking ? "Disabling..." : "Disable node (revoke trust)",
        scope: "bulk",
        tone: "danger",
        requiredPermissions: Object.freeze(["node.trust.revoke"]),
        requiredSurfaceCapabilities: Object.freeze(["confirmations"]),
        telemetry: Object.freeze({
          eventName: "ui.nodeInventory.revokeTrust",
          auditCategory: "node-trust-administration",
        }),
        confirmation: Object.freeze({
          title: "Disable trusted node?",
          message: `Revoke trust for ${node.displayName} (${node.nodeId}). This disables trusted runtime participation until re-enrollment.`,
          confirmLabel: "Disable node",
          cancelLabel: "Cancel",
          tone: "danger",
        }),
        availability: () => {
          if (node.revocation.state === NodeRevocationStates.revoked || node.trustState === NodeTrustStates.revoked) {
            return Object.freeze({ disabled: true, disabledReason: "Node is already revoked." });
          }
          if (isRevoking) {
            return Object.freeze({ disabled: true, disabledReason: "A revocation request is already running." });
          }
          if (revocationConfirmationNodeId.trim() !== node.nodeId) {
            return Object.freeze({ disabled: true, disabledReason: "Type the exact node id in the confirmation field." });
          }
          return Object.freeze({});
        },
        onInvoke: async () => {
          await onRevokeNodeTrust(node);
        },
      } satisfies SurfaceActionDescriptor,
    ]),
    [isRevoking, node, onOpenEnrollmentReview, onRevokeNodeTrust, revocationConfirmationNodeId],
  );

  return (
    <div className="ui-stack ui-stack--md">
      <div className="ui-node-inventory-page__detail-grid">
        <div><strong>Display name</strong><div className="ui-text-secondary">{node.displayName}</div></div>
        <div><strong>Node id</strong><div className="ui-text-secondary">{node.nodeId}</div></div>
        <div><strong>Node type</strong><div className="ui-text-secondary">{node.nodeType}</div></div>
        <div><strong>Operational state</strong><div className="ui-text-secondary"><span className={`ui-badge ${operationalStateBadgeClass(node.operationalState)}`}>{node.operationalState}</span></div></div>
        <div><strong>Presence state</strong><div className="ui-text-secondary"><span className={`ui-badge ${presenceStateBadgeClass(node.presenceState)}`}>{node.presenceState}</span></div></div>
        <div><strong>Approval status</strong><div className="ui-text-secondary"><span className={`ui-badge ${approvalStatusBadgeClass(node.approvalStatus)}`}>{node.approvalStatus}</span></div></div>
        <div><strong>Trust state</strong><div className="ui-text-secondary">{node.trustState}</div></div>
        <div><strong>Enrollment status</strong><div className="ui-text-secondary">{node.enrollmentStatus ?? "n/a"}</div></div>
        <div><strong>Last heartbeat</strong><div className="ui-text-secondary">{formatTimestamp(node.lastSeen?.lastSeenAt) ?? "Never"}</div></div>
        <div><strong>Heartbeat state</strong><div className="ui-text-secondary">{node.lastSeen?.heartbeatStatus ?? "unknown"}</div></div>
        <div><strong>Observed by</strong><div className="ui-text-secondary">{node.lastSeen?.observedBy ?? "n/a"}</div></div>
        <div>
          <strong>Certificate</strong>
          <div className="ui-text-secondary">{node.certificateRef ?? "not assigned"}</div>
          <div className="ui-text-secondary ui-text-small">Reference only. Certificate internals are not exposed in UI.</div>
        </div>
      </div>

      <div className="ui-stack ui-stack--2xs">
        <strong>Capabilities</strong>
        <div className="ui-text-secondary">{formatCapabilities(node.capabilityProfile)}</div>
        <div className="ui-text-secondary ui-text-small">
          Remote scheduling: {node.capabilityProfile.supportsRemoteScheduling ? "enabled" : "disabled"}.
          {node.capabilityProfile.maxConcurrentWorkloads ? ` Max concurrent workloads: ${node.capabilityProfile.maxConcurrentWorkloads}.` : ""}
        </div>
      </div>

      <div className="ui-stack ui-stack--2xs">
        <strong>Deployment tags</strong>
        <div className="ui-text-secondary">{node.deploymentTags.length > 0 ? node.deploymentTags.join(", ") : "none"}</div>
      </div>

      <div className="ui-stack ui-stack--2xs">
        <strong>Revocation</strong>
        <div className="ui-text-secondary">State: {node.revocation.state}</div>
        <div className="ui-text-secondary">Reason: {node.revocation.reason ?? "n/a"}</div>
        <div className="ui-text-secondary">Note: {node.revocation.note ?? "n/a"}</div>
        <div className="ui-text-secondary">Revoked at: {formatTimestamp(node.revocation.revokedAt) ?? "n/a"}</div>
      </div>

      {node.revocation.state === NodeRevocationStates.revoked || node.trustState === NodeTrustStates.revoked
        ? <p className="ui-text-secondary">This node is already disabled through trust revocation.</p>
        : (
          <>
            <label className="ui-field">
              <span className="ui-field__label">Revocation reason</span>
              <select className="ui-select" value={revocationReason} onChange={(event) => onRevocationReasonChange(event.target.value as NodeRevocationReason)} disabled={isRevoking}>
                <option value={NodeRevocationReasons.operatorAction}>operator-action</option>
                <option value={NodeRevocationReasons.ownerRequest}>owner-request</option>
                <option value={NodeRevocationReasons.policyViolation}>policy-violation</option>
                <option value={NodeRevocationReasons.certificateCompromise}>certificate-compromise</option>
                <option value={NodeRevocationReasons.decommissioned}>decommissioned</option>
              </select>
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Administrative note (optional)</span>
              <textarea className="ui-textarea ui-node-inventory-page__revocation-note" value={revocationNote} maxLength={2000} onChange={(event) => onRevocationNoteChange(event.target.value)} placeholder="Include ticket id, incident, or operator context" disabled={isRevoking} />
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Confirmation</span>
              <input className="ui-input" value={revocationConfirmationNodeId} onChange={(event) => onRevocationConfirmationNodeIdChange(event.target.value)} placeholder={`Type ${node.nodeId} to confirm`} disabled={isRevoking} />
            </label>
          </>
        )}

      <div className="ui-page__actions">
        <SurfaceActionButtonStrip scope="bulk" actions={detailActions} context={detailActionContext} />
      </div>

      {node.pendingEnrollment ? (
        <div className="ui-stack ui-stack--2xs">
          <strong>Pending enrollment</strong>
          <div className="ui-text-secondary">Request: {node.pendingEnrollment.requestId}</div>
          <div className="ui-text-secondary">Status: {node.pendingEnrollment.status}</div>
          <div className="ui-text-secondary">Requested: {formatTimestamp(node.pendingEnrollment.requestedAt) ?? node.pendingEnrollment.requestedAt}</div>
          <div className="ui-text-secondary">Reviewed: {formatTimestamp(node.pendingEnrollment.reviewedAt) ?? "n/a"}</div>
          <div className="ui-text-secondary">Decision note: {node.pendingEnrollment.decisionNote ?? "n/a"}</div>
        </div>
      ) : null}
    </div>
  );
}

interface NodeEnrollmentPendingListPanelProps {
  readonly surface: NodeAdministrationSurface;
  readonly enrollments: ReadonlyArray<NodePendingEnrollmentSummaryDto>;
  readonly selectedRequestId?: string;
  readonly isLoading: boolean;
  readonly actorPermissionIds: ReadonlyArray<string>;
  readonly onSelectEnrollment: (requestId: string) => Promise<void> | void;
}
export function NodeEnrollmentPendingListPanel({
  surface,
  enrollments,
  selectedRequestId,
  isLoading,
  actorPermissionIds,
  onSelectEnrollment,
}: NodeEnrollmentPendingListPanelProps): JSX.Element {
  if (isLoading && enrollments.length < 1) {
    return <p className="ui-text-secondary">Loading pending enrollment requests...</p>;
  }

  if (!isLoading && enrollments.length < 1) {
    return <p className="ui-text-secondary">No pending enrollment requests.</p>;
  }

  return surface === "desktop"
    ? (
      <SurfaceResponsiveTableContainer>
        <div className="ui-table-wrapper">
          <table className="ui-table ui-responsive-table__table">
            <thead>
              <tr>
                <th scope="col">Node</th>
                <th scope="col">Type</th>
                <th scope="col">Capabilities</th>
                <th scope="col">Tags</th>
                <th scope="col">Requested</th>
                <th scope="col">Trust status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((enrollment) => (
                <tr key={enrollment.requestId} className={enrollment.requestId === selectedRequestId ? "ui-node-enrollment-review-page__table-row--selected" : undefined}>
                  <td data-label="Node">
                    <button type="button" className="ui-button ui-button--ghost ui-button--sm ui-node-enrollment-review-page__select-button" onClick={() => { void onSelectEnrollment(enrollment.requestId); }}>
                      {enrollment.displayName}
                    </button>
                    <div className="ui-text-secondary ui-text-small">{enrollment.nodeId}</div>
                  </td>
                  <td data-label="Type">{enrollment.nodeType}</td>
                  <td data-label="Capabilities">{formatCapabilitySummary(enrollment.capabilityProfile)}</td>
                  <td data-label="Tags">{formatDeploymentTags(enrollment.deploymentTags)}</td>
                  <td data-label="Requested">{formatTimestamp(enrollment.requestedAt) ?? enrollment.requestedAt}</td>
                  <td data-label="Trust status">{formatTrustStatus(enrollment.status)}</td>
                  <td data-label="Actions">
                    <NodeEnrollmentRowActions surface={surface} actorPermissionIds={actorPermissionIds} enrollment={enrollment} isLoading={isLoading} onSelectEnrollment={onSelectEnrollment} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SurfaceResponsiveTableContainer>
    )
    : (
      <div className="ui-stack ui-stack--xs">
        {enrollments.map((enrollment) => (
          <article key={enrollment.requestId} className="ui-node-admin-shared__enrollment-card">
            <div className="ui-stack ui-stack--2xs">
              <strong>{enrollment.displayName}</strong>
              <span className="ui-text-secondary ui-text-small">{enrollment.nodeId}</span>
              <span className="ui-text-secondary ui-text-small">{enrollment.nodeType}</span>
              <span className="ui-text-secondary ui-text-small">{formatCapabilitySummary(enrollment.capabilityProfile)}</span>
              <span className="ui-text-secondary ui-text-small">tags: {formatDeploymentTags(enrollment.deploymentTags)}</span>
              <span className="ui-text-secondary ui-text-small">status: {formatTrustStatus(enrollment.status)}</span>
            </div>
            <NodeEnrollmentRowActions surface={surface} actorPermissionIds={actorPermissionIds} enrollment={enrollment} isLoading={isLoading} onSelectEnrollment={onSelectEnrollment} />
          </article>
        ))}
      </div>
    );
}

interface NodeEnrollmentDecisionPanelProps {
  readonly surface: NodeAdministrationSurface;
  readonly actorPermissionIds: ReadonlyArray<string>;
  readonly selectedEnrollment?: NodePendingEnrollmentSummaryDto;
  readonly selectedEnrollmentDetail?: NodeEnrollmentDetailDto;
  readonly selectedRequestId?: string;
  readonly decisionNote: string;
  readonly isMutating: boolean;
  readonly onDecisionNoteChange: (value: string) => void;
  readonly onApprove: () => Promise<void> | void;
  readonly onReject: () => Promise<void> | void;
}

export function NodeEnrollmentDecisionPanel({
  surface,
  actorPermissionIds,
  selectedEnrollment,
  selectedEnrollmentDetail,
  selectedRequestId,
  decisionNote,
  isMutating,
  onDecisionNoteChange,
  onApprove,
  onReject,
}: NodeEnrollmentDecisionPanelProps): JSX.Element {
  const actionContext = useMemo(
    () => createSurfaceActionContext({
      actorPermissionIds,
      surface,
      surfaceCapabilities: Object.freeze(["inline-actions", "menu-actions", "confirmations"]),
      resource: selectedEnrollment,
      selection: Object.freeze({ selectedRequestId }),
      meta: Object.freeze({ isMutating }),
    }),
    [actorPermissionIds, isMutating, selectedEnrollment, selectedRequestId, surface],
  );

  const actions = useMemo<ReadonlyArray<SurfaceActionDescriptor>>(
    () => Object.freeze([
      {
        id: "node-enrollment-approve",
        label: isMutating ? "Approving..." : "Approve",
        scope: "bulk",
        tone: "primary",
        requiredPermissions: Object.freeze(["node.enrollment.review"]),
        availability: () => {
          if (!selectedRequestId) {
            return Object.freeze({ disabled: true, disabledReason: "Select a request before taking action." });
          }
          if (isMutating) {
            return Object.freeze({ disabled: true, disabledReason: "A review decision is already running." });
          }
          return Object.freeze({});
        },
        onInvoke: async () => { await onApprove(); },
      } satisfies SurfaceActionDescriptor,
      {
        id: "node-enrollment-reject",
        label: isMutating ? "Rejecting..." : "Reject",
        scope: "bulk",
        tone: "danger",
        requiredPermissions: Object.freeze(["node.enrollment.review"]),
        confirmation: Object.freeze({
          title: "Reject enrollment request?",
          message: selectedEnrollment ? `Reject ${selectedEnrollment.displayName} (${selectedEnrollment.nodeId}) enrollment request.` : "Reject selected enrollment request.",
          confirmLabel: "Reject request",
          cancelLabel: "Cancel",
          tone: "danger",
        }),
        availability: () => {
          if (!selectedRequestId) {
            return Object.freeze({ disabled: true, disabledReason: "Select a request before taking action." });
          }
          if (isMutating) {
            return Object.freeze({ disabled: true, disabledReason: "A review decision is already running." });
          }
          return Object.freeze({});
        },
        onInvoke: async () => { await onReject(); },
      } satisfies SurfaceActionDescriptor,
    ]),
    [isMutating, onApprove, onReject, selectedEnrollment, selectedRequestId],
  );

  if (!selectedEnrollment) {
    return <p className="ui-text-secondary">Select a pending request to review details and take action.</p>;
  }

  return (
    <div className="ui-stack ui-stack--sm">
      <div className="ui-node-enrollment-review-page__detail-grid">
        <div><strong>Display name</strong><div className="ui-text-secondary">{selectedEnrollment.displayName}</div></div>
        <div><strong>Node type</strong><div className="ui-text-secondary">{selectedEnrollment.nodeType}</div></div>
        <div><strong>Trust status</strong><div className="ui-text-secondary">{formatTrustStatus(selectedEnrollment.status)}</div></div>
        <div><strong>Request time</strong><div className="ui-text-secondary">{formatTimestamp(selectedEnrollment.requestedAt) ?? selectedEnrollment.requestedAt}</div></div>
        <div><strong>Capabilities</strong><div className="ui-text-secondary">{formatCapabilitySummary(selectedEnrollment.capabilityProfile)}</div></div>
        <div><strong>Deployment tags</strong><div className="ui-text-secondary">{formatDeploymentTags(selectedEnrollment.deploymentTags)}</div></div>
      </div>
      <label className="ui-field">
        <span className="ui-field__label">Decision note</span>
        <textarea className="ui-textarea ui-node-enrollment-review-page__decision-note" value={decisionNote} onChange={(event) => onDecisionNoteChange(event.target.value)} placeholder="Optional note for audit and operators" />
      </label>
      <SurfaceActionButtonStrip actions={actions} context={actionContext} scope="bulk" />
      {selectedEnrollmentDetail?.decisionNote ? <p className="ui-text-secondary ui-text-small">Latest decision note: {selectedEnrollmentDetail.decisionNote}</p> : null}
    </div>
  );
}

interface NodeInventoryRowActionsProps {
  readonly surface: NodeAdministrationSurface;
  readonly actorPermissionIds: ReadonlyArray<string>;
  readonly node: NodeInventorySummaryDto;
  readonly selectedNodeId?: string;
  readonly isLoadingInventory: boolean;
  readonly onSelectNode: (nodeId: string) => Promise<void> | void;
}

function NodeInventoryRowActions({ surface, actorPermissionIds, node, selectedNodeId, isLoadingInventory, onSelectNode }: NodeInventoryRowActionsProps): JSX.Element {
  const actionContext = useMemo(
    () => createSurfaceActionContext({
      actorPermissionIds,
      surface,
      surfaceCapabilities: Object.freeze(["menu-actions", "inline-actions"]),
      resource: node,
      selection: Object.freeze({ selectedNodeId }),
      meta: Object.freeze({ isLoadingInventory }),
    }),
    [actorPermissionIds, isLoadingInventory, node, selectedNodeId, surface],
  );

  const actions = useMemo<ReadonlyArray<SurfaceActionDescriptor>>(
    () => Object.freeze([{
      id: `node-row-inspect:${node.nodeId}`,
      label: "Inspect node",
      scope: "row",
      tone: "secondary",
      requiredPermissions: Object.freeze(["node.inventory.view"]),
      availability: () => isLoadingInventory ? Object.freeze({ disabled: true, disabledReason: "Inventory list is refreshing." }) : Object.freeze({}),
      onInvoke: async () => { await onSelectNode(node.nodeId); },
    } satisfies SurfaceActionDescriptor]),
    [isLoadingInventory, node.nodeId, onSelectNode],
  );

  return surface === "desktop"
    ? <SurfaceActionMenu triggerLabel="Row actions" actions={actions} context={actionContext} scope="row" />
    : <SurfaceActionList actions={actions} context={actionContext} scope="row" />;
}

interface NodeEnrollmentRowActionsProps {
  readonly surface: NodeAdministrationSurface;
  readonly actorPermissionIds: ReadonlyArray<string>;
  readonly enrollment: NodePendingEnrollmentSummaryDto;
  readonly isLoading: boolean;
  readonly onSelectEnrollment: (requestId: string) => Promise<void> | void;
}

function NodeEnrollmentRowActions({ surface, actorPermissionIds, enrollment, isLoading, onSelectEnrollment }: NodeEnrollmentRowActionsProps): JSX.Element {
  const actionContext = useMemo(
    () => createSurfaceActionContext({
      actorPermissionIds,
      surface,
      surfaceCapabilities: Object.freeze(["menu-actions", "inline-actions"]),
      resource: enrollment,
      meta: Object.freeze({ isLoading }),
    }),
    [actorPermissionIds, enrollment, isLoading, surface],
  );

  const actions = useMemo<ReadonlyArray<SurfaceActionDescriptor>>(
    () => Object.freeze([{
      id: `node-enrollment-review:${enrollment.requestId}`,
      label: "Review",
      scope: "row",
      tone: "secondary",
      requiredPermissions: Object.freeze(["node.enrollment.review"]),
      availability: () => isLoading ? Object.freeze({ disabled: true, disabledReason: "Pending request list is refreshing." }) : Object.freeze({}),
      onInvoke: async () => { await onSelectEnrollment(enrollment.requestId); },
    } satisfies SurfaceActionDescriptor]),
    [enrollment.requestId, isLoading, onSelectEnrollment],
  );

  return surface === "desktop"
    ? <SurfaceActionMenu triggerLabel="Actions" actions={actions} context={actionContext} scope="row" />
    : <SurfaceActionList actions={actions} context={actionContext} scope="row" />;
}

function formatCapabilities(profile: NodeCapabilityProfileDto): string {
  return profile.enabledCapabilities.length > 0 ? profile.enabledCapabilities.join(", ") : "none";
}

function formatCapabilitySummary(profile: NodeCapabilityProfileDto): string {
  const capabilityList = profile.enabledCapabilities.join(", ");
  const scheduling = profile.supportsRemoteScheduling ? "remote scheduling enabled" : "remote scheduling disabled";
  return capabilityList ? `${capabilityList} (${scheduling})` : scheduling;
}

function formatDeploymentTags(tags: ReadonlyArray<string>): string {
  return tags.length > 0 ? tags.join(", ") : "none";
}

function formatTimestamp(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleString() : value;
}

function formatTrustStatus(status: string): string {
  switch (status) {
    case NodeEnrollmentRequestStatuses.underReview:
      return "pending-enrollment (under review)";
    case NodeEnrollmentRequestStatuses.submitted:
      return "pending-enrollment (submitted)";
    case NodeEnrollmentRequestStatuses.approved:
      return "trusted (approved)";
    case NodeEnrollmentRequestStatuses.rejected:
      return "quarantined (rejected)";
    case NodeEnrollmentRequestStatuses.withdrawn:
      return "enrollment withdrawn";
    case NodeEnrollmentRequestStatuses.expired:
      return "enrollment expired";
    default:
      return status;
  }
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
