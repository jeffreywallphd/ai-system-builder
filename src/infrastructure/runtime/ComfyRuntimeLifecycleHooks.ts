import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  ComfyRuntimeLifecycleOperations,
  ComfyRuntimeLifecycleStates,
  createComfyRuntimeEndpointValidation,
  createComfyRuntimeLifecycleResult,
  type ComfyRuntimeLifecycleOperation,
  type ComfyRuntimeLifecycleResult,
} from "@application/runtime/ComfyRuntimeLifecycleContract";
import type {
  ComfyRuntimeOrchestrationContext,
  ComfyRuntimeOrchestrationPhaseHookResult,
  IComfyRuntimeStartStopValidationHook,
} from "@application/runtime/ComfyRuntimeInstallerOrchestrationService";

interface RuntimeChildHandle {
  readonly pid?: number;
  readonly kill: (signal?: NodeJS.Signals | number) => boolean;
}

interface RuntimeFetchResponse {
  readonly status: number;
}

type RuntimeProcessLauncher = (
  command: string,
  args: ReadonlyArray<string>,
  options: { readonly cwd: string; readonly env: NodeJS.ProcessEnv; readonly detached: boolean },
) => RuntimeChildHandle;

type RuntimeFetch = (input: string, init: { readonly signal: AbortSignal }) => Promise<RuntimeFetchResponse>;

type RuntimeSleep = (ms: number) => Promise<void>;

export interface ComfyRuntimeLifecycleHooksOptions {
  readonly processLauncher?: RuntimeProcessLauncher;
  readonly fetcher?: RuntimeFetch;
  readonly sleep?: RuntimeSleep;
  readonly now?: () => Date;
  readonly healthTimeoutMs?: number;
  readonly stopTimeoutMs?: number;
}

export class ComfyRuntimeLifecycleHooks implements IComfyRuntimeStartStopValidationHook {
  private readonly processes = new Map<string, RuntimeChildHandle>();
  private readonly processLauncher: RuntimeProcessLauncher;
  private readonly fetcher: RuntimeFetch;
  private readonly sleep: RuntimeSleep;
  private readonly now: () => Date;
  private readonly healthTimeoutMs: number;
  private readonly stopTimeoutMs: number;

  public constructor(options: ComfyRuntimeLifecycleHooksOptions = {}) {
    this.processLauncher = options.processLauncher ?? ((command, args, launchOptions) => spawn(command, [...args], launchOptions));
    this.fetcher = options.fetcher ?? ((input, init) => fetch(input, init));
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.now = options.now ?? (() => new Date());
    this.healthTimeoutMs = options.healthTimeoutMs ?? 15_000;
    this.stopTimeoutMs = options.stopTimeoutMs ?? 5_000;
  }

  public async validateRuntime(context: ComfyRuntimeOrchestrationContext): Promise<ComfyRuntimeOrchestrationPhaseHookResult> {
    const result = await this.start(context);
    return this.toPhaseResult(result);
  }

  public async start(context: ComfyRuntimeOrchestrationContext): Promise<ComfyRuntimeLifecycleResult> {
    return this.executeLifecycle(context, ComfyRuntimeLifecycleOperations.start);
  }

  public async stop(context: ComfyRuntimeOrchestrationContext): Promise<ComfyRuntimeLifecycleResult> {
    return this.executeLifecycle(context, ComfyRuntimeLifecycleOperations.stop);
  }

  public async restart(context: ComfyRuntimeOrchestrationContext): Promise<ComfyRuntimeLifecycleResult> {
    await this.stop(context);
    return this.executeLifecycle(context, ComfyRuntimeLifecycleOperations.restart);
  }

  public async inspect(context: ComfyRuntimeOrchestrationContext): Promise<ComfyRuntimeLifecycleResult> {
    return this.executeLifecycle(context, ComfyRuntimeLifecycleOperations.inspect);
  }

  private async executeLifecycle(
    context: ComfyRuntimeOrchestrationContext,
    operation: ComfyRuntimeLifecycleOperation,
  ): Promise<ComfyRuntimeLifecycleResult> {
    const startedAt = this.now().toISOString();
    const diagnostics: Array<{
      code: string;
      severity: "error" | "warning" | "info";
      message: string;
      metadata: Readonly<Record<string, unknown>>;
    }> = [];
    const endpointValidation = this.validateEndpoints(context.runtimeEndpoint, context.runtimeAsset.runtimeHealth);

    if (!endpointValidation.valid) {
      const finishedAt = this.now().toISOString();
      return createComfyRuntimeLifecycleResult({
        operation,
        state: ComfyRuntimeLifecycleStates.unknown,
        endpointValidation,
        process: {
          started: false,
          alreadyRunning: false,
          stopped: false,
          gracefulStop: false,
          forcedStop: false,
          pid: this.processes.get(context.installDirectory)?.pid,
        },
        startedAt,
        finishedAt,
        durationMs: Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt)),
        diagnostics: endpointValidation.diagnostics,
        metadata: {},
      });
    }

    const healthBefore = await this.probeHealth(context);
    if (operation === ComfyRuntimeLifecycleOperations.inspect || operation === ComfyRuntimeLifecycleOperations.validate) {
      const finishedAt = this.now().toISOString();
      return createComfyRuntimeLifecycleResult({
        operation,
        state: healthBefore.healthy ? ComfyRuntimeLifecycleStates.healthy : ComfyRuntimeLifecycleStates.unhealthy,
        endpointValidation,
        health: healthBefore,
        process: {
          started: false,
          alreadyRunning: healthBefore.healthy,
          stopped: false,
          gracefulStop: false,
          forcedStop: false,
          pid: this.processes.get(context.installDirectory)?.pid,
        },
        startedAt,
        finishedAt,
        durationMs: Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt)),
        diagnostics: diagnostics.map((entry) => ({ ...entry })),
        metadata: {},
      });
    }

    if (operation === ComfyRuntimeLifecycleOperations.stop) {
      const stopResult = await this.stopProcess(context.installDirectory);
      const health = await this.probeHealth(context);
      const finishedAt = this.now().toISOString();
      return createComfyRuntimeLifecycleResult({
        operation,
        state: health.healthy ? ComfyRuntimeLifecycleStates.unhealthy : ComfyRuntimeLifecycleStates.stopped,
        endpointValidation,
        health,
        process: {
          started: false,
          alreadyRunning: healthBefore.healthy,
          stopped: stopResult.stopped,
          gracefulStop: stopResult.gracefulStop,
          forcedStop: stopResult.forcedStop,
          pid: stopResult.pid,
        },
        startedAt,
        finishedAt,
        durationMs: Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt)),
        diagnostics: Object.freeze(stopResult.diagnostics),
        metadata: {},
      });
    }

    if (healthBefore.healthy) {
      const finishedAt = this.now().toISOString();
      return createComfyRuntimeLifecycleResult({
        operation,
        state: ComfyRuntimeLifecycleStates.healthy,
        endpointValidation,
        health: healthBefore,
        process: {
          started: false,
          alreadyRunning: true,
          stopped: false,
          gracefulStop: false,
          forcedStop: false,
          pid: this.processes.get(context.installDirectory)?.pid,
        },
        startedAt,
        finishedAt,
        durationMs: Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt)),
        diagnostics: diagnostics.map((entry) => ({ ...entry })),
        metadata: {},
      });
    }

    const existing = this.processes.get(context.installDirectory);
    if (existing?.pid && this.processAlive(existing.pid)) {
      diagnostics.push({
        code: "runtime-partially-started",
        severity: "warning",
        message: "Runtime process exists but endpoint is unhealthy; restarting process.",
        metadata: Object.freeze({ pid: existing.pid }),
      });
      await this.stopProcess(context.installDirectory);
    }

    const command = this.resolveRuntimeCommand(context.installDirectory);
    const args = this.resolveRuntimeArgs(context);
    const child = this.processLauncher(command, args, {
      cwd: context.runtimeWorkingDirectory,
      env: {
        ...process.env,
        ...context.runtimeEnvironment,
      },
      detached: false,
    });
    this.processes.set(context.installDirectory, child);

    const health = await this.waitForHealthy(context);
    const finishedAt = this.now().toISOString();
    return createComfyRuntimeLifecycleResult({
      operation,
      state: health.healthy
        ? ComfyRuntimeLifecycleStates.healthy
        : health.timeout
          ? ComfyRuntimeLifecycleStates.timedOut
          : ComfyRuntimeLifecycleStates.unhealthy,
      endpointValidation,
      health: {
        endpoint: context.runtimeEndpoint,
        readinessUrl: health.readinessUrl,
        livenessUrl: health.livenessUrl,
        readinessStatusCode: health.readinessStatusCode,
        livenessStatusCode: health.livenessStatusCode,
        healthy: health.healthy,
        checkedAt: health.checkedAt,
        durationMs: health.durationMs,
      },
      process: {
        started: true,
        alreadyRunning: false,
        stopped: false,
        gracefulStop: false,
        forcedStop: false,
        pid: child.pid,
      },
      startedAt,
      finishedAt,
      durationMs: Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt)),
      diagnostics: Object.freeze([
        ...diagnostics,
        ...(health.timeout
          ? [{
            code: "runtime-start-timeout",
            severity: "error" as const,
            message: "ComfyUI did not become healthy before startup timeout.",
            metadata: Object.freeze({
              timeoutMs: context.runtimeStartupTimeoutMs,
              endpoint: context.runtimeEndpoint,
            }),
          }]
          : []),
      ]),
      metadata: Object.freeze({
        command,
        args,
      }),
    });
  }

  private resolveRuntimeCommand(installDirectory: string): string {
    const pythonInVenv = process.platform === "win32"
      ? path.join(installDirectory, ".venv", "Scripts", "python.exe")
      : path.join(installDirectory, ".venv", "bin", "python");
    if (existsSync(pythonInVenv)) {
      return pythonInVenv;
    }
    return "python";
  }

  private resolveRuntimeArgs(context: ComfyRuntimeOrchestrationContext): ReadonlyArray<string> {
    const declared = [...context.runtimeAsset.runtimeStart.args];
    const withoutPort = stripArgPair(declared, "--port");
    const withoutListen = stripArgPair(withoutPort, "--listen");
    return Object.freeze([
      ...withoutListen,
      "--listen",
      context.runtimeHost,
      "--port",
      `${context.runtimePort}`,
    ]);
  }

  private validateEndpoints(
    endpoint: string,
    health: ComfyRuntimeOrchestrationContext["runtimeAsset"]["runtimeHealth"],
  ) {
    try {
      const base = new URL(endpoint);
      const readinessUrl = new URL(health.expectedReadinessPath, base).toString();
      const livenessUrl = new URL(health.expectedLivenessPath, base).toString();
      return createComfyRuntimeEndpointValidation({
        endpoint: base.toString(),
        readinessUrl,
        livenessUrl,
        valid: true,
        diagnostics: [],
      });
    } catch (error) {
      return createComfyRuntimeEndpointValidation({
        endpoint,
        readinessUrl: endpoint,
        livenessUrl: endpoint,
        valid: false,
        diagnostics: [{
          code: "runtime-endpoint-invalid",
          severity: "error",
          message: error instanceof Error ? error.message : "Runtime endpoint is invalid.",
          metadata: {},
        }],
      });
    }
  }

  private async probeHealth(context: ComfyRuntimeOrchestrationContext): Promise<{
    endpoint: string;
    readinessUrl: string;
    livenessUrl: string;
    readinessStatusCode?: number;
    livenessStatusCode?: number;
    healthy: boolean;
    checkedAt: string;
    durationMs: number;
    timeout?: boolean;
  }> {
    const started = this.now();
    const base = new URL(context.runtimeEndpoint);
    const readinessUrl = new URL(context.runtimeAsset.runtimeHealth.expectedReadinessPath, base).toString();
    const livenessUrl = new URL(context.runtimeAsset.runtimeHealth.expectedLivenessPath, base).toString();
    const expectedCodes = new Set(context.runtimeAsset.runtimeHealth.expectedStatusCodes);

    const readiness = await this.safeFetchStatus(readinessUrl);
    const liveness = await this.safeFetchStatus(livenessUrl);
    const finished = this.now();
    const healthy = readiness !== undefined && liveness !== undefined
      && expectedCodes.has(readiness) && expectedCodes.has(liveness);

    return Object.freeze({
      endpoint: context.runtimeEndpoint,
      readinessUrl,
      livenessUrl,
      readinessStatusCode: readiness,
      livenessStatusCode: liveness,
      healthy,
      checkedAt: finished.toISOString(),
      durationMs: Math.max(0, finished.getTime() - started.getTime()),
    });
  }

  private async waitForHealthy(context: ComfyRuntimeOrchestrationContext) {
    const timeoutMs = Math.max(1_000, Math.min(context.runtimeStartupTimeoutMs, this.healthTimeoutMs));
    const started = Date.now();
    while (Date.now() - started <= timeoutMs) {
      const probe = await this.probeHealth(context);
      if (probe.healthy) {
        return probe;
      }
      await this.sleep(Math.max(100, context.runtimeAsset.runtimeHealth.pollIntervalMs));
    }
    const timedOutProbe = await this.probeHealth(context);
    return Object.freeze({
      ...timedOutProbe,
      timeout: true,
    });
  }

  private async safeFetchStatus(url: string): Promise<number | undefined> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2_000);
    try {
      const response = await this.fetcher(url, { signal: controller.signal });
      return response.status;
    } catch {
      return undefined;
    } finally {
      clearTimeout(timeout);
    }
  }

  private processAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  private async stopProcess(installDirectory: string): Promise<{
    stopped: boolean;
    gracefulStop: boolean;
    forcedStop: boolean;
    pid?: number;
    diagnostics: ReadonlyArray<{
      code: string;
      severity: "error" | "warning" | "info";
      message: string;
      metadata: Readonly<Record<string, unknown>>;
    }>;
  }> {
    const handle = this.processes.get(installDirectory);
    if (!handle || !handle.pid) {
      this.processes.delete(installDirectory);
      return Object.freeze({
        stopped: true,
        gracefulStop: false,
        forcedStop: false,
        diagnostics: Object.freeze([]),
      });
    }

    const pid = handle.pid;
    if (!this.processAlive(pid)) {
      this.processes.delete(installDirectory);
      return Object.freeze({
        stopped: true,
        gracefulStop: false,
        forcedStop: false,
        pid,
        diagnostics: Object.freeze([]),
      });
    }

    handle.kill("SIGTERM");
    const gracefulStart = Date.now();
    while (Date.now() - gracefulStart < this.stopTimeoutMs) {
      if (!this.processAlive(pid)) {
        this.processes.delete(installDirectory);
        return Object.freeze({
          stopped: true,
          gracefulStop: true,
          forcedStop: false,
          pid,
          diagnostics: Object.freeze([]),
        });
      }
      await this.sleep(100);
    }

    handle.kill("SIGKILL");
    this.processes.delete(installDirectory);
    return Object.freeze({
      stopped: true,
      gracefulStop: false,
      forcedStop: true,
      pid,
      diagnostics: Object.freeze([{
        code: "runtime-forced-stop",
        severity: "warning",
        message: "Runtime required forced termination.",
        metadata: Object.freeze({ pid }),
      }]),
    });
  }

  private toPhaseResult(result: ComfyRuntimeLifecycleResult): ComfyRuntimeOrchestrationPhaseHookResult {
    const failed = result.state === ComfyRuntimeLifecycleStates.unhealthy || result.state === ComfyRuntimeLifecycleStates.timedOut;
    const issueSeverity = result.state === ComfyRuntimeLifecycleStates.timedOut ? "error" : "warning";
    return Object.freeze({
      status: failed ? "failed" : "completed",
      message: failed
        ? `ComfyUI runtime lifecycle ${result.operation} ended in '${result.state}'.`
        : "ComfyUI runtime is healthy.",
      issues: Object.freeze(
        failed
          ? [{
            code: result.state === ComfyRuntimeLifecycleStates.timedOut
              ? "runtime-validation-timeout"
              : "runtime-validation-unhealthy",
            severity: issueSeverity,
            message: failed
              ? `ComfyUI runtime endpoint is ${result.state}.`
              : "ComfyUI runtime endpoint is healthy.",
            phase: "runtime-validation",
            metadata: Object.freeze({
              endpoint: result.endpointValidation.endpoint,
              readinessStatusCode: result.health?.readinessStatusCode,
              livenessStatusCode: result.health?.livenessStatusCode,
            }),
          }]
          : [],
      ),
      metadata: Object.freeze({
        runtimeLifecycle: result,
      }),
    });
  }
}

function stripArgPair(args: ReadonlyArray<string>, key: string): ReadonlyArray<string> {
  const index = args.indexOf(key);
  if (index < 0) {
    return args;
  }
  const copy = [...args];
  copy.splice(index, 2);
  return copy;
}

