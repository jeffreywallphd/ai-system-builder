import { describe, expect, it } from "bun:test";
import { CompositionAssetContractResolver } from "../../contracts/CompositionAssetContractResolver";
import {
  createStudioHandoffContract,
  StudioHandoffAssetRoles,
  StudioHandoffIntentKinds,
  type StudioHandoffContract,
} from "../../../domain/studio-handoff/StudioHandoffContract";
import {
  createCompositionTaxonomyDescriptor,
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
} from "../../../domain/taxonomy/CompositionTaxonomy";
import {
  StudioHandoffCompatibilityValidator,
  type StudioCapabilityDescriptor,
} from "../StudioHandoffCompatibilityValidator";
import {
  AtomicStudioInputAdapter,
  CompositeStudioInputAdapter,
  StudioInputAdapterLayer,
  StudioInputAdapterRegistry,
  SystemStudioInputAdapter,
} from "../StudioInputAdapter";
import {
  AtomicStudioOutputAdapter,
  CompositeStudioOutputAdapter,
  StudioOutputAdapterLayer,
  StudioOutputAdapterRegistry,
  SystemStudioOutputAdapter,
} from "../StudioOutputAdapter";
import { StudioHandoffOrchestrationService } from "../StudioHandoffOrchestrationService";

const resolver = new CompositionAssetContractResolver();

function createCapabilities(): ReadonlyArray<StudioCapabilityDescriptor> {
  return Object.freeze([
    {
      studioType: "workflow-studio",
      acceptedInputs: Object.freeze([
        {
          contractId: "workflow-default-input",
          acceptedStructuralKinds: ["atomic", "composite"],
          acceptedSemanticRoles: ["dataset", "workflow"],
          acceptedBehaviorKinds: ["none", "deterministic"],
          allowedContextKeys: ["split", "trainingObjective"],
        },
      ]),
    },
    {
      studioType: "system-studio",
      acceptedInputs: Object.freeze([
        {
          contractId: "system-default-input",
          acceptedStructuralKinds: ["atomic", "composite", "system"],
          acceptedSemanticRoles: ["workflow", "system", "dataset", "model"],
          acceptedBehaviorKinds: ["none", "deterministic", "iterative", "autonomous"],
          allowedContextKeys: ["nestedStrategy", "priority"],
        },
      ]),
    },
  ]);
}

function createService(): StudioHandoffOrchestrationService {
  const outputRegistry = new StudioOutputAdapterRegistry();
  outputRegistry.register(new AtomicStudioOutputAdapter(["dataset-studio", "model-studio", "tool-studio"]));
  outputRegistry.register(new CompositeStudioOutputAdapter(["workflow-studio", "context-bundle-studio", "tool-chain-studio"]));
  outputRegistry.register(new SystemStudioOutputAdapter(["system-studio"]));

  const inputRegistry = new StudioInputAdapterRegistry();
  inputRegistry.register(new AtomicStudioInputAdapter(["dataset-studio", "model-studio", "tool-studio"]));
  inputRegistry.register(new CompositeStudioInputAdapter(["workflow-studio", "context-bundle-studio", "tool-chain-studio"]));
  inputRegistry.register(new SystemStudioInputAdapter(["system-studio"]));

  return new StudioHandoffOrchestrationService(
    new StudioOutputAdapterLayer(outputRegistry),
    new StudioInputAdapterLayer(
      new StudioHandoffCompatibilityValidator({
        validateVersionReference: ({ versionId }) => versionId.includes(":v"),
      }),
      inputRegistry,
    ),
  );
}

function createExistingHandoff(input: {
  readonly id: string;
  readonly sourceStudioType: string;
  readonly sourceStudioId: string;
  readonly targetStudioType: string;
  readonly targetStudioId: string;
  readonly assetId: string;
  readonly versionId: string;
  readonly contractId: string;
  readonly taxonomy: {
    readonly structuralKind: "atomic" | "composite" | "system";
    readonly semanticRole: "dataset" | "workflow" | "system";
    readonly behaviorKind: "none" | "deterministic" | "iterative";
  };
  readonly prefill?: Readonly<Record<string, unknown>>;
}): StudioHandoffContract {
  const taxonomy = createCompositionTaxonomyDescriptor(input.taxonomy);
  return createStudioHandoffContract({
    id: input.id,
    source: {
      studioId: input.sourceStudioId,
      studioType: input.sourceStudioType,
      sessionId: `${input.sourceStudioType}-session`,
    },
    target: {
      studioId: input.targetStudioId,
      studioType: input.targetStudioType,
      sessionId: `${input.targetStudioType}-session`,
    },
    payload: {
      assetId: input.assetId,
      versionId: input.versionId,
      taxonomy,
      contract: resolver.resolveContractForTaxonomy(taxonomy),
      targetInputContract: {
        contractId: input.contractId,
      },
    },
    intent: {
      kind: StudioHandoffIntentKinds.compositionAssembly,
    },
    context: {
      sourceReferences: [
        { assetId: input.assetId, versionId: input.versionId, relation: "primary" },
      ],
      prefill: {
        values: {
          ...(input.prefill ?? {}),
        },
      },
    },
  });
}

describe("StudioHandoffOrchestrationService", () => {
  it("orchestrates representative atomic→composite and composite→system handoffs through output+compatibility+input adapters", () => {
    const service = createService();
    const capabilities = createCapabilities();

    const atomicToComposite = service.orchestrate({
      handoffId: "atomic-to-composite",
      source: {
        studioId: "dataset-studio-default",
        studioType: "dataset-studio",
      },
      target: {
        studioId: "workflow-studio-default",
        studioType: "workflow-studio",
      },
      sourceOutput: {
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
        },
        handoffHints: { trainingObjective: "classification" },
      },
      targetInputContract: {
        contractId: "workflow-default-input",
      },
      intent: {
        kind: StudioHandoffIntentKinds.compositionAssembly,
      },
      targetCapabilities: capabilities,
    });

    const compositeToSystem = service.orchestrate({
      handoff: createExistingHandoff({
        id: "composite-to-system",
        sourceStudioType: "workflow-studio",
        sourceStudioId: "workflow-studio-default",
        targetStudioType: "system-studio",
        targetStudioId: "system-studio-default",
        assetId: "asset:workflow",
        versionId: "asset:workflow:v2",
        contractId: "system-default-input",
        taxonomy: {
          structuralKind: TaxonomyStructuralKinds.composite,
          semanticRole: TaxonomySemanticRoles.workflow,
          behaviorKind: TaxonomyBehaviorKinds.deterministic,
        },
        prefill: {
          nestedStrategy: "compose",
        },
      }),
      sourceOutput: {
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
          { assetId: "asset:dataset", versionId: "asset:dataset:v5", relation: "dependency" },
          { assetId: "asset:system-parent", versionId: "asset:system-parent:v1", relation: "system-of-systems" },
        ],
        handoffHints: { nestedStrategy: "compose" },
      },
      targetCapabilities: capabilities,
    });

    expect(atomicToComposite.ok).toBeTrue();
    expect(atomicToComposite.preparation?.sourceOutput.kind).toBe("atomic");
    expect(atomicToComposite.preparation?.targetInput.kind).toBe("composite");

    expect(compositeToSystem.ok).toBeTrue();
    expect(compositeToSystem.preparation?.sourceOutput.kind).toBe("composite");
    expect(compositeToSystem.preparation?.targetInput.kind).toBe("system");
  });

  it("returns structured compatibility-grounded failures for invalid handoffs", () => {
    const service = createService();
    const capabilities = createCapabilities();

    const invalid = service.orchestrate({
      handoffId: "invalid-version",
      source: {
        studioId: "dataset-studio-default",
        studioType: "dataset-studio",
      },
      target: {
        studioId: "workflow-studio-default",
        studioType: "workflow-studio",
      },
      sourceOutput: {
        sourceStudioType: "dataset-studio",
        sourceStudioId: "dataset-studio-default",
        authoritativeAsset: {
          assetId: "asset:dataset",
          versionId: "asset:dataset:bad",
          taxonomy: createCompositionTaxonomyDescriptor({
            structuralKind: TaxonomyStructuralKinds.atomic,
            semanticRole: TaxonomySemanticRoles.dataset,
            behaviorKind: TaxonomyBehaviorKinds.none,
          }),
        },
        handoffHints: { disallowed: true },
      },
      targetInputContract: {
        contractId: "workflow-default-input",
      },
      intent: {
        kind: StudioHandoffIntentKinds.authoringContinuation,
      },
      targetCapabilities: capabilities,
    });

    expect(invalid.ok).toBeFalse();
    expect(invalid.failure?.stage).toBe("input-adaptation");
    expect(invalid.failure?.compatibility?.compatible).toBeFalse();
    expect(invalid.failure?.compatibility?.issues.map((entry) => entry.code)).toContain("version-reference-invalid");
    expect(invalid.failure?.compatibility?.issues.map((entry) => entry.code)).toContain("context-key-not-allowed");
  });

  it("preserves authoritative asset identity/version/taxonomy through orchestration", () => {
    const service = createService();
    const capabilities = createCapabilities();

    const result = service.orchestrate({
      handoffId: "preserve-authoritative-facts",
      source: {
        studioId: "dataset-studio-default",
        studioType: "dataset-studio",
      },
      target: {
        studioId: "workflow-studio-default",
        studioType: "workflow-studio",
      },
      sourceOutput: {
        sourceStudioType: "dataset-studio",
        sourceStudioId: "dataset-studio-default",
        authoritativeAsset: {
          assetId: "asset:authoritative",
          versionId: "asset:authoritative:v9",
          taxonomy: createCompositionTaxonomyDescriptor({
            structuralKind: TaxonomyStructuralKinds.atomic,
            semanticRole: TaxonomySemanticRoles.dataset,
            behaviorKind: TaxonomyBehaviorKinds.none,
          }),
        },
        handoffHints: {
          trainingObjective: "regression",
        },
      },
      targetInputContract: {
        contractId: "workflow-default-input",
      },
      intent: {
        kind: StudioHandoffIntentKinds.compositionAssembly,
      },
      targetCapabilities: capabilities,
    });

    expect(result.ok).toBeTrue();
    expect(result.preparation?.sourceOutput.authoritativeAsset.assetId).toBe("asset:authoritative");
    expect(result.preparation?.handoff.payload.assetId).toBe("asset:authoritative");
    expect(result.preparation?.targetInput.authoritativeAsset.assetId).toBe("asset:authoritative");
    expect(result.preparation?.sourceOutput.handoffMetadata.hints.trainingObjective).toBe("regression");
  });

  it("supports incremental handoff refresh with revision linkage, changed fields, and revalidation", () => {
    const service = createService();
    const capabilities = createCapabilities();
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

    const basis = createStudioHandoffContract({
      id: "basis-handoff",
      source: {
        studioId: "dataset-studio-default",
        studioType: "dataset-studio",
      },
      target: {
        studioId: "system-studio-default",
        studioType: "system-studio",
      },
      payload: {
        assetId: "asset:dataset",
        versionId: "asset:dataset:v1",
        taxonomy: datasetTaxonomy,
        contract: resolver.resolveContractForTaxonomy(datasetTaxonomy),
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
            assetId: "asset:dataset",
            versionId: "asset:dataset:v1",
            taxonomy: datasetTaxonomy,
          },
          {
            role: StudioHandoffAssetRoles.supporting,
            roleLabel: "model",
            assetId: "asset:model",
            versionId: "asset:model:v1",
            taxonomy: modelTaxonomy,
          },
        ],
      },
      intent: {
        kind: StudioHandoffIntentKinds.compositionAssembly,
      },
      context: {
        sourceReferences: [
          { assetId: "asset:dataset", versionId: "asset:dataset:v1", relation: "primary" },
          { assetId: "asset:model", versionId: "asset:model:v1", relation: "supporting" },
        ],
        prefill: {
          values: {
            priority: "normal",
          },
        },
      },
    });

    const updated = service.refreshStudioHandoff({
      basis,
      update: {
        revisionId: "rev-2",
        assetVersionUpdates: [
          { assetId: "asset:dataset", versionId: "asset:dataset:v2", role: "primary" },
          { assetId: "asset:model", versionId: "asset:model:v3", role: "supporting" },
        ],
        contextPrefillPatch: {
          priority: "urgent",
        },
        contextProvenancePatch: {
          correlationId: "corr-updated",
        },
      },
      sourceOutput: {
        sourceStudioType: "dataset-studio",
        sourceStudioId: "dataset-studio-default",
        authoritativeAsset: {
          assetId: "asset:dataset",
          versionId: "asset:dataset:v2",
          taxonomy: datasetTaxonomy,
          contract: resolver.resolveContractForTaxonomy(datasetTaxonomy),
        },
        sourceReferences: [
          { assetId: "asset:dataset", versionId: "asset:dataset:v2", relation: "primary" },
          { assetId: "asset:model", versionId: "asset:model:v3", relation: "supporting" },
        ],
        handoffHints: {
          priority: "urgent",
        },
      },
      targetCapabilities: capabilities,
    });

    expect(updated.ok).toBeTrue();
    expect(updated.revision?.previousHandoffId).toBe("basis-handoff");
    expect(updated.revision?.updatedHandoffId).toContain("basis-handoff:rev");
    expect(updated.changes?.updatedAuthoritativeAsset).toBeTrue();
    expect(updated.changes?.updatedBundleAssets).toHaveLength(2);
    expect(updated.changes?.updatedContextPrefillKeys).toContain("priority");
    expect(updated.preparation?.handoff.payload.versionId).toBe("asset:dataset:v2");
    expect(updated.preparation?.compatibility.compatible).toBeTrue();
  });
});
