import type { IModel } from "../../../domain/models/interfaces/IModel";
import type { IModelDownloadProgress } from "./IModelDownloader";

export type ModelInstallStatus =
  | "queued"
  | "preparing"
  | "downloading"
  | "installing"
  | "verifying"
  | "completed"
  | "failed"
  | "cancelled";

export interface IModelInstallRequest {
  /**
   * The model to install.
   */
  readonly model: IModel;

  /**
   * Target install location resolved by the application/infrastructure.
   * This can be a path or storage key depending on the implementation.
   */
  readonly destination: string;

  /**
   * Whether an existing installation may be replaced.
   */
  readonly overwrite?: boolean;

  /**
   * Whether installation should verify integrity when possible.
   */
  readonly verifyIntegrity?: boolean;

  /**
   * Optional auth token or opaque credential reference.
   */
  readonly authToken?: string;

  /**
   * Optional provider override if installation should use a specific source.
   */
  readonly provider?: string;
}

export interface IModelInstallProgress {
  readonly modelId: string;
  readonly status: ModelInstallStatus;

  /**
   * Optional nested download progress for installers that download remotely.
   */
  readonly downloadProgress?: IModelDownloadProgress;

  /**
   * Optional human-readable message.
   */
  readonly message?: string;
}

export interface IModelInstallResult {
  readonly model: IModel;
  readonly destination: string;
  readonly status: Extract<ModelInstallStatus, "completed" | "failed" | "cancelled">;

  /**
   * Optional resolved installed artifact location/path.
   */
  readonly installedLocation?: string;

  /**
   * Optional failure/cancellation reason.
   */
  readonly message?: string;
}

export interface IModelInstallHandle {
  readonly operationId: string;
  readonly request: IModelInstallRequest;

  getProgress(): Promise<IModelInstallProgress>;
  waitForCompletion(): Promise<IModelInstallResult>;
  cancel(): Promise<void>;
}

export interface IModelUninstallRequest {
  readonly model: IModel;
  readonly destination?: string;
  readonly removeArtifacts?: boolean;
}

export interface IModelInstaller {
  /**
   * Starts an installation operation and returns a handle.
   */
  startInstall(request: IModelInstallRequest): Promise<IModelInstallHandle>;

  /**
   * Convenience API for one-shot install flows.
   */
  install(
    request: IModelInstallRequest,
    onProgress?: (progress: IModelInstallProgress) => void
  ): Promise<IModelInstallResult>;

  /**
   * Returns true when the installer can install this model in the requested way.
   */
  canInstall(request: IModelInstallRequest): boolean;

  /**
   * Returns true when the model already appears installed at the target destination.
   */
  isInstalled(model: IModel, destination?: string): Promise<boolean>;

  /**
   * Removes a previously installed model.
   * Implementations may ignore destination when the model identity is sufficient.
   */
  uninstall(request: IModelUninstallRequest): Promise<void>;

  /**
   * Returns true when this installer can uninstall the model.
   */
  canUninstall(model: IModel): boolean;
}
