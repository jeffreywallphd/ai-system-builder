import type { RegistryAsset, RegistryDependencyReference } from "../../domain/asset-registry/RegistryAsset";
import type { AssetLineageRelationshipType } from "../../domain/assets/AssetLineageEdge";
import type { IAssetVersionRepository } from "../ports/interfaces/IAssetVersionRepository";
import { RegistryQueryService } from "./RegistryQueryService";

export interface RegistryDependencyGraphNode {
  readonly assetId: string;
  readonly versionId: string;
  readonly name?: string;
  readonly kind?: string;
  readonly status?: string;
  readonly taxonomy?: RegistryAsset["taxonomy"];
  readonly isRegistryProjected: boolean;
}

export interface RegistryDependencyGraphEdge {
  readonly fromAssetId: string;
  readonly fromVersionId: string;
  readonly toAssetId: string;
  readonly toVersionId: string;
  readonly relationshipType?: AssetLineageRelationshipType;
  readonly source: RegistryDependencyReference["source"];
}

export interface RegistryDependencyGraph {
  readonly nodes: ReadonlyArray<RegistryDependencyGraphNode>;
  readonly edges: ReadonlyArray<RegistryDependencyGraphEdge>;
}

export interface RegistryDependencyTraversal {
  readonly rootVersionId: string;
  readonly direction: "upstream" | "downstream";
  readonly maxDepth: number;
  readonly graph: RegistryDependencyGraph;
  readonly levels: ReadonlyArray<ReadonlyArray<string>>;
}

export interface RegistryDependencyTraversalOptions {
  readonly maxDepth?: number;
  readonly maxNodes?: number;
}

interface DependencyAdjacency {
  readonly nodesByVersionId: Map<string, RegistryDependencyGraphNode>;
  readonly upstreamEdgesByVersionId: Map<string, ReadonlyArray<RegistryDependencyGraphEdge>>;
  readonly downstreamEdgesByVersionId: Map<string, ReadonlyArray<RegistryDependencyGraphEdge>>;
}

function appendMapEntry<T>(map: Map<string, ReadonlyArray<T>>, key: string, entry: T): void {
  const existing = map.get(key) ?? Object.freeze([]);
  map.set(key, Object.freeze([...existing, entry]));
}

export class RegistryDependencyGraphService {
  constructor(
    private readonly registryQueryService: RegistryQueryService,
    private readonly versionRepository: Pick<IAssetVersionRepository, "getByVersionId">,
  ) {}

  public async expandDirectDependencies(versionId: string): Promise<RegistryDependencyGraph> {
    return this.expandDirect(versionId, "upstream");
  }

  public async expandDirectDependents(versionId: string): Promise<RegistryDependencyGraph> {
    return this.expandDirect(versionId, "downstream");
  }

  public async traverseUpstream(
    versionId: string,
    options: RegistryDependencyTraversalOptions = {},
  ): Promise<RegistryDependencyTraversal> {
    return this.traverse(versionId, "upstream", options);
  }

  public async traverseDownstream(
    versionId: string,
    options: RegistryDependencyTraversalOptions = {},
  ): Promise<RegistryDependencyTraversal> {
    return this.traverse(versionId, "downstream", options);
  }

  private async expandDirect(versionId: string, direction: "upstream" | "downstream"): Promise<RegistryDependencyGraph> {
    const normalized = versionId.trim();
    if (!normalized) {
      return Object.freeze({ nodes: Object.freeze([]), edges: Object.freeze([]) });
    }

    const adjacency = await this.buildAdjacency();
    const root = await this.getNode(normalized, adjacency.nodesByVersionId);
    if (!root) {
      return Object.freeze({ nodes: Object.freeze([]), edges: Object.freeze([]) });
    }

    const selected = direction === "upstream"
      ? adjacency.upstreamEdgesByVersionId.get(normalized) ?? Object.freeze([])
      : adjacency.downstreamEdgesByVersionId.get(normalized) ?? Object.freeze([]);

    const nodes = new Map<string, RegistryDependencyGraphNode>([[root.versionId, root]]);
    for (const edge of selected) {
      const adjacentVersionId = direction === "upstream" ? edge.toVersionId : edge.fromVersionId;
      const adjacent = await this.getNode(adjacentVersionId, adjacency.nodesByVersionId);
      if (adjacent) {
        nodes.set(adjacent.versionId, adjacent);
      }
    }

    return Object.freeze({
      nodes: Object.freeze([...nodes.values()]),
      edges: selected,
    });
  }

  private async traverse(
    versionId: string,
    direction: "upstream" | "downstream",
    options: RegistryDependencyTraversalOptions,
  ): Promise<RegistryDependencyTraversal> {
    const normalized = versionId.trim();
    const maxDepth = options.maxDepth && options.maxDepth > 0 ? options.maxDepth : 3;
    const maxNodes = options.maxNodes && options.maxNodes > 0 ? options.maxNodes : 200;

    if (!normalized) {
      return Object.freeze({
        rootVersionId: normalized,
        direction,
        maxDepth,
        graph: Object.freeze({ nodes: Object.freeze([]), edges: Object.freeze([]) }),
        levels: Object.freeze([]),
      });
    }

    const adjacency = await this.buildAdjacency();
    const root = await this.getNode(normalized, adjacency.nodesByVersionId);
    if (!root) {
      return Object.freeze({
        rootVersionId: normalized,
        direction,
        maxDepth,
        graph: Object.freeze({ nodes: Object.freeze([]), edges: Object.freeze([]) }),
        levels: Object.freeze([]),
      });
    }

    const queue: Array<{ versionId: string; depth: number }> = [{ versionId: normalized, depth: 0 }];
    const visited = new Set<string>([normalized]);
    const edges = new Map<string, RegistryDependencyGraphEdge>();
    const nodes = new Map<string, RegistryDependencyGraphNode>([[root.versionId, root]]);
    const levels: string[][] = [[normalized]];

    while (queue.length > 0 && nodes.size < maxNodes) {
      const current = queue.shift();
      if (!current) {
        break;
      }

      if (current.depth >= maxDepth) {
        continue;
      }

      const adjacencyEdges = direction === "upstream"
        ? adjacency.upstreamEdgesByVersionId.get(current.versionId) ?? Object.freeze([])
        : adjacency.downstreamEdgesByVersionId.get(current.versionId) ?? Object.freeze([]);

      for (const edge of adjacencyEdges) {
        const edgeKey = `${edge.fromVersionId}->${edge.toVersionId}:${edge.source}:${edge.relationshipType ?? ""}`;
        edges.set(edgeKey, edge);

        const adjacentVersionId = direction === "upstream" ? edge.toVersionId : edge.fromVersionId;
        if (visited.has(adjacentVersionId)) {
          continue;
        }

        const adjacentNode = await this.getNode(adjacentVersionId, adjacency.nodesByVersionId);
        if (!adjacentNode) {
          continue;
        }

        visited.add(adjacentVersionId);
        nodes.set(adjacentNode.versionId, adjacentNode);
        queue.push({ versionId: adjacentVersionId, depth: current.depth + 1 });

        if (!levels[current.depth + 1]) {
          levels[current.depth + 1] = [];
        }
        levels[current.depth + 1]!.push(adjacentVersionId);

        if (nodes.size >= maxNodes) {
          break;
        }
      }
    }

    return Object.freeze({
      rootVersionId: normalized,
      direction,
      maxDepth,
      graph: Object.freeze({
        nodes: Object.freeze([...nodes.values()]),
        edges: Object.freeze([...edges.values()]),
      }),
      levels: Object.freeze(levels.map((level) => Object.freeze(level))),
    });
  }

  private async buildAdjacency(): Promise<DependencyAdjacency> {
    const registryAssets = await this.registryQueryService.queryRegistry();
    const nodesByVersionId = new Map<string, RegistryDependencyGraphNode>();
    const upstreamEdgesByVersionId = new Map<string, ReadonlyArray<RegistryDependencyGraphEdge>>();
    const downstreamEdgesByVersionId = new Map<string, ReadonlyArray<RegistryDependencyGraphEdge>>();
    const dedupedEdges = new Map<string, RegistryDependencyGraphEdge>();

    for (const asset of registryAssets) {
      if (!asset.versionId) {
        continue;
      }

      nodesByVersionId.set(asset.versionId, Object.freeze({
        assetId: asset.assetId,
        versionId: asset.versionId,
        name: asset.name,
        kind: asset.kind,
        status: asset.status,
        taxonomy: asset.taxonomy,
        isRegistryProjected: true,
      }));

      for (const dependency of asset.dependencies) {
        const edge = this.toEdge(asset, dependency);
        const key = `${edge.fromVersionId}->${edge.toVersionId}:${edge.source}:${edge.relationshipType ?? ""}`;
        if (!dedupedEdges.has(key)) {
          dedupedEdges.set(key, edge);
          appendMapEntry(upstreamEdgesByVersionId, edge.fromVersionId, edge);
          appendMapEntry(downstreamEdgesByVersionId, edge.toVersionId, edge);
        }
      }
    }

    for (const edge of dedupedEdges.values()) {
      if (!nodesByVersionId.has(edge.fromVersionId)) {
        const node = await this.lookupNode(edge.fromVersionId, edge.fromAssetId);
        if (node) {
          nodesByVersionId.set(node.versionId, node);
        }
      }

      if (!nodesByVersionId.has(edge.toVersionId)) {
        const node = await this.lookupNode(edge.toVersionId, edge.toAssetId);
        if (node) {
          nodesByVersionId.set(node.versionId, node);
        }
      }
    }

    return Object.freeze({
      nodesByVersionId,
      upstreamEdgesByVersionId,
      downstreamEdgesByVersionId,
    });
  }

  private toEdge(asset: RegistryAsset, dependency: RegistryDependencyReference): RegistryDependencyGraphEdge {
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

  private async getNode(
    versionId: string,
    nodesByVersionId: Map<string, RegistryDependencyGraphNode>,
  ): Promise<RegistryDependencyGraphNode | undefined> {
    const known = nodesByVersionId.get(versionId);
    if (known) {
      return known;
    }

    const fromVersionRepository = await this.versionRepository.getByVersionId(versionId);
    if (!fromVersionRepository) {
      return undefined;
    }

    const fallback = Object.freeze({
      assetId: fromVersionRepository.assetId.value,
      versionId: fromVersionRepository.versionId,
      isRegistryProjected: false,
    });
    nodesByVersionId.set(fallback.versionId, fallback);
    return fallback;
  }

  private async lookupNode(versionId: string, assetId: string): Promise<RegistryDependencyGraphNode | undefined> {
    const version = await this.versionRepository.getByVersionId(versionId);
    if (!version) {
      return Object.freeze({
        assetId,
        versionId,
        isRegistryProjected: false,
      });
    }

    return Object.freeze({
      assetId: version.assetId.value,
      versionId: version.versionId,
      isRegistryProjected: false,
    });
  }
}
