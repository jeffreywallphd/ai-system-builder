import { describe, expect, it } from "bun:test";
import { Asset } from "@domain/assets/Asset";
import { AssetAuditInfo, AssetLocation, AssetSourceInfo } from "@domain/assets/AssetMetadata";
import type { AssetContractDescriptor } from "@domain/contracts/AssetContract";
import { createWorkflowTemplateDefinition } from "@domain/workflow-template-studio/WorkflowTemplateDomain";
import type { IAsset } from "@domain/assets/interfaces/IAsset";
import type { IAssetCatalog } from "../../ports/interfaces/IAssetCatalog";
import { WorkflowTemplateCompositionResolver, type WorkflowTemplateWorkflowContractResolver } from "../WorkflowTemplateCompositionResolver";

class InMemoryAssetCatalog implements IAssetCatalog {
  private readonly byId = new Map<string, IAsset>();
  async list(): Promise<ReadonlyArray<IAsset>> { return [...this.byId.values()]; }
  async getById(id: string): Promise<IAsset | undefined> { return this.byId.get(id); }
  async save(asset: IAsset): Promise<void> { this.byId.set(asset.id, asset); }
  async remove(id: string): Promise<boolean> { return this.byId.delete(id); }
  async exists(id: string): Promise<boolean> { return this.byId.has(id); }
}

function createAsset(id: string, kind: IAsset["kind"]): Asset {
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

function createTemplate() {
  return createWorkflowTemplateDefinition({
    templateId: "template:test",
    versionId: "template:test:v1",
    name: "Template",
    category: "image-generation",
    supportedIntent: "text-to-image",
    inputRequirements: [{ inputId: "prompt", valueType: "text", required: true }],
    outputExpectations: [{ outputId: "images", valueType: "images" }],
    parameterDefaults: [],
    parameters: [{ parameterId: "steps", name: "Steps", type: "integer", required: true }],
    composition: {
      workflowInterfaces: [{ workflowAssetId: "asset:workflow:base", inputIds: ["prompt"], outputIds: ["images"], parameterIds: ["steps"] }],
      inputBindings: [{ bindingId: "in-1", templateInputId: "prompt", workflowAssetId: "asset:workflow:base", workflowInputId: "prompt" }],
      outputBindings: [{ bindingId: "out-1", templateOutputId: "images", workflowAssetId: "asset:workflow:base", workflowOutputId: "images", targetDatasetAssetId: "asset:dataset:images" }],
      parameterMappings: [{ parameterId: "steps", workflowAssetId: "asset:workflow:base", workflowParameterId: "steps" }],
    },
    workflowAssets: [{ role: "workflow-definition", assetId: "asset:workflow:base" }],
    tags: [],
    metadata: {},
  });
}

describe("WorkflowTemplateCompositionResolver", () => {
  it("resolves workflow and dataset references with compatibility checks", async () => {
    const catalog = new InMemoryAssetCatalog();
    await catalog.save(createAsset("asset:workflow:base", "workflow-definition"));
    await catalog.save(createAsset("asset:dataset:images", "dataset"));

    const template = createTemplate();

    const resolved = await new WorkflowTemplateCompositionResolver(catalog).resolve(template);
    expect(resolved.workflowAssets).toHaveLength(1);
    expect(resolved.datasetAssets).toHaveLength(1);
  });

  it("uses workflow contract resolver when available for deeper compatibility", async () => {
    const catalog = new InMemoryAssetCatalog();
    await catalog.save(createAsset("asset:workflow:base", "workflow-definition"));
    await catalog.save(createAsset("asset:dataset:images", "dataset"));

    const contractResolver: WorkflowTemplateWorkflowContractResolver = {
      async resolveWorkflowContract(): Promise<AssetContractDescriptor> {
        return {
          version: "1.0.0",
          input: { kind: "json-schema", schema: { type: "object", properties: { prompt: { type: "string" } } } },
          output: { kind: "json-schema", schema: { type: "object", properties: { images: { type: "array" } } } },
          parameters: [{ id: "steps", required: true }],
        };
      },
    };

    const template = createTemplate();
    const resolved = await new WorkflowTemplateCompositionResolver(catalog, contractResolver).resolve(template);
    expect(resolved.workflowAssets[0]?.id).toBe("asset:workflow:base");
  });
});

