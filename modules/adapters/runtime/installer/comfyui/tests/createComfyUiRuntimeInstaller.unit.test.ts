import { describe, expect, it, testDouble } from "../../../../../testing/node-test";

import { buildComfyUiInstallRequest, createComfyUiRuntimeInstaller } from "../createComfyUiRuntimeInstaller";

const baseRequest = {
  targetId: "custom-target",
  installRoot: "/runtime/comfy",
  source: { type: "git" as const, repositoryUrl: "https://example.com/ignored.git", ref: "v1.0.0" },
};

describe("createComfyUiRuntimeInstaller", () => {
  it("builds default install request correctly", () => {
    const request = buildComfyUiInstallRequest({ installRoot: "/tmp/comfy" });
    expect(request.targetId).toBe("comfyui");
    expect(request.source.repositoryUrl).toBe("https://github.com/Comfy-Org/ComfyUI");
    expect(request.installRoot).toBe("/tmp/comfy");
  });

  it("delegates to git installer", async () => {
    const gitInstaller = {
      ensureInstalled: testDouble.fn(async (request) => ({ ...request, status: "installed" as const })),
      getInstallStatus: testDouble.fn(),
      repairInstall: testDouble.fn(),
    };
    const stat = testDouble.fn(async () => ({}));
    const installer = createComfyUiRuntimeInstaller({ gitInstaller, skipPythonSetup: true, stat: stat as never });
    await installer.ensureInstalled(baseRequest);
    expect(gitInstaller.ensureInstalled).toHaveBeenCalled();
  });

  it("skips python setup when disabled", async () => {
    const gitInstaller = {
      ensureInstalled: testDouble.fn(async (request) => ({ ...request, status: "installed" as const, warnings: [] })),
      getInstallStatus: testDouble.fn(),
    };
    const execFile = testDouble.fn();
    const stat = testDouble.fn(async () => ({}));
    const installer = createComfyUiRuntimeInstaller({ gitInstaller, skipPythonSetup: true, execFile, stat: stat as never });
    await installer.ensureInstalled(baseRequest);
    expect(execFile).toHaveBeenCalledWith("python", ["/runtime/comfy/main.py", "--help"]);
    expect(execFile).toHaveBeenCalledTimes(1);
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
    expect(execFile).toHaveBeenCalledWith("python", ["-m", "pip", "install", "-r", "/runtime/comfy/requirements.txt"]);
  });

  it("skips python install when file missing", async () => {
    const gitInstaller = {
      ensureInstalled: testDouble.fn(async (request) => ({ ...request, status: "installed" as const, warnings: [] })),
      getInstallStatus: testDouble.fn(),
    };
    const execFile = testDouble.fn(async () => ({ stdout: "", stderr: "" }));
    const stat = testDouble.fn(async (targetPath: string) => {
      if (targetPath.endsWith("main.py")) return {};
      throw new Error("missing");
    });
    const installer = createComfyUiRuntimeInstaller({ gitInstaller, execFile, stat: stat as never });
    const result = await installer.ensureInstalled(baseRequest);
    expect(result.status).toBe("installed");
    expect(result.warnings?.some((w) => w.includes("requirements.txt not found"))).toBe(true);
  });

  it("python install failure maps to correct error code", async () => {
    const gitInstaller = {
      ensureInstalled: testDouble.fn(async (request) => ({ ...request, status: "installed" as const, warnings: [] })),
      getInstallStatus: testDouble.fn(),
    };
    const execFile = testDouble.fn(async (_file: string, args: readonly string[] = []) => {
      if (args.includes("pip")) throw { stdout: "o", stderr: "e" };
      return { stdout: "", stderr: "" };
    });
    const stat = testDouble.fn(async () => ({}));
    const installer = createComfyUiRuntimeInstaller({ gitInstaller, execFile, stat: stat as never });
    const result = await installer.ensureInstalled(baseRequest);
    expect(result.status).toBe("failed");
    expect(result.error?.code).toBe("python-dependency-install-failed");
  });

  it("validation failure maps correctly", async () => {
    const gitInstaller = {
      ensureInstalled: testDouble.fn(async (request) => ({ ...request, status: "installed" as const, warnings: [] })),
      getInstallStatus: testDouble.fn(),
    };
    const stat = testDouble.fn(async () => {
      throw new Error("missing");
    });
    const installer = createComfyUiRuntimeInstaller({ gitInstaller, stat: stat as never });
    const result = await installer.ensureInstalled(baseRequest);
    expect(result.status).toBe("failed");
    expect(result.error?.code).toBe("comfyui-missing-entrypoint");
  });

  it("getInstallStatus delegates to git installer", async () => {
    const gitInstaller = {
      ensureInstalled: testDouble.fn(),
      getInstallStatus: testDouble.fn(async () => ({ status: "installed", targetId: "comfyui", source: baseRequest.source, installRoot: baseRequest.installRoot })),
    };
    const installer = createComfyUiRuntimeInstaller({ gitInstaller, skipPythonSetup: true });
    await installer.getInstallStatus(baseRequest);
    expect(gitInstaller.getInstallStatus).toHaveBeenCalled();
  });

  it("repairInstall delegates correctly", async () => {
    const gitInstaller = {
      ensureInstalled: testDouble.fn(),
      getInstallStatus: testDouble.fn(),
      repairInstall: testDouble.fn(async (request) => ({ ...request, status: "installed" as const })),
    };
    const installer = createComfyUiRuntimeInstaller({ gitInstaller, skipPythonSetup: true });
    await installer.repairInstall?.(baseRequest);
    expect(gitInstaller.repairInstall).toHaveBeenCalled();
  });

  it("does not hardcode installRoot", async () => {
    const gitInstaller = {
      ensureInstalled: testDouble.fn(async (request) => ({ ...request, status: "installed" as const, warnings: [] })),
      getInstallStatus: testDouble.fn(),
    };
    const stat = testDouble.fn(async () => ({}));
    const installer = createComfyUiRuntimeInstaller({ gitInstaller, skipPythonSetup: true, stat: stat as never });
    await installer.ensureInstalled({ ...baseRequest, installRoot: "/custom/path" });
    expect(gitInstaller.ensureInstalled).toHaveBeenCalledWith(expect.objectContaining({ installRoot: "/custom/path" }));
  });
});
