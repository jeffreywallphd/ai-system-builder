import { randomUUID } from "node:crypto";
import type { DeploymentPolicyBootstrapResolutionResult } from "@application/configuration/DeploymentPolicyBootstrapResolutionService";
import { AuthorizationPolicyDecisionEvaluator } from "@application/authorization/use-cases/AuthorizationPolicyDecisionEvaluator";
import { AuthorizationPolicyMutationService } from "@application/authorization/use-cases/AuthorizationPolicyMutationService";
import { GrantAuthorizationSharingAccessUseCase } from "@application/authorization/use-cases/GrantAuthorizationSharingAccessUseCase";
import { RevokeAuthorizationSharingAccessUseCase } from "@application/authorization/use-cases/RevokeAuthorizationSharingAccessUseCase";
import { UpdateAuthorizationVisibilityUseCase } from "@application/authorization/use-cases/UpdateAuthorizationVisibilityUseCase";
import { BulkGrantAuthorizationWorkspaceRoleAccessUseCase } from "@application/authorization/use-cases/BulkGrantAuthorizationWorkspaceRoleAccessUseCase";
import { ListAuthorizationEffectiveAccessUseCase } from "@application/authorization/use-cases/ListAuthorizationEffectiveAccessUseCase";
import { AuthoritativeAuditRecordingService } from "@application/audit/use-cases/AuthoritativeAuditRecordingService";
import {
  IssueWorkspaceInvitationUseCase,
  type WorkspaceInvitationIssuanceClock,
  type WorkspaceInvitationIssuanceIdGenerator,
  Sha256WorkspaceInvitationTokenIssuer,
} from "@application/workspaces/use-cases/IssueWorkspaceInvitationUseCase";
import {
  ResolveWorkspaceInvitationLifecycleUseCase,
  type WorkspaceInvitationLifecycleClock,
  type WorkspaceInvitationLifecycleIdGenerator,
} from "@application/workspaces/use-cases/ResolveWorkspaceInvitationLifecycleUseCase";
import {
  ResolveAuthenticatedWorkspaceOnboardingUseCase,
  type AuthenticatedWorkspaceOnboardingClock,
} from "@application/workspaces/use-cases/ResolveAuthenticatedWorkspaceOnboardingUseCase";
import { WorkspaceAdministrationQueryService } from "@application/workspaces/use-cases/WorkspaceAdministrationQueryService";
import { CreateWorkspaceUseCase } from "@application/workspaces/use-cases/CreateWorkspaceUseCase";
import { UpdateWorkspaceUseCase } from "@application/workspaces/use-cases/UpdateWorkspaceUseCase";
import { TransitionWorkspaceLifecycleUseCase } from "@application/workspaces/use-cases/TransitionWorkspaceLifecycleUseCase";
import { AddWorkspaceMemberUseCase } from "@application/workspaces/use-cases/AddWorkspaceMemberUseCase";
import { ChangeWorkspaceMembershipStatusUseCase } from "@application/workspaces/use-cases/ChangeWorkspaceMembershipStatusUseCase";
import { RemoveWorkspaceMemberUseCase } from "@application/workspaces/use-cases/RemoveWorkspaceMemberUseCase";
import { AssignWorkspaceRoleUseCase } from "@application/workspaces/use-cases/AssignWorkspaceRoleUseCase";
import { ReassignWorkspaceRoleUseCase } from "@application/workspaces/use-cases/ReassignWorkspaceRoleUseCase";
import { RevokeWorkspaceRoleUseCase } from "@application/workspaces/use-cases/RevokeWorkspaceRoleUseCase";
import { WorkspaceInvitationBackendApi } from "@infrastructure/api/workspaces/WorkspaceInvitationBackendApi";
import { WorkspaceAdministrationBackendApi } from "@infrastructure/api/workspaces/WorkspaceAdministrationBackendApi";
import { AuthorizationManagementBackendApi } from "@infrastructure/api/authorization/AuthorizationManagementBackendApi";
import { AuthoritativeAuthorizationPolicyEventRecorder } from "@infrastructure/audit/AuthoritativeAuthorizationPolicyEventRecorder";
import type { AuthoritativePersistentPlatformServices } from "@infrastructure/persistence/AuthoritativePersistenceComposition";
import { WorkspaceAuthorizationPolicyReadAdapter } from "@infrastructure/persistence/workspaces/WorkspaceAuthorizationPolicyReadAdapter";
import { SqliteAuthorizationPolicyReadAdapter } from "@infrastructure/persistence/authorization/SqliteAuthorizationPolicyReadAdapter";
import type { WorkspaceIdNamespace } from "@shared/contracts/workspaces/WorkspaceRepositoryContracts";

export interface ServerWorkspaceAuthorizationCompositionModuleInput {
  readonly workspaceRepository: AuthoritativePersistentPlatformServices["workspaceRepository"];
  readonly authorizationRepository: AuthoritativePersistentPlatformServices["authorizationRepository"];
  readonly authoritativeAuditRecorder: AuthoritativeAuditRecordingService;
  readonly deploymentPolicyBootstrap?: DeploymentPolicyBootstrapResolutionResult;
}

export interface ServerWorkspaceAuthorizationCompositionModuleOutput {
  readonly workspaceClock: {
    now(): Date;
  };
  readonly authorizationDecisionEvaluator: AuthorizationPolicyDecisionEvaluator;
  readonly workspaceBackendApi: WorkspaceInvitationBackendApi;
  readonly workspaceAdministrationBackendApi: WorkspaceAdministrationBackendApi;
  readonly authorizationManagementBackendApi: AuthorizationManagementBackendApi;
}

class SystemWorkspaceClock
implements WorkspaceInvitationIssuanceClock, WorkspaceInvitationLifecycleClock, AuthenticatedWorkspaceOnboardingClock {
  public now(): Date {
    return new Date();
  }
}

class RandomWorkspaceIdGenerator
implements WorkspaceInvitationIssuanceIdGenerator, WorkspaceInvitationLifecycleIdGenerator {
  public nextId(namespace: WorkspaceIdNamespace): string {
    return `${namespace}:${randomUUID()}`;
  }
}

export function composeServerWorkspaceAuthorizationCompositionModule(
  input: ServerWorkspaceAuthorizationCompositionModuleInput,
): ServerWorkspaceAuthorizationCompositionModuleOutput {
  const workspaceClock = new SystemWorkspaceClock();
  const workspaceIdGenerator = new RandomWorkspaceIdGenerator();
  const workspaceAuthorizationPolicyReadAdapter = new WorkspaceAuthorizationPolicyReadAdapter({
    workspaceAuthorizationReadRepository: input.workspaceRepository,
  });
  const workspaceAdministrationAuthorizationDecisionEvaluator = new AuthorizationPolicyDecisionEvaluator({
    roleGrantReadRepository: workspaceAuthorizationPolicyReadAdapter,
    sharingGrantReadRepository: workspaceAuthorizationPolicyReadAdapter,
    resourcePolicyMetadataReadRepository: workspaceAuthorizationPolicyReadAdapter,
    clock: workspaceClock,
  });
  const authorizationPolicyReadAdapter = new SqliteAuthorizationPolicyReadAdapter({
    authorizationPersistenceAdapter: input.authorizationRepository,
  });
  const authorizationDecisionEvaluator = new AuthorizationPolicyDecisionEvaluator({
    roleGrantReadRepository: authorizationPolicyReadAdapter,
    sharingGrantReadRepository: authorizationPolicyReadAdapter,
    resourcePolicyMetadataReadRepository: authorizationPolicyReadAdapter,
    clock: workspaceClock,
  });
  const authorizationMutationService = new AuthorizationPolicyMutationService({
    ports: {
      roleAssignmentPersistenceRepository: input.authorizationRepository,
      sharingGrantPersistenceRepository: input.authorizationRepository,
      resourcePolicyMetadataPersistenceRepository: input.authorizationRepository,
    },
    policyEventRecorder: new AuthoritativeAuthorizationPolicyEventRecorder(input.authoritativeAuditRecorder),
    clock: workspaceClock,
  });

  const resolveWorkspaceInvitationLifecycleUseCase = new ResolveWorkspaceInvitationLifecycleUseCase({
    workspaceRepository: input.workspaceRepository,
    invitationRepository: input.workspaceRepository,
    membershipRepository: input.workspaceRepository,
    roleAssignmentRepository: input.workspaceRepository,
    authorizationReadRepository: input.workspaceRepository,
    transactionManager: input.workspaceRepository,
    idGenerator: workspaceIdGenerator,
    clock: workspaceClock,
  });

  const workspaceBackendApi = new WorkspaceInvitationBackendApi({
    issueWorkspaceInvitationUseCase: new IssueWorkspaceInvitationUseCase({
      invitationRepository: input.workspaceRepository,
      authorizationReadRepository: input.workspaceRepository,
      transactionManager: input.workspaceRepository,
      idGenerator: workspaceIdGenerator,
      tokenIssuer: new Sha256WorkspaceInvitationTokenIssuer(),
      clock: workspaceClock,
    }),
    resolveAuthenticatedWorkspaceOnboardingUseCase: new ResolveAuthenticatedWorkspaceOnboardingUseCase({
      invitationLifecycleUseCase: resolveWorkspaceInvitationLifecycleUseCase,
      clock: workspaceClock,
    }),
  });

  const workspaceAdministrationBackendApi = new WorkspaceAdministrationBackendApi({
    workspaceQueryService: new WorkspaceAdministrationQueryService({
      workspaceRepository: input.workspaceRepository,
      membershipRepository: input.workspaceRepository,
      roleAssignmentRepository: input.workspaceRepository,
      invitationRepository: input.workspaceRepository,
      authorizationReadRepository: input.workspaceRepository,
      clock: workspaceClock,
    }),
    workspaceRepository: input.workspaceRepository,
    membershipRepository: input.workspaceRepository,
    roleAssignmentRepository: input.workspaceRepository,
    invitationRepository: input.workspaceRepository,
    authorizationReadRepository: input.workspaceRepository,
    createWorkspaceUseCase: new CreateWorkspaceUseCase({
      workspaceRepository: input.workspaceRepository,
      membershipRepository: input.workspaceRepository,
      roleAssignmentRepository: input.workspaceRepository,
      transactionManager: input.workspaceRepository,
      idGenerator: workspaceIdGenerator,
      clock: workspaceClock,
      deploymentAuthorizationPolicyPort: input.deploymentPolicyBootstrap?.evaluationService,
      deploymentPolicyContextResolver: input.deploymentPolicyBootstrap?.contextResolver,
    }),
    updateWorkspaceUseCase: new UpdateWorkspaceUseCase({
      workspaceRepository: input.workspaceRepository,
      authorizationReadRepository: input.workspaceRepository,
      clock: workspaceClock,
    }),
    transitionWorkspaceLifecycleUseCase: new TransitionWorkspaceLifecycleUseCase({
      workspaceRepository: input.workspaceRepository,
      authorizationReadRepository: input.workspaceRepository,
      clock: workspaceClock,
    }),
    addWorkspaceMemberUseCase: new AddWorkspaceMemberUseCase({
      membershipRepository: input.workspaceRepository,
      roleAssignmentRepository: input.workspaceRepository,
      authorizationReadRepository: input.workspaceRepository,
      transactionManager: input.workspaceRepository,
      idGenerator: workspaceIdGenerator,
      clock: workspaceClock,
    }),
    changeWorkspaceMembershipStatusUseCase: new ChangeWorkspaceMembershipStatusUseCase({
      membershipRepository: input.workspaceRepository,
      roleAssignmentRepository: input.workspaceRepository,
      authorizationReadRepository: input.workspaceRepository,
      transactionManager: input.workspaceRepository,
      clock: workspaceClock,
    }),
    removeWorkspaceMemberUseCase: new RemoveWorkspaceMemberUseCase({
      membershipRepository: input.workspaceRepository,
      roleAssignmentRepository: input.workspaceRepository,
      authorizationReadRepository: input.workspaceRepository,
      transactionManager: input.workspaceRepository,
      clock: workspaceClock,
    }),
    assignWorkspaceRoleUseCase: new AssignWorkspaceRoleUseCase({
      membershipRepository: input.workspaceRepository,
      roleAssignmentRepository: input.workspaceRepository,
      authorizationReadRepository: input.workspaceRepository,
      transactionManager: input.workspaceRepository,
      idGenerator: workspaceIdGenerator,
      clock: workspaceClock,
    }),
    reassignWorkspaceRoleUseCase: new ReassignWorkspaceRoleUseCase({
      membershipRepository: input.workspaceRepository,
      roleAssignmentRepository: input.workspaceRepository,
      authorizationReadRepository: input.workspaceRepository,
      transactionManager: input.workspaceRepository,
      idGenerator: workspaceIdGenerator,
      clock: workspaceClock,
    }),
    revokeWorkspaceRoleUseCase: new RevokeWorkspaceRoleUseCase({
      membershipRepository: input.workspaceRepository,
      roleAssignmentRepository: input.workspaceRepository,
      authorizationReadRepository: input.workspaceRepository,
      transactionManager: input.workspaceRepository,
      clock: workspaceClock,
    }),
    resolveWorkspaceInvitationLifecycleUseCase,
    authorizationPolicyDecisionEvaluator: workspaceAdministrationAuthorizationDecisionEvaluator,
    workspaceAdministrationCapabilityResourceType: "workspace-administration",
    clock: workspaceClock,
  });

  const authorizationManagementBackendApi = new AuthorizationManagementBackendApi({
    grantSharingAccessUseCase: new GrantAuthorizationSharingAccessUseCase({
      mutationService: authorizationMutationService,
      decisionEvaluator: authorizationDecisionEvaluator,
      persistencePorts: {
        roleAssignmentPersistenceRepository: input.authorizationRepository,
        sharingGrantPersistenceRepository: input.authorizationRepository,
        resourcePolicyMetadataPersistenceRepository: input.authorizationRepository,
      },
      clock: workspaceClock,
    }),
    revokeSharingAccessUseCase: new RevokeAuthorizationSharingAccessUseCase({
      mutationService: authorizationMutationService,
      decisionEvaluator: authorizationDecisionEvaluator,
      persistencePorts: {
        roleAssignmentPersistenceRepository: input.authorizationRepository,
        sharingGrantPersistenceRepository: input.authorizationRepository,
        resourcePolicyMetadataPersistenceRepository: input.authorizationRepository,
      },
      clock: workspaceClock,
    }),
    updateVisibilityUseCase: new UpdateAuthorizationVisibilityUseCase({
      mutationService: authorizationMutationService,
      decisionEvaluator: authorizationDecisionEvaluator,
      persistencePorts: {
        roleAssignmentPersistenceRepository: input.authorizationRepository,
        sharingGrantPersistenceRepository: input.authorizationRepository,
        resourcePolicyMetadataPersistenceRepository: input.authorizationRepository,
      },
      clock: workspaceClock,
    }),
    bulkGrantWorkspaceRoleAccessUseCase: new BulkGrantAuthorizationWorkspaceRoleAccessUseCase({
      mutationService: authorizationMutationService,
      decisionEvaluator: authorizationDecisionEvaluator,
      persistencePorts: {
        roleAssignmentPersistenceRepository: input.authorizationRepository,
        sharingGrantPersistenceRepository: input.authorizationRepository,
        resourcePolicyMetadataPersistenceRepository: input.authorizationRepository,
      },
      clock: workspaceClock,
    }),
    listEffectiveAccessUseCase: new ListAuthorizationEffectiveAccessUseCase({
      decisionEvaluator: authorizationDecisionEvaluator,
      roleGrantReadRepository: authorizationPolicyReadAdapter,
      sharingGrantReadRepository: authorizationPolicyReadAdapter,
      resourcePolicyMetadataReadRepository: authorizationPolicyReadAdapter,
    }),
    decisionEvaluator: authorizationDecisionEvaluator,
    roleAssignmentPersistenceRepository: input.authorizationRepository,
    sharingGrantPersistenceRepository: input.authorizationRepository,
    resourcePolicyMetadataPersistenceRepository: input.authorizationRepository,
    clock: workspaceClock,
  });

  return Object.freeze({
    workspaceClock,
    authorizationDecisionEvaluator,
    workspaceBackendApi,
    workspaceAdministrationBackendApi,
    authorizationManagementBackendApi,
  });
}
