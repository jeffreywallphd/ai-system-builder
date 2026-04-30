import { spawn, type ChildProcess } from "node:child_process";

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

  return {
    async start() {
      if (processHandle && status !== "stopped") {
        return;
      }

      status = "starting";
      lastCheckAt = Date.now();
      processHandle = spawnImplementation(pythonExecutable, ["main.py", "--listen", host, "--port", String(port)], {
        cwd: options.workingDirectory,
        stdio: "pipe",
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
