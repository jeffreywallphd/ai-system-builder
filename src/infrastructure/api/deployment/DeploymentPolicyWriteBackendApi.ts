import {
  type ApplyDeploymentPolicyAdministrationUpdatesResult,
  type DeploymentPolicyAdministrationAuthoritativeUpdateUseCase,
  DeploymentPolicyAdministrationUpdateErrorCodes,
} from "@application/policy-administration/use-cases/DeploymentPolicyAdministrationAuthoritativeUpdateUseCase";
import { SharedApiErrorCodes, type SharedApiResponseEnvelope } from "@shared/contracts/api/SharedApiContractPrimitives";
import type {
  ApplyDeploymentPolicyOverrideOperationsRequest,
  ApplyDeploymentPolicyOverrideOperationsResponse,
  UpdateDeploymentPolicyActiveProfileRequest,
  UpdateDeploymentPolicyActiveProfileResponse,
} from "@shared/contracts/deployment/DeploymentPolicyWriteContracts";
import { DeploymentPolicyPersistenceScopeKinds } from "@shared/dto/deployment/DeploymentPolicyAdministrationPersistenceDtos";
import {
  DeploymentPolicyWriteSchemaValidationError,
  parseApplyDeploymentPolicyOverrideOperationsRequest,
  parseApplyDeploymentPolicyOverrideOperationsResponse,
  parseUpdateDeploymentPolicyActiveProfileRequest,
  parseUpdateDeploymentPolicyActiveProfileResponse,
} from "@shared/schemas/deployment/DeploymentPolicyWriteSchemaContracts";

export interface DeploymentPolicyWriteApiRequestContext {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
}

export interface DeploymentPolicyWriteBackendApiDependencies {
  readonly updateDeploymentPolicyStateUseCase: DeploymentPolicyAdministrationAuthoritativeUpdateUseCase;
}

export class DeploymentPolicyWriteBackendApi {
  public constructor(private readonly dependencies: DeploymentPolicyWriteBackendApiDependencies) {}

  public async updateActiveProfile(
    context: DeploymentPolicyWriteApiRequestContext,
    request: UpdateDeploymentPolicyActiveProfileRequest,
  ): Promise<SharedApiResponseEnvelope<UpdateDeploymentPolicyActiveProfileResponse>> {
    let parsedRequest: UpdateDeploymentPolicyActiveProfileRequest;
    try {
      parsedRequest = parseUpdateDeploymentPolicyActiveProfileRequest(request);
    } catch (error) {
      if (error instanceof DeploymentPolicyWriteSchemaValidationError) {
        return this.failedValidation(error);
      }
      throw error;
    }

    let outcome: Awaited<ReturnType<DeploymentPolicyAdministrationAuthoritativeUpdateUseCase["execute"]>>;
    try {
      outcome = await this.dependencies.updateDeploymentPolicyStateUseCase.execute({
        scope: Object.freeze({
          kind: DeploymentPolicyPersistenceScopeKinds.deploymentPolicyScope,
          scopeId: context.workspaceId,
        }),
        actorUserIdentityId: context.actorUserIdentityId,
        dryRun: parsedRequest.dryRun,
        occurredAt: parsedRequest.occurredAt,
        reason: parsedRequest.reason,
        ticketReference: parsedRequest.ticketReference,
        correlationId: parsedRequest.correlationId,
        expectedRevision: parsedRequest.expectedRevision,
        operations: Object.freeze([Object.freeze({
          kind: "set-active-profile" as const,
          profileId: parsedRequest.profileId,
        })]),
      });
    } catch (error) {
      return this.internalFailure(error);
    }

    if (!outcome.ok) {
      return this.failedOutcome(outcome.error);
    }

    const response = Object.freeze({
      result: this.toWriteResult(outcome.value),
    }) satisfies UpdateDeploymentPolicyActiveProfileResponse;
    parseUpdateDeploymentPolicyActiveProfileResponse(response);

    return Object.freeze({
      ok: true,
      data: response,
    });
  }

  public async applyOverrideOperations(
    context: DeploymentPolicyWriteApiRequestContext,
    request: ApplyDeploymentPolicyOverrideOperationsRequest,
  ): Promise<SharedApiResponseEnvelope<ApplyDeploymentPolicyOverrideOperationsResponse>> {
    let parsedRequest: ApplyDeploymentPolicyOverrideOperationsRequest;
    try {
      parsedRequest = parseApplyDeploymentPolicyOverrideOperationsRequest(request);
    } catch (error) {
      if (error instanceof DeploymentPolicyWriteSchemaValidationError) {
        return this.failedValidation(error);
      }
      throw error;
    }

    let outcome: Awaited<ReturnType<DeploymentPolicyAdministrationAuthoritativeUpdateUseCase["execute"]>>;
    try {
      outcome = await this.dependencies.updateDeploymentPolicyStateUseCase.execute({
        scope: Object.freeze({
          kind: DeploymentPolicyPersistenceScopeKinds.deploymentPolicyScope,
          scopeId: context.workspaceId,
        }),
        actorUserIdentityId: context.actorUserIdentityId,
        dryRun: parsedRequest.dryRun,
        occurredAt: parsedRequest.occurredAt,
        reason: parsedRequest.reason,
        ticketReference: parsedRequest.ticketReference,
        correlationId: parsedRequest.correlationId,
        expectedRevision: parsedRequest.expectedRevision,
        operations: Object.freeze([Object.freeze({
          kind: "apply-override-operations" as const,
          command: Object.freeze({
            profileId: parsedRequest.profileId,
            actorUserIdentityId: context.actorUserIdentityId,
            submittedAt: parsedRequest.submittedAt,
            expectedRevision: parsedRequest.expectedRevision,
            dryRun: parsedRequest.dryRun,
            operations: Object.freeze(parsedRequest.operations.map((operation) => Object.freeze({
              operation: operation.operation,
              familyId: operation.familyId,
              settingKey: operation.settingKey,
              value: operation.value,
              valueType: operation.valueType,
              expectedControlMode: operation.expectedControlMode,
              provenance: operation.provenance
                ? Object.freeze({
                  ticketReference: operation.provenance.ticketReference,
                  reason: operation.provenance.reason,
                  updatedAt: operation.provenance.updatedAt,
                })
                : undefined,
            }))),
          }),
        })]),
      });
    } catch (error) {
      return this.internalFailure(error);
    }

    if (!outcome.ok) {
      return this.failedOutcome(outcome.error);
    }

    const response = Object.freeze({
      result: this.toWriteResult(outcome.value),
    }) satisfies ApplyDeploymentPolicyOverrideOperationsResponse;
    parseApplyDeploymentPolicyOverrideOperationsResponse(response);

    return Object.freeze({
      ok: true,
      data: response,
    });
  }

  private toWriteResult(input: ApplyDeploymentPolicyAdministrationUpdatesResult): ApplyDeploymentPolicyOverrideOperationsResponse["result"] {
    return Object.freeze({
      scope: input.scope,
      dryRun: input.dryRun,
      validation: input.validation,
      activeProfileSelection: input.activeProfileSelection,
      overrideMutations: input.overrideMutations,
      effectiveMetadata: input.effectiveMetadata,
      snapshot: input.snapshot,
    });
  }

  private failedValidation(
    error: DeploymentPolicyWriteSchemaValidationError,
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

  private failedOutcome(
    error: {
      readonly code: string;
      readonly message: string;
      readonly validation?: {
        readonly issues: ReadonlyArray<{
          readonly path: string;
          readonly code: string;
          readonly message: string;
        }>;
      };
    },
  ): SharedApiResponseEnvelope<never> {
    if (error.code === DeploymentPolicyAdministrationUpdateErrorCodes.forbidden) {
      return Object.freeze({
        ok: false,
        error: Object.freeze({
          code: SharedApiErrorCodes.forbidden,
          message: error.message,
          validationErrors: this.toValidationErrors(error.validation),
        }),
      });
    }

    if (error.code === DeploymentPolicyAdministrationUpdateErrorCodes.persistenceConflict) {
      return Object.freeze({
        ok: false,
        error: Object.freeze({
          code: SharedApiErrorCodes.conflict,
          message: error.message,
          validationErrors: this.toValidationErrors(error.validation),
        }),
      });
    }

    if (
      error.code === DeploymentPolicyAdministrationUpdateErrorCodes.invalidRequest
      || error.code === DeploymentPolicyAdministrationUpdateErrorCodes.validationFailed
    ) {
      return Object.freeze({
        ok: false,
        error: Object.freeze({
          code: SharedApiErrorCodes.invalidRequest,
          message: error.message,
          validationErrors: this.toValidationErrors(error.validation),
        }),
      });
    }

    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code: SharedApiErrorCodes.internal,
        message: error.message,
        validationErrors: this.toValidationErrors(error.validation),
      }),
    });
  }

  private toValidationErrors(
    validation: { readonly issues: ReadonlyArray<{ readonly path: string; readonly code: string; readonly message: string }> } | undefined,
  ): ReadonlyArray<{ readonly path: string; readonly code: string; readonly message: string }> | undefined {
    if (!validation || validation.issues.length < 1) {
      return undefined;
    }

    return Object.freeze(validation.issues.map((issue) => Object.freeze({
      path: issue.path,
      code: issue.code,
      message: issue.message,
    })));
  }

  private internalFailure(error: unknown): SharedApiResponseEnvelope<never> {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code: SharedApiErrorCodes.internal,
        message: error instanceof Error ? error.message : "Unknown deployment policy write failure.",
      }),
    });
  }
}
