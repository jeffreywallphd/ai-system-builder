import { describe, expect, it } from "bun:test";
import type { IAssetCatalog } from "../../ports/interfaces/IAssetCatalog";
import type { IFileStorage } from "../../ports/interfaces/IFileStorage";
import { WorkflowTemplateAssetService } from "../WorkflowTemplateAssetService";
import type { IAsset } from "../../../domain/assets/interfaces/IAsset";
import { Asset } from "../../../domain/assets/Asset";
import { AssetAuditInfo, AssetLocation, AssetSourceInfo } from "../../../domain/assets/AssetMetadata";

class InMemoryAssetCatalog implements IAssetCatalog {
  private readonly records = new Map<string, IAsset>();
  async list(criteria?: { kinds?: ReadonlyArray<IAsset["kind"]> }): Promise<ReadonlyArray<IAsset>> {
    const all = [...this.records.values()];
    return criteria?.kinds?.length ? all.filter((entry) => criteria.kinds?.includes(entry.kind)) : all;
  }
  async getById(id: string): Promise<IAsset | undefined> { return this.records.get(id); }
  async save(asset: IAsset): Promise<void> { this.records.set(asset.id, asset); }
  async remove(id: string): Promise<boolean> { return this.records.delete(id); }
  async exists(id: string): Promise<boolean> { return this.records.has(id); }
}

class InMemoryFileStorage implements IFileStorage {
  private readonly files = new Map<string, string>();
  async read(path: string): Promise<{ path: string; content: Uint8Array; encoding?: BufferEncoding | undefined; }> { return { path, content: new TextEncoder().encode(this.files.get(path) ?? "") }; }
  async readText(path: string): Promise<string> { const value = this.files.get(path); if (value === undefined) throw new Error("missing"); return value; }
  async write(request: { path: string; content: string | Uint8Array; }): Promise<void> { this.files.set(request.path, typeof request.content === "string" ? request.content : new TextDecoder().decode(request.content)); }
  async delete(path: string): Promise<void> { this.files.delete(path); }
  async exists(path: string): Promise<boolean> { return this.files.has(path); }
  async stat(path: string): Promise<{ path: string; kind: "file" | "directory" | "other"; sizeBytes?: number | undefined; updatedAt?: Date | undefined; }> { return { path, kind: "file" }; }
  async list(): Promise<ReadonlyArray<{ path: string; kind: "file" | "directory" | "other"; sizeBytes?: number | undefined; updatedAt?: Date | undefined; }>> { return []; }
  async mkdir(): Promise<void> {}
  async copy(): Promise<void> {}
  async move(): Promise<void> {}
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

describe("WorkflowTemplateInstantiationService", () => {
  it("instantiates template into runtime-ready immutable instance with lineage", async () => {
    const catalog = new InMemoryAssetCatalog();
    await catalog.save(createAsset("asset:workflow:starter", "workflow-definition"));
    await catalog.save(createAsset("asset:dataset:images", "dataset"));

    const service = new WorkflowTemplateAssetService(catalog, new InMemoryFileStorage(), "/templates");
    await service.saveTemplate({
      definition: {
        templateId: "template:image:starter",
        versionId: "template:image:starter:v1",
        name: "Image Starter",
        category: "image-generation",
        supportedIntent: "text-to-image",
        inputRequirements: [{ inputId: "prompt", valueType: "text", required: true }],
        outputExpectations: [{ outputId: "images", valueType: "images" }],
        parameterDefaults: [{ parameterId: "steps", value: 20 }],
        parameters: [{ parameterId: "steps", name: "Steps", type: "integer", required: true, defaultValue: 20 }],
        composition: {
          workflowInterfaces: [{ workflowAssetId: "asset:workflow:starter", inputIds: ["prompt"], outputIds: ["images"], parameterIds: ["steps"] }],
          inputBindings: [{ bindingId: "in-1", templateInputId: "prompt", workflowAssetId: "asset:workflow:starter", workflowInputId: "prompt", required: true }],
          outputBindings: [{ bindingId: "out-1", templateOutputId: "images", workflowAssetId: "asset:workflow:starter", workflowOutputId: "images", targetDatasetAssetId: "asset:dataset:images" }],
          parameterMappings: [{ parameterId: "steps", workflowAssetId: "asset:workflow:starter", workflowParameterId: "steps" }],
          systemContextMappings: [{ mappingId: "ctx-1", contextKey: "workspaceId", workflowAssetId: "asset:workflow:starter", targetKind: "workflow-parameter", targetId: "workspaceId" }],
        },
        workflowAssets: [{ role: "workflow-definition", assetId: "asset:workflow:starter" }],
        tags: [],
        metadata: {},
      },
    });

    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const instance = await service.instantiateTemplate({
      templateId: "template:image:starter",
      versionId: "template:image:starter:v1",
      inputs: { prompt: "hello" },
      parameterOverrides: { steps: 30 },
      systemContext: { workspaceId: "ws-1" },
      createdAt,
    });

    expect(instance.template.templateId).toBe("template:image:starter");
    expect(instance.template.versionId).toBe("template:image:starter:v1");
    expect(instance.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(instance.parameterOverrides.steps).toBe(30);
    expect(instance.resolvedParameters.steps).toBe(30);
    expect(instance.boundInputs[0]?.value).toBe("hello");
    expect(instance.boundOutputs[0]?.bindings[0]?.targetDatasetAssetId).toBe("asset:dataset:images");
    expect(instance.systemContextBindings[0]?.value).toBe("ws-1");
  });

  it("fails fast when required input is missing", async () => {
    const catalog = new InMemoryAssetCatalog();
    await catalog.save(createAsset("asset:workflow:starter", "workflow-definition"));

    const service = new WorkflowTemplateAssetService(catalog, new InMemoryFileStorage(), "/templates");
    await service.saveTemplate({
      definition: {
        templateId: "template:image:starter",
        versionId: "template:image:starter:v1",
        name: "Image Starter",
        category: "image-generation",
        supportedIntent: "text-to-image",
        inputRequirements: [{ inputId: "prompt", valueType: "text", required: true }],
        outputExpectations: [{ outputId: "images", valueType: "images" }],
        parameterDefaults: [],
        parameters: [],
        composition: {
          workflowInterfaces: [{ workflowAssetId: "asset:workflow:starter", inputIds: ["prompt"], outputIds: ["images"], parameterIds: [] }],
          inputBindings: [{ bindingId: "in-1", templateInputId: "prompt", workflowAssetId: "asset:workflow:starter", workflowInputId: "prompt", required: true }],
          outputBindings: [{ bindingId: "out-1", templateOutputId: "images", workflowAssetId: "asset:workflow:starter", workflowOutputId: "images" }],
          parameterMappings: [],
        },
        workflowAssets: [{ role: "workflow-definition", assetId: "asset:workflow:starter" }],
        tags: [],
        metadata: {},
      },
    });

    await expect(service.instantiateTemplate({ templateId: "template:image:starter", inputs: {} })).rejects.toThrow("Missing required workflow template input 'prompt'");
  });
});
