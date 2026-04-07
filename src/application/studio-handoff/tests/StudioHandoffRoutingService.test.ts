import { describe, expect, it } from "bun:test";
import {
  createCompositionTaxonomyDescriptor,
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
} from "../../../domain/taxonomy/CompositionTaxonomy";
import { CompositionAssetContractResolver } from "../../contracts/CompositionAssetContractResolver";
import { StudioCapabilityQueryService, StudioCapabilityRegistry, type StudioCapabilityDescriptor } from "../StudioCapabilityRegistry";
import { StudioHandoffCompatibilityValidator } from "../StudioHandoffCompatibilityValidator";
import { StudioHandoffRoutingService } from "../StudioHandoffRoutingService";
import { StudioHandoffIntentKinds } from "../../../domain/studio-handoff/StudioHandoffContract";

const resolver = new CompositionAssetContractResolver();

function createRegistry(): StudioCapabilityQueryService {
  const registry = new StudioCapabilityRegistry();
  const descriptors: ReadonlyArray<StudioCapabilityDescriptor> = [
    {
      studioType: "workflow-studio",
      studioId: "workflow-studio-default",
      registrationKind: "composite",
      acceptsMultiAssetHandoffs: true,
      producesMultiAssetHandoffs: true,
      acceptedInputs: [{
        capabilityId: "workflow-default-input",
        supportsGroupedMultiAsset: true,
        contract: {
          contractId: "workflow-default-input",
          acceptedStructuralKinds: ["atomic", "composite"],
          acceptedSemanticRoles: ["dataset", "workflow"],
          acceptedBehaviorKinds: ["none", "deterministic"],
          allowedContextKeys: ["trainingObjective", "seed"],
        },
      }],
      producedOutputs: [],
    },
    {
      studioType: "model-studio",
      studioId: "model-studio-default",
      registrationKind: "atomic",
      acceptsMultiAssetHandoffs: false,
      producesMultiAssetHandoffs: false,
      acceptedInputs: [{
        capabilityId: "model-default-input",
        supportsGroupedMultiAsset: false,
        contract: {
          contractId: "model-default-input",
          acceptedStructuralKinds: ["atomic"],
          acceptedSemanticRoles: ["model", "dataset"],
          acceptedBehaviorKinds: ["none"],
          allowedContextKeys: ["seed"],
        },
      }],
      producedOutputs: [],
    },
    {
      studioType: "system-studio",
      studioId: "studio-systems",
      registrationKind: "system",
      acceptsMultiAssetHandoffs: true,
      producesMultiAssetHandoffs: true,
      acceptedInputs: [{
        capabilityId: "system-default-input",
        supportsGroupedMultiAsset: true,
        contract: {
          contractId: "system-default-input",
          acceptedStructuralKinds: ["atomic", "composite", "system"],
          acceptedSemanticRoles: ["dataset", "workflow", "model", "system"],
          acceptedBehaviorKinds: ["none", "deterministic", "iterative", "autonomous"],
          allowedContextKeys: ["trainingObjective", "nestedStrategy", "seed"],
        },
      }],
      producedOutputs: [],
    },
  ];
  registry.replaceAll(descriptors);
  return new StudioCapabilityQueryService(registry);
}

function createRoutingService(): StudioHandoffRoutingService {
  const query = createRegistry();
  return new StudioHandoffRoutingService(
    query,
    new StudioHandoffCompatibilityValidator({
      validateVersionReference: ({ versionId }) => versionId.includes(":v"),
      capabilityQueryService: query,
    }),
  );
}

describe("StudioHandoffRoutingService", () => {
  it("routes single-asset handoffs to a deterministic preferred compatible studio", () => {
    const service = createRoutingService();
    const taxonomy = createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.atomic,
      semanticRole: TaxonomySemanticRoles.dataset,
      behaviorKind: TaxonomyBehaviorKinds.none,
    });

    const decision = service.route({
      sourceOutput: {
        sourceStudioType: "dataset-studio",
        sourceStudioId: "dataset-studio-default",
        authoritativeAsset: {
          assetId: "asset:dataset",
          versionId: "asset:dataset:v1",
          pinnedVersion: { assetId: "asset:dataset", versionId: "asset:dataset:v1" },
          taxonomy,
          contract: resolver.resolveContractForTaxonomy(taxonomy),
        },
        handoffHints: {
          trainingObjective: "classification",
        },
      },
      intent: {
        kind: StudioHandoffIntentKinds.authoringContinuation,
      },
    });

    expect(decision.preferred?.studioType).toBe("workflow-studio");
    expect(decision.preferred?.matchedContractId).toBe("workflow-default-input");
    expect(decision.alternateCandidates.map((entry) => entry.studioType)).toEqual(["system-studio"]);

    const rerun = service.route({
      sourceOutput: {
        sourceStudioType: "dataset-studio",
        sourceStudioId: "dataset-studio-default",
        authoritativeAsset: {
          assetId: "asset:dataset",
          versionId: "asset:dataset:v1",
          pinnedVersion: { assetId: "asset:dataset", versionId: "asset:dataset:v1" },
          taxonomy,
          contract: resolver.resolveContractForTaxonomy(taxonomy),
        },
        handoffHints: {
          trainingObjective: "classification",
        },
      },
      intent: {
        kind: StudioHandoffIntentKinds.authoringContinuation,
      },
    });

    expect(rerun.deterministicSignature).toBe(decision.deterministicSignature);
  });

  it("routes grouped multi-asset and system-integration handoffs to system studio as preferred", () => {
    const service = createRoutingService();
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

    const decision = service.route({
      sourceOutput: {
        sourceStudioType: "workflow-studio",
        sourceStudioId: "workflow-studio-default",
        authoritativeAsset: {
          assetId: "asset:workflow",
          versionId: "asset:workflow:v2",
          pinnedVersion: { assetId: "asset:workflow", versionId: "asset:workflow:v2" },
          taxonomy: workflowTaxonomy,
          contract: resolver.resolveContractForTaxonomy(workflowTaxonomy),
        },
        sourceReferences: [
          { assetId: "asset:dataset", versionId: "asset:dataset:v3", relation: "dependency" },
          { assetId: "system:parent", versionId: "system:parent:v1", relation: "system-of-systems" },
        ],
      },
      multiAsset: {
        grouped: true,
        requireAllAssets: true,
        assets: [
          {
            role: "primary",
            assetId: "asset:workflow",
            versionId: "asset:workflow:v2",
            taxonomy: workflowTaxonomy,
          },
          {
            role: "supporting",
            assetId: "asset:dataset",
            versionId: "asset:dataset:v3",
            taxonomy: datasetTaxonomy,
          },
        ],
      },
      intent: {
        kind: StudioHandoffIntentKinds.systemIntegration,
      },
    });

    expect(decision.preferred?.studioType).toBe("system-studio");
    expect(decision.preferred?.matchedContractId).toBe("system-default-input");
    expect(decision.preferred?.reasons.some((entry) => entry.code === "system-studio-preferred-for-composition")).toBeTrue();
  });

  it("supports coherent route reevaluation for incremental version updates", () => {
    const service = createRoutingService();
    const systemTaxonomy = createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.system,
      semanticRole: TaxonomySemanticRoles.system,
      behaviorKind: TaxonomyBehaviorKinds.iterative,
    });

    const initial = service.route({
      sourceOutput: {
        sourceStudioType: "system-studio-upstream",
        sourceStudioId: "system-upstream-default",
        authoritativeAsset: {
          assetId: "system:child",
          versionId: "system:child:v1",
          pinnedVersion: { assetId: "system:child", versionId: "system:child:v1" },
          taxonomy: systemTaxonomy,
          contract: resolver.resolveContractForTaxonomy(systemTaxonomy),
        },
      },
      intent: {
        kind: StudioHandoffIntentKinds.systemIntegration,
      },
    });

    const reevaluated = service.reevaluate({
      sourceOutput: {
        sourceStudioType: "system-studio-upstream",
        sourceStudioId: "system-upstream-default",
        authoritativeAsset: {
          assetId: "system:child",
          versionId: "system:child:v2",
          pinnedVersion: { assetId: "system:child", versionId: "system:child:v2" },
          taxonomy: systemTaxonomy,
          contract: resolver.resolveContractForTaxonomy(systemTaxonomy),
        },
      },
      intent: {
        kind: StudioHandoffIntentKinds.systemIntegration,
      },
      previousDecision: initial,
    });

    expect(initial.preferred?.studioType).toBe("system-studio");
    expect(reevaluated.preferred?.studioType).toBe("system-studio");
    expect(initial.deterministicSignature).not.toBe(reevaluated.deterministicSignature);
  });

  it("reuses bounded routing decisions for repeated equivalent requests", () => {
    const service = createRoutingService();
    const taxonomy = createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.atomic,
      semanticRole: TaxonomySemanticRoles.dataset,
      behaviorKind: TaxonomyBehaviorKinds.none,
    });
    const request = {
      sourceOutput: {
        sourceStudioType: "dataset-studio",
        sourceStudioId: "dataset-studio-default",
        authoritativeAsset: {
          assetId: "asset:dataset",
          versionId: "asset:dataset:v1",
          pinnedVersion: { assetId: "asset:dataset", versionId: "asset:dataset:v1" },
          taxonomy,
          contract: resolver.resolveContractForTaxonomy(taxonomy),
        },
      },
      intent: {
        kind: StudioHandoffIntentKinds.authoringContinuation,
      },
    } as const;

    const first = service.route(request);
    const second = service.route(request);
    expect(second).toBe(first);
  });
});
