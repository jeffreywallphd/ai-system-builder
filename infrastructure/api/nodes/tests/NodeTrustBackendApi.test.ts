import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { RegisterNodeEnrollmentRequestUseCase } from "../../../src/application/nodes/use-cases/RegisterNodeEnrollmentRequestUseCase";
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
});
