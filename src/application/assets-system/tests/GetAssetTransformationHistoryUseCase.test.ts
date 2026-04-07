import { describe, expect, it } from "bun:test";
import { GetAssetTransformationHistoryUseCase } from "../GetAssetTransformationHistoryUseCase";
import { AssetTransformation } from "../../../domain/assets/AssetTransformation";
import { AssetVersion } from "../../../domain/assets/AssetVersion";

describe("GetAssetTransformationHistoryUseCase", () => {
  it("loads transformation history via direct asset query when repository supports it", async () => {
    const useCase = new GetAssetTransformationHistoryUseCase(
      { listVersionsByAssetId: async () => [] } as never,
      {
        listTransformationsByAssetId: async () => [
          new AssetTransformation({
            transformationId: "tx-asset",
            transformationType: "mcp-tool-transform",
            status: "success",
            inputVersionIds: ["asset:v1"],
            outputVersionIds: ["asset:v2"],
            executionId: "exec-1",
          }),
        ],
        saveTransformation: async () => undefined,
        getById: async () => undefined,
        listByVersionId: async () => [],
      },
    );

    const history = await useCase.execute("asset");
    expect(history).toHaveLength(1);
    expect(history[0]?.executionId).toBe("exec-1");
  });

  it("falls back to version-scoped history when direct asset query is unavailable", async () => {
    const tx = new AssetTransformation({
      transformationId: "tx-v",
      transformationType: "mcp-tool-generate",
      status: "success",
      inputVersionIds: ["asset:v1"],
      outputVersionIds: ["asset:v2"],
    });
    const useCase = new GetAssetTransformationHistoryUseCase(
      {
        listVersionsByAssetId: async () => [
          new AssetVersion({ assetId: "asset", versionId: "asset:v1" }),
          new AssetVersion({ assetId: "asset", versionId: "asset:v2" }),
        ],
      } as never,
      {
        saveTransformation: async () => undefined,
        getById: async () => undefined,
        listByVersionId: async () => [tx],
      },
    );

    const history = await useCase.execute("asset");
    expect(history).toHaveLength(1);
    expect(history[0]?.transformationId).toBe("tx-v");
  });
});
