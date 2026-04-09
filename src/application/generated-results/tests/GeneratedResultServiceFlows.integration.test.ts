import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { IWorkspaceAuthorizationReadRepository } from "@application/workspaces/ports/IWorkspaceAuthorizationReadRepository";
import type {
  WorkspaceAuthorizationSnapshot,
  WorkspaceAuthorizationSnapshotQuery,
} from "@shared/contracts/workspaces/WorkspaceRepositoryContracts";
import type {
  IStorageLogicalAccessResolutionService,
  ResolveStorageLogicalAccessCommand,
  StorageLogicalAccessResolutionPlan,
  StorageLogicalAccessResolutionResult,
} from "@application/storage/use-cases/StorageLogicalAccessResolutionServiceContracts";
import type {
  CreateStorageObjectKeyRequest,
  CreateStorageObjectKeyResult,
  IStorageObjectPort,
  StorageObjectDeleteRequest,
  StorageObjectDeleteResult,
  StorageObjectMetadata,
  StorageObjectReference,
  StorageObjectWriteRequest,
  StorageObjectWriteResult,
} from "@application/storage/ports/StorageObjectPort";
import { WorkspaceMembershipStatuses, WorkspaceRoles } from "@domain/workspaces/WorkspaceDomain";
import { AssetVisibilities } from "@domain/assets/AssetDomain";
import { GeneratedResultAssetStatuses } from "@domain/image-assets/GeneratedResultAssetDomain";
import {
  GeneratedResultDerivativeAvailabilityStatuses,
  GeneratedResultPreviewKinds,
} from "@domain/image-assets/GeneratedResultAssetDerivativeDomain";
import { createWorkspaceTenancyMetadata } from "@shared/persistence/PersistenceTenancyMetadataFactory";
import { SqliteGeneratedResultPersistenceAdapter } from "@infrastructure/persistence/generated-results/SqliteGeneratedResultPersistenceAdapter";
import { SqliteRunCollectedResultPersistenceAdapter } from "@infrastructure/persistence/generated-results/SqliteRunCollectedResultPersistenceAdapter";
import { TokenizedGeneratedResultPreviewAccessPort } from "@infrastructure/media/generated-results/TokenizedGeneratedResultPreviewAccessPort";
import { SharpGeneratedResultPreviewImageProcessor } from "@infrastructure/media/generated-results/SharpGeneratedResultPreviewImageProcessor";
import { ListGeneratedResultMetadataUseCase } from "../use-cases/ListGeneratedResultMetadataUseCase";
import { GetGeneratedResultOriginalContentUseCase } from "../use-cases/GetGeneratedResultOriginalContentUseCase";
import { RequestGeneratedResultPreviewContentUseCase } from "../use-cases/RequestGeneratedResultPreviewContentUseCase";
import { OpenGeneratedResultPreviewContentUseCase } from "../use-cases/OpenGeneratedResultPreviewContentUseCase";
import { GetGeneratedResultLineageSummaryUseCase } from "../use-cases/GetGeneratedResultLineageSummaryUseCase";
import { GetGeneratedResultLineageDetailUseCase } from "../use-cases/GetGeneratedResultLineageDetailUseCase";
import { GenerateGeneratedResultPreviewUseCase } from "../use-cases/GenerateGeneratedResultPreviewUseCase";

const createdRoots: string[] = [];
const TinyPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2ioAAAAASUVORK5CYII=";

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

class StaticWorkspaceAuthorizationReadRepository implements IWorkspaceAuthorizationReadRepository {
  public async getWorkspaceAuthorizationSnapshot(
    query: WorkspaceAuthorizationSnapshotQuery,
  ): Promise<WorkspaceAuthorizationSnapshot | undefined> {
    if (query.workspaceId !== "workspace-alpha") {
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
          createdAt: "2026-04-09T09:00:00.000Z",
          lastModifiedAt: "2026-04-09T09:00:00.000Z",
        },
      },
      membership: {
        id: "membership-owner",
        workspaceId: query.workspaceId,
        userIdentityId: query.userIdentityId,
        status: WorkspaceMembershipStatuses.active,
        createdAt: "2026-04-09T09:00:00.000Z",
        updatedAt: "2026-04-09T09:00:00.000Z",
        createdBy: "user-owner",
        lastModifiedBy: "user-owner",
      },
      activeRoleAssignments: Object.freeze([]),
      effectiveRoles: Object.freeze([WorkspaceRoles.owner]),
      isWorkspaceOwner: true,
    });
  }
}

class InMemoryStorageObjectPort implements IStorageObjectPort {
  public readonly objects = new Map<string, Uint8Array>();

  public createObjectKey(input: CreateStorageObjectKeyRequest): CreateStorageObjectKeyResult {
    return Object.freeze({
      objectKey: [
        input.namespace,
        ...input.logicalPathSegments,
        input.originalFileName ?? "preview.webp",
      ].join("/"),
      normalizedFileName: input.originalFileName ?? "preview.webp",
      partition: Object.freeze([]),
    });
  }

  public async writeObject(input: StorageObjectWriteRequest): Promise<StorageObjectWriteResult> {
    const key = this.key(input.reference);
    const chunks: Uint8Array[] = [];
    if (input.content instanceof Uint8Array) {
      chunks.push(input.content);
    } else {
      for await (const chunk of input.content) {
        chunks.push(chunk);
      }
    }
    const payload = Buffer.concat(chunks.map((entry) => Buffer.from(entry)));
    this.objects.set(key, payload);

    return Object.freeze({
      objectKey: input.reference.objectKey,
      sizeBytes: payload.byteLength,
      checksum: Object.freeze({
        algorithm: "sha256",
        digest: "b".repeat(64),
      }),
      writtenAt: "2026-04-09T10:00:01.000Z",
    });
  }

  public async objectExists(reference: StorageObjectReference): Promise<boolean> {
    return this.objects.has(this.key(reference));
  }

  public async readObjectMetadata(reference: StorageObjectReference): Promise<StorageObjectMetadata> {
    const payload = this.objects.get(this.key(reference));
    if (!payload) {
      throw new Error("not found");
    }
    return Object.freeze({
      objectKey: reference.objectKey,
      sizeBytes: payload.byteLength,
      lastModifiedAt: "2026-04-09T10:00:00.000Z",
    });
  }

  public async openObjectReadStream(reference: StorageObjectReference): Promise<AsyncIterable<Uint8Array>> {
    const payload = this.objects.get(this.key(reference));
    if (!payload) {
      throw new Error("not found");
    }
    return (async function* stream() {
      yield payload;
    })();
  }

  public async deleteObject(input: StorageObjectDeleteRequest): Promise<StorageObjectDeleteResult> {
    return Object.freeze({
      objectKey: input.reference.objectKey,
      deleted: this.objects.delete(this.key(input.reference)),
      deletedAt: "2026-04-09T10:00:02.000Z",
    });
  }

  private key(reference: StorageObjectReference): string {
    return `${reference.storageInstance.id}:${reference.objectKey}`;
  }
}

class StaticStorageLogicalAccessResolutionService implements IStorageLogicalAccessResolutionService {
  public constructor(private readonly objectPort: IStorageObjectPort) {}

  public async resolveLogicalAccessPlan(
    command: ResolveStorageLogicalAccessCommand,
  ): Promise<StorageLogicalAccessResolutionResult<StorageLogicalAccessResolutionPlan>> {
    return {
      ok: true,
      value: Object.freeze({
        intent: command.intent,
        occurredAt: command.occurredAt ?? "2026-04-09T10:00:00.000Z",
        storageInstance: Object.freeze({
          id: command.storageInstanceId ?? "storage-alpha",
          ownership: Object.freeze({
            workspaceId: command.workspaceId,
          }),
        }),
        objectPort: this.objectPort,
      } as unknown as StorageLogicalAccessResolutionPlan),
    };
  }
}

describe("Generated-result service flows integration", () => {
  it("persists collected outputs and serves authoritative list/original/preview/lineage flows", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-generated-result-service-flows-"));
    createdRoots.push(root);
    const repository = new SqliteGeneratedResultPersistenceAdapter(path.join(root, "generated-results.sqlite"));
    const objectPort = new InMemoryStorageObjectPort();
    const storageResolution = new StaticStorageLogicalAccessResolutionService(objectPort);
    const workspaceAuthorization = new StaticWorkspaceAuthorizationReadRepository();
    const previewAccessPort = new TokenizedGeneratedResultPreviewAccessPort("integration-preview-secret");

    try {
      objectPort.objects.set(
        "storage-alpha:generated-results/run-int-001/output-primary.png",
        Buffer.from(TinyPngBase64, "base64"),
      );

      const persistenceAdapter = new SqliteRunCollectedResultPersistenceAdapter({
        repository,
      });
      const persistence = await persistenceAdapter.persistCollectedResult({
        runId: "run-int-001",
        workflowId: "workflow-int-001",
        systemId: "system-int-001",
        workspaceId: "workspace-alpha",
        actorId: "user-owner",
        occurredAt: "2026-04-09T10:00:00.000Z",
        operationKey: "op:integration:generated-result:persist-1",
        collectedResult: Object.freeze({
          schemaVersion: "1.0.0",
          collectionId: "collection-int-001",
          discoveryId: "discovery-int-001",
          executionJobId: "job-int-001",
          runId: "run-int-001",
          workspaceId: "workspace-alpha",
          collectedAt: "2026-04-09T09:59:59.000Z",
          status: "collected",
          discoveredOutputs: Object.freeze([
            Object.freeze({
              descriptorId: "descriptor-primary",
              discoveredAt: "2026-04-09T09:59:58.000Z",
              outputRole: "primary",
              outputIndex: 0,
              media: Object.freeze({
                mediaKind: "image",
                mimeType: "image/png",
              }),
              temporaryReference: Object.freeze({
                kind: "backend-object-handle",
                backendFamily: "comfyui",
                objectHandle: "backend-output-token-primary",
              }),
              sourceInputAssetReference: "asset-input-001",
              slotMatch: Object.freeze({
                status: "matched",
                outputId: "output-primary",
              }),
            }),
            Object.freeze({
              descriptorId: "descriptor-failed",
              discoveredAt: "2026-04-09T09:59:58.100Z",
              outputRole: "variant",
              outputIndex: 1,
              media: Object.freeze({
                mediaKind: "image",
                mimeType: "image/png",
              }),
              temporaryReference: Object.freeze({
                kind: "backend-object-handle",
                backendFamily: "comfyui",
                objectHandle: "backend-output-token-failed",
              }),
            }),
          ]),
          records: Object.freeze([
            Object.freeze({
              descriptorId: "descriptor-primary",
              temporaryReference: Object.freeze({
                kind: "backend-object-handle",
                backendFamily: "comfyui",
                objectHandle: "backend-output-token-primary",
              }),
              persistence: Object.freeze({
                status: "persisted",
                logicalAsset: Object.freeze({
                  assetId: "gr-result-int-001",
                  logicalAssetReference: "storage-instance://storage-alpha/generated-results/run-int-001/output-primary.png",
                  persistedAt: "2026-04-09T09:59:59.200Z",
                }),
              }),
              lineageMetadata: Object.freeze({
                inputAssetIds: Object.freeze(["asset-input-001", "asset-input-002"]),
              }),
            }),
            Object.freeze({
              descriptorId: "descriptor-failed",
              temporaryReference: Object.freeze({
                kind: "backend-object-handle",
                backendFamily: "comfyui",
                objectHandle: "backend-output-token-failed",
              }),
              persistence: Object.freeze({
                status: "failed",
                errorCode: "store-write-failed",
                message: "Could not store generated output.",
                retryable: true,
              }),
            }),
          ]),
          summary: Object.freeze({
            discoveredCount: 2,
            collectedCount: 2,
            persistedCount: 1,
            notPersistedCount: 0,
            failedCount: 1,
          }),
        }),
        terminalResult: Object.freeze({
          summary: "completed",
        }),
      });

      expect(persistence.status).toBe("partially-persisted");
      expect(persistence.outputs).toHaveLength(1);
      expect(persistence.outputs[0]?.assetId).toBe("gr-result-int-001");

      const recordsByRun = await repository.listResultsByRun({
        workspaceId: "workspace-alpha",
        runId: "run-int-001",
      });
      expect(recordsByRun).toHaveLength(2);
      expect(recordsByRun.some((entry) => entry.status === GeneratedResultAssetStatuses.available)).toBeTrue();
      expect(recordsByRun.some((entry) => entry.status === GeneratedResultAssetStatuses.failedCollection)).toBeTrue();
      for (const record of recordsByRun) {
        expect(JSON.stringify(record)).not.toContain("backend-output-token-primary");
        expect(JSON.stringify(record)).not.toContain("backend-output-token-failed");
      }

      const listUseCase = new ListGeneratedResultMetadataUseCase({
        generatedResultRepository: repository,
        workspaceAuthorizationReadRepository: workspaceAuthorization,
      });
      const listOutcome = await listUseCase.execute({
        actorUserId: "user-owner",
        workspaceId: "workspace-alpha",
        runId: "run-int-001",
        includeArchived: true,
      });
      expect(listOutcome.ok).toBeTrue();
      if (!listOutcome.ok) {
        return;
      }
      expect(listOutcome.value.items.some((entry) => entry.resultAssetId === "gr-result-int-001")).toBeTrue();
      expect(listOutcome.value.items.some((entry) => entry.status === "failed-collection")).toBeTrue();

      const originalUseCase = new GetGeneratedResultOriginalContentUseCase({
        generatedResultRepository: repository,
        storageLogicalAccessResolutionService: storageResolution,
        workspaceAuthorizationReadRepository: workspaceAuthorization,
      });
      const originalOutcome = await originalUseCase.execute({
        actorUserId: "user-owner",
        workspaceId: "workspace-alpha",
        resultAssetId: "gr-result-int-001",
      });
      expect(originalOutcome.ok).toBeTrue();
      if (!originalOutcome.ok) {
        return;
      }
      expect(originalOutcome.value.mediaType).toBe("image/png");
      expect(originalOutcome.value.sizeBytes).toBeGreaterThan(0);

      const requestPreviewUseCase = new RequestGeneratedResultPreviewContentUseCase({
        generatedResultRepository: repository,
        workspaceAuthorizationReadRepository: workspaceAuthorization,
      });

      const pendingPreviewOutcome = await requestPreviewUseCase.execute({
        actorUserId: "user-owner",
        workspaceId: "workspace-alpha",
        resultAssetId: "gr-result-int-001",
      });
      expect(pendingPreviewOutcome.ok).toBeTrue();
      if (!pendingPreviewOutcome.ok) {
        return;
      }
      expect(pendingPreviewOutcome.value.state).toBe("preview-pending");

      const generatePreviewUseCase = new GenerateGeneratedResultPreviewUseCase({
        generatedResultRepository: repository,
        storageLogicalAccessResolutionService: storageResolution,
        previewImageProcessorPort: new SharpGeneratedResultPreviewImageProcessor(),
        previewAccessPort,
      });
      const generation = await generatePreviewUseCase.execute({
        resultAssetId: "gr-result-int-001",
        workspaceId: "workspace-alpha",
        actorUserId: "user-owner",
        operationKey: "op:integration:generated-result:preview-generate-1",
        occurredAt: "2026-04-09T10:00:01.000Z",
      });
      expect(generation.ok).toBeTrue();
      if (!generation.ok) {
        return;
      }

      const availablePreviewOutcome = await requestPreviewUseCase.execute({
        actorUserId: "user-owner",
        workspaceId: "workspace-alpha",
        resultAssetId: "gr-result-int-001",
      });
      expect(availablePreviewOutcome.ok).toBeTrue();
      if (!availablePreviewOutcome.ok) {
        return;
      }
      expect(availablePreviewOutcome.value.state).toBe("preview-available");
      const previewToken = availablePreviewOutcome.value.selected?.previewToken;
      expect(previewToken).toBeDefined();

      const openPreviewUseCase = new OpenGeneratedResultPreviewContentUseCase({
        generatedResultRepository: repository,
        storageLogicalAccessResolutionService: storageResolution,
        workspaceAuthorizationReadRepository: workspaceAuthorization,
        previewAccessPort,
      });
      const openPreviewOutcome = await openPreviewUseCase.execute({
        actorUserId: "user-owner",
        workspaceId: "workspace-alpha",
        resultAssetId: "gr-result-int-001",
        previewToken: previewToken ?? "",
      });
      expect(openPreviewOutcome.ok).toBeTrue();
      if (!openPreviewOutcome.ok) {
        return;
      }
      expect(openPreviewOutcome.value.mediaType).toBe("image/webp");
      expect(openPreviewOutcome.value.sizeBytes).toBeGreaterThan(0);

      const lineageSummaryUseCase = new GetGeneratedResultLineageSummaryUseCase({
        generatedResultRepository: repository,
        workspaceAuthorizationReadRepository: workspaceAuthorization,
      });
      const lineageDetailUseCase = new GetGeneratedResultLineageDetailUseCase({
        generatedResultRepository: repository,
        workspaceAuthorizationReadRepository: workspaceAuthorization,
      });
      const summary = await lineageSummaryUseCase.execute({
        actorUserId: "user-owner",
        workspaceId: "workspace-alpha",
        resultAssetId: "gr-result-int-001",
      });
      const detail = await lineageDetailUseCase.execute({
        actorUserId: "user-owner",
        workspaceId: "workspace-alpha",
        resultAssetId: "gr-result-int-001",
      });
      expect(summary.ok).toBeTrue();
      expect(detail.ok).toBeTrue();
      if (!summary.ok || !detail.ok) {
        return;
      }
      expect(summary.value.lineage.runId).toBe("run-int-001");
      expect(summary.value.lineage.inputAssetCount).toBe(2);
      expect(detail.value.lineage.summary.workflowId).toBe("workflow-int-001");
      expect(detail.value.lineage.upstreamInputs).toHaveLength(2);
      expect(detail.value.lineage.upstreamInputs).toContainEqual({ assetId: "asset-input-001" });
      expect(detail.value.lineage.upstreamInputs).toContainEqual({ assetId: "asset-input-002" });
      expect(JSON.stringify(detail.value.lineage)).not.toContain("backend-output-token");
    } finally {
      repository.dispose();
    }
  });

  it("returns explicit preview-missing and preview-failed states from authoritative preview records", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-generated-result-preview-states-"));
    createdRoots.push(root);
    const repository = new SqliteGeneratedResultPersistenceAdapter(path.join(root, "generated-results.sqlite"));
    const workspaceAuthorization = new StaticWorkspaceAuthorizationReadRepository();

    try {
      await repository.saveResult(Object.freeze({
        resultAssetId: "gr-result-no-preview",
        workspaceId: "workspace-alpha",
        ownerUserId: "user-owner",
        runId: "run-int-002",
        systemId: "system-int-002",
        workflowId: "workflow-int-002",
        workflowTemplateId: undefined,
        executionNodeId: undefined,
        outputSlot: "primary",
        inputAssetIds: Object.freeze(["asset-input-010"]),
        workflowTemplateVersionId: undefined,
        workflowTemplateVersionTag: undefined,
        systemSnapshotId: undefined,
        systemVersionTag: undefined,
        parameterSnapshotId: undefined,
        selectedNodeId: undefined,
        executionAdapterKind: "comfyui",
        executionBackendFamily: "comfyui",
        visibility: AssetVisibilities.workspace,
        sharingPolicyId: undefined,
        sharingPolicyVersion: undefined,
        storageInstanceId: "storage-alpha",
        storageBindingReference: "storage-instance://storage-alpha/generated-results/run-int-002/output-001.png",
        mediaType: "image/png",
        status: GeneratedResultAssetStatuses.available,
        pendingSince: "2026-04-09T11:00:00.000Z",
        logicalAssetVersionId: "storage-instance://storage-alpha/generated-results/run-int-002/output-001.png",
        persistedAt: "2026-04-09T11:00:01.000Z",
        persistedBy: "user-owner",
        previewReadyAt: undefined,
        previewReadyBy: undefined,
        failedAt: undefined,
        failedBy: undefined,
        failureCode: undefined,
        failureMessage: undefined,
        archivedAt: undefined,
        archivedBy: undefined,
        tenancy: createWorkspaceTenancyMetadata("workspace-alpha"),
        createdAt: "2026-04-09T11:00:00.000Z",
        createdBy: "user-owner",
        lastModifiedAt: "2026-04-09T11:00:01.000Z",
        lastModifiedBy: "user-owner",
        revision: 1,
        schemaVersion: 1,
      }), {
        operationKey: "op:integration:no-preview:result",
        context: {
          actorUserId: "user-owner",
          occurredAt: "2026-04-09T11:00:01.000Z",
        },
      });

      await repository.saveResult(Object.freeze({
        resultAssetId: "gr-result-preview-failed",
        workspaceId: "workspace-alpha",
        ownerUserId: "user-owner",
        runId: "run-int-002",
        systemId: "system-int-002",
        workflowId: "workflow-int-002",
        workflowTemplateId: undefined,
        executionNodeId: undefined,
        outputSlot: "variant",
        inputAssetIds: Object.freeze(["asset-input-011"]),
        workflowTemplateVersionId: undefined,
        workflowTemplateVersionTag: undefined,
        systemSnapshotId: undefined,
        systemVersionTag: undefined,
        parameterSnapshotId: undefined,
        selectedNodeId: undefined,
        executionAdapterKind: "comfyui",
        executionBackendFamily: "comfyui",
        visibility: AssetVisibilities.workspace,
        sharingPolicyId: undefined,
        sharingPolicyVersion: undefined,
        storageInstanceId: "storage-alpha",
        storageBindingReference: "storage-instance://storage-alpha/generated-results/run-int-002/output-002.png",
        mediaType: "image/png",
        status: GeneratedResultAssetStatuses.available,
        pendingSince: "2026-04-09T11:00:00.000Z",
        logicalAssetVersionId: "storage-instance://storage-alpha/generated-results/run-int-002/output-002.png",
        persistedAt: "2026-04-09T11:00:01.000Z",
        persistedBy: "user-owner",
        previewReadyAt: undefined,
        previewReadyBy: undefined,
        failedAt: undefined,
        failedBy: undefined,
        failureCode: undefined,
        failureMessage: undefined,
        archivedAt: undefined,
        archivedBy: undefined,
        tenancy: createWorkspaceTenancyMetadata("workspace-alpha"),
        createdAt: "2026-04-09T11:00:00.000Z",
        createdBy: "user-owner",
        lastModifiedAt: "2026-04-09T11:00:01.000Z",
        lastModifiedBy: "user-owner",
        revision: 1,
        schemaVersion: 1,
      }), {
        operationKey: "op:integration:preview-failed:result",
        context: {
          actorUserId: "user-owner",
          occurredAt: "2026-04-09T11:00:01.000Z",
        },
      });

      await repository.savePreview(Object.freeze({
        derivativeId: "gr-preview-failed-001",
        resultAssetId: "gr-result-preview-failed",
        resultLogicalAssetVersionId: "storage-instance://storage-alpha/generated-results/run-int-002/output-002.png",
        previewKind: GeneratedResultPreviewKinds.displaySafe,
        availabilityStatus: GeneratedResultDerivativeAvailabilityStatuses.failed,
        isPrimaryPreview: true,
        protectedResourceId: undefined,
        accessHandle: undefined,
        mediaType: undefined,
        width: undefined,
        height: undefined,
        byteSize: undefined,
        generatedAt: undefined,
        failureCode: "preview-generation-failed",
        failureMessage: "Preview generation failed.",
        tenancy: createWorkspaceTenancyMetadata("workspace-alpha"),
        createdAt: "2026-04-09T11:00:02.000Z",
        createdBy: "user-owner",
        lastModifiedAt: "2026-04-09T11:00:02.000Z",
        lastModifiedBy: "user-owner",
        revision: 1,
        schemaVersion: 1,
      }), {
        operationKey: "op:integration:preview-failed:preview",
        context: {
          actorUserId: "user-owner",
          occurredAt: "2026-04-09T11:00:02.000Z",
        },
      });

      const requestPreviewUseCase = new RequestGeneratedResultPreviewContentUseCase({
        generatedResultRepository: repository,
        workspaceAuthorizationReadRepository: workspaceAuthorization,
      });

      const missing = await requestPreviewUseCase.execute({
        actorUserId: "user-owner",
        workspaceId: "workspace-alpha",
        resultAssetId: "gr-result-no-preview",
      });
      const failed = await requestPreviewUseCase.execute({
        actorUserId: "user-owner",
        workspaceId: "workspace-alpha",
        resultAssetId: "gr-result-preview-failed",
      });

      expect(missing.ok).toBeTrue();
      expect(failed.ok).toBeTrue();
      if (!missing.ok || !failed.ok) {
        return;
      }
      expect(missing.value.state).toBe("preview-unavailable");
      expect(missing.value.reasonCode).toBe("preview-missing");
      expect(failed.value.state).toBe("preview-failed");
      expect(failed.value.reasonCode).toBe("preview-generation-failed");
    } finally {
      repository.dispose();
    }
  });
});
