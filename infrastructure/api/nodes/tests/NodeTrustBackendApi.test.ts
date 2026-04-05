import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { ApproveNodeEnrollmentUseCase } from "../../../src/application/nodes/use-cases/ApproveNodeEnrollmentUseCase";
import { GetNodeEnrollmentDetailUseCase } from "../../../src/application/nodes/use-cases/GetNodeEnrollmentDetailUseCase";
import { RegisterNodeEnrollmentRequestUseCase } from "../../../src/application/nodes/use-cases/RegisterNodeEnrollmentRequestUseCase";
import { RejectNodeEnrollmentUseCase } from "../../../src/application/nodes/use-cases/RejectNodeEnrollmentUseCase";
import { ReviewPendingNodeEnrollmentUseCase } from "../../../src/application/nodes/use-cases/ReviewPendingNodeEnrollmentUseCase";
import { NodeRoleCapabilities, NodeTypes } from "../../../src/domain/nodes/NodeTrustDomain";
import { SqliteNodeTrustPersistenceAdapter } from "../../../src/infrastructure/persistence/nodes/SqliteNodeTrustPersistenceAdapter";
import { NodeTrustBackendApi } from "../NodeTrustBackendApi";

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
} {
  const directory = mkdtempSync(path.join(tmpdir(), "ai-loom-node-trust-backend-api-"));
  cleanupPaths.push(directory);
  const adapter = new SqliteNodeTrustPersistenceAdapter(path.join(directory, "node-trust.sqlite"));
  disposers.push(() => adapter.dispose());
  const backendApi = new NodeTrustBackendApi({
    registerNodeEnrollmentRequestUseCase: new RegisterNodeEnrollmentRequestUseCase({
      enrollmentRequestRepository: adapter,
    }),
    reviewPendingNodeEnrollmentUseCase: new ReviewPendingNodeEnrollmentUseCase({
      enrollmentRequestRepository: adapter,
    }),
    getNodeEnrollmentDetailUseCase: new GetNodeEnrollmentDetailUseCase({
      enrollmentRequestRepository: adapter,
    }),
    approveNodeEnrollmentUseCase: new ApproveNodeEnrollmentUseCase({
      enrollmentRequestRepository: adapter,
      nodeRepository: adapter,
    }),
    rejectNodeEnrollmentUseCase: new RejectNodeEnrollmentUseCase({
      enrollmentRequestRepository: adapter,
      nodeRepository: adapter,
    }),
  });

  return Object.freeze({
    backendApi,
    adapter,
  });
}

describe("NodeTrustBackendApi", () => {
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
});
