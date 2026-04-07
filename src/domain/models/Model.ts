import type {
  IModel,
  IModelArtifact,
  IModelCompatibility,
  IModelIdentity,
  IModelResourceProfile,
  IModelSource,
} from "./interfaces/IModel";
import type { IModelRequirement } from "./interfaces/IModelRequirement";
import type { IModelDependency } from "./interfaces/IModelDependency";
import type {
  ModelModality,
  ModelTask,
} from "./interfaces/IModelCompatibility";
import { ModelCompatibility } from "./ModelCompatibility";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeArray(values: ReadonlyArray<string>): string[] {
  return [...new Set(values.map(normalize).filter(Boolean))];
}

function isCompatibility(target: IModel | IModelCompatibility): target is IModelCompatibility {
  return (
    "inputModalities" in target &&
    "outputModalities" in target &&
    "supportedTasks" in target
  );
}

export class ModelIdentity implements IModelIdentity {
  public readonly id: string;
  public readonly name: string;
  public readonly version?: string;
  public readonly variant?: string;
  public readonly publisher?: string;

  constructor(params: {
    id: string;
    name: string;
    version?: string;
    variant?: string;
    publisher?: string;
  }) {
    this.id = params.id;
    this.name = params.name;
    this.version = params.version;
    this.variant = params.variant;
    this.publisher = params.publisher;
  }
}

export class ModelSource implements IModelSource {
  public readonly type: IModelSource["type"];
  public readonly sourceId?: string;
  public readonly repository?: string;
  public readonly revision?: string;
  public readonly url?: string;
  public readonly providerMetadata?: Readonly<Record<string, string>>;

  constructor(params: {
    type: IModelSource["type"];
    sourceId?: string;
    repository?: string;
    revision?: string;
    url?: string;
    providerMetadata?: Readonly<Record<string, string>>;
  }) {
    this.type = params.type;
    this.sourceId = params.sourceId;
    this.repository = params.repository;
    this.revision = params.revision;
    this.url = params.url;
    this.providerMetadata = params.providerMetadata;
  }
}

export class ModelArtifact implements IModelArtifact {
  public readonly name: string;
  public readonly accessMethod: IModelArtifact["accessMethod"];
  public readonly location?: string;
  public readonly format: IModelArtifact["format"];
  public readonly sizeBytes?: number;
  public readonly sha256?: string;
  public readonly contentType?: string;

  constructor(params: {
    name: string;
    accessMethod: IModelArtifact["accessMethod"];
    location?: string;
    format?: IModelArtifact["format"];
    sizeBytes?: number;
    sha256?: string;
    contentType?: string;
  }) {
    this.name = params.name;
    this.accessMethod = params.accessMethod;
    this.location = params.location;
    this.format = params.format ?? "unknown";
    this.sizeBytes = params.sizeBytes;
    this.sha256 = params.sha256;
    this.contentType = params.contentType;
  }
}

export class ModelResourceProfile implements IModelResourceProfile {
  public readonly parameterCount?: number;
  public readonly contextWindowTokens?: number;
  public readonly maxOutputTokens?: number;
  public readonly estimatedMinMemoryBytes?: number;
  public readonly estimatedRecommendedMemoryBytes?: number;
  public readonly maxBatchSize?: number;
  public readonly recommendedConcurrency?: number;

  constructor(params: Partial<IModelResourceProfile> = {}) {
    this.parameterCount = params.parameterCount;
    this.contextWindowTokens = params.contextWindowTokens;
    this.maxOutputTokens = params.maxOutputTokens;
    this.estimatedMinMemoryBytes = params.estimatedMinMemoryBytes;
    this.estimatedRecommendedMemoryBytes =
      params.estimatedRecommendedMemoryBytes;
    this.maxBatchSize = params.maxBatchSize;
    this.recommendedConcurrency = params.recommendedConcurrency;
  }
}

export class Model implements IModel {
  public readonly id: string;
  public readonly name: string;
  public readonly version?: string;
  public readonly variant?: string;
  public readonly publisher?: string;

  public readonly kind: IModel["kind"];
  public readonly isRunnable: boolean;
  public readonly status: IModel["status"];
  public readonly source: IModelSource;
  public readonly artifact: IModelArtifact;
  public readonly additionalArtifacts: ReadonlyArray<IModelArtifact>;
  public readonly dependencies: ReadonlyArray<IModelDependency>;
  public readonly precision?: IModel["precision"];
  public readonly architectureFamily?: string;
  public readonly architecture?: string;
  public readonly compatibility: IModelCompatibility;
  public readonly requirements: ReadonlyArray<IModelRequirement>;
  public readonly resourceProfile?: IModelResourceProfile;
  public readonly description?: string;
  public readonly tags: ReadonlyArray<string>;
  public readonly license?: string;
  public readonly languageCodes: ReadonlyArray<string>;
  public readonly requiresAuth: boolean;

  constructor(params: {
    id: string;
    name: string;
    version?: string;
    variant?: string;
    publisher?: string;
    kind: IModel["kind"];
    isRunnable?: boolean;
    status?: IModel["status"];
    source: IModelSource;
    artifact: IModelArtifact;
    additionalArtifacts?: ReadonlyArray<IModelArtifact>;
    dependencies?: ReadonlyArray<IModelDependency>;
    precision?: IModel["precision"];
    architectureFamily?: string;
    architecture?: string;
    compatibility?: IModelCompatibility;
    requirements?: ReadonlyArray<IModelRequirement>;
    resourceProfile?: IModelResourceProfile;
    description?: string;
    tags?: ReadonlyArray<string>;
    license?: string;
    languageCodes?: ReadonlyArray<string>;
    requiresAuth?: boolean;
  }) {
    this.id = params.id;
    this.name = params.name;
    this.version = params.version;
    this.variant = params.variant;
    this.publisher = params.publisher;

    this.kind = params.kind;
    this.isRunnable = params.isRunnable ?? true;
    this.status = params.status ?? "discovered";
    this.source = params.source;
    this.artifact = params.artifact;
    this.additionalArtifacts = Object.freeze([
      ...(params.additionalArtifacts ?? []),
    ]);
    this.dependencies = Object.freeze([...(params.dependencies ?? [])]);
    this.precision = params.precision;
    this.architectureFamily = params.architectureFamily;
    this.architecture = params.architecture;
    this.compatibility = params.compatibility ?? ModelCompatibility.any();
    this.requirements = Object.freeze([...(params.requirements ?? [])]);
    this.resourceProfile = params.resourceProfile;
    this.description = params.description;
    this.tags = Object.freeze([...(params.tags ?? [])]);
    this.license = params.license;
    this.languageCodes = Object.freeze([...(params.languageCodes ?? [])]);
    this.requiresAuth = params.requiresAuth ?? false;
  }

  public isAvailable(): boolean {
    return ["available", "installed", "ready"].includes(this.status);
  }

  public isSupportingAsset(): boolean {
    return !this.isRunnable;
  }

  public supportsTask(task: ModelTask): boolean {
    return normalizeArray(this.compatibility.supportedTasks).includes(
      normalize(task)
    );
  }

  public supportsInputModality(modality: ModelModality): boolean {
    return normalizeArray(this.compatibility.inputModalities).includes(
      normalize(modality)
    );
  }

  public supportsOutputModality(modality: ModelModality): boolean {
    return normalizeArray(this.compatibility.outputModalities).includes(
      normalize(modality)
    );
  }

  public isCompatibleWith(target: IModel | IModelCompatibility): boolean {
    if (isCompatibility(target)) {
      return this.compatibility.isCompatibleWith(target);
    }

    const baseCompatibility =
      this.compatibility.isCompatibleWith(target.compatibility);

    if (!baseCompatibility) {
      return false;
    }

    const architectureCompatible =
      !this.architectureFamily ||
      !target.architectureFamily ||
      normalize(this.architectureFamily) === normalize(target.architectureFamily) ||
      this.compatibility.supportsArchitectureFamily(target.architectureFamily) ||
      target.compatibility.supportsArchitectureFamily(this.architectureFamily);

    if (!architectureCompatible) {
      return false;
    }

    const declaredDependencyCompatible =
      this.dependencies.some((dependency) => dependency.isSatisfiedBy(target)) ||
      target.dependencies.some((dependency) => dependency.isSatisfiedBy(this));

    if (declaredDependencyCompatible) {
      return true;
    }

    if (this.isSupportingAsset() || target.isSupportingAsset()) {
      const thisKind = normalize(this.kind);
      const targetKind = normalize(target.kind);

      return (
        this.compatibility.supportsAssetType(targetKind) ||
        target.compatibility.supportsAssetType(thisKind)
      );
    }

    return true;
  }

  public satisfiesRequirements(): boolean {
    const estimatedMemoryBytes =
      this.resourceProfile?.estimatedRecommendedMemoryBytes ??
      this.resourceProfile?.estimatedMinMemoryBytes;

    return this.requirements.every((requirement) =>
      requirement.isSatisfiedBy({
        inputModalities: this.compatibility.inputModalities,
        outputModalities: this.compatibility.outputModalities,
        tasks: this.compatibility.supportedTasks,
        runtime:
          this.compatibility.supportedRuntimes.length === 1
            ? this.compatibility.supportedRuntimes[0]
            : undefined,
        architectureFamily: this.architectureFamily,
        format: this.artifact.format,
        dependencies: this.dependencies,
        quantization: this.precision,
        license: this.license,
        estimatedMemoryBytes,
        compatibility: this.compatibility,
      })
    );
  }

  public toReferenceString(): string {
    const parts = [this.name];

    if (this.version) {
      parts.push(this.version);
    }

    if (this.variant) {
      parts.push(this.variant);
    }

    if (this.precision && this.precision !== "unknown") {
      parts.push(this.precision);
    }

    return parts.join("@");
  }

  public static from(model: IModel): Model {
    return new Model({
      id: model.id,
      name: model.name,
      version: model.version,
      variant: model.variant,
      publisher: model.publisher,
      kind: model.kind,
      isRunnable: model.isRunnable,
      status: model.status,
      source: model.source,
      artifact: model.artifact,
      additionalArtifacts: model.additionalArtifacts,
      dependencies: model.dependencies,
      precision: model.precision,
      architectureFamily: model.architectureFamily,
      architecture: model.architecture,
      compatibility: model.compatibility,
      requirements: model.requirements,
      resourceProfile: model.resourceProfile,
      description: model.description,
      tags: model.tags,
      license: model.license,
      languageCodes: model.languageCodes,
      requiresAuth: model.requiresAuth,
    });
  }
}
