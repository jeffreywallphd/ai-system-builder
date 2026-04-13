import type { DesktopServiceSupervisor } from "../DesktopServiceSupervisor";
import type { DesktopPostLoginRuntimeStatusStore } from "../DesktopPostLoginRuntimeStatusStore";
import { DesktopStartupPhases } from "../DesktopStartupContract";
import {
  logInitializationCheckpoint,
  logInitializationEnd,
  logInitializationMemory,
  logInitializationStart,
} from "../InitializationLogging";

export class ServiceSupervisorActivationStageError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "ServiceSupervisorActivationStageError";
  }
}

export async function startServiceSupervisorActivationStage(input: {
  readonly serviceSupervisor: DesktopServiceSupervisor;
  readonly postLoginRuntimeStatusStore: DesktopPostLoginRuntimeStatusStore;
  readonly bootstrapStartedAt: number;
}): Promise<void> {
  const supervisorStartAt = logInitializationStart("desktop-startup.post-login-service-supervisor-start");
  input.postLoginRuntimeStatusStore.markServiceSupervisorStartupRunning();
  console.info("[ai-loom][startup] Starting desktop local service supervisor for post-login runtime.");
  try {
    await input.serviceSupervisor.start();
    logInitializationEnd("desktop-startup.post-login-service-supervisor-start", supervisorStartAt);
    const stageDetail = {
      baseUrl: input.serviceSupervisor.baseUrl,
      runtimeBaseUrl: input.serviceSupervisor.runtimeBaseUrl,
    };
    input.postLoginRuntimeStatusStore.markServiceSupervisorStartupReady(stageDetail);
    console.info(
      `[ai-loom][startup] Desktop local service supervisor ready (baseUrl=${stageDetail.baseUrl}, runtimeBaseUrl=${stageDetail.runtimeBaseUrl}).`,
    );
    logInitializationCheckpoint(DesktopStartupPhases.postLoginWarmup, "local-service-supervisor-ready", input.bootstrapStartedAt);
    logInitializationMemory(DesktopStartupPhases.postLoginWarmup, "local-service-supervisor-ready");
  } catch (error) {
    input.postLoginRuntimeStatusStore.markServiceSupervisorStartupBlocked(error);
    logInitializationEnd("desktop-startup.post-login-service-supervisor-start", supervisorStartAt);
    throw new ServiceSupervisorActivationStageError("Desktop service supervisor startup failed.", error);
  }
}
