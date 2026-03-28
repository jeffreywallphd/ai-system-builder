import { describe, expect, it } from "bun:test";
import { CompositionAssetContractResolver } from "../../contracts/CompositionAssetContractResolver";
import { createStudioHandoffContract, StudioHandoffAssetRoles, StudioHandoffIntentKinds } from "../../../domain/studio-handoff/StudioHandoffContract";
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
  AtomicStudioOutputAdapter,
  CompositeStudioOutputAdapter,
  StudioOutputAdapterLayer,
  StudioOutputAdapterRegistry,
  SystemStudioOutputAdapter,
} from "../StudioOutputAdapter";
import { StudioHandoffCompatibilityValidator } from "../StudioHandoffCompatibilityValidator";
import { StudioHandoffOrchestrationService } from "../StudioHandoffOrchestrationService";
import { InMemoryStudioHandoffAuditRepository, StudioHandoffAuditTrailService } from "../StudioHandoffAuditTrailService";
import { StudioHandoffAuditEventKinds } from "../../../domain/studio-handoff/StudioHandoffAuditTrail";
import type { StudioCapabilityDescriptor } from "../StudioCapabilityRegistry";

const resolver = new CompositionAssetContractResolver();

function createCapabilities(): ReadonlyArray<StudioCapabilityDescriptor> {
  return Object.freeze([
    {
      studioType: "workflow-studio",
      acceptsMultiAssetHandoffs: true,
      producesMultiAssetHandoffs: true,
      producedOutputs: Object.freeze([]),
      acceptedInputs: Object.freeze([
        {
          capabilityId: "workflow-default-input",
          supportsGroupedMultiAsset: true,
          contract: {
            contractId: "workflow-default-input",
            acceptedStructuralKinds: ["atomic", "composite"],
            acceptedSemanticRoles: ["dataset", "workflow"],
            acceptedBehaviorKinds: ["none", "deterministic"],
            allowedContextKeys: ["trainingObjective"],
          },
        },
      ]),
    },
  ]);
}

function createService(auditTrail: StudioHandoffAuditTrailService): StudioHandoffOrchestrationService {
  const outputRegistry = new StudioOutputAdapterRegistry();
  outputRegistry.register(new AtomicStudioOutputAdapter(["dataset-studio"]));
  outputRegistry.register(new CompositeStudioOutputAdapter(["workflow-studio"]));
  outputRegistry.register(new SystemStudioOutputAdapter(["system-studio"]));

  const inputRegistry = new StudioInputAdapterRegistry();
  inputRegistry.register(new AtomicStudioInputAdapter(["dataset-studio"]));
  inputRegistry.register(new CompositeStudioInputAdapter(["workflow-studio"]));
  inputRegistry.register(new SystemStudioInputAdapter(["system-studio"]));

  return new StudioHandoffOrchestrationService(
    new StudioOutputAdapterLayer(outputRegistry),
    new StudioInputAdapterLayer(
      new StudioHandoffCompatibilityValidator({
        validateVersionReference: ({ versionId }) => versionId.includes(":v"),
      }),
      inputRegistry,
    ),
    {
      auditTrail,
    },
  );
}

describe("StudioHandoffAuditTrailService integration", () => {
  it("records creation, compatibility, orchestration, and revision audit records with actor/studio/version context", () => {
    const auditRepository = new InMemoryStudioHandoffAuditRepository();
    const auditTrail = new StudioHandoffAuditTrailService(auditRepository);
    const service = createService(auditTrail);

    const datasetTaxonomy = createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.atomic,
      semanticRole: TaxonomySemanticRoles.dataset,
      behaviorKind: TaxonomyBehaviorKinds.none,
    });

    const initial = service.orchestrate({
      handoffId: "handoff:audit:base",
      source: { studioId: "dataset-studio-default", studioType: "dataset-studio" },
      target: { studioId: "workflow-studio-default", studioType: "workflow-studio" },
      sourceOutput: {
        sourceStudioType: "dataset-studio",
        sourceStudioId: "dataset-studio-default",
        authoritativeAsset: {
          assetId: "asset:dataset",
          versionId: "asset:dataset:v1",
          taxonomy: datasetTaxonomy,
          contract: resolver.resolveContractForTaxonomy(datasetTaxonomy),
        },
        handoffHints: { trainingObjective: "classification" },
      },
      targetInputContract: { contractId: "workflow-default-input" },
      intent: { kind: StudioHandoffIntentKinds.compositionAssembly },
      context: {
        domain: "studio-handoff-context",
        sourceStudioId: "dataset-studio-default",
        sourceStudioType: "dataset-studio",
        targetStudioId: "workflow-studio-default",
        targetStudioType: "workflow-studio",
        intent: { kind: StudioHandoffIntentKinds.compositionAssembly },
        initiatedAt: new Date().toISOString(),
        actor: { actorKind: "user", actorId: "user-123", requestSource: "studio-shell" },
        sourceReferences: [{ assetId: "asset:dataset", versionId: "asset:dataset:v1", relation: "primary" }],
      },
      targetCapabilities: createCapabilities(),
    });

    expect(initial.ok).toBeTrue();
    const refreshed = service.refreshStudioHandoff({
      basis: initial.preparation!.handoff,
      update: {
        revisionId: "rev-1",
        handoffId: "handoff:audit:rev1",
        assetVersionUpdates: [{ assetId: "asset:dataset", versionId: "asset:dataset:v2", role: StudioHandoffAssetRoles.primary }],
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
      },
      targetCapabilities: createCapabilities(),
    });

    expect(refreshed.ok).toBeTrue();

    const records = auditTrail.listRecent(20);
    expect(records.some((entry) => entry.eventKind === StudioHandoffAuditEventKinds.handoffCreated)).toBeTrue();
    expect(records.some((entry) => entry.eventKind === StudioHandoffAuditEventKinds.compatibilityEvaluated)).toBeTrue();
    expect(records.some((entry) => entry.eventKind === StudioHandoffAuditEventKinds.handoffOrchestrated)).toBeTrue();
    expect(records.some((entry) => entry.eventKind === StudioHandoffAuditEventKinds.handoffUpdated)).toBeTrue();

    const created = records.find((entry) =>
      entry.eventKind === StudioHandoffAuditEventKinds.handoffCreated
      && entry.handoff.handoffId === "handoff:audit:base"
    );
    expect(created?.actor?.actorId).toBe("user-123");
    expect(created?.sourceStudio.studioId).toBe("dataset-studio-default");
    expect(created?.targetStudio.studioId).toBe("workflow-studio-default");
    expect(created?.assets[0]?.versionId).toBe("asset:dataset:v1");

    const updated = records.find((entry) => entry.eventKind === StudioHandoffAuditEventKinds.handoffUpdated);
    expect(updated?.handoff.revisionId).toBe("rev-1");
    expect(updated?.handoff.previousHandoffId).toBe("handoff:audit:base");
    expect(updated?.assets[0]?.versionId).toBe("asset:dataset:v2");

    expect(records.every((entry) => !entry.eventKind.includes("deployment") && !entry.eventKind.includes("execution"))).toBeTrue();
  });

  it("records failed handoff attempts as dedicated handoff audit events", () => {
    const auditTrail = new StudioHandoffAuditTrailService(new InMemoryStudioHandoffAuditRepository());
    const service = createService(auditTrail);

    const bad = service.orchestrate({
      handoffId: "handoff:audit:bad",
      source: { studioId: "dataset-studio-default", studioType: "dataset-studio" },
      target: { studioId: "workflow-studio-default", studioType: "workflow-studio" },
      sourceOutput: {
        sourceStudioType: "dataset-studio",
        sourceStudioId: "dataset-studio-default",
        authoritativeAsset: {
          assetId: "asset:dataset",
          versionId: "asset:dataset:broken",
          taxonomy: createCompositionTaxonomyDescriptor({
            structuralKind: TaxonomyStructuralKinds.atomic,
            semanticRole: TaxonomySemanticRoles.dataset,
            behaviorKind: TaxonomyBehaviorKinds.none,
          }),
        },
        handoffHints: { disallowed: true },
      },
      targetInputContract: { contractId: "workflow-default-input" },
      intent: { kind: StudioHandoffIntentKinds.authoringContinuation },
      targetCapabilities: createCapabilities(),
    });

    expect(bad.ok).toBeFalse();
    const records = auditTrail.listByHandoffId("handoff:audit:bad", 20);
    expect(records.some((entry) => entry.eventKind === StudioHandoffAuditEventKinds.handoffFailed)).toBeTrue();
  });
});
