import { AssetContractShapeKinds } from "@domain/contracts/AssetContract";
import { CanonicalDataAsset } from "@domain/dataset-studio/CanonicalDataAsset";
import { createCanonicalRecordsShape, type CanonicalRecordValue } from "@domain/dataset-studio/CanonicalDataShapes";
import {
  UnifiedIngestionContractVersion,
  type UnifiedIngestionConfiguration,
  type UnifiedIngestionConfigMode,
  type UnifiedIngestionSourceReference,
  UnifiedIngestionOutputTargetKinds,
  UnifiedIngestionSourceKinds,
  UnifiedIngestionStrategyKinds,
} from "@domain/dataset-studio/UnifiedIngestionDomain";
import type { DatasetSchemaIntentId } from "@domain/dataset-studio/schema-intents/DatasetSchemaIntent";
import {
  DataAssetConfigFieldKinds,
  DataAssetConfigFieldVisibilities,
  createDataAssetConfigSchema,
  type DataAssetConfigSchema,
} from "./DataAssetConfiguration";
import { resolveUnifiedIngestionConfiguration } from "./UnifiedIngestionConfiguration";
import {
  UnifiedIngestionOrchestrationService,
  type UnifiedIngestionPreviewResult,
  type UnifiedIngestionResult,
} from "./UnifiedIngestionOrchestrationService";
import {
  UnifiedIngestionBatchOrchestrationService,
  type UnifiedIngestionBatchResult,
} from "./UnifiedIngestionBatchOrchestrationService";
import type { SourceLocatorRequest } from "./SourceLocatorInputAbstraction";

export const UnifiedIngestionAssetId = "unified-ingestion";
export const UnifiedIngestionAssetVersion = "1.0.0";
export const UnifiedIngestionAssetInputContractVersion = "1.0.0";
export const UnifiedIngestionAssetOutputContractVersion = "1.0.0";

export interface UnifiedIngestionAssetExecutionRequest {
  readonly source: UnifiedIngestionSourceReference;
  readonly payload?: string | Uint8Array;
  readonly schemaIntentId?: DatasetSchemaIntentId;
  readonly configuration?: UnifiedIngestionConfiguration;
  readonly configurationMode?: UnifiedIngestionConfigMode;
  readonly configurationValues?: Readonly<Record<string, CanonicalRecordValue>>;
  readonly converterContext?: {
    readonly operationId?: string;
    readonly initiatedBy?: string;
    readonly requestId?: string;
    readonly pipelineId?: string;
    readonly stageId?: string;
    readonly lineageAssetId?: string;
  };
}

export interface UnifiedIngestionAssetExecutionResult {
  readonly contractVersion: typeof UnifiedIngestionContractVersion;
  readonly inputContractVersion: typeof UnifiedIngestionAssetInputContractVersion;
  readonly outputContractVersion: typeof UnifiedIngestionAssetOutputContractVersion;
  readonly assetId: typeof UnifiedIngestionAssetId;
  readonly assetVersion: typeof UnifiedIngestionAssetVersion;
  readonly mode: "execute" | "preview";
  readonly configuration: UnifiedIngestionConfiguration;
  readonly result: UnifiedIngestionResult | UnifiedIngestionPreviewResult;
}

export interface UnifiedIngestionBatchExecutionRequest {
  readonly sourceRequest?: SourceLocatorRequest;
  readonly sources?: ReadonlyArray<UnifiedIngestionSourceReference>;
  readonly payloadBySourceId?: Readonly<Record<string, string | Uint8Array>>;
  readonly schemaIntentId?: DatasetSchemaIntentId;
  readonly configuration?: UnifiedIngestionConfiguration;
  readonly configurationMode?: UnifiedIngestionConfigMode;
  readonly configurationValues?: Readonly<Record<string, CanonicalRecordValue>>;
  readonly converterContext?: {
    readonly operationId?: string;
    readonly initiatedBy?: string;
    readonly requestId?: string;
    readonly pipelineId?: string;
    readonly stageId?: string;
    readonly lineageAssetId?: string;
  };
  readonly options?: {
    readonly continueOnError?: boolean;
    readonly maxItems?: number;
    readonly concurrency?: number;
  };
}

export interface UnifiedIngestionAssetBatchExecutionResult {
  readonly contractVersion: typeof UnifiedIngestionContractVersion;
  readonly inputContractVersion: typeof UnifiedIngestionAssetInputContractVersion;
  readonly outputContractVersion: typeof UnifiedIngestionAssetOutputContractVersion;
  readonly assetId: typeof UnifiedIngestionAssetId;
  readonly assetVersion: typeof UnifiedIngestionAssetVersion;
  readonly mode: "execute-batch" | "preview-batch";
  readonly configuration: UnifiedIngestionConfiguration;
  readonly result: UnifiedIngestionBatchResult;
}

export class UnifiedIngestionAssetExecutionWrapper {
  private readonly orchestration: UnifiedIngestionOrchestrationService;
  private readonly batchOrchestration: UnifiedIngestionBatchOrchestrationService;

  constructor(options?: {
    readonly orchestration?: UnifiedIngestionOrchestrationService;
    readonly batchOrchestration?: UnifiedIngestionBatchOrchestrationService;
  }) {
    this.orchestration = options?.orchestration ?? new UnifiedIngestionOrchestrationService();
    this.batchOrchestration = options?.batchOrchestration ?? new UnifiedIngestionBatchOrchestrationService({
      orchestration: this.orchestration,
    });
  }

  public async execute(request: UnifiedIngestionAssetExecutionRequest): Promise<UnifiedIngestionAssetExecutionResult> {
    const configurationResolution = resolveUnifiedIngestionConfiguration({
      mode: request.configurationMode,
      values: request.configurationValues,
      base: request.configuration,
    });
    const result = await this.orchestration.ingest({
      source: request.source,
      payload: request.payload,
      schemaIntentId: request.schemaIntentId,
      configuration: configurationResolution.configuration,
      converterContext: request.converterContext,
    });
    return Object.freeze({
      contractVersion: UnifiedIngestionContractVersion,
      inputContractVersion: UnifiedIngestionAssetInputContractVersion,
      outputContractVersion: UnifiedIngestionAssetOutputContractVersion,
      assetId: UnifiedIngestionAssetId,
      assetVersion: UnifiedIngestionAssetVersion,
      mode: "execute",
      configuration: configurationResolution.configuration,
      result,
    });
  }

  public async preview(request: UnifiedIngestionAssetExecutionRequest): Promise<UnifiedIngestionAssetExecutionResult> {
    const configurationResolution = resolveUnifiedIngestionConfiguration({
      mode: request.configurationMode,
      values: request.configurationValues,
      base: request.configuration,
    });
    const result = await this.orchestration.ingestWithPreview({
      source: request.source,
      payload: request.payload,
      schemaIntentId: request.schemaIntentId,
      configuration: configurationResolution.configuration,
      converterContext: request.converterContext,
    });
    return Object.freeze({
      contractVersion: UnifiedIngestionContractVersion,
      inputContractVersion: UnifiedIngestionAssetInputContractVersion,
      outputContractVersion: UnifiedIngestionAssetOutputContractVersion,
      assetId: UnifiedIngestionAssetId,
      assetVersion: UnifiedIngestionAssetVersion,
      mode: "preview",
      configuration: configurationResolution.configuration,
      result,
    });
  }

  public async executeBatch(
    request: UnifiedIngestionBatchExecutionRequest,
  ): Promise<UnifiedIngestionAssetBatchExecutionResult> {
    const configurationResolution = resolveUnifiedIngestionConfiguration({
      mode: request.configurationMode,
      values: request.configurationValues,
      base: request.configuration,
    });
    const result = await this.batchOrchestration.executeBatch({
      sourceRequest: request.sourceRequest,
      sources: request.sources,
      payloadBySourceId: request.payloadBySourceId,
      schemaIntentId: request.schemaIntentId,
      configuration: configurationResolution.configuration,
      converterContext: request.converterContext,
      options: request.options,
    });
    return Object.freeze({
      contractVersion: UnifiedIngestionContractVersion,
      inputContractVersion: UnifiedIngestionAssetInputContractVersion,
      outputContractVersion: UnifiedIngestionAssetOutputContractVersion,
      assetId: UnifiedIngestionAssetId,
      assetVersion: UnifiedIngestionAssetVersion,
      mode: "execute-batch",
      configuration: configurationResolution.configuration,
      result,
    });
  }

  public async previewBatch(
    request: UnifiedIngestionBatchExecutionRequest,
  ): Promise<UnifiedIngestionAssetBatchExecutionResult> {
    const configurationResolution = resolveUnifiedIngestionConfiguration({
      mode: request.configurationMode,
      values: request.configurationValues,
      base: request.configuration,
    });
    const result = await this.batchOrchestration.previewBatch({
      sourceRequest: request.sourceRequest,
      sources: request.sources,
      payloadBySourceId: request.payloadBySourceId,
      schemaIntentId: request.schemaIntentId,
      configuration: configurationResolution.configuration,
      converterContext: request.converterContext,
      options: request.options,
    });
    return Object.freeze({
      contractVersion: UnifiedIngestionContractVersion,
      inputContractVersion: UnifiedIngestionAssetInputContractVersion,
      outputContractVersion: UnifiedIngestionAssetOutputContractVersion,
      assetId: UnifiedIngestionAssetId,
      assetVersion: UnifiedIngestionAssetVersion,
      mode: "preview-batch",
      configuration: configurationResolution.configuration,
      result,
    });
  }
}

export function createUnifiedIngestionConfigSchema(assetId: string): DataAssetConfigSchema {
  return createDataAssetConfigSchema({
    schemaId: `data-asset.${assetId}.config`,
    version: "1.0.0",
    fields: Object.freeze([
      {
        key: "outputTarget",
        label: "Output target",
        kind: DataAssetConfigFieldKinds.select,
        visibility: DataAssetConfigFieldVisibilities.simple,
        required: true,
        defaultValue: UnifiedIngestionOutputTargetKinds.records,
        options: Object.freeze([
          { value: UnifiedIngestionOutputTargetKinds.records, label: "Records (CSV/JSON)" },
          { value: UnifiedIngestionOutputTargetKinds.textItems, label: "Text items (Document/PDF)" },
          { value: UnifiedIngestionOutputTargetKinds.imageMetadataRecords, label: "Image metadata records" },
        ]),
      },
      {
        key: "previewSampleLimit",
        label: "Preview sample limit",
        kind: DataAssetConfigFieldKinds.number,
        visibility: DataAssetConfigFieldVisibilities.advanced,
        defaultValue: 25,
        min: 1,
        max: 100,
      },
      {
        key: "strategy",
        label: "Routing strategy",
        kind: DataAssetConfigFieldKinds.select,
        visibility: DataAssetConfigFieldVisibilities.advanced,
        required: true,
        defaultValue: UnifiedIngestionStrategyKinds.auto,
        options: Object.freeze([
          { value: UnifiedIngestionStrategyKinds.auto, label: "Auto detect and route" },
          { value: UnifiedIngestionStrategyKinds.csv, label: "Force CSV ingestor" },
          { value: UnifiedIngestionStrategyKinds.json, label: "Force JSON ingestor" },
          { value: UnifiedIngestionStrategyKinds.document, label: "Force document ingestor" },
          { value: UnifiedIngestionStrategyKinds.image, label: "Force image ingestor" },
        ]),
      },
      {
        key: "explicitSourceKind",
        label: "Detected source override",
        kind: DataAssetConfigFieldKinds.select,
        visibility: DataAssetConfigFieldVisibilities.advanced,
        options: Object.freeze([
          { value: UnifiedIngestionSourceKinds.csv, label: "CSV" },
          { value: UnifiedIngestionSourceKinds.json, label: "JSON" },
          { value: UnifiedIngestionSourceKinds.document, label: "Document/PDF" },
          { value: UnifiedIngestionSourceKinds.image, label: "Image" },
        ]),
      },
      {
        key: "enableContentSniffing",
        label: "Enable content sniffing",
        kind: DataAssetConfigFieldKinds.boolean,
        visibility: DataAssetConfigFieldVisibilities.advanced,
        defaultValue: true,
      },
      {
        key: "delimiterHint",
        label: "CSV delimiter hint",
        kind: DataAssetConfigFieldKinds.string,
        visibility: DataAssetConfigFieldVisibilities.advanced,
      },
      {
        key: "textEncoding",
        label: "Text encoding",
        kind: DataAssetConfigFieldKinds.string,
        visibility: DataAssetConfigFieldVisibilities.advanced,
        defaultValue: "utf-8",
      },
      {
        key: "normalizeHeadersToLowercase",
        label: "Lowercase CSV headers",
        kind: DataAssetConfigFieldKinds.boolean,
        visibility: DataAssetConfigFieldVisibilities.advanced,
        defaultValue: false,
      },
      {
        key: "flattenJson",
        label: "Flatten nested JSON",
        kind: DataAssetConfigFieldKinds.boolean,
        visibility: DataAssetConfigFieldVisibilities.advanced,
        defaultValue: false,
      },
      {
        key: "flattenJsonDepth",
        label: "Flatten max depth",
        kind: DataAssetConfigFieldKinds.number,
        visibility: DataAssetConfigFieldVisibilities.advanced,
        min: 1,
        max: 16,
      },
      {
        key: "documentMaxPages",
        label: "Document max pages",
        kind: DataAssetConfigFieldKinds.number,
        visibility: DataAssetConfigFieldVisibilities.advanced,
        min: 1,
        max: 500,
      },
      {
        key: "imageExtractExif",
        label: "Extract EXIF metadata",
        kind: DataAssetConfigFieldKinds.boolean,
        visibility: DataAssetConfigFieldVisibilities.advanced,
      },
      {
        key: "imageNormalizeOrientation",
        label: "Normalize image orientation",
        kind: DataAssetConfigFieldKinds.boolean,
        visibility: DataAssetConfigFieldVisibilities.advanced,
      },
    ]),
  });
}

export function createUnifiedIngestionDataAsset(
  config: Readonly<Record<string, CanonicalRecordValue>>,
): CanonicalDataAsset {
  return new CanonicalDataAsset({
    id: UnifiedIngestionAssetId,
    name: "Unified Ingestion",
    version: UnifiedIngestionAssetVersion,
    source: { type: "generated", workflowId: "dataset-studio-ingestors" },
    location: { accessMethod: "virtual", location: "dataset://unified-ingestion" },
    outputShape: createCanonicalRecordsShape({
      records: Object.freeze([]),
      metadata: {
        schemaVersion: "1.0.0",
        source: {
          format: "unified-ingestion",
        },
      },
    }),
    contracts: {
      version: "1.0.0",
      input: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Unified ingestion asset wrapper input contract v1.0.0 (source + configuration + optional payload).",
      },
      output: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Unified ingestion asset wrapper output contract v1.0.0 (canonical output + preview/error/fallback metadata).",
      },
    },
    config,
    versionMetadata: {
      schemaVersion: "1.0.0",
      contractVersion: "1.0.0",
      revision: 1,
      publishedVersionId: UnifiedIngestionAssetVersion,
    },
    semanticMetadata: {
      description: "Default unified ingestion entry point with optional advanced routing overrides.",
      tags: ["dataset", "ingestion", "unified", "routing"],
    },
  });
}

