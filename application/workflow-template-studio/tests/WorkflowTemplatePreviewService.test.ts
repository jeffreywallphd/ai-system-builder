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

describe("WorkflowTemplatePreviewService", () => {
  it("builds inspectable preview for template selection surfaces", async () => {
    const catalog = new InMemoryAssetCatalog();
    await catalog.save(createAsset("asset:workflow:starter", "workflow-definition"));

    const service = new WorkflowTemplateAssetService(catalog, new InMemoryFileStorage(), "/templates");
    await service.saveTemplate({
      definition: {
        templateId: "template:image:starter",
        versionId: "template:image:starter:v1",
        name: "Image Starter",
        summary: "Starter template",
        category: "image-generation",
        supportedIntent: "text-to-image",
        inputRequirements: [{ inputId: "prompt", valueType: "text", required: true, description: "Prompt" }],
        outputExpectations: [{ outputId: "images", valueType: "images", description: "Generated images" }],
        parameterDefaults: [{ parameterId: "steps", value: 20 }],
        parameters: [{ parameterId: "steps", name: "Steps", type: "integer", required: true, defaultValue: 20 }],
        composition: {
          workflowInterfaces: [{ workflowAssetId: "asset:workflow:starter", inputIds: ["prompt"], outputIds: ["images"], parameterIds: ["steps"] }],
          inputBindings: [{ bindingId: "in-1", templateInputId: "prompt", workflowAssetId: "asset:workflow:starter", workflowInputId: "prompt", required: true }],
          outputBindings: [{
            bindingId: "out-1",
            templateOutputId: "images",
            workflowAssetId: "asset:workflow:starter",
            workflowOutputId: "images",
            targetDatasetInstanceRef: "dataset-instance-ref:starter:output",
            targetStorageInstanceRef: "storage-instance://storage-instance%3Atemplate-starter",
            targetStorageBindingId: "output-images",
          }],
          parameterMappings: [{ parameterId: "steps", workflowAssetId: "asset:workflow:starter", workflowParameterId: "steps" }],
        },
        workflowAssets: [{ role: "workflow-definition", assetId: "asset:workflow:starter" }],
        executionMetadata: {
          runtime: {
            backendId: "runtime:comfyui",
            runtimeProfile: "comfyui",
            requiredCapabilities: ["workflow-template-execution"],
            requiredDependencies: ["comfyui>=0.2"],
          },
          capability: {
            workflowMode: "text-to-image",
            supportsFaceId: false,
            supportsBatchExecution: false,
          },
        },
        tags: [],
        metadata: {},
      },
    });

    const preview = await service.previewTemplate("template:image:starter", "template:image:starter:v1");
    expect(preview?.name).toBe("Image Starter");
    expect(preview?.expectedInputs[0]?.inputId).toBe("prompt");
    expect(preview?.outputs[0]?.outputId).toBe("images");
    expect(preview?.outputs[0]?.targetDatasetInstanceRef).toBe("dataset-instance-ref:starter:output");
    expect(preview?.parameters[0]?.defaultValue).toBe(20);
    expect(preview?.referencedWorkflowAssets[0]?.workflowAssetId).toBe("asset:workflow:starter");
    expect(preview?.executionMetadata?.runtimeProfile).toBe("comfyui");
  });
});
