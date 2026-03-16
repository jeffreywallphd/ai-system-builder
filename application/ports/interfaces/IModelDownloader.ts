import type { IModel } from "../../../domain/models/interfaces/IModel";

export type ModelDownloadLifecycleStatus =
  | "queued"
  | "resolving"
  | "downloading"
  | "verifying"
  | "completed"
  | "failed"
  | "cancelled";

export interface IModelDownloadSource {
  /**
   * Optional direct URL when the source is already resolved.
   */
  readonly url?: string;

  /**
   * Optional provider identifier.
   * Examples:
   * - huggingface
   * - civitai
   * - direct-url
   * - ollama
   */
  readonly provider?: string;

  /**
   * Optional provider-specific source identifier.
   */
  readonly sourceId?: string;

  /**
   * Optional provider repository or namespace.
   */
  readonly repository?: string;

  /**
   * Optional provider revision/tag/commit.
   */
  readonly revision?: string;

  /**
   * Optional auth token or opaque credential reference.
   * The application layer treats this as data only.
   */
  readonly authToken?: string;

  /**
   * Optional additional provider parameters.
   */
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface IModelDownloadRequest {
  /**
   * Domain model being downloaded.
   * This keeps the downloader aligned with the domain model registry.
   */
  readonly model: IModel;

  /**
   * Where the downloader should fetch from.
   * If omitted, implementations may derive the source from model.source.
   */
  readonly source?: IModelDownloadSource;

  /**
   * Destination path or opaque storage key resolved by the application/infrastructure.
   */
  readonly destination: string;

  /**
   * Whether existing content may be overwritten.
   */
  readonly overwrite?: boolean;

  /**
   * Whether integrity verification should be attempted when hashes are available.
   */
  readonly verifyIntegrity?: boolean;

  /**
   * Optional timeout in milliseconds.
   */
  readonly timeoutMs?: number;
}

export interface IModelDownloadProgress {
  readonly modelId: string;
  readonly status: ModelDownloadLifecycleStatus;

  /**
   * Optional bytes downloaded so far.
   */
  readonly bytesDownloaded?: number;

  /**
   * Optional total size when known.
   */
  readonly totalBytes?: number;

  /**
   * Optional percent complete in [0,100].
   */
  readonly percent?: number;

  /**
   * Optional human-readable message.
   */
  readonly message?: string;
}

export interface IModelDownloadResult {
  readonly modelId: string;
  readonly destination: string;
  readonly status: Extract<
    ModelDownloadLifecycleStatus,
    "completed" | "failed" | "cancelled"
  >;

  /**
   * Optional checksum of the downloaded artifact.
   */
  readonly sha256?: string;

  /**
   * Optional size of the downloaded artifact.
   */
  readonly sizeBytes?: number;

  /**
   * Optional failure/cancellation reason.
   */
  readonly message?: string;
}

export interface IModelDownloadHandle {
  /**
   * Stable operation identifier.
   */
  readonly operationId: string;

  /**
   * The original request associated with this handle.
   */
  readonly request: IModelDownloadRequest;

  /**
   * Returns the latest known progress snapshot.
   */
  getProgress(): Promise<IModelDownloadProgress>;

  /**
   * Waits for the operation to reach a terminal state.
   */
  waitForCompletion(): Promise<IModelDownloadResult>;

  /**
   * Requests cancellation.
   * Implementations should be idempotent.
   */
  cancel(): Promise<void>;
}

export interface IModelDownloader {
  /**
   * Starts a model download operation and returns a handle for progress/cancellation.
   */
  startDownload(
    request: IModelDownloadRequest
  ): Promise<IModelDownloadHandle>;

  /**
   * Convenience API for one-shot download flows.
   */
  download(
    request: IModelDownloadRequest,
    onProgress?: (progress: IModelDownloadProgress) => void
  ): Promise<IModelDownloadResult>;

  /**
   * Returns true when the downloader can handle the requested source/provider.
   */
  canDownload(request: IModelDownloadRequest): boolean;
}
