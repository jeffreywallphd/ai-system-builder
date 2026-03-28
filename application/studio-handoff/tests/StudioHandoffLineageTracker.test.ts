import { describe, expect, it } from "bun:test";
import { createCompositionTaxonomyDescriptor, TaxonomyBehaviorKinds, TaxonomySemanticRoles, TaxonomyStructuralKinds } from "../../../domain/taxonomy/CompositionTaxonomy";
import { createStudioHandoffContract, StudioHandoffAssetRoles, StudioHandoffIntentKinds } from "../../../domain/studio-handoff/StudioHandoffContract";
import { StudioHandoffLineageTracker } from "../StudioHandoffLineageTracker";
import type { StudioHandoffPreparation, StudioHandoffRevision } from "../StudioHandoffOrchestrationService";

function createPreparation(): StudioHandoffPreparation {
  const taxonomy = createCompositionTaxonomyDescriptor({
    structuralKind: TaxonomyStructuralKinds.system,
    semanticRole: TaxonomySemanticRoles.system,
    behaviorKind: TaxonomyBehaviorKinds.iterative,
  });

  const handoff = createStudioHandoffContract({
    id: "lineage-handoff",
    source: { studioId: "source-system", studioType: "system-studio" },
    target: { studioId: "target-system", studioType: "system-studio" },
    payload: {
      assetId: "asset:root-system",
      versionId: "asset:root-system:v2",
      taxonomy,
      targetInputContract: { contractId: "system-default-input" },
    },
    multiAsset: {
      grouped: true,
      requireAllAssets: true,
      assets: [
        {
          role: StudioHandoffAssetRoles.primary,
          assetId: "asset:root-system",
          versionId: "asset:root-system:v2",
          taxonomy,
        },
        {
          role: StudioHandoffAssetRoles.systemComponent,
          assetId: "asset:nested-system",
          versionId: "asset:nested-system:v4",
          taxonomy,
        },
      ],
    },
    intent: { kind: StudioHandoffIntentKinds.systemIntegration },
    context: {
      sourceReferences: [
        { assetId: "asset:root-system", versionId: "asset:root-system:v2", relation: "primary" },
        { assetId: "asset:nested-system", versionId: "asset:nested-system:v4", relation: "system-of-systems" },
      ],
      provenance: {
        correlationId: "corr-lineage",
      },
    },
  });

  return Object.freeze({
    sourceOutput: {
      kind: "system",
      sourceStudioType: "system-studio",
      sourceStudioId: "source-system",
      authoritativeAsset: {
        assetId: "asset:root-system",
        versionId: "asset:root-system:v2",
        pinnedVersion: { assetId: "asset:root-system", versionId: "asset:root-system:v2" },
        taxonomy,
      },
      sourceReferences: handoff.context?.sourceReferences ?? [],
      handoffMetadata: {
        hints: {},
      },
      studioSpecific: {},
    },
    handoff,
    context: handoff.context!,
    compatibility: {
      compatible: true,
      targetStudioType: "system-studio",
      issues: [],
    },
    targetInput: {
      kind: "system",
      targetStudioType: "system-studio",
      targetStudioId: "target-system",
      sourceStudioType: "system-studio",
      sourceStudioId: "source-system",
      authoritativeAsset: {
        assetId: "asset:root-system",
        versionId: "asset:root-system:v2",
        pinnedVersion: { assetId: "asset:root-system", versionId: "asset:root-system:v2" },
        taxonomy,
      },
      sourceReferences: handoff.context?.sourceReferences ?? [],
      prefill: {},
      context: { intent: handoff.intent },
      studioSpecific: {},
      grouped: true,
      requireAllAssets: true,
      bundledAssets: [
        {
          role: StudioHandoffAssetRoles.primary,
          ordinal: 0,
          assetId: "asset:root-system",
          versionId: "asset:root-system:v2",
          pinnedVersion: { assetId: "asset:root-system", versionId: "asset:root-system:v2" },
          taxonomy,
          context: {},
        },
      ],
    },
  });
}

describe("StudioHandoffLineageTracker", () => {
  it("records version-aware lineage edges for multi-asset handoffs", () => {
    const tracker = new StudioHandoffLineageTracker();
    const event = tracker.track({ preparation: createPreparation() });

    expect(event.kind).toBe("studio-handoff-lineage-recorded");
    expect(event.record.sourceVersions).toHaveLength(2);
    expect(event.record.sourceVersions[0]?.versionId).toBe("asset:root-system:v2");
    expect(event.record.targetStudioType).toBe("system-studio");
    expect(event.record.edges).toHaveLength(2);
  });

  it("keeps revision linkage explicit for incremental handoff updates", () => {
    const tracker = new StudioHandoffLineageTracker();
    const revision: StudioHandoffRevision = {
      revisionId: "rev-7",
      previousHandoffId: "lineage-handoff",
      updatedHandoffId: "lineage-handoff:rev:7",
      createdAt: new Date().toISOString(),
    };

    const event = tracker.track({ preparation: createPreparation(), revision });
    expect(event.record.handoffRevisionId).toBe("rev-7");
    expect(event.record.previousHandoffId).toBe("lineage-handoff");
    expect(event.record.edges[0]?.handoffRevisionId).toBe("rev-7");
  });

  it("supports bounded lineage record reads", () => {
    const tracker = new StudioHandoffLineageTracker();
    const first = createPreparation();
    tracker.track({ preparation: first });
    const second = createPreparation();
    tracker.track({
      preparation: Object.freeze({
        ...second,
        handoff: createStudioHandoffContract({
          id: "lineage-handoff:second",
          source: second.handoff.source,
          target: second.handoff.target,
          payload: second.handoff.payload,
          multiAsset: second.handoff.multiAsset,
          intent: second.handoff.intent,
          context: {
            sourceReferences: second.handoff.context?.sourceReferences ?? [],
            prefill: second.handoff.context?.prefill,
            provenance: second.handoff.context?.provenance,
          },
        }),
      }),
    });

    const recent = tracker.listRecords(1);
    expect(recent).toHaveLength(1);
    expect(recent[0]?.handoffId).toBe("lineage-handoff:second");
  });
});
