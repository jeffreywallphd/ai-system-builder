import { describe, expect, it } from "bun:test";
import type { IAssetCatalog } from "../../ports/interfaces/IAssetCatalog";
import type { IFileStorage } from "../../ports/interfaces/IFileStorage";
import { WorkflowTemplateAssetService } from "../WorkflowTemplateAssetService";
import type { IAsset } from "../../../domain/assets/interfaces/IAsset";
import { Asset } from "../../../domain/assets/Asset";
import { AssetAuditInfo, AssetLocation, AssetSourceInfo } from "../../../domain/assets/AssetMetadata";
import { AssetValidationStatuses } from "../../../domain/contracts/AssetValidation";
import {
  ImageManipulationFaceIdSubworkflowAssetId,
  ImageManipulationWorkflowTemplate,
  ImageManipulationWorkflowTemplateAssetId,
  ImageManipulationWorkflowTemplateVersionId,
} from "../ImageManipulationWorkflowTemplate";
import {
  ImageManipulationFaceIdReferenceDatasetAssetId,
  ImageManipulationInputDatasetAssetId,
  ImageManipulationOutputDatasetAssetId,
} from "../../dataset-studio/ImageManipulationDatasetAssets";

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

describe("ImageManipulationWorkflowTemplate epic-4 integration", () => {
  it("validates mapping, dataset bindings, execution metadata, and default executable readiness", async () => {
    const catalog = new InMemoryAssetCatalog();
    const workflowAssets = ["asset:workflow:image-to-image", ImageManipulationFaceIdSubworkflowAssetId];
    for (const workflowAssetId of workflowAssets) {
      await catalog.save(createAsset(workflowAssetId, "workflow-definition"));
    }

    for (const datasetAssetId of [
      ImageManipulationInputDatasetAssetId,
      ImageManipulationOutputDatasetAssetId,
      ImageManipulationFaceIdReferenceDatasetAssetId,
    ]) {
      await catalog.save(createAsset(datasetAssetId, "dataset"));
    }

    const service = new WorkflowTemplateAssetService(catalog, new InMemoryFileStorage(), "/templates");
    await service.saveTemplate({ definition: ImageManipulationWorkflowTemplate });

    const readiness = await service.validateTemplateReadiness(
      ImageManipulationWorkflowTemplateAssetId,
      ImageManipulationWorkflowTemplateVersionId,
    );
    expect(readiness.status).toBe(AssetValidationStatuses.valid);
    expect(readiness.metadata?.readiness).toBe("ready");

    const assetGraph = await service.validateTemplateAssetGraph(
      ImageManipulationWorkflowTemplateAssetId,
      ImageManipulationWorkflowTemplateVersionId,
    );
    expect(assetGraph.status).toBe("valid");
    const errors = Object.values(assetGraph.errorsByAsset).flatMap((entry) => entry);
    expect(errors).toHaveLength(0);

    const instance = await service.instantiateTemplate({
      templateId: ImageManipulationWorkflowTemplateAssetId,
      versionId: ImageManipulationWorkflowTemplateVersionId,
      inputs: {
        sourceImage: "dataset-instance-ref:reference-image:input/image:123",
      },
      systemContext: {
        editInstruction: "make it cinematic",
        faceIdReferenceDataset: [{ datasetBindingId: "faceid-reference", datasetAssetId: ImageManipulationFaceIdReferenceDatasetAssetId }],
      },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(instance.resolvedParameters.positivePrompt).toBeTypeOf("string");
    expect(instance.resolvedParameters.negativePrompt).toBeTypeOf("string");
    expect(instance.resolvedParameters.checkpointModel).toBe("system-default");
    expect(instance.resolvedParameters.vaeModel).toBe("system-default");
    expect(instance.resolvedParameters.faceIdEnabled).toBeFalse();

    const bindings = instance.workflowParameterBindings;
    expect(bindings.some((binding) => (
      binding.workflowAssetId === "asset:workflow:image-to-image" &&
      binding.workflowParameterId === "checkpointModel" &&
      binding.value === "system-default"
    ))).toBeTrue();
    expect(bindings.some((binding) => (
      binding.workflowAssetId === "asset:workflow:image-to-image" &&
      binding.workflowParameterId === "vaeModel" &&
      binding.value === "system-default"
    ))).toBeTrue();
    expect(bindings.some((binding) => (
      binding.workflowAssetId === ImageManipulationFaceIdSubworkflowAssetId &&
      binding.workflowParameterId === "referenceBindings" &&
      Array.isArray(binding.value)
    ))).toBeTrue();

    const outputBinding = instance.boundOutputs[0]?.bindings[0];
    expect(outputBinding?.targetDatasetAssetId).toBe(ImageManipulationOutputDatasetAssetId);
    expect(outputBinding?.targetDatasetInstanceRef).toBe("dataset-instance-ref:reference-image:output");
    expect(outputBinding?.targetStorageInstanceRef?.startsWith("storage-instance://")).toBeTrue();
    expect(outputBinding?.targetStorageBindingId).toBe("output-images");

    expect(instance.systemContextBindings.some((entry) => (
      entry.mappingId === "image-manipulation.context.faceid-references" &&
      Array.isArray(entry.value)
    ))).toBeTrue();
    expect(ImageManipulationWorkflowTemplate.executionMetadata?.runtime.backendId).toBe("runtime:comfyui");
  });
});
