import type { StudioHandoffLineageRecord } from "./StudioHandoffLineageTracker";
import type {
  StudioHandoffChangeSet,
  StudioHandoffPreparation,
  StudioHandoffRevision,
} from "./StudioHandoffOrchestrationService";

export const StudioHandoffDependencyNodeKinds = Object.freeze({
  assetVersion: "asset-version",
  studioTransition: "studio-transition",
});

export type StudioHandoffDependencyNodeKind =
  typeof StudioHandoffDependencyNodeKinds[keyof typeof StudioHandoffDependencyNodeKinds];

export interface StudioHandoffDependencyNode {
  readonly nodeId: string;
  readonly kind: StudioHandoffDependencyNodeKind;
  readonly assetId?: string;
  readonly versionId?: string;
  readonly studioId?: string;
  readonly studioType?: string;
  readonly handoffId?: string;
}

export const StudioHandoffDependencyEdgeKinds = Object.freeze({
  handoffDerived: "handoff-derived-dependency",
  bundleMembership: "bundle-membership",
  revisionSupersedes: "revision-supersedes",
  revisionTransition: "revision-transition",
});

export type StudioHandoffDependencyEdgeKind =
  typeof StudioHandoffDependencyEdgeKinds[keyof typeof StudioHandoffDependencyEdgeKinds];

export interface StudioHandoffDependencyEdge {
  readonly edgeId: string;
  readonly kind: StudioHandoffDependencyEdgeKind;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly handoffId: string;
  readonly handoffRevisionId?: string;
  readonly bundleId?: string;
  readonly bundleRole?: string;
  readonly sourceAssetId?: string;
  readonly sourceVersionId?: string;
  readonly targetAssetId?: string;
  readonly targetVersionId?: string;
  readonly sourceStudioId: string;
  readonly sourceStudioType: string;
  readonly targetStudioId: string;
  readonly targetStudioType: string;
  readonly createdAt: string;
}

export interface CrossStudioDependencyGraph {
  readonly nodes: ReadonlyArray<StudioHandoffDependencyNode>;
  readonly edges: ReadonlyArray<StudioHandoffDependencyEdge>;
}

export interface StudioHandoffDependencyRecord {
  readonly recordId: string;
  readonly handoffId: string;
  readonly handoffRevisionId?: string;
  readonly previousHandoffId?: string;
  readonly createdAt: string;
  readonly graph: CrossStudioDependencyGraph;
}

export interface StudioHandoffDependencyBuildInput {
  readonly preparation: StudioHandoffPreparation;
  readonly lineage?: StudioHandoffLineageRecord;
  readonly revision?: StudioHandoffRevision;
  readonly changes?: StudioHandoffChangeSet;
}

function freezeNode(node: StudioHandoffDependencyNode): StudioHandoffDependencyNode {
  return Object.freeze({ ...node });
}

function freezeEdge(edge: StudioHandoffDependencyEdge): StudioHandoffDependencyEdge {
  return Object.freeze({ ...edge });
}

function toAssetVersionNodeId(assetId: string, versionId: string): string {
  return `asset-version:${assetId}@${versionId}`;
}

function toTransitionNodeId(input: {
  readonly sourceStudioId: string;
  readonly targetStudioId: string;
  readonly handoffId: string;
}): string {
  return `studio-transition:${input.sourceStudioId}->${input.targetStudioId}:${input.handoffId}`;
}

export class CrossStudioDependencyGraphBuilder {
  public build(input: StudioHandoffDependencyBuildInput): StudioHandoffDependencyRecord {
    const now = new Date().toISOString();
    const handoff = input.preparation.handoff;
    const sourceVersions = handoff.multiAsset
      ? handoff.multiAsset.assets.map((entry) => Object.freeze({
        assetId: entry.pinnedVersion?.assetId ?? entry.assetId,
        versionId: entry.pinnedVersion?.versionId ?? entry.versionId,
        role: entry.role,
      }))
      : [Object.freeze({
        assetId: handoff.payload.pinnedVersion?.assetId ?? handoff.payload.assetId,
        versionId: handoff.payload.pinnedVersion?.versionId ?? handoff.payload.versionId,
        role: "primary",
      })];

    const targetReferences = input.lineage?.resultingTargetReferences.length
      ? input.lineage.resultingTargetReferences
      : input.preparation.targetInput.sourceReferences;

    const nodes = new Map<string, StudioHandoffDependencyNode>();
    const edges = new Map<string, StudioHandoffDependencyEdge>();
    const transitionNodeId = toTransitionNodeId({
      sourceStudioId: handoff.source.studioId,
      targetStudioId: handoff.target.studioId,
      handoffId: handoff.id.value,
    });

    nodes.set(transitionNodeId, freezeNode({
      nodeId: transitionNodeId,
      kind: StudioHandoffDependencyNodeKinds.studioTransition,
      studioId: handoff.target.studioId,
      studioType: handoff.target.studioType,
      handoffId: handoff.id.value,
    }));

    const bundleId = handoff.multiAsset ? `${handoff.id.value}:bundle` : undefined;

    for (let index = 0; index < sourceVersions.length; index += 1) {
      const source = sourceVersions[index]!;
      const sourceNodeId = toAssetVersionNodeId(source.assetId, source.versionId);
      nodes.set(sourceNodeId, freezeNode({
        nodeId: sourceNodeId,
        kind: StudioHandoffDependencyNodeKinds.assetVersion,
        assetId: source.assetId,
        versionId: source.versionId,
        studioId: handoff.source.studioId,
        studioType: handoff.source.studioType,
      }));

      const targetRef = targetReferences[index] ?? targetReferences[0];
      const targetNodeId = targetRef
        ? toAssetVersionNodeId(targetRef.assetId, targetRef.versionId)
        : transitionNodeId;

      if (targetRef) {
        nodes.set(targetNodeId, freezeNode({
          nodeId: targetNodeId,
          kind: StudioHandoffDependencyNodeKinds.assetVersion,
          assetId: targetRef.assetId,
          versionId: targetRef.versionId,
          studioId: handoff.target.studioId,
          studioType: handoff.target.studioType,
        }));
      }

      const dependencyEdge: StudioHandoffDependencyEdge = {
        edgeId: `${handoff.id.value}:${input.revision?.revisionId ?? "base"}:depends:${index}`,
        kind: StudioHandoffDependencyEdgeKinds.handoffDerived,
        fromNodeId: sourceNodeId,
        toNodeId: targetNodeId,
        handoffId: handoff.id.value,
        handoffRevisionId: input.revision?.revisionId,
        bundleId,
        bundleRole: source.role,
        sourceAssetId: source.assetId,
        sourceVersionId: source.versionId,
        targetAssetId: targetRef?.assetId,
        targetVersionId: targetRef?.versionId,
        sourceStudioId: handoff.source.studioId,
        sourceStudioType: handoff.source.studioType,
        targetStudioId: handoff.target.studioId,
        targetStudioType: handoff.target.studioType,
        createdAt: now,
      };
      edges.set(dependencyEdge.edgeId, freezeEdge(dependencyEdge));

      const transitionEdge: StudioHandoffDependencyEdge = {
        edgeId: `${handoff.id.value}:${input.revision?.revisionId ?? "base"}:transition:${index}`,
        kind: StudioHandoffDependencyEdgeKinds.bundleMembership,
        fromNodeId: sourceNodeId,
        toNodeId: transitionNodeId,
        handoffId: handoff.id.value,
        handoffRevisionId: input.revision?.revisionId,
        bundleId,
        bundleRole: source.role,
        sourceAssetId: source.assetId,
        sourceVersionId: source.versionId,
        sourceStudioId: handoff.source.studioId,
        sourceStudioType: handoff.source.studioType,
        targetStudioId: handoff.target.studioId,
        targetStudioType: handoff.target.studioType,
        createdAt: now,
      };
      edges.set(transitionEdge.edgeId, freezeEdge(transitionEdge));
    }

    if (input.revision) {
      const revisionTransitionNodeId = toTransitionNodeId({
        sourceStudioId: handoff.source.studioId,
        targetStudioId: handoff.target.studioId,
        handoffId: input.revision.previousHandoffId,
      });
      nodes.set(revisionTransitionNodeId, freezeNode({
        nodeId: revisionTransitionNodeId,
        kind: StudioHandoffDependencyNodeKinds.studioTransition,
        studioId: handoff.target.studioId,
        studioType: handoff.target.studioType,
        handoffId: input.revision.previousHandoffId,
      }));

      edges.set(`${handoff.id.value}:${input.revision.revisionId}:revision-transition`, freezeEdge({
        edgeId: `${handoff.id.value}:${input.revision.revisionId}:revision-transition`,
        kind: StudioHandoffDependencyEdgeKinds.revisionTransition,
        fromNodeId: revisionTransitionNodeId,
        toNodeId: transitionNodeId,
        handoffId: handoff.id.value,
        handoffRevisionId: input.revision.revisionId,
        sourceStudioId: handoff.source.studioId,
        sourceStudioType: handoff.source.studioType,
        targetStudioId: handoff.target.studioId,
        targetStudioType: handoff.target.studioType,
        createdAt: now,
      }));
    }

    const versionChanges = [
      input.changes?.updatedAuthoritativeVersion,
      ...(input.changes?.updatedBundleAssets ?? []),
    ].filter((entry): entry is { assetId: string; previousVersionId: string; nextVersionId: string; role?: string } => Boolean(entry));

    versionChanges.forEach((change, index) => {
      const previousNodeId = toAssetVersionNodeId(change.assetId, change.previousVersionId);
      const nextNodeId = toAssetVersionNodeId(change.assetId, change.nextVersionId);
      nodes.set(previousNodeId, freezeNode({
        nodeId: previousNodeId,
        kind: StudioHandoffDependencyNodeKinds.assetVersion,
        assetId: change.assetId,
        versionId: change.previousVersionId,
        studioId: handoff.source.studioId,
        studioType: handoff.source.studioType,
      }));
      nodes.set(nextNodeId, freezeNode({
        nodeId: nextNodeId,
        kind: StudioHandoffDependencyNodeKinds.assetVersion,
        assetId: change.assetId,
        versionId: change.nextVersionId,
        studioId: handoff.source.studioId,
        studioType: handoff.source.studioType,
      }));

      edges.set(`${handoff.id.value}:${input.revision?.revisionId ?? "base"}:supersedes:${index}`, freezeEdge({
        edgeId: `${handoff.id.value}:${input.revision?.revisionId ?? "base"}:supersedes:${index}`,
        kind: StudioHandoffDependencyEdgeKinds.revisionSupersedes,
        fromNodeId: previousNodeId,
        toNodeId: nextNodeId,
        handoffId: handoff.id.value,
        handoffRevisionId: input.revision?.revisionId,
        sourceAssetId: change.assetId,
        sourceVersionId: change.previousVersionId,
        targetAssetId: change.assetId,
        targetVersionId: change.nextVersionId,
        sourceStudioId: handoff.source.studioId,
        sourceStudioType: handoff.source.studioType,
        targetStudioId: handoff.target.studioId,
        targetStudioType: handoff.target.studioType,
        createdAt: now,
      }));
    });

    return Object.freeze({
      recordId: `${handoff.id.value}:${input.revision?.revisionId ?? "base"}:dependency`,
      handoffId: handoff.id.value,
      handoffRevisionId: input.revision?.revisionId,
      previousHandoffId: input.revision?.previousHandoffId,
      createdAt: now,
      graph: Object.freeze({
        nodes: Object.freeze([...nodes.values()]),
        edges: Object.freeze([...edges.values()]),
      }),
    });
  }
}

export class StudioHandoffDependencyTracker {
  private readonly records: StudioHandoffDependencyRecord[] = [];

  public constructor(private readonly graphBuilder: CrossStudioDependencyGraphBuilder = new CrossStudioDependencyGraphBuilder()) {}

  public track(input: StudioHandoffDependencyBuildInput): StudioHandoffDependencyRecord {
    const record = this.graphBuilder.build(input);
    this.records.push(record);
    return record;
  }

  public listRecords(): ReadonlyArray<StudioHandoffDependencyRecord> {
    return Object.freeze([...this.records]);
  }

  public buildGraph(): CrossStudioDependencyGraph {
    const nodes = new Map<string, StudioHandoffDependencyNode>();
    const edges = new Map<string, StudioHandoffDependencyEdge>();

    for (const record of this.records) {
      for (const node of record.graph.nodes) {
        nodes.set(node.nodeId, node);
      }
      for (const edge of record.graph.edges) {
        edges.set(edge.edgeId, edge);
      }
    }

    return Object.freeze({
      nodes: Object.freeze([...nodes.values()]),
      edges: Object.freeze([...edges.values()]),
    });
  }
}
