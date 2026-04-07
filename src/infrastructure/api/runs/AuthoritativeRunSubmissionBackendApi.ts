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
  type ValidateRunSubmissionResult,
} from "@application/runs/use-cases/RunSubmissionValidationContracts";
import type { ValidateRunSubmissionUseCase } from "@application/runs/use-cases/ValidateRunSubmissionUseCase";
import type { CreateAuthoritativeRunUseCase } from "@application/runs/use-cases/CreateAuthoritativeRunUseCase";
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
  readonly validateRunSubmissionUseCase: ValidateRunSubmissionUseCase;
  readonly createAuthoritativeRunUseCase: CreateAuthoritativeRunUseCase;
  readonly realtimePublisher?: RunOrchestrationRealtimePublisher;
  readonly observability?: RunOrchestrationObservability;
}

export class AuthoritativeRunSubmissionBackendApi {
  public constructor(private readonly dependencies: AuthoritativeRunSubmissionBackendApiDependencies) {}

  public async submitRun(
    request: AuthoritativeRunSubmissionRequest,
  ): Promise<SharedApiResponseEnvelope<RunSubmissionAcceptedResponse>> {
    try {
      const validation = await this.dependencies.validateRunSubmissionUseCase.execute({
        actor: Object.freeze({
          actorUserIdentityId: request.actorUserIdentityId,
          activeWorkspaceId: request.workspaceId,
        }),
        submission: Object.freeze({
          ...request.submission,
          workspaceId: request.workspaceId,
          submittedByActorId: request.actorUserIdentityId,
        }),
        occurredAt: request.occurredAt,
      });

      if (!validation.ok) {
        await this.recordObservability({
          event: "run.orchestration.submission.completed",
          operation: "submission",
          outcome: "failure",
          severity: validation.error.code === RunSubmissionValidationErrorCodes.invalidRequest ? "warn" : "error",
          requestId: request.submission.clientRequestId,
          correlationId: request.submission.correlationId,
          workspaceId: request.workspaceId,
          markers: Object.freeze(["submission-validation-failed"]),
          details: Object.freeze({
            code: validation.error.code,
            message: validation.error.message,
            issueCount: validation.error.validationIssues.length,
            request: Object.freeze({
              source: request.submission.source,
              runtimeTarget: request.submission.runtimeTarget,
              tagsCount: request.submission.tags?.length ?? 0,
              hasTemplateId: typeof request.submission.templateId === "string",
              hasParameters: typeof request.submission.parameters === "object",
            }),
          }),
        });
        return this.buildValidationFailure(validation);
      }

      const created = await this.dependencies.createAuthoritativeRunUseCase.execute({
        command: validation.command,
      });
      await publishRunOrchestrationRealtimeEventsBestEffort(async () => {
        this.dependencies.realtimePublisher?.publishRunStatus({
          actorUserIdentityId: request.actorUserIdentityId,
          workspaceId: created.run.workspaceId ?? request.workspaceId,
          payload: buildRunStatusPayload({
            run: created.run,
            eventKind: "submission-accepted",
            changedAt: validation.command.occurredAt,
          }),
        });
        this.dependencies.realtimePublisher?.publishQueueMovement({
          actorUserIdentityId: request.actorUserIdentityId,
          workspaceId: created.run.workspaceId ?? request.workspaceId,
          payload: buildQueueMovementPayload({
            run: created.run,
            eventKind: "queue-enqueued",
            changedAt: validation.command.occurredAt,
          }),
        });
      });
      await this.recordObservability({
        event: "run.orchestration.submission.completed",
        operation: "submission",
        outcome: "success",
        severity: "info",
        requestId: request.submission.clientRequestId,
        correlationId: created.run.submission.correlationId ?? request.submission.correlationId,
        runId: created.run.runId,
        workspaceId: created.run.workspaceId ?? request.workspaceId,
        lifecycleState: created.run.state,
        markers: Object.freeze(["submission-accepted", "queue-enqueued"]),
        counters: Object.freeze({
          queue_position: created.run.queue?.position ?? -1,
        }),
      });

      return Object.freeze({
        ok: true,
        data: Object.freeze({
          run: created.run,
          mutation: Object.freeze({
            changed: true,
            mutationId: created.orchestrationIntentEventId,
            occurredAt: validation.command.occurredAt,
          }),
        }),
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
    validation: Exclude<ValidateRunSubmissionResult, { readonly ok: true }>,
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

