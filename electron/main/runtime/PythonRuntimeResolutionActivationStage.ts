import process from "node:process";
import { resolveDesktopStoragePaths } from "../../../src/infrastructure/desktop/DesktopAppPaths";
import { resolveDesktopPythonRuntime } from "../../../src/infrastructure/desktop/DesktopPythonRuntimeResolver";
import { DesktopStartupPhases } from "../DesktopStartupContract";
import type { DesktopPostLoginRuntimeStatusStore } from "../DesktopPostLoginRuntimeStatusStore";
import type { DesktopPythonRuntimeInfo } from "../../shared/DesktopContracts";
import {
  logInitializationCheckpoint,
  logInitializationEnd,
  logInitializationMemory,
  logInitializationStart,
} from "../InitializationLogging";

export interface ResolvePythonRuntimeActivationStageInput {
  readonly isPackaged: boolean;
  readonly repoRoot: string;
  readonly storagePaths: ReturnType<typeof resolveDesktopStoragePaths>;
  readonly postLoginRuntimeStatusStore: DesktopPostLoginRuntimeStatusStore;
  readonly bootstrapStartedAt: number;
  readonly resolvePythonRuntime?: (input: {
    readonly isPackaged: boolean;
    readonly repoRoot: string;
    readonly resourcesPath: string;
    readonly storagePaths: ReturnType<typeof resolveDesktopStoragePaths>;
  }) => DesktopPythonRuntimeInfo;
}

export function resolvePythonRuntimeActivationStage(
  input: ResolvePythonRuntimeActivationStageInput,
): DesktopPythonRuntimeInfo {
  const resolvePythonRuntime = input.resolvePythonRuntime ?? resolveDesktopPythonRuntime;
  const pythonRuntimeResolutionStartedAt = logInitializationStart("desktop-startup.post-login-python-runtime-resolve");
  input.postLoginRuntimeStatusStore.markPythonRuntimeResolutionRunning();
  console.info("[ai-loom][startup] Resolving desktop Python runtime for post-login warmup.");

  try {
    const pythonRuntime = resolvePythonRuntime({
      isPackaged: input.isPackaged,
      repoRoot: input.repoRoot,
      resourcesPath: process.resourcesPath,
      storagePaths: input.storagePaths,
    });
    input.postLoginRuntimeStatusStore.markPythonRuntimeResolutionReady({
      detail: `mode=${pythonRuntime.mode}, available=${pythonRuntime.isAvailable}`,
    });
    logInitializationEnd("desktop-startup.post-login-python-runtime-resolve", pythonRuntimeResolutionStartedAt);
    console.info(
      `[ai-loom][startup] Desktop Python runtime resolved (mode=${pythonRuntime.mode}, available=${pythonRuntime.isAvailable}).`,
    );
    logInitializationCheckpoint(DesktopStartupPhases.postLoginWarmup, "python-runtime-resolved", input.bootstrapStartedAt);
    logInitializationMemory(DesktopStartupPhases.postLoginWarmup, "python-runtime-resolved");
    return pythonRuntime;
  } catch (error) {
    input.postLoginRuntimeStatusStore.markPythonRuntimeResolutionBlocked(error);
    logInitializationEnd("desktop-startup.post-login-python-runtime-resolve", pythonRuntimeResolutionStartedAt);
    throw error;
  }
}
