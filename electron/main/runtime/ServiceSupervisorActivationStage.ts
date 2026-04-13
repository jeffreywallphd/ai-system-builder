import type { DesktopServiceSupervisor } from "../DesktopServiceSupervisor";
import type { DesktopPostLoginRuntimeStatusStore } from "../DesktopPostLoginRuntimeStatusStore";
import { DesktopStartupPhases } from "../DesktopStartupContract";
import {
  logPostLoginActivationDiagnostic,
  summarizeActivationError,
} from "./PostLoginActivationDiagnostics";
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
  const startedAtIso = new Date(supervisorStartAt).toISOString();
  input.postLoginRuntimeStatusStore.markServiceSupervisorStartupRunning();
  logPostLoginActivationDiagnostic({
    payload: {
      event: "desktop.post-login-activation.stage.started",
      stageId: "service-supervisor-startup",
      startedAt: startedAtIso,
      blockingDependency: "runtime-supervisor",
      dependencies: Object.freeze(["python-runtime", "runtime-supervisor"]),
      detail: "Starting desktop local service supervisor for runtime activation.",
    },
  });
  console.info("[ai-loom][startup] Starting desktop local service supervisor for post-login runtime.");
  try {
    await input.serviceSupervisor.start();
    const endedAt = Date.now();
    logPostLoginActivationDiagnostic({
      payload: {
        event: "desktop.post-login-activation.stage.completed",
        stageId: "service-supervisor-startup",
        startedAt: startedAtIso,
        endedAt: new Date(endedAt).toISOString(),
        durationMs: Math.max(0, endedAt - supervisorStartAt),
        blockingDependency: "runtime-supervisor",
        detail: `baseUrl=${input.serviceSupervisor.baseUrl}, runtimeBaseUrl=${input.serviceSupervisor.runtimeBaseUrl}`,
      },
    });
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
    const endedAt = Date.now();
    const summarizedError = summarizeActivationError(error);
    input.postLoginRuntimeStatusStore.markServiceSupervisorStartupBlocked(error);
    logPostLoginActivationDiagnostic({
      level: "error",
      payload: {
        event: "desktop.post-login-activation.stage.blocked",
        stageId: "service-supervisor-startup",
        startedAt: startedAtIso,
        endedAt: new Date(endedAt).toISOString(),
        durationMs: Math.max(0, endedAt - supervisorStartAt),
        blockingDependency: "runtime-supervisor",
        ...summarizedError,
      },
    });
    logInitializationEnd("desktop-startup.post-login-service-supervisor-start", supervisorStartAt);
    throw new ServiceSupervisorActivationStageError("Desktop service supervisor startup failed.", error);
  }
}
