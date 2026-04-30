import { stat as nodeStat } from "node:fs/promises";
import path from "node:path";

import type { RuntimeInstallerPort } from "../../../../application/ports/runtime-installer/runtime-installer.port";
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
}

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
      repositoryUrl: "https://github.com/Comfy-Org/ComfyUI",
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

    if (!(await pathExists(requirementsPath))) {
      warnings.push(`Skipped Python dependency install: ${requirementsFileName} not found`);
      return { warnings };
    }

    if (!options.execFile) {
      warnings.push("Skipped Python dependency install: no execFile configured");
      return { warnings };
    }

    try {
      if (options.pipCommand) {
        await options.execFile(options.pipCommand, ["install", "-r", requirementsPath]);
      } else {
        await options.execFile(pythonCommand, ["-m", "pip", "install", "-r", requirementsPath]);
      }
      return { warnings, installedAt: now() };
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string; message?: string };
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
    if (!(await pathExists(entrypointPath))) {
      return { error: makeError("comfyui-missing-entrypoint", "ComfyUI entrypoint main.py is missing", { entrypointPath }) };
    }

    if (options.execFile && !options.skipPythonValidation) {
      try {
        await options.execFile(pythonCommand, [entrypointPath, "--help"]);
      } catch (error) {
        const err = error as { stdout?: string; stderr?: string; message?: string };
        return {
          error: makeError("comfyui-validation-failed", "ComfyUI validation command failed", {
            stdout: err?.stdout,
            stderr: err?.stderr,
            message: err?.message,
          }),
        };
      }
    }

    return { checkedAt: now() };
  }

  async function finalizeComfyUiInstall(installResult: RuntimeInstallResult, normalizedRequest: RuntimeInstallRequest): Promise<RuntimeInstallResult> {
    const warnings = [...(installResult.warnings ?? [])];

    let pythonDependenciesInstalledAt: string | undefined;
    if (!options.skipPythonSetup) {
      const pythonSetup = await ensurePythonDependencies(normalizedRequest.installRoot);
      warnings.push(...pythonSetup.warnings);
      if (pythonSetup.error) {
        return { ...installResult, status: "failed", warnings, error: pythonSetup.error };
      }
      pythonDependenciesInstalledAt = pythonSetup.installedAt;
    }

    const validation = await validateComfyUi(normalizedRequest.installRoot);
    if (validation.error) {
      return { ...installResult, status: "failed", warnings, error: validation.error };
    }

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
    const normalizedRequest = normalizeComfyUiInstallRequest(request);
    if (!normalizedRequest.installRoot) {
      return {
        targetId: normalizedRequest.targetId,
        status: "failed",
        installRoot: normalizedRequest.installRoot,
        source: normalizedRequest.source,
        error: makeError("missing-install-root", "installRoot is required"),
      };
    }

    const installResult = await options.gitInstaller.ensureInstalled(normalizedRequest);
    if (installResult.status !== "installed") {
      return installResult;
    }

    return finalizeComfyUiInstall(installResult, normalizedRequest);
  }

  async function getInstallStatus(request: RuntimeInstallStatusRequest): Promise<RuntimeInstallStatusResult> {
    return options.gitInstaller.getInstallStatus(buildComfyUiInstallRequest({
      installRoot: request.installRoot ?? "",
      source: request.source,
      metadata: request.metadata,
    }));
  }

  async function repairInstall(request: RuntimeInstallRequest): Promise<RuntimeInstallResult> {
    const normalizedRequest = normalizeComfyUiInstallRequest(request);
    if (!normalizedRequest.installRoot) {
      return {
        targetId: normalizedRequest.targetId,
        status: "failed",
        installRoot: normalizedRequest.installRoot,
        source: normalizedRequest.source,
        error: makeError("missing-install-root", "installRoot is required"),
      };
    }

    if (!options.gitInstaller.repairInstall) {
      return ensureInstalled({ ...normalizedRequest, allowUpdate: true });
    }

    const repairResult = await options.gitInstaller.repairInstall({ ...normalizedRequest, allowUpdate: true });
    if (repairResult.status !== "installed") {
      return repairResult;
    }
    return finalizeComfyUiInstall(repairResult, normalizedRequest);
  }

  return { ensureInstalled, getInstallStatus, repairInstall };
}
