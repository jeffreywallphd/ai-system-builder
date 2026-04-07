import { describe, expect, it } from "bun:test";
import {
  createCanonicalRecordsShape,
  createCanonicalTableShape,
  createCanonicalTextItemsShape,
} from "../../../domain/dataset-studio/CanonicalDataShapes";
import { PipelineExecutionStatusKinds } from "../../../domain/dataset-studio/PipelineInspectionDomain";
import {
  createPipelineStageInstance,
  PipelineStageConfigModes,
  PipelineStageIds,
} from "../../../domain/dataset-studio/PipelineStageDomain";
import { PipelineStageRegistry } from "../../../domain/dataset-studio/PipelineStageRegistry";
import { buildPipelineGraph } from "../PipelineGraphConstructionService";
import { PipelineInspectionService } from "../PipelineInspectionService";

describe("PipelineInspectionService", () => {
  it("inspects pipeline/stage/asset outputs with typed previews and metadata", () => {
    const registry = new PipelineStageRegistry();
    const stageInstances = Object.freeze([
      createPipelineStageInstance({
        definition: registry.getDefinition(PipelineStageIds.SourceSelection),
        config: { mode: PipelineStageConfigModes.simple, options: Object.freeze({}) },
      }),
      createPipelineStageInstance({
        definition: registry.getDefinition(PipelineStageIds.UnifiedIngestion),
        config: { mode: PipelineStageConfigModes.simple, options: Object.freeze({ outputTarget: "records" }) },
      }),
      createPipelineStageInstance({
        definition: registry.getDefinition(PipelineStageIds.Normalization),
        config: { mode: PipelineStageConfigModes.simple, options: Object.freeze({}) },
      }),
    ]);

    const graph = buildPipelineGraph({ stageInstances });
    const stageOutput = createCanonicalRecordsShape({
      records: Object.freeze([
        Object.freeze({ recordId: "1", fields: Object.freeze({ name: "A", value: 1 }) }),
        Object.freeze({ recordId: "2", fields: Object.freeze({ name: "B", value: 2 }) }),
      ]),
    });
    const firstAsset = graph.nodes.find((node) => node.kind === "asset");
    expect(firstAsset).toBeDefined();

    const assetOutput = createCanonicalTableShape({
      columns: Object.freeze([
        Object.freeze({ columnId: "name", label: "Name", valueType: "string" as const }),
      ]),
      rows: Object.freeze([
        Object.freeze({ rowId: "r1", cells: Object.freeze({ name: "A" }) }),
      ]),
    });

    const service = new PipelineInspectionService({
      preview: { maxRecords: 1 },
    });
    const inspection = service.inspectPipeline(graph, Object.freeze({
      stageStatusById: Object.freeze({
        [PipelineStageIds.SourceSelection]: PipelineExecutionStatusKinds.complete,
        [PipelineStageIds.UnifiedIngestion]: PipelineExecutionStatusKinds.running,
      }),
      stageOutputById: Object.freeze({
        [PipelineStageIds.SourceSelection]: stageOutput,
      }),
      assetStatusByNodeId: firstAsset
        ? Object.freeze({ [firstAsset.id]: PipelineExecutionStatusKinds.complete })
        : Object.freeze({}),
      assetOutputByNodeId: firstAsset
        ? Object.freeze({ [firstAsset.id]: assetOutput })
        : Object.freeze({}),
      pipelineGraph: graph,
    }));

    expect(inspection.status).toBe(PipelineExecutionStatusKinds.running);
    expect(inspection.stages.length).toBe(3);
    expect(inspection.assets.length).toBeGreaterThan(0);
    expect(inspection.stages[0]?.previewData?.kind).toBe("records");
    expect(inspection.stages[0]?.preview?.version).toBe("1.0.0");
    expect(inspection.stages[0]?.preview?.kind).toBe("records");
    expect(inspection.stages[0]?.previewData && "items" in inspection.stages[0].previewData
      ? inspection.stages[0].previewData.items.length
      : 0).toBe(1);
    expect(inspection.stages[0]?.metadata.rowCount).toBe(2);

    const stageInspection = service.inspectStage(PipelineStageIds.SourceSelection, Object.freeze({ pipelineGraph: graph }));
    expect(stageInspection?.stageId).toBe(PipelineStageIds.SourceSelection);

    const assetInspection = firstAsset
      ? service.inspectAsset(firstAsset.id, Object.freeze({ pipelineGraph: graph }))
      : undefined;
    expect(assetInspection?.assetNodeId).toBe(firstAsset?.id);

    const graphWithInspection = service.attachInspectionMetadata(graph, inspection);
    const stageNode = graphWithInspection.nodes.find((node) => node.kind === "stage");
    expect(stageNode && "inspection" in stageNode.data ? stageNode.data.inspection?.status : undefined)
      .toBeDefined();
  });

  it("supports stage-specific enrichment hooks without hardcoded stage logic", () => {
    const registry = new PipelineStageRegistry();
    const stageInstances = Object.freeze([
      createPipelineStageInstance({
        definition: registry.getDefinition(PipelineStageIds.SourceSelection),
        config: { mode: PipelineStageConfigModes.simple, options: Object.freeze({}) },
      }),
      createPipelineStageInstance({
        definition: registry.getDefinition(PipelineStageIds.Profiling),
        config: { mode: PipelineStageConfigModes.simple, options: Object.freeze({}) },
      }),
      createPipelineStageInstance({
        definition: registry.getDefinition(PipelineStageIds.Cleaning),
        config: { mode: PipelineStageConfigModes.simple, options: Object.freeze({}) },
      }),
      createPipelineStageInstance({
        definition: registry.getDefinition(PipelineStageIds.Extraction),
        config: { mode: PipelineStageConfigModes.simple, options: Object.freeze({}) },
      }),
    ]);

    const graph = buildPipelineGraph({
      stageInstances,
      transitions: Object.freeze([
        Object.freeze({ fromStageId: PipelineStageIds.SourceSelection, toStageId: PipelineStageIds.Profiling }),
        Object.freeze({ fromStageId: PipelineStageIds.Profiling, toStageId: PipelineStageIds.Cleaning }),
        Object.freeze({ fromStageId: PipelineStageIds.Cleaning, toStageId: PipelineStageIds.Extraction }),
      ]),
    });

    const service = new PipelineInspectionService({
      hooks: {
        stage: Object.freeze([
          (context) => context.stageNode.data.stageId === PipelineStageIds.Profiling
            ? Object.freeze({ summaryStats: Object.freeze({ profiledFields: 12 }) })
            : undefined,
          (context) => context.stageNode.data.stageId === PipelineStageIds.Cleaning
            ? Object.freeze({ summaryStats: Object.freeze({ deduplicatedCount: 8 }) })
            : undefined,
          (context) => context.stageNode.data.stageId === PipelineStageIds.Extraction
            ? Object.freeze({ summaryStats: Object.freeze({ tokenCount: 320 }) })
            : undefined,
        ]),
      },
    });

    const inspection = service.inspectPipeline(graph, Object.freeze({ pipelineGraph: graph }));
    const profiling = inspection.stages.find((stage) => stage.stageId === PipelineStageIds.Profiling);
    const cleaning = inspection.stages.find((stage) => stage.stageId === PipelineStageIds.Cleaning);
    const extraction = inspection.stages.find((stage) => stage.stageId === PipelineStageIds.Extraction);

    expect(profiling?.metadata.summaryStats?.profiledFields).toBe(12);
    expect(cleaning?.metadata.summaryStats?.deduplicatedCount).toBe(8);
    expect(extraction?.metadata.summaryStats?.tokenCount).toBe(320);
  });

  it("surfaces feature-engineering and labeling inspection metadata for mode/status/count visibility", () => {
    const registry = new PipelineStageRegistry();
    const stageInstances = Object.freeze([
      createPipelineStageInstance({
        definition: registry.getDefinition(PipelineStageIds.Transformation),
        config: {
          mode: PipelineStageConfigModes.advanced,
          declaredInputType: "records",
          expectedOutputType: "records",
          options: Object.freeze({}),
        },
      }),
      createPipelineStageInstance({
        definition: registry.getDefinition(PipelineStageIds.FeatureEngineering),
        config: {
          mode: PipelineStageConfigModes.advanced,
          declaredInputType: "records",
          expectedOutputType: "records",
          options: Object.freeze({
            featureStrategy: "structured",
            featureOperations: Object.freeze([
              Object.freeze({
                kind: "derived-numeric",
                operationId: "op-1",
                targetField: "feature.margin",
                method: "difference",
                sourceFields: Object.freeze(["price", "cost"]),
              }),
            ]),
          }),
        },
      }),
      createPipelineStageInstance({
        definition: registry.getDefinition(PipelineStageIds.Labeling),
        config: {
          mode: PipelineStageConfigModes.advanced,
          declaredInputType: "records",
          expectedOutputType: "records",
          options: Object.freeze({
            labelingMode: "assisted",
            annotationTarget: "record",
            annotationAttachmentMode: "embedded",
            annotationAllowFreeText: true,
            annotationEmitManualNeeded: true,
            annotationAssistedSeedFromClassification: false,
            annotationRecords: Object.freeze([
              Object.freeze({
                annotationId: "ann-1",
                target: "record",
                targetRef: "r-1",
                label: "positive",
                source: "seed",
                status: "manual-needed",
              }),
            ]),
          }),
        },
      }),
    ]);

    const graph = buildPipelineGraph({ stageInstances });
    const transformationOutput = createCanonicalRecordsShape({
      records: Object.freeze([
        Object.freeze({ recordId: "r-1", fields: Object.freeze({ price: 12, cost: 3 }) }),
      ]),
    });
    const featureOutput = createCanonicalRecordsShape({
      records: Object.freeze([
        Object.freeze({ recordId: "r-1", fields: Object.freeze({ price: 12, cost: 3, "feature.margin": 9 }) }),
      ]),
    });

    const inspection = new PipelineInspectionService().inspectPipeline(graph, Object.freeze({
      pipelineGraph: graph,
      stageStatusById: Object.freeze({
        [PipelineStageIds.FeatureEngineering]: PipelineExecutionStatusKinds.complete,
        [PipelineStageIds.Labeling]: PipelineExecutionStatusKinds.running,
      }),
      stageOutputById: Object.freeze({
        [PipelineStageIds.Transformation]: transformationOutput,
        [PipelineStageIds.FeatureEngineering]: featureOutput,
        [PipelineStageIds.Labeling]: createCanonicalTextItemsShape({
          items: Object.freeze([
            Object.freeze({ itemId: "chunk-1", text: "sample", sourceDocumentId: "doc-1" }),
          ]),
        }),
      }),
    }));

    const featureStage = inspection.stages.find((stage) => stage.stageId === PipelineStageIds.FeatureEngineering);
    const labelingStage = inspection.stages.find((stage) => stage.stageId === PipelineStageIds.Labeling);

    expect(featureStage?.metadata.summaryStats?.["feature.operationCount"]).toBe(1);
    expect(featureStage?.metadata.summaryStats?.["feature.beforeAfterPreviewAvailable"]).toBeTrue();
    expect(labelingStage?.metadata.summaryStats?.["annotation.mode"]).toBe("assisted");
    expect(labelingStage?.metadata.summaryStats?.["annotation.manualNeededCount"]).toBe(1);
  });
});
