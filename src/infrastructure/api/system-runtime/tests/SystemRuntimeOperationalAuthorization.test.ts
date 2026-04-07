import { describe, expect, it } from "bun:test";
import type { IStudioShellRepository } from "../../../../application/ports/interfaces/IStudioShellRepository";
import type { Studio, AssetSession, AssetDraft } from "../../../../src/domain/studio-shell/StudioShellDomain";
import { AssetVersion } from "../../../../src/domain/assets/AssetVersion";
import { SystemRuntimeBackendApi } from "../SystemRuntimeBackendApi";
import { AuthorizationPolicyDecisionEvaluator } from "../../../../src/application/authorization/use-cases/AuthorizationPolicyDecisionEvaluator";
import type {
  AuthorizationActorRoleGrantSnapshot,
  AuthorizationActorRoleGrantSnapshotQuery,
  AuthorizationResourcePolicyMetadata,
  AuthorizationResourcePolicyMetadataListQuery,
  AuthorizationResourcePolicyMetadataLookupQuery,
  AuthorizationSharingGrantLookupQuery,
  AuthorizationSharingGrantRecord,
} from "../../../../src/application/authorization/contracts/AuthorizationPolicyEvaluationContracts";
import type { IAuthorizationRoleGrantReadRepository } from "../../../../src/application/authorization/ports/IAuthorizationRoleGrantReadRepository";
import type { IAuthorizationSharingGrantReadRepository } from "../../../../src/application/authorization/ports/IAuthorizationSharingGrantReadRepository";
import type { IAuthorizationResourcePolicyMetadataReadRepository } from "../../../../src/application/authorization/ports/IAuthorizationResourcePolicyMetadataReadRepository";
import {
  ResourceOwnershipScopes,
  ResourceVisibilities,
  RoleAssignmentScopes,
  SharingPolicyModes,
  SharingSubjectKinds,
  createRoleAssignment,
} from "../../../../src/domain/authorization/AuthorizationDomain";
import { AuthorizationResourceFamilies } from "../../../../src/domain/authorization/AuthorizationPermissionCatalog";

const evaluationAsOf = "2026-04-05T16:00:00.000Z";

class InMemoryStudioShellRepository implements IStudioShellRepository {
  private readonly studios = new Map<string, Studio>();
  private readonly sessions = new Map<string, AssetSession>();
  private readonly drafts = new Map<string, AssetDraft>();
  private readonly versions = new Map<string, AssetVersion>();

  async saveStudio(studio: Studio): Promise<Studio> { this.studios.set(studio.id, studio); return studio; }
  async getStudio(studioId: string): Promise<Studio | undefined> { return this.studios.get(studioId); }
  async saveSession(session: AssetSession): Promise<AssetSession> { this.sessions.set(session.id, session); return session; }
  async getSession(sessionId: string): Promise<AssetSession | undefined> { return this.sessions.get(sessionId); }
  async listStudioSessions(studioId: string): Promise<ReadonlyArray<AssetSession>> { return [...this.sessions.values()].filter((entry) => entry.studioId === studioId); }
  async saveDraft(draft: AssetDraft): Promise<AssetDraft> { this.drafts.set(draft.id, draft); return draft; }
  async getDraft(draftId: string): Promise<AssetDraft | undefined> { return this.drafts.get(draftId); }
  async listSessionDrafts(sessionId: string): Promise<ReadonlyArray<AssetDraft>> { return [...this.drafts.values()].filter((entry) => entry.sessionId === sessionId); }
  async saveAssetVersion(version: AssetVersion): Promise<AssetVersion> { this.versions.set(version.versionId, version); return version; }
  async getAssetVersion(versionId: string): Promise<AssetVersion | undefined> { return this.versions.get(versionId); }
  async listAssetVersionsByAssetId(assetId: string): Promise<ReadonlyArray<AssetVersion>> { return [...this.versions.values()].filter((entry) => entry.assetId.value === assetId); }
}

class InMemoryOperationalAuthorizationRepositories
  implements
    IAuthorizationRoleGrantReadRepository,
    IAuthorizationSharingGrantReadRepository,
    IAuthorizationResourcePolicyMetadataReadRepository {
  public roleGrantSnapshot: AuthorizationActorRoleGrantSnapshot = Object.freeze({
    roleAssignments: Object.freeze([]),
    permissionGrants: Object.freeze([]),
  });
  public sharingGrants: ReadonlyArray<AuthorizationSharingGrantRecord> = Object.freeze([]);
  public resourceMetadata = new Map<string, AuthorizationResourcePolicyMetadata>();

  public async getActorRoleGrantSnapshot(
    _query: AuthorizationActorRoleGrantSnapshotQuery,
  ): Promise<AuthorizationActorRoleGrantSnapshot> {
    return this.roleGrantSnapshot;
  }

  public async listSharingGrants(
    _query: AuthorizationSharingGrantLookupQuery,
  ): Promise<ReadonlyArray<AuthorizationSharingGrantRecord>> {
    return this.sharingGrants;
  }

  public async findResourcePolicyMetadata(
    query: AuthorizationResourcePolicyMetadataLookupQuery,
  ): Promise<AuthorizationResourcePolicyMetadata | undefined> {
    return this.resourceMetadata.get(toKey(query.resource.resourceType, query.resource.resourceId));
  }

  public async listResourcePolicyMetadata(
    _query: AuthorizationResourcePolicyMetadataListQuery,
  ): Promise<ReadonlyArray<AuthorizationResourcePolicyMetadata>> {
    return Object.freeze([...this.resourceMetadata.values()]);
  }
}

function toKey(resourceType: string, resourceId: string): string {
  return `${resourceType}:${resourceId}`;
}

function createEvaluator(repositories: InMemoryOperationalAuthorizationRepositories): AuthorizationPolicyDecisionEvaluator {
  return new AuthorizationPolicyDecisionEvaluator({
    roleGrantReadRepository: repositories,
    sharingGrantReadRepository: repositories,
    resourcePolicyMetadataReadRepository: repositories,
    clock: { now: () => new Date(evaluationAsOf) },
  });
}

describe("System runtime operational authorization", () => {
  it("enforces run, queue, and log policy checks with list filtering", async () => {
    const repository = new InMemoryStudioShellRepository();
    await repository.saveAssetVersion(new AssetVersion({
      assetId: "system:ops",
      versionId: "system:ops:v1",
      metadata: {
        metadata: {
          taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" },
        },
        content: JSON.stringify({
          systemSpec: {
            components: [],
            inputs: [{ inputId: "request", valueType: "string", required: false }],
            outputs: [{ outputId: "response", valueType: "string" }],
          },
        }),
        dependencies: [],
      },
    }));

    const authRepositories = new InMemoryOperationalAuthorizationRepositories();
    const runtimeApi = new SystemRuntimeBackendApi(
      repository,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        authorizationDecisionEvaluator: createEvaluator(authRepositories),
        now: () => new Date(evaluationAsOf),
      },
    );

    const first = await runtimeApi.startExecution({
      systemId: "system:ops",
      versionId: "system:ops:v1",
      requestContext: {
        trustedInternal: true,
        trustedInternalAuthorization: {
          actorMode: "system-action",
          systemActionId: "runtime-seed",
        },
      },
    });
    const second = await runtimeApi.startExecution({
      systemId: "system:ops",
      versionId: "system:ops:v1",
      requestContext: {
        trustedInternal: true,
        trustedInternalAuthorization: {
          actorMode: "system-action",
          systemActionId: "runtime-seed",
        },
      },
    });
    const third = await runtimeApi.startExecution({
      systemId: "system:ops",
      versionId: "system:ops:v1",
      requestContext: {
        trustedInternal: true,
        trustedInternalAuthorization: {
          actorMode: "system-action",
          systemActionId: "runtime-seed",
        },
      },
    });
    expect(first.ok).toBeTrue();
    expect(second.ok).toBeTrue();
    expect(third.ok).toBeTrue();

    const runAllowed = first.data!.executionId;
    const runPrivateOther = second.data!.executionId;
    const runWorkspaceVisible = third.data!.executionId;
    authRepositories.resourceMetadata.set(
      toKey("runtime-queue", "system:ops::system:ops:v1"),
      Object.freeze({
        resourceFamily: AuthorizationResourceFamilies.queue,
        resourceType: "runtime-queue",
        resourceId: "system:ops::system:ops:v1",
        ownerUserIdentityId: "user-owner",
        ownershipScope: ResourceOwnershipScopes.workspace,
        workspaceId: "workspace-alpha",
        visibility: ResourceVisibilities.workspace,
        sharingPolicyMode: SharingPolicyModes.workspaceMembers,
        allowResharing: false,
        isPublishedCapable: false,
      }),
    );
    authRepositories.resourceMetadata.set(
      toKey("runtime-execution", runAllowed),
      Object.freeze({
        resourceFamily: AuthorizationResourceFamilies.run,
        resourceType: "runtime-execution",
        resourceId: runAllowed,
        ownerUserIdentityId: "user-owner",
        ownershipScope: ResourceOwnershipScopes.workspace,
        workspaceId: "workspace-alpha",
        visibility: ResourceVisibilities.shared,
        sharingPolicyMode: SharingPolicyModes.explicit,
        allowResharing: false,
        isPublishedCapable: false,
      }),
    );
    authRepositories.resourceMetadata.set(
      toKey("runtime-execution", runPrivateOther),
      Object.freeze({
        resourceFamily: AuthorizationResourceFamilies.run,
        resourceType: "runtime-execution",
        resourceId: runPrivateOther,
        ownerUserIdentityId: "user-other",
        ownershipScope: ResourceOwnershipScopes.workspace,
        workspaceId: "workspace-alpha",
        visibility: ResourceVisibilities.private,
        sharingPolicyMode: SharingPolicyModes.ownerOnly,
        allowResharing: false,
        isPublishedCapable: false,
      }),
    );
    authRepositories.resourceMetadata.set(
      toKey("runtime-execution", runWorkspaceVisible),
      Object.freeze({
        resourceFamily: AuthorizationResourceFamilies.run,
        resourceType: "runtime-execution",
        resourceId: runWorkspaceVisible,
        ownerUserIdentityId: "user-owner",
        ownershipScope: ResourceOwnershipScopes.workspace,
        workspaceId: "workspace-alpha",
        visibility: ResourceVisibilities.workspace,
        sharingPolicyMode: SharingPolicyModes.workspaceMembers,
        allowResharing: false,
        isPublishedCapable: false,
      }),
    );
    authRepositories.resourceMetadata.set(
      toKey("runtime-log", runAllowed),
      Object.freeze({
        resourceFamily: AuthorizationResourceFamilies.log,
        resourceType: "runtime-log",
        resourceId: runAllowed,
        ownerUserIdentityId: "user-owner",
        ownershipScope: ResourceOwnershipScopes.workspace,
        workspaceId: "workspace-alpha",
        visibility: ResourceVisibilities.shared,
        sharingPolicyMode: SharingPolicyModes.explicit,
        allowResharing: false,
        isPublishedCapable: false,
      }),
    );
    authRepositories.resourceMetadata.set(
      toKey("runtime-log", runPrivateOther),
      Object.freeze({
        resourceFamily: AuthorizationResourceFamilies.log,
        resourceType: "runtime-log",
        resourceId: runPrivateOther,
        ownerUserIdentityId: "user-other",
        ownershipScope: ResourceOwnershipScopes.workspace,
        workspaceId: "workspace-alpha",
        visibility: ResourceVisibilities.private,
        sharingPolicyMode: SharingPolicyModes.ownerOnly,
        allowResharing: false,
        isPublishedCapable: false,
      }),
    );
    authRepositories.resourceMetadata.set(
      toKey("runtime-log", runWorkspaceVisible),
      Object.freeze({
        resourceFamily: AuthorizationResourceFamilies.log,
        resourceType: "runtime-log",
        resourceId: runWorkspaceVisible,
        ownerUserIdentityId: "user-owner",
        ownershipScope: ResourceOwnershipScopes.workspace,
        workspaceId: "workspace-alpha",
        visibility: ResourceVisibilities.workspace,
        sharingPolicyMode: SharingPolicyModes.workspaceMembers,
        allowResharing: false,
        isPublishedCapable: false,
      }),
    );
    authRepositories.sharingGrants = Object.freeze([
      Object.freeze({
        id: "share-runtime-run-1",
        subject: {
          kind: SharingSubjectKinds.user,
          userIdentityId: "user-collab",
        },
        permissionKeys: Object.freeze(["run.read", "log.read"]),
        grantedByUserIdentityId: "user-owner",
        grantedAt: "2026-04-05T15:00:00.000Z",
      }),
    ]);
    authRepositories.roleGrantSnapshot = Object.freeze({
      roleAssignments: Object.freeze([
        createRoleAssignment({
          id: "role-admin-runtime-1",
          actorUserIdentityId: "user-admin",
          roleKey: "admin",
          scope: RoleAssignmentScopes.workspace,
          workspaceId: "workspace-alpha",
          assignedByUserIdentityId: "user-owner",
          assignedAt: "2026-04-05T12:00:00.000Z",
        }),
        createRoleAssignment({
          id: "role-guest-runtime-1",
          actorUserIdentityId: "user-guest",
          roleKey: "guest",
          scope: RoleAssignmentScopes.workspace,
          workspaceId: "workspace-alpha",
          assignedByUserIdentityId: "user-owner",
          assignedAt: "2026-04-05T12:30:00.000Z",
        }),
      ]),
      permissionGrants: Object.freeze([]),
    });

    const ownerStatus = await runtimeApi.getExecutionStatus(runAllowed, {
      accessContext: { callerKind: "user", callerId: "user-owner", metadata: { workspaceId: "workspace-alpha" } },
    });
    expect(ownerStatus.ok).toBeTrue();

    const collabTrace = await runtimeApi.getExecutionTrace({
      executionId: runAllowed,
      requestContext: {
        accessContext: { callerKind: "user", callerId: "user-collab", metadata: { workspaceId: "workspace-alpha" } },
      },
    });
    expect(collabTrace.ok).toBeTrue();

    const deniedStatus = await runtimeApi.getExecutionStatus(runAllowed, {
      accessContext: { callerKind: "user", callerId: "user-denied", metadata: { workspaceId: "workspace-alpha" } },
    });
    expect(deniedStatus.ok).toBeFalse();
    expect(deniedStatus.error?.code).toBe("forbidden");

    const deniedTrace = await runtimeApi.getExecutionTrace({
      executionId: runPrivateOther,
      requestContext: {
        accessContext: { callerKind: "user", callerId: "user-collab", metadata: { workspaceId: "workspace-alpha" } },
      },
    });
    expect(deniedTrace.ok).toBeFalse();
    expect(deniedTrace.error?.code).toBe("forbidden");

    const adminStatus = await runtimeApi.getExecutionStatus(runPrivateOther, {
      accessContext: { callerKind: "user", callerId: "user-admin", metadata: { workspaceId: "workspace-alpha" } },
    });
    expect(adminStatus.ok).toBeTrue();

    const guestResult = await runtimeApi.getExecutionResult(runWorkspaceVisible, {
      accessContext: { callerKind: "user", callerId: "user-guest", metadata: { workspaceId: "workspace-alpha" } },
    });
    expect(guestResult.ok).toBeTrue();
    expect(guestResult.data?.output).toBeUndefined();
    expect(guestResult.data?.diagnostics).toBeUndefined();
    expect(guestResult.data?.serialized.outputs).toBeUndefined();

    const guestTrace = await runtimeApi.getExecutionTrace({
      executionId: runWorkspaceVisible,
      requestContext: {
        accessContext: { callerKind: "user", callerId: "user-guest", metadata: { workspaceId: "workspace-alpha" } },
      },
    });
    expect(guestTrace.ok).toBeTrue();
    expect(guestTrace.data?.trace.events).toBeUndefined();
    expect(guestTrace.data?.trace.logs).toBeUndefined();

    const collabQueue = await runtimeApi.listRecentExecutionsForSystem({
      assetId: "system:ops",
      versionId: "system:ops:v1",
      requestContext: {
        accessContext: { callerKind: "user", callerId: "user-collab", metadata: { workspaceId: "workspace-alpha" } },
      },
    });
    expect(collabQueue.ok).toBeTrue();
    expect(collabQueue.data?.length).toBe(1);
    expect(collabQueue.data?.[0]?.executionId).toBe(runAllowed);

    const deniedAudit = await runtimeApi.getExecutionAuditTrail({
      executionId: runAllowed,
      requestContext: {
        accessContext: { callerKind: "user", callerId: "user-denied", metadata: { workspaceId: "workspace-alpha" } },
      },
    });
    expect(deniedAudit.ok).toBeFalse();
    expect(deniedAudit.error?.code).toBe("forbidden");

    const delegatedDeniedStatus = await runtimeApi.getExecutionStatus(runAllowed, {
      trustedInternal: true,
      trustedInternalAuthorization: {
        actorMode: "propagate-caller",
      },
      accessContext: { callerKind: "user", callerId: "user-denied", metadata: { workspaceId: "workspace-alpha" } },
    });
    expect(delegatedDeniedStatus.ok).toBeFalse();
    expect(delegatedDeniedStatus.error?.code).toBe("forbidden");
  });

  it("requires explicit system-action semantics for trusted internal authorization bypass when policy evaluator is active", async () => {
    const repository = new InMemoryStudioShellRepository();
    await repository.saveAssetVersion(new AssetVersion({
      assetId: "system:ops",
      versionId: "system:ops:v1",
      metadata: {
        metadata: {
          taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" },
        },
        content: JSON.stringify({
          systemSpec: {
            components: [],
            inputs: [{ inputId: "request", valueType: "string", required: false }],
            outputs: [{ outputId: "response", valueType: "string" }],
          },
        }),
        dependencies: [],
      },
    }));
    const authRepositories = new InMemoryOperationalAuthorizationRepositories();
    const runtimeApi = new SystemRuntimeBackendApi(
      repository,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        authorizationDecisionEvaluator: createEvaluator(authRepositories),
        now: () => new Date(evaluationAsOf),
      },
    );

    const missingSystemAction = await runtimeApi.startExecution({
      systemId: "system:ops",
      versionId: "system:ops:v1",
      requestContext: {
        trustedInternal: true,
      },
    });
    expect(missingSystemAction.ok).toBeFalse();
    expect(missingSystemAction.error?.code).toBe("invalid-request");

    const explicitSystemAction = await runtimeApi.startExecution({
      systemId: "system:ops",
      versionId: "system:ops:v1",
      requestContext: {
        trustedInternal: true,
        trustedInternalAuthorization: {
          actorMode: "system-action",
          systemActionId: "runtime-maintenance",
        },
      },
    });
    expect(explicitSystemAction.ok).toBeTrue();
  });

  it("preserves delegated actor scoping for async deferred execution polling", async () => {
    const repository = new InMemoryStudioShellRepository();
    await repository.saveAssetVersion(new AssetVersion({
      assetId: "system:ops",
      versionId: "system:ops:v1",
      metadata: {
        metadata: {
          taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" },
        },
        content: JSON.stringify({
          systemSpec: {
            components: [],
            inputs: [{ inputId: "request", valueType: "string", required: false }],
            outputs: [{ outputId: "response", valueType: "string" }],
          },
        }),
        dependencies: [],
      },
    }));
    const authRepositories = new InMemoryOperationalAuthorizationRepositories();
    const runtimeApi = new SystemRuntimeBackendApi(
      repository,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        authorizationDecisionEvaluator: createEvaluator(authRepositories),
        now: () => new Date(evaluationAsOf),
      },
    );

    const started = await runtimeApi.startExecutionAsync({
      systemId: "system:ops",
      versionId: "system:ops:v1",
      requestContext: {
        trustedInternal: true,
        trustedInternalAuthorization: {
          actorMode: "propagate-caller",
        },
        accessContext: {
          callerKind: "user",
          callerId: "user-owner",
          metadata: { workspaceId: "workspace-alpha" },
        },
      },
    });
    expect(started.ok).toBeTrue();
    const executionId = started.data!.executionId;
    authRepositories.resourceMetadata.set(
      toKey("runtime-execution", executionId),
      Object.freeze({
        resourceFamily: AuthorizationResourceFamilies.run,
        resourceType: "runtime-execution",
        resourceId: executionId,
        ownerUserIdentityId: "user-owner",
        ownershipScope: ResourceOwnershipScopes.workspace,
        workspaceId: "workspace-alpha",
        visibility: ResourceVisibilities.private,
        sharingPolicyMode: SharingPolicyModes.ownerOnly,
        allowResharing: false,
        isPublishedCapable: false,
      }),
    );

    const deniedPoll = await runtimeApi.pollExecution({
      executionId,
      requestContext: {
        trustedInternal: true,
        trustedInternalAuthorization: {
          actorMode: "propagate-caller",
        },
        accessContext: {
          callerKind: "user",
          callerId: "user-denied",
          metadata: { workspaceId: "workspace-alpha" },
        },
      },
    });
    expect(deniedPoll.ok).toBeFalse();
    expect(deniedPoll.error?.code).toBe("forbidden");
  });
});
