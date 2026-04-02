import { describe, expect, it } from "bun:test";
import {
  ReferenceImageExecutionFlowService,
  createReferenceImageOutputPersistenceRequest,
} from "../ReferenceImageExecutionFlowService";
import { createSystemContextContract } from "../../../domain/system-studio/SystemContextContract";

describe("ReferenceImageExecutionFlowService", () => {
  it("emits plain-language step status across trigger, execution, save, and refresh", async () => {
    const service = new ReferenceImageExecutionFlowService();
    const snapshots: ReadonlyArray<unknown>[] = [];

    const final = await service.run({
      startExecution: async () => ({ ok: true, executionId: "run:1" }),
      getExecutionResult: async () => ({
        ok: true,
        data: {
          executionId: "run:1",
          status: "succeeded",
          rootAssetId: "asset:system",
          outputSummary: {
            hasOutput: true,
            hasError: false,
            outputFieldCount: 1,
            contractOutputIds: ["image"],
          },
          nodeResults: [],
          nestedSystemResults: [],
          diagnostics: [],
          executedVersionMap: { nodeVersionIds: {} },
          nestedExecutionLineage: [],
        },
      }),
      persistOutputs: async () => ({
        ok: true,
        data: {
          systemId: "system:1",
          datasetInstanceId: "dataset-instance:output",
          executionId: "run:1",
          materializationId: "mat:run:1",
          persistedRecordIds: ["record:1"],
          status: "materialized",
          failureMessages: [],
          executionOutcome: "success",
          persistenceBlocked: false,
        },
      }),
      persistenceRequestFactory: ({ executionId }) => ({
        studioId: "studio-system",
        draftId: "draft-1",
        executionId,
      }),
      refreshViews: async () => {},
      onSnapshot: (snapshot) => {
        snapshots.push([snapshot]);
      },
    });

    expect(final.overallStatus).toBe("completed");
    expect(final.steps.some((step) => step.userLabel === "Run started" && step.status === "completed")).toBeTrue();
    expect(final.steps.some((step) => step.userLabel === "Generating result")).toBeTrue();
    expect(final.steps.some((step) => step.userLabel === "Saving result")).toBeTrue();
    expect(final.steps.some((step) => step.userLabel === "Refreshing results")).toBeTrue();
    expect(snapshots.length).toBeGreaterThan(0);
  });

  it("builds persistence requests with runtime output payload projection", () => {
    const request = createReferenceImageOutputPersistenceRequest({
      studioId: "studio-system",
      draftId: "draft-1",
      executionId: "run:1",
      sourceRecordId: "record:input",
      sourceAssetId: "asset:image:input",
      parameterSnapshot: { prompt: "make it warmer" },
      runtimeContext: createSystemContextContract({
        selectedImages: [{
          selectionId: "record:input",
          imageId: "record:input",
          assetRef: {
            assetId: "asset:image:input",
            recordId: "record:input",
          },
        }],
      }),
      workflowAssetId: "asset:workflow:image",
      workflowAssetVersionId: "v1",
      systemAssetId: "asset:system:reference-image",
      runtimeResult: {
        executionId: "run:1",
        status: "succeeded",
        output: { image: "ok" },
        rootAssetId: "asset:system:reference-image",
        outputSummary: {
          hasOutput: true,
          hasError: false,
          outputFieldCount: 1,
          contractOutputIds: ["image"],
        },
        nodeResults: [],
        nestedSystemResults: [],
        diagnostics: [],
        executedVersionMap: { nodeVersionIds: {} },
        nestedExecutionLineage: [],
      },
    });

    expect(request.runtimeResult?.status).toBe("succeeded");
    expect(request.runtimeResult?.output).toEqual({ image: "ok" });
    expect(request.parameterSnapshot.prompt).toBe("make it warmer");
  });

  it("reports failed overall status when persistence returns non-recoverable failure", async () => {
    const service = new ReferenceImageExecutionFlowService();
    const final = await service.run({
      startExecution: async () => ({ ok: true, executionId: "run:2" }),
      getExecutionResult: async () => ({
        ok: true,
        data: {
          executionId: "run:2",
          status: "failed",
          rootAssetId: "asset:system",
          outputSummary: { hasOutput: false, hasError: true, outputFieldCount: 0, contractOutputIds: [] },
          nodeResults: [],
          nestedSystemResults: [],
          diagnostics: [],
          executedVersionMap: { nodeVersionIds: {} },
          nestedExecutionLineage: [],
        },
      }),
      persistOutputs: async () => ({
        ok: true,
        data: {
          systemId: "system:1",
          datasetInstanceId: "dataset-instance:output",
          executionId: "run:2",
          materializationId: "mat:run:2",
          persistedRecordIds: [],
          status: "failed",
          failureMessages: ["Runtime execution failed before output materialization."],
          executionOutcome: "non-recoverable-failure",
          persistenceBlocked: true,
        },
      }),
      persistenceRequestFactory: ({ executionId }) => ({ studioId: "studio-system", draftId: "draft-1", executionId }),
      refreshViews: async () => {},
      onSnapshot: () => {},
    });

    expect(final.overallStatus).toBe("failed");
    expect(final.issues.some((issue) => issue.code === "save-non-recoverable")).toBeTrue();
  });
});
