import { describe, expect, it } from "bun:test";
import {
  StudioCapabilityQueryService,
  StudioCapabilityRegistry,
  type StudioCapabilityDescriptor,
} from "../StudioCapabilityRegistry";
import {
  createCompositionTaxonomyDescriptor,
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
} from "../../../domain/taxonomy/CompositionTaxonomy";
import { StudioHandoffCompatibilityValidator } from "../StudioHandoffCompatibilityValidator";
import { createStudioHandoffContract, StudioHandoffIntentKinds } from "../../../domain/studio-handoff/StudioHandoffContract";

function createDescriptors(): ReadonlyArray<StudioCapabilityDescriptor> {
  return Object.freeze([
    {
      studioType: "dataset-studio",
      registrationKind: "atomic",
      acceptsMultiAssetHandoffs: false,
      producesMultiAssetHandoffs: false,
      acceptedInputs: Object.freeze([{
        capabilityId: "dataset-default-input",
        supportsGroupedMultiAsset: false,
        contract: {
          contractId: "dataset-default-input",
          acceptedStructuralKinds: ["atomic"],
          acceptedSemanticRoles: ["dataset"],
          acceptedBehaviorKinds: ["none"],
          allowedContextKeys: ["seed"],
        },
      }]),
      producedOutputs: Object.freeze([{
        capabilityId: "dataset-default-output",
        supportsGroupedMultiAsset: false,
        taxonomy: createCompositionTaxonomyDescriptor({
          structuralKind: TaxonomyStructuralKinds.atomic,
          semanticRole: TaxonomySemanticRoles.dataset,
          behaviorKind: TaxonomyBehaviorKinds.none,
        }),
      }]),
    },
    {
      studioType: "workflow-studio",
      registrationKind: "composite",
      acceptsMultiAssetHandoffs: true,
      producesMultiAssetHandoffs: true,
      acceptedInputs: Object.freeze([{
        capabilityId: "workflow-default-input",
        supportsGroupedMultiAsset: true,
        adapterKind: "composite",
        contract: {
          contractId: "workflow-default-input",
          acceptedStructuralKinds: ["atomic", "composite"],
          acceptedSemanticRoles: ["dataset", "workflow"],
          acceptedBehaviorKinds: ["none", "deterministic"],
          allowedContextKeys: ["seed", "trainingObjective"],
        },
      }]),
      producedOutputs: Object.freeze([{
        capabilityId: "workflow-default-output",
        supportsGroupedMultiAsset: true,
        adapterKind: "composite",
        taxonomy: createCompositionTaxonomyDescriptor({
          structuralKind: TaxonomyStructuralKinds.composite,
          semanticRole: TaxonomySemanticRoles.workflow,
          behaviorKind: TaxonomyBehaviorKinds.deterministic,
        }),
      }]),
    },
    {
      studioType: "system-studio",
      registrationKind: "system",
      acceptsMultiAssetHandoffs: true,
      producesMultiAssetHandoffs: true,
      acceptedInputs: Object.freeze([{
        capabilityId: "system-default-input",
        supportsGroupedMultiAsset: true,
        adapterKind: "system",
        contract: {
          contractId: "system-default-input",
          acceptedStructuralKinds: ["atomic", "composite", "system"],
          acceptedSemanticRoles: ["dataset", "workflow", "system", "model"],
          acceptedBehaviorKinds: ["none", "deterministic", "iterative", "autonomous"],
          allowedContextKeys: ["seed", "nestedStrategy"],
        },
      }]),
      producedOutputs: Object.freeze([{
        capabilityId: "system-default-output",
        supportsGroupedMultiAsset: true,
        adapterKind: "system",
        taxonomy: createCompositionTaxonomyDescriptor({
          structuralKind: TaxonomyStructuralKinds.system,
          semanticRole: TaxonomySemanticRoles.system,
          behaviorKind: TaxonomyBehaviorKinds.iterative,
        }),
      }]),
    },
  ]);
}

describe("StudioCapabilityRegistry", () => {
  it("registers descriptors for atomic/composite/system studios and answers capability queries", () => {
    const registry = new StudioCapabilityRegistry();
    registry.replaceAll(createDescriptors());

    const query = new StudioCapabilityQueryService(registry);
    expect(query.getStudioDescriptor("dataset-studio")?.registrationKind).toBe("atomic");
    expect(query.getStudioDescriptor("workflow-studio")?.registrationKind).toBe("composite");
    expect(query.getStudioDescriptor("system-studio")?.registrationKind).toBe("system");

    expect(query.listAcceptedInputRoles("workflow-studio")).toEqual(["dataset", "workflow"]);
    expect(query.listProducedOutputRoles("workflow-studio")).toEqual(["workflow"]);
    expect(query.supportsGroupedInput("dataset-studio")).toBeFalse();
    expect(query.supportsGroupedInput("system-studio")).toBeTrue();
  });

  it("provides shared compatibility truth for validator checks", () => {
    const registry = new StudioCapabilityRegistry();
    registry.replaceAll(createDescriptors());
    const query = new StudioCapabilityQueryService(registry);

    const taxonomy = createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.atomic,
      semanticRole: TaxonomySemanticRoles.dataset,
      behaviorKind: TaxonomyBehaviorKinds.none,
    });

    const handoff = createStudioHandoffContract({
      id: "handoff:capability-truth",
      source: { studioId: "dataset-studio-default", studioType: "dataset-studio" },
      target: { studioId: "workflow-studio-default", studioType: "workflow-studio" },
      payload: {
        assetId: "asset:dataset",
        versionId: "asset:dataset:v1",
        taxonomy,
        targetInputContract: {
          contractId: "workflow-default-input",
        },
      },
      intent: { kind: StudioHandoffIntentKinds.compositionAssembly },
      context: {
        sourceReferences: [{ assetId: "asset:dataset", versionId: "asset:dataset:v1", relation: "primary" }],
        prefill: { values: { trainingObjective: "classification" } },
      },
    });

    const decision = new StudioHandoffCompatibilityValidator({
      validateVersionReference: ({ versionId }) => versionId.endsWith(":v1"),
      capabilityQueryService: query,
    }).validate({
      handoff,
    });

    expect(decision.compatible).toBeTrue();
    expect(decision.matchedContractId).toBe("workflow-default-input");
  });
});
