import type { IGetGeneratedResultOriginalContentUseCase } from "@application/generated-results/use-cases/GetGeneratedResultOriginalContentUseCaseContracts";
import { GeneratedResultOriginalContentReadErrorCodes } from "@application/generated-results/use-cases/GetGeneratedResultOriginalContentUseCaseContracts";
import {
  GeneratedResultManagementApiErrorCodes,
  type GeneratedResultManagementApiError,
  type GeneratedResultManagementApiResponse,
  type OpenGeneratedResultOriginalContentStreamApiRequest,
  type OpenGeneratedResultOriginalContentStreamApiResponse,
} from "./sdk/PublicGeneratedResultManagementApiContract";

export interface GeneratedResultManagementBackendApiDependencies {
  readonly getGeneratedResultOriginalContentUseCase: IGetGeneratedResultOriginalContentUseCase;
}

export class GeneratedResultManagementBackendApi {
  public constructor(private readonly dependencies: GeneratedResultManagementBackendApiDependencies) {}

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
