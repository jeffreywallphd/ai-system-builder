import type {
  IModelDownloadHandle,
  IModelDownloadProgress,
  IModelDownloadRequest,
  IModelDownloadResult,
  IModelDownloader,
} from "../../../application/ports/interfaces/IModelDownloader";
import {
  ModelDownloadHandle,
  ModelDownloadProgress,
  ModelDownloadResult,
} from "../../../application/ports/ModelDownloader";
import { HuggingFaceApiClient } from "../../huggingface/HuggingFaceApiClient";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function defaultIdFactory(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `browser_hf_download_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function baseName(filePath: string): string {
  const segments = filePath.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? filePath;
}

async function computeSha256(bytes: Uint8Array): Promise<string | undefined> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    return undefined;
  }

  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function triggerBrowserDownload(bytes: Uint8Array, fileName: string): void {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    throw new Error("Browser downloads require document and URL support.");
  }

  const blob = new Blob([bytes]);
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = fileName;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
}

export interface IBrowserHuggingFaceModelDownloaderOptions {
  readonly apiClient: HuggingFaceApiClient;
  readonly createId?: () => string;
}

export class BrowserHuggingFaceModelDownloader implements IModelDownloader {
  private readonly apiClient: HuggingFaceApiClient;
  private readonly createId: () => string;

  constructor(options: IBrowserHuggingFaceModelDownloaderOptions) {
    this.apiClient = options.apiClient;
    this.createId = options.createId ?? defaultIdFactory;
  }

  public async startDownload(request: IModelDownloadRequest): Promise<IModelDownloadHandle> {
    if (!this.canDownload(request)) {
      throw new Error(`BrowserHuggingFaceModelDownloader cannot handle model '${request.model.id}'.`);
    }

    const operationId = this.createId();
    let cancelled = false;

    let resolveCompletion!: (value: IModelDownloadResult) => void;
    const completionPromise = new Promise<IModelDownloadResult>((resolve) => {
      resolveCompletion = resolve;
    });

    const handle = new ModelDownloadHandle({
      operationId,
      request,
      initialProgress: new ModelDownloadProgress({
        modelId: request.model.id,
        status: "queued",
        percent: 0,
        message: "Download queued.",
      }),
      completionPromise,
      cancel: async () => {
        cancelled = true;
      },
    });

    void (async () => {
      const result = await this.performDownload(request, {
        isCancelled: () => cancelled,
        onProgress: (progress) => handle.updateProgress(progress),
      });
      resolveCompletion(result);
    })();

    return handle;
  }

  public async download(
    request: IModelDownloadRequest,
    onProgress?: (progress: IModelDownloadProgress) => void
  ): Promise<IModelDownloadResult> {
    const handle = await this.startDownload(request);
    let active = true;

    const poll = (async () => {
      while (active) {
        const progress = await handle.getProgress();
        onProgress?.(progress);

        if (["completed", "failed", "cancelled"].includes(progress.status)) {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    })();

    try {
      const result = await handle.waitForCompletion();
      onProgress?.(
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
    const provider = request.source?.provider ?? request.model.source.type;
    return normalize(provider) === "huggingface";
  }

  private async performDownload(
    request: IModelDownloadRequest,
    options: {
      readonly isCancelled: () => boolean;
      readonly onProgress: (progress: ModelDownloadProgress) => void;
    }
  ): Promise<IModelDownloadResult> {
    try {
      options.onProgress(
        new ModelDownloadProgress({
          modelId: request.model.id,
          status: "resolving",
          percent: 0,
          message: "Resolving Hugging Face model file.",
        })
      );

      const repository =
        request.source?.repository?.trim() ||
        request.model.source.repository?.trim() ||
        request.model.source.sourceId?.trim();

      if (!repository) {
        throw new Error(`Hugging Face repository could not be resolved for '${request.model.id}'.`);
      }

      const filePath = request.model.artifact.location?.trim() || request.model.artifact.name.trim();
      const revision = request.source?.revision?.trim() || request.model.source.revision?.trim();
      const files = await this.apiClient.listModelFiles({ modelId: repository, revision });
      const resolvedFile = files.find((file) => file.path === filePath || baseName(file.path) === baseName(filePath));

      if (!resolvedFile) {
        return new ModelDownloadResult({
          modelId: request.model.id,
          destination: request.destination,
          status: "failed",
          message: `The selected file '${filePath}' is no longer available in '${repository}'.`,
        });
      }

      if (options.isCancelled()) {
        return new ModelDownloadResult({
          modelId: request.model.id,
          destination: request.destination,
          status: "cancelled",
          message: "Download was cancelled before transfer started.",
        });
      }

      options.onProgress(
        new ModelDownloadProgress({
          modelId: request.model.id,
          status: "downloading",
          bytesDownloaded: 0,
          totalBytes: resolvedFile.sizeBytes,
          percent: 0,
          message: `Downloading '${resolvedFile.path}'.`,
        })
      );

      const bytes = await this.apiClient.downloadToBuffer(resolvedFile.downloadUrl);

      if (options.isCancelled()) {
        return new ModelDownloadResult({
          modelId: request.model.id,
          destination: request.destination,
          status: "cancelled",
          message: "Download was cancelled.",
        });
      }

      const fileName = baseName(resolvedFile.path);
      triggerBrowserDownload(bytes, fileName);

      options.onProgress(
        new ModelDownloadProgress({
          modelId: request.model.id,
          status: request.verifyIntegrity ? "verifying" : "completed",
          bytesDownloaded: bytes.byteLength,
          totalBytes: bytes.byteLength,
          percent: 100,
          message: request.verifyIntegrity ? "Verifying downloaded artifact." : "Download completed.",
        })
      );

      const sha256 = await computeSha256(bytes);
      if (
        request.verifyIntegrity &&
        resolvedFile.sha256 &&
        sha256 &&
        normalize(sha256) !== normalize(resolvedFile.sha256)
      ) {
        return new ModelDownloadResult({
          modelId: request.model.id,
          destination: `${request.destination}/${fileName}`,
          status: "failed",
          sha256,
          sizeBytes: bytes.byteLength,
          message: `Checksum verification failed for '${request.model.id}'.`,
        });
      }

      return new ModelDownloadResult({
        modelId: request.model.id,
        destination: `${request.destination}/${fileName}`,
        status: "completed",
        sha256,
        sizeBytes: bytes.byteLength,
        message: `Downloaded '${fileName}' to your browser downloads.`,
      });
    } catch (error) {
      return new ModelDownloadResult({
        modelId: request.model.id,
        destination: request.destination,
        status: options.isCancelled() ? "cancelled" : "failed",
        message: options.isCancelled()
          ? "Download was cancelled."
          : error instanceof Error
          ? error.message
          : "Unknown browser download error.",
      });
    }
  }
}
