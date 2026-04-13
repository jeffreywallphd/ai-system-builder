import { describe, expect, it } from "bun:test";
import {
  ServiceSupervisorActivationStageError,
  startServiceSupervisorActivationStage,
} from "../runtime/ServiceSupervisorActivationStage";

describe("startServiceSupervisorActivationStage", () => {
  it("marks service supervisor startup running and ready with explicit base URLs", async () => {
    const operations: string[] = [];
    const serviceSupervisor = Object.freeze({
      baseUrl: "http://127.0.0.1:8790",
      runtimeBaseUrl: "http://127.0.0.1:8100",
      start: async () => {
        operations.push("supervisor:start");
      },
    });

    await startServiceSupervisorActivationStage({
      serviceSupervisor: serviceSupervisor as never,
      bootstrapStartedAt: Date.now(),
      postLoginRuntimeStatusStore: {
        markServiceSupervisorStartupRunning: () => operations.push("stage:running"),
        markServiceSupervisorStartupReady: (metadata) => {
          operations.push(`stage:ready:${metadata?.baseUrl}:${metadata?.runtimeBaseUrl}`);
        },
        markServiceSupervisorStartupBlocked: () => operations.push("stage:blocked"),
      } as never,
    });

    expect(operations).toEqual([
      "stage:running",
      "supervisor:start",
      "stage:ready:http://127.0.0.1:8790:http://127.0.0.1:8100",
    ]);
  });

  it("marks blocked and throws stage error when service supervisor startup fails", async () => {
    const operations: string[] = [];
    const failure = new Error("failed-to-bind-service-supervisor");
    const serviceSupervisor = Object.freeze({
      baseUrl: "http://127.0.0.1:8790",
      runtimeBaseUrl: "http://127.0.0.1:8100",
      start: async () => {
        operations.push("supervisor:start");
        throw failure;
      },
    });

    await expect(startServiceSupervisorActivationStage({
      serviceSupervisor: serviceSupervisor as never,
      bootstrapStartedAt: Date.now(),
      postLoginRuntimeStatusStore: {
        markServiceSupervisorStartupRunning: () => operations.push("stage:running"),
        markServiceSupervisorStartupReady: () => operations.push("stage:ready"),
        markServiceSupervisorStartupBlocked: (error) => {
          const message = error instanceof Error ? error.message : "unknown";
          operations.push(`stage:blocked:${message}`);
        },
      } as never,
    })).rejects.toBeInstanceOf(ServiceSupervisorActivationStageError);

    expect(operations).toEqual([
      "stage:running",
      "supervisor:start",
      "stage:blocked:failed-to-bind-service-supervisor",
    ]);
  });
});
