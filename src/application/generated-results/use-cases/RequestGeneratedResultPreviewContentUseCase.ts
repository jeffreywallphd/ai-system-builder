import type { IWorkspaceAuthorizationReadRepository } from "@application/workspaces/ports/IWorkspaceAuthorizationReadRepository";
import { GeneratedResultDerivativeAvailabilityStatuses } from "@domain/image-assets/GeneratedResultAssetDerivativeDomain";
import { WorkspaceMembershipStatuses, WorkspaceRoles } from "@domain/workspaces/WorkspaceDomain";
import { AssetVisibilities } from "@domain/assets/AssetDomain";
import {
  GeneratedResultPreviewStates,
} from "@shared/contracts/assets/GeneratedResultTransportContracts";
import type { IGeneratedResultPersistenceRepository } from "../ports/IGeneratedResultPersistenceRepository";
import type { GeneratedResultPreviewPersistenceRecord } from "@shared/dto/assets/GeneratedResultPersistenceDtos";
import {
  GeneratedResultPreviewContentReadErrorCodes,
  validateRequestGeneratedResultPreviewContentRequest,
  type GeneratedResultPreviewContentReadResult,
  type IRequestGeneratedResultPreviewContentUseCase,
  type RequestGeneratedResultPreviewContentRequest,
  type RequestGeneratedResultPreviewContentSuccess,
} from "./GetGeneratedResultPreviewContentUseCaseContracts";

export interface RequestGeneratedResultPreviewContentUseCaseDependencies {
  readonly generatedResultRepository: IGeneratedResultPersistenceRepository;
  readonly workspaceAuthorizationReadRepository: IWorkspaceAuthorizationReadRepository;
  readonly clock?: {
    now(): Date;
  };
}

export class RequestGeneratedResultPreviewContentUseCase implements IRequestGeneratedResultPreviewContentUseCase {
  private readonly clock: { now(): Date };

  public constructor(
    private readonly dependencies: RequestGeneratedResultPreviewContentUseCaseDependencies,
  ) {
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    input: RequestGeneratedResultPreviewContentRequest,
  ): Promise<GeneratedResultPreviewContentReadResult<RequestGeneratedResultPreviewContentSuccess>> {
    let request: RequestGeneratedResultPreviewContentRequest;
    try {
      request = validateRequestGeneratedResultPreviewContentRequest(input);
    } catch (error) {
      return this.failure(
        GeneratedResultPreviewContentReadErrorCodes.invalidRequest,
        error instanceof Error ? error.message : "Invalid generated-result preview request.",
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
        GeneratedResultPreviewContentReadErrorCodes.accessDenied,
        "Generated-result preview retrieval requires active workspace membership.",
      );
    }

    const result = await this.dependencies.generatedResultRepository.findResultById(request.resultAssetId);
    if (!result || result.workspaceId !== request.workspaceId) {
      return this.failure(
        GeneratedResultPreviewContentReadErrorCodes.notFound,
        "Generated result was not found for the workspace.",
      );
    }

    if (
      result.visibility === AssetVisibilities.private
      && result.ownerUserId
      && result.ownerUserId !== request.actorUserId
      && !workspaceAuthorization.isWorkspaceAdmin
    ) {
      return this.failure(
        GeneratedResultPreviewContentReadErrorCodes.notFound,
        "Generated result was not found for the workspace.",
      );
    }

    const previews = await this.dependencies.generatedResultRepository.listPreviewsByResultId(result.resultAssetId);
    const alternatives = Object.freeze(previews.map((preview) => Object.freeze({
      derivativeId: preview.derivativeId,
      previewKind: preview.previewKind,
      availabilityStatus: preview.availabilityStatus,
      mediaType: preview.mediaType,
      width: preview.width,
      height: preview.height,
      byteSize: preview.byteSize,
      failureCode: preview.failureCode,
    })));

    const ordered = this.selectPreviewCandidates(previews, request.preferredPreviewKinds);
    const selected = ordered[0];
    if (!selected) {
      return {
        ok: true,
        value: Object.freeze({
          resultAssetId: result.resultAssetId,
          workspaceId: result.workspaceId,
          state: GeneratedResultPreviewStates.unavailable,
          available: false,
          reasonCode: request.preferredPreviewKinds?.length ? "preferred-preview-not-available" : "preview-missing",
          retryable: true,
          alternatives,
        }),
      };
    }

    if (selected.availabilityStatus === GeneratedResultDerivativeAvailabilityStatuses.pending) {
      return {
        ok: true,
        value: Object.freeze({
          resultAssetId: result.resultAssetId,
          workspaceId: result.workspaceId,
          state: GeneratedResultPreviewStates.pending,
          available: false,
          reasonCode: "preview-pending",
          retryable: true,
          alternatives,
        }),
      };
    }

    if (selected.availabilityStatus === GeneratedResultDerivativeAvailabilityStatuses.failed) {
      return {
        ok: true,
        value: Object.freeze({
          resultAssetId: result.resultAssetId,
          workspaceId: result.workspaceId,
          state: GeneratedResultPreviewStates.failed,
          available: false,
          reasonCode: selected.failureCode ?? "preview-failed",
          retryable: false,
          alternatives,
        }),
      };
    }

    if (!selected.accessHandle || !selected.mediaType) {
      return {
        ok: true,
        value: Object.freeze({
          resultAssetId: result.resultAssetId,
          workspaceId: result.workspaceId,
          state: GeneratedResultPreviewStates.unavailable,
          available: false,
          reasonCode: "preview-access-unavailable",
          retryable: true,
          alternatives,
        }),
      };
    }

    const previewToken = extractPreviewToken(selected.accessHandle);
    if (!previewToken) {
      return {
        ok: true,
        value: Object.freeze({
          resultAssetId: result.resultAssetId,
          workspaceId: result.workspaceId,
          state: GeneratedResultPreviewStates.unavailable,
          available: false,
          reasonCode: "preview-access-unavailable",
          retryable: true,
          alternatives,
        }),
      };
    }

    return {
      ok: true,
      value: Object.freeze({
        resultAssetId: result.resultAssetId,
        workspaceId: result.workspaceId,
        state: GeneratedResultPreviewStates.available,
        available: true,
        selected: Object.freeze({
          derivativeId: selected.derivativeId,
          previewKind: selected.previewKind,
          availabilityStatus: selected.availabilityStatus,
          mediaType: selected.mediaType,
          width: selected.width,
          height: selected.height,
          byteSize: selected.byteSize,
          previewToken,
        }),
        alternatives,
      }),
    };
  }

  private selectPreviewCandidates(
    previews: ReadonlyArray<GeneratedResultPreviewPersistenceRecord>,
    preferredPreviewKinds: ReadonlyArray<string> | undefined,
  ): ReadonlyArray<GeneratedResultPreviewPersistenceRecord> {
    const preferenceOrder = new Map<string, number>();
    for (const [index, kind] of (preferredPreviewKinds ?? []).entries()) {
      if (!preferenceOrder.has(kind)) {
        preferenceOrder.set(kind, index);
      }
    }

    return Object.freeze([...previews].sort((left, right) => {
      const leftPreference = preferenceOrder.get(left.previewKind) ?? Number.MAX_SAFE_INTEGER;
      const rightPreference = preferenceOrder.get(right.previewKind) ?? Number.MAX_SAFE_INTEGER;
      if (leftPreference !== rightPreference) {
        return leftPreference - rightPreference;
      }

      if (left.isPrimaryPreview !== right.isPrimaryPreview) {
        return left.isPrimaryPreview ? -1 : 1;
      }

      const updatedDelta = Date.parse(right.lastModifiedAt) - Date.parse(left.lastModifiedAt);
      if (Number.isFinite(updatedDelta) && updatedDelta !== 0) {
        return updatedDelta;
      }

      return left.derivativeId.localeCompare(right.derivativeId);
    }));
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
    code: typeof GeneratedResultPreviewContentReadErrorCodes[keyof typeof GeneratedResultPreviewContentReadErrorCodes],
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): GeneratedResultPreviewContentReadResult<never> {
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

function extractPreviewToken(accessHandle: string): string | undefined {
  const prefix = "preview-access://generated-results/";
  const normalized = accessHandle.trim();
  if (!normalized.startsWith(prefix)) {
    return undefined;
  }
  const token = normalized.slice(prefix.length).trim();
  return token.length > 0 ? token : undefined;
}
