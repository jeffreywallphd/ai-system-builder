import type { IModel } from "../../domain/models/interfaces/IModel";
import type {
  IModelDownloadProgress,
  IModelDownloadRequest,
  IModelDownloadResult,
  IModelDownloader,
} from "./interfaces/IModelDownloader";
import type {
  IModelInstallHandle,
  IModelInstallProgress,
  IModelInstallRequest,
  IModelInstallResult,
  IModelInstaller,
  IModelUninstallRequest,
} from "./interfaces/IModelInstaller";

function createOperationId(prefix: string = "install"): string {
  const random = Math.random().toString(36).slice(2, 10);
  const timestamp = Date.now().toString(36);
  return `${prefix}_${timestamp}_${random}`;
}

type ModelInstallerParams = {
  providers?: ReadonlyArray<IModelInstaller>;
  downloader?: IModelDownloader;
};

function isParams(value: unknown): value is ModelInstallerParams {
  return !!value && !Array.isArray(value) && typeof value === "object";
}

export class ModelInstallProgress implements IModelInstallProgress {
  public readonly modelId: string;
  public readonly status: IModelInstallProgress["status"];
  public readonly downloadProgress?: IModelDownloadProgress;
  public readonly message?: string;

  constructor(params: {
    modelId: string;
    status: IModelInstallProgress["status"];
    downloadProgress?: IModelDownloadProgress;
    message?: string;
  }) {
    const modelId = params.modelId.trim();

    if (!modelId) {
      throw new Error("ModelInstallProgress.modelId cannot be empty.");
    }

    this.modelId = modelId;
    this.status = params.status;
    this.downloadProgress = params.downloadProgress;
    this.message = params.message?.trim() || undefined;
  }

  public static from(progress: IModelInstallProgress): ModelInstallProgress {
    return new ModelInstallProgress({
      modelId: progress.modelId,
      status: progress.status,
      downloadProgress: progress.downloadProgress,
      message: progress.message,
    });
  }
}

export class ModelInstallResult implements IModelInstallResult {
  public readonly model: IModel;
  public readonly destination: string;
  public readonly status: IModelInstallResult["status"];
  public readonly installedLocation?: string;
  public readonly message?: string;

  constructor(params: {
    model: IModel;
    destination: string;
    status: IModelInstallResult["status"];
    installedLocation?: string;
    message?: string;
  }) {
    const destination = params.destination.trim();

    if (!destination) {
      throw new Error("ModelInstallResult.destination cannot be empty.");
    }

    this.model = params.model;
    this.destination = destination;
    this.status = params.status;
    this.installedLocation = params.installedLocation?.trim() || undefined;
    this.message = params.message?.trim() || undefined;
  }

  public static from(result: IModelInstallResult): ModelInstallResult {
    return new ModelInstallResult({
      model: result.model,
      destination: result.destination,
      status: result.status,
      installedLocation: result.installedLocation,
      message: result.message,
    });
  }
}

export class ModelInstallHandle implements IModelInstallHandle {
  public readonly operationId: string;
  public readonly request: IModelInstallRequest;

  private currentProgress: IModelInstallProgress;
  private readonly completionPromise: Promise<IModelInstallResult>;
  private readonly cancelFn: (() => Promise<void>) | (() => void);

  constructor(params: {
    operationId: string;
    request: IModelInstallRequest;
    initialProgress?: IModelInstallProgress;
    completionPromise: Promise<IModelInstallResult>;
    cancel?: (() => Promise<void>) | (() => void);
  }) {
    const operationId = params.operationId.trim();

    if (!operationId) {
      throw new Error("ModelInstallHandle.operationId cannot be empty.");
    }

    this.operationId = operationId;
    this.request = params.request;
    this.currentProgress =
      params.initialProgress ??
      new ModelInstallProgress({
        modelId: params.request.model.id,
        status: "queued",
      });

    this.completionPromise = params.completionPromise.then((result) => {
      this.currentProgress = new ModelInstallProgress({
        modelId: result.model.id,
        status: result.status,
        message: result.message,
      });

      return result;
    });

    this.cancelFn = params.cancel ?? (() => undefined);
  }

  public async getProgress(): Promise<IModelInstallProgress> {
    return this.currentProgress;
  }

  public async waitForCompletion(): Promise<IModelInstallResult> {
    return this.completionPromise;
  }

  public async cancel(): Promise<void> {
    await this.cancelFn();
  }

  public updateProgress(progress: IModelInstallProgress): void {
    if (progress.modelId !== this.request.model.id) {
      throw new Error(
        `Install progress model '${progress.modelId}' does not match request model '${this.request.model.id}'.`
      );
    }

    this.currentProgress = ModelInstallProgress.from(progress);
  }
}

export class ModelInstaller implements IModelInstaller {
  private readonly installers: ReadonlyArray<IModelInstaller>;
  private readonly downloader?: IModelDownloader;

  constructor(params: ReadonlyArray<IModelInstaller> | ModelInstallerParams = []) {
    if (isParams(params)) {
      this.installers = Object.freeze([...(params.providers ?? [])]);
      this.downloader = params.downloader;
      return;
    }

    this.installers = Object.freeze([...(params ?? [])]);
  }

  public async startInstall(
    request: IModelInstallRequest
  ): Promise<IModelInstallHandle> {
    const delegatedInstaller = this.findDelegatedInstaller(request);

    if (delegatedInstaller) {
      return delegatedInstaller.startInstall(request);
    }

    const operationId = createOperationId();
    const modelId = request.model.id;
    const downloadHandleRef: { current?: { cancel(): Promise<void> } } = {};

    let resolveCompletion: (result: IModelInstallResult) => void;
    let rejectCompletion: (reason?: unknown) => void;

    const completionPromise = new Promise<IModelInstallResult>((resolve, reject) => {
      resolveCompletion = resolve;
      rejectCompletion = reject;
    });

    const handle = new ModelInstallHandle({
      operationId,
      request,
      initialProgress: new ModelInstallProgress({
        modelId,
        status: "queued",
      }),
      completionPromise,
      cancel: async () => {
        await downloadHandleRef.current?.cancel();
      },
    });

    void this.performInstall(
      request,
      (progress) => {
        handle.updateProgress(progress);
      },
      downloadHandleRef
    ).then(resolveCompletion!, rejectCompletion!);

    return handle;
  }

  public async install(
    request: IModelInstallRequest,
    onProgress?: (progress: IModelInstallProgress) => void
  ): Promise<IModelInstallResult> {
    const delegatedInstaller = this.findDelegatedInstaller(request);

    if (delegatedInstaller) {
      return delegatedInstaller.install(request, onProgress);
    }

    return this.performInstall(request, onProgress);
  }

  public canInstall(request: IModelInstallRequest): boolean {
    if (this.findDelegatedInstaller(request)) {
      return true;
    }

    const sourceType = request.provider ?? request.model.source.type;

    if (sourceType === "local" || sourceType === "bundled" || sourceType === "manual") {
      return true;
    }

    return !!this.downloader;
  }

  public async isInstalled(model: IModel, destination?: string): Promise<boolean> {
    const resolvedDestination = destination?.trim();

    if (!resolvedDestination) {
      return false;
    }

    const delegatedInstaller = this.installers.find((installer) => {
      const candidate = {
        model,
        destination: resolvedDestination,
      } satisfies IModelInstallRequest;

      if (installer.canInstall(candidate)) {
        return true;
      }

      return typeof installer.canUninstall === "function"
        ? installer.canUninstall(model)
        : false;
    });

    if (delegatedInstaller) {
      return delegatedInstaller.isInstalled(model, resolvedDestination);
    }

    const modelLocation = model.artifact.location?.trim();
    return !!modelLocation && modelLocation === resolvedDestination;
  }

  public async uninstall(request: IModelUninstallRequest): Promise<void> {
    const installer = this.resolveUninstaller(request.model);
    await installer.uninstall(request);
  }

  public canUninstall(model: IModel): boolean {
    return this.installers.some((installer) =>
      typeof installer.canUninstall === "function"
        ? installer.canUninstall(model)
        : false
    );
  }

  private findDelegatedInstaller(
    request: IModelInstallRequest
  ): IModelInstaller | undefined {
    return this.installers.find((installer) => installer.canInstall(request));
  }

  private resolveUninstaller(model: IModel): IModelInstaller {
    const installer = this.installers.find((candidate) =>
      typeof candidate.canUninstall === "function"
        ? candidate.canUninstall(model)
        : false
    );

    if (!installer) {
      throw new Error(
        `No model installer is available to uninstall model '${model.id}'.`
      );
    }

    return installer;
  }

  private async performInstall(
    request: IModelInstallRequest,
    onProgress?: (progress: IModelInstallProgress) => void,
    downloadHandleRef?: { current?: { cancel(): Promise<void> } }
  ): Promise<IModelInstallResult> {
    const emit = (progress: IModelInstallProgress): void => {
      onProgress?.(progress);
    };

    emit(
      new ModelInstallProgress({
        modelId: request.model.id,
        status: "preparing",
        message: "Preparing model installation.",
      })
    );

    const alreadyInstalled = await this.isInstalled(request.model, request.destination);
    if (alreadyInstalled && !request.overwrite) {
      return new ModelInstallResult({
        model: request.model,
        destination: request.destination,
        installedLocation: request.destination,
        status: "completed",
        message: "Model is already installed.",
      });
    }

    const sourceType = request.provider ?? request.model.source.type;

    if (sourceType === "local" || sourceType === "bundled" || sourceType === "manual") {
      emit(
        new ModelInstallProgress({
          modelId: request.model.id,
          status: "installing",
          message: "Registering local/bundled model installation.",
        })
      );

      emit(
        new ModelInstallProgress({
          modelId: request.model.id,
          status: "verifying",
          message: "Verifying installation metadata.",
        })
      );

      return new ModelInstallResult({
        model: request.model,
        destination: request.destination,
        installedLocation: request.destination,
        status: "completed",
        message: "Model installation completed.",
      });
    }

    if (!this.downloader) {
      return new ModelInstallResult({
        model: request.model,
        destination: request.destination,
        status: "failed",
        message: `No model downloader is configured for source '${sourceType}'.`,
      });
    }

    const downloadRequest: IModelDownloadRequest = {
      model: request.model,
      destination: request.destination,
      overwrite: request.overwrite,
      verifyIntegrity: request.verifyIntegrity,
      source: {
        provider: request.provider ?? request.model.source.type,
        sourceId: request.model.source.sourceId,
        repository: request.model.source.repository,
        revision: request.model.source.revision,
        url: request.model.source.url,
        authToken: request.authToken,
        metadata: request.model.source.providerMetadata,
      },
    };

    const downloadHandle = await this.downloader.startDownload(downloadRequest);
    if (downloadHandleRef) {
      downloadHandleRef.current = downloadHandle;
    }

    let lastDownloadProgress: IModelDownloadProgress | undefined;
    let active = true;

    const poll = (async () => {
      while (active) {
        const progress = await downloadHandle.getProgress();
        lastDownloadProgress = progress;

        emit(
          new ModelInstallProgress({
            modelId: request.model.id,
            status:
              progress.status === "queued" || progress.status === "resolving"
                ? "preparing"
                : progress.status === "downloading"
                ? "downloading"
                : progress.status === "verifying"
                ? "verifying"
                : progress.status === "failed"
                ? "failed"
                : progress.status === "cancelled"
                ? "cancelled"
                : "installing",
            downloadProgress: progress,
            message: progress.message,
          })
        );

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
      const downloadResult: IModelDownloadResult = await downloadHandle.waitForCompletion();

      active = false;
      await poll.catch(() => undefined);

      if (downloadResult.status === "failed") {
        return new ModelInstallResult({
          model: request.model,
          destination: request.destination,
          status: "failed",
          message: downloadResult.message ?? "Model download failed.",
        });
      }

      if (downloadResult.status === "cancelled") {
        return new ModelInstallResult({
          model: request.model,
          destination: request.destination,
          status: "cancelled",
          message: downloadResult.message ?? "Model installation was cancelled.",
        });
      }

      emit(
        new ModelInstallProgress({
          modelId: request.model.id,
          status: "installing",
          downloadProgress: lastDownloadProgress,
          message: "Finalizing installation.",
        })
      );

      emit(
        new ModelInstallProgress({
          modelId: request.model.id,
          status: "verifying",
          downloadProgress: lastDownloadProgress,
          message: "Verifying installed model.",
        })
      );

      return new ModelInstallResult({
        model: request.model,
        destination: request.destination,
        installedLocation: downloadResult.destination,
        status: "completed",
        message: "Model installation completed.",
      });
    } catch (error) {
      active = false;
      await poll.catch(() => undefined);

      return new ModelInstallResult({
        model: request.model,
        destination: request.destination,
        status: "failed",
        message:
          error instanceof Error ? error.message : "Model installation failed.",
      });
    }
  }
}
