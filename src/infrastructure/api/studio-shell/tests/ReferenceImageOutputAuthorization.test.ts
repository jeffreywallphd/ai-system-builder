import { describe, expect, it } from "bun:test";
import { StudioShellBackendApi } from "../StudioShellBackendApi";
import { InMemoryStudioShellRepository } from "../../../../infrastructure/studio-shell/InMemoryStudioShellRepository";
import { ReferenceImageSystemTemplate } from "../../../../application/system-studio/ReferenceImageSystemTemplate";
import { AuthorizationPolicyDecisionEvaluator } from "../../../../application/authorization/use-cases/AuthorizationPolicyDecisionEvaluator";
import type {
  AuthorizationActorRoleGrantSnapshot,
  AuthorizationActorRoleGrantSnapshotQuery,
  AuthorizationResourcePolicyMetadata,
  AuthorizationResourcePolicyMetadataListQuery,
  AuthorizationResourcePolicyMetadataLookupQuery,
  AuthorizationSharingGrantLookupQuery,
  AuthorizationSharingGrantRecord,
} from "../../../../application/authorization/contracts/AuthorizationPolicyEvaluationContracts";
import type { IAuthorizationRoleGrantReadRepository } from "../../../../application/authorization/ports/IAuthorizationRoleGrantReadRepository";
import type { IAuthorizationSharingGrantReadRepository } from "../../../../application/authorization/ports/IAuthorizationSharingGrantReadRepository";
import type { IAuthorizationResourcePolicyMetadataReadRepository } from "../../../../application/authorization/ports/IAuthorizationResourcePolicyMetadataReadRepository";
import {
  ResourceOwnershipScopes,
  ResourceVisibilities,
  RoleAssignmentScopes,
  SharingPolicyModes,
  SharingSubjectKinds,
  createRoleAssignment,
} from "../../../../domain/authorization/AuthorizationDomain";
import { AuthorizationResourceFamilies } from "../../../../domain/authorization/AuthorizationPermissionCatalog";

const evaluationAsOf = "2026-04-05T16:00:00.000Z";

class InMemoryReferenceImageAuthorizationRepositories
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

async function createPersistedOutputFixture(api: StudioShellBackendApi): Promise<{
  readonly draftId: string;
  readonly recordId: string;
}> {
  const initialized = await api.initializeStudio("studio-authz", "System Studio");
  const created = await api.createDraft({
    studioId: "studio-authz",
    sessionId: initialized.data!.activeSessionId!,
    assetId: ReferenceImageSystemTemplate.systemAsset.assetId,
    content: JSON.stringify({ systemSpec: {} }),
    metadata: {
      title: "Reference image",
      tags: ["system"],
      taxonomy: {
        structuralKind: "system",
        semanticRole: "system",
        behaviorKind: "deterministic",
      },
    },
  });

  const persisted = await api.persistReferenceImageOutputs({
    studioId: "studio-authz",
    draftId: created.data!.draft!.draftId,
    executionId: "run:authz:1",
    sourceAssetId: "generated-output:upload://source.png",
    runtimeContext: {
      contractVersion: "1.0.0",
      selectedImages: [{ selectionId: "source-1", imageId: "source-1", assetRef: { assetId: "generated-output:upload://source.png", recordId: "source-1" } }],
      parameters: { resultCount: 1 },
      datasets: [{ referenceId: "active-input", instanceId: "dataset-instance:reference-image:input", datasetAssetId: "asset:dataset:image-reference-input", role: "active-input" }],
      runtime: { systemAssetId: ReferenceImageSystemTemplate.systemAsset.assetId, runtimeSessionId: "session:authz:1" },
    },
    runtimeResult: {
      output: {
        payload: {
          nodeResults: {
            workflow: {
              result: {
                executionId: "run:authz:1",
                status: "completed",
                outputs: [{
                  nodeId: "save_image",
                  kind: "image",
                  reference: "memory://generated-authz.png",
                  metadata: {
                    filename: "generated-authz.png",
                    format: "png",
                    width: 1024,
                    height: 768,
                  },
                }],
              },
            },
          },
        },
      },
    },
  });
  return Object.freeze({
    draftId: created.data!.draft!.draftId,
    recordId: persisted.data!.persistedRecordIds[0]!,
  });
}

function toProtectedResourceId(datasetBindingId = "output-image-dataset"): string {
  return `${ReferenceImageSystemTemplate.systemAsset.assetId}::${datasetBindingId}`;
}

function toKey(resourceType: string, resourceId: string): string {
  return `${resourceType}:${resourceId}`;
}

describe("Reference image output authorization", () => {
  it("supports private owner, workspace visibility, explicit sharing, and denied non-leaky outcomes", async () => {
    const repositories = new InMemoryReferenceImageAuthorizationRepositories();
    const evaluator = new AuthorizationPolicyDecisionEvaluator({
      roleGrantReadRepository: repositories,
      sharingGrantReadRepository: repositories,
      resourcePolicyMetadataReadRepository: repositories,
      clock: { now: () => new Date(evaluationAsOf) },
    });
    const api = new StudioShellBackendApi(
      new InMemoryStudioShellRepository(),
      undefined,
      undefined,
      () => new Date(evaluationAsOf),
      undefined,
      {
        authorizationDecisionEvaluator: evaluator,
      },
    );
    const fixture = await createPersistedOutputFixture(api);

    repositories.resourceMetadata.set(
      toKey("reference-image-output", toProtectedResourceId()),
      Object.freeze({
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "reference-image-output",
        resourceId: toProtectedResourceId(),
        ownerUserIdentityId: "user-owner",
        ownershipScope: ResourceOwnershipScopes.workspace,
        workspaceId: "workspace-alpha",
        visibility: ResourceVisibilities.private,
        sharingPolicyMode: SharingPolicyModes.ownerOnly,
        allowResharing: false,
        isPublishedCapable: false,
      }),
    );

    const privateOwner = await api.getReferenceImageOutput({
      studioId: "studio-authz",
      draftId: fixture.draftId,
      recordId: fixture.recordId,
      authorization: {
        actorUserIdentityId: "user-owner",
        activeWorkspaceId: "workspace-alpha",
      },
    });
    expect(privateOwner.ok).toBeTrue();

    repositories.resourceMetadata.set(
      toKey("reference-image-output", toProtectedResourceId()),
      Object.freeze({
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "reference-image-output",
        resourceId: toProtectedResourceId(),
        ownerUserIdentityId: "user-owner",
        ownershipScope: ResourceOwnershipScopes.workspace,
        workspaceId: "workspace-alpha",
        visibility: ResourceVisibilities.workspace,
        sharingPolicyMode: SharingPolicyModes.workspaceMembers,
        allowResharing: false,
        isPublishedCapable: false,
      }),
    );
    repositories.roleGrantSnapshot = Object.freeze({
      roleAssignments: Object.freeze([
        createRoleAssignment({
          id: "role-member-1",
          actorUserIdentityId: "user-member",
          roleKey: "guest",
          scope: RoleAssignmentScopes.workspace,
          workspaceId: "workspace-alpha",
          assignedByUserIdentityId: "user-owner",
          assignedAt: "2026-04-01T00:00:00.000Z",
        }),
      ]),
      permissionGrants: Object.freeze([]),
    });
    const workspaceShared = await api.listReferenceImageOutputs({
      studioId: "studio-authz",
      draftId: fixture.draftId,
      authorization: {
        actorUserIdentityId: "user-member",
        activeWorkspaceId: "workspace-alpha",
      },
    });
    expect(workspaceShared.ok).toBeTrue();

    repositories.resourceMetadata.set(
      toKey("reference-image-output", toProtectedResourceId()),
      Object.freeze({
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "reference-image-output",
        resourceId: toProtectedResourceId(),
        ownerUserIdentityId: "user-owner",
        ownershipScope: ResourceOwnershipScopes.workspace,
        workspaceId: "workspace-alpha",
        visibility: ResourceVisibilities.shared,
        sharingPolicyMode: SharingPolicyModes.explicit,
        allowResharing: false,
        isPublishedCapable: false,
      }),
    );
    repositories.roleGrantSnapshot = Object.freeze({
      roleAssignments: Object.freeze([]),
      permissionGrants: Object.freeze([]),
    });
    repositories.sharingGrants = Object.freeze([
      Object.freeze({
        id: "share-output-1",
        subject: {
          kind: SharingSubjectKinds.user,
          userIdentityId: "user-shared",
        },
        permissionKeys: Object.freeze(["asset.read"]),
        grantedByUserIdentityId: "user-owner",
        grantedAt: "2026-04-01T00:00:00.000Z",
      }),
    ]);
    const explicitlyShared = await api.getReferenceImageOutput({
      studioId: "studio-authz",
      draftId: fixture.draftId,
      recordId: fixture.recordId,
      authorization: {
        actorUserIdentityId: "user-shared",
        activeWorkspaceId: "workspace-alpha",
      },
    });
    expect(explicitlyShared.ok).toBeTrue();

    repositories.sharingGrants = Object.freeze([]);
    const deniedExisting = await api.getReferenceImageOutput({
      studioId: "studio-authz",
      draftId: fixture.draftId,
      recordId: fixture.recordId,
      authorization: {
        actorUserIdentityId: "user-denied",
        activeWorkspaceId: "workspace-alpha",
      },
    });
    const deniedMissing = await api.getReferenceImageOutput({
      studioId: "studio-authz",
      draftId: fixture.draftId,
      recordId: "record:does-not-exist",
      authorization: {
        actorUserIdentityId: "user-denied",
        activeWorkspaceId: "workspace-alpha",
      },
    });

    expect(deniedExisting.ok).toBeFalse();
    expect(deniedExisting.error?.code).toBe("not-found");
    expect(deniedExisting.error?.message).toBe("Requested reference image output was not found.");
    expect(deniedMissing.ok).toBeFalse();
    expect(deniedMissing.error?.code).toBe("not-found");
    expect(deniedMissing.error?.message).toBe("Requested reference image output was not found.");
  });
});
