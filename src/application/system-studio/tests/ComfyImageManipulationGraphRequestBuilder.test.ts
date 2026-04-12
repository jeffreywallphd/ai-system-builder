import { describe, expect, it } from "bun:test";
import { ImageManipulationWorkflowTemplate } from "../../workflow-template-studio/ImageManipulationWorkflowTemplate";
import { ComfyImageManipulationBaseGraph } from "../ComfyImageManipulationBaseGraph";
import { createComfyImageManipulationDefaultConfig } from "../ComfyImageManipulationPropertySchema";
import { buildComfyImageManipulationExecutionSubmission } from "../ComfyImageManipulationGraphRequestBuilder";
import { ComfyImageManipulationExecutionContractVersion } from "../ComfyImageManipulationExecutionAdapterContract";

describe("ComfyImageManipulationGraphRequestBuilder", () => {
  it("builds a runnable inspectable Comfy prompt graph for the default template", () => {
    const submission = buildComfyImageManipulationExecutionSubmission({
      contractVersion: ComfyImageManipulationExecutionContractVersion,
      workflowTemplate: ImageManipulationWorkflowTemplate,
      baseGraph: ComfyImageManipulationBaseGraph,
      resolvedConfig: createComfyImageManipulationDefaultConfig(),
      datasetHandles: [
        {
          kind: "dataset-instance",
          referenceId: "input-image-dataset",
          instanceId: "dataset-instance-ref:reference-image:input",
          storageInstanceRef: "storage-instance://runtime-image-store",
        },
      ],
      runtimeMetadata: {
        executionId: "exec-image-1",
        systemAssetId: "asset:system:reference-image-manipulation",
        runtimeProfile: "comfyui",
      },
      runtimeEnvironment: {
        apiBaseUrl: "http://127.0.0.1:8188",
      },
    });

    expect(submission.executionRequestId).toBe("exec-image-1");
    expect(submission.graph.prompt["1"]?.class_type).toBe("CheckpointLoaderSimple");
    expect(submission.graph.prompt["6"]?.inputs.steps).toBeGreaterThan(0);
    expect(submission.graph.prompt["2"]?.inputs.image).toBe("dataset-instance://dataset-instance-ref%3Areference-image%3Ainput");
    expect(submission.graph.outputNodeIds).toEqual(["8"]);
    expect(submission.materializationBindings.length).toBeGreaterThan(0);
    expect(submission.inspection.executionPath).toBe("non-faceid");
    expect(submission.inspection.runtimeResolution.runtimeProfile).toBe("comfyui");
    expect(submission.inspection.extensionBindings.some((entry) => entry.bindingId === "binding.generation.width-extension")).toBeTrue();
  });

  it("uses the FaceID execution path when enabled", () => {
    const config = {
      ...createComfyImageManipulationDefaultConfig(),
      faceId: {
        enabled: true,
        referenceBindings: [{ datasetBindingId: "faceid-reference", datasetAssetId: "asset:dataset:image-faceid-reference" }],
        weight: 0.8,
        startStepFraction: 0,
        endStepFraction: 1,
      },
    };

    const submission = buildComfyImageManipulationExecutionSubmission({
      contractVersion: ComfyImageManipulationExecutionContractVersion,
      workflowTemplate: ImageManipulationWorkflowTemplate,
      baseGraph: ComfyImageManipulationBaseGraph,
      resolvedConfig: config,
      datasetHandles: [
        {
          kind: "dataset-instance",
          referenceId: "input-image-dataset",
          instanceId: "dataset-instance-ref:reference-image:input",
        },
      ],
      runtimeMetadata: {},
      runtimeEnvironment: {
        apiBaseUrl: "http://127.0.0.1:8188",
      },
    });

    expect(submission.inspection.executionPath).toBe("faceid");
    expect((submission.inspection.subworkflowBindings?.[0] as { enabled?: boolean } | undefined)?.enabled).toBeTrue();
  });

  it("validates FaceID dependencies only when FaceID is enabled", () => {
    const config = {
      ...createComfyImageManipulationDefaultConfig(),
      faceId: {
        enabled: true,
        referenceBindings: [],
        weight: 0.8,
        startStepFraction: 0,
        endStepFraction: 1,
      },
    };

    expect(() => buildComfyImageManipulationExecutionSubmission({
      contractVersion: ComfyImageManipulationExecutionContractVersion,
      workflowTemplate: ImageManipulationWorkflowTemplate,
      baseGraph: ComfyImageManipulationBaseGraph,
      resolvedConfig: config,
      datasetHandles: [
        {
          kind: "dataset-instance",
          referenceId: "input-image-dataset",
          instanceId: "dataset-instance-ref:reference-image:input",
        },
      ],
      runtimeMetadata: {},
      runtimeEnvironment: {
        apiBaseUrl: "http://127.0.0.1:8188",
      },
    })).toThrow();
  });

  it("keeps public request binding values logical and path-safe", () => {
    expect(() => buildComfyImageManipulationExecutionSubmission({
      contractVersion: ComfyImageManipulationExecutionContractVersion,
      workflowTemplate: ImageManipulationWorkflowTemplate,
      baseGraph: ComfyImageManipulationBaseGraph,
      resolvedConfig: createComfyImageManipulationDefaultConfig(),
      datasetHandles: [
        {
          kind: "dataset-instance",
          referenceId: "input-image-dataset",
          instanceId: "../../unsafe/path.png",
        },
      ],
      runtimeMetadata: {},
      runtimeEnvironment: {
        apiBaseUrl: "http://127.0.0.1:8188",
      },
    })).toThrow();
  });

  it("rejects unsupported execution contract versions", () => {
    expect(() => buildComfyImageManipulationExecutionSubmission({
      contractVersion: "0.9.0",
      workflowTemplate: ImageManipulationWorkflowTemplate,
      baseGraph: ComfyImageManipulationBaseGraph,
      resolvedConfig: createComfyImageManipulationDefaultConfig(),
      datasetHandles: [
        {
          kind: "dataset-instance",
          referenceId: "input-image-dataset",
          instanceId: "dataset-instance-ref:reference-image:input",
        },
      ],
      runtimeMetadata: {},
      runtimeEnvironment: {
        apiBaseUrl: "http://127.0.0.1:8188",
      },
    })).toThrow("Unsupported Comfy image manipulation execution contract version");
  });
});
