import type { IPythonRuntimeClient } from "../../../application/ports/interfaces/IPythonRuntimeClient";
import {
  PythonRuntimeOwnership,
  PythonRuntimeStatuses,
  type IPythonRuntimeManager,
  type PythonRuntimeManagerStatus,
} from "../../../application/ports/interfaces/IPythonRuntimeManager";
import type { IRuntimeEventSink } from "../../../application/ports/interfaces/IRuntimeEventSink";
import { RuntimeEventSources } from "../../../application/runtime/RuntimeEvent";
import type { PythonRuntimeConfig } from "../../config/PythonRuntimeConfig";
import { PythonRuntimeLauncher, type RuntimeProcessLike } from "./PythonRuntimeLauncher";
import { PythonRuntimeState } from "./PythonRuntimeState";

export interface PythonRuntimeProcessManagerOptions {
  readonly client: IPythonRuntimeClient;
  readonly launcher: PythonRuntimeLauncher;
  readonly eventSink: IRuntimeEventSink;
  readonly config: PythonRuntimeConfig;
  readonly startupTimeoutMs?: number;
  readonly healthPollIntervalMs?: number;
  readonly autoStartEnabled?: boolean;
  readonly sleep?: (ms: number) => Promise<void>;
}

export class PythonRuntimeProcessManager implements IPythonRuntimeManager {
  private readonly client: IPythonRuntimeClient;
  private readonly launcher: PythonRuntimeLauncher;
  private readonly eventSink: IRuntimeEventSink;
  private readonly startupTimeoutMs: number;
  private readonly healthPollIntervalMs: number;
  private readonly autoStartEnabled: boolean;
  private readonly sleep: (ms: number) => Promise<void>;
  private process?: RuntimeProcessLike;
  private state = new PythonRuntimeState({ status: PythonRuntimeStatuses.unavailable });

  constructor(options: PythonRuntimeProcessManagerOptions) {
    this.client = options.client;
    this.launcher = options.launcher;
    this.eventSink = options.eventSink;
    this.startupTimeoutMs = options.startupTimeoutMs ?? 20_000;
    this.healthPollIntervalMs = options.healthPollIntervalMs ?? 500;
    this.autoStartEnabled = options.autoStartEnabled ?? true;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  public getStatus(): PythonRuntimeManagerStatus {
    return this.state;
  }

  public async checkAvailability(): Promise<boolean> {
    this.emitInfo("Checking Python runtime health.");

    try {
      const health = await this.client.health();
      const isHealthy = health.status === "ok";
      this.state = new PythonRuntimeState({
        status: isHealthy ? PythonRuntimeStatuses.healthy : PythonRuntimeStatuses.unhealthy,
        owner: isHealthy ? PythonRuntimeOwnership.external : PythonRuntimeOwnership.none,
      });
      if (isHealthy) {
        this.emitInfo("Python runtime is healthy.");
      }
      return isHealthy;
    } catch {
      this.state = new PythonRuntimeState({ status: PythonRuntimeStatuses.unavailable });
      return false;
    }
  }

  public async ensureRuntimeAvailability(): Promise<PythonRuntimeManagerStatus> {
    const existing = await this.checkAvailability();

    if (existing) {
      return this.state;
    }

    if (!this.autoStartEnabled) {
      this.state = new PythonRuntimeState({
        status: PythonRuntimeStatuses.unavailable,
        detail: "Auto-start is disabled.",
      });
      this.emitInfo("Python runtime unavailable and auto-start disabled.");
      return this.state;
    }

    this.emitInfo("Python runtime unavailable; starting managed runtime.");
    this.state = new PythonRuntimeState({
      status: PythonRuntimeStatuses.starting,
      owner: PythonRuntimeOwnership.managed,
    });

    try {
      this.process = this.launcher.launch();
      this.attachProcessEvents(this.process);
      this.emitInfo("Python runtime process started.");
      await this.waitForHealth();
      this.state = new PythonRuntimeState({
        status: PythonRuntimeStatuses.healthy,
        owner: PythonRuntimeOwnership.managed,
      });
      this.emitSuccess("Python runtime is healthy.");
      return this.state;
    } catch (error: unknown) {
      const message = toErrorMessage(error) || "Python runtime startup failed.";
      this.state = new PythonRuntimeState({
        status: PythonRuntimeStatuses.failed,
        owner: PythonRuntimeOwnership.managed,
        detail: message,
      });
      this.emitError(message);
      return this.state;
    }
  }

  public async restartRuntime(): Promise<PythonRuntimeManagerStatus> {
    await this.stopManagedRuntime();
    return this.ensureRuntimeAvailability();
  }

  public async stopManagedRuntime(): Promise<void> {
    if (this.state.owner !== PythonRuntimeOwnership.managed || !this.process) {
      return;
    }

    this.state = new PythonRuntimeState({
      status: PythonRuntimeStatuses.stopping,
      owner: PythonRuntimeOwnership.managed,
    });

    this.process.kill("SIGTERM");
    this.process = undefined;

    this.state = new PythonRuntimeState({
      status: PythonRuntimeStatuses.stopped,
      owner: PythonRuntimeOwnership.managed,
    });
    this.emitInfo("Managed Python runtime stopped.");
  }

  private async waitForHealth(): Promise<void> {
    const startedAt = Date.now();

    while (Date.now() - startedAt <= this.startupTimeoutMs) {
      try {
        const health = await this.client.health();

        if (health.status === "ok") {
          return;
        }
      } catch {
        // keep polling
      }

      await this.sleep(this.healthPollIntervalMs);
    }

    this.emitError("Python runtime startup timed out.");
    throw new Error("Python runtime startup timed out.");
  }

  private attachProcessEvents(process: RuntimeProcessLike): void {
    process.stdout?.on("data", (chunk) => {
      this.emitInfo(`Python runtime stdout: ${String(chunk).trim()}`);
    });

    process.stderr?.on("data", (chunk) => {
      this.emitError(`Python runtime stderr: ${String(chunk).trim()}`);
    });

    process.on("error", (error: unknown) => {
      this.emitError(`Python runtime process error: ${toErrorMessage(error)}`);
    });

    process.on("exit", (code?: number) => {
      this.emitInfo(`Python runtime process exited${typeof code === "number" ? ` (${code})` : ""}.`);
    });
  }

  private emitInfo(message: string): void {
    this.eventSink.emit({ source: RuntimeEventSources.pythonRuntime, severity: "info", message });
  }

  private emitSuccess(message: string): void {
    this.eventSink.emit({ source: RuntimeEventSources.pythonRuntime, severity: "success", message });
  }

  private emitError(message: string): void {
    this.eventSink.emit({ source: RuntimeEventSources.pythonRuntime, severity: "error", message });
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === "string" ? error : "Unknown error";
}
