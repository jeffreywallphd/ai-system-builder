import { describe, expect, it } from "bun:test";
import { CompositionAssetContractResolver } from "../../contracts/CompositionAssetContractResolver";
import {
  createCompositionTaxonomyDescriptor,
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
  type CompositionTaxonomyDescriptor,
} from "../../../domain/taxonomy/CompositionTaxonomy";
import {
  StudioCapabilityQueryService,
  StudioCapabilityRegistry,
  type StudioCapabilityDescriptor,
} from "../StudioCapabilityRegistry";
import { StudioHandoffCompatibilityValidator } from "../StudioHandoffCompatibilityValidator";
import { StudioHandoffRoutingService } from "../StudioHandoffRoutingService";
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
  type StudioProducedOutput,
} from "../StudioOutputAdapter";
import { StudioHandoffOrchestrationService } from "../StudioHandoffOrchestrationService";
import { createStudioHandoffContract, StudioHandoffIntentKinds } from "../../../domain/studio-handoff/StudioHandoffContract";

const resolver = new CompositionAssetContractResolver();

function createQuery(): StudioCapabilityQueryService {
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
          acceptedSemanticRoles: ["dataset", "workflow", "tool-chain"],
          acceptedBehaviorKinds: ["none", "deterministic", "conditional"],
          allowedContextKeys: ["title", "priority", "trainingObjective"],
        },
      }],
      producedOutputs: [],
    },
    {
      studioType: "tool-chain-studio",
      studioId: "tool-chain-studio-default",
      registrationKind: "composite",
      acceptsMultiAssetHandoffs: true,
      producesMultiAssetHandoffs: true,
      acceptedInputs: [{
        capabilityId: "tool-chain-default-input",
        supportsGroupedMultiAsset: true,
        contract: {
          contractId: "tool-chain-default-input",
          acceptedStructuralKinds: ["atomic", "composite"],
          acceptedSemanticRoles: ["tool", "workflow", "dataset"],
          acceptedBehaviorKinds: ["none", "deterministic", "conditional"],
          allowedContextKeys: ["title", "priority"],
        },
      }],
      producedOutputs: [],
    },
    {
      studioType: "system-studio",
      studioId: "system-studio-default",
      registrationKind: "system",
      acceptsMultiAssetHandoffs: true,
      producesMultiAssetHandoffs: true,
      acceptedInputs: [{
        capabilityId: "system-default-input",
        supportsGroupedMultiAsset: true,
        contract: {
          contractId: "system-default-input",
          acceptedStructuralKinds: ["atomic", "composite", "system"],
          acceptedSemanticRoles: ["dataset", "workflow", "system", "model", "tool-chain"],
          acceptedBehaviorKinds: ["none", "deterministic", "conditional", "iterative", "autonomous"],
          allowedContextKeys: ["title", "nestedStrategy", "priority", "trainingObjective"],
        },
      }],
      producedOutputs: [],
    },
  ];
  registry.replaceAll(descriptors);
  return new StudioCapabilityQueryService(registry);
}

function createService() {
  const query = createQuery();
  const validator = new StudioHandoffCompatibilityValidator({
    validateVersionReference: ({ versionId }) => versionId.includes(":v"),
    capabilityQueryService: query,
  });

  const outputRegistry = new StudioOutputAdapterRegistry();
  outputRegistry.register(new AtomicStudioOutputAdapter(["dataset-studio", "model-studio", "tool-studio"]));
  outputRegistry.register(new CompositeStudioOutputAdapter(["workflow-studio", "tool-chain-studio", "context-bundle-studio"]));
  outputRegistry.register(new SystemStudioOutputAdapter(["system-studio", "system-studio-upstream"]));

  const inputRegistry = new StudioInputAdapterRegistry();
  inputRegistry.register(new AtomicStudioInputAdapter(["dataset-studio", "model-studio", "tool-studio"]));
  inputRegistry.register(new CompositeStudioInputAdapter(["workflow-studio", "tool-chain-studio", "context-bundle-studio"]));
  inputRegistry.register(new SystemStudioInputAdapter(["system-studio"]));

  return {
    query,
    routing: new StudioHandoffRoutingService(query, validator),
    orchestration: new StudioHandoffOrchestrationService(
      new StudioOutputAdapterLayer(outputRegistry),
      new StudioInputAdapterLayer(validator, inputRegistry),
    ),
  };
}

function output(input: {
  readonly sourceStudioType: string;
  readonly sourceStudioId: string;
  readonly assetId: string;
  readonly versionId: string;
  readonly taxonomy: CompositionTaxonomyDescriptor;
  readonly references?: ReadonlyArray<{ readonly assetId: string; readonly versionId: string; readonly relation?: string }>;
}): StudioProducedOutput {
  return {
    sourceStudioType: input.sourceStudioType,
    sourceStudioId: input.sourceStudioId,
    authoritativeAsset: {
      assetId: input.assetId,
      versionId: input.versionId,
      pinnedVersion: { assetId: input.assetId, versionId: input.versionId },
      taxonomy: input.taxonomy,
      contract: resolver.resolveContractForTaxonomy(input.taxonomy),
    },
    sourceReferences: input.references,
    handoffHints: { title: "interop" },
  };
}

describe("Cross-studio handoff interop integration", () => {
  it("supports valid atomic/composite/system interop combinations through routing+orchestration", () => {
    const fixture = createService();
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

    const scenarios = [
      {
        id: "atomic-to-composite",
        source: { studioType: "dataset-studio", studioId: "dataset-studio-default" },
        out: output({
          sourceStudioType: "dataset-studio",
          sourceStudioId: "dataset-studio-default",
          assetId: "asset:dataset",
          versionId: "asset:dataset:v1",
          taxonomy: datasetTaxonomy,
        }),
        expectedStudios: ["workflow-studio", "tool-chain-studio"],
        expectedInputKind: "composite",
        intent: StudioHandoffIntentKinds.authoringContinuation,
      },
      {
        id: "atomic-to-system",
        source: { studioType: "model-studio", studioId: "model-studio-default" },
        out: output({
          sourceStudioType: "model-studio",
          sourceStudioId: "model-studio-default",
          assetId: "asset:model",
          versionId: "asset:model:v4",
          taxonomy: createCompositionTaxonomyDescriptor({
            structuralKind: TaxonomyStructuralKinds.atomic,
            semanticRole: TaxonomySemanticRoles.model,
            behaviorKind: TaxonomyBehaviorKinds.none,
          }),
        }),
        expectedStudios: ["system-studio"],
        expectedInputKind: "system",
        intent: StudioHandoffIntentKinds.systemIntegration,
      },
      {
        id: "composite-to-composite",
        source: { studioType: "workflow-studio", studioId: "workflow-studio-default" },
        out: output({
          sourceStudioType: "workflow-studio",
          sourceStudioId: "workflow-studio-default",
          assetId: "asset:workflow",
          versionId: "asset:workflow:v7",
          taxonomy: workflowTaxonomy,
          references: [{ assetId: "asset:dataset", versionId: "asset:dataset:v1", relation: "dependency" }],
        }),
        expectedStudios: ["workflow-studio", "tool-chain-studio"],
        expectedInputKind: "composite",
        intent: StudioHandoffIntentKinds.authoringContinuation,
      },
      {
        id: "composite-to-system",
        source: { studioType: "tool-chain-studio", studioId: "tool-chain-studio-default" },
        out: output({
          sourceStudioType: "tool-chain-studio",
          sourceStudioId: "tool-chain-studio-default",
          assetId: "asset:tool-chain",
          versionId: "asset:tool-chain:v2",
          taxonomy: createCompositionTaxonomyDescriptor({
            structuralKind: TaxonomyStructuralKinds.composite,
            semanticRole: TaxonomySemanticRoles.toolChain,
            behaviorKind: TaxonomyBehaviorKinds.deterministic,
          }),
        }),
        expectedStudios: ["system-studio"],
        expectedInputKind: "system",
        intent: StudioHandoffIntentKinds.systemIntegration,
      },
      {
        id: "system-to-system",
        source: { studioType: "system-studio-upstream", studioId: "system-studio-upstream-default" },
        out: output({
          sourceStudioType: "system-studio-upstream",
          sourceStudioId: "system-studio-upstream-default",
          assetId: "system:root",
          versionId: "system:root:v3",
          taxonomy: systemTaxonomy,
          references: [{ assetId: "system:child", versionId: "system:child:v1", relation: "system-of-systems" }],
        }),
        expectedStudios: ["system-studio"],
        expectedInputKind: "system",
        intent: StudioHandoffIntentKinds.systemIntegration,
      },
    ] as const;

    for (const scenario of scenarios) {
      const route = fixture.routing.route({
        handoffId: `handoff:${scenario.id}`,
        source: scenario.source,
        sourceOutput: scenario.out,
        intent: { kind: scenario.intent },
      });

      expect(scenario.expectedStudios.includes(route.preferred?.studioType ?? "")).toBeTrue();
      expect(route.preferred?.compatible).toBeTrue();

      const orchestration = fixture.orchestration.orchestrate({
        handoffId: `handoff:${scenario.id}`,
        source: scenario.source,
        target: {
          studioType: route.preferred!.studioType,
          studioId: route.preferred!.studioId,
        },
        sourceOutput: scenario.out,
        targetInputContract: { contractId: route.preferred!.matchedContractId! },
        intent: { kind: scenario.intent },
        targetCapabilities: fixture.query.listCapabilities(),
      });

      expect(orchestration.ok).toBeTrue();
      expect(orchestration.preparation?.compatibility.compatible).toBeTrue();
      expect(orchestration.preparation?.targetInput.kind).toBe(scenario.expectedInputKind);
      expect(orchestration.preparation?.targetInput.authoritativeAsset.pinnedVersion.versionId).toBe(scenario.out.authoritativeAsset.versionId);
    }
  });

  it("supports grouped multi-asset interop into System Studio", () => {
    const fixture = createService();
    const workflowTaxonomy = createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.composite,
      semanticRole: TaxonomySemanticRoles.workflow,
      behaviorKind: TaxonomyBehaviorKinds.deterministic,
    });
    const datasetTaxonomy = createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.atomic,
      semanticRole: TaxonomySemanticRoles.dataset,
      behaviorKind: TaxonomyBehaviorKinds.none,
    });

    const route = fixture.routing.route({
      handoffId: "handoff:grouped-interop",
      source: { studioType: "workflow-studio", studioId: "workflow-studio-default" },
      sourceOutput: output({
        sourceStudioType: "workflow-studio",
        sourceStudioId: "workflow-studio-default",
        assetId: "asset:workflow",
        versionId: "asset:workflow:v8",
        taxonomy: workflowTaxonomy,
      }),
      multiAsset: {
        grouped: true,
        requireAllAssets: true,
        assets: [
          {
            role: "primary",
            assetId: "asset:workflow",
            versionId: "asset:workflow:v8",
            taxonomy: workflowTaxonomy,
            contract: resolver.resolveContractForTaxonomy(workflowTaxonomy),
          },
          {
            role: "supporting",
            assetId: "asset:dataset",
            versionId: "asset:dataset:v12",
            taxonomy: datasetTaxonomy,
            contract: resolver.resolveContractForTaxonomy(datasetTaxonomy),
          },
        ],
      },
      intent: { kind: StudioHandoffIntentKinds.systemIntegration },
    });

    expect(route.preferred?.studioType).toBe("system-studio");

    const result = fixture.orchestration.orchestrate({
      handoffId: "handoff:grouped-interop",
      source: { studioType: "workflow-studio", studioId: "workflow-studio-default" },
      target: {
        studioType: route.preferred!.studioType,
        studioId: route.preferred!.studioId,
      },
      sourceOutput: output({
        sourceStudioType: "workflow-studio",
        sourceStudioId: "workflow-studio-default",
        assetId: "asset:workflow",
        versionId: "asset:workflow:v8",
        taxonomy: workflowTaxonomy,
      }),
      targetInputContract: { contractId: route.preferred!.matchedContractId! },
      intent: { kind: StudioHandoffIntentKinds.systemIntegration },
      targetCapabilities: fixture.query.listCapabilities(),
      handoff: createStudioHandoffContract({
        id: "handoff:grouped-interop",
        source: { studioType: "workflow-studio", studioId: "workflow-studio-default" },
        target: { studioType: route.preferred!.studioType, studioId: route.preferred!.studioId },
        payload: {
          assetId: "asset:workflow",
          versionId: "asset:workflow:v8",
          taxonomy: workflowTaxonomy,
          contract: resolver.resolveContractForTaxonomy(workflowTaxonomy),
          targetInputContract: { contractId: route.preferred!.matchedContractId! },
        },
        multiAsset: {
          grouped: true,
          requireAllAssets: true,
          assets: [
            {
              role: "primary",
              assetId: "asset:workflow",
              versionId: "asset:workflow:v8",
              taxonomy: workflowTaxonomy,
              contract: resolver.resolveContractForTaxonomy(workflowTaxonomy),
            },
            {
              role: "supporting",
              assetId: "asset:dataset",
              versionId: "asset:dataset:v12",
              taxonomy: datasetTaxonomy,
              contract: resolver.resolveContractForTaxonomy(datasetTaxonomy),
            },
          ],
        },
        intent: { kind: StudioHandoffIntentKinds.systemIntegration },
      }),
    });

    expect(result.ok).toBeTrue();
    expect(result.preparation?.targetInput.kind).toBe("system");
    expect((result.preparation?.targetInput as { grouped?: boolean }).grouped).toBeTrue();
  });

  it("classifies invalid interop with structured compatibility/routing failures", () => {
    const fixture = createService();
    const promptTaxonomy = createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.atomic,
      semanticRole: TaxonomySemanticRoles.promptTemplate,
      behaviorKind: TaxonomyBehaviorKinds.none,
    });

    const route = fixture.routing.route({
      handoffId: "handoff:invalid-interop",
      source: { studioType: "dataset-studio", studioId: "dataset-studio-default" },
      sourceOutput: output({
        sourceStudioType: "dataset-studio",
        sourceStudioId: "dataset-studio-default",
        assetId: "asset:prompt",
        versionId: "asset:prompt:v1",
        taxonomy: promptTaxonomy,
      }),
      intent: { kind: StudioHandoffIntentKinds.authoringContinuation },
    });

    expect(route.preferred).toBeUndefined();
    expect(route.candidates.length).toBeGreaterThan(0);
    expect(route.candidates.every((candidate) => candidate.compatible === false)).toBeTrue();

    const failure = fixture.orchestration.orchestrate({
      handoffId: "handoff:invalid-interop",
      source: { studioType: "dataset-studio", studioId: "dataset-studio-default" },
      target: { studioType: "workflow-studio", studioId: "workflow-studio-default" },
      sourceOutput: output({
        sourceStudioType: "dataset-studio",
        sourceStudioId: "dataset-studio-default",
        assetId: "asset:prompt",
        versionId: "asset:prompt:v1",
        taxonomy: promptTaxonomy,
      }),
      targetInputContract: { contractId: "workflow-default-input" },
      intent: { kind: StudioHandoffIntentKinds.authoringContinuation },
      targetCapabilities: fixture.query.listCapabilities(),
    });

    expect(failure.ok).toBeFalse();
    expect(["compatibility-failure", "adapter-failure"].includes(failure.failure?.kind ?? "")).toBeTrue();
    const issueCodes = failure.failure?.issues.map((issue) => issue.code) ?? [];
    expect(issueCodes.length).toBeGreaterThan(0);
    expect(issueCodes.some((code) => ["semantic-role-incompatible", "taxonomy-incompatible", "compatibility-failed"].includes(code))).toBeTrue();
  });
});
