import { describe, expect, it } from "bun:test";
import { ImageManipulationWorkflowTemplate } from "../../workflow-template-studio/ImageManipulationWorkflowTemplate";
import { ComfyImageManipulationBaseGraph } from "../ComfyImageManipulationBaseGraph";
import { createComfyImageManipulationDefaultConfig } from "../ComfyImageManipulationPropertySchema";
import {
  createComfyExecutionReadinessFailure,
  validateComfyImageManipulationExecutionReadiness,
} from "../ComfyImageManipulationExecutionValidation";
import { ComfyImageManipulationExecutionContractVersion } from "../ComfyImageManipulationExecutionAdapterContract";

describe("ComfyImageManipulationExecutionValidation", () => {
  it("marks default template configuration execution-ready with no extra user input", () => {
    const result = validateComfyImageManipulationExecutionReadiness({
      contractVersion: ComfyImageManipulationExecutionContractVersion,
      workflowTemplate: ImageManipulationWorkflowTemplate,
      baseGraph: ComfyImageManipulationBaseGraph,
      resolvedConfig: createComfyImageManipulationDefaultConfig(),
      datasetHandles: [{
        kind: "dataset-instance",
        referenceId: "input-image-dataset",
        instanceId: "dataset-instance-ref:reference-image:input",
        storageInstanceRef: "storage-instance://shared-input",
      }],
      runtimeMetadata: {
        executionId: "exec-validation-ready",
      },
      runtimeEnvironment: {
        apiBaseUrl: "http://127.0.0.1:8188",
      },
    });

    expect(result.ready).toBeTrue();
    expect(result.executionPath).toBe("non-faceid");
    expect(result.issues.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(result.inspection.mappingResolved).toBeTrue();
    expect(result.inspection.datasetBindingResolved).toBeTrue();
    expect(result.runtimeResolution?.endpoint.apiBaseUrl).toBe("http://127.0.0.1:8188");
  });

  it("validates FaceID-only requirements only when FaceID is enabled", () => {
    const faceIdResult = validateComfyImageManipulationExecutionReadiness({
      contractVersion: ComfyImageManipulationExecutionContractVersion,
      workflowTemplate: ImageManipulationWorkflowTemplate,
      baseGraph: ComfyImageManipulationBaseGraph,
      resolvedConfig: {
        ...createComfyImageManipulationDefaultConfig(),
        faceId: {
          enabled: true,
          referenceBindings: [],
          weight: 0.8,
          startStepFraction: 0,
          endStepFraction: 1,
        },
      },
      datasetHandles: [{
        kind: "dataset-instance",
        referenceId: "input-image-dataset",
        instanceId: "dataset-instance-ref:reference-image:input",
      }],
      runtimeMetadata: {
        executionId: "exec-validation-faceid-missing",
      },
      runtimeEnvironment: {
        apiBaseUrl: "http://127.0.0.1:8188",
      },
    });

    expect(faceIdResult.ready).toBeFalse();
    expect(faceIdResult.executionPath).toBe("faceid");
    expect(faceIdResult.issues.some((issue) => issue.code === "faceid-reference-binding-missing")).toBeTrue();

    const nonFaceIdResult = validateComfyImageManipulationExecutionReadiness({
      contractVersion: ComfyImageManipulationExecutionContractVersion,
      workflowTemplate: ImageManipulationWorkflowTemplate,
      baseGraph: ComfyImageManipulationBaseGraph,
      resolvedConfig: createComfyImageManipulationDefaultConfig(),
      datasetHandles: [{
        kind: "dataset-instance",
        referenceId: "input-image-dataset",
        instanceId: "dataset-instance-ref:reference-image:input",
      }],
      runtimeMetadata: {
        executionId: "exec-validation-faceid-off",
      },
      runtimeEnvironment: {
        apiBaseUrl: "http://127.0.0.1:8188",
      },
    });

    expect(nonFaceIdResult.ready).toBeTrue();
    expect(nonFaceIdResult.issues.some((issue) => issue.code === "faceid-reference-binding-missing")).toBeFalse();
  });

  it("returns normalized execution-ready failure diagnostics", () => {
    const readiness = validateComfyImageManipulationExecutionReadiness({
      contractVersion: ComfyImageManipulationExecutionContractVersion,
      workflowTemplate: {
        ...ImageManipulationWorkflowTemplate,
        composition: {
          ...ImageManipulationWorkflowTemplate.composition!,
          outputBindings: [],
        },
      },
      baseGraph: ComfyImageManipulationBaseGraph,
      resolvedConfig: createComfyImageManipulationDefaultConfig(),
      datasetHandles: [{
        kind: "dataset-instance",
        referenceId: "input-image-dataset",
        instanceId: "dataset-instance-ref:reference-image:input",
      }],
      runtimeMetadata: {
        executionId: "exec-validation-failure",
      },
    });

    expect(readiness.ready).toBeFalse();
    const failure = createComfyExecutionReadinessFailure(readiness, "exec-validation-failure");
    expect(failure.error.code).toBe("invalid-request");
    expect(failure.error.category).toBe("validation");
    expect(((failure.error.details as { issues?: ReadonlyArray<{ code: string }> }).issues ?? []).length).toBeGreaterThan(0);
  });
});
