import type {
  SharedApiResponseEnvelope,
} from "@shared/contracts/api/SharedApiContractPrimitives";
import { SharedApiErrorCodes } from "@shared/contracts/api/SharedApiContractPrimitives";
import type {
  RunLifecycleUpdateRequest,
  RunMutationResponse,
  RunStatusEnvelope,
} from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
import {
  IngestRunExecutionUpdateUseCase,
  RunExecutionUpdateConflictError,
  RunExecutionUpdateForbiddenError,
  RunExecutionUpdateNotFoundError,
  RunExecutionUpdateValidationError,
} from "@application/runs/use-cases/IngestRunExecutionUpdateUseCase";

export interface AuthoritativeRunExecutionUpdateRequest {
  readonly runId: string;
  readonly senderNodeId: string;
  readonly update: RunLifecycleUpdateRequest;
}

export interface AuthoritativeRunExecutionUpdateResponse {
  readonly mutation: RunMutationResponse;
  readonly status: RunStatusEnvelope;
}

export interface AuthoritativeRunExecutionUpdateBackendApiDependencies {
  readonly ingestRunExecutionUpdateUseCase: IngestRunExecutionUpdateUseCase;
}

export class AuthoritativeRunExecutionUpdateBackendApi {
  public constructor(private readonly dependencies: AuthoritativeRunExecutionUpdateBackendApiDependencies) {}

  public async ingestExecutionUpdate(
    request: AuthoritativeRunExecutionUpdateRequest,
  ): Promise<SharedApiResponseEnvelope<AuthoritativeRunExecutionUpdateResponse>> {
    try {
      const ingested = await this.dependencies.ingestRunExecutionUpdateUseCase.execute({
        runId: request.runId,
        senderNodeId: request.senderNodeId,
        update: request.update,
      });

      return Object.freeze({
        ok: true,
        data: Object.freeze({
          mutation: ingested.mutation,
          status: ingested.status,
        }),
      });
    } catch (error) {
      return toExecutionUpdateErrorEnvelope(error);
    }
  }
}

function toExecutionUpdateErrorEnvelope(
  error: unknown,
): SharedApiResponseEnvelope<never> {
  if (error instanceof RunExecutionUpdateValidationError) {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code: SharedApiErrorCodes.invalidRequest,
        message: error.message,
      }),
    });
  }
  if (error instanceof RunExecutionUpdateNotFoundError) {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code: SharedApiErrorCodes.notFound,
        message: error.message,
      }),
    });
  }
  if (error instanceof RunExecutionUpdateForbiddenError) {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code: SharedApiErrorCodes.forbidden,
        message: error.message,
      }),
    });
  }
  if (error instanceof RunExecutionUpdateConflictError) {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code: SharedApiErrorCodes.conflict,
        message: error.message,
      }),
    });
  }

  const message = error instanceof Error ? error.message : "Run execution update failed.";
  if (message.includes("cannot transition")) {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code: SharedApiErrorCodes.conflict,
        message,
      }),
    });
  }
  if (
    message.includes("requires")
    || message.includes("must be")
    || message.includes("cannot be")
  ) {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code: SharedApiErrorCodes.invalidRequest,
        message,
      }),
    });
  }

  return Object.freeze({
    ok: false,
    error: Object.freeze({
      code: SharedApiErrorCodes.internal,
      message: "Run execution update failed due to an internal server error.",
    }),
  });
}
