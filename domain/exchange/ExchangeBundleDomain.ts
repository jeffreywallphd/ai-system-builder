import { AssetId } from "../assets/AssetId";
import type { CompositionTaxonomyDescriptor } from "../taxonomy/CompositionTaxonomy";
import { createCompositionTaxonomyDescriptor } from "../taxonomy/CompositionTaxonomy";

export class ExchangeBundleId {
  public readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  public static from(value: string): ExchangeBundleId {
    const normalized = value.trim();
    if (!normalized) {
      throw new Error("ExchangeBundleId cannot be empty.");
    }
    return new ExchangeBundleId(normalized);
  }
}

export class ExchangeBundleFormatVersion {
  public readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  public static readonly current = "ai-loom.exchange-bundle.v1" as const;

  public static from(value?: string): ExchangeBundleFormatVersion {
    const normalized = (value ?? ExchangeBundleFormatVersion.current).trim();
    if (!normalized) {
      throw new Error("ExchangeBundleFormatVersion cannot be empty.");
    }
    return new ExchangeBundleFormatVersion(normalized);
  }
}

export const ExchangeBundleSubjectKinds = Object.freeze({
  atomicAsset: "atomic-asset",
  compositeAsset: "composite-asset",
  systemAsset: "system-asset",
});

export type ExchangeBundleSubjectKind = typeof ExchangeBundleSubjectKinds[keyof typeof ExchangeBundleSubjectKinds];

export const ExchangeBundleReferenceRelations = Object.freeze({
  root: "root",
  component: "component",
  dependency: "dependency",
  nestedSystem: "nested-system",
});

export type ExchangeBundleReferenceRelation =
  typeof ExchangeBundleReferenceRelations[keyof typeof ExchangeBundleReferenceRelations];

export interface ExchangeBundleSubjectReference {
  readonly assetId: string;
  readonly versionId: string;
  readonly kind: ExchangeBundleSubjectKind;
  readonly relation: ExchangeBundleReferenceRelation;
  readonly taxonomy?: CompositionTaxonomyDescriptor;
}

export interface ExchangeBundleSubject {
  readonly root: ExchangeBundleSubjectReference;
  readonly references: ReadonlyArray<ExchangeBundleSubjectReference>;
}

export interface ExchangeBundleDependencySnapshotReference {
  readonly assetId: string;
  readonly versionId?: string;
  readonly relation: "direct" | "transitive";
  readonly capabilityHints?: ReadonlyArray<string>;
  readonly configurationHints?: Readonly<Record<string, unknown>>;
}

export interface ExchangeBundleMetadata {
  readonly label?: string;
  readonly description?: string;
  readonly tags: ReadonlyArray<string>;
  readonly createdAt: string;
  readonly deterministicInputKey?: string;
}

export interface ExchangeBundleProvenance {
  readonly originType?: "manual" | "import" | "automation" | "handoff";
  readonly sourceBundleId?: string;
  readonly sourceVersionLineage?: ReadonlyArray<string>;
  readonly handoffSessionId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ExchangeBundle {
  readonly bundleId: ExchangeBundleId;
  readonly formatVersion: ExchangeBundleFormatVersion;
  readonly subject: ExchangeBundleSubject;
  readonly metadata: ExchangeBundleMetadata;
  readonly provenance?: ExchangeBundleProvenance;
  readonly dependencySnapshot: ReadonlyArray<ExchangeBundleDependencySnapshotReference>;
  readonly scope: {
    readonly excludesRuntimeState: true;
    readonly excludesDeploymentState: true;
  };
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
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

function normalizeSubjectKind(value: ExchangeBundleSubjectKind): ExchangeBundleSubjectKind {
  if (!Object.values(ExchangeBundleSubjectKinds).includes(value)) {
    throw new Error(`Unsupported exchange bundle subject kind '${value}'.`);
  }
  return value;
}

function normalizeSubjectReference(input: ExchangeBundleSubjectReference): ExchangeBundleSubjectReference {
  return Object.freeze({
    assetId: AssetId.from(input.assetId).value,
    versionId: normalizeRequired(input.versionId, "Exchange bundle subject reference version id"),
    kind: normalizeSubjectKind(input.kind),
    relation: input.relation,
    taxonomy: input.taxonomy ? createCompositionTaxonomyDescriptor(input.taxonomy) : undefined,
  });
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function normalizeDependencySnapshot(
  entries?: ReadonlyArray<ExchangeBundleDependencySnapshotReference>,
): ReadonlyArray<ExchangeBundleDependencySnapshotReference> {
  const deduped = new Map<string, ExchangeBundleDependencySnapshotReference>();
  for (const entry of entries ?? []) {
    const assetId = AssetId.from(entry.assetId).value;
    const versionId = normalizeOptional(entry.versionId);
    const dedupeKey = `${assetId}::${versionId ?? ""}::${entry.relation}`;
    deduped.set(dedupeKey, Object.freeze({
      assetId,
      versionId,
      relation: entry.relation,
      capabilityHints: normalizeStringArray(entry.capabilityHints),
      configurationHints: normalizeRecord(entry.configurationHints),
    }));
  }

  return Object.freeze([...deduped.values()].sort((left, right) =>
    `${left.assetId}:${left.versionId ?? ""}:${left.relation}`.localeCompare(`${right.assetId}:${right.versionId ?? ""}:${right.relation}`),
  ));
}

export function createExchangeBundle(input: {
  readonly bundleId: string;
  readonly formatVersion?: string;
  readonly subject: ExchangeBundleSubject;
  readonly metadata?: Partial<ExchangeBundleMetadata>;
  readonly provenance?: ExchangeBundleProvenance;
  readonly dependencySnapshot?: ReadonlyArray<ExchangeBundleDependencySnapshotReference>;
}): ExchangeBundle {
  const root = normalizeSubjectReference(input.subject.root);
  const additionalReferences = (input.subject.references ?? [])
    .map((entry) => normalizeSubjectReference(entry))
    .filter((entry) => !(entry.relation === ExchangeBundleReferenceRelations.root && entry.assetId === root.assetId && entry.versionId === root.versionId));

  const references = Object.freeze([
    root,
    ...additionalReferences,
  ].sort((left, right) =>
    `${left.relation}:${left.kind}:${left.assetId}:${left.versionId}`.localeCompare(`${right.relation}:${right.kind}:${right.assetId}:${right.versionId}`),
  ));

  const createdAt = normalizeOptional(input.metadata?.createdAt) ?? new Date().toISOString();

  return Object.freeze({
    bundleId: ExchangeBundleId.from(input.bundleId),
    formatVersion: ExchangeBundleFormatVersion.from(input.formatVersion),
    subject: Object.freeze({ root, references }),
    metadata: Object.freeze({
      label: normalizeOptional(input.metadata?.label),
      description: normalizeOptional(input.metadata?.description),
      tags: normalizeStringArray(input.metadata?.tags),
      createdAt,
      deterministicInputKey: normalizeOptional(input.metadata?.deterministicInputKey),
    }),
    provenance: input.provenance
      ? Object.freeze({
        originType: input.provenance.originType,
        sourceBundleId: normalizeOptional(input.provenance.sourceBundleId),
        sourceVersionLineage: normalizeStringArray(input.provenance.sourceVersionLineage),
        handoffSessionId: normalizeOptional(input.provenance.handoffSessionId),
        metadata: normalizeRecord(input.provenance.metadata),
      })
      : undefined,
    dependencySnapshot: normalizeDependencySnapshot(input.dependencySnapshot),
    scope: Object.freeze({
      excludesRuntimeState: true,
      excludesDeploymentState: true,
    }),
  });
}
