import type { CanonicalDataShape, CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";
import { DatasetSchemaIntentIds } from "../../domain/dataset-studio/schema-intents/DatasetSchemaIntent";
import type {
  IMediaRecordValidator,
  IMediaDatasetValidator,
} from "../../domain/dataset-studio/interfaces/MediaValidation";
import type { IImageRecordValidator } from "../../domain/dataset-studio/contracts/ImageRecord";
import type { IImageMetadataExtractor } from "../../domain/dataset-studio/interfaces/ImageMetadataExtraction";
import { createDefaultMediaAdapterBundle } from "../dataset-studio/adapters/media/MediaAdapterFactory";
import {
  createSystemDatasetBindingFromInstance,
  mapSystemBindingRoleToDatasetInstanceRole,
  type SystemDatasetBinding,
  type SystemDatasetBindingRole,
} from "../../domain/system-runtime/SystemDatasetBindingDomain";
import {
  createDatasetInstance,
  patchDatasetInstance,
  transitionDatasetInstanceLifecycle,
  DatasetInstanceLifecycleStatuses,
  DatasetInstanceRoles,
  DatasetInstanceRuntimeStatuses,
  type DatasetInstancePatch,
  type DatasetInstance,
  type DatasetInstanceCleanupStatus,
  type DatasetInstanceRole,
} from "../../domain/system-runtime/DatasetInstanceDomain";
import {
  WorkflowOutputTargetTypes,
  getWorkflowOutputTargetDefinition,
  resolveWorkflowOutputTargetPurpose,
  type WorkflowOutputTargetType,
} from "../../domain/system-runtime/WorkflowOutputTargetDomain";
import {
  createDatasetInstanceImageRecord,
  deriveStorageReferenceFromImageRecord,
  patchDatasetInstanceImageRecord,
  type DatasetInstanceImageRecordProvenance,
  type DatasetInstanceImageRecordPatch,
  type DatasetInstanceImageRecord,
  type DatasetInstanceImageRecordQuery,
} from "../../domain/system-runtime/DatasetInstanceRecordDomain";
import type { DatasetInstanceAssetCatalog } from "./DatasetInstanceAssetCatalog";
import type { DatasetInstanceRepository } from "./DatasetInstanceRepository";
import { createDefaultMediaValidationAdapters } from "../dataset-studio/adapters/validation/MediaValidationFactory";
import { DatasetInstanceSchemaEnforcementService } from "./DatasetInstanceSchemaEnforcementService";
import type { DatasetOperationalLineageContext, DatasetOperationalLineageSink } from "./DatasetOperationalLineage";
import {
  createDatasetEventEnvelope,
  type DatasetEventPublisher,
} from "../dataset-events/DatasetEventPublisher";
import { DatasetEventActorKinds, DatasetEventTypes } from "../../domain/dataset-studio/contracts/DatasetEvent";

export interface SystemDatasetOwnershipValidator {
  assertSystemExists(systemId: string): Promise<void> | void;
}

export interface CreateSystemDatasetInstanceRequest {
  readonly instanceId: string;
  readonly systemId: string;
  readonly datasetAssetId: string;
  readonly datasetAssetVersionId?: string;
  readonly role: DatasetInstanceRole;
  readonly purpose?: string;
  readonly lifecycleStatus?: DatasetInstance["lifecycleStatus"];
  readonly runtimeStatus?: DatasetInstance["runtimeStatus"];
  readonly storageBinding?: DatasetInstance["storageBinding"];
  readonly seedMetadata?: DatasetInstance["seedMetadata"];
  readonly lifecycleMetadata?: DatasetInstance["lifecycleMetadata"];
}

export interface EnsureRoleDatasetInstanceRequest {
  readonly instanceId: string;
  readonly systemId: string;
  readonly datasetAssetId: string;
  readonly datasetAssetVersionId?: string;
  readonly role: DatasetInstanceRole;
  readonly purpose?: string;
  readonly requiredSchemaIntentId?: string;
  readonly requiredOutputShapeKind?: string;
  readonly storageBinding?: DatasetInstance["storageBinding"];
  readonly seedMetadata?: DatasetInstance["seedMetadata"];
  readonly lifecycleMetadata?: DatasetInstance["lifecycleMetadata"];
}

export interface EnsureInputImageStoreInstanceRequest {
  readonly instanceId: string;
  readonly systemId: string;
  readonly datasetAssetId: string;
  readonly datasetAssetVersionId?: string;
  readonly storageBinding?: DatasetInstance["storageBinding"];
  readonly seedMetadata?: DatasetInstance["seedMetadata"];
}

export interface EnsureOutputImageStoreInstanceRequest {
  readonly instanceId: string;
  readonly systemId: string;
  readonly datasetAssetId: string;
  readonly datasetAssetVersionId?: string;
  readonly storageBinding?: DatasetInstance["storageBinding"];
  readonly seedMetadata?: DatasetInstance["seedMetadata"];
}

export interface EnsureWorkflowOutputTargetInstanceRequest {
  readonly targetType: WorkflowOutputTargetType;
  readonly instanceId: string;
  readonly systemId: string;
  readonly datasetAssetId: string;
  readonly datasetAssetVersionId?: string;
  readonly purpose?: string;
  readonly storageBinding?: DatasetInstance["storageBinding"];
  readonly seedMetadata?: DatasetInstance["seedMetadata"];
}

export interface EnsureIntermediateStoreInstanceRequest {
  readonly instanceId: string;
  readonly systemId: string;
  readonly datasetAssetId: string;
  readonly datasetAssetVersionId?: string;
  readonly purpose?: string;
  readonly requiredSchemaIntentId?: string;
  readonly requiredOutputShapeKind?: string;
  readonly storageBinding?: DatasetInstance["storageBinding"];
  readonly seedMetadata?: DatasetInstance["seedMetadata"];
  readonly lifecycleMetadata?: DatasetInstance["lifecycleMetadata"];
}

export interface BindSystemDatasetInstanceByRoleRequest {
  readonly systemId: string;
  readonly instanceId: string;
  readonly role: SystemDatasetBindingRole;
  readonly purpose?: string;
}

export interface GetSystemDatasetBindingByRoleRequest {
  readonly systemId: string;
  readonly role: SystemDatasetBindingRole;
  readonly purpose?: string;
}

export interface SystemDatasetInstanceServiceOptions {
  readonly mediaRecordValidator?: IMediaRecordValidator;
  readonly imageRecordValidator?: IImageRecordValidator;
  readonly imageMetadataExtractor?: IImageMetadataExtractor;
  readonly datasetEventPublisher?: DatasetEventPublisher;
}

export interface IngestDatasetInstanceImageRecordMetadataExtraction {
  readonly payload: Uint8Array;
  readonly includeExifInMetadata?: boolean;
}

export interface IngestDatasetInstanceImageRecordRequest {
  readonly systemId: string;
  readonly instanceId: string;
  readonly record: unknown;
  readonly recordId?: string;
  readonly storageReference?: string;
  readonly storageProvider?: string;
  readonly metadata?: Readonly<Record<string, CanonicalRecordValue>>;
  readonly provenance?: DatasetInstanceImageRecordProvenance;
  readonly metadataExtraction?: IngestDatasetInstanceImageRecordMetadataExtraction;
  readonly lineageContext?: DatasetOperationalLineageContext;
}

export interface IngestDatasetInstanceImageRecordsRequest {
  readonly systemId: string;
  readonly instanceId: string;
  readonly records: ReadonlyArray<{
    readonly record: unknown;
    readonly recordId?: string;
    readonly storageReference?: string;
    readonly storageProvider?: string;
    readonly metadata?: Readonly<Record<string, CanonicalRecordValue>>;
    readonly provenance?: DatasetInstanceImageRecordProvenance;
    readonly metadataExtraction?: IngestDatasetInstanceImageRecordMetadataExtraction;
  }>;
  readonly lineageContext?: DatasetOperationalLineageContext;
}

export interface QueryDatasetInstanceImageRecordsRequest {
  readonly systemId: string;
  readonly instanceId: string;
  readonly query?: DatasetInstanceImageRecordQuery;
  readonly lineageContext?: DatasetOperationalLineageContext;
}

export interface QueryDatasetInstanceImageRecordPageRequest extends QueryDatasetInstanceImageRecordsRequest {
  readonly limit: number;
  readonly offset: number;
}

export interface QueryDatasetInstanceImageRecordPageResult {
  readonly items: ReadonlyArray<DatasetInstanceImageRecord>;
  readonly totalCount: number;
  readonly limit: number;
  readonly offset: number;
}

export interface GetDatasetInstanceImageRecordRequest {
  readonly systemId: string;
  readonly instanceId: string;
  readonly recordId: string;
  readonly lineageContext?: DatasetOperationalLineageContext;
}

export interface GetDatasetInstanceImageRecordsByIdsRequest {
  readonly systemId: string;
  readonly instanceId: string;
  readonly recordIds: ReadonlyArray<string>;
  readonly lineageContext?: DatasetOperationalLineageContext;
}

export interface UpdateDatasetInstanceImageRecordRequest {
  readonly systemId: string;
  readonly instanceId: string;
  readonly recordId: string;
  readonly patch: DatasetInstanceImageRecordPatch;
  readonly lineageContext?: DatasetOperationalLineageContext;
}

export interface DeleteDatasetInstanceImageRecordRequest {
  readonly systemId: string;
  readonly instanceId: string;
  readonly recordId: string;
  readonly lineageContext?: DatasetOperationalLineageContext;
}

export interface DatasetInstanceImageMutationIssue {
  readonly code: "invalid-request" | "not-found" | "conflict";
  readonly message: string;
}

export interface DatasetInstanceImageMutationResult {
  readonly operation: "create" | "update" | "delete";
  readonly accepted: boolean;
  readonly record?: DatasetInstanceImageRecord;
  readonly deletedRecordId?: string;
  readonly issues: ReadonlyArray<DatasetInstanceImageMutationIssue>;
}

export interface QueryDatasetInstanceImageRecordsResult {
  readonly items: ReadonlyArray<DatasetInstanceImageRecord>;
  readonly totalCount: number;
  readonly appliedQuery?: DatasetInstanceImageRecordQuery;
}

export interface ResolveOwnedDatasetInstanceRequest {
  readonly systemId: string;
  readonly instanceId: string;
}

export interface ResetDatasetInstanceStateRequest {
  readonly systemId: string;
  readonly instanceId: string;
  readonly clearSeedMetadata?: boolean;
  readonly clearLifecycleMetadata?: boolean;
}

export interface ResetDatasetInstanceStateResult {
  readonly instance: DatasetInstance;
  readonly clearedImageRecordCount: number;
}

export interface ArchiveDatasetInstanceRequest {
  readonly systemId: string;
  readonly instanceId: string;
  readonly cleanupStatus?: DatasetInstanceCleanupStatus;
}

export interface DeleteDatasetInstanceRequest {
  readonly systemId: string;
  readonly instanceId: string;
  readonly force?: boolean;
}

export interface DeleteDatasetInstanceResult {
  readonly instanceId: string;
  readonly removedImageRecordCount: number;
}

export interface DeleteDatasetInstanceImageRecordsResult {
  readonly instanceId: string;
  readonly removedCount: number;
}

export interface SelectDatasetInstanceImageRecordRequest {
  readonly systemId: string;
  readonly instanceId: string;
  readonly recordId: string;
  readonly selectionContext?: {
    readonly selectionMode?: string;
    readonly reason?: string;
    readonly rank?: number;
  };
  readonly lineageContext?: DatasetOperationalLineageContext;
}

export interface SelectDatasetInstanceImageRecordResult {
  readonly accepted: boolean;
  readonly changed: boolean;
  readonly record: DatasetInstanceImageRecord;
}

export class SystemDatasetInstanceService {
  private readonly schemaEnforcementService: DatasetInstanceSchemaEnforcementService;
  private readonly imageRecordValidator: IImageRecordValidator;
  private readonly imageMetadataExtractor: IImageMetadataExtractor;
  private readonly lineageSink?: DatasetOperationalLineageSink;
  private readonly datasetEventPublisher?: DatasetEventPublisher;
  private readonly selectedRecordByInstanceKey = new Map<string, string>();

  public constructor(
    private readonly repository: DatasetInstanceRepository,
    private readonly assetCatalog: DatasetInstanceAssetCatalog,
    private readonly mediaDatasetValidator: IMediaDatasetValidator,
    private readonly systemValidator?: SystemDatasetOwnershipValidator,
    options: SystemDatasetInstanceServiceOptions = {},
    lineageSink?: DatasetOperationalLineageSink,
  ) {
    this.schemaEnforcementService = new DatasetInstanceSchemaEnforcementService(
      this.assetCatalog,
      this.mediaDatasetValidator,
      options.mediaRecordValidator ?? createDefaultMediaValidationAdapters().mediaRecordValidator,
    );
    this.imageRecordValidator = options.imageRecordValidator
      ?? createDefaultMediaValidationAdapters().imageRecordValidator;
    this.imageMetadataExtractor = options.imageMetadataExtractor
      ?? createDefaultMediaAdapterBundle().metadataExtractor;
    this.lineageSink = lineageSink;
    this.datasetEventPublisher = options.datasetEventPublisher;
  }

  public async createDatasetInstance(request: CreateSystemDatasetInstanceRequest): Promise<DatasetInstance> {
    this.assertNoPathConfiguration(request);
    await this.assertSystemExists(request.systemId);
    await this.assertAssetLinked({
      datasetAssetId: request.datasetAssetId,
      datasetAssetVersionId: request.datasetAssetVersionId,
    });

    const instance = createDatasetInstance({
      instanceId: request.instanceId,
      systemId: request.systemId,
      datasetAssetId: request.datasetAssetId,
      datasetAssetVersionId: request.datasetAssetVersionId,
      role: request.role,
      purpose: request.purpose,
      lifecycleStatus: request.lifecycleStatus ?? DatasetInstanceLifecycleStatuses.ready,
      runtimeStatus: request.runtimeStatus ?? DatasetInstanceRuntimeStatuses.idle,
      storageBinding: request.storageBinding,
      seedMetadata: request.seedMetadata,
      lifecycleMetadata: request.lifecycleMetadata,
    });

    return this.repository.save(instance);
  }

  public getDatasetInstance(request: ResolveOwnedDatasetInstanceRequest): DatasetInstance | undefined {
    const systemId = normalizeOptional(request.systemId);
    const instanceId = normalizeOptional(request.instanceId);
    if (!systemId || !instanceId) {
      return undefined;
    }
    return this.repository.getBySystemAndId({
      systemId,
      instanceId,
    });
  }

  public loadDatasetInstance(request: {
    readonly systemId: string;
    readonly instanceId: string;
  }): DatasetInstance {
    return this.requireOwnedDatasetInstanceSync(request);
  }

  public listSystemDatasetInstances(systemId: string): ReadonlyArray<DatasetInstance> {
    return this.repository.listBySystemId(systemId);
  }

  public async resetDatasetInstanceState(
    request: ResetDatasetInstanceStateRequest,
  ): Promise<ResetDatasetInstanceStateResult> {
    const instance = await this.requireOwnedDatasetInstance({
      systemId: request.systemId,
      instanceId: request.instanceId,
    });
    this.assertInstanceMutable(instance, "reset dataset instance state");

    const removedImageRecordCount = this.repository.deleteImageRecordsByInstanceId(instance.instanceId);
    const updated = patchDatasetInstance({
      instance,
      patch: {
        runtimeStatus: DatasetInstanceRuntimeStatuses.idle,
        seedMetadata: request.clearSeedMetadata ? null : instance.seedMetadata,
        lifecycleMetadata: request.clearLifecycleMetadata ? null : instance.lifecycleMetadata,
      } satisfies DatasetInstancePatch,
    });
    const saved = this.repository.save(updated);
    if (removedImageRecordCount > 0) {
      this.selectedRecordByInstanceKey.delete(this.createInstanceSelectionKey(instance.systemId, instance.instanceId));
    }
    return Object.freeze({
      instance: saved,
      clearedImageRecordCount: removedImageRecordCount,
    });
  }

  public async archiveDatasetInstance(request: ArchiveDatasetInstanceRequest): Promise<DatasetInstance> {
    const instance = await this.requireOwnedDatasetInstance({
      systemId: request.systemId,
      instanceId: request.instanceId,
    });
    if (instance.lifecycleStatus === DatasetInstanceLifecycleStatuses.archived) {
      return instance;
    }

    const transitioned = transitionDatasetInstanceLifecycle({
      instance,
      nextLifecycleStatus: DatasetInstanceLifecycleStatuses.archived,
      nextRuntimeStatus: DatasetInstanceRuntimeStatuses.unavailable,
    });
    const lifecycleMetadata = request.cleanupStatus
      ? {
        ...(transitioned.lifecycleMetadata ?? {}),
        cleanupStatus: request.cleanupStatus,
      }
      : transitioned.lifecycleMetadata;
    return this.repository.save(patchDatasetInstance({
      instance: transitioned,
      patch: {
        lifecycleMetadata: lifecycleMetadata ?? null,
      },
    }));
  }

  public async deactivateDatasetInstance(request: ArchiveDatasetInstanceRequest): Promise<DatasetInstance> {
    return this.archiveDatasetInstance(request);
  }

  public async deleteDatasetInstance(request: DeleteDatasetInstanceRequest): Promise<DeleteDatasetInstanceResult> {
    const instance = await this.requireOwnedDatasetInstance({
      systemId: request.systemId,
      instanceId: request.instanceId,
    });
    if (!request.force && instance.lifecycleStatus !== DatasetInstanceLifecycleStatuses.archived) {
      throw new Error(
        `invalid-request:Dataset instance '${instance.instanceId}' must be archived before delete/remove.`,
      );
    }

    const removedImageRecordCount = this.repository.deleteImageRecordsByInstanceId(instance.instanceId);
    const deleted = this.repository.deleteById(instance.instanceId);
    if (!deleted) {
      throw new Error(`not-found:Dataset instance '${instance.instanceId}' was not found.`);
    }
    this.selectedRecordByInstanceKey.delete(this.createInstanceSelectionKey(instance.systemId, instance.instanceId));
    return Object.freeze({
      instanceId: instance.instanceId,
      removedImageRecordCount,
    });
  }

  public listSystemDatasetBindings(systemId: string): ReadonlyArray<SystemDatasetBinding> {
    return Object.freeze(this.repository.listBySystemId(systemId).map(createSystemDatasetBindingFromInstance));
  }

  public getSystemDatasetBindingByRole(request: GetSystemDatasetBindingByRoleRequest): SystemDatasetBinding | undefined {
    const instance = this.getBoundDatasetInstanceByRole(request);
    return instance ? createSystemDatasetBindingFromInstance(instance) : undefined;
  }

  public getBoundDatasetInstanceByRole(request: GetSystemDatasetBindingByRoleRequest): DatasetInstance | undefined {
    const role = mapSystemBindingRoleToDatasetInstanceRole(request.role);
    return this.repository.findBySystemAndRole({
      systemId: request.systemId,
      role,
      purpose: request.purpose,
    });
  }

  public async bindDatasetInstanceByRole(request: BindSystemDatasetInstanceByRoleRequest): Promise<SystemDatasetBinding> {
    await this.assertSystemExists(request.systemId);

    const instance = this.repository.getById(request.instanceId);
    if (!instance) {
      throw new Error(`not-found:Dataset instance '${request.instanceId}' was not found.`);
    }

    if (instance.systemId !== request.systemId.trim()) {
      throw new Error(
        `invalid-request:Dataset instance '${instance.instanceId}' is owned by system '${instance.systemId}', not '${request.systemId.trim()}'.`,
      );
    }

    const expectedRole = mapSystemBindingRoleToDatasetInstanceRole(request.role);
    if (instance.role !== expectedRole) {
      throw new Error(
        `invalid-request:Dataset instance '${instance.instanceId}' has role '${instance.role}', expected '${expectedRole}' for binding role '${request.role}'.`,
      );
    }

    const requestedPurpose = normalizeOptional(request.purpose);
    if (requestedPurpose && requestedPurpose !== normalizeOptional(instance.purpose)) {
      throw new Error(
        `invalid-request:Dataset instance '${instance.instanceId}' purpose '${instance.purpose ?? ""}' does not match requested binding purpose '${requestedPurpose}'.`,
      );
    }

    const existing = this.repository.findBySystemAndRole({
      systemId: request.systemId,
      role: expectedRole,
      purpose: requestedPurpose ?? instance.purpose,
    });
    if (existing && existing.instanceId !== instance.instanceId) {
      throw new Error(
        `conflict:System '${request.systemId}' already has a '${expectedRole}' dataset instance for purpose '${requestedPurpose ?? instance.purpose ?? ""}'.`,
      );
    }

    return createSystemDatasetBindingFromInstance(instance);
  }

  public async ensureRoleDatasetInstance(request: EnsureRoleDatasetInstanceRequest): Promise<DatasetInstance> {
    this.assertNoPathConfiguration(request);
    await this.assertSystemExists(request.systemId);
    const asset = await this.assertAssetLinked({
      datasetAssetId: request.datasetAssetId,
      datasetAssetVersionId: request.datasetAssetVersionId,
    });
    if (request.requiredSchemaIntentId && asset.schemaIntentId !== request.requiredSchemaIntentId) {
      throw new Error(
        `invalid-request:Dataset asset '${asset.assetId}@${asset.versionId ?? "latest"}' has schema intent '${asset.schemaIntentId}', expected '${request.requiredSchemaIntentId}'.`,
      );
    }
    if (request.requiredOutputShapeKind && asset.outputShapeKind !== request.requiredOutputShapeKind) {
      throw new Error(
        `invalid-request:Dataset asset '${asset.assetId}@${asset.versionId ?? "latest"}' has output shape '${asset.outputShapeKind}', expected '${request.requiredOutputShapeKind}'.`,
      );
    }

    const existing = this.repository.findBySystemAndRole({
      systemId: request.systemId,
      role: request.role,
      purpose: request.purpose,
    });
    if (existing) {
      if (existing.datasetAssetId !== request.datasetAssetId
        || normalizeOptional(existing.datasetAssetVersionId) !== normalizeOptional(request.datasetAssetVersionId)) {
        throw new Error(
          `conflict:System '${request.systemId}' already has a '${request.role}' dataset instance for purpose '${request.purpose ?? ""}' with different asset linkage.`,
        );
      }
      if (!this.areStorageBindingsEquivalent(existing.storageBinding, request.storageBinding)) {
        throw new Error(
          `conflict:System '${request.systemId}' already has a '${request.role}' dataset instance for purpose '${request.purpose ?? ""}' with different storage binding linkage.`,
        );
      }
      return existing;
    }

    return this.createDatasetInstance({
      instanceId: request.instanceId,
      systemId: request.systemId,
      datasetAssetId: request.datasetAssetId,
      datasetAssetVersionId: request.datasetAssetVersionId,
      role: request.role,
      purpose: request.purpose,
      storageBinding: request.storageBinding,
      seedMetadata: request.seedMetadata,
      lifecycleStatus: DatasetInstanceLifecycleStatuses.ready,
      runtimeStatus: DatasetInstanceRuntimeStatuses.idle,
      lifecycleMetadata: request.lifecycleMetadata,
    });
  }

  public async ensureInputImageStoreInstance(request: EnsureInputImageStoreInstanceRequest): Promise<DatasetInstance> {
    return this.ensureRoleDatasetInstance({
      instanceId: request.instanceId,
      systemId: request.systemId,
      datasetAssetId: request.datasetAssetId,
      datasetAssetVersionId: request.datasetAssetVersionId,
      role: DatasetInstanceRoles.inputStore,
      purpose: "incoming-images",
      requiredSchemaIntentId: DatasetSchemaIntentIds.media,
      requiredOutputShapeKind: "image-metadata-records",
      storageBinding: request.storageBinding,
      seedMetadata: request.seedMetadata,
    });
  }

  public async ensureOutputImageStoreInstance(request: EnsureOutputImageStoreInstanceRequest): Promise<DatasetInstance> {
    return this.ensureWorkflowOutputTargetInstance({
      targetType: WorkflowOutputTargetTypes.outputDataset,
      instanceId: request.instanceId,
      systemId: request.systemId,
      datasetAssetId: request.datasetAssetId,
      datasetAssetVersionId: request.datasetAssetVersionId,
      storageBinding: request.storageBinding,
      seedMetadata: request.seedMetadata,
    });
  }

  public async ensureWorkflowOutputTargetInstance(
    request: EnsureWorkflowOutputTargetInstanceRequest,
  ): Promise<DatasetInstance> {
    const target = getWorkflowOutputTargetDefinition(request.targetType);
    if (!target) {
      throw new Error(`invalid-request:Workflow output target type '${request.targetType}' is not supported.`);
    }
    return this.ensureRoleDatasetInstance({
      instanceId: request.instanceId,
      systemId: request.systemId,
      datasetAssetId: request.datasetAssetId,
      datasetAssetVersionId: request.datasetAssetVersionId,
      role: target.datasetInstanceRole,
      purpose: resolveWorkflowOutputTargetPurpose({
        targetType: request.targetType,
        purpose: request.purpose,
      }),
      requiredSchemaIntentId: DatasetSchemaIntentIds.media,
      requiredOutputShapeKind: "image-metadata-records",
      storageBinding: request.storageBinding,
      seedMetadata: request.seedMetadata,
    });
  }

  public async ensureIntermediateStoreInstance(
    request: EnsureIntermediateStoreInstanceRequest,
  ): Promise<DatasetInstance> {
    return this.ensureRoleDatasetInstance({
      instanceId: request.instanceId,
      systemId: request.systemId,
      datasetAssetId: request.datasetAssetId,
      datasetAssetVersionId: request.datasetAssetVersionId,
      role: DatasetInstanceRoles.intermediateStore,
      purpose: normalizeOptional(request.purpose) ?? "workflow-intermediate-images",
      requiredSchemaIntentId: request.requiredSchemaIntentId,
      requiredOutputShapeKind: request.requiredOutputShapeKind,
      storageBinding: request.storageBinding,
      seedMetadata: request.seedMetadata,
      lifecycleMetadata: request.lifecycleMetadata,
    });
  }

  public validateIncomingShapeForInstance(input: {
    readonly systemId: string;
    readonly instanceId: string;
    readonly shape: CanonicalDataShape;
  }): ReturnType<IMediaDatasetValidator["validateShape"]> {
    const instance = this.requireOwnedDatasetInstanceSync({
      systemId: input.systemId,
      instanceId: input.instanceId,
    });
    return this.schemaEnforcementService.validateShapeForInstance({
      instance,
      shape: input.shape,
    });
  }

  public validateRecordForInstance(input: {
    readonly systemId: string;
    readonly instanceId: string;
    readonly record: unknown;
  }) {
    const instance = this.requireOwnedDatasetInstanceSync({
      systemId: input.systemId,
      instanceId: input.instanceId,
    });
    return this.schemaEnforcementService.validateRecordForInstance({
      instance,
      record: input.record,
    });
  }

  public validateRecordsForInstance(input: {
    readonly systemId: string;
    readonly instanceId: string;
    readonly records: ReadonlyArray<unknown>;
  }) {
    const instance = this.requireOwnedDatasetInstanceSync({
      systemId: input.systemId,
      instanceId: input.instanceId,
    });
    return this.schemaEnforcementService.validateRecordsForInstance({
      instance,
      records: input.records,
    });
  }

  public admitRecordForInstance(input: {
    readonly systemId: string;
    readonly instanceId: string;
    readonly record: unknown;
  }): unknown {
    const instance = this.requireOwnedDatasetInstanceSync({
      systemId: input.systemId,
      instanceId: input.instanceId,
    });
    return this.schemaEnforcementService.admitRecordForInstance({
      instance,
      record: input.record,
    });
  }

  public admitRecordsForInstance(input: {
    readonly systemId: string;
    readonly instanceId: string;
    readonly records: ReadonlyArray<unknown>;
  }): ReadonlyArray<unknown> {
    const instance = this.requireOwnedDatasetInstanceSync({
      systemId: input.systemId,
      instanceId: input.instanceId,
    });
    return this.schemaEnforcementService.admitRecordsForInstance({
      instance,
      records: input.records,
    });
  }

  public async ingestImageRecordIntoInstance(
    request: IngestDatasetInstanceImageRecordRequest,
  ): Promise<DatasetInstanceImageRecord> {
    const instance = await this.requireOwnedDatasetInstance({
      systemId: request.systemId,
      instanceId: request.instanceId,
    });
    this.assertInstanceMutable(instance, "ingest image record");

    const candidate = await this.prepareImageRecordCandidate({
      record: request.record,
      storageReference: request.storageReference,
      metadataExtraction: request.metadataExtraction,
    });
    const admitted = this.schemaEnforcementService.admitRecordForInstance({
      instance,
      record: candidate,
    });
    const image = this.imageRecordValidator.validateImageRecord(admitted);
    const now = new Date().toISOString();
    const persisted = createDatasetInstanceImageRecord({
      recordId: normalizeOptional(request.recordId) ?? this.createImageRecordId(instance.instanceId),
      instanceId: instance.instanceId,
      systemId: instance.systemId,
      datasetAssetId: instance.datasetAssetId,
      datasetAssetVersionId: instance.datasetAssetVersionId,
      image,
      storage: this.createStorageReference({
        explicitReference: request.storageReference,
        explicitProvider: request.storageProvider,
        image,
      }),
      metadata: request.metadata,
      provenance: request.provenance,
      admittedAt: now,
      updatedAt: now,
      mutationVersion: 1,
    });

    const saved = this.repository.saveImageRecord(persisted);
    this.lineageSink?.record({
      eventKind: "record-write",
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      datasetAssetId: instance.datasetAssetId,
      datasetAssetVersionId: instance.datasetAssetVersionId,
      recordId: saved.recordId,
      resultCount: 1,
      operation: "create",
      context: request.lineageContext,
    });
    await this.publishDatasetRecordMutationEvent({
      instance,
      record: saved,
      operation: this.isGeneratedRecord(saved) ? "generated" : "create",
      request,
    });
    return saved;
  }

  public async ingestImageRecordsIntoInstance(
    request: IngestDatasetInstanceImageRecordsRequest,
  ): Promise<ReadonlyArray<DatasetInstanceImageRecord>> {
    const persisted: DatasetInstanceImageRecord[] = [];
    for (const record of request.records) {
      persisted.push(await this.ingestImageRecordIntoInstance({
        systemId: request.systemId,
        instanceId: request.instanceId,
        record: record.record,
        recordId: record.recordId,
        storageReference: record.storageReference,
        storageProvider: record.storageProvider,
        metadata: record.metadata,
        provenance: record.provenance,
        metadataExtraction: record.metadataExtraction,
        lineageContext: request.lineageContext,
      }));
    }
    return Object.freeze(persisted);
  }

  public listImageRecordsForInstance(
    request: QueryDatasetInstanceImageRecordsRequest,
  ): ReadonlyArray<DatasetInstanceImageRecord> {
    const instance = this.requireOwnedDatasetInstanceSync({
      systemId: request.systemId,
      instanceId: request.instanceId,
    });
    const items = this.repository.queryImageRecordsBySystemId({
      systemId: request.systemId,
      instanceId: request.instanceId,
      query: request.query,
    });
    this.lineageSink?.record({
      eventKind: "record-query",
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      datasetAssetId: instance.datasetAssetId,
      datasetAssetVersionId: instance.datasetAssetVersionId,
      operation: "list",
      resultCount: items.length,
      query: request.query as unknown as Readonly<Record<string, unknown>> | undefined,
      context: request.lineageContext,
    });
    return items;
  }

  public listImageRecordPageForInstance(
    request: QueryDatasetInstanceImageRecordPageRequest,
  ): QueryDatasetInstanceImageRecordPageResult {
    const instance = this.requireOwnedDatasetInstanceSync({
      systemId: request.systemId,
      instanceId: request.instanceId,
    });
    const page = this.repository.queryImageRecordPageBySystemId({
      systemId: request.systemId,
      instanceId: request.instanceId,
      query: request.query,
      window: Object.freeze({
        limit: request.limit,
        offset: request.offset,
      }),
    });
    this.lineageSink?.record({
      eventKind: "record-query",
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      datasetAssetId: instance.datasetAssetId,
      datasetAssetVersionId: instance.datasetAssetVersionId,
      operation: "windowed-list",
      resultCount: page.items.length,
      query: request.query as unknown as Readonly<Record<string, unknown>> | undefined,
      context: request.lineageContext,
      metadata: Object.freeze({
        totalCount: String(page.totalCount),
        offset: String(page.offset),
        limit: String(page.limit),
      }),
    });
    return Object.freeze({
      items: page.items,
      totalCount: page.totalCount,
      limit: page.limit,
      offset: page.offset,
    });
  }

  public queryImageRecordsForInstance(
    request: QueryDatasetInstanceImageRecordsRequest,
  ): QueryDatasetInstanceImageRecordsResult {
    const items = this.listImageRecordsForInstance(request);
    return Object.freeze({
      items,
      totalCount: items.length,
      appliedQuery: request.query,
    });
  }

  public getImageRecordFromInstance(
    request: GetDatasetInstanceImageRecordRequest,
  ): DatasetInstanceImageRecord | undefined {
    const instance = this.requireOwnedDatasetInstanceSync({
      systemId: request.systemId,
      instanceId: request.instanceId,
    });
    const recordId = normalizeRequired(request.recordId, "recordId");
    const found = this.repository.getImageRecordBySystemAndId({
      systemId: request.systemId,
      instanceId: request.instanceId,
      recordId,
    });
    this.lineageSink?.record({
      eventKind: "record-read",
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      datasetAssetId: instance.datasetAssetId,
      datasetAssetVersionId: instance.datasetAssetVersionId,
      recordId,
      operation: "get-by-id",
      resultCount: found ? 1 : 0,
      context: request.lineageContext,
    });
    return found;
  }

  public getImageRecordsFromInstanceByIds(
    request: GetDatasetInstanceImageRecordsByIdsRequest,
  ): ReadonlyArray<DatasetInstanceImageRecord> {
    const instance = this.requireOwnedDatasetInstanceSync({
      systemId: request.systemId,
      instanceId: request.instanceId,
    });
    const recordIds = [...new Set(request.recordIds.map((recordId) => normalizeOptional(recordId)).filter(Boolean))];
    if (recordIds.length === 0) {
      return Object.freeze([]);
    }
    const records = Object.freeze(recordIds
      .map((recordId) => this.repository.getImageRecordBySystemAndId({
        systemId: request.systemId,
        instanceId: request.instanceId,
        recordId: recordId!,
      }))
      .filter((record): record is DatasetInstanceImageRecord => Boolean(record)));
    this.lineageSink?.record({
      eventKind: "record-read",
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      datasetAssetId: instance.datasetAssetId,
      datasetAssetVersionId: instance.datasetAssetVersionId,
      recordIds: recordIds as ReadonlyArray<string>,
      operation: "get-by-ids",
      resultCount: records.length,
      context: request.lineageContext,
    });
    return records;
  }

  public async updateImageRecordInInstance(
    request: UpdateDatasetInstanceImageRecordRequest,
  ): Promise<DatasetInstanceImageRecord> {
    const instance = await this.requireOwnedDatasetInstance({
      systemId: request.systemId,
      instanceId: request.instanceId,
    });
    this.assertInstanceMutable(instance, "update image record");

    const recordId = normalizeRequired(request.recordId, "recordId");
    const existing = this.repository.getImageRecordBySystemAndId({
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      recordId,
    });
    if (!existing) {
      throw new Error(
        `not-found:Dataset instance image record '${recordId}' was not found in instance '${instance.instanceId}'.`,
      );
    }

    const patched = patchDatasetInstanceImageRecord({
      record: existing,
      patch: request.patch,
    });
    const admitted = this.schemaEnforcementService.admitRecordForInstance({
      instance,
      record: patched.image,
    });
    const image = this.imageRecordValidator.validateImageRecord(admitted);
    const persisted = createDatasetInstanceImageRecord({
      recordId: patched.recordId,
      instanceId: patched.instanceId,
      systemId: patched.systemId,
      datasetAssetId: patched.datasetAssetId,
      datasetAssetVersionId: patched.datasetAssetVersionId,
      image,
      storage: patched.storage,
      metadata: patched.metadata,
      provenance: patched.provenance,
      generation: patched.generation,
      admittedAt: patched.admittedAt,
      updatedAt: patched.updatedAt,
      mutationVersion: patched.mutationVersion,
    });
    const saved = this.repository.saveImageRecord(persisted);
    this.lineageSink?.record({
      eventKind: "record-write",
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      datasetAssetId: instance.datasetAssetId,
      datasetAssetVersionId: instance.datasetAssetVersionId,
      recordId: saved.recordId,
      operation: "update",
      resultCount: 1,
      context: request.lineageContext,
    });
    await this.publishDatasetRecordMutationEvent({
      instance,
      record: saved,
      operation: "update",
      previousRecord: existing,
      request,
    });
    return saved;
  }

  public async deleteImageRecordFromInstance(
    request: DeleteDatasetInstanceImageRecordRequest,
  ): Promise<boolean> {
    const instance = await this.requireOwnedDatasetInstance({
      systemId: request.systemId,
      instanceId: request.instanceId,
    });
    this.assertInstanceMutable(instance, "delete/remove image record");
    const deleted = this.repository.deleteImageRecordById({
      instanceId: instance.instanceId,
      recordId: normalizeRequired(request.recordId, "recordId"),
    });
    this.lineageSink?.record({
      eventKind: "record-write",
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      datasetAssetId: instance.datasetAssetId,
      datasetAssetVersionId: instance.datasetAssetVersionId,
      recordId: request.recordId,
      operation: "delete",
      resultCount: deleted ? 1 : 0,
      context: request.lineageContext,
    });
    if (deleted) {
      const selectionKey = this.createInstanceSelectionKey(instance.systemId, instance.instanceId);
      if (this.selectedRecordByInstanceKey.get(selectionKey) === request.recordId) {
        this.selectedRecordByInstanceKey.delete(selectionKey);
      }
    }
    return deleted;
  }

  public async selectImageRecordInInstance(
    request: SelectDatasetInstanceImageRecordRequest,
  ): Promise<SelectDatasetInstanceImageRecordResult> {
    const instance = await this.requireOwnedDatasetInstance({
      systemId: request.systemId,
      instanceId: request.instanceId,
    });
    const recordId = normalizeRequired(request.recordId, "recordId");
    const record = this.repository.getImageRecordBySystemAndId({
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      recordId,
    });
    if (!record) {
      throw new Error(
        `not-found:Dataset instance image record '${recordId}' was not found in instance '${instance.instanceId}'.`,
      );
    }

    const selectionKey = this.createInstanceSelectionKey(instance.systemId, instance.instanceId);
    const previousRecordId = this.selectedRecordByInstanceKey.get(selectionKey);
    if (previousRecordId === record.recordId) {
      return Object.freeze({
        accepted: true,
        changed: false,
        record,
      });
    }
    this.selectedRecordByInstanceKey.set(selectionKey, record.recordId);
    await this.publishDatasetRecordSelectionEvent({
      instance,
      record,
      request,
    });
    return Object.freeze({
      accepted: true,
      changed: true,
      record,
    });
  }

  public async mutateImageRecordInInstance(input:
    | {
      readonly operation: "create";
      readonly request: IngestDatasetInstanceImageRecordRequest;
    }
    | {
      readonly operation: "update";
      readonly request: UpdateDatasetInstanceImageRecordRequest;
    }
    | {
      readonly operation: "delete";
      readonly request: DeleteDatasetInstanceImageRecordRequest;
    }): Promise<DatasetInstanceImageMutationResult> {
    try {
      if (input.operation === "create") {
        const record = await this.ingestImageRecordIntoInstance(input.request);
        return Object.freeze({
          operation: "create",
          accepted: true,
          record,
          issues: Object.freeze([]),
        });
      }
      if (input.operation === "update") {
        const record = await this.updateImageRecordInInstance(input.request);
        return Object.freeze({
          operation: "update",
          accepted: true,
          record,
          issues: Object.freeze([]),
        });
      }
      const deleted = await this.deleteImageRecordFromInstance(input.request);
      if (!deleted) {
        return Object.freeze({
          operation: "delete",
          accepted: false,
          issues: Object.freeze([Object.freeze({
            code: "not-found",
            message: `Dataset instance image record '${input.request.recordId}' was not found.`,
          })]),
        });
      }
      return Object.freeze({
        operation: "delete",
        accepted: true,
        deletedRecordId: input.request.recordId,
        issues: Object.freeze([]),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const separator = message.indexOf(":");
      const code = separator > 0 ? message.slice(0, separator) : "invalid-request";
      const normalizedCode = code === "not-found" || code === "conflict" ? code : "invalid-request";
      return Object.freeze({
        operation: input.operation,
        accepted: false,
        issues: Object.freeze([Object.freeze({
          code: normalizedCode,
          message,
        })]),
      });
    }
  }

  public async deleteAllImageRecordsFromInstance(
    request: ResolveOwnedDatasetInstanceRequest,
  ): Promise<DeleteDatasetInstanceImageRecordsResult> {
    const instance = await this.requireOwnedDatasetInstance({
      systemId: request.systemId,
      instanceId: request.instanceId,
    });
    this.assertInstanceMutable(instance, "delete/remove image records");
    const removedCount = this.repository.deleteImageRecordsByInstanceId(instance.instanceId);
    if (removedCount > 0) {
      this.selectedRecordByInstanceKey.delete(this.createInstanceSelectionKey(instance.systemId, instance.instanceId));
    }
    return Object.freeze({
      instanceId: instance.instanceId,
      removedCount,
    });
  }

  private async prepareImageRecordCandidate(input: {
    readonly record: unknown;
    readonly storageReference?: string;
    readonly metadataExtraction?: IngestDatasetInstanceImageRecordMetadataExtraction;
  }): Promise<unknown> {
    const baseRecord = this.ensureRecordObject(input.record);
    const recordWithStorageReference = this.ensureAssetReferenceFromStorageReference({
      record: baseRecord,
      storageReference: input.storageReference,
    });
    if (!input.metadataExtraction) {
      return recordWithStorageReference;
    }

    const extracted = await this.imageMetadataExtractor.extract(input.metadataExtraction.payload);
    const metadataRecord = this.ensureCanonicalMetadataRecord(recordWithStorageReference.metadata);
    const mergedMetadata = {
      ...metadataRecord,
      ...(extracted.additionalMetadata ?? {}),
    } as Record<string, CanonicalRecordValue>;
    if (input.metadataExtraction.includeExifInMetadata && extracted.exif) {
      mergedMetadata.exif = this.toCanonicalRecordValue(extracted.exif);
    }

    return Object.freeze({
      ...recordWithStorageReference,
      width: this.toOptionalPositiveNumber(recordWithStorageReference.width) ?? extracted.dimensions.width,
      height: this.toOptionalPositiveNumber(recordWithStorageReference.height) ?? extracted.dimensions.height,
      format: this.toOptionalString(recordWithStorageReference.format)
        ?? extracted.formatHint?.format
        ?? "png",
      metadata: Object.freeze(mergedMetadata),
    });
  }

  private ensureRecordObject(value: unknown): Readonly<Record<string, unknown>> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("invalid-request:Image ingestion requires a record object.");
    }
    return Object.freeze({ ...(value as Record<string, unknown>) });
  }

  private ensureAssetReferenceFromStorageReference(input: {
    readonly record: Readonly<Record<string, unknown>>;
    readonly storageReference?: string;
  }): Readonly<Record<string, unknown>> {
    const storageReference = normalizeOptional(input.storageReference);
    if (!storageReference || input.record.assetRef !== undefined) {
      return input.record;
    }

    return Object.freeze({
      ...input.record,
      assetRef: Object.freeze({
        kind: "generated-output",
        stableId: `generated-output:${storageReference}`,
        outputId: storageReference,
        path: storageReference,
        sourceSystem: "system-runtime-dataset-instance",
        sourceContext: Object.freeze({
          sourceKind: "instance-storage-reference",
        }),
      }),
    });
  }

  private ensureCanonicalMetadataRecord(
    metadata: unknown,
  ): Readonly<Record<string, CanonicalRecordValue>> {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      return Object.freeze({});
    }
    const normalized: Record<string, CanonicalRecordValue> = {};
    for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
      const normalizedKey = key.trim();
      if (!normalizedKey) {
        continue;
      }
      normalized[normalizedKey] = this.toCanonicalRecordValue(value);
    }
    return Object.freeze(normalized);
  }

  private toCanonicalRecordValue(value: unknown): CanonicalRecordValue {
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return value;
    }
    if (Array.isArray(value)) {
      return Object.freeze(value.map((entry) => this.toCanonicalRecordValue(entry)));
    }
    if (typeof value === "object") {
      return Object.freeze(Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .map(([key, entry]) => [key, this.toCanonicalRecordValue(entry)] as const),
      ));
    }
    return String(value);
  }

  private async publishDatasetRecordMutationEvent(input: {
    readonly instance: DatasetInstance;
    readonly record: DatasetInstanceImageRecord;
    readonly operation: "create" | "update" | "generated";
    readonly previousRecord?: DatasetInstanceImageRecord;
    readonly request:
      | IngestDatasetInstanceImageRecordRequest
      | UpdateDatasetInstanceImageRecordRequest;
  }): Promise<void> {
    if (!this.datasetEventPublisher) {
      return;
    }
    const actor = {
      actorKind: DatasetEventActorKinds.system,
      actorId: input.request.lineageContext?.actorId ?? input.instance.systemId,
      source: input.request.lineageContext?.source ?? "system-runtime-dataset-instance-service",
      metadata: {
        operation: input.operation,
      },
    } as const;
    const payloadMetadataLineage = {
      instanceId: input.instance.instanceId,
      studioId: input.request.lineageContext?.studioId,
      sourceType: input.record.provenance.sourceType,
      sourceReference: input.record.provenance.sourceReference,
      sourceSystemId: input.record.provenance.sourceSystemId,
      sourceRecordId: input.record.provenance.sourceReference,
      sourceRunId: input.record.provenance.sourceRunId,
    } satisfies Readonly<Record<string, string | undefined>>;
    const payloadMetadata = {
      workflowId: input.request.lineageContext?.workflowAssetId,
      workflowRunId: input.request.lineageContext?.workflowExecutionId ?? input.record.provenance.sourceRunId,
      systemId: input.instance.systemId,
      lineage: Object.freeze(Object.fromEntries(
        Object.entries(payloadMetadataLineage).filter((entry): entry is [string, string] => Boolean(entry[1])),
      )),
    } as const;

    if (input.operation === "update") {
      if (!("patch" in input.request)) {
        throw new Error("invalid-request:Update event emission requires a record patch.");
      }
      const updateRequest = input.request;
      const event = createDatasetEventEnvelope({
        eventId: this.createDatasetMutationEventId({
          eventType: DatasetEventTypes.imageUpdated,
          instance: input.instance,
          record: input.record,
          mutationVersion: input.record.mutationVersion,
        }),
        eventType: DatasetEventTypes.imageUpdated,
        dataset: { assetId: input.instance.datasetAssetId, versionId: input.instance.datasetAssetVersionId },
        instance: {
          systemId: input.instance.systemId,
          instanceId: input.instance.instanceId,
          dataset: { assetId: input.instance.datasetAssetId, versionId: input.instance.datasetAssetVersionId },
        },
        actor,
        payloadMetadata,
        payload: {
          record: this.createDatasetRecordReference(input.record),
          previousRecord: input.previousRecord ? this.createDatasetRecordReference(input.previousRecord) : undefined,
          updatedFields: this.resolveUpdatedFields(updateRequest.patch),
          derivedMetadata: input.record.image.derived,
        },
      });
      await this.publishDatasetEventBestEffort({
        event,
        instance: input.instance,
        recordId: input.record.recordId,
        operation: "update",
        lineageContext: input.request.lineageContext,
      });
      return;
    }

    const event = createDatasetEventEnvelope({
      eventId: this.createDatasetMutationEventId({
        eventType: input.operation === "generated" ? DatasetEventTypes.imageGenerated : DatasetEventTypes.imageAdded,
        instance: input.instance,
        record: input.record,
        mutationVersion: input.record.mutationVersion,
      }),
      eventType: input.operation === "generated" ? DatasetEventTypes.imageGenerated : DatasetEventTypes.imageAdded,
      dataset: { assetId: input.instance.datasetAssetId, versionId: input.instance.datasetAssetVersionId },
      instance: {
        systemId: input.instance.systemId,
        instanceId: input.instance.instanceId,
        dataset: { assetId: input.instance.datasetAssetId, versionId: input.instance.datasetAssetVersionId },
      },
      actor,
      payloadMetadata,
      payload: input.operation === "generated"
        ? {
          record: this.createDatasetRecordReference(input.record),
          generationContext: {
            sourceWorkflowId: input.request.lineageContext?.workflowAssetId ?? "unknown",
            sourceExecutionId: input.request.lineageContext?.workflowExecutionId ?? "unknown",
            sourceRecordReference: input.record.provenance.sourceReference ?? "unknown",
            sourceType: input.record.provenance.sourceType ?? "unknown",
            sourceRunId: input.record.provenance.sourceRunId ?? "unknown",
          },
          derivedMetadata: input.record.image.derived,
        }
        : {
          record: this.createDatasetRecordReference(input.record),
          derivedMetadata: input.record.image.derived,
        },
    });
    await this.publishDatasetEventBestEffort({
      event,
      instance: input.instance,
      recordId: input.record.recordId,
      operation: input.operation,
      lineageContext: input.request.lineageContext,
    });
  }

  private resolveUpdatedFields(patch: DatasetInstanceImageRecordPatch): ReadonlyArray<string> {
    const fields = new Set<string>();
    if (patch.imagePatch) {
      fields.add("image");
      if (patch.imagePatch.metadataPatch) {
        fields.add("image.metadata");
      }
      if (patch.imagePatch.tags !== undefined || patch.imagePatch.tagsPatch) {
        fields.add("image.tags");
      }
      if (patch.imagePatch.derived !== undefined) {
        fields.add("image.derived");
      }
      if (patch.imagePatch.annotations !== undefined) {
        fields.add("image.annotations");
      }
    }
    if (patch.metadataPatch) {
      fields.add("metadata");
    }
    if (patch.storagePatch !== undefined) {
      fields.add("storage");
    }
    if (patch.provenancePatch) {
      fields.add("provenance");
    }
    if (fields.size === 0) {
      fields.add("record");
    }
    return Object.freeze([...fields]);
  }

  private async publishDatasetRecordSelectionEvent(input: {
    readonly instance: DatasetInstance;
    readonly record: DatasetInstanceImageRecord;
    readonly request: SelectDatasetInstanceImageRecordRequest;
  }): Promise<void> {
    if (!this.datasetEventPublisher) {
      return;
    }
    const event = createDatasetEventEnvelope({
      eventId: this.createDatasetSelectionEventId({
        instance: input.instance,
        record: input.record,
      }),
      eventType: DatasetEventTypes.imageSelected,
      dataset: { assetId: input.instance.datasetAssetId, versionId: input.instance.datasetAssetVersionId },
      instance: {
        systemId: input.instance.systemId,
        instanceId: input.instance.instanceId,
        dataset: { assetId: input.instance.datasetAssetId, versionId: input.instance.datasetAssetVersionId },
      },
      actor: {
        actorKind: DatasetEventActorKinds.system,
        actorId: input.request.lineageContext?.actorId ?? input.instance.systemId,
        source: input.request.lineageContext?.source ?? "system-runtime-dataset-instance-service",
        metadata: Object.freeze({
          operation: "selection",
        }),
      },
      payloadMetadata: {
        workflowId: input.request.lineageContext?.workflowAssetId,
        workflowRunId: input.request.lineageContext?.workflowExecutionId,
        systemId: input.instance.systemId,
        lineage: Object.freeze(Object.fromEntries(
          Object.entries({
            instanceId: input.instance.instanceId,
            studioId: input.request.lineageContext?.studioId,
          }).filter((entry): entry is [string, string] => Boolean(entry[1])),
        )),
      },
      payload: {
        record: this.createDatasetRecordReference(input.record),
        selectionContext: input.request.selectionContext,
        derivedMetadata: input.record.image.derived,
      },
    });
    await this.publishDatasetEventBestEffort({
      event,
      instance: input.instance,
      recordId: input.record.recordId,
      operation: "selection",
      lineageContext: input.request.lineageContext,
    });
  }

  private async publishDatasetEventBestEffort(input: {
    readonly event: ReturnType<typeof createDatasetEventEnvelope>;
    readonly instance: DatasetInstance;
    readonly recordId: string;
    readonly operation: string;
    readonly lineageContext?: DatasetOperationalLineageContext;
  }): Promise<void> {
    if (!this.datasetEventPublisher) {
      return;
    }
    try {
      await this.datasetEventPublisher.publish({ event: input.event });
    } catch (error) {
      this.lineageSink?.record({
        eventKind: "record-write",
        systemId: input.instance.systemId,
        instanceId: input.instance.instanceId,
        datasetAssetId: input.instance.datasetAssetId,
        datasetAssetVersionId: input.instance.datasetAssetVersionId,
        recordId: input.recordId,
        operation: `${input.operation}-event-publish-failed`,
        resultCount: 1,
        metadata: Object.freeze({
          datasetEventId: input.event.eventId,
          datasetEventType: input.event.eventType,
          error: error instanceof Error ? error.message : "unknown-error",
        }),
        context: input.lineageContext,
      });
    }
  }

  private createDatasetMutationEventId(input: {
    readonly eventType: typeof DatasetEventTypes[keyof typeof DatasetEventTypes];
    readonly instance: DatasetInstance;
    readonly record: DatasetInstanceImageRecord;
    readonly mutationVersion: number;
  }): string {
    return [
      "dataset-event",
      input.eventType,
      input.instance.systemId,
      input.instance.instanceId,
      input.record.recordId,
      `v${Math.max(1, Math.floor(input.mutationVersion))}`,
    ].join(":");
  }

  private createDatasetSelectionEventId(input: {
    readonly instance: DatasetInstance;
    readonly record: DatasetInstanceImageRecord;
  }): string {
    return [
      "dataset-event",
      DatasetEventTypes.imageSelected,
      input.instance.systemId,
      input.instance.instanceId,
      input.record.recordId,
    ].join(":");
  }

  private createDatasetRecordReference(record: DatasetInstanceImageRecord): {
    readonly dataset: {
      readonly assetId: string;
      readonly versionId?: string;
    };
    readonly selectionId: string;
    readonly recordId: string;
    readonly instance: {
      readonly systemId: string;
      readonly instanceId: string;
      readonly dataset: {
        readonly assetId: string;
        readonly versionId?: string;
      };
    };
    readonly imageReference?: string;
  } {
    const imageReference = record.storage?.reference
      ?? record.image.assetRef?.stableId;
    return {
      dataset: {
        assetId: record.datasetAssetId,
        versionId: record.datasetAssetVersionId,
      },
      selectionId: record.recordId,
      recordId: record.recordId,
      instance: {
        systemId: record.systemId,
        instanceId: record.instanceId,
        dataset: {
          assetId: record.datasetAssetId,
          versionId: record.datasetAssetVersionId,
        },
      },
      imageReference,
    };
  }

  private createInstanceSelectionKey(systemId: string, instanceId: string): string {
    return `${systemId}::${instanceId}`;
  }

  private isGeneratedRecord(record: DatasetInstanceImageRecord): boolean {
    return record.image.assetRef?.kind === "generated-output"
      || record.storage?.provider === "generated-output"
      || (record.provenance.sourceType?.toLowerCase().includes("generated") ?? false);
  }

  private createStorageReference(input: {
    readonly explicitReference?: string;
    readonly explicitProvider?: string;
    readonly image: DatasetInstanceImageRecord["image"];
  }): DatasetInstanceImageRecord["storage"] | undefined {
    const explicitReference = normalizeOptional(input.explicitReference);
    const derivedReference = deriveStorageReferenceFromImageRecord(input.image);
    const reference = explicitReference ?? derivedReference;
    if (!reference) {
      return undefined;
    }
    return Object.freeze({
      reference,
      provider: normalizeOptional(input.explicitProvider),
    });
  }

  private toOptionalPositiveNumber(value: unknown): number | undefined {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      return undefined;
    }
    return value;
  }

  private toOptionalString(value: unknown): string | undefined {
    if (typeof value !== "string") {
      return undefined;
    }
    const normalized = value.trim();
    return normalized ? normalized : undefined;
  }

  private createImageRecordId(instanceId: string): string {
    return `${instanceId}:image-record:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
  }

  private areStorageBindingsEquivalent(
    existing?: DatasetInstance["storageBinding"],
    requested?: DatasetInstance["storageBinding"],
  ): boolean {
    if (!existing && !requested) {
      return true;
    }
    if (!existing || !requested) {
      return false;
    }
    return existing.storageInstanceId === requested.storageInstanceId
      && existing.storageInstanceRef === requested.storageInstanceRef
      && existing.bindingArea === requested.bindingArea
      && existing.bindingId === requested.bindingId
      && existing.bindingReference === requested.bindingReference;
  }

  private assertNoPathConfiguration(input: unknown): void {
    const root = this.toOptionalRecord(input);
    if (!root) {
      return;
    }
    if (this.hasForbiddenPathField(root)) {
      throw new Error("invalid-request:Dataset instance storage configuration must use storage-instance references instead of raw filesystem paths.");
    }
  }

  private hasForbiddenPathField(node: Readonly<Record<string, unknown>>): boolean {
    for (const [key, value] of Object.entries(node)) {
      const normalized = key.toLowerCase();
      if (normalized.includes("path") || normalized.includes("directory") || normalized.includes("filesystem")) {
        return true;
      }
      const nested = this.toOptionalRecord(value);
      if (nested && this.hasForbiddenPathField(nested)) {
        return true;
      }
    }
    return false;
  }

  private toOptionalRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }
    return value as Readonly<Record<string, unknown>>;
  }

  private async requireOwnedDatasetInstance(input: {
    readonly systemId: string;
    readonly instanceId: string;
  }): Promise<DatasetInstance> {
    await this.assertSystemExists(input.systemId);
    return this.requireOwnedDatasetInstanceSync(input);
  }

  private requireOwnedDatasetInstanceSync(input: {
    readonly systemId: string;
    readonly instanceId: string;
  }): DatasetInstance {
    const systemId = normalizeRequired(input.systemId, "systemId");
    const instanceId = normalizeRequired(input.instanceId, "instanceId");
    const instance = this.repository.getBySystemAndId({
      systemId,
      instanceId,
    });
    if (!instance) {
      const existingById = this.repository.getById(instanceId);
      if (!existingById) {
        throw new Error(`not-found:Dataset instance '${instanceId}' was not found.`);
      }
      throw new Error(
        `invalid-request:Dataset instance '${existingById.instanceId}' is owned by system '${existingById.systemId}', not '${systemId}'.`,
      );
    }
    return instance;
  }

  private assertInstanceMutable(instance: DatasetInstance, operation: string): void {
    if (instance.lifecycleStatus === DatasetInstanceLifecycleStatuses.archived) {
      throw new Error(
        `invalid-request:Cannot ${operation} for archived dataset instance '${instance.instanceId}'.`,
      );
    }
  }

  private async assertSystemExists(systemId: string): Promise<void> {
    const normalized = normalizeRequired(systemId, "systemId");
    if (!normalized.startsWith("system:")) {
      throw new Error("invalid-request:systemId must be a canonical system asset id.");
    }
    await this.systemValidator?.assertSystemExists(normalized);
  }

  private async assertAssetLinked(input: {
    readonly datasetAssetId: string;
    readonly datasetAssetVersionId?: string;
  }): Promise<NonNullable<ReturnType<DatasetInstanceAssetCatalog["resolveAsset"]>>> {
    const datasetAssetId = normalizeRequired(input.datasetAssetId, "datasetAssetId");
    const asset = this.assetCatalog.resolveAsset({
      assetId: datasetAssetId,
      versionId: normalizeOptional(input.datasetAssetVersionId),
    });
    if (!asset) {
      throw new Error(
        `invalid-request:Dataset asset '${datasetAssetId}@${normalizeOptional(input.datasetAssetVersionId) ?? "latest"}' is not registered.`,
      );
    }
    return asset;
  }

}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`invalid-request:${label} is required.`);
  }
  return normalized;
}
