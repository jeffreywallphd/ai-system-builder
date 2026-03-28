import {
  buildNestedSystemReferences,
  collectSystemDirectDependencies,
  type SystemAsset,
  type SystemCompositionReference,
} from "../../domain/system-studio/SystemAssetDomain";
import type { AssetDraftDependencyReference } from "../../domain/studio-shell/StudioShellDomain";

export interface ResolvedRuntimeDependency {
  readonly assetId: string;
  readonly versionId?: string;
  readonly relation: "direct" | "transitive";
  readonly discoveredInSystemAssetId: string;
  readonly discoveredAtDepth: number;
}

export interface ResolvedRuntimeComponent {
  readonly runtimeComponentId: string;
  readonly parentRuntimeComponentId?: string;
  readonly parentSystemAssetId: string;
  readonly componentAlias?: string;
  readonly componentKind: SystemAsset["components"][number]["componentKind"];
  readonly assetId: string;
  readonly versionId?: string;
  readonly taxonomy?: SystemAsset["components"][number]["taxonomy"];
  readonly depth: number;
}

export interface RuntimeDependencyResolutionResult {
  readonly rootSystemAssetId: string;
  readonly rootSystemVersionId?: string;
  readonly resolvedComponents: ReadonlyArray<ResolvedRuntimeComponent>;
  readonly directDependencies: ReadonlyArray<ResolvedRuntimeDependency>;
  readonly transitiveDependencies: ReadonlyArray<ResolvedRuntimeDependency>;
  readonly allDependencies: ReadonlyArray<ResolvedRuntimeDependency>;
  readonly dependencyOrderingHints: ReadonlyArray<string>;
  readonly traversedSystemAssetIds: ReadonlyArray<string>;
  readonly recursion: {
    readonly maxDepth: number;
    readonly status: "complete" | "cycle-detected" | "max-depth-exceeded";
    readonly unresolvedNestedSystemCount: number;
  };
}

function makeReferenceKey(reference: { readonly assetId: string; readonly versionId?: string }): string {
  return `${reference.assetId}::${reference.versionId ?? ""}`;
}

function normalizeDependency(input: AssetDraftDependencyReference): AssetDraftDependencyReference {
  return Object.freeze({
    assetId: input.assetId.trim(),
    versionId: input.versionId?.trim() || undefined,
  });
}

export async function resolveSystemRuntimeDependencies(input: {
  readonly root: SystemAsset;
  readonly resolveSystem: (reference: SystemCompositionReference) => Promise<SystemAsset | undefined> | SystemAsset | undefined;
  readonly maxDepth?: number;
}): Promise<RuntimeDependencyResolutionResult> {
  const maxDepth = Math.max(1, input.maxDepth ?? 4);
  const resolvedComponents = new Map<string, ResolvedRuntimeComponent>();
  const directDependencies = new Map<string, ResolvedRuntimeDependency>();
  const transitiveDependencies = new Map<string, ResolvedRuntimeDependency>();
  const traversedSystemAssetIds = new Set<string>();
  let unresolvedNestedSystemCount = 0;
  let recursionStatus: RuntimeDependencyResolutionResult["recursion"]["status"] = "complete";

  const traverse = async (params: {
    readonly system: SystemAsset;
    readonly depth: number;
    readonly pathKeys: ReadonlyArray<string>;
    readonly runtimeParentComponentId?: string;
  }): Promise<void> => {
    const key = makeReferenceKey(params.system);
    if (params.pathKeys.includes(key)) {
      recursionStatus = "cycle-detected";
      return;
    }
    if (params.depth > maxDepth) {
      recursionStatus = "max-depth-exceeded";
      return;
    }

    traversedSystemAssetIds.add(params.system.assetId);
    const nextPath = [...params.pathKeys, key];

    for (const component of params.system.components) {
      const runtimeComponentId = `${params.system.assetId}:${component.alias ?? component.assetId}:${component.versionId ?? ""}`;
      if (!resolvedComponents.has(runtimeComponentId)) {
        resolvedComponents.set(runtimeComponentId, Object.freeze({
          runtimeComponentId,
          parentRuntimeComponentId: params.runtimeParentComponentId,
          parentSystemAssetId: params.system.assetId,
          componentAlias: component.alias,
          componentKind: component.componentKind,
          assetId: component.assetId,
          versionId: component.versionId,
          taxonomy: component.taxonomy,
          depth: params.depth,
        }));
      }
    }

    const relation: ResolvedRuntimeDependency["relation"] = params.depth === 1 ? "direct" : "transitive";
    for (const dependency of collectSystemDirectDependencies(params.system).map(normalizeDependency)) {
      const dependencyKey = makeReferenceKey(dependency);
      const entry = Object.freeze({
        assetId: dependency.assetId,
        versionId: dependency.versionId,
        relation,
        discoveredInSystemAssetId: params.system.assetId,
        discoveredAtDepth: params.depth,
      } satisfies ResolvedRuntimeDependency);

      if (relation === "direct") {
        directDependencies.set(dependencyKey, entry);
        transitiveDependencies.delete(dependencyKey);
      } else if (!directDependencies.has(dependencyKey)) {
        transitiveDependencies.set(dependencyKey, entry);
      }
    }

    const nested = buildNestedSystemReferences(params.system)
      .sort((left, right) => `${left.assetId}:${left.versionId ?? ""}`.localeCompare(`${right.assetId}:${right.versionId ?? ""}`));

    for (const reference of nested) {
      const child = await input.resolveSystem(reference);
      if (!child) {
        unresolvedNestedSystemCount += 1;
        continue;
      }

      const parentComponentId = `${params.system.assetId}:${reference.alias ?? reference.assetId}:${reference.versionId ?? ""}`;
      await traverse({
        system: child,
        depth: params.depth + 1,
        pathKeys: nextPath,
        runtimeParentComponentId: parentComponentId,
      });
    }
  };

  await traverse({
    system: input.root,
    depth: 1,
    pathKeys: [],
  });

  const sortedComponents = Object.freeze([...resolvedComponents.values()].sort((left, right) => (
    `${left.depth}:${left.runtimeComponentId}`.localeCompare(`${right.depth}:${right.runtimeComponentId}`)
  )));
  const sortedDirect = Object.freeze([...directDependencies.values()].sort((left, right) => makeReferenceKey(left).localeCompare(makeReferenceKey(right))));
  const sortedTransitive = Object.freeze([...transitiveDependencies.values()].sort((left, right) => makeReferenceKey(left).localeCompare(makeReferenceKey(right))));
  const allDependencies = Object.freeze([...sortedDirect, ...sortedTransitive]);
  const dependencyOrderingHints = Object.freeze([...allDependencies]
    .sort((left, right) => {
      if (left.discoveredAtDepth !== right.discoveredAtDepth) {
        return left.discoveredAtDepth - right.discoveredAtDepth;
      }
      return makeReferenceKey(left).localeCompare(makeReferenceKey(right));
    })
    .map((entry) => makeReferenceKey(entry)));

  return Object.freeze({
    rootSystemAssetId: input.root.assetId,
    rootSystemVersionId: input.root.versionId,
    resolvedComponents: sortedComponents,
    directDependencies: sortedDirect,
    transitiveDependencies: sortedTransitive,
    allDependencies,
    dependencyOrderingHints,
    traversedSystemAssetIds: Object.freeze([...traversedSystemAssetIds].sort((left, right) => left.localeCompare(right))),
    recursion: Object.freeze({
      maxDepth,
      status: recursionStatus,
      unresolvedNestedSystemCount,
    }),
  });
}
