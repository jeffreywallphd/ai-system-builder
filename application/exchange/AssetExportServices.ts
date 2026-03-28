import { createHash } from "node:crypto";
import type { IAsset } from "../../domain/assets/interfaces/IAsset";
import type { AssetVersion } from "../../domain/assets/AssetVersion";
import {
  createAtomicAssetPackageManifest,
  createCompositeAssetPackageManifest,
  type AssetPackageDependencyReference,
} from "../../domain/exchange/AssetPackageManifest";
import { BundleDependencySnapshotBuilder } from "../../domain/exchange/BundleDependencySnapshot";
import {
  ExchangeBundleReferenceRelations,
  ExchangeBundleSubjectKinds,
  createExchangeBundle,
  type ExchangeBundleProvenance,
} from "../../domain/exchange/ExchangeBundleDomain";
import { ExchangeBundleSerializer } from "../../domain/exchange/ExchangeBundleSerialization";
import { ExchangeBundleValidator } from "../../domain/exchange/ExchangeBundleValidation";
import type { CompositionTaxonomyDescriptor } from "../../domain/taxonomy/CompositionTaxonomy";
import type { IAssetRecordRepository } from "../ports/interfaces/IAssetRecordRepository";
import type { IAssetVersionRepository } from "../ports/interfaces/IAssetVersionRepository";
import { CompositionTaxonomyClassifier } from "../taxonomy/CompositionTaxonomyClassifier";

export interface AtomicAssetExportRequest {
  readonly assetId: string;
  readonly versionId: string;
  readonly bundleFormatVersion?: string;
  readonly exportedAt?: string;
  readonly tags?: ReadonlyArray<string>;
}

export interface CompositeAssetExportRequest {
  readonly assetId: string;
  readonly versionId: string;
  readonly bundleFormatVersion?: string;
  readonly exportedAt?: string;
  readonly tags?: ReadonlyArray<string>;
}

export interface AssetExportArtifact {
  readonly fileName: string;
  readonly mediaType: string;
  readonly byteLength: number;
  readonly sha256: string;
  readonly content: string;
}

export type AtomicAssetExportResult = {
  readonly ok: true;
  readonly subjectKind: "atomic-asset";
  readonly assetId: string;
  readonly versionId: string;
  readonly bundleId: string;
  readonly artifact: AssetExportArtifact;
} | {
  readonly ok: false;
  readonly subjectKind: "atomic-asset";
  readonly code: "invalid-request" | "asset-not-found" | "version-not-found" | "version-mismatch" | "validation-failed";
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
};

export type CompositeAssetExportResult = {
  readonly ok: true;
  readonly subjectKind: "composite-asset";
  readonly assetId: string;
  readonly versionId: string;
  readonly bundleId: string;
  readonly artifact: AssetExportArtifact;
  readonly compositionCount: number;
} | {
  readonly ok: false;
  readonly subjectKind: "composite-asset";
  readonly code: "invalid-request" | "asset-not-found" | "version-not-found" | "version-mismatch" | "validation-failed";
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
};

interface VersionDependencyMetadata {
  readonly assetId: string;
  readonly versionId?: string;
  readonly relation?: "component" | "dependency" | "contract";
  readonly alias?: string;
  readonly taxonomy?: CompositionTaxonomyDescriptor;
  readonly capabilityHints?: ReadonlyArray<string>;
  readonly configurationHints?: Readonly<Record<string, unknown>>;
}

interface VersionEnvelope {
  readonly metadata?: {
    readonly title?: string;
    readonly summary?: string;
    readonly tags?: ReadonlyArray<string>;
    readonly taxonomy?: CompositionTaxonomyDescriptor;
    readonly contract?: unknown;
    readonly provenance?: {
      readonly sourceType?: string;
      readonly upstreamAssets?: ReadonlyArray<{ readonly versionId?: string }>;
      readonly sourceLabel?: string;
    };
  };
  readonly dependencies?: ReadonlyArray<VersionDependencyMetadata>;
  readonly composition?: ReadonlyArray<VersionDependencyMetadata>;
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeTags(input?: ReadonlyArray<string>): ReadonlyArray<string> {
  return Object.freeze([...(input ?? [])]
    .map((entry) => entry.trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right)));
}

function toEnvelope(version: AssetVersion): VersionEnvelope {
  const metadata = version.metadata as VersionEnvelope | undefined;
  return metadata ?? {};
}

async function resolvePinnedDependencies(
  version: AssetVersion,
  metadataDependencies: ReadonlyArray<VersionDependencyMetadata>,
  versionRepository: IAssetVersionRepository,
): Promise<ReadonlyArray<AssetPackageDependencyReference>> {
  const byVersionId = new Map<string, AssetPackageDependencyReference>();

  for (const dependency of metadataDependencies) {
    if (!dependency.versionId?.trim()) {
      throw new Error(`Dependency '${dependency.assetId}' must include a pinned version id for export.`);
    }
    const versionId = dependency.versionId.trim();
    const assetId = dependency.assetId.trim();
    if (!assetId) {
      throw new Error("Dependency asset id must be present when dependency metadata is provided.");
    }
    byVersionId.set(versionId, Object.freeze({
      assetId,
      versionId,
      relation: dependency.relation ?? "dependency",
      capabilityHints: dependency.capabilityHints,
      configurationHints: dependency.configurationHints,
    }));
  }

  for (const upstreamVersionId of version.upstreamVersionIds) {
    if (byVersionId.has(upstreamVersionId)) {
      continue;
    }
    const upstream = await versionRepository.getByVersionId(upstreamVersionId);
    if (!upstream) {
      throw new Error(`Upstream dependency version '${upstreamVersionId}' could not be resolved.`);
    }

    byVersionId.set(upstreamVersionId, Object.freeze({
      assetId: upstream.assetId.value,
      versionId: upstream.versionId,
      relation: "dependency",
    }));
  }

  return Object.freeze([...byVersionId.values()].sort((left, right) =>
    `${left.assetId}:${left.versionId}:${left.relation}`.localeCompare(`${right.assetId}:${right.versionId}:${right.relation}`)));
}

function resolveTaxonomy(asset: IAsset, version: AssetVersion, taxonomyClassifier: CompositionTaxonomyClassifier): CompositionTaxonomyDescriptor {
  const envelope = toEnvelope(version);
  const fromMetadata = envelope.metadata?.taxonomy;
  return fromMetadata ?? taxonomyClassifier.classifyAsset(asset)
    ?? { structuralKind: "atomic", semanticRole: "dataset", behaviorKind: "none" };
}

function deriveProvenance(version: AssetVersion): ExchangeBundleProvenance | undefined {
  const provenance = toEnvelope(version).metadata?.provenance;
  if (!provenance) {
    return undefined;
  }

  return Object.freeze({
    originType: provenance.sourceType === "imported" ? "import" : "manual",
    sourceVersionLineage: Object.freeze((provenance.upstreamAssets ?? [])
      .map((entry) => entry.versionId?.trim())
      .filter((entry): entry is string => Boolean(entry))),
    metadata: provenance.sourceLabel ? Object.freeze({ sourceLabel: provenance.sourceLabel }) : undefined,
  });
}

function createBundleId(kind: "atomic" | "composite", assetId: string, versionId: string): string {
  return `exchange:${kind}:${assetId}:${versionId}`;
}

function checksum(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

export class AtomicAssetBundleBuilder {
  private readonly taxonomyClassifier: CompositionTaxonomyClassifier;

  public constructor(
    private readonly versionRepository: IAssetVersionRepository,
    taxonomyClassifier: CompositionTaxonomyClassifier = new CompositionTaxonomyClassifier(),
  ) {
    this.taxonomyClassifier = taxonomyClassifier;
  }

  public async build(input: {
    readonly asset: IAsset;
    readonly version: AssetVersion;
    readonly request: AtomicAssetExportRequest;
  }) {
    const envelope = toEnvelope(input.version);
    const dependencies = await resolvePinnedDependencies(input.version, envelope.dependencies ?? [], this.versionRepository);
    const taxonomy = resolveTaxonomy(input.asset, input.version, this.taxonomyClassifier);
    const createdAt = normalizeOptional(input.request.exportedAt) ?? input.version.createdAt.toISOString();

    const manifest = createAtomicAssetPackageManifest({
      subject: {
        assetId: input.asset.id,
        versionId: input.version.versionId,
        kind: ExchangeBundleSubjectKinds.atomicAsset,
        taxonomy,
      },
      bundleFormatVersion: input.request.bundleFormatVersion,
      metadata: {
        createdAt,
        deterministicInputKey: `${input.asset.id}@${input.version.versionId}`,
        packageLabel: envelope.metadata?.title,
        tags: [...(envelope.metadata?.tags ?? []), ...(input.request.tags ?? [])],
      },
      contract: envelope.metadata?.contract as never,
      provenance: deriveProvenance(input.version),
      dependencies,
    });

    const bundle = createExchangeBundle({
      bundleId: createBundleId("atomic", input.asset.id, input.version.versionId),
      formatVersion: input.request.bundleFormatVersion,
      subject: {
        root: {
          assetId: input.asset.id,
          versionId: input.version.versionId,
          kind: ExchangeBundleSubjectKinds.atomicAsset,
          relation: ExchangeBundleReferenceRelations.root,
          taxonomy,
        },
        references: [],
      },
      metadata: {
        label: envelope.metadata?.title,
        description: envelope.metadata?.summary,
        createdAt,
        deterministicInputKey: `${input.asset.id}@${input.version.versionId}`,
        tags: normalizeTags([...(envelope.metadata?.tags ?? []), ...(input.request.tags ?? [])]),
      },
      provenance: deriveProvenance(input.version),
    });

    const dependencySnapshot = BundleDependencySnapshotBuilder.fromAssetPackageManifest(manifest);
    return Object.freeze({ bundle, manifest, dependencySnapshot });
  }
}

export class CompositeAssetBundleBuilder {
  private readonly taxonomyClassifier: CompositionTaxonomyClassifier;

  public constructor(
    private readonly versionRepository: IAssetVersionRepository,
    taxonomyClassifier: CompositionTaxonomyClassifier = new CompositionTaxonomyClassifier(),
  ) {
    this.taxonomyClassifier = taxonomyClassifier;
  }

  public async build(input: {
    readonly asset: IAsset;
    readonly version: AssetVersion;
    readonly request: CompositeAssetExportRequest;
  }): Promise<{ readonly compositionCount: number; readonly bundle: ReturnType<typeof createExchangeBundle>; readonly manifest: ReturnType<typeof createCompositeAssetPackageManifest>; readonly dependencySnapshot: ReturnType<typeof BundleDependencySnapshotBuilder.fromAssetPackageManifest> }> {
    const envelope = toEnvelope(input.version);
    const dependencies = await resolvePinnedDependencies(input.version, envelope.dependencies ?? [], this.versionRepository);
    const taxonomy = resolveTaxonomy(input.asset, input.version, this.taxonomyClassifier);
    const createdAt = normalizeOptional(input.request.exportedAt) ?? input.version.createdAt.toISOString();

    const compositionInput = (envelope.composition ?? envelope.dependencies ?? [])
      .filter((entry) => (entry.relation ?? "component") === "component")
      .map((entry, index) => {
        if (!entry.versionId?.trim()) {
          throw new Error(`Composition child '${entry.assetId}' must include a pinned version id for export.`);
        }
        return Object.freeze({
          alias: entry.alias?.trim() || `component-${index + 1}`,
          assetId: normalizeRequired(entry.assetId, "Composite composition asset id"),
          versionId: entry.versionId.trim(),
          taxonomy: entry.taxonomy,
        });
      });

    const manifest = createCompositeAssetPackageManifest({
      subject: {
        assetId: input.asset.id,
        versionId: input.version.versionId,
        kind: ExchangeBundleSubjectKinds.compositeAsset,
        taxonomy,
      },
      composition: compositionInput,
      bundleFormatVersion: input.request.bundleFormatVersion,
      metadata: {
        createdAt,
        deterministicInputKey: `${input.asset.id}@${input.version.versionId}`,
        packageLabel: envelope.metadata?.title,
        tags: [...(envelope.metadata?.tags ?? []), ...(input.request.tags ?? [])],
      },
      contract: envelope.metadata?.contract as never,
      provenance: deriveProvenance(input.version),
      dependencies,
    });

    const bundle = createExchangeBundle({
      bundleId: createBundleId("composite", input.asset.id, input.version.versionId),
      formatVersion: input.request.bundleFormatVersion,
      subject: {
        root: {
          assetId: input.asset.id,
          versionId: input.version.versionId,
          kind: ExchangeBundleSubjectKinds.compositeAsset,
          relation: ExchangeBundleReferenceRelations.root,
          taxonomy,
        },
        references: compositionInput.map((entry) => ({
          assetId: entry.assetId,
          versionId: entry.versionId,
          kind: ExchangeBundleSubjectKinds.atomicAsset,
          relation: ExchangeBundleReferenceRelations.component,
          taxonomy: entry.taxonomy,
        })),
      },
      metadata: {
        label: envelope.metadata?.title,
        description: envelope.metadata?.summary,
        createdAt,
        deterministicInputKey: `${input.asset.id}@${input.version.versionId}`,
        tags: normalizeTags([...(envelope.metadata?.tags ?? []), ...(input.request.tags ?? [])]),
      },
      provenance: deriveProvenance(input.version),
    });

    const dependencySnapshot = BundleDependencySnapshotBuilder.fromAssetPackageManifest(manifest);
    return Object.freeze({ compositionCount: compositionInput.length, bundle, manifest, dependencySnapshot });
  }
}

export class AtomicAssetExportService {
  private readonly serializer: ExchangeBundleSerializer;
  private readonly builder: AtomicAssetBundleBuilder;

  public constructor(
    private readonly assetRepository: IAssetRecordRepository,
    private readonly versionRepository: IAssetVersionRepository,
    serializer: ExchangeBundleSerializer = new ExchangeBundleSerializer({ validator: new ExchangeBundleValidator() }),
  ) {
    this.serializer = serializer;
    this.builder = new AtomicAssetBundleBuilder(this.versionRepository);
  }

  public async export(request: AtomicAssetExportRequest): Promise<AtomicAssetExportResult> {
    try {
      const assetId = normalizeRequired(request.assetId, "Atomic export asset id");
      const versionId = normalizeRequired(request.versionId, "Atomic export version id");
      const asset = await this.assetRepository.getById(assetId);
      if (!asset) {
        return { ok: false, subjectKind: "atomic-asset", code: "asset-not-found", message: `Asset '${assetId}' was not found.` };
      }

      const version = await this.versionRepository.getByVersionId(versionId);
      if (!version) {
        return { ok: false, subjectKind: "atomic-asset", code: "version-not-found", message: `Version '${versionId}' was not found.` };
      }
      if (version.assetId.value !== asset.id) {
        return { ok: false, subjectKind: "atomic-asset", code: "version-mismatch", message: `Version '${versionId}' does not belong to asset '${asset.id}'.` };
      }

      const built = await this.builder.build({ asset, version, request });
      const serialized = this.serializer.serialize(built);
      if (!serialized.ok) {
        return { ok: false, subjectKind: "atomic-asset", code: "validation-failed", message: "Atomic export failed validation.", details: { issues: serialized.validation.issues } };
      }

      return Object.freeze({
        ok: true,
        subjectKind: "atomic-asset",
        assetId,
        versionId,
        bundleId: built.bundle.bundleId.value,
        artifact: Object.freeze({
          fileName: serialized.artifact.fileName,
          mediaType: serialized.artifact.mediaType,
          byteLength: serialized.artifact.byteLength,
          content: serialized.artifact.content,
          sha256: checksum(serialized.artifact.content),
        }),
      });
    } catch (error) {
      return {
        ok: false,
        subjectKind: "atomic-asset",
        code: "invalid-request",
        message: error instanceof Error ? error.message : "Atomic export request is invalid.",
      };
    }
  }
}

export class CompositeAssetExportService {
  private readonly serializer: ExchangeBundleSerializer;
  private readonly builder: CompositeAssetBundleBuilder;

  public constructor(
    private readonly assetRepository: IAssetRecordRepository,
    private readonly versionRepository: IAssetVersionRepository,
    serializer: ExchangeBundleSerializer = new ExchangeBundleSerializer({ validator: new ExchangeBundleValidator() }),
  ) {
    this.serializer = serializer;
    this.builder = new CompositeAssetBundleBuilder(this.versionRepository);
  }

  public async export(request: CompositeAssetExportRequest): Promise<CompositeAssetExportResult> {
    try {
      const assetId = normalizeRequired(request.assetId, "Composite export asset id");
      const versionId = normalizeRequired(request.versionId, "Composite export version id");
      const asset = await this.assetRepository.getById(assetId);
      if (!asset) {
        return { ok: false, subjectKind: "composite-asset", code: "asset-not-found", message: `Asset '${assetId}' was not found.` };
      }

      const version = await this.versionRepository.getByVersionId(versionId);
      if (!version) {
        return { ok: false, subjectKind: "composite-asset", code: "version-not-found", message: `Version '${versionId}' was not found.` };
      }
      if (version.assetId.value !== asset.id) {
        return { ok: false, subjectKind: "composite-asset", code: "version-mismatch", message: `Version '${versionId}' does not belong to asset '${asset.id}'.` };
      }

      const built = await this.builder.build({ asset, version, request });
      const serialized = this.serializer.serialize(built);
      if (!serialized.ok) {
        return { ok: false, subjectKind: "composite-asset", code: "validation-failed", message: "Composite export failed validation.", details: { issues: serialized.validation.issues } };
      }

      return Object.freeze({
        ok: true,
        subjectKind: "composite-asset",
        assetId,
        versionId,
        bundleId: built.bundle.bundleId.value,
        compositionCount: built.compositionCount,
        artifact: Object.freeze({
          fileName: serialized.artifact.fileName,
          mediaType: serialized.artifact.mediaType,
          byteLength: serialized.artifact.byteLength,
          content: serialized.artifact.content,
          sha256: checksum(serialized.artifact.content),
        }),
      });
    } catch (error) {
      return {
        ok: false,
        subjectKind: "composite-asset",
        code: "invalid-request",
        message: error instanceof Error ? error.message : "Composite export request is invalid.",
      };
    }
  }
}
