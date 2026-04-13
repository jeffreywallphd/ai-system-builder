import process from "node:process";
import { resolveDesktopStoragePaths } from "../../../src/infrastructure/desktop/DesktopAppPaths";
import { resolveDesktopPythonRuntime } from "../../../src/infrastructure/desktop/DesktopPythonRuntimeResolver";
import { DesktopStartupPhases } from "../DesktopStartupContract";
import type { DesktopPostLoginRuntimeStatusStore } from "../DesktopPostLoginRuntimeStatusStore";
import type { DesktopPythonRuntimeInfo } from "../../shared/DesktopContracts";
import {
  logPostLoginActivationDiagnostic,
  summarizeActivationError,
} from "./PostLoginActivationDiagnostics";
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
  const startedAtIso = new Date(pythonRuntimeResolutionStartedAt).toISOString();
  input.postLoginRuntimeStatusStore.markPythonRuntimeResolutionRunning();
  logPostLoginActivationDiagnostic({
    payload: {
      event: "desktop.post-login-activation.stage.started",
      stageId: "python-runtime-resolution",
      startedAt: startedAtIso,
      blockingDependency: "python-runtime",
      dependencies: Object.freeze(["desktop-storage", "python-runtime"]),
      detail: "Resolving desktop Python runtime for post-login activation.",
    },
  });
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
    const endedAt = Date.now();
    logPostLoginActivationDiagnostic({
      payload: {
        event: "desktop.post-login-activation.stage.completed",
        stageId: "python-runtime-resolution",
        startedAt: startedAtIso,
        endedAt: new Date(endedAt).toISOString(),
        durationMs: Math.max(0, endedAt - pythonRuntimeResolutionStartedAt),
        blockingDependency: "python-runtime",
        detail: `mode=${pythonRuntime.mode}, available=${pythonRuntime.isAvailable}`,
      },
    });
    logInitializationEnd("desktop-startup.post-login-python-runtime-resolve", pythonRuntimeResolutionStartedAt);
    console.info(
      `[ai-loom][startup] Desktop Python runtime resolved (mode=${pythonRuntime.mode}, available=${pythonRuntime.isAvailable}).`,
    );
    logInitializationCheckpoint(DesktopStartupPhases.postLoginWarmup, "python-runtime-resolved", input.bootstrapStartedAt);
    logInitializationMemory(DesktopStartupPhases.postLoginWarmup, "python-runtime-resolved");
    return pythonRuntime;
  } catch (error) {
    const endedAt = Date.now();
    const summarizedError = summarizeActivationError(error);
    input.postLoginRuntimeStatusStore.markPythonRuntimeResolutionBlocked(error);
    logPostLoginActivationDiagnostic({
      level: "error",
      payload: {
        event: "desktop.post-login-activation.stage.blocked",
        stageId: "python-runtime-resolution",
        startedAt: startedAtIso,
        endedAt: new Date(endedAt).toISOString(),
        durationMs: Math.max(0, endedAt - pythonRuntimeResolutionStartedAt),
        blockingDependency: "python-runtime",
        ...summarizedError,
      },
    });
    logInitializationEnd("desktop-startup.post-login-python-runtime-resolve", pythonRuntimeResolutionStartedAt);
    throw error;
  }
}
