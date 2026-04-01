import type { CanonicalDataShape } from "../../domain/dataset-studio/CanonicalDataShapes";
import { DatasetSchemaIntentIds } from "../../domain/dataset-studio/schema-intents/DatasetSchemaIntent";
import type {
  IMediaDatasetValidator,
  IMediaRecordValidator,
} from "../../domain/dataset-studio/interfaces/MediaValidation";
import {
  createSystemDatasetBindingFromInstance,
  mapSystemBindingRoleToDatasetInstanceRole,
  type SystemDatasetBinding,
  type SystemDatasetBindingRole,
} from "../../domain/system-runtime/SystemDatasetBindingDomain";
import {
  createDatasetInstance,
  DatasetInstanceLifecycleStatuses,
  DatasetInstanceRoles,
  DatasetInstanceRuntimeStatuses,
  type DatasetInstance,
  type DatasetInstanceRole,
} from "../../domain/system-runtime/DatasetInstanceDomain";
import type { DatasetInstanceAssetCatalog } from "./DatasetInstanceAssetCatalog";
import type { DatasetInstanceRepository } from "./DatasetInstanceRepository";
import { createDefaultMediaValidationAdapters } from "../dataset-studio/adapters/validation/MediaValidationFactory";
import { DatasetInstanceSchemaEnforcementService } from "./DatasetInstanceSchemaEnforcementService";

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
  readonly seedMetadata?: DatasetInstance["seedMetadata"];
  readonly lifecycleMetadata?: DatasetInstance["lifecycleMetadata"];
}

export interface EnsureInputImageStoreInstanceRequest {
  readonly instanceId: string;
  readonly systemId: string;
  readonly datasetAssetId: string;
  readonly datasetAssetVersionId?: string;
  readonly seedMetadata?: DatasetInstance["seedMetadata"];
}

export interface EnsureOutputImageStoreInstanceRequest {
  readonly instanceId: string;
  readonly systemId: string;
  readonly datasetAssetId: string;
  readonly datasetAssetVersionId?: string;
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
}

export class SystemDatasetInstanceService {
  private readonly schemaEnforcementService: DatasetInstanceSchemaEnforcementService;

  public constructor(
    private readonly repository: DatasetInstanceRepository,
    private readonly assetCatalog: DatasetInstanceAssetCatalog,
    private readonly mediaDatasetValidator: IMediaDatasetValidator,
    private readonly systemValidator?: SystemDatasetOwnershipValidator,
    options: SystemDatasetInstanceServiceOptions = {},
  ) {
    this.schemaEnforcementService = new DatasetInstanceSchemaEnforcementService(
      this.assetCatalog,
      this.mediaDatasetValidator,
      options.mediaRecordValidator ?? createDefaultMediaValidationAdapters().mediaRecordValidator,
    );
  }

  public async createDatasetInstance(request: CreateSystemDatasetInstanceRequest): Promise<DatasetInstance> {
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
      seedMetadata: request.seedMetadata,
      lifecycleMetadata: request.lifecycleMetadata,
    });

    return this.repository.save(instance);
  }

  public getDatasetInstance(instanceId: string): DatasetInstance | undefined {
    return this.repository.getById(instanceId);
  }

  public listSystemDatasetInstances(systemId: string): ReadonlyArray<DatasetInstance> {
    return this.repository.listBySystemId(systemId);
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
      return existing;
    }

    return this.createDatasetInstance({
      instanceId: request.instanceId,
      systemId: request.systemId,
      datasetAssetId: request.datasetAssetId,
      datasetAssetVersionId: request.datasetAssetVersionId,
      role: request.role,
      purpose: request.purpose,
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
      seedMetadata: request.seedMetadata,
    });
  }

  public async ensureOutputImageStoreInstance(request: EnsureOutputImageStoreInstanceRequest): Promise<DatasetInstance> {
    return this.ensureRoleDatasetInstance({
      instanceId: request.instanceId,
      systemId: request.systemId,
      datasetAssetId: request.datasetAssetId,
      datasetAssetVersionId: request.datasetAssetVersionId,
      role: DatasetInstanceRoles.outputStore,
      purpose: "workflow-output-images",
      requiredSchemaIntentId: DatasetSchemaIntentIds.media,
      requiredOutputShapeKind: "image-metadata-records",
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
      seedMetadata: request.seedMetadata,
      lifecycleMetadata: request.lifecycleMetadata,
    });
  }

  public validateIncomingShapeForInstance(input: {
    readonly instanceId: string;
    readonly shape: CanonicalDataShape;
  }): ReturnType<IMediaDatasetValidator["validateShape"]> {
    const instance = this.requireDatasetInstance(input.instanceId);
    return this.schemaEnforcementService.validateShapeForInstance({
      instance,
      shape: input.shape,
    });
  }

  public validateRecordForInstance(input: {
    readonly instanceId: string;
    readonly record: unknown;
  }) {
    const instance = this.requireDatasetInstance(input.instanceId);
    return this.schemaEnforcementService.validateRecordForInstance({
      instance,
      record: input.record,
    });
  }

  public validateRecordsForInstance(input: {
    readonly instanceId: string;
    readonly records: ReadonlyArray<unknown>;
  }) {
    const instance = this.requireDatasetInstance(input.instanceId);
    return this.schemaEnforcementService.validateRecordsForInstance({
      instance,
      records: input.records,
    });
  }

  public admitRecordForInstance(input: {
    readonly instanceId: string;
    readonly record: unknown;
  }): unknown {
    const instance = this.requireDatasetInstance(input.instanceId);
    return this.schemaEnforcementService.admitRecordForInstance({
      instance,
      record: input.record,
    });
  }

  public admitRecordsForInstance(input: {
    readonly instanceId: string;
    readonly records: ReadonlyArray<unknown>;
  }): ReadonlyArray<unknown> {
    const instance = this.requireDatasetInstance(input.instanceId);
    return this.schemaEnforcementService.admitRecordsForInstance({
      instance,
      records: input.records,
    });
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

  private requireDatasetInstance(instanceId: string): DatasetInstance {
    const instance = this.repository.getById(instanceId);
    if (!instance) {
      throw new Error(`not-found:Dataset instance '${instanceId}' was not found.`);
    }
    return instance;
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
