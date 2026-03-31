import { z } from "zod";
import {
  deserializePipelineDefinition,
  serializePipelineDefinition,
  validatePipelineDefinition,
  type PipelineDefinition,
} from "../../domain/dataset-studio/PipelineDefinitionDomain";
import {
  deserializePipelineGraph,
  serializePipelineGraph,
  type PipelineGraph,
} from "../../domain/dataset-studio/PipelineGraphDomain";
import {
  validatePipelineTemplateInstantiationOptions,
  type PipelineTemplateId,
  type PipelineTemplateInstantiationOptions,
} from "../../domain/dataset-studio/MidLevelPipelineTemplateDomain";
import type { PipelineStageId } from "../../domain/dataset-studio/PipelineStageDomain";
import { buildReactFlowGraph, type PipelineReactFlowGraph } from "./PipelineReactFlowGraph";
import { PipelineValidationService } from "./PipelineValidationService";
import type { StageCompositionDefinition } from "./StageAssetCompositionService";

const PersistedPipelineDocumentVersion = "1.0.0";

export interface PersistedPipelineTemplateContext {
  readonly templateId: PipelineTemplateId;
  readonly instantiationOptions?: PipelineTemplateInstantiationOptions;
}

export interface PersistedMidLevelPipelineDocument {
  readonly kind: "dataset-mid-level-pipeline";
  readonly version: typeof PersistedPipelineDocumentVersion;
  readonly persistedAt: string;
  readonly pipelineId: string;
  readonly definition: string;
  readonly graph: string;
  readonly graphMetadata: {
    readonly nodeCount: number;
    readonly edgeCount: number;
    readonly stageIds: ReadonlyArray<PipelineStageId>;
  };
  readonly templateContext?: PersistedPipelineTemplateContext;
}

const PersistedPipelineTemplateContextSchema = z.object({
  templateId: z.string().trim().min(1),
  instantiationOptions: z.unknown().optional(),
});

const PersistedMidLevelPipelineDocumentSchema = z.object({
  kind: z.literal("dataset-mid-level-pipeline"),
  version: z.string().trim().min(1),
  persistedAt: z.string().trim().min(1),
  pipelineId: z.string().trim().min(1),
  definition: z.string().trim().min(1),
  graph: z.string().trim().min(1),
  graphMetadata: z.object({
    nodeCount: z.number().int().nonnegative(),
    edgeCount: z.number().int().nonnegative(),
    stageIds: z.array(z.string().trim().min(1)),
  }),
  templateContext: PersistedPipelineTemplateContextSchema.optional(),
});

export interface RehydratedPipelineArtifacts {
  readonly definition: PipelineDefinition;
  readonly pipelineGraph: PipelineGraph;
  readonly reactFlowGraph: PipelineReactFlowGraph;
}

export class PipelineSerializationService {
  private readonly validationService: PipelineValidationService;
  private readonly stageCompositions?: ReadonlyArray<StageCompositionDefinition>;

  constructor(input?: {
    readonly validationService?: PipelineValidationService;
    readonly stageCompositions?: ReadonlyArray<StageCompositionDefinition>;
  }) {
    this.validationService = input?.validationService ?? new PipelineValidationService({
      stageCompositions: input?.stageCompositions,
    });
    this.stageCompositions = input?.stageCompositions;
  }

  public toPersistedDocument(input: {
    readonly pipelineId: string;
    readonly definition: PipelineDefinition;
    readonly templateContext?: PersistedPipelineTemplateContext;
  }): PersistedMidLevelPipelineDocument {
    const pipelineId = input.pipelineId.trim();
    if (!pipelineId) {
      throw new Error("Pipeline id is required for persistence.");
    }

    const validated = this.validationService.validate({
      definition: input.definition,
      stageCompositions: this.stageCompositions,
      context: "default",
    });

    const templateContext = input.templateContext
      ? Object.freeze({
        templateId: input.templateContext.templateId.trim(),
        instantiationOptions: input.templateContext.instantiationOptions
          ? validatePipelineTemplateInstantiationOptions(input.templateContext.instantiationOptions)
          : undefined,
      })
      : undefined;

    return Object.freeze({
      kind: "dataset-mid-level-pipeline",
      version: PersistedPipelineDocumentVersion,
      persistedAt: new Date().toISOString(),
      pipelineId,
      definition: serializePipelineDefinition(validated.definition),
      graph: serializePipelineGraph(validated.graph),
      graphMetadata: Object.freeze({
        nodeCount: validated.graph.nodes.length,
        edgeCount: validated.graph.edges.length,
        stageIds: Object.freeze(
          validated.definition.stageInstances
            .filter((stage) => stage.enabled)
            .map((stage) => stage.stageId),
        ),
      }),
      templateContext,
    });
  }

  public serialize(document: PersistedMidLevelPipelineDocument): string {
    return JSON.stringify(document, null, 2);
  }

  public deserialize(serialized: string): PersistedMidLevelPipelineDocument {
    const parsed = JSON.parse(serialized) as unknown;
    return this.decode(parsed);
  }

  public decode(value: unknown): PersistedMidLevelPipelineDocument {
    const parsed = PersistedMidLevelPipelineDocumentSchema.parse(value);
    if (parsed.version !== PersistedPipelineDocumentVersion) {
      throw new Error(
        `Unsupported pipeline persistence version '${parsed.version}'. Expected '${PersistedPipelineDocumentVersion}'.`,
      );
    }

    return Object.freeze({
      kind: parsed.kind,
      version: PersistedPipelineDocumentVersion,
      persistedAt: parsed.persistedAt,
      pipelineId: parsed.pipelineId,
      definition: parsed.definition,
      graph: parsed.graph,
      graphMetadata: Object.freeze({
        nodeCount: parsed.graphMetadata.nodeCount,
        edgeCount: parsed.graphMetadata.edgeCount,
        stageIds: Object.freeze(parsed.graphMetadata.stageIds as PipelineStageId[]),
      }),
      templateContext: parsed.templateContext
        ? Object.freeze({
          templateId: parsed.templateContext.templateId,
          instantiationOptions: parsed.templateContext.instantiationOptions
            ? validatePipelineTemplateInstantiationOptions(
              parsed.templateContext.instantiationOptions as PipelineTemplateInstantiationOptions,
            )
            : undefined,
        })
        : undefined,
    });
  }

  public rehydrate(document: PersistedMidLevelPipelineDocument): RehydratedPipelineArtifacts {
    const definition = validatePipelineDefinition(deserializePipelineDefinition(document.definition));
    const expectedGraph = this.validationService.validate({
      definition,
      stageCompositions: this.stageCompositions,
      context: "default",
    }).graph;
    const persistedGraph = deserializePipelineGraph(document.graph);

    const expectedSerializedGraph = serializePipelineGraph(expectedGraph);
    const persistedSerializedGraph = serializePipelineGraph(persistedGraph);
    if (expectedSerializedGraph !== persistedSerializedGraph) {
      throw new Error(
        `Persisted graph for pipeline '${document.pipelineId}' is not equivalent to deterministic reconstruction.`,
      );
    }

    return Object.freeze({
      definition,
      pipelineGraph: persistedGraph,
      reactFlowGraph: buildReactFlowGraph(persistedGraph),
    });
  }
}

export function createPipelineSerializationService(input?: {
  readonly validationService?: PipelineValidationService;
  readonly stageCompositions?: ReadonlyArray<StageCompositionDefinition>;
}): PipelineSerializationService {
  return new PipelineSerializationService(input);
}
