import { describe, expect, it } from "bun:test";
import { ImageManipulationWorkflowTemplate } from "../../workflow-template-studio/ImageManipulationWorkflowTemplate";
import { ComfyImageManipulationBaseGraph } from "../ComfyImageManipulationBaseGraph";
import { createComfyImageManipulationDefaultConfig } from "../ComfyImageManipulationPropertySchema";
import { ComfyImageManipulationExecutionContractVersion } from "../ComfyImageManipulationExecutionAdapterContract";
import { ComfyImageManipulationExecutionService } from "../ComfyImageManipulationExecutionService";
import { buildComfyImageManipulationExecutionSubmission } from "../ComfyImageManipulationGraphRequestBuilder";

const makeAdapter = () => {
  let pollCount = 0;
  return {
    buildGraphRequest: buildComfyImageManipulationExecutionSubmission,
    submitExecution: async () => ({ executionId: "exec-service-1" }),
    getExecutionProgress: async () => {
      pollCount += 1;
      if (pollCount === 1) {
        return {
          executionId: "exec-service-1",
          status: "queued" as const,
          percent: 5,
          updatedAt: "2026-01-01T00:00:01.000Z",
        };
      }
      return {
        executionId: "exec-service-1",
        status: "running" as const,
        percent: 80,
        updatedAt: "2026-01-01T00:00:02.000Z",
      };
    },
    waitForExecutionResult: async () => ({
      status: "completed" as const,
      executionId: "exec-service-1",
      outputs: [],
      materializationHooks: [],
    }),
  };
};

describe("ComfyImageManipulationExecutionService", () => {
  it("tracks normalized lifecycle from queued through succeeded", async () => {
    const service = new ComfyImageManipulationExecutionService(makeAdapter());

    const result = await service.execute({
      contractVersion: ComfyImageManipulationExecutionContractVersion,
      workflowTemplate: {
        ...ImageManipulationWorkflowTemplate,
        metadata: {
          ...ImageManipulationWorkflowTemplate.metadata,
          runtimeApiBaseUrl: "http://127.0.0.1:8188",
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
        executionId: "exec-service-1",
      },
      runtimeEnvironment: {
        apiBaseUrl: "http://127.0.0.1:8188",
      },
      pollIntervalMs: 0,
    });

    expect(result.executionId).toBe("exec-service-1");
    expect(result.lifecycle.some((entry) => entry.status === "queued")).toBeTrue();
    expect(result.final.status).toBe("succeeded");
  });

  it("returns normalized failed lifecycle when readiness validation is blocked", async () => {
    const service = new ComfyImageManipulationExecutionService(makeAdapter());

    const result = await service.execute({
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
        executionId: "exec-service-readiness-failed",
      },
      pollIntervalMs: 0,
    });

    expect(result.final.status).toBe("failed");
    expect(result.final.error?.code).toBe("invalid-request");
    expect(result.lifecycle.length).toBe(1);
  });
});
