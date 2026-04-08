import type {
  SharedApiErrorCode,
  SharedApiResponseEnvelope,
  SharedApiValidationIssue,
} from "@shared/contracts/api/SharedApiContractPrimitives";
import {
  SharedApiErrorCodes,
} from "@shared/contracts/api/SharedApiContractPrimitives";
import type {
  RunSubmissionAcceptedResponse,
  RunSubmissionRequest,
} from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
import {
  RunSubmissionValidationErrorCodes,
} from "@application/runs/use-cases/RunSubmissionValidationContracts";
import type { SubmitImageRunUseCase } from "@application/runs/use-cases/SubmitImageRunUseCase";
import {
  buildQueueMovementPayload,
  buildRunStatusPayload,
  publishRunOrchestrationRealtimeEventsBestEffort,
  type RunOrchestrationRealtimePublisher,
} from "./RunOrchestrationRealtimePublisher";
import { RunOrchestrationObservability } from "./RunOrchestrationObservability";

export interface AuthoritativeRunSubmissionRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly submission: RunSubmissionRequest & {
    readonly templateId?: string;
    readonly parameters?: Readonly<Record<string, unknown>>;
  };
  readonly occurredAt?: string;
}

export interface AuthoritativeRunSubmissionBackendApiDependencies {
  readonly submitImageRunUseCase: SubmitImageRunUseCase;
  readonly realtimePublisher?: RunOrchestrationRealtimePublisher;
  readonly observability?: RunOrchestrationObservability;
}

export class AuthoritativeRunSubmissionBackendApi {
  public constructor(private readonly dependencies: AuthoritativeRunSubmissionBackendApiDependencies) {}

  public async submitRun(
    request: AuthoritativeRunSubmissionRequest,
  ): Promise<SharedApiResponseEnvelope<RunSubmissionAcceptedResponse>> {
    try {
      const submission = await this.dependencies.submitImageRunUseCase.execute({
        actor: Object.freeze({
          actorUserIdentityId: request.actorUserIdentityId,
          activeWorkspaceId: request.workspaceId,
        }),
        workspaceId: request.workspaceId,
        submission: request.submission,
        occurredAt: request.occurredAt,
      });

      if (!submission.ok) {
        await this.recordObservability({
          event: "run.orchestration.submission.completed",
          operation: "submission",
          outcome: "failure",
          severity: submission.error.code === RunSubmissionValidationErrorCodes.invalidRequest ? "warn" : "error",
          requestId: request.submission.clientRequestId,
          correlationId: request.submission.correlationId,
          workspaceId: request.workspaceId,
          markers: Object.freeze(["submission-validation-failed"]),
          details: Object.freeze({
            code: submission.error.code,
            message: submission.error.message,
            issueCount: submission.error.validationIssues.length,
            request: Object.freeze({
              source: request.submission.source,
              runtimeTarget: request.submission.runtimeTarget,
              tagsCount: request.submission.tags?.length ?? 0,
              hasTemplateId: typeof request.submission.templateId === "string",
              hasParameters: typeof request.submission.parameters === "object",
            }),
          }),
        });
        return this.buildValidationFailure(submission);
      }

      await publishRunOrchestrationRealtimeEventsBestEffort(async () => {
        this.dependencies.realtimePublisher?.publishRunStatus({
          actorUserIdentityId: request.actorUserIdentityId,
          workspaceId: submission.response.run.workspaceId ?? request.workspaceId,
          payload: buildRunStatusPayload({
            run: submission.response.run,
            eventKind: "submission-accepted",
            changedAt: submission.response.mutation.occurredAt,
          }),
        });
        this.dependencies.realtimePublisher?.publishQueueMovement({
          actorUserIdentityId: request.actorUserIdentityId,
          workspaceId: submission.response.run.workspaceId ?? request.workspaceId,
          payload: buildQueueMovementPayload({
            run: submission.response.run,
            eventKind: "queue-enqueued",
            changedAt: submission.response.mutation.occurredAt,
          }),
        });
      });
      await this.recordObservability({
        event: "run.orchestration.submission.completed",
        operation: "submission",
        outcome: "success",
        severity: "info",
        requestId: request.submission.clientRequestId,
        correlationId: submission.response.run.submission.correlationId ?? request.submission.correlationId,
        runId: submission.response.run.runId,
        workspaceId: submission.response.run.workspaceId ?? request.workspaceId,
        lifecycleState: submission.response.run.state,
        markers: Object.freeze(["submission-accepted", "queue-enqueued"]),
        counters: Object.freeze({
          queue_position: submission.response.run.queue?.position ?? -1,
        }),
      });

      return Object.freeze({
        ok: true,
        data: submission.response,
      });
    } catch (error) {
      if (isConflictError(error)) {
        await this.recordObservability({
          event: "run.orchestration.submission.completed",
          operation: "submission",
          outcome: "failure",
          severity: "warn",
          requestId: request.submission.clientRequestId,
          correlationId: request.submission.correlationId,
          workspaceId: request.workspaceId,
          markers: Object.freeze(["submission-conflict"]),
          details: Object.freeze({
            reason: "run-already-exists",
          }),
        });
        return Object.freeze({
          ok: false,
          error: Object.freeze({
            code: SharedApiErrorCodes.conflict,
            message: "Run submission could not be accepted because the run already exists.",
          }),
        });
      }

      await this.recordObservability({
        event: "run.orchestration.submission.completed",
        operation: "submission",
        outcome: "failure",
        severity: "error",
        requestId: request.submission.clientRequestId,
        correlationId: request.submission.correlationId,
        workspaceId: request.workspaceId,
        markers: Object.freeze(["submission-internal-error"]),
        details: Object.freeze({
          error,
        }),
      });

      return Object.freeze({
        ok: false,
        error: Object.freeze({
          code: SharedApiErrorCodes.internal,
          message: "Run submission failed due to an internal server error.",
        }),
      });
    }
  }

  private async recordObservability(
    event: Parameters<RunOrchestrationObservability["record"]>[0],
  ): Promise<void> {
    if (!this.dependencies.observability) {
      return;
    }
    try {
      await this.dependencies.observability.record(event);
    } catch {
      // Observability failures are intentionally non-blocking.
    }
  }

  private buildValidationFailure(
    validation: {
      readonly error: {
        readonly code: typeof RunSubmissionValidationErrorCodes[keyof typeof RunSubmissionValidationErrorCodes];
        readonly message: string;
        readonly validationIssues: ReadonlyArray<{
          readonly path: string;
          readonly code: string;
          readonly message: string;
        }>;
      };
    },
  ): SharedApiResponseEnvelope<RunSubmissionAcceptedResponse> {
    const code = mapValidationCodeToSharedCode(validation.error.code);
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code,
        message: validation.error.message,
        domainCode: validation.error.code,
        sharedCode: code,
        validationErrors: Object.freeze(validation.error.validationIssues.map((issue): SharedApiValidationIssue => Object.freeze({
          path: issue.path,
          code: issue.code,
          message: issue.message,
        }))),
      }),
    });
  }
}

function mapValidationCodeToSharedCode(
  code: typeof RunSubmissionValidationErrorCodes[keyof typeof RunSubmissionValidationErrorCodes],
): SharedApiErrorCode {
  switch (code) {
    case RunSubmissionValidationErrorCodes.invalidRequest:
      return SharedApiErrorCodes.invalidRequest;
    case RunSubmissionValidationErrorCodes.notFound:
      return SharedApiErrorCodes.notFound;
    case RunSubmissionValidationErrorCodes.forbidden:
    case RunSubmissionValidationErrorCodes.policyIneligible:
      return SharedApiErrorCodes.forbidden;
    default:
      return SharedApiErrorCodes.internal;
  }
}

function isConflictError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return message.includes("already exists") || message.includes("conflict");
}

