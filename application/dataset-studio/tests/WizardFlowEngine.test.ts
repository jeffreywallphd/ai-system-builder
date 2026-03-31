import { describe, expect, it } from "bun:test";
import { UnifiedIngestionOutputTargetKinds, UnifiedIngestionReferenceKinds } from "../../../domain/dataset-studio/UnifiedIngestionDomain";
import { IntentService } from "../IntentService";
import { StageExecutionPolicy } from "../StageExecutionPolicy";
import { TemplateService } from "../TemplateService";
import { WizardFlowEngine } from "../WizardFlowEngine";

describe("WizardFlowEngine", () => {
  it("navigates forward/backward through stage flow state", () => {
    const templates = new TemplateService();
    const template = templates.getTemplate("elt-default");
    const engine = new WizardFlowEngine({
      template,
    });

    const firstMove = engine.goNext();
    expect(firstMove.moved).toBeTrue();
    expect(engine.getState().currentStageId).toBe("ingestion");

    const secondMove = engine.goBack();
    expect(secondMove.moved).toBeTrue();
    expect(engine.getState().currentStageId).toBe("source");
  });

  it("supports conditional branching based on stage outputs", () => {
    const templates = new TemplateService();
    const template = templates.getTemplate("document-default");
    const engine = new WizardFlowEngine({
      stageFlow: {
        ...template.stageFlow,
        conditionalTransitions: Object.freeze([
          Object.freeze({
            id: "skip-to-prepared",
            fromStageId: "ingestion",
            toStageId: "prepared-storage",
            conditionId: "skip-document-transform",
            priority: 1,
          }),
        ]),
      },
      conditionEvaluators: Object.freeze({
        "skip-document-transform": (context) => context.stageOutputs.ingestion?.sourceKind === "image",
      }),
    });

    engine.goNext();
    engine.setStageOutput("ingestion", Object.freeze({ sourceKind: "image" }));
    const move = engine.goNext();

    expect(move.moved).toBeTrue();
    expect(move.transition?.toStageId).toBe("prepared-storage");
    expect(move.transition?.skippedStageIds).toEqual([
      "raw-storage",
      "extraction",
      "chunking",
      "transformation",
    ]);
  });

  it("auto-skips conditional stages when condition criteria are not met", () => {
    const templates = new TemplateService();
    const template = templates.getTemplate("document-default");
    const engine = new WizardFlowEngine({
      template,
      conditionEvaluators: Object.freeze({
        "requires-extraction": (context) => context.stageConfiguration.source?.sourceKind === "document",
      }),
    });

    engine.setStageConfiguration("source", Object.freeze({ sourceKind: "json" }));
    engine.goNext();
    engine.setStageOutput("raw-storage", Object.freeze({ completed: true }));
    engine.goNext();
    const move = engine.goNext();

    expect(move.moved).toBeTrue();
    expect(move.transition?.toStageId).toBe("chunking");
    expect(move.transition?.skippedStageIds).toContain("extraction");
  });

  it("initializes flow using intent resolution and tracks intent context", () => {
    const templates = new TemplateService();
    const intents = new IntentService(templates);
    const engine = new WizardFlowEngine({
      intentId: "ml",
      intentService: intents,
      stageExecutionPolicy: new StageExecutionPolicy(),
    });

    expect(engine.getIntentContext()?.id).toBe("ml");
    expect(engine.getStageFlow().stages.some((stage) => stage.kind === "feature-engineering")).toBeTrue();
    expect(engine.getState().autoConfiguredStageIds).toContain("normalization");
  });

  it("tracks skipped, auto-configured, and user-overridden stages", () => {
    const templates = new TemplateService();
    const intents = new IntentService(templates);
    const template = templates.getTemplate("document-default");
    const engine = new WizardFlowEngine({
      template,
      intentId: "document",
      intentService: intents,
      stageExecutionPolicy: new StageExecutionPolicy(),
    });

    engine.setStageConfiguration("chunking", Object.freeze({ chunkSize: 800, chunkOverlap: 100 }));
    engine.goNext();
    engine.setStageOutput("ingestion", Object.freeze({ detectedSourceKind: "json" }));
    engine.setStageOutput("raw-storage", Object.freeze({ completed: true }));
    engine.goNext();
    const move = engine.goNext();

    expect(move.transition?.skippedStageIds).toContain("extraction");
    expect(engine.getState().skippedStageIds).toContain("extraction");
    expect(engine.getState().autoConfiguredStageIds).toContain("chunking");
    expect(engine.getState().userOverriddenStageIds).toContain("chunking");
  });

  it("propagates unified-ingestion stage output metadata through stage state", () => {
    const templates = new TemplateService();
    const template = templates.getTemplate("elt-default");
    const engine = new WizardFlowEngine({
      template,
      stageExecutionPolicy: new StageExecutionPolicy(),
    });

    engine.setUnifiedIngestionStageOutput("ingestion", Object.freeze({
      contractVersion: "1.0.0",
      ok: true,
      source: Object.freeze({
        sourceId: "source-1",
        referenceKind: UnifiedIngestionReferenceKinds.inMemory,
        reference: "memory://source-1",
      }),
      outputTarget: UnifiedIngestionOutputTargetKinds.records,
      detection: Object.freeze({
        contractVersion: "1.0.0",
        source: Object.freeze({
          sourceId: "source-1",
          referenceKind: UnifiedIngestionReferenceKinds.inMemory,
          reference: "memory://source-1",
        }),
        detectedKind: "json",
        confidence: "high",
        normalizedMetadata: Object.freeze({}),
        candidateScores: Object.freeze({ csv: 0, json: 100, document: 0, image: 0, unknown: 0 }),
        evidence: Object.freeze([]),
      }),
      route: Object.freeze({
        status: "resolved",
        sourceKind: "json",
        handlerKind: "json",
        assetId: "json-ingestor",
        policy: "detected-kind",
        fallbackUsed: false,
        reason: "detected kind",
      }),
      output: Object.freeze({
        kind: "records",
        records: Object.freeze([]),
        metadata: Object.freeze({ schemaVersion: "1.0.0" }),
      }),
      normalized: Object.freeze({
        contractVersion: "1.0.0",
        normalizationVersion: "1.0.0",
        canonicalOutputKind: "records",
        normalizedPayload: Object.freeze({
          kind: "records",
          records: Object.freeze([]),
          metadata: Object.freeze({ schemaVersion: "1.0.0" }),
        }),
        metadata: Object.freeze({
          outputTarget: UnifiedIngestionOutputTargetKinds.records,
          configurationMode: "simple",
          sourceId: "source-1",
          sourceReference: "memory://source-1",
          totalCount: 0,
          isEmpty: true,
        }),
        detectionSummary: Object.freeze({
          detectedKind: "json",
          confidence: "high",
          evidenceCount: 0,
        }),
        routeSummary: Object.freeze({
          handlerKind: "json",
          assetId: "json-ingestor",
          policy: "detected-kind",
          fallbackUsed: false,
        }),
        warnings: Object.freeze([]),
      }),
      metadata: Object.freeze({
        contractVersion: "1.0.0",
        metadataVersion: "1.0.0",
        source: Object.freeze({
          sourceId: "source-1",
          reference: "memory://source-1",
          referenceKind: "in-memory",
        }),
        detection: Object.freeze({
          detectedKind: "json",
          confidence: "high",
          candidateScores: Object.freeze({ csv: 0, json: 100, document: 0, image: 0, unknown: 0 }),
          evidenceCount: 0,
          normalizedMetadata: Object.freeze({}),
        }),
        route: Object.freeze({
          status: "resolved",
          sourceKind: "json",
          handlerKind: "json",
          assetId: "json-ingestor",
          policy: "detected-kind",
          fallbackUsed: false,
        }),
        normalization: Object.freeze({
          normalizationVersion: "1.0.0",
          outputTarget: UnifiedIngestionOutputTargetKinds.records,
          canonicalOutputKind: "records",
          totalCount: 0,
          isEmpty: true,
        }),
        processing: Object.freeze({
          startedAt: "2026-03-31T12:00:00.000Z",
          completedAt: "2026-03-31T12:00:00.100Z",
          configurationMode: "simple",
          outputTarget: UnifiedIngestionOutputTargetKinds.records,
          stageCount: 5,
          pipelineId: "dataset-unified-ingestion",
          orderedStageIds: Object.freeze(["source-selection", "ingestion", "normalization"]),
          warningCount: 0,
          errorCount: 0,
          fallbackCount: 0,
        }),
      }),
      lineage: Object.freeze({
        contractVersion: "1.0.0",
        lineageVersion: "1.0.0",
        lineageId: "lineage-1",
        capturedAt: "2026-03-31T12:00:00.100Z",
        source: Object.freeze({
          sourceId: "source-1",
          reference: "memory://source-1",
          referenceKind: "in-memory",
        }),
        stages: Object.freeze([]),
      }),
      conversion: Object.freeze({
        operation: "source-to-records",
        inputBoundary: "resolved-source",
      }),
      issues: Object.freeze([]),
      fallbacks: Object.freeze([]),
    }));

    const stageOutput = engine.getState().stageOutputs.ingestion;
    expect(stageOutput?.detectedSourceKind).toBe("json");
    expect(stageOutput?.lineageId).toBe("lineage-1");
    expect(stageOutput?.pipelineId).toBe("dataset-unified-ingestion");

    const tracking = engine.getStageRuntimeTracking();
    expect(tracking.normalization?.propagated?.detectedDataType).toBe("json");
    expect(tracking.normalization?.metadata.status.marker).toBe("pending");
  });
});
