import { createHash } from "node:crypto";
import { Asset } from "../../domain/assets/Asset";
import { AssetAuditInfo, AssetLocation, AssetSemanticMetadata, AssetSourceInfo, AssetTechnicalMetadata } from "../../domain/assets/AssetMetadata";
import type { IAsset } from "../../domain/assets/interfaces/IAsset";
import type { AssetVersion } from "../../domain/assets/AssetVersion";
import { AssetVersion as CanonicalAssetVersion } from "../../domain/assets/AssetVersion";
import {
  createAtomicAssetPackageManifest,
  createCompositeAssetPackageManifest,
  type AssetPackageManifest,
  type AssetPackageDependencyReference,
} from "../../domain/exchange/AssetPackageManifest";
import { BundleDependencySnapshotBuilder } from "../../domain/exchange/BundleDependencySnapshot";
import {
  ExchangeBundleReferenceRelations,
  ExchangeBundleSubjectKinds,
  createExchangeBundle,
  type ExchangeBundleProvenance,
} from "../../domain/exchange/ExchangeBundleDomain";
import { ExchangeFormatCompatibilities } from "../../domain/exchange/ExchangeFormatVersioning";
import { ExchangeBundleDeserializer, ExchangeBundleSerializer } from "../../domain/exchange/ExchangeBundleSerialization";
import { ExchangeBundleValidator } from "../../domain/exchange/ExchangeBundleValidation";
import { createSystemPackageManifest } from "../../domain/exchange/SystemPackageManifest";
import { createSystemAsset, type SystemAsset, type SystemCompositionNode, type SystemCompositionReference } from "../../domain/system-studio/SystemAssetDomain";
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

export interface SystemAssetExportRequest {
  readonly assetId: string;
  readonly versionId: string;
  readonly bundleFormatVersion?: string;
  readonly exportedAt?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly maxDepth?: number;
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

export type SystemAssetExportResult = {
  readonly ok: true;
  readonly subjectKind: "system-asset";
  readonly assetId: string;
  readonly versionId: string;
  readonly bundleId: string;
  readonly artifact: AssetExportArtifact;
  readonly nodeCount: number;
  readonly compositionCount: number;
} | {
  readonly ok: false;
  readonly subjectKind: "system-asset";
  readonly code: "invalid-request" | "asset-not-found" | "version-not-found" | "version-mismatch" | "validation-failed";
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
};

export interface AtomicAssetImportRequest {
  readonly artifactContent: string;
}

export interface ImportedAtomicAssetRecord {
  readonly assetId: string;
  readonly versionId: string;
  readonly bundleId: string;
  readonly sourceBundleId?: string;
  readonly sourceVersionLineage: ReadonlyArray<string>;
  readonly importedAt: string;
  readonly existingAsset: boolean;
  readonly existingVersion: boolean;
}

export type AtomicAssetImportResult = {
  readonly ok: true;
  readonly subjectKind: "atomic-asset";
  readonly imported: ImportedAtomicAssetRecord;
  readonly dependencyCount: number;
} | {
  readonly ok: false;
  readonly subjectKind: "atomic-asset";
  readonly code:
    | "invalid-request"
    | "deserialization-failed"
    | "unsupported-format-version"
    | "validation-failed"
    | "unsupported-subject-kind"
    | "conflict";
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

function toSystemEnvelope(version: AssetVersion): {
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
  readonly dependencies?: SystemAsset["dependencies"];
  readonly content?: string;
} {
  const payload = version.metadata as {
    readonly metadata?: unknown;
    readonly dependencies?: unknown;
    readonly content?: unknown;
  } | undefined;
  if (!payload) {
    return {};
  }

  return Object.freeze({
    metadata: payload.metadata as {
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
    } | undefined,
    dependencies: Array.isArray(payload.dependencies) ? payload.dependencies as SystemAsset["dependencies"] : undefined,
    content: typeof payload.content === "string" ? payload.content : undefined,
  });
}

function parseSystemContent(content?: string): {
  readonly components?: SystemAsset["components"];
  readonly nestedSystems?: SystemAsset["nestedSystems"];
  readonly inputs?: SystemAsset["inputs"];
  readonly outputs?: SystemAsset["outputs"];
  readonly parameters?: SystemAsset["parameters"];
  readonly bindings?: SystemAsset["bindings"];
  readonly executionMetadata?: SystemAsset["executionMetadata"];
} {
  const raw = content?.trim();
  if (!raw) {
    return {};
  }

  const parsed = JSON.parse(raw) as {
    readonly systemSpec?: {
      readonly components?: SystemAsset["components"];
      readonly nestedSystems?: SystemAsset["nestedSystems"];
      readonly inputs?: SystemAsset["inputs"];
      readonly outputs?: SystemAsset["outputs"];
      readonly parameters?: SystemAsset["parameters"];
      readonly bindings?: SystemAsset["bindings"];
      readonly executionMetadata?: SystemAsset["executionMetadata"];
    };
  };
  return parsed.systemSpec ?? {};
}

function systemReferenceKey(reference: { readonly assetId: string; readonly versionId?: string }): string {
  return `${reference.assetId}::${reference.versionId ?? ""}`;
}

function manifestNodeKindToSubjectKind(kind: "atomic" | "composite" | "system"): "atomic-asset" | "composite-asset" | "system-asset" {
  if (kind === "atomic") {
    return "atomic-asset";
  }
  if (kind === "composite") {
    return "composite-asset";
  }
  return "system-asset";
}

function inferAtomicAssetKind(manifest: AssetPackageManifest): IAsset["kind"] {
  const taxonomy = manifest.subject.taxonomy;
  if (taxonomy.semanticRole === "dataset") {
    return "dataset";
  }
  if (taxonomy.semanticRole === "workflow") {
    return "workflow-definition";
  }
  if (taxonomy.semanticRole === "model") {
    return "json";
  }
  return "generic";
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

export class SystemAssetBundleBuilder {
  public constructor(
    private readonly versionRepository: IAssetVersionRepository,
    private readonly taxonomyClassifier: CompositionTaxonomyClassifier = new CompositionTaxonomyClassifier(),
  ) {}

  public async build(input: {
    readonly asset: IAsset;
    readonly version: AssetVersion;
    readonly request: SystemAssetExportRequest;
  }): Promise<{
    readonly bundle: ReturnType<typeof createExchangeBundle>;
    readonly manifest: ReturnType<typeof createSystemPackageManifest>;
    readonly dependencySnapshot: ReturnType<typeof BundleDependencySnapshotBuilder.fromSystemPackageManifest>;
  }> {
    const rootSystem = this.mapVersionToSystemAsset(input.asset, input.version);
    const compositionRoot = await this.buildSystemCompositionTree({
      root: rootSystem,
      maxDepth: input.request.maxDepth,
    });
    const envelope = toSystemEnvelope(input.version);
    const createdAt = normalizeOptional(input.request.exportedAt) ?? input.version.createdAt.toISOString();
    const deterministicInputKey = `${input.asset.id}@${input.version.versionId}`;

    const manifest = createSystemPackageManifest({
      root: compositionRoot,
      bundleFormatVersion: input.request.bundleFormatVersion,
      metadata: {
        createdAt,
        deterministicInputKey,
        packageLabel: envelope.metadata?.title,
        tags: normalizeTags([...(envelope.metadata?.tags ?? []), ...(input.request.tags ?? [])]),
      },
      provenance: deriveProvenance(input.version),
      rootContract: envelope.metadata?.contract as never,
      maxDepth: input.request.maxDepth,
    });

    const nodeTaxonomy = new Map<string, CompositionTaxonomyDescriptor>();
    for (const node of manifest.nodes) {
      if (node.taxonomy) {
        nodeTaxonomy.set(`${node.assetId}::${node.versionId}`, node.taxonomy);
      }
    }

    const bundle = createExchangeBundle({
      bundleId: createBundleId("composite", input.asset.id, input.version.versionId).replace("exchange:composite:", "exchange:system:"),
      formatVersion: input.request.bundleFormatVersion,
      subject: {
        root: {
          assetId: manifest.subject.assetId,
          versionId: manifest.subject.versionId,
          kind: ExchangeBundleSubjectKinds.systemAsset,
          relation: ExchangeBundleReferenceRelations.root,
          taxonomy: manifest.subject.taxonomy,
        },
        references: manifest.composition.map((reference) => ({
          assetId: reference.childAssetId,
          versionId: reference.childVersionId,
          kind: manifestNodeKindToSubjectKind(reference.childKind),
          relation: reference.edgeKind === "nested-system"
            ? ExchangeBundleReferenceRelations.nestedSystem
            : ExchangeBundleReferenceRelations.component,
          taxonomy: nodeTaxonomy.get(`${reference.childAssetId}::${reference.childVersionId}`),
        })),
      },
      metadata: {
        label: envelope.metadata?.title,
        description: envelope.metadata?.summary,
        createdAt,
        deterministicInputKey,
        tags: normalizeTags([...(envelope.metadata?.tags ?? []), ...(input.request.tags ?? [])]),
      },
      provenance: deriveProvenance(input.version),
    });

    const dependencySnapshot = BundleDependencySnapshotBuilder.fromSystemPackageManifest(manifest);
    return Object.freeze({ bundle, manifest, dependencySnapshot });
  }

  private mapVersionToSystemAsset(asset: IAsset, version: AssetVersion): SystemAsset {
    const envelope = toSystemEnvelope(version);
    const metadata = envelope.metadata;
    const parsed = parseSystemContent(envelope.content);
    return createSystemAsset({
      assetId: asset.id,
      versionId: version.versionId,
      taxonomy: metadata?.taxonomy ?? this.taxonomyClassifier.classifyAsset(asset) ?? { structuralKind: "system", semanticRole: "system", behaviorKind: "none" },
      provenance: metadata?.provenance as never,
      dependencies: envelope.dependencies,
      ...parsed,
    });
  }

  private async buildSystemCompositionTree(input: {
    readonly root: SystemAsset;
    readonly maxDepth?: number;
  }): Promise<SystemCompositionNode> {
    const maxDepth = Math.max(1, input.maxDepth ?? 4);
    const visited = new Set<string>();
    const visit = async (system: SystemAsset, depth: number): Promise<SystemCompositionNode> => {
      if (depth > maxDepth) {
        throw new Error(`System export composition exceeds max depth ${maxDepth}.`);
      }
      const key = systemReferenceKey(system);
      if (visited.has(key)) {
        throw new Error(`System export composition cycle detected at '${system.assetId}'.`);
      }
      visited.add(key);
      const nested = [...new Map((system.nestedSystems ?? [])
        .map((entry) => [systemReferenceKey(entry), entry] as const)).values()]
        .sort((left, right) => `${left.assetId}:${left.versionId ?? ""}`.localeCompare(`${right.assetId}:${right.versionId ?? ""}`));

      const children: SystemCompositionNode[] = [];
      for (const reference of nested) {
        children.push({ system: await this.resolveNestedSystem(reference), children: undefined });
      }
      for (let index = 0; index < children.length; index += 1) {
        children[index] = await visit(children[index].system, depth + 1);
      }
      visited.delete(key);
      return Object.freeze({ system, children: children.length ? Object.freeze(children) : undefined });
    };

    return visit(input.root, 1);
  }

  private async resolveNestedSystem(reference: SystemCompositionReference): Promise<SystemAsset> {
    if (!reference.versionId?.trim()) {
      throw new Error(`Nested system '${reference.assetId}' must include a pinned version id.`);
    }
    const childVersion = await this.versionRepository.getByVersionId(reference.versionId.trim());
    if (!childVersion) {
      throw new Error(`Nested system version '${reference.versionId}' could not be resolved.`);
    }
    const childEnvelope = toSystemEnvelope(childVersion);
    const childParsed = parseSystemContent(childEnvelope.content);
    return createSystemAsset({
      assetId: reference.assetId,
      versionId: childVersion.versionId,
      taxonomy: childEnvelope.metadata?.taxonomy ?? { structuralKind: "system", semanticRole: "system", behaviorKind: "none" },
      provenance: childEnvelope.metadata?.provenance as never,
      dependencies: childEnvelope.dependencies,
      ...childParsed,
    });
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

export class SystemAssetExportService {
  private readonly serializer: ExchangeBundleSerializer;
  private readonly builder: SystemAssetBundleBuilder;

  public constructor(
    private readonly assetRepository: IAssetRecordRepository,
    private readonly versionRepository: IAssetVersionRepository,
    serializer: ExchangeBundleSerializer = new ExchangeBundleSerializer({ validator: new ExchangeBundleValidator() }),
  ) {
    this.serializer = serializer;
    this.builder = new SystemAssetBundleBuilder(this.versionRepository);
  }

  public async export(request: SystemAssetExportRequest): Promise<SystemAssetExportResult> {
    try {
      const assetId = normalizeRequired(request.assetId, "System export asset id");
      const versionId = normalizeRequired(request.versionId, "System export version id");
      const asset = await this.assetRepository.getById(assetId);
      if (!asset) {
        return { ok: false, subjectKind: "system-asset", code: "asset-not-found", message: `Asset '${assetId}' was not found.` };
      }

      const version = await this.versionRepository.getByVersionId(versionId);
      if (!version) {
        return { ok: false, subjectKind: "system-asset", code: "version-not-found", message: `Version '${versionId}' was not found.` };
      }
      if (version.assetId.value !== asset.id) {
        return { ok: false, subjectKind: "system-asset", code: "version-mismatch", message: `Version '${versionId}' does not belong to asset '${asset.id}'.` };
      }

      const built = await this.builder.build({ asset, version, request });
      const serialized = this.serializer.serialize(built);
      if (!serialized.ok) {
        return { ok: false, subjectKind: "system-asset", code: "validation-failed", message: "System export failed validation.", details: { issues: serialized.validation.issues } };
      }

      return Object.freeze({
        ok: true,
        subjectKind: "system-asset",
        assetId,
        versionId,
        bundleId: built.bundle.bundleId.value,
        nodeCount: built.manifest.nodes.length,
        compositionCount: built.manifest.composition.length,
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
        subjectKind: "system-asset",
        code: "invalid-request",
        message: error instanceof Error ? error.message : "System export request is invalid.",
      };
    }
  }
}

export class AtomicAssetBundleImportResolver {
  public resolve(input: {
    readonly bundle: {
      readonly bundleId: { readonly value: string };
      readonly subject: { readonly root: { readonly kind: string; readonly assetId: string; readonly versionId: string } };
      readonly provenance?: ExchangeBundleProvenance;
    };
    readonly manifest: AssetPackageManifest;
  }): {
    readonly assetId: string;
    readonly versionId: string;
    readonly bundleId: string;
    readonly sourceBundleId?: string;
    readonly sourceVersionLineage: ReadonlyArray<string>;
  } {
    if (input.bundle.subject.root.kind !== ExchangeBundleSubjectKinds.atomicAsset || input.manifest.type !== "atomic") {
      throw new Error("Atomic import requires an atomic bundle root and atomic package manifest.");
    }

    return Object.freeze({
      assetId: input.manifest.subject.assetId,
      versionId: input.manifest.subject.versionId,
      bundleId: input.bundle.bundleId.value,
      sourceBundleId: input.bundle.provenance?.sourceBundleId,
      sourceVersionLineage: Object.freeze([...(input.bundle.provenance?.sourceVersionLineage ?? [])]),
    });
  }
}

export class AtomicAssetImportService {
  private readonly deserializer: ExchangeBundleDeserializer;
  private readonly resolver: AtomicAssetBundleImportResolver;

  public constructor(
    private readonly assetRepository: IAssetRecordRepository,
    private readonly versionRepository: IAssetVersionRepository,
    deserializer: ExchangeBundleDeserializer = new ExchangeBundleDeserializer({ validator: new ExchangeBundleValidator() }),
    resolver: AtomicAssetBundleImportResolver = new AtomicAssetBundleImportResolver(),
    private readonly clock: () => Date = () => new Date(),
  ) {
    this.deserializer = deserializer;
    this.resolver = resolver;
  }

  public async import(request: AtomicAssetImportRequest): Promise<AtomicAssetImportResult> {
    try {
      const content = normalizeRequired(request.artifactContent, "Atomic import artifact content");
      const deserialized = this.deserializer.deserialize({ content });
      if (!deserialized.ok) {
        if (deserialized.formatVersionSupport
          && deserialized.formatVersionSupport.compatibility !== ExchangeFormatCompatibilities.compatible) {
          return {
            ok: false,
            subjectKind: "atomic-asset",
            code: "unsupported-format-version",
            message: deserialized.formatVersionSupport?.reason ?? "Atomic import format version is not supported.",
            details: { compatibility: deserialized.formatVersionSupport?.compatibility, version: deserialized.formatVersionSupport?.version.value },
          };
        }
        if (deserialized.validation) {
          return {
            ok: false,
            subjectKind: "atomic-asset",
            code: "validation-failed",
            message: "Atomic import bundle failed validation.",
            details: { issues: deserialized.validation.issues },
          };
        }
        return {
          ok: false,
          subjectKind: "atomic-asset",
          code: "deserialization-failed",
          message: deserialized.parseFailure?.message ?? "Atomic import artifact could not be deserialized.",
          details: deserialized.parseFailure ? { parseFailure: deserialized.parseFailure } : undefined,
        };
      }

      const { bundle, manifest } = deserialized.deserialized;
      if (manifest.manifestVersion !== "ai-loom.asset-package-manifest.v1" || manifest.type !== "atomic") {
        return {
          ok: false,
          subjectKind: "atomic-asset",
          code: "unsupported-subject-kind",
          message: "Atomic import only supports atomic asset package manifests.",
        };
      }

      const resolved = this.resolver.resolve({ bundle, manifest });
      const existingAsset = await this.assetRepository.getById(resolved.assetId);
      const existingVersion = await this.versionRepository.getByVersionId(resolved.versionId);
      if (existingVersion && existingVersion.assetId.value !== resolved.assetId) {
        return {
          ok: false,
          subjectKind: "atomic-asset",
          code: "conflict",
          message: `Imported version '${resolved.versionId}' belongs to a different asset id.`,
        };
      }

      if (!existingAsset) {
        await this.assetRepository.save(new Asset({
          id: manifest.subject.assetId,
          name: manifest.metadata.packageLabel ?? manifest.subject.assetId,
          kind: inferAtomicAssetKind(manifest),
          status: "available",
          source: new AssetSourceInfo({ type: "imported", provider: "exchange-bundle" }),
          location: new AssetLocation({
            accessMethod: "virtual",
            location: `exchange://${bundle.bundleId.value}/${manifest.subject.assetId}/${manifest.subject.versionId}`,
            contentType: "application/vnd.ai-loom.exchange-bundle+json",
            format: "json",
          }),
          technicalMetadata: new AssetTechnicalMetadata({}),
          semanticMetadata: new AssetSemanticMetadata({
            description: manifest.metadata.packageLabel,
            tags: manifest.metadata.tags,
          }),
          audit: new AssetAuditInfo({ createdAt: this.clock(), updatedAt: this.clock() }),
        }));
      }

      if (!existingVersion) {
        const upstreamVersionIds = [...new Set([
          ...manifest.dependencies.map((entry) => entry.versionId).filter((value): value is string => Boolean(value?.trim())),
          ...resolved.sourceVersionLineage,
        ])].filter((entry) => entry !== resolved.versionId);

        await this.versionRepository.saveVersion(new CanonicalAssetVersion({
          assetId: resolved.assetId,
          versionId: resolved.versionId,
          createdAt: new Date(manifest.metadata.createdAt),
          upstreamVersionIds,
          metadata: {
            metadata: {
              title: manifest.metadata.packageLabel,
              tags: manifest.metadata.tags,
              taxonomy: manifest.subject.taxonomy,
              contract: manifest.contract,
              provenance: {
                sourceType: "imported",
                sourceLabel: "exchange-bundle",
                upstreamAssets: resolved.sourceVersionLineage.map((versionId) => ({ versionId })),
              },
            },
            dependencies: manifest.dependencies,
            exchangeImport: {
              bundleId: resolved.bundleId,
              sourceBundleId: resolved.sourceBundleId,
              importedAt: this.clock().toISOString(),
              dependencySnapshotVersion: deserialized.deserialized.dependencySnapshot.snapshotVersion,
            },
          },
        }));
      }

      return {
        ok: true,
        subjectKind: "atomic-asset",
        dependencyCount: manifest.dependencies.length,
        imported: Object.freeze({
          assetId: resolved.assetId,
          versionId: resolved.versionId,
          bundleId: resolved.bundleId,
          sourceBundleId: resolved.sourceBundleId,
          sourceVersionLineage: resolved.sourceVersionLineage,
          importedAt: this.clock().toISOString(),
          existingAsset: Boolean(existingAsset),
          existingVersion: Boolean(existingVersion),
        }),
      };
    } catch (error) {
      return {
        ok: false,
        subjectKind: "atomic-asset",
        code: "invalid-request",
        message: error instanceof Error ? error.message : "Atomic import request is invalid.",
      };
    }
  }
}
