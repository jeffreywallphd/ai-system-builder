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
import { GetNodeEnrollmentDetailUseCase } from "../../../../../src/application/nodes/use-cases/GetNodeEnrollmentDetailUseCase";
import { RegisterNodeEnrollmentRequestUseCase } from "../../../../../src/application/nodes/use-cases/RegisterNodeEnrollmentRequestUseCase";
import { RejectNodeEnrollmentUseCase } from "../../../../../src/application/nodes/use-cases/RejectNodeEnrollmentUseCase";
import { ReviewPendingNodeEnrollmentUseCase } from "../../../../../src/application/nodes/use-cases/ReviewPendingNodeEnrollmentUseCase";
import { NodeRoleCapabilities, NodeTypes } from "../../../../../src/domain/nodes/NodeTrustDomain";
import { SqliteNodeTrustPersistenceAdapter } from "../../../../../src/infrastructure/persistence/nodes/SqliteNodeTrustPersistenceAdapter";

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
    approveNodeEnrollmentUseCase: new ApproveNodeEnrollmentUseCase({
      enrollmentRequestRepository: nodeTrustAdapter,
      nodeRepository: nodeTrustAdapter,
    }),
    rejectNodeEnrollmentUseCase: new RejectNodeEnrollmentUseCase({
      enrollmentRequestRepository: nodeTrustAdapter,
      nodeRepository: nodeTrustAdapter,
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
});
