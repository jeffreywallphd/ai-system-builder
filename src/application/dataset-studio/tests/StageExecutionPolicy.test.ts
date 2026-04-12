import { describe, expect, it } from "bun:test";
import { TemplateService } from "../TemplateService";
import {
  StageExecutionDispositions,
  StageExecutionPolicy,
} from "../StageExecutionPolicy";
import {
  createUnifiedIngestionStageOutputFromResult,
  toStageRecordFromUnifiedIngestionOutput,
} from "../StageIntegrationContracts";
import { createInitialStageFlowRuntimeState, withStageOutput } from "@domain/dataset-studio/StageFlowDefinition";
import { UnifiedIngestionOutputTargetKinds, UnifiedIngestionReferenceKinds } from "@domain/dataset-studio/UnifiedIngestionDomain";

describe("StageExecutionPolicy", () => {
  it("skips extraction when ingestion output is already structured", () => {
    const template = new TemplateService().getTemplate("document-default");
    const extraction = template.stageFlow.stages.find((stage) => stage.id === "extraction");
    if (!extraction) {
      throw new Error("expected extraction stage");
    }

    const policy = new StageExecutionPolicy();
    const state = withStageOutput(
      createInitialStageFlowRuntimeState(template.stageFlow),
      "ingestion",
      Object.freeze({ detectedSourceKind: "csv" }),
    );

    const decision = policy.evaluate({
      stage: extraction,
      stageFlow: template.stageFlow,
      state,
    });

    expect(decision.disposition).toBe(StageExecutionDispositions.skip);
  });

  it("auto-configures normalization when schema is known", () => {
    const template = new TemplateService().getTemplate("elt-default");
    const normalization = template.stageFlow.stages.find((stage) => stage.id === "normalization");
    if (!normalization) {
      throw new Error("expected normalization stage");
    }

    const policy = new StageExecutionPolicy();
    const state = withStageOutput(
      createInitialStageFlowRuntimeState(template.stageFlow),
      "ingestion",
      Object.freeze({ schemaKnown: true }),
    );

    const decision = policy.evaluate({
      stage: normalization,
      stageFlow: template.stageFlow,
      state,
      templateDefaults: template.defaultStageConfiguration,
      intentDefaults: Object.freeze({
        normalization: Object.freeze({ strategy: "contract-first" }),
      }),
    });

    expect(decision.disposition).toBe(StageExecutionDispositions.execute);
    expect(decision.autoConfiguration.schemaMode).toBe("known");
    expect(decision.autoConfiguration.useDetectedSchema).toBeTrue();
    expect(decision.autoConfiguration.strategy).toBe("contract-first");
  });

  it("auto-completes stages that already have completed outputs", () => {
    const template = new TemplateService().getTemplate("analytics-default");
    const profiling = template.stageFlow.stages.find((stage) => stage.id === "profiling");
    if (!profiling) {
      throw new Error("expected profiling stage");
    }

    const policy = new StageExecutionPolicy();
    const state = withStageOutput(
      createInitialStageFlowRuntimeState(template.stageFlow),
      "profiling",
      Object.freeze({ completed: true }),
    );

    const decision = policy.evaluate({
      stage: profiling,
      stageFlow: template.stageFlow,
      state,
    });

    expect(decision.disposition).toBe(StageExecutionDispositions.autoComplete);
  });

  it("reads strongly-typed unified ingestion stage output contracts", () => {
    const template = new TemplateService().getTemplate("document-default");
    const extraction = template.stageFlow.stages.find((stage) => stage.id === "extraction");
    if (!extraction) {
      throw new Error("expected extraction stage");
    }

    const policy = new StageExecutionPolicy();
    const typedOutput = createUnifiedIngestionStageOutputFromResult(Object.freeze({
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
          startedAt: "2026-03-31T10:00:00.000Z",
          completedAt: "2026-03-31T10:00:00.100Z",
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
        capturedAt: "2026-03-31T10:00:00.100Z",
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
    const state = withStageOutput(
      createInitialStageFlowRuntimeState(template.stageFlow),
      "ingestion",
      toStageRecordFromUnifiedIngestionOutput(typedOutput),
    );

    const decision = policy.evaluate({
      stage: extraction,
      stageFlow: template.stageFlow,
      state,
    });

    expect(decision.disposition).toBe(StageExecutionDispositions.skip);
  });

  it("propagates unified-ingestion metadata into raw-storage auto-configuration", () => {
    const template = new TemplateService().getTemplate("elt-default");
    const rawStorage = template.stageFlow.stages.find((stage) => stage.id === "raw-storage");
    if (!rawStorage) {
      throw new Error("expected raw-storage stage");
    }

    const policy = new StageExecutionPolicy();
    const state = withStageOutput(
      createInitialStageFlowRuntimeState(template.stageFlow),
      "ingestion",
      Object.freeze({
        completed: true,
        detectedSourceKind: "json",
        sourceId: "source-1",
        sourceReference: "memory://source-1",
        lineageId: "lineage-1",
        pipelineId: "dataset-unified-ingestion",
      }),
    );

    const decision = policy.evaluate({
      stage: rawStorage,
      stageFlow: template.stageFlow,
      state,
    });

    expect(decision.disposition).toBe(StageExecutionDispositions.execute);
    expect(decision.autoConfiguration.sourceId).toBe("source-1");
    expect(decision.autoConfiguration.sourceReference).toBe("memory://source-1");
    expect(decision.autoConfiguration.lineageId).toBe("lineage-1");
  });
});

