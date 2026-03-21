import type {
  ConversionMetadata,
  FileDescriptor,
  FileIngestionWarning,
  FileIngestionOutputFormat,
} from "../../domain/ingestion/interfaces/IFileIngestion";

export interface DocumentConversionRequest {
  readonly file: FileDescriptor;
  readonly content: Uint8Array;
  readonly outputFormat: FileIngestionOutputFormat;
}

export interface DocumentConversionResult {
  readonly markdown: string;
  readonly sourceFormat: string;
  readonly outputFormat: FileIngestionOutputFormat;
  readonly file: FileDescriptor;
  readonly conversion: ConversionMetadata;
  readonly warnings: ReadonlyArray<FileIngestionWarning>;
}

export interface DocumentConversionGateway {
  convert(request: DocumentConversionRequest): Promise<DocumentConversionResult>;
}
