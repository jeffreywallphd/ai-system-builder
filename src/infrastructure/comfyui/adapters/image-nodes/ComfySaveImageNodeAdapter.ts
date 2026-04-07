import fs from "node:fs";
import path from "node:path";
import type {
  ICommonImageNodeContract,
  ICommonImageNodeInternalImage,
  IImageNodeExecutionRequest,
} from "../../../../application/execution/comfyui/image-nodes/CommonImageNodeContracts";
import type { DatasetInstanceRepository } from "../../../../application/system-runtime/DatasetInstanceRepository";
import { createImageRecord } from "../../../../domain/dataset-studio/contracts/ImageRecord";
import { createDatasetInstanceImageRecord } from "../../../../domain/system-runtime/DatasetInstanceRecordDomain";
import type { CanonicalRecordValue } from "../../../../domain/dataset-studio/CanonicalDataShapes";
import {
  ComfyImageNodeAdapterBase,
  type IComfyNodeExecutionContext,
} from "./ComfyImageNodeAdapterPattern";

const SAVE_IMAGE_NODE_CONTRACT: ICommonImageNodeContract = Object.freeze({
  identity: Object.freeze({
    id: "image.save-image",
    kind: "save-image",
    version: "1.0.0",
    displayName: "Save Image",
  }),
  capabilities: Object.freeze({
    composable: true,
    inspectable: true,
    previewable: false,
    versionedInputs: true,
    deterministicByDefault: false,
  }),
  inputContract: Object.freeze([
    Object.freeze({ id: "image", type: "image", required: true, inspectable: true }),
    Object.freeze({ id: "datasetInstanceId", type: "asset-reference", required: true, inspectable: true }),
    Object.freeze({ id: "systemId", type: "text", required: false, inspectable: true }),
    Object.freeze({ id: "metadata", type: "metadata", required: false, inspectable: true }),
  ]),
  outputContract: Object.freeze([
    Object.freeze({ id: "record", type: "asset-reference", inspectable: true, previewable: false }),
    Object.freeze({ id: "metadata", type: "metadata", inspectable: true, previewable: false }),
  ]),
  configContract: Object.freeze({
    version: "1.0.0",
    fields: Object.freeze([
      Object.freeze({ id: "filenamePrefix", type: "string", required: false, defaultValue: "loom" }),
    ]),
  }),
});

export class ComfySaveImageNodeAdapter extends ComfyImageNodeAdapterBase {
  public readonly contract = SAVE_IMAGE_NODE_CONTRACT;

  public constructor(
    private readonly datasetRepository: DatasetInstanceRepository,
    private readonly storageRoot: string,
    private readonly now: () => Date = () => new Date(),
    private readonly idGenerator: () => string = () => Math.random().toString(36).slice(2, 10),
  ) {
    super();
  }

  protected resolveComfyClassType(): string {
    return "SaveImage";
  }

  protected mapRequestInputs(
    request: IImageNodeExecutionRequest,
    _context?: IComfyNodeExecutionContext,
  ): Readonly<Record<string, unknown>> {
    const image = this.requireImageInput(request);
    const datasetInstanceId = this.requireStringInput(request, "datasetInstanceId");
    const instance = this.datasetRepository.getById(datasetInstanceId);
    if (!instance) {
      throw new Error(`Target dataset instance '${datasetInstanceId}' was not found.`);
    }

    const filenamePrefix = this.resolvePrefix(request);
    const timestamp = this.now().toISOString().replace(/[:.]/g, "-");
    const unique = this.idGenerator();
    const extension = image.format ?? "png";
    const filename = `${filenamePrefix}-${timestamp}-${unique}.${extension}`;
    const outputDir = path.join(this.storageRoot, datasetInstanceId);
    fs.mkdirSync(outputDir, { recursive: true });
    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, image.buffer);

    const recordId = `record:${datasetInstanceId}:${timestamp}:${unique}`;
    const workflowRef = this.extractStringMetadata(request, "workflowId");
    const sourceImageRef = this.extractStringMetadata(request, "sourceImageRecordId");
    const providedMetadata = this.extractCanonicalMetadata(request.inputs.metadata);

    const record = createDatasetInstanceImageRecord({
      recordId,
      instanceId: datasetInstanceId,
      systemId: instance.systemId,
      datasetAssetId: instance.datasetAssetId,
      datasetAssetVersionId: instance.datasetAssetVersionId,
      image: createImageRecord({
        assetRef: {
          kind: "local-file",
          path: filePath,
          sourceSystem: instance.systemId,
          mimeTypeHint: image.mimeType,
          formatHint: image.format,
        },
        width: image.width ?? 1,
        height: image.height ?? 1,
        format: image.format ?? "png",
        mimeType: image.mimeType,
      }),
      storage: { reference: filePath, provider: "filesystem" },
      metadata: {
        timestamp,
        ...providedMetadata,
      },
      provenance: {
        sourceType: sourceImageRef ? "workflow-derived" : "generated",
        sourceReference: sourceImageRef,
        sourceSystemId: instance.systemId,
        sourceRunId: workflowRef,
        ingestedBy: "comfy-save-image-adapter",
      },
      admittedAt: this.now().toISOString(),
      updatedAt: this.now().toISOString(),
    });

    this.datasetRepository.saveImageRecord(record);

    return Object.freeze({
      images: [image.buffer],
      filename_prefix: filenamePrefix,
      loomDatasetRecordId: record.recordId,
    });
  }

  protected mapResultOutputs(request: IImageNodeExecutionRequest) {
    const datasetInstanceId = this.requireStringInput(request, "datasetInstanceId");
    const records = this.datasetRepository.listImageRecordsByInstanceId(datasetInstanceId);
    const latest = records[0];
    if (!latest) {
      throw new Error(`Save image adapter could not resolve persisted record for '${datasetInstanceId}'.`);
    }

    return Object.freeze([
      Object.freeze({
        outputId: "record",
        value: Object.freeze({
          datasetInstanceId,
          recordId: latest.recordId,
          datasetAssetId: latest.datasetAssetId,
        }),
      }),
      Object.freeze({
        outputId: "metadata",
        value: Object.freeze({
          filename: latest.storage?.reference ? path.basename(latest.storage.reference) : undefined,
          timestamp: latest.admittedAt,
          workflowId: latest.provenance.sourceRunId,
          sourceImageReference: latest.provenance.sourceReference,
        }),
      }),
    ]);
  }

  private resolvePrefix(request: IImageNodeExecutionRequest): string {
    const fromConfig = request.config?.filenamePrefix;
    if (typeof fromConfig === "string" && fromConfig.trim().length > 0) {
      return fromConfig.trim();
    }
    return "loom";
  }

  private requireImageInput(request: IImageNodeExecutionRequest): ICommonImageNodeInternalImage {
    const value = request.inputs.image;
    if (!value || typeof value !== "object") {
      throw new Error("Save image node input 'image' is required.");
    }

    const image = value as ICommonImageNodeInternalImage;
    if (!(image.buffer instanceof Uint8Array) || image.buffer.byteLength === 0) {
      throw new Error("Save image node input 'image.buffer' must be a non-empty Uint8Array.");
    }
    return image;
  }

  private requireStringInput(request: IImageNodeExecutionRequest, key: string): string {
    const value = request.inputs[key];
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(`Save image node input '${key}' is required.`);
    }
    return value.trim();
  }

  private extractStringMetadata(request: IImageNodeExecutionRequest, key: string): string | undefined {
    const metadata = request.inputs.metadata;
    if (!metadata || typeof metadata !== "object") {
      return undefined;
    }
    const value = (metadata as Record<string, unknown>)[key];
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
  }

  private extractCanonicalMetadata(
    input: unknown,
  ): Readonly<Record<string, CanonicalRecordValue>> {
    if (!input || typeof input !== "object") {
      return Object.freeze({});
    }

    const entries = Object.entries(input as Record<string, unknown>).filter(([, value]) =>
      typeof value === "string"
      || typeof value === "number"
      || typeof value === "boolean"
      || value === null,
    );
    return Object.freeze(Object.fromEntries(entries) as Record<string, CanonicalRecordValue>);
  }
}
