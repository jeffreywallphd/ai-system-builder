import { describe, expect, it } from "bun:test";
import type { IAssetCatalog } from "../../ports/interfaces/IAssetCatalog";
import type { IFileStorage } from "../../ports/interfaces/IFileStorage";
import type { IAsset } from "@domain/assets/interfaces/IAsset";
import { Asset } from "@domain/assets/Asset";
import { AssetAuditInfo, AssetLocation, AssetSourceInfo } from "@domain/assets/AssetMetadata";
import { WorkflowTemplateAssetService } from "../WorkflowTemplateAssetService";
import { WorkflowTemplateStarterKitService } from "../WorkflowTemplateStarterKitService";

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

function createAsset(id: string, kind: IAsset["kind"] = "workflow-definition"): IAsset {
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

describe("WorkflowTemplateStarterKitService", () => {
  it("provisions the core starter set as workflow-template assets", async () => {
    const catalog = new InMemoryAssetCatalog();
    for (const workflowId of [
      "asset:workflow:image-to-image",
      "asset:workflow:restyle",
      "asset:workflow:enhance-upscale",
      "asset:workflow:batch-transform",
    ]) {
      await catalog.save(createAsset(workflowId));
    }
    await catalog.save(createAsset("asset:dataset:image-reference-output", "dataset"));

    const templateAssets = new WorkflowTemplateAssetService(catalog, new InMemoryFileStorage(), "/templates");
    const service = new WorkflowTemplateStarterKitService(templateAssets);
    const created = await service.provisionCoreImageStarterTemplates();

    expect(created).toHaveLength(5);
    expect(created.every((entry) => entry.kind === "workflow-template")).toBeTrue();

    const listed = await templateAssets.listTemplates();
    expect(listed.map((entry) => entry.name)).toEqual([
      "Image manipulation default",
      "Image to image starter",
      "Restyle starter",
      "Enhance/upscale starter",
      "Batch transform starter",
    ]);
  });
});

