import type { IGetGeneratedResultOriginalContentUseCase } from "@application/generated-results/use-cases/GetGeneratedResultOriginalContentUseCaseContracts";
import { GeneratedResultOriginalContentReadErrorCodes } from "@application/generated-results/use-cases/GetGeneratedResultOriginalContentUseCaseContracts";
import type {
  IGetGeneratedResultMetadataUseCase,
  IListGeneratedResultMetadataUseCase,
} from "@application/generated-results/use-cases/GeneratedResultMetadataReadUseCaseContracts";
import { GeneratedResultMetadataReadErrorCodes } from "@application/generated-results/use-cases/GeneratedResultMetadataReadUseCaseContracts";
import type {
  IGetGeneratedResultLineageDetailUseCase,
  IGetGeneratedResultLineageSummaryUseCase,
} from "@application/generated-results/use-cases/GeneratedResultLineageReadUseCaseContracts";
import { GeneratedResultLineageReadErrorCodes } from "@application/generated-results/use-cases/GeneratedResultLineageReadUseCaseContracts";
import type {
  IOpenGeneratedResultPreviewContentUseCase,
  IRequestGeneratedResultPreviewContentUseCase,
} from "@application/generated-results/use-cases/GetGeneratedResultPreviewContentUseCaseContracts";
import { GeneratedResultPreviewContentReadErrorCodes } from "@application/generated-results/use-cases/GetGeneratedResultPreviewContentUseCaseContracts";
import {
  GeneratedResultManagementApiErrorCodes,
  type GetGeneratedResultApiRequest,
  type GetGeneratedResultApiResponse,
  type GeneratedResultManagementApiError,
  type GeneratedResultManagementApiResponse,
  type ListGeneratedResultsApiRequest,
  type ListGeneratedResultsApiResponse,
  type ListGeneratedResultsByRunApiRequest,
  type ListGeneratedResultsByRunApiResponse,
  type OpenGeneratedResultPreviewContentStreamApiRequest,
  type OpenGeneratedResultPreviewContentStreamApiResponse,
  type OpenGeneratedResultOriginalContentStreamApiRequest,
  type OpenGeneratedResultOriginalContentStreamApiResponse,
  type GetGeneratedResultLineageSummaryApiRequest,
  type GetGeneratedResultLineageSummaryApiResponse,
  type GetGeneratedResultLineageDetailApiRequest,
  type GetGeneratedResultLineageDetailApiResponse,
  type RequestGeneratedResultPreviewApiRequest,
  type RequestGeneratedResultPreviewApiResponse,
} from "./sdk/PublicGeneratedResultManagementApiContract";

export interface GeneratedResultManagementBackendApiDependencies {
  readonly listGeneratedResultMetadataUseCase: IListGeneratedResultMetadataUseCase;
  readonly getGeneratedResultMetadataUseCase: IGetGeneratedResultMetadataUseCase;
  readonly getGeneratedResultOriginalContentUseCase: IGetGeneratedResultOriginalContentUseCase;
  readonly requestGeneratedResultPreviewContentUseCase: IRequestGeneratedResultPreviewContentUseCase;
  readonly openGeneratedResultPreviewContentUseCase: IOpenGeneratedResultPreviewContentUseCase;
  readonly getGeneratedResultLineageSummaryUseCase: IGetGeneratedResultLineageSummaryUseCase;
  readonly getGeneratedResultLineageDetailUseCase: IGetGeneratedResultLineageDetailUseCase;
}

export class GeneratedResultManagementBackendApi {
  public constructor(private readonly dependencies: GeneratedResultManagementBackendApiDependencies) {}

  public async listGeneratedResults(
    request: ListGeneratedResultsApiRequest,
  ): Promise<GeneratedResultManagementApiResponse<ListGeneratedResultsApiResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failed(
        GeneratedResultManagementApiErrorCodes.invalidRequest,
        "actorUserIdentityId is required.",
      );
    }

    const outcome = await this.dependencies.listGeneratedResultMetadataUseCase.execute({
      actorUserId: actorUserIdentityId,
      workspaceId: request.workspaceId,
      ownerUserIds: request.ownerUserIds,
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
      previewStates: request.previewStates,
      hasPreview: request.hasPreview,
      lineageInputAssetIds: request.lineageInputAssetIds,
      requiredInputPurposes: request.requiredInputPurposes,
      requiredAssetClasses: request.requiredAssetClasses,
      requiredMediaClasses: request.requiredMediaClasses,
      reuseReadyOnly: request.reuseReadyOnly,
      includeArchived: request.includeArchived,
      limit: request.limit,
      offset: request.offset,
      correlationId: request.correlationId,
      occurredAt: request.occurredAt,
    });

    if (!outcome.ok) {
      return this.failedFromMetadataReadError(
        outcome.error.code,
        outcome.error.message,
        outcome.error.details,
      );
    }

    return {
      ok: true,
      data: Object.freeze({
        items: Object.freeze(outcome.value.items.map((item) => Object.freeze({
          ...item,
        }))),
        pagination: Object.freeze({
          ...outcome.value.pagination,
        }),
      }),
    };
  }

  public async getGeneratedResult(
    request: GetGeneratedResultApiRequest,
  ): Promise<GeneratedResultManagementApiResponse<GetGeneratedResultApiResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failed(
        GeneratedResultManagementApiErrorCodes.invalidRequest,
        "actorUserIdentityId is required.",
      );
    }

    const outcome = await this.dependencies.getGeneratedResultMetadataUseCase.execute({
      actorUserId: actorUserIdentityId,
      workspaceId: request.workspaceId,
      resultAssetId: request.resultAssetId,
      correlationId: request.correlationId,
      occurredAt: request.occurredAt,
    });

    if (!outcome.ok) {
      return this.failedFromMetadataReadError(
        outcome.error.code,
        outcome.error.message,
        outcome.error.details,
      );
    }

    return {
      ok: true,
      data: Object.freeze({
        result: Object.freeze({
          ...outcome.value.result,
        }),
      }),
    };
  }

  public async listGeneratedResultsByRun(
    request: ListGeneratedResultsByRunApiRequest,
  ): Promise<GeneratedResultManagementApiResponse<ListGeneratedResultsByRunApiResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failed(
        GeneratedResultManagementApiErrorCodes.invalidRequest,
        "actorUserIdentityId is required.",
      );
    }

    const outcome = await this.dependencies.listGeneratedResultMetadataUseCase.execute({
      actorUserId: actorUserIdentityId,
      workspaceId: request.workspaceId,
      runId: request.runId,
      includeArchived: false,
      limit: request.limit,
      offset: request.offset,
      correlationId: request.correlationId,
      occurredAt: request.occurredAt,
    });

    if (!outcome.ok) {
      return this.failedFromMetadataReadError(
        outcome.error.code,
        outcome.error.message,
        outcome.error.details,
      );
    }

    return {
      ok: true,
      data: Object.freeze({
        runId: request.runId,
        items: Object.freeze(outcome.value.items.map((item) => Object.freeze({
          ...item,
        }))),
        pagination: Object.freeze({
          ...outcome.value.pagination,
        }),
      }),
    };
  }

  public async openGeneratedResultOriginalContentStream(
    request: OpenGeneratedResultOriginalContentStreamApiRequest,
  ): Promise<GeneratedResultManagementApiResponse<OpenGeneratedResultOriginalContentStreamApiResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failed(
        GeneratedResultManagementApiErrorCodes.invalidRequest,
        "actorUserIdentityId is required.",
      );
    }

    const outcome = await this.dependencies.getGeneratedResultOriginalContentUseCase.execute({
      actorUserId: actorUserIdentityId,
      workspaceId: request.workspaceId,
      resultAssetId: request.resultAssetId,
      correlationId: request.correlationId,
      occurredAt: request.occurredAt,
    });

    if (!outcome.ok) {
      return this.failedFromOriginalContentReadError(
        outcome.error.code,
        outcome.error.message,
        outcome.error.details,
      );
    }

    return {
      ok: true,
      data: Object.freeze({
        resultAssetId: outcome.value.resultAssetId,
        workspaceId: outcome.value.workspaceId,
        mimeType: outcome.value.mediaType,
        sizeBytes: outcome.value.sizeBytes,
        contentDisposition: outcome.value.contentDisposition,
        contentDispositionFileName: outcome.value.contentDispositionFileName,
        stream: outcome.value.stream,
      }),
    };
  }

  public async requestGeneratedResultPreview(
    request: RequestGeneratedResultPreviewApiRequest,
  ): Promise<GeneratedResultManagementApiResponse<RequestGeneratedResultPreviewApiResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failed(
        GeneratedResultManagementApiErrorCodes.invalidRequest,
        "actorUserIdentityId is required.",
      );
    }

    const outcome = await this.dependencies.requestGeneratedResultPreviewContentUseCase.execute({
      actorUserId: actorUserIdentityId,
      workspaceId: request.workspaceId,
      resultAssetId: request.resultAssetId,
      preferredPreviewKinds: request.preferredPreviewKinds,
      correlationId: request.correlationId,
      occurredAt: request.occurredAt,
    });

    if (!outcome.ok) {
      return this.failedFromPreviewContentReadError(
        outcome.error.code,
        outcome.error.message,
        outcome.error.details,
      );
    }

    return {
      ok: true,
      data: Object.freeze({
        preview: Object.freeze({
          resultAssetId: outcome.value.resultAssetId,
          workspaceId: outcome.value.workspaceId,
          state: outcome.value.state,
          available: outcome.value.available,
          reasonCode: outcome.value.reasonCode,
          retryable: outcome.value.retryable,
          selected: outcome.value.selected
            ? Object.freeze({
              derivativeId: outcome.value.selected.derivativeId,
              previewKind: outcome.value.selected.previewKind,
              mediaType: outcome.value.selected.mediaType ?? "image/webp",
              width: outcome.value.selected.width,
              height: outcome.value.selected.height,
              byteSize: outcome.value.selected.byteSize,
              previewToken: outcome.value.selected.previewToken,
              contentEndpoint: `/api/v1/generated-results/${encodeURIComponent(outcome.value.resultAssetId)}/preview/content`,
            })
            : undefined,
          alternatives: Object.freeze(outcome.value.alternatives.map((item) => Object.freeze({
            derivativeId: item.derivativeId,
            previewKind: item.previewKind,
            availabilityStatus: item.availabilityStatus,
            mediaType: item.mediaType,
            width: item.width,
            height: item.height,
            byteSize: item.byteSize,
            failureCode: item.failureCode,
          }))),
        }),
      }),
    };
  }

  public async openGeneratedResultPreviewContentStream(
    request: OpenGeneratedResultPreviewContentStreamApiRequest,
  ): Promise<GeneratedResultManagementApiResponse<OpenGeneratedResultPreviewContentStreamApiResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failed(
        GeneratedResultManagementApiErrorCodes.invalidRequest,
        "actorUserIdentityId is required.",
      );
    }

    const outcome = await this.dependencies.openGeneratedResultPreviewContentUseCase.execute({
      actorUserId: actorUserIdentityId,
      workspaceId: request.workspaceId,
      resultAssetId: request.resultAssetId,
      previewToken: request.previewToken,
      correlationId: request.correlationId,
      occurredAt: request.occurredAt,
    });

    if (!outcome.ok) {
      return this.failedFromPreviewContentReadError(
        outcome.error.code,
        outcome.error.message,
        outcome.error.details,
      );
    }

    return {
      ok: true,
      data: Object.freeze({
        resultAssetId: outcome.value.resultAssetId,
        workspaceId: outcome.value.workspaceId,
        mimeType: outcome.value.mediaType,
        sizeBytes: outcome.value.sizeBytes,
        contentDisposition: outcome.value.contentDisposition,
        contentDispositionFileName: outcome.value.contentDispositionFileName,
        stream: outcome.value.stream,
      }),
    };
  }

  public async getGeneratedResultLineageSummary(
    request: GetGeneratedResultLineageSummaryApiRequest,
  ): Promise<GeneratedResultManagementApiResponse<GetGeneratedResultLineageSummaryApiResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failed(
        GeneratedResultManagementApiErrorCodes.invalidRequest,
        "actorUserIdentityId is required.",
      );
    }

    const outcome = await this.dependencies.getGeneratedResultLineageSummaryUseCase.execute({
      actorUserId: actorUserIdentityId,
      workspaceId: request.workspaceId,
      resultAssetId: request.resultAssetId,
      correlationId: request.correlationId,
      occurredAt: request.occurredAt,
    });
    if (!outcome.ok) {
      return this.failedFromLineageReadError(
        outcome.error.code,
        outcome.error.message,
        outcome.error.details,
      );
    }

    return {
      ok: true,
      data: Object.freeze({
        lineage: outcome.value.lineage,
      }),
    };
  }

  public async getGeneratedResultLineageDetail(
    request: GetGeneratedResultLineageDetailApiRequest,
  ): Promise<GeneratedResultManagementApiResponse<GetGeneratedResultLineageDetailApiResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failed(
        GeneratedResultManagementApiErrorCodes.invalidRequest,
        "actorUserIdentityId is required.",
      );
    }

    const outcome = await this.dependencies.getGeneratedResultLineageDetailUseCase.execute({
      actorUserId: actorUserIdentityId,
      workspaceId: request.workspaceId,
      resultAssetId: request.resultAssetId,
      correlationId: request.correlationId,
      occurredAt: request.occurredAt,
    });
    if (!outcome.ok) {
      return this.failedFromLineageReadError(
        outcome.error.code,
        outcome.error.message,
        outcome.error.details,
      );
    }

    return {
      ok: true,
      data: Object.freeze({
        lineage: outcome.value.lineage,
      }),
    };
  }

  private failedFromOriginalContentReadError(
    code: typeof GeneratedResultOriginalContentReadErrorCodes[keyof typeof GeneratedResultOriginalContentReadErrorCodes],
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): GeneratedResultManagementApiResponse<never> {
    switch (code) {
      case GeneratedResultOriginalContentReadErrorCodes.invalidRequest:
        return this.failed(GeneratedResultManagementApiErrorCodes.invalidRequest, message, details);
      case GeneratedResultOriginalContentReadErrorCodes.accessDenied:
        return this.failed(GeneratedResultManagementApiErrorCodes.forbidden, message, details);
      case GeneratedResultOriginalContentReadErrorCodes.notFound:
        return this.failed(GeneratedResultManagementApiErrorCodes.notFound, message, details);
      case GeneratedResultOriginalContentReadErrorCodes.invalidState:
      case GeneratedResultOriginalContentReadErrorCodes.contentUnavailable:
        return this.failed(GeneratedResultManagementApiErrorCodes.invalidState, message, details);
      default:
        return this.failed(GeneratedResultManagementApiErrorCodes.internal, message, details);
    }
  }

  private failedFromPreviewContentReadError(
    code: typeof GeneratedResultPreviewContentReadErrorCodes[keyof typeof GeneratedResultPreviewContentReadErrorCodes],
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): GeneratedResultManagementApiResponse<never> {
    switch (code) {
      case GeneratedResultPreviewContentReadErrorCodes.invalidRequest:
        return this.failed(GeneratedResultManagementApiErrorCodes.invalidRequest, message, details);
      case GeneratedResultPreviewContentReadErrorCodes.accessDenied:
        return this.failed(GeneratedResultManagementApiErrorCodes.forbidden, message, details);
      case GeneratedResultPreviewContentReadErrorCodes.notFound:
        return this.failed(GeneratedResultManagementApiErrorCodes.notFound, message, details);
      case GeneratedResultPreviewContentReadErrorCodes.invalidState:
      case GeneratedResultPreviewContentReadErrorCodes.contentUnavailable:
        return this.failed(GeneratedResultManagementApiErrorCodes.invalidState, message, details);
      default:
        return this.failed(GeneratedResultManagementApiErrorCodes.internal, message, details);
    }
  }

  private failedFromMetadataReadError(
    code: typeof GeneratedResultMetadataReadErrorCodes[keyof typeof GeneratedResultMetadataReadErrorCodes],
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): GeneratedResultManagementApiResponse<never> {
    switch (code) {
      case GeneratedResultMetadataReadErrorCodes.invalidRequest:
        return this.failed(GeneratedResultManagementApiErrorCodes.invalidRequest, message, details);
      case GeneratedResultMetadataReadErrorCodes.accessDenied:
        return this.failed(GeneratedResultManagementApiErrorCodes.forbidden, message, details);
      case GeneratedResultMetadataReadErrorCodes.notFound:
        return this.failed(GeneratedResultManagementApiErrorCodes.notFound, message, details);
      default:
        return this.failed(GeneratedResultManagementApiErrorCodes.internal, message, details);
    }
  }

  private failedFromLineageReadError(
    code: typeof GeneratedResultLineageReadErrorCodes[keyof typeof GeneratedResultLineageReadErrorCodes],
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): GeneratedResultManagementApiResponse<never> {
    switch (code) {
      case GeneratedResultLineageReadErrorCodes.invalidRequest:
        return this.failed(GeneratedResultManagementApiErrorCodes.invalidRequest, message, details);
      case GeneratedResultLineageReadErrorCodes.accessDenied:
        return this.failed(GeneratedResultManagementApiErrorCodes.forbidden, message, details);
      case GeneratedResultLineageReadErrorCodes.notFound:
        return this.failed(GeneratedResultManagementApiErrorCodes.notFound, message, details);
      default:
        return this.failed(GeneratedResultManagementApiErrorCodes.internal, message, details);
    }
  }

  private failed(
    code: GeneratedResultManagementApiError["code"],
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): GeneratedResultManagementApiResponse<never> {
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

function normalizeRequired(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}
