import { describe, expect, it } from "bun:test";
import type { IAssetCatalog } from "../../ports/interfaces/IAssetCatalog";
import type { IFileStorage } from "../../ports/interfaces/IFileStorage";
import { WorkflowTemplateAssetService } from "../WorkflowTemplateAssetService";
import type { IAsset } from "@domain/assets/interfaces/IAsset";

class InMemoryAssetCatalog implements IAssetCatalog {
  private readonly records = new Map<string, IAsset>();

  async list(criteria?: { kinds?: ReadonlyArray<IAsset["kind"]> }): Promise<ReadonlyArray<IAsset>> {
    const all = [...this.records.values()];
    if (!criteria?.kinds?.length) {
      return all;
    }
    return all.filter((entry) => criteria.kinds?.includes(entry.kind));
  }

  async getById(id: string): Promise<IAsset | undefined> {
    return this.records.get(id);
  }

  async save(asset: IAsset): Promise<void> {
    this.records.set(asset.id, asset);
  }

  async remove(id: string): Promise<boolean> {
    return this.records.delete(id);
  }

  async exists(id: string): Promise<boolean> {
    return this.records.has(id);
  }
}

class InMemoryFileStorage implements IFileStorage {
  private readonly files = new Map<string, string>();

  async read(path: string): Promise<{ path: string; content: Uint8Array; encoding?: BufferEncoding | undefined; }> {
    return { path, content: new TextEncoder().encode(this.files.get(path) ?? "") };
  }

  async readText(path: string): Promise<string> {
    const value = this.files.get(path);
    if (value === undefined) throw new Error(`missing file ${path}`);
    return value;
  }

  async write(request: { path: string; content: string | Uint8Array; }): Promise<void> {
    this.files.set(request.path, typeof request.content === "string" ? request.content : new TextDecoder().decode(request.content));
  }

  async delete(path: string): Promise<void> { this.files.delete(path); }
  async exists(path: string): Promise<boolean> { return this.files.has(path); }
  async stat(path: string): Promise<{ path: string; kind: "file" | "directory" | "other"; sizeBytes?: number | undefined; updatedAt?: Date | undefined; }> {
    return { path, kind: "file", sizeBytes: this.files.get(path)?.length ?? 0, updatedAt: new Date() };
  }
  async list(): Promise<ReadonlyArray<{ path: string; kind: "file" | "directory" | "other"; sizeBytes?: number | undefined; updatedAt?: Date | undefined; }>> { return []; }
  async mkdir(): Promise<void> {}
  async copy(): Promise<void> {}
  async move(): Promise<void> {}
}

describe("WorkflowTemplateAssetService", () => {
  const baseTemplate = {
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
      inputBindings: [{ bindingId: "in-1", templateInputId: "prompt", workflowAssetId: "asset:workflow:starter", workflowInputId: "prompt" }],
      outputBindings: [{ bindingId: "out-1", templateOutputId: "images", workflowAssetId: "asset:workflow:starter", workflowOutputId: "images" }],
      parameterMappings: [{ parameterId: "steps", workflowAssetId: "asset:workflow:starter", workflowParameterId: "steps" }],
    },
    workflowAssets: [{ role: "workflow-definition", assetId: "asset:workflow:starter", versionId: "asset:workflow:starter:v1" }],
    tags: ["starter"],
    metadata: { owner: "platform" },
  } as const;

  it("persists templates and supports load/list/resolve", async () => {
    const service = new WorkflowTemplateAssetService(new InMemoryAssetCatalog(), new InMemoryFileStorage(), "/templates");
    const saved = await service.saveTemplate({ definition: baseTemplate });

    expect(saved.kind).toBe("workflow-template");
    expect(saved.version).toBe(baseTemplate.versionId);

    const loaded = await service.loadTemplate(baseTemplate.templateId);
    expect(loaded?.supportedIntent).toBe("text-to-image");

    const listed = await service.listTemplates();
    expect(listed).toHaveLength(1);

    const resolved = await service.resolveTemplate(baseTemplate.templateId, baseTemplate.versionId);
    expect(resolved?.templateId).toBe(baseTemplate.templateId);

    const unresolved = await service.resolveTemplate(baseTemplate.templateId, "template:image:starter:v2");
    expect(unresolved).toBeUndefined();

    const defaults = service.applyParameterDefaults({ template: loaded! });
    expect(defaults.steps).toBe(20);
  });
});

