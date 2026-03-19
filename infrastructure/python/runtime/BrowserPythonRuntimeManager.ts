import type { IPythonRuntimeClient } from "../../../application/ports/interfaces/IPythonRuntimeClient";
import {
  PythonRuntimeOwnership,
  PythonRuntimeStatuses,
  type IPythonRuntimeManager,
  type PythonRuntimeManagerStatus,
} from "../../../application/ports/interfaces/IPythonRuntimeManager";
import type { IRuntimeEventSink } from "../../../application/ports/interfaces/IRuntimeEventSink";
import { RuntimeEventSources } from "../../../application/runtime/RuntimeEvent";
import { PythonRuntimeMode } from "../../config/PythonRuntimeMode";
import type { PythonRuntimeConfig } from "../../config/PythonRuntimeConfig";
import { PythonRuntimeState } from "./PythonRuntimeState";

export interface BrowserPythonRuntimeManagerOptions {
  readonly client: IPythonRuntimeClient;
  readonly eventSink: IRuntimeEventSink;
  readonly config: PythonRuntimeConfig;
}

export class BrowserPythonRuntimeManager implements IPythonRuntimeManager {
  private readonly client: IPythonRuntimeClient;
  private readonly eventSink: IRuntimeEventSink;
  private readonly config: PythonRuntimeConfig;
  private state: PythonRuntimeState;

  constructor(options: BrowserPythonRuntimeManagerOptions) {
    this.client = options.client;
    this.eventSink = options.eventSink;
    this.config = options.config;
    this.state = new PythonRuntimeState({
      status: PythonRuntimeStatuses.unavailable,
      detail: this.config.mode === PythonRuntimeMode.disabled
        ? "Python runtime is disabled in settings."
        : "Python runtime is not connected.",
    });
  }

  public getStatus(): PythonRuntimeManagerStatus {
    return this.state;
  }

  public async checkAvailability(): Promise<boolean> {
    if (this.config.mode === PythonRuntimeMode.disabled) {
      this.state = new PythonRuntimeState({
        status: PythonRuntimeStatuses.unavailable,
        owner: PythonRuntimeOwnership.none,
        detail: "Python runtime is disabled in settings.",
      });
      this.emitInfo("Python runtime is disabled in browser settings.");
      return false;
    }

    this.emitInfo("Checking Python runtime health.");

    try {
      const health = await this.client.health();
      const isHealthy = health.status === "ok";
      this.state = new PythonRuntimeState({
        status: isHealthy ? PythonRuntimeStatuses.healthy : PythonRuntimeStatuses.unhealthy,
        owner: isHealthy ? PythonRuntimeOwnership.external : PythonRuntimeOwnership.none,
        detail: isHealthy ? undefined : "Python runtime endpoint is reachable but not healthy.",
      });

      if (isHealthy) {
        this.emitInfo("Python runtime is healthy.");
      } else {
        this.emitInfo("Python runtime endpoint reported an unhealthy status.");
      }

      return isHealthy;
    } catch {
      this.state = new PythonRuntimeState({
        status: PythonRuntimeStatuses.unavailable,
        owner: PythonRuntimeOwnership.none,
        detail: "Python runtime endpoint is unavailable from the browser environment.",
      });
      this.emitInfo("Python runtime is unavailable from the browser environment.");
      return false;
    }
  }

  public async ensureRuntimeAvailability(): Promise<PythonRuntimeManagerStatus> {
    await this.checkAvailability();

    if (!this.state.isAvailable) {
      this.emitInfo("Browser UI will continue without managing a local Python runtime process.");
    }

    return this.state;
  }

  public async stopManagedRuntime(): Promise<void> {
    this.emitInfo("No managed Python runtime process is available in the browser environment.");
  }

  private emitInfo(message: string): void {
    this.eventSink.emit({ source: RuntimeEventSources.pythonRuntime, severity: "info", message });
  }
}
