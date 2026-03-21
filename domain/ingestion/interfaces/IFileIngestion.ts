export const FILE_INGESTION_OUTPUT_FORMATS = Object.freeze(["markdown"] as const);
export type FileIngestionOutputFormat = (typeof FILE_INGESTION_OUTPUT_FORMATS)[number];

export const FILE_INGESTION_CONVERSION_MODES = Object.freeze(["required", "optional", "forbidden"] as const);
export type FileIngestionConversionMode = (typeof FILE_INGESTION_CONVERSION_MODES)[number];

export const FILE_INGESTION_WARNING_CODES = Object.freeze([
  "filename_extension_mismatch",
  "missing_content_type",
  "conversion_performed",
  "pass_through_normalization",
] as const);
export type FileIngestionWarningCode = (typeof FILE_INGESTION_WARNING_CODES)[number];

export const FILE_INGESTION_ERROR_CODES = Object.freeze([
  "malformed_request",
  "unsupported_file_type",
  "disallowed_mime_type",
  "file_too_large",
  "conversion_required",
  "conversion_failed",
  "runtime_unavailable",
] as const);
export type FileIngestionErrorCode = (typeof FILE_INGESTION_ERROR_CODES)[number];

export interface FileIngestionWarning {
  readonly code: FileIngestionWarningCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface FileProvenance {
  readonly source: string;
  readonly feature?: string;
  readonly actor?: string;
  readonly capturedAt: Date;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface FileDescriptor {
  readonly name: string;
  readonly extension?: string;
  readonly mimeType?: string;
  readonly sizeInBytes: number;
  readonly lastModifiedAt?: Date;
  readonly checksum?: string;
}

export interface FileIngestionRequest {
  readonly file: FileDescriptor;
  readonly content: string | Uint8Array;
  readonly provenance: FileProvenance;
}

export interface FileIngestionPolicy {
  readonly acceptedExtensions: ReadonlyArray<string>;
  readonly acceptedMimeTypes: ReadonlyArray<string>;
  readonly maxFileSizeBytes: number;
  readonly allowMissingMimeType?: boolean;
  readonly mismatchWarningsEnabled?: boolean;
  readonly conversion: {
    readonly mode: FileIngestionConversionMode;
    readonly allowedOutputFormats: ReadonlyArray<FileIngestionOutputFormat>;
    readonly passThroughExtensions: ReadonlyArray<string>;
    readonly passThroughMimeTypes: ReadonlyArray<string>;
  };
}

export interface FileIngestionProfile {
  readonly id: string;
  readonly capability: string;
  readonly policy: FileIngestionPolicy;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ConversionMetadata {
  readonly strategy: "pass_through" | "converted";
  readonly converterId: string;
  readonly converterVersion?: string;
  readonly durationMs?: number;
  readonly declaredSourceFormat?: string;
  readonly detectedSourceFormat?: string;
}

export interface NormalizedDocumentContent {
  readonly markdown: string;
  readonly sourceFormat: string;
  readonly outputFormat: FileIngestionOutputFormat;
  readonly file: FileDescriptor;
  readonly conversion: ConversionMetadata;
  readonly warnings: ReadonlyArray<FileIngestionWarning>;
  readonly provenance: FileProvenance;
}

export interface FileIngestionResult {
  readonly profileId: string;
  readonly document: NormalizedDocumentContent;
  readonly warnings: ReadonlyArray<FileIngestionWarning>;
}

export class FileIngestionError extends Error {
  public readonly code: FileIngestionErrorCode;
  public readonly details?: Readonly<Record<string, unknown>>;

  constructor(code: FileIngestionErrorCode, message: string, details?: Readonly<Record<string, unknown>>) {
    super(message);
    this.name = "FileIngestionError";
    this.code = code;
    this.details = details;
  }
}

export class UnsupportedFileTypeError extends FileIngestionError {
  constructor(message: string, details?: Readonly<Record<string, unknown>>) {
    super("unsupported_file_type", message, details);
    this.name = "UnsupportedFileTypeError";
  }
}

export class DisallowedMimeTypeError extends FileIngestionError {
  constructor(message: string, details?: Readonly<Record<string, unknown>>) {
    super("disallowed_mime_type", message, details);
    this.name = "DisallowedMimeTypeError";
  }
}

export class FileTooLargeError extends FileIngestionError {
  constructor(message: string, details?: Readonly<Record<string, unknown>>) {
    super("file_too_large", message, details);
    this.name = "FileTooLargeError";
  }
}

export class ConversionRequiredError extends FileIngestionError {
  constructor(message: string, details?: Readonly<Record<string, unknown>>) {
    super("conversion_required", message, details);
    this.name = "ConversionRequiredError";
  }
}

export class ConversionFailedError extends FileIngestionError {
  constructor(message: string, details?: Readonly<Record<string, unknown>>) {
    super("conversion_failed", message, details);
    this.name = "ConversionFailedError";
  }
}

export class RuntimeUnavailableError extends FileIngestionError {
  constructor(message: string, details?: Readonly<Record<string, unknown>>) {
    super("runtime_unavailable", message, details);
    this.name = "RuntimeUnavailableError";
  }
}

export class MalformedFileIngestionRequestError extends FileIngestionError {
  constructor(message: string, details?: Readonly<Record<string, unknown>>) {
    super("malformed_request", message, details);
    this.name = "MalformedFileIngestionRequestError";
  }
}
