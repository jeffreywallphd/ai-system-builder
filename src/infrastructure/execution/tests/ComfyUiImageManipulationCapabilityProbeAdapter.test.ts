import { describe, expect, it } from "bun:test";
import { ImageManipulationExecutionBackendHealthStates } from "@application/image-workflows/ports";
import {
  ComfyUiBackendProbeStates,
  type ComfyUiBackendProbeResult,
} from "../comfyui/ComfyUiTransportClient";
import { ComfyUiImageManipulationCapabilityProbeAdapter } from "../comfyui/ComfyUiImageManipulationCapabilityProbeAdapter";

describe("ComfyUiImageManipulationCapabilityProbeAdapter", () => {
  it("maps ready probe results to healthy execution backend status", async () => {
    const adapter = new ComfyUiImageManipulationCapabilityProbeAdapter(createTransportStub(createProbeResult({
      state: ComfyUiBackendProbeStates.ready,
      message: "ready",
    })));

    const status = await adapter.getExecutionBackendStatus({
      workspaceId: "workspace-alpha",
      operationKind: "image-to-image",
      translationContractVersion: "1.0.0",
    });

    expect(status.health).toBe(ImageManipulationExecutionBackendHealthStates.healthy);
    expect(status.diagnostics?.["readinessState"]).toBe("ready");
    expect(status.capabilities.supportedOperationKinds).toContain("image-to-image");
  });

  it("maps degraded probe results to degraded backend health", async () => {
    const adapter = new ComfyUiImageManipulationCapabilityProbeAdapter(createTransportStub(createProbeResult({
      state: ComfyUiBackendProbeStates.degraded,
      message: "degraded",
    })));

    const status = await adapter.getExecutionBackendStatus({
      workspaceId: "workspace-alpha",
    });

    expect(status.health).toBe(ImageManipulationExecutionBackendHealthStates.degraded);
    expect(status.diagnostics?.["readinessState"]).toBe("degraded");
  });

  it("maps unavailable probe results to unavailable backend health", async () => {
    const adapter = new ComfyUiImageManipulationCapabilityProbeAdapter(createTransportStub(createProbeResult({
      state: ComfyUiBackendProbeStates.unavailable,
      message: "unavailable",
      reachable: false,
      responsive: false,
    })));

    const status = await adapter.getExecutionBackendStatus({
      workspaceId: "workspace-alpha",
    });

    expect(status.health).toBe(ImageManipulationExecutionBackendHealthStates.unavailable);
    expect(status.diagnostics?.["readinessState"]).toBe("unavailable");
  });

  it("reports incompatible readiness when requested operation or contract version is unsupported", async () => {
    const adapter = new ComfyUiImageManipulationCapabilityProbeAdapter(createTransportStub(createProbeResult({
      state: ComfyUiBackendProbeStates.ready,
      message: "ready",
    })));

    const status = await adapter.getExecutionBackendStatus({
      workspaceId: "workspace-alpha",
      operationKind: "video-restyle",
      translationContractVersion: "9.9.9",
    });

    expect(status.health).toBe(ImageManipulationExecutionBackendHealthStates.degraded);
    expect(status.diagnostics?.["readinessState"]).toBe("incompatible");
    const compatibility = status.diagnostics?.["compatibility"] as { issues?: ReadonlyArray<string> } | undefined;
    expect(compatibility?.issues).toContain("unsupported-operation-kind:video-restyle");
    expect(compatibility?.issues).toContain("unsupported-translation-contract-version:9.9.9");
  });
});

function createTransportStub(result: ComfyUiBackendProbeResult): {
  probeBackend: () => Promise<ComfyUiBackendProbeResult>;
} {
  return Object.freeze({
    probeBackend: async () => result,
  });
}

function createProbeResult(input: {
  readonly state: ComfyUiBackendProbeResult["state"];
  readonly message: string;
  readonly reachable?: boolean;
  readonly responsive?: boolean;
}): ComfyUiBackendProbeResult {
  return Object.freeze({
    checkedAt: "2026-04-08T14:00:00.000Z",
    state: input.state,
    reachable: input.reachable ?? true,
    responsive: input.responsive ?? true,
    message: input.message,
    capabilities: Object.freeze({
      supportsPromptSubmission: true,
      supportsQueueInspection: true,
      supportsPromptHistory: true,
      supportsCancellation: true,
      supportsCapabilityDiscovery: true,
      availableNodeTypes: Object.freeze(["LoadImage", "SaveImage"]),
      missingRequiredNodeTypes: Object.freeze([]),
    }),
    diagnostics: Object.freeze({ reason: "test" }),
  });
}
