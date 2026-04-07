import { describe, expect, it } from "bun:test";
import { CompositionAssetContractResolver } from "../../contracts/CompositionAssetContractResolver";
import {
  StudioHandoffCompatibilityValidator,
  StudioHandoffCompatibilityIssueCodes,
} from "../StudioHandoffCompatibilityValidator";
import type { StudioCapabilityDescriptor } from "../StudioCapabilityRegistry";
import {
  createStudioHandoffContract,
  StudioHandoffAssetRoles,
  StudioHandoffIntentKinds,
  type StudioHandoffContract,
} from "@domain/studio-handoff/StudioHandoffContract";
import {
  createCompositionTaxonomyDescriptor,
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
} from "@domain/taxonomy/CompositionTaxonomy";

const resolver = new CompositionAssetContractResolver();

function createHandoff(input: {
  readonly id: string;
  readonly sourceType: string;
  readonly targetType: string;
  readonly taxonomy: {
    readonly structuralKind: "atomic" | "composite" | "system";
    readonly semanticRole: "model" | "dataset" | "workflow" | "system";
    readonly behaviorKind: "none" | "deterministic" | "iterative" | "autonomous";
  };
  readonly context?: Readonly<Record<string, unknown>>;
  readonly versionId?: string;
  readonly contractOverride?: ReturnType<CompositionAssetContractResolver["resolveContractForTaxonomy"]>;
  readonly targetInputContractId?: string;
}): StudioHandoffContract {
  const taxonomy = createCompositionTaxonomyDescriptor(input.taxonomy);
  const projectedContract = input.contractOverride ?? resolver.resolveContractForTaxonomy(taxonomy);

  return createStudioHandoffContract({
    id: input.id,
    source: { studioId: `source-${input.id}`, studioType: input.sourceType },
    target: { studioId: `target-${input.id}`, studioType: input.targetType },
    payload: {
      assetId: `asset:${input.id}`,
      versionId: input.versionId ?? `${input.id}:v1`,
      taxonomy,
      contract: projectedContract,
      targetInputContract: {
        contractId: input.targetInputContractId ?? "system-default-input",
      },
    },
    context: input.context
      ? {
        sourceReferences: [{ assetId: `asset:${input.id}`, versionId: input.versionId ?? `${input.id}:v1`, relation: "primary" }],
        prefill: { values: input.context, hintOnlyKeys: Object.keys(input.context) },
        provenance: { correlationId: `${input.id}-corr` },
      }
      : {
        sourceReferences: [{ assetId: `asset:${input.id}`, versionId: input.versionId ?? `${input.id}:v1`, relation: "primary" }],
      },
    intent: {
      kind: StudioHandoffIntentKinds.authoringContinuation,
    },
  });
}

function createCapabilities(): ReadonlyArray<StudioCapabilityDescriptor> {
  const datasetTaxonomy = createCompositionTaxonomyDescriptor({
    structuralKind: TaxonomyStructuralKinds.atomic,
    semanticRole: TaxonomySemanticRoles.dataset,
    behaviorKind: TaxonomyBehaviorKinds.none,
  });
  const workflowTaxonomy = createCompositionTaxonomyDescriptor({
    structuralKind: TaxonomyStructuralKinds.composite,
    semanticRole: TaxonomySemanticRoles.workflow,
    behaviorKind: TaxonomyBehaviorKinds.deterministic,
  });
  const systemTaxonomy = createCompositionTaxonomyDescriptor({
    structuralKind: TaxonomyStructuralKinds.system,
    semanticRole: TaxonomySemanticRoles.system,
    behaviorKind: TaxonomyBehaviorKinds.iterative,
  });

  return Object.freeze([
    {
      studioType: "workflow-studio",
      acceptsMultiAssetHandoffs: true,
      producesMultiAssetHandoffs: true,
      producedOutputs: Object.freeze([]),
      acceptedInputs: Object.freeze([
        {
          capabilityId: "workflow-dataset-input",
          supportsGroupedMultiAsset: false,
          contract: {
            contractId: "workflow-dataset-input",
            acceptedStructuralKinds: ["atomic"],
            acceptedSemanticRoles: ["dataset"],
            acceptedBehaviorKinds: ["none"],
            requireVersionedAsset: true,
            expectedContract: resolver.resolveContractForTaxonomy(datasetTaxonomy),
            allowedContextKeys: ["datasetSplit"],
          },
        },
      ]),
    },
    {
      studioType: "system-studio",
      acceptsMultiAssetHandoffs: true,
      producesMultiAssetHandoffs: true,
      producedOutputs: Object.freeze([]),
      acceptedInputs: Object.freeze([
        {
          capabilityId: "system-default-input",
          supportsGroupedMultiAsset: true,
          contract: {
            contractId: "system-default-input",
            acceptedStructuralKinds: ["atomic", "composite", "system"],
            acceptedSemanticRoles: ["dataset", "workflow", "system", "model"],
            acceptedBehaviorKinds: ["none", "deterministic", "iterative", "autonomous"],
            requireVersionedAsset: true,
            allowedContextKeys: ["reason", "priority", "datasetSplit"],
          },
        },
      ]),
    },
    {
      studioType: "system-of-systems-studio",
      acceptsMultiAssetHandoffs: true,
      producesMultiAssetHandoffs: true,
      producedOutputs: Object.freeze([]),
      acceptedInputs: Object.freeze([
        {
          capabilityId: "system-default-input",
          supportsGroupedMultiAsset: true,
          contract: {
            contractId: "system-default-input",
            acceptedStructuralKinds: ["system"],
            acceptedSemanticRoles: ["system"],
            acceptedBehaviorKinds: ["iterative", "autonomous", "deterministic"],
            requireVersionedAsset: true,
            expectedContract: resolver.resolveContractForTaxonomy(systemTaxonomy),
            allowedContextKeys: ["reason"],
          },
        },
      ]),
    },
    {
      studioType: "training-recipe-studio",
      acceptsMultiAssetHandoffs: false,
      producesMultiAssetHandoffs: true,
      producedOutputs: Object.freeze([]),
      acceptedInputs: Object.freeze([
        {
          capabilityId: "training-workflow-input",
          supportsGroupedMultiAsset: false,
          contract: {
            contractId: "training-workflow-input",
            acceptedStructuralKinds: ["composite"],
            acceptedSemanticRoles: ["workflow"],
            acceptedBehaviorKinds: ["deterministic"],
            requireVersionedAsset: true,
            expectedContract: resolver.resolveContractForTaxonomy(workflowTaxonomy),
            allowedContextKeys: [],
          },
        },
      ]),
    },
  ]);
}

describe("StudioHandoffCompatibilityValidator", () => {
  it("accepts valid atomic/composite/system handoffs for representative studio pairs", () => {
    const validator = new StudioHandoffCompatibilityValidator({
      validateVersionReference: ({ versionId }) => versionId.endsWith(":v1"),
    });

    const atomic = createHandoff({
      id: "atomic-ok",
      sourceType: "dataset-studio",
      targetType: "workflow-studio",
      taxonomy: { structuralKind: "atomic", semanticRole: "dataset", behaviorKind: "none" },
      context: { datasetSplit: "train" },
      targetInputContractId: "workflow-dataset-input",
    });
    const composite = createHandoff({
      id: "composite-ok",
      sourceType: "workflow-studio",
      targetType: "system-studio",
      taxonomy: { structuralKind: "composite", semanticRole: "workflow", behaviorKind: "deterministic" },
      context: { reason: "compose" },
    });
    const system = createHandoff({
      id: "system-ok",
      sourceType: "system-studio",
      targetType: "system-studio",
      taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "iterative" },
      context: { reason: "compose" },
    });

    expect(validator.validate({ handoff: atomic, targetCapabilities: createCapabilities() }).compatible).toBeTrue();
    expect(validator.validate({ handoff: composite, targetCapabilities: createCapabilities() }).compatible).toBeTrue();
    expect(validator.validate({ handoff: system, targetCapabilities: createCapabilities() }).compatible).toBeTrue();
  });

  it("returns structured issues for taxonomy/contract/version/context incompatibilities", () => {
    const validator = new StudioHandoffCompatibilityValidator({
      validateVersionReference: ({ assetId, versionId }) => assetId === "asset:valid" && versionId === "valid:v1",
    });

    const handoff = createHandoff({
      id: "invalid",
      sourceType: "dataset-studio",
      targetType: "training-recipe-studio",
      taxonomy: { structuralKind: "atomic", semanticRole: "dataset", behaviorKind: "none" },
      versionId: "invalid:v5",
      context: { unknownKey: true },
      targetInputContractId: "training-workflow-input",
      contractOverride: resolver.resolveContractForTaxonomy(createCompositionTaxonomyDescriptor({
        structuralKind: TaxonomyStructuralKinds.atomic,
        semanticRole: TaxonomySemanticRoles.model,
        behaviorKind: TaxonomyBehaviorKinds.none,
      })),
    });

    const decision = validator.validate({ handoff, targetCapabilities: createCapabilities() });
    expect(decision.compatible).toBeFalse();
    expect(decision.issues.map((entry) => entry.code)).toContain(StudioHandoffCompatibilityIssueCodes.taxonomyIncompatible);
    expect(decision.issues.map((entry) => entry.code)).toContain(StudioHandoffCompatibilityIssueCodes.contractIncompatible);
    expect(decision.issues.map((entry) => entry.code)).toContain(StudioHandoffCompatibilityIssueCodes.versionReferenceInvalid);
    expect(decision.issues.map((entry) => entry.code)).toContain(StudioHandoffCompatibilityIssueCodes.contextKeyNotAllowed);
  });

  it("accepts system-of-systems handoffs for a target studio that explicitly supports them", () => {
    const validator = new StudioHandoffCompatibilityValidator({
      validateVersionReference: () => true,
    });

    const handoff = createHandoff({
      id: "system-of-systems",
      sourceType: "system-studio",
      targetType: "system-of-systems-studio",
      taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "iterative" },
      context: { reason: "nested-compose" },
    });

    const decision = validator.validate({ handoff, targetCapabilities: createCapabilities() });
    expect(decision.compatible).toBeTrue();
    expect(decision.matchedContractId).toBe("system-default-input");
  });

  it("keeps compatibility logic deterministic when target studio is missing from capabilities", () => {
    const validator = new StudioHandoffCompatibilityValidator();
    const handoff = createHandoff({
      id: "unsupported-target",
      sourceType: "dataset-studio",
      targetType: "unknown-studio",
      taxonomy: { structuralKind: "atomic", semanticRole: "dataset", behaviorKind: "none" },
    });

    const decision = validator.validate({ handoff, targetCapabilities: createCapabilities() });
    expect(decision.compatible).toBeFalse();
    expect(decision.issues).toEqual([
      {
        code: StudioHandoffCompatibilityIssueCodes.targetStudioUnsupported,
        message: "Target studio type 'unknown-studio' has no registered handoff capability descriptor.",
        path: "target.studioType",
      },
    ]);
  });

  it("rejects mismatched pinned version references instead of floating version identity", () => {
    const validator = new StudioHandoffCompatibilityValidator({
      validateVersionReference: () => true,
    });
    const basis = createHandoff({
      id: "pinned-mismatch",
      sourceType: "dataset-studio",
      targetType: "system-studio",
      taxonomy: { structuralKind: "atomic", semanticRole: "dataset", behaviorKind: "none" },
    });
    const handoff = Object.freeze({
      ...basis,
      payload: Object.freeze({
        ...basis.payload,
        pinnedVersion: Object.freeze({
          assetId: basis.payload.assetId,
          versionId: "asset:dataset:v999",
        }),
      }),
    });

    const decision = validator.validate({ handoff, targetCapabilities: createCapabilities() });
    expect(decision.compatible).toBeFalse();
    expect(decision.issues.map((entry) => entry.code)).toContain(StudioHandoffCompatibilityIssueCodes.versionReferenceMismatch);
  });

  it("evaluates grouped multi-asset compatibility with per-asset and aggregate bundle decisions", () => {
    const validator = new StudioHandoffCompatibilityValidator({
      validateVersionReference: ({ versionId }) => versionId.includes(":v"),
    });
    const handoff = createHandoff({
      id: "multi-bundle",
      sourceType: "dataset-studio",
      targetType: "system-studio",
      taxonomy: { structuralKind: "atomic", semanticRole: "dataset", behaviorKind: "none" },
    });
    const modelTaxonomy = createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.atomic,
      semanticRole: TaxonomySemanticRoles.model,
      behaviorKind: TaxonomyBehaviorKinds.none,
    });

    const updated = createStudioHandoffContract({
      id: handoff.id,
      source: handoff.source,
      target: handoff.target,
      payload: handoff.payload,
      intent: handoff.intent,
      context: {
        sourceReferences: handoff.context?.sourceReferences ?? [],
        prefill: handoff.context?.prefill,
        provenance: handoff.context?.provenance,
      },
      multiAsset: {
        grouped: true,
        requireAllAssets: true,
        assets: [
          {
            role: StudioHandoffAssetRoles.primary,
            assetId: handoff.payload.assetId,
            versionId: handoff.payload.versionId,
            taxonomy: handoff.payload.taxonomy,
            contract: handoff.payload.contract,
          },
          {
            role: StudioHandoffAssetRoles.supporting,
            assetId: "asset:model",
            versionId: "asset:model:bad",
            taxonomy: modelTaxonomy,
            contract: resolver.resolveContractForTaxonomy(modelTaxonomy),
          },
        ],
      },
    });

    const decision = validator.validate({ handoff: updated, targetCapabilities: createCapabilities() });
    expect(decision.multiAsset?.grouped).toBeTrue();
    expect(decision.multiAsset?.entries).toHaveLength(2);
    expect(decision.compatible).toBeFalse();
    expect(decision.issues.map((entry) => entry.code)).toContain(StudioHandoffCompatibilityIssueCodes.bundleAssetIncompatible);
    expect(decision.multiAsset?.entries[1]?.issues.map((entry) => entry.code)).toContain(StudioHandoffCompatibilityIssueCodes.versionReferenceInvalid);
  });

  it("reuses bounded compatibility decisions for repeated equivalent inputs", () => {
    const validator = new StudioHandoffCompatibilityValidator({
      validateVersionReference: () => true,
      cacheMaxEntries: 4,
    });
    const handoff = createHandoff({
      id: "cached",
      sourceType: "dataset-studio",
      targetType: "workflow-studio",
      taxonomy: { structuralKind: "atomic", semanticRole: "dataset", behaviorKind: "none" },
      targetInputContractId: "workflow-dataset-input",
      context: { datasetSplit: "train" },
    });
    const capabilities = createCapabilities();

    const first = validator.validate({ handoff, targetCapabilities: capabilities });
    const second = validator.validate({ handoff, targetCapabilities: capabilities });
    expect(second).toBe(first);
  });
});

