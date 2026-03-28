import { describe, expect, it } from "bun:test";
import { CompositionAssetContractResolver } from "../../contracts/CompositionAssetContractResolver";
import {
  createStudioHandoffContract,
  StudioHandoffAssetRoles,
  StudioHandoffIntentKinds,
} from "../../../domain/studio-handoff/StudioHandoffContract";
import {
  createCompositionTaxonomyDescriptor,
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
} from "../../../domain/taxonomy/CompositionTaxonomy";
import {
  StudioHandoffDependencyEdgeKinds,
  StudioHandoffDependencyTracker,
} from "../CrossStudioDependencyGraph";
import { createStudioHandoffContext } from "../../../domain/studio-handoff/StudioHandoffContext";
import type { StudioHandoffPreparation } from "../StudioHandoffOrchestrationService";

const resolver = new CompositionAssetContractResolver();

function createPreparation() : StudioHandoffPreparation {
  const taxonomy = createCompositionTaxonomyDescriptor({
    structuralKind: TaxonomyStructuralKinds.system,
    semanticRole: TaxonomySemanticRoles.system,
    behaviorKind: TaxonomyBehaviorKinds.iterative,
  });
  const handoff = createStudioHandoffContract({
    id: "handoff:system",
    source: { studioId: "workflow-a", studioType: "workflow-studio" },
    target: { studioId: "system-a", studioType: "system-studio" },
    payload: {
      assetId: "asset:system",
      versionId: "asset:system:v1",
      taxonomy,
      contract: resolver.resolveContractForTaxonomy(taxonomy),
      targetInputContract: { contractId: "system-default-input" },
    },
    multiAsset: {
      grouped: true,
      requireAllAssets: true,
      assets: [
        {
          role: StudioHandoffAssetRoles.primary,
          assetId: "asset:system",
          versionId: "asset:system:v1",
          taxonomy,
        },
        {
          role: StudioHandoffAssetRoles.systemComponent,
          assetId: "asset:workflow",
          versionId: "asset:workflow:v3",
          taxonomy: createCompositionTaxonomyDescriptor({
            structuralKind: TaxonomyStructuralKinds.composite,
            semanticRole: TaxonomySemanticRoles.workflow,
            behaviorKind: TaxonomyBehaviorKinds.deterministic,
          }),
        },
      ],
    },
    intent: { kind: StudioHandoffIntentKinds.systemIntegration },
    context: {
      sourceReferences: [
        { assetId: "asset:system", versionId: "asset:system:v1", relation: "primary" },
        { assetId: "asset:workflow", versionId: "asset:workflow:v3", relation: "system-component" },
      ],
    },
  });

  const context = createStudioHandoffContext({
    sourceStudioId: handoff.source.studioId,
    sourceStudioType: handoff.source.studioType,
    targetStudioId: handoff.target.studioId,
    targetStudioType: handoff.target.studioType,
    intent: handoff.intent,
    sourceReferences: handoff.context?.sourceReferences ?? [],
  });

  return Object.freeze({
    sourceOutput: {
      kind: "system",
      sourceStudioType: handoff.source.studioType,
      sourceStudioId: handoff.source.studioId,
      authoritativeAsset: {
        assetId: handoff.payload.assetId,
        versionId: handoff.payload.versionId,
        taxonomy,
      },
      sourceReferences: context.sourceReferences,
      handoffMetadata: {
        hints: Object.freeze({ priority: "high" }),
      },
      studioSpecific: Object.freeze({ supportsSystemOfSystems: true }),
    },
    handoff,
    context,
    compatibility: {
      compatible: true,
      targetStudioType: handoff.target.studioType,
      matchedContractId: "system-default-input",
      issues: Object.freeze([]),
    },
    targetInput: {
      kind: "system",
      targetStudioType: handoff.target.studioType,
      targetStudioId: handoff.target.studioId,
      sourceStudioType: handoff.source.studioType,
      sourceStudioId: handoff.source.studioId,
      authoritativeAsset: {
        assetId: handoff.payload.assetId,
        versionId: handoff.payload.versionId,
        pinnedVersion: {
          assetId: handoff.payload.assetId,
          versionId: handoff.payload.versionId,
        },
        taxonomy,
      },
      sourceReferences: context.sourceReferences,
      prefill: Object.freeze({ priority: "high" }),
      context: {
        intent: handoff.intent,
      },
      studioSpecific: Object.freeze({ supportsSystemOfSystems: true }),
      grouped: true,
      requireAllAssets: true,
      bundledAssets: Object.freeze([]),
    },
  });
}

describe("CrossStudioDependencyGraphBuilder/Tracker", () => {
  it("creates version-aware dependency edges from orchestration preparation", () => {
    const tracker = new StudioHandoffDependencyTracker();
    const preparation = createPreparation();
    const record = tracker.track({ preparation });

    const dependencyEdges = record.graph.edges.filter((edge) => edge.kind === StudioHandoffDependencyEdgeKinds.handoffDerived);
    expect(dependencyEdges.length).toBe(2);
    expect(dependencyEdges.every((edge) => edge.sourceVersionId?.includes(":v"))).toBeTrue();
    expect(dependencyEdges.every((edge) => edge.sourceStudioType === "workflow-studio")).toBeTrue();
    expect(dependencyEdges.every((edge) => edge.targetStudioType === "system-studio")).toBeTrue();
  });

  it("tracks grouped multi-asset bundle dependencies coherently", () => {
    const tracker = new StudioHandoffDependencyTracker();
    const preparation = createPreparation();
    const record = tracker.track({ preparation });

    const bundleMembershipEdges = record.graph.edges.filter((edge) => edge.kind === StudioHandoffDependencyEdgeKinds.bundleMembership);
    expect(bundleMembershipEdges.length).toBe(2);
    expect(bundleMembershipEdges.every((edge) => edge.bundleId === "handoff:system:bundle")).toBeTrue();
    expect(bundleMembershipEdges.map((edge) => edge.bundleRole).sort()).toEqual(["primary", "system-component"]);
  });

  it("records revision-aware dependency updates without dropping prior traceability", () => {
    const tracker = new StudioHandoffDependencyTracker();
    const preparation = createPreparation();
    tracker.track({ preparation });

    const revised = tracker.track({
      preparation: Object.freeze({
        ...preparation,
        handoff: createStudioHandoffContract({
          id: "handoff:system:rev1",
          source: preparation.handoff.source,
          target: preparation.handoff.target,
          payload: {
            ...preparation.handoff.payload,
            versionId: "asset:system:v2",
            pinnedVersion: {
              assetId: "asset:system",
              versionId: "asset:system:v2",
            },
          },
          context: {
            sourceReferences: [
              { assetId: "asset:system", versionId: "asset:system:v2", relation: "primary" },
              { assetId: "asset:workflow", versionId: "asset:workflow:v4", relation: "system-component" },
            ],
          },
          multiAsset: preparation.handoff.multiAsset
            ? {
              grouped: true,
              requireAllAssets: preparation.handoff.multiAsset.requireAllAssets,
              assets: preparation.handoff.multiAsset.assets.map((entry) => ({
                ...entry,
                versionId: entry.assetId === "asset:system"
                  ? "asset:system:v2"
                  : (entry.assetId === "asset:workflow" ? "asset:workflow:v4" : entry.versionId),
                pinnedVersion: {
                  assetId: entry.assetId,
                  versionId: entry.assetId === "asset:system"
                    ? "asset:system:v2"
                    : (entry.assetId === "asset:workflow" ? "asset:workflow:v4" : entry.versionId),
                },
              })),
            }
            : undefined,
          intent: preparation.handoff.intent,
        }),
      }),
      revision: {
        revisionId: "rev-1",
        previousHandoffId: "handoff:system",
        updatedHandoffId: "handoff:system:rev1",
        createdAt: new Date().toISOString(),
      },
      changes: {
        updatedAuthoritativeAsset: true,
        updatedAuthoritativeVersion: {
          assetId: "asset:system",
          previousVersionId: "asset:system:v1",
          nextVersionId: "asset:system:v2",
        },
        updatedBundleAssets: [
          {
            assetId: "asset:workflow",
            previousVersionId: "asset:workflow:v3",
            nextVersionId: "asset:workflow:v4",
            role: "system-component",
          },
        ],
        updatedContextPrefillKeys: [],
        updatedContextProvenanceFields: [],
      },
    });

    const supersedes = revised.graph.edges.filter((edge) => edge.kind === StudioHandoffDependencyEdgeKinds.revisionSupersedes);
    expect(supersedes.length).toBe(2);

    const graph = tracker.buildGraph();
    expect(graph.edges.some((edge) => edge.handoffId === "handoff:system")).toBeTrue();
    expect(graph.edges.some((edge) => edge.handoffId === "handoff:system:rev1")).toBeTrue();
  });
});
