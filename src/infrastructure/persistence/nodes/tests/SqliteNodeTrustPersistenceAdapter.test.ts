import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  NodeApprovalStatuses,
  NodeEnrollmentRequestStatuses,
  NodeHeartbeatStatuses,
  NodeRevocationStates,
  NodeRoleCapabilities,
  NodeTrustStates,
  NodeTypes,
} from "../../../../domain/nodes/NodeTrustDomain";
import { openSqliteCompatDatabase } from "../../sqlite/SqliteCompat";
import { SqliteNodeTrustPersistenceAdapter } from "../SqliteNodeTrustPersistenceAdapter";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("SqliteNodeTrustPersistenceAdapter", () => {
  it("applies migrations and creates node trust persistence tables", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-node-trust-schema-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "node-trust.sqlite");

    const adapter = new SqliteNodeTrustPersistenceAdapter(databasePath);
    await adapter.registerNode({
      record: {
        nodeId: "node:bootstrap",
        nodeType: NodeTypes.compute,
        displayName: "Bootstrap Node",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        approvalStatus: NodeApprovalStatuses.pending,
        trustState: NodeTrustStates.pendingApproval,
        deploymentTags: ["bootstrap"],
        revocation: { state: NodeRevocationStates.active },
        enrolledAt: "2026-04-05T12:00:00.000Z",
        createdAt: "2026-04-05T12:00:00.000Z",
        createdBy: "system",
        lastModifiedAt: "2026-04-05T12:00:00.000Z",
        lastModifiedBy: "system",
        revision: 0,
      },
      mutation: {
        operationKey: "op:node:bootstrap:create",
        context: {
          actorUserIdentityId: "system",
          occurredAt: "2026-04-05T12:00:00.000Z",
        },
      },
    });
    adapter.dispose();

    const database = openSqliteCompatDatabase(databasePath);
    const versionRow = database.prepare("SELECT MAX(version) AS version FROM node_trust_repository_migrations")
      .get() as { version?: number };
    expect(versionRow.version).toBe(2);

    const tables = database.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name IN (
          'node_trust_identities',
          'node_enrollment_requests',
          'node_trust_identity_capabilities',
          'node_trust_identity_deployment_tags',
          'node_trust_mutation_replays',
          'node_trust_audit_events'
        )
      ORDER BY name ASC
    `).all() as Array<{ name: string }>;

    expect(tables.map((table) => table.name)).toEqual([
      "node_enrollment_requests",
      "node_trust_audit_events",
      "node_trust_identities",
      "node_trust_identity_capabilities",
      "node_trust_identity_deployment_tags",
      "node_trust_mutation_replays",
    ]);

    database.close();
  });

  it("supports node and enrollment lifecycle persistence workflows", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-node-trust-roundtrip-"));
    createdRoots.push(root);
    const adapter = new SqliteNodeTrustPersistenceAdapter(path.join(root, "node-trust.sqlite"));

    const registerResult = await adapter.registerNode({
      record: {
        nodeId: "node:compute:001",
        nodeType: NodeTypes.compute,
        displayName: "Compute 001",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
          maxConcurrentWorkloads: 2,
        },
        approvalStatus: NodeApprovalStatuses.pending,
        trustState: NodeTrustStates.pendingApproval,
        deploymentTags: ["us-east-1", "gpu"],
        revocation: { state: NodeRevocationStates.active },
        enrolledAt: "2026-04-05T12:00:00.000Z",
        createdAt: "2026-04-05T12:00:00.000Z",
        createdBy: "system",
        lastModifiedAt: "2026-04-05T12:00:00.000Z",
        lastModifiedBy: "system",
        revision: 0,
      },
      mutation: {
        operationKey: "op:node:001:create",
        context: {
          actorUserIdentityId: "system",
          occurredAt: "2026-04-05T12:00:00.000Z",
        },
      },
    });
    expect(registerResult.record.revision).toBe(1);

    const replayResult = await adapter.registerNode({
      record: registerResult.record,
      mutation: {
        operationKey: "op:node:001:create",
        context: {
          actorUserIdentityId: "system",
          occurredAt: "2026-04-05T12:00:00.000Z",
        },
      },
    });
    expect(replayResult.wasReplay).toBeTrue();
    expect(replayResult.changed).toBeFalse();

    const approved = await adapter.updateNodeApproval({
      nodeId: "node:compute:001",
      approvalStatus: NodeApprovalStatuses.approved,
      approvedAt: "2026-04-05T12:05:00.000Z",
      trustState: NodeTrustStates.trusted,
      mutation: {
        operationKey: "op:node:001:approve",
        expectedRevision: registerResult.record.revision,
        context: {
          actorUserIdentityId: "admin:1",
          occurredAt: "2026-04-05T12:05:00.000Z",
        },
      },
    });

    await adapter.updateNodeCertificateReference({
      nodeId: "node:compute:001",
      certificate: {
        certificateRef: "cert:node:001:v1",
        certificateAssignedAt: "2026-04-05T12:06:00.000Z",
        certificateAuthorityRef: "ca:platform",
      },
      mutation: {
        operationKey: "op:node:001:cert",
        expectedRevision: approved.record.revision,
        context: {
          actorUserIdentityId: "admin:1",
          occurredAt: "2026-04-05T12:06:00.000Z",
        },
      },
    });

    await adapter.recordNodeLastSeen({
      nodeId: "node:compute:001",
      lastSeen: {
        lastSeenAt: "2026-04-05T12:10:00.000Z",
        heartbeatStatus: NodeHeartbeatStatuses.online,
        observedBy: "heartbeat",
      },
      mutation: {
        operationKey: "op:node:001:last-seen",
        context: {
          actorUserIdentityId: "system:heartbeat",
          occurredAt: "2026-04-05T12:10:00.000Z",
        },
      },
    });

    const activeNodes = await adapter.listNodes({
      activeOnly: true,
      certificateAssigned: true,
      capabilityAnyOf: [NodeRoleCapabilities.executor],
      deploymentTagAnyOf: ["US-EAST-1"],
      includeRevoked: false,
    });
    expect(activeNodes).toHaveLength(1);
    expect(activeNodes[0]?.trustState).toBe(NodeTrustStates.trusted);

    const revoked = await adapter.revokeNode({
      nodeId: "node:compute:001",
      revocation: {
        state: NodeRevocationStates.revoked,
        reason: "policy-violation",
        revokedAt: "2026-04-05T12:30:00.000Z",
        revokedByUserIdentityId: "admin:1",
        note: "Revoked from admin control plane.",
      },
      mutation: {
        operationKey: "op:node:001:revoke",
        context: {
          actorUserIdentityId: "admin:1",
          occurredAt: "2026-04-05T12:30:00.000Z",
        },
      },
    });
    expect(revoked.record.trustState).toBe(NodeTrustStates.revoked);
    expect(revoked.record.revocation.reason).toBe("policy-violation");
    expect(revoked.record.revocation.revokedByUserIdentityId).toBe("admin:1");
    expect(revoked.record.revocation.note).toBe("Revoked from admin control plane.");
    expect(revoked.record.revokedAt).toBe("2026-04-05T12:30:00.000Z");

    const revokedNodes = await adapter.listNodes({
      trustStates: [NodeTrustStates.revoked],
      includeRevoked: true,
    });
    expect(revokedNodes).toHaveLength(1);
    expect(revokedNodes[0]?.nodeId).toBe("node:compute:001");
    expect(revokedNodes[0]?.revocation.note).toBe("Revoked from admin control plane.");

    const enrollmentSaved = await adapter.saveEnrollmentRequest({
      record: {
        requestId: "enroll:001",
        nodeId: "node:hybrid:001",
        nodeType: NodeTypes.hybrid,
        displayName: "Hybrid 001",
        capabilityProfile: {
          enabledCapabilities: [
            NodeRoleCapabilities.executor,
            NodeRoleCapabilities.api,
          ],
          supportsRemoteScheduling: true,
        },
        deploymentTags: ["region-1", "hybrid"],
        requestedAt: "2026-04-05T13:00:00.000Z",
        status: NodeEnrollmentRequestStatuses.submitted,
        createdAt: "2026-04-05T13:00:00.000Z",
        createdBy: "node:hybrid:001",
        lastModifiedAt: "2026-04-05T13:00:00.000Z",
        lastModifiedBy: "node:hybrid:001",
        revision: 0,
      },
      mutation: {
        operationKey: "op:enroll:001:create",
        context: {
          actorUserIdentityId: "node:hybrid:001",
          occurredAt: "2026-04-05T13:00:00.000Z",
        },
      },
    });
    expect(enrollmentSaved.record.revision).toBe(1);

    const pending = await adapter.findPendingEnrollmentRequestByNodeId(
      "node:hybrid:001",
      "2026-04-05T13:01:00.000Z",
    );
    expect(pending?.requestId).toBe("enroll:001");

    const approvedEnrollment = await adapter.transitionEnrollmentRequestStatus({
      requestId: "enroll:001",
      toStatus: NodeEnrollmentRequestStatuses.approved,
      reviewedByUserIdentityId: "admin:1",
      mutation: {
        operationKey: "op:enroll:001:approve",
        expectedRevision: enrollmentSaved.record.revision,
        context: {
          actorUserIdentityId: "admin:1",
          occurredAt: "2026-04-05T13:05:00.000Z",
        },
      },
    });

    expect(approvedEnrollment.record.status).toBe(NodeEnrollmentRequestStatuses.approved);
    expect(approvedEnrollment.record.reviewedAt).toBe("2026-04-05T13:05:00.000Z");

    const pendingAfter = await adapter.findPendingEnrollmentRequestByNodeId("node:hybrid:001");
    expect(pendingAfter).toBeUndefined();

    const approvedList = await adapter.listEnrollmentRequests({
      statuses: [NodeEnrollmentRequestStatuses.approved],
      includeTerminal: true,
    });
    expect(approvedList).toHaveLength(1);
    expect(approvedList[0]?.reviewedByUserIdentityId).toBe("admin:1");

    await expect(adapter.updateNodeApproval({
      nodeId: "node:compute:001",
      approvalStatus: NodeApprovalStatuses.approved,
      mutation: {
        operationKey: "op:node:001:approve:stale",
        expectedRevision: 1,
        context: {
          actorUserIdentityId: "admin:1",
          occurredAt: "2026-04-05T12:40:00.000Z",
        },
      },
    })).rejects.toThrow("expectedRevision");

    adapter.dispose();
  });
});
