import { describe, expect, it } from "bun:test";
import {
  RunOrchestrationTransportContractVersions,
  type RunDetail,
} from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
import { RunSubmissionValidationErrorCodes } from "@application/runs/use-cases/RunSubmissionValidationContracts";
import { AuthoritativeRunSubmissionBackendApi } from "../AuthoritativeRunSubmissionBackendApi";
import { AssetBackedRunSubmissionTargetResolver } from "../AssetBackedRunSubmissionTargetResolver";
import type { RunOrchestrationRealtimePublisher } from "../RunOrchestrationRealtimePublisher";
import {
  RunOrchestrationObservability,
  type RunOrchestrationObservabilityLogEvent,
  type RunOrchestrationObservabilityLogger,
} from "../RunOrchestrationObservability";

class CapturingRunObservabilityLogger implements RunOrchestrationObservabilityLogger {
  public readonly infoEvents: RunOrchestrationObservabilityLogEvent[] = [];
  public readonly warnEvents: RunOrchestrationObservabilityLogEvent[] = [];
  public readonly errorEvents: RunOrchestrationObservabilityLogEvent[] = [];

  public info(event: RunOrchestrationObservabilityLogEvent): void {
    this.infoEvents.push(event);
  }

  public warn(event: RunOrchestrationObservabilityLogEvent): void {
    this.warnEvents.push(event);
  }

  public error(event: RunOrchestrationObservabilityLogEvent): void {
    this.errorEvents.push(event);
  }
}

describe("AuthoritativeRunSubmissionBackendApi", () => {
  it("returns canonical run submission acceptance payload when validation passes", async () => {
    const realtimeEvents: Array<{ type: "run" | "queue"; payload: unknown }> = [];
    const realtimePublisher: RunOrchestrationRealtimePublisher = Object.freeze({
      publishRunStatus: (input) => {
        realtimeEvents.push({ type: "run", payload: input.payload });
      },
      publishQueueMovement: (input) => {
        realtimeEvents.push({ type: "queue", payload: input.payload });
      },
    });
    const backend = new AuthoritativeRunSubmissionBackendApi({
      submitImageRunUseCase: {
        execute: async () => Object.freeze({
          ok: true as const,
          response: Object.freeze({
            run: createRunDetail("run:1"),
            mutation: Object.freeze({
              changed: true,
              mutationId: "audit:1",
              occurredAt: "2026-04-07T12:00:00.000Z",
            }),
          }),
          readiness: createReadySubmissionReadiness(),
          warnings: Object.freeze([]),
        }),
      } as any,
      realtimePublisher,
    });

    const response = await backend.submitRun({
      actorUserIdentityId: "user:1",
      workspaceId: "workspace-alpha",
      submission: Object.freeze({
        runtimeTarget: Object.freeze({
          systemId: "system-demo",
          versionId: "version-1",
          async: true,
        }),
      }),
    });

    expect(response.ok).toBe(true);
    expect(response.data?.run.runId).toBe("run:1");
    expect(response.data?.mutation.changed).toBe(true);
    expect(response.data?.mutation.mutationId).toBe("audit:1");
    expect(realtimeEvents).toHaveLength(2);
    expect(realtimeEvents[0]?.type).toBe("run");
    expect(realtimeEvents[1]?.type).toBe("queue");
    expect((realtimeEvents[0]?.payload as { eventKind?: string }).eventKind).toBe("submission-accepted");
    expect((realtimeEvents[1]?.payload as { eventKind?: string }).eventKind).toBe("queue-enqueued");
  });

  it("maps policy-ineligible validation denials to stable forbidden semantics with validation details", async () => {
    const backend = new AuthoritativeRunSubmissionBackendApi({
      submitImageRunUseCase: {
        execute: async () => Object.freeze({
          ok: false as const,
          error: Object.freeze({
            code: RunSubmissionValidationErrorCodes.policyIneligible,
            message: "Run submission is policy-ineligible.",
            validationIssues: Object.freeze([Object.freeze({
              kind: "policy",
              path: "submission.parameters.unsafe",
              code: "parameter-not-allowed",
              message: "Parameter is not allowed.",
            })]),
          }),
        }),
      } as any,
    });

    const response = await backend.submitRun({
      actorUserIdentityId: "user:1",
      workspaceId: "workspace-alpha",
      submission: Object.freeze({
        runtimeTarget: Object.freeze({
          systemId: "system-demo",
          versionId: "version-1",
          async: true,
        }),
      }),
    });

    expect(response.ok).toBe(false);
    expect(response.error?.code).toBe("forbidden");
    expect(response.error?.domainCode).toBe("policy-ineligible");
    expect(response.error?.validationErrors?.[0]?.path).toBe("submission.parameters.unsafe");
  });

  it("maps run-creation conflicts to shared conflict error responses", async () => {
    const backend = new AuthoritativeRunSubmissionBackendApi({
      submitImageRunUseCase: {
        execute: async () => {
          throw new Error("Platform run 'run:1' already exists.");
        },
      } as any,
    });

    const response = await backend.submitRun({
      actorUserIdentityId: "user:1",
      workspaceId: "workspace-alpha",
      submission: Object.freeze({
        runtimeTarget: Object.freeze({
          systemId: "system-demo",
          versionId: "version-1",
          async: true,
        }),
      }),
    });

    expect(response.ok).toBe(false);
    expect(response.error?.code).toBe("conflict");
  });

  it("emits correlatable and redacted observability records for validation-denied submission", async () => {
    const logger = new CapturingRunObservabilityLogger();
    const observability = new RunOrchestrationObservability({ logger });
    const backend = new AuthoritativeRunSubmissionBackendApi({
      submitImageRunUseCase: {
        execute: async () => Object.freeze({
          ok: false as const,
          error: Object.freeze({
            code: RunSubmissionValidationErrorCodes.invalidRequest,
            message: "payload invalid",
            validationIssues: Object.freeze([]),
          }),
        }),
      } as any,
      observability,
    });

    const response = await backend.submitRun({
      actorUserIdentityId: "user:1",
      workspaceId: "workspace-alpha",
      submission: Object.freeze({
        clientRequestId: "client-request-1",
        correlationId: "corr-123",
        runtimeTarget: Object.freeze({
          systemId: "system-demo",
          versionId: "version-1",
          async: true,
        }),
        parameters: Object.freeze({
          prompt: "should never be logged",
        }),
      }),
    });

    expect(response.ok).toBeFalse();
    expect(logger.warnEvents).toHaveLength(1);
    expect(logger.warnEvents[0]?.correlationId).toBe("corr-123");
    expect(logger.warnEvents[0]?.requestId).toBe("client-request-1");
    const serialized = JSON.stringify(logger.warnEvents[0]);
    expect(serialized).not.toContain("should never be logged");
    expect(serialized).toContain("[REDACTED]");
  });
});

describe("AssetBackedRunSubmissionTargetResolver", () => {
  it("resolves target availability from workspace-scoped persisted assets and versions", async () => {
    const resolver = new AssetBackedRunSubmissionTargetResolver({
      findAssetById: async (assetId: string) => assetId === "system-demo"
        ? Object.freeze({
          id: "system-demo",
          ownership: Object.freeze({
            workspaceId: "workspace-alpha",
          }),
          lifecycle: Object.freeze({
            state: "active",
          }),
          versions: Object.freeze([Object.freeze({ versionId: "version-1" })]),
        })
        : undefined,
    } as any);

    const resolved = await resolver.resolveRunSubmissionTarget({
      workspaceId: "workspace-alpha",
      systemId: "system-demo",
      versionId: "version-1",
    });
    const workspaceMismatch = await resolver.resolveRunSubmissionTarget({
      workspaceId: "workspace-beta",
      systemId: "system-demo",
      versionId: "version-1",
    });

    expect(resolved.systemExists).toBe(true);
    expect(resolved.versionExists).toBe(true);
    expect(workspaceMismatch.systemExists).toBe(false);
  });

  it("treats deleted assets as unavailable runtime targets", async () => {
    const resolver = new AssetBackedRunSubmissionTargetResolver({
      findAssetById: async () => Object.freeze({
        id: "system-demo",
        ownership: Object.freeze({
          workspaceId: "workspace-alpha",
        }),
        lifecycle: Object.freeze({
          state: "deleted",
        }),
        versions: Object.freeze([Object.freeze({ versionId: "version-1" })]),
      }),
    } as any);

    const resolved = await resolver.resolveRunSubmissionTarget({
      workspaceId: "workspace-alpha",
      systemId: "system-demo",
      versionId: "version-1",
    });
    expect(resolved.systemExists).toBe(false);
    expect(resolved.versionExists).toBe(false);
  });
});

function createRunDetail(runId: string): RunDetail {
  return Object.freeze({
    contractVersion: RunOrchestrationTransportContractVersions.v1,
    runId,
    workflowId: "system:system-demo:version-1",
    workspaceId: "workspace-alpha",
    source: "api",
    state: "submitted",
    assignmentStatus: "unassigned",
    executionOutcome: "none",
    submittedAt: "2026-04-07T12:00:00.000Z",
    updatedAt: "2026-04-07T12:00:00.000Z",
    submission: Object.freeze({
      submittedByActorId: "user:1",
    }),
    assignment: Object.freeze({
      status: "unassigned",
    }),
    execution: Object.freeze({
      outcome: "none",
    }),
    retry: Object.freeze({
      attempt: 1,
      maxAttempts: 1,
    }),
  });
}

function createReadySubmissionReadiness() {
  return Object.freeze({
    checkedAt: "2026-04-07T12:00:00.000Z",
    state: "ready" as const,
    readyForQueueing: true,
    summary: "Run submission is ready for queue admission.",
    issues: Object.freeze([]),
    blockingIssues: Object.freeze([]),
    advisoryIssues: Object.freeze([]),
    policyDenials: Object.freeze([]),
    assetBinding: Object.freeze({
      complete: true,
      missingInputBindingIds: Object.freeze([]),
      missingOutputBindingIds: Object.freeze([]),
      unresolvedAssetReferences: Object.freeze([]),
    }),
    workflowValidity: Object.freeze({
      valid: true,
      issues: Object.freeze([]),
    }),
    systemValidity: Object.freeze({
      valid: true,
      issues: Object.freeze([]),
    }),
    backendReadinessDependency: Object.freeze({
      adapterHealth: "healthy" as const,
      ready: true,
      issues: Object.freeze([]),
    }),
    compatibility: Object.freeze({
      compatible: true,
      issues: Object.freeze([]),
    }),
  });
}
