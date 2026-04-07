import { describe, expect, it } from "bun:test";
import { Asset } from "@domain/assets/Asset";
import { AssetAuditInfo, AssetLocation, AssetSourceInfo } from "@domain/assets/AssetMetadata";
import type { IAsset } from "@domain/assets/interfaces/IAsset";
import type { IAssetCatalog } from "../../ports/interfaces/IAssetCatalog";
import { AssetValidationOrchestrator } from "../AssetValidationOrchestrator";
import { DatasetAssetValidator } from "../DatasetAssetValidator";
import { WorkflowAssetValidator } from "../WorkflowAssetValidator";
import { WorkflowTemplateValidator } from "../../workflow-template-studio/WorkflowTemplateValidator";
import { ValidatedAssetTypes } from "../AssetValidationTypes";

class InMemoryAssetCatalog implements IAssetCatalog {
  private readonly byId = new Map<string, IAsset>();
  async list(): Promise<ReadonlyArray<IAsset>> { return [...this.byId.values()]; }
  async getById(id: string): Promise<IAsset | undefined> { return this.byId.get(id); }
  async save(asset: IAsset): Promise<void> { this.byId.set(asset.id, asset); }
  async remove(id: string): Promise<boolean> { return this.byId.delete(id); }
  async exists(id: string): Promise<boolean> { return this.byId.has(id); }
}

function createAsset(id: string, kind: IAsset["kind"]): IAsset {
  return new Asset({
    id,
    name: id,
    kind,
    status: "available",
    source: new AssetSourceInfo({ type: "generated", provider: "test" }),
    location: new AssetLocation({ accessMethod: "memory", location: id }),
    audit: new AssetAuditInfo({ createdAt: new Date(), updatedAt: new Date() }),
  });
}

describe("AssetValidationOrchestrator", () => {
  it("aggregates cross-asset validation for template dependencies", async () => {
    const catalog = new InMemoryAssetCatalog();
    await catalog.save(createAsset("asset:workflow:base", "workflow-definition"));

    const orchestrator = new AssetValidationOrchestrator([
      new WorkflowTemplateValidator(catalog),
      new WorkflowAssetValidator(catalog),
      new DatasetAssetValidator(catalog),
    ]);

    const result = await orchestrator.validate({
      assetType: ValidatedAssetTypes.template,
      assetId: "template:test",
      versionId: "template:test:v1",
      payload: {
        templateId: "template:test",
        versionId: "template:test:v1",
        name: "Template",
        category: "image-generation",
        supportedIntent: "text-to-image",
        inputRequirements: [{ inputId: "prompt", valueType: "text", required: true }],
        outputExpectations: [{ outputId: "images", valueType: "images" }],
        parameterDefaults: [],
        parameters: [],
        composition: {
          workflowInterfaces: [{ workflowAssetId: "asset:workflow:base", inputIds: ["prompt"], outputIds: ["images"], parameterIds: [] }],
          inputBindings: [{ bindingId: "in", templateInputId: "prompt", workflowAssetId: "asset:workflow:base", workflowInputId: "prompt" }],
          outputBindings: [{ bindingId: "out", templateOutputId: "images", workflowAssetId: "asset:workflow:base", workflowOutputId: "images" }],
          parameterMappings: [],
        },
        workflowAssets: [
          { role: "workflow-definition", assetId: "asset:workflow:base" },
          { role: "dataset", assetId: "asset:dataset:missing" },
        ],
        tags: [],
        metadata: {},
      },
    });

    expect(result.status).toBe("invalid");
    expect(Object.keys(result.errorsByAsset).some((key) => key.startsWith("dataset:asset:dataset:missing:"))).toBeTrue();
  });
});

