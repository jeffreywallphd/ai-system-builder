import {
  ComfyRuntimeInstallerOrchestrationService,
  type ComfyRuntimeInstallerOrchestrationServiceOptions,
} from "../../application/runtime/ComfyRuntimeInstallerOrchestrationService";
import type { IRuntimeRepositoryInstallerContract } from "../../application/runtime/RuntimeRepositoryInstallerContract";
import { ComfyRuntimeAssetValidationHook, type ComfyRuntimeAssetValidationHookOptions } from "./ComfyRuntimeAssetValidationHook";
import {
  ComfyRuntimeCustomNodeInstallationHooks,
  type ComfyRuntimeCustomNodeInstallationHooksOptions,
} from "./ComfyRuntimeCustomNodeInstallationHooks";
import { ComfyRuntimePythonHooks, type ComfyRuntimePythonHooksOptions } from "./ComfyRuntimePythonHooks";

export interface ComfyRuntimeInstallerCompositionOptions {
  readonly orchestration?: Omit<
    ComfyRuntimeInstallerOrchestrationServiceOptions,
    "environmentPreparationHook" | "dependencyInstallationHook" | "customNodeInstallationHook" | "modelValidationHook"
  >;
  readonly pythonHooks?: ComfyRuntimePythonHooksOptions;
  readonly customNodeHooks?: ComfyRuntimeCustomNodeInstallationHooksOptions;
  readonly assetValidationHook?: ComfyRuntimeAssetValidationHookOptions;
}

export function createComfyRuntimeInstallerOrchestrationService(
  repositoryInstaller: IRuntimeRepositoryInstallerContract,
  options: ComfyRuntimeInstallerCompositionOptions = {},
): ComfyRuntimeInstallerOrchestrationService {
  const pythonHooks = new ComfyRuntimePythonHooks({
    ...options.pythonHooks,
    now: options.orchestration?.now ?? options.pythonHooks?.now,
  });
  const customNodeHooks = new ComfyRuntimeCustomNodeInstallationHooks(repositoryInstaller, {
    ...options.customNodeHooks,
    now: options.orchestration?.now ?? options.customNodeHooks?.now,
  });
  const assetValidationHook = new ComfyRuntimeAssetValidationHook({
    ...options.assetValidationHook,
    now: options.orchestration?.now ?? options.assetValidationHook?.now,
  });

  return new ComfyRuntimeInstallerOrchestrationService(repositoryInstaller, {
    ...options.orchestration,
    environmentPreparationHook: pythonHooks,
    dependencyInstallationHook: pythonHooks,
    customNodeInstallationHook: customNodeHooks,
    modelValidationHook: assetValidationHook,
  });
}
