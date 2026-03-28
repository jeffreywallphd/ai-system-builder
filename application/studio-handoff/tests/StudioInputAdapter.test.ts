import { describe, expect, it } from "bun:test";
import { CompositionAssetContractResolver } from "../../contracts/CompositionAssetContractResolver";
import {
  createStudioHandoffContract,
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
  AtomicStudioInputAdapter,
  CompositeStudioInputAdapter,
  StudioInputAdapterLayer,
  StudioInputAdapterRegistry,
  SystemStudioInputAdapter,
} from "../StudioInputAdapter";
import {
  StudioHandoffCompatibilityIssueCodes,
  StudioHandoffCompatibilityValidator,
  type StudioCapabilityDescriptor,
} from "../StudioHandoffCompatibilityValidator";

const resolver = new CompositionAssetContractResolver();

function createCapabilities(): ReadonlyArray<StudioCapabilityDescriptor> {
  return Object.freeze([
    {
      studioType: "dataset-studio",
      acceptedInputs: Object.freeze([
        {
          contractId: "dataset-default-input",
          acceptedStructuralKinds: ["atomic"],
          acceptedSemanticRoles: ["dataset"],
          acceptedBehaviorKinds: ["none"],
          allowedContextKeys: ["split", "seed", "assetId"],
        },
      ]),
    },
    {
      studioType: "workflow-studio",
      acceptedInputs: Object.freeze([
        {
          contractId: "workflow-default-input",
          acceptedStructuralKinds: ["composite", "atomic"],
          acceptedSemanticRoles: ["workflow", "dataset"],
          acceptedBehaviorKinds: ["deterministic", "none"],
          allowedContextKeys: ["split", "trainingObjective", "assetId"],
        },
      ]),
    },
    {
      studioType: "system-studio",
      acceptedInputs: Object.freeze([
        {
          contractId: "system-default-input",
          acceptedStructuralKinds: ["atomic", "composite", "system"],
          acceptedSemanticRoles: ["dataset", "workflow", "system", "model"],
          acceptedBehaviorKinds: ["none", "deterministic", "iterative", "autonomous"],
          allowedContextKeys: ["split", "trainingObjective", "priority", "nestedStrategy", "assetId"],
        },
      ]),
    },
  ]);
}

function createHandoff(input: {
  readonly id: string;
  readonly sourceStudioType: string;
  readonly targetStudioType: string;
  readonly assetId: string;
  readonly versionId: string;
  readonly contractId: string;
  readonly taxonomy: {
    readonly structuralKind: "atomic" | "composite" | "system";
    readonly semanticRole: "dataset" | "workflow" | "system";
    readonly behaviorKind: "none" | "deterministic" | "iterative" | "autonomous";
  };
  readonly prefill?: Readonly<Record<string, unknown>>;
}): StudioHandoffContract {
  const taxonomy = createCompositionTaxonomyDescriptor(input.taxonomy);
  return createStudioHandoffContract({
    id: input.id,
    source: {
      studioId: `${input.sourceStudioType}-default`,
      studioType: input.sourceStudioType,
      sessionId: `${input.sourceStudioType}-session`,
    },
    target: {
      studioId: `${input.targetStudioType}-default`,
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
      kind: StudioHandoffIntentKinds.authoringContinuation,
      description: "handoff for studio entry",
    },
    context: {
      sourceReferences: [
        { assetId: input.assetId, versionId: input.versionId, relation: "primary" },
        { assetId: "asset:system-parent", versionId: "asset:system-parent:v2", relation: "system-of-systems" },
      ],
      prefill: {
        values: {
          ...(input.prefill ?? {}),
          assetId: "prefill-override-attempt",
        },
        hintOnlyKeys: ["assetId", ...Object.keys(input.prefill ?? {})],
      },
      provenance: {
        correlationId: `${input.id}-corr`,
        sourceSessionId: `${input.sourceStudioType}-session`,
      },
    },
  });
}

function createAdapterLayer(): StudioInputAdapterLayer {
  const registry = new StudioInputAdapterRegistry();
  registry.register(new AtomicStudioInputAdapter(["dataset-studio", "model-studio", "tool-studio"]));
  registry.register(new CompositeStudioInputAdapter(["workflow-studio", "context-bundle-studio", "tool-chain-studio"]));
  registry.register(new SystemStudioInputAdapter(["system-studio"]));

  return new StudioInputAdapterLayer(
    new StudioHandoffCompatibilityValidator({
      validateVersionReference: ({ versionId }) => versionId.includes(":v"),
    }),
    registry,
  );
}

describe("StudioInputAdapterLayer", () => {
  it("adapts valid handoffs for representative atomic, composite, and system studios", () => {
    const layer = createAdapterLayer();
    const capabilities = createCapabilities();

    const atomic = layer.adapt({
      handoff: createHandoff({
        id: "atomic",
        sourceStudioType: "workflow-studio",
        targetStudioType: "dataset-studio",
        assetId: "asset:dataset",
        versionId: "asset:dataset:v1",
        contractId: "dataset-default-input",
        taxonomy: {
          structuralKind: TaxonomyStructuralKinds.atomic,
          semanticRole: TaxonomySemanticRoles.dataset,
          behaviorKind: TaxonomyBehaviorKinds.none,
        },
        prefill: { split: "train" },
      }),
      targetCapabilities: capabilities,
    });

    const composite = layer.adapt({
      handoff: createHandoff({
        id: "composite",
        sourceStudioType: "dataset-studio",
        targetStudioType: "workflow-studio",
        assetId: "asset:workflow",
        versionId: "asset:workflow:v3",
        contractId: "workflow-default-input",
        taxonomy: {
          structuralKind: TaxonomyStructuralKinds.composite,
          semanticRole: TaxonomySemanticRoles.workflow,
          behaviorKind: TaxonomyBehaviorKinds.deterministic,
        },
        prefill: { trainingObjective: "classification" },
      }),
      targetCapabilities: capabilities,
    });

    const system = layer.adapt({
      handoff: createHandoff({
        id: "system",
        sourceStudioType: "workflow-studio",
        targetStudioType: "system-studio",
        assetId: "asset:system",
        versionId: "asset:system:v2",
        contractId: "system-default-input",
        taxonomy: {
          structuralKind: TaxonomyStructuralKinds.system,
          semanticRole: TaxonomySemanticRoles.system,
          behaviorKind: TaxonomyBehaviorKinds.iterative,
        },
        prefill: { nestedStrategy: "compose" },
      }),
      targetCapabilities: capabilities,
    });

    expect(atomic.ok).toBeTrue();
    expect(atomic.adapted?.kind).toBe("atomic");
    expect(composite.ok).toBeTrue();
    expect(composite.adapted?.kind).toBe("composite");
    expect(system.ok).toBeTrue();
    expect(system.adapted?.kind).toBe("system");
  });

  it("blocks invalid or incompatible handoffs with structured outcomes", () => {
    const layer = createAdapterLayer();
    const capabilities = createCapabilities();

    const incompatible = layer.adapt({
      handoff: createHandoff({
        id: "incompatible",
        sourceStudioType: "dataset-studio",
        targetStudioType: "workflow-studio",
        assetId: "asset:dataset",
        versionId: "asset:dataset:bad",
        contractId: "workflow-default-input",
        taxonomy: {
          structuralKind: TaxonomyStructuralKinds.atomic,
          semanticRole: TaxonomySemanticRoles.dataset,
          behaviorKind: TaxonomyBehaviorKinds.none,
        },
        prefill: { disallowed: true },
      }),
      targetCapabilities: capabilities,
    });

    expect(incompatible.ok).toBeFalse();
    expect(incompatible.issues[0]?.code).toBe("compatibility-failed");
    expect(incompatible.compatibility.issues.map((issue) => issue.code)).toContain(StudioHandoffCompatibilityIssueCodes.contextKeyNotAllowed);
  });

  it("preserves authoritative asset facts while surfacing bounded prefill/context hints", () => {
    const layer = createAdapterLayer();
    const capabilities = createCapabilities();
    const handoff = createHandoff({
      id: "preserve-authoritative",
      sourceStudioType: "workflow-studio",
      targetStudioType: "dataset-studio",
      assetId: "asset:authoritative-dataset",
      versionId: "asset:authoritative-dataset:v11",
      contractId: "dataset-default-input",
      taxonomy: {
        structuralKind: TaxonomyStructuralKinds.atomic,
        semanticRole: TaxonomySemanticRoles.dataset,
        behaviorKind: TaxonomyBehaviorKinds.none,
      },
      prefill: { split: "validation" },
    });

    const result = layer.adapt({ handoff, targetCapabilities: capabilities });
    expect(result.ok).toBeTrue();
    expect(result.adapted?.authoritativeAsset.assetId).toBe("asset:authoritative-dataset");
    expect(result.adapted?.authoritativeAsset.versionId).toBe("asset:authoritative-dataset:v11");
    expect(result.adapted?.prefill.assetId).toBe("prefill-override-attempt");
    expect(result.adapted?.authoritativeAsset.assetId).not.toBe(result.adapted?.prefill.assetId);
  });
});
