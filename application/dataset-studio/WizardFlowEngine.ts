import type { CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";
import {
  areStageContractsCompatible,
  createInitialStageFlowRuntimeState,
  createStageFlowDefinition,
  insertStageInFlow,
  removeStageFromFlow,
  reorderFlowStages,
  withStageConfiguration,
  withStageOutput,
  type StageFlowConditionContext,
  type StageFlowConditionalTransition,
  type StageFlowDefinition,
  type StageFlowRuntimeState,
} from "../../domain/dataset-studio/StageFlowDefinition";
import type { DatasetPipelineStageDefinition } from "../../domain/dataset-studio/StagePipelineDomain";
import type { PipelineTemplate } from "../../domain/dataset-studio/PipelineTemplateDomain";
import type { PipelineTemplateInstantiationRequest, TemplateService } from "./TemplateService";

export interface WizardFlowTransition {
  readonly fromStageId: string;
  readonly toStageId: string;
  readonly skippedStageIds: ReadonlyArray<string>;
}

export interface WizardFlowNavigationResult {
  readonly moved: boolean;
  readonly transition?: WizardFlowTransition;
  readonly reason?: string;
}

export type WizardFlowConditionEvaluator = (context: StageFlowConditionContext) => boolean;

export interface WizardFlowTransitionValidationHook {
  (input: {
    readonly fromStage: DatasetPipelineStageDefinition;
    readonly toStage: DatasetPipelineStageDefinition;
    readonly state: StageFlowRuntimeState;
  }): void;
}

export interface WizardFlowEngineOptions {
  readonly stageFlow?: StageFlowDefinition;
  readonly template?: PipelineTemplate;
  readonly templateService?: TemplateService;
  readonly templateInstantiation?: PipelineTemplateInstantiationRequest;
  readonly conditionEvaluators?: Readonly<Record<string, WizardFlowConditionEvaluator>>;
  readonly autoSkipEvaluator?: (input: {
    readonly stage: DatasetPipelineStageDefinition;
    readonly state: StageFlowRuntimeState;
  }) => boolean;
  readonly beforeTransition?: WizardFlowTransitionValidationHook;
}

export interface WizardFlowUiStage {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly description: string;
  readonly order: number;
  readonly executionMode: string;
  readonly status: "current" | "completed" | "skipped" | "pending";
  readonly configuration: Readonly<Record<string, CanonicalRecordValue>>;
  readonly metadata: {
    readonly acceptedInputShapeKinds: ReadonlyArray<string>;
    readonly producedOutputShapeKinds: ReadonlyArray<string>;
    readonly assetReferences: ReadonlyArray<DatasetPipelineStageDefinition["assetReferences"][number]>;
  };
}

export interface WizardFlowUiSnapshot {
  readonly flowId: string;
  readonly flowName: string;
  readonly currentStageId: string;
  readonly stages: ReadonlyArray<WizardFlowUiStage>;
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} cannot be empty.`);
  }
  return normalized;
}

function dedupeOrdered(values: ReadonlyArray<string>): ReadonlyArray<string> {
  return Object.freeze([...new Set(values)]);
}

function toConditionContext(state: StageFlowRuntimeState): StageFlowConditionContext {
  return Object.freeze({
    currentStageId: state.currentStageId,
    completedStageIds: state.completedStageIds,
    skippedStageIds: state.skippedStageIds,
    stageConfiguration: state.stageConfiguration,
    stageOutputs: state.stageOutputs,
  });
}

function freezeRecord(
  value: Readonly<Record<string, CanonicalRecordValue>>,
): Readonly<Record<string, CanonicalRecordValue>> {
  return Object.freeze({ ...value });
}

export class WizardFlowEngine {
  private stageFlow: StageFlowDefinition;
  private state: StageFlowRuntimeState;
  private readonly conditionEvaluators: Readonly<Record<string, WizardFlowConditionEvaluator>>;
  private readonly autoSkipEvaluator?: WizardFlowEngineOptions["autoSkipEvaluator"];
  private readonly beforeTransition?: WizardFlowTransitionValidationHook;
  private navigationHistory: ReadonlyArray<string>;

  constructor(options: WizardFlowEngineOptions) {
    const initial = this.resolveInitial(options);
    const stageFlow = initial.stageFlow;
    this.stageFlow = createStageFlowDefinition({
      flowId: stageFlow.flowId,
      name: stageFlow.name,
      description: stageFlow.description,
      stages: stageFlow.stages,
      conditionalTransitions: stageFlow.conditionalTransitions,
    });
    this.state = initial.state ?? createInitialStageFlowRuntimeState(this.stageFlow);
    this.navigationHistory = Object.freeze([]);
    this.conditionEvaluators = options.conditionEvaluators ?? Object.freeze({});
    this.autoSkipEvaluator = options.autoSkipEvaluator;
    this.beforeTransition = options.beforeTransition;

    if (initial.template?.defaultStageConfiguration) {
      for (const [stageId, config] of Object.entries(initial.template.defaultStageConfiguration)) {
        this.state = withStageConfiguration(this.state, stageId, config);
      }
    }

    this.validateCurrentStageExists();
  }

  public getStageFlow(): StageFlowDefinition {
    return this.stageFlow;
  }

  public getState(): StageFlowRuntimeState {
    return this.state;
  }

  public setStageConfiguration(
    stageId: string,
    configuration: Readonly<Record<string, CanonicalRecordValue>>,
  ): StageFlowRuntimeState {
    this.assertKnownStageId(stageId);
    this.state = withStageConfiguration(this.state, stageId, freezeRecord(configuration));
    return this.state;
  }

  public setStageOutput(
    stageId: string,
    output: Readonly<Record<string, CanonicalRecordValue>>,
  ): StageFlowRuntimeState {
    this.assertKnownStageId(stageId);
    this.state = withStageOutput(this.state, stageId, freezeRecord(output));
    return this.state;
  }

  public skipStage(stageId: string): StageFlowRuntimeState {
    this.assertKnownStageId(stageId);
    if (this.state.currentStageId === stageId) {
      throw new Error(`Cannot explicitly skip current stage '${stageId}'.`);
    }
    this.state = Object.freeze({
      ...this.state,
      skippedStageIds: dedupeOrdered([...this.state.skippedStageIds, stageId]),
    });
    return this.state;
  }

  public insertStage(stage: DatasetPipelineStageDefinition, order: number): StageFlowDefinition {
    this.stageFlow = insertStageInFlow(this.stageFlow, stage, order);
    this.validateCurrentStageExists();
    return this.stageFlow;
  }

  public removeStage(stageId: string): StageFlowDefinition {
    const normalizedStageId = normalizeRequired(stageId, "removeStage.stageId");
    const nextFlow = removeStageFromFlow(this.stageFlow, normalizedStageId);
    const nextCurrentStageId = this.state.currentStageId === normalizedStageId
      ? (nextFlow.stages[0]?.id ?? "")
      : this.state.currentStageId;

    this.stageFlow = nextFlow;
    this.state = Object.freeze({
      ...this.state,
      currentStageId: nextCurrentStageId,
      completedStageIds: this.state.completedStageIds.filter((existing) => existing !== normalizedStageId),
      skippedStageIds: this.state.skippedStageIds.filter((existing) => existing !== normalizedStageId),
    });
    this.validateCurrentStageExists();
    return this.stageFlow;
  }

  public reorderStages(orderedStageIds: ReadonlyArray<string>): StageFlowDefinition {
    this.stageFlow = reorderFlowStages(this.stageFlow, orderedStageIds);
    this.validateCurrentStageExists();
    return this.stageFlow;
  }

  public goNext(): WizardFlowNavigationResult {
    const currentStage = this.getCurrentStage();
    const completion = dedupeOrdered([...this.state.completedStageIds, currentStage.id]);
    const resolution = this.resolveForward(currentStage.id);
    if (!resolution.nextStage) {
      this.state = Object.freeze({
        ...this.state,
        completedStageIds: completion,
      });
      return Object.freeze({
        moved: false,
        reason: "No next stage is available from the current wizard state.",
      });
    }

    if (!areStageContractsCompatible(currentStage, resolution.nextStage)) {
      throw new Error(
        `Invalid transition '${currentStage.id}' -> '${resolution.nextStage.id}': stage contracts are incompatible.`,
      );
    }

    this.beforeTransition?.({
      fromStage: currentStage,
      toStage: resolution.nextStage,
      state: this.state,
    });

    this.navigationHistory = Object.freeze([...this.navigationHistory, currentStage.id]);
    this.state = Object.freeze({
      ...this.state,
      currentStageId: resolution.nextStage.id,
      completedStageIds: completion,
      skippedStageIds: dedupeOrdered([...this.state.skippedStageIds, ...resolution.skippedStageIds]),
    });

    return Object.freeze({
      moved: true,
      transition: Object.freeze({
        fromStageId: currentStage.id,
        toStageId: resolution.nextStage.id,
        skippedStageIds: resolution.skippedStageIds,
      }),
    });
  }

  public goBack(): WizardFlowNavigationResult {
    const currentStage = this.getCurrentStage();
    const previousStageId = this.navigationHistory[this.navigationHistory.length - 1];
    if (!previousStageId) {
      return Object.freeze({
        moved: false,
        reason: "No previous stage is available.",
      });
    }

    this.assertKnownStageId(previousStageId);
    this.navigationHistory = Object.freeze(this.navigationHistory.slice(0, -1));
    this.state = Object.freeze({
      ...this.state,
      currentStageId: previousStageId,
    });

    return Object.freeze({
      moved: true,
      transition: Object.freeze({
        fromStageId: currentStage.id,
        toStageId: previousStageId,
        skippedStageIds: Object.freeze([]),
      }),
    });
  }

  public toUiSnapshot(): WizardFlowUiSnapshot {
    const completedSet = new Set(this.state.completedStageIds);
    const skippedSet = new Set(this.state.skippedStageIds);
    return Object.freeze({
      flowId: this.stageFlow.flowId,
      flowName: this.stageFlow.name,
      currentStageId: this.state.currentStageId,
      stages: Object.freeze(this.stageFlow.stages.map((stage) => Object.freeze({
        id: stage.id,
        kind: stage.kind,
        name: stage.name,
        description: stage.description,
        order: stage.order,
        executionMode: stage.executionPolicy.mode,
        status: stage.id === this.state.currentStageId
          ? "current"
          : completedSet.has(stage.id)
            ? "completed"
            : skippedSet.has(stage.id)
              ? "skipped"
              : "pending",
        configuration: this.state.stageConfiguration[stage.id] ?? Object.freeze({}),
        metadata: Object.freeze({
          acceptedInputShapeKinds: stage.dataContract.acceptedInputShapeKinds,
          producedOutputShapeKinds: stage.dataContract.producedOutputShapeKinds,
          assetReferences: stage.assetReferences,
        }),
      }))),
    });
  }

  private resolveInitial(options: WizardFlowEngineOptions): {
    readonly stageFlow: StageFlowDefinition;
    readonly state?: StageFlowRuntimeState;
    readonly template?: PipelineTemplate;
  } {
    if (options.stageFlow) {
      return Object.freeze({ stageFlow: options.stageFlow });
    }
    if (options.template) {
      return Object.freeze({
        stageFlow: options.template.stageFlow,
        template: options.template,
      });
    }
    if (options.templateService && options.templateInstantiation) {
      const instance = options.templateService.instantiate(options.templateInstantiation);
      return Object.freeze({
        stageFlow: instance.stageFlow,
        state: instance.state,
        template: instance.template,
      });
    }
    throw new Error("WizardFlowEngine requires a stageFlow, template, or template instantiation source.");
  }

  private getCurrentStage(): DatasetPipelineStageDefinition {
    const current = this.stageFlow.stages.find((stage) => stage.id === this.state.currentStageId);
    if (!current) {
      throw new Error(`Current stage '${this.state.currentStageId}' is not present in flow '${this.stageFlow.flowId}'.`);
    }
    return current;
  }

  private assertKnownStageId(stageId: string): void {
    const normalizedStageId = normalizeRequired(stageId, "stageId");
    if (!this.stageFlow.stages.some((stage) => stage.id === normalizedStageId)) {
      throw new Error(`Unknown stage '${normalizedStageId}' for flow '${this.stageFlow.flowId}'.`);
    }
  }

  private validateCurrentStageExists(): void {
    this.assertKnownStageId(this.state.currentStageId);
  }

  private isConditionMet(conditionId: string): boolean {
    const evaluator = this.conditionEvaluators[conditionId];
    if (!evaluator) {
      return false;
    }
    return evaluator(toConditionContext(this.state));
  }

  private shouldAutoSkip(stage: DatasetPipelineStageDefinition): boolean {
    if (this.state.skippedStageIds.includes(stage.id)) {
      return true;
    }
    if (stage.executionPolicy.skipByDefault) {
      return true;
    }
    if (stage.executionPolicy.mode === "conditional" && stage.executionPolicy.conditionId) {
      return !this.isConditionMet(stage.executionPolicy.conditionId);
    }
    if (this.autoSkipEvaluator) {
      return this.autoSkipEvaluator({
        stage,
        state: this.state,
      });
    }
    return false;
  }

  private selectConditionalTransition(fromStageId: string): StageFlowConditionalTransition | undefined {
    const transitions = this.stageFlow.conditionalTransitions
      .filter((transition) => transition.fromStageId === fromStageId)
      .sort((left, right) => (left.priority ?? 1000) - (right.priority ?? 1000));
    return transitions.find((transition) => this.isConditionMet(transition.conditionId));
  }

  private getLinearNextStage(fromStageId: string): DatasetPipelineStageDefinition | undefined {
    const currentIndex = this.stageFlow.stages.findIndex((stage) => stage.id === fromStageId);
    if (currentIndex === -1) {
      return undefined;
    }
    return this.stageFlow.stages[currentIndex + 1];
  }

  private resolveForward(fromStageId: string): {
    readonly nextStage?: DatasetPipelineStageDefinition;
    readonly skippedStageIds: ReadonlyArray<string>;
  } {
    const conditional = this.selectConditionalTransition(fromStageId);
    const fromIndex = this.stageFlow.stages.findIndex((stage) => stage.id === fromStageId);
    let cursor = conditional
      ? this.stageFlow.stages.find((stage) => stage.id === conditional.toStageId)
      : this.getLinearNextStage(fromStageId);

    const skippedStageIds: string[] = [];
    if (conditional && cursor && fromIndex >= 0) {
      const toIndex = this.stageFlow.stages.findIndex((stage) => stage.id === cursor?.id);
      if (toIndex > fromIndex + 1) {
        const bypassed = this.stageFlow.stages
          .slice(fromIndex + 1, toIndex)
          .map((stage) => stage.id);
        skippedStageIds.push(...bypassed);
      }
    }
    while (cursor && this.shouldAutoSkip(cursor)) {
      skippedStageIds.push(cursor.id);
      cursor = this.getLinearNextStage(cursor.id);
    }

    return Object.freeze({
      nextStage: cursor,
      skippedStageIds: Object.freeze(skippedStageIds),
    });
  }
}

export function createWizardFlowEngine(options: WizardFlowEngineOptions): WizardFlowEngine {
  return new WizardFlowEngine(options);
}
