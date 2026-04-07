import type { RegistryAsset, RegistryDependencyReference } from "@domain/asset-registry/RegistryAsset";
import type {
  RegistryGraphProjectionEdgeRecord,
  RegistryGraphProjectionNodeRecord,
  RegistryGraphProjectionSnapshot,
  RegistryGraphProjectionSourceSignature,
} from "../ports/interfaces/IRegistryGraphProjectionRepository";

function freezeNode(node: RegistryGraphProjectionNodeRecord): RegistryGraphProjectionNodeRecord {
  return Object.freeze({
    ...node,
    taxonomy: node.taxonomy ? Object.freeze({ ...node.taxonomy }) : undefined,
  });
}

function freezeEdge(edge: RegistryGraphProjectionEdgeRecord): RegistryGraphProjectionEdgeRecord {
  return Object.freeze({ ...edge });
}

function toEdge(asset: RegistryAsset, dependency: RegistryDependencyReference): RegistryGraphProjectionEdgeRecord {
  if (dependency.direction === "upstream") {
    return Object.freeze({
      fromAssetId: asset.assetId,
      fromVersionId: asset.versionId ?? dependency.versionId,
      toAssetId: dependency.assetId,
      toVersionId: dependency.versionId,
      relationshipType: dependency.relationshipType,
      source: dependency.source,
    });
  }

  return Object.freeze({
    fromAssetId: dependency.assetId,
    fromVersionId: dependency.versionId,
    toAssetId: asset.assetId,
    toVersionId: asset.versionId ?? dependency.versionId,
    relationshipType: dependency.relationshipType,
    source: dependency.source,
  });
}

export function buildRegistryGraphProjection(
  assets: ReadonlyArray<RegistryAsset>,
  sourceSignature?: RegistryGraphProjectionSourceSignature,
): RegistryGraphProjectionSnapshot {
  const nodes = new Map<string, RegistryGraphProjectionNodeRecord>();
  const edges = new Map<string, RegistryGraphProjectionEdgeRecord>();

  for (const asset of assets) {
    if (!asset.versionId) {
      continue;
    }

    nodes.set(asset.versionId, freezeNode({
      assetId: asset.assetId,
      versionId: asset.versionId,
      name: asset.name,
      kind: asset.kind,
      status: asset.status,
      taxonomy: asset.taxonomy,
      isRegistryProjected: true,
    }));

    for (const dependency of asset.dependencies) {
      const edge = toEdge(asset, dependency);
      const key = `${edge.fromVersionId}->${edge.toVersionId}:${edge.source}:${edge.relationshipType ?? ""}`;
      if (!edges.has(key)) {
        edges.set(key, freezeEdge(edge));
      }
    }
  }

  return Object.freeze({
    nodes: Object.freeze([...nodes.values()]),
    edges: Object.freeze([...edges.values()]),
    computedAt: new Date(),
    sourceSignature,
  });
}

