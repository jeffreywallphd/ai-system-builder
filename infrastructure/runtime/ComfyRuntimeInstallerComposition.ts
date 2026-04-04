import {
  ComfyRuntimeInstallerOrchestrationService,
  type ComfyRuntimeInstallerOrchestrationServiceOptions,
} from "../../application/runtime/ComfyRuntimeInstallerOrchestrationService";
import type { IRuntimeRepositoryInstallerContract } from "../../application/runtime/RuntimeRepositoryInstallerContract";
import { ComfyRuntimePythonHooks, type ComfyRuntimePythonHooksOptions } from "./ComfyRuntimePythonHooks";

export interface ComfyRuntimeInstallerCompositionOptions {
  readonly orchestration?: Omit<ComfyRuntimeInstallerOrchestrationServiceOptions, "environmentPreparationHook" | "dependencyInstallationHook">;
  readonly pythonHooks?: ComfyRuntimePythonHooksOptions;
}

export function createComfyRuntimeInstallerOrchestrationService(
  repositoryInstaller: IRuntimeRepositoryInstallerContract,
  options: ComfyRuntimeInstallerCompositionOptions = {},
): ComfyRuntimeInstallerOrchestrationService {
  const pythonHooks = new ComfyRuntimePythonHooks({
    ...options.pythonHooks,
    now: options.orchestration?.now ?? options.pythonHooks?.now,
  });

  return new ComfyRuntimeInstallerOrchestrationService(repositoryInstaller, {
    ...options.orchestration,
    environmentPreparationHook: pythonHooks,
    dependencyInstallationHook: pythonHooks,
  });
}
