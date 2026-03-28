import { describe, expect, it } from "bun:test";
import { CompositionAssetContractResolver } from "../../../application/contracts/CompositionAssetContractResolver";
import {
  createStudioHandoffContract,
  StudioHandoffAssetRoles,
  StudioHandoffIntentKinds,
  StudioHandoffContractId,
} from "../StudioHandoffContract";
import { createCompositionTaxonomyDescriptor, TaxonomyBehaviorKinds, TaxonomySemanticRoles, TaxonomyStructuralKinds } from "../../taxonomy/CompositionTaxonomy";

const resolver = new CompositionAssetContractResolver();

function createHandoffForTaxonomy(input: {
  readonly id: string;
  readonly taxonomy: {
    readonly structuralKind: "atomic" | "composite" | "system";
    readonly semanticRole: Parameters<typeof createCompositionTaxonomyDescriptor>[0]["semanticRole"];
    readonly behaviorKind: Parameters<typeof createCompositionTaxonomyDescriptor>[0]["behaviorKind"];
  };
}) {
  const descriptor = createCompositionTaxonomyDescriptor(input.taxonomy);
  const projectedContract = resolver.resolveContractForTaxonomy(descriptor);

  return createStudioHandoffContract({
    id: input.id,
    source: {
      studioId: "studio-source",
      studioType: "dataset-studio",
      sessionId: "session-source",
      draftId: "draft-source",
    },
    target: {
      studioId: "studio-target",
      studioType: "system-studio",
      sessionId: "session-target",
      draftId: "draft-target",
    },
    payload: {
      assetId: `asset:${input.id}`,
      versionId: `${input.id}:v1`,
      taxonomy: descriptor,
      contract: projectedContract,
      targetInputContract: {
        contractId: "input:system-default",
        acceptedStructuralKinds: [descriptor.structuralKind],
        acceptedSemanticRoles: [descriptor.semanticRole],
        acceptedBehaviorKinds: [descriptor.behaviorKind],
        requireVersionedAsset: true,
        expectedContract: projectedContract,
        allowedContextKeys: ["reason", "priority"],
      },
    },
    context: {
      sourceReferences: [{ assetId: `asset:${input.id}`, versionId: `${input.id}:v1`, relation: "primary" }],
      prefill: {
        values: { reason: "compose", priority: "high" },
        hintOnlyKeys: ["reason", "priority"],
        note: "Hints only; authoritative values come from the source asset version.",
      },
      provenance: {
        correlationId: `${input.id}-corr`,
        sourceSessionId: "session-source",
        sourceDraftId: "draft-source",
        sourceVersionLineage: [`${input.id}:v0`, `${input.id}:v1`],
      },
    },
    intent: {
      kind: StudioHandoffIntentKinds.systemIntegration,
      description: "handoff for cross-studio composition",
      labels: ["epic-9", "handoff"],
    },
  });
}

describe("createStudioHandoffContract", () => {
  it("represents atomic/composite/system/system-of-systems handoff contracts with version-aware references", () => {
    const atomic = createHandoffForTaxonomy({
      id: "handoff-atomic",
      taxonomy: {
        structuralKind: TaxonomyStructuralKinds.atomic,
        semanticRole: TaxonomySemanticRoles.dataset,
        behaviorKind: TaxonomyBehaviorKinds.none,
      },
    });
    const composite = createHandoffForTaxonomy({
      id: "handoff-composite",
      taxonomy: {
        structuralKind: TaxonomyStructuralKinds.composite,
        semanticRole: TaxonomySemanticRoles.workflow,
        behaviorKind: TaxonomyBehaviorKinds.deterministic,
      },
    });
    const system = createHandoffForTaxonomy({
      id: "handoff-system",
      taxonomy: {
        structuralKind: TaxonomyStructuralKinds.system,
        semanticRole: TaxonomySemanticRoles.system,
        behaviorKind: TaxonomyBehaviorKinds.iterative,
      },
    });
    const systemOfSystems = createHandoffForTaxonomy({
      id: "handoff-system-of-systems",
      taxonomy: {
        structuralKind: TaxonomyStructuralKinds.system,
        semanticRole: TaxonomySemanticRoles.system,
        behaviorKind: TaxonomyBehaviorKinds.autonomous,
      },
    });

    expect(atomic.payload.taxonomy.structuralKind).toBe("atomic");
    expect(composite.payload.taxonomy.structuralKind).toBe("composite");
    expect(system.payload.taxonomy.structuralKind).toBe("system");
    expect(systemOfSystems.payload.taxonomy.semanticRole).toBe("system");
    expect(systemOfSystems.payload.versionId).toBe("handoff-system-of-systems:v1");
    expect(systemOfSystems.payload.pinnedVersion?.versionId).toBe("handoff-system-of-systems:v1");
    expect(systemOfSystems.payload.systemOfSystems?.rootSystem.assetId).toBe("asset:handoff-system-of-systems");
    expect(systemOfSystems.payload.systemOfSystems?.rootSystem.structureRole).toBe("root-system");
  });

  it("preserves source/target identities and remains scoped to studio-handoff contracts", () => {
    const handoff = createHandoffForTaxonomy({
      id: "handoff-source-target",
      taxonomy: {
        structuralKind: TaxonomyStructuralKinds.composite,
        semanticRole: TaxonomySemanticRoles.contextBundle,
        behaviorKind: TaxonomyBehaviorKinds.none,
      },
    });

    expect(handoff.id.equals("handoff-source-target")).toBeTrue();
    expect(handoff.source).toEqual({
      studioId: "studio-source",
      studioType: "dataset-studio",
      sessionId: "session-source",
      draftId: "draft-source",
    });
    expect(handoff.target).toEqual({
      studioId: "studio-target",
      studioType: "system-studio",
      sessionId: "session-target",
      draftId: "draft-target",
    });
    expect(handoff.domain).toBe("studio-handoff");
    expect((handoff as unknown as { readonly execution?: unknown }).execution).toBeUndefined();
    expect((handoff as unknown as { readonly deployment?: unknown }).deployment).toBeUndefined();
  });

  it("normalizes identifiers through StudioHandoffContractId", () => {
    const id = new StudioHandoffContractId("  handoff-id  ");
    const handoff = createHandoffForTaxonomy({
      id,
      taxonomy: {
        structuralKind: TaxonomyStructuralKinds.atomic,
        semanticRole: TaxonomySemanticRoles.model,
        behaviorKind: TaxonomyBehaviorKinds.none,
      },
    });

    expect(handoff.id.value).toBe("handoff-id");
  });

  it("supports typed multi-asset handoff bundles with role semantics and version-aware identity", () => {
    const datasetTaxonomy = createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.atomic,
      semanticRole: TaxonomySemanticRoles.dataset,
      behaviorKind: TaxonomyBehaviorKinds.none,
    });
    const modelTaxonomy = createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.atomic,
      semanticRole: TaxonomySemanticRoles.model,
      behaviorKind: TaxonomyBehaviorKinds.none,
    });

    const handoff = createStudioHandoffContract({
      id: "handoff-multi-asset",
      source: {
        studioId: "studio-source",
        studioType: "dataset-studio",
      },
      target: {
        studioId: "studio-target",
        studioType: "training-recipe-studio",
      },
      payload: {
        assetId: "asset:dataset",
        versionId: "asset:dataset:v7",
        taxonomy: datasetTaxonomy,
        contract: resolver.resolveContractForTaxonomy(datasetTaxonomy),
        targetInputContract: {
          contractId: "training-default-input",
        },
      },
      multiAsset: {
        grouped: true,
        requireAllAssets: true,
        assets: [
          {
            role: StudioHandoffAssetRoles.primary,
            assetId: "asset:dataset",
            versionId: "asset:dataset:v7",
            taxonomy: datasetTaxonomy,
          },
          {
            role: StudioHandoffAssetRoles.supporting,
            roleLabel: "model",
            assetId: "asset:model",
            versionId: "asset:model:v3",
            taxonomy: modelTaxonomy,
            context: {
              usage: "seed-model",
            },
          },
        ],
      },
      intent: {
        kind: StudioHandoffIntentKinds.compositionAssembly,
      },
      context: {
        sourceReferences: [
          { assetId: "asset:dataset", versionId: "asset:dataset:v7", relation: "primary" },
          { assetId: "asset:model", versionId: "asset:model:v3", relation: "supporting" },
        ],
      },
    });

    expect(handoff.multiAsset?.grouped).toBeTrue();
    expect(handoff.multiAsset?.assets).toHaveLength(2);
    expect(handoff.multiAsset?.assets[1]?.roleLabel).toBe("model");
    expect(handoff.multiAsset?.assets[1]?.versionId).toBe("asset:model:v3");
    expect(handoff.multiAsset?.assets[1]?.pinnedVersion?.versionId).toBe("asset:model:v3");
  });

  it("captures explicit system-of-systems context for system handoffs with nested references", () => {
    const systemTaxonomy = createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.system,
      semanticRole: TaxonomySemanticRoles.system,
      behaviorKind: TaxonomyBehaviorKinds.iterative,
    });

    const handoff = createStudioHandoffContract({
      id: "handoff-system-context",
      source: {
        studioId: "system-studio-source",
        studioType: "system-studio",
      },
      target: {
        studioId: "system-studio-target",
        studioType: "system-studio",
      },
      payload: {
        assetId: "system:root",
        versionId: "system:root:v2",
        taxonomy: systemTaxonomy,
        contract: resolver.resolveContractForTaxonomy(systemTaxonomy),
        targetInputContract: {
          contractId: "system-default-input",
        },
      },
      multiAsset: {
        grouped: true,
        requireAllAssets: true,
        assets: [
          {
            role: StudioHandoffAssetRoles.primary,
            assetId: "system:root",
            versionId: "system:root:v2",
            taxonomy: systemTaxonomy,
          },
          {
            role: StudioHandoffAssetRoles.systemComponent,
            assetId: "system:nested",
            versionId: "system:nested:v9",
            taxonomy: systemTaxonomy,
          },
        ],
      },
      context: {
        sourceReferences: [
          { assetId: "system:root", versionId: "system:root:v2", relation: "system-root" },
          { assetId: "system:nested", versionId: "system:nested:v9", relation: "system-of-systems-child" },
        ],
      },
      intent: {
        kind: StudioHandoffIntentKinds.systemIntegration,
      },
    });

    expect(handoff.payload.systemOfSystems?.rootSystem.assetId).toBe("system:root");
    expect(handoff.payload.systemOfSystems?.rootSystem.nestedSystemReferences[0]?.assetId).toBe("system:nested");
    expect(handoff.payload.systemOfSystems?.nestedSystems[0]?.assetId).toBe("system:nested");
  });
});
