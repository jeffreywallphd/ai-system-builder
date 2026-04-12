import type { AssetContractDescriptor } from "../contracts/AssetContract";
import { createAssetContractDescriptor } from "../contracts/AssetContract";
import { AssetId } from "../assets/AssetId";
import type { CompositionTaxonomyDescriptor } from "../taxonomy/CompositionTaxonomy";
import {
  assertAllowedCompositionTaxonomyCombination,
  createCompositionTaxonomyDescriptor,
} from "../taxonomy/CompositionTaxonomy";
import {
  ExchangeBundleFormatVersion,
  ExchangeBundleSubjectKinds,
  type ExchangeBundleProvenance,
  type ExchangeBundleSubjectKind,
} from "./ExchangeBundleDomain";

export interface AssetPackageDependencyReference {
  readonly assetId: string;
  readonly versionId?: string;
  readonly relation: "component" | "dependency" | "contract";
  readonly capabilityHints?: ReadonlyArray<string>;
  readonly configurationHints?: Readonly<Record<string, unknown>>;
}

export interface AssetPackageManifestMetadata {
  readonly createdAt: string;
  readonly deterministicInputKey?: string;
  readonly packageLabel?: string;
  readonly tags: ReadonlyArray<string>;
}

export interface AssetPackageManifestSubject {
  readonly assetId: string;
  readonly versionId: string;
  readonly kind: Extract<ExchangeBundleSubjectKind, "atomic-asset" | "composite-asset">;
  readonly taxonomy: CompositionTaxonomyDescriptor;
}

export interface AtomicAssetPackageManifest {
  readonly type: "atomic";
  readonly subject: AssetPackageManifestSubject & { readonly kind: "atomic-asset" };
  readonly contract?: AssetContractDescriptor;
}

export interface CompositeAssetPackageManifest {
  readonly type: "composite";
  readonly subject: AssetPackageManifestSubject & { readonly kind: "composite-asset" };
  readonly composition: ReadonlyArray<Readonly<{
    readonly alias: string;
    readonly assetId: string;
    readonly versionId?: string;
    readonly taxonomy?: CompositionTaxonomyDescriptor;
  }>>;
  readonly contract?: AssetContractDescriptor;
}

export type AssetPackageManifest = {
  readonly manifestVersion: "ai-loom.asset-package-manifest.v1";
  readonly bundleFormatVersion: string;
  readonly metadata: AssetPackageManifestMetadata;
  readonly provenance?: ExchangeBundleProvenance;
  readonly dependencies: ReadonlyArray<AssetPackageDependencyReference>;
} & (AtomicAssetPackageManifest | CompositeAssetPackageManifest);

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function normalizeStringArray(values?: ReadonlyArray<string>): ReadonlyArray<string> {
  return Object.freeze([...new Set((values ?? []).map((entry) => entry.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)));
}

function normalizeRecord(record?: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> | undefined {
  if (!record) {
    return undefined;
  }
  return Object.freeze(JSON.parse(JSON.stringify(record)) as Record<string, unknown>);
}

function normalizeSubject(input: AssetPackageManifestSubject): AssetPackageManifestSubject {
  const kind = input.kind;
  if (kind !== ExchangeBundleSubjectKinds.atomicAsset && kind !== ExchangeBundleSubjectKinds.compositeAsset) {
    throw new Error(`Asset package manifest subject kind '${kind}' is not supported.`);
  }

  const taxonomy = createCompositionTaxonomyDescriptor(input.taxonomy);
  assertAllowedCompositionTaxonomyCombination(taxonomy, "Asset package manifest taxonomy");

  return Object.freeze({
    assetId: AssetId.from(input.assetId).value,
    versionId: normalizeRequired(input.versionId, "Asset package manifest subject version id"),
    kind,
    taxonomy,
  });
}

function normalizeDependencies(
  dependencies?: ReadonlyArray<AssetPackageDependencyReference>,
): ReadonlyArray<AssetPackageDependencyReference> {
  const deduped = new Map<string, AssetPackageDependencyReference>();
  for (const dependency of dependencies ?? []) {
    const assetId = AssetId.from(dependency.assetId).value;
    const versionId = normalizeOptional(dependency.versionId);
    const dedupeKey = `${assetId}::${versionId ?? ""}::${dependency.relation}`;
    deduped.set(dedupeKey, Object.freeze({
      assetId,
      versionId,
      relation: dependency.relation,
      capabilityHints: normalizeStringArray(dependency.capabilityHints),
      configurationHints: normalizeRecord(dependency.configurationHints),
    }));
  }

  return Object.freeze([...deduped.values()].sort((left, right) =>
    `${left.assetId}:${left.versionId ?? ""}:${left.relation}`.localeCompare(`${right.assetId}:${right.versionId ?? ""}:${right.relation}`),
  ));
}

function normalizeProvenance(input?: ExchangeBundleProvenance): ExchangeBundleProvenance | undefined {
  if (!input) {
    return undefined;
  }

  return Object.freeze({
    originType: input.originType,
    sourceBundleId: normalizeOptional(input.sourceBundleId),
    sourceVersionLineage: normalizeStringArray(input.sourceVersionLineage),
    handoffSessionId: normalizeOptional(input.handoffSessionId),
    metadata: normalizeRecord(input.metadata),
  });
}

function normalizeManifestMetadata(input?: Partial<AssetPackageManifestMetadata>): AssetPackageManifestMetadata {
  return Object.freeze({
    createdAt: normalizeOptional(input?.createdAt) ?? new Date().toISOString(),
    deterministicInputKey: normalizeOptional(input?.deterministicInputKey),
    packageLabel: normalizeOptional(input?.packageLabel),
    tags: normalizeStringArray(input?.tags),
  });
}

export function createAtomicAssetPackageManifest(input: {
  readonly subject: AssetPackageManifestSubject & { readonly kind: "atomic-asset" };
  readonly bundleFormatVersion?: string;
  readonly metadata?: Partial<AssetPackageManifestMetadata>;
  readonly contract?: AssetContractDescriptor;
  readonly provenance?: ExchangeBundleProvenance;
  readonly dependencies?: ReadonlyArray<AssetPackageDependencyReference>;
}): AssetPackageManifest {
  const subject = normalizeSubject(input.subject);
  if (subject.kind !== ExchangeBundleSubjectKinds.atomicAsset) {
    throw new Error("Atomic asset package manifests require subject kind 'atomic-asset'.");
  }

  return Object.freeze({
    manifestVersion: "ai-loom.asset-package-manifest.v1",
    type: "atomic",
    bundleFormatVersion: ExchangeBundleFormatVersion.from(input.bundleFormatVersion).value,
    subject,
    metadata: normalizeManifestMetadata(input.metadata),
    contract: input.contract ? createAssetContractDescriptor(input.contract) : undefined,
    provenance: normalizeProvenance(input.provenance),
    dependencies: normalizeDependencies(input.dependencies),
  });
}

export function createCompositeAssetPackageManifest(input: {
  readonly subject: AssetPackageManifestSubject & { readonly kind: "composite-asset" };
  readonly composition: ReadonlyArray<{
    readonly alias: string;
    readonly assetId: string;
    readonly versionId?: string;
    readonly taxonomy?: CompositionTaxonomyDescriptor;
  }>;
  readonly bundleFormatVersion?: string;
  readonly metadata?: Partial<AssetPackageManifestMetadata>;
  readonly contract?: AssetContractDescriptor;
  readonly provenance?: ExchangeBundleProvenance;
  readonly dependencies?: ReadonlyArray<AssetPackageDependencyReference>;
}): AssetPackageManifest {
  const subject = normalizeSubject(input.subject);
  if (subject.kind !== ExchangeBundleSubjectKinds.compositeAsset) {
    throw new Error("Composite asset package manifests require subject kind 'composite-asset'.");
  }

  const composition = Object.freeze((input.composition ?? [])
    .map((entry) => Object.freeze({
      alias: normalizeRequired(entry.alias, "Composite manifest composition alias"),
      assetId: AssetId.from(entry.assetId).value,
      versionId: normalizeOptional(entry.versionId),
      taxonomy: entry.taxonomy ? createCompositionTaxonomyDescriptor(entry.taxonomy) : undefined,
    }))
    .sort((left, right) => `${left.alias}:${left.assetId}:${left.versionId ?? ""}`.localeCompare(`${right.alias}:${right.assetId}:${right.versionId ?? ""}`)));

  return Object.freeze({
    manifestVersion: "ai-loom.asset-package-manifest.v1",
    type: "composite",
    bundleFormatVersion: ExchangeBundleFormatVersion.from(input.bundleFormatVersion).value,
    subject,
    composition,
    metadata: normalizeManifestMetadata(input.metadata),
    contract: input.contract ? createAssetContractDescriptor(input.contract) : undefined,
    provenance: normalizeProvenance(input.provenance),
    dependencies: normalizeDependencies(input.dependencies),
  });
}
