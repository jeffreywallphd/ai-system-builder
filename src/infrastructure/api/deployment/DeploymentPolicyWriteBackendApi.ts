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
import {
  DeploymentPolicyAdministrationObservabilityOperations,
  DeploymentPolicyAdministrationObservabilityOutcomes,
  publishDeploymentPolicyAdministrationObservabilityBestEffort,
  type IDeploymentPolicyAdministrationObservabilityPort,
} from "@application/policy-administration/ports/DeploymentPolicyAdministrationObservabilityPorts";

export interface DeploymentPolicyWriteApiRequestContext {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly correlationId?: string;
}

export interface DeploymentPolicyWriteBackendApiDependencies {
  readonly updateDeploymentPolicyStateUseCase: DeploymentPolicyAdministrationAuthoritativeUpdateUseCase;
  readonly observabilityPort?: IDeploymentPolicyAdministrationObservabilityPort;
}

export class DeploymentPolicyWriteBackendApi {
  public constructor(private readonly dependencies: DeploymentPolicyWriteBackendApiDependencies) {}

  public async updateActiveProfile(
    context: DeploymentPolicyWriteApiRequestContext,
    request: UpdateDeploymentPolicyActiveProfileRequest,
  ): Promise<SharedApiResponseEnvelope<UpdateDeploymentPolicyActiveProfileResponse>> {
    const occurredAt = request.occurredAt ?? new Date().toISOString();
    let parsedRequest: UpdateDeploymentPolicyActiveProfileRequest;
    try {
      parsedRequest = parseUpdateDeploymentPolicyActiveProfileRequest(request);
    } catch (error) {
      if (error instanceof DeploymentPolicyWriteSchemaValidationError) {
        await this.publishSurfaceObservability({
          event: "deployment-policy-admin.surface.write.active-profile.rejected",
          occurredAt,
          outcome: DeploymentPolicyAdministrationObservabilityOutcomes.rejected,
          severity: "warn",
          context,
          details: Object.freeze({
            phase: "request-validation",
          }),
          counters: Object.freeze({
            validationIssueCount: error.issues.length,
          }),
        });
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
        correlationId: parsedRequest.correlationId ?? context.correlationId,
        expectedRevision: parsedRequest.expectedRevision,
        operations: Object.freeze([Object.freeze({
          kind: "set-active-profile" as const,
          profileId: parsedRequest.profileId,
        })]),
      });
    } catch (error) {
      await this.publishSurfaceObservability({
        event: "deployment-policy-admin.surface.write.active-profile.failed",
        occurredAt,
        outcome: DeploymentPolicyAdministrationObservabilityOutcomes.failure,
        severity: "error",
        context,
        details: Object.freeze({
          phase: "use-case-execute",
          message: error instanceof Error ? error.message : "Unknown write failure.",
        }),
      });
      return this.internalFailure(error);
    }

    if (!outcome.ok) {
      await this.publishSurfaceObservability({
        event: "deployment-policy-admin.surface.write.active-profile.rejected",
        occurredAt,
        outcome: outcome.error.code === DeploymentPolicyAdministrationUpdateErrorCodes.persistenceConflict
          ? DeploymentPolicyAdministrationObservabilityOutcomes.failure
          : DeploymentPolicyAdministrationObservabilityOutcomes.rejected,
        severity: outcome.error.code === DeploymentPolicyAdministrationUpdateErrorCodes.persistenceConflict
          ? "error"
          : "warn",
        context,
        details: Object.freeze({
          phase: "use-case-outcome",
          code: outcome.error.code,
        }),
        counters: Object.freeze({
          validationIssueCount: outcome.error.validation?.issues.length ?? 0,
        }),
      });
      return this.failedOutcome(outcome.error);
    }

    const response = Object.freeze({
      result: this.toWriteResult(outcome.value),
    }) satisfies UpdateDeploymentPolicyActiveProfileResponse;
    parseUpdateDeploymentPolicyActiveProfileResponse(response);

    await this.publishSurfaceObservability({
      event: "deployment-policy-admin.surface.write.active-profile.completed",
      occurredAt,
      outcome: DeploymentPolicyAdministrationObservabilityOutcomes.success,
      severity: "info",
      context,
      profileId: parsedRequest.profileId,
      counters: Object.freeze({
        validationIssueCount: outcome.value.validation.issues.length,
        overrideMutationCount: outcome.value.overrideMutations.length,
      }),
    });

    return Object.freeze({
      ok: true,
      data: response,
    });
  }

  public async applyOverrideOperations(
    context: DeploymentPolicyWriteApiRequestContext,
    request: ApplyDeploymentPolicyOverrideOperationsRequest,
  ): Promise<SharedApiResponseEnvelope<ApplyDeploymentPolicyOverrideOperationsResponse>> {
    const occurredAt = request.occurredAt ?? request.submittedAt ?? new Date().toISOString();
    let parsedRequest: ApplyDeploymentPolicyOverrideOperationsRequest;
    try {
      parsedRequest = parseApplyDeploymentPolicyOverrideOperationsRequest(request);
    } catch (error) {
      if (error instanceof DeploymentPolicyWriteSchemaValidationError) {
        await this.publishSurfaceObservability({
          event: "deployment-policy-admin.surface.write.overrides.rejected",
          occurredAt,
          outcome: DeploymentPolicyAdministrationObservabilityOutcomes.rejected,
          severity: "warn",
          context,
          details: Object.freeze({
            phase: "request-validation",
          }),
          counters: Object.freeze({
            validationIssueCount: error.issues.length,
          }),
        });
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
        correlationId: parsedRequest.correlationId ?? context.correlationId,
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
      await this.publishSurfaceObservability({
        event: "deployment-policy-admin.surface.write.overrides.failed",
        occurredAt,
        outcome: DeploymentPolicyAdministrationObservabilityOutcomes.failure,
        severity: "error",
        context,
        details: Object.freeze({
          phase: "use-case-execute",
          message: error instanceof Error ? error.message : "Unknown write failure.",
        }),
      });
      return this.internalFailure(error);
    }

    if (!outcome.ok) {
      await this.publishSurfaceObservability({
        event: "deployment-policy-admin.surface.write.overrides.rejected",
        occurredAt,
        outcome: outcome.error.code === DeploymentPolicyAdministrationUpdateErrorCodes.persistenceConflict
          ? DeploymentPolicyAdministrationObservabilityOutcomes.failure
          : DeploymentPolicyAdministrationObservabilityOutcomes.rejected,
        severity: outcome.error.code === DeploymentPolicyAdministrationUpdateErrorCodes.persistenceConflict
          ? "error"
          : "warn",
        context,
        details: Object.freeze({
          phase: "use-case-outcome",
          code: outcome.error.code,
        }),
        counters: Object.freeze({
          operationCount: parsedRequest.operations.length,
          validationIssueCount: outcome.error.validation?.issues.length ?? 0,
        }),
      });
      return this.failedOutcome(outcome.error);
    }

    const response = Object.freeze({
      result: this.toWriteResult(outcome.value),
    }) satisfies ApplyDeploymentPolicyOverrideOperationsResponse;
    parseApplyDeploymentPolicyOverrideOperationsResponse(response);

    await this.publishSurfaceObservability({
      event: "deployment-policy-admin.surface.write.overrides.completed",
      occurredAt,
      outcome: DeploymentPolicyAdministrationObservabilityOutcomes.success,
      severity: "info",
      context,
      profileId: parsedRequest.profileId,
      counters: Object.freeze({
        operationCount: parsedRequest.operations.length,
        overrideMutationCount: outcome.value.overrideMutations.length,
        validationIssueCount: outcome.value.validation.issues.length,
      }),
    });

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

  private async publishSurfaceObservability(input: {
    readonly event: string;
    readonly occurredAt: string;
    readonly outcome: "success" | "rejected" | "failure";
    readonly severity: "info" | "warn" | "error";
    readonly context: DeploymentPolicyWriteApiRequestContext;
    readonly profileId?: string;
    readonly details?: Readonly<Record<string, unknown>>;
    readonly counters?: Readonly<Record<string, number>>;
  }): Promise<void> {
    await publishDeploymentPolicyAdministrationObservabilityBestEffort(this.dependencies.observabilityPort, Object.freeze({
      event: input.event,
      operation: DeploymentPolicyAdministrationObservabilityOperations.adminSurface,
      outcome: input.outcome,
      severity: input.severity,
      occurredAt: input.occurredAt,
      scope: Object.freeze({
        kind: DeploymentPolicyPersistenceScopeKinds.deploymentPolicyScope,
        scopeId: input.context.workspaceId,
      }),
      actorUserIdentityId: input.context.actorUserIdentityId,
      profileId: input.profileId,
      correlationId: input.context.correlationId,
      details: input.details,
      counters: input.counters,
    }));
  }
}
