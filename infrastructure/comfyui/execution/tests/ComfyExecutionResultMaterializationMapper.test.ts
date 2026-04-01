import { describe, expect, it } from "bun:test";
import { ComfyExecutionResultMaterializationMapper } from "../mappers/ComfyExecutionResultMaterializationMapper";

describe("ComfyExecutionResultMaterializationMapper", () => {
  it("maps Comfy adapter results into canonical workflow output materialization payloads", () => {
    const mapper = new ComfyExecutionResultMaterializationMapper();

    const payload = mapper.map({
      workflowRun: {
        runId: "run-42",
        workflowAssetId: "asset:workflow:image",
        workflowAssetVersionId: "v2",
      },
      result: {
        executionId: "exec-42",
        status: "completed",
        outputs: [
          {
            nodeId: "save_1",
            kind: "image",
            reference: "asset:workflow-output:comfyui:exec-42:save_1:image:0",
            assetRef: { assetId: "asset:workflow-output:comfyui:exec-42:save_1:image:0" },
            metadata: {
              filename: "hero.png",
              width: 1024,
              height: 768,
            },
          },
          {
            nodeId: "save_2",
            kind: "image",
            reference: "asset:workflow-output:comfyui:exec-42:save_2:image:0",
            metadata: {
              filename: "hero-variant.png",
              width: 1024,
              height: 768,
            },
          },
          {
            nodeId: "text_1",
            kind: "text",
            reference: "asset:workflow-output:comfyui:exec-42:text_1:text:0",
          },
        ],
        lifecycle: [],
      },
      parameterSnapshot: {
        prompt: "A portrait",
        cfg: 7,
        nested: { valid: true, ignored: undefined },
      },
      timestamps: {
        requestedAt: "2026-04-01T09:00:00.000Z",
        completedAt: "2026-04-01T09:00:05.000Z",
      },
    });

    expect(payload.status).toBe("materialized");
    expect(payload.producedAssets).toHaveLength(2);
    expect(payload.producedAssets[0]?.role).toBe("primary");
    expect(payload.producedAssets[1]?.role).toBe("variant");
    expect(payload.producedAssets[0]?.assetRef.path).toBe("hero.png");
    expect(payload.parameterSnapshot).toEqual({
      prompt: "A portrait",
      cfg: 7,
      nested: { valid: true },
    });
  });

  it("rejects payload mapping when no image output exists", () => {
    const mapper = new ComfyExecutionResultMaterializationMapper();

    expect(() => mapper.map({
      workflowRun: {
        runId: "run-43",
        workflowAssetId: "asset:workflow:image",
      },
      result: {
        executionId: "exec-43",
        status: "failed",
        outputs: [
          {
            nodeId: "text_1",
            kind: "text",
            reference: "asset:workflow-output:comfyui:exec-43:text_1:text:0",
          },
        ],
        lifecycle: [],
        error: {
          code: "execution-failed",
          category: "execution",
          severity: "error",
          message: "failed",
          retriable: false,
          retryable: false,
        },
      },
    })).toThrow("did not contain image outputs");
  });
});
