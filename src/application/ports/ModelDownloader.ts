import type {
  IModelDownloadHandle,
  IModelDownloadProgress,
  IModelDownloadRequest,
  IModelDownloadResult,
  IModelDownloader,
} from "./interfaces/IModelDownloader";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export class ModelDownloadProgress implements IModelDownloadProgress {
  public readonly modelId: string;
  public readonly status: IModelDownloadProgress["status"];
  public readonly bytesDownloaded?: number;
  public readonly totalBytes?: number;
  public readonly percent?: number;
  public readonly message?: string;

  constructor(params: {
    modelId: string;
    status: IModelDownloadProgress["status"];
    bytesDownloaded?: number;
    totalBytes?: number;
    percent?: number;
    message?: string;
  }) {
    const modelId = params.modelId.trim();

    if (!modelId) {
      throw new Error("ModelDownloadProgress.modelId cannot be empty.");
    }

    const percent =
      params.percent !== undefined
        ? Math.max(0, Math.min(100, params.percent))
        : params.totalBytes && params.totalBytes > 0 && params.bytesDownloaded !== undefined
        ? Math.max(
            0,
            Math.min(100, (params.bytesDownloaded / params.totalBytes) * 100)
          )
        : undefined;

    this.modelId = modelId;
    this.status = params.status;
    this.bytesDownloaded = params.bytesDownloaded;
    this.totalBytes = params.totalBytes;
    this.percent = percent;
    this.message = params.message?.trim() || undefined;
  }

  public static from(progress: IModelDownloadProgress): ModelDownloadProgress {
    return new ModelDownloadProgress({
      modelId: progress.modelId,
      status: progress.status,
      bytesDownloaded: progress.bytesDownloaded,
      totalBytes: progress.totalBytes,
      percent: progress.percent,
      message: progress.message,
    });
  }
}

export class ModelDownloadResult implements IModelDownloadResult {
  public readonly modelId: string;
  public readonly destination: string;
  public readonly status: IModelDownloadResult["status"];
  public readonly sha256?: string;
  public readonly sizeBytes?: number;
  public readonly message?: string;

  constructor(params: {
    modelId: string;
    destination: string;
    status: IModelDownloadResult["status"];
    sha256?: string;
    sizeBytes?: number;
    message?: string;
  }) {
    const modelId = params.modelId.trim();
    const destination = params.destination.trim();

    if (!modelId) {
      throw new Error("ModelDownloadResult.modelId cannot be empty.");
    }

    if (!destination) {
      throw new Error("ModelDownloadResult.destination cannot be empty.");
    }

    this.modelId = modelId;
    this.destination = destination;
    this.status = params.status;
    this.sha256 = params.sha256?.trim().toLowerCase() || undefined;
    this.sizeBytes = params.sizeBytes;
    this.message = params.message?.trim() || undefined;
  }

  public static from(result: IModelDownloadResult): ModelDownloadResult {
    return new ModelDownloadResult({
      modelId: result.modelId,
      destination: result.destination,
      status: result.status,
      sha256: result.sha256,
      sizeBytes: result.sizeBytes,
      message: result.message,
    });
  }
}

export class ModelDownloadHandle implements IModelDownloadHandle {
  public readonly operationId: string;
  public readonly request: IModelDownloadRequest;

  private currentProgress: IModelDownloadProgress;
  private readonly completionPromise: Promise<IModelDownloadResult>;
  private readonly cancelFn: (() => Promise<void>) | (() => void);

  constructor(params: {
    operationId: string;
    request: IModelDownloadRequest;
    initialProgress?: IModelDownloadProgress;
    completionPromise: Promise<IModelDownloadResult>;
    cancel?: (() => Promise<void>) | (() => void);
  }) {
    const operationId = params.operationId.trim();

    if (!operationId) {
      throw new Error("ModelDownloadHandle.operationId cannot be empty.");
    }

    this.operationId = operationId;
    this.request = params.request;
    this.currentProgress =
      params.initialProgress ??
      new ModelDownloadProgress({
        modelId: params.request.model.id,
        status: "queued",
      });

    this.completionPromise = params.completionPromise.then((result) => {
      this.currentProgress = new ModelDownloadProgress({
        modelId: result.modelId,
        status: result.status,
        bytesDownloaded: result.sizeBytes,
        totalBytes: result.sizeBytes,
        percent:
          result.status === "completed"
            ? 100
            : result.status === "cancelled"
            ? this.currentProgress.percent
            : this.currentProgress.percent,
        message: result.message,
      });

      return result;
    });

    this.cancelFn = params.cancel ?? (() => undefined);
  }

  public async getProgress(): Promise<IModelDownloadProgress> {
    return this.currentProgress;
  }

  public async waitForCompletion(): Promise<IModelDownloadResult> {
    return this.completionPromise;
  }

  public async cancel(): Promise<void> {
    await this.cancelFn();
  }

  public updateProgress(progress: IModelDownloadProgress): void {
    if (progress.modelId !== this.request.model.id) {
      throw new Error(
        `Progress model '${progress.modelId}' does not match request model '${this.request.model.id}'.`
      );
    }

    this.currentProgress = ModelDownloadProgress.from(progress);
  }
}

export class ModelDownloader implements IModelDownloader {
  private readonly providers: ReadonlyArray<IModelDownloader>;

  constructor(providers: ReadonlyArray<IModelDownloader> = []) {
    this.providers = Object.freeze([...providers]);
  }

  public async startDownload(
    request: IModelDownloadRequest
  ): Promise<IModelDownloadHandle> {
    const provider = this.resolveProvider(request);
    return provider.startDownload(request);
  }

  public async download(
    request: IModelDownloadRequest,
    onProgress?: (progress: IModelDownloadProgress) => void
  ): Promise<IModelDownloadResult> {
    const provider = this.resolveProvider(request);

    if (!onProgress) {
      return provider.download(request);
    }

    const handle = await provider.startDownload(request);
    let active = true;

    const poll = (async () => {
      while (active) {
        const progress = await handle.getProgress();
        onProgress(progress);

        if (
          progress.status === "completed" ||
          progress.status === "failed" ||
          progress.status === "cancelled"
        ) {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    })();

    try {
      const result = await handle.waitForCompletion();

      onProgress(
        new ModelDownloadProgress({
          modelId: result.modelId,
          status: result.status,
          bytesDownloaded: result.sizeBytes,
          totalBytes: result.sizeBytes,
          percent: result.status === "completed" ? 100 : undefined,
          message: result.message,
        })
      );

      return result;
    } finally {
      active = false;
      await poll.catch(() => undefined);
    }
  }

  public canDownload(request: IModelDownloadRequest): boolean {
    return this.providers.some((provider) => provider.canDownload(request));
  }

  private resolveProvider(request: IModelDownloadRequest): IModelDownloader {
    const provider = this.providers.find((candidate) =>
      candidate.canDownload(request)
    );

    if (!provider) {
      const providerLabel = request.source?.provider ?? request.model.source.type;
      throw new Error(
        `No model downloader is available for provider/source '${providerLabel}'.`
      );
    }

    return provider;
  }
}
