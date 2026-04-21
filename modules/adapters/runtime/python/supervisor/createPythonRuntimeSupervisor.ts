import { ChildProcess, spawn, type SpawnOptions } from "node:child_process";
import { platform } from "node:os";

import type { PythonRuntimeHttpClient } from "../client/createPythonRuntimeHttpClient";

export type PythonRuntimeSupervisorStatus = "stopped" | "starting" | "ready" | "failed";

export interface PythonRuntimeSupervisorEvent {
  type:
    | "start-requested"
    | "start-skipped"
    | "spawned"
    | "health-probe-failed"
    | "health-unhealthy"
    | "health-ready"
    | "startup-timeout"
    | "process-exit"
    | "process-error"
    | "stop-requested"
    | "stop-complete"
    | "stdio";
  status: PythonRuntimeSupervisorStatus;
  detail?: string;
  data?: Record<string, unknown>;
}

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
  onEvent?: (event: PythonRuntimeSupervisorEvent) => void;
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
  const onEvent = options.onEvent;

  let childProcess: ChildProcess | undefined;
  let status: PythonRuntimeSupervisorStatus = "stopped";
  let lastHealthProbeError: string | undefined;
  let lastStartupFailure: string | undefined;
  const recentRuntimeOutput: string[] = [];

  const emitEvent = (
    type: PythonRuntimeSupervisorEvent["type"],
    detail?: string,
    data?: Record<string, unknown>,
  ) => {
    onEvent?.({
      type,
      status,
      detail,
      data,
    });
  };

  const appendRuntimeOutput = (text: string) => {
    const normalized = text.trim();
    if (normalized.length === 0) {
      return;
    }

    recentRuntimeOutput.push(normalized);
    if (recentRuntimeOutput.length > 10) {
      recentRuntimeOutput.splice(0, recentRuntimeOutput.length - 10);
    }
  };

  const startFailureMessage = (base: string): string => {
    const details = [
      lastStartupFailure,
      lastHealthProbeError ? `Last health probe error: ${lastHealthProbeError}` : undefined,
      recentRuntimeOutput.length > 0
        ? `Recent runtime output: ${recentRuntimeOutput.join(" | ")}`
        : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    if (details.length === 0) {
      return base;
    }

    return `${base} ${details.join(" ")}`;
  };

  const applyChildExitBinding = (processHandle: ChildProcess) => {
    processHandle.once("exit", (code, signal) => {
      const exitDetail = `Python runtime process exited during lifecycle (code=${String(code ?? "null")}, signal=${String(signal ?? "null")}).`;
      lastStartupFailure = exitDetail;
      childProcess = undefined;
      status = "stopped";
      emitEvent("process-exit", exitDetail, { code, signal });
    });
    processHandle.once("error", (error) => {
      lastStartupFailure = `Python runtime process failed to start: ${error.message}`;
      status = "failed";
      emitEvent("process-error", lastStartupFailure, {
        errorName: error.name,
      });
    });

    const bindStream = (
      stream: NodeJS.ReadableStream | null,
      source: "stdout" | "stderr",
    ) => {
      if (!stream) {
        return;
      }

      stream.on("data", (chunk: string | Buffer) => {
        const text = chunk.toString();
        appendRuntimeOutput(text);
        emitEvent("stdio", text, { source });
      });
    };

    bindStream(processHandle.stdout, "stdout");
    bindStream(processHandle.stderr, "stderr");
  };

  const getDefaultCommand = () => {
    return platform() === "win32" ? "python" : "python3";
  };

  const resolveCommand = () => {
    const command = options.command.trim();
    return command.length > 0 ? command : getDefaultCommand();
  };

  const resolveArgs = () => {
    if (Array.isArray(options.args) && options.args.length > 0) {
      return options.args;
    }

    return ["main.py"];
  };

  const hasRuntimeExited = () => {
    return !childProcess || status === "stopped";
  };

  const throwStartupFailure = (message: string): never => {
    status = "failed";
    throw new Error(startFailureMessage(message));
  };

  const assertRuntimeStillStarting = () => {
    if (hasRuntimeExited()) {
      throwStartupFailure("Python runtime exited before health check completed.");
    }
    if (status === "failed") {
      throwStartupFailure("Python runtime failed during startup.");
    }
  };

  const maybeWarnOnWindowsCommand = (command: string) => {
    if (platform() === "win32" && command === "python3") {
      emitEvent(
        "start-requested",
        "Configured python runtime command is `python3` on Windows; `python` is usually required.",
      );
      lastStartupFailure = "Configured command `python3` is uncommon on Windows.";
    }
  };

  const startHealthPolling = async () => {
    const startedAt = Date.now();
    while ((Date.now() - startedAt) < startupTimeoutMs) {
      assertRuntimeStillStarting();
      try {
        const health = await options.runtimeClient.getHealthStatus();
        if (health.healthy) {
          status = "ready";
          emitEvent("health-ready", "Python runtime reported healthy startup state.");
          return;
        }

        const unhealthyDetail = health.error?.message ?? `Runtime status was ${health.status.status}.`;
        lastStartupFailure = unhealthyDetail;
        emitEvent("health-unhealthy", unhealthyDetail, {
          runtimeStatus: health.status.status,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        lastHealthProbeError = message;
        emitEvent("health-probe-failed", message);
      }

      await delay(healthCheckIntervalMs);
    }

    emitEvent(
      "startup-timeout",
      `Python runtime failed to report healthy status within ${startupTimeoutMs}ms.`,
    );
    throwStartupFailure("Python runtime failed to report healthy status during startup window.");
  };

  return {
    async start() {
      if (childProcess && status !== "stopped") {
        emitEvent("start-skipped", "Runtime start skipped because supervisor is already active.");
        return;
      }

      lastHealthProbeError = undefined;
      lastStartupFailure = undefined;
      recentRuntimeOutput.splice(0, recentRuntimeOutput.length);

      const command = resolveCommand();
      const args = resolveArgs();
      emitEvent("start-requested", "Starting Python runtime process.", {
        command,
        args,
        cwd: options.cwd,
      });
      maybeWarnOnWindowsCommand(command);

      status = "starting";
      childProcess = spawnImplementation(command, args, {
        cwd: options.cwd,
        env: options.env,
        stdio: "pipe",
      } satisfies SpawnOptions);
      applyChildExitBinding(childProcess);
      emitEvent("spawned", "Python runtime process spawned.");

      await startHealthPolling();
    },

    async stop() {
      emitEvent("stop-requested", "Stopping Python runtime process.");
      if (!childProcess) {
        status = "stopped";
        emitEvent("stop-complete", "Python runtime process was already stopped.");
        return;
      }

      const processHandle = childProcess;
      await new Promise<void>((resolve) => {
        processHandle.once("exit", () => resolve());
        processHandle.kill("SIGTERM");
      });

      childProcess = undefined;
      status = "stopped";
      emitEvent("stop-complete", "Python runtime process stopped.");
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
