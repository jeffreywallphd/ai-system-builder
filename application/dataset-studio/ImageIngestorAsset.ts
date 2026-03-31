import { z } from "zod";
import { AssetContractShapeKinds } from "../../domain/contracts/AssetContract";
import { CanonicalDataAsset } from "../../domain/dataset-studio/CanonicalDataAsset";
import { createCanonicalImageMetadataRecordsShape, type CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";
import { DataSourceReferenceKinds, type DataSourceReference, type ResolvedDataSource } from "./DataConverterContracts";
import { DefaultDataSourceLocator, type IDataSourceLocator } from "./DataSourceLocator";
import {
  DataAssetConfigFieldKinds,
  DataAssetConfigFieldVisibilities,
  createDataAssetConfigSchema,
  type DataAssetConfigSchema,
} from "./DataAssetConfiguration";
import {
  IngestionIssueCategories,
  IngestionIssueRecoverabilities,
  IngestionExecutionContextSchema,
  contextToIssueSource,
  createIngestionIssue,
  toIngestionIssueFromError,
  toIngestionIssuesFromZodError,
  type IngestionExecutionContext,
} from "./IngestionContracts";
import {
  buildIngestionFailureEnvelope,
  buildIngestionPreviewEnvelope,
  buildIngestionSuccessEnvelope,
  normalizeImageMetadataOutput,
  type IngestionFailureEnvelope,
  type IngestionPreviewEnvelope,
  type IngestionSuccessEnvelope,
} from "./IngestionCanonicalNormalization";

export const ImageIngestorErrorCodes = Object.freeze({
  invalidConfig: "image-ingestor-invalid-config",
  unreadableSource: "image-ingestor-unreadable-source",
  unsupportedType: "image-ingestor-unsupported-type",
  metadataExtractionFailed: "image-ingestor-metadata-extraction-failed",
} as const);

export type ImageIngestorErrorCode = typeof ImageIngestorErrorCodes[keyof typeof ImageIngestorErrorCodes];

export interface ImageIngestorDiagnostic {
  readonly code: ImageIngestorErrorCode;
  readonly message: string;
  readonly path?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export const ImageIngestorConfigSchema = z.object({
  extractExif: z.boolean().default(true),
  generatePreviewMetadata: z.boolean().default(true),
  normalizeOrientation: z.boolean().default(true),
  includeFileStats: z.boolean().default(true),
});

export type ImageIngestorConfig = z.output<typeof ImageIngestorConfigSchema>;

export interface ImageIngestorExecutionRequest {
  readonly source: ResolvedDataSource;
  readonly config?: Partial<ImageIngestorConfig>;
  readonly imageId?: string;
  readonly context?: Partial<IngestionExecutionContext>;
}

export interface ImageIngestorResolveRequest {
  readonly source: DataSourceReference;
  readonly config?: Partial<ImageIngestorConfig>;
  readonly imageId?: string;
}

export interface ImageIngestorPreviewResult {
  readonly imageId: string;
  readonly format: string;
  readonly width: number;
  readonly height: number;
  readonly fileSizeInBytes?: number;
  readonly orientation?: number;
  readonly source: {
    readonly reference: string;
    readonly fileName?: string;
    readonly contentType?: string;
  };
  readonly exifHighlights?: Readonly<Record<string, CanonicalRecordValue>>;
  readonly normalized: IngestionPreviewEnvelope;
}

export interface ImageIngestorExecutionSuccess {
  readonly ok: true;
  readonly config: ImageIngestorConfig;
  readonly output: ReturnType<typeof createCanonicalImageMetadataRecordsShape>;
  readonly normalized: IngestionSuccessEnvelope<ReturnType<typeof createCanonicalImageMetadataRecordsShape>>;
  readonly metadata: Readonly<Record<string, CanonicalRecordValue>>;
  readonly preview: ImageIngestorPreviewResult;
  readonly diagnostics: ReadonlyArray<ImageIngestorDiagnostic>;
}

export interface ImageIngestorExecutionFailure {
  readonly ok: false;
  readonly normalized: IngestionFailureEnvelope;
  readonly diagnostics: ReadonlyArray<ImageIngestorDiagnostic>;
}

export type ImageIngestorExecutionResult = ImageIngestorExecutionSuccess | ImageIngestorExecutionFailure;

interface ImageMetadataResult {
  readonly width: number;
  readonly height: number;
  readonly format: string;
  readonly orientation?: number;
}

export interface IImageMetadataProbe {
  probe(payload: Uint8Array): Promise<ImageMetadataResult>;
}

export interface IImageExifReader {
  read(payload: Uint8Array): Promise<Readonly<Record<string, unknown>> | undefined>;
}

class DefaultImageMetadataProbe implements IImageMetadataProbe {
  public async probe(payload: Uint8Array): Promise<ImageMetadataResult> {
    let imageSizeRecord: Readonly<Record<string, unknown>>;
    try {
      imageSizeRecord = await import("image-size") as Readonly<Record<string, unknown>>;
    } catch (error) {
      throw new Error(`Unable to load 'image-size': ${error instanceof Error ? error.message : String(error)}`);
    }

    const imageSizeFn = (imageSizeRecord.imageSize ?? imageSizeRecord.default) as
      | ((input: Uint8Array) => { width?: number; height?: number; type?: string; orientation?: number })
      | undefined;

    if (typeof imageSizeFn !== "function") {
      throw new Error("'image-size' API is unavailable.");
    }

    const quick = imageSizeFn(payload);

    let sharpRecord: Readonly<Record<string, unknown>>;
    try {
      sharpRecord = await import("sharp") as Readonly<Record<string, unknown>>;
    } catch (error) {
      throw new Error(`Unable to load 'sharp': ${error instanceof Error ? error.message : String(error)}`);
    }

    const sharpFactory = (sharpRecord.default ?? sharpRecord) as
      | ((input: Uint8Array) => { metadata(): Promise<{ width?: number; height?: number; format?: string; orientation?: number }> })
      | undefined;

    if (typeof sharpFactory !== "function") {
      throw new Error("'sharp' API is unavailable.");
    }

    const details = await sharpFactory(payload).metadata();
    const width = details.width ?? quick.width;
    const height = details.height ?? quick.height;
    const format = (details.format ?? quick.type ?? "unknown").toLowerCase();
    const orientation = details.orientation ?? quick.orientation;

    if (!width || !height) {
      throw new Error("Unable to determine image dimensions.");
    }

    return Object.freeze({
      width,
      height,
      format,
      orientation,
    });
  }
}

class DefaultImageExifReader implements IImageExifReader {
  public async read(payload: Uint8Array): Promise<Readonly<Record<string, unknown>> | undefined> {
    let exifrRecord: Readonly<Record<string, unknown>>;
    try {
      exifrRecord = await import("exifr") as Readonly<Record<string, unknown>>;
    } catch {
      return undefined;
    }

    const parseFn = exifrRecord.parse as ((input: Uint8Array, options?: Readonly<Record<string, unknown>>) => Promise<unknown>) | undefined;
    if (typeof parseFn !== "function") {
      return undefined;
    }

    const parsed = await parseFn(payload, { translateValues: false });
    if (!parsed || typeof parsed !== "object") {
      return undefined;
    }

    return Object.freeze({ ...(parsed as Record<string, unknown>) });
  }
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function toUint8Array(payload: ResolvedDataSource["payload"]): Uint8Array | undefined {
  if (payload instanceof Uint8Array) {
    return payload;
  }
  if (typeof payload === "string") {
    return new TextEncoder().encode(payload);
  }
  return undefined;
}

function toCanonicalRecordValue(value: unknown): CanonicalRecordValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry) => toCanonicalRecordValue(entry)));
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => [key, toCanonicalRecordValue(entry)] as const);
    return Object.freeze(Object.fromEntries(entries));
  }
  return String(value);
}

function normalizeExifHighlights(exif: Readonly<Record<string, unknown>> | undefined): Readonly<Record<string, CanonicalRecordValue>> | undefined {
  if (!exif) {
    return undefined;
  }

  const keys = [
    "Make",
    "Model",
    "LensModel",
    "DateTimeOriginal",
    "Orientation",
    "GPSLatitude",
    "GPSLongitude",
  ];
  const highlights = Object.fromEntries(
    keys
      .filter((key) => key in exif)
      .map((key) => [key, toCanonicalRecordValue(exif[key])]),
  );

  return Object.keys(highlights).length > 0 ? Object.freeze(highlights) : undefined;
}

function inferExtension(source: ResolvedDataSource): string | undefined {
  const name = normalizeOptional(source.fileName)?.toLowerCase();
  if (!name || !name.includes(".")) {
    return undefined;
  }
  return name.slice(name.lastIndexOf("."));
}

function isSupportedImage(source: ResolvedDataSource): boolean {
  const extension = inferExtension(source);
  const contentType = normalizeOptional(source.contentType)?.toLowerCase();
  return extension === ".png"
    || extension === ".jpg"
    || extension === ".jpeg"
    || extension === ".webp"
    || contentType === "image/png"
    || contentType === "image/jpeg"
    || contentType === "image/webp";
}

function normalizeOrientationDimensions(metadata: ImageMetadataResult): { width: number; height: number } {
  if (metadata.orientation && [5, 6, 7, 8].includes(metadata.orientation)) {
    return { width: metadata.height, height: metadata.width };
  }
  return { width: metadata.width, height: metadata.height };
}

export interface ImageIngestorAssetOptions {
  readonly sourceLocator?: IDataSourceLocator;
  readonly metadataProbe?: IImageMetadataProbe;
  readonly exifReader?: IImageExifReader;
}

export class ImageIngestorAsset {
  public static readonly assetId = "image-ingestor-v1";
  public static readonly assetVersion = "1.0.0";

  public readonly inputContract = Object.freeze({
    kind: AssetContractShapeKinds.jsonSchema,
    description: "Image source reference/resolved source and metadata extraction configuration.",
  });

  public readonly outputContract = Object.freeze({
    kind: AssetContractShapeKinds.jsonSchema,
    description: "Canonical image-metadata-records output for multimodal image ingestion flows.",
  });

  private readonly sourceLocator: IDataSourceLocator;
  private readonly metadataProbe: IImageMetadataProbe;
  private readonly exifReader: IImageExifReader;

  constructor(options: ImageIngestorAssetOptions = {}) {
    this.sourceLocator = options.sourceLocator ?? new DefaultDataSourceLocator();
    this.metadataProbe = options.metadataProbe ?? new DefaultImageMetadataProbe();
    this.exifReader = options.exifReader ?? new DefaultImageExifReader();
  }

  public async resolveAndExecute(request: ImageIngestorResolveRequest): Promise<ImageIngestorExecutionResult> {
    const assetIdentity = Object.freeze({
      assetId: ImageIngestorAsset.assetId,
      assetVersion: ImageIngestorAsset.assetVersion,
    });
    try {
      const source = await this.sourceLocator.resolve({ source: request.source });
      return this.execute({ source, config: request.config, imageId: request.imageId });
    } catch (error) {
      const context = IngestionExecutionContextSchema.parse({});
      const issues = Object.freeze([toIngestionIssueFromError({
        code: ImageIngestorErrorCodes.unreadableSource,
        message: "Unable to resolve image source reference.",
        error,
        category: IngestionIssueCategories.unreadableSource,
        recoverability: IngestionIssueRecoverabilities.fixSource,
        source: contextToIssueSource({
          sourceReference: request.source.kind === DataSourceReferenceKinds.localFile
            ? request.source.path
            : request.source.kind === DataSourceReferenceKinds.url
              ? request.source.url
              : "in-memory",
        }),
      })]);
      return Object.freeze({
        ok: false,
        diagnostics: Object.freeze([Object.freeze({
          code: ImageIngestorErrorCodes.unreadableSource,
          message: "Unable to resolve image source reference.",
          details: Object.freeze({
            cause: error instanceof Error ? error.message : String(error),
            sourceKind: request.source.kind,
            sourceReference: request.source.kind === DataSourceReferenceKinds.localFile
              ? request.source.path
              : request.source.kind === DataSourceReferenceKinds.url
                ? request.source.url
                : "in-memory",
          }),
        } satisfies ImageIngestorDiagnostic)]),
        normalized: buildIngestionFailureEnvelope({
          context,
          issues,
          asset: assetIdentity,
          configSummary: request.config,
        }),
      });
    }
  }

  public async execute(request: ImageIngestorExecutionRequest): Promise<ImageIngestorExecutionResult> {
    const assetIdentity = Object.freeze({
      assetId: ImageIngestorAsset.assetId,
      assetVersion: ImageIngestorAsset.assetVersion,
    });
    const parsedConfig = ImageIngestorConfigSchema.safeParse(request.config ?? {});
    if (!parsedConfig.success) {
      const parsedContext = IngestionExecutionContextSchema.safeParse(request.context ?? {});
      const issues = toIngestionIssuesFromZodError(parsedConfig.error, ImageIngestorErrorCodes.invalidConfig, {
        category: IngestionIssueCategories.invalidConfiguration,
        source: contextToIssueSource(parsedContext.success ? parsedContext.data : request.context),
      });
      return Object.freeze({
        ok: false,
        diagnostics: Object.freeze(parsedConfig.error.issues.map((issue) => Object.freeze({
          code: ImageIngestorErrorCodes.invalidConfig,
          message: issue.message,
          path: issue.path.join("."),
        } satisfies ImageIngestorDiagnostic))),
        normalized: buildIngestionFailureEnvelope({
          context: parsedContext.success ? parsedContext.data : IngestionExecutionContextSchema.parse({}),
          issues,
          asset: assetIdentity,
          configSummary: request.config,
        }),
      });
    }

    const config = parsedConfig.data;
    const ingestionContext = IngestionExecutionContextSchema.parse({
      ...request.context,
      sourceReference: request.source.reference,
      sourceAssetId: request.source.sourceAssetId,
      sourceVersionId: request.source.sourceVersionId,
      fileName: request.source.fileName,
      contentType: request.source.contentType,
    });
    if (!isSupportedImage(request.source)) {
      const issues = Object.freeze([createIngestionIssue({
        code: ImageIngestorErrorCodes.unsupportedType,
        message: "Image ingestor supports PNG, JPG/JPEG, and WEBP sources.",
        category: IngestionIssueCategories.unsupportedSourceType,
        recoverability: IngestionIssueRecoverabilities.fixSource,
        source: contextToIssueSource(ingestionContext),
      })]);
      return Object.freeze({
        ok: false,
        diagnostics: Object.freeze([Object.freeze({
          code: ImageIngestorErrorCodes.unsupportedType,
          message: "Image ingestor supports PNG, JPG/JPEG, and WEBP sources.",
          details: Object.freeze({
            fileName: request.source.fileName,
            contentType: request.source.contentType,
          }),
        } satisfies ImageIngestorDiagnostic)]),
        normalized: buildIngestionFailureEnvelope({
          context: ingestionContext,
          issues,
          asset: assetIdentity,
          configSummary: config,
        }),
      });
    }

    const payload = toUint8Array(request.source.payload);
    if (!payload || payload.length === 0) {
      const issues = Object.freeze([createIngestionIssue({
        code: ImageIngestorErrorCodes.unreadableSource,
        message: "Image payload is missing or unreadable.",
        category: IngestionIssueCategories.unreadableSource,
        recoverability: IngestionIssueRecoverabilities.fixSource,
        source: contextToIssueSource(ingestionContext),
      })]);
      return Object.freeze({
        ok: false,
        diagnostics: Object.freeze([Object.freeze({
          code: ImageIngestorErrorCodes.unreadableSource,
          message: "Image payload is missing or unreadable.",
          details: Object.freeze({ reference: request.source.reference }),
        } satisfies ImageIngestorDiagnostic)]),
        normalized: buildIngestionFailureEnvelope({
          context: ingestionContext,
          issues,
          asset: assetIdentity,
          configSummary: config,
        }),
      });
    }

    let metadata: ImageMetadataResult;
    try {
      metadata = await this.metadataProbe.probe(payload);
    } catch (error) {
      const issues = Object.freeze([toIngestionIssueFromError({
        code: ImageIngestorErrorCodes.metadataExtractionFailed,
        message: "Image metadata extraction failed.",
        error,
        category: IngestionIssueCategories.parseExtractionFailure,
        recoverability: IngestionIssueRecoverabilities.fixSource,
        source: contextToIssueSource(ingestionContext),
      })]);
      return Object.freeze({
        ok: false,
        diagnostics: Object.freeze([Object.freeze({
          code: ImageIngestorErrorCodes.metadataExtractionFailed,
          message: "Image metadata extraction failed.",
          details: Object.freeze({
            cause: error instanceof Error ? error.message : String(error),
            reference: request.source.reference,
          }),
        } satisfies ImageIngestorDiagnostic)]),
        normalized: buildIngestionFailureEnvelope({
          context: ingestionContext,
          issues,
          asset: assetIdentity,
          configSummary: config,
        }),
      });
    }

    const orientation = metadata.orientation;
    const normalizedDimensions = config.normalizeOrientation
      ? normalizeOrientationDimensions(metadata)
      : { width: metadata.width, height: metadata.height };

    const exifRaw = config.extractExif ? await this.exifReader.read(payload) : undefined;
    const exifHighlights = normalizeExifHighlights(exifRaw);
    const imageId = normalizeOptional(request.imageId)
      ?? normalizeOptional(request.source.fileName)
      ?? "image-1";

    const metadataRecord: Record<string, CanonicalRecordValue> = {
      width: normalizedDimensions.width,
      height: normalizedDimensions.height,
      format: metadata.format,
      orientation: orientation ?? null,
      sourceReference: request.source.reference,
      normalizeOrientationApplied: config.normalizeOrientation,
    };

    if (config.includeFileStats) {
      metadataRecord.fileSizeInBytes = payload.byteLength;
    }
    if (exifHighlights) {
      metadataRecord.exif = exifHighlights;
    }

    const output = createCanonicalImageMetadataRecordsShape({
      items: Object.freeze([Object.freeze({
        itemId: `image-item-${imageId}`,
        imageId,
        label: metadata.format,
        attributes: Object.freeze(metadataRecord),
      })]),
      metadata: {
        schemaVersion: "1.0.0",
        source: {
          fileName: request.source.fileName,
          contentType: request.source.contentType,
          format: metadata.format,
        },
        attributes: {
          ...metadataRecord,
          originalWidth: metadata.width,
          originalHeight: metadata.height,
        },
      },
    });

    const preview = Object.freeze({
      imageId,
      format: metadata.format,
      width: normalizedDimensions.width,
      height: normalizedDimensions.height,
      fileSizeInBytes: config.includeFileStats ? payload.byteLength : undefined,
      orientation,
      source: Object.freeze({
        reference: request.source.reference,
        fileName: request.source.fileName,
        contentType: request.source.contentType,
      }),
      exifHighlights: config.generatePreviewMetadata ? exifHighlights : undefined,
      normalized: buildIngestionPreviewEnvelope({
        ingestor: ImageIngestorAsset.assetId,
        context: ingestionContext,
        asset: assetIdentity,
        configSummary: config,
        totalCount: 1,
        sampleCount: 1,
        preview: buildIngestionSuccessEnvelope({
          output: createCanonicalImageMetadataRecordsShape({
            items: Object.freeze([Object.freeze({
              itemId: `preview-image-${imageId}`,
              imageId,
              label: metadata.format,
              attributes: Object.freeze({
                width: normalizedDimensions.width,
                height: normalizedDimensions.height,
                format: metadata.format,
              }),
            })]),
            metadata: {
              schemaVersion: "1.0.0",
              source: {
                fileName: request.source.fileName,
                contentType: request.source.contentType,
                format: metadata.format,
              },
            },
          }),
          context: ingestionContext,
          asset: assetIdentity,
          configSummary: config,
        }).preview,
        sample: Object.freeze([Object.freeze({
          imageId,
          width: normalizedDimensions.width,
          height: normalizedDimensions.height,
          format: metadata.format,
        })]),
        metadata: Object.freeze({
          fileSizeInBytes: config.includeFileStats ? payload.byteLength : undefined,
          orientation,
        }),
        issues: config.extractExif && !exifHighlights
          ? Object.freeze([createIngestionIssue({
            code: "image-ingestor-partial-exif",
            message: "EXIF metadata was not available for this source.",
            category: IngestionIssueCategories.previewFailure,
            severity: "warning",
            recoverability: IngestionIssueRecoverabilities.partial,
            source: contextToIssueSource(ingestionContext),
          })])
          : Object.freeze([]),
      }),
    } satisfies ImageIngestorPreviewResult);

    const normalizedOutput = normalizeImageMetadataOutput({
      output,
      context: {
        ...ingestionContext,
        formatHint: metadata.format,
      },
      additionalAttributes: Object.freeze({
        sourceReference: request.source.reference,
      }),
    });
    return Object.freeze({
      ok: true,
      config,
      output: normalizedOutput,
      normalized: buildIngestionSuccessEnvelope({
        output: normalizedOutput,
        context: ingestionContext,
        asset: assetIdentity,
        configSummary: config,
      }),
      metadata: Object.freeze(metadataRecord),
      preview,
      diagnostics: Object.freeze([]),
    });
  }

  public async preview(request: ImageIngestorExecutionRequest): Promise<ImageIngestorPreviewResult | ImageIngestorExecutionFailure> {
    const result = await this.execute(request);
    if (!result.ok) {
      return result;
    }
    return result.preview;
  }
}

export function createImageIngestorConfigSchema(assetId: string): DataAssetConfigSchema {
  return createDataAssetConfigSchema({
    schemaId: `data-asset.${assetId}.config`,
    version: "1.0.0",
    fields: Object.freeze([
      {
        key: "extractExif",
        label: "Extract EXIF",
        kind: DataAssetConfigFieldKinds.boolean,
        visibility: DataAssetConfigFieldVisibilities.simple,
        defaultValue: true,
      },
      {
        key: "generatePreviewMetadata",
        label: "Preview metadata",
        kind: DataAssetConfigFieldKinds.boolean,
        visibility: DataAssetConfigFieldVisibilities.advanced,
        defaultValue: true,
      },
      {
        key: "normalizeOrientation",
        label: "Normalize orientation",
        kind: DataAssetConfigFieldKinds.boolean,
        visibility: DataAssetConfigFieldVisibilities.advanced,
        defaultValue: true,
      },
      {
        key: "includeFileStats",
        label: "Include file stats",
        kind: DataAssetConfigFieldKinds.boolean,
        visibility: DataAssetConfigFieldVisibilities.advanced,
        defaultValue: true,
      },
    ]),
  });
}

export function toImageIngestorConfig(config: Readonly<Record<string, CanonicalRecordValue>>): ImageIngestorConfig {
  return ImageIngestorConfigSchema.parse({
    extractExif: typeof config.extractExif === "boolean" ? config.extractExif : true,
    generatePreviewMetadata: typeof config.generatePreviewMetadata === "boolean" ? config.generatePreviewMetadata : true,
    normalizeOrientation: typeof config.normalizeOrientation === "boolean" ? config.normalizeOrientation : true,
    includeFileStats: typeof config.includeFileStats === "boolean" ? config.includeFileStats : true,
  });
}

export function createImageIngestorDataAsset(config: Readonly<Record<string, CanonicalRecordValue>>): CanonicalDataAsset {
  return new CanonicalDataAsset({
    id: ImageIngestorAsset.assetId,
    name: "Image Ingestor V1",
    version: ImageIngestorAsset.assetVersion,
    source: { type: "generated", workflowId: "dataset-studio-ingestors" },
    location: { accessMethod: "virtual", location: "dataset://image-ingestor-v1" },
    outputShape: createCanonicalImageMetadataRecordsShape({
      items: Object.freeze([]),
      metadata: {
        schemaVersion: "1.0.0",
        source: {
          format: "image-metadata",
        },
      },
    }),
    contracts: {
      version: "1.0.0",
      input: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Image source reference/resolved source and metadata extraction configuration.",
      },
      output: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Canonical image metadata records extracted from image sources.",
      },
    },
    config,
    versionMetadata: {
      schemaVersion: "1.0.0",
      contractVersion: "1.0.0",
      revision: 1,
      publishedVersionId: ImageIngestorAsset.assetVersion,
    },
    semanticMetadata: {
      description: "First-class image ingestion asset producing canonical image metadata records.",
      tags: ["dataset", "ingestion", "image", "metadata", "multimodal"],
    },
  });
}
