import type { IWorkspaceAuthorizationReadRepository } from "@application/workspaces/ports/IWorkspaceAuthorizationReadRepository";
import { WorkspaceMembershipStatuses, WorkspaceRoles } from "@domain/workspaces/WorkspaceDomain";
import type { IGeneratedResultPersistenceRepository } from "../ports/IGeneratedResultPersistenceRepository";
import {
  canViewGeneratedResultRecord,
  matchesLineageInputAssetFilter,
  matchesPreviewStateFilter,
  matchesReuseFilter,
  matchesStatus,
  toGeneratedResultMetadataSummary,
} from "./GeneratedResultMetadataProjection";
import {
  GeneratedResultMetadataReadErrorCodes,
  validateListGeneratedResultMetadataRequest,
  type GeneratedResultMetadataReadResult,
  type IListGeneratedResultMetadataUseCase,
  type ListGeneratedResultMetadataRequest,
  type ListGeneratedResultMetadataSuccess,
} from "./GeneratedResultMetadataReadUseCaseContracts";

export interface ListGeneratedResultMetadataUseCaseDependencies {
  readonly generatedResultRepository: IGeneratedResultPersistenceRepository;
  readonly workspaceAuthorizationReadRepository: IWorkspaceAuthorizationReadRepository;
  readonly clock?: {
    now(): Date;
  };
}

const DefaultListLimit = 25;
const MaxListLimit = 100;

export class ListGeneratedResultMetadataUseCase implements IListGeneratedResultMetadataUseCase {
  private readonly clock: { now(): Date };

  public constructor(
    private readonly dependencies: ListGeneratedResultMetadataUseCaseDependencies,
  ) {
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    input: ListGeneratedResultMetadataRequest,
  ): Promise<GeneratedResultMetadataReadResult<ListGeneratedResultMetadataSuccess>> {
    let request: ListGeneratedResultMetadataRequest;
    try {
      request = validateListGeneratedResultMetadataRequest(input);
    } catch (error) {
      return this.failure(
        GeneratedResultMetadataReadErrorCodes.invalidRequest,
        error instanceof Error ? error.message : "Invalid generated-result metadata list request.",
      );
    }

    const occurredAt = request.occurredAt ?? this.clock.now().toISOString();
    const workspaceAuthorization = await this.resolveWorkspaceAuthorization(
      request.workspaceId,
      request.actorUserId,
      occurredAt,
    );
    if (!workspaceAuthorization.isAuthorized) {
      return this.failure(
        GeneratedResultMetadataReadErrorCodes.accessDenied,
        "Generated-result metadata listing requires active workspace membership.",
      );
    }

    const limit = clampLimit(request.limit);
    const offset = request.offset ?? 0;
    const targetVisibleCount = offset + limit + 1;
    const batchSize = clampLimit(Math.max(limit * 2, 50));
    const visible = [];
    let repositoryOffset = 0;

    while (visible.length < targetVisibleCount) {
      const batch = await this.dependencies.generatedResultRepository.listResults({
        workspaceId: request.workspaceId,
        runId: request.runId,
        systemId: request.systemId,
        workflowId: request.workflowId,
        workflowTemplateId: request.workflowTemplateId,
        executionNodeId: request.executionNodeId,
        statuses: request.statuses,
        visibilities: request.visibilities,
        mediaTypes: request.mediaTypes,
        createdAfter: request.createdAfter,
        createdBefore: request.createdBefore,
        updatedAfter: request.updatedAfter,
        updatedBefore: request.updatedBefore,
        lineageInputAssetIds: request.lineageInputAssetIds,
        includeArchived: request.includeArchived,
        limit: batchSize,
        offset: repositoryOffset,
      });

      if (batch.length < 1) {
        break;
      }

      repositoryOffset += batch.length;

      const previewsByRecord = await Promise.all(batch.map((record) =>
        this.dependencies.generatedResultRepository.listPreviewsByResultId(record.resultAssetId)
      ));

      for (let index = 0; index < batch.length; index += 1) {
        const record = batch[index];
        if (!record) {
          continue;
        }
        if (!matchesStatus(record.status, request.statuses)) {
          continue;
        }
        if (!matchesLineageInputAssetFilter(record, request.lineageInputAssetIds)) {
          continue;
        }
        if (!canViewGeneratedResultRecord({
          record,
          actorUserId: request.actorUserId,
          isWorkspaceAdmin: workspaceAuthorization.isWorkspaceAdmin,
        })) {
          continue;
        }
        if (request.ownerUserIds && request.ownerUserIds.length > 0) {
          const owner = record.ownerUserId;
          if (!owner || !request.ownerUserIds.includes(owner)) {
            continue;
          }
        }

        const previews = previewsByRecord[index] ?? [];
        const summary = toGeneratedResultMetadataSummary({
          record,
          previews,
        });
        if (!matchesPreviewStateFilter(summary.preview, request.previewStates)) {
          continue;
        }
        if (typeof request.hasPreview === "boolean" && request.hasPreview !== summary.preview.hasPreview) {
          continue;
        }
        if (!matchesReuseFilter(summary.reuse, {
          requiredInputPurposes: request.requiredInputPurposes,
          requiredAssetClasses: request.requiredAssetClasses,
          requiredMediaClasses: request.requiredMediaClasses,
          reuseReadyOnly: request.reuseReadyOnly,
        })) {
          continue;
        }
        visible.push(summary);
      }

      if (batch.length < batchSize) {
        break;
      }
    }

    const page = Object.freeze(visible.slice(offset, offset + limit));
    const hasMore = visible.length > (offset + limit);

    return {
      ok: true,
      value: Object.freeze({
        items: page,
        pagination: Object.freeze({
          limit,
          offset,
          returned: page.length,
          hasMore,
        }),
      }),
    };
  }

  private async resolveWorkspaceAuthorization(
    workspaceId: string,
    actorUserIdentityId: string,
    occurredAt?: string,
  ): Promise<{ readonly isAuthorized: boolean; readonly isWorkspaceAdmin: boolean }> {
    const snapshot = await this.dependencies.workspaceAuthorizationReadRepository.getWorkspaceAuthorizationSnapshot({
      workspaceId,
      userIdentityId: actorUserIdentityId,
      asOf: occurredAt,
    });
    if (!snapshot) {
      return Object.freeze({ isAuthorized: false, isWorkspaceAdmin: false });
    }

    const isActiveMember = snapshot.isWorkspaceOwner
      || snapshot.membership?.status === WorkspaceMembershipStatuses.active;
    const isWorkspaceAdmin = snapshot.isWorkspaceOwner
      || snapshot.effectiveRoles.includes(WorkspaceRoles.owner)
      || snapshot.effectiveRoles.includes(WorkspaceRoles.admin);

    return Object.freeze({
      isAuthorized: isActiveMember,
      isWorkspaceAdmin,
    });
  }

  private failure(
    code: typeof GeneratedResultMetadataReadErrorCodes[keyof typeof GeneratedResultMetadataReadErrorCodes],
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): GeneratedResultMetadataReadResult<never> {
    return {
      ok: false,
      error: Object.freeze({
        code,
        message,
        details,
      }),
    };
  }
}

function clampLimit(limit: number | undefined): number {
  if (Number.isInteger(limit) && (limit as number) > 0) {
    return Math.min(limit as number, MaxListLimit);
  }
  return DefaultListLimit;
}
