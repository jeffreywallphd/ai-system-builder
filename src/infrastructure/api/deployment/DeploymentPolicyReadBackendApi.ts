import {
  ReadDeploymentPolicyAdministrationPermissionError,
  type ReadDeploymentPolicyAdministrationUseCase,
} from "@application/policy-administration/use-cases/ReadDeploymentPolicyAdministrationUseCase";
import { SharedApiErrorCodes, type SharedApiResponseEnvelope } from "@shared/contracts/api/SharedApiContractPrimitives";
import type { ReadDeploymentPolicyStateResponse } from "@shared/contracts/deployment/DeploymentPolicyReadContracts";
import { DeploymentPolicyPersistenceScopeKinds } from "@shared/dto/deployment/DeploymentPolicyAdministrationPersistenceDtos";
import {
  DeploymentPolicyReadSchemaValidationError,
  parseReadDeploymentPolicyStateRequest,
  parseReadDeploymentPolicyStateResponse,
} from "@shared/schemas/deployment/DeploymentPolicyReadSchemaContracts";

export interface DeploymentPolicyReadApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly profileId?: "home" | "classroom" | "organization";
  readonly includeCatalog?: boolean;
  readonly includeOverrideRecords?: boolean;
  readonly includeEffectiveMetadata?: boolean;
  readonly evaluatedAt?: string;
}

export interface DeploymentPolicyReadBackendApiDependencies {
  readonly readDeploymentPolicyStateUseCase: ReadDeploymentPolicyAdministrationUseCase;
}

export class DeploymentPolicyReadBackendApi {
  public constructor(private readonly dependencies: DeploymentPolicyReadBackendApiDependencies) {}

  public async readPolicyState(
    request: DeploymentPolicyReadApiRequest,
  ): Promise<SharedApiResponseEnvelope<ReadDeploymentPolicyStateResponse>> {
    let parsedRequest: ReturnType<typeof parseReadDeploymentPolicyStateRequest>;
    try {
      parsedRequest = parseReadDeploymentPolicyStateRequest({
        scope: {
          kind: DeploymentPolicyPersistenceScopeKinds.deploymentPolicyScope,
          scopeId: request.workspaceId,
        },
        actorUserIdentityId: request.actorUserIdentityId,
        profileId: request.profileId,
        includeCatalog: request.includeCatalog,
        includeOverrideRecords: request.includeOverrideRecords,
        includeEffectiveMetadata: request.includeEffectiveMetadata,
        evaluatedAt: request.evaluatedAt,
      });
    } catch (error) {
      if (error instanceof DeploymentPolicyReadSchemaValidationError) {
        return this.failedValidation(error);
      }
      throw error;
    }

    try {
      const result = await this.dependencies.readDeploymentPolicyStateUseCase.execute(parsedRequest);
      parseReadDeploymentPolicyStateResponse(result);
      return Object.freeze({
        ok: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof ReadDeploymentPolicyAdministrationPermissionError) {
        return Object.freeze({
          ok: false,
          error: Object.freeze({
            code: SharedApiErrorCodes.forbidden,
            message: error.reason ?? error.message,
          }),
        });
      }
      const message = error instanceof Error ? error.message : "Unknown deployment policy read failure.";
      return Object.freeze({
        ok: false,
        error: Object.freeze({
          code: SharedApiErrorCodes.internal,
          message,
        }),
      });
    }
  }

  private failedValidation(
    error: DeploymentPolicyReadSchemaValidationError,
  ): SharedApiResponseEnvelope<never> {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code: SharedApiErrorCodes.invalidRequest,
        message: "Request validation failed.",
        validationErrors: Object.freeze(error.issues.map((issue) => Object.freeze({
          path: issue.path,
          code: issue.code,
          message: issue.message,
        }))),
      }),
    });
  }
}
