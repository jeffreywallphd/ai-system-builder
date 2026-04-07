import type {
  FileIngestionProfile,
  FileIngestionRequest,
  FileIngestionResult,
} from "../../domain/ingestion/interfaces/IFileIngestion";

export interface FileIngestionApplicationService {
  ingestFile(profile: FileIngestionProfile, request: FileIngestionRequest): Promise<FileIngestionResult>;
  ingestFiles(profile: FileIngestionProfile, requests: ReadonlyArray<FileIngestionRequest>): Promise<ReadonlyArray<FileIngestionResult>>;
}
