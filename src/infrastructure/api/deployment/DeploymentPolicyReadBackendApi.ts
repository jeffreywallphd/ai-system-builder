import {
  ReadDeploymentPolicyAdministrationPermissionError,
  type ReadDeploymentPolicyAdministrationUseCase,
} from "@application/policy-administration/use-cases/ReadDeploymentPolicyAdministrationUseCase";
import {
  DeploymentPolicyAdministrationObservabilityOperations,
  DeploymentPolicyAdministrationObservabilityOutcomes,
  publishDeploymentPolicyAdministrationObservabilityBestEffort,
  type IDeploymentPolicyAdministrationObservabilityPort,
} from "@application/policy-administration/ports/DeploymentPolicyAdministrationObservabilityPorts";
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
  readonly correlationId?: string;
  readonly profileId?: "home" | "classroom" | "organization";
  readonly includeCatalog?: boolean;
  readonly includeOverrideRecords?: boolean;
  readonly includeEffectiveMetadata?: boolean;
  readonly evaluatedAt?: string;
}

export interface DeploymentPolicyReadBackendApiDependencies {
  readonly readDeploymentPolicyStateUseCase: ReadDeploymentPolicyAdministrationUseCase;
  readonly observabilityPort?: IDeploymentPolicyAdministrationObservabilityPort;
}

export class DeploymentPolicyReadBackendApi {
  public constructor(private readonly dependencies: DeploymentPolicyReadBackendApiDependencies) {}

  public async readPolicyState(
    request: DeploymentPolicyReadApiRequest,
  ): Promise<SharedApiResponseEnvelope<ReadDeploymentPolicyStateResponse>> {
    const occurredAt = request.evaluatedAt ?? new Date().toISOString();
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
        await this.publishSurfaceObservability({
          event: "deployment-policy-admin.surface.read.rejected",
          occurredAt,
          outcome: DeploymentPolicyAdministrationObservabilityOutcomes.rejected,
          severity: "warn",
          request,
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

    try {
      const result = await this.dependencies.readDeploymentPolicyStateUseCase.execute(parsedRequest);
      parseReadDeploymentPolicyStateResponse(result);
      await this.publishSurfaceObservability({
        event: "deployment-policy-admin.surface.read.completed",
        occurredAt,
        outcome: DeploymentPolicyAdministrationObservabilityOutcomes.success,
        severity: "info",
        request,
        profileId: result.snapshot.profileId,
        counters: Object.freeze({
          validationIssueCount: result.validation.issues.length,
          overrideRecordCount: result.overrideRecords?.length ?? 0,
          familyCount: result.snapshot.summary.familyCount,
          settingCount: result.snapshot.summary.settingCount,
        }),
      });
      return Object.freeze({
        ok: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof ReadDeploymentPolicyAdministrationPermissionError) {
        await this.publishSurfaceObservability({
          event: "deployment-policy-admin.surface.read.rejected",
          occurredAt,
          outcome: DeploymentPolicyAdministrationObservabilityOutcomes.rejected,
          severity: "warn",
          request,
          details: Object.freeze({
            phase: "permission-check",
            reasonCode: error.reasonCode,
          }),
        });
        return Object.freeze({
          ok: false,
          error: Object.freeze({
            code: SharedApiErrorCodes.forbidden,
            message: error.reason ?? error.message,
          }),
        });
      }
      const message = error instanceof Error ? error.message : "Unknown deployment policy read failure.";
      await this.publishSurfaceObservability({
        event: "deployment-policy-admin.surface.read.failed",
        occurredAt,
        outcome: DeploymentPolicyAdministrationObservabilityOutcomes.failure,
        severity: "error",
        request,
        details: Object.freeze({
          phase: "use-case-execute",
          message,
        }),
      });
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

  private async publishSurfaceObservability(input: {
    readonly event: string;
    readonly occurredAt: string;
    readonly outcome: "success" | "rejected" | "failure";
    readonly severity: "info" | "warn" | "error";
    readonly request: DeploymentPolicyReadApiRequest;
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
        scopeId: input.request.workspaceId,
      }),
      actorUserIdentityId: input.request.actorUserIdentityId,
      profileId: input.profileId,
      correlationId: input.request.correlationId,
      details: input.details,
      counters: input.counters,
    }));
  }
}
