import { describe, expect, it } from "bun:test";
import { CompositionAssetContractResolver } from "../../contracts/CompositionAssetContractResolver";
import {
  AtomicStudioOutputAdapter,
  CompositeStudioOutputAdapter,
  StudioOutputAdapterLayer,
  StudioOutputAdapterRegistry,
  SystemStudioOutputAdapter,
} from "../StudioOutputAdapter";
import {
  createCompositionTaxonomyDescriptor,
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
} from "@domain/taxonomy/CompositionTaxonomy";

const resolver = new CompositionAssetContractResolver();

function createAdapterLayer(): StudioOutputAdapterLayer {
  const registry = new StudioOutputAdapterRegistry();
  registry.register(new AtomicStudioOutputAdapter(["dataset-studio", "model-studio", "tool-studio"]));
  registry.register(new CompositeStudioOutputAdapter(["workflow-studio", "context-bundle-studio", "tool-chain-studio"]));
  registry.register(new SystemStudioOutputAdapter(["system-studio"]));
  return new StudioOutputAdapterLayer(registry);
}

describe("StudioOutputAdapterLayer", () => {
  it("adapts representative atomic, composite, and system studio outputs into canonical handoff-ready outputs", () => {
    const layer = createAdapterLayer();

    const atomic = layer.adapt({
      sourceStudioType: "dataset-studio",
      sourceStudioId: "dataset-studio-default",
      authoritativeAsset: {
        assetId: "asset:dataset",
        versionId: "asset:dataset:v1",
        taxonomy: createCompositionTaxonomyDescriptor({
          structuralKind: TaxonomyStructuralKinds.atomic,
          semanticRole: TaxonomySemanticRoles.dataset,
          behaviorKind: TaxonomyBehaviorKinds.none,
        }),
        contract: resolver.resolveContractForTaxonomy(createCompositionTaxonomyDescriptor({
          structuralKind: TaxonomyStructuralKinds.atomic,
          semanticRole: TaxonomySemanticRoles.dataset,
          behaviorKind: TaxonomyBehaviorKinds.none,
        })),
      },
      handoffHints: { split: "train" },
    });

    const composite = layer.adapt({
      sourceStudioType: "workflow-studio",
      sourceStudioId: "workflow-studio-default",
      authoritativeAsset: {
        assetId: "asset:workflow",
        versionId: "asset:workflow:v2",
        taxonomy: createCompositionTaxonomyDescriptor({
          structuralKind: TaxonomyStructuralKinds.composite,
          semanticRole: TaxonomySemanticRoles.workflow,
          behaviorKind: TaxonomyBehaviorKinds.deterministic,
        }),
      },
      sourceReferences: [
        { assetId: "asset:dataset", versionId: "asset:dataset:v7", relation: "dependency" },
      ],
      handoffHints: { trainingObjective: "classification" },
    });

    const system = layer.adapt({
      sourceStudioType: "system-studio",
      sourceStudioId: "system-studio-default",
      authoritativeAsset: {
        assetId: "asset:system",
        versionId: "asset:system:v4",
        taxonomy: createCompositionTaxonomyDescriptor({
          structuralKind: TaxonomyStructuralKinds.system,
          semanticRole: TaxonomySemanticRoles.system,
          behaviorKind: TaxonomyBehaviorKinds.iterative,
        }),
      },
      sourceReferences: [
        { assetId: "asset:workflow", versionId: "asset:workflow:v2", relation: "system-child" },
        { assetId: "asset:system-parent", versionId: "asset:system-parent:v1", relation: "system-of-systems" },
      ],
      handoffHints: { nestedStrategy: "compose" },
    });

    expect(atomic.ok).toBeTrue();
    expect(atomic.adapted?.kind).toBe("atomic");
    expect(composite.ok).toBeTrue();
    expect(composite.adapted?.kind).toBe("composite");
    expect(system.ok).toBeTrue();
    expect(system.adapted?.kind).toBe("system");
  });

  it("preserves authoritative identity/version/taxonomy/contract facts while keeping handoff hints bounded", () => {
    const layer = createAdapterLayer();
    const taxonomy = createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.atomic,
      semanticRole: TaxonomySemanticRoles.dataset,
      behaviorKind: TaxonomyBehaviorKinds.none,
    });
    const contract = resolver.resolveContractForTaxonomy(taxonomy);

    const output = layer.adapt({
      sourceStudioType: "dataset-studio",
      sourceStudioId: "dataset-studio-default",
      authoritativeAsset: {
        assetId: "asset:authoritative",
        versionId: "asset:authoritative:v11",
        taxonomy,
        contract,
      },
      handoffHints: {
        assetId: "hint-override-attempt",
        split: "validation",
      },
    });

    expect(output.ok).toBeTrue();
    expect(output.adapted?.authoritativeAsset.assetId).toBe("asset:authoritative");
    expect(output.adapted?.authoritativeAsset.versionId).toBe("asset:authoritative:v11");
    expect(output.adapted?.authoritativeAsset.pinnedVersion.versionId).toBe("asset:authoritative:v11");
    expect(output.adapted?.authoritativeAsset.taxonomy.semanticRole).toBe(TaxonomySemanticRoles.dataset);
    expect(output.adapted?.authoritativeAsset.contract?.id).toBe(contract.id);
    expect(output.adapted?.handoffMetadata.hints.assetId).toBe("hint-override-attempt");
    expect(output.adapted?.authoritativeAsset.assetId).not.toBe(output.adapted?.handoffMetadata.hints.assetId as string);
  });

  it("reuses bounded output adaptation results for unchanged version-pinned source output", () => {
    const layer = createAdapterLayer();
    const taxonomy = createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.atomic,
      semanticRole: TaxonomySemanticRoles.dataset,
      behaviorKind: TaxonomyBehaviorKinds.none,
    });

    const output = {
      sourceStudioType: "dataset-studio",
      sourceStudioId: "dataset-studio-default",
      authoritativeAsset: {
        assetId: "asset:dataset",
        versionId: "asset:dataset:v3",
        taxonomy,
      },
      handoffHints: {
        split: "train",
      },
    } as const;

    const first = layer.adapt(output);
    const second = layer.adapt(output);
    expect(second).toBe(first);
  });
});

