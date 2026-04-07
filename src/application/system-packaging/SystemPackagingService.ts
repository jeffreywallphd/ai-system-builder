import { createHash } from "node:crypto";
import type { AssetVersion } from "@domain/assets/AssetVersion";
import {
  createSystemPackage,
  type PackagedDependencyEdge,
  type PackagedDependencyNode,
  type SystemPackage,
} from "@domain/system-packaging/SystemPackagingDomain";
import {
  createSystemAsset,
  createSystemStudioTaxonomy,
  type SystemAsset,
  type SystemCompositionReference,
} from "@domain/system-studio/SystemAssetDomain";
import type { IStudioShellRepository } from "../ports/interfaces/IStudioShellRepository";
import { resolveSystemRuntimeDependencies } from "../system-runtime/RuntimeDependencyResolution";

interface SystemSpecContent {
  readonly components?: ReadonlyArray<SystemAsset["components"][number]>;
  readonly nestedSystems?: ReadonlyArray<SystemAsset["nestedSystems"][number]>;
  readonly inputs?: ReadonlyArray<SystemAsset["inputs"][number]>;
  readonly outputs?: ReadonlyArray<SystemAsset["outputs"][number]>;
  readonly parameters?: ReadonlyArray<SystemAsset["parameters"][number]>;
  readonly bindings?: ReadonlyArray<SystemAsset["bindings"][number]>;
  readonly executionMetadata?: SystemAsset["executionMetadata"];
}

function parseSystemContent(content: string): SystemSpecContent {
  const raw = content.trim();
  if (!raw) {
    return Object.freeze({});
  }

  const parsed = JSON.parse(raw) as { readonly systemSpec?: SystemSpecContent };
  return Object.freeze(parsed.systemSpec ?? {});
}

function readVersionDraftEnvelope(version: AssetVersion): {
  readonly metadata?: { readonly taxonomy?: SystemAsset["taxonomy"]; readonly provenance?: SystemAsset["provenance"] };
  readonly dependencies?: SystemAsset["dependencies"];
  readonly content?: string;
} {
  const payload = version.metadata as {
    readonly metadata?: unknown;
    readonly dependencies?: unknown;
    readonly content?: unknown;
  } | undefined;
  if (!payload) {
    return Object.freeze({});
  }

  return Object.freeze({
    metadata: payload.metadata as { readonly taxonomy?: SystemAsset["taxonomy"]; readonly provenance?: SystemAsset["provenance"] } | undefined,
    dependencies: Array.isArray(payload.dependencies)
      ? payload.dependencies as SystemAsset["dependencies"]
      : undefined,
    content: typeof payload.content === "string" ? payload.content : undefined,
  });
}

function makeSystemNodeId(input: { readonly assetId: string; readonly versionId?: string }): string {
  return `system:${input.assetId}:${input.versionId ?? "latest"}`;
}

function makeDependencyNodeId(input: { readonly assetId: string; readonly versionId?: string }): string {
  return `dependency:${input.assetId}:${input.versionId ?? "unpinned"}`;
}

function snapshotKey(input: { readonly assetId: string; readonly versionId?: string }): string {
  return `${input.assetId}::${input.versionId ?? ""}`;
}

export class SystemPackagingService {
  public constructor(
    private readonly repository: Pick<IStudioShellRepository, "getAssetVersion">,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  public async packageSystemVersion(input: {
    readonly versionId: string;
    readonly packagingVersion?: string;
    readonly maxDepth?: number;
  }): Promise<SystemPackage> {
    const versionId = input.versionId.trim();
    if (!versionId) {
      throw new Error("System packaging requires a version id.");
    }

    const rootVersion = await this.repository.getAssetVersion(versionId);
    if (!rootVersion) {
      throw new Error(`System version '${versionId}' was not found for packaging.`);
    }

    const rootSystem = this.mapVersionToSystemAsset(rootVersion);
    const resolution = await resolveSystemRuntimeDependencies({
      root: rootSystem,
      maxDepth: input.maxDepth,
      resolveSystem: async (reference: SystemCompositionReference) => {
        if (!reference.versionId) {
          return undefined;
        }
        const resolvedVersion = await this.repository.getAssetVersion(reference.versionId);
        if (!resolvedVersion) {
          return undefined;
        }
        return this.mapVersionToSystemAsset(resolvedVersion);
      },
    });

    const rootNodeId = makeSystemNodeId({ assetId: rootSystem.assetId, versionId: rootSystem.versionId });
    const graphNodes = new Map<string, PackagedDependencyNode>();
    const graphEdges = new Map<string, PackagedDependencyEdge>();

    graphNodes.set(rootNodeId, Object.freeze({
      nodeId: rootNodeId,
      assetId: rootSystem.assetId,
      versionId: rootSystem.versionId,
      structuralKind: "system",
      relation: "root",
      discoveredAtDepth: 0,
    }));

    for (const component of resolution.resolvedComponents) {
      const nodeId = `component:${component.runtimeComponentId}`;
      graphNodes.set(nodeId, Object.freeze({
        nodeId,
        assetId: component.assetId,
        versionId: component.versionId,
        structuralKind: component.componentKind,
        relation: "component",
        parentNodeId: component.parentRuntimeComponentId ? `component:${component.parentRuntimeComponentId}` : rootNodeId,
        discoveredAtDepth: component.depth,
      }));

      const fromNodeId = component.parentRuntimeComponentId ? `component:${component.parentRuntimeComponentId}` : rootNodeId;
      const edgeKey = `${fromNodeId}->${nodeId}:contains`;
      graphEdges.set(edgeKey, Object.freeze({ fromNodeId, toNodeId: nodeId, relation: "contains" }));
    }

    for (const dependency of resolution.allDependencies) {
      const nodeId = makeDependencyNodeId({ assetId: dependency.assetId, versionId: dependency.versionId });
      if (!graphNodes.has(nodeId)) {
        graphNodes.set(nodeId, Object.freeze({
          nodeId,
          assetId: dependency.assetId,
          versionId: dependency.versionId,
          structuralKind: "unknown",
          relation: "dependency",
          discoveredAtDepth: dependency.discoveredAtDepth,
        }));
      }

      const fromNodeId = makeSystemNodeId({
        assetId: dependency.discoveredInSystemAssetId,
        versionId: dependency.discoveredInSystemAssetId === rootSystem.assetId ? rootSystem.versionId : undefined,
      });
      if (!graphNodes.has(fromNodeId)) {
        graphNodes.set(fromNodeId, Object.freeze({
          nodeId: fromNodeId,
          assetId: dependency.discoveredInSystemAssetId,
          versionId: dependency.discoveredInSystemAssetId === rootSystem.assetId ? rootSystem.versionId : undefined,
          structuralKind: "system",
          relation: "component",
          discoveredAtDepth: Math.max(0, dependency.discoveredAtDepth - 1),
        }));
      }

      const edgeKey = `${fromNodeId}->${nodeId}:depends-on`;
      graphEdges.set(edgeKey, Object.freeze({ fromNodeId, toNodeId: nodeId, relation: "depends-on" }));
    }

    const dependencySnapshot = Object.freeze([...resolution.allDependencies]
      .sort((left, right) => snapshotKey(left).localeCompare(snapshotKey(right)))
      .map((entry) => Object.freeze({
        assetId: entry.assetId,
        versionId: entry.versionId,
        relation: entry.relation,
        discoveredInSystemAssetId: entry.discoveredInSystemAssetId,
        discoveredAtDepth: entry.discoveredAtDepth,
      })));

    const determinismPayload = JSON.stringify({
      rootSystemAssetId: rootSystem.assetId,
      rootSystemVersionId: rootSystem.versionId,
      dependencies: dependencySnapshot.map((entry) => `${entry.assetId}:${entry.versionId ?? ""}:${entry.relation}:${entry.discoveredAtDepth}`),
      componentOrder: resolution.resolvedComponents.map((entry) => `${entry.runtimeComponentId}:${entry.assetId}:${entry.versionId ?? ""}`),
      recursion: resolution.recursion,
    });

    const determinismKey = createHash("sha256").update(determinismPayload).digest("hex");
    const packageId = `system-package:${rootSystem.versionId}:${input.packagingVersion?.trim() || "v1"}:${determinismKey.slice(0, 16)}`;

    return createSystemPackage({
      packageId,
      manifest: {
        rootSystemAssetId: rootSystem.assetId,
        rootSystemVersionId: rootSystem.versionId ?? rootVersion.versionId,
        dependencyGraph: {
          nodes: Object.freeze([...graphNodes.values()].sort((left, right) => left.nodeId.localeCompare(right.nodeId))),
          edges: Object.freeze([...graphEdges.values()].sort((left, right) => `${left.fromNodeId}->${left.toNodeId}`.localeCompare(`${right.fromNodeId}->${right.toNodeId}`))),
        },
        dependencyVersionSnapshot: dependencySnapshot,
        requirements: {
          runtimeEnvironment: rootSystem.executionMetadata?.runtime?.environment,
          runtimeRequirements: rootSystem.executionMetadata?.runtime?.requirements ?? [],
          exportTargets: rootSystem.executionMetadata?.publish?.exportTargets ?? [],
          requiresNestedSystemSupport: resolution.resolvedComponents.some((entry) => entry.componentKind === "system"),
          maxDependencyDepth: Math.max(0, ...resolution.allDependencies.map((entry) => entry.discoveredAtDepth)),
        },
        lineage: {
          parentVersionId: rootVersion.parentVersionId,
          upstreamVersionIds: rootVersion.upstreamVersionIds,
        },
        recursion: resolution.recursion,
        packagingMetadata: {
          packagingVersion: input.packagingVersion?.trim() || "v1",
          packagedAt: this.clock().toISOString(),
          determinismKey,
        },
      },
    });
  }

  private mapVersionToSystemAsset(version: AssetVersion): SystemAsset {
    const envelope = readVersionDraftEnvelope(version);
    return createSystemAsset({
      assetId: version.assetId.value,
      versionId: version.versionId,
      taxonomy: envelope.metadata?.taxonomy ?? createSystemStudioTaxonomy(),
      provenance: envelope.metadata?.provenance,
      dependencies: envelope.dependencies,
      ...parseSystemContent(envelope.content ?? ""),
    });
  }
}

