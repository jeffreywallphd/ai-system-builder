import { ReadDeploymentPolicyAdministrationUseCase } from "@application/policy-administration/use-cases/ReadDeploymentPolicyAdministrationUseCase";
import { DeploymentPolicyAdministrationAuthoritativeUpdateUseCase } from "@application/policy-administration/use-cases/DeploymentPolicyAdministrationAuthoritativeUpdateUseCase";
import { AuthoritativeAuditRecordingService } from "@application/audit/use-cases/AuthoritativeAuditRecordingService";
import { DeploymentPolicyReadBackendApi } from "@infrastructure/api/deployment/DeploymentPolicyReadBackendApi";
import { DeploymentPolicyWriteBackendApi } from "@infrastructure/api/deployment/DeploymentPolicyWriteBackendApi";
import { PlatformDeploymentPolicyAdministrationObservabilityPort } from "@infrastructure/api/deployment/PlatformDeploymentPolicyAdministrationObservabilityPort";
import { PlatformDeploymentPolicyGovernanceEventSink } from "@infrastructure/api/deployment/PlatformDeploymentPolicyGovernanceEventSink";
import { WorkspaceRoleBasedDeploymentPolicyAdministrationPermissionService } from "@infrastructure/api/deployment/WorkspaceRoleBasedDeploymentPolicyAdministrationPermissionService";
import { FanoutDeploymentPolicyGovernanceEventSink } from "@infrastructure/audit/AuditFanoutPublishers";
import { AuthoritativeDeploymentPolicyGovernanceEventSink } from "@infrastructure/audit/AuthoritativeDeploymentPolicyGovernanceEventSink";
import type { AuthoritativePersistentPlatformServices } from "@infrastructure/persistence/AuthoritativePersistenceComposition";

export interface ServerDeploymentPolicyCompositionModuleInput {
  readonly persistentPlatformServices: AuthoritativePersistentPlatformServices;
  readonly authoritativeAuditRecorder: AuthoritativeAuditRecordingService;
  readonly observabilityLogger?: {
    info(event: Readonly<Record<string, unknown>>): void;
    warn(event: Readonly<Record<string, unknown>>): void;
    error(event: Readonly<Record<string, unknown>>): void;
  };
  readonly hostLogger?: {
    info(event: Readonly<Record<string, unknown>>): void;
    warn(event: Readonly<Record<string, unknown>>): void;
    error(event: Readonly<Record<string, unknown>>): void;
  };
}

export interface ServerDeploymentPolicyCompositionModuleOutput {
  readonly deploymentPolicyReadBackendApi: DeploymentPolicyReadBackendApi;
  readonly deploymentPolicyWriteBackendApi: DeploymentPolicyWriteBackendApi;
}

export function composeServerDeploymentPolicyCompositionModule(
  input: ServerDeploymentPolicyCompositionModuleInput,
): ServerDeploymentPolicyCompositionModuleOutput {
  const deploymentPolicyPermissionService = new WorkspaceRoleBasedDeploymentPolicyAdministrationPermissionService({
    workspaceRoleAssignmentRepository: input.persistentPlatformServices.workspaceRepository,
  });
  const deploymentPolicyAdministrationObservabilityPort = new PlatformDeploymentPolicyAdministrationObservabilityPort({
    logger: input.observabilityLogger,
  });
  const deploymentPolicyReadBackendApi = new DeploymentPolicyReadBackendApi({
    readDeploymentPolicyStateUseCase: new ReadDeploymentPolicyAdministrationUseCase({
      deploymentPolicyRepository: input.persistentPlatformServices.deploymentPolicyRepository,
      permissionService: deploymentPolicyPermissionService,
      observabilityPort: deploymentPolicyAdministrationObservabilityPort,
    }),
    observabilityPort: deploymentPolicyAdministrationObservabilityPort,
  });
  const deploymentPolicyGovernanceEventSink = new FanoutDeploymentPolicyGovernanceEventSink([
    new PlatformDeploymentPolicyGovernanceEventSink(
      input.persistentPlatformServices.platformPersistenceRepository,
      input.hostLogger
        ? {
          info: (event) => input.hostLogger?.info(Object.freeze({
            event: event.event,
            requestId: "deployment-policy-governance",
            details: Object.freeze({
              operation: event.operation,
              outcome: event.outcome,
              scopeKind: event.scopeKind,
              scopeId: event.scopeId,
              actorUserIdentityId: event.actorUserIdentityId,
              profileId: event.profileId,
              policyFamilyIds: event.policyFamilyIds,
              details: event.details,
              occurredAt: event.occurredAt,
            }),
          })),
        }
        : undefined,
    ),
    new AuthoritativeDeploymentPolicyGovernanceEventSink(input.authoritativeAuditRecorder),
  ]);
  const deploymentPolicyWriteBackendApi = new DeploymentPolicyWriteBackendApi({
    updateDeploymentPolicyStateUseCase: new DeploymentPolicyAdministrationAuthoritativeUpdateUseCase({
      deploymentPolicyRepository: input.persistentPlatformServices.deploymentPolicyRepository,
      permissionService: deploymentPolicyPermissionService,
      governanceEventSink: deploymentPolicyGovernanceEventSink,
      observabilityPort: deploymentPolicyAdministrationObservabilityPort,
    }),
    observabilityPort: deploymentPolicyAdministrationObservabilityPort,
  });

  return Object.freeze({
    deploymentPolicyReadBackendApi,
    deploymentPolicyWriteBackendApi,
  });
}
