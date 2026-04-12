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
import { GeneratedResultLineageReadErrorCodes } from "../use-cases/GeneratedResultLineageReadUseCaseContracts";
import { GetGeneratedResultLineageSummaryUseCase } from "../use-cases/GetGeneratedResultLineageSummaryUseCase";
import { GetGeneratedResultLineageDetailUseCase } from "../use-cases/GetGeneratedResultLineageDetailUseCase";

class InMemoryGeneratedResultRepository implements IGeneratedResultPersistenceRepository {
  public readonly records = new Map<string, GeneratedResultPersistenceRecord>();
  public readonly lineages = new Map<string, GeneratedResultLineageRecord>();

  public async findResultById(resultAssetId: string): Promise<GeneratedResultPersistenceRecord | undefined> {
    return this.records.get(resultAssetId);
  }

  public async listResults(
    _query: GeneratedResultRecordListQuery,
  ): Promise<ReadonlyArray<GeneratedResultPersistenceRecord>> {
    return Object.freeze([...this.records.values()]);
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
    return Object.freeze({ record, changed: true, wasReplay: false });
  }

  public async listPreviewsByResultId(
    _resultAssetId: string,
  ): Promise<ReadonlyArray<GeneratedResultPreviewPersistenceRecord>> {
    return Object.freeze([]);
  }

  public async getLineageByResultId(resultAssetId: string): Promise<GeneratedResultLineageRecord | undefined> {
    return this.lineages.get(resultAssetId);
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

function buildResultRecord(input?: Partial<GeneratedResultPersistenceRecord>): GeneratedResultPersistenceRecord {
  return Object.freeze({
    resultAssetId: input?.resultAssetId ?? "gr-result-001",
    workspaceId: input?.workspaceId ?? "workspace-alpha",
    ownerUserId: input?.ownerUserId ?? "user-owner",
    runId: input?.runId ?? "run:alpha:001",
    systemId: input?.systemId ?? "system:alpha",
    workflowId: input?.workflowId ?? "workflow:alpha",
    workflowTemplateId: input?.workflowTemplateId ?? "workflow-template:alpha",
    executionNodeId: input?.executionNodeId ?? "node:trusted-alpha",
    outputSlot: input?.outputSlot ?? "primary",
    inputAssetIds: input?.inputAssetIds ?? Object.freeze(["input-asset-1"]),
    workflowTemplateVersionId: input?.workflowTemplateVersionId ?? "workflow-template-version:1",
    workflowTemplateVersionTag: input?.workflowTemplateVersionTag ?? "1.2.3",
    systemSnapshotId: input?.systemSnapshotId ?? "system-snapshot:1",
    systemVersionTag: input?.systemVersionTag ?? "1.0.0",
    parameterSnapshotId: input?.parameterSnapshotId ?? "parameter-snapshot:1",
    selectedNodeId: input?.selectedNodeId ?? "node:trusted-alpha",
    executionAdapterKind: input?.executionAdapterKind ?? "comfyui",
    executionBackendFamily: input?.executionBackendFamily ?? "comfyui",
    visibility: input?.visibility ?? "private",
    sharingPolicyId: input?.sharingPolicyId,
    sharingPolicyVersion: input?.sharingPolicyVersion,
    storageInstanceId: input?.storageInstanceId ?? "storage-alpha",
    storageBindingReference: input?.storageBindingReference ?? "storage-instance://storage-alpha/generated-results",
    mediaType: input?.mediaType ?? "image/png",
    status: input?.status ?? GeneratedResultAssetStatuses.previewReady,
    pendingSince: input?.pendingSince ?? "2026-04-08T12:00:00.000Z",
    logicalAssetVersionId: input?.logicalAssetVersionId ?? "logical-version:1",
    persistedAt: input?.persistedAt ?? "2026-04-08T12:01:00.000Z",
    persistedBy: input?.persistedBy ?? "user-owner",
    previewReadyAt: input?.previewReadyAt ?? "2026-04-08T12:02:00.000Z",
    previewReadyBy: input?.previewReadyBy ?? "user-owner",
    failedAt: input?.failedAt,
    failedBy: input?.failedBy,
    failureCode: input?.failureCode,
    failureMessage: input?.failureMessage,
    archivedAt: input?.archivedAt,
    archivedBy: input?.archivedBy,
    tenancy: input?.tenancy ?? createWorkspaceTenancyMetadata(input?.workspaceId ?? "workspace-alpha"),
    createdAt: input?.createdAt ?? "2026-04-08T12:00:00.000Z",
    createdBy: input?.createdBy ?? "user-owner",
    lastModifiedAt: input?.lastModifiedAt ?? "2026-04-08T12:02:00.000Z",
    lastModifiedBy: input?.lastModifiedBy ?? "user-owner",
    revision: input?.revision ?? 1,
    schemaVersion: input?.schemaVersion ?? 1,
  });
}

describe("Generated-result lineage use cases", () => {
  it("returns lineage summary and detail for authorized callers", async () => {
    const repository = new InMemoryGeneratedResultRepository();
    const workspaceAuthorizationReadRepository = new WorkspaceAuthorizationReadRepository();
    const summaryUseCase = new GetGeneratedResultLineageSummaryUseCase({
      generatedResultRepository: repository,
      workspaceAuthorizationReadRepository,
    });
    const detailUseCase = new GetGeneratedResultLineageDetailUseCase({
      generatedResultRepository: repository,
      workspaceAuthorizationReadRepository,
    });
    const result = buildResultRecord();
    repository.records.set(result.resultAssetId, result);
    repository.lineages.set(result.resultAssetId, Object.freeze({
      resultAssetId: result.resultAssetId,
      runId: result.runId,
      systemId: result.systemId,
      workflowId: result.workflowId,
      workflowTemplateId: result.workflowTemplateId,
      executionNodeId: result.executionNodeId,
      outputSlot: result.outputSlot,
      inputAssetIds: Object.freeze(["input-asset-1", "input-asset-2"]),
      workflowTemplateVersionId: result.workflowTemplateVersionId,
      workflowTemplateVersionTag: result.workflowTemplateVersionTag,
      systemSnapshotId: result.systemSnapshotId,
      systemVersionTag: result.systemVersionTag,
      parameterSnapshotId: result.parameterSnapshotId,
      selectedNodeId: result.selectedNodeId,
      executionAdapterKind: result.executionAdapterKind,
      executionBackendFamily: result.executionBackendFamily,
      updatedAt: "2026-04-08T12:05:00.000Z",
    }));

    const summary = await summaryUseCase.execute({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      resultAssetId: result.resultAssetId,
    });
    const detail = await detailUseCase.execute({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      resultAssetId: result.resultAssetId,
    });

    expect(summary.ok).toBeTrue();
    expect(detail.ok).toBeTrue();
    if (!summary.ok || !detail.ok) {
      return;
    }

    expect(summary.value.lineage.inputAssetCount).toBe(2);
    expect(detail.value.lineage.summary.resultAssetId).toBe(result.resultAssetId);
    expect(detail.value.lineage.source.executionBackendFamily).toBe("comfyui");
    expect(detail.value.lineage.graph.nodes.some((node) => node.nodeType === "result")).toBeTrue();
  });

  it("returns safe not-found for private results when actor is not owner/admin", async () => {
    const repository = new InMemoryGeneratedResultRepository();
    repository.records.set("gr-result-001", buildResultRecord({
      ownerUserId: "user-owner",
      visibility: "private",
    }));
    const workspaceAuthorizationReadRepository = new WorkspaceAuthorizationReadRepository();
    const useCase = new GetGeneratedResultLineageSummaryUseCase({
      generatedResultRepository: repository,
      workspaceAuthorizationReadRepository,
    });

    const outcome = await useCase.execute({
      actorUserId: "user-other",
      workspaceId: "workspace-alpha",
      resultAssetId: "gr-result-001",
    });

    expect(outcome).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: GeneratedResultLineageReadErrorCodes.notFound,
      }),
    });
  });

  it("returns access denied when workspace membership is missing", async () => {
    const repository = new InMemoryGeneratedResultRepository();
    const workspaceAuthorizationReadRepository = new WorkspaceAuthorizationReadRepository();
    workspaceAuthorizationReadRepository.allow = false;
    const useCase = new GetGeneratedResultLineageDetailUseCase({
      generatedResultRepository: repository,
      workspaceAuthorizationReadRepository,
    });

    const outcome = await useCase.execute({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      resultAssetId: "gr-result-001",
    });

    expect(outcome).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: GeneratedResultLineageReadErrorCodes.accessDenied,
      }),
    });
  });
});
