import { describe, expect, it } from "bun:test";
import type {
  GeneratedResultLineageRecord,
  GeneratedResultRecordListQuery,
  IGeneratedResultPersistenceRepository,
} from "../ports/IGeneratedResultPersistenceRepository";
import type {
  GeneratedResultPersistenceMutationEnvelope,
  GeneratedResultPersistenceMutationResult,
  GeneratedResultPersistenceRecord,
  GeneratedResultPreviewPersistenceRecord,
} from "@shared/dto/assets/GeneratedResultPersistenceDtos";
import { createWorkspaceTenancyMetadata } from "@shared/persistence/PersistenceTenancyMetadataFactory";
import type { IWorkspaceAuthorizationReadRepository } from "@application/workspaces/ports/IWorkspaceAuthorizationReadRepository";
import { GeneratedResultAssetStatuses } from "@domain/image-assets/GeneratedResultAssetDomain";
import { GeneratedResultDerivativeAvailabilityStatuses, GeneratedResultPreviewKinds } from "@domain/image-assets/GeneratedResultAssetDerivativeDomain";
import { GeneratedResultMetadataReadErrorCodes } from "../use-cases/GeneratedResultMetadataReadUseCaseContracts";
import { ListGeneratedResultMetadataUseCase } from "../use-cases/ListGeneratedResultMetadataUseCase";

class InMemoryGeneratedResultRepository implements IGeneratedResultPersistenceRepository {
  public readonly records = new Map<string, GeneratedResultPersistenceRecord>();
  public readonly previews = new Map<string, GeneratedResultPreviewPersistenceRecord[]>();
  public readonly listQueries: GeneratedResultRecordListQuery[] = [];

  public async findResultById(resultAssetId: string): Promise<GeneratedResultPersistenceRecord | undefined> {
    return this.records.get(resultAssetId);
  }

  public async listResults(
    query: GeneratedResultRecordListQuery,
  ): Promise<ReadonlyArray<GeneratedResultPersistenceRecord>> {
    this.listQueries.push(query);
    let records = [...this.records.values()]
      .filter((record) => record.workspaceId === query.workspaceId)
      .sort((left, right) => {
        const created = right.createdAt.localeCompare(left.createdAt);
        if (created !== 0) {
          return created;
        }
        return left.resultAssetId.localeCompare(right.resultAssetId);
      });

    if (!query.includeArchived) {
      records = records.filter((record) => record.status !== GeneratedResultAssetStatuses.archived);
    }
    if (query.runId) {
      records = records.filter((record) => record.runId === query.runId);
    }
    if (query.systemId) {
      records = records.filter((record) => record.systemId === query.systemId);
    }
    if (query.workflowId) {
      records = records.filter((record) => record.workflowId === query.workflowId);
    }
    if (query.statuses && query.statuses.length > 0) {
      records = records.filter((record) => query.statuses?.includes(record.status));
    }
    if (query.updatedAfter) {
      records = records.filter((record) => record.lastModifiedAt >= query.updatedAfter!);
    }
    if (query.lineageInputAssetIds && query.lineageInputAssetIds.length > 0) {
      const lineageInputAssetIds = new Set(query.lineageInputAssetIds);
      records = records.filter((record) => record.inputAssetIds.some((assetId) => lineageInputAssetIds.has(assetId)));
    }

    const offset = query.offset ?? 0;
    const limit = query.limit ?? records.length;
    return Object.freeze(records.slice(offset, offset + limit));
  }

  public async listResultsByRun(input: {
    readonly workspaceId: string;
    readonly runId: string;
  }): Promise<ReadonlyArray<GeneratedResultPersistenceRecord>> {
    return Object.freeze([...this.records.values()].filter((record) =>
      record.workspaceId === input.workspaceId && record.runId === input.runId,
    ));
  }

  public async createResult(
    record: GeneratedResultPersistenceRecord,
    _mutation: GeneratedResultPersistenceMutationEnvelope,
  ): Promise<GeneratedResultPersistenceMutationResult<GeneratedResultPersistenceRecord>> {
    this.records.set(record.resultAssetId, record);
    return Object.freeze({ record, changed: true, wasReplay: false });
  }

  public async saveResult(
    record: GeneratedResultPersistenceRecord,
    _mutation: GeneratedResultPersistenceMutationEnvelope,
  ): Promise<GeneratedResultPersistenceMutationResult<GeneratedResultPersistenceRecord>> {
    this.records.set(record.resultAssetId, record);
    return Object.freeze({ record, changed: true, wasReplay: false });
  }

  public async savePreview(
    record: GeneratedResultPreviewPersistenceRecord,
    _mutation: GeneratedResultPersistenceMutationEnvelope,
  ): Promise<GeneratedResultPersistenceMutationResult<GeneratedResultPreviewPersistenceRecord>> {
    this.previews.set(record.resultAssetId, Object.freeze([record]));
    return Object.freeze({ record, changed: true, wasReplay: false });
  }

  public async listPreviewsByResultId(resultAssetId: string): Promise<ReadonlyArray<GeneratedResultPreviewPersistenceRecord>> {
    return this.previews.get(resultAssetId) ?? Object.freeze([]);
  }

  public async getLineageByResultId(_resultAssetId: string): Promise<GeneratedResultLineageRecord | undefined> {
    return undefined;
  }
}

class WorkspaceAuthorizationReadRepository implements IWorkspaceAuthorizationReadRepository {
  public allow = true;
  public isAdmin = false;

  public async getWorkspaceAuthorizationSnapshot(
    query: Parameters<IWorkspaceAuthorizationReadRepository["getWorkspaceAuthorizationSnapshot"]>[0],
  ): Promise<Awaited<ReturnType<IWorkspaceAuthorizationReadRepository["getWorkspaceAuthorizationSnapshot"]>>> {
    if (!this.allow) {
      return undefined;
    }
    return Object.freeze({
      workspace: {
        id: query.workspaceId,
        slug: "workspace-alpha",
        displayName: "Workspace Alpha",
        status: "active",
        ownership: {
          workspaceId: query.workspaceId,
          ownerUserId: "user-owner",
          visibility: "team",
          createdBy: "user-owner",
          lastModifiedBy: "user-owner",
          createdAt: "2026-04-08T10:00:00.000Z",
          lastModifiedAt: "2026-04-08T10:00:00.000Z",
        },
      },
      membership: {
        id: "membership-alpha",
        workspaceId: query.workspaceId,
        userIdentityId: query.userIdentityId,
        status: "active",
        createdAt: "2026-04-08T10:00:00.000Z",
        updatedAt: "2026-04-08T10:00:00.000Z",
        createdBy: query.userIdentityId,
        lastModifiedBy: query.userIdentityId,
      },
      activeRoleAssignments: Object.freeze([]),
      effectiveRoles: this.isAdmin ? Object.freeze(["admin"]) : Object.freeze(["member"]),
      isWorkspaceOwner: false,
    });
  }
}

function buildResultRecord(input: {
  readonly resultAssetId: string;
  readonly ownerUserId?: string;
  readonly runId: string;
  readonly systemId: string;
  readonly status: "pending-collection" | "available" | "preview-ready" | "failed-collection" | "archived";
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly visibility: "private" | "workspace" | "shared" | "published";
}): GeneratedResultPersistenceRecord {
  return Object.freeze({
    resultAssetId: input.resultAssetId,
    workspaceId: "workspace-alpha",
    ownerUserId: input.ownerUserId,
    runId: input.runId,
    systemId: input.systemId,
    workflowId: "workflow:alpha",
    workflowTemplateId: "workflow-template:alpha",
    executionNodeId: "node:trusted-alpha",
    outputSlot: "primary",
    inputAssetIds: Object.freeze(["input-asset-1"]),
    workflowTemplateVersionId: "workflow-template-version:1",
    workflowTemplateVersionTag: "1.0.0",
    systemSnapshotId: "system-snapshot:1",
    systemVersionTag: "1.0.0",
    parameterSnapshotId: "parameter-snapshot:1",
    selectedNodeId: "node:trusted-alpha",
    executionAdapterKind: "comfyui",
    executionBackendFamily: "comfyui",
    visibility: input.visibility,
    storageInstanceId: "storage-alpha",
    storageBindingReference: "storage-instance://storage-alpha/generated-results",
    mediaType: "image/png",
    status: input.status,
    pendingSince: "2026-04-08T11:59:00.000Z",
    logicalAssetVersionId: input.status === GeneratedResultAssetStatuses.pendingCollection ? undefined : "logical-version:1",
    persistedAt: input.status === GeneratedResultAssetStatuses.pendingCollection ? undefined : "2026-04-08T12:00:00.000Z",
    persistedBy: input.status === GeneratedResultAssetStatuses.pendingCollection ? undefined : "user-owner",
    previewReadyAt: input.status === GeneratedResultAssetStatuses.previewReady ? "2026-04-08T12:02:00.000Z" : undefined,
    previewReadyBy: input.status === GeneratedResultAssetStatuses.previewReady ? "user-owner" : undefined,
    failedAt: input.status === GeneratedResultAssetStatuses.failedCollection ? "2026-04-08T12:02:00.000Z" : undefined,
    failedBy: input.status === GeneratedResultAssetStatuses.failedCollection ? "user-owner" : undefined,
    failureCode: input.status === GeneratedResultAssetStatuses.failedCollection ? "collection-failed" : undefined,
    failureMessage: input.status === GeneratedResultAssetStatuses.failedCollection ? "Collection failed." : undefined,
    archivedAt: input.status === GeneratedResultAssetStatuses.archived ? "2026-04-08T12:03:00.000Z" : undefined,
    archivedBy: input.status === GeneratedResultAssetStatuses.archived ? "user-owner" : undefined,
    tenancy: createWorkspaceTenancyMetadata("workspace-alpha"),
    createdAt: input.createdAt,
    createdBy: "user-owner",
    lastModifiedAt: input.updatedAt,
    lastModifiedBy: "user-owner",
    revision: 1,
    schemaVersion: 1,
  });
}

function buildFixture() {
  const repository = new InMemoryGeneratedResultRepository();
  const workspaceAuthorizationReadRepository = new WorkspaceAuthorizationReadRepository();
  const useCase = new ListGeneratedResultMetadataUseCase({
    generatedResultRepository: repository,
    workspaceAuthorizationReadRepository,
    clock: {
      now: () => new Date("2026-04-08T12:10:00.000Z"),
    },
  });

  return {
    repository,
    workspaceAuthorizationReadRepository,
    useCase,
  };
}

describe("ListGeneratedResultMetadataUseCase", () => {
  it("lists authorized generated results and applies owner/preview filters with pagination", async () => {
    const fixture = buildFixture();
    fixture.repository.records.set("gr-result-a", buildResultRecord({
      resultAssetId: "gr-result-a",
      ownerUserId: "user-owner",
      runId: "run:alpha",
      systemId: "system:alpha",
      status: GeneratedResultAssetStatuses.previewReady,
      createdAt: "2026-04-08T12:00:00.000Z",
      updatedAt: "2026-04-08T12:05:00.000Z",
      visibility: "private",
    }));
    fixture.repository.records.set("gr-result-b", buildResultRecord({
      resultAssetId: "gr-result-b",
      ownerUserId: "user-other",
      runId: "run:alpha",
      systemId: "system:alpha",
      status: GeneratedResultAssetStatuses.available,
      createdAt: "2026-04-08T11:59:00.000Z",
      updatedAt: "2026-04-08T12:04:00.000Z",
      visibility: "private",
    }));
    fixture.repository.records.set("gr-result-c", buildResultRecord({
      resultAssetId: "gr-result-c",
      ownerUserId: "user-owner",
      runId: "run:beta",
      systemId: "system:beta",
      status: GeneratedResultAssetStatuses.available,
      createdAt: "2026-04-08T11:58:00.000Z",
      updatedAt: "2026-04-08T12:03:00.000Z",
      visibility: "workspace",
    }));

    fixture.repository.previews.set("gr-result-a", Object.freeze([Object.freeze({
      derivativeId: "gr-preview-a",
      resultAssetId: "gr-result-a",
      previewKind: GeneratedResultPreviewKinds.thumbnail,
      availabilityStatus: GeneratedResultDerivativeAvailabilityStatuses.available,
      isPrimaryPreview: true,
      mediaType: "image/png",
      tenancy: createWorkspaceTenancyMetadata("workspace-alpha"),
      createdAt: "2026-04-08T12:05:01.000Z",
      createdBy: "user-owner",
      lastModifiedAt: "2026-04-08T12:05:01.000Z",
      lastModifiedBy: "user-owner",
      revision: 1,
      schemaVersion: 1,
    })]));

    const outcome = await fixture.useCase.execute({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      ownerUserIds: ["user-owner"],
      previewStates: ["preview-available"],
      limit: 1,
      offset: 0,
    });

    expect(outcome.ok).toBeTrue();
    if (!outcome.ok) {
      return;
    }
    expect(outcome.value.items).toHaveLength(1);
    expect(outcome.value.items[0]?.resultAssetId).toBe("gr-result-a");
    expect(outcome.value.items[0]?.reuse.reusableAsWorkflowInput).toBeTrue();
    expect(outcome.value.items[0]?.reuse.supportedInputPurposes).toEqual(["source-image", "reference-image"]);
    expect(outcome.value.items[0]?.reuse.assetClasses).toEqual(["image-asset", "reference-asset"]);
    expect(outcome.value.items[0]?.reuse.mediaClasses).toEqual(["image"]);
    expect(outcome.value.pagination.hasMore).toBeFalse();
  });

  it("passes run/system/status/recent and lineage filters to repository query", async () => {
    const fixture = buildFixture();
    fixture.repository.records.set("gr-result-a", buildResultRecord({
      resultAssetId: "gr-result-a",
      ownerUserId: "user-owner",
      runId: "run:alpha",
      systemId: "system:alpha",
      status: GeneratedResultAssetStatuses.available,
      createdAt: "2026-04-08T12:00:00.000Z",
      updatedAt: "2026-04-08T12:05:00.000Z",
      visibility: "workspace",
    }));

    const outcome = await fixture.useCase.execute({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      runId: "run:alpha",
      systemId: "system:alpha",
      statuses: [GeneratedResultAssetStatuses.available],
      updatedAfter: "2026-04-08T12:04:00.000Z",
      lineageInputAssetIds: ["input-asset-1"],
    });

    expect(outcome.ok).toBeTrue();
    const query = fixture.repository.listQueries[0];
    expect(query).toEqual(expect.objectContaining({
      runId: "run:alpha",
      systemId: "system:alpha",
      statuses: [GeneratedResultAssetStatuses.available],
      updatedAfter: "2026-04-08T12:04:00.000Z",
      lineageInputAssetIds: ["input-asset-1"],
    }));
  });

  it("supports reuse compatibility filters for later workflow source selection", async () => {
    const fixture = buildFixture();
    fixture.repository.records.set("gr-result-a", buildResultRecord({
      resultAssetId: "gr-result-a",
      ownerUserId: "user-owner",
      runId: "run:alpha",
      systemId: "system:alpha",
      status: GeneratedResultAssetStatuses.previewReady,
      createdAt: "2026-04-08T12:00:00.000Z",
      updatedAt: "2026-04-08T12:05:00.000Z",
      visibility: "workspace",
    }));
    fixture.repository.records.set("gr-result-b", buildResultRecord({
      resultAssetId: "gr-result-b",
      ownerUserId: "user-owner",
      runId: "run:beta",
      systemId: "system:beta",
      status: GeneratedResultAssetStatuses.pendingCollection,
      createdAt: "2026-04-08T11:58:00.000Z",
      updatedAt: "2026-04-08T12:03:00.000Z",
      visibility: "workspace",
    }));

    const outcome = await fixture.useCase.execute({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      requiredInputPurposes: ["source-image"],
      requiredAssetClasses: ["image-asset"],
      requiredMediaClasses: ["image"],
      reuseReadyOnly: true,
    });

    expect(outcome.ok).toBeTrue();
    if (!outcome.ok) {
      return;
    }
    expect(outcome.value.items.map((entry) => entry.resultAssetId)).toEqual(["gr-result-a"]);
  });

  it("returns access denied when workspace membership is missing", async () => {
    const fixture = buildFixture();
    fixture.workspaceAuthorizationReadRepository.allow = false;

    const outcome = await fixture.useCase.execute({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
    });

    expect(outcome).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: GeneratedResultMetadataReadErrorCodes.accessDenied,
      }),
    });
  });
});
