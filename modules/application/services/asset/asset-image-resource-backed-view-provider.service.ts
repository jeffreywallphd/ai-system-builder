import type {
  AssetFamily,
  AssetGeneratedOutputReference,
  AssetMetadata,
  AssetReference,
  AssetResourceBackedView,
  AssetResourceBackedViewKind,
  AssetResourceBacking,
  AssetType,
} from "../../../contracts/asset";
import { normalizeAssetId } from "../../../contracts/asset";
import type { ImageAsset } from "../../../contracts/image";
import type { ImageGenerationOutput } from "../../../contracts/image-generation";
import type { ImageAssetDescriptorReadPort } from "../../ports/image";
import type {
  AssetResourceBackedViewListQuery,
  AssetResourceBackedViewListResult,
  AssetResourceBackedViewProvider,
  AssetResourceBackedViewProviderDiagnostic,
} from "../../ports/asset";
import { AssetResourceBackedMappingService, assetResourceBackedMappingService } from "./asset-resource-backed-mapping.service";
import { BUILT_IN_ASSET_DEFINITION_VERSION } from "./built-ins";
import { isUnsafeAssetMetadataKey, isUnsafeAssetMetadataString, sanitizeAssetMetadata, sanitizeAssetStringValue, sanitizeAssetViewValue } from "./asset-safe-metadata";

export interface GeneratedImageOutputDescriptor {
  readonly outputId: string;
  readonly output?: ImageGenerationOutput;
  readonly generatedOutput?: AssetGeneratedOutputReference;
  readonly displayName?: string;
  readonly producedAt?: string;
  readonly artifactId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface GeneratedImageOutputDescriptorListResult {
  readonly items: readonly GeneratedImageOutputDescriptor[];
  readonly nextCursor?: string;
}

export interface GeneratedImageOutputDescriptorSource {
  listGeneratedImageOutputDescriptors(query?: { readonly searchText?: string; readonly limit?: number; readonly cursor?: string }): Promise<GeneratedImageOutputDescriptorListResult>;
  readGeneratedImageOutputDescriptor?(outputId: string): Promise<GeneratedImageOutputDescriptor | null | undefined>;
}

export interface AssetImageResourceBackedViewProviderDependencies {
  readonly imageAssetDescriptorRead?: ImageAssetDescriptorReadPort;
  readonly generatedImageOutputDescriptorSource?: GeneratedImageOutputDescriptorSource;
  readonly mappingService?: AssetResourceBackedMappingService;
  readonly providerId?: string;
  readonly maxListLimit?: number;
}

const DEFAULT_PROVIDER_ID = "asset-image-resource-backed-view-provider";
const DEFAULT_LIST_LIMIT = 100;
const ABSOLUTE_MAX_LIST_LIMIT = 250;
type UnknownRecord = Readonly<Record<string, unknown>>;

export class AssetImageResourceBackedViewProvider implements AssetResourceBackedViewProvider {
  public readonly providerId: string;
  private readonly imageAssetDescriptorRead?: ImageAssetDescriptorReadPort;
  private readonly generatedImageOutputDescriptorSource?: GeneratedImageOutputDescriptorSource;
  private readonly mappingService: AssetResourceBackedMappingService;
  private readonly maxListLimit: number;

  public constructor(dependencies: AssetImageResourceBackedViewProviderDependencies = {}) {
    this.imageAssetDescriptorRead = dependencies.imageAssetDescriptorRead;
    this.generatedImageOutputDescriptorSource = dependencies.generatedImageOutputDescriptorSource;
    this.mappingService = dependencies.mappingService ?? assetResourceBackedMappingService;
    this.providerId = dependencies.providerId ?? DEFAULT_PROVIDER_ID;
    this.maxListLimit = Math.min(Math.max(1, dependencies.maxListLimit ?? DEFAULT_LIST_LIMIT), ABSOLUTE_MAX_LIST_LIMIT);
  }

  public async listResourceBackedViews(query: AssetResourceBackedViewListQuery = {}): Promise<AssetResourceBackedViewListResult> {
    const diagnostics: AssetResourceBackedViewProviderDiagnostic[] = [];
    const limit = this.safeLimit(query.limit);

    if (typeof query.limit === "number" && Number.isFinite(query.limit) && Math.floor(query.limit) > limit) {
      diagnostics.push(this.diagnostic("info", "image-resource-backed-view-limit-clamped", "Image resource-backed view limit was clamped.", {
        requestedLimit: query.limit,
        appliedLimit: limit,
      }));
    }

    if (query.cursor) {
      diagnostics.push(this.diagnostic("warning", "image-resource-backed-view-cursor-unsupported", "Image resource-backed view cursor pagination is not supported by this descriptor provider yet."));
    }

    if (query.lifecycleStatuses?.length) {
      diagnostics.push(this.diagnostic("info", "image-resource-backed-view-lifecycle-filter-unsupported", "Generated image output descriptors do not have Asset Kernel lifecycle status until finalization."));
    }

    const imageViews = await this.listImageAssetViews(query, limit, diagnostics);
    const remainingLimit = Math.max(0, limit - imageViews.length);
    const generatedOutputViews = remainingLimit > 0
      ? await this.listGeneratedOutputViews(query, remainingLimit, diagnostics)
      : [];

    const items = [...imageViews, ...generatedOutputViews]
      .filter((view) => matchesQuery(view, query))
      .slice(0, limit);

    return sanitizeAssetViewValue({
      items,
      ...(diagnostics.length ? { diagnostics } : {}),
    }) as AssetResourceBackedViewListResult;
  }

  public async readResourceBackedView(viewId: string): Promise<AssetResourceBackedView | undefined> {
    const result = await this.listResourceBackedViews({ limit: this.maxListLimit });
    return result.items.find((view) => view.viewId === viewId);
  }

  private async listImageAssetViews(
    query: AssetResourceBackedViewListQuery,
    limit: number,
    diagnostics: AssetResourceBackedViewProviderDiagnostic[],
  ): Promise<readonly AssetResourceBackedView[]> {
    if (limit <= 0 || !allowsViewKind(query, "image-asset")) return [];
    if (!this.imageAssetDescriptorRead) {
      diagnostics.push(this.diagnostic("warning", "image-resource-backed-view-image-source-unavailable", "Finalized image asset descriptor list seam is not available."));
      return [];
    }

    let items: readonly ImageAsset[];
    try {
      const result = await this.imageAssetDescriptorRead.listImageAssetDescriptors({
        searchText: query.searchText,
        limit,
        cursor: undefined,
      });
      items = result.items;
    } catch {
      diagnostics.push(this.diagnostic("warning", "image-resource-backed-view-image-source-failed", "Finalized image asset descriptor source failed while listing resource-backed views.", {
        failureKind: "source-exception",
      }));
      return [];
    }

    const views: AssetResourceBackedView[] = [];
    for (const item of items) {
      const view = this.viewFromImageAsset(item, diagnostics);
      if (!view || !matchesQuery(view, query)) continue;
      views.push(view);
      if (views.length >= limit) break;
    }
    return views;
  }

  private async listGeneratedOutputViews(
    query: AssetResourceBackedViewListQuery,
    limit: number,
    diagnostics: AssetResourceBackedViewProviderDiagnostic[],
  ): Promise<readonly AssetResourceBackedView[]> {
    if (limit <= 0 || !allowsViewKind(query, "generated-output")) return [];
    if (!this.generatedImageOutputDescriptorSource) {
      diagnostics.push(this.diagnostic("info", "image-resource-backed-view-generated-output-source-unavailable", "Generated image output descriptor source is not available."));
      return [];
    }

    let items: readonly GeneratedImageOutputDescriptor[];
    try {
      const result = await this.generatedImageOutputDescriptorSource.listGeneratedImageOutputDescriptors({
        searchText: query.searchText,
        limit,
        cursor: undefined,
      });
      items = result.items;
    } catch {
      diagnostics.push(this.diagnostic("warning", "image-resource-backed-view-generated-output-source-failed", "Generated image output descriptor source failed while listing resource-backed views.", {
        failureKind: "source-exception",
      }));
      return [];
    }

    const views: AssetResourceBackedView[] = [];
    for (const item of items) {
      const view = this.viewFromGeneratedOutputDescriptor(item, diagnostics);
      if (!view || !matchesQuery(view, query)) continue;
      views.push(view);
      if (views.length >= limit) break;
    }
    return views;
  }

  private viewFromImageAsset(
    image: ImageAsset,
    diagnostics: AssetResourceBackedViewProviderDiagnostic[],
  ): AssetResourceBackedView | undefined {
    const imageIdentity = safeIdentity(image.assetId, "image");
    const artifactIdentity = safeIdentity(image.artifactId, "artifact");
    if (!imageIdentity || !artifactIdentity) {
      diagnostics.push(this.diagnostic("warning", "image-resource-backed-view-skipped-invalid-descriptor", "An image asset descriptor was skipped because its identifier was invalid."));
      return undefined;
    }

    if (hasUnsafeMetadata(image.metadata)) {
      diagnostics.push(this.diagnostic("warning", "image-resource-backed-view-unsafe-data-omitted", "Unsafe image asset metadata fields were omitted from a resource-backed view."));
    }

    const metadata = image.metadata as unknown as UnknownRecord;
    const displayName = safeDisplayName(stringField(metadata, ["title", "name", "displayName", "originalFileName"])) ?? imageIdentity.safeLabel;
    const sourceRef = artifactSourceRef(artifactIdentity, displayName);
    const backing: AssetResourceBacking = sanitizeAssetViewValue({
      backingId: `image.internal.${stableHash(imageIdentity.raw)}`,
      resourceKind: "image",
      ref: sourceRef,
      role: "primary",
      displayName,
      createdAt: safeMetadataString(image.metadata.createdAt),
      metadata: metadataOf({
        artifactId: artifactIdentity.publicId,
        imageAssetId: imageIdentity.publicId,
        source: image.source,
        ...safeImageGenerationMetadata(metadata),
      }),
    }) as AssetResourceBacking;
    const assetRef: AssetReference = {
      kind: "resource-backed-asset",
      id: normalizeAssetId(`image-asset.${imageIdentity.publicId}`),
      label: displayName,
      metadata: metadataOf({ imageAssetId: imageIdentity.publicId }),
    };

    return sanitizeAssetViewValue({
      viewId: `asset-view.image.internal.${stableHash(imageIdentity.raw)}`,
      viewKind: "image-asset",
      assetType: "image" satisfies AssetType,
      assetFamily: "resource-backed" satisfies AssetFamily,
      assetDefinitionRef: builtInDefinitionRef("builtin.resource-backed-image"),
      resourceBacking: backing,
      resourceBackedAsset: this.mappingService.mapBackingToResourceBackedAsset(assetRef, backing, "image"),
      sourceRef,
      displayName,
      summary: "Finalized image asset resource view; not a newly registered Asset Kernel instance.",
      lifecycleStatus: "published",
      metadata: metadataOf({
        imageAssetId: imageIdentity.publicId,
        artifactId: artifactIdentity.publicId,
        source: image.source,
        width: image.metadata.width,
        height: image.metadata.height,
        ...safeImageGenerationMetadata(metadata),
      }),
    }) as AssetResourceBackedView;
  }

  private viewFromGeneratedOutputDescriptor(
    descriptor: GeneratedImageOutputDescriptor,
    diagnostics: AssetResourceBackedViewProviderDiagnostic[],
  ): AssetResourceBackedView | undefined {
    const outputIdentity = safeIdentity(descriptor.outputId, "generated-output");
    if (!outputIdentity) {
      diagnostics.push(this.diagnostic("warning", "image-resource-backed-view-skipped-invalid-descriptor", "A generated image output descriptor was skipped because its identifier was invalid."));
      return undefined;
    }

    if (hasUnsafeMetadata(descriptor) || hasUnsafeMetadata(descriptor.metadata)) {
      diagnostics.push(this.diagnostic("warning", "image-resource-backed-view-unsafe-data-omitted", "Unsafe generated image output descriptor fields were omitted from a resource-backed view."));
    }

    const generatedOutput = this.generatedOutputReference(descriptor, outputIdentity);
    const backing = this.mappingService.mapGeneratedOutputToBacking(generatedOutput);
    const displayName =
      safeDisplayName(descriptor.displayName) ??
      safeDisplayName(descriptor.output?.fileName) ??
      outputIdentity.safeLabel;

    return sanitizeAssetViewValue({
      viewId: `asset-view.generated-output.internal.${stableHash(outputIdentity.raw)}`,
      viewKind: "generated-output",
      generatedOutput,
      resourceBacking: {
        ...backing,
        displayName,
        contentType: safeContentType(descriptor.output?.mediaType),
        metadata: metadataOf({
          producedAssetType: "image",
          runtimeCapabilityId: "image-generation",
          artifactId: descriptor.artifactId ? safeIdentity(descriptor.artifactId, "artifact")?.publicId : undefined,
        }),
      },
      displayName,
      summary: "Generated image output descriptor; not finalized or registered as an image asset.",
      metadata: metadataOf({
        outputId: outputIdentity.publicId,
        producedAssetType: "image",
        finalized: false,
        registered: false,
        mediaType: descriptor.output?.mediaType,
        width: descriptor.output?.width,
        height: descriptor.output?.height,
        engine: safeEngineValue(descriptor.output?.engine ?? stringField(descriptor.metadata, ["engine"])),
        model: safeModelValue(stringField(descriptor.metadata, ["model", "checkpoint"])),
        sampler: safeModelValue(stringField(descriptor.metadata, ["sampler"])),
        seed: numberField(descriptor.metadata, ["seed"]),
        ...safeImageGenerationMetadata(descriptor.metadata),
      }),
      diagnostics: [
        {
          severity: "info",
          code: "generated-output-not-finalized",
          message: "Generated image output is not finalized or registered as an image asset.",
          sourceKind: "image-generation-output",
          metadata: metadataOf({ producedAssetType: "image" }),
        },
      ],
    }) as AssetResourceBackedView;
  }

  private generatedOutputReference(
    descriptor: GeneratedImageOutputDescriptor,
    outputIdentity: SafeIdentity,
  ): AssetGeneratedOutputReference {
    const base = descriptor.generatedOutput ?? (descriptor.output
      ? this.mappingService.mapImageGenerationOutputToGeneratedOutputReference(descriptor.output, outputIdentity.publicId)
      : {
          outputId: outputIdentity.publicId,
          runtimeCapabilityId: "image-generation" as const,
          producedAssetType: "image" as const,
        });
    const artifactIdentity = descriptor.artifactId ? safeIdentity(descriptor.artifactId, "artifact") : undefined;
    const artifactRef = artifactIdentity ? artifactSourceRef(artifactIdentity, artifactIdentity.safeLabel) : undefined;

    return sanitizeAssetViewValue({
      outputId: outputIdentity.publicId,
      runtimeCapabilityId: "image-generation",
      producedAssetType: "image",
      producedAt: safeMetadataString(descriptor.producedAt ?? base.producedAt),
      ...(artifactRef ? { sourceRefs: [artifactRef] } : {}),
      metadata: metadataOf({
        ...safeGeneratedOutputMetadata(base.metadata),
        ...safeImageGenerationMetadata(descriptor.metadata),
        artifactId: artifactIdentity?.publicId,
      }),
    }) as AssetGeneratedOutputReference;
  }

  private safeLimit(limit: number | undefined): number {
    if (typeof limit !== "number" || !Number.isFinite(limit) || limit <= 0) return this.maxListLimit;
    return Math.min(Math.floor(limit), this.maxListLimit);
  }

  private diagnostic(
    severity: AssetResourceBackedViewProviderDiagnostic["severity"],
    code: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): AssetResourceBackedViewProviderDiagnostic {
    return {
      severity,
      code,
      message,
      providerId: this.providerId,
      sourceKind: "image",
      ...(metadataOf(metadata) ? { metadata: metadataOf(metadata) } : {}),
    };
  }
}

export function createAssetImageResourceBackedViewProvider(
  dependencies: AssetImageResourceBackedViewProviderDependencies = {},
): AssetImageResourceBackedViewProvider {
  return new AssetImageResourceBackedViewProvider(dependencies);
}

interface SafeIdentity {
  readonly raw: string;
  readonly publicId: string;
  readonly safeLabel: string;
}

function safeIdentity(value: string | undefined, fallbackPrefix: string): SafeIdentity | undefined {
  const raw = typeof value === "string" ? value.trim() : undefined;
  if (!raw) return undefined;
  const pathLikeOrUnsafe = /[\\/]/.test(raw) || /^[a-z]:/i.test(raw) || isUnsafeAssetMetadataString(raw);
  if (!pathLikeOrUnsafe) {
    const publicId = stableToken(raw);
    return { raw, publicId, safeLabel: raw };
  }
  const publicId = `${fallbackPrefix}.${stableHash(raw)}`;
  return { raw, publicId, safeLabel: publicId };
}

function artifactSourceRef(identity: SafeIdentity, label: string): AssetReference {
  return {
    kind: "artifact",
    id: normalizeAssetId(`artifact-ref.${identity.publicId}`),
    label,
    metadata: metadataOf({ artifactId: identity.publicId }),
  };
}

function builtInDefinitionRef(id: "builtin.resource-backed-image"): AssetReference {
  return {
    kind: "asset-definition",
    id: normalizeAssetId(id),
    version: BUILT_IN_ASSET_DEFINITION_VERSION,
  };
}

function metadataOf(value: Record<string, unknown> | AssetMetadata | undefined): AssetMetadata | undefined {
  return sanitizeAssetMetadata(value);
}

function safeGeneratedOutputMetadata(metadata: AssetMetadata | undefined): AssetMetadata | undefined {
  if (!metadata) return undefined;
  const entries = Object.entries(metadata)
    .filter(([key]) => !unsafeImageMetadataKey(key))
    .filter(([key]) => !/^(fileName|subfolder|promptId|requestId|taskId)$/i.test(key));
  return metadataOf(Object.fromEntries(entries));
}

function safeImageGenerationMetadata(metadata: UnknownRecord | undefined): AssetMetadata | undefined {
  if (!metadata) return undefined;
  const safe: Record<string, unknown> = {};
  const engine = safeEngineValue(stringField(metadata, ["engine"]));
  const model = safeModelValue(stringField(metadata, ["model", "checkpoint"]));
  const sampler = safeModelValue(stringField(metadata, ["sampler"]));
  const seed = numberField(metadata, ["seed"]);
  if (engine) safe.engine = engine;
  if (model) safe.model = model;
  if (sampler) safe.sampler = sampler;
  if (typeof seed === "number") safe.seed = seed;
  return metadataOf(safe);
}

function unsafeImageMetadataKey(key: string): boolean {
  return isUnsafeAssetMetadataKey(key) || /^(prompt|negativePrompt|workflow|workflowJson|comfyui|fileName|subfolder|storageKey|thumbnail|preview|dataUrl|request|rawWorkflow)$/i.test(key);
}

function hasUnsafeMetadata(value: unknown): boolean {
  if (typeof value === "string") return isUnsafeAssetMetadataString(value);
  if (Array.isArray(value)) return value.some((entry) => hasUnsafeMetadata(entry));
  if (typeof value === "object" && value !== null) {
    return Object.entries(value as Record<string, unknown>).some(([key, entry]) => unsafeImageMetadataKey(key) || hasUnsafeMetadata(entry));
  }
  return false;
}

function safeDisplayName(value: string | undefined): string | undefined {
  const sanitized = sanitizeAssetStringValue(value);
  if (!sanitized || /[\\/]/.test(sanitized) || /^[a-z]:/i.test(sanitized) || /^data:/i.test(sanitized)) return undefined;
  return sanitized;
}

function safeMetadataString(value: string | undefined): string | undefined {
  return sanitizeAssetStringValue(value);
}

function safeContentType(value: string | undefined): string | undefined {
  const sanitized = sanitizeAssetStringValue(value);
  if (!sanitized || !/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(sanitized)) return undefined;
  return sanitized.toLowerCase();
}

function safeEngineValue(value: string | undefined): string | undefined {
  const sanitized = sanitizeAssetStringValue(value);
  if (!sanitized || !/^[a-z0-9_.:-]{1,80}$/i.test(sanitized)) return undefined;
  return sanitized;
}

function safeModelValue(value: string | undefined): string | undefined {
  const sanitized = sanitizeAssetStringValue(value);
  if (!sanitized || /[\\/]/.test(sanitized) || /^[a-z]:/i.test(sanitized) || sanitized.length > 120) return undefined;
  return sanitized;
}

function stringField(metadata: UnknownRecord | undefined, keys: readonly string[]): string | undefined {
  if (!metadata) return undefined;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string") {
      const sanitized = sanitizeAssetStringValue(value);
      if (sanitized) return sanitized;
    }
  }
  return undefined;
}

function numberField(metadata: UnknownRecord | undefined, keys: readonly string[]): number | undefined {
  if (!metadata) return undefined;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

function allowsViewKind(query: AssetResourceBackedViewListQuery, viewKind: AssetResourceBackedViewKind): boolean {
  return !query.viewKinds?.length || query.viewKinds.includes(viewKind);
}

function matchesQuery(view: AssetResourceBackedView, query: AssetResourceBackedViewListQuery): boolean {
  return (
    (!query.assetTypes?.length || (view.assetType !== undefined && query.assetTypes.includes(view.assetType))) &&
    (!query.assetFamilies?.length || (view.assetFamily !== undefined && query.assetFamilies.includes(view.assetFamily))) &&
    (!query.lifecycleStatuses?.length || (view.lifecycleStatus !== undefined && query.lifecycleStatuses.includes(view.lifecycleStatus))) &&
    (!query.viewKinds?.length || query.viewKinds.includes(view.viewKind)) &&
    matchesSearch(query.searchText, [
      view.viewId,
      view.viewKind,
      view.displayName,
      view.summary,
      view.assetType,
      view.assetFamily,
      view.generatedOutput?.outputId,
      view.resourceBacking?.contentType,
    ])
  );
}

function matchesSearch(searchText: string | undefined, values: readonly (string | undefined)[]): boolean {
  const needle = searchText?.trim().toLowerCase();
  if (!needle) return true;
  return values.some((value) => value?.toLowerCase().includes(needle));
}

function stableToken(value: string): string {
  const token = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return token.length > 0 ? token : "resource";
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
