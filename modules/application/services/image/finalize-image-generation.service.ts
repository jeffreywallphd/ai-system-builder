import type { RuntimeTaskRecord } from "../../../contracts/runtime";
import type { ArtifactStoragePort } from "../../ports/storage";
import type { ImageAssetRegistryPort, ImageBinaryRetrievalPort } from "../../ports/image";

interface FinalizedAssetRef {
  assetId: string;
  artifactId: string;
}

export class FinalizeImageGenerationService {
  private readonly finalizedByRequestId = new Map<string, FinalizedAssetRef[]>();

  public constructor(
    private readonly dependencies: {
      artifactStorage: ArtifactStoragePort;
      imageAssetRegistry: ImageAssetRegistryPort;
      imageBinaryRetrieval: ImageBinaryRetrievalPort;
    },
  ) {}

  public async finalizeCompletedTask(task: RuntimeTaskRecord): Promise<{ assets: FinalizedAssetRef[] }> {
    const existing = this.finalizedByRequestId.get(task.requestId);
    if (existing) {
      return { assets: existing };
    }

    if (task.status !== "succeeded") {
      throw new Error("Image generation finalization requires a succeeded runtime task.");
    }

    const outputs = this.getOutputs(task.data);
    const metadata = this.getMetadata(task);
    const assets: FinalizedAssetRef[] = [];

    for (const output of outputs) {
      const buffer = await this.dependencies.imageBinaryRetrieval.getImageBinary(output);
      const fileName = this.getOutputFileName(output, assets.length);
      const mimeType = this.getOutputMimeType(output);

      const stored = await this.dependencies.artifactStorage.storeArtifact({
        descriptor: { storageKey: fileName, mediaType: mimeType ?? "application/octet-stream" },
        content: buffer,
      });
      if (!stored.ok) {
        throw new Error(`Failed to persist generated image artifact: ${stored.error.message}`);
      }
      const artifactId = stored.value.storageKey;
      const { assetId } = await this.dependencies.imageAssetRegistry.registerImageAsset({
        artifactId,
        source: "generated",
        metadata: {
          ...metadata,
          createdAt: Date.now(),
        },
      });
      assets.push({ assetId, artifactId });
    }

    this.finalizedByRequestId.set(task.requestId, assets);
    return { assets };
  }

  private getOutputs(data: unknown): unknown[] {
    if (typeof data !== "object" || data === null || !("outputs" in data) || !Array.isArray((data as { outputs?: unknown[] }).outputs)) {
      throw new Error("Image generation finalization requires task outputs.");
    }
    return (data as { outputs: unknown[] }).outputs;
  }

  private getMetadata(task: RuntimeTaskRecord): Omit<NonNullable<Parameters<ImageAssetRegistryPort['registerImageAsset']>[0]['metadata']>, 'createdAt'> {
    const payload = this.readRecord(task.data, "payload");
    const runtimeMetadata = this.readRecord(task.metadata);

    return {
      prompt: this.readString(payload, "prompt"),
      negativePrompt: this.readString(payload, "negativePrompt"),
      seed: this.readNumber(runtimeMetadata, "seed"),
      model: this.readString(runtimeMetadata, "model"),
      workflowTemplateId: this.readString(runtimeMetadata, "workflowTemplateId"),
      width: this.readNumber(runtimeMetadata, "width"),
      height: this.readNumber(runtimeMetadata, "height"),
      engine: "comfyui",
    };
  }

  private readRecord(input: unknown, key?: string): Record<string, unknown> | undefined {
    if (typeof input !== "object" || input === null) return undefined;
    const record = input as Record<string, unknown>;
    if (!key) return record;
    const candidate = record[key];
    return typeof candidate === "object" && candidate !== null ? (candidate as Record<string, unknown>) : undefined;
  }

  private readString(record: Record<string, unknown> | undefined, key: string): string | undefined {
    const value = record?.[key];
    return typeof value === "string" ? value : undefined;
  }

  private readNumber(record: Record<string, unknown> | undefined, key: string): number | undefined {
    const value = record?.[key];
    return typeof value === "number" ? value : undefined;
  }

  private getOutputFileName(output: unknown, index: number): string {
    if (typeof output === "object" && output !== null && "fileName" in output && typeof (output as { fileName?: unknown }).fileName === "string") {
      return (output as { fileName: string }).fileName;
    }
    return `generated-image-${index + 1}.png`;
  }

  private getOutputMimeType(output: unknown): string | undefined {
    if (typeof output === "object" && output !== null && "mimeType" in output && typeof (output as { mimeType?: unknown }).mimeType === "string") {
      return (output as { mimeType: string }).mimeType;
    }
    return undefined;
  }
}
