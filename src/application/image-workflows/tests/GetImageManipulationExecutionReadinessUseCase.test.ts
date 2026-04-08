import { describe, expect, it } from "bun:test";
import {
  ImageManipulationExecutionBackendHealthStates,
  type IImageManipulationExecutionCapabilityPort,
} from "../ports";
import {
  GetImageManipulationExecutionReadinessUseCase,
  ImageManipulationExecutionNodeAvailabilityStates,
  ImageManipulationExecutionReadinessStates,
} from "../GetImageManipulationExecutionReadinessUseCase";
import { ImageManipulationResilienceStateKinds } from "@shared/contracts/image-workflows/ImageManipulationResilienceStateContracts";
import {
  type ExecutionNodeEligibilityDecisionKind,
  ExecutionNodeEligibilityDecisionKinds,
  type ImageRunExecutionNodeSelectionOutcome,
  ImageRunExecutionNodeSelectionOutcomes,
  type IImageRunExecutionNodeSelectionServicePort,
} from "@application/nodes/ports/ExecutionNodeManagementPorts";

function createNodeSelectionService(input: {
  readonly outcome: ImageRunExecutionNodeSelectionOutcome;
  readonly candidates?: ReadonlyArray<{
    readonly nodeId: string;
    readonly decision: ExecutionNodeEligibilityDecisionKind;
    readonly eligible: boolean;
    readonly blockingReasonCodes?: ReadonlyArray<string>;
    readonly advisoryReasonCodes?: ReadonlyArray<string>;
    readonly transientAvailabilityReasonCodes?: ReadonlyArray<string>;
  }>;
  readonly selectedNodeId?: string;
}): Pick<IImageRunExecutionNodeSelectionServicePort, "selectExecutionNodeForRun"> {
  return Object.freeze({
    selectExecutionNodeForRun: async () => Object.freeze({
      run: Object.freeze({
        runId: "run:readiness",
        workspaceId: "workspace-alpha",
      }),
      asOf: "2026-04-08T12:10:00.000Z",
      strategyId: "test",
      outcome: input.outcome,
      selectedNodeId: input.selectedNodeId,
      selectedCandidate: input.selectedNodeId
        ? Object.freeze({
          nodeId: input.selectedNodeId,
          rank: 1,
          decision: ExecutionNodeEligibilityDecisionKinds.eligible,
          eligible: true,
          blockingReasonCodes: Object.freeze([]),
          advisoryReasonCodes: Object.freeze([]),
          transientAvailabilityReasonCodes: Object.freeze([]),
        })
        : undefined,
      reasons: Object.freeze([]),
      candidates: Object.freeze((input.candidates ?? []).map((candidate, index) => Object.freeze({
        nodeId: candidate.nodeId,
        rank: index + 1,
        decision: candidate.decision,
        eligible: candidate.eligible,
        blockingReasonCodes: Object.freeze([...(candidate.blockingReasonCodes ?? [])]),
        advisoryReasonCodes: Object.freeze([...(candidate.advisoryReasonCodes ?? [])]),
        transientAvailabilityReasonCodes: Object.freeze([...(candidate.transientAvailabilityReasonCodes ?? [])]),
      }))),
    }),
  });
}

describe("GetImageManipulationExecutionReadinessUseCase", () => {
  it("returns unavailable readiness when capability adapter is not configured", async () => {
    const useCase = new GetImageManipulationExecutionReadinessUseCase({
      now: () => new Date("2026-04-08T12:00:00.000Z"),
    });

    const readiness = await useCase.execute({
      workspaceId: "workspace-alpha",
    });

    expect(readiness.readiness).toBe(ImageManipulationExecutionReadinessStates.unavailable);
    expect(readiness.readyForExecution).toBeFalse();
    expect(readiness.issues[0]?.code).toBe("execution-adapter-not-configured");
    expect(readiness.resilience.state).toBe(ImageManipulationResilienceStateKinds.unavailable);
  });

  it("normalizes healthy adapter responses into actionable readiness", async () => {
    const capabilityPort: IImageManipulationExecutionCapabilityPort = {
      getExecutionBackendStatus: async () => Object.freeze({
        backendFamily: "adapter.comfyui.image-manipulation",
        health: ImageManipulationExecutionBackendHealthStates.healthy,
        checkedAt: "2026-04-08T12:10:00.000Z",
        message: "healthy",
        capabilities: Object.freeze({
          backendFamily: "adapter.comfyui.image-manipulation",
          supportsProgressPolling: true,
          supportsProgressStreaming: false,
          supportsCancellation: true,
          supportsOutputDiscovery: true,
          supportedOperationKinds: Object.freeze(["image-to-image"]),
          supportedTranslationContractVersions: Object.freeze(["1.0.0"]),
        }),
        diagnostics: Object.freeze({}),
      }),
    };

    const useCase = new GetImageManipulationExecutionReadinessUseCase({
      capabilityPort,
      nodeSelectionService: createNodeSelectionService({
        outcome: ImageRunExecutionNodeSelectionOutcomes.selected,
        selectedNodeId: "node:image:001",
        candidates: Object.freeze([Object.freeze({
          nodeId: "node:image:001",
          decision: ExecutionNodeEligibilityDecisionKinds.eligible,
          eligible: true,
        })]),
      }),
    });

    const readiness = await useCase.execute({
      workspaceId: "workspace-alpha",
      operationKind: "image-to-image",
      translationContractVersion: "1.0.0",
    });

    expect(readiness.readiness).toBe(ImageManipulationExecutionReadinessStates.ready);
    expect(readiness.readyForExecution).toBeTrue();
    expect(readiness.issues).toHaveLength(0);
    expect(readiness.nodeAvailability.state).toBe(ImageManipulationExecutionNodeAvailabilityStates.available);
    expect(readiness.nodeAvailability.selectedNodeId).toBe("node:image:001");
    expect(readiness.resilience.state).toBe(ImageManipulationResilienceStateKinds.healthy);
  });

  it("flags compatibility mismatches as degraded and non-actionable", async () => {
    const capabilityPort: IImageManipulationExecutionCapabilityPort = {
      getExecutionBackendStatus: async () => Object.freeze({
        backendFamily: "adapter.comfyui.image-manipulation",
        health: ImageManipulationExecutionBackendHealthStates.healthy,
        checkedAt: "2026-04-08T12:10:00.000Z",
        capabilities: Object.freeze({
          backendFamily: "adapter.comfyui.image-manipulation",
          supportsProgressPolling: true,
          supportsProgressStreaming: false,
          supportsCancellation: true,
          supportsOutputDiscovery: true,
          supportedOperationKinds: Object.freeze(["image-to-image"]),
          supportedTranslationContractVersions: Object.freeze(["1.0.0"]),
        }),
      }),
    };

    const useCase = new GetImageManipulationExecutionReadinessUseCase({
      capabilityPort,
      nodeSelectionService: createNodeSelectionService({
        outcome: ImageRunExecutionNodeSelectionOutcomes.selected,
        selectedNodeId: "node:image:001",
      }),
    });

    const readiness = await useCase.execute({
      workspaceId: "workspace-alpha",
      operationKind: "enhance-upscale",
      translationContractVersion: "2.0.0",
    });

    expect(readiness.readiness).toBe(ImageManipulationExecutionReadinessStates.degraded);
    expect(readiness.readyForExecution).toBeFalse();
    expect(readiness.issues.map((issue) => issue.code)).toEqual([
      "operation-kind-unsupported",
      "translation-contract-version-unsupported",
    ]);
    expect(readiness.nodeAvailability.state).toBe(ImageManipulationExecutionNodeAvailabilityStates.unknown);
    expect(readiness.nodeAvailability.reasonCode).toBe("node-availability-evaluation-skipped-backend-blocking");
    expect(readiness.resilience.state).toBe(ImageManipulationResilienceStateKinds.blocked);
  });

  it("returns degraded readiness when no eligible execution node is currently routable", async () => {
    const capabilityPort: IImageManipulationExecutionCapabilityPort = {
      getExecutionBackendStatus: async () => Object.freeze({
        backendFamily: "adapter.comfyui.image-manipulation",
        health: ImageManipulationExecutionBackendHealthStates.healthy,
        checkedAt: "2026-04-08T12:10:00.000Z",
        capabilities: Object.freeze({
          backendFamily: "adapter.comfyui.image-manipulation",
          supportsProgressPolling: true,
          supportsProgressStreaming: false,
          supportsCancellation: true,
          supportsOutputDiscovery: true,
          supportedOperationKinds: Object.freeze(["image-to-image"]),
          supportedTranslationContractVersions: Object.freeze(["1.0.0"]),
        }),
      }),
    };

    const useCase = new GetImageManipulationExecutionReadinessUseCase({
      capabilityPort,
      nodeSelectionService: createNodeSelectionService({
        outcome: ImageRunExecutionNodeSelectionOutcomes.noEligibleNode,
        candidates: Object.freeze([
          Object.freeze({
            nodeId: "node:image:001",
            decision: ExecutionNodeEligibilityDecisionKinds.unavailable,
            eligible: false,
            blockingReasonCodes: Object.freeze(["node-health-not-routable"]),
            transientAvailabilityReasonCodes: Object.freeze(["node-health-not-routable"]),
          }),
          Object.freeze({
            nodeId: "node:image:002",
            decision: ExecutionNodeEligibilityDecisionKinds.incompatible,
            eligible: false,
            blockingReasonCodes: Object.freeze(["node-backend-family-unsupported"]),
          }),
        ]),
      }),
    });

    const readiness = await useCase.execute({
      workspaceId: "workspace-alpha",
      operationKind: "image-to-image",
      translationContractVersion: "1.0.0",
    });

    expect(readiness.readiness).toBe(ImageManipulationExecutionReadinessStates.degraded);
    expect(readiness.readyForExecution).toBeFalse();
    expect(readiness.nodeAvailability.state).toBe(ImageManipulationExecutionNodeAvailabilityStates.constrained);
    expect(readiness.nodeAvailability.reasonCode).toBe("execution-node-no-eligible-match");
    expect(readiness.issues.map((issue) => issue.code)).toContain("execution-node-no-eligible-match");
    expect(readiness.resilience.blockedConditions.map((entry) => entry.code)).toContain("execution-node-no-eligible-match");
  });
});
