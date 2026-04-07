import { describe, expect, it } from "bun:test";
import {
  DatasetInstanceImageGenerationRoles,
} from "../../../domain/system-runtime/DatasetInstanceRecordDomain";
import {
  materializationAssetToDatasetGeneration,
  validateWorkflowOutputMaterializationPayload,
} from "../WorkflowOutputMaterializationContract";

describe("WorkflowOutputMaterializationContract", () => {
  it("validates canonical system-owned output materialization payloads", () => {
    const payload = validateWorkflowOutputMaterializationPayload({
      materializationId: "mat:run-1",
      workflowRun: {
        runId: "run-1",
        workflowAssetId: "asset:workflow:image-system",
        workflowAssetVersionId: "v3",
      },
      sourceImage: {
        imageRef: {
          assetId: "asset:image:source:1",
        },
      },
      producedAssets: [
        {
          assetRef: {
            assetId: "asset:image:output:1",
          },
          role: DatasetInstanceImageGenerationRoles.primary,
          metadata: { sampler: "dpm++" },
          tags: ["hero", "primary"],
        },
      ],
      parameterSnapshot: {
        prompt: "portrait",
        cfg: 7,
      },
      timestamps: {
        requestedAt: "2026-04-01T10:00:00.000Z",
        startedAt: "2026-04-01T10:00:01.000Z",
        completedAt: "2026-04-01T10:00:05.000Z",
        updatedAt: "2026-04-01T10:00:05.000Z",
      },
      status: "materialized",
    });

    expect(payload.workflowRun.runId).toBe("run-1");
    expect(payload.producedAssets[0]?.role).toBe("primary");
  });

  it("maps materialized produced assets into first-class dataset generation records", () => {
    const generation = materializationAssetToDatasetGeneration({
      payload: {
        materializationId: "mat:run-2",
        workflowRun: {
          runId: "run-2",
          workflowAssetId: "asset:workflow:image-system",
        },
        sourceImage: {
          imageRef: { assetId: "asset:image:source:2" },
        },
        producedAssets: [
          {
            assetRef: { assetId: "asset:image:output:2" },
            role: DatasetInstanceImageGenerationRoles.variant,
            outputIndex: 4,
            outputGroupId: "batch:source:2",
            metadata: { strength: 0.35 },
            tags: ["variant", "v2", "variant"],
          },
        ],
        parameterSnapshot: { seed: 1234 },
        timestamps: {
          requestedAt: "2026-04-01T11:00:00.000Z",
          updatedAt: "2026-04-01T11:00:10.000Z",
        },
        status: "partial",
      },
      assetIndex: 0,
    });

    expect(generation.workflowAssetId).toBe("asset:workflow:image-system");
    expect(generation.runId).toBe("run-2");
    expect(generation.role).toBe("variant");
    expect(generation.outputIndex).toBe(4);
    expect(generation.outputGroupId).toBe("batch:source:2");
    expect(generation.tags).toEqual(["variant", "v2"]);
    expect(generation.metadata.materializationId).toBe("mat:run-2");
  });

  it("rejects invalid payloads that leak incomplete materialization state", () => {
    expect(() => validateWorkflowOutputMaterializationPayload({
      materializationId: "",
      workflowRun: { runId: "run-1", workflowAssetId: "asset:workflow:x" },
      producedAssets: [],
      parameterSnapshot: {},
      timestamps: {
        requestedAt: "2026-04-01T10:00:00.000Z",
        updatedAt: "2026-04-01T10:00:00.000Z",
      },
      status: "pending",
    })).toThrow();
  });

  it("accepts failed payloads with no produced outputs when execution fails before materialization", () => {
    const payload = validateWorkflowOutputMaterializationPayload({
      materializationId: "mat:run:failed-pre-output",
      workflowRun: { runId: "run:failed-pre-output", workflowAssetId: "asset:workflow:x" },
      producedAssets: [],
      parameterSnapshot: {},
      timestamps: {
        requestedAt: "2026-04-01T10:00:00.000Z",
        updatedAt: "2026-04-01T10:00:00.000Z",
      },
      status: "failed",
      error: {
        code: "execution-failed",
        message: "upstream executor failed before producing outputs",
      },
    });

    expect(payload.status).toBe("failed");
    expect(payload.producedAssets).toHaveLength(0);
  });
});
