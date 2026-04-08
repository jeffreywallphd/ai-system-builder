import { describe, expect, it } from "bun:test";
import {
  createExecutionNodeRecord,
  ExecutionNodeActivationStatuses,
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
import { ImageRunExecutionNodeSelectionOutcomes } from "@application/nodes/ports/ExecutionNodeManagementPorts";
import type { ExecutionNodeListQuery } from "@application/nodes/ports/ExecutionNodeManagementPorts";
import { ImageRunNodeEligibilityEvaluationService } from "@application/nodes/use-cases/ImageRunNodeEligibilityEvaluationService";
import { ImageRunExecutionNodeSelectionService } from "@application/nodes/use-cases/ImageRunExecutionNodeSelectionService";

class InMemoryNodeRepository {
  public readonly records = new Map<string, ExecutionNodeRecord>();

  public async findExecutionNodeById(nodeId: string): Promise<ExecutionNodeRecord | undefined> {
    return this.records.get(nodeId);
  }

  public async listExecutionNodes(_query: ExecutionNodeListQuery): Promise<ReadonlyArray<ExecutionNodeRecord>> {
    return Object.freeze([...this.records.values()]);
  }
}

function createRunContext() {
  return Object.freeze({
    runId: "run:image:selection",
    workspaceId: "workspace:image",
    systemId: "system:image:alpha",
    workflowId: "workflow:image:restyle",
    operationKind: "image-to-image",
    translationContractVersion: "1.0.0",
  });
}

function createExecutionNode(input: {
  readonly nodeId: string;
  readonly backendFamily?: string;
  readonly healthStatus?: ExecutionNodeRecord["healthStatus"];
  readonly activationStatus?: ExecutionNodeRecord["activationStatus"];
  readonly backendReadinessState?: "ready" | "degraded" | "unavailable" | "unknown";
}): ExecutionNodeRecord {
  return createExecutionNodeRecord({
    nodeId: input.nodeId,
    displayName: `Image Node ${input.nodeId}`,
    nodeType: NodeTypes.compute,
    capabilityProfile: createNodeCapabilityProfile({
      enabledCapabilities: [
        NodeRoleCapabilities.executor,
        NodeRoleCapabilities.storageAccess,
      ],
      supportsRemoteScheduling: true,
      maxConcurrentWorkloads: 4,
    }),
    backendFamilyCapabilities: [Object.freeze({
      backendFamily: input.backendFamily ?? "comfyui",
      supportedExecutionTargets: [ExecutionNodeTargetKinds.imageManipulation],
      supportedOperationKinds: ["image-to-image"],
      supportedInputKinds: ["source-image"],
      supportedOutputKinds: ["generated-image"],
      supportedTranslationContractVersions: ["1.0.0"],
      executionReadiness: Object.freeze({
        state: input.backendReadinessState ?? ExecutionNodeBackendReadinessStates.ready,
        checkedAt: "2026-04-08T12:00:00.000Z",
      }),
    })],
    approvalStatus: NodeApprovalStatuses.approved,
    trustState: NodeTrustStates.trusted,
    activationStatus: input.activationStatus ?? ExecutionNodeActivationStatuses.active,
    healthStatus: input.healthStatus ?? ExecutionNodeHealthStatuses.ready,
    availabilityOverride: Object.freeze({
      mode: "enabled",
      updatedAt: "2026-04-08T12:00:00.000Z",
    }),
    deploymentTags: ["region-east"],
    endpoint: Object.freeze({
      endpointRef: `node://${input.nodeId}`,
    }),
    certificateRef: `cert:${input.nodeId}`,
    lastSeenAt: "2026-04-08T12:00:00.000Z",
    metadata: {},
    createdAt: "2026-04-08T12:00:00.000Z",
    updatedAt: "2026-04-08T12:00:00.000Z",
  });
}

describe("ImageRunExecutionNodeSelectionService", () => {
  it("selects deterministically from multiple eligible nodes by advisory and finding weight", async () => {
    const repository = new InMemoryNodeRepository();
    repository.records.set("node-beta", createExecutionNode({
      nodeId: "node-beta",
      backendReadinessState: ExecutionNodeBackendReadinessStates.degraded,
      activationStatus: ExecutionNodeActivationStatuses.degraded,
      healthStatus: ExecutionNodeHealthStatuses.degraded,
    }));
    repository.records.set("node-alpha", createExecutionNode({
      nodeId: "node-alpha",
    }));

    const eligibilityService = new ImageRunNodeEligibilityEvaluationService({
      nodeRepository: repository,
    });
    const selectionService = new ImageRunExecutionNodeSelectionService({
      eligibilityService,
    });

    const decision = await selectionService.selectExecutionNodeForRun({
      asOf: "2026-04-08T12:05:00.000Z",
      run: createRunContext(),
      requirements: {
        requiredBackendFamilies: ["comfyui"],
        requiredExecutionTarget: "image-manipulation",
        requiredOperationKind: "image-to-image",
        allowDegraded: true,
      },
    });

    expect(decision.outcome).toBe(ImageRunExecutionNodeSelectionOutcomes.selected);
    expect(decision.selectedNodeId).toBe("node-alpha");
    expect(decision.candidates).toHaveLength(2);
    expect(decision.candidates[0]?.nodeId).toBe("node-alpha");
    expect(decision.candidates[1]?.nodeId).toBe("node-beta");
  });

  it("uses nodeId tie-break ordering when eligible candidates have identical findings", async () => {
    const repository = new InMemoryNodeRepository();
    repository.records.set("node-zulu", createExecutionNode({
      nodeId: "node-zulu",
    }));
    repository.records.set("node-alpha", createExecutionNode({
      nodeId: "node-alpha",
    }));

    const eligibilityService = new ImageRunNodeEligibilityEvaluationService({
      nodeRepository: repository,
    });
    const selectionService = new ImageRunExecutionNodeSelectionService({
      eligibilityService,
    });

    const decision = await selectionService.selectExecutionNodeForRun({
      asOf: "2026-04-08T12:05:00.000Z",
      run: createRunContext(),
      requirements: {
        requiredBackendFamilies: ["comfyui"],
      },
    });

    expect(decision.outcome).toBe(ImageRunExecutionNodeSelectionOutcomes.selected);
    expect(decision.selectedNodeId).toBe("node-alpha");
    expect(decision.candidates[0]?.nodeId).toBe("node-alpha");
    expect(decision.candidates[1]?.nodeId).toBe("node-zulu");
  });

  it("returns no-eligible-node with structured reasons when all candidates are incompatible or unavailable", async () => {
    const repository = new InMemoryNodeRepository();
    repository.records.set("node-unavailable", createExecutionNode({
      nodeId: "node-unavailable",
      activationStatus: ExecutionNodeActivationStatuses.unavailable,
      healthStatus: ExecutionNodeHealthStatuses.unavailable,
    }));
    repository.records.set("node-backend-mismatch", createExecutionNode({
      nodeId: "node-backend-mismatch",
      backendFamily: "custom-runtime",
    }));

    const eligibilityService = new ImageRunNodeEligibilityEvaluationService({
      nodeRepository: repository,
    });
    const selectionService = new ImageRunExecutionNodeSelectionService({
      eligibilityService,
    });

    const decision = await selectionService.selectExecutionNodeForRun({
      asOf: "2026-04-08T12:05:00.000Z",
      run: createRunContext(),
      requirements: {
        requiredBackendFamilies: ["comfyui"],
      },
    });

    expect(decision.outcome).toBe(ImageRunExecutionNodeSelectionOutcomes.noEligibleNode);
    expect(decision.selectedNodeId).toBeUndefined();
    expect(decision.candidates).toHaveLength(2);
    expect(decision.reasons[0]?.code).toBe(ImageRunExecutionNodeSelectionOutcomes.noEligibleNode);
  });

  it("returns no-candidate-nodes when candidate filters resolve to no known nodes", async () => {
    const repository = new InMemoryNodeRepository();
    repository.records.set("node-available", createExecutionNode({
      nodeId: "node-available",
    }));

    const eligibilityService = new ImageRunNodeEligibilityEvaluationService({
      nodeRepository: repository,
    });
    const selectionService = new ImageRunExecutionNodeSelectionService({
      eligibilityService,
    });

    const decision = await selectionService.selectExecutionNodeForRun({
      asOf: "2026-04-08T12:05:00.000Z",
      run: createRunContext(),
      candidateNodeIds: ["node-unknown"],
    });

    expect(decision.outcome).toBe(ImageRunExecutionNodeSelectionOutcomes.noCandidateNodes);
    expect(decision.selectedNodeId).toBeUndefined();
    expect(decision.candidates).toEqual([]);
  });
});
