import { describe, expect, it } from "bun:test";
import {
  ImageManipulationExecutionBackendHealthStates,
  type IImageManipulationExecutionCapabilityPort,
} from "../ports";
import {
  GetImageManipulationExecutionReadinessUseCase,
  ImageManipulationExecutionReadinessStates,
} from "../GetImageManipulationExecutionReadinessUseCase";

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
    });

    const readiness = await useCase.execute({
      workspaceId: "workspace-alpha",
      operationKind: "image-to-image",
      translationContractVersion: "1.0.0",
    });

    expect(readiness.readiness).toBe(ImageManipulationExecutionReadinessStates.ready);
    expect(readiness.readyForExecution).toBeTrue();
    expect(readiness.issues).toHaveLength(0);
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
  });
});
