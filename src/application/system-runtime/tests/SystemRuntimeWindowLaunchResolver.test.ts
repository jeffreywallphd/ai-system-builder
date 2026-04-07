import { describe, expect, it } from "bun:test";
import { ImageManipulationSystemTemplate } from "../../system-studio/ImageManipulationSystemTemplate";
import {
  ComfyRuntimeSystemDiagnosticsVersion,
  ComfyRuntimeSystemReadinessStates,
} from "../../runtime/ComfyRuntimeSystemDiagnostics";
import {
  createImageManipulationRuntimeWindowLaunchContract,
  createImageManipulationRuntimeWindowLaunchRequest,
} from "../SystemRuntimeWindowLaunchResolver";

describe("SystemRuntimeWindowLaunchResolver", () => {
  it("builds an image manipulation launch contract with reusable logical bindings", () => {
    const contract = createImageManipulationRuntimeWindowLaunchContract({
      studioId: "system-studio",
      draftId: "draft-image-1",
      sessionId: "session-1",
      systemAssetId: ImageManipulationSystemTemplate.systemAsset.assetId,
    });

    expect(contract.launchTarget.pageBindingId).toBe(ImageManipulationSystemTemplate.compositionBindings.pageBindingId);
    expect(contract.launchTarget.runtimeBindingId).toBe(ImageManipulationSystemTemplate.compositionBindings.runtimeBindingId);
    expect(contract.datasetBindings.map((entry) => entry.bindingId)).toEqual([
      "input-image-dataset",
      "output-image-dataset",
      "reference-image-dataset",
    ]);
    expect(contract.datasetBindings.every((entry) => entry.sharingScope === "shared")).toBeTrue();
    expect(contract.datasetBindings.map((entry) => entry.datasetAssetId)).toEqual(
      ImageManipulationSystemTemplate.datasetInstances.map((entry) => entry.datasetAssetId),
    );
    expect(contract.initialSelection.selectedDatasetBindingId).toBe("input-image-dataset");
    expect(contract.windowIntent.reuseWindowKey).toBe("system-studio:system-page:image-manipulation");
  });

  it("carries structured runtime diagnostics into launch runtime context payload", () => {
    const diagnostics = {
      diagnosticsVersion: ComfyRuntimeSystemDiagnosticsVersion,
      generatedAt: "2026-04-03T12:00:00.000Z",
      runtimeDependencyId: "runtime:comfyui",
      runtimeAssetId: "asset:config-profile:comfyui-runtime-installation",
      runtimeAssetVersionId: "asset:config-profile:comfyui-runtime-installation:v1",
      workflowProfile: "image-manipulation-default",
      orchestrationState: "partial",
      readiness: {
        state: ComfyRuntimeSystemReadinessStates.partiallyConfigured,
        recoverable: true,
        summary: "partially configured",
        reasons: ["installer-reported-partial-state"],
      },
      repository: {
        stateBefore: "installed",
        stateAfter: "installed",
        operation: "updated",
        installLocationKey: "runtime-comfyui",
        installDirectory: "/runtime/comfy",
        validationValid: true,
      },
      phaseStatus: {
        environment: "completed",
      },
      runtimeLifecycle: {
        state: "healthy",
      },
      persistedStateRecovery: {
        loaded: true,
        recovered: false,
        reconciliation: "match",
      },
      validationFailures: [],
      nextActions: [],
      failures: [],
      phaseDiagnostics: [],
    } as const;
    const contract = createImageManipulationRuntimeWindowLaunchContract({
      studioId: "system-studio",
      draftId: "draft-image-1",
      systemAssetId: ImageManipulationSystemTemplate.systemAsset.assetId,
      runtimeDiagnostics: diagnostics,
    });

    expect(contract.runtimeContextPayload.runtimeDiagnostics).toEqual(diagnostics);
  });

  it("returns a launch request envelope for bridge transport", () => {
    const request = createImageManipulationRuntimeWindowLaunchRequest({
      studioId: "system-studio",
      draftId: "draft-image-1",
      systemAssetId: ImageManipulationSystemTemplate.systemAsset.assetId,
      initialSelection: {
        activePreviewRole: "reference",
        selectedRecordIds: {
          "reference-image-dataset": "record-ref-1",
        },
      },
    });

    expect(request.launchContract.initialSelection.activePreviewRole).toBe("reference");
    expect(request.launchContract.initialSelection.selectedRecordIds["reference-image-dataset"]).toBe("record-ref-1");
  });
});
