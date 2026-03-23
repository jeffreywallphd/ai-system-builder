import type { IModelCreationEnvironmentGateway } from "../../../application/ports/interfaces/IModelCreationEnvironmentGateway";
import type { IFileStorage } from "../../../application/ports/interfaces/IFileStorage";
import type { IPythonRuntimeClient } from "../../../application/ports/interfaces/IPythonRuntimeClient";
import type { AppRuntimeConfig } from "../../config/AppRuntimeConfig";
import type { ModelCreationEnvironment } from "../../../domain/model-training/ModelCreationSupport";

export class RuntimeAwareModelCreationEnvironmentGateway implements IModelCreationEnvironmentGateway {
  constructor(
    private readonly config: AppRuntimeConfig,
    private readonly runtimeClient: IPythonRuntimeClient,
    private readonly runtimeEnabled: boolean,
    private readonly fileStorage?: IFileStorage,
    private readonly desktopBridgeDetail?: string,
  ) {}

  public async getEnvironment(): Promise<ModelCreationEnvironment> {
    if (!this.runtimeEnabled) {
      return Object.freeze({
        runtimeMode: this.config.runtimeMode,
        runtimeStatus: "disabled",
        runtimeDetail: "The Python runtime is disabled in Settings.",
        desktopBridgeAvailable: Boolean(this.fileStorage),
        desktopBridgeDetail: this.desktopBridgeDetail,
        canAccessLocalArtifacts: Boolean(this.fileStorage),
        canRegisterPromotedModels: Boolean(this.fileStorage),
      });
    }

    try {
      const health = await this.runtimeClient.health();
      return Object.freeze({
        runtimeMode: this.config.runtimeMode,
        runtimeStatus: health.status === "ok" ? "ready" : "degraded",
        runtimeDetail: health.status === "ok"
          ? "The Python runtime is healthy."
          : "The Python runtime responded, but it is not currently healthy enough for reliable model creation.",
        desktopBridgeAvailable: Boolean(this.fileStorage),
        desktopBridgeDetail: this.desktopBridgeDetail,
        canAccessLocalArtifacts: Boolean(this.fileStorage),
        canRegisterPromotedModels: Boolean(this.fileStorage),
      });
    } catch (error) {
      return Object.freeze({
        runtimeMode: this.config.runtimeMode,
        runtimeStatus: "unavailable",
        runtimeDetail: error instanceof Error
          ? error.message
          : "The Python runtime could not be reached.",
        desktopBridgeAvailable: Boolean(this.fileStorage),
        desktopBridgeDetail: this.desktopBridgeDetail,
        canAccessLocalArtifacts: Boolean(this.fileStorage),
        canRegisterPromotedModels: Boolean(this.fileStorage),
      });
    }
  }
}
