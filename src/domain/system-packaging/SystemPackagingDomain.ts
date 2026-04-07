import { AssetId } from "../assets/AssetId";

export class SystemPackageId {
  public readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  public static from(value: string): SystemPackageId {
    const normalized = value.trim();
    if (!normalized) {
      throw new Error("SystemPackageId cannot be empty.");
    }
    return new SystemPackageId(normalized);
  }
}

export interface PackagedDependencyNode {
  readonly nodeId: string;
  readonly assetId: string;
  readonly versionId?: string;
  readonly structuralKind: "atomic" | "composite" | "system" | "unknown";
  readonly relation: "root" | "component" | "dependency";
  readonly parentNodeId?: string;
  readonly discoveredAtDepth: number;
}

export interface PackagedDependencyEdge {
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly relation: "contains" | "depends-on";
}

export interface PackagedDependencyGraph {
  readonly nodes: ReadonlyArray<PackagedDependencyNode>;
  readonly edges: ReadonlyArray<PackagedDependencyEdge>;
}

export interface SystemPackageRequirements {
  readonly runtimeEnvironment?: string;
  readonly runtimeRequirements: ReadonlyArray<string>;
  readonly exportTargets: ReadonlyArray<string>;
  readonly requiresNestedSystemSupport: boolean;
  readonly maxDependencyDepth: number;
}

export interface SystemPackageManifest {
  readonly rootSystemAssetId: string;
  readonly rootSystemVersionId: string;
  readonly dependencyGraph: PackagedDependencyGraph;
  readonly dependencyVersionSnapshot: ReadonlyArray<{
    readonly assetId: string;
    readonly versionId?: string;
    readonly relation: "direct" | "transitive";
    readonly discoveredInSystemAssetId: string;
    readonly discoveredAtDepth: number;
  }>;
  readonly requirements: SystemPackageRequirements;
  readonly lineage: {
    readonly parentVersionId?: string;
    readonly upstreamVersionIds: ReadonlyArray<string>;
  };
  readonly recursion: {
    readonly status: "complete" | "cycle-detected" | "max-depth-exceeded";
    readonly unresolvedNestedSystemCount: number;
    readonly maxDepth: number;
  };
  readonly packagingMetadata: {
    readonly packagingVersion: string;
    readonly packagedAt: string;
    readonly determinismKey: string;
  };
}

export interface SystemPackage {
  readonly packageId: SystemPackageId;
  readonly manifest: SystemPackageManifest;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeStringList(values?: ReadonlyArray<string>): ReadonlyArray<string> {
  return Object.freeze([...new Set((values ?? []).map((entry) => entry.trim()).filter(Boolean))]);
}

export function createSystemPackageManifest(input: SystemPackageManifest): SystemPackageManifest {
  const rootSystemAssetId = AssetId.from(input.rootSystemAssetId).value;
  const rootSystemVersionId = input.rootSystemVersionId.trim();
  if (!rootSystemVersionId) {
    throw new Error("SystemPackageManifest.rootSystemVersionId is required.");
  }

  const packagingVersion = input.packagingMetadata.packagingVersion.trim();
  if (!packagingVersion) {
    throw new Error("SystemPackageManifest.packagingMetadata.packagingVersion is required.");
  }

  const packagedAt = input.packagingMetadata.packagedAt.trim();
  if (!packagedAt) {
    throw new Error("SystemPackageManifest.packagingMetadata.packagedAt is required.");
  }

  return Object.freeze({
    rootSystemAssetId,
    rootSystemVersionId,
    dependencyGraph: Object.freeze({
      nodes: Object.freeze((input.dependencyGraph.nodes ?? []).map((node) => Object.freeze({
        nodeId: node.nodeId.trim(),
        assetId: AssetId.from(node.assetId).value,
        versionId: normalizeOptional(node.versionId),
        structuralKind: node.structuralKind,
        relation: node.relation,
        parentNodeId: normalizeOptional(node.parentNodeId),
        discoveredAtDepth: Math.max(0, Math.floor(node.discoveredAtDepth)),
      }))),
      edges: Object.freeze((input.dependencyGraph.edges ?? []).map((edge) => Object.freeze({
        fromNodeId: edge.fromNodeId.trim(),
        toNodeId: edge.toNodeId.trim(),
        relation: edge.relation,
      }))),
    }),
    dependencyVersionSnapshot: Object.freeze((input.dependencyVersionSnapshot ?? []).map((entry) => Object.freeze({
      assetId: AssetId.from(entry.assetId).value,
      versionId: normalizeOptional(entry.versionId),
      relation: entry.relation,
      discoveredInSystemAssetId: AssetId.from(entry.discoveredInSystemAssetId).value,
      discoveredAtDepth: Math.max(0, Math.floor(entry.discoveredAtDepth)),
    }))),
    requirements: Object.freeze({
      runtimeEnvironment: normalizeOptional(input.requirements.runtimeEnvironment),
      runtimeRequirements: normalizeStringList(input.requirements.runtimeRequirements),
      exportTargets: normalizeStringList(input.requirements.exportTargets),
      requiresNestedSystemSupport: input.requirements.requiresNestedSystemSupport,
      maxDependencyDepth: Math.max(0, Math.floor(input.requirements.maxDependencyDepth)),
    }),
    lineage: Object.freeze({
      parentVersionId: normalizeOptional(input.lineage.parentVersionId),
      upstreamVersionIds: normalizeStringList(input.lineage.upstreamVersionIds),
    }),
    recursion: Object.freeze({
      status: input.recursion.status,
      unresolvedNestedSystemCount: Math.max(0, Math.floor(input.recursion.unresolvedNestedSystemCount)),
      maxDepth: Math.max(1, Math.floor(input.recursion.maxDepth)),
    }),
    packagingMetadata: Object.freeze({
      packagingVersion,
      packagedAt,
      determinismKey: input.packagingMetadata.determinismKey.trim(),
    }),
  });
}

export function createSystemPackage(input: {
  readonly packageId: string;
  readonly manifest: SystemPackageManifest;
}): SystemPackage {
  return Object.freeze({
    packageId: SystemPackageId.from(input.packageId),
    manifest: createSystemPackageManifest(input.manifest),
  });
}
