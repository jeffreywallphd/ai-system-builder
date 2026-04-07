import path from "node:path";
import type { IModel } from "../../src/domain/models/interfaces/IModel";
import {
  Model,
  ModelArtifact,
  ModelResourceProfile,
  ModelSource,
} from "../../src/domain/models/Model";
import { ModelCompatibility } from "../../src/domain/models/ModelCompatibility";
import { ModelDependency } from "../../src/domain/models/ModelDependency";
import { ModelRequirement } from "../../src/domain/models/ModelRequirement";
import type {
  IInstalledModelCatalog,
  IInstalledModelSearchCriteria,
} from "../../application/ports/interfaces/IInstalledModelCatalog";
import type { IFileStorage } from "../../application/ports/interfaces/IFileStorage";

interface ModelRecord {
  readonly id: string;
  readonly name: string;
  readonly version?: string;
  readonly variant?: string;
  readonly publisher?: string;
  readonly kind: IModel["kind"];
  readonly isRunnable: boolean;
  readonly status: IModel["status"];
  readonly source: {
    readonly type: IModel["source"]["type"];
    readonly sourceId?: string;
    readonly repository?: string;
    readonly revision?: string;
    readonly url?: string;
    readonly providerMetadata?: Readonly<Record<string, string>>;
  };
  readonly artifact: {
    readonly name: string;
    readonly accessMethod: IModel["artifact"]["accessMethod"];
    readonly location?: string;
    readonly format: IModel["artifact"]["format"];
    readonly sizeBytes?: number;
    readonly sha256?: string;
    readonly contentType?: string;
  };
  readonly additionalArtifacts: ReadonlyArray<ModelRecord["artifact"]>;
  readonly dependencies: ReadonlyArray<{
    readonly id: string;
    readonly label: string;
    readonly dependencyType: string;
    readonly severity: string;
    readonly description?: string;
    readonly acceptedModelIds?: ReadonlyArray<string>;
    readonly acceptedNames?: ReadonlyArray<string>;
    readonly acceptedKinds?: ReadonlyArray<IModel["kind"]>;
    readonly acceptedArchitectureFamilies?: ReadonlyArray<string>;
    readonly acceptedTasks?: ReadonlyArray<string>;
    readonly acceptedFormats?: ReadonlyArray<string>;
    readonly acceptedPrecisions?: ReadonlyArray<string>;
  }>;
  readonly precision?: IModel["precision"];
  readonly architectureFamily?: string;
  readonly architecture?: string;
  readonly compatibility: {
    readonly inputModalities: ReadonlyArray<string>;
    readonly outputModalities: ReadonlyArray<string>;
    readonly supportedTasks: ReadonlyArray<string>;
    readonly supportedRuntimes: ReadonlyArray<string>;
    readonly allowsAnyRuntime: boolean;
    readonly architectureFamilies: ReadonlyArray<string>;
    readonly allowsAnyArchitectureFamily: boolean;
    readonly compatibleAssetTypes: ReadonlyArray<string>;
  };
  readonly requirements: ReadonlyArray<{
    readonly id: string;
    readonly label: string;
    readonly kind: string;
    readonly severity: string;
    readonly description?: string;
    readonly acceptedInputModalities?: ReadonlyArray<string>;
    readonly acceptedOutputModalities?: ReadonlyArray<string>;
    readonly requiredTasks?: ReadonlyArray<string>;
    readonly acceptedRuntimes?: ReadonlyArray<string>;
    readonly acceptedArchitectureFamilies?: ReadonlyArray<string>;
    readonly acceptedFormats?: ReadonlyArray<string>;
    readonly requiredDependencies?: ReadonlyArray<{
      readonly id: string;
      readonly label: string;
      readonly dependencyType: string;
      readonly severity: string;
      readonly description?: string;
      readonly acceptedModelIds?: ReadonlyArray<string>;
      readonly acceptedNames?: ReadonlyArray<string>;
      readonly acceptedKinds?: ReadonlyArray<IModel["kind"]>;
      readonly acceptedArchitectureFamilies?: ReadonlyArray<string>;
      readonly acceptedTasks?: ReadonlyArray<string>;
      readonly acceptedFormats?: ReadonlyArray<string>;
      readonly acceptedPrecisions?: ReadonlyArray<string>;
    }>;
    readonly acceptedQuantizations?: ReadonlyArray<string>;
    readonly acceptedLicenses?: ReadonlyArray<string>;
    readonly minimumMemoryBytes?: number;
    readonly maximumMemoryBytes?: number;
  }>;
  readonly resourceProfile?: {
    readonly parameterCount?: number;
    readonly contextWindowTokens?: number;
    readonly maxOutputTokens?: number;
    readonly estimatedMinMemoryBytes?: number;
    readonly estimatedRecommendedMemoryBytes?: number;
    readonly maxBatchSize?: number;
    readonly recommendedConcurrency?: number;
  };
  readonly description?: string;
  readonly tags: ReadonlyArray<string>;
  readonly license?: string;
  readonly languageCodes: ReadonlyArray<string>;
  readonly requiresAuth: boolean;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function includesAnyNormalized(
  candidates: ReadonlyArray<string> | undefined,
  filters: ReadonlyArray<string> | undefined
): boolean {
  if (!filters || filters.length === 0) {
    return true;
  }

  const normalizedFilters = new Set(filters.map(normalize));
  const normalizedCandidates = new Set((candidates ?? []).map(normalize));
  return [...normalizedFilters].some((filter) => normalizedCandidates.has(filter));
}

function modelMatchesCriteria(
  model: IModel,
  criteria?: IInstalledModelSearchCriteria
): boolean {
  if (!criteria) {
    return true;
  }

  if (criteria.query) {
    const query = normalize(criteria.query);
    const haystack = [
      model.id,
      model.name,
      model.kind,
      model.architecture,
      model.architectureFamily,
      model.description,
      model.source.type,
      ...(model.tags ?? []),
      ...(model.languageCodes ?? []),
    ]
      .filter(Boolean)
      .map((value) => normalize(String(value)));

    if (!haystack.some((value) => value.includes(query))) {
      return false;
    }
  }

  if (criteria.ids && criteria.ids.length > 0 && !criteria.ids.includes(model.id)) {
    return false;
  }

  if (criteria.kinds && criteria.kinds.length > 0 && !criteria.kinds.includes(model.kind)) {
    return false;
  }

  if (
    criteria.architectureFamilies &&
    criteria.architectureFamilies.length > 0 &&
    (!model.architectureFamily ||
      !includesAnyNormalized([model.architectureFamily], criteria.architectureFamilies))
  ) {
    return false;
  }

  if (
    criteria.tasks &&
    criteria.tasks.length > 0 &&
    !includesAnyNormalized(model.compatibility.supportedTasks, criteria.tasks)
  ) {
    return false;
  }

  if (
    criteria.inputModalities &&
    criteria.inputModalities.length > 0 &&
    !includesAnyNormalized(model.compatibility.inputModalities, criteria.inputModalities)
  ) {
    return false;
  }

  if (
    criteria.outputModalities &&
    criteria.outputModalities.length > 0 &&
    !includesAnyNormalized(model.compatibility.outputModalities, criteria.outputModalities)
  ) {
    return false;
  }

  if (
    criteria.runtimes &&
    criteria.runtimes.length > 0 &&
    !(
      model.compatibility.allowsAnyRuntime ||
      includesAnyNormalized(model.compatibility.supportedRuntimes, criteria.runtimes)
    )
  ) {
    return false;
  }

  if (criteria.runnableOnly && !model.isRunnable) {
    return false;
  }

  if (criteria.availableOnly && !model.isAvailable()) {
    return false;
  }

  if (
    criteria.tags &&
    criteria.tags.length > 0 &&
    !includesAnyNormalized(model.tags, criteria.tags)
  ) {
    return false;
  }

  return true;
}

export class LocalModelRepository implements IInstalledModelCatalog {
  private readonly fileStorage: IFileStorage;
  private readonly rootDirectory: string;
  private readonly indexPath: string;

  constructor(params: {
    fileStorage: IFileStorage;
    rootDirectory: string;
    indexFileName?: string;
  }) {
    this.fileStorage = params.fileStorage;
    this.rootDirectory = params.rootDirectory.trim();
    this.indexPath = path.join(
      this.rootDirectory,
      params.indexFileName?.trim() || "installed-models.index.json"
    );
  }

  public async listInstalled(
    criteria?: IInstalledModelSearchCriteria
  ): Promise<ReadonlyArray<IModel>> {
    const records = await this.readIndex();
    const models = records.map((record) => this.toDomain(record));
    const filtered = models.filter((model) => modelMatchesCriteria(model, criteria));

    const limited =
      criteria?.limit && criteria.limit > 0
        ? filtered.slice(0, criteria.limit)
        : filtered;

    return Object.freeze(
      limited.sort((left, right) => left.name.localeCompare(right.name))
    );
  }

  public async getInstalledById(id: string): Promise<IModel | undefined> {
    const normalizedId = id.trim();
    const records = await this.readIndex();
    const record = records.find((item) => item.id === normalizedId);
    return record ? this.toDomain(record) : undefined;
  }

  public async saveInstalled(model: IModel): Promise<void> {
    const records = await this.readIndex();
    const record = this.toRecord(model);
    const existingIndex = records.findIndex((item) => item.id === model.id);

    if (existingIndex >= 0) {
      records[existingIndex] = record;
    } else {
      records.push(record);
    }

    await this.writeIndex(records);
  }

  public async removeInstalled(id: string): Promise<boolean> {
    const normalizedId = id.trim();
    const records = await this.readIndex();
    const filtered = records.filter((item) => item.id !== normalizedId);

    if (filtered.length === records.length) {
      return false;
    }

    await this.writeIndex(filtered);
    return true;
  }

  public async isInstalled(id: string): Promise<boolean> {
    return !!(await this.getInstalledById(id));
  }

  private async readIndex(): Promise<ModelRecord[]> {
    if (!(await this.fileStorage.exists(this.indexPath))) {
      return [];
    }

    const content = await this.fileStorage.readText(this.indexPath, "utf-8");
    const parsed = JSON.parse(content) as ReadonlyArray<ModelRecord>;
    return [...parsed];
  }

  private async writeIndex(records: ReadonlyArray<ModelRecord>): Promise<void> {
    await this.fileStorage.write({
      path: this.indexPath,
      content: JSON.stringify(records, null, 2),
      createDirectories: true,
      overwrite: true,
    });
  }

  private toRecord(model: IModel): ModelRecord {
    return {
      id: model.id,
      name: model.name,
      version: model.version,
      variant: model.variant,
      publisher: model.publisher,
      kind: model.kind,
      isRunnable: model.isRunnable,
      status: model.status,
      source: {
        type: model.source.type,
        sourceId: model.source.sourceId,
        repository: model.source.repository,
        revision: model.source.revision,
        url: model.source.url,
        providerMetadata: model.source.providerMetadata,
      },
      artifact: {
        name: model.artifact.name,
        accessMethod: model.artifact.accessMethod,
        location: model.artifact.location,
        format: model.artifact.format,
        sizeBytes: model.artifact.sizeBytes,
        sha256: model.artifact.sha256,
        contentType: model.artifact.contentType,
      },
      additionalArtifacts: model.additionalArtifacts.map((artifact) => ({
        name: artifact.name,
        accessMethod: artifact.accessMethod,
        location: artifact.location,
        format: artifact.format,
        sizeBytes: artifact.sizeBytes,
        sha256: artifact.sha256,
        contentType: artifact.contentType,
      })),
      dependencies: model.dependencies.map((dependency) => ({
        id: dependency.id,
        label: dependency.label,
        dependencyType: dependency.dependencyType,
        severity: dependency.severity,
        description: dependency.description,
        acceptedModelIds: dependency.acceptedModelIds,
        acceptedNames: dependency.acceptedNames,
        acceptedKinds: dependency.acceptedKinds,
        acceptedArchitectureFamilies: dependency.acceptedArchitectureFamilies,
        acceptedTasks: dependency.acceptedTasks,
        acceptedFormats: dependency.acceptedFormats,
        acceptedPrecisions: dependency.acceptedPrecisions,
      })),
      precision: model.precision,
      architectureFamily: model.architectureFamily,
      architecture: model.architecture,
      compatibility: {
        inputModalities: model.compatibility.inputModalities,
        outputModalities: model.compatibility.outputModalities,
        supportedTasks: model.compatibility.supportedTasks,
        supportedRuntimes: model.compatibility.supportedRuntimes,
        allowsAnyRuntime: model.compatibility.allowsAnyRuntime,
        architectureFamilies: model.compatibility.architectureFamilies,
        allowsAnyArchitectureFamily:
          model.compatibility.allowsAnyArchitectureFamily,
        compatibleAssetTypes: model.compatibility.compatibleAssetTypes,
      },
      requirements: model.requirements.map((requirement) => ({
        id: requirement.id,
        label: requirement.label,
        kind: requirement.kind,
        severity: requirement.severity,
        description: requirement.description,
        acceptedInputModalities: requirement.acceptedInputModalities,
        acceptedOutputModalities: requirement.acceptedOutputModalities,
        requiredTasks: requirement.requiredTasks,
        acceptedRuntimes: requirement.acceptedRuntimes,
        acceptedArchitectureFamilies: requirement.acceptedArchitectureFamilies,
        acceptedFormats: requirement.acceptedFormats,
        requiredDependencies: requirement.requiredDependencies?.map(
          (dependency) => ({
            id: dependency.id,
            label: dependency.label,
            dependencyType: dependency.dependencyType,
            severity: dependency.severity,
            description: dependency.description,
            acceptedModelIds: dependency.acceptedModelIds,
            acceptedNames: dependency.acceptedNames,
            acceptedKinds: dependency.acceptedKinds,
            acceptedArchitectureFamilies:
              dependency.acceptedArchitectureFamilies,
            acceptedTasks: dependency.acceptedTasks,
            acceptedFormats: dependency.acceptedFormats,
            acceptedPrecisions: dependency.acceptedPrecisions,
          })
        ),
        acceptedQuantizations: requirement.acceptedQuantizations,
        acceptedLicenses: requirement.acceptedLicenses,
        minimumMemoryBytes: requirement.minimumMemoryBytes,
        maximumMemoryBytes: requirement.maximumMemoryBytes,
      })),
      resourceProfile: model.resourceProfile
        ? {
            parameterCount: model.resourceProfile.parameterCount,
            contextWindowTokens: model.resourceProfile.contextWindowTokens,
            maxOutputTokens: model.resourceProfile.maxOutputTokens,
            estimatedMinMemoryBytes:
              model.resourceProfile.estimatedMinMemoryBytes,
            estimatedRecommendedMemoryBytes:
              model.resourceProfile.estimatedRecommendedMemoryBytes,
            maxBatchSize: model.resourceProfile.maxBatchSize,
            recommendedConcurrency: model.resourceProfile.recommendedConcurrency,
          }
        : undefined,
      description: model.description,
      tags: model.tags,
      license: model.license,
      languageCodes: model.languageCodes,
      requiresAuth: model.requiresAuth,
    };
  }

  private toDomain(record: ModelRecord): IModel {
    return new Model({
      id: record.id,
      name: record.name,
      version: record.version,
      variant: record.variant,
      publisher: record.publisher,
      kind: record.kind,
      isRunnable: record.isRunnable,
      status: record.status,
      source: new ModelSource({
        type: record.source.type,
        sourceId: record.source.sourceId,
        repository: record.source.repository,
        revision: record.source.revision,
        url: record.source.url,
        providerMetadata: record.source.providerMetadata,
      }),
      artifact: new ModelArtifact({
        name: record.artifact.name,
        accessMethod: record.artifact.accessMethod,
        location: record.artifact.location,
        format: record.artifact.format,
        sizeBytes: record.artifact.sizeBytes,
        sha256: record.artifact.sha256,
        contentType: record.artifact.contentType,
      }),
      additionalArtifacts: record.additionalArtifacts.map(
        (artifact) =>
          new ModelArtifact({
            name: artifact.name,
            accessMethod: artifact.accessMethod,
            location: artifact.location,
            format: artifact.format,
            sizeBytes: artifact.sizeBytes,
            sha256: artifact.sha256,
            contentType: artifact.contentType,
          })
      ),
      dependencies: record.dependencies.map(
        (dependency) =>
          new ModelDependency({
            id: dependency.id,
            label: dependency.label,
            dependencyType: dependency.dependencyType,
            severity: dependency.severity as never,
            description: dependency.description,
            acceptedModelIds: dependency.acceptedModelIds,
            acceptedNames: dependency.acceptedNames,
            acceptedKinds: dependency.acceptedKinds,
            acceptedArchitectureFamilies:
              dependency.acceptedArchitectureFamilies,
            acceptedTasks: dependency.acceptedTasks as never,
            acceptedFormats: dependency.acceptedFormats as never,
            acceptedPrecisions: dependency.acceptedPrecisions as never,
          })
      ),
      precision: record.precision,
      architectureFamily: record.architectureFamily,
      architecture: record.architecture,
      compatibility: new ModelCompatibility({
        inputModalities: record.compatibility.inputModalities as never,
        outputModalities: record.compatibility.outputModalities as never,
        supportedTasks: record.compatibility.supportedTasks as never,
        supportedRuntimes: record.compatibility.supportedRuntimes as never,
        allowsAnyRuntime: record.compatibility.allowsAnyRuntime,
        architectureFamilies: record.compatibility.architectureFamilies,
        allowsAnyArchitectureFamily:
          record.compatibility.allowsAnyArchitectureFamily,
        compatibleAssetTypes: record.compatibility.compatibleAssetTypes,
      }),
      requirements: record.requirements.map(
        (requirement) =>
          new ModelRequirement({
            id: requirement.id,
            label: requirement.label,
            kind: requirement.kind as never,
            severity: requirement.severity as never,
            description: requirement.description,
            acceptedInputModalities: requirement.acceptedInputModalities as never,
            acceptedOutputModalities:
              requirement.acceptedOutputModalities as never,
            requiredTasks: requirement.requiredTasks as never,
            acceptedRuntimes: requirement.acceptedRuntimes as never,
            acceptedArchitectureFamilies:
              requirement.acceptedArchitectureFamilies,
            acceptedFormats: requirement.acceptedFormats as never,
            requiredDependencies: requirement.requiredDependencies?.map(
              (dependency) =>
                new ModelDependency({
                  id: dependency.id,
                  label: dependency.label,
                  dependencyType: dependency.dependencyType,
                  severity: dependency.severity as never,
                  description: dependency.description,
                  acceptedModelIds: dependency.acceptedModelIds,
                  acceptedNames: dependency.acceptedNames,
                  acceptedKinds: dependency.acceptedKinds,
                  acceptedArchitectureFamilies:
                    dependency.acceptedArchitectureFamilies,
                  acceptedTasks: dependency.acceptedTasks as never,
                  acceptedFormats: dependency.acceptedFormats as never,
                  acceptedPrecisions: dependency.acceptedPrecisions as never,
                })
            ),
            acceptedQuantizations: requirement.acceptedQuantizations as never,
            acceptedLicenses: requirement.acceptedLicenses,
            minimumMemoryBytes: requirement.minimumMemoryBytes,
            maximumMemoryBytes: requirement.maximumMemoryBytes,
          })
      ),
      resourceProfile: record.resourceProfile
        ? new ModelResourceProfile(record.resourceProfile)
        : undefined,
      description: record.description,
      tags: record.tags,
      license: record.license,
      languageCodes: record.languageCodes,
      requiresAuth: record.requiresAuth,
    });
  }
}
