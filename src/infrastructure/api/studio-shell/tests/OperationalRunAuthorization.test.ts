import { describe, expect, it } from "bun:test";
import { StudioShellBackendApi } from "../StudioShellBackendApi";
import { InMemoryStudioShellRepository } from "../../../../src/infrastructure/studio-shell/InMemoryStudioShellRepository";
import { InMemoryWorkflowRunSummaryRepository } from "../../../../src/infrastructure/workflows/InMemoryWorkflowRunSummaryRepository";
import { ReferenceImageSystemTemplate } from "../../../../application/system-studio/ReferenceImageSystemTemplate";
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
import {
  createWorkflowRunDetailRecord,
  createWorkflowRunSummaryRecord,
  WorkflowRunStatuses,
  WorkflowRunTriggerSources,
} from "../../../../src/domain/workflow-studio/WorkflowRunHistoryDomain";

const evaluationAsOf = "2026-04-05T16:00:00.000Z";

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

describe("Operational run authorization", () => {
  it("enforces list filtering and per-item checks for workflow runs", async () => {
    const workflowRuns = new InMemoryWorkflowRunSummaryRepository();
    await workflowRuns.upsertDetail(createWorkflowRunDetailRecord({
      runId: "run:wf:allowed",
      summary: createWorkflowRunSummaryRecord({
        runId: "run:wf:allowed",
        status: WorkflowRunStatuses.completed,
        triggerSource: WorkflowRunTriggerSources.manual,
        workflow: { workflowId: "workflow:alpha", workflowName: "Workflow Alpha" },
        correlation: { executionRunId: "run:wf:allowed" },
        timestamps: {
          startedAt: "2026-04-05T12:00:00.000Z",
          endedAt: "2026-04-05T12:00:02.000Z",
          updatedAt: "2026-04-05T12:00:02.000Z",
        },
      }),
    }));
    await workflowRuns.upsertDetail(createWorkflowRunDetailRecord({
      runId: "run:wf:private-other",
      summary: createWorkflowRunSummaryRecord({
        runId: "run:wf:private-other",
        status: WorkflowRunStatuses.failed,
        triggerSource: WorkflowRunTriggerSources.manual,
        workflow: { workflowId: "workflow:alpha", workflowName: "Workflow Alpha" },
        correlation: { executionRunId: "run:wf:private-other" },
        timestamps: {
          startedAt: "2026-04-05T13:00:00.000Z",
          endedAt: "2026-04-05T13:00:04.000Z",
          updatedAt: "2026-04-05T13:00:04.000Z",
        },
      }),
    }));
    await workflowRuns.upsertDetail(createWorkflowRunDetailRecord({
      runId: "run:wf:workspace-visible",
      summary: createWorkflowRunSummaryRecord({
        runId: "run:wf:workspace-visible",
        status: WorkflowRunStatuses.completed,
        triggerSource: WorkflowRunTriggerSources.manual,
        workflow: { workflowId: "workflow:beta", workflowName: "Workflow Beta" },
        correlation: { executionRunId: "run:wf:workspace-visible" },
        timestamps: {
          startedAt: "2026-04-05T14:00:00.000Z",
          endedAt: "2026-04-05T14:00:03.000Z",
          updatedAt: "2026-04-05T14:00:03.000Z",
        },
      }),
      executionContext: Object.freeze({
        executionInput: Object.freeze({
          parameters: Object.freeze({
            prompt: "hidden prompt",
            modelConfig: Object.freeze({
              temperature: 0.4,
            }),
          }),
        }),
      }),
      outputs: Object.freeze({
        outputAssetIds: Object.freeze(["asset:run:wf:workspace-visible:1"]),
        outputCount: 1,
        resultMessages: Object.freeze(["hidden result message"]),
        outputValues: Object.freeze({ payload: "hidden output payload" }),
      }),
    }));

    const repositories = new InMemoryOperationalAuthorizationRepositories();
    repositories.resourceMetadata.set(
      toKey("workflow-run", "run:wf:allowed"),
      Object.freeze({
        resourceFamily: AuthorizationResourceFamilies.run,
        resourceType: "workflow-run",
        resourceId: "run:wf:allowed",
        ownerUserIdentityId: "user-owner",
        ownershipScope: ResourceOwnershipScopes.workspace,
        workspaceId: "workspace-alpha",
        visibility: ResourceVisibilities.shared,
        sharingPolicyMode: SharingPolicyModes.explicit,
        allowResharing: false,
        isPublishedCapable: false,
      }),
    );
    repositories.resourceMetadata.set(
      toKey("workflow-run", "run:wf:private-other"),
      Object.freeze({
        resourceFamily: AuthorizationResourceFamilies.run,
        resourceType: "workflow-run",
        resourceId: "run:wf:private-other",
        ownerUserIdentityId: "user-other",
        ownershipScope: ResourceOwnershipScopes.workspace,
        workspaceId: "workspace-alpha",
        visibility: ResourceVisibilities.private,
        sharingPolicyMode: SharingPolicyModes.ownerOnly,
        allowResharing: false,
        isPublishedCapable: false,
      }),
    );
    repositories.resourceMetadata.set(
      toKey("workflow-run", "run:wf:workspace-visible"),
      Object.freeze({
        resourceFamily: AuthorizationResourceFamilies.run,
        resourceType: "workflow-run",
        resourceId: "run:wf:workspace-visible",
        ownerUserIdentityId: "user-owner",
        ownershipScope: ResourceOwnershipScopes.workspace,
        workspaceId: "workspace-alpha",
        visibility: ResourceVisibilities.workspace,
        sharingPolicyMode: SharingPolicyModes.workspaceMembers,
        allowResharing: false,
        isPublishedCapable: false,
      }),
    );
    repositories.sharingGrants = Object.freeze([
      Object.freeze({
        id: "share-run-1",
        subject: {
          kind: SharingSubjectKinds.user,
          userIdentityId: "user-collab",
        },
        permissionKeys: Object.freeze(["run.read"]),
        grantedByUserIdentityId: "user-owner",
        grantedAt: "2026-04-05T15:00:00.000Z",
      }),
    ]);
    repositories.roleGrantSnapshot = Object.freeze({
      roleAssignments: Object.freeze([
        createRoleAssignment({
          id: "role-admin-1",
          actorUserIdentityId: "user-admin",
          roleKey: "admin",
          scope: RoleAssignmentScopes.workspace,
          workspaceId: "workspace-alpha",
          assignedByUserIdentityId: "user-owner",
          assignedAt: "2026-04-05T10:00:00.000Z",
        }),
        createRoleAssignment({
          id: "role-guest-1",
          actorUserIdentityId: "user-guest",
          roleKey: "guest",
          scope: RoleAssignmentScopes.workspace,
          workspaceId: "workspace-alpha",
          assignedByUserIdentityId: "user-owner",
          assignedAt: "2026-04-05T10:30:00.000Z",
        }),
      ]),
      permissionGrants: Object.freeze([]),
    });

    const api = new StudioShellBackendApi(
      new InMemoryStudioShellRepository(),
      undefined,
      workflowRuns,
      () => new Date(evaluationAsOf),
      undefined,
      { authorizationDecisionEvaluator: createEvaluator(repositories) },
    );

    const ownerList = await api.listWorkflowRuns({
      workflowId: "workflow:alpha",
      authorization: { actorUserIdentityId: "user-owner", activeWorkspaceId: "workspace-alpha" },
    });
    expect(ownerList.ok).toBeTrue();
    expect(ownerList.data?.map((entry) => entry.runId)).toEqual(["run:wf:allowed"]);

    const collabList = await api.listWorkflowRuns({
      workflowId: "workflow:alpha",
      authorization: { actorUserIdentityId: "user-collab", activeWorkspaceId: "workspace-alpha" },
    });
    expect(collabList.ok).toBeTrue();
    expect(collabList.data?.map((entry) => entry.runId)).toEqual(["run:wf:allowed"]);

    const adminList = await api.listWorkflowRuns({
      workflowId: "workflow:alpha",
      authorization: { actorUserIdentityId: "user-admin", activeWorkspaceId: "workspace-alpha" },
    });
    expect(adminList.ok).toBeTrue();
    expect(adminList.data?.map((entry) => entry.runId)).toEqual(expect.arrayContaining(["run:wf:private-other", "run:wf:allowed"]));
    expect(adminList.data?.length).toBe(2);

    const deniedDetail = await api.getWorkflowRunDetail("run:wf:allowed", {
      actorUserIdentityId: "user-denied",
      activeWorkspaceId: "workspace-alpha",
    });
    expect(deniedDetail.ok).toBeFalse();
    expect(deniedDetail.error?.code).toBe("not-found");

    const guestDetail = await api.getWorkflowRunDetail("run:wf:workspace-visible", {
      actorUserIdentityId: "user-guest",
      activeWorkspaceId: "workspace-alpha",
    });
    expect(guestDetail.ok).toBeTrue();
    expect(guestDetail.data?.executionContext?.executionInput).toBeUndefined();
    expect(guestDetail.data?.outputs?.resultMessages).toBeUndefined();
    expect(guestDetail.data?.outputs?.outputValues).toBeUndefined();
  });

  it("filters reference-image run history by owner/share/admin visibility", async () => {
    const repositories = new InMemoryOperationalAuthorizationRepositories();
    repositories.sharingGrants = Object.freeze([
      Object.freeze({
        id: "share-ref-run-1",
        subject: {
          kind: SharingSubjectKinds.user,
          userIdentityId: "user-collab",
        },
        permissionKeys: Object.freeze(["run.read"]),
        grantedByUserIdentityId: "user-owner",
        grantedAt: "2026-04-05T15:00:00.000Z",
      }),
    ]);
    repositories.roleGrantSnapshot = Object.freeze({
      roleAssignments: Object.freeze([
        createRoleAssignment({
          id: "role-admin-ref-1",
          actorUserIdentityId: "user-admin",
          roleKey: "admin",
          scope: RoleAssignmentScopes.workspace,
          workspaceId: "workspace-alpha",
          assignedByUserIdentityId: "user-owner",
          assignedAt: "2026-04-05T10:00:00.000Z",
        }),
      ]),
      permissionGrants: Object.freeze([]),
    });

    const api = new StudioShellBackendApi(
      new InMemoryStudioShellRepository(),
      undefined,
      undefined,
      () => new Date(evaluationAsOf),
      undefined,
      { authorizationDecisionEvaluator: createEvaluator(repositories) },
    );
    const initialized = await api.initializeStudio("studio-authz-runs", "System Studio");
    const created = await api.createDraft({
      studioId: "studio-authz-runs",
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
    const draftId = created.data!.draft!.draftId;
    const runtimeSystemId = `system:studio:${draftId}`;
    for (const runId of ["run:ref:allowed", "run:ref:private-other"]) {
      const persisted = await api.persistReferenceImageOutputs({
        studioId: "studio-authz-runs",
        draftId,
        executionId: runId,
        sourceAssetId: "generated-output:upload://source.png",
        runtimeContext: {
          contractVersion: "1.0.0",
          selectedImages: [{ selectionId: "source-1", imageId: "source-1", assetRef: { assetId: "generated-output:upload://source.png", recordId: "source-1" } }],
          parameters: { resultCount: 1 },
          datasets: [{ referenceId: "active-input", instanceId: "dataset-instance:reference-image:input", datasetAssetId: "asset:dataset:image-reference-input", role: "active-input" }],
          runtime: { systemAssetId: ReferenceImageSystemTemplate.systemAsset.assetId, runtimeSessionId: `session:${runId}` },
        },
        runtimeResult: {
          output: {
            payload: {
              nodeResults: {
                workflow: {
                  result: {
                    executionId: runId,
                    status: "completed",
                    outputs: [{
                      nodeId: "save_image",
                      kind: "image",
                      reference: `memory://${runId}.png`,
                    }],
                  },
                },
              },
            },
          },
        },
      });
      expect(persisted.ok).toBeTrue();
    }

    repositories.resourceMetadata.set(
      toKey("reference-image-run", `${runtimeSystemId}::run:ref:allowed`),
      Object.freeze({
        resourceFamily: AuthorizationResourceFamilies.run,
        resourceType: "reference-image-run",
        resourceId: `${runtimeSystemId}::run:ref:allowed`,
        ownerUserIdentityId: "user-owner",
        ownershipScope: ResourceOwnershipScopes.workspace,
        workspaceId: "workspace-alpha",
        visibility: ResourceVisibilities.shared,
        sharingPolicyMode: SharingPolicyModes.explicit,
        allowResharing: false,
        isPublishedCapable: false,
      }),
    );
    repositories.resourceMetadata.set(
      toKey("reference-image-run", `${runtimeSystemId}::run:ref:private-other`),
      Object.freeze({
        resourceFamily: AuthorizationResourceFamilies.run,
        resourceType: "reference-image-run",
        resourceId: `${runtimeSystemId}::run:ref:private-other`,
        ownerUserIdentityId: "user-other",
        ownershipScope: ResourceOwnershipScopes.workspace,
        workspaceId: "workspace-alpha",
        visibility: ResourceVisibilities.private,
        sharingPolicyMode: SharingPolicyModes.ownerOnly,
        allowResharing: false,
        isPublishedCapable: false,
      }),
    );

    const owner = await api.listReferenceImageRunHistory({
      studioId: "studio-authz-runs",
      draftId,
      authorization: { actorUserIdentityId: "user-owner", activeWorkspaceId: "workspace-alpha" },
    });
    expect(owner.ok).toBeTrue();
    expect(owner.data?.runs.map((entry) => entry.runId)).toEqual(["run:ref:allowed"]);

    const collab = await api.listReferenceImageRunHistory({
      studioId: "studio-authz-runs",
      draftId,
      authorization: { actorUserIdentityId: "user-collab", activeWorkspaceId: "workspace-alpha" },
    });
    expect(collab.ok).toBeTrue();
    expect(collab.data?.runs.map((entry) => entry.runId)).toEqual(["run:ref:allowed"]);

    const admin = await api.listReferenceImageRunHistory({
      studioId: "studio-authz-runs",
      draftId,
      authorization: { actorUserIdentityId: "user-admin", activeWorkspaceId: "workspace-alpha" },
    });
    expect(admin.ok).toBeTrue();
    expect(admin.data?.runs.map((entry) => entry.runId)).toEqual(expect.arrayContaining(["run:ref:private-other", "run:ref:allowed"]));
    expect(admin.data?.runs.length).toBe(2);

    const denied = await api.listReferenceImageRunHistory({
      studioId: "studio-authz-runs",
      draftId,
      authorization: { actorUserIdentityId: "user-denied", activeWorkspaceId: "workspace-alpha" },
    });
    expect(denied.ok).toBeTrue();
    expect(denied.data?.runs).toEqual([]);
  });
});
