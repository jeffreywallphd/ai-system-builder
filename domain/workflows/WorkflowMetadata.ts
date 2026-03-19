import type {
  IWorkflowAuditInfo,
  IWorkflowContextConfiguration,
  IWorkflowContextPackageReference,
  IWorkflowMetadata,
  IWorkflowRuntimeProfile,
  WorkflowContextVisibilityMode,
} from "./interfaces/IWorkflow";
import type { RuntimeEngine } from "../models/interfaces/IModelCompatibility";

function freezeArray<T>(values?: ReadonlyArray<T>): ReadonlyArray<T> | undefined {
  return values ? Object.freeze([...values]) : undefined;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeOptionalArray(values?: ReadonlyArray<string>): ReadonlyArray<string> | undefined {
  const normalized = [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
  return normalized.length > 0 ? Object.freeze(normalized) : undefined;
}

function normalizeOptionalInteger(value?: number): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isFinite(value) || value < 0) {
    throw new Error("WorkflowMetadata.contextConfiguration numeric values must be finite positive numbers or zero.");
  }

  return Math.floor(value);
}

function freezeContextPackageReferences(
  references?: ReadonlyArray<IWorkflowContextPackageReference>
): ReadonlyArray<IWorkflowContextPackageReference> | undefined {
  if (!references || references.length === 0) {
    return undefined;
  }

  const deduped = new Map<string, IWorkflowContextPackageReference>();

  for (const reference of references) {
    const packageId = reference.packageId.trim();
    if (!packageId || deduped.has(packageId)) {
      continue;
    }

    deduped.set(
      packageId,
      Object.freeze({
        packageId,
        alias: normalizeOptional(reference.alias),
        version: normalizeOptional(reference.version),
        includeFragmentIds: normalizeOptionalArray(reference.includeFragmentIds),
        excludeFragmentIds: normalizeOptionalArray(reference.excludeFragmentIds),
        isEnabled: reference.isEnabled ?? true,
      })
    );
  }

  return deduped.size > 0 ? Object.freeze([...deduped.values()]) : undefined;
}

function freezeContextConfiguration(
  configuration?: IWorkflowContextConfiguration
): IWorkflowContextConfiguration | undefined {
  if (!configuration) {
    return undefined;
  }

  const visibilityMode = configuration.visibilityMode;
  if (visibilityMode !== undefined && visibilityMode !== "basic" && visibilityMode !== "advanced") {
    throw new Error("WorkflowMetadata.contextConfiguration.visibilityMode must be 'basic' or 'advanced'.");
  }

  const packageReferences = freezeContextPackageReferences(configuration.packageReferences);
  const selectedPackageIds = normalizeOptionalArray(configuration.selectedPackageIds);
  const includeKinds = normalizeOptionalArray(configuration.includeKinds);
  const excludeKinds = normalizeOptionalArray(configuration.excludeKinds);

  if (
    selectedPackageIds &&
    packageReferences &&
    selectedPackageIds.some((packageId) => !packageReferences.some((reference) => reference.packageId === packageId))
  ) {
    throw new Error("WorkflowMetadata.contextConfiguration.selectedPackageIds must reference configured context packages.");
  }

  const enabledSelectedPackageIds = selectedPackageIds && packageReferences
    ? Object.freeze(
        packageReferences
          .filter((reference) => reference.isEnabled !== false && selectedPackageIds.includes(reference.packageId))
          .map((reference) => reference.packageId)
      )
    : selectedPackageIds;

  const normalized: IWorkflowContextConfiguration = Object.freeze({
    packageReferences,
    selectedPackageIds: enabledSelectedPackageIds,
    visibilityMode: visibilityMode as WorkflowContextVisibilityMode | undefined,
    maxCharacters: normalizeOptionalInteger(configuration.maxCharacters),
    maxTokens: normalizeOptionalInteger(configuration.maxTokens),
    trimPartialFragments: configuration.trimPartialFragments ?? true,
    includeKinds,
    excludeKinds,
  });

  return (
    normalized.packageReferences ||
    normalized.selectedPackageIds ||
    normalized.visibilityMode !== undefined ||
    normalized.maxCharacters !== undefined ||
    normalized.maxTokens !== undefined ||
    normalized.trimPartialFragments !== true ||
    normalized.includeKinds ||
    normalized.excludeKinds
  )
    ? normalized
    : undefined;
}

export class WorkflowMetadata implements IWorkflowMetadata {
  public readonly name: string;
  public readonly description?: string;
  public readonly author?: string;
  public readonly tags?: ReadonlyArray<string>;
  public readonly version?: string;
  public readonly isPublishedAsTool?: boolean;
  public readonly toolTitle?: string;
  public readonly toolDescription?: string;
  public readonly toolCategory?: string;
  public readonly toolSlug?: string;
  public readonly contextConfiguration?: IWorkflowContextConfiguration;

  constructor(params: {
    name: string;
    description?: string;
    author?: string;
    tags?: ReadonlyArray<string>;
    version?: string;
    isPublishedAsTool?: boolean;
    toolTitle?: string;
    toolDescription?: string;
    toolCategory?: string;
    toolSlug?: string;
    contextConfiguration?: IWorkflowContextConfiguration;
  }) {
    const normalizedName = params.name.trim();

    if (!normalizedName) {
      throw new Error("WorkflowMetadata.name cannot be empty.");
    }

    this.name = normalizedName;
    this.description = params.description?.trim() || undefined;
    this.author = params.author?.trim() || undefined;
    this.tags = freezeArray(
      params.tags?.map((tag) => tag.trim()).filter(Boolean)
    );
    this.version = params.version?.trim() || undefined;
    this.isPublishedAsTool = params.isPublishedAsTool ?? false;
    this.toolTitle = params.toolTitle?.trim() || undefined;
    this.toolDescription = params.toolDescription?.trim() || undefined;
    this.toolCategory = params.toolCategory?.trim() || undefined;
    this.toolSlug = params.toolSlug?.trim() || undefined;
    this.contextConfiguration = freezeContextConfiguration(params.contextConfiguration);
  }

  public static from(metadata: IWorkflowMetadata): WorkflowMetadata {
    return new WorkflowMetadata({
      name: metadata.name,
      description: metadata.description,
      author: metadata.author,
      tags: metadata.tags,
      version: metadata.version,
      isPublishedAsTool: metadata.isPublishedAsTool,
      toolTitle: metadata.toolTitle,
      toolDescription: metadata.toolDescription,
      toolCategory: metadata.toolCategory,
      toolSlug: metadata.toolSlug,
      contextConfiguration: metadata.contextConfiguration,
    });
  }
}

export class WorkflowAuditInfo implements IWorkflowAuditInfo {
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  constructor(params: {
    createdAt?: Date;
    updatedAt?: Date;
  } = {}) {
    this.createdAt = params.createdAt
      ? new Date(params.createdAt.getTime())
      : undefined;
    this.updatedAt = params.updatedAt
      ? new Date(params.updatedAt.getTime())
      : undefined;
  }

  public touch(now: Date = new Date()): WorkflowAuditInfo {
    return new WorkflowAuditInfo({
      createdAt: this.createdAt ?? now,
      updatedAt: now,
    });
  }

  public static from(audit?: IWorkflowAuditInfo): WorkflowAuditInfo | undefined {
    if (!audit) {
      return undefined;
    }

    return new WorkflowAuditInfo({
      createdAt: audit.createdAt,
      updatedAt: audit.updatedAt,
    });
  }
}

export class WorkflowRuntimeProfile implements IWorkflowRuntimeProfile {
  public readonly preferredRuntime?: RuntimeEngine;
  public readonly allowedRuntimes?: ReadonlyArray<RuntimeEngine>;

  constructor(params: {
    preferredRuntime?: RuntimeEngine;
    allowedRuntimes?: ReadonlyArray<RuntimeEngine>;
  } = {}) {
    this.preferredRuntime = params.preferredRuntime;
    this.allowedRuntimes = freezeArray(params.allowedRuntimes);

    if (
      this.preferredRuntime &&
      this.allowedRuntimes &&
      this.allowedRuntimes.length > 0 &&
      !this.allowedRuntimes.includes(this.preferredRuntime)
    ) {
      throw new Error(
        "WorkflowRuntimeProfile.preferredRuntime must be included in allowedRuntimes when allowedRuntimes is provided."
      );
    }
  }

  public supportsRuntime(runtime: RuntimeEngine): boolean {
    if (!this.allowedRuntimes || this.allowedRuntimes.length === 0) {
      return true;
    }

    return this.allowedRuntimes.includes(runtime);
  }

  public static from(
    profile?: IWorkflowRuntimeProfile
  ): WorkflowRuntimeProfile | undefined {
    if (!profile) {
      return undefined;
    }

    return new WorkflowRuntimeProfile({
      preferredRuntime: profile.preferredRuntime,
      allowedRuntimes: profile.allowedRuntimes,
    });
  }
}
