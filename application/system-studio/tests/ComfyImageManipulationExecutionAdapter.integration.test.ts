import { describe, expect, it } from "bun:test";
import { ImageManipulationWorkflowTemplate } from "../../workflow-template-studio/ImageManipulationWorkflowTemplate";
import { ComfyImageManipulationBaseGraph } from "../ComfyImageManipulationBaseGraph";
import { createComfyImageManipulationDefaultConfig } from "../ComfyImageManipulationPropertySchema";
import type {
  ComfyImageManipulationExecutionSubmission,
  ComfyImageManipulationGraphBuildRequest,
} from "../ComfyImageManipulationExecutionAdapterContract";
import { ComfyImageManipulationExecutionContractVersion } from "../ComfyImageManipulationExecutionAdapterContract";
import { ComfyImageManipulationExecutionService } from "../ComfyImageManipulationExecutionService";
import { buildComfyImageManipulationExecutionSubmission } from "../ComfyImageManipulationGraphRequestBuilder";

function createRequest(overrides?: Partial<ComfyImageManipulationGraphBuildRequest>): ComfyImageManipulationGraphBuildRequest {
  return {
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
      executionId: "exec-adapter-integration",
      systemAssetId: "asset:system:reference-image-manipulation",
    },
    runtimeEnvironment: {
      apiBaseUrl: "http://127.0.0.1:8188",
    },
    ...overrides,
  };
}

describe("ComfyImageManipulation execution adapter integration", () => {
  it("executes default template through adapter path with inspectable graph and binding contracts", async () => {
    let capturedSubmission: ComfyImageManipulationExecutionSubmission | undefined;
    const service = new ComfyImageManipulationExecutionService({
      buildGraphRequest: buildComfyImageManipulationExecutionSubmission,
      submitExecution: async (submission) => {
        capturedSubmission = submission;
        return { executionId: "exec-adapter-integration" };
      },
      getExecutionProgress: async () => ({
        executionId: "exec-adapter-integration",
        status: "running",
        percent: 67,
        updatedAt: "2026-01-01T00:00:01.000Z",
      }),
      waitForExecutionResult: async () => ({
        status: "completed",
        executionId: "exec-adapter-integration",
        outputs: [{
          outputNodeId: "8",
          outputIndex: 0,
          reference: "memory://generated-1.png",
          metadata: { filename: "generated-1.png", format: "png" },
        }],
        materializationHooks: [{
          workflowOutputId: "images",
          outputNodeId: "8",
          outputIndex: 0,
          binding: {
            bindingId: "image-manipulation:output:images",
            targetDatasetAssetId: "asset:dataset:image-reference-output",
            targetDatasetInstanceRef: "dataset-instance-ref:reference-image:output",
            targetStorageInstanceRef: "storage-instance://storage-instance%3Aasset%3Asystem%3Areference-image-manipulation%3Aimage-runtime",
            targetStorageBindingId: "output-images",
          },
        }],
      }),
    });

    const result = await service.execute({
      ...createRequest(),
      pollIntervalMs: 0,
    });

    expect(result.final.status).toBe("succeeded");
    expect(result.lifecycle.some((entry) => entry.status === "queued")).toBeTrue();
    expect(result.lifecycle.some((entry) => entry.status === "running")).toBeTrue();
    expect(capturedSubmission).toBeDefined();
    expect(capturedSubmission?.graph.prompt["1"]?.class_type).toBe("CheckpointLoaderSimple");
    expect(capturedSubmission?.graph.prompt["6"]?.inputs.steps).toBeGreaterThan(0);
    expect(capturedSubmission?.inspection.executionPath).toBe("non-faceid");
    expect(capturedSubmission?.inspection.runtimeResolution.endpoint.apiBaseUrl).toBe("http://127.0.0.1:8188");
    expect(capturedSubmission?.materializationBindings[0]?.targetStorageInstanceRef?.startsWith("storage-instance://")).toBeTrue();
  });

  it("branches to faceid execution path when faceid is enabled", () => {
    const submission = buildComfyImageManipulationExecutionSubmission(createRequest({
      resolvedConfig: {
        ...createComfyImageManipulationDefaultConfig(),
        faceId: {
          enabled: true,
          referenceBindings: [{ datasetBindingId: "faceid-reference", datasetAssetId: "asset:dataset:image-faceid-reference" }],
          weight: 0.8,
          startStepFraction: 0,
          endStepFraction: 1,
        },
      },
    }));

    expect(submission.inspection.executionPath).toBe("faceid");
    expect((submission.inspection.subworkflowBindings?.[0] as { enabled?: boolean } | undefined)?.enabled).toBeTrue();
  });

  it("normalizes adapter request-construction failures into execution-ready errors", async () => {
    const service = new ComfyImageManipulationExecutionService({
      buildGraphRequest: () => {
        throw new Error("invalid-request:Graph mapping failed.");
      },
      submitExecution: async () => ({ executionId: "unused" }),
      getExecutionProgress: async () => ({
        executionId: "unused",
        status: "queued",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
      waitForExecutionResult: async () => ({
        status: "failed",
        error: {
          code: "invalid-request",
          category: "validation",
          message: "unused",
          retryable: false,
        },
      }),
    });

    const result = await service.execute(createRequest());
    expect(result.final.status).toBe("failed");
    expect(result.final.error?.code).toBe("invalid-request");
  });
});
