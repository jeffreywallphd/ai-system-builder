import fs from "node:fs";
import path from "node:path";
import type {
  ICommonImageNodeContract,
  ICommonImageNodeDatasetSelection,
  ICommonImageNodeInternalImage,
  IImageNodeExecutionRequest,
} from "@application/execution/comfyui/image-nodes/CommonImageNodeContracts";
import type { DatasetInstanceRepository } from "@application/system-runtime/DatasetInstanceRepository";
import type { DatasetInstanceImageRecord } from "@domain/system-runtime/DatasetInstanceRecordDomain";
import {
  ComfyImageNodeAdapterBase,
  type IComfyNodeExecutionContext,
  type IComfyNodeExecutionResult,
} from "./ComfyImageNodeAdapterPattern";

const LOAD_IMAGE_NODE_CONTRACT: ICommonImageNodeContract = Object.freeze({
  identity: Object.freeze({
    id: "image.load-image",
    kind: "load-image",
    version: "1.0.0",
    displayName: "Load Image",
  }),
  capabilities: Object.freeze({
    composable: true,
    inspectable: true,
    previewable: true,
    versionedInputs: true,
    deterministicByDefault: false,
  }),
  inputContract: Object.freeze([
    Object.freeze({ id: "datasetInstanceId", type: "asset-reference", required: true, inspectable: true }),
    Object.freeze({ id: "systemId", type: "text", required: false, inspectable: true }),
    Object.freeze({ id: "selection", type: "metadata", required: false, inspectable: true }),
  ]),
  outputContract: Object.freeze([
    Object.freeze({ id: "image", type: "image", inspectable: true, previewable: true, versioned: true }),
    Object.freeze({ id: "metadata", type: "metadata", inspectable: true, previewable: true, versioned: false }),
  ]),
  configContract: Object.freeze({
    version: "1.0.0",
    fields: Object.freeze([
      Object.freeze({
        id: "selectionStrategy",
        type: "enum",
        required: false,
        defaultValue: "latest",
        options: ["latest", "index", "random"],
      }),
    ]),
  }),
});

interface ResolvedRecordState {
  readonly record: DatasetInstanceImageRecord;
  readonly image: ICommonImageNodeInternalImage;
}

export class ComfyLoadImageNodeAdapter extends ComfyImageNodeAdapterBase {
  public readonly contract = LOAD_IMAGE_NODE_CONTRACT;
  private readonly resolvedByNodeId = new Map<string, ResolvedRecordState>();

  public constructor(
    private readonly datasetRepository: DatasetInstanceRepository,
    private readonly random: () => number = Math.random,
  ) {
    super();
  }

  protected resolveComfyClassType(): string {
    return "LoadImage";
  }

  protected mapRequestInputs(
    request: IImageNodeExecutionRequest,
    _context?: IComfyNodeExecutionContext,
  ): Readonly<Record<string, unknown>> {
    const datasetInstanceId = this.requireStringInput(request, "datasetInstanceId");
    const record = this.selectRecord(request, datasetInstanceId);
    const filePath = this.resolveFilePath(record);
    const imageBuffer = fs.readFileSync(filePath);
    const filename = path.basename(filePath);

    this.resolvedByNodeId.set(request.nodeId, {
      record,
      image: Object.freeze({
        buffer: imageBuffer,
        filename,
        mimeType: record.image.mimeType,
        format: record.image.format,
        width: record.image.width,
        height: record.image.height,
      }),
    });

    return Object.freeze({ image: filename });
  }

  protected mapResultOutputs(
    request: IImageNodeExecutionRequest,
    result: IComfyNodeExecutionResult,
  ) {
    const resolved = this.resolvedByNodeId.get(request.nodeId);
    if (!resolved) {
      throw new Error(`Load image adapter state is unavailable for node '${request.nodeId}'.`);
    }

    const metadata = Object.freeze({
      datasetInstanceId: resolved.record.instanceId,
      datasetAssetId: resolved.record.datasetAssetId,
      imageId: resolved.record.recordId,
      filename: resolved.image.filename,
      width: resolved.image.width,
      height: resolved.image.height,
      preview: Object.freeze({
        kind: "image",
        filename: resolved.image.filename,
        mimeType: resolved.image.mimeType,
        width: resolved.image.width,
        height: resolved.image.height,
      }),
      comfy: Object.freeze({
        loadedImage: result.outputs.image,
      }),
    });

    return Object.freeze([
      Object.freeze({
        outputId: "image",
        value: resolved.image,
        preview: metadata.preview as Readonly<Record<string, unknown>>,
      }),
      Object.freeze({
        outputId: "metadata",
        value: metadata,
      }),
    ]);
  }

  private selectRecord(request: IImageNodeExecutionRequest, datasetInstanceId: string): DatasetInstanceImageRecord {
    const systemId = this.optionalStringInput(request, "systemId");
    const records = systemId
      ? this.datasetRepository.listImageRecordsBySystemId({ systemId, instanceId: datasetInstanceId })
      : this.datasetRepository.listImageRecordsByInstanceId(datasetInstanceId);

    if (records.length === 0) {
      throw new Error(`Dataset instance '${datasetInstanceId}' has no image records to load.`);
    }

    const selection = this.parseSelection(request);

    if (selection.recordId) {
      const byId = records.find((record) => record.recordId === selection.recordId);
      if (!byId) {
        throw new Error(`Image record '${selection.recordId}' was not found in dataset instance '${datasetInstanceId}'.`);
      }
      return byId;
    }

    const strategy = selection.strategy ?? (typeof selection.index === "number" ? "index" : undefined)
      ?? (typeof request.config?.selectionStrategy === "string" ? request.config.selectionStrategy : undefined)
      ?? "latest";

    if (strategy === "index") {
      const index = selection.index ?? 0;
      if (!Number.isInteger(index) || index < 0 || index >= records.length) {
        throw new Error(`Image selection index '${index}' is out of range for dataset instance '${datasetInstanceId}'.`);
      }
      return records[index] as DatasetInstanceImageRecord;
    }

    if (strategy === "random") {
      const index = Math.min(records.length - 1, Math.floor(this.random() * records.length));
      return records[index] as DatasetInstanceImageRecord;
    }

    return records[0] as DatasetInstanceImageRecord;
  }

  private parseSelection(request: IImageNodeExecutionRequest): ICommonImageNodeDatasetSelection {
    const input = request.inputs.selection;
    if (!input || typeof input !== "object") {
      return Object.freeze({});
    }
    const selection = input as ICommonImageNodeDatasetSelection;
    return Object.freeze({
      recordId: typeof selection.recordId === "string" ? selection.recordId : undefined,
      index: typeof selection.index === "number" ? selection.index : undefined,
      strategy: selection.strategy,
    });
  }

  private resolveFilePath(record: DatasetInstanceImageRecord): string {
    const sourcePath = record.storage?.reference
      ?? (record.image.assetRef.kind === "local-file" ? record.image.assetRef.path : undefined)
      ?? (record.image.assetRef.kind === "generated-output" ? record.image.assetRef.path : undefined);

    if (!sourcePath) {
      throw new Error(`Dataset image record '${record.recordId}' does not have a resolvable file path.`);
    }

    return sourcePath;
  }

  private requireStringInput(request: IImageNodeExecutionRequest, key: string): string {
    const value = request.inputs[key];
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(`Load image node input '${key}' is required.`);
    }
    return value.trim();
  }

  private optionalStringInput(request: IImageNodeExecutionRequest, key: string): string | undefined {
    const value = request.inputs[key];
    if (typeof value !== "string") {
      return undefined;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }
}

