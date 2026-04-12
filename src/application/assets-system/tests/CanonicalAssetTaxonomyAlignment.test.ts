import { describe, expect, it } from "bun:test";
import { LoadCanonicalAssetSummaryUseCase } from "../CanonicalAssetReadUseCases";
import { Asset } from "@domain/assets/Asset";
import { AssetLocation, AssetSourceInfo } from "@domain/assets/AssetMetadata";
import { AssetVersion } from "@domain/assets/AssetVersion";
import { AssetId } from "@domain/assets/AssetId";

describe("Canonical asset taxonomy alignment", () => {
  it("attaches taxonomy descriptors to canonical-summary reads when asset ids map to canonical entities", async () => {
    const asset = new Asset({
      id: "workflow-definition:wf-1",
      name: "Workflow One",
      kind: "workflow-definition",
      source: new AssetSourceInfo({ type: "system" }),
      location: new AssetLocation({ accessMethod: "virtual", location: "workflow://wf-1" }),
      status: "available",
    });

    const repository = {
      async getById(id: string) {
        return id === asset.id ? asset : undefined;
      },
      async listVersionsByAssetId() {
        return [new AssetVersion({ versionId: "asset-version:workflow-definition:wf-1:v1", assetId: new AssetId(asset.id) })];
      },
    };

    const summary = await new LoadCanonicalAssetSummaryUseCase(repository as any, repository as any).execute(asset.id);

    expect(summary?.taxonomy).toEqual({
      structuralKind: "composite",
      semanticRole: "workflow",
      behaviorKind: "deterministic",
    });
  });
});

