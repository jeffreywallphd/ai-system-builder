import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ComfyRuntimeInstallationAsset } from "@application/runtime/ComfyRuntimeInstallationAsset";
import { ComfyRuntimeWorkflowProfiles } from "@application/runtime/ComfyRuntimeRequirements";
import type { ComfyRuntimeOrchestrationContext } from "@application/runtime/ComfyRuntimeInstallerOrchestrationService";
import { ComfyRuntimeLifecycleHooks } from "../ComfyRuntimeLifecycleHooks";

describe("ComfyRuntimeLifecycleHooks", () => {
  it("reports already-running runtime when health endpoints are healthy", async () => {
    const context = createContext();
    const hook = new ComfyRuntimeLifecycleHooks({
      fetcher: async () => ({ status: 200 }),
      processLauncher: () => ({ pid: 123, kill: () => true }),
    });

    const result = await hook.start(context);

    expect(result.state).toBe("healthy");
    expect(result.process.alreadyRunning).toBeTrue();
    cleanupContext(context);
  });

  it("returns timed-out state when runtime does not become healthy", async () => {
    const context = createContext();
    const hook = new ComfyRuntimeLifecycleHooks({
      fetcher: async () => ({ status: 503 }),
      processLauncher: () => ({ pid: 345, kill: () => true }),
      healthTimeoutMs: 200,
      sleep: async () => {},
    });

    const result = await hook.start(context);

    expect(result.state).toBe("timed-out");
    expect(result.diagnostics.some((entry) => entry.code === "runtime-start-timeout")).toBeTrue();
    cleanupContext(context);
  });

  it("supports restart with stop and start semantics", async () => {
    const context = createContext();
    const hook = new ComfyRuntimeLifecycleHooks({
      fetcher: async () => ({ status: 200 }),
      processLauncher: () => {
        return { pid: 456, kill: () => true };
      },
    });

    const result = await hook.restart(context);

    expect(result.operation).toBe("restart");
    expect(result.state).toBe("healthy");
    cleanupContext(context);
  });
});

function createContext(): ComfyRuntimeOrchestrationContext {
  const root = mkdtempSync(path.join(os.tmpdir(), "comfy-runtime-lifecycle-"));
  const installDirectory = path.join(root, "runtime-comfy");
  mkdirSync(path.join(installDirectory, ".venv", process.platform === "win32" ? "Scripts" : "bin"), { recursive: true });
  writeFileSync(
    path.join(installDirectory, ".venv", process.platform === "win32" ? "Scripts" : "bin", process.platform === "win32" ? "python.exe" : "python"),
    "python",
    "utf8",
  );
  return Object.freeze({
    runtimeAsset: ComfyRuntimeInstallationAsset,
    installDirectory,
    runtimeWorkingDirectory: installDirectory,
    runtimeEndpoint: "http://127.0.0.1:8188",
    runtimeHost: "127.0.0.1",
    runtimePort: 8188,
    runtimeEnvironment: Object.freeze({}),
    runtimeStartupTimeoutMs: 200,
    workflowProfile: ComfyRuntimeWorkflowProfiles.imageManipulationDefault,
  });
}

function cleanupContext(context: ComfyRuntimeOrchestrationContext): void {
  rmSync(path.dirname(context.installDirectory), { recursive: true, force: true });
}

