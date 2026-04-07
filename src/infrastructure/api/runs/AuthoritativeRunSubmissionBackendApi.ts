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
        return Object.freeze({
          ok: false,
          error: Object.freeze({
            code: SharedApiErrorCodes.conflict,
            message: "Run submission could not be accepted because the run already exists.",
          }),
        });
      }

      return Object.freeze({
        ok: false,
        error: Object.freeze({
          code: SharedApiErrorCodes.internal,
          message: "Run submission failed due to an internal server error.",
        }),
      });
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

