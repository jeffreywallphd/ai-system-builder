import type { CanonicalRecordValue } from "@domain/dataset-studio/CanonicalDataShapes";
import {
  createDefaultPipelineTemplates,
  toPipelineTemplateUiDescriptor,
  type PipelineTemplate,
  type PipelineTemplateUiDescriptor,
} from "@domain/dataset-studio/PipelineTemplateDomain";
import {
  createInitialStageFlowRuntimeState,
  createStageFlowDefinition,
  reorderFlowStages,
  type StageFlowDefinition,
  type StageFlowRuntimeState,
} from "@domain/dataset-studio/StageFlowDefinition";
import { DatasetPipelineStageExecutionModes } from "@domain/dataset-studio/StagePipelineDomain";
import { UnifiedIngestionOutputTargetKinds, UnifiedIngestionSourceKinds } from "@domain/dataset-studio/UnifiedIngestionDomain";
import { StageAssetMappingService } from "./StageAssetMappingService";

export interface PipelineTemplateInstantiationRequest {
  readonly templateId: string;
  readonly stageConfigurationOverrides?: Readonly<Record<string, Readonly<Record<string, CanonicalRecordValue>>>>;
  readonly skippedStageIds?: ReadonlyArray<string>;
  readonly orderedStageIds?: ReadonlyArray<string>;
}

export interface PipelineTemplateInstance {
  readonly template: PipelineTemplate;
  readonly stageFlow: StageFlowDefinition;
  readonly state: StageFlowRuntimeState;
  readonly ui: PipelineTemplateUiDescriptor;
}

function freezeConfigMap(
  value: Readonly<Record<string, Readonly<Record<string, CanonicalRecordValue>>>>,
): Readonly<Record<string, Readonly<Record<string, CanonicalRecordValue>>>> {
  return Object.freeze(
    Object.entries(value).reduce<Record<string, Readonly<Record<string, CanonicalRecordValue>>>>((accumulator, [stageId, config]) => {
      accumulator[stageId] = Object.freeze({ ...config });
      return accumulator;
    }, {}),
  );
}

function assertKnownStageIds(flow: StageFlowDefinition, stageIds: ReadonlyArray<string>, label: string): void {
  const knownIds = new Set(flow.stages.map((stage) => stage.id));
  for (const stageId of stageIds) {
    if (!knownIds.has(stageId)) {
      throw new Error(`${label} references unknown stage '${stageId}' in flow '${flow.flowId}'.`);
    }
  }
}

export class TemplateService {
  private readonly templates: ReadonlyArray<PipelineTemplate>;
  private readonly mappingService: StageAssetMappingService;

  constructor(
    templates: ReadonlyArray<PipelineTemplate> = createDefaultPipelineTemplates(),
    mappingService: StageAssetMappingService = new StageAssetMappingService(),
  ) {
    if (templates.length === 0) {
      throw new Error("TemplateService requires at least one pipeline template.");
    }
    this.mappingService = mappingService;
    this.templates = Object.freeze(templates.map((template) => this.validateTemplate(template)));
  }

  public listTemplates(): ReadonlyArray<PipelineTemplateUiDescriptor> {
    return Object.freeze(this.templates.map((template) => toPipelineTemplateUiDescriptor(template)));
  }

  public getTemplate(templateId: string): PipelineTemplate {
    const normalizedTemplateId = templateId.trim();
    const template = this.templates.find((entry) => entry.id === normalizedTemplateId);
    if (!template) {
      throw new Error(`Pipeline template '${normalizedTemplateId}' is not registered.`);
    }
    return template;
  }

  public instantiate(request: PipelineTemplateInstantiationRequest): PipelineTemplateInstance {
    const template = this.getTemplate(request.templateId);
    let stageFlow = template.stageFlow;
    if (request.orderedStageIds && request.orderedStageIds.length > 0) {
      assertKnownStageIds(stageFlow, request.orderedStageIds, "orderedStageIds");
      stageFlow = reorderFlowStages(stageFlow, request.orderedStageIds);
    }

    const skippedStageIds = Object.freeze([...(request.skippedStageIds ?? [])]);
    assertKnownStageIds(stageFlow, skippedStageIds, "skippedStageIds");

    const stageConfiguration = freezeConfigMap({
      ...(template.defaultStageConfiguration ?? {}),
      ...(request.stageConfigurationOverrides ?? {}),
    });

    const runtime = createInitialStageFlowRuntimeState(stageFlow);
    const state: StageFlowRuntimeState = Object.freeze({
      ...runtime,
      skippedStageIds,
      stageConfiguration,
    });

    const resolvedTemplate: PipelineTemplate = Object.freeze({
      ...template,
      stageFlow,
      defaultStageConfiguration: stageConfiguration,
    });

    return Object.freeze({
      template: resolvedTemplate,
      stageFlow,
      state,
      ui: toPipelineTemplateUiDescriptor(resolvedTemplate),
    });
  }

  public validateTemplate(template: PipelineTemplate): PipelineTemplate {
    const normalizedFlow = createStageFlowDefinition({
      flowId: template.stageFlow.flowId,
      name: template.stageFlow.name,
      description: template.stageFlow.description,
      stages: template.stageFlow.stages,
      conditionalTransitions: template.stageFlow.conditionalTransitions,
    });

    for (const stage of normalizedFlow.stages) {
      const result = this.mappingService.resolveStage({
        stageKind: stage.kind,
        detectedSourceKind: UnifiedIngestionSourceKinds.unknown,
        outputTarget: UnifiedIngestionOutputTargetKinds.records,
      });
      if (result.status === "unsupported") {
        throw new Error(
          `Template '${template.id}' stage '${stage.id}' has no valid stage-to-asset mapping (${result.failureCode}).`,
        );
      }
      if (
        stage.executionPolicy.mode === DatasetPipelineStageExecutionModes.conditional
        && !stage.executionPolicy.conditionId
      ) {
        throw new Error(
          `Template '${template.id}' conditional stage '${stage.id}' is missing an execution condition id.`,
        );
      }
    }

    return Object.freeze({
      ...template,
      stageFlow: normalizedFlow,
      defaultStageConfiguration: freezeConfigMap(template.defaultStageConfiguration ?? {}),
    });
  }
}

export function createTemplateService(
  templates?: ReadonlyArray<PipelineTemplate>,
  mappingService?: StageAssetMappingService,
): TemplateService {
  return new TemplateService(templates, mappingService);
}

