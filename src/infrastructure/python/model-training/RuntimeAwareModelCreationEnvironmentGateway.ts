import type { IModelCreationEnvironmentGateway } from "../../../application/ports/interfaces/IModelCreationEnvironmentGateway";
import type { IFileStorage } from "../../../application/ports/interfaces/IFileStorage";
import type { IPythonRuntimeClient } from "../../../application/ports/interfaces/IPythonRuntimeClient";
import {
  RuntimeDependencyIds,
  RuntimeDependencyOperationalStates,
  type IRuntimeDependencyOrchestrator,
} from "../../../application/runtime/RuntimeDependencyOrchestrator";
import type { AppRuntimeConfig } from "../../config/AppRuntimeConfig";
import type { ModelCreationEnvironment } from "../../../domain/model-training/ModelCreationSupport";
import { createRuntimeDependencyDetail } from "../../runtime/RuntimeDependencyDiagnostics";

export class RuntimeAwareModelCreationEnvironmentGateway implements IModelCreationEnvironmentGateway {
  constructor(
    private readonly config: AppRuntimeConfig,
    private readonly runtimeClient: IPythonRuntimeClient,
    private readonly runtimeEnabled: boolean,
    private readonly fileStorage?: IFileStorage,
    private readonly desktopBridgeDetail?: string,
    private readonly runtimeDependencyOrchestrator?: IRuntimeDependencyOrchestrator,
  ) {}

  public async getEnvironment(): Promise<ModelCreationEnvironment> {
    const desktopBridgeState = {
      desktopBridgeAvailable: Boolean(this.fileStorage),
      desktopBridgeDetail: this.desktopBridgeDetail,
      canAccessLocalArtifacts: Boolean(this.fileStorage),
      canRegisterPromotedModels: Boolean(this.fileStorage),
    } as const;

    if (!this.runtimeEnabled) {
      return Object.freeze({
        runtimeMode: this.config.runtimeMode,
        runtimeStatus: "disabled",
        runtimeDetail: "The Python runtime is disabled in Settings.",
        runtimeRemediationHints: Object.freeze(["Enable the Python runtime to prepare export bundles or train models."]),
        ...desktopBridgeState,
      });
    }

    if (this.runtimeDependencyOrchestrator) {
      const resolution = await this.runtimeDependencyOrchestrator.ensureAvailable(RuntimeDependencyIds.modelTrainingRuntime);
      if (!resolution.available) {
        return Object.freeze({
          runtimeMode: this.config.runtimeMode,
          runtimeStatus: mapDependencyResolutionToRuntimeStatus(resolution.state),
          runtimeDetail: createRuntimeDependencyDetail(resolution, "The model training runtime is unavailable."),
          runtimeDependencyStatus: resolution,
          runtimeRemediationHints: Object.freeze([...resolution.remediationHints]),
          ...desktopBridgeState,
        });
      }
    }

    try {
      const health = await this.runtimeClient.health();
      return Object.freeze({
        runtimeMode: this.config.runtimeMode,
        runtimeStatus: health.status === "ok" ? "ready" : "degraded",
        runtimeDetail: health.status === "ok"
          ? "The Python runtime is healthy."
          : "The Python runtime responded, but it is not currently healthy enough for reliable model creation.",
        ...desktopBridgeState,
      });
    } catch (error) {
      return Object.freeze({
        runtimeMode: this.config.runtimeMode,
        runtimeStatus: "unavailable",
        runtimeDetail: error instanceof Error
          ? error.message
          : "The Python runtime could not be reached.",
        runtimeRemediationHints: Object.freeze(["Start or repair the Python runtime before creating model jobs."]),
        ...desktopBridgeState,
      });
    }
  }
}

function mapDependencyResolutionToRuntimeStatus(
  state: typeof RuntimeDependencyOperationalStates[keyof typeof RuntimeDependencyOperationalStates],
): ModelCreationEnvironment["runtimeStatus"] {
  switch (state) {
    case RuntimeDependencyOperationalStates.disabled:
      return "disabled";
    case RuntimeDependencyOperationalStates.degraded:
    case RuntimeDependencyOperationalStates.starting:
    case RuntimeDependencyOperationalStates.provisioning:
    case RuntimeDependencyOperationalStates.unknown:
      return "degraded";
    case RuntimeDependencyOperationalStates.healthy:
      return "ready";
    case RuntimeDependencyOperationalStates.failed:
    case RuntimeDependencyOperationalStates.stopped:
    case RuntimeDependencyOperationalStates.unavailable:
    default:
      return "unavailable";
  }
}
