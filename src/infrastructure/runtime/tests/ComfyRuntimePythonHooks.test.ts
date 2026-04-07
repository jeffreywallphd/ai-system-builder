import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ComfyRuntimeInstallationAsset } from "@application/runtime/ComfyRuntimeInstallationAsset";
import { ComfyRuntimeWorkflowProfiles } from "@application/runtime/ComfyRuntimeRequirements";
import type { ComfyRuntimeOrchestrationContext } from "@application/runtime/ComfyRuntimeInstallerOrchestrationService";
import {
  ComfyRuntimePythonHooks,
  type PythonCommandRunner,
} from "../ComfyRuntimePythonHooks";

class FakePythonRunner implements PythonCommandRunner {
  public readonly commands: Array<{ command: string; args: string[]; cwd?: string }> = [];
  public failPipInstallCount = 0;
  public pipImportFailureCount = 0;
  public detectedVersion = "3.12.7";
  public detectedExecutable = "/usr/bin/python3.12";

  public async run(command: string, args: ReadonlyArray<string>, options: { readonly cwd?: string } = {}) {
    this.commands.push({ command, args: [...args], cwd: options.cwd });

    if (args.includes(PYTHON_PROBE_SNIPPET)) {
      return {
        command,
        args,
        exitCode: 0,
        stdout: JSON.stringify({
          version: this.detectedVersion,
          executable: this.detectedExecutable,
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

    if (args[0] === "-c" && args[1] === "import pip; import pip._internal.cli.main") {
      if (this.pipImportFailureCount > 0) {
        this.pipImportFailureCount -= 1;
        return { command, args, exitCode: 1, stdout: "", stderr: "pip import failed" };
      }
      return { command, args, exitCode: 0, stdout: "", stderr: "" };
    }

    if (args[0] === "-m" && args[1] === "pip" && args[2] === "--version") {
      return { command, args, exitCode: 0, stdout: "pip 25.0", stderr: "" };
    }

    if (args[0] === "-m" && args[1] === "ensurepip") {
      return { command, args, exitCode: 0, stdout: "", stderr: "" };
    }

    if (args[0] === "-m" && args[1] === "pip" && args[2] === "install") {
      if (this.failPipInstallCount > 0) {
        this.failPipInstallCount -= 1;
        return { command, args, exitCode: 1, stdout: "", stderr: "dependency conflict" };
      }
      return { command, args, exitCode: 0, stdout: "installed", stderr: "" };
    }

    return { command, args, exitCode: 0, stdout: "", stderr: "" };
  }
}

const tempDirectories: string[] = [];
let tempRoot = "";

beforeEach(() => {
  tempRoot = mkdtempSync(path.join(os.tmpdir(), "comfy-python-hooks-"));
  tempDirectories.push(tempRoot);
});

afterEach(() => {
  while (tempDirectories.length > 0) {
    const directory = tempDirectories.pop();
    if (directory) {
      rmSync(directory, { recursive: true, force: true });
    }
  }
});

describe("ComfyRuntimePythonHooks", () => {
  it("fails environment preparation when detected Python is incompatible", async () => {
    const runner = new FakePythonRunner();
    runner.detectedVersion = "3.9.12";
    const hooks = new ComfyRuntimePythonHooks({ commandRunner: runner });

    const result = await hooks.prepare(createContext(tempRoot));

    expect(result.status).toBe("failed");
    expect(result.issues.some((entry) => entry.code === "python-runtime-version-incompatible")).toBeTrue();
  });

  it("creates the virtual environment when missing and records metadata", async () => {
    const runner = new FakePythonRunner();
    const hooks = new ComfyRuntimePythonHooks({ commandRunner: runner, now: () => new Date("2026-04-03T00:00:00.000Z") });

    const result = await hooks.prepare(createContext(tempRoot));
    const provisioning = (result.metadata?.environmentProvisioning ?? undefined) as { readonly status: string } | undefined;

    expect(result.status).toBe("completed");
    expect(readEnvironmentMetadata(tempRoot).status).toBe("created");
    expect(provisioning?.status).toBe("created");
    expect(runner.commands.some((entry) => entry.args[1] === "venv")).toBeTrue();
  });

  it("reuses a healthy existing environment without recreating it", async () => {
    const runner = new FakePythonRunner();
    const hooks = new ComfyRuntimePythonHooks({ commandRunner: runner, now: () => new Date("2026-04-03T00:00:00.000Z") });
    const context = createContext(tempRoot);
    createExistingEnvironment(context.installDirectory);

    const result = await hooks.prepare(context);
    const provisioning = (result.metadata?.environmentProvisioning ?? undefined) as { readonly status: string } | undefined;

    expect(result.status).toBe("completed");
    expect(provisioning?.status).toBe("reused");
    expect(runner.commands.some((entry) => entry.args[1] === "venv")).toBeFalse();
  });

  it("recovers partial environments by recreating deterministically", async () => {
    const runner = new FakePythonRunner();
    const hooks = new ComfyRuntimePythonHooks({ commandRunner: runner });
    const context = createContext(tempRoot);
    const envDir = path.join(context.installDirectory, ".venv");
    mkdirSync(envDir, { recursive: true });
    writeFileSync(path.join(envDir, "PARTIAL"), "partial", "utf8");

    const result = await hooks.prepare(context);
    const provisioning = (result.metadata?.environmentProvisioning ?? undefined) as { readonly status: string } | undefined;

    expect(result.status).toBe("completed");
    expect(provisioning?.status).toBe("recreated");
    expect(existsSync(path.join(envDir, "PARTIAL"))).toBeFalse();
  });

  it("fails dependency installation when requirements file is missing", async () => {
    const runner = new FakePythonRunner();
    const hooks = new ComfyRuntimePythonHooks({ commandRunner: runner });
    const context = createContext(tempRoot);
    createExistingEnvironment(context.installDirectory);

    const result = await hooks.installDependencies(context);

    expect(result.status).toBe("failed");
    expect(result.issues.some((entry) => entry.code === "dependency-requirements-missing")).toBeTrue();
    expect(readDependencyState(context.installDirectory).status).toBe("failed");
  });

  it("supports idempotent dependency reruns after a failed attempt", async () => {
    const runner = new FakePythonRunner();
    runner.failPipInstallCount = 1;
    const hooks = new ComfyRuntimePythonHooks({ commandRunner: runner, now: () => new Date("2026-04-03T00:00:00.000Z") });
    const context = createContext(tempRoot);
    createExistingEnvironment(context.installDirectory);
    writeFileSync(path.join(context.runtimeWorkingDirectory, "requirements.txt"), "fastapi==0.115.0\n", "utf8");

    const first = await hooks.installDependencies(context);
    const second = await hooks.installDependencies(context);

    expect(first.status).toBe("failed");
    expect(second.status).toBe("completed");
    expect(second.issues.some((entry) => entry.code === "dependency-install-partial-state-detected")).toBeTrue();
    expect(readDependencyState(context.installDirectory).status).toBe("completed");
  });
});

function createContext(root: string): ComfyRuntimeOrchestrationContext {
  const installDirectory = path.join(root, "comfy-runtime");
  mkdirSync(installDirectory, { recursive: true });
  return Object.freeze({
    runtimeAsset: ComfyRuntimeInstallationAsset,
    installDirectory,
    runtimeWorkingDirectory: installDirectory,
    runtimeEndpoint: "http://127.0.0.1:8188",
    runtimeHost: "127.0.0.1",
    runtimePort: 8188,
    runtimeEnvironment: Object.freeze({}),
    runtimeStartupTimeoutMs: 120000,
    workflowProfile: ComfyRuntimeWorkflowProfiles.imageManipulationDefault,
  });
}

function createExistingEnvironment(installDirectory: string): void {
  const pythonPath = process.platform === "win32"
    ? path.join(installDirectory, ".venv", "Scripts", "python.exe")
    : path.join(installDirectory, ".venv", "bin", "python");
  mkdirSync(path.dirname(pythonPath), { recursive: true });
  writeFileSync(pythonPath, "python", "utf8");
}

function readEnvironmentMetadata(root: string): { readonly status: string } {
  const metadataPath = process.platform === "win32"
    ? path.join(root, "comfy-runtime", ".venv", ".ai-loom-comfy-python-environment.json")
    : path.join(root, "comfy-runtime", ".venv", ".ai-loom-comfy-python-environment.json");
  return JSON.parse(readFileSync(metadataPath, "utf8")) as { readonly status: string };
}

function readDependencyState(installDirectory: string): { readonly status: string } {
  return JSON.parse(readFileSync(path.join(installDirectory, ".ai-loom-comfy-python-dependencies.json"), "utf8")) as { readonly status: string };
}

const PYTHON_PROBE_SNIPPET = "import json;import platform;import sys;print(json.dumps({'version': platform.python_version(), 'executable': sys.executable}))";

