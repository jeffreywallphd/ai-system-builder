import { createHash } from "node:crypto";
import path from "node:path";
import type {
  IModelDownloadHandle,
  IModelDownloadProgress,
  IModelDownloadRequest,
  IModelDownloadResult,
  IModelDownloader,
} from "@application/ports/interfaces/IModelDownloader";
import {
  ModelDownloadHandle,
  ModelDownloadProgress,
  ModelDownloadResult,
} from "@application/ports/ModelDownloader";
import type { IFileStorage } from "@application/ports/interfaces/IFileStorage";
import { HuggingFaceApiClient } from "./HuggingFaceApiClient";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function defaultIdFactory(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `hf_download_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export interface IHuggingFaceModelDownloaderOptions {
  readonly apiClient: HuggingFaceApiClient;
  readonly fileStorage: IFileStorage;
  readonly createId?: () => string;
}

export class HuggingFaceModelDownloader implements IModelDownloader {
  private readonly apiClient: HuggingFaceApiClient;
  private readonly fileStorage: IFileStorage;
  private readonly createId: () => string;

  constructor(options: IHuggingFaceModelDownloaderOptions) {
    this.apiClient = options.apiClient;
    this.fileStorage = options.fileStorage;
    this.createId = options.createId ?? defaultIdFactory;
  }

  public async startDownload(
    request: IModelDownloadRequest
  ): Promise<IModelDownloadHandle> {
    if (!this.canDownload(request)) {
      throw new Error(
        `HuggingFaceModelDownloader cannot handle model '${request.model.id}'.`
      );
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

        if (
          progress.status === "completed" ||
          progress.status === "failed" ||
          progress.status === "cancelled"
        ) {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
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

      const resolvedFile = await this.resolveFile(request);

      if (!resolvedFile) {
        return new ModelDownloadResult({
          modelId: request.model.id,
          destination: request.destination,
          status: "failed",
          message: `No downloadable file could be resolved for Hugging Face model '${request.model.id}'.`,
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

      const fileName = path.basename(resolvedFile.path);
      const destination = this.resolveDestination(request.destination, fileName);

      await this.fileStorage.write({
        path: destination,
        content: bytes,
        createDirectories: true,
        overwrite: request.overwrite ?? false,
      });

      const sha256 = this.computeSha256(bytes);

      options.onProgress(
        new ModelDownloadProgress({
          modelId: request.model.id,
          status: request.verifyIntegrity ? "verifying" : "completed",
          bytesDownloaded: bytes.byteLength,
          totalBytes: bytes.byteLength,
          percent: 100,
          message: request.verifyIntegrity
            ? "Verifying downloaded artifact."
            : "Download completed.",
        })
      );

      if (
        request.verifyIntegrity &&
        resolvedFile.sha256 &&
        normalize(resolvedFile.sha256) !== normalize(sha256)
      ) {
        return new ModelDownloadResult({
          modelId: request.model.id,
          destination,
          status: "failed",
          sha256,
          sizeBytes: bytes.byteLength,
          message:
            `Checksum verification failed for '${request.model.id}'. ` +
            `Expected ${resolvedFile.sha256}, received ${sha256}.`,
        });
      }

      return new ModelDownloadResult({
        modelId: request.model.id,
        destination,
        status: "completed",
        sha256,
        sizeBytes: bytes.byteLength,
        message: "Download completed successfully.",
      });
    } catch (error: unknown) {
      return new ModelDownloadResult({
        modelId: request.model.id,
        destination: request.destination,
        status: options.isCancelled() ? "cancelled" : "failed",
        message: options.isCancelled()
          ? "Download was cancelled."
          : error instanceof Error
          ? error.message
          : "Unknown Hugging Face download error.",
      });
    }
  }

  private async resolveFile(
    request: IModelDownloadRequest
  ): Promise<
    | {
        readonly path: string;
        readonly sizeBytes?: number;
        readonly sha256?: string;
        readonly downloadUrl: string;
      }
    | undefined
  > {
    const source = request.source;
    const repository =
      source?.repository?.trim() ||
      request.model.source.repository?.trim() ||
      request.model.source.sourceId?.trim() ||
      request.model.id;

    const preferredExtensions = this.determinePreferredExtensions(request.model.kind);

    return this.apiClient.resolveDownloadFile({
      modelId: repository,
      revision: source?.revision ?? request.model.source.revision,
      preferredExtensions,
      preferredFileNames: request.model.artifact.location
        ? [request.model.artifact.location]
        : undefined,
    });
  }

  private determinePreferredExtensions(
    kind: IModelDownloadRequest["model"]["kind"]
  ): ReadonlyArray<string> {
    if (kind === "lora" || kind === "adapter" || kind === "control-module") {
      return Object.freeze([".safetensors", ".bin"]);
    }

    if (
      kind === "completion-model" ||
      kind === "foundation-model" ||
      kind === "embedding-model"
    ) {
      return Object.freeze([".gguf", ".safetensors", ".bin"]);
    }

    if (
      kind === "image-generation-model" ||
      kind === "video-generation-model" ||
      kind === "vision-model"
    ) {
      return Object.freeze([".safetensors", ".onnx", ".bin", ".ckpt"]);
    }

    return Object.freeze([".safetensors", ".gguf", ".onnx", ".bin", ".pt", ".pth", ".ckpt"]);
  }

  private resolveDestination(baseDestination: string, fileName: string): string {
    const normalizedDestination = baseDestination.trim();

    if (!normalizedDestination) {
      throw new Error("Model download destination cannot be empty.");
    }

    if (normalizedDestination.endsWith(path.sep) || !path.extname(normalizedDestination)) {
      return path.join(normalizedDestination, fileName);
    }

    return normalizedDestination;
  }

  private computeSha256(bytes: Uint8Array): string {
    return createHash("sha256").update(bytes).digest("hex");
  }
}

