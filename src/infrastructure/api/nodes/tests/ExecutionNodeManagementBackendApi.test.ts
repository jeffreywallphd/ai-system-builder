import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  createExecutionNodeRecord,
  ExecutionNodeActivationStatuses,
  ExecutionNodeBackendReadinessStates,
  ExecutionNodeHealthStatuses,
  ExecutionNodeTargetKinds,
} from "@domain/nodes/ExecutionNodeDomain";
import {
  createNodeCapabilityProfile,
  NodeApprovalStatuses,
  NodeRoleCapabilities,
  NodeTrustStates,
  NodeTypes,
} from "@domain/nodes/NodeTrustDomain";
import { ListExecutionNodesUseCase } from "@application/nodes/use-cases/ListExecutionNodesUseCase";
import { GetExecutionNodeDetailUseCase } from "@application/nodes/use-cases/GetExecutionNodeDetailUseCase";
import { SetExecutionNodeAvailabilityOverrideUseCase } from "@application/nodes/use-cases/SetExecutionNodeAvailabilityOverrideUseCase";
import { ImageRunNodeEligibilityEvaluationService } from "@application/nodes/use-cases/ImageRunNodeEligibilityEvaluationService";
import { SqliteExecutionNodeRepository } from "@infrastructure/persistence/nodes/SqliteExecutionNodeRepository";
import { ExecutionNodeManagementBackendApi } from "../ExecutionNodeManagementBackendApi";

const cleanupRoots: string[] = [];

afterEach(() => {
  while (cleanupRoots.length > 0) {
    const root = cleanupRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

async function createHarness(): Promise<{
  readonly backendApi: ExecutionNodeManagementBackendApi;
  readonly repository: SqliteExecutionNodeRepository;
}> {
  const root = mkdtempSync(path.join(tmpdir(), "ai-loom-execution-node-management-api-"));
  cleanupRoots.push(root);
  const repository = new SqliteExecutionNodeRepository(path.join(root, "execution-node.sqlite"));

  await repository.registerExecutionNode({
    record: createSeedNode({
      nodeId: "node:execution:ready-1",
      displayName: "Execution Ready 1",
      activationStatus: ExecutionNodeActivationStatuses.active,
      healthStatus: ExecutionNodeHealthStatuses.ready,
      backendReadiness: ExecutionNodeBackendReadinessStates.ready,
      lastSeenAt: "2026-04-08T20:00:00.000Z",
    }),
    mutation: {
      operationKey: "seed-ready-1",
      actorId: "seed",
    },
  });

  await repository.registerExecutionNode({
    record: createSeedNode({
      nodeId: "node:execution:degraded-1",
      displayName: "Execution Degraded 1",
      activationStatus: ExecutionNodeActivationStatuses.degraded,
      healthStatus: ExecutionNodeHealthStatuses.degraded,
      backendReadiness: ExecutionNodeBackendReadinessStates.degraded,
      lastSeenAt: "2026-04-08T20:01:00.000Z",
    }),
    mutation: {
      operationKey: "seed-degraded-1",
      actorId: "seed",
    },
  });

  const backendApi = new ExecutionNodeManagementBackendApi({
    listExecutionNodesUseCase: new ListExecutionNodesUseCase({
      nodeRepository: repository,
      clock: {
        now: () => new Date("2026-04-08T20:05:00.000Z"),
      },
    }),
    getExecutionNodeDetailUseCase: new GetExecutionNodeDetailUseCase({
      nodeRepository: repository,
      clock: {
        now: () => new Date("2026-04-08T20:05:00.000Z"),
      },
    }),
    setExecutionNodeAvailabilityOverrideUseCase: new SetExecutionNodeAvailabilityOverrideUseCase({
      nodeRepository: repository,
      clock: {
        now: () => new Date("2026-04-08T20:05:00.000Z"),
      },
    }),
    eligibilityService: new ImageRunNodeEligibilityEvaluationService({
      nodeRepository: repository,
    }),
    clock: {
      now: () => new Date("2026-04-08T20:05:00.000Z"),
    },
  });

  return Object.freeze({
    backendApi,
    repository,
  });
}

function createSeedNode(input: {
  readonly nodeId: string;
  readonly displayName: string;
  readonly activationStatus: typeof ExecutionNodeActivationStatuses[keyof typeof ExecutionNodeActivationStatuses];
  readonly healthStatus: typeof ExecutionNodeHealthStatuses[keyof typeof ExecutionNodeHealthStatuses];
  readonly backendReadiness: typeof ExecutionNodeBackendReadinessStates[keyof typeof ExecutionNodeBackendReadinessStates];
  readonly lastSeenAt: string;
}) {
  return createExecutionNodeRecord({
    nodeId: input.nodeId,
    displayName: input.displayName,
    nodeType: NodeTypes.compute,
    capabilityProfile: createNodeCapabilityProfile({
      enabledCapabilities: [NodeRoleCapabilities.executor, NodeRoleCapabilities.storageAccess],
      supportsRemoteScheduling: true,
      maxConcurrentWorkloads: 3,
    }),
    backendFamilyCapabilities: [{
      backendFamily: "comfyui",
      supportedExecutionTargets: [ExecutionNodeTargetKinds.imageManipulation],
      supportedOperationKinds: ["image-to-image"],
      executionReadiness: {
        state: input.backendReadiness,
        checkedAt: input.lastSeenAt,
      },
    }],
    approvalStatus: NodeApprovalStatuses.approved,
    trustState: NodeTrustStates.trusted,
    activationStatus: input.activationStatus,
    healthStatus: input.healthStatus,
    deploymentTags: ["ops"],
    endpoint: {
      endpointRef: `node://${input.nodeId}`,
    },
    certificateRef: `cert:${input.nodeId}:v1`,
    lastSeenAt: input.lastSeenAt,
    metadata: {
      owner: "platform",
    },
    createdAt: "2026-04-08T19:55:00.000Z",
    updatedAt: input.lastSeenAt,
  });
}

describe("ExecutionNodeManagementBackendApi", () => {
  it("returns list/get, eligibility/readiness, and backend availability DTOs", async () => {
    const harness = await createHarness();

    const listed = await harness.backendApi.listNodes({
      actorUserIdentityId: "admin:ops",
      backendFamilies: ["comfyui"],
      executionTargets: ["image-manipulation"],
    });
    expect(listed.ok).toBeTrue();
    if (!listed.ok || !listed.data) {
      harness.repository.dispose();
      return;
    }
    expect(listed.data.items).toHaveLength(2);
    expect(listed.data.contractVersion).toBe("execution-node-management-api/v1");

    const detailed = await harness.backendApi.getNode({
      actorUserIdentityId: "admin:ops",
      nodeId: "node:execution:ready-1",
    });
    expect(detailed.ok).toBeTrue();
    if (!detailed.ok || !detailed.data) {
      harness.repository.dispose();
      return;
    }
    expect(detailed.data.node.nodeId).toBe("node:execution:ready-1");
    expect(detailed.data.node.backendCapabilities[0]?.backendFamily).toBe("comfyui");

    const eligibility = await harness.backendApi.checkEligibility({
      actorUserIdentityId: "admin:ops",
      requiredBackendFamilies: ["comfyui"],
      requiredExecutionTarget: "image-manipulation",
      candidateNodeIds: ["node:execution:ready-1", "node:execution:degraded-1"],
    });
    expect(eligibility.ok).toBeTrue();
    if (!eligibility.ok || !eligibility.data) {
      harness.repository.dispose();
      return;
    }
    expect(eligibility.data.evaluations.some((entry) => entry.decision === "eligible")).toBeTrue();

    const readiness = await harness.backendApi.checkReadiness({
      actorUserIdentityId: "admin:ops",
      requiredBackendFamilies: ["comfyui"],
      requiredExecutionTarget: "image-manipulation",
      candidateNodeIds: ["node:execution:ready-1", "node:execution:degraded-1"],
    });
    expect(readiness.ok).toBeTrue();
    if (!readiness.ok || !readiness.data) {
      harness.repository.dispose();
      return;
    }
    expect(readiness.data.readyForExecution).toBeTrue();
    expect(readiness.data.readiness).toBe("ready");

    const backendAvailability = await harness.backendApi.listBackendAvailability({
      actorUserIdentityId: "admin:ops",
      backendFamilies: ["comfyui"],
      executionTarget: "image-manipulation",
      includeUnavailable: true,
    });
    expect(backendAvailability.ok).toBeTrue();
    if (!backendAvailability.ok || !backendAvailability.data) {
      harness.repository.dispose();
      return;
    }
    expect(backendAvailability.data.backends[0]?.backendFamily).toBe("comfyui");
    expect(backendAvailability.data.backends[0]?.readyNodeCount).toBe(1);
    expect(backendAvailability.data.backends[0]?.degradedNodeCount).toBe(1);

    harness.repository.dispose();
  });

  it("applies availability override mutations through the use-case boundary", async () => {
    const harness = await createHarness();

    const mutated = await harness.backendApi.setAvailabilityOverride({
      actorUserIdentityId: "admin:ops",
      nodeId: "node:execution:ready-1",
      action: "suppress",
      changedAt: "2026-04-08T20:06:00.000Z",
      suppressedUntil: "2026-04-08T20:36:00.000Z",
      reason: "maintenance window",
    });

    expect(mutated.ok).toBeTrue();
    if (!mutated.ok || !mutated.data) {
      harness.repository.dispose();
      return;
    }

    expect(mutated.data.node.operational.availabilityOverrideMode).toBe("suppressed");
    expect(mutated.data.node.operational.availabilitySuppressedUntil).toBe("2026-04-08T20:36:00.000Z");
    expect(mutated.data.mutation.changed).toBeTrue();
    expect(mutated.data.contractVersion).toBe("execution-node-management-api/v1");

    harness.repository.dispose();
  });

  it("returns stable validation errors for malformed requests", async () => {
    const harness = await createHarness();

    const invalid = await harness.backendApi.setAvailabilityOverride({
      actorUserIdentityId: "admin:ops",
      nodeId: "node:execution:ready-1",
      action: "enable",
      suppressedUntil: "2026-04-08T20:36:00.000Z",
    });

    expect(invalid.ok).toBeFalse();
    if (invalid.ok || !invalid.error) {
      harness.repository.dispose();
      return;
    }
    expect(invalid.error.code).toBe("invalid-request");
    expect(Array.isArray(invalid.error.validationErrors)).toBeTrue();

    harness.repository.dispose();
  });
});
