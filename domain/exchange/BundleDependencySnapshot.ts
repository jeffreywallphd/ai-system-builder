import { AssetId } from "../assets/AssetId";
import {
  aggregateSystemDependencies,
  type SystemAsset,
  type SystemCompositionReference,
} from "../system-studio/SystemAssetDomain";
import type { AssetPackageManifest, AssetPackageDependencyReference } from "./AssetPackageManifest";
import type { SystemPackageManifest } from "./SystemPackageManifest";
import { ExchangeBundleFormatVersion, type ExchangeBundleSubjectKind } from "./ExchangeBundleDomain";

export const BundleDependencyEntryKinds = Object.freeze({
  direct: "direct",
  transitive: "transitive",
});

export type BundleDependencyEntryKind = typeof BundleDependencyEntryKinds[keyof typeof BundleDependencyEntryKinds];

export const BundleDependencyInclusionModes = Object.freeze({
  embedded: "embedded",
  referenced: "referenced",
  external: "external",
});

export type BundleDependencyInclusionMode = typeof BundleDependencyInclusionModes[keyof typeof BundleDependencyInclusionModes];

export interface PinnedBundleDependencyReference {
  readonly assetId: string;
  readonly versionId: string;
}

export interface BundleDependencyEntry {
  readonly dependency: PinnedBundleDependencyReference;
  readonly kind: BundleDependencyEntryKind;
  readonly dependencyRole?: string;
  readonly inclusionMode: BundleDependencyInclusionMode;
  readonly requiredBy: ReadonlyArray<PinnedBundleDependencyReference>;
  readonly capabilityHints: ReadonlyArray<string>;
  readonly configurationHints?: Readonly<Record<string, unknown>>;
  readonly provenance?: Readonly<{
    readonly derivation: "declared" | "resolved";
    readonly source?: string;
  }>;
}

export interface BundleDependencySnapshot {
  readonly snapshotVersion: "ai-loom.bundle-dependency-snapshot.v1";
  readonly bundleFormatVersion: string;
  readonly rootSubject: {
    readonly kind: ExchangeBundleSubjectKind;
    readonly assetId: string;
    readonly versionId: string;
  };
  readonly entries: ReadonlyArray<BundleDependencyEntry>;
  readonly scope: {
    readonly excludesRuntimeResolutionState: true;
    readonly excludesDeploymentResolutionState: true;
  };
}

interface InternalDependencyEntry {
  readonly dependency: PinnedBundleDependencyReference;
  readonly kind: BundleDependencyEntryKind;
  readonly dependencyRole?: string;
  readonly inclusionMode: BundleDependencyInclusionMode;
  readonly requiredBy: ReadonlyArray<PinnedBundleDependencyReference>;
  readonly capabilityHints?: ReadonlyArray<string>;
  readonly configurationHints?: Readonly<Record<string, unknown>>;
  readonly provenance?: Readonly<{
    readonly derivation: "declared" | "resolved";
    readonly source?: string;
  }>;
}

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

function normalizePinnedReference(input: PinnedBundleDependencyReference, label: string): PinnedBundleDependencyReference {
  return Object.freeze({
    assetId: AssetId.from(input.assetId).value,
    versionId: normalizeRequired(input.versionId, `${label} version id`),
  });
}

function normalizeDependencyEntry(entry: InternalDependencyEntry): BundleDependencyEntry {
  return Object.freeze({
    dependency: normalizePinnedReference(entry.dependency, "Bundle dependency"),
    kind: entry.kind,
    dependencyRole: normalizeOptional(entry.dependencyRole),
    inclusionMode: entry.inclusionMode,
    requiredBy: Object.freeze((entry.requiredBy ?? []).map((reference) => normalizePinnedReference(reference, "Bundle dependency required-by")).sort((left, right) =>
      `${left.assetId}:${left.versionId}`.localeCompare(`${right.assetId}:${right.versionId}`))),
    capabilityHints: normalizeStringArray(entry.capabilityHints),
    configurationHints: normalizeRecord(entry.configurationHints),
    provenance: entry.provenance
      ? Object.freeze({ derivation: entry.provenance.derivation, source: normalizeOptional(entry.provenance.source) })
      : undefined,
  });
}

function mergeKinds(existing: BundleDependencyEntryKind, incoming: BundleDependencyEntryKind): BundleDependencyEntryKind {
  if (existing === BundleDependencyEntryKinds.direct || incoming === BundleDependencyEntryKinds.direct) {
    return BundleDependencyEntryKinds.direct;
  }
  return BundleDependencyEntryKinds.transitive;
}

export function createBundleDependencySnapshot(input: {
  readonly rootSubject: {
    readonly kind: ExchangeBundleSubjectKind;
    readonly assetId: string;
    readonly versionId: string;
  };
  readonly entries: ReadonlyArray<InternalDependencyEntry>;
  readonly bundleFormatVersion?: string;
}): BundleDependencySnapshot {
  const rootSubject = Object.freeze({
    kind: input.rootSubject.kind,
    assetId: AssetId.from(input.rootSubject.assetId).value,
    versionId: normalizeRequired(input.rootSubject.versionId, "Bundle dependency snapshot root version id"),
  });

  const deduped = new Map<string, BundleDependencyEntry>();
  for (const rawEntry of input.entries) {
    const entry = normalizeDependencyEntry(rawEntry);
    const key = `${entry.dependency.assetId}::${entry.dependency.versionId}`;
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, entry);
      continue;
    }

    deduped.set(key, Object.freeze({
      ...existing,
      kind: mergeKinds(existing.kind, entry.kind),
      dependencyRole: normalizeOptional(existing.dependencyRole) ?? normalizeOptional(entry.dependencyRole),
      inclusionMode: existing.inclusionMode === BundleDependencyInclusionModes.embedded
        ? existing.inclusionMode
        : entry.inclusionMode,
      requiredBy: Object.freeze([...existing.requiredBy, ...entry.requiredBy].sort((left, right) =>
        `${left.assetId}:${left.versionId}`.localeCompare(`${right.assetId}:${right.versionId}`))),
      capabilityHints: normalizeStringArray([...existing.capabilityHints, ...entry.capabilityHints]),
      configurationHints: existing.configurationHints ?? entry.configurationHints,
      provenance: existing.provenance ?? entry.provenance,
    }));
  }

  return Object.freeze({
    snapshotVersion: "ai-loom.bundle-dependency-snapshot.v1",
    bundleFormatVersion: ExchangeBundleFormatVersion.from(input.bundleFormatVersion).value,
    rootSubject,
    entries: Object.freeze([...deduped.values()].sort((left, right) =>
      `${left.kind}:${left.dependency.assetId}:${left.dependency.versionId}:${left.dependencyRole ?? ""}`
        .localeCompare(`${right.kind}:${right.dependency.assetId}:${right.dependency.versionId}:${right.dependencyRole ?? ""}`))),
    scope: Object.freeze({
      excludesRuntimeResolutionState: true,
      excludesDeploymentResolutionState: true,
    }),
  });
}

function toPinnedReference(reference: { readonly assetId: string; readonly versionId?: string }, label: string): PinnedBundleDependencyReference {
  return Object.freeze({
    assetId: AssetId.from(reference.assetId).value,
    versionId: normalizeRequired(reference.versionId ?? "", `${label} version id`),
  });
}

function manifestDependencyToEntry(
  dependency: AssetPackageDependencyReference,
  requiredBy: PinnedBundleDependencyReference,
): InternalDependencyEntry {
  const pinned = toPinnedReference(dependency, `Asset package dependency '${dependency.assetId}'`);
  return Object.freeze({
    dependency: pinned,
    kind: BundleDependencyEntryKinds.direct,
    dependencyRole: dependency.relation,
    inclusionMode: BundleDependencyInclusionModes.referenced,
    requiredBy: Object.freeze([requiredBy]),
    capabilityHints: dependency.capabilityHints,
    configurationHints: dependency.configurationHints,
    provenance: Object.freeze({ derivation: "declared", source: "asset-package-manifest" }),
  });
}

export class BundleDependencySnapshotBuilder {
  public static fromAssetPackageManifest(manifest: AssetPackageManifest): BundleDependencySnapshot {
    const root = toPinnedReference({ assetId: manifest.subject.assetId, versionId: manifest.subject.versionId }, "Asset package subject");
    return createBundleDependencySnapshot({
      rootSubject: {
        kind: manifest.subject.kind,
        assetId: root.assetId,
        versionId: root.versionId,
      },
      entries: manifest.dependencies.map((dependency) => manifestDependencyToEntry(dependency, root)),
      bundleFormatVersion: manifest.bundleFormatVersion,
    });
  }

  public static fromSystemPackageManifest(manifest: SystemPackageManifest): BundleDependencySnapshot {
    const root = toPinnedReference({ assetId: manifest.subject.assetId, versionId: manifest.subject.versionId }, "System package subject");
    return createBundleDependencySnapshot({
      rootSubject: {
        kind: "system-asset",
        assetId: root.assetId,
        versionId: root.versionId,
      },
      entries: manifest.composition.map((reference) => Object.freeze({
        dependency: Object.freeze({ assetId: reference.childAssetId, versionId: reference.childVersionId }),
        kind: BundleDependencyEntryKinds.direct,
        dependencyRole: `${reference.edgeKind}:${reference.childKind}`,
        inclusionMode: BundleDependencyInclusionModes.referenced,
        requiredBy: Object.freeze([
          Object.freeze({ assetId: reference.parentAssetId, versionId: reference.parentVersionId }),
        ]),
        provenance: Object.freeze({ derivation: "declared", source: "system-package-manifest" }),
      })),
      bundleFormatVersion: manifest.bundleFormatVersion,
    });
  }

  public static async fromSystemAssetGraph(input: {
    readonly root: SystemAsset;
    readonly resolveSystem: (reference: SystemCompositionReference) => Promise<SystemAsset | undefined> | SystemAsset | undefined;
    readonly maxDepth?: number;
    readonly bundleFormatVersion?: string;
  }): Promise<BundleDependencySnapshot> {
    const root = toPinnedReference({ assetId: input.root.assetId, versionId: input.root.versionId }, "System root");
    const aggregate = await aggregateSystemDependencies({
      root: input.root,
      resolveSystem: input.resolveSystem,
      maxDepth: input.maxDepth,
    });

    return createBundleDependencySnapshot({
      rootSubject: {
        kind: "system-asset",
        assetId: root.assetId,
        versionId: root.versionId,
      },
      entries: [
        ...aggregate.directDependencies.map((dependency) => Object.freeze({
          dependency: toPinnedReference(dependency, `System direct dependency '${dependency.assetId}'`),
          kind: BundleDependencyEntryKinds.direct,
          inclusionMode: BundleDependencyInclusionModes.referenced,
          requiredBy: Object.freeze([root]),
          provenance: Object.freeze({ derivation: "resolved", source: "system-domain-aggregate-direct" }),
        })),
        ...aggregate.transitiveDependencies.map((dependency) => Object.freeze({
          dependency: toPinnedReference(dependency, `System transitive dependency '${dependency.assetId}'`),
          kind: BundleDependencyEntryKinds.transitive,
          inclusionMode: BundleDependencyInclusionModes.referenced,
          requiredBy: Object.freeze([root]),
          provenance: Object.freeze({ derivation: "resolved", source: "system-domain-aggregate-transitive" }),
        })),
      ],
      bundleFormatVersion: input.bundleFormatVersion,
    });
  }

  public static async fromDependencyGraph(input: {
    readonly rootSubject: {
      readonly kind: ExchangeBundleSubjectKind;
      readonly assetId: string;
      readonly versionId: string;
    };
    readonly resolveDirectDependencies: (reference: PinnedBundleDependencyReference) =>
      Promise<ReadonlyArray<{ readonly dependency: PinnedBundleDependencyReference; readonly role?: string; readonly inclusionMode?: BundleDependencyInclusionMode }>>
      | ReadonlyArray<{ readonly dependency: PinnedBundleDependencyReference; readonly role?: string; readonly inclusionMode?: BundleDependencyInclusionMode }>;
    readonly maxDepth?: number;
    readonly bundleFormatVersion?: string;
  }): Promise<BundleDependencySnapshot> {
    const root = normalizePinnedReference({ assetId: input.rootSubject.assetId, versionId: input.rootSubject.versionId }, "Dependency graph root");
    const maxDepth = Math.max(1, input.maxDepth ?? 4);

    const queue: Array<{ readonly reference: PinnedBundleDependencyReference; readonly depth: number; readonly requiredBy: PinnedBundleDependencyReference }> = [{
      reference: root,
      depth: 0,
      requiredBy: root,
    }];
    const visited = new Set<string>();
    const entries: InternalDependencyEntry[] = [];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        break;
      }

      const visitKey = `${current.reference.assetId}::${current.reference.versionId}::${current.depth}`;
      if (visited.has(visitKey)) {
        continue;
      }
      visited.add(visitKey);

      if (current.depth >= maxDepth) {
        continue;
      }

      const dependencies = await input.resolveDirectDependencies(current.reference);
      const kind = current.depth === 0 ? BundleDependencyEntryKinds.direct : BundleDependencyEntryKinds.transitive;
      for (const dependency of dependencies) {
        const normalized = normalizePinnedReference(dependency.dependency, "Dependency graph entry");
        entries.push(Object.freeze({
          dependency: normalized,
          kind,
          dependencyRole: normalizeOptional(dependency.role),
          inclusionMode: dependency.inclusionMode ?? BundleDependencyInclusionModes.referenced,
          requiredBy: Object.freeze([current.requiredBy]),
          provenance: Object.freeze({ derivation: "resolved", source: "dependency-graph" }),
        }));
        queue.push({
          reference: normalized,
          depth: current.depth + 1,
          requiredBy: current.reference,
        });
      }
    }

    return createBundleDependencySnapshot({
      rootSubject: {
        ...input.rootSubject,
        assetId: root.assetId,
        versionId: root.versionId,
      },
      entries,
      bundleFormatVersion: input.bundleFormatVersion,
    });
  }
}
