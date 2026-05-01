import { spawn, type ChildProcess } from "node:child_process";
import type { Readable } from "node:stream";

import type { RuntimeInstallerPort } from "../../../application/ports/runtime-installer/runtime-installer.port";
import type { LoggingPort } from "../../../application/ports/logging";
import { DEFAULT_COMFYUI_REPOSITORY_URL } from "../installer/comfyui/createComfyUiRuntimeInstaller";
import { createComfyUiHttpClient, type ComfyUiHttpClient } from "./createComfyUiHttpClient";
import type { ComfyUiRuntimeHealth } from "./comfyUiRuntimeHealth";
import { buildComfyUiRuntimeEnvironment } from "./comfyUiPythonEnvironment";


export interface CreateComfyUiRuntimeSupervisorOptions {
  workingDirectory: string;
  pythonExecutable?: string;
  runtimeDeviceMode?: ComfyUiRuntimeDeviceMode;
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

export type ComfyUiRuntimeDeviceMode = "auto" | "cpu" | "directml" | "cuda";

export interface ComfyUiRuntimeSupervisor {
  start(): Promise<void>;
  isRunning(): boolean;
  getHealth(): Promise<ComfyUiRuntimeHealth>;
  stop(): Promise<void>;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function normalizeRuntimeOutput(text: string): string | undefined {
  const normalized = text.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function buildComfyUiRuntimeLaunchArguments(input: {
  host: string;
  port: number;
  runtimeDeviceMode?: ComfyUiRuntimeDeviceMode;
}): string[] {
  const deviceMode = input.runtimeDeviceMode ?? "auto";
  const deviceArguments =
    deviceMode === "directml"
      ? ["--directml"]
      : deviceMode === "cpu"
        ? ["--cpu"]
        : [];

  return ["main.py", ...deviceArguments, "--listen", input.host, "--port", String(input.port)];
}

export function createComfyUiRuntimeSupervisor(options: CreateComfyUiRuntimeSupervisorOptions): ComfyUiRuntimeSupervisor {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 8188;
  const runtimeDeviceMode = options.runtimeDeviceMode ?? "auto";
  const url = `http://${host}:${port}`;
  const startupTimeoutMs = options.startupTimeoutMs ?? 120_000;
  const healthCheckIntervalMs = options.healthCheckIntervalMs ?? 1_000;
  const spawnImplementation = options.spawnImplementation ?? spawn;
  const pythonExecutable = options.pythonExecutable ?? "python";
  const client: Pick<ComfyUiHttpClient, "getSystemStats"> = createComfyUiHttpClient({ baseUrl: url, fetchImplementation: options.fetchImplementation });

  let processHandle: ChildProcess | undefined;
  let status: ComfyUiRuntimeHealth["status"] = "stopped";
  let lastCheckAt = Date.now();
  let startupFailure: string | undefined;
  const recentRuntimeOutput: string[] = [];

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
  const elapsed = (startedAt: number) => Date.now() - startedAt;

  const appendRuntimeOutput = (text: string, stream?: "stdout" | "stderr") => {
    const normalized = normalizeRuntimeOutput(text);
    if (!normalized) {
      return;
    }

    recentRuntimeOutput.push(normalized);
    if (recentRuntimeOutput.length > 10) {
      recentRuntimeOutput.splice(0, recentRuntimeOutput.length - 10);
    }
    log(stream === "stderr" ? "info" : "debug", "ComfyUI runtime process output.", {
      stream,
      output: normalized,
    });
  };

  const bindRuntimeOutput = (stream: Readable | null | undefined, source: "stdout" | "stderr") => {
    stream?.on("data", (chunk: string | Buffer) => {
      appendRuntimeOutput(chunk.toString(), source);
    });
  };

  const formatStartupFailure = (base: string) => {
    const details = [
      startupFailure,
      recentRuntimeOutput.length > 0 ? `Recent runtime output: ${recentRuntimeOutput.join(" | ")}` : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    return details.length > 0 ? `${base} ${details.join(" ")}` : base;
  };

  const throwStartupFailure = (message: string): never => {
    status = "unhealthy";
    lastCheckAt = Date.now();
    log("error", message, {
      startupFailure,
      recentRuntimeOutput: recentRuntimeOutput.length > 0 ? [...recentRuntimeOutput] : undefined,
    });
    throw new Error(formatStartupFailure(message));
  };

  const assertStartupProcessActive = () => {
    if (!processHandle) {
      throwStartupFailure("ComfyUI runtime exited before health check completed.");
    }
    if (startupFailure && status === "unhealthy") {
      throwStartupFailure("ComfyUI runtime failed during startup.");
    }
  };

  const throwMissingSpawnedProcess = (): never => {
    startupFailure = "ComfyUI runtime process spawn did not return a child process.";
    return throwStartupFailure("ComfyUI runtime failed during startup.");
  };

  return {
    async start() {
      if (processHandle && status !== "stopped") {
        log("info", "ComfyUI runtime start skipped because a process is already active.", {
          status,
          url,
        });
        return;
      }

      const startStartedAt = Date.now();
      startupFailure = undefined;
      recentRuntimeOutput.splice(0, recentRuntimeOutput.length);

      let spawnWorkingDirectory = options.workingDirectory;

      if (options.autoInstall === true) {
        const installStartedAt = Date.now();
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
        log("info", "ComfyUI runtime install check completed before start.", {
          installRoot: options.installRoot,
          status: installResult.status,
          commitSha: installResult.commitSha,
          durationMs: elapsed(installStartedAt),
        });
      }

      status = "starting";
      lastCheckAt = Date.now();
      const launchArguments = buildComfyUiRuntimeLaunchArguments({ host, port, runtimeDeviceMode });
      log("info", "Starting ComfyUI runtime process.", { pythonExecutable, launchArguments, spawnWorkingDirectory, host, port, runtimeDeviceMode });
      let spawnedProcessCandidate: ChildProcess | undefined;
      try {
        spawnedProcessCandidate = spawnImplementation(pythonExecutable, launchArguments, {
          cwd: spawnWorkingDirectory,
          env: buildComfyUiRuntimeEnvironment(),
          stdio: "pipe",
        });
      } catch (error) {
        startupFailure = `ComfyUI runtime process failed to start: ${error instanceof Error ? error.message : String(error)}`;
        throwStartupFailure("ComfyUI runtime failed during startup.");
      }
      const spawnedProcess = spawnedProcessCandidate ?? throwMissingSpawnedProcess();
      processHandle = spawnedProcess;
      log("info", "ComfyUI runtime process spawned; polling health endpoint.", {
        url,
        startupTimeoutMs,
        healthCheckIntervalMs,
      });
      bindRuntimeOutput(spawnedProcess.stdout, "stdout");
      bindRuntimeOutput(spawnedProcess.stderr, "stderr");
      spawnedProcess.on("error", (error) => {
        startupFailure = `ComfyUI runtime process failed to start: ${error.message}`;
        status = "unhealthy";
        lastCheckAt = Date.now();
        log("error", "ComfyUI runtime process failed to spawn.", { error: error instanceof Error ? error.message : String(error), pythonExecutable });
      });

      spawnedProcess.once("exit", (code, signal) => {
        if (status === "starting") {
          startupFailure = `ComfyUI runtime process exited during startup (code=${String(code ?? "null")}, signal=${String(signal ?? "null")}).`;
        }
        processHandle = undefined;
        status = status === "starting" ? "unhealthy" : "stopped";
        lastCheckAt = Date.now();
        log(status === "unhealthy" ? "error" : "info", "ComfyUI runtime process exited.", {
          code,
          signal,
          status,
          startupFailure,
          recentRuntimeOutput: recentRuntimeOutput.length > 0 ? [...recentRuntimeOutput] : undefined,
        });
      });

      const timeoutAt = Date.now() + startupTimeoutMs;
      let healthCheckAttempts = 0;
      let lastHealthWaitLogAt = 0;
      while (Date.now() < timeoutAt) {
        assertStartupProcessActive();
        healthCheckAttempts += 1;
        try {
          await client.getSystemStats();
          assertStartupProcessActive();
          status = "ready";
          lastCheckAt = Date.now();
          log("info", "ComfyUI runtime is ready.", {
            url,
            healthCheckAttempts,
            durationMs: elapsed(startStartedAt),
          });
          return;
        } catch {
          assertStartupProcessActive();
          status = "starting";
          lastCheckAt = Date.now();
          if (Date.now() - lastHealthWaitLogAt >= 10_000) {
            lastHealthWaitLogAt = Date.now();
            log("info", "Waiting for ComfyUI runtime health endpoint.", {
              url,
              healthCheckAttempts,
              elapsedMs: elapsed(startStartedAt),
              startupTimeoutMs,
              recentRuntimeOutput: recentRuntimeOutput.length > 0 ? [...recentRuntimeOutput] : undefined,
            });
          }
          await delay(healthCheckIntervalMs);
        }
      }

      processHandle?.kill("SIGTERM");
      processHandle = undefined;
      status = "unhealthy";
      lastCheckAt = Date.now();
      log("error", "ComfyUI runtime startup timed out.", {
        startupTimeoutMs,
        url,
        durationMs: elapsed(startStartedAt),
        recentRuntimeOutput: recentRuntimeOutput.length > 0 ? [...recentRuntimeOutput] : undefined,
      });
      throw new Error(formatStartupFailure(`ComfyUI runtime failed to become ready within ${startupTimeoutMs}ms.`));
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
