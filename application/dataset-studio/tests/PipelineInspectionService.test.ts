import { describe, expect, it } from "bun:test";
import {
  createCanonicalRecordsShape,
  createCanonicalTableShape,
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
});
