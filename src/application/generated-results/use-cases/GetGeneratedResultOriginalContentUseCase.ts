import {
  StorageLogicalAccessOperationIntents,
  StorageLogicalAccessResolutionErrorCodes,
  type IStorageLogicalAccessResolutionService,
} from "@application/storage/use-cases/StorageLogicalAccessResolutionServiceContracts";
import type { IWorkspaceAuthorizationReadRepository } from "@application/workspaces/ports/IWorkspaceAuthorizationReadRepository";
import { WorkspaceMembershipStatuses, WorkspaceRoles } from "@domain/workspaces/WorkspaceDomain";
import { AssetVisibilities } from "@domain/assets/AssetDomain";
import { GeneratedResultAssetStatuses } from "@domain/image-assets/GeneratedResultAssetDomain";
import type { IGeneratedResultPersistenceRepository } from "../ports/IGeneratedResultPersistenceRepository";
import {
  GeneratedResultOriginalContentReadErrorCodes,
  validateGetGeneratedResultOriginalContentRequest,
  type GeneratedResultOriginalContentReadResult,
  type GetGeneratedResultOriginalContentRequest,
  type GetGeneratedResultOriginalContentSuccess,
  type IGetGeneratedResultOriginalContentUseCase,
} from "./GetGeneratedResultOriginalContentUseCaseContracts";

export interface GetGeneratedResultOriginalContentUseCaseDependencies {
  readonly generatedResultRepository: IGeneratedResultPersistenceRepository;
  readonly storageLogicalAccessResolutionService: IStorageLogicalAccessResolutionService;
  readonly workspaceAuthorizationReadRepository: IWorkspaceAuthorizationReadRepository;
  readonly clock?: {
    now(): Date;
  };
}

interface StorageObjectLookup {
  readonly storageInstanceId: string;
  readonly objectKey: string;
}

export class GetGeneratedResultOriginalContentUseCase implements IGetGeneratedResultOriginalContentUseCase {
  private readonly clock: { now(): Date };

  public constructor(
    private readonly dependencies: GetGeneratedResultOriginalContentUseCaseDependencies,
  ) {
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    input: GetGeneratedResultOriginalContentRequest,
  ): Promise<GeneratedResultOriginalContentReadResult<GetGeneratedResultOriginalContentSuccess>> {
    let request: GetGeneratedResultOriginalContentRequest;
    try {
      request = validateGetGeneratedResultOriginalContentRequest(input);
    } catch (error) {
      return this.failure(
        GeneratedResultOriginalContentReadErrorCodes.invalidRequest,
        error instanceof Error ? error.message : "Invalid generated-result original-content request.",
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
        GeneratedResultOriginalContentReadErrorCodes.accessDenied,
        "Generated-result original-content retrieval requires active workspace membership.",
      );
    }

    const result = await this.dependencies.generatedResultRepository.findResultById(request.resultAssetId);
    if (!result || result.workspaceId !== request.workspaceId) {
      return this.failure(
        GeneratedResultOriginalContentReadErrorCodes.notFound,
        "Generated result was not found for the workspace.",
      );
    }

    if (result.visibility === AssetVisibilities.private
      && result.ownerUserId
      && result.ownerUserId !== request.actorUserId
      && !workspaceAuthorization.isWorkspaceAdmin) {
      return this.failure(
        GeneratedResultOriginalContentReadErrorCodes.notFound,
        "Generated result was not found for the workspace.",
      );
    }

    if (
      result.status !== GeneratedResultAssetStatuses.available
      && result.status !== GeneratedResultAssetStatuses.previewReady
      && result.status !== GeneratedResultAssetStatuses.archived
    ) {
      return this.failure(
        GeneratedResultOriginalContentReadErrorCodes.invalidState,
        `Generated result '${result.resultAssetId}' is not available for original-content retrieval.`,
      );
    }

    const mediaType = result.mediaType;
    if (!mediaType) {
      return this.failure(
        GeneratedResultOriginalContentReadErrorCodes.invalidState,
        "Generated result mediaType is unavailable for original-content retrieval.",
      );
    }

    const storageLookup = resolveStorageObjectLookup(result);
    if (!storageLookup) {
      return this.failure(
        GeneratedResultOriginalContentReadErrorCodes.contentUnavailable,
        "Generated result original content is not currently available.",
      );
    }

    const resolution = await this.dependencies.storageLogicalAccessResolutionService.resolveLogicalAccessPlan({
      workspaceId: request.workspaceId,
      actorUserIdentityId: request.actorUserId,
      storageInstanceId: storageLookup.storageInstanceId,
      intent: StorageLogicalAccessOperationIntents.openObjectReadStream,
      occurredAt,
    });
    if (!resolution.ok) {
      return this.failure(
        mapResolutionErrorCode(resolution.error.code),
        resolution.error.message,
      );
    }

    try {
      const metadata = await resolution.value.objectPort.readObjectMetadata({
        storageInstance: resolution.value.storageInstance,
        objectKey: storageLookup.objectKey,
      });
      const stream = await resolution.value.objectPort.openObjectReadStream({
        storageInstance: resolution.value.storageInstance,
        objectKey: storageLookup.objectKey,
      });
      return {
        ok: true,
        value: Object.freeze({
          resultAssetId: result.resultAssetId,
          workspaceId: result.workspaceId,
          mediaType,
          sizeBytes: metadata.sizeBytes,
          contentDisposition: "attachment",
          contentDispositionFileName: createResultDownloadFilename(result.resultAssetId, mediaType),
          stream,
        }),
      };
    } catch {
      return this.failure(
        GeneratedResultOriginalContentReadErrorCodes.contentUnavailable,
        "Generated result original content is not currently available.",
      );
    }
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
    code: typeof GeneratedResultOriginalContentReadErrorCodes[keyof typeof GeneratedResultOriginalContentReadErrorCodes],
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): GeneratedResultOriginalContentReadResult<never> {
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

function resolveStorageObjectLookup(input: {
  readonly storageInstanceId: string;
  readonly storageBindingReference?: string;
  readonly logicalAssetVersionId?: string;
}): StorageObjectLookup | undefined {
  const candidates = [
    input.storageBindingReference,
    input.logicalAssetVersionId,
  ];

  for (const candidate of candidates) {
    const parsed = parseStorageObjectReference(candidate);
    if (parsed) {
      if (parsed.storageInstanceId !== input.storageInstanceId) {
        continue;
      }
      return parsed;
    }
  }
  return undefined;
}

function parseStorageObjectReference(reference: string | undefined): StorageObjectLookup | undefined {
  const normalized = reference?.trim();
  if (!normalized) {
    return undefined;
  }

  const withoutGeneratedPrefix = normalized.startsWith("generated-output:")
    ? normalized.slice("generated-output:".length)
    : normalized;
  if (!withoutGeneratedPrefix.startsWith("storage-instance://")) {
    return undefined;
  }

  const remainder = withoutGeneratedPrefix.slice("storage-instance://".length);
  const [encodedStorageInstanceId, ...objectSegments] = remainder.split("/");
  const decodedStorageInstanceId = decodeURIComponent((encodedStorageInstanceId ?? "").trim());
  if (!decodedStorageInstanceId) {
    return undefined;
  }
  if (objectSegments.length === 0) {
    return undefined;
  }

  const objectKey = objectSegments
    .map((segment) => decodeURIComponent(segment))
    .join("/")
    .trim();
  if (!objectKey || objectKey.includes("\\") || objectKey.includes("..")) {
    return undefined;
  }

  return Object.freeze({
    storageInstanceId: decodedStorageInstanceId,
    objectKey,
  });
}

function mapResolutionErrorCode(code: string): typeof GeneratedResultOriginalContentReadErrorCodes[keyof typeof GeneratedResultOriginalContentReadErrorCodes] {
  switch (code) {
    case StorageLogicalAccessResolutionErrorCodes.invalidRequest:
      return GeneratedResultOriginalContentReadErrorCodes.invalidRequest;
    case StorageLogicalAccessResolutionErrorCodes.notFound:
      return GeneratedResultOriginalContentReadErrorCodes.notFound;
    case StorageLogicalAccessResolutionErrorCodes.policyViolation:
      return GeneratedResultOriginalContentReadErrorCodes.accessDenied;
    default:
      return GeneratedResultOriginalContentReadErrorCodes.internal;
  }
}

function createResultDownloadFilename(resultAssetId: string, mediaType: string): string {
  const extension = mediaTypeToExtension(mediaType);
  const safeId = resultAssetId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, "-")
    .replace(/-+/g, "-");
  return `${safeId || "generated-result"}.${extension}`;
}

function mediaTypeToExtension(mediaType: string): string {
  switch (mediaType.toLowerCase()) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/bmp":
      return "bmp";
    case "image/tiff":
      return "tiff";
    case "image/avif":
      return "avif";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    default:
      return "bin";
  }
}

