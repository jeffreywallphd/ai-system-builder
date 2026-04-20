import { ChildProcess, spawn, type SpawnOptions } from "node:child_process";

import type { PythonRuntimeHttpClient } from "../client/createPythonRuntimeHttpClient";

export type PythonRuntimeSupervisorStatus = "stopped" | "starting" | "ready" | "failed";

export interface PythonRuntimeSupervisor {
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  getStatus(): PythonRuntimeSupervisorStatus;
}

export interface CreatePythonRuntimeSupervisorOptions {
  command: string;
  args?: readonly string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  startupTimeoutMs?: number;
  healthCheckIntervalMs?: number;
  runtimeClient: Pick<PythonRuntimeHttpClient, "getHealthStatus">;
  spawnImplementation?: typeof spawn;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export function createPythonRuntimeSupervisor(
  options: CreatePythonRuntimeSupervisorOptions,
): PythonRuntimeSupervisor {
  const startupTimeoutMs = options.startupTimeoutMs ?? 5_000;
  const healthCheckIntervalMs = options.healthCheckIntervalMs ?? 100;
  const spawnImplementation = options.spawnImplementation ?? spawn;

  let childProcess: ChildProcess | undefined;
  let status: PythonRuntimeSupervisorStatus = "stopped";

  const applyChildExitBinding = (processHandle: ChildProcess) => {
    processHandle.once("exit", () => {
      childProcess = undefined;
      status = "stopped";
    });
    processHandle.once("error", () => {
      status = "failed";
    });
  };

  return {
    async start() {
      if (childProcess && status !== "stopped") {
        return;
      }

      status = "starting";
      childProcess = spawnImplementation(options.command, options.args ?? [], {
        cwd: options.cwd,
        env: options.env,
        stdio: "pipe",
      } satisfies SpawnOptions);
      applyChildExitBinding(childProcess);

      const startedAt = Date.now();
      while ((Date.now() - startedAt) < startupTimeoutMs) {
        try {
          const health = await options.runtimeClient.getHealthStatus();
          if (health.healthy) {
            status = "ready";
            return;
          }
        } catch {
          // Keep polling until timeout while process is still booting.
        }

        await delay(healthCheckIntervalMs);
      }

      status = "failed";
      throw new Error("Python runtime failed to report healthy status during startup window.");
    },

    async stop() {
      if (!childProcess) {
        status = "stopped";
        return;
      }

      const processHandle = childProcess;
      await new Promise<void>((resolve) => {
        processHandle.once("exit", () => resolve());
        processHandle.kill("SIGTERM");
      });

      childProcess = undefined;
      status = "stopped";
    },

    async restart() {
      await this.stop();
      await this.start();
    },

    getStatus() {
      return status;
    },
  };
}
