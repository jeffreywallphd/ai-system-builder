import { describe, expect, it } from "bun:test";
import {
  createCanonicalImageMetadataRecordsShape,
  createCanonicalRecordsShape,
  createCanonicalTextItemsShape,
} from "@domain/dataset-studio/CanonicalDataShapes";
import { PipelineExecutionStatusKinds } from "@domain/dataset-studio/PipelineInspectionDomain";
import { PipelineStageIds } from "@domain/dataset-studio/PipelineStageDomain";
import type { ResolvedDataSource } from "../DataConverterContracts";
import {
  createImagePreparationPipelineDefinition,
  chunkDocumentTextItems,
  createDocumentPreparationPipelineDefinition,
  createTabularCleaningPipelineDefinition,
  DocumentChunkingStrategyKinds,
  DocumentPreparationExtractionService,
  ImagePreparationExtractionService,
  SharpImageTransformationService,
  type IImageOcrExtractor,
} from "../MidLevelPipelineDefinitions";

describe("MidLevelPipelineDefinitions", () => {
  it("creates tabular cleaning pipeline with required stage ordering and graph/react-flow integration", () => {
    const pipeline = createTabularCleaningPipelineDefinition({
      includeTransformation: true,
      includeAggregation: true,
    });

    expect(pipeline.definition.stageInstances.map((stage) => stage.stageId)).toEqual([
      PipelineStageIds.Normalization,
      PipelineStageIds.Cleaning,
      PipelineStageIds.Transformation,
      PipelineStageIds.FeatureEngineering,
      PipelineStageIds.Aggregation,
    ]);

    const graph = pipeline.buildGraph();
    const reactFlow = pipeline.buildReactFlowGraph();

    expect(graph.nodes.some((node) => node.id === "stage:Normalization")).toBeTrue();
    expect(graph.nodes.some((node) => node.id === "stage:Cleaning")).toBeTrue();
    expect(reactFlow.nodes.length).toBe(graph.nodes.length);
    expect(reactFlow.edges.length).toBe(graph.edges.length);
  });

  it("creates document preparation pipeline with optional labeling/enrichment and composition mapping", () => {
    const pipeline = createDocumentPreparationPipelineDefinition({
      includeLabeling: true,
      includeEnrichment: true,
      chunkingStrategy: DocumentChunkingStrategyKinds.token,
      chunkSize: 64,
      chunkOverlap: 8,
    });

    expect(pipeline.definition.stageInstances.map((stage) => stage.stageId)).toEqual([
      PipelineStageIds.Extraction,
      PipelineStageIds.Normalization,
      PipelineStageIds.Chunking,
      PipelineStageIds.Labeling,
      PipelineStageIds.Enrichment,
    ]);

    const chunkingStage = pipeline.definition.stageInstances.find((stage) => stage.stageId === PipelineStageIds.Chunking);
    expect(chunkingStage?.config.options.chunkingStrategy).toBe("token");

    const graph = pipeline.buildGraph();
    expect(graph.nodes.some((node) => node.id === "stage:Chunking")).toBeTrue();
    expect(graph.edges.some((edge) => edge.sourceStageId === PipelineStageIds.Chunking)).toBeTrue();
  });

  it("enriches tabular inspection metadata with summary stats", () => {
    const pipeline = createTabularCleaningPipelineDefinition();
    const graph = pipeline.buildGraph();
    const inspectionService = pipeline.createInspectionService();

    const normalizationOutput = createCanonicalRecordsShape({
      records: Object.freeze([
        Object.freeze({ recordId: "1", fields: Object.freeze({ value: 2, name: "a" }) }),
        Object.freeze({ recordId: "2", fields: Object.freeze({ value: 4, name: "b" }) }),
      ]),
    });

    const inspection = inspectionService.inspectPipeline(graph, Object.freeze({
      pipelineGraph: graph,
      stageStatusById: Object.freeze({
        [PipelineStageIds.Normalization]: PipelineExecutionStatusKinds.complete,
      }),
      stageOutputById: Object.freeze({
        [PipelineStageIds.Normalization]: normalizationOutput,
      }),
    }));

    const normalization = inspection.stages.find((stage) => stage.stageId === PipelineStageIds.Normalization);
    expect(normalization?.metadata.summaryStats?.schemaSnapshotCaptured).toBeTrue();
    expect(normalization?.metadata.summaryStats?.["numeric.value.mean"]).toBe(3);
  });

  it("chunks text items by characters and tokens", () => {
    const input = createCanonicalTextItemsShape({
      items: Object.freeze([
        Object.freeze({ itemId: "item-1", text: "abcdefghijklmnopqrstuvwxyz" }),
      ]),
    });

    const characterChunks = chunkDocumentTextItems(input, {
      strategy: DocumentChunkingStrategyKinds.character,
      chunkSize: 10,
      chunkOverlap: 2,
    });
    expect(characterChunks.items.length).toBeGreaterThan(1);

    const tokenChunks = chunkDocumentTextItems(input, {
      strategy: DocumentChunkingStrategyKinds.token,
      chunkSize: 5,
      chunkOverlap: 1,
      tokenizerEncoding: "cl100k_base",
    });
    expect(tokenChunks.items.length).toBeGreaterThan(0);
  });

  it("extracts image OCR text into canonical text-items via injected extractor", async () => {
    const mockOcrExtractor: IImageOcrExtractor = {
      extractText: async () => "ocr text",
    };

    const source: ResolvedDataSource = Object.freeze({
      kind: "in-memory",
      sourceId: "source-image",
      reference: "file://image.png",
      payload: new Uint8Array([1, 2, 3]),
      fileName: "image.png",
      contentType: "image/png",
      diagnostics: Object.freeze([]),
    });

    const service = new DocumentPreparationExtractionService({
      ocrExtractor: mockOcrExtractor,
    });

    const output = await service.extractToTextItems({ source, documentId: "doc-image" });
    expect(output.kind).toBe("text-items");
    expect(output.items[0]?.text).toBe("ocr text");
  });

  it("creates image preparation pipeline with optional OCR extraction and enrichment composition", () => {
    const pipeline = createImagePreparationPipelineDefinition({
      includeExtraction: true,
      includeTransformation: true,
      includeLabeling: true,
      includeEnrichment: true,
      extractionEmitShape: "text-items",
      enrichment: {
        strategy: "lookup",
        outputFieldPrefix: "aug",
        previewSampleSize: 10,
      },
    });

    expect(pipeline.definition.stageInstances.map((stage) => stage.stageId)).toEqual([
      PipelineStageIds.Extraction,
      PipelineStageIds.Normalization,
      PipelineStageIds.Transformation,
      PipelineStageIds.Labeling,
      PipelineStageIds.Enrichment,
    ]);

    const graph = pipeline.buildGraph();
    const reactFlow = pipeline.buildReactFlowGraph();

    expect(graph.nodes.some((node) => node.id === "stage:Extraction")).toBeTrue();
    expect(graph.nodes.some((node) => node.id === "stage:Transformation")).toBeTrue();
    expect(reactFlow.nodes.length).toBe(graph.nodes.length);
  });

  it("extracts image metadata records when OCR is disabled in image preparation extraction service", async () => {
    const noOcrService = new ImagePreparationExtractionService({
      imageIngestor: {
        async execute() {
          return Object.freeze({
            ok: true,
            output: createCanonicalImageMetadataRecordsShape({
              items: Object.freeze([
                Object.freeze({
                  itemId: "image-1",
                  imageId: "image-1",
                  attributes: Object.freeze({
                    width: 100,
                    height: 100,
                    format: "png",
                  }),
                }),
              ]),
            }),
          });
        },
      } as unknown as any,
      ocrExtractor: {
        extractText: async () => "ocr text",
      },
    });

    const output = await noOcrService.extract({
      source: Object.freeze({
        kind: "in-memory",
        sourceId: "source-image",
        reference: "file://image.png",
        payload: new Uint8Array([1, 2, 3]),
        fileName: "image.png",
        contentType: "image/png",
        diagnostics: Object.freeze([]),
      }),
      enableOcr: false,
    });

    expect(output.kind).toBe("image-metadata-records");
  });

  it("runs sharp transformation service as no-op when no transform options are provided", async () => {
    const service = new SharpImageTransformationService();
    const payload = new Uint8Array([1, 2, 3, 4]);
    const result = await service.transform(payload, { targetFormat: "keep", grayscale: false });
    expect(result.transformed).toBeFalse();
    expect(result.payload).toEqual(payload);
  });
});

