import { readFile as nodeReadFile, stat as nodeStat, writeFile as nodeWriteFile } from "node:fs/promises";
import path from "node:path";

import type { RuntimeInstallerPort } from "../../../../application/ports/runtime-installer/runtime-installer.port";
import type { LoggingPort } from "../../../../application/ports/logging";
import type {
  RuntimeInstallRequest,
  RuntimeInstallResult,
  RuntimeInstallStatusRequest,
  RuntimeInstallStatusResult,
} from "../../../../contracts/runtime-installer";
import type { ComfyUiRuntimeDeviceMode } from "../../comfyui/createComfyUiRuntimeSupervisor";
import {
  buildComfyUiManagedPythonEnvironmentRoot,
  buildComfyUiManagedPythonExecutablePath,
  type ComfyUiPythonEnvironmentMode,
} from "../../comfyui/comfyUiPythonEnvironment";

type ExecFileLike = (file: string, args?: readonly string[]) => Promise<{ stdout: string; stderr: string }>;

export interface CreateComfyUiRuntimeInstallerOptions {
  gitInstaller: RuntimeInstallerPort;
  pythonCommand?: string;
  pipCommand?: string;
  execFile?: ExecFileLike;
  now?: () => string;
  metadataFileName?: string;
  skipPythonSetup?: boolean;
  skipPythonValidation?: boolean;
  pythonEnvironmentMode?: ComfyUiPythonEnvironmentMode;
  runtimeDeviceMode?: ComfyUiRuntimeDeviceMode;
  directMlPackageName?: string;
  directMlTorchVersion?: string;
  directMlTorchAudioVersion?: string;
  directMlTorchVisionVersion?: string;
  requirementsFileName?: string;
  stat?: typeof nodeStat;
  readFile?: typeof nodeReadFile;
  writeFile?: typeof nodeWriteFile;
  logging?: LoggingPort;
}

export const DEFAULT_COMFYUI_REPOSITORY_URL = "https://github.com/Comfy-Org/ComfyUI";

interface BuildComfyUiInstallRequestInput {
  installRoot: string;
  source?: RuntimeInstallRequest["source"];
  metadata?: Record<string, unknown>;
  allowUpdate?: boolean;
  forceRepair?: boolean;
}

function readGitRef(source: RuntimeInstallRequest["source"] | undefined): string | undefined {
  if (!source || source.type !== "git") {
    return undefined;
  }
  return source.ref;
}

interface ComfyUiFinalizationMetadata {
  schemaVersion: number;
  managedBy: "ai-system-builder";
  targetId: "comfyui";
  installRoot: string;
  commitSha?: string;
  pythonEnvironmentMode: ComfyUiPythonEnvironmentMode;
  runtimeDeviceMode: ComfyUiRuntimeDeviceMode | "auto";
  skipPythonSetup: boolean;
  skipPythonValidation: boolean;
  requirementsFileName: string;
  directMlPackageName: string;
  pythonDependenciesInstalledAt?: string;
  directMlDependenciesInstalledAt?: string;
  pythonEnvironmentCreatedAt?: string;
  validationCheckedAt?: string;
  finalizedAt: string;
}
export const COMFYUI_FINALIZATION_SCHEMA_VERSION = 2;
export const DEFAULT_DIRECTML_TORCH_VERSION = "2.3.1";
export const DEFAULT_DIRECTML_TORCHAUDIO_VERSION = "2.3.1";
export const DEFAULT_DIRECTML_TORCHVISION_VERSION = "0.18.1";

export function buildComfyUiInstallRequest(input: BuildComfyUiInstallRequestInput): RuntimeInstallRequest {
  return {
    targetId: "comfyui",
    installRoot: input.installRoot,
    source: {
      type: "git",
      repositoryUrl: DEFAULT_COMFYUI_REPOSITORY_URL,
      ref: readGitRef(input.source),
    },
    metadata: input.metadata,
    allowUpdate: input.allowUpdate,
    forceRepair: input.forceRepair,
  };
}

function normalizeComfyUiInstallRequest(request: RuntimeInstallRequest): RuntimeInstallRequest {
  return buildComfyUiInstallRequest({
    installRoot: request.installRoot ?? "",
    source: request.source,
    metadata: request.metadata,
    allowUpdate: request.allowUpdate,
    forceRepair: request.forceRepair,
  });
}

export function createComfyUiRuntimeInstaller(options: CreateComfyUiRuntimeInstallerOptions): RuntimeInstallerPort {
  const now = options.now ?? (() => new Date().toISOString());
  const pythonCommand = options.pythonCommand ?? "python";
  const requirementsFileName = options.requirementsFileName ?? "requirements.txt";
  const directMlPackageName = options.directMlPackageName ?? "torch-directml";
  const directMlTorchVersion = options.directMlTorchVersion ?? DEFAULT_DIRECTML_TORCH_VERSION;
  const directMlTorchAudioVersion = options.directMlTorchAudioVersion ?? DEFAULT_DIRECTML_TORCHAUDIO_VERSION;
  const directMlTorchVisionVersion = options.directMlTorchVisionVersion ?? DEFAULT_DIRECTML_TORCHVISION_VERSION;
  const pythonEnvironmentMode = options.pythonEnvironmentMode ?? "managed-venv";
  const stat = options.stat ?? nodeStat;
  const readFile = options.readFile ?? nodeReadFile;
  const writeFile = options.writeFile ?? nodeWriteFile;
  const finalizationMetadataFileName = options.metadataFileName ?? ".ai-system-builder-comfyui-finalization.json";

  const makeError = (code: string, message: string, details?: Record<string, unknown>) => ({ code, message, details });
  const log = (level: "debug" | "info" | "error", message: string, details?: Record<string, unknown>) => {
    void options.logging?.log({
      level,
      message,
      timestamp: new Date().toISOString(),
      verbosity: "normal",
      event: "runtime.comfyui.installer.activity",
      component: "comfyui-runtime-installer",
      subsystem: "runtime",
      data: details,
    });
  };
  const elapsed = (startedAt: number) => Date.now() - startedAt;
  const getFinalizationMetadataPath = (installRoot: string) => path.join(installRoot, finalizationMetadataFileName);

  const logInstallResult = (operation: "ensure" | "repair", result: RuntimeInstallResult, startedAt: number) => {
    log(result.status === "installed" ? "info" : "error", `ComfyUI ${operation} install finished.`, {
      operation,
      targetId: result.targetId,
      installRoot: result.installRoot,
      status: result.status,
      durationMs: elapsed(startedAt),
      error: result.error,
      warningCount: result.warnings?.length ?? 0,
    });
  };

  async function pathExists(targetPath: string): Promise<boolean> {
    try {
      await stat(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  async function readFinalizationMetadata(installRoot: string): Promise<ComfyUiFinalizationMetadata | undefined> {
    const metadataPath = getFinalizationMetadataPath(installRoot);
    if (!(await pathExists(metadataPath))) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(await readFile(metadataPath, "utf-8")) as Partial<ComfyUiFinalizationMetadata>;
      if (parsed.managedBy !== "ai-system-builder" || parsed.targetId !== "comfyui") {
        return undefined;
      }
      return parsed as ComfyUiFinalizationMetadata;
    } catch (error) {
      log("error", "ComfyUI finalization metadata could not be read; dependency stages will be rechecked.", {
        installRoot,
        metadataPath,
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

  async function writeFinalizationMetadata(metadata: ComfyUiFinalizationMetadata): Promise<void> {
    const metadataPath = getFinalizationMetadataPath(metadata.installRoot);
    try {
      await writeFile(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");
    } catch (error) {
      log("error", "ComfyUI finalization metadata could not be written; dependency stages may run again next start.", {
        installRoot: metadata.installRoot,
        metadataPath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  function matchesFinalizationMetadata(metadata: ComfyUiFinalizationMetadata | undefined, input: {
    installRoot: string;
    commitSha?: string;
    skipPythonSetup: boolean;
    skipPythonValidation: boolean;
  }): metadata is ComfyUiFinalizationMetadata {
    return metadata?.managedBy === "ai-system-builder"
      && metadata.targetId === "comfyui"
      && metadata.schemaVersion === COMFYUI_FINALIZATION_SCHEMA_VERSION
      && metadata.installRoot === input.installRoot
      && metadata.commitSha === input.commitSha
      && metadata.pythonEnvironmentMode === pythonEnvironmentMode
      && metadata.runtimeDeviceMode === (options.runtimeDeviceMode ?? "auto")
      && metadata.skipPythonSetup === input.skipPythonSetup
      && metadata.skipPythonValidation === input.skipPythonValidation
      && metadata.requirementsFileName === requirementsFileName
      && metadata.directMlPackageName === directMlPackageName;
  }

  async function runCommandStage(input: {
    stage: string;
    file: string;
    args: readonly string[];
    installRoot?: string;
  }): Promise<{ stdout: string; stderr: string }> {
    if (!options.execFile) {
      throw new Error("No execFile configured");
    }

    const startedAt = Date.now();
    log("info", "Starting ComfyUI installer command.", {
      stage: input.stage,
      file: input.file,
      args: input.args,
      installRoot: input.installRoot,
    });
    const heartbeat = setInterval(() => {
      log("info", "ComfyUI installer command is still running.", {
        stage: input.stage,
        file: input.file,
        durationMs: elapsed(startedAt),
        installRoot: input.installRoot,
      });
    }, 30_000);
    heartbeat.unref?.();

    try {
      const result = await options.execFile(input.file, input.args);
      log("info", "ComfyUI installer command completed.", {
        stage: input.stage,
        file: input.file,
        durationMs: elapsed(startedAt),
        stdoutBytes: result.stdout.length,
        stderrBytes: result.stderr.length,
        installRoot: input.installRoot,
      });
      return result;
    } finally {
      clearInterval(heartbeat);
    }
  }

  async function ensurePythonEnvironment(installRoot: string): Promise<{
    pythonCommand: string;
    createdAt?: string;
    error?: RuntimeInstallResult["error"];
  }> {
    if (pythonEnvironmentMode === "ambient") {
      return { pythonCommand };
    }

    const managedPythonCommand = buildComfyUiManagedPythonExecutablePath({ installRoot });
    if (await pathExists(managedPythonCommand)) {
      return { pythonCommand: managedPythonCommand };
    }

    if (!options.execFile) {
      return { pythonCommand };
    }

    const environmentRoot = buildComfyUiManagedPythonEnvironmentRoot(installRoot);
    const stageStartedAt = Date.now();
    log("info", "Creating ComfyUI managed Python environment.", { installRoot, environmentRoot, pythonCommand });

    try {
      await runCommandStage({ stage: "python-environment", file: pythonCommand, args: ["-m", "venv", environmentRoot], installRoot });
      log("info", "ComfyUI managed Python environment created.", {
        installRoot,
        environmentRoot,
        durationMs: elapsed(stageStartedAt),
      });
      return { pythonCommand: managedPythonCommand, createdAt: now() };
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string; message?: string };
      log("error", "ComfyUI managed Python environment creation failed.", {
        installRoot,
        environmentRoot,
        durationMs: elapsed(stageStartedAt),
        message: err?.message,
        stdout: err?.stdout,
        stderr: err?.stderr,
      });
      return {
        pythonCommand,
        error: makeError("python-environment-create-failed", "Failed to create ComfyUI managed Python environment", {
          stdout: err?.stdout,
          stderr: err?.stderr,
          message: err?.message,
          environmentRoot,
        }),
      };
    }
  }

  async function ensurePythonDependencies(
    installRoot: string,
    dependencyPythonCommand: string,
  ): Promise<{ warnings: string[]; installedAt?: string; error?: RuntimeInstallResult["error"] }> {
    const warnings: string[] = [];
    const requirementsPath = path.join(installRoot, requirementsFileName);
    const stageStartedAt = Date.now();
    log("info", "Checking ComfyUI Python dependency stage.", { installRoot, requirementsPath });

    if (!(await pathExists(requirementsPath))) {
      warnings.push(`Skipped Python dependency install: ${requirementsFileName} not found`);
      log("info", "Skipped ComfyUI Python dependency install because requirements file is missing.", {
        installRoot,
        requirementsPath,
        durationMs: elapsed(stageStartedAt),
      });
      return { warnings };
    }

    if (!options.execFile) {
      warnings.push("Skipped Python dependency install: no execFile configured");
      log("info", "Skipped ComfyUI Python dependency install because no command runner is configured.", {
        installRoot,
        requirementsPath,
        durationMs: elapsed(stageStartedAt),
      });
      return { warnings };
    }

    try {
      if (options.pipCommand) {
        log("info", "Installing ComfyUI Python dependencies with pip command.", { pipCommand: options.pipCommand });
        await runCommandStage({ stage: "python-dependencies", file: options.pipCommand, args: ["install", "-r", requirementsPath], installRoot });
      } else {
        log("info", "Installing ComfyUI Python dependencies via python -m pip.", { pythonCommand: dependencyPythonCommand });
        await runCommandStage({ stage: "python-dependencies", file: dependencyPythonCommand, args: ["-m", "pip", "install", "-r", requirementsPath], installRoot });
      }
      log("info", "ComfyUI Python dependency install completed.", {
        installRoot,
        requirementsPath,
        durationMs: elapsed(stageStartedAt),
      });
      return { warnings, installedAt: now() };
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string; message?: string };
      log("error", "ComfyUI Python dependency install failed.", {
        installRoot,
        requirementsPath,
        durationMs: elapsed(stageStartedAt),
        message: err?.message,
        stdout: err?.stdout,
        stderr: err?.stderr,
      });
      return {
        warnings,
        error: makeError("python-dependency-install-failed", "Failed to install Python dependencies", {
          stdout: err?.stdout,
          stderr: err?.stderr,
          message: err?.message,
        }),
      };
    }
  }

  async function ensureDirectMlDependencies(dependencyPythonCommand: string): Promise<{ installedAt?: string; error?: RuntimeInstallResult["error"] }> {
    if (options.runtimeDeviceMode !== "directml") {
      return {};
    }

    const stageStartedAt = Date.now();
    log("info", "Checking ComfyUI DirectML dependency stage.", { directMlPackageName });

    if (!options.execFile) {
      log("error", "ComfyUI DirectML dependency install failed because no command runner is configured.", {
        directMlPackageName,
        durationMs: elapsed(stageStartedAt),
      });
      return { error: makeError("directml-dependency-install-failed", "Failed to install DirectML dependency", { message: "no execFile configured" }) };
    }

    try {
      await runCommandStage({
        stage: "directml-torch-dependency",
        file: dependencyPythonCommand,
        args: ["-m", "pip", "install", "--force-reinstall", "--no-cache-dir", `torch==${directMlTorchVersion}`, `torchvision==${directMlTorchVisionVersion}`, `torchaudio==${directMlTorchAudioVersion}`],
      });
      await runCommandStage({
        stage: "directml-dependency",
        file: dependencyPythonCommand,
        args: ["-m", "pip", "install", "--force-reinstall", "--no-cache-dir", directMlPackageName],
      });
      log("info", "ComfyUI DirectML dependency install completed.", {
        directMlPackageName,
        durationMs: elapsed(stageStartedAt),
      });
      return { installedAt: now() };
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string; message?: string };
      log("error", "ComfyUI DirectML dependency install failed.", {
        directMlPackageName,
        durationMs: elapsed(stageStartedAt),
        message: err?.message,
        stdout: err?.stdout,
        stderr: err?.stderr,
      });
      return {
        error: makeError("directml-dependency-install-failed", "Failed to install DirectML dependency", {
          stdout: err?.stdout,
          stderr: err?.stderr,
          message: err?.message,
        }),
      };
    }
  }

  async function checkPythonRuntimeDependencies(dependencyPythonCommand: string): Promise<{ healthy: boolean; error?: RuntimeInstallResult["error"] }> {
    if (!options.execFile) return { healthy: true };
    try {
      await runCommandStage({ stage: "torch-import-check", file: dependencyPythonCommand, args: ["-c", "import torch; print(torch.__version__)"] });
      await runCommandStage({ stage: "torchaudio-import-check", file: dependencyPythonCommand, args: ["-c", "import torchaudio; print(torchaudio.__version__)"] });
      if (options.runtimeDeviceMode === "directml") {
        await runCommandStage({ stage: "directml-import-check", file: dependencyPythonCommand, args: ["-c", "import torch_directml; print(torch_directml.device())"] });
      }
      return { healthy: true };
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string; message?: string };
      const errorText = `${err?.message ?? ""} ${err?.stderr ?? ""}`;
      const code = errorText.includes("torch_directml")
        ? "directml-import-check-failed"
        : errorText.includes("torchaudio")
          ? "torchaudio-import-check-failed"
          : "torch-import-check-failed";
      return {
        healthy: false,
        error: makeError(code, "ComfyUI Python dependency mismatch detected. The managed environment has incompatible torch/torchaudio binaries. Repair the ComfyUI install or allow the app to reinstall DirectML dependencies.", {
          stdout: err?.stdout,
          stderr: err?.stderr,
          message: err?.message,
        }),
      };
    }
  }

  async function validateComfyUi(
    installRoot: string,
    validationPythonCommand: string,
  ): Promise<{ checkedAt?: string; error?: RuntimeInstallResult["error"] }> {
    const entrypointPath = path.join(installRoot, "main.py");
    const stageStartedAt = Date.now();
    log("info", "Checking ComfyUI validation stage.", { installRoot, entrypointPath });
    if (!(await pathExists(entrypointPath))) {
      log("error", "ComfyUI validation failed because entrypoint is missing.", {
        installRoot,
        entrypointPath,
        durationMs: elapsed(stageStartedAt),
      });
      return { error: makeError("comfyui-missing-entrypoint", "ComfyUI entrypoint main.py is missing", { entrypointPath }) };
    }

    if (options.execFile && !options.skipPythonValidation) {
      try {
        log("info", "Validating ComfyUI entrypoint.", { installRoot, entrypointPath, pythonCommand: validationPythonCommand });
        await runCommandStage({ stage: "validation", file: validationPythonCommand, args: [entrypointPath, "--help"], installRoot });
      } catch (error) {
        const err = error as { stdout?: string; stderr?: string; message?: string };
        log("error", "ComfyUI validation command failed.", {
          installRoot,
          entrypointPath,
          durationMs: elapsed(stageStartedAt),
          message: err?.message,
          stdout: err?.stdout,
          stderr: err?.stderr,
        });
        return {
          error: makeError("comfyui-validation-failed", "ComfyUI validation command failed", {
            stdout: err?.stdout,
            stderr: err?.stderr,
            message: err?.message,
          }),
        };
      }
    } else if (options.skipPythonValidation) {
      log("info", "Skipped ComfyUI Python validation command.", { installRoot, entrypointPath });
    }

    log("info", "ComfyUI validation stage completed.", {
      installRoot,
      entrypointPath,
      durationMs: elapsed(stageStartedAt),
    });
    return { checkedAt: now() };
  }

  async function finalizeComfyUiInstall(installResult: RuntimeInstallResult, normalizedRequest: RuntimeInstallRequest): Promise<RuntimeInstallResult> {
    const finalizeStartedAt = Date.now();
    const skipPythonSetup = options.skipPythonSetup === true;
    const skipPythonValidation = options.skipPythonValidation === true;
    log("info", "Finalizing ComfyUI install with dependency and validation stages.", {
      installRoot: normalizedRequest.installRoot,
      targetId: normalizedRequest.targetId,
      commitSha: installResult.commitSha,
      skipPythonSetup,
      skipPythonValidation,
      runtimeDeviceMode: options.runtimeDeviceMode ?? "auto",
      pythonEnvironmentMode,
    });
    const warnings = [...(installResult.warnings ?? [])];

    const finalizationMetadata = await readFinalizationMetadata(normalizedRequest.installRoot);
    if (matchesFinalizationMetadata(finalizationMetadata, {
      installRoot: normalizedRequest.installRoot,
      commitSha: installResult.commitSha,
      skipPythonSetup,
      skipPythonValidation,
    })) {
      const dependencyPythonCommand = pythonEnvironmentMode === "managed-venv"
        ? buildComfyUiManagedPythonExecutablePath({ installRoot: normalizedRequest.installRoot })
        : pythonCommand;
      const dependencyCheck = await checkPythonRuntimeDependencies(dependencyPythonCommand);
      if (dependencyCheck.healthy) {
        log("info", "ComfyUI install finalization already completed; skipping dependency and validation commands.", {
        installRoot: normalizedRequest.installRoot,
        targetId: normalizedRequest.targetId,
        commitSha: installResult.commitSha,
        metadataPath: getFinalizationMetadataPath(normalizedRequest.installRoot),
        durationMs: elapsed(finalizeStartedAt),
      });
        return {
        ...installResult,
        warnings,
        metadata: {
          ...(installResult.metadata ?? {}),
          extra: finalizationMetadata,
        },
        };
      }
      log("error", "ComfyUI finalization metadata matched but Python dependency imports are unhealthy; continuing with dependency repair.", {
        installRoot: normalizedRequest.installRoot,
        error: dependencyCheck.error,
      });
    }

    const shouldUsePythonEnvironment = !skipPythonSetup || !skipPythonValidation;
    const pythonEnvironment = shouldUsePythonEnvironment
      ? await ensurePythonEnvironment(normalizedRequest.installRoot)
      : { pythonCommand };
    if (pythonEnvironment.error) {
      log("error", "ComfyUI install finalization failed during Python environment stage.", {
        installRoot: normalizedRequest.installRoot,
        targetId: normalizedRequest.targetId,
        durationMs: elapsed(finalizeStartedAt),
        error: pythonEnvironment.error,
      });
      return { ...installResult, status: "failed", warnings, error: pythonEnvironment.error };
    }

    let pythonDependenciesInstalledAt: string | undefined;
    let directMlDependenciesInstalledAt: string | undefined;
    if (!skipPythonSetup) {
      const pythonSetup = await ensurePythonDependencies(normalizedRequest.installRoot, pythonEnvironment.pythonCommand);
      warnings.push(...pythonSetup.warnings);
      if (pythonSetup.error) {
        log("error", "ComfyUI install finalization failed during Python dependency stage.", {
          installRoot: normalizedRequest.installRoot,
          targetId: normalizedRequest.targetId,
          durationMs: elapsed(finalizeStartedAt),
          error: pythonSetup.error,
        });
        return { ...installResult, status: "failed", warnings, error: pythonSetup.error };
      }
      pythonDependenciesInstalledAt = pythonSetup.installedAt;

      const directMlSetup = await ensureDirectMlDependencies(pythonEnvironment.pythonCommand);
      if (directMlSetup.error) {
        log("error", "ComfyUI install finalization failed during DirectML dependency stage.", {
          installRoot: normalizedRequest.installRoot,
          targetId: normalizedRequest.targetId,
          durationMs: elapsed(finalizeStartedAt),
          error: directMlSetup.error,
        });
        return { ...installResult, status: "failed", warnings, error: directMlSetup.error };
      }
      directMlDependenciesInstalledAt = directMlSetup.installedAt;

      const dependencyCheck = await checkPythonRuntimeDependencies(pythonEnvironment.pythonCommand);
      if (!dependencyCheck.healthy) {
        log("error", "ComfyUI install finalization failed during torchaudio import stage.", {
          installRoot: normalizedRequest.installRoot,
          targetId: normalizedRequest.targetId,
          durationMs: elapsed(finalizeStartedAt),
          error: dependencyCheck.error,
        });
        return { ...installResult, status: "failed", warnings, error: dependencyCheck.error };
      }
    } else {
      log("info", "Skipped ComfyUI Python dependency stage by configuration.", {
        installRoot: normalizedRequest.installRoot,
        targetId: normalizedRequest.targetId,
      });
    }

    const validation = await validateComfyUi(normalizedRequest.installRoot, pythonEnvironment.pythonCommand);
    if (validation.error) {
      log("error", "ComfyUI install finalization failed during validation stage.", {
        installRoot: normalizedRequest.installRoot,
        targetId: normalizedRequest.targetId,
        durationMs: elapsed(finalizeStartedAt),
        error: validation.error,
      });
      return { ...installResult, status: "failed", warnings, error: validation.error };
    }

    const finalization: ComfyUiFinalizationMetadata = {
      schemaVersion: COMFYUI_FINALIZATION_SCHEMA_VERSION,
      managedBy: "ai-system-builder",
      targetId: "comfyui",
      installRoot: normalizedRequest.installRoot,
      commitSha: installResult.commitSha,
      pythonEnvironmentMode,
      runtimeDeviceMode: options.runtimeDeviceMode ?? "auto",
      skipPythonSetup,
      skipPythonValidation,
      requirementsFileName,
      directMlPackageName,
      pythonDependenciesInstalledAt,
      directMlDependenciesInstalledAt,
      pythonEnvironmentCreatedAt: pythonEnvironment.createdAt,
      validationCheckedAt: validation.checkedAt,
      finalizedAt: now(),
    };
    await writeFinalizationMetadata(finalization);

    log("info", "ComfyUI install finalization completed.", {
      installRoot: normalizedRequest.installRoot,
      targetId: normalizedRequest.targetId,
      durationMs: elapsed(finalizeStartedAt),
      warningCount: warnings.length,
      metadataPath: getFinalizationMetadataPath(normalizedRequest.installRoot),
    });
    return {
      ...installResult,
      warnings,
      metadata: {
        ...(installResult.metadata ?? {}),
        extra: {
          ...finalization,
        },
      },
    };
  }

  async function ensureInstalled(request: RuntimeInstallRequest): Promise<RuntimeInstallResult> {
    const operationStartedAt = Date.now();
    log("info", "Ensuring ComfyUI install.", { installRoot: request.installRoot, targetId: request.targetId });
    const normalizedRequest = normalizeComfyUiInstallRequest(request);
    log("info", "Resolved ComfyUI install request.", {
      installRoot: normalizedRequest.installRoot,
      targetId: normalizedRequest.targetId,
      sourceType: normalizedRequest.source.type,
      requestedRef: normalizedRequest.source.ref,
      allowUpdate: normalizedRequest.allowUpdate === true,
      forceRepair: normalizedRequest.forceRepair === true,
    });
    if (!normalizedRequest.installRoot) {
      const result = {
        targetId: normalizedRequest.targetId,
        status: "failed",
        installRoot: normalizedRequest.installRoot,
        source: normalizedRequest.source,
        error: makeError("missing-install-root", "installRoot is required"),
      } satisfies RuntimeInstallResult;
      logInstallResult("ensure", result, operationStartedAt);
      return result;
    }

    log("info", "Delegating ComfyUI git install stage.", {
      installRoot: normalizedRequest.installRoot,
      targetId: normalizedRequest.targetId,
    });
    const installResult = await options.gitInstaller.ensureInstalled(normalizedRequest);
    if (installResult.status !== "installed") {
      logInstallResult("ensure", installResult, operationStartedAt);
      return installResult;
    }

    const result = await finalizeComfyUiInstall(installResult, normalizedRequest);
    logInstallResult("ensure", result, operationStartedAt);
    return result;
  }

  async function getInstallStatus(request: RuntimeInstallStatusRequest): Promise<RuntimeInstallStatusResult> {
    return options.gitInstaller.getInstallStatus(buildComfyUiInstallRequest({
      installRoot: request.installRoot ?? "",
      source: request.source,
      metadata: request.metadata,
    }));
  }

  async function repairInstall(request: RuntimeInstallRequest): Promise<RuntimeInstallResult> {
    const operationStartedAt = Date.now();
    log("info", "Repairing ComfyUI install.", { installRoot: request.installRoot, targetId: request.targetId });
    const normalizedRequest = normalizeComfyUiInstallRequest(request);
    log("info", "Resolved ComfyUI repair request.", {
      installRoot: normalizedRequest.installRoot,
      targetId: normalizedRequest.targetId,
      sourceType: normalizedRequest.source.type,
      requestedRef: normalizedRequest.source.ref,
      allowUpdate: true,
      forceRepair: normalizedRequest.forceRepair === true,
    });
    if (!normalizedRequest.installRoot) {
      const result = {
        targetId: normalizedRequest.targetId,
        status: "failed",
        installRoot: normalizedRequest.installRoot,
        source: normalizedRequest.source,
        error: makeError("missing-install-root", "installRoot is required"),
      } satisfies RuntimeInstallResult;
      logInstallResult("repair", result, operationStartedAt);
      return result;
    }

    if (!options.gitInstaller.repairInstall) {
      log("info", "Git installer has no repair operation; using ComfyUI ensure install path.", {
        installRoot: normalizedRequest.installRoot,
        targetId: normalizedRequest.targetId,
      });
      const result = await ensureInstalled({ ...normalizedRequest, allowUpdate: true });
      logInstallResult("repair", result, operationStartedAt);
      return result;
    }

    const status = await options.gitInstaller.getInstallStatus(normalizedRequest);
    log("info", "Read ComfyUI install status before repair.", {
      installRoot: normalizedRequest.installRoot,
      targetId: normalizedRequest.targetId,
      status: status.status,
      error: status.error,
    });

    if (status.status === "not-installed") {
      log("info", "ComfyUI install is missing; repair will perform initial install.", {
        installRoot: normalizedRequest.installRoot,
        targetId: normalizedRequest.targetId,
      });
      const installResult = await options.gitInstaller.ensureInstalled({ ...normalizedRequest, allowUpdate: true });
      if (installResult.status !== "installed") {
        logInstallResult("repair", installResult, operationStartedAt);
        return installResult;
      }
      const result = await finalizeComfyUiInstall(installResult, normalizedRequest);
      logInstallResult("repair", result, operationStartedAt);
      return result;
    }

    log("info", "Delegating ComfyUI git repair stage.", {
      installRoot: normalizedRequest.installRoot,
      targetId: normalizedRequest.targetId,
    });
    const repairResult = await options.gitInstaller.repairInstall({ ...normalizedRequest, allowUpdate: true });
    if (repairResult.status !== "installed") {
      logInstallResult("repair", repairResult, operationStartedAt);
      return repairResult;
    }
    const result = await finalizeComfyUiInstall(repairResult, normalizedRequest);
    logInstallResult("repair", result, operationStartedAt);
    return result;
  }

  return { ensureInstalled, getInstallStatus, repairInstall };
}
