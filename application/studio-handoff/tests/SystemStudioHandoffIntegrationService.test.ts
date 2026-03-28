import { describe, expect, it } from "bun:test";
import { CompositionAssetContractResolver } from "../../contracts/CompositionAssetContractResolver";
import {
  createCompositionTaxonomyDescriptor,
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
} from "../../../domain/taxonomy/CompositionTaxonomy";
import { StudioCapabilityQueryService, StudioCapabilityRegistry, type StudioCapabilityDescriptor } from "../StudioCapabilityRegistry";
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
} from "../StudioOutputAdapter";
import { StudioHandoffOrchestrationService } from "../StudioHandoffOrchestrationService";
import { SystemStudioHandoffIntegrationService } from "../SystemStudioHandoffIntegrationService";
import { StudioHandoffIntentKinds } from "../../../domain/studio-handoff/StudioHandoffContract";

const resolver = new CompositionAssetContractResolver();

class InMemorySystemStudioGateway {
  public ensureCalls = 0;
  public createCalls = 0;

  public async ensureStudioInitialized(studioId = "studio-systems", studioName = "System Studio"): Promise<{ studio: { id: string; name: string }; session: { id: string } }> {
    this.ensureCalls += 1;
    return {
      studio: { id: studioId, name: studioName },
      session: { id: "session-system-1" },
    };
  }

  public async createSystemDraft(command: {
    studioId?: string;
    sessionId: string;
    draftId?: string;
    title: string;
    summary?: string;
    content: string;
    dependencies?: ReadonlyArray<{ assetId: string; versionId?: string }>;
  }): Promise<{ draft: { id: string; content: string; dependencies: ReadonlyArray<{ assetId: string; versionId?: string }> } }> {
    this.createCalls += 1;
    return {
      draft: {
        id: command.draftId ?? `draft-${this.createCalls}`,
        content: command.content,
        dependencies: command.dependencies ?? [],
      },
    };
  }
}

function createCapabilities(): StudioCapabilityQueryService {
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
          allowedContextKeys: ["trainingObjective"],
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
          acceptedSemanticRoles: ["dataset", "workflow", "system", "model"],
          acceptedBehaviorKinds: ["none", "deterministic", "iterative", "autonomous"],
          allowedContextKeys: ["trainingObjective", "nestedStrategy", "title"],
        },
      }],
      producedOutputs: [],
    },
  ];
  registry.replaceAll(descriptors);
  return new StudioCapabilityQueryService(registry);
}

function createOrchestrationService(query: StudioCapabilityQueryService): StudioHandoffOrchestrationService {
  const outputRegistry = new StudioOutputAdapterRegistry();
  outputRegistry.register(new AtomicStudioOutputAdapter(["dataset-studio", "model-studio"]));
  outputRegistry.register(new CompositeStudioOutputAdapter(["workflow-studio", "context-bundle-studio", "tool-chain-studio"]));
  outputRegistry.register(new SystemStudioOutputAdapter(["system-studio", "system-studio-upstream"]));

  const inputRegistry = new StudioInputAdapterRegistry();
  inputRegistry.register(new AtomicStudioInputAdapter(["dataset-studio", "model-studio"]));
  inputRegistry.register(new CompositeStudioInputAdapter(["workflow-studio", "context-bundle-studio", "tool-chain-studio"]));
  inputRegistry.register(new SystemStudioInputAdapter(["system-studio"]));

  return new StudioHandoffOrchestrationService(
    new StudioOutputAdapterLayer(outputRegistry),
    new StudioInputAdapterLayer(
      new StudioHandoffCompatibilityValidator({
        validateVersionReference: ({ versionId }) => versionId.includes(":v"),
        capabilityQueryService: query,
      }),
      inputRegistry,
    ),
  );
}

function createIntegrationFixture(): {
  readonly service: SystemStudioHandoffIntegrationService;
  readonly gateway: InMemorySystemStudioGateway;
} {
  const query = createCapabilities();
  const routing = new StudioHandoffRoutingService(
    query,
    new StudioHandoffCompatibilityValidator({
      validateVersionReference: ({ versionId }) => versionId.includes(":v"),
      capabilityQueryService: query,
    }),
  );
  const orchestration = createOrchestrationService(query);
  const gateway = new InMemorySystemStudioGateway();
  const service = new SystemStudioHandoffIntegrationService(routing, orchestration, gateway as never);
  return { service, gateway };
}

describe("SystemStudioHandoffIntegrationService", () => {
  it("accepts grouped atomic+composite handoffs and initializes system composition prefill coherently", async () => {
    const { service, gateway } = createIntegrationFixture();

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

    const result = await service.integrateHandoff({
      routingRequest: {
        handoffId: "handoff:grouped",
        source: { studioId: "workflow-studio-default", studioType: "workflow-studio" },
        sourceOutput: {
          sourceStudioType: "workflow-studio",
          sourceStudioId: "workflow-studio-default",
          authoritativeAsset: {
            assetId: "asset:workflow",
            versionId: "asset:workflow:v1",
            pinnedVersion: { assetId: "asset:workflow", versionId: "asset:workflow:v1" },
            taxonomy: workflowTaxonomy,
            contract: resolver.resolveContractForTaxonomy(workflowTaxonomy),
          },
          sourceReferences: [{ assetId: "asset:dataset", versionId: "asset:dataset:v5", relation: "dependency" }],
          handoffHints: { title: "Composed System", trainingObjective: "classification" },
        },
        multiAsset: {
          grouped: true,
          requireAllAssets: true,
          assets: [
            {
              role: "primary",
              assetId: "asset:workflow",
              versionId: "asset:workflow:v1",
              taxonomy: workflowTaxonomy,
              contract: resolver.resolveContractForTaxonomy(workflowTaxonomy),
            },
            {
              role: "supporting",
              assetId: "asset:dataset",
              versionId: "asset:dataset:v5",
              taxonomy: datasetTaxonomy,
              contract: resolver.resolveContractForTaxonomy(datasetTaxonomy),
            },
          ],
        },
        intent: { kind: StudioHandoffIntentKinds.systemIntegration },
        targetCapabilities: createCapabilities().listCapabilities(),
      },
      draftId: "draft-system-grouped",
    });

    expect(result.routeDecision.preferred?.studioType).toBe("system-studio");
    expect(result.handoffInput.grouped).toBeTrue();
    expect(result.handoffInput.assets).toHaveLength(2);
    expect(result.prefill.title).toBe("Composed System");
    expect(JSON.parse(result.prefill.content).systemSpec.components).toHaveLength(2);
    expect(result.draftId).toBe("draft-system-grouped");
    expect(gateway.ensureCalls).toBe(1);
    expect(gateway.createCalls).toBe(1);
  });

  it("accepts system asset handoffs for system-of-systems intake preserving version/revision facts", async () => {
    const { service } = createIntegrationFixture();

    const systemTaxonomy = createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.system,
      semanticRole: TaxonomySemanticRoles.system,
      behaviorKind: TaxonomyBehaviorKinds.iterative,
    });

    const initial = await service.integrateHandoff({
      routingRequest: {
        handoffId: "handoff:system",
        source: { studioId: "system-upstream-default", studioType: "system-studio-upstream" },
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
          sourceReferences: [{ assetId: "system:parent", versionId: "system:parent:v3", relation: "system-of-systems" }],
          handoffHints: { nestedStrategy: "compose" },
        },
        intent: { kind: StudioHandoffIntentKinds.systemIntegration },
        targetCapabilities: createCapabilities().listCapabilities(),
      },
      draftId: "draft-system-initial",
    });

    const updated = await service.integrateHandoff({
      routingRequest: {
        handoff: initial.orchestration.preparation!.handoff,
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
          sourceReferences: [{ assetId: "system:parent", versionId: "system:parent:v3", relation: "system-of-systems" }],
          handoffHints: { nestedStrategy: "compose" },
        },
        multiAsset: {
          grouped: true,
          requireAllAssets: true,
          assets: [
            {
              role: "primary",
              assetId: "system:child",
              versionId: "system:child:v2",
              taxonomy: systemTaxonomy,
            },
          ],
        },
        context: {
          ...initial.orchestration.preparation!.context,
          prefill: {
            values: {
              nestedStrategy: "compose",
              title: "Nested System",
            },
          },
        },
        intent: { kind: StudioHandoffIntentKinds.systemIntegration },
        targetCapabilities: createCapabilities().listCapabilities(),
      },
      draftId: "draft-system-updated",
    });

    expect(updated.handoffInput.authoritativeAsset.versionId).toBe("system:child:v2");
    expect(updated.handoffInput.revision?.previousHandoffId).toBe("handoff:system");
    expect(updated.handoffInput.revision?.updatedHandoffId).toContain("handoff:system:rev");
    const spec = JSON.parse(updated.prefill.content) as { systemSpec: { nestedSystems: Array<{ assetId: string; versionId: string }> } };
    expect(spec.systemSpec.nestedSystems[0]).toEqual({ assetId: "system:child", versionId: "system:child:v2", alias: "primary-1" });
  });
});
