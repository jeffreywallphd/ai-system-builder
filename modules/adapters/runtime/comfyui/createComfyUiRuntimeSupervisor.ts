import { spawn, type ChildProcess } from "node:child_process";

import type { RuntimeInstallerPort } from "../../../application/ports/runtime-installer/runtime-installer.port";
import type { LoggingPort } from "../../../application/ports/logging";
import { DEFAULT_COMFYUI_REPOSITORY_URL } from "../installer/comfyui/createComfyUiRuntimeInstaller";
import { createComfyUiHttpClient, type ComfyUiHttpClient } from "./createComfyUiHttpClient";
import type { ComfyUiRuntimeHealth } from "./comfyUiRuntimeHealth";


export interface CreateComfyUiRuntimeSupervisorOptions {
  workingDirectory: string;
  pythonExecutable?: string;
  port?: number;
  host?: string;
  startupTimeoutMs?: number;
  healthCheckIntervalMs?: number;
  fetchImplementation?: typeof fetch;
  spawnImplementation?: typeof spawn;
  installer?: RuntimeInstallerPort;
  installRoot?: string;
  installSourceRef?: string;
  autoInstall?: boolean;
  logging?: LoggingPort;
}

export interface ComfyUiRuntimeSupervisor {
  start(): Promise<void>;
  isRunning(): boolean;
  getHealth(): Promise<ComfyUiRuntimeHealth>;
  stop(): Promise<void>;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function createComfyUiRuntimeSupervisor(options: CreateComfyUiRuntimeSupervisorOptions): ComfyUiRuntimeSupervisor {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 8188;
  const url = `http://${host}:${port}`;
  const startupTimeoutMs = options.startupTimeoutMs ?? 120_000;
  const healthCheckIntervalMs = options.healthCheckIntervalMs ?? 1_000;
  const spawnImplementation = options.spawnImplementation ?? spawn;
  const pythonExecutable = options.pythonExecutable ?? "python";
  const client: Pick<ComfyUiHttpClient, "getSystemStats"> = createComfyUiHttpClient({ baseUrl: url, fetchImplementation: options.fetchImplementation });

  let processHandle: ChildProcess | undefined;
  let status: ComfyUiRuntimeHealth["status"] = "stopped";
  let lastCheckAt = Date.now();

  const log = (level: "debug" | "info" | "error", message: string, details?: Record<string, unknown>) => {
    void options.logging?.log({
      level,
      message,
      timestamp: new Date().toISOString(),
      verbosity: "normal",
      event: "runtime.comfyui.supervisor.activity",
      component: "comfyui-runtime-supervisor",
      subsystem: "runtime",
      data: details,
    });
  };

  return {
    async start() {
      if (processHandle && status !== "stopped") {
        return;
      }

      let spawnWorkingDirectory = options.workingDirectory;

      if (options.autoInstall === true) {
        log("info", "Ensuring ComfyUI runtime install before start.", { installRoot: options.installRoot });
        if (!options.installRoot?.trim()) {
          throw new Error("ComfyUI install failed: installRoot is required when autoInstall is enabled");
        }
        if (!options.installer) {
          throw new Error("ComfyUI install failed: installer is required when autoInstall is enabled");
        }

        const installResult = await options.installer.ensureInstalled({
          targetId: "comfyui",
          installRoot: options.installRoot,
          source: {
            type: "git",
            repositoryUrl: DEFAULT_COMFYUI_REPOSITORY_URL,
            ref: options.installSourceRef,
          },
        });

        if (installResult.status !== "installed") {
          log("error", "ComfyUI auto-install failed.", { installRoot: options.installRoot, error: installResult.error });
          throw new Error(`ComfyUI install failed: ${installResult.error?.message ?? "unknown install error"}`);
        }

        spawnWorkingDirectory = options.installRoot;
      }

      status = "starting";
      lastCheckAt = Date.now();
      log("info", "Starting ComfyUI runtime process.", { pythonExecutable, spawnWorkingDirectory, host, port });
      processHandle = spawnImplementation(pythonExecutable, ["main.py", "--listen", host, "--port", String(port)], {
        cwd: spawnWorkingDirectory,
        stdio: "pipe",
      });
      processHandle.on("error", (error) => {
        log("error", "ComfyUI runtime process failed to spawn.", { error: error instanceof Error ? error.message : String(error), pythonExecutable });
      });

      processHandle.once("exit", () => {
        processHandle = undefined;
        status = "stopped";
        lastCheckAt = Date.now();
      });

      const timeoutAt = Date.now() + startupTimeoutMs;
      while (Date.now() < timeoutAt) {
        try {
          await client.getSystemStats();
          status = "ready";
          lastCheckAt = Date.now();
          log("info", "ComfyUI runtime is ready.", { url });
          return;
        } catch {
          status = "starting";
          lastCheckAt = Date.now();
          await delay(healthCheckIntervalMs);
        }
      }

      processHandle.kill("SIGTERM");
      processHandle = undefined;
      status = "unhealthy";
      lastCheckAt = Date.now();
      log("error", "ComfyUI runtime startup timed out.", { startupTimeoutMs, url });
      throw new Error(`ComfyUI runtime failed to become ready within ${startupTimeoutMs}ms.`);
    },

    isRunning() {
      return Boolean(processHandle) && status !== "stopped";
    },

    async getHealth() {
      if (!processHandle || status === "stopped") {
        return { status: "stopped", url, port, lastCheckAt };
      }

      try {
        await client.getSystemStats();
        status = "ready";
      } catch {
        status = status === "starting" ? "starting" : "unhealthy";
      }
      lastCheckAt = Date.now();
      return { status, url, port, lastCheckAt };
    },

    async stop() {
      if (!processHandle) {
        status = "stopped";
        lastCheckAt = Date.now();
        return;
      }

      processHandle.kill("SIGTERM");
      processHandle = undefined;
      status = "stopped";
      lastCheckAt = Date.now();
    },
  };
}
