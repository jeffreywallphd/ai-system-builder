import type { CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";
import type { DatasetPipelineStageDefinition, DatasetPipelineStageKind } from "../../domain/dataset-studio/StagePipelineDomain";
import { DatasetPipelineStageExecutionModes } from "../../domain/dataset-studio/StagePipelineDomain";
import { createStageFlowDefinition } from "../../domain/dataset-studio/StageFlowDefinition";
import type { PipelineTemplate } from "../../domain/dataset-studio/PipelineTemplateDomain";
import { StageAssetMappingService } from "./StageAssetMappingService";
import {
  StageCanvasGraphProjectionService,
  type StageCanvasGraphModel,
} from "./StageCanvasGraphProjectionService";
import { TemplateService } from "./TemplateService";
import type { WizardFlowEngine } from "./WizardFlowEngine";

export interface StageCanvasEditIssue {
  readonly code: string;
  readonly message: string;
  readonly stageId?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface StageCanvasEditResult {
  readonly ok: boolean;
  readonly issues: ReadonlyArray<StageCanvasEditIssue>;
  readonly graph?: StageCanvasGraphModel;
}

function issue(
  code: string,
  message: string,
  stageId?: string,
  details?: Readonly<Record<string, unknown>>,
): StageCanvasEditIssue {
  return Object.freeze({ code, message, stageId, details });
}

function sortStagesByOrder(stages: ReadonlyArray<DatasetPipelineStageDefinition>): ReadonlyArray<DatasetPipelineStageDefinition> {
  return Object.freeze([...stages].sort((left, right) => left.order - right.order));
}

function isOptionalStage(stage: DatasetPipelineStageDefinition): boolean {
  return stage.executionPolicy.mode !== DatasetPipelineStageExecutionModes.required;
}

function normalizeOrderedStageIds(
  value: ReadonlyArray<string>,
): ReadonlyArray<string> {
  return Object.freeze(value.map((entry) => entry.trim()).filter(Boolean));
}

function mergeOptionalStageCatalog(
  templates: ReadonlyArray<PipelineTemplate>,
): Readonly<Record<DatasetPipelineStageKind, DatasetPipelineStageDefinition>> {
  const byKind: Partial<Record<DatasetPipelineStageKind, DatasetPipelineStageDefinition>> = {};
  for (const template of templates) {
    for (const stage of template.stageFlow.stages) {
      if (!isOptionalStage(stage)) {
        continue;
      }
      if (!byKind[stage.kind]) {
        byKind[stage.kind] = Object.freeze({ ...stage, order: 1 });
      }
    }
  }
  return Object.freeze(byKind as Readonly<Record<DatasetPipelineStageKind, DatasetPipelineStageDefinition>>);
}

export class StageCanvasEditingService {
  private readonly mappingService: StageAssetMappingService;
  private readonly projectionService: StageCanvasGraphProjectionService;
  private readonly optionalStageCatalog: Readonly<Record<DatasetPipelineStageKind, DatasetPipelineStageDefinition>>;

  constructor(options?: {
    readonly mappingService?: StageAssetMappingService;
    readonly projectionService?: StageCanvasGraphProjectionService;
    readonly templateService?: TemplateService;
  }) {
    this.mappingService = options?.mappingService ?? new StageAssetMappingService();
    this.projectionService = options?.projectionService ?? new StageCanvasGraphProjectionService(this.mappingService);

    const templateService = options?.templateService ?? new TemplateService();
    const templates = templateService
      .listTemplates()
      .map((descriptor) => templateService.getTemplate(descriptor.id));
    this.optionalStageCatalog = mergeOptionalStageCatalog(templates);
  }

  public listAddableOptionalStages(engine: WizardFlowEngine): ReadonlyArray<DatasetPipelineStageDefinition> {
    const flow = engine.getStageFlow();
    const presentKinds = new Set(flow.stages.map((stage) => stage.kind));
    const candidates = Object.values(this.optionalStageCatalog)
      .filter((stage) => !presentKinds.has(stage.kind))
      .map((stage) => Object.freeze({ ...stage, order: flow.stages.length + 1 }));
    return sortStagesByOrder(candidates);
  }

  public updateStageConfiguration(
    engine: WizardFlowEngine,
    stageId: string,
    configuration: Readonly<Record<string, CanonicalRecordValue>>,
  ): StageCanvasEditResult {
    try {
      engine.setStageConfiguration(stageId, configuration);
      return Object.freeze({
        ok: true,
        issues: Object.freeze([]),
        graph: this.projectionService.projectFromWizard(engine),
      });
    } catch (error) {
      return Object.freeze({
        ok: false,
        issues: Object.freeze([
          issue(
            "stage-configuration-invalid",
            error instanceof Error ? error.message : String(error),
            stageId,
          ),
        ]),
      });
    }
  }

  public reorderStages(
    engine: WizardFlowEngine,
    orderedStageIds: ReadonlyArray<string>,
  ): StageCanvasEditResult {
    const flow = engine.getStageFlow();
    const normalized = normalizeOrderedStageIds(orderedStageIds);
    const requiredStageIdsInCurrentOrder = flow.stages
      .filter((stage) => stage.executionPolicy.mode === DatasetPipelineStageExecutionModes.required)
      .map((stage) => stage.id);
    const requiredStageIdsInRequestedOrder = normalized
      .filter((stageId) => requiredStageIdsInCurrentOrder.includes(stageId));

    if (requiredStageIdsInCurrentOrder.join("|") !== requiredStageIdsInRequestedOrder.join("|")) {
      return Object.freeze({
        ok: false,
        issues: Object.freeze([
          issue(
            "stage-reorder-required-order-violation",
            "Required stages must retain their relative ordering.",
          ),
        ]),
      });
    }

    try {
      engine.reorderStages(normalized);
      const validationIssues = this.validateFlowCompatibility(engine);
      if (validationIssues.length > 0) {
        return Object.freeze({ ok: false, issues: validationIssues });
      }
      return Object.freeze({
        ok: true,
        issues: Object.freeze([]),
        graph: this.projectionService.projectFromWizard(engine),
      });
    } catch (error) {
      return Object.freeze({
        ok: false,
        issues: Object.freeze([
          issue(
            "stage-reorder-invalid",
            error instanceof Error ? error.message : String(error),
          ),
        ]),
      });
    }
  }

  public addOptionalStage(
    engine: WizardFlowEngine,
    stageKind: DatasetPipelineStageKind,
    order?: number,
  ): StageCanvasEditResult {
    const stage = this.optionalStageCatalog[stageKind];
    if (!stage) {
      return Object.freeze({
        ok: false,
        issues: Object.freeze([
          issue(
            "stage-insert-unsupported-kind",
            `No optional stage blueprint is registered for '${stageKind}'.`,
          ),
        ]),
      });
    }

    if (!isOptionalStage(stage)) {
      return Object.freeze({
        ok: false,
        issues: Object.freeze([
          issue(
            "stage-insert-required-forbidden",
            `Stage '${stage.id}' is required and cannot be inserted through optional-stage editing.`,
            stage.id,
          ),
        ]),
      });
    }

    const flow = engine.getStageFlow();
    if (flow.stages.some((existing) => existing.kind === stageKind)) {
      return Object.freeze({
        ok: false,
        issues: Object.freeze([
          issue(
            "stage-insert-duplicate-kind",
            `Stage kind '${stageKind}' already exists in this pipeline flow.`,
            stage.id,
          ),
        ]),
      });
    }

    try {
      const insertOrder = order ?? (flow.stages.length + 1);
      engine.insertStage(
        Object.freeze({
          ...stage,
          id: stage.id,
          order: insertOrder,
        }),
        insertOrder,
      );
      const validationIssues = this.validateFlowCompatibility(engine);
      if (validationIssues.length > 0) {
        return Object.freeze({ ok: false, issues: validationIssues });
      }
      return Object.freeze({
        ok: true,
        issues: Object.freeze([]),
        graph: this.projectionService.projectFromWizard(engine),
      });
    } catch (error) {
      return Object.freeze({
        ok: false,
        issues: Object.freeze([
          issue(
            "stage-insert-invalid",
            error instanceof Error ? error.message : String(error),
            stage.id,
          ),
        ]),
      });
    }
  }

  public removeOptionalStage(engine: WizardFlowEngine, stageId: string): StageCanvasEditResult {
    const flow = engine.getStageFlow();
    const stage = flow.stages.find((entry) => entry.id === stageId);
    if (!stage) {
      return Object.freeze({
        ok: false,
        issues: Object.freeze([
          issue("stage-remove-unknown", `Stage '${stageId}' is not part of this flow.`, stageId),
        ]),
      });
    }
    if (!isOptionalStage(stage)) {
      return Object.freeze({
        ok: false,
        issues: Object.freeze([
          issue("stage-remove-required-forbidden", "Required stages cannot be removed.", stageId),
        ]),
      });
    }
    if (engine.getState().currentStageId === stageId) {
      return Object.freeze({
        ok: false,
        issues: Object.freeze([
          issue("stage-remove-current-stage-forbidden", "Current stage cannot be removed while active.", stageId),
        ]),
      });
    }

    try {
      engine.removeStage(stageId);
      const validationIssues = this.validateFlowCompatibility(engine);
      if (validationIssues.length > 0) {
        return Object.freeze({ ok: false, issues: validationIssues });
      }
      return Object.freeze({
        ok: true,
        issues: Object.freeze([]),
        graph: this.projectionService.projectFromWizard(engine),
      });
    } catch (error) {
      return Object.freeze({
        ok: false,
        issues: Object.freeze([
          issue("stage-remove-invalid", error instanceof Error ? error.message : String(error), stageId),
        ]),
      });
    }
  }

  public regenerateGraph(engine: WizardFlowEngine): StageCanvasGraphModel {
    return this.projectionService.projectFromWizard(engine);
  }

  private validateFlowCompatibility(engine: WizardFlowEngine): ReadonlyArray<StageCanvasEditIssue> {
    const flow = engine.getStageFlow();
    const issues: StageCanvasEditIssue[] = [];

    try {
      createStageFlowDefinition({
        flowId: flow.flowId,
        name: flow.name,
        description: flow.description,
        stages: flow.stages,
        conditionalTransitions: flow.conditionalTransitions,
      });
    } catch (error) {
      issues.push(issue(
        "stage-flow-invalid",
        error instanceof Error ? error.message : String(error),
      ));
    }

    for (const stage of flow.stages) {
      const mapping = this.mappingService.resolveStage({ stageKind: stage.kind });
      if (mapping.status === "unsupported") {
        issues.push(issue(
          "stage-asset-mapping-unsupported",
          mapping.reason,
          stage.id,
          Object.freeze({ failureCode: mapping.failureCode }),
        ));
      }
    }

    return Object.freeze(issues);
  }
}

export function createStageCanvasEditingService(options?: {
  readonly mappingService?: StageAssetMappingService;
  readonly projectionService?: StageCanvasGraphProjectionService;
  readonly templateService?: TemplateService;
}): StageCanvasEditingService {
  return new StageCanvasEditingService(options);
}
