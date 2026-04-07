import { describe, expect, it } from "bun:test";
import { Asset } from "../../../domain/assets/Asset";
import { AssetAuditInfo, AssetLocation, AssetSourceInfo } from "../../../domain/assets/AssetMetadata";
import type { IAsset } from "../../../domain/assets/interfaces/IAsset";
import type { IAssetCatalog } from "../../ports/interfaces/IAssetCatalog";
import { WorkflowTemplateValidator } from "../WorkflowTemplateValidator";
import { ValidatedAssetTypes } from "../../asset-validation/AssetValidationTypes";

class InMemoryAssetCatalog implements IAssetCatalog {
  private readonly byId = new Map<string, IAsset>();
  async list(): Promise<ReadonlyArray<IAsset>> { return [...this.byId.values()]; }
  async getById(id: string): Promise<IAsset | undefined> { return this.byId.get(id); }
  async save(asset: IAsset): Promise<void> { this.byId.set(asset.id, asset); }
  async remove(id: string): Promise<boolean> { return this.byId.delete(id); }
  async exists(id: string): Promise<boolean> { return this.byId.has(id); }
}

function createAsset(id: string, kind: IAsset["kind"], version?: string): IAsset {
  return new Asset({
    id,
    name: id,
    version,
    kind,
    status: "available",
    source: new AssetSourceInfo({ type: "generated", provider: "test" }),
    location: new AssetLocation({ accessMethod: "memory", location: id }),
    audit: new AssetAuditInfo({ createdAt: new Date(), updatedAt: new Date() }),
  });
}

describe("WorkflowTemplateValidator", () => {
  it("validates a template deterministically", async () => {
    const catalog = new InMemoryAssetCatalog();
    await catalog.save(createAsset("asset:workflow:base", "workflow-definition", "workflow:v1"));
    await catalog.save(createAsset("asset:dataset:images", "dataset", "dataset:v1"));

    const validator = new WorkflowTemplateValidator(catalog, {
      async resolveWorkflowContract() {
        return {
          version: "1.0.0",
          input: { kind: "json-schema", schema: { type: "object", properties: { prompt: { type: "string" } } } },
          output: { kind: "json-schema", schema: { type: "object", properties: { images: { type: "array" } } } },
          parameters: [{ id: "steps", required: true }],
        };
      },
    });

    const result = await validator.validate({
      assetType: ValidatedAssetTypes.template,
      assetId: "template:test",
      payload: {
        templateId: "template:test",
        versionId: "template:test:v1",
        name: "Template",
        category: "image-generation",
        supportedIntent: "text-to-image",
        inputRequirements: [{ inputId: "prompt", valueType: "text", required: true }],
        outputExpectations: [{ outputId: "images", valueType: "images" }],
        parameterDefaults: [{ parameterId: "steps", value: 20 }],
        parameters: [{ parameterId: "steps", name: "Steps", type: "integer", required: true, defaultValue: 20 }],
        composition: {
          workflowInterfaces: [{ workflowAssetId: "asset:workflow:base", workflowAssetVersionId: "workflow:v1", inputIds: ["prompt"], outputIds: ["images"], parameterIds: ["steps"] }],
          inputBindings: [{ bindingId: "in", templateInputId: "prompt", workflowAssetId: "asset:workflow:base", workflowInputId: "prompt", required: true }],
          outputBindings: [{ bindingId: "out", templateOutputId: "images", workflowAssetId: "asset:workflow:base", workflowOutputId: "images", targetDatasetAssetId: "asset:dataset:images" }],
          parameterMappings: [{ parameterId: "steps", workflowAssetId: "asset:workflow:base", workflowParameterId: "steps" }],
          systemContextMappings: [],
        },
        workflowAssets: [{ role: "workflow-definition", assetId: "asset:workflow:base", versionId: "workflow:v1" }],
        tags: [],
        metadata: {},
      },
    });

    expect(result.status).toBe("valid");
    expect(result.errors).toHaveLength(0);
  });

  it("fails fast for missing workflow references", async () => {
    const validator = new WorkflowTemplateValidator(new InMemoryAssetCatalog());
    const result = await validator.validate({
      assetType: ValidatedAssetTypes.template,
      assetId: "template:test",
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
          workflowInterfaces: [{ workflowAssetId: "asset:workflow:missing", inputIds: ["prompt"], outputIds: ["images"], parameterIds: [] }],
          inputBindings: [{ bindingId: "in", templateInputId: "prompt", workflowAssetId: "asset:workflow:missing", workflowInputId: "prompt" }],
          outputBindings: [{ bindingId: "out", templateOutputId: "images", workflowAssetId: "asset:workflow:missing", workflowOutputId: "images" }],
          parameterMappings: [],
        },
        workflowAssets: [{ role: "workflow-definition", assetId: "asset:workflow:missing" }],
        tags: [],
        metadata: {},
      },
    });

    expect(result.status).toBe("invalid");
    expect(result.errors[0]?.code).toBe("template.workflow-reference.missing");
  });
});
