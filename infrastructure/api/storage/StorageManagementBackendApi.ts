import { randomUUID } from "node:crypto";
import type { IStorageCapabilityInspectionPort, StorageBackendCapabilitySnapshot } from "../../../src/application/storage/ports/StorageCapabilityInspectionPort";
import type { StorageSynchronizationAdapter, StorageSynchronizationStateSnapshot } from "../../../src/infrastructure/storage/sync/ServerManagedStorageSynchronizationAdapter";
import { toStorageSynchronizationMetadataDto } from "../../../src/infrastructure/storage/sync/StorageSynchronizationTransportMapper";
import type { IStorageManagementService, StorageManagementErrorCode } from "../../../src/application/storage/use-cases/StorageManagementServiceContracts";
import { StorageManagementErrorCodes } from "../../../src/application/storage/use-cases/StorageManagementServiceContracts";
import type { StorageInstance } from "../../../src/domain/storage/StorageDomain";
import {
  toCreateStorageInstanceResponseDto,
  toGetStorageInstanceDetailResponseDto,
  toListStorageInstancesResponseDto,
  toUpdateStorageInstanceResponseDto,
  type StorageDtoProjectionOptions,
} from "../../../src/shared/dto/storage/StorageTransportDtos";
import type { StorageSyncStatus } from "../../../src/shared/contracts/storage/StorageTransportContracts";
import {
  StorageTransportSchemaValidationError,
  parseCreateStorageInstanceRequestDto,
  parseCreateStorageInstanceResponseDto,
  parseGetStorageInstanceDetailResponseDto,
  parseListStorageInstancesResponseDto,
  parseUpdateStorageInstanceRequestDto,
  parseUpdateStorageInstanceResponseDto,
} from "../../../src/shared/schemas/storage/StorageTransportSchemaContracts";
import {
  StorageManagementApiErrorCodes,
  type ActivateStorageInstanceApiRequest,
  type ActivateStorageInstanceApiResponse,
  type CreateStorageInstanceApiRequest,
  type CreateStorageInstanceApiResponse,
  type DeactivateStorageInstanceApiRequest,
  type DeactivateStorageInstanceApiResponse,
  type GetStorageInstanceDetailApiRequest,
  type GetStorageInstanceDetailApiResponse,
  type GetStorageInstanceHealthApiRequest,
  type GetStorageInstanceHealthApiResponse,
  type ListStorageInstancesApiRequest,
  type ListStorageInstancesApiResponse,
  type StorageManagementApiError,
  type StorageManagementApiResponse,
  type UpdateStorageInstanceMetadataApiRequest,
  type UpdateStorageInstanceMetadataApiResponse,
} from "./sdk/PublicStorageManagementApiContract";

export interface StorageManagementBackendApiDependencies {
  readonly storageManagementService: IStorageManagementService;
  readonly synchronizationAdapter?: StorageSynchronizationAdapter;
  readonly capabilityInspectionPort?: IStorageCapabilityInspectionPort;
  readonly clock?: {
    now(): Date;
  };
}

type StorageAccessSummaryProjection = {
  readonly actorUserIdentityId?: string;
  readonly isOwner: boolean;
  readonly source: "authorization-policy" | "ownership-default" | "mixed" | "unknown";
  readonly effectivePermissions: ReadonlyArray<{
    readonly action: "view" | "update-metadata" | "provision" | "activate" | "deactivate" | "use-for-assets";
    readonly effect: "allowed" | "denied" | "restricted" | "unknown";
    readonly reasonCode?: string;
    readonly message?: string;
  }>;
  readonly policyRestrictedCapabilities: ReadonlyArray<{
    readonly capability: "mutable-writes" | "cross-workspace-reads" | "preview-decryption" | "worker-decryption";
    readonly restricted: boolean;
    readonly reasonCode?: string;
  }>;
};

export class StorageManagementBackendApi {
  private readonly clock: { now(): Date };

  public constructor(private readonly dependencies: StorageManagementBackendApiDependencies) {
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async createStorageInstance(
    request: CreateStorageInstanceApiRequest,
  ): Promise<StorageManagementApiResponse<CreateStorageInstanceApiResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failed(StorageManagementApiErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    let parsedRequest: ReturnType<typeof parseCreateStorageInstanceRequestDto>;
    try {
      parsedRequest = parseCreateStorageInstanceRequestDto({
        actorUserIdentityId: request.actorUserIdentityId,
        workspaceId: request.workspaceId,
        operationKey: request.operationKey,
        correlationId: request.correlationId,
        storageInstanceId: request.storageInstanceId,
        backendType: request.backendType,
        display: request.display,
        ownerUserIdentityId: request.ownerUserIdentityId,
        access: request.access,
        replication: request.replication,
        policy: request.policy,
        createdAt: request.createdAt,
        lifecycleState: request.lifecycleState,
      });
    } catch (error) {
      if (error instanceof StorageTransportSchemaValidationError) {
        return this.failedValidation(error);
      }
      throw error;
    }

    const operationKey = normalizeOptional(parsedRequest.operationKey)
      ?? `storage-management:create:${parsedRequest.storageInstanceId}:${randomUUID()}`;
    const correlationId = normalizeOptional(parsedRequest.correlationId)
      ?? `storage-management-create-${randomUUID()}`;

    const outcome = await this.dependencies.storageManagementService.createStorageInstance({
      actorUserIdentityId,
      workspaceId: parsedRequest.workspaceId,
      operationKey,
      correlationId,
      storageInstanceId: parsedRequest.storageInstanceId,
      displayName: parsedRequest.display.displayName,
      backendType: parsedRequest.backendType,
      ownerUserIdentityId: parsedRequest.ownerUserIdentityId,
      access: parsedRequest.access,
      replication: parsedRequest.replication,
      policy: {
        policyId: parsedRequest.policy.policyId,
        maxObjectBytes: parsedRequest.policy.maxObjectBytes,
        retentionDays: parsedRequest.policy.retentionDays,
        immutableWrites: parsedRequest.policy.immutableWrites,
        allowCrossWorkspaceReads: parsedRequest.policy.allowCrossWorkspaceReads,
        labels: parsedRequest.policy.labels,
        encryption: {
          profileId: parsedRequest.policy.encryptionProfileId,
          keyReferenceId: parsedRequest.policy.encryptionKeyReferenceId,
          envelopeRequired: parsedRequest.policy.envelopeRequired,
        },
      },
      lifecycleState: parsedRequest.lifecycleState,
      createdAt: parsedRequest.createdAt,
      requestBackendProvisioning: request.requestBackendProvisioning ?? false,
      includeCapabilities: request.includeCapabilities ?? false,
    });

    if (!outcome.ok) {
      return this.failedFromManagementError(outcome.error.code, outcome.error.message, outcome.error.details);
    }

    const synchronization = this.evaluateSynchronizationState(
      outcome.value.storageInstance,
      outcome.value.capabilities,
      parsedRequest.createdAt,
    );
    const dtoResponse = toCreateStorageInstanceResponseDto(
      outcome.value.storageInstance,
      this.toProjectionOptions(outcome.value.storageInstance, outcome.value.accessSummary, synchronization),
    );
    parseCreateStorageInstanceResponseDto(dtoResponse);

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        ...dtoResponse,
        provisioning: outcome.value.provisioning,
        capabilities: outcome.value.capabilities,
        synchronization: synchronization ? toStorageSynchronizationMetadataDto(synchronization) : undefined,
        synchronizationStatus: synchronization ? this.toStorageSyncStatus(synchronization) : undefined,
      }),
    });
  }

  public async updateStorageMetadata(
    request: UpdateStorageInstanceMetadataApiRequest,
  ): Promise<StorageManagementApiResponse<UpdateStorageInstanceMetadataApiResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failed(StorageManagementApiErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    let parsedRequest: ReturnType<typeof parseUpdateStorageInstanceRequestDto>;
    try {
      parsedRequest = parseUpdateStorageInstanceRequestDto({
        actorUserIdentityId: request.actorUserIdentityId,
        workspaceId: request.workspaceId,
        operationKey: request.operationKey,
        correlationId: request.correlationId,
        storageInstanceId: request.storageInstanceId,
        display: request.display,
        policy: request.policy,
        replication: request.replication,
        lifecycleState: request.lifecycleState,
        occurredAt: request.occurredAt,
      });
    } catch (error) {
      if (error instanceof StorageTransportSchemaValidationError) {
        return this.failedValidation(error);
      }
      throw error;
    }

    const unsupportedMutation = resolveUnsupportedMetadataMutation(parsedRequest);
    if (unsupportedMutation) {
      return this.failed(StorageManagementApiErrorCodes.invalidRequest, unsupportedMutation);
    }

    const operationKey = normalizeOptional(parsedRequest.operationKey)
      ?? `storage-management:update-metadata:${parsedRequest.storageInstanceId}:${randomUUID()}`;
    const correlationId = normalizeOptional(parsedRequest.correlationId)
      ?? `storage-management-update-metadata-${randomUUID()}`;

    const outcome = await this.dependencies.storageManagementService.updateStorageMetadata({
      actorUserIdentityId,
      workspaceId: parsedRequest.workspaceId,
      operationKey,
      correlationId,
      storageInstanceId: parsedRequest.storageInstanceId,
      displayName: parsedRequest.display?.displayName,
      labels: parsedRequest.policy?.labels,
      occurredAt: parsedRequest.occurredAt,
      includeCapabilities: request.includeCapabilities ?? false,
    });

    if (!outcome.ok) {
      return this.failedFromManagementError(outcome.error.code, outcome.error.message, outcome.error.details);
    }

    const synchronization = this.evaluateSynchronizationState(
      outcome.value.storageInstance,
      outcome.value.capabilities,
      parsedRequest.occurredAt,
    );
    const dtoResponse = toUpdateStorageInstanceResponseDto(
      outcome.value.storageInstance,
      this.toProjectionOptions(outcome.value.storageInstance, outcome.value.accessSummary, synchronization),
    );
    parseUpdateStorageInstanceResponseDto(dtoResponse);

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        ...dtoResponse,
        capabilities: outcome.value.capabilities,
        synchronization: synchronization ? toStorageSynchronizationMetadataDto(synchronization) : undefined,
        synchronizationStatus: synchronization ? this.toStorageSyncStatus(synchronization) : undefined,
      }),
    });
  }

  public async activateStorageInstance(
    request: ActivateStorageInstanceApiRequest,
  ): Promise<StorageManagementApiResponse<ActivateStorageInstanceApiResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    const workspaceId = normalizeRequired(request.workspaceId);
    const storageInstanceId = normalizeRequired(request.storageInstanceId);
    if (!actorUserIdentityId || !workspaceId || !storageInstanceId) {
      return this.failed(StorageManagementApiErrorCodes.invalidRequest, "actorUserIdentityId, workspaceId, and storageInstanceId are required.");
    }

    const operationKey = normalizeOptional(request.operationKey)
      ?? `storage-management:activate:${storageInstanceId}:${randomUUID()}`;
    const correlationId = normalizeOptional(request.correlationId)
      ?? `storage-management-activate-${randomUUID()}`;

    const outcome = await this.dependencies.storageManagementService.activateStorageInstance({
      actorUserIdentityId,
      workspaceId,
      storageInstanceId,
      operationKey,
      correlationId,
      activatedAt: request.activatedAt,
      requestBackendActivation: request.requestBackendActivation ?? false,
      includeCapabilities: request.includeCapabilities ?? false,
    });

    if (!outcome.ok) {
      return this.failedFromManagementError(outcome.error.code, outcome.error.message, outcome.error.details);
    }

    const synchronization = this.evaluateSynchronizationState(
      outcome.value.storageInstance,
      outcome.value.capabilities,
      request.activatedAt,
    );
    const dtoResponse = toGetStorageInstanceDetailResponseDto(
      outcome.value.storageInstance,
      this.toProjectionOptions(outcome.value.storageInstance, outcome.value.accessSummary, synchronization),
    );
    parseGetStorageInstanceDetailResponseDto(dtoResponse);

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        ...dtoResponse,
        provisioning: outcome.value.provisioning,
        capabilities: outcome.value.capabilities,
        synchronization: synchronization ? toStorageSynchronizationMetadataDto(synchronization) : undefined,
        synchronizationStatus: synchronization ? this.toStorageSyncStatus(synchronization) : undefined,
      }),
    });
  }

  public async deactivateStorageInstance(
    request: DeactivateStorageInstanceApiRequest,
  ): Promise<StorageManagementApiResponse<DeactivateStorageInstanceApiResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    const workspaceId = normalizeRequired(request.workspaceId);
    const storageInstanceId = normalizeRequired(request.storageInstanceId);
    if (!actorUserIdentityId || !workspaceId || !storageInstanceId) {
      return this.failed(StorageManagementApiErrorCodes.invalidRequest, "actorUserIdentityId, workspaceId, and storageInstanceId are required.");
    }

    const operationKey = normalizeOptional(request.operationKey)
      ?? `storage-management:deactivate:${storageInstanceId}:${randomUUID()}`;
    const correlationId = normalizeOptional(request.correlationId)
      ?? `storage-management-deactivate-${randomUUID()}`;

    const outcome = await this.dependencies.storageManagementService.deactivateStorageInstance({
      actorUserIdentityId,
      workspaceId,
      storageInstanceId,
      operationKey,
      correlationId,
      targetLifecycleState: request.targetLifecycleState,
      deactivatedAt: request.deactivatedAt,
      requestBackendDeactivation: request.requestBackendDeactivation ?? false,
      includeCapabilities: request.includeCapabilities ?? false,
    });

    if (!outcome.ok) {
      return this.failedFromManagementError(outcome.error.code, outcome.error.message, outcome.error.details);
    }

    const synchronization = this.evaluateSynchronizationState(
      outcome.value.storageInstance,
      outcome.value.capabilities,
      request.deactivatedAt,
    );
    const dtoResponse = toGetStorageInstanceDetailResponseDto(
      outcome.value.storageInstance,
      this.toProjectionOptions(outcome.value.storageInstance, outcome.value.accessSummary, synchronization),
    );
    parseGetStorageInstanceDetailResponseDto(dtoResponse);

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        ...dtoResponse,
        provisioning: outcome.value.provisioning,
        capabilities: outcome.value.capabilities,
        synchronization: synchronization ? toStorageSynchronizationMetadataDto(synchronization) : undefined,
        synchronizationStatus: synchronization ? this.toStorageSyncStatus(synchronization) : undefined,
      }),
    });
  }

  public async listStorageInstances(
    request: ListStorageInstancesApiRequest,
  ): Promise<StorageManagementApiResponse<ListStorageInstancesApiResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    const workspaceId = normalizeRequired(request.workspaceId);
    if (!actorUserIdentityId || !workspaceId) {
      return this.failed(StorageManagementApiErrorCodes.invalidRequest, "actorUserIdentityId and workspaceId are required.");
    }

    const outcome = await this.dependencies.storageManagementService.listAccessibleStorageInstances({
      actorUserIdentityId,
      workspaceId,
      backendTypes: request.backendTypes,
      lifecycleStates: request.lifecycleStates,
      accessModes: request.accessModes,
      accessScopes: request.accessScopes,
      limit: request.limit,
      offset: request.offset,
      includeCapabilities: request.includeCapabilities ?? false,
      occurredAt: request.occurredAt,
    });
    if (!outcome.ok) {
      return this.failedFromManagementError(outcome.error.code, outcome.error.message, outcome.error.details);
    }

    const optionsByStorageId: Record<string, StorageDtoProjectionOptions> = {};
    for (const item of outcome.value.items) {
      const synchronization = this.evaluateSynchronizationState(item.storageInstance, item.capabilities, request.occurredAt);
      optionsByStorageId[item.storageInstance.id] = this.toProjectionOptions(item.storageInstance, item.accessSummary, synchronization);
    }

    const response = toListStorageInstancesResponseDto(
      outcome.value.items.map((item) => item.storageInstance),
      optionsByStorageId,
    );
    parseListStorageInstancesResponseDto(response);
    return Object.freeze({ ok: true, data: response });
  }

  public async getStorageInstanceDetail(
    request: GetStorageInstanceDetailApiRequest,
  ): Promise<StorageManagementApiResponse<GetStorageInstanceDetailApiResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    const workspaceId = normalizeRequired(request.workspaceId);
    const storageInstanceId = normalizeRequired(request.storageInstanceId);
    if (!actorUserIdentityId || !workspaceId || !storageInstanceId) {
      return this.failed(StorageManagementApiErrorCodes.invalidRequest, "actorUserIdentityId, workspaceId, and storageInstanceId are required.");
    }

    const outcome = await this.dependencies.storageManagementService.getStorageInstanceDetails({
      actorUserIdentityId,
      workspaceId,
      storageInstanceId,
      includeCapabilities: request.includeCapabilities ?? false,
      occurredAt: request.occurredAt,
    });
    if (!outcome.ok) {
      return this.failedFromManagementError(outcome.error.code, outcome.error.message, outcome.error.details);
    }

    const synchronization = this.evaluateSynchronizationState(
      outcome.value.storageInstance,
      outcome.value.capabilities,
      request.occurredAt,
    );
    const dtoResponse = toGetStorageInstanceDetailResponseDto(
      outcome.value.storageInstance,
      this.toProjectionOptions(outcome.value.storageInstance, outcome.value.accessSummary, synchronization),
    );
    parseGetStorageInstanceDetailResponseDto(dtoResponse);

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        ...dtoResponse,
        capabilities: outcome.value.capabilities,
        synchronization: synchronization ? toStorageSynchronizationMetadataDto(synchronization) : undefined,
        synchronizationStatus: synchronization ? this.toStorageSyncStatus(synchronization) : undefined,
      }),
    });
  }

  public async getStorageInstanceHealth(
    request: GetStorageInstanceHealthApiRequest,
  ): Promise<StorageManagementApiResponse<GetStorageInstanceHealthApiResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    const workspaceId = normalizeRequired(request.workspaceId);
    const storageInstanceId = normalizeRequired(request.storageInstanceId);
    if (!actorUserIdentityId || !workspaceId || !storageInstanceId) {
      return this.failed(StorageManagementApiErrorCodes.invalidRequest, "actorUserIdentityId, workspaceId, and storageInstanceId are required.");
    }

    const inspected = await this.dependencies.storageManagementService.inspectStorageInstanceStatus({
      actorUserIdentityId,
      workspaceId,
      storageInstanceId,
      occurredAt: request.occurredAt,
    });
    if (!inspected.ok) {
      return this.failedFromManagementError(inspected.error.code, inspected.error.message, inspected.error.details);
    }

    const synchronization = this.evaluateSynchronizationState(
      inspected.value.storageInstance,
      inspected.value.capabilities,
      request.occurredAt,
    );
    const dtoResponse = toGetStorageInstanceDetailResponseDto(
      inspected.value.storageInstance,
      this.toProjectionOptions(inspected.value.storageInstance, inspected.value.accessSummary, synchronization),
    );
    parseGetStorageInstanceDetailResponseDto(dtoResponse);

    const synchronizationMetadata = synchronization
      ? toStorageSynchronizationMetadataDto(synchronization)
      : Object.freeze({
      syncCapable: false,
      supportsReplicationSyncOperation: false,
      deploymentAvailability: "unavailable" as const,
      reasonCode: "sync-state-unavailable",
      evaluatedAt: this.clock.now().toISOString(),
    });

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        storage: dtoResponse.storage,
        capabilities: inspected.value.capabilities,
        synchronization: synchronizationMetadata,
        synchronizationStatus: synchronization ? this.toStorageSyncStatus(synchronization) : "disabled",
        lifecycleState: inspected.value.lifecycleState,
        operationalStatus: inspected.value.operationalStatus,
        lastCheckedAt: inspected.value.lastCheckedAt,
        reasonCode: inspected.value.reasonCode,
        operationalNotes: inspected.value.operationalNotes,
      }),
    });
  }

  private toProjectionOptions(
    storageInstance: StorageInstance,
    accessSummary: StorageAccessSummaryProjection | undefined,
    synchronization?: StorageSynchronizationStateSnapshot,
  ): StorageDtoProjectionOptions {
    return Object.freeze({
      accessSummary: accessSummary ? {
        actorUserIdentityId: accessSummary.actorUserIdentityId,
        isOwner: accessSummary.isOwner,
        source: accessSummary.source,
        effectivePermissions: accessSummary.effectivePermissions,
        policyRestrictedCapabilities: accessSummary.policyRestrictedCapabilities,
      } : undefined,
      replicationStatus: synchronization ? Object.freeze({
        lastSyncStatus: this.toStorageSyncStatus(synchronization),
        synchronization: toStorageSynchronizationMetadataDto(synchronization),
      }) : undefined,
      sensitive: Object.freeze({
        backendEndpointReferenceId: `binding:${storageInstance.id}`,
        infrastructureBindingReferenceId: `infrastructure:${storageInstance.id}`,
      }),
    });
  }

  private evaluateSynchronizationState(
    storageInstance: StorageInstance,
    capabilities: StorageBackendCapabilitySnapshot | undefined,
    occurredAt?: string,
  ): StorageSynchronizationStateSnapshot | undefined {
    if (!this.dependencies.synchronizationAdapter) {
      return undefined;
    }

    return this.dependencies.synchronizationAdapter.inspectSynchronizationState({
      storageInstance,
      backendCapabilities: capabilities,
      occurredAt,
    });
  }

  private toStorageSyncStatus(snapshot: StorageSynchronizationStateSnapshot): StorageSyncStatus {
    switch (snapshot.status) {
      case "healthy":
        return "healthy";
      case "degraded":
        return "degraded";
      case "disabled":
        return "disabled";
      default:
        return "pending";
    }
  }

  private failedValidation(error: StorageTransportSchemaValidationError): StorageManagementApiResponse<never> {
    return this.failed(
      StorageManagementApiErrorCodes.invalidRequest,
      "Request validation failed.",
      Object.freeze({
        validationErrors: Object.freeze(error.issues.map((issue) => Object.freeze({
          path: issue.path,
          code: issue.code,
          message: issue.message,
        }))),
      }),
    );
  }

  private failedFromManagementError(
    code: StorageManagementErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): StorageManagementApiResponse<never> {
    switch (code) {
      case StorageManagementErrorCodes.invalidRequest:
        return this.failed(StorageManagementApiErrorCodes.invalidRequest, message, details);
      case StorageManagementErrorCodes.accessDenied:
      case StorageManagementErrorCodes.policyViolation:
        return this.failed(StorageManagementApiErrorCodes.forbidden, message, details);
      case StorageManagementErrorCodes.notFound:
        return this.failed(StorageManagementApiErrorCodes.notFound, message, details);
      case StorageManagementErrorCodes.conflict:
        return this.failed(StorageManagementApiErrorCodes.conflict, message, details);
      case StorageManagementErrorCodes.invalidState:
        return this.failed(StorageManagementApiErrorCodes.invalidState, message, details);
      case StorageManagementErrorCodes.capabilityUnsupported:
        return this.failed(StorageManagementApiErrorCodes.capabilityUnsupported, message, details);
      case StorageManagementErrorCodes.provisioningFailed:
        return this.failed(StorageManagementApiErrorCodes.provisioningFailed, message, details);
      default:
        return this.failed(StorageManagementApiErrorCodes.internal, message, details);
    }
  }

  private failed(
    code: StorageManagementApiError["code"],
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): StorageManagementApiResponse<never> {
    const validationErrors = extractValidationErrors(details);
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code,
        message,
        validationErrors,
        details: details && !validationErrors ? details : undefined,
      }),
    });
  }
}

function resolveUnsupportedMetadataMutation(request: UpdateStorageInstanceMetadataApiRequest): string | undefined {
  if (request.lifecycleState) {
    return "Storage metadata endpoint does not allow lifecycleState mutations.";
  }
  if (request.replication) {
    return "Storage metadata endpoint does not allow replication mutations.";
  }
  if (request.display) {
    if (request.display.description !== undefined) {
      return "Storage metadata endpoint does not allow display.description mutations.";
    }
    if (request.display.tags !== undefined) {
      return "Storage metadata endpoint does not allow display.tags mutations.";
    }
    if (request.display.labels !== undefined) {
      return "Storage metadata endpoint does not allow display.labels mutations.";
    }
    if (request.display.iconName !== undefined) {
      return "Storage metadata endpoint does not allow display.iconName mutations.";
    }
    if (request.display.colorToken !== undefined) {
      return "Storage metadata endpoint does not allow display.colorToken mutations.";
    }
    if (request.display.extensions !== undefined) {
      return "Storage metadata endpoint does not allow display.extensions mutations.";
    }
  }

  if (request.policy) {
    const hasUnsupportedPolicyFields = [
      request.policy.maxObjectBytes,
      request.policy.retentionDays,
      request.policy.immutableWrites,
      request.policy.allowCrossWorkspaceReads,
      request.policy.encryptionMode,
      request.policy.contentEncryptionRequired,
      request.policy.keyScope,
      request.policy.allowPreviewDecryption,
      request.policy.allowWorkerDecryption,
      request.policy.retentionExpiryAction,
      request.policy.purgeGracePeriodDays,
      request.policy.encryptionProfileId,
      request.policy.encryptionKeyReferenceId,
      request.policy.envelopeRequired,
    ].some((value) => value !== undefined);
    if (hasUnsupportedPolicyFields) {
      return "Storage metadata endpoint only supports policy.labels updates.";
    }
  }

  return undefined;
}

function extractValidationErrors(
  details?: Readonly<Record<string, unknown>>,
): ReadonlyArray<{ readonly path: string; readonly code: string; readonly message: string }> | undefined {
  const candidate = details?.validationErrors;
  if (!Array.isArray(candidate)) {
    return undefined;
  }

  const normalized = candidate.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const path = normalizeOptional((item as Record<string, unknown>).path as string | undefined);
    const code = normalizeOptional((item as Record<string, unknown>).code as string | undefined);
    const message = normalizeOptional((item as Record<string, unknown>).message as string | undefined);
    if (!path || !code || !message) {
      return [];
    }
    return [Object.freeze({ path, code, message })];
  });

  return normalized.length > 0 ? Object.freeze(normalized) : undefined;
}

function normalizeRequired(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}
