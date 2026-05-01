import path from "node:path";

import { describe, expect, it, testDouble } from "../../../../../testing/node-test";

import {
  buildComfyUiManagedPythonEnvironmentRoot,
  buildComfyUiManagedPythonExecutablePath,
} from "../../../comfyui/comfyUiPythonEnvironment";
import { buildComfyUiInstallRequest, createComfyUiRuntimeInstaller } from "../createComfyUiRuntimeInstaller";

const baseRequest = {
  targetId: "custom-target",
  installRoot: "/runtime/comfy",
  source: { type: "git" as const, repositoryUrl: "https://example.com/ignored.git", ref: "v1.0.0" },
};
const requirementsPath = path.join(baseRequest.installRoot, "requirements.txt");
const entrypointPath = path.join(baseRequest.installRoot, "main.py");
const managedPythonPath = buildComfyUiManagedPythonExecutablePath({ installRoot: baseRequest.installRoot });
const managedPythonEnvironmentRoot = buildComfyUiManagedPythonEnvironmentRoot(baseRequest.installRoot);

describe("createComfyUiRuntimeInstaller", () => {
  it("builds default install request correctly", () => {
    const request = buildComfyUiInstallRequest({ installRoot: "/tmp/comfy" });
    expect(request.targetId).toBe("comfyui");
    expect(request.source.repositoryUrl).toBe("https://github.com/Comfy-Org/ComfyUI");
    expect(request.installRoot).toBe("/tmp/comfy");
  });

  it("preserves git ref override", () => {
    const request = buildComfyUiInstallRequest({ installRoot: "/tmp/comfy", source: baseRequest.source });
    expect(request.source.ref).toBe("v1.0.0");
  });

  it("ignores non-git source-like values", () => {
    const request = buildComfyUiInstallRequest({
      installRoot: "/tmp/comfy",
      source: { type: "archive", ref: "nope" } as never,
    });
    expect(request.source.ref).toBeUndefined();
  });

  it("delegates to git installer", async () => {
    const gitInstaller = {
      ensureInstalled: testDouble.fn(async (request) => ({ ...request, status: "installed" as const })),
      getInstallStatus: testDouble.fn(),
      repairInstall: testDouble.fn(),
    };
    const stat = testDouble.fn(async () => ({}));
    const installer = createComfyUiRuntimeInstaller({ gitInstaller, skipPythonSetup: true, skipPythonValidation: true, stat: stat as never });
    await installer.ensureInstalled(baseRequest);
    expect(gitInstaller.ensureInstalled).toHaveBeenCalled();
  });

  it("emits shared structured runtime install log events", async () => {
    const gitInstaller = {
      ensureInstalled: testDouble.fn(async (request) => ({ ...request, status: "installed" as const, warnings: [] })),
      getInstallStatus: testDouble.fn(),
    };
    const log = testDouble.fn();
    const installer = createComfyUiRuntimeInstaller({
      gitInstaller,
      skipPythonSetup: true,
      skipPythonValidation: true,
      logging: { log },
    });

    await installer.ensureInstalled(baseRequest);

    expect(log).toHaveBeenCalled();
    const event = log.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(event).toMatchObject({
      level: "info",
      verbosity: "normal",
      event: "runtime.comfyui.installer.activity",
      component: "comfyui-runtime-installer",
      subsystem: "runtime",
      data: {
        installRoot: "/runtime/comfy",
        targetId: "custom-target",
      },
    });
    expect(event.context).toBeUndefined();
  });

  it("skipPythonSetup does not run pip install but still validates", async () => {
    const gitInstaller = {
      ensureInstalled: testDouble.fn(async (request) => ({ ...request, status: "installed" as const, warnings: [] })),
      getInstallStatus: testDouble.fn(),
    };
    const execFile = testDouble.fn(async () => ({ stdout: "", stderr: "" }));
    const stat = testDouble.fn(async () => ({}));
    const installer = createComfyUiRuntimeInstaller({ gitInstaller, skipPythonSetup: true, execFile, stat: stat as never });
    await installer.ensureInstalled(baseRequest);
    expect(execFile).toHaveBeenCalledWith(managedPythonPath, [entrypointPath, "--help"]);
    expect(execFile).toHaveBeenCalledTimes(1);
  });

  it("skipPythonValidation avoids running python help command", async () => {
    const gitInstaller = {
      ensureInstalled: testDouble.fn(async (request) => ({ ...request, status: "installed" as const, warnings: [] })),
      getInstallStatus: testDouble.fn(),
    };
    const execFile = testDouble.fn(async () => ({ stdout: "", stderr: "" }));
    const stat = testDouble.fn(async () => ({}));
    const installer = createComfyUiRuntimeInstaller({ gitInstaller, skipPythonSetup: false, skipPythonValidation: true, execFile, stat: stat as never });
    await installer.ensureInstalled(baseRequest);
    expect(execFile).toHaveBeenCalledTimes(1);
    expect(execFile).toHaveBeenCalledWith(managedPythonPath, ["-m", "pip", "install", "-r", requirementsPath]);
  });

  it("skip setup and validation makes no execFile calls", async () => {
    const gitInstaller = {
      ensureInstalled: testDouble.fn(async (request) => ({ ...request, status: "installed" as const, warnings: [] })),
      getInstallStatus: testDouble.fn(),
    };
    const execFile = testDouble.fn(async () => ({ stdout: "", stderr: "" }));
    const stat = testDouble.fn(async () => ({}));
    const installer = createComfyUiRuntimeInstaller({ gitInstaller, skipPythonSetup: true, skipPythonValidation: true, execFile, stat: stat as never });
    await installer.ensureInstalled(baseRequest);
    expect(execFile).not.toHaveBeenCalled();
  });

  it("installs python dependencies when requirements.txt exists", async () => {
    const gitInstaller = {
      ensureInstalled: testDouble.fn(async (request) => ({ ...request, status: "installed" as const, warnings: [] })),
      getInstallStatus: testDouble.fn(),
    };
    const execFile = testDouble.fn(async () => ({ stdout: "", stderr: "" }));
    const stat = testDouble.fn(async () => ({}));
    const installer = createComfyUiRuntimeInstaller({ gitInstaller, execFile, stat: stat as never });
    await installer.ensureInstalled(baseRequest);
    expect(execFile).toHaveBeenCalledWith(managedPythonPath, ["-m", "pip", "install", "-r", requirementsPath]);
  });

  it("creates a managed Python environment before installing ComfyUI dependencies when one is missing", async () => {
    const gitInstaller = {
      ensureInstalled: testDouble.fn(async (request) => ({ ...request, status: "installed" as const, warnings: [] })),
      getInstallStatus: testDouble.fn(),
    };
    const execFile = testDouble.fn(async () => ({ stdout: "", stderr: "" }));
    const stat = testDouble.fn(async (targetPath: string) => {
      if (targetPath === managedPythonPath) {
        throw new Error("missing");
      }
      return {};
    });
    const installer = createComfyUiRuntimeInstaller({ gitInstaller, execFile, stat: stat as never });

    await installer.ensureInstalled(baseRequest);

    expect(execFile).toHaveBeenCalledWith("python", ["-m", "venv", managedPythonEnvironmentRoot]);
    expect(execFile).toHaveBeenCalledWith(managedPythonPath, ["-m", "pip", "install", "-r", requirementsPath]);
  });

  it("installs torch-directml when DirectML runtime mode is selected", async () => {
    const gitInstaller = {
      ensureInstalled: testDouble.fn(async (request) => ({ ...request, status: "installed" as const, warnings: [] })),
      getInstallStatus: testDouble.fn(),
    };
    const execFile = testDouble.fn(async () => ({ stdout: "", stderr: "" }));
    const stat = testDouble.fn(async () => ({}));
    const installer = createComfyUiRuntimeInstaller({ gitInstaller, execFile, stat: stat as never, runtimeDeviceMode: "directml" });

    await installer.ensureInstalled(baseRequest);

    expect(execFile).toHaveBeenCalledWith(managedPythonPath, ["-m", "pip", "install", "-r", requirementsPath]);
    expect(execFile).toHaveBeenCalledWith(managedPythonPath, ["-m", "pip", "install", "torch-directml"]);
    expect(execFile).toHaveBeenCalledWith(managedPythonPath, [entrypointPath, "--help"]);
  });

  it("skips dependency and validation commands on later starts when finalization metadata still matches", async () => {
    const gitInstaller = {
      ensureInstalled: testDouble.fn(async (request) => ({ ...request, status: "installed" as const, warnings: [], commitSha: "abc123" })),
      getInstallStatus: testDouble.fn(),
    };
    let finalizationMetadata = "";
    const execFile = testDouble.fn(async () => ({ stdout: "", stderr: "" }));
    const stat = testDouble.fn(async (targetPath: string) => {
      if (String(targetPath).endsWith(".ai-system-builder-comfyui-finalization.json") && !finalizationMetadata) {
        throw new Error("missing metadata");
      }
      return {};
    });
    const readFile = testDouble.fn(async () => finalizationMetadata);
    const writeFile = testDouble.fn(async (_targetPath: string, content: string) => {
      finalizationMetadata = content;
    });
    const log = testDouble.fn();
    const installer = createComfyUiRuntimeInstaller({
      gitInstaller,
      execFile,
      stat: stat as never,
      readFile: readFile as never,
      writeFile: writeFile as never,
      runtimeDeviceMode: "directml",
      logging: { log },
    });

    await installer.ensureInstalled(baseRequest);
    expect(execFile).toHaveBeenCalledWith(managedPythonPath, ["-m", "pip", "install", "-r", requirementsPath]);
    expect(execFile).toHaveBeenCalledWith(managedPythonPath, ["-m", "pip", "install", "torch-directml"]);
    expect(execFile).toHaveBeenCalledWith(managedPythonPath, [entrypointPath, "--help"]);

    execFile.mockClear();
    await installer.ensureInstalled(baseRequest);

    expect(execFile).not.toHaveBeenCalled();
    const messages = log.mock.calls.map((call) => (call[0] as { message: string }).message);
    expect(messages).toContain("ComfyUI install finalization already completed; skipping dependency and validation commands.");
  });

  it("does not install torch-directml for automatic CUDA-capable ComfyUI startup", async () => {
    const gitInstaller = {
      ensureInstalled: testDouble.fn(async (request) => ({ ...request, status: "installed" as const, warnings: [] })),
      getInstallStatus: testDouble.fn(),
    };
    const execFile = testDouble.fn(async () => ({ stdout: "", stderr: "" }));
    const stat = testDouble.fn(async () => ({}));
    const installer = createComfyUiRuntimeInstaller({ gitInstaller, execFile, stat: stat as never, runtimeDeviceMode: "auto" });

    await installer.ensureInstalled(baseRequest);

    expect(execFile).not.toHaveBeenCalledWith(managedPythonPath, ["-m", "pip", "install", "torch-directml"]);
  });

  it("repair runs post-install validation/dependency setup", async () => {
    const gitInstaller = {
      ensureInstalled: testDouble.fn(),
      getInstallStatus: testDouble.fn(async (request) => ({ ...request, status: "installed" as const })),
      repairInstall: testDouble.fn(async (request) => ({ ...request, status: "installed" as const, warnings: [] })),
    };
    const execFile = testDouble.fn(async () => ({ stdout: "", stderr: "" }));
    const stat = testDouble.fn(async () => ({}));
    const installer = createComfyUiRuntimeInstaller({ gitInstaller, execFile, stat: stat as never });
    await installer.repairInstall?.(baseRequest);
    expect(execFile).toHaveBeenCalledWith(managedPythonPath, ["-m", "pip", "install", "-r", requirementsPath]);
    expect(execFile).toHaveBeenCalledWith(managedPythonPath, [entrypointPath, "--help"]);
  });

  it("repair performs initial install when ComfyUI is not installed", async () => {
    const gitInstaller = {
      ensureInstalled: testDouble.fn(async (request) => ({ ...request, status: "installed" as const, warnings: [] })),
      getInstallStatus: testDouble.fn(async (request) => ({ ...request, status: "not-installed" as const })),
      repairInstall: testDouble.fn(),
    };
    const stat = testDouble.fn(async () => ({}));
    const installer = createComfyUiRuntimeInstaller({
      gitInstaller,
      skipPythonSetup: true,
      skipPythonValidation: true,
      stat: stat as never,
    });

    const result = await installer.repairInstall?.(baseRequest);

    expect(result?.status).toBe("installed");
    expect(gitInstaller.getInstallStatus).toHaveBeenCalled();
    expect(gitInstaller.ensureInstalled).toHaveBeenCalledWith({
      installRoot: baseRequest.installRoot,
      targetId: "comfyui",
      allowUpdate: true,
    });
    expect(gitInstaller.repairInstall).not.toHaveBeenCalled();
  });

  it("repair failure maps dependency errors", async () => {
    const gitInstaller = {
      ensureInstalled: testDouble.fn(),
      getInstallStatus: testDouble.fn(async (request) => ({ ...request, status: "installed" as const })),
      repairInstall: testDouble.fn(async (request) => ({ ...request, status: "installed" as const, warnings: [] })),
    };
    const execFile = testDouble.fn(async (_file: string, args: readonly string[] = []) => {
      if (args.includes("pip")) throw { stdout: "o", stderr: "e" };
      return { stdout: "", stderr: "" };
    });
    const stat = testDouble.fn(async () => ({}));
    const installer = createComfyUiRuntimeInstaller({ gitInstaller, execFile, stat: stat as never });
    const result = await installer.repairInstall?.(baseRequest);
    expect(result?.status).toBe("failed");
    expect(result?.error?.code).toBe("python-dependency-install-failed");
  });

  it("repair emits status and final outcome logs for diagnosis", async () => {
    const gitInstaller = {
      ensureInstalled: testDouble.fn(async (request) => ({ ...request, status: "installed" as const, warnings: [] })),
      getInstallStatus: testDouble.fn(async (request) => ({ ...request, status: "not-installed" as const })),
      repairInstall: testDouble.fn(),
    };
    const log = testDouble.fn();
    const stat = testDouble.fn(async () => ({}));
    const installer = createComfyUiRuntimeInstaller({
      gitInstaller,
      skipPythonSetup: true,
      skipPythonValidation: true,
      stat: stat as never,
      logging: { log },
    });

    await installer.repairInstall?.(baseRequest);

    const messages = log.mock.calls.map((call) => (call[0] as { message: string }).message);
    expect(messages).toContain("Read ComfyUI install status before repair.");
    expect(messages).toContain("ComfyUI install is missing; repair will perform initial install.");
    expect(messages).toContain("ComfyUI repair install finished.");
  });

  it("missing installRoot fails before delegating", async () => {
    const gitInstaller = {
      ensureInstalled: testDouble.fn(),
      getInstallStatus: testDouble.fn(),
    };
    const installer = createComfyUiRuntimeInstaller({ gitInstaller, skipPythonSetup: true, skipPythonValidation: true });
    const result = await installer.ensureInstalled({ ...baseRequest, installRoot: "" });
    expect(result.status).toBe("failed");
    expect(result.error?.code).toBe("missing-install-root");
    expect(gitInstaller.ensureInstalled).not.toHaveBeenCalled();
  });
});
