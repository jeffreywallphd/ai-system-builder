import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { ApproveNodeEnrollmentUseCase } from "../../../src/application/nodes/use-cases/ApproveNodeEnrollmentUseCase";
import { GetNodeInventoryDetailUseCase } from "../../../src/application/nodes/use-cases/GetNodeInventoryDetailUseCase";
import { GetNodeEnrollmentDetailUseCase } from "../../../src/application/nodes/use-cases/GetNodeEnrollmentDetailUseCase";
import { ListNodeInventoryUseCase } from "../../../src/application/nodes/use-cases/ListNodeInventoryUseCase";
import { ListTrustedNodeInventoryUseCase } from "../../../src/application/nodes/use-cases/ListTrustedNodeInventoryUseCase";
import { RecordNodeHeartbeatUseCase } from "../../../src/application/nodes/use-cases/RecordNodeHeartbeatUseCase";
import { RegisterNodeEnrollmentRequestUseCase } from "../../../src/application/nodes/use-cases/RegisterNodeEnrollmentRequestUseCase";
import { RejectNodeEnrollmentUseCase } from "../../../src/application/nodes/use-cases/RejectNodeEnrollmentUseCase";
import { ResolveApprovedNodeRuntimeTrustMaterialUseCase } from "../../../src/application/nodes/use-cases/ResolveApprovedNodeRuntimeTrustMaterialUseCase";
import { RevokeNodeTrustUseCase } from "../../../src/application/nodes/use-cases/RevokeNodeTrustUseCase";
import { ReviewPendingNodeEnrollmentUseCase } from "../../../src/application/nodes/use-cases/ReviewPendingNodeEnrollmentUseCase";
import {
  NodeApprovalStatuses,
  NodeHeartbeatStatuses,
  NodeRevocationReasons,
  NodeRevocationStates,
  NodeRoleCapabilities,
  NodeTrustStates,
  NodeTypes,
} from "../../../src/domain/nodes/NodeTrustDomain";
import { SqliteNodeTrustPersistenceAdapter } from "../../../src/infrastructure/persistence/nodes/SqliteNodeTrustPersistenceAdapter";
import { SqliteNodeTrustAuditRecorder } from "../../../src/infrastructure/persistence/nodes/SqliteNodeTrustAuditRecorder";
import { NodeTrustBackendApi } from "../NodeTrustBackendApi";
import type {
  ITrustMaterialDistributionPort,
  PublishTrustBundleInput,
  PublishTrustBundleResult,
  ResolveRuntimeTrustMaterialPackageInput,
  ResolveRuntimeTrustMaterialPackageResult,
} from "../../../src/application/security/ports/ITrustMaterialDistributionPort";
import { ResolveRuntimeTrustMaterialPackageUseCase } from "../../../src/application/security/use-cases/ResolveRuntimeTrustMaterialPackageUseCase";

const cleanupPaths: string[] = [];
const disposers: Array<() => void> = [];

afterEach(() => {
  while (disposers.length > 0) {
    disposers.pop()?.();
  }
  while (cleanupPaths.length > 0) {
    const directory = cleanupPaths.pop();
    if (directory) {
      rmSync(directory, { recursive: true, force: true });
    }
  }
});

function createHarness(): {
  readonly backendApi: NodeTrustBackendApi;
  readonly adapter: SqliteNodeTrustPersistenceAdapter;
  readonly auditRecorder: SqliteNodeTrustAuditRecorder;
} {
  const directory = mkdtempSync(path.join(tmpdir(), "ai-loom-node-trust-backend-api-"));
  cleanupPaths.push(directory);
  const adapter = new SqliteNodeTrustPersistenceAdapter(path.join(directory, "node-trust.sqlite"));
  const auditRecorder = new SqliteNodeTrustAuditRecorder(path.join(directory, "node-trust.sqlite"));
  disposers.push(() => adapter.dispose());
  disposers.push(() => auditRecorder.dispose());
  const backendApi = new NodeTrustBackendApi({
    registerNodeEnrollmentRequestUseCase: new RegisterNodeEnrollmentRequestUseCase({
      enrollmentRequestRepository: adapter,
      auditSink: auditRecorder,
    }),
    reviewPendingNodeEnrollmentUseCase: new ReviewPendingNodeEnrollmentUseCase({
      enrollmentRequestRepository: adapter,
      auditSink: auditRecorder,
    }),
    getNodeEnrollmentDetailUseCase: new GetNodeEnrollmentDetailUseCase({
      enrollmentRequestRepository: adapter,
    }),
    getNodeInventoryDetailUseCase: new GetNodeInventoryDetailUseCase({
      nodeRepository: adapter,
      enrollmentRequestRepository: adapter,
    }),
    approveNodeEnrollmentUseCase: new ApproveNodeEnrollmentUseCase({
      enrollmentRequestRepository: adapter,
      nodeRepository: adapter,
      auditSink: auditRecorder,
    }),
    rejectNodeEnrollmentUseCase: new RejectNodeEnrollmentUseCase({
      enrollmentRequestRepository: adapter,
      nodeRepository: adapter,
      auditSink: auditRecorder,
    }),
    revokeNodeTrustUseCase: new RevokeNodeTrustUseCase({
      nodeRepository: adapter,
      auditSink: auditRecorder,
    }),
    recordNodeHeartbeatUseCase: new RecordNodeHeartbeatUseCase({
      nodeRepository: adapter,
      auditSink: auditRecorder,
    }),
    resolveApprovedNodeRuntimeTrustMaterialUseCase: new ResolveApprovedNodeRuntimeTrustMaterialUseCase({
      nodeRepository: adapter,
      runtimeTrustMaterialResolver: new ResolveRuntimeTrustMaterialPackageUseCase({
        trustMaterialDistributionPort: new StubRuntimeTrustMaterialDistributionPort(),
      }),
    }),
    listTrustedNodeInventoryUseCase: new ListTrustedNodeInventoryUseCase({
      nodeRepository: adapter,
      auditSink: auditRecorder,
    }),
    listNodeInventoryUseCase: new ListNodeInventoryUseCase({
      nodeRepository: adapter,
      enrollmentRequestRepository: adapter,
      auditSink: auditRecorder,
    }),
  });

  return Object.freeze({
    backendApi,
    adapter,
    auditRecorder,
  });
}

describe("NodeTrustBackendApi", () => {
  it("records node lifecycle audit events through the backend boundary", async () => {
    const harness = createHarness();
    const submit = await harness.backendApi.submitNodeEnrollment({
      actorUserIdentityId: "node:bootstrap:audit-1",
      nodeId: "node:compute:audit-1",
      nodeType: NodeTypes.compute,
      displayName: "Audit Node 1",
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.workflowExecution],
        supportsRemoteScheduling: true,
      },
    });
    expect(submit.ok).toBeTrue();
    if (!submit.ok || !submit.data) {
      return;
    }

    const approve = await harness.backendApi.approveNodeEnrollment({
      actorUserIdentityId: "admin:user:audit-1",
      requestId: submit.data.enrollment.requestId,
      certificate: {
        certificateRef: "cert:node:compute:audit-1:v1",
      },
    });
    expect(approve.ok).toBeTrue();
    if (!approve.ok) {
      return;
    }

    const heartbeat = await harness.backendApi.recordNodeHeartbeat({
      actorUserIdentityId: "node:compute:audit-1",
      nodeId: "node:compute:audit-1",
      heartbeatStatus: NodeHeartbeatStatuses.online,
      observedBy: "node-agent",
    });
    expect(heartbeat.ok).toBeTrue();

    const events = harness.auditRecorder.listRecent(10);
    expect(events.some((event) => event.type === "node-enrollment-requested")).toBeTrue();
    expect(events.some((event) => event.type === "node-approved")).toBeTrue();
    expect(events.some((event) => event.type === "node-heartbeat-recorded")).toBeTrue();
  });

  it("submits bootstrap enrollment requests and returns pending summaries", async () => {
    const harness = createHarness();
    const submit = await harness.backendApi.submitNodeEnrollment({
      actorUserIdentityId: "node:bootstrap:1",
      nodeId: "node:compute:1",
      nodeType: NodeTypes.compute,
      displayName: "Compute 1",
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.workflowExecution],
        supportsRemoteScheduling: true,
      },
      bootstrap: {
        trustMaterialRef: "trust-material:compute-1",
        publicKeyAlgorithm: "ed25519",
        publicKeyFingerprintSha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
      requestedAt: "2026-04-05T17:00:00.000Z",
    });

    expect(submit.ok).toBeTrue();
    if (!submit.ok || !submit.data) {
      return;
    }

    expect(submit.data.enrollment.status).toBe("submitted");
    expect(submit.data.enrollment.certificateRef).toBe("trust-material:compute-1");

    const pending = await harness.backendApi.listPendingNodeEnrollments({
      actorUserIdentityId: "admin:user:1",
    });

    expect(pending.ok).toBeTrue();
    if (!pending.ok || !pending.data) {
      return;
    }

    expect(pending.data.enrollments).toHaveLength(1);
    expect(pending.data.enrollments[0]?.nodeId).toBe("node:compute:1");
    expect(pending.data.enrollments[0]?.hasBootstrapMaterial).toBeTrue();
  });

  it("returns conflict when duplicate pending enrollment already exists", async () => {
    const harness = createHarness();

    const first = await harness.backendApi.submitNodeEnrollment({
      actorUserIdentityId: "node:bootstrap:2",
      nodeId: "node:compute:2",
      nodeType: NodeTypes.compute,
      displayName: "Compute 2",
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.workflowExecution],
        supportsRemoteScheduling: true,
      },
    });
    expect(first.ok).toBeTrue();

    const duplicate = await harness.backendApi.submitNodeEnrollment({
      actorUserIdentityId: "node:bootstrap:2",
      nodeId: "node:compute:2",
      nodeType: NodeTypes.compute,
      displayName: "Compute 2 Duplicate",
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.workflowExecution],
        supportsRemoteScheduling: true,
      },
    });

    expect(duplicate.ok).toBeFalse();
    if (duplicate.ok || !duplicate.error) {
      return;
    }

    expect(duplicate.error.code).toBe("conflict");
  });

  it("returns enrollment details and supports approval/rejection actions", async () => {
    const harness = createHarness();

    const submitted = await harness.backendApi.submitNodeEnrollment({
      actorUserIdentityId: "node:bootstrap:3",
      nodeId: "node:compute:3",
      nodeType: NodeTypes.compute,
      displayName: "Compute 3",
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.workflowExecution],
        supportsRemoteScheduling: true,
      },
    });
    expect(submitted.ok).toBeTrue();
    if (!submitted.ok || !submitted.data) {
      return;
    }

    const detail = await harness.backendApi.getNodeEnrollmentDetail({
      actorUserIdentityId: "admin:user:3",
      requestId: submitted.data.enrollment.requestId,
    });
    expect(detail.ok).toBeTrue();
    if (!detail.ok || !detail.data) {
      return;
    }
    expect(detail.data.enrollment.nodeId).toBe("node:compute:3");

    const approved = await harness.backendApi.approveNodeEnrollment({
      actorUserIdentityId: "admin:user:3",
      requestId: submitted.data.enrollment.requestId,
      decisionNote: "Approved for workflow capacity",
      certificate: {
        certificateRef: "cert:node:compute:3:v1",
        certificateAuthorityRef: "ca:internal",
        certificateThumbprint: "thumbprint-value",
      },
    });
    expect(approved.ok).toBeTrue();
    if (!approved.ok || !approved.data) {
      return;
    }
    expect(approved.data.enrollment.status).toBe("approved");
    expect(approved.data.node.trustState).toBe("trusted");
    expect(approved.data.node.certificate?.certificateRef).toBe("cert:node:compute:3:v1");
    expect((approved.data.node.certificate as Record<string, unknown>).certificateAuthorityRef).toBeUndefined();
    expect((approved.data.node.certificate as Record<string, unknown>).certificateThumbprint).toBeUndefined();

    const secondSubmission = await harness.backendApi.submitNodeEnrollment({
      actorUserIdentityId: "node:bootstrap:4",
      nodeId: "node:edge:4",
      nodeType: NodeTypes.edge,
      displayName: "Edge 4",
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.workflowExecution],
        supportsRemoteScheduling: false,
      },
    });
    expect(secondSubmission.ok).toBeTrue();
    if (!secondSubmission.ok || !secondSubmission.data) {
      return;
    }

    const rejected = await harness.backendApi.rejectNodeEnrollment({
      actorUserIdentityId: "admin:user:3",
      requestId: secondSubmission.data.enrollment.requestId,
      decisionNote: "Capacity cap reached",
    });
    expect(rejected.ok).toBeTrue();
    if (!rejected.ok || !rejected.data) {
      return;
    }
    expect(rejected.data.enrollment.status).toBe("rejected");
    expect(rejected.data.node.trustState).toBe("quarantined");
  });

  it("revokes trusted nodes and returns updated trust state", async () => {
    const harness = createHarness();
    await harness.adapter.registerNode({
      record: {
        nodeId: "node:trusted:revoke-1",
        nodeType: NodeTypes.compute,
        displayName: "Trusted Revoke 1",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        approvalStatus: NodeApprovalStatuses.approved,
        trustState: NodeTrustStates.trusted,
        certificate: {
          certificateRef: "cert:revoke-1:v1",
        },
        deploymentTags: ["inventory"],
        revocation: {
          state: NodeRevocationStates.active,
        },
        enrolledAt: "2026-04-05T17:00:00.000Z",
        approvedAt: "2026-04-05T17:05:00.000Z",
        createdAt: "2026-04-05T17:00:00.000Z",
        createdBy: "seed",
        lastModifiedAt: "2026-04-05T17:05:00.000Z",
        lastModifiedBy: "seed",
        revision: 0,
      },
      mutation: {
        operationKey: "seed-revoke-1",
        context: {
          actorUserIdentityId: "seed",
        },
      },
    });

    const revoke = await harness.backendApi.revokeNodeTrust({
      actorUserIdentityId: "admin:user:revoke-1",
      nodeId: "node:trusted:revoke-1",
      reason: NodeRevocationReasons.operatorAction,
      note: "Node retired from service.",
    });

    expect(revoke.ok).toBeTrue();
    if (!revoke.ok || !revoke.data) {
      return;
    }
    expect(revoke.data.node.trustState).toBe(NodeTrustStates.revoked);
    expect(revoke.data.node.revocation.state).toBe(NodeRevocationStates.revoked);
    expect(revoke.data.node.revocation.reason).toBe(NodeRevocationReasons.operatorAction);
    expect(revoke.data.node.revocation.note).toBe("Node retired from service.");
    expect(revoke.data.node.revokedAt).toBeDefined();
  });

  it("records heartbeat for trusted nodes and exposes last-seen in inventory queries", async () => {
    const harness = createHarness();
    await harness.adapter.registerNode({
      record: {
        nodeId: "node:trusted:presence-1",
        nodeType: NodeTypes.compute,
        displayName: "Trusted Presence 1",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        approvalStatus: NodeApprovalStatuses.approved,
        trustState: NodeTrustStates.trusted,
        certificate: {
          certificateRef: "cert:presence-1:v1",
        },
        deploymentTags: ["presence"],
        revocation: {
          state: NodeRevocationStates.active,
        },
        enrolledAt: "2026-04-05T17:00:00.000Z",
        approvedAt: "2026-04-05T17:05:00.000Z",
        createdAt: "2026-04-05T17:00:00.000Z",
        createdBy: "seed",
        lastModifiedAt: "2026-04-05T17:05:00.000Z",
        lastModifiedBy: "seed",
        revision: 0,
      },
      mutation: {
        operationKey: "seed-presence-trusted",
        context: {
          actorUserIdentityId: "seed",
        },
      },
    });

    const heartbeat = await harness.backendApi.recordNodeHeartbeat({
      actorUserIdentityId: "node:trusted:presence-1",
      nodeId: "node:trusted:presence-1",
      heartbeatStatus: NodeHeartbeatStatuses.online,
      seenAt: "2026-04-05T17:10:00.000Z",
      observedBy: "node-agent",
    });
    expect(heartbeat.ok).toBeTrue();
    if (!heartbeat.ok || !heartbeat.data) {
      return;
    }
    expect(heartbeat.data.node.lastSeen?.lastSeenAt).toBe("2026-04-05T17:10:00.000Z");
    expect(heartbeat.data.node.lastSeen?.heartbeatStatus).toBe(NodeHeartbeatStatuses.online);

    const inventory = await harness.backendApi.listTrustedNodeInventory({
      actorUserIdentityId: "admin:user:presence",
      lastSeenAfter: "2026-04-05T17:09:00.000Z",
    });
    expect(inventory.ok).toBeTrue();
    if (!inventory.ok || !inventory.data) {
      return;
    }
    expect(inventory.data.nodes).toHaveLength(1);
    expect(inventory.data.nodes[0]?.nodeId).toBe("node:trusted:presence-1");
    expect(inventory.data.nodes[0]?.lastSeen?.observedBy).toBe("node-agent");
  });

  it("returns managed runtime trust material for approved trusted node identities", async () => {
    const harness = createHarness();
    await harness.adapter.registerNode({
      record: {
        nodeId: "node:trusted:runtime-1",
        nodeType: NodeTypes.compute,
        displayName: "Trusted Runtime 1",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        approvalStatus: NodeApprovalStatuses.approved,
        trustState: NodeTrustStates.trusted,
        certificate: {
          certificateRef: "cert:runtime-1:v1",
        },
        deploymentTags: ["runtime"],
        revocation: {
          state: NodeRevocationStates.active,
        },
        enrolledAt: "2026-04-05T17:00:00.000Z",
        approvedAt: "2026-04-05T17:05:00.000Z",
        createdAt: "2026-04-05T17:00:00.000Z",
        createdBy: "seed",
        lastModifiedAt: "2026-04-05T17:05:00.000Z",
        lastModifiedBy: "seed",
        revision: 0,
      },
      mutation: {
        operationKey: "seed-runtime-trusted-1",
        context: {
          actorUserIdentityId: "seed",
        },
      },
    });

    const result = await harness.backendApi.resolveNodeRuntimeTrustMaterial({
      actorUserIdentityId: "node:trusted:runtime-1",
      nodeId: "node:trusted:runtime-1",
      includeLeafCertificate: true,
      includeCertificateChain: true,
      includeTrustBundle: true,
    });

    expect(result.ok).toBeTrue();
    if (!result.ok || !result.data) {
      return;
    }
    expect(result.data.runtimeTrustMaterial.targetKind).toBe("node");
    expect(result.data.runtimeTrustMaterial.targetReferenceId).toBe("node:trusted:runtime-1");
    expect(result.data.runtimeTrustMaterial.trustBundlePem).toContain("BEGIN CERTIFICATE");
  });

  it("rejects managed runtime trust material retrieval for unapproved nodes", async () => {
    const harness = createHarness();
    await harness.adapter.registerNode({
      record: {
        nodeId: "node:pending:runtime-1",
        nodeType: NodeTypes.compute,
        displayName: "Pending Runtime 1",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        approvalStatus: NodeApprovalStatuses.pending,
        trustState: NodeTrustStates.pendingApproval,
        certificate: {
          certificateRef: "cert:runtime-pending-1:v1",
        },
        deploymentTags: ["runtime"],
        revocation: {
          state: NodeRevocationStates.active,
        },
        enrolledAt: "2026-04-05T17:00:00.000Z",
        createdAt: "2026-04-05T17:00:00.000Z",
        createdBy: "seed",
        lastModifiedAt: "2026-04-05T17:00:00.000Z",
        lastModifiedBy: "seed",
        revision: 0,
      },
      mutation: {
        operationKey: "seed-runtime-pending-1",
        context: {
          actorUserIdentityId: "seed",
        },
      },
    });

    const result = await harness.backendApi.resolveNodeRuntimeTrustMaterial({
      actorUserIdentityId: "node:pending:runtime-1",
      nodeId: "node:pending:runtime-1",
      includeTrustBundle: true,
    });

    expect(result.ok).toBeFalse();
    if (result.ok || !result.error) {
      return;
    }
    expect(result.error.code).toBe("conflict");
  });

  it("rejects heartbeat updates from unknown, pending, rejected, and revoked nodes", async () => {
    const harness = createHarness();

    const unknown = await harness.backendApi.recordNodeHeartbeat({
      actorUserIdentityId: "node:missing",
      nodeId: "node:missing",
      heartbeatStatus: NodeHeartbeatStatuses.online,
    });
    expect(unknown.ok).toBeFalse();
    if (!unknown.ok && unknown.error) {
      expect(unknown.error.code).toBe("not-found");
    }

    await harness.adapter.registerNode({
      record: {
        nodeId: "node:pending:presence-1",
        nodeType: NodeTypes.compute,
        displayName: "Pending Presence 1",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        approvalStatus: NodeApprovalStatuses.pending,
        trustState: NodeTrustStates.pendingApproval,
        deploymentTags: ["presence"],
        revocation: {
          state: NodeRevocationStates.active,
        },
        enrolledAt: "2026-04-05T17:00:00.000Z",
        createdAt: "2026-04-05T17:00:00.000Z",
        createdBy: "seed",
        lastModifiedAt: "2026-04-05T17:00:00.000Z",
        lastModifiedBy: "seed",
        revision: 0,
      },
      mutation: {
        operationKey: "seed-presence-pending",
        context: {
          actorUserIdentityId: "seed",
        },
      },
    });

    const nonTrusted = await harness.backendApi.recordNodeHeartbeat({
      actorUserIdentityId: "node:pending:presence-1",
      nodeId: "node:pending:presence-1",
      heartbeatStatus: NodeHeartbeatStatuses.online,
    });
    expect(nonTrusted.ok).toBeFalse();
    if (!nonTrusted.ok && nonTrusted.error) {
      expect(nonTrusted.error.code).toBe("conflict");
    }

    await harness.adapter.registerNode({
      record: {
        nodeId: "node:rejected:presence-1",
        nodeType: NodeTypes.compute,
        displayName: "Rejected Presence 1",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        approvalStatus: NodeApprovalStatuses.rejected,
        trustState: NodeTrustStates.quarantined,
        deploymentTags: ["presence"],
        revocation: {
          state: NodeRevocationStates.active,
        },
        enrolledAt: "2026-04-05T17:00:00.000Z",
        createdAt: "2026-04-05T17:00:00.000Z",
        createdBy: "seed",
        lastModifiedAt: "2026-04-05T17:00:00.000Z",
        lastModifiedBy: "seed",
        revision: 0,
      },
      mutation: {
        operationKey: "seed-presence-rejected",
        context: {
          actorUserIdentityId: "seed",
        },
      },
    });

    const rejected = await harness.backendApi.recordNodeHeartbeat({
      actorUserIdentityId: "node:rejected:presence-1",
      nodeId: "node:rejected:presence-1",
      heartbeatStatus: NodeHeartbeatStatuses.online,
    });
    expect(rejected.ok).toBeFalse();
    if (!rejected.ok && rejected.error) {
      expect(rejected.error.code).toBe("conflict");
    }

    await harness.adapter.registerNode({
      record: {
        nodeId: "node:revoked:presence-1",
        nodeType: NodeTypes.compute,
        displayName: "Revoked Presence 1",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        approvalStatus: NodeApprovalStatuses.rejected,
        trustState: NodeTrustStates.revoked,
        deploymentTags: ["presence"],
        revocation: {
          state: NodeRevocationStates.revoked,
        },
        enrolledAt: "2026-04-05T17:00:00.000Z",
        revokedAt: "2026-04-05T17:20:00.000Z",
        createdAt: "2026-04-05T17:00:00.000Z",
        createdBy: "seed",
        lastModifiedAt: "2026-04-05T17:20:00.000Z",
        lastModifiedBy: "seed",
        revision: 0,
      },
      mutation: {
        operationKey: "seed-presence-revoked",
        context: {
          actorUserIdentityId: "seed",
        },
      },
    });

    const revoked = await harness.backendApi.recordNodeHeartbeat({
      actorUserIdentityId: "node:revoked:presence-1",
      nodeId: "node:revoked:presence-1",
      heartbeatStatus: NodeHeartbeatStatuses.online,
    });
    expect(revoked.ok).toBeFalse();
    if (!revoked.ok && revoked.error) {
      expect(revoked.error.code).toBe("conflict");
    }
  });

  it("lists admin inventory and returns node inventory detail including pending enrollment context", async () => {
    const harness = createHarness();
    await harness.backendApi.submitNodeEnrollment({
      actorUserIdentityId: "node:bootstrap:pending-1",
      nodeId: "node:pending:inventory-1",
      nodeType: NodeTypes.hybrid,
      displayName: "Pending Inventory 1",
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.executor],
        supportsRemoteScheduling: true,
      },
      deploymentTags: ["inventory"],
      requestedAt: "2026-04-05T17:30:00.000Z",
    });

    await harness.adapter.registerNode({
      record: {
        nodeId: "node:trusted:offline-1",
        nodeType: NodeTypes.compute,
        displayName: "Trusted Offline 1",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        approvalStatus: NodeApprovalStatuses.approved,
        trustState: NodeTrustStates.trusted,
        certificate: {
          certificateRef: "cert:offline-1:v1",
        },
        deploymentTags: ["inventory"],
        lastSeen: {
          lastSeenAt: "2026-04-05T17:40:00.000Z",
          heartbeatStatus: NodeHeartbeatStatuses.offline,
        },
        revocation: {
          state: NodeRevocationStates.active,
        },
        enrolledAt: "2026-04-05T17:00:00.000Z",
        approvedAt: "2026-04-05T17:10:00.000Z",
        createdAt: "2026-04-05T17:00:00.000Z",
        createdBy: "seed",
        lastModifiedAt: "2026-04-05T17:40:00.000Z",
        lastModifiedBy: "seed",
        revision: 0,
      },
      mutation: {
        operationKey: "seed-inventory-offline-1",
        context: {
          actorUserIdentityId: "seed",
        },
      },
    });

    const list = await harness.backendApi.listNodeInventory({
      actorUserIdentityId: "admin:user:inventory",
      deploymentTagAnyOf: ["inventory"],
      operationalStates: ["pending", "offline"],
    });

    expect(list.ok).toBeTrue();
    if (!list.ok || !list.data) {
      return;
    }

    expect(list.data.nodes.some((node) => node.nodeId === "node:pending:inventory-1")).toBeTrue();
    expect(list.data.nodes.some((node) => node.nodeId === "node:trusted:offline-1")).toBeTrue();
    expect(list.data.nodes.find((node) => node.nodeId === "node:trusted:offline-1")?.operationalState).toBe("offline");

    const pendingDetail = await harness.backendApi.getNodeInventoryDetail({
      actorUserIdentityId: "admin:user:inventory",
      nodeId: "node:pending:inventory-1",
    });

    expect(pendingDetail.ok).toBeTrue();
    if (!pendingDetail.ok || !pendingDetail.data) {
      return;
    }

    expect(pendingDetail.data.node.operationalState).toBe("pending");
    expect(pendingDetail.data.node.pendingEnrollment?.requestId).toBeDefined();
  });
});

class StubRuntimeTrustMaterialDistributionPort implements ITrustMaterialDistributionPort {
  public async publishTrustBundle(_input: PublishTrustBundleInput): Promise<PublishTrustBundleResult> {
    throw new Error("not implemented");
  }

  public async resolveRuntimeTrustMaterialPackage(
    input: ResolveRuntimeTrustMaterialPackageInput,
  ): Promise<ResolveRuntimeTrustMaterialPackageResult | undefined> {
    return Object.freeze({
      packageId: `runtime-trust-package:${input.targetKind}:${input.targetReferenceId}`,
      occurredAt: input.occurredAt ?? "2026-04-05T00:00:00.000Z",
      certificateAuthorityId: input.certificateAuthorityId ?? "ca:internal:root:v1",
      serialNumber: input.serialNumber ?? "AA11",
      targetKind: input.targetKind,
      targetReferenceId: input.targetReferenceId,
      workspaceId: input.workspaceId,
      leafCertificatePem: "-----BEGIN CERTIFICATE-----leaf-----END CERTIFICATE-----",
      certificateChainPem: "-----BEGIN CERTIFICATE-----chain-----END CERTIFICATE-----",
      trustBundlePem: "-----BEGIN CERTIFICATE-----bundle-----END CERTIFICATE-----",
      protectedReferences: Object.freeze([]),
    });
  }
}
