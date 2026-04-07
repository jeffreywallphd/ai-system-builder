import type { IModel } from "../../../src/domain/models/interfaces/IModel";
import { Model, ModelArtifact, ModelResourceProfile, ModelSource } from "../../../src/domain/models/Model";
import { ModelCompatibility } from "../../../src/domain/models/ModelCompatibility";
import { ModelDependency } from "../../../src/domain/models/ModelDependency";
import { ModelRequirement } from "../../../src/domain/models/ModelRequirement";
import type {
  IInstalledModelCatalog,
  IInstalledModelSearchCriteria,
} from "../../../application/ports/interfaces/IInstalledModelCatalog";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface StoredModelRecord {
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
  readonly additionalArtifacts: ReadonlyArray<StoredModelRecord["artifact"]>;
  readonly dependencies: ReadonlyArray<ConstructorParameters<typeof ModelDependency>[0]>;
  readonly precision?: IModel["precision"];
  readonly architectureFamily?: string;
  readonly architecture?: string;
  readonly compatibility: ConstructorParameters<typeof ModelCompatibility>[0];
  readonly requirements: ReadonlyArray<ConstructorParameters<typeof ModelRequirement>[0]>;
  readonly resourceProfile?: ConstructorParameters<typeof ModelResourceProfile>[0];
  readonly description?: string;
  readonly tags: ReadonlyArray<string>;
  readonly license?: string;
  readonly languageCodes: ReadonlyArray<string>;
  readonly requiresAuth: boolean;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeArray(values?: ReadonlyArray<string>): string[] {
  if (!values || values.length === 0) {
    return [];
  }

  return [...new Set(values.map(normalize).filter(Boolean))];
}

function includesAnyNormalized(
  candidates: ReadonlyArray<string> | undefined,
  filters: ReadonlyArray<string> | undefined
): boolean {
  const normalizedFilters = normalizeArray(filters);

  if (normalizedFilters.length === 0) {
    return true;
  }

  const normalizedCandidates = new Set(normalizeArray(candidates));
  return normalizedFilters.some((filter) => normalizedCandidates.has(filter));
}

function modelMatchesCriteria(model: IModel, criteria?: IInstalledModelSearchCriteria): boolean {
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

  if (criteria.tags && criteria.tags.length > 0 && !includesAnyNormalized(model.tags, criteria.tags)) {
    return false;
  }

  return true;
}

export class LocalStorageInstalledModelCatalog implements IInstalledModelCatalog {
  private readonly storageKey: string;
  private readonly storage?: StorageLike;

  constructor(storageKey: string = "ai-loom-installed-models", storage?: StorageLike) {
    this.storageKey = storageKey.trim() || "ai-loom-installed-models";
    this.storage = storage ?? this.resolveStorage();
  }

  public async listInstalled(criteria?: IInstalledModelSearchCriteria): Promise<ReadonlyArray<IModel>> {
    const items = this.readAll()
      .filter((model) => modelMatchesCriteria(model, criteria))
      .sort((left, right) => normalize(left.name).localeCompare(normalize(right.name)));

    return Object.freeze(
      criteria?.limit && criteria.limit > 0 ? items.slice(0, criteria.limit) : items
    );
  }

  public async getInstalledById(id: string): Promise<IModel | undefined> {
    const modelId = id.trim();
    return this.readAll().find((model) => model.id === modelId);
  }

  public async saveInstalled(model: IModel): Promise<void> {
    const models = new Map(this.readAll().map((item) => [item.id, item] as const));
    models.set(model.id, model);
    this.writeAll([...models.values()]);
  }

  public async removeInstalled(id: string): Promise<boolean> {
    const modelId = id.trim();
    const models = new Map(this.readAll().map((item) => [item.id, item] as const));
    const removed = models.delete(modelId);

    if (removed) {
      this.writeAll([...models.values()]);
    }

    return removed;
  }

  public async isInstalled(id: string): Promise<boolean> {
    return !!(await this.getInstalledById(id));
  }

  private resolveStorage(): StorageLike | undefined {
    if (typeof window === "undefined" || !window.localStorage) {
      return undefined;
    }

    return window.localStorage;
  }

  private readAll(): IModel[] {
    const raw = this.storage?.getItem(this.storageKey);

    if (!raw) {
      return [];
    }

    try {
      const records = JSON.parse(raw) as ReadonlyArray<StoredModelRecord>;
      return records.map((record) => this.toDomain(record));
    } catch {
      return [];
    }
  }

  private writeAll(models: ReadonlyArray<IModel>): void {
    if (!this.storage) {
      return;
    }

    const records = models.map((model) => this.toRecord(model));
    this.storage.setItem(this.storageKey, JSON.stringify(records));
  }

  private toDomain(record: StoredModelRecord): IModel {
    return new Model({
      id: record.id,
      name: record.name,
      version: record.version,
      variant: record.variant,
      publisher: record.publisher,
      kind: record.kind,
      isRunnable: record.isRunnable,
      status: record.status,
      source: new ModelSource(record.source),
      artifact: new ModelArtifact(record.artifact),
      additionalArtifacts: record.additionalArtifacts.map((artifact) => new ModelArtifact(artifact)),
      dependencies: record.dependencies.map((dependency) => new ModelDependency(dependency)),
      precision: record.precision,
      architectureFamily: record.architectureFamily,
      architecture: record.architecture,
      compatibility: new ModelCompatibility(record.compatibility),
      requirements: record.requirements.map((requirement) => new ModelRequirement(requirement)),
      resourceProfile: record.resourceProfile ? new ModelResourceProfile(record.resourceProfile) : undefined,
      description: record.description,
      tags: record.tags,
      license: record.license,
      languageCodes: record.languageCodes,
      requiresAuth: record.requiresAuth,
    });
  }

  private toRecord(model: IModel): StoredModelRecord {
    return Object.freeze({
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
        allowsAnyArchitectureFamily: model.compatibility.allowsAnyArchitectureFamily,
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
        requiredDependencies: requirement.requiredDependencies,
      })),
      resourceProfile: model.resourceProfile
        ? {
            parameterCount: model.resourceProfile.parameterCount,
            contextWindowTokens: model.resourceProfile.contextWindowTokens,
            maxOutputTokens: model.resourceProfile.maxOutputTokens,
            estimatedMinMemoryBytes: model.resourceProfile.estimatedMinMemoryBytes,
            estimatedRecommendedMemoryBytes: model.resourceProfile.estimatedRecommendedMemoryBytes,
            maxBatchSize: model.resourceProfile.maxBatchSize,
            recommendedConcurrency: model.resourceProfile.recommendedConcurrency,
          }
        : undefined,
      description: model.description,
      tags: model.tags,
      license: model.license,
      languageCodes: model.languageCodes,
      requiresAuth: model.requiresAuth,
    });
  }
}
