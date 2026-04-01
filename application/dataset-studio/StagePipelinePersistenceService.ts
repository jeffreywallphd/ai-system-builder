import { z } from "zod";
import type { StageFlowDefinition, StageFlowRuntimeState } from "../../domain/dataset-studio/StageFlowDefinition";
import type { DatasetPipelineStageAssetReference } from "../../domain/dataset-studio/StagePipelineDomain";
import type { StageRuntimeTracking } from "./StageMetadataContracts";
import type { StageCanvasGraphModel } from "./StageCanvasGraphProjectionService";
import { StageAssetMappingService } from "./StageAssetMappingService";
import { StageCanvasGraphProjectionService } from "./StageCanvasGraphProjectionService";
import { WizardFlowEngine, type WizardFlowEngineOptions } from "./WizardFlowEngine";

const PersistedStagePipelineSchemaVersion = "1.0.0";

export interface PersistedStagePipelineDocument {
  readonly kind: "dataset-stage-pipeline";
  readonly version: typeof PersistedStagePipelineSchemaVersion;
  readonly persistedAt: string;
  readonly pipeline: {
    readonly pipelineId: string;
    readonly flowId: string;
    readonly name: string;
    readonly description?: string;
    readonly intentId?: string;
    readonly intentTemplateId?: string;
  };
  readonly stageFlow: StageFlowDefinition;
  readonly runtimeState: StageFlowRuntimeState;
  readonly stageRuntimeTracking: Readonly<Record<string, StageRuntimeTracking>>;
  readonly wizard: {
    readonly navigationHistory: ReadonlyArray<string>;
  };
  readonly stageAssetMappings: Readonly<Record<string, ReadonlyArray<DatasetPipelineStageAssetReference>>>;
  readonly graph: {
    readonly nodeCount: number;
    readonly edgeCount: number;
    readonly stageCount: number;
  };
}

const PersistedEnvelopeSchema = z.object({
  kind: z.literal("dataset-stage-pipeline"),
  version: z.string().trim().min(1),
  persistedAt: z.string().trim().min(1),
  pipeline: z.object({
    pipelineId: z.string().trim().min(1),
    flowId: z.string().trim().min(1),
    name: z.string().trim().min(1),
    description: z.string().trim().min(1).optional(),
    intentId: z.string().trim().min(1).optional(),
    intentTemplateId: z.string().trim().min(1).optional(),
  }),
  stageFlow: z.unknown(),
  runtimeState: z.unknown(),
  stageRuntimeTracking: z.record(z.string().trim().min(1), z.unknown()),
  wizard: z.object({
    navigationHistory: z.array(z.string().trim().min(1)),
  }),
  stageAssetMappings: z.record(z.string().trim().min(1), z.array(z.object({
    assetId: z.string().trim().min(1),
    assetVersion: z.string().trim().min(1).optional(),
  }))),
  graph: z.object({
    nodeCount: z.number().int().nonnegative(),
    edgeCount: z.number().int().nonnegative(),
    stageCount: z.number().int().positive(),
  }),
});

export class StagePipelinePersistenceService {
  private readonly mappingService: StageAssetMappingService;
  private readonly projectionService: StageCanvasGraphProjectionService;

  constructor(options?: {
    readonly mappingService?: StageAssetMappingService;
    readonly projectionService?: StageCanvasGraphProjectionService;
  }) {
    this.mappingService = options?.mappingService ?? new StageAssetMappingService();
    this.projectionService = options?.projectionService ?? new StageCanvasGraphProjectionService(this.mappingService);
  }

  public saveFromWizard(input: {
    readonly engine: WizardFlowEngine;
    readonly pipelineId?: string;
  }): PersistedStagePipelineDocument {
    const stageFlow = input.engine.getStageFlow();
    const runtimeState = input.engine.getState();
    const graph = this.projectionService.projectFromWizard(input.engine);
    const stageAssetMappings = this.resolveStageAssetMappings(graph);

    return Object.freeze({
      kind: "dataset-stage-pipeline",
      version: PersistedStagePipelineSchemaVersion,
      persistedAt: new Date().toISOString(),
      pipeline: Object.freeze({
        pipelineId: input.pipelineId?.trim() || stageFlow.flowId,
        flowId: stageFlow.flowId,
        name: stageFlow.name,
        description: stageFlow.description,
        intentId: runtimeState.intentContext?.id,
        intentTemplateId: runtimeState.intentContext?.templateId,
      }),
      stageFlow,
      runtimeState,
      stageRuntimeTracking: input.engine.getStageRuntimeTracking(),
      wizard: Object.freeze({
        navigationHistory: input.engine.getNavigationHistory(),
      }),
      stageAssetMappings,
      graph: Object.freeze({
        nodeCount: graph.metadata.nodeCount,
        edgeCount: graph.metadata.edgeCount,
        stageCount: graph.metadata.stageCount,
      }),
    });
  }

  public serialize(document: PersistedStagePipelineDocument): string {
    return JSON.stringify(document, null, 2);
  }

  public deserialize(value: string): PersistedStagePipelineDocument {
    const parsed = JSON.parse(value) as unknown;
    return this.decode(parsed);
  }

  public decode(value: unknown): PersistedStagePipelineDocument {
    const legacy = this.tryDecodeLegacy(value);
    if (legacy) {
      return legacy;
    }
    const parsed = PersistedEnvelopeSchema.parse(value);
    if (parsed.version !== PersistedStagePipelineSchemaVersion) {
      throw new Error(
        `Unsupported persisted stage pipeline version '${parsed.version}'. Expected '${PersistedStagePipelineSchemaVersion}'.`,
      );
    }

    return Object.freeze({
      kind: parsed.kind,
      version: PersistedStagePipelineSchemaVersion,
      persistedAt: parsed.persistedAt,
      pipeline: parsed.pipeline,
      stageFlow: parsed.stageFlow as StageFlowDefinition,
      runtimeState: parsed.runtimeState as StageFlowRuntimeState,
      stageRuntimeTracking: parsed.stageRuntimeTracking as Readonly<Record<string, StageRuntimeTracking>>,
      wizard: parsed.wizard,
      stageAssetMappings: parsed.stageAssetMappings,
      graph: parsed.graph,
    });
  }

  public createWizardOptionsFromPersisted(
    document: PersistedStagePipelineDocument,
    overrides?: Pick<WizardFlowEngineOptions, "stageExecutionPolicy" | "conditionEvaluators" | "beforeTransition">,
  ): WizardFlowEngineOptions {
    return Object.freeze({
      stageFlow: document.stageFlow,
      runtimeState: document.runtimeState,
      stageRuntimeTracking: document.stageRuntimeTracking,
      navigationHistory: document.wizard.navigationHistory,
      stageExecutionPolicy: overrides?.stageExecutionPolicy,
      conditionEvaluators: overrides?.conditionEvaluators,
      beforeTransition: overrides?.beforeTransition,
    });
  }

  public rehydrateWizardEngine(
    document: PersistedStagePipelineDocument,
    overrides?: Pick<WizardFlowEngineOptions, "stageExecutionPolicy" | "conditionEvaluators" | "beforeTransition">,
  ): WizardFlowEngine {
    return new WizardFlowEngine(this.createWizardOptionsFromPersisted(document, overrides));
  }

  private resolveStageAssetMappings(
    graph: StageCanvasGraphModel,
  ): Readonly<Record<string, ReadonlyArray<DatasetPipelineStageAssetReference>>> {
    const mappings: Record<string, ReadonlyArray<DatasetPipelineStageAssetReference>> = {};
    for (const group of graph.groups) {
      const refs = graph.nodes
        .filter((node) => node.stageId === group.stageId)
        .map((node) => Object.freeze({
          assetId: node.assetId,
          assetVersion: node.assetVersion,
        }));
      mappings[group.stageId] = Object.freeze(refs);
    }
    return Object.freeze(mappings);
  }

  private tryDecodeLegacy(value: unknown): PersistedStagePipelineDocument | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }
    const candidate = value as {
      readonly stageFlow?: StageFlowDefinition;
      readonly state?: StageFlowRuntimeState;
      readonly runtimeState?: StageFlowRuntimeState;
      readonly stageRuntimeTracking?: Readonly<Record<string, StageRuntimeTracking>>;
      readonly navigationHistory?: ReadonlyArray<string>;
      readonly persistedAt?: string;
    };
    if (!candidate.stageFlow || (!candidate.state && !candidate.runtimeState)) {
      return undefined;
    }

    const runtimeState = candidate.runtimeState ?? candidate.state;
    if (!runtimeState) {
      return undefined;
    }
    const stageRuntimeTracking = candidate.stageRuntimeTracking ?? Object.freeze({});
    const graph = this.projectionService.projectFromSavedFlow({
      stageFlow: candidate.stageFlow,
      state: runtimeState,
      stageRuntimeTracking,
    });

    return Object.freeze({
      kind: "dataset-stage-pipeline",
      version: PersistedStagePipelineSchemaVersion,
      persistedAt: candidate.persistedAt ?? new Date().toISOString(),
      pipeline: Object.freeze({
        pipelineId: candidate.stageFlow.flowId,
        flowId: candidate.stageFlow.flowId,
        name: candidate.stageFlow.name,
        description: candidate.stageFlow.description,
        intentId: runtimeState.intentContext?.id,
        intentTemplateId: runtimeState.intentContext?.templateId,
      }),
      stageFlow: candidate.stageFlow,
      runtimeState,
      stageRuntimeTracking,
      wizard: Object.freeze({
        navigationHistory: Object.freeze([...(candidate.navigationHistory ?? [])]),
      }),
      stageAssetMappings: this.resolveStageAssetMappings(graph),
      graph: Object.freeze({
        nodeCount: graph.metadata.nodeCount,
        edgeCount: graph.metadata.edgeCount,
        stageCount: graph.metadata.stageCount,
      }),
    });
  }
}

export function createStagePipelinePersistenceService(options?: {
  readonly mappingService?: StageAssetMappingService;
  readonly projectionService?: StageCanvasGraphProjectionService;
}): StagePipelinePersistenceService {
  return new StagePipelinePersistenceService(options);
}
