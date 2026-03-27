import type { RegistryAsset, RegistryDependencyReference } from "../../domain/asset-registry/RegistryAsset";
import type { AssetLineageRelationshipType } from "../../domain/assets/AssetLineageEdge";
import type { IAssetVersionRepository } from "../ports/interfaces/IAssetVersionRepository";
import type {
  IRegistryGraphProjectionRepository,
  RegistryGraphProjectionEdgeRecord,
  RegistryGraphProjectionNodeRecord,
} from "../ports/interfaces/IRegistryGraphProjectionRepository";
import { buildRegistryGraphProjection } from "./RegistryGraphProjection";
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

function toGraphNode(node: RegistryGraphProjectionNodeRecord): RegistryDependencyGraphNode {
  return Object.freeze({ ...node });
}

function toGraphEdge(edge: RegistryGraphProjectionEdgeRecord): RegistryDependencyGraphEdge {
  return Object.freeze({ ...edge });
}

function appendMapEntry<T>(map: Map<string, ReadonlyArray<T>>, key: string, entry: T): void {
  const existing = map.get(key) ?? Object.freeze([]);
  map.set(key, Object.freeze([...existing, entry]));
}

export class RegistryDependencyGraphService {
  constructor(
    private readonly registryQueryService: RegistryQueryService,
    private readonly versionRepository: Pick<IAssetVersionRepository, "getByVersionId">,
    private readonly projectionRepository?: IRegistryGraphProjectionRepository,
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
    const projection = await this.loadOrRebuildProjection();
    const nodesByVersionId = new Map<string, RegistryDependencyGraphNode>();
    const upstreamEdgesByVersionId = new Map<string, ReadonlyArray<RegistryDependencyGraphEdge>>();
    const downstreamEdgesByVersionId = new Map<string, ReadonlyArray<RegistryDependencyGraphEdge>>();

    for (const node of projection.nodes) {
      nodesByVersionId.set(node.versionId, toGraphNode(node));
    }

    for (const edge of projection.edges) {
      const mapped = toGraphEdge(edge);
      appendMapEntry(upstreamEdgesByVersionId, edge.fromVersionId, mapped);
      appendMapEntry(downstreamEdgesByVersionId, edge.toVersionId, mapped);
    }

    for (const edge of projection.edges) {
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

  private async loadOrRebuildProjection() {
    if (!this.projectionRepository) {
      const assets = await this.registryQueryService.queryRegistry();
      return buildRegistryGraphProjection(assets);
    }

    const [state, currentSignature] = await Promise.all([
      this.projectionRepository.getProjectionState(),
      this.projectionRepository.getCurrentSourceSignature?.(),
    ]);

    const snapshot = await this.projectionRepository.loadProjection();
    const isSignatureStale = Boolean(
      currentSignature
      && snapshot?.sourceSignature
      && (currentSignature.versionCount !== snapshot.sourceSignature.versionCount
        || currentSignature.lineageEdgeCount !== snapshot.sourceSignature.lineageEdgeCount),
    );

    if (snapshot && !state?.dirty && !isSignatureStale) {
      return snapshot;
    }

    const assets = await this.registryQueryService.queryRegistry();
    const rebuilt = buildRegistryGraphProjection(assets, currentSignature);
    await this.projectionRepository.saveProjection(rebuilt);
    return rebuilt;
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
