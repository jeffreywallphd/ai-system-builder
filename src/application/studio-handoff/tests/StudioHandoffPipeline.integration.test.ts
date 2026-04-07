import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import { CompositionAssetContractResolver } from "../../contracts/CompositionAssetContractResolver";
import {
  createCompositionTaxonomyDescriptor,
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
  type CompositionTaxonomyDescriptor,
} from "@domain/taxonomy/CompositionTaxonomy";
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
import {
  StudioHandoffOrchestrationService,
  type StudioHandoffPreparation,
} from "../StudioHandoffOrchestrationService";
import {
  StudioHandoffAuditTrailService,
} from "../StudioHandoffAuditTrailService";
import { StudioHandoffLineageTracker } from "../StudioHandoffLineageTracker";
import {
  CrossStudioDependencyGraphBuilder,
  StudioHandoffDependencyTracker,
} from "../CrossStudioDependencyGraph";
import {
  StudioHandoffPersistenceService,
  StudioHandoffQueryService,
} from "../StudioHandoffPersistenceService";
import { StudioHandoffRetryService } from "../StudioHandoffRetryService";
import {
  createStudioHandoffContract,
  StudioHandoffIntentKinds,
} from "@domain/studio-handoff/StudioHandoffContract";
import { createStudioHandoffContext } from "@domain/studio-handoff/StudioHandoffContext";
import { SqliteStudioHandoffRepository } from "@infrastructure/filesystem/studio-handoff/SqliteStudioHandoffRepository";
import { SqliteStudioHandoffAuditRepository } from "@infrastructure/filesystem/studio-handoff/SqliteStudioHandoffAuditRepository";
import { SystemStudioHandoffIntegrationService } from "../SystemStudioHandoffIntegrationService";

const resolver = new CompositionAssetContractResolver();
const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (!dir) {
      continue;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createCapabilityQuery(): StudioCapabilityQueryService {
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
          allowedContextKeys: ["trainingObjective", "title", "priority"],
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
          allowedContextKeys: ["trainingObjective", "nestedStrategy", "title", "priority"],
        },
      }],
      producedOutputs: [],
    },
  ];
  registry.replaceAll(descriptors);
  return new StudioCapabilityQueryService(registry);
}

class InMemorySystemStudioGateway {
  public lastCreateCommand?: {
    readonly sessionId: string;
    readonly content: string;
    readonly dependencies?: ReadonlyArray<{ readonly assetId: string; readonly versionId?: string }>;
  };

  public async ensureStudioInitialized(studioId = "system-studio-default", studioName = "System Studio"): Promise<{ studio: { id: string; name: string }; session: { id: string } }> {
    return {
      studio: { id: studioId, name: studioName },
      session: { id: "session-system-default" },
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
    this.lastCreateCommand = command;
    return {
      draft: {
        id: command.draftId ?? "draft-system",
        content: command.content,
        dependencies: command.dependencies ?? [],
      },
    };
  }
}

function createFixture() {
  const query = createCapabilityQuery();

  const outputRegistry = new StudioOutputAdapterRegistry();
  outputRegistry.register(new AtomicStudioOutputAdapter(["dataset-studio", "model-studio", "tool-studio"]));
  outputRegistry.register(new CompositeStudioOutputAdapter(["workflow-studio", "tool-chain-studio", "context-bundle-studio"]));
  outputRegistry.register(new SystemStudioOutputAdapter(["system-studio", "system-studio-upstream"]));

  const inputRegistry = new StudioInputAdapterRegistry();
  inputRegistry.register(new AtomicStudioInputAdapter(["dataset-studio", "model-studio", "tool-studio"]));
  inputRegistry.register(new CompositeStudioInputAdapter(["workflow-studio", "tool-chain-studio", "context-bundle-studio"]));
  inputRegistry.register(new SystemStudioInputAdapter(["system-studio"]));

  const validator = new StudioHandoffCompatibilityValidator({
    validateVersionReference: ({ versionId }) => versionId.includes(":v"),
    capabilityQueryService: query,
  });

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "handoff-pipeline-int-"));
  tempDirs.push(dir);

  const auditRepository = new SqliteStudioHandoffAuditRepository(path.join(dir, "audit.db"));
  const auditTrail = new StudioHandoffAuditTrailService(auditRepository);
  const lineageTracker = new StudioHandoffLineageTracker();
  const dependencyTracker = new StudioHandoffDependencyTracker(new CrossStudioDependencyGraphBuilder());

  const orchestration = new StudioHandoffOrchestrationService(
    new StudioOutputAdapterLayer(outputRegistry),
    new StudioInputAdapterLayer(validator, inputRegistry),
    {
      lineageTracker,
      auditTrail,
    },
  );

  const routing = new StudioHandoffRoutingService(query, validator);

  const handoffRepository = new SqliteStudioHandoffRepository(path.join(dir, "handoff.db"));
  const persistence = new StudioHandoffPersistenceService(handoffRepository, auditTrail);
  const queryService = new StudioHandoffQueryService(handoffRepository);

  const retry = new StudioHandoffRetryService(queryService, persistence, orchestration, undefined, auditTrail);

  const systemGateway = new InMemorySystemStudioGateway();
  const systemIntegration = new SystemStudioHandoffIntegrationService(routing, orchestration, systemGateway as never);

  return {
    query,
    routing,
    orchestration,
    persistence,
    queryService,
    retry,
    auditTrail,
    lineageTracker,
    dependencyTracker,
    systemIntegration,
    systemGateway,
  };
}

function output(input: {
  readonly sourceStudioType: string;
  readonly sourceStudioId: string;
  readonly assetId: string;
  readonly versionId: string;
  readonly taxonomy: CompositionTaxonomyDescriptor;
  readonly references?: ReadonlyArray<{ readonly assetId: string; readonly versionId: string; readonly relation?: string }>;
  readonly hints?: Readonly<Record<string, unknown>>;
}): StudioProducedOutput {
  return {
    sourceStudioType: input.sourceStudioType,
    sourceStudioId: input.sourceStudioId,
    authoritativeAsset: {
      assetId: input.assetId,
      versionId: input.versionId,
      pinnedVersion: {
        assetId: input.assetId,
        versionId: input.versionId,
      },
      taxonomy: input.taxonomy,
      contract: resolver.resolveContractForTaxonomy(input.taxonomy),
    },
    sourceReferences: input.references,
    handoffHints: input.hints,
  };
}

function trackAndPersistPrepared(input: {
  readonly fixture: ReturnType<typeof createFixture>;
  readonly preparation: StudioHandoffPreparation;
  readonly revision?: {
    readonly revisionId: string;
    readonly previousHandoffId: string;
    readonly updatedHandoffId: string;
    readonly createdAt: string;
  };
  readonly changes?: Parameters<StudioHandoffDependencyTracker["track"]>[0]["changes"];
}) {
  const lineage = input.fixture.lineageTracker.track({
    preparation: input.preparation,
    revision: input.revision,
  }).record;
  const dependency = input.fixture.dependencyTracker.track({
    preparation: input.preparation,
    lineage,
    revision: input.revision,
    changes: input.changes,
  });
  return input.fixture.persistence.persistPrepared({
    preparation: input.preparation,
    revision: input.revision,
    changes: input.changes,
    lineage,
    dependency,
  });
}

describe("Studio handoff end-to-end pipeline integration", () => {
  it("orchestrates routeâ†’compatibilityâ†’adapterâ†’persistenceâ†’lineageâ†’dependencyâ†’audit for atomicâ†’composite", async () => {
    const fixture = createFixture();
    const datasetTaxonomy = createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.atomic,
      semanticRole: TaxonomySemanticRoles.dataset,
      behaviorKind: TaxonomyBehaviorKinds.none,
    });

    const routeDecision = fixture.routing.route({
      handoffId: "handoff:atomic-workflow",
      source: { studioType: "dataset-studio", studioId: "dataset-studio-default" },
      sourceOutput: output({
        sourceStudioType: "dataset-studio",
        sourceStudioId: "dataset-studio-default",
        assetId: "asset:dataset",
        versionId: "asset:dataset:v1",
        taxonomy: datasetTaxonomy,
        hints: { trainingObjective: "classification", title: "Dataset Flow" },
      }),
      intent: { kind: StudioHandoffIntentKinds.authoringContinuation },
    });

    expect(routeDecision.preferred?.studioType).toBe("workflow-studio");
    expect(routeDecision.preferred?.matchedContractId).toBe("workflow-default-input");

    const orchestration = fixture.orchestration.orchestrate({
      handoffId: "handoff:atomic-workflow",
      source: { studioType: "dataset-studio", studioId: "dataset-studio-default" },
      target: {
        studioType: routeDecision.preferred!.studioType,
        studioId: routeDecision.preferred!.studioId,
      },
      sourceOutput: output({
        sourceStudioType: "dataset-studio",
        sourceStudioId: "dataset-studio-default",
        assetId: "asset:dataset",
        versionId: "asset:dataset:v1",
        taxonomy: datasetTaxonomy,
        hints: { trainingObjective: "classification", title: "Dataset Flow" },
      }),
      targetInputContract: { contractId: routeDecision.preferred!.matchedContractId! },
      intent: { kind: StudioHandoffIntentKinds.authoringContinuation },
      targetCapabilities: fixture.query.listCapabilities(),
    });

    expect(orchestration.ok).toBeTrue();
    expect(orchestration.preparation?.targetInput.kind).toBe("composite");

    const persisted = await trackAndPersistPrepared({
      fixture,
      preparation: orchestration.preparation!,
    });

    expect(persisted.orchestration.status).toBe("prepared");
    expect(persisted.orchestration.targetInputKind).toBe("composite");

    const reloaded = await fixture.queryService.getByHandoffId("handoff:atomic-workflow");
    expect(reloaded?.targetStudioType).toBe("workflow-studio");
    expect(reloaded?.authoritativeAsset.versionId).toBe("asset:dataset:v1");

    const graph = fixture.dependencyTracker.buildGraph();
    expect(graph.edges.some((edge) => edge.kind === "handoff-derived-dependency")).toBeTrue();
    expect(fixture.lineageTracker.listRecords().length).toBeGreaterThan(0);

    const auditRecords = fixture.auditTrail.listByHandoffId("handoff:atomic-workflow");
    expect(auditRecords.length).toBeGreaterThanOrEqual(4);
    expect(auditRecords.some((entry) => entry.eventKind === "handoff-orchestrated")).toBeTrue();
  });

  it("supports grouped handoff into System Studio and authoritative System Studio initialization", async () => {
    const fixture = createFixture();
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

    const integrated = await fixture.systemIntegration.integrateHandoff({
      routingRequest: {
        handoffId: "handoff:grouped-system",
        source: { studioType: "workflow-studio", studioId: "workflow-studio-default" },
        sourceOutput: output({
          sourceStudioType: "workflow-studio",
          sourceStudioId: "workflow-studio-default",
          assetId: "asset:workflow",
          versionId: "asset:workflow:v9",
          taxonomy: workflowTaxonomy,
          references: [{ assetId: "asset:dataset", versionId: "asset:dataset:v4", relation: "dependency" }],
          hints: { title: "System Composition", nestedStrategy: "compose" },
        }),
        multiAsset: {
          grouped: true,
          requireAllAssets: true,
          assets: [
            {
              role: "primary",
              assetId: "asset:workflow",
              versionId: "asset:workflow:v9",
              taxonomy: workflowTaxonomy,
              contract: resolver.resolveContractForTaxonomy(workflowTaxonomy),
            },
            {
              role: "supporting",
              assetId: "asset:dataset",
              versionId: "asset:dataset:v4",
              taxonomy: datasetTaxonomy,
              contract: resolver.resolveContractForTaxonomy(datasetTaxonomy),
            },
          ],
        },
        intent: { kind: StudioHandoffIntentKinds.systemIntegration },
        targetCapabilities: fixture.query.listCapabilities(),
      },
      draftId: "draft-grouped-system",
    });

    expect(integrated.routeDecision.preferred?.studioType).toBe("system-studio");
    expect(integrated.orchestration.preparation?.targetInput.kind).toBe("system");
    expect(integrated.handoffInput.grouped).toBeTrue();
    expect(integrated.handoffInput.assets).toHaveLength(2);

    await trackAndPersistPrepared({
      fixture,
      preparation: integrated.orchestration.preparation!,
      revision: integrated.orchestration.revision,
      changes: integrated.orchestration.changes,
    });

    expect(integrated.draftId).toBe("draft-grouped-system");
    expect(fixture.systemGateway.lastCreateCommand?.dependencies).toHaveLength(2);
    expect(fixture.systemGateway.lastCreateCommand?.content.includes("handoff:grouped-system")).toBeTrue();
  });

  it("persists failed handoff then reconciles via retry service and records retry linkage", async () => {
    const fixture = createFixture();
    const datasetTaxonomy = createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.atomic,
      semanticRole: TaxonomySemanticRoles.dataset,
      behaviorKind: TaxonomyBehaviorKinds.none,
    });

    const invalid = fixture.orchestration.orchestrate({
      handoffId: "handoff:bad-version",
      source: { studioType: "dataset-studio", studioId: "dataset-studio-default" },
      target: { studioType: "workflow-studio", studioId: "workflow-studio-default" },
      sourceOutput: output({
        sourceStudioType: "dataset-studio",
        sourceStudioId: "dataset-studio-default",
        assetId: "asset:dataset",
        versionId: "asset:dataset@bad",
        taxonomy: datasetTaxonomy,
      }),
      targetInputContract: { contractId: "workflow-default-input" },
      intent: { kind: StudioHandoffIntentKinds.authoringContinuation },
      targetCapabilities: fixture.query.listCapabilities(),
    });

    expect(invalid.ok).toBeFalse();

    const failedHandoff = createStudioHandoffContract({
      id: "handoff:bad-version",
      source: { studioType: "dataset-studio", studioId: "dataset-studio-default" },
      target: { studioType: "workflow-studio", studioId: "workflow-studio-default" },
      payload: {
        assetId: "asset:dataset",
        versionId: "asset:dataset@bad",
        taxonomy: datasetTaxonomy,
        contract: resolver.resolveContractForTaxonomy(datasetTaxonomy),
        targetInputContract: { contractId: "workflow-default-input" },
      },
      intent: { kind: StudioHandoffIntentKinds.authoringContinuation },
    });

    await fixture.persistence.persistFailure({
      handoff: failedHandoff,
      context: createStudioHandoffContext({
        sourceStudioId: "dataset-studio-default",
        sourceStudioType: "dataset-studio",
        targetStudioId: "workflow-studio-default",
        targetStudioType: "workflow-studio",
        intent: { kind: StudioHandoffIntentKinds.authoringContinuation },
        sourceReferences: [{ assetId: "asset:dataset", versionId: "asset:dataset@bad", relation: "primary" }],
      }),
      failure: invalid.failure!,
    });

    const reconciledBasis = createStudioHandoffContract({
      id: "handoff:bad-version:retry",
      source: { studioType: "dataset-studio", studioId: "dataset-studio-default" },
      target: { studioType: "workflow-studio", studioId: "workflow-studio-default" },
      payload: {
        assetId: "asset:dataset",
        versionId: "asset:dataset:v2",
        taxonomy: datasetTaxonomy,
        contract: resolver.resolveContractForTaxonomy(datasetTaxonomy),
        targetInputContract: { contractId: "workflow-default-input" },
      },
      intent: { kind: StudioHandoffIntentKinds.authoringContinuation },
    });

    const result = await fixture.retry.reconcileFailedHandoff({
      handoffId: "handoff:bad-version",
      basisHandoff: reconciledBasis,
      sourceOutput: output({
        sourceStudioType: "dataset-studio",
        sourceStudioId: "dataset-studio-default",
        assetId: "asset:dataset",
        versionId: "asset:dataset:v2",
        taxonomy: datasetTaxonomy,
      }),
      targetCapabilities: fixture.query.listCapabilities(),
      contextOverride: createStudioHandoffContext({
        sourceStudioId: "dataset-studio-default",
        sourceStudioType: "dataset-studio",
        targetStudioId: "workflow-studio-default",
        targetStudioType: "workflow-studio",
        intent: { kind: StudioHandoffIntentKinds.authoringContinuation },
        sourceReferences: [{ assetId: "asset:dataset", versionId: "asset:dataset:v2", relation: "primary" }],
      }),
    });

    expect(result.allowed).toBeTrue();
    expect(result.retryLink?.attemptKind).toBe("reconciliation");
    expect(result.persisted?.orchestration.status).toBe("prepared");

    const reloaded = await fixture.queryService.getByHandoffId("handoff:bad-version:retry");
    expect(reloaded?.retryLink?.sourceHandoffId).toBe("handoff:bad-version");
  });

  it("preserves lineage/dependency coherence on version-aware refresh revisions", async () => {
    const fixture = createFixture();
    const datasetTaxonomy = createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.atomic,
      semanticRole: TaxonomySemanticRoles.dataset,
      behaviorKind: TaxonomyBehaviorKinds.none,
    });

    const base = fixture.orchestration.orchestrate({
      handoffId: "handoff:revision-base",
      source: { studioType: "dataset-studio", studioId: "dataset-studio-default" },
      target: { studioType: "workflow-studio", studioId: "workflow-studio-default" },
      sourceOutput: output({
        sourceStudioType: "dataset-studio",
        sourceStudioId: "dataset-studio-default",
        assetId: "asset:dataset",
        versionId: "asset:dataset:v1",
        taxonomy: datasetTaxonomy,
        hints: { trainingObjective: "classification" },
      }),
      targetInputContract: { contractId: "workflow-default-input" },
      intent: { kind: StudioHandoffIntentKinds.authoringContinuation },
      targetCapabilities: fixture.query.listCapabilities(),
    });

    await trackAndPersistPrepared({
      fixture,
      preparation: base.preparation!,
    });

    const revised = fixture.orchestration.refreshStudioHandoff({
      basis: base.preparation!.handoff,
      update: {
        revisionId: "rev-v2",
        handoffId: "handoff:revision-v2",
        assetVersionUpdates: [{ assetId: "asset:dataset", versionId: "asset:dataset:v2", role: "primary" }],
        contextPrefillPatch: { trainingObjective: "regression", priority: "high" },
      },
      sourceOutput: output({
        sourceStudioType: "dataset-studio",
        sourceStudioId: "dataset-studio-default",
        assetId: "asset:dataset",
        versionId: "asset:dataset:v2",
        taxonomy: datasetTaxonomy,
        hints: { trainingObjective: "regression", priority: "high" },
      }),
      targetCapabilities: fixture.query.listCapabilities(),
    });

    expect(revised.ok).toBeTrue();
    expect(revised.revision?.previousHandoffId).toBe("handoff:revision-base");
    expect(revised.changes?.updatedAuthoritativeAsset).toBeTrue();

    await trackAndPersistPrepared({
      fixture,
      preparation: revised.preparation!,
      revision: revised.revision,
      changes: revised.changes,
    });

    const loaded = await fixture.queryService.getByHandoffId("handoff:revision-v2");
    expect(loaded?.revision?.revisionId).toBe("rev-v2");
    expect(loaded?.revision?.previousHandoffId).toBe("handoff:revision-base");

    const dependencyGraph = fixture.dependencyTracker.buildGraph();
    expect(dependencyGraph.edges.some((edge) => edge.kind === "revision-supersedes")).toBeTrue();
    expect(fixture.lineageTracker.listRecords().some((record) => record.handoffRevisionId === "rev-v2")).toBeTrue();
  });
});

