import type { CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";
import type { IntentDefinition } from "../../domain/dataset-studio/IntentDomain";
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
import {
  StageExecutionDispositions,
  StageExecutionPolicy,
  type StageExecutionPolicyDecision,
} from "./StageExecutionPolicy";
import {
  createUnifiedIngestionStageOutputFromResult,
  toStageRecordFromRawStorageOutput,
  toStageRecordFromUnifiedIngestionOutput,
  type RawStorageStageOutput,
} from "./StageIntegrationContracts";
import {
  createStageContractFromDefinition,
  createStageMetadataFromDefinition,
  createStageMetadataPropagationPayload,
  mergePropagationPayloads,
  withStageStatusMarker,
  type StageRuntimeTracking,
} from "./StageMetadataContracts";
import type { IntentContext, IntentService } from "./IntentService";
import type { PipelineTemplateInstantiationRequest, TemplateService } from "./TemplateService";
import type { UnifiedIngestionResult } from "./UnifiedIngestionOrchestrationService";

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
  readonly intentId?: string;
  readonly intentPreset?: IntentDefinition;
  readonly intentService?: IntentService;
  readonly conditionEvaluators?: Readonly<Record<string, WizardFlowConditionEvaluator>>;
  readonly autoSkipEvaluator?: (input: {
    readonly stage: DatasetPipelineStageDefinition;
    readonly state: StageFlowRuntimeState;
  }) => boolean;
  readonly stageExecutionPolicy?: StageExecutionPolicy;
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
    readonly stageCategory: string;
    readonly statusMarker: string;
    readonly lineageId?: string;
    readonly pipelineId?: string;
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
    autoConfiguredStageIds: state.autoConfiguredStageIds,
    userOverriddenStageIds: state.userOverriddenStageIds,
    stageConfiguration: state.stageConfiguration,
    stageOutputs: state.stageOutputs,
  });
}

function freezeRecord(
  value: Readonly<Record<string, CanonicalRecordValue>>,
): Readonly<Record<string, CanonicalRecordValue>> {
  return Object.freeze({ ...value });
}

function hasValues(record: Readonly<Record<string, CanonicalRecordValue>>): boolean {
  return Object.keys(record).length > 0;
}

export class WizardFlowEngine {
  private stageFlow: StageFlowDefinition;
  private state: StageFlowRuntimeState;
  private readonly conditionEvaluators: Readonly<Record<string, WizardFlowConditionEvaluator>>;
  private readonly autoSkipEvaluator?: WizardFlowEngineOptions["autoSkipEvaluator"];
  private readonly stageExecutionPolicy?: StageExecutionPolicy;
  private readonly beforeTransition?: WizardFlowTransitionValidationHook;
  private navigationHistory: ReadonlyArray<string>;
  private readonly intentDefaults: Readonly<Record<string, Readonly<Record<string, CanonicalRecordValue>>>>;
  private readonly templateDefaults: Readonly<Record<string, Readonly<Record<string, CanonicalRecordValue>>>>;
  private stageRuntimeTracking: Readonly<Record<string, StageRuntimeTracking>>;

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
    this.stageExecutionPolicy = options.stageExecutionPolicy;
    this.beforeTransition = options.beforeTransition;
    this.intentDefaults = initial.intentDefaults ?? Object.freeze({});
    this.templateDefaults = initial.templateDefaults ?? Object.freeze({});
    this.stageRuntimeTracking = Object.freeze(
      Object.fromEntries(this.stageFlow.stages.map((stage) => [stage.id, Object.freeze({
        metadata: createStageMetadataFromDefinition(stage),
        contract: createStageContractFromDefinition(stage),
      } satisfies StageRuntimeTracking)])),
    );

    if (initial.intentContext) {
      this.state = Object.freeze({
        ...this.state,
        intentContext: initial.intentContext,
      });
    }

    if (initial.defaultStageConfiguration) {
      for (const [stageId, config] of Object.entries(initial.defaultStageConfiguration)) {
        this.applyStageConfiguration(stageId, config, "auto");
      }
    }

    this.validateCurrentStageExists();
    this.refreshStageRuntimeTrackingStatuses();
  }

  public getStageFlow(): StageFlowDefinition {
    return this.stageFlow;
  }

  public getState(): StageFlowRuntimeState {
    return this.state;
  }

  public getIntentContext(): StageFlowRuntimeState["intentContext"] {
    return this.state.intentContext;
  }

  public getStageRuntimeTracking(): Readonly<Record<string, StageRuntimeTracking>> {
    return this.stageRuntimeTracking;
  }

  public setStageConfiguration(
    stageId: string,
    configuration: Readonly<Record<string, CanonicalRecordValue>>,
  ): StageFlowRuntimeState {
    this.assertKnownStageId(stageId);
    this.applyStageConfiguration(stageId, configuration, "user");
    return this.state;
  }

  public setStageOutput(
    stageId: string,
    output: Readonly<Record<string, CanonicalRecordValue>>,
  ): StageFlowRuntimeState {
    this.assertKnownStageId(stageId);
    const normalizedOutput = freezeRecord(output);
    this.state = withStageOutput(this.state, stageId, normalizedOutput);
    this.updateStageRuntimeTrackingFromOutput(stageId, normalizedOutput);
    return this.state;
  }

  public setUnifiedIngestionStageOutput(
    stageId: string,
    result: UnifiedIngestionResult,
  ): StageFlowRuntimeState {
    this.assertKnownStageId(stageId);
    const typed = createUnifiedIngestionStageOutputFromResult(result);
    const output = toStageRecordFromUnifiedIngestionOutput(typed);
    this.state = withStageOutput(this.state, stageId, output);
    this.updateStageRuntimeTrackingFromOutput(stageId, output);
    return this.state;
  }

  public setRawStorageStageOutput(
    stageId: string,
    output: RawStorageStageOutput,
  ): StageFlowRuntimeState {
    this.assertKnownStageId(stageId);
    const stageRecord = toStageRecordFromRawStorageOutput(output);
    this.state = withStageOutput(this.state, stageId, stageRecord);
    this.updateStageRuntimeTrackingFromOutput(stageId, stageRecord);
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
    this.refreshStageRuntimeTrackingStatuses();
    return this.state;
  }

  public insertStage(stage: DatasetPipelineStageDefinition, order: number): StageFlowDefinition {
    this.stageFlow = insertStageInFlow(this.stageFlow, stage, order);
    this.stageRuntimeTracking = Object.freeze({
      ...this.stageRuntimeTracking,
      [stage.id]: Object.freeze({
        metadata: createStageMetadataFromDefinition(stage),
        contract: createStageContractFromDefinition(stage),
      }),
    });
    this.validateCurrentStageExists();
    this.refreshStageRuntimeTrackingStatuses();
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
      autoConfiguredStageIds: this.state.autoConfiguredStageIds.filter((existing) => existing !== normalizedStageId),
      userOverriddenStageIds: this.state.userOverriddenStageIds.filter((existing) => existing !== normalizedStageId),
    });
    const nextTracking = { ...this.stageRuntimeTracking };
    delete nextTracking[normalizedStageId];
    this.stageRuntimeTracking = Object.freeze(nextTracking);
    this.validateCurrentStageExists();
    this.refreshStageRuntimeTrackingStatuses();
    return this.stageFlow;
  }

  public reorderStages(orderedStageIds: ReadonlyArray<string>): StageFlowDefinition {
    this.stageFlow = reorderFlowStages(this.stageFlow, orderedStageIds);
    this.validateCurrentStageExists();
    this.refreshStageRuntimeTrackingStatuses();
    return this.stageFlow;
  }

  public goNext(): WizardFlowNavigationResult {
    const currentStage = this.getCurrentStage();
    const completion = dedupeOrdered([...this.state.completedStageIds, currentStage.id]);
    const resolution = this.resolveForward(currentStage.id);
    if (!resolution.nextStage) {
      this.state = Object.freeze({
        ...this.state,
        completedStageIds: dedupeOrdered([
          ...completion,
          ...resolution.autoCompletedStageIds,
        ]),
      });
      this.refreshStageRuntimeTrackingStatuses();
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
      completedStageIds: dedupeOrdered([
        ...completion,
        ...resolution.autoCompletedStageIds,
      ]),
      skippedStageIds: dedupeOrdered([...this.state.skippedStageIds, ...resolution.skippedStageIds]),
    });
    this.refreshStageRuntimeTrackingStatuses();

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
    this.refreshStageRuntimeTrackingStatuses();

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
          stageCategory: this.stageRuntimeTracking[stage.id]?.metadata.stageCategory ?? "processing",
          statusMarker: this.stageRuntimeTracking[stage.id]?.metadata.status.marker ?? "pending",
          lineageId: this.stageRuntimeTracking[stage.id]?.propagated?.lineage.lineageId,
          pipelineId: this.stageRuntimeTracking[stage.id]?.propagated?.lineage.pipelineId,
        }),
      }))),
    });
  }

  private resolveInitial(options: WizardFlowEngineOptions): {
    readonly stageFlow: StageFlowDefinition;
    readonly state?: StageFlowRuntimeState;
    readonly defaultStageConfiguration?: Readonly<Record<string, Readonly<Record<string, CanonicalRecordValue>>>>;
    readonly templateDefaults?: Readonly<Record<string, Readonly<Record<string, CanonicalRecordValue>>>>;
    readonly intentDefaults?: Readonly<Record<string, Readonly<Record<string, CanonicalRecordValue>>>>;
    readonly intentContext?: IntentContext;
  } {
    if (options.intentId || options.intentPreset) {
      if (!options.intentService) {
        throw new Error("WizardFlowEngine intent initialization requires an IntentService.");
      }
      const templateId = options.templateInstantiation?.templateId
        ?? options.template?.id;
      const resolution = options.intentService.resolve({
        intentId: options.intentId,
        intentPreset: options.intentPreset,
        templateId,
        orderedStageIds: options.templateInstantiation?.orderedStageIds,
        skippedStageIds: options.templateInstantiation?.skippedStageIds,
        stageConfigurationOverrides: options.templateInstantiation?.stageConfigurationOverrides,
      });
      return Object.freeze({
        stageFlow: resolution.stageFlow,
        defaultStageConfiguration: resolution.defaultStageConfiguration,
        templateDefaults: resolution.templateStageConfigurationDefaults,
        intentDefaults: resolution.intentStageConfigurationDefaults,
        intentContext: resolution.intent,
      });
    }
    if (options.stageFlow) {
      return Object.freeze({ stageFlow: options.stageFlow });
    }
    if (options.template) {
      return Object.freeze({
        stageFlow: options.template.stageFlow,
        defaultStageConfiguration: options.template.defaultStageConfiguration,
        templateDefaults: options.template.defaultStageConfiguration,
      });
    }
    if (options.templateService && options.templateInstantiation) {
      const instance = options.templateService.instantiate(options.templateInstantiation);
      return Object.freeze({
        stageFlow: instance.stageFlow,
        state: instance.state,
        defaultStageConfiguration: instance.template.defaultStageConfiguration,
        templateDefaults: instance.template.defaultStageConfiguration,
      });
    }
    throw new Error("WizardFlowEngine requires a stageFlow, template, template instantiation source, or intent source.");
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
    readonly autoCompletedStageIds: ReadonlyArray<string>;
  } {
    const conditional = this.selectConditionalTransition(fromStageId);
    const fromIndex = this.stageFlow.stages.findIndex((stage) => stage.id === fromStageId);
    let cursor = conditional
      ? this.stageFlow.stages.find((stage) => stage.id === conditional.toStageId)
      : this.getLinearNextStage(fromStageId);

    const skippedStageIds: string[] = [];
    const autoCompletedStageIds: string[] = [];
    if (conditional && cursor && fromIndex >= 0) {
      const toIndex = this.stageFlow.stages.findIndex((stage) => stage.id === cursor?.id);
      if (toIndex > fromIndex + 1) {
        const bypassed = this.stageFlow.stages
          .slice(fromIndex + 1, toIndex)
          .map((stage) => stage.id);
        skippedStageIds.push(...bypassed);
      }
    }

    while (cursor) {
      const decision = this.resolveStageDecision(cursor);
      if (hasValues(decision.autoConfiguration)) {
        this.applyStageConfiguration(cursor.id, decision.autoConfiguration, "auto");
      }

      if (decision.disposition === StageExecutionDispositions.skip) {
        skippedStageIds.push(cursor.id);
        cursor = this.getLinearNextStage(cursor.id);
        continue;
      }
      if (decision.disposition === StageExecutionDispositions.autoComplete) {
        autoCompletedStageIds.push(cursor.id);
        cursor = this.getLinearNextStage(cursor.id);
        continue;
      }
      break;
    }

    return Object.freeze({
      nextStage: cursor,
      skippedStageIds: Object.freeze(skippedStageIds),
      autoCompletedStageIds: Object.freeze(autoCompletedStageIds),
    });
  }

  private resolveStageDecision(stage: DatasetPipelineStageDefinition): StageExecutionPolicyDecision {
    if (this.state.skippedStageIds.includes(stage.id)) {
      return Object.freeze({
        disposition: StageExecutionDispositions.skip,
        reason: `Stage '${stage.id}' was already marked as skipped.`,
        autoConfiguration: Object.freeze({}),
      });
    }
    if (stage.executionPolicy.skipByDefault) {
      return Object.freeze({
        disposition: StageExecutionDispositions.skip,
        reason: `Stage '${stage.id}' is configured to skip by default.`,
        autoConfiguration: Object.freeze({}),
      });
    }
    if (stage.executionPolicy.mode === "conditional" && stage.executionPolicy.conditionId) {
      if (!this.isConditionMet(stage.executionPolicy.conditionId)) {
        return Object.freeze({
          disposition: StageExecutionDispositions.skip,
          reason: `Stage '${stage.id}' condition '${stage.executionPolicy.conditionId}' was not met.`,
          autoConfiguration: Object.freeze({}),
        });
      }
    }

    const policyDecision = this.stageExecutionPolicy?.evaluate({
      stage,
      stageFlow: this.stageFlow,
      state: this.state,
      intent: this.state.intentContext,
      templateDefaults: this.templateDefaults,
      intentDefaults: this.intentDefaults,
    });

    if (policyDecision) {
      if (policyDecision.disposition === StageExecutionDispositions.execute && this.autoSkipEvaluator) {
        const shouldSkip = this.autoSkipEvaluator({ stage, state: this.state });
        if (shouldSkip) {
          return Object.freeze({
            disposition: StageExecutionDispositions.skip,
            reason: `Stage '${stage.id}' was skipped by autoSkipEvaluator.`,
            autoConfiguration: policyDecision.autoConfiguration,
          });
        }
      }
      return policyDecision;
    }

    if (this.autoSkipEvaluator) {
      const shouldSkip = this.autoSkipEvaluator({
        stage,
        state: this.state,
      });
      if (shouldSkip) {
        return Object.freeze({
          disposition: StageExecutionDispositions.skip,
          reason: `Stage '${stage.id}' was skipped by autoSkipEvaluator.`,
          autoConfiguration: Object.freeze({}),
        });
      }
    }

    return Object.freeze({
      disposition: StageExecutionDispositions.execute,
      reason: `Stage '${stage.id}' should execute.`,
      autoConfiguration: Object.freeze({}),
    });
  }

  private applyStageConfiguration(
    stageId: string,
    configuration: Readonly<Record<string, CanonicalRecordValue>>,
    source: "user" | "auto",
  ): void {
    const normalizedConfig = freezeRecord(configuration);
    this.state = withStageConfiguration(this.state, stageId, normalizedConfig);
    if (source === "auto" && hasValues(normalizedConfig)) {
      this.state = Object.freeze({
        ...this.state,
        autoConfiguredStageIds: dedupeOrdered([...this.state.autoConfiguredStageIds, stageId]),
      });
      return;
    }
    if (source === "user") {
      this.state = Object.freeze({
        ...this.state,
        userOverriddenStageIds: dedupeOrdered([...this.state.userOverriddenStageIds, stageId]),
      });
    }
  }

  private updateStageRuntimeTrackingFromOutput(
    sourceStageId: string,
    output: Readonly<Record<string, CanonicalRecordValue>>,
  ): void {
    const sourceTracking = this.stageRuntimeTracking[sourceStageId];
    if (!sourceTracking) {
      return;
    }

    const payload = createStageMetadataPropagationPayload({
      stageId: sourceStageId,
      stageOutput: output,
    });
    if (!payload) {
      return;
    }

    const stageIndex = this.stageFlow.stages.findIndex((stage) => stage.id === sourceStageId);
    if (stageIndex < 0) {
      return;
    }

    const nextTracking: Record<string, StageRuntimeTracking> = { ...this.stageRuntimeTracking };
    for (const stage of this.stageFlow.stages.slice(stageIndex + 1)) {
      const existing = nextTracking[stage.id];
      if (!existing) {
        continue;
      }

      const merged = mergePropagationPayloads(existing.propagated, {
        ...payload,
        lineage: {
          ...payload.lineage,
          upstreamStageIds: Array.from(new Set([...payload.lineage.upstreamStageIds, sourceStageId])),
        },
      });

      nextTracking[stage.id] = Object.freeze({
        ...existing,
        metadata: {
          ...existing.metadata,
          lineageHooks: {
            pipelineId: merged.lineage.pipelineId,
            lineageId: merged.lineage.lineageId,
            upstreamStageIds: merged.lineage.upstreamStageIds,
          },
          previewHooks: {
            ...existing.metadata.previewHooks,
            previewReference: merged.previewReference ?? existing.metadata.previewHooks.previewReference,
          },
          inspectability: {
            ...existing.metadata.inspectability,
            inspectionReference: merged.inspectionReference ?? existing.metadata.inspectability.inspectionReference,
          },
          sourceMetadata: {
            detectedDataType: merged.detectedDataType ?? existing.metadata.sourceMetadata.detectedDataType,
            sourceReference: merged.storageReference ?? existing.metadata.sourceMetadata.sourceReference,
          },
        },
        propagated: merged,
      });
    }

    this.stageRuntimeTracking = Object.freeze(nextTracking);
    this.refreshStageRuntimeTrackingStatuses();
  }

  private refreshStageRuntimeTrackingStatuses(): void {
    const completed = new Set(this.state.completedStageIds);
    const skipped = new Set(this.state.skippedStageIds);
    const currentStageId = this.state.currentStageId;
    const stageOrder = this.stageFlow.stages.map((stage) => stage.id);
    const currentIndex = stageOrder.findIndex((stageId) => stageId === currentStageId);

    const nextTracking: Record<string, StageRuntimeTracking> = {};
    for (const stage of this.stageFlow.stages) {
      const existing = this.stageRuntimeTracking[stage.id] ?? Object.freeze({
        metadata: createStageMetadataFromDefinition(stage),
        contract: createStageContractFromDefinition(stage),
      } satisfies StageRuntimeTracking);

      let marker: "pending" | "current" | "completed" | "skipped" | "disabled" = "pending";
      if (stage.id === currentStageId) {
        marker = "current";
      } else if (completed.has(stage.id)) {
        marker = "completed";
      } else if (skipped.has(stage.id)) {
        marker = "skipped";
      } else {
        const stageIndex = stageOrder.findIndex((id) => id === stage.id);
        if (currentIndex >= 0 && stageIndex > currentIndex + 1) {
          marker = "disabled";
        }
      }

      nextTracking[stage.id] = Object.freeze({
        ...existing,
        metadata: withStageStatusMarker(existing.metadata, marker),
      });
    }

    this.stageRuntimeTracking = Object.freeze(nextTracking);
  }
}

export function createWizardFlowEngine(options: WizardFlowEngineOptions): WizardFlowEngine {
  return new WizardFlowEngine(options);
}
