import type { CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";
import { DatasetPipelineStageKinds, type DatasetPipelineStageDefinition } from "../../domain/dataset-studio/StagePipelineDomain";
import type { StageFlowDefinition, StageFlowRuntimeState } from "../../domain/dataset-studio/StageFlowDefinition";
import { UnifiedIngestionSourceKinds } from "../../domain/dataset-studio/UnifiedIngestionDomain";
import type { IntentContext } from "./IntentService";
import { StageAssetMappingService } from "./StageAssetMappingService";

export const StageExecutionDispositions = Object.freeze({
  execute: "execute",
  autoComplete: "auto-complete",
  skip: "skip",
} as const);

export type StageExecutionDisposition = typeof StageExecutionDispositions[keyof typeof StageExecutionDispositions];

export interface StageExecutionPolicyDecision {
  readonly disposition: StageExecutionDisposition;
  readonly reason: string;
  readonly autoConfiguration: Readonly<Record<string, CanonicalRecordValue>>;
}

export interface StageExecutionPolicyContext {
  readonly stage: DatasetPipelineStageDefinition;
  readonly stageFlow: StageFlowDefinition;
  readonly state: StageFlowRuntimeState;
  readonly intent?: IntentContext;
  readonly templateDefaults?: Readonly<Record<string, Readonly<Record<string, CanonicalRecordValue>>>>;
  readonly intentDefaults?: Readonly<Record<string, Readonly<Record<string, CanonicalRecordValue>>>>;
}

function freezeRecord(value: Readonly<Record<string, CanonicalRecordValue>>): Readonly<Record<string, CanonicalRecordValue>> {
  return Object.freeze({ ...value });
}

function toBoolean(value: CanonicalRecordValue | undefined): boolean {
  return value === true || value === "true" || value === 1;
}

function toString(value: CanonicalRecordValue | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function hasAnyUpstreamOutput(stageFlow: StageFlowDefinition, stage: DatasetPipelineStageDefinition, state: StageFlowRuntimeState): boolean {
  const stageIndex = stageFlow.stages.findIndex((entry) => entry.id === stage.id);
  if (stageIndex <= 0) {
    return true;
  }
  const upstream = stageFlow.stages.slice(0, stageIndex);
  return upstream.some((entry) => state.stageOutputs[entry.id]);
}

function resolveIngestionSourceKind(state: StageFlowRuntimeState): string | undefined {
  const ingestionOutput = state.stageOutputs.ingestion ?? Object.freeze({});
  return toString(ingestionOutput.detectedSourceKind)
    ?? toString(ingestionOutput.sourceKind)
    ?? toString(state.stageConfiguration.source?.sourceKind);
}

export class StageExecutionPolicy {
  private readonly mappingService: StageAssetMappingService;

  constructor(mappingService: StageAssetMappingService = new StageAssetMappingService()) {
    this.mappingService = mappingService;
  }

  public evaluate(context: StageExecutionPolicyContext): StageExecutionPolicyDecision {
    const autoConfiguration = this.resolveAutoConfiguration(context);
    const existingOutput = context.state.stageOutputs[context.stage.id];
    if (toBoolean(existingOutput?.completed) || toString(existingOutput?.status) === "completed") {
      return Object.freeze({
        disposition: StageExecutionDispositions.autoComplete,
        reason: `Stage '${context.stage.id}' already has completed output context.`,
        autoConfiguration,
      });
    }

    if (!hasAnyUpstreamOutput(context.stageFlow, context.stage, context.state)
      && context.stage.executionPolicy.mode !== "required") {
      return Object.freeze({
        disposition: StageExecutionDispositions.skip,
        reason: `Stage '${context.stage.id}' has no upstream inputs and is not required.`,
        autoConfiguration,
      });
    }

    const sourceKind = resolveIngestionSourceKind(context.state);
    if (
      context.stage.kind === DatasetPipelineStageKinds.extraction
      && (sourceKind === UnifiedIngestionSourceKinds.csv || sourceKind === UnifiedIngestionSourceKinds.json)
    ) {
      return Object.freeze({
        disposition: StageExecutionDispositions.skip,
        reason: "Extraction skipped because ingestion source is already structured (CSV/JSON).",
        autoConfiguration,
      });
    }

    const profileComputed = toBoolean(context.state.stageOutputs.ingestion?.profileComputed)
      || toBoolean(context.state.stageOutputs.profiling?.profileComputed)
      || toBoolean(context.state.stageOutputs.profiling?.alreadyComputed);
    if (context.stage.kind === DatasetPipelineStageKinds.profiling && profileComputed) {
      return Object.freeze({
        disposition: StageExecutionDispositions.skip,
        reason: "Profiling skipped because profile metadata already exists upstream.",
        autoConfiguration,
      });
    }

    return Object.freeze({
      disposition: StageExecutionDispositions.execute,
      reason: `Stage '${context.stage.id}' should execute.`,
      autoConfiguration,
    });
  }

  private resolveAutoConfiguration(context: StageExecutionPolicyContext): Readonly<Record<string, CanonicalRecordValue>> {
    const templateDefaults = context.templateDefaults?.[context.stage.id] ?? Object.freeze({});
    const intentDefaults = context.intentDefaults?.[context.stage.id] ?? Object.freeze({});

    let mappingDefaults: Readonly<Record<string, CanonicalRecordValue>> = Object.freeze({});
    const mapping = this.mappingService.resolveStage({ stageKind: context.stage.kind });
    if (mapping.status === "resolved") {
      mappingDefaults = mapping.assets[0]?.configDefaults ?? Object.freeze({});
    }

    const schemaKnown = toBoolean(context.state.stageOutputs.ingestion?.schemaKnown)
      || toBoolean(context.state.stageOutputs.ingestion?.schemaDetected)
      || toBoolean(context.state.stageConfiguration.source?.schemaKnown);
    const normalizationDefaults = context.stage.kind === DatasetPipelineStageKinds.normalization && schemaKnown
      ? Object.freeze({ schemaMode: "known", useDetectedSchema: true } satisfies Record<string, CanonicalRecordValue>)
      : Object.freeze({});

    return freezeRecord({
      ...mappingDefaults,
      ...templateDefaults,
      ...intentDefaults,
      ...normalizationDefaults,
    });
  }
}

export function createStageExecutionPolicy(mappingService?: StageAssetMappingService): StageExecutionPolicy {
  return new StageExecutionPolicy(mappingService);
}
