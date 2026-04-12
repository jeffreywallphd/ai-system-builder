import type { SystemRuntimeBackendApi } from "@infrastructure/api/system-runtime/SystemRuntimeBackendApi";
import type { RunOrchestrationRealtimePublisher } from "./RunOrchestrationRealtimePublisher";

export class RuntimeBackendRunRealtimePublisher implements RunOrchestrationRealtimePublisher {
  public constructor(
    private readonly runtimeBackendApi: Pick<SystemRuntimeBackendApi, "publishRuntimeRunStatus" | "publishRuntimeQueueMovement">,
  ) {}

  public publishRunStatus(input: Parameters<RunOrchestrationRealtimePublisher["publishRunStatus"]>[0]): void {
    this.runtimeBackendApi.publishRuntimeRunStatus(input);
  }

  public publishQueueMovement(input: Parameters<RunOrchestrationRealtimePublisher["publishQueueMovement"]>[0]): void {
    this.runtimeBackendApi.publishRuntimeQueueMovement(input);
  }
}
