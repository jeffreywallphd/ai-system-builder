import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { tmpdir } from "node:os";
import { createIdentityAuthTestHarness } from "../../../../api/identity/tests/TestIdentityAuthHarness";
import { NodeTrustBackendApi } from "../../../../api/nodes/NodeTrustBackendApi";
import { createIdentityHttpServer } from "../IdentityHttpServer";
import { ApproveNodeEnrollmentUseCase } from "../../../../../src/application/nodes/use-cases/ApproveNodeEnrollmentUseCase";
import { GetNodeInventoryDetailUseCase } from "../../../../../src/application/nodes/use-cases/GetNodeInventoryDetailUseCase";
import { GetNodeEnrollmentDetailUseCase } from "../../../../../src/application/nodes/use-cases/GetNodeEnrollmentDetailUseCase";
import { ListNodeInventoryUseCase } from "../../../../../src/application/nodes/use-cases/ListNodeInventoryUseCase";
import { ListTrustedNodeInventoryUseCase } from "../../../../../src/application/nodes/use-cases/ListTrustedNodeInventoryUseCase";
import { RecordNodeHeartbeatUseCase } from "../../../../../src/application/nodes/use-cases/RecordNodeHeartbeatUseCase";
import { RegisterNodeEnrollmentRequestUseCase } from "../../../../../src/application/nodes/use-cases/RegisterNodeEnrollmentRequestUseCase";
import { RejectNodeEnrollmentUseCase } from "../../../../../src/application/nodes/use-cases/RejectNodeEnrollmentUseCase";
import { ResolveApprovedNodeRuntimeTrustMaterialUseCase } from "../../../../../src/application/nodes/use-cases/ResolveApprovedNodeRuntimeTrustMaterialUseCase";
import { RevokeNodeTrustUseCase } from "../../../../../src/application/nodes/use-cases/RevokeNodeTrustUseCase";
import { ReviewPendingNodeEnrollmentUseCase } from "../../../../../src/application/nodes/use-cases/ReviewPendingNodeEnrollmentUseCase";
import {
  NodeApprovalStatuses,
  NodeHeartbeatStatuses,
  NodeRevocationReasons,
  NodeRevocationStates,
  NodeRoleCapabilities,
  NodeTrustStates,
  NodeTypes,
} from "../../../../../src/domain/nodes/NodeTrustDomain";
import { SqliteNodeTrustPersistenceAdapter } from "../../../../../src/infrastructure/persistence/nodes/SqliteNodeTrustPersistenceAdapter";
import type {
  ITrustMaterialDistributionPort,
  PublishTrustBundleInput,
  PublishTrustBundleResult,
  ResolveRuntimeTrustMaterialPackageInput,
  ResolveRuntimeTrustMaterialPackageResult,
} from "../../../../../src/application/security/ports/ITrustMaterialDistributionPort";
import { ResolveRuntimeTrustMaterialPackageUseCase } from "../../../../../src/application/security/use-cases/ResolveRuntimeTrustMaterialPackageUseCase";

const servers: Server[] = [];
const cleanup: Array<() => void> = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  })));
  while (cleanup.length > 0) {
    cleanup.pop()?.();
  }
});

async function startServer(): Promise<{
  readonly baseUrl: string;
  readonly nodeTrustAdapter: SqliteNodeTrustPersistenceAdapter;
}> {
  const identityHarness = await createIdentityAuthTestHarness();
  const root = mkdtempSync(path.join(tmpdir(), "ai-loom-identity-http-node-trust-"));
  cleanup.push(() => rmSync(root, { recursive: true, force: true }));

  const nodeTrustAdapter = new SqliteNodeTrustPersistenceAdapter(path.join(root, "node-trust.sqlite"));
  cleanup.push(() => nodeTrustAdapter.dispose());
  const nodeTrustBackendApi = new NodeTrustBackendApi({
    registerNodeEnrollmentRequestUseCase: new RegisterNodeEnrollmentRequestUseCase({
      enrollmentRequestRepository: nodeTrustAdapter,
    }),
    reviewPendingNodeEnrollmentUseCase: new ReviewPendingNodeEnrollmentUseCase({
      enrollmentRequestRepository: nodeTrustAdapter,
    }),
    getNodeEnrollmentDetailUseCase: new GetNodeEnrollmentDetailUseCase({
      enrollmentRequestRepository: nodeTrustAdapter,
    }),
    getNodeInventoryDetailUseCase: new GetNodeInventoryDetailUseCase({
      nodeRepository: nodeTrustAdapter,
      enrollmentRequestRepository: nodeTrustAdapter,
    }),
    approveNodeEnrollmentUseCase: new ApproveNodeEnrollmentUseCase({
      enrollmentRequestRepository: nodeTrustAdapter,
      nodeRepository: nodeTrustAdapter,
    }),
    rejectNodeEnrollmentUseCase: new RejectNodeEnrollmentUseCase({
      enrollmentRequestRepository: nodeTrustAdapter,
      nodeRepository: nodeTrustAdapter,
    }),
    revokeNodeTrustUseCase: new RevokeNodeTrustUseCase({
      nodeRepository: nodeTrustAdapter,
    }),
    recordNodeHeartbeatUseCase: new RecordNodeHeartbeatUseCase({
      nodeRepository: nodeTrustAdapter,
    }),
    resolveApprovedNodeRuntimeTrustMaterialUseCase: new ResolveApprovedNodeRuntimeTrustMaterialUseCase({
      nodeRepository: nodeTrustAdapter,
      runtimeTrustMaterialResolver: new ResolveRuntimeTrustMaterialPackageUseCase({
        trustMaterialDistributionPort: new StubRuntimeTrustMaterialDistributionPort(),
      }),
    }),
    listTrustedNodeInventoryUseCase: new ListTrustedNodeInventoryUseCase({
      nodeRepository: nodeTrustAdapter,
    }),
    listNodeInventoryUseCase: new ListNodeInventoryUseCase({
      nodeRepository: nodeTrustAdapter,
      enrollmentRequestRepository: nodeTrustAdapter,
    }),
  });

  const server = createIdentityHttpServer({
    backendApi: identityHarness.backendApi,
    nodeTrustBackendApi,
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  servers.push(server);

  const address = server.address() as AddressInfo;
  return Object.freeze({
    baseUrl: `http://127.0.0.1:${address.port}`,
    nodeTrustAdapter,
  });
}

async function registerAndLogin(
  baseUrl: string,
  username: string,
): Promise<{ readonly userIdentityId: string; readonly sessionToken: string }> {
  const registerResponse = await fetch(`${baseUrl}/api/v1/identity/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username,
      credential: {
        candidate: "StrongPass!2026",
      },
    }),
  });
  expect(registerResponse.status).toBe(200);
  const registerBody = await registerResponse.json();

  const loginResponse = await fetch(`${baseUrl}/api/v1/identity/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      providerSubject: username,
      credential: {
        candidate: "StrongPass!2026",
      },
    }),
  });
  expect(loginResponse.status).toBe(200);
  const loginBody = await loginResponse.json();
  return Object.freeze({
    userIdentityId: registerBody.data.userIdentityId,
    sessionToken: loginBody.data.sessionToken,
  });
}

describe("IdentityHttpServer node trust routes", () => {
  it("accepts enrollment submissions as pending and exposes pending-review queries", async () => {
    const { baseUrl, nodeTrustAdapter } = await startServer();

    const submitResponse = await fetch(`${baseUrl}/api/v1/nodes/enrollments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actorUserIdentityId: "node:bootstrap:compute-1",
        nodeId: "node:compute:1",
        nodeType: NodeTypes.compute,
        displayName: "Compute Node 1",
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
      }),
    });
    expect(submitResponse.status).toBe(200);
    const submitBody = await submitResponse.json();
    expect(submitBody.ok).toBe(true);
    expect(submitBody.data.enrollment.status).toBe("submitted");
    expect(submitBody.data.enrollment.certificateRef).toBe("trust-material:compute-1");

    const activeNodes = await nodeTrustAdapter.listNodes({
      activeOnly: true,
      includeRevoked: false,
    });
    expect(activeNodes).toHaveLength(0);

    const unauthenticatedPending = await fetch(`${baseUrl}/api/v1/nodes/enrollments/pending`);
    expect(unauthenticatedPending.status).toBe(401);

    const admin = await registerAndLogin(baseUrl, "node.pending.admin");
    const pendingResponse = await fetch(`${baseUrl}/api/v1/nodes/enrollments/pending`, {
      headers: {
        authorization: `Bearer ${admin.sessionToken}`,
      },
    });
    expect(pendingResponse.status).toBe(200);
    const pendingBody = await pendingResponse.json();
    expect(pendingBody.ok).toBe(true);
    expect(pendingBody.data.enrollments).toHaveLength(1);
    expect(pendingBody.data.enrollments[0].nodeId).toBe("node:compute:1");
    expect(pendingBody.data.enrollments[0].status).toBe("submitted");
    expect(pendingBody.data.enrollments[0].hasBootstrapMaterial).toBe(true);
  });

  it("handles malformed or duplicate enrollment submissions predictably", async () => {
    const { baseUrl } = await startServer();

    const invalidResponse = await fetch(`${baseUrl}/api/v1/nodes/enrollments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actorUserIdentityId: "",
        nodeId: "",
        nodeType: NodeTypes.compute,
      }),
    });
    expect(invalidResponse.status).toBe(400);
    const invalidBody = await invalidResponse.json();
    expect(invalidBody.ok).toBe(false);
    expect(invalidBody.error.code).toBe("invalid-request");
    expect(Array.isArray(invalidBody.error.validationErrors)).toBe(true);

    const firstSubmit = await fetch(`${baseUrl}/api/v1/nodes/enrollments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actorUserIdentityId: "node:bootstrap:compute-2",
        nodeId: "node:compute:2",
        nodeType: NodeTypes.compute,
        displayName: "Compute Node 2",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.workflowExecution],
          supportsRemoteScheduling: true,
        },
      }),
    });
    expect(firstSubmit.status).toBe(200);

    const duplicateSubmit = await fetch(`${baseUrl}/api/v1/nodes/enrollments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actorUserIdentityId: "node:bootstrap:compute-2",
        nodeId: "node:compute:2",
        nodeType: NodeTypes.compute,
        displayName: "Compute Node 2 Duplicate",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.workflowExecution],
          supportsRemoteScheduling: true,
        },
      }),
    });
    expect(duplicateSubmit.status).toBe(409);
    const duplicateBody = await duplicateSubmit.json();
    expect(duplicateBody.ok).toBe(false);
    expect(duplicateBody.error.code).toBe("conflict");
  });

  it("supports detail review and approval/rejection workflows for authenticated admins", async () => {
    const { baseUrl, nodeTrustAdapter } = await startServer();
    const admin = await registerAndLogin(baseUrl, "node.review.admin");

    const submitResponse = await fetch(`${baseUrl}/api/v1/nodes/enrollments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actorUserIdentityId: "node:bootstrap:compute-3",
        nodeId: "node:compute:3",
        nodeType: NodeTypes.compute,
        displayName: "Compute Node 3",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.workflowExecution],
          supportsRemoteScheduling: true,
        },
      }),
    });
    expect(submitResponse.status).toBe(200);
    const submitBody = await submitResponse.json();
    const requestId = submitBody.data.enrollment.requestId as string;

    const detailResponse = await fetch(`${baseUrl}/api/v1/nodes/enrollments/${encodeURIComponent(requestId)}`, {
      headers: {
        authorization: `Bearer ${admin.sessionToken}`,
      },
    });
    expect(detailResponse.status).toBe(200);
    const detailBody = await detailResponse.json();
    expect(detailBody.ok).toBe(true);
    expect(detailBody.data.enrollment.requestId).toBe(requestId);
    expect(detailBody.data.enrollment.nodeId).toBe("node:compute:3");

    const unauthenticatedDetail = await fetch(`${baseUrl}/api/v1/nodes/enrollments/${encodeURIComponent(requestId)}`);
    expect(unauthenticatedDetail.status).toBe(401);

    const approveResponse = await fetch(`${baseUrl}/api/v1/nodes/enrollments/${encodeURIComponent(requestId)}/approve`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${admin.sessionToken}`,
      },
      body: JSON.stringify({
        actorUserIdentityId: "spoofed-actor-id",
        requestId: "spoofed-request",
        decisionNote: "Approved after review",
        certificate: {
          certificateRef: "cert:node:compute:3:v1",
          certificateAuthorityRef: "ca:internal",
          certificateThumbprint: "thumbprint-internal",
        },
      }),
    });
    expect(approveResponse.status).toBe(200);
    const approveBody = await approveResponse.json();
    expect(approveBody.ok).toBe(true);
    expect(approveBody.data.enrollment.status).toBe("approved");
    expect(approveBody.data.enrollment.reviewedByUserIdentityId).toBeUndefined();
    expect(approveBody.data.node.trustState).toBe("trusted");
    expect(approveBody.data.node.certificate.certificateRef).toBe("cert:node:compute:3:v1");
    expect(approveBody.data.node.certificate.certificateAuthorityRef).toBeUndefined();
    expect(approveBody.data.node.certificate.certificateThumbprint).toBeUndefined();
    const persistedApproval = await nodeTrustAdapter.findEnrollmentRequestById(requestId);
    expect(persistedApproval?.reviewedByUserIdentityId).toBe(admin.userIdentityId);

    const secondSubmitResponse = await fetch(`${baseUrl}/api/v1/nodes/enrollments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actorUserIdentityId: "node:bootstrap:edge-4",
        nodeId: "node:edge:4",
        nodeType: NodeTypes.edge,
        displayName: "Edge Node 4",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.workflowExecution],
          supportsRemoteScheduling: false,
        },
      }),
    });
    expect(secondSubmitResponse.status).toBe(200);
    const secondSubmitBody = await secondSubmitResponse.json();
    const rejectRequestId = secondSubmitBody.data.enrollment.requestId as string;

    const rejectResponse = await fetch(`${baseUrl}/api/v1/nodes/enrollments/${encodeURIComponent(rejectRequestId)}/reject`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${admin.sessionToken}`,
      },
      body: JSON.stringify({
        decisionNote: "Rejected due to capacity policy",
      }),
    });
    expect(rejectResponse.status).toBe(200);
    const rejectBody = await rejectResponse.json();
    expect(rejectBody.ok).toBe(true);
    expect(rejectBody.data.enrollment.status).toBe("rejected");
    expect(rejectBody.data.node.trustState).toBe("quarantined");
  });

  it("revokes nodes through authenticated admin route and persists revocation state", async () => {
    const { baseUrl, nodeTrustAdapter } = await startServer();
    const admin = await registerAndLogin(baseUrl, "node.revoke.admin");

    await nodeTrustAdapter.registerNode({
      record: {
        nodeId: "node:trusted:revoke-http-1",
        nodeType: NodeTypes.compute,
        displayName: "Trusted Revoke HTTP 1",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        approvalStatus: NodeApprovalStatuses.approved,
        trustState: NodeTrustStates.trusted,
        certificate: {
          certificateRef: "cert:revoke-http-1:v1",
        },
        deploymentTags: ["inventory-http"],
        revocation: {
          state: NodeRevocationStates.active,
        },
        enrolledAt: "2026-04-05T18:00:00.000Z",
        approvedAt: "2026-04-05T18:01:00.000Z",
        createdAt: "2026-04-05T18:00:00.000Z",
        createdBy: "seed",
        lastModifiedAt: "2026-04-05T18:01:00.000Z",
        lastModifiedBy: "seed",
        revision: 0,
      },
      mutation: {
        operationKey: "seed-revoke-http-1",
        context: {
          actorUserIdentityId: "seed",
        },
      },
    });

    const unauthenticated = await fetch(
      `${baseUrl}/api/v1/nodes/${encodeURIComponent("node:trusted:revoke-http-1")}/revoke`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reason: NodeRevocationReasons.operatorAction,
        }),
      },
    );
    expect(unauthenticated.status).toBe(401);

    const invalidRequest = await fetch(
      `${baseUrl}/api/v1/nodes/${encodeURIComponent("node:trusted:revoke-http-1")}/revoke`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${admin.sessionToken}`,
        },
        body: JSON.stringify({
          reason: "invalid-reason",
        }),
      },
    );
    expect(invalidRequest.status).toBe(400);

    const revoke = await fetch(
      `${baseUrl}/api/v1/nodes/${encodeURIComponent("node:trusted:revoke-http-1")}/revoke`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${admin.sessionToken}`,
        },
        body: JSON.stringify({
          actorUserIdentityId: "spoofed-admin",
          nodeId: "spoofed-node-id",
          reason: NodeRevocationReasons.operatorAction,
          note: "Revoked from admin route.",
        }),
      },
    );
    expect(revoke.status).toBe(200);
    const revokeBody = await revoke.json();
    expect(revokeBody.ok).toBe(true);
    expect(revokeBody.data.node.nodeId).toBe("node:trusted:revoke-http-1");
    expect(revokeBody.data.node.trustState).toBe("revoked");
    expect(revokeBody.data.node.revocation.state).toBe("revoked");
    expect(revokeBody.data.node.revocation.reason).toBe(NodeRevocationReasons.operatorAction);

    const persisted = await nodeTrustAdapter.findNodeById("node:trusted:revoke-http-1");
    expect(persisted?.trustState).toBe(NodeTrustStates.revoked);
    expect(persisted?.revocation.state).toBe(NodeRevocationStates.revoked);
    expect(persisted?.revocation.revokedByUserIdentityId).toBe(admin.userIdentityId);
  });

  it("records node heartbeat, updates lastSeen, and ignores spoofed payload actor/node fields", async () => {
    const { baseUrl, nodeTrustAdapter } = await startServer();
    const nodePrincipal = await registerAndLogin(baseUrl, "node:trusted:hb-1");
    const admin = await registerAndLogin(baseUrl, "node.inventory.admin");

    await nodeTrustAdapter.registerNode({
      record: {
        nodeId: "node:trusted:hb-1",
        nodeType: NodeTypes.compute,
        displayName: "Trusted HB Node 1",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        approvalStatus: NodeApprovalStatuses.approved,
        trustState: NodeTrustStates.trusted,
        certificate: {
          certificateRef: "cert:trusted:hb-1:v1",
        },
        deploymentTags: ["presence"],
        revocation: {
          state: NodeRevocationStates.active,
        },
        enrolledAt: "2026-04-05T18:00:00.000Z",
        approvedAt: "2026-04-05T18:01:00.000Z",
        createdAt: "2026-04-05T18:00:00.000Z",
        createdBy: "seed",
        lastModifiedAt: "2026-04-05T18:01:00.000Z",
        lastModifiedBy: "seed",
        revision: 0,
      },
      mutation: {
        operationKey: "seed-hb-1",
        context: {
          actorUserIdentityId: "seed",
        },
      },
    });

    const unauthenticatedHeartbeat = await fetch(
      `${baseUrl}/api/v1/nodes/${encodeURIComponent("node:trusted:hb-1")}/heartbeat`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          heartbeatStatus: NodeHeartbeatStatuses.online,
        }),
      },
    );
    expect(unauthenticatedHeartbeat.status).toBe(401);

    const heartbeat = await fetch(
      `${baseUrl}/api/v1/nodes/${encodeURIComponent("node:trusted:hb-1")}/heartbeat`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${nodePrincipal.sessionToken}`,
        },
        body: JSON.stringify({
          actorUserIdentityId: "spoofed-actor",
          nodeId: "spoofed-node",
          heartbeatStatus: NodeHeartbeatStatuses.online,
          seenAt: "2026-04-05T18:02:30.000Z",
          observedBy: "node-agent-v1",
        }),
      },
    );
    expect(heartbeat.status).toBe(200);
    const heartbeatBody = await heartbeat.json();
    expect(heartbeatBody.ok).toBe(true);
    expect(heartbeatBody.data.node.nodeId).toBe("node:trusted:hb-1");
    expect(heartbeatBody.data.node.lastSeen.lastSeenAt).toBe("2026-04-05T18:02:30.000Z");
    expect(heartbeatBody.data.node.lastSeen.observedBy).toBe("node-agent-v1");

    const inventory = await fetch(
      `${baseUrl}/api/v1/nodes/trusted?lastSeenAfter=2026-04-05T18:02:00.000Z&deploymentTag=presence`,
      {
        headers: {
          authorization: `Bearer ${admin.sessionToken}`,
        },
      },
    );
    expect(inventory.status).toBe(200);
    const inventoryBody = await inventory.json();
    expect(inventoryBody.ok).toBe(true);
    expect(inventoryBody.data.nodes.some((node: { nodeId: string }) => node.nodeId === "node:trusted:hb-1")).toBeTrue();
  });

  it("rejects heartbeat updates when the authenticated principal is not bound to the nodeId", async () => {
    const { baseUrl, nodeTrustAdapter } = await startServer();
    const admin = await registerAndLogin(baseUrl, "node.heartbeat.admin");

    await nodeTrustAdapter.registerNode({
      record: {
        nodeId: "node:trusted:bound-1",
        nodeType: NodeTypes.compute,
        displayName: "Trusted Bound Node 1",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        approvalStatus: NodeApprovalStatuses.approved,
        trustState: NodeTrustStates.trusted,
        certificate: {
          certificateRef: "cert:trusted:bound-1:v1",
        },
        deploymentTags: ["presence"],
        revocation: {
          state: NodeRevocationStates.active,
        },
        enrolledAt: "2026-04-05T18:00:00.000Z",
        approvedAt: "2026-04-05T18:01:00.000Z",
        createdAt: "2026-04-05T18:00:00.000Z",
        createdBy: "seed",
        lastModifiedAt: "2026-04-05T18:01:00.000Z",
        lastModifiedBy: "seed",
        revision: 0,
      },
      mutation: {
        operationKey: "seed-hb-bound-1",
        context: {
          actorUserIdentityId: "seed",
        },
      },
    });

    const response = await fetch(
      `${baseUrl}/api/v1/nodes/${encodeURIComponent("node:trusted:bound-1")}/heartbeat`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${admin.sessionToken}`,
        },
        body: JSON.stringify({
          heartbeatStatus: NodeHeartbeatStatuses.online,
          seenAt: "2026-04-05T18:02:30.000Z",
        }),
      },
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("forbidden");
  });

  it("returns admin inventory list/detail with operational and presence filters", async () => {
    const { baseUrl, nodeTrustAdapter } = await startServer();
    const admin = await registerAndLogin(baseUrl, "node.inventory.filter.admin");

    await fetch(`${baseUrl}/api/v1/nodes/enrollments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actorUserIdentityId: "node:bootstrap:pending-http-1",
        nodeId: "node:pending:http-1",
        nodeType: NodeTypes.hybrid,
        displayName: "Pending HTTP 1",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        deploymentTags: ["inventory-http"],
      }),
    });

    await nodeTrustAdapter.registerNode({
      record: {
        nodeId: "node:trusted:http-offline-1",
        nodeType: NodeTypes.compute,
        displayName: "HTTP Offline 1",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        approvalStatus: NodeApprovalStatuses.approved,
        trustState: NodeTrustStates.trusted,
        certificate: {
          certificateRef: "cert:http-offline-1:v1",
        },
        deploymentTags: ["inventory-http"],
        lastSeen: {
          lastSeenAt: "2026-04-05T18:06:00.000Z",
          heartbeatStatus: NodeHeartbeatStatuses.offline,
        },
        revocation: {
          state: NodeRevocationStates.active,
        },
        enrolledAt: "2026-04-05T18:00:00.000Z",
        approvedAt: "2026-04-05T18:02:00.000Z",
        createdAt: "2026-04-05T18:00:00.000Z",
        createdBy: "seed",
        lastModifiedAt: "2026-04-05T18:06:00.000Z",
        lastModifiedBy: "seed",
        revision: 0,
      },
      mutation: {
        operationKey: "seed-http-offline-1",
        context: {
          actorUserIdentityId: "seed",
        },
      },
    });

    const listResponse = await fetch(
      `${baseUrl}/api/v1/nodes/inventory?deploymentTag=inventory-http&operationalState=pending&operationalState=offline`,
      {
        headers: {
          authorization: `Bearer ${admin.sessionToken}`,
        },
      },
    );

    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.ok).toBe(true);
    expect(listBody.data.nodes.some((node: { nodeId: string }) => node.nodeId === "node:pending:http-1")).toBeTrue();
    expect(listBody.data.nodes.some((node: { nodeId: string; operationalState: string }) => (
      node.nodeId === "node:trusted:http-offline-1" && node.operationalState === "offline"
    ))).toBeTrue();

    const detailResponse = await fetch(
      `${baseUrl}/api/v1/nodes/inventory/${encodeURIComponent("node:pending:http-1")}`,
      {
        headers: {
          authorization: `Bearer ${admin.sessionToken}`,
        },
      },
    );
    expect(detailResponse.status).toBe(200);
    const detailBody = await detailResponse.json();
    expect(detailBody.ok).toBe(true);
    expect(detailBody.data.node.operationalState).toBe("pending");
    expect(detailBody.data.node.pendingEnrollment.requestId).toBeDefined();
  });

  it("rejects heartbeat updates for unknown and revoked nodes", async () => {
    const { baseUrl, nodeTrustAdapter } = await startServer();
    const missingNodePrincipal = await registerAndLogin(baseUrl, "node:missing:hb-1");
    const revokedNodePrincipal = await registerAndLogin(baseUrl, "node:revoked:hb-1");

    await nodeTrustAdapter.registerNode({
      record: {
        nodeId: "node:revoked:hb-1",
        nodeType: NodeTypes.compute,
        displayName: "Revoked HB Node",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        approvalStatus: NodeApprovalStatuses.rejected,
        trustState: NodeTrustStates.revoked,
        deploymentTags: ["presence"],
        revocation: {
          state: NodeRevocationStates.revoked,
          reason: NodeRevocationReasons.operatorAction,
          revokedAt: "2026-04-05T18:05:00.000Z",
          revokedByUserIdentityId: "admin-1",
        },
        enrolledAt: "2026-04-05T18:00:00.000Z",
        revokedAt: "2026-04-05T18:05:00.000Z",
        createdAt: "2026-04-05T18:00:00.000Z",
        createdBy: "seed",
        lastModifiedAt: "2026-04-05T18:05:00.000Z",
        lastModifiedBy: "seed",
        revision: 0,
      },
      mutation: {
        operationKey: "seed-revoked-hb",
        context: {
          actorUserIdentityId: "seed",
        },
      },
    });

    const unknownHeartbeat = await fetch(
      `${baseUrl}/api/v1/nodes/${encodeURIComponent("node:missing:hb-1")}/heartbeat`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${missingNodePrincipal.sessionToken}`,
        },
        body: JSON.stringify({
          heartbeatStatus: NodeHeartbeatStatuses.online,
        }),
      },
    );
    expect(unknownHeartbeat.status).toBe(404);

    const revokedHeartbeat = await fetch(
      `${baseUrl}/api/v1/nodes/${encodeURIComponent("node:revoked:hb-1")}/heartbeat`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${revokedNodePrincipal.sessionToken}`,
        },
        body: JSON.stringify({
          heartbeatStatus: NodeHeartbeatStatuses.online,
        }),
      },
    );
    expect(revokedHeartbeat.status).toBe(409);
  });

  it("retrieves managed runtime trust material only for authenticated approved node principals", async () => {
    const { baseUrl, nodeTrustAdapter } = await startServer();
    const nodePrincipal = await registerAndLogin(baseUrl, "node:trusted:runtime-http-1");
    const otherPrincipal = await registerAndLogin(baseUrl, "node:trusted:runtime-http-2");

    await nodeTrustAdapter.registerNode({
      record: {
        nodeId: "node:trusted:runtime-http-1",
        nodeType: NodeTypes.compute,
        displayName: "Trusted Runtime HTTP 1",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        approvalStatus: NodeApprovalStatuses.approved,
        trustState: NodeTrustStates.trusted,
        certificate: {
          certificateRef: "cert:trusted:runtime-http-1:v1",
        },
        deploymentTags: ["runtime"],
        revocation: {
          state: NodeRevocationStates.active,
        },
        enrolledAt: "2026-04-05T18:00:00.000Z",
        approvedAt: "2026-04-05T18:01:00.000Z",
        createdAt: "2026-04-05T18:00:00.000Z",
        createdBy: "seed",
        lastModifiedAt: "2026-04-05T18:01:00.000Z",
        lastModifiedBy: "seed",
        revision: 0,
      },
      mutation: {
        operationKey: "seed-runtime-http-1",
        context: {
          actorUserIdentityId: "seed",
        },
      },
    });

    const unauthorized = await fetch(
      `${baseUrl}/api/v1/nodes/${encodeURIComponent("node:trusted:runtime-http-1")}/runtime-trust-material`,
      {
        headers: {
          authorization: `Bearer ${otherPrincipal.sessionToken}`,
        },
      },
    );
    expect(unauthorized.status).toBe(403);

    const authorized = await fetch(
      `${baseUrl}/api/v1/nodes/${encodeURIComponent("node:trusted:runtime-http-1")}/runtime-trust-material`,
      {
        headers: {
          authorization: `Bearer ${nodePrincipal.sessionToken}`,
        },
      },
    );
    expect(authorized.status).toBe(200);
    const authorizedBody = await authorized.json();
    expect(authorizedBody.ok).toBe(true);
    expect(authorizedBody.data.runtimeTrustMaterial.targetKind).toBe("node");
    expect(authorizedBody.data.runtimeTrustMaterial.targetReferenceId).toBe("node:trusted:runtime-http-1");
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
      certificateAuthorityId: "ca:internal:root:v1",
      serialNumber: "AA11",
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
