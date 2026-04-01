import { z } from "zod";
import { AssetContractShapeKinds } from "../../domain/contracts/AssetContract";
import { CanonicalDataAsset } from "../../domain/dataset-studio/CanonicalDataAsset";
import { createCanonicalImageMetadataRecordsShape, type CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";
import { createImageRecord, type IImageRecordValidator } from "../../domain/dataset-studio/contracts/ImageRecord";
import {
  ImageAssetReferenceKinds,
  type ImageAssetReferenceInput,
} from "../../domain/dataset-studio/contracts/ImageAssetReference";
import type {
  IImageDimensionReader,
  IImageExifReader as IImageExifExtractionReader,
  IImageFormatDetector,
  IImageMetadataExtractor,
} from "../../domain/dataset-studio/interfaces/ImageMetadataExtraction";
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
import { ZodImageRecordValidator } from "./adapters/validation/ImageRecordValidator";
import {
  ExifrImageExifReaderAdapter,
  ImageMetadataExtractorAdapter,
} from "./adapters/media/ImageMetadataExtractorAdapter";
import { ImageSizeDimensionReaderAdapter } from "./adapters/media/ImageDimensionReaderAdapter";
import { FileTypeImageFormatDetectorAdapter } from "./adapters/media/ImageFormatDetectorAdapter";

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
  readonly format?: string;
  readonly mimeType?: string;
  readonly orientation?: number;
  readonly exif?: Readonly<Record<string, CanonicalRecordValue>>;
}

export interface IImageMetadataProbe {
  probe(payload: Uint8Array): Promise<ImageMetadataResult>;
}

export interface IImageExifReader {
  read(payload: Uint8Array): Promise<Readonly<Record<string, unknown>> | undefined>;
}

class MetadataProbeFromExtractor implements IImageMetadataProbe {
  constructor(private readonly extractor: IImageMetadataExtractor) {}

  public async probe(payload: Uint8Array): Promise<ImageMetadataResult> {
    const extracted = await this.extractor.extract(payload);
    return Object.freeze({
      width: extracted.dimensions.width,
      height: extracted.dimensions.height,
      format: extracted.formatHint?.format,
      mimeType: extracted.formatHint?.mimeType,
      orientation: extracted.orientation,
      exif: extracted.additionalMetadata,
    });
  }
}

class ExifReaderFromExtractionReader implements IImageExifReader {
  constructor(private readonly reader: IImageExifExtractionReader) {}

  public async read(payload: Uint8Array): Promise<Readonly<Record<string, unknown>> | undefined> {
    const exif = await this.reader.readExif(payload);
    if (!exif) {
      return undefined;
    }

    return Object.freeze({
      Make: exif.make,
      Model: exif.model,
      LensModel: exif.lensModel,
      DateTimeOriginal: exif.dateTimeOriginal,
      Orientation: exif.orientation,
      GPSLatitude: exif.gpsLatitude,
      GPSLongitude: exif.gpsLongitude,
    });
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

function toImageAssetRefFromSource(input: {
  readonly source: ResolvedDataSource;
  readonly imageId: string;
  readonly format: string;
  readonly mimeType?: string;
}): ImageAssetReferenceInput {
  const source = input.source;
  if (source.kind === DataSourceReferenceKinds.localFile) {
    return Object.freeze({
      kind: ImageAssetReferenceKinds.localFile,
      path: source.reference,
      stableId: source.reference,
      sourceSystem: "dataset-ingestion",
      sourceContext: Object.freeze({
        sourceKind: source.kind,
      }),
      formatHint: input.format,
      mimeTypeHint: input.mimeType ?? source.contentType,
    });
  }
  if (source.kind === DataSourceReferenceKinds.url) {
    return Object.freeze({
      kind: ImageAssetReferenceKinds.externalUri,
      uri: source.reference,
      stableId: source.reference,
      sourceSystem: "dataset-ingestion",
      sourceContext: Object.freeze({
        sourceKind: source.kind,
      }),
      formatHint: input.format,
      mimeTypeHint: input.mimeType ?? source.contentType,
    });
  }

  return Object.freeze({
    kind: ImageAssetReferenceKinds.generatedOutput,
    outputId: input.imageId,
    path: source.fileName,
    stableId: `${source.reference}:${input.imageId}`,
    sourceSystem: "dataset-ingestion",
    sourceContext: Object.freeze({
      sourceKind: source.kind,
      sourceReference: source.reference,
    }),
    formatHint: input.format,
    mimeTypeHint: input.mimeType ?? source.contentType,
  });
}

export interface ImageIngestorAssetOptions {
  readonly sourceLocator?: IDataSourceLocator;
  readonly formatDetector?: IImageFormatDetector;
  readonly dimensionReader?: IImageDimensionReader;
  readonly metadataExtractor?: IImageMetadataExtractor;
  readonly metadataProbe?: IImageMetadataProbe;
  readonly exifReader?: IImageExifReader | IImageExifExtractionReader;
  readonly imageRecordValidator?: IImageRecordValidator;
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
  private readonly imageRecordValidator: IImageRecordValidator;

  constructor(options: ImageIngestorAssetOptions = {}) {
    this.sourceLocator = options.sourceLocator ?? new DefaultDataSourceLocator();
    const metadataExtractor = options.metadataExtractor ?? new ImageMetadataExtractorAdapter({
      formatDetector: options.formatDetector ?? new FileTypeImageFormatDetectorAdapter(),
      dimensionReader: options.dimensionReader ?? new ImageSizeDimensionReaderAdapter(),
      exifReader: options.exifReader && "readExif" in options.exifReader
        ? options.exifReader
        : new ExifrImageExifReaderAdapter(),
    });
    this.metadataProbe = options.metadataProbe ?? new MetadataProbeFromExtractor(metadataExtractor);
    this.exifReader = options.exifReader && "read" in options.exifReader
      ? options.exifReader
      : new ExifReaderFromExtractionReader(options.exifReader && "readExif" in options.exifReader
        ? options.exifReader
        : new ExifrImageExifReaderAdapter());
    this.imageRecordValidator = options.imageRecordValidator ?? new ZodImageRecordValidator();
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
    const normalizedFormat = normalizeOptional(metadata.format)?.toLowerCase()
      ?? inferExtension(request.source)?.replace(".", "")
      ?? "unknown";
    const mimeTypeHint = normalizeOptional(metadata.mimeType) ?? normalizeOptional(request.source.contentType)?.toLowerCase();

    const exifRaw = config.extractExif ? await this.exifReader.read(payload) : undefined;
    const exifHighlights = normalizeExifHighlights(exifRaw);
    const imageId = normalizeOptional(request.imageId)
      ?? normalizeOptional(request.source.fileName)
      ?? "image-1";

    const imageRecord = this.imageRecordValidator.validateImageRecord(createImageRecord({
      assetRef: toImageAssetRefFromSource({
        source: request.source,
        imageId,
        format: normalizedFormat,
        mimeType: mimeTypeHint,
      }),
      width: normalizedDimensions.width,
      height: normalizedDimensions.height,
      format: normalizedFormat,
      metadata: Object.freeze({
        sourceReference: request.source.reference,
        fileName: request.source.fileName ?? null,
        contentType: request.source.contentType ?? null,
      }),
      tags: Object.freeze([]),
      derived: Object.freeze({
        orientation: orientation ?? null,
      }),
      schemaVersion: "1.0.0",
    }));

    const metadataRecord: Record<string, CanonicalRecordValue> = {
      assetRef: imageRecord.assetRef as unknown as CanonicalRecordValue,
      width: imageRecord.width,
      height: imageRecord.height,
      format: imageRecord.format,
      mimeType: mimeTypeHint ?? null,
      orientation: orientation ?? null,
      sourceReference: request.source.reference,
      normalizeOrientationApplied: config.normalizeOrientation,
    };

    if (config.includeFileStats) {
      metadataRecord.fileSizeInBytes = payload.byteLength;
    }
    const hasExif = Boolean(metadata.exif || exifHighlights);
    if (config.extractExif) {
      if (metadata.exif) {
        metadataRecord.exif = metadata.exif;
      } else if (exifHighlights) {
        metadataRecord.exif = exifHighlights;
      }
    }

    const output = createCanonicalImageMetadataRecordsShape({
      items: Object.freeze([Object.freeze({
        itemId: `image-item-${imageId}`,
        imageId,
        label: imageRecord.format,
        attributes: Object.freeze(metadataRecord),
      })]),
      metadata: {
        schemaVersion: "1.0.0",
        source: {
          fileName: request.source.fileName,
          contentType: request.source.contentType,
          format: imageRecord.format,
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
      format: imageRecord.format,
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
              label: imageRecord.format,
              attributes: Object.freeze({
                assetRef: imageRecord.assetRef as unknown as CanonicalRecordValue,
                width: normalizedDimensions.width,
                height: normalizedDimensions.height,
                format: imageRecord.format,
              }),
            })]),
            metadata: {
              schemaVersion: "1.0.0",
              source: {
                fileName: request.source.fileName,
                contentType: request.source.contentType,
                format: imageRecord.format,
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
          format: imageRecord.format,
        })]),
        metadata: Object.freeze({
          fileSizeInBytes: config.includeFileStats ? payload.byteLength : undefined,
          orientation,
        }),
        issues: config.extractExif && !hasExif
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
        formatHint: imageRecord.format,
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
