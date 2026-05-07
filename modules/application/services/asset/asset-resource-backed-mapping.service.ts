import type { ArtifactDescriptor, ArtifactReference } from "../../../contracts/artifact";
import type { DatasetDescriptor, DatasetReference } from "../../../contracts/dataset";
import type { ImageAsset } from "../../../contracts/image";
import type { ImageGenerationOutput } from "../../../contracts/image-generation";
import type { ModelInventoryRecord } from "../../../contracts/model";
import type { ArtifactRepoDescriptor, ArtifactRepoTarget, StorageObjectDescriptor } from "../../../contracts/storage";
import { normalizeRuntimeCapabilityId } from "../../../contracts/runtime";
import { normalizeAssetId } from "../../../contracts/asset";
import type {
  AssetExternalRepositoryObjectReference,
  AssetGeneratedOutputReference,
  AssetJsonObject,
  AssetJsonValue,
  AssetMetadata,
  AssetReference,
  AssetResourceBackedAsset,
  AssetResourceBacking,
  AssetResourceBackingRole,
  AssetResourcePreviewKind,
  AssetResourcePreviewReference,
  AssetType,
} from "../../../contracts/asset";

const FORBIDDEN_METADATA_KEY_PATTERN =
  /(token|secret|password|credential|authorization|auth|localpath|cachepath|temppath|filepath|filesystempath|bytes|blob|contentbase64|stacktrace|commandline|rawpayload)/i;

interface ResourceBackedAssetLinkInput {
  readonly assetRef: AssetReference;
  readonly backings: readonly AssetResourceBacking[];
  readonly primaryBackingRef?: AssetReference;
  readonly previewRefs?: readonly AssetReference[];
  readonly generatedFrom?: AssetGeneratedOutputReference;
  readonly metadata?: Record<string, unknown>;
}

interface PreviewInput {
  readonly previewId: string;
  readonly previewKind: AssetResourcePreviewKind;
  readonly assetRef?: AssetReference;
  readonly resourceBackingRef?: AssetReference;
  readonly contentType?: string;
  readonly summary?: string;
  readonly metadata?: Record<string, unknown>;
}

function trimText(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function stableToken(value: string): string {
  const token = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return token.length > 0 ? token : "resource";
}

function safeId(prefix: string, value: string | undefined): string {
  return `${prefix}.${stableToken(value ?? prefix)}`;
}

function checksumValue(checksum: { readonly algorithm?: string; readonly value?: string } | undefined): string | undefined {
  if (!checksum?.value) {
    return undefined;
  }

  return checksum.algorithm ? `${checksum.algorithm}:${checksum.value}` : checksum.value;
}

function sanitizeJsonValue(value: unknown): AssetJsonValue | undefined {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value as AssetJsonValue;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (Array.isArray(value)) {
    const sanitizedArray = value
      .map((entry) => sanitizeJsonValue(entry))
      .filter((entry): entry is AssetJsonValue => typeof entry !== "undefined");
    return sanitizedArray;
  }

  if (typeof value === "object" && value !== null) {
    const sanitizedEntries = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !FORBIDDEN_METADATA_KEY_PATTERN.test(key))
      .map(([key, entry]) => [key, sanitizeJsonValue(entry)] as const)
      .filter((entry): entry is readonly [string, AssetJsonValue] => typeof entry[1] !== "undefined");

    return Object.fromEntries(sanitizedEntries) as AssetJsonObject;
  }

  return undefined;
}

function metadataOf(value: Record<string, unknown> | undefined): AssetMetadata | undefined {
  const sanitized = sanitizeJsonValue(value);

  if (!sanitized || typeof sanitized !== "object" || Array.isArray(sanitized)) {
    return undefined;
  }

  return sanitized as AssetMetadata;
}

function safeAssetId(prefix: string, value: string | undefined) {
  return normalizeAssetId(safeId(prefix, value));
}

function artifactKeyFromReference(reference: ArtifactReference): string {
  return reference.key;
}

function externalProvider(provider: string): AssetExternalRepositoryObjectReference["provider"] {
  switch (provider.trim().toLowerCase()) {
    case "huggingface":
    case "hf":
      return "huggingface";
    case "local":
    case "local-filesystem":
      return "local";
    case "github":
      return "github";
    case "http":
    case "https":
      return "http";
    default:
      return "custom";
  }
}

export class AssetResourceBackedMappingService {
  mapArtifactReferenceToBacking(
    reference: ArtifactReference,
    role: AssetResourceBackingRole = "source",
  ): AssetResourceBacking {
    const key = artifactKeyFromReference(reference);

    return {
      backingId: safeId("artifact", key),
      resourceKind: "artifact",
      ref: {
        kind: "artifact",
        id: safeAssetId("artifact-ref", key),
        label: trimText(reference.label),
        metadata: metadataOf({ artifactKey: key }),
      },
      role,
      displayName: trimText(reference.label),
      metadata: metadataOf({ artifactKey: key }),
    };
  }

  mapArtifactDescriptorToBacking(
    descriptor: ArtifactDescriptor,
    role: AssetResourceBackingRole = "primary",
  ): AssetResourceBacking {
    const key = descriptor.key;

    return {
      backingId: safeId("artifact", descriptor.id ?? key),
      resourceKind: "artifact",
      ref: {
        kind: "artifact",
        id: safeAssetId("artifact-ref", descriptor.id ?? key),
        label: trimText(descriptor.name),
        metadata: metadataOf({ artifactKey: key, artifactId: descriptor.id }),
      },
      role,
      displayName: trimText(descriptor.name),
      contentType: trimText(descriptor.format?.mediaType),
      format: trimText(descriptor.format?.extension),
      sizeBytes: descriptor.sizeBytes,
      checksum: checksumValue(descriptor.checksum),
      createdAt: trimText(descriptor.createdAt),
      updatedAt: trimText(descriptor.updatedAt),
      metadata: metadataOf(descriptor.metadata),
    };
  }

  mapStorageObjectToBacking(
    descriptor: StorageObjectDescriptor,
    role: AssetResourceBackingRole = "materialization",
  ): AssetResourceBacking {
    return {
      backingId: safeId("storage-object", descriptor.key),
      resourceKind: "storage-object",
      ref: {
        kind: "resource",
        id: safeAssetId("storage-object-ref", descriptor.key),
        metadata: metadataOf({ storageKey: descriptor.key }),
      },
      role,
      contentType: trimText(descriptor.mediaType),
      sizeBytes: descriptor.sizeBytes,
      checksum: checksumValue(descriptor.checksum),
      metadata: metadataOf(descriptor.metadata),
    };
  }

  mapArtifactRepoTargetToExternalRepositoryObject(
    target: ArtifactRepoTarget,
    objectKind: AssetExternalRepositoryObjectReference["objectKind"] = "file",
  ): AssetExternalRepositoryObjectReference {
    return {
      provider: externalProvider(target.provider),
      repositoryId: target.repository.trim(),
      revision: trimText(target.revision),
      objectPath: trimText(target.path),
      objectKind,
      metadata: metadataOf({ storageProvider: target.provider }),
    };
  }

  mapArtifactRepoDescriptorToBacking(
    descriptor: ArtifactRepoDescriptor,
    role: AssetResourceBackingRole = "source",
  ): AssetResourceBacking {
    const ref = this.mapArtifactRepoTargetToExternalRepositoryObject(descriptor.target, "artifact");

    return {
      backingId: safeId("artifact-repo-object", `${ref.provider}-${ref.repositoryId}-${ref.objectPath ?? "root"}`),
      resourceKind: "artifact-repository-object",
      ref,
      role,
      contentType: trimText(descriptor.mediaType),
      sizeBytes: descriptor.sizeBytes,
      checksum: checksumValue(descriptor.checksum),
    };
  }

  mapExternalRepositoryObjectToBacking(
    reference: AssetExternalRepositoryObjectReference,
    role: AssetResourceBackingRole = "source",
  ): AssetResourceBacking {
    return {
      backingId: safeId("external-repository-object", `${reference.provider}-${reference.repositoryId}-${reference.objectPath ?? "root"}`),
      resourceKind: "external-repository-object",
      ref: {
        ...reference,
        metadata: metadataOf(reference.metadata),
      },
      role,
      contentType: trimText(reference.contentType),
      metadata: metadataOf({ provider: reference.provider, repositoryId: reference.repositoryId, objectKind: reference.objectKind }),
    };
  }

  mapImageAssetToResourceBackedAsset(
    image: ImageAsset,
    assetRef?: AssetReference,
  ): AssetResourceBackedAsset {
    const backing: AssetResourceBacking = {
      backingId: safeId("image", image.assetId),
      resourceKind: "image",
      ref: {
        kind: "artifact",
        id: safeAssetId("image-artifact-ref", image.artifactId),
        metadata: metadataOf({ artifactId: image.artifactId, imageAssetId: image.assetId }),
      },
      role: "primary",
      displayName: trimText(image.metadata.originalFileName),
      createdAt: trimText(image.metadata.createdAt),
      metadata: metadataOf({ ...image.metadata, source: image.source }),
    };

    return this.linkResourceBackedAsset({
      assetRef: assetRef ?? { kind: "resource-backed-asset", id: safeAssetId("image-asset", image.assetId) },
      backings: [backing],
      primaryBackingRef: { kind: "resource", id: normalizeAssetId(backing.backingId) },
      metadata: { source: image.source },
    });
  }

  mapImageGenerationOutputToGeneratedOutputReference(
    output: ImageGenerationOutput,
    outputId: string,
    taskRef?: AssetReference,
  ): AssetGeneratedOutputReference {
    return {
      outputId: outputId.trim(),
      taskRef,
      runtimeCapabilityId: normalizeRuntimeCapabilityId("image-generation"),
      producedAssetType: "image",
      metadata: metadataOf({
        engine: output.engine,
        fileName: output.fileName,
        subfolder: output.subfolder,
        mediaType: output.mediaType,
        promptId: output.promptId,
        width: output.width,
        height: output.height,
      }),
    };
  }

  mapGeneratedOutputToBacking(
    reference: AssetGeneratedOutputReference,
    role: AssetResourceBackingRole = "derived",
  ): AssetResourceBacking {
    return {
      backingId: safeId("generated-output", reference.outputId),
      resourceKind: "generated-output",
      ref: {
        ...reference,
        metadata: metadataOf(reference.metadata),
      },
      role,
      createdAt: trimText(reference.producedAt),
      metadata: metadataOf({ producedAssetType: reference.producedAssetType, runtimeCapabilityId: reference.runtimeCapabilityId }),
    };
  }

  mapDatasetDescriptorToBacking(
    descriptor: DatasetDescriptor,
    role: AssetResourceBackingRole = "primary",
  ): AssetResourceBacking {
    return {
      backingId: safeId("dataset", descriptor.id),
      resourceKind: "dataset",
      ref: {
        kind: "resource",
        id: safeAssetId("dataset-ref", descriptor.id),
        label: trimText(descriptor.name),
        metadata: metadataOf({ datasetId: descriptor.id }),
      },
      role,
      displayName: trimText(descriptor.name),
      createdAt: trimText(descriptor.createdAt),
      metadata: metadataOf({
        ...descriptor.metadata,
        sourceArtifactCount: descriptor.sourceArtifacts?.length,
        transformCount: descriptor.transforms?.length,
        materializationCount: descriptor.materializations?.length,
      }),
    };
  }

  mapDatasetReferenceToBacking(
    reference: DatasetReference,
    role: AssetResourceBackingRole = "source",
  ): AssetResourceBacking {
    return {
      backingId: safeId("dataset", reference.id),
      resourceKind: "dataset",
      ref: {
        kind: "resource",
        id: safeAssetId("dataset-ref", reference.id),
        label: trimText(reference.label),
        metadata: metadataOf({ datasetId: reference.id }),
      },
      role,
      displayName: trimText(reference.label),
    };
  }

  mapModelInventoryRecordToBacking(
    record: ModelInventoryRecord,
    role: AssetResourceBackingRole = "primary",
  ): AssetResourceBacking {
    return {
      backingId: safeId("model", record.modelRecordId),
      resourceKind: "model",
      ref: {
        kind: "resource",
        id: safeAssetId("model-ref", record.modelRecordId),
        label: trimText(record.displayName),
        metadata: metadataOf({ modelRecordId: record.modelRecordId, modelId: record.modelId }),
      },
      role,
      displayName: trimText(record.displayName),
      sizeBytes: record.sizeBytes,
      createdAt: trimText(record.createdAt),
      updatedAt: trimText(record.updatedAt),
      metadata: metadataOf({
        source: record.source,
        lifecycleStatus: record.lifecycleStatus,
        artifactForm: record.artifactForm,
        provider: record.provider,
        modelId: record.modelId,
        taskTags: record.taskTags,
        inferenceMode: record.inferenceMode,
        serializationFormat: record.serializationFormat,
        parameterCount: record.parameterCount,
        baseModelId: record.baseModelId,
        generatedFromRunId: record.generatedFromRunId,
        adapterOfModelId: record.adapterOfModelId,
        backingArtifactIds: record.backingArtifactIds,
        primaryArtifactId: record.primaryArtifactId,
        validationStatus: record.validationStatus,
        published: record.published,
        metadata: record.metadata,
      }),
    };
  }

  createPreviewReference(input: PreviewInput): AssetResourcePreviewReference {
    return {
      previewId: input.previewId.trim(),
      previewKind: input.previewKind,
      assetRef: input.assetRef,
      resourceBackingRef: input.resourceBackingRef,
      contentType: trimText(input.contentType),
      summary: trimText(input.summary),
      metadata: metadataOf(input.metadata),
    };
  }

  linkResourceBackedAsset(input: ResourceBackedAssetLinkInput): AssetResourceBackedAsset {
    return {
      assetRef: input.assetRef,
      backings: input.backings.map((backing) => ({ ...backing })),
      primaryBackingRef: input.primaryBackingRef,
      previewRefs: input.previewRefs?.map((previewRef) => ({ ...previewRef })),
      generatedFrom: input.generatedFrom
        ? { ...input.generatedFrom, sourceRefs: input.generatedFrom.sourceRefs?.map((ref) => ({ ...ref })) }
        : undefined,
      metadata: metadataOf(input.metadata),
    };
  }

  mapBackingToResourceBackedAsset(
    assetRef: AssetReference,
    backing: AssetResourceBacking,
    assetType?: AssetType,
  ): AssetResourceBackedAsset {
    return this.linkResourceBackedAsset({
      assetRef,
      backings: [backing],
      primaryBackingRef: { kind: "resource", id: normalizeAssetId(backing.backingId) },
      metadata: assetType ? { assetType } : undefined,
    });
  }
}

export const assetResourceBackedMappingService = new AssetResourceBackedMappingService();
