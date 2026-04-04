import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  RuntimeRepositoryInstallationStates,
  type IRuntimeRepositoryInstallerContract,
  type RuntimeRepositoryDiagnosticsRequest,
  type RuntimeRepositoryDiagnosticsResult,
  type RuntimeRepositoryInstallLocation,
  type RuntimeRepositoryInstallLocationRequest,
  type RuntimeRepositoryInstallRequest,
  type RuntimeRepositoryInstallResult,
  type RuntimeRepositoryStatusRequest,
  type RuntimeRepositoryStatusResult,
  type RuntimeRepositoryUpdateRequest,
  type RuntimeRepositoryUpdateResult,
  type RuntimeRepositoryValidationRequest,
  type RuntimeRepositoryValidationResult,
} from "../../../application/runtime/RuntimeRepositoryInstallerContract";
import {
  createComfyRuntimeInstallerOrchestrationService,
} from "../ComfyRuntimeInstallerComposition";

describe("createComfyRuntimeInstallerOrchestrationService", () => {
  it("wires python environment and dependency hooks into orchestration", async () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "comfy-runtime-composition-"));
    try {
      const installer = new FakeRuntimeRepositoryInstaller(tempRoot);
      const service = createComfyRuntimeInstallerOrchestrationService(installer, {
        pythonHooks: {
          commandRunner: new HappyPathPythonRunner(),
        },
      });

      const result = await service.orchestrate({
        targetRootDirectory: tempRoot,
      });

      expect(result.phases.find((entry) => entry.phase === "environment")?.status).toBe("completed");
      expect(result.phases.find((entry) => entry.phase === "dependencies")?.status).toBe("completed");
      expect(result.issues.some((entry) => entry.code === "environment-preparation-not-implemented")).toBeFalse();
      expect(result.issues.some((entry) => entry.code === "dependency-install-not-implemented")).toBeFalse();
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

class FakeRuntimeRepositoryInstaller implements IRuntimeRepositoryInstallerContract {
  private readonly installLocation: RuntimeRepositoryInstallLocation;
  private state: RuntimeRepositoryStatusResult["state"] = RuntimeRepositoryInstallationStates.notInstalled;

  public constructor(private readonly targetRootDirectory: string) {
    this.installLocation = Object.freeze({
      installLocationKey: "runtime-comfyui",
      installDirectory: path.join(targetRootDirectory, "runtime-comfyui"),
      targetRootDirectory,
    });
  }

  public resolveInstallLocation(_request: RuntimeRepositoryInstallLocationRequest): RuntimeRepositoryInstallLocation {
    return this.installLocation;
  }

  public async install(request: RuntimeRepositoryInstallRequest): Promise<RuntimeRepositoryInstallResult> {
    this.state = RuntimeRepositoryInstallationStates.installed;
    mkdirSync(this.installLocation.installDirectory, { recursive: true });
    writeFileSync(path.join(this.installLocation.installDirectory, "requirements.txt"), "fastapi==0.115.0\n", "utf8");
    return Object.freeze({
      success: true,
      operation: "installed",
      recoveredFromPartial: false,
      issues: Object.freeze([]),
      installed: this.createInstalled(request.source.requestedRevision ?? "master"),
    });
  }

  public async update(_request: RuntimeRepositoryUpdateRequest): Promise<RuntimeRepositoryUpdateResult> {
    this.state = RuntimeRepositoryInstallationStates.installed;
    return Object.freeze({
      success: true,
      operation: "already-current",
      updated: false,
      issues: Object.freeze([]),
      installed: this.createInstalled("master"),
    });
  }

  public async inspectStatus(_request: RuntimeRepositoryStatusRequest): Promise<RuntimeRepositoryStatusResult> {
    return Object.freeze({
      state: this.state,
      installLocation: this.installLocation,
      issues: Object.freeze([]),
      installed: this.state === RuntimeRepositoryInstallationStates.installed
        ? this.createInstalled("master")
        : undefined,
    });
  }

  public async validate(_request: RuntimeRepositoryValidationRequest): Promise<RuntimeRepositoryValidationResult> {
    return Object.freeze({
      valid: this.state === RuntimeRepositoryInstallationStates.installed,
      status: await this.inspectStatus(this.createStatusRequest()),
      issues: Object.freeze([]),
    });
  }

  public async collectDiagnostics(_request: RuntimeRepositoryDiagnosticsRequest): Promise<RuntimeRepositoryDiagnosticsResult> {
    return Object.freeze({
      status: await this.inspectStatus(this.createStatusRequest()),
      commandDiagnostics: Object.freeze([]),
      issues: Object.freeze([]),
    });
  }

  private createInstalled(requestedRevision: string) {
    return Object.freeze({
      runtimeDependencyId: "runtime:comfyui",
      installerKind: "git",
      source: Object.freeze({
        repositoryKind: "git",
        repositoryUri: "https://github.com/comfyanonymous/ComfyUI.git",
        requestedRevision,
        metadata: Object.freeze({}),
      }),
      installLocation: this.installLocation,
      resolvedRevision: "abc123",
      installedAt: "2026-04-03T00:00:00.000Z",
      updatedAt: "2026-04-03T00:00:00.000Z",
      metadata: Object.freeze({}),
    });
  }

  private createStatusRequest(): RuntimeRepositoryStatusRequest {
    return Object.freeze({
      runtimeDependencyId: "runtime:comfyui",
      installerKind: "git",
      source: Object.freeze({
        repositoryKind: "git",
        repositoryUri: "https://github.com/comfyanonymous/ComfyUI.git",
        metadata: Object.freeze({}),
      }),
      targetRootDirectory: this.targetRootDirectory,
    });
  }
}

class HappyPathPythonRunner {
  public async run(command: string, args: ReadonlyArray<string>) {
    if (args[0] === "-c" && String(args[1]).includes("platform.python_version")) {
      return {
        command,
        args,
        exitCode: 0,
        stdout: JSON.stringify({
          version: "3.12.7",
          executable: "/usr/bin/python3.12",
        }),
        stderr: "",
      };
    }
    if (args[0] === "-m" && args[1] === "venv") {
      const target = args[2]!;
      const pythonPath = process.platform === "win32"
        ? path.join(target, "Scripts", "python.exe")
        : path.join(target, "bin", "python");
      mkdirSync(path.dirname(pythonPath), { recursive: true });
      writeFileSync(pythonPath, "python", "utf8");
      return { command, args, exitCode: 0, stdout: "", stderr: "" };
    }
    return { command, args, exitCode: 0, stdout: "", stderr: "" };
  }
}
