import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  NodeEnrollmentDecisionPanel,
  NodeEnrollmentPendingListPanel,
  NodeInventoryDetailPanel,
  NodeInventoryListPanel,
} from "../NodeTrustAdministrationPanels";
import {
  NodeApprovalStatuses,
  NodeRevocationReasons,
  NodeRevocationStates,
  NodeTrustStates,
} from "@domain/nodes/NodeTrustDomain";

const inventoryNode = Object.freeze({
  nodeId: "node:compute:1",
  nodeType: "compute" as const,
  displayName: "Compute Node 1",
  approvalStatus: NodeApprovalStatuses.approved,
  trustState: NodeTrustStates.trusted,
  enrollmentStatus: "approved" as const,
  operationalState: "active" as const,
  presenceState: "online" as const,
  capabilityProfile: Object.freeze({
    enabledCapabilities: Object.freeze(["api", "executor"]),
    supportsRemoteScheduling: true,
    maxConcurrentWorkloads: 3,
  }),
  deploymentTags: Object.freeze(["prod", "us-east"]),
  lastSeen: Object.freeze({
    lastSeenAt: "2026-04-07T10:00:00.000Z",
    heartbeatStatus: "online" as const,
    observedBy: "node-monitor",
  }),
  certificateRef: "cert:node:1",
  revocation: Object.freeze({ state: NodeRevocationStates.active }),
  enrolledAt: "2026-04-07T08:00:00.000Z",
  approvedAt: "2026-04-07T09:00:00.000Z",
});

const inventoryDetailNode = Object.freeze({
  ...inventoryNode,
  pendingEnrollmentRequestId: "request:1",
  pendingEnrollment: Object.freeze({
    requestId: "request:1",
    status: "under-review" as const,
    requestedAt: "2026-04-07T09:30:00.000Z",
    decisionNote: "Awaiting final approval",
  }),
});

const pendingEnrollment = Object.freeze({
  requestId: "request:1",
  nodeId: "node:compute:1",
  nodeType: "compute" as const,
  displayName: "Compute Node 1",
  requestedAt: "2026-04-07T09:30:00.000Z",
  status: "submitted" as const,
  capabilityProfile: inventoryNode.capabilityProfile,
  deploymentTags: inventoryNode.deploymentTags,
  hasBootstrapMaterial: true,
});

describe("NodeTrustAdministrationPanels", () => {
  it("renders desktop inventory table with row actions", () => {
    const html = renderToStaticMarkup(
      <NodeInventoryListPanel
        surface="desktop"
        nodes={Object.freeze([inventoryNode])}
        selectedNodeId="node:compute:1"
        isLoadingInventory={false}
        actorPermissionIds={Object.freeze(["node.inventory.view"])}
        onSelectNode={() => undefined}
      />,
    );

    expect(html).toContain("Compute Node 1");
    expect(html).toContain("Row actions");
    expect(html).toContain("ui-table");
  });

  it("renders thin pending enrollment cards", () => {
    const html = renderToStaticMarkup(
      <NodeEnrollmentPendingListPanel
        surface="thin-client"
        enrollments={Object.freeze([pendingEnrollment])}
        selectedRequestId={pendingEnrollment.requestId}
        isLoading={false}
        actorPermissionIds={Object.freeze(["node.enrollment.review"])}
        onSelectEnrollment={() => undefined}
      />,
    );

    expect(html).toContain("Compute Node 1");
    expect(html).toContain("status: pending-enrollment");
    expect(html).toContain("Review");
  });

  it("renders node detail revocation and approval actions", () => {
    const html = renderToStaticMarkup(
      <NodeInventoryDetailPanel
        surface="desktop"
        actorPermissionIds={Object.freeze(["node.trust.revoke", "node.enrollment.review"])}
        node={inventoryDetailNode}
        selectedNodeId={inventoryDetailNode.nodeId}
        isRevoking={false}
        revocationReason={NodeRevocationReasons.operatorAction}
        revocationNote=""
        revocationConfirmationNodeId={inventoryDetailNode.nodeId}
        onRevocationReasonChange={() => undefined}
        onRevocationNoteChange={() => undefined}
        onRevocationConfirmationNodeIdChange={() => undefined}
        onRevokeNodeTrust={() => undefined}
        onOpenEnrollmentReview={() => undefined}
      />,
    );

    expect(html).toContain("Disable node (revoke trust)");
    expect(html).toContain("Open enrollment review");
    expect(html).toContain("Certificate internals are not exposed");
  });

  it("enforces admin-lite boundary by hiding node revocation actions on thin surfaces", () => {
    const html = renderToStaticMarkup(
      <NodeInventoryDetailPanel
        surface="thin-client"
        actorPermissionIds={Object.freeze(["node.trust.revoke", "node.enrollment.review"])}
        node={inventoryDetailNode}
        selectedNodeId={inventoryDetailNode.nodeId}
        allowTrustRevocation={false}
        isRevoking={false}
        revocationReason={NodeRevocationReasons.operatorAction}
        revocationNote=""
        revocationConfirmationNodeId={inventoryDetailNode.nodeId}
        onRevocationReasonChange={() => undefined}
        onRevocationNoteChange={() => undefined}
        onRevocationConfirmationNodeIdChange={() => undefined}
        onRevokeNodeTrust={() => undefined}
        onOpenEnrollmentReview={() => undefined}
      />,
    );

    expect(html).toContain("Open enrollment review");
    expect(html).toContain("Admin-lite boundary");
    expect(html).not.toContain("Disable node (revoke trust)");
    expect(html).not.toContain("Revocation reason");
  });

  it("renders decision actions for selected pending enrollment", () => {
    const html = renderToStaticMarkup(
      <NodeEnrollmentDecisionPanel
        surface="desktop"
        actorPermissionIds={Object.freeze(["node.enrollment.review"])}
        selectedEnrollment={pendingEnrollment}
        selectedEnrollmentDetail={undefined}
        selectedRequestId={pendingEnrollment.requestId}
        decisionNote=""
        isMutating={false}
        onDecisionNoteChange={() => undefined}
        onApprove={() => undefined}
        onReject={() => undefined}
      />,
    );

    expect(html).toContain("Approve");
    expect(html).toContain("Reject");
    expect(html).toContain("Decision note");
  });
});
