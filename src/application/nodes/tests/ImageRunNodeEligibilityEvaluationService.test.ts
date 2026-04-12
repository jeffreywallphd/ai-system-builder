import { describe, expect, it } from "bun:test";
import {
  createExecutionNodeRecord,
  ExecutionNodeActivationStatuses,
  type ExecutionNodeBackendReadinessState,
  ExecutionNodeBackendReadinessStates,
  ExecutionNodeHealthStatuses,
  ExecutionNodeTargetKinds,
  type ExecutionNodeRecord,
} from "@domain/nodes/ExecutionNodeDomain";
import {
  NodeApprovalStatuses,
  NodeRoleCapabilities,
  NodeTrustStates,
  NodeTypes,
  createNodeCapabilityProfile,
} from "@domain/nodes/NodeTrustDomain";
import { ExecutionNodeEligibilityDecisionKinds } from "@application/nodes/ports/ExecutionNodeManagementPorts";
import type { ExecutionNodeListQuery } from "@application/nodes/ports/ExecutionNodeManagementPorts";
import { ImageRunNodeEligibilityEvaluationService } from "@application/nodes/use-cases/ImageRunNodeEligibilityEvaluationService";

class InMemoryNodeRepository {
  public readonly records = new Map<string, ExecutionNodeRecord>();

  public async findExecutionNodeById(nodeId: string): Promise<ExecutionNodeRecord | undefined> {
    return this.records.get(nodeId);
  }

  public async listExecutionNodes(_query: ExecutionNodeListQuery): Promise<ReadonlyArray<ExecutionNodeRecord>> {
    return Object.freeze([...this.records.values()]);
  }
}

function createRunContext(input?: {
  readonly runId?: string;
  readonly operationKind?: string;
  readonly translationContractVersion?: string;
}) {
  return Object.freeze({
    runId: input?.runId ?? "run:image:001",
    workspaceId: "workspace:image",
    systemId: "system:image:alpha",
    workflowId: "workflow:image:restyle",
    operationKind: input?.operationKind ?? "image-to-image",
    translationContractVersion: input?.translationContractVersion ?? "1.0.0",
  });
}

function createExecutionNode(input?: {
  readonly nodeId?: string;
  readonly activationStatus?: ExecutionNodeRecord["activationStatus"];
  readonly healthStatus?: ExecutionNodeRecord["healthStatus"];
  readonly backendFamily?: string;
  readonly supportedOperationKinds?: ReadonlyArray<string>;
  readonly supportedOperationCapabilities?: ReadonlyArray<string>;
  readonly backendReadinessState?: ExecutionNodeBackendReadinessState;
}) {
  return createExecutionNodeRecord({
    nodeId: input?.nodeId ?? "node:image:001",
    displayName: "Image Execution Node",
    nodeType: NodeTypes.compute,
    capabilityProfile: createNodeCapabilityProfile({
      enabledCapabilities: [
        NodeRoleCapabilities.executor,
        NodeRoleCapabilities.storageAccess,
      ],
      supportsRemoteScheduling: true,
      maxConcurrentWorkloads: 4,
    }),
    backendFamilyCapabilities: [{
      backendFamily: input?.backendFamily ?? "comfyui",
      supportedExecutionTargets: [ExecutionNodeTargetKinds.imageManipulation],
      supportedOperationKinds: input?.supportedOperationKinds ?? ["image-to-image"],
      supportedOperationCapabilities: input?.supportedOperationCapabilities ?? ["image.workflow.operation.image-to-image.execute"],
      supportedInputKinds: ["source-image"],
      supportedOutputKinds: ["generated-image"],
      supportedTranslationContractVersions: ["1.0.0"],
      executionReadiness: {
        state: input?.backendReadinessState ?? ExecutionNodeBackendReadinessStates.ready,
        checkedAt: "2026-04-08T12:00:00.000Z",
      },
    }],
    approvalStatus: NodeApprovalStatuses.approved,
    trustState: NodeTrustStates.trusted,
    activationStatus: input?.activationStatus ?? ExecutionNodeActivationStatuses.active,
    healthStatus: input?.healthStatus ?? ExecutionNodeHealthStatuses.ready,
    availabilityOverride: {
      mode: "enabled",
      updatedAt: "2026-04-08T12:00:00.000Z",
    },
    deploymentTags: ["region-east"],
    endpoint: {
      endpointRef: "node://image-001",
    },
    certificateRef: "cert:node:image:001",
    lastSeenAt: "2026-04-08T12:00:00.000Z",
    metadata: {},
    createdAt: "2026-04-08T12:00:00.000Z",
    updatedAt: "2026-04-08T12:00:00.000Z",
  });
}

describe("ImageRunNodeEligibilityEvaluationService", () => {
  it("returns eligible when node satisfies run requirements", async () => {
    const repository = new InMemoryNodeRepository();
    repository.records.set("node:image:001", createExecutionNode());

    const service = new ImageRunNodeEligibilityEvaluationService({
      nodeRepository: repository,
    });

    const result = await service.evaluateRunToNodeEligibility({
      asOf: "2026-04-08T12:05:00.000Z",
      run: createRunContext(),
      nodeId: "node:image:001",
      requirements: {
        requiredBackendFamilies: ["comfyui"],
        requiredExecutionTarget: "image-manipulation",
        requiredOperationKind: "image-to-image",
        requiredInputKinds: ["source-image"],
        requiredOutputKinds: ["generated-image"],
        requiredTranslationContractVersion: "1.0.0",
        requiresRemoteScheduling: true,
      },
    });

    expect(result.eligible).toBeTrue();
    expect(result.decision).toBe(ExecutionNodeEligibilityDecisionKinds.eligible);
    expect(result.summary.blockingReasonCodes).toEqual([]);
  });

  it("returns incompatible for obvious backend-family mismatch", async () => {
    const repository = new InMemoryNodeRepository();
    repository.records.set("node:image:001", createExecutionNode({
      backendFamily: "custom-backend",
    }));

    const service = new ImageRunNodeEligibilityEvaluationService({
      nodeRepository: repository,
    });

    const result = await service.evaluateRunToNodeEligibility({
      asOf: "2026-04-08T12:05:00.000Z",
      run: createRunContext(),
      nodeId: "node:image:001",
      requirements: {
        requiredBackendFamilies: ["comfyui"],
      },
    });

    expect(result.eligible).toBeFalse();
    expect(result.decision).toBe(ExecutionNodeEligibilityDecisionKinds.incompatible);
    expect(result.summary.blockingReasonCodes).toContain("node-backend-family-unsupported");
  });

  it("returns unavailable for transient health posture even when compatibility is satisfied", async () => {
    const repository = new InMemoryNodeRepository();
    repository.records.set("node:image:001", createExecutionNode({
      healthStatus: ExecutionNodeHealthStatuses.unknown,
    }));

    const service = new ImageRunNodeEligibilityEvaluationService({
      nodeRepository: repository,
    });

    const result = await service.evaluateRunToNodeEligibility({
      asOf: "2026-04-08T12:05:00.000Z",
      run: createRunContext(),
      nodeId: "node:image:001",
      requirements: {
        requiredBackendFamilies: ["comfyui"],
      },
    });

    expect(result.eligible).toBeFalse();
    expect(result.compatible).toBeTrue();
    expect(result.routable).toBeFalse();
    expect(result.decision).toBe(ExecutionNodeEligibilityDecisionKinds.unavailable);
    expect(result.summary.transientAvailabilityReasonCodes).toContain("node-health-not-routable");
  });

  it("keeps degraded nodes eligible when policy allows degraded routing and emits advisories", async () => {
    const repository = new InMemoryNodeRepository();
    repository.records.set("node:image:001", createExecutionNode({
      activationStatus: ExecutionNodeActivationStatuses.degraded,
      healthStatus: ExecutionNodeHealthStatuses.degraded,
      backendReadinessState: ExecutionNodeBackendReadinessStates.degraded,
    }));

    const service = new ImageRunNodeEligibilityEvaluationService({
      nodeRepository: repository,
    });

    const result = await service.evaluateRunToNodeEligibility({
      asOf: "2026-04-08T12:05:00.000Z",
      run: createRunContext(),
      nodeId: "node:image:001",
      requirements: {
        requiredBackendFamilies: ["comfyui"],
        allowDegraded: true,
      },
    });

    expect(result.eligible).toBeTrue();
    expect(result.decision).toBe(ExecutionNodeEligibilityDecisionKinds.eligible);
    expect(result.summary.advisoryReasonCodes).toContain("backend-readiness-degraded");
  });

  it("applies workflow compatibility hints when explicit requirements are omitted", async () => {
    const repository = new InMemoryNodeRepository();
    repository.records.set("node:image:001", createExecutionNode({
      supportedOperationCapabilities: [],
    }));

    const service = new ImageRunNodeEligibilityEvaluationService({
      nodeRepository: repository,
    });

    const result = await service.evaluateRunToNodeEligibility({
      asOf: "2026-04-08T12:05:00.000Z",
      run: createRunContext(),
      nodeId: "node:image:001",
      requirements: {
        compatibilityHints: {
          requiredOperationCapability: "image.workflow.operation.image-to-image.execute",
          translationBackendFamilies: ["comfyui"],
          readinessChecks: {
            operationCapability: true,
            translationBackendFamily: true,
          },
        },
      },
    });

    expect(result.eligible).toBeFalse();
    expect(result.decision).toBe(ExecutionNodeEligibilityDecisionKinds.incompatible);
    expect(result.summary.blockingReasonCodes).toContain("backend-operation-capability-missing");
  });
});
