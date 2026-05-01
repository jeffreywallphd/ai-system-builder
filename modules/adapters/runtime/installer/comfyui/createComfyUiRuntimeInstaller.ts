import { stat as nodeStat } from "node:fs/promises";
import path from "node:path";

import type { RuntimeInstallerPort } from "../../../../application/ports/runtime-installer/runtime-installer.port";
import type { LoggingPort } from "../../../../application/ports/logging";
import type {
  RuntimeInstallRequest,
  RuntimeInstallResult,
  RuntimeInstallStatusRequest,
  RuntimeInstallStatusResult,
} from "../../../../contracts/runtime-installer";

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
  requirementsFileName?: string;
  stat?: typeof nodeStat;
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
  const stat = options.stat ?? nodeStat;

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

  async function ensurePythonDependencies(installRoot: string): Promise<{ warnings: string[]; installedAt?: string; error?: RuntimeInstallResult["error"] }> {
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
        await options.execFile(options.pipCommand, ["install", "-r", requirementsPath]);
      } else {
        log("info", "Installing ComfyUI Python dependencies via python -m pip.", { pythonCommand });
        await options.execFile(pythonCommand, ["-m", "pip", "install", "-r", requirementsPath]);
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

  async function validateComfyUi(installRoot: string): Promise<{ checkedAt?: string; error?: RuntimeInstallResult["error"] }> {
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
        log("info", "Validating ComfyUI entrypoint.", { installRoot, entrypointPath, pythonCommand });
        await options.execFile(pythonCommand, [entrypointPath, "--help"]);
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
    log("info", "Finalizing ComfyUI install with dependency and validation stages.", {
      installRoot: normalizedRequest.installRoot,
      targetId: normalizedRequest.targetId,
      skipPythonSetup: options.skipPythonSetup === true,
      skipPythonValidation: options.skipPythonValidation === true,
    });
    const warnings = [...(installResult.warnings ?? [])];

    let pythonDependenciesInstalledAt: string | undefined;
    if (!options.skipPythonSetup) {
      const pythonSetup = await ensurePythonDependencies(normalizedRequest.installRoot);
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
    } else {
      log("info", "Skipped ComfyUI Python dependency stage by configuration.", {
        installRoot: normalizedRequest.installRoot,
        targetId: normalizedRequest.targetId,
      });
    }

    const validation = await validateComfyUi(normalizedRequest.installRoot);
    if (validation.error) {
      log("error", "ComfyUI install finalization failed during validation stage.", {
        installRoot: normalizedRequest.installRoot,
        targetId: normalizedRequest.targetId,
        durationMs: elapsed(finalizeStartedAt),
        error: validation.error,
      });
      return { ...installResult, status: "failed", warnings, error: validation.error };
    }

    log("info", "ComfyUI install finalization completed.", {
      installRoot: normalizedRequest.installRoot,
      targetId: normalizedRequest.targetId,
      durationMs: elapsed(finalizeStartedAt),
      warningCount: warnings.length,
    });
    return {
      ...installResult,
      warnings,
      metadata: {
        ...(installResult.metadata ?? {}),
        extra: {
          pythonDependenciesInstalledAt,
          validationCheckedAt: validation.checkedAt,
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
