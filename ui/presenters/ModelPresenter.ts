import type { IModel } from "../../domain/models/interfaces/IModel";
import type { IModelCompatibilityResult } from "../../domain/services/interfaces/IModelCompatibilityService";
import type { IRemoteModelCatalogItem } from "../../application/ports/interfaces/IRemoteModelCatalog";
import type { ModelResponse } from "../../application/dto/ModelResponse";
import { formatBytes, toTitleCase } from "./PresenterFormatting";

export interface ModelDownloadFileViewModel {
  readonly id: string;
  readonly name: string;
  readonly format: string;
  readonly extension: string;
  readonly sizeBytes?: number;
  readonly sizeLabel?: string;
  readonly isPrimary: boolean;
}

export interface ModelListItemViewModel {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly kind: string;
  readonly status: string;
  readonly architectureFamily?: string;
  readonly format?: string;
  readonly sizeLabel?: string;
  readonly taskBadges: ReadonlyArray<string>;
  readonly runtimeBadges: ReadonlyArray<string>;
  readonly tags: ReadonlyArray<string>;
  readonly isRunnable: boolean;
  readonly isAvailable: boolean;
  readonly requiresAuth: boolean;
  readonly reference: string;
  readonly downloadFiles: ReadonlyArray<ModelDownloadFileViewModel>;
}

export interface RemoteModelListItemViewModel extends ModelListItemViewModel {
  readonly provider: string;
  readonly remoteId?: string;
  readonly isInstallable: boolean;
}

export interface ModelCompatibilityViewModel {
  readonly severity: string;
  readonly isCompatible: boolean;
  readonly reasons: ReadonlyArray<{
    readonly code: string;
    readonly severity: string;
    readonly message: string;
  }>;
}

export interface ModelDetailViewModel extends ModelResponse {
  readonly kindLabel: string;
  readonly statusLabel: string;
  readonly sizeLabel?: string;
  readonly availableLabel: string;
}

function extractExtension(fileName: string, format: string): string {
  const normalizedName = fileName.trim();
  const extension = normalizedName.includes(".")
    ? normalizedName.slice(normalizedName.lastIndexOf(".") + 1).trim()
    : "";

  if (extension) {
    return extension.toLowerCase();
  }

  const normalizedFormat = format.trim().toLowerCase();
  return normalizedFormat && normalizedFormat !== "unknown" ? normalizedFormat : "other";
}

function resolveModelSizeLabel(model: IModel): string | undefined {
  const explicitSize = formatBytes(model.artifact.sizeBytes);

  if (explicitSize) {
    return explicitSize;
  }

  const totalKnownBytes = [model.artifact, ...model.additionalArtifacts].reduce((sum, artifact) =>
    sum + (artifact.sizeBytes ?? 0), 0);

  return totalKnownBytes > 0 ? formatBytes(totalKnownBytes) : undefined;
}

export class ModelPresenter {
  public present(model: IModel): ModelDetailViewModel {
    const response = this.toResponse(model);

    return Object.freeze({
      ...response,
      kindLabel: toTitleCase(response.kind),
      statusLabel: toTitleCase(response.status),
      sizeLabel: resolveModelSizeLabel(model),
      availableLabel: model.isAvailable() ? "Available" : "Unavailable",
    });
  }

  public presentList(models: ReadonlyArray<IModel>): ReadonlyArray<ModelListItemViewModel> {
    return Object.freeze(models.map((model) => this.presentListItem(model)));
  }

  public presentListItem(model: IModel): ModelListItemViewModel {
    return Object.freeze({
      id: model.id,
      title: model.name,
      subtitle: this.buildSubtitle(model),
      kind: toTitleCase(model.kind),
      status: toTitleCase(model.status),
      architectureFamily: model.architectureFamily,
      format: model.artifact.format,
      sizeLabel: resolveModelSizeLabel(model),
      taskBadges: Object.freeze([...(model.compatibility.supportedTasks ?? [])]),
      runtimeBadges: Object.freeze([...(model.compatibility.supportedRuntimes ?? [])]),
      tags: Object.freeze([...(model.tags ?? [])]),
      isRunnable: model.isRunnable,
      isAvailable: model.isAvailable(),
      requiresAuth: model.requiresAuth,
      reference: model.toReferenceString(),
      downloadFiles: this.buildDownloadFiles(model),
    });
  }

  public presentRemoteItem(
    item: IRemoteModelCatalogItem
  ): RemoteModelListItemViewModel {
    const base = this.presentListItem(item.model);

    return Object.freeze({
      ...base,
      provider: item.provider,
      remoteId: item.remoteId,
      isInstallable: item.isInstallable,
    });
  }

  public presentRemoteList(
    items: ReadonlyArray<IRemoteModelCatalogItem>
  ): ReadonlyArray<RemoteModelListItemViewModel> {
    return Object.freeze(items.map((item) => this.presentRemoteItem(item)));
  }

  public presentCompatibility(
    result: IModelCompatibilityResult
  ): ModelCompatibilityViewModel {
    return Object.freeze({
      severity: toTitleCase(result.severity),
      isCompatible: result.isCompatible,
      reasons: Object.freeze(
        result.reasons.map((reason) =>
          Object.freeze({
            code: reason.code,
            severity: toTitleCase(reason.severity),
            message: reason.message,
          })
        )
      ),
    });
  }

  private buildDownloadFiles(model: IModel): ReadonlyArray<ModelDownloadFileViewModel> {
    const files = [model.artifact, ...model.additionalArtifacts];

    return Object.freeze(
      files.map((artifact, index) =>
        Object.freeze({
          id: `${model.id}::${index}::${artifact.name}`,
          name: artifact.name,
          format: artifact.format,
          extension: extractExtension(artifact.name, artifact.format),
          sizeBytes: artifact.sizeBytes,
          sizeLabel: formatBytes(artifact.sizeBytes),
          isPrimary: index === 0,
        })
      )
    );
  }

  public toResponse(model: IModel): ModelResponse {
    return Object.freeze({
      id: model.id,
      name: model.name,
      version: model.version,
      variant: model.variant,
      publisher: model.publisher,
      kind: model.kind,
      isRunnable: model.isRunnable,
      status: model.status,
      source: Object.freeze({
        type: model.source.type,
        sourceId: model.source.sourceId,
        repository: model.source.repository,
        revision: model.source.revision,
        url: model.source.url,
        providerMetadata: model.source.providerMetadata,
      }),
      artifact: Object.freeze({
        name: model.artifact.name,
        accessMethod: model.artifact.accessMethod,
        location: model.artifact.location,
        format: model.artifact.format,
        sizeBytes: model.artifact.sizeBytes,
        sha256: model.artifact.sha256,
        contentType: model.artifact.contentType,
      }),
      additionalArtifacts: Object.freeze(
        model.additionalArtifacts.map((artifact) =>
          Object.freeze({
            name: artifact.name,
            accessMethod: artifact.accessMethod,
            location: artifact.location,
            format: artifact.format,
            sizeBytes: artifact.sizeBytes,
            sha256: artifact.sha256,
            contentType: artifact.contentType,
          })
        )
      ),
      dependencies: Object.freeze(
        model.dependencies.map((dependency) =>
          Object.freeze({
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
          })
        )
      ),
      precision: model.precision,
      architectureFamily: model.architectureFamily,
      architecture: model.architecture,
      compatibility: Object.freeze({
        inputModalities: model.compatibility.inputModalities,
        outputModalities: model.compatibility.outputModalities,
        supportedTasks: model.compatibility.supportedTasks,
        supportedRuntimes: model.compatibility.supportedRuntimes,
        allowsAnyRuntime: model.compatibility.allowsAnyRuntime,
        architectureFamilies: model.compatibility.architectureFamilies,
        allowsAnyArchitectureFamily:
          model.compatibility.allowsAnyArchitectureFamily,
        compatibleAssetTypes: model.compatibility.compatibleAssetTypes,
      }),
      requirements: Object.freeze(
        model.requirements.map((requirement) =>
          Object.freeze({
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
            requiredDependencies: requirement.requiredDependencies?.map((dependency) =>
              Object.freeze({
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
          })
        )
      ),
      resourceProfile: model.resourceProfile
        ? Object.freeze({
            parameterCount: model.resourceProfile.parameterCount,
            contextWindowTokens: model.resourceProfile.contextWindowTokens,
            maxOutputTokens: model.resourceProfile.maxOutputTokens,
            estimatedMinMemoryBytes: model.resourceProfile.estimatedMinMemoryBytes,
            estimatedRecommendedMemoryBytes:
              model.resourceProfile.estimatedRecommendedMemoryBytes,
            maxBatchSize: model.resourceProfile.maxBatchSize,
            recommendedConcurrency: model.resourceProfile.recommendedConcurrency,
          })
        : undefined,
      description: model.description,
      tags: Object.freeze([...(model.tags ?? [])]),
      license: model.license,
      languageCodes: Object.freeze([...(model.languageCodes ?? [])]),
      requiresAuth: model.requiresAuth,
      isAvailable: model.isAvailable(),
      isSupportingAsset: model.isSupportingAsset(),
      satisfiesRequirements: model.satisfiesRequirements(),
      reference: model.toReferenceString(),
    });
  }

  private buildSubtitle(model: IModel): string | undefined {
    const parts = [model.publisher, model.source.repository].filter(
      (value): value is string => !!value?.trim()
    );

    return parts.length > 0 ? parts.join(" • ") : undefined;
  }
}
