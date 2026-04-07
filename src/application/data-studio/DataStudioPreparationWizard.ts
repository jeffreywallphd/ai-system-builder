import type { CanonicalRecordValue } from "@domain/dataset-studio/CanonicalDataShapes";
import {
  type PipelineStageConfigMode,
  type PipelineStageId,
  PipelineStageIds,
} from "@domain/dataset-studio/PipelineStageDomain";
import { PipelineStageRegistry } from "@domain/dataset-studio/PipelineStageRegistry";
import {
  UnifiedPreparationStageActivationModes,
  type UnifiedPreparationAssetDefinition,
  type UnifiedPreparationStageActivation,
  type UnifiedPreparationStageConfig,
  type UnifiedPreparationVisibilityMode,
} from "@domain/dataset-studio/UnifiedPreparationAsset";
import {
  UnifiedPreparationPipelineService,
  type UnifiedPreparationPipelineResolution,
} from "../dataset-studio/UnifiedPreparationPipelineService";
import type { StudioAuthoringGraphProjection } from "../studio-shell/StudioAuthoringGraph";
import { createDefaultDataStudioPreparationAssetDefinition } from "./DataStudioPreparationAssetDefaults";
import {
  createDefaultDataStudioPreparationTemplateRegistry,
  type DataStudioPreparationFieldDescriptor,
  type DataStudioPreparationFieldInputKind,
  type DataStudioPreparationFieldOption,
  type DataStudioPreparationTemplateConditionContext,
  type DataStudioPreparationTemplateConditionEvaluator,
  type DataStudioPreparationTemplateSummary,
  type DataStudioPreparationFieldDependency,
  type DataStudioPreparationTemplateRegistry,
} from "./DataStudioPreparationTemplates";
import {
  DataStudioAuthoringModes,
  createDataStudioPipelineStateFromWizard,
  deserializeDataStudioPipelineState,
  serializeDataStudioPipelineState,
  type DataStudioPipelineIdentity,
  type DataStudioPipelineState,
} from "./DataStudioPipelineState";

export const DataStudioWizardPresentationModes = Object.freeze({
  simple: "simple",
  advanced: "advanced",
} as const);

export type DataStudioWizardPresentationMode =
  typeof DataStudioWizardPresentationModes[keyof typeof DataStudioWizardPresentationModes];

export const DataStudioWizardStageStatuses = Object.freeze({
  current: "current",
  completed: "completed",
  skipped: "skipped",
  pending: "pending",
  disabled: "disabled",
} as const);

export type DataStudioWizardStageStatus =
  typeof DataStudioWizardStageStatuses[keyof typeof DataStudioWizardStageStatuses];

export interface DataStudioWizardValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: "error" | "warning";
  readonly stageId?: PipelineStageId;
}

export interface DataStudioWizardStageAvailability {
  readonly isAvailable: boolean;
  readonly reason?: "disabled" | "visibility" | "condition";
}

export interface DataStudioWizardFieldSnapshot {
  readonly fieldId: string;
  readonly optionKey: string;
  readonly label: string;
  readonly description?: string;
  readonly placeholder?: string;
  readonly inputKind: DataStudioPreparationFieldInputKind;
  readonly visibility: UnifiedPreparationVisibilityMode;
  readonly value?: CanonicalRecordValue;
  readonly options?: ReadonlyArray<DataStudioPreparationFieldOption>;
  readonly isVisible: boolean;
  readonly hiddenReason?: "visibility" | "template" | "condition";
}

export interface DataStudioWizardStageSnapshot {
  readonly stageId: PipelineStageId;
  readonly order: number;
  readonly title: string;
  readonly description: string;
  readonly status: DataStudioWizardStageStatus;
  readonly isOptional: boolean;
  readonly isSkippable: boolean;
  readonly visibility: UnifiedPreparationVisibilityMode;
  readonly configMode: PipelineStageConfigMode;
  readonly activation: UnifiedPreparationStageActivation;
  readonly options: Readonly<Record<string, CanonicalRecordValue>>;
  readonly assetGroupIds: ReadonlyArray<string>;
  readonly availability: DataStudioWizardStageAvailability;
  readonly fields: ReadonlyArray<DataStudioWizardFieldSnapshot>;
}

export interface DataStudioWizardSnapshot {
  readonly assetId: string;
  readonly versionId: string;
  readonly currentStageId: PipelineStageId;
  readonly presentationMode: DataStudioWizardPresentationMode;
  readonly template: DataStudioPreparationTemplateSummary;
  readonly stages: ReadonlyArray<DataStudioWizardStageSnapshot>;
  readonly completedStageIds: ReadonlyArray<PipelineStageId>;
  readonly skippedStageIds: ReadonlyArray<PipelineStageId>;
  readonly progressPercent: number;
  readonly canGoBack: boolean;
  readonly canGoNext: boolean;
  readonly authoringGraph: StudioAuthoringGraphProjection;
}

export interface DataStudioWizardNavigationResult {
  readonly moved: boolean;
  readonly fromStageId: PipelineStageId;
  readonly toStageId: PipelineStageId;
  readonly skippedStageIds: ReadonlyArray<PipelineStageId>;
  readonly issues: ReadonlyArray<DataStudioWizardValidationIssue>;
  readonly reason?: string;
}

export type DataStudioWizardConditionContext = DataStudioPreparationTemplateConditionContext;

export type DataStudioWizardConditionEvaluator = DataStudioPreparationTemplateConditionEvaluator;

export interface DataStudioWizardValidationHooks {
  readonly onEnterStage?: (input: {
    readonly fromStageId: PipelineStageId;
    readonly toStageId: PipelineStageId;
    readonly snapshot: DataStudioWizardSnapshot;
  }) => ReadonlyArray<DataStudioWizardValidationIssue>;
  readonly onLeaveStage?: (input: {
    readonly fromStageId: PipelineStageId;
    readonly toStageId: PipelineStageId;
    readonly snapshot: DataStudioWizardSnapshot;
  }) => ReadonlyArray<DataStudioWizardValidationIssue>;
  readonly onCompleteStage?: (input: {
    readonly stageId: PipelineStageId;
    readonly snapshot: DataStudioWizardSnapshot;
  }) => ReadonlyArray<DataStudioWizardValidationIssue>;
}

export interface DataStudioWizardCanvasHandoff {
  readonly asset: UnifiedPreparationAssetDefinition;
  readonly currentStageId: PipelineStageId;
  readonly presentationMode: DataStudioWizardPresentationMode;
  readonly stages: ReadonlyArray<DataStudioWizardStageSnapshot>;
  readonly completedStageIds: ReadonlyArray<PipelineStageId>;
  readonly skippedStageIds: ReadonlyArray<PipelineStageId>;
  readonly authoringGraph: StudioAuthoringGraphProjection;
}

export interface DataStudioPreparationWizardOptions {
  readonly asset?: UnifiedPreparationAssetDefinition;
  readonly pipelineService?: UnifiedPreparationPipelineService;
  readonly stageRegistry?: PipelineStageRegistry;
  readonly templateRegistry?: DataStudioPreparationTemplateRegistry;
  readonly templateId?: string;
  readonly conditionEvaluators?: Readonly<Record<string, DataStudioWizardConditionEvaluator>>;
  readonly validationHooks?: DataStudioWizardValidationHooks;
  readonly presentationMode?: DataStudioWizardPresentationMode;
}

function createIssue(input: {
  readonly code: string;
  readonly message: string;
  readonly severity?: "error" | "warning";
  readonly stageId?: PipelineStageId;
}): DataStudioWizardValidationIssue {
  return Object.freeze({
    code: input.code.trim(),
    message: input.message.trim(),
    severity: input.severity ?? "error",
    stageId: input.stageId,
  });
}

function dedupeOrderedStageIds(ids: ReadonlyArray<PipelineStageId>): ReadonlyArray<PipelineStageId> {
  return Object.freeze([...new Set(ids)]);
}

function stageOptionsMap(
  stages: ReadonlyArray<UnifiedPreparationStageConfig>,
): Readonly<Record<PipelineStageId, Readonly<Record<string, CanonicalRecordValue>>>> {
  return Object.freeze(Object.fromEntries(stages.map((stage) => [stage.stageId, stage.options])) as Record<
    PipelineStageId,
    Readonly<Record<string, CanonicalRecordValue>>
  >);
}

function normalizeStringArray(values: ReadonlyArray<string> | undefined): ReadonlyArray<string> {
  return Object.freeze([...new Set((values ?? [])
    .map((value) => value.trim())
    .filter((value) => value.length > 0))]);
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : undefined;
}

function readTrimmedString(record: Readonly<Record<string, unknown>> | undefined, key: string): string | undefined {
  if (!record) {
    return undefined;
  }
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function inferSourceKindFromLegacyFormat(format?: string): string | undefined {
  if (!format) {
    return undefined;
  }
  if (format === "json" || format === "jsonl" || format === "csv") {
    return "json";
  }
  if (format === "image" || format === "images") {
    return "image";
  }
  if (format === "document" || format === "text") {
    return "document";
  }
  return undefined;
}

function updateStageConfig(
  asset: UnifiedPreparationAssetDefinition,
  stageId: PipelineStageId,
  updater: (current: UnifiedPreparationStageConfig) => UnifiedPreparationStageConfig,
): UnifiedPreparationAssetDefinition {
  let found = false;
  const stages = asset.stages.map((stage) => {
    if (stage.stageId !== stageId) {
      return stage;
    }
    found = true;
    return updater(stage);
  });
  if (!found) {
    throw new Error(`Cannot update unknown stage '${stageId}'.`);
  }

  return Object.freeze({
    ...asset,
    stages: Object.freeze(stages),
  });
}

function findNextAvailableStageId(
  orderedStages: ReadonlyArray<DataStudioWizardStageSnapshot>,
  currentStageId: PipelineStageId,
): PipelineStageId | undefined {
  const currentIndex = orderedStages.findIndex((stage) => stage.stageId === currentStageId);
  if (currentIndex < 0) {
    return undefined;
  }

  for (const stage of orderedStages.slice(currentIndex + 1)) {
    if (stage.availability.isAvailable) {
      return stage.stageId;
    }
  }
  return undefined;
}

function findPreviousAvailableStageId(
  orderedStages: ReadonlyArray<DataStudioWizardStageSnapshot>,
  currentStageId: PipelineStageId,
): PipelineStageId | undefined {
  const currentIndex = orderedStages.findIndex((stage) => stage.stageId === currentStageId);
  if (currentIndex <= 0) {
    return undefined;
  }

  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    const stage = orderedStages[index];
    if (stage?.availability.isAvailable) {
      return stage.stageId;
    }
  }
  return undefined;
}

function computeProgressPercent(stages: ReadonlyArray<DataStudioWizardStageSnapshot>): number {
  if (stages.length === 0) {
    return 0;
  }
  const completedCount = stages.filter((stage) => stage.status === "completed").length;
  return Math.round((completedCount / stages.length) * 100);
}

function matchesFieldDependency(
  dependency: DataStudioPreparationFieldDependency,
  context: DataStudioWizardConditionContext,
): boolean {
  const value = context.stageOptions[dependency.stageId]?.[dependency.optionKey];
  if (dependency.in && dependency.in.length > 0) {
    return dependency.in.includes(value);
  }
  if (dependency.equals !== undefined) {
    return value === dependency.equals;
  }
  return Boolean(value);
}

export class DataStudioPreparationWizard {
  private asset: UnifiedPreparationAssetDefinition;
  private readonly pipelineService: UnifiedPreparationPipelineService;
  private readonly templateRegistry: DataStudioPreparationTemplateRegistry;
  private selectedTemplateId: string;
  private readonly customConditionEvaluators: Readonly<Record<string, DataStudioWizardConditionEvaluator>>;
  private templateConditionEvaluators: Readonly<Record<string, DataStudioWizardConditionEvaluator>>;
  private readonly validationHooks: DataStudioWizardValidationHooks;
  private presentationMode: DataStudioWizardPresentationMode;
  private resolution: UnifiedPreparationPipelineResolution;
  private currentStageId: PipelineStageId;
  private completedStageIds: ReadonlyArray<PipelineStageId>;
  private skippedStageIds: ReadonlyArray<PipelineStageId>;
  private navigationHistory: ReadonlyArray<PipelineStageId>;
  private persistentIdentity: Partial<DataStudioPipelineIdentity>;

  constructor(options: DataStudioPreparationWizardOptions = {}) {
    const stageRegistry = options.stageRegistry ?? new PipelineStageRegistry();
    this.pipelineService = options.pipelineService ?? new UnifiedPreparationPipelineService({
      stageRegistry,
    });
    this.templateRegistry = options.templateRegistry ?? createDefaultDataStudioPreparationTemplateRegistry();
    this.selectedTemplateId = options.templateId?.trim() || this.templateRegistry.getDefaultTemplateId();

    const templateInstantiation = options.asset
      ? undefined
      : this.templateRegistry.instantiate(this.selectedTemplateId);
    this.asset = options.asset ?? templateInstantiation?.asset ?? createDefaultDataStudioPreparationAssetDefinition(stageRegistry);
    this.selectedTemplateId = templateInstantiation?.template.id ?? this.selectedTemplateId;

    this.customConditionEvaluators = options.conditionEvaluators ?? Object.freeze({});
    this.templateConditionEvaluators = this.templateRegistry.getTemplate(this.selectedTemplateId).conditionEvaluators ?? Object.freeze({});
    this.validationHooks = options.validationHooks ?? Object.freeze({});
    this.presentationMode = options.presentationMode ?? DataStudioWizardPresentationModes.simple;
    this.resolution = this.pipelineService.resolve(this.asset);
    this.completedStageIds = Object.freeze([]);
    this.skippedStageIds = Object.freeze([]);
    this.navigationHistory = Object.freeze([]);
    const now = new Date().toISOString();
    this.persistentIdentity = Object.freeze({
      draftId: `data-studio-draft:${this.asset.identity.assetId}`,
      pipelineId: `data-studio-pipeline:${this.asset.identity.assetId}`,
      assetId: this.asset.identity.assetId,
      assetVersionId: this.asset.identity.versionId,
      name: this.templateRegistry.getTemplateSummary(this.selectedTemplateId).name,
      description: this.templateRegistry.getTemplateSummary(this.selectedTemplateId).description,
      revision: this.asset.versioning.revision,
      createdAt: now,
      updatedAt: now,
    });

    const initialStageId = this.getInitialStageId();
    if (!initialStageId) {
      throw new Error("Data Studio wizard requires at least one available stage.");
    }
    this.currentStageId = initialStageId;
    this.synchronizeLineageMetadata();
  }

  public getSnapshot(): DataStudioWizardSnapshot {
    const stages = this.getOrderedStageSnapshots();
    const currentStage = stages.find((stage) => stage.stageId === this.currentStageId);
    const fallbackCurrent = stages.find((stage) => stage.availability.isAvailable)?.stageId;
    const currentStageId = currentStage?.stageId ?? fallbackCurrent ?? this.currentStageId;
    const previousStageId = findPreviousAvailableStageId(stages, currentStageId);
    const nextStageId = findNextAvailableStageId(stages, currentStageId);

    return Object.freeze({
      assetId: this.asset.identity.assetId,
      versionId: this.asset.identity.versionId,
      currentStageId,
      presentationMode: this.presentationMode,
      template: this.templateRegistry.getTemplateSummary(this.selectedTemplateId),
      stages,
      completedStageIds: this.completedStageIds,
      skippedStageIds: this.skippedStageIds,
      progressPercent: computeProgressPercent(stages),
      canGoBack: typeof previousStageId === "string",
      canGoNext: typeof nextStageId === "string",
      authoringGraph: this.resolution.authoringGraph,
    });
  }

  public getAssetDefinition(): UnifiedPreparationAssetDefinition {
    return this.asset;
  }

  public listTemplates(): ReadonlyArray<DataStudioPreparationTemplateSummary> {
    return this.templateRegistry.listTemplates();
  }

  public selectTemplate(templateId: string): DataStudioWizardSnapshot {
    const instantiation = this.templateRegistry.instantiate(templateId);
    this.selectedTemplateId = instantiation.template.id;
    this.asset = instantiation.asset;
    this.templateConditionEvaluators = instantiation.template.conditionEvaluators ?? Object.freeze({});
    this.resolution = this.pipelineService.resolve(this.asset);
    this.completedStageIds = Object.freeze([]);
    this.skippedStageIds = Object.freeze([]);
    this.navigationHistory = Object.freeze([]);
    this.bumpPersistentRevision();
    const initialStageId = this.getInitialStageId();
    if (!initialStageId) {
      throw new Error("Data Studio wizard requires at least one available stage.");
    }
    this.currentStageId = initialStageId;
    this.synchronizeLineageMetadata();
    return this.getSnapshot();
  }

  public setPresentationMode(mode: DataStudioWizardPresentationMode): DataStudioWizardSnapshot {
    this.presentationMode = mode;
    this.refreshResolution();
    this.bumpPersistentRevision();
    return this.getSnapshot();
  }

  public setStageOptions(
    stageId: PipelineStageId,
    options: Readonly<Record<string, CanonicalRecordValue>>,
  ): DataStudioWizardSnapshot {
    this.asset = updateStageConfig(this.asset, stageId, (current) => Object.freeze({
      ...current,
      options: Object.freeze({ ...options }),
    }));
    this.refreshResolution();
    this.bumpPersistentRevision();
    return this.getSnapshot();
  }

  public setStageVisibility(
    stageId: PipelineStageId,
    visibility: UnifiedPreparationVisibilityMode,
  ): DataStudioWizardSnapshot {
    this.asset = updateStageConfig(this.asset, stageId, (current) => Object.freeze({
      ...current,
      visibility,
    }));
    this.refreshResolution();
    this.bumpPersistentRevision();
    return this.getSnapshot();
  }

  public setStageActivation(
    stageId: PipelineStageId,
    activation: UnifiedPreparationStageActivation,
  ): DataStudioWizardSnapshot {
    this.asset = updateStageConfig(this.asset, stageId, (current) => Object.freeze({
      ...current,
      activation: Object.freeze({
        mode: activation.mode,
        conditionId: activation.conditionId,
        reason: activation.reason,
      }),
    }));
    this.refreshResolution();
    this.bumpPersistentRevision();
    return this.getSnapshot();
  }

  public goNext(): DataStudioWizardNavigationResult {
    const snapshot = this.getSnapshot();
    const stages = snapshot.stages;
    const currentStage = stages.find((stage) => stage.stageId === snapshot.currentStageId);
    if (!currentStage) {
      return Object.freeze({
        moved: false,
        fromStageId: snapshot.currentStageId,
        toStageId: snapshot.currentStageId,
        skippedStageIds: Object.freeze([]),
        issues: Object.freeze([createIssue({
          code: "wizard.current-stage-missing",
          message: `Current stage '${snapshot.currentStageId}' is unavailable.`,
          stageId: snapshot.currentStageId,
        })]),
        reason: "Current stage is unavailable.",
      });
    }

    const candidateNext = findNextAvailableStageId(stages, currentStage.stageId);
    if (!candidateNext) {
      this.completedStageIds = dedupeOrderedStageIds([...this.completedStageIds, currentStage.stageId]);
      return Object.freeze({
        moved: false,
        fromStageId: currentStage.stageId,
        toStageId: currentStage.stageId,
        skippedStageIds: Object.freeze([]),
        issues: Object.freeze([]),
        reason: "No next stage available.",
      });
    }

    const issues = Object.freeze([
      ...(this.validationHooks.onCompleteStage?.({
        stageId: currentStage.stageId,
        snapshot,
      }) ?? []),
      ...(this.validationHooks.onLeaveStage?.({
        fromStageId: currentStage.stageId,
        toStageId: candidateNext,
        snapshot,
      }) ?? []),
      ...(this.validationHooks.onEnterStage?.({
        fromStageId: currentStage.stageId,
        toStageId: candidateNext,
        snapshot,
      }) ?? []),
    ]);

    if (issues.some((issue) => issue.severity === "error")) {
      return Object.freeze({
        moved: false,
        fromStageId: currentStage.stageId,
        toStageId: currentStage.stageId,
        skippedStageIds: Object.freeze([]),
        issues,
        reason: "Validation hooks blocked stage transition.",
      });
    }

    const skippedBetween = this.collectSkippedBetween(stages, currentStage.stageId, candidateNext);
    this.navigationHistory = Object.freeze([...this.navigationHistory, currentStage.stageId]);
    this.completedStageIds = dedupeOrderedStageIds([...this.completedStageIds, currentStage.stageId]);
    this.skippedStageIds = dedupeOrderedStageIds([...this.skippedStageIds, ...skippedBetween]);
    this.currentStageId = candidateNext;
    this.bumpPersistentRevision();

    return Object.freeze({
      moved: true,
      fromStageId: currentStage.stageId,
      toStageId: candidateNext,
      skippedStageIds: skippedBetween,
      issues,
    });
  }

  public goBack(): DataStudioWizardNavigationResult {
    const snapshot = this.getSnapshot();
    const stages = snapshot.stages;
    const currentStage = stages.find((stage) => stage.stageId === snapshot.currentStageId);
    if (!currentStage) {
      return Object.freeze({
        moved: false,
        fromStageId: snapshot.currentStageId,
        toStageId: snapshot.currentStageId,
        skippedStageIds: Object.freeze([]),
        issues: Object.freeze([]),
        reason: "Current stage is unavailable.",
      });
    }

    const historyStageId = this.navigationHistory[this.navigationHistory.length - 1];
    const candidatePrevious = historyStageId ?? findPreviousAvailableStageId(stages, currentStage.stageId);
    if (!candidatePrevious) {
      return Object.freeze({
        moved: false,
        fromStageId: currentStage.stageId,
        toStageId: currentStage.stageId,
        skippedStageIds: Object.freeze([]),
        issues: Object.freeze([]),
        reason: "No previous stage available.",
      });
    }

    const issues = Object.freeze(this.validationHooks.onEnterStage?.({
      fromStageId: currentStage.stageId,
      toStageId: candidatePrevious,
      snapshot,
    }) ?? []);
    if (issues.some((issue) => issue.severity === "error")) {
      return Object.freeze({
        moved: false,
        fromStageId: currentStage.stageId,
        toStageId: currentStage.stageId,
        skippedStageIds: Object.freeze([]),
        issues,
        reason: "Validation hooks blocked stage transition.",
      });
    }

    if (historyStageId) {
      this.navigationHistory = Object.freeze(this.navigationHistory.slice(0, -1));
    }
    this.currentStageId = candidatePrevious;
    this.bumpPersistentRevision();

    return Object.freeze({
      moved: true,
      fromStageId: currentStage.stageId,
      toStageId: candidatePrevious,
      skippedStageIds: Object.freeze([]),
      issues,
    });
  }

  public goToStage(stageId: PipelineStageId): DataStudioWizardNavigationResult {
    const snapshot = this.getSnapshot();
    const target = snapshot.stages.find((stage) => stage.stageId === stageId);
    if (!target) {
      return Object.freeze({
        moved: false,
        fromStageId: snapshot.currentStageId,
        toStageId: snapshot.currentStageId,
        skippedStageIds: Object.freeze([]),
        issues: Object.freeze([createIssue({
          code: "wizard.stage-not-found",
          message: `Stage '${stageId}' is not present in the current wizard definition.`,
          stageId,
        })]),
        reason: "Stage is not present in definition.",
      });
    }
    if (!target.availability.isAvailable) {
      return Object.freeze({
        moved: false,
        fromStageId: snapshot.currentStageId,
        toStageId: snapshot.currentStageId,
        skippedStageIds: Object.freeze([]),
        issues: Object.freeze([createIssue({
          code: "wizard.stage-unavailable",
          message: `Stage '${stageId}' is currently unavailable.`,
          stageId,
        })]),
        reason: "Stage is unavailable.",
      });
    }
    if (snapshot.currentStageId === stageId) {
      return Object.freeze({
        moved: false,
        fromStageId: stageId,
        toStageId: stageId,
        skippedStageIds: Object.freeze([]),
        issues: Object.freeze([]),
        reason: "Stage is already current.",
      });
    }

    const issues = Object.freeze(this.validationHooks.onEnterStage?.({
      fromStageId: snapshot.currentStageId,
      toStageId: stageId,
      snapshot,
    }) ?? []);
    if (issues.some((issue) => issue.severity === "error")) {
      return Object.freeze({
        moved: false,
        fromStageId: snapshot.currentStageId,
        toStageId: snapshot.currentStageId,
        skippedStageIds: Object.freeze([]),
        issues,
        reason: "Validation hooks blocked stage transition.",
      });
    }

    this.navigationHistory = Object.freeze([...this.navigationHistory, snapshot.currentStageId]);
    this.currentStageId = stageId;
    this.bumpPersistentRevision();

    return Object.freeze({
      moved: true,
      fromStageId: snapshot.currentStageId,
      toStageId: stageId,
      skippedStageIds: Object.freeze([]),
      issues,
    });
  }

  public toCanvasHandoff(): DataStudioWizardCanvasHandoff {
    const snapshot = this.getSnapshot();
    return Object.freeze({
      asset: this.asset,
      currentStageId: snapshot.currentStageId,
      presentationMode: snapshot.presentationMode,
      stages: snapshot.stages,
      completedStageIds: snapshot.completedStageIds,
      skippedStageIds: snapshot.skippedStageIds,
      authoringGraph: snapshot.authoringGraph,
    });
  }

  public exportPipelineState(): DataStudioPipelineState {
    return createDataStudioPipelineStateFromWizard({
      snapshot: this.getSnapshot(),
      asset: this.asset,
      navigationHistory: this.navigationHistory,
      authoringMode: DataStudioAuthoringModes.wizard,
      identity: this.persistentIdentity,
    });
  }

  public exportPipelineStateJson(): string {
    return serializeDataStudioPipelineState(this.exportPipelineState());
  }

  public importPipelineState(input: DataStudioPipelineState | string): DataStudioWizardSnapshot {
    let state: DataStudioPipelineState;
    if (typeof input === "string") {
      try {
        state = deserializeDataStudioPipelineState(input);
      } catch {
        return this.importLegacyDataStudioState(input);
      }
    } else {
      state = input;
    }
    const templateExists = this.templateRegistry
      .listTemplates()
      .some((template) => template.id === state.flow.templateId);
    if (templateExists) {
      this.selectedTemplateId = state.flow.templateId;
    }
    this.templateConditionEvaluators = this.templateRegistry
      .getTemplate(this.selectedTemplateId)
      .conditionEvaluators ?? Object.freeze({});
    this.asset = state.unifiedPreparationAsset;
    this.presentationMode = state.flow.presentationMode;
    this.completedStageIds = dedupeOrderedStageIds(state.flow.completedStageIds);
    this.skippedStageIds = dedupeOrderedStageIds(state.flow.skippedStageIds);
    this.navigationHistory = dedupeOrderedStageIds(state.flow.navigationHistory);
    this.currentStageId = state.flow.currentStageId;
    this.persistentIdentity = Object.freeze({
      ...state.identity,
    });
    this.refreshResolution();
    return this.getSnapshot();
  }

  private importLegacyDataStudioState(value: string): DataStudioWizardSnapshot {
    const legacyRecord = asRecord(JSON.parse(value) as unknown);
    const datasetSpec = asRecord(legacyRecord?.datasetSpec);
    const datasetPipelineSpec = asRecord(legacyRecord?.datasetPipelineSpec);
    if (!datasetSpec && !datasetPipelineSpec) {
      throw new Error("Persisted state is not a recognized Data Studio pipeline format.");
    }

    const snapshot = this.getSnapshot();
    const sourceSelection = snapshot.stages.find((stage) => stage.stageId === PipelineStageIds.SourceSelection);
    const ingestion = snapshot.stages.find((stage) => stage.stageId === PipelineStageIds.UnifiedIngestion);
    const pipelineSource = asRecord((datasetPipelineSpec?.sources as ReadonlyArray<unknown> | undefined)?.[0]);
    const pipelineRuntime = asRecord(datasetPipelineSpec?.runtime);
    const pipelineSchemas = asRecord(datasetPipelineSpec?.schemas);

    if (sourceSelection) {
      this.setStageOptions(PipelineStageIds.SourceSelection, Object.freeze({
        ...sourceSelection.options,
        sourceReference: readTrimmedString(pipelineSource, "datasetRef")
          ?? readTrimmedString(datasetSpec, "source")
          ?? readTrimmedString(sourceSelection.options as Readonly<Record<string, unknown>>, "sourceReference"),
        sourceKind: readTrimmedString(pipelineSource, "ingestionMode")
          ?? inferSourceKindFromLegacyFormat(readTrimmedString(datasetSpec, "format"))
          ?? readTrimmedString(sourceSelection.options as Readonly<Record<string, unknown>>, "sourceKind")
          ?? "auto",
        legacySchemaDefinition: datasetSpec?.schema,
        inputSchemaAssetId: readTrimmedString(asRecord(pipelineSchemas?.input), "assetId"),
        outputSchemaAssetId: readTrimmedString(asRecord(pipelineSchemas?.output), "assetId"),
      }));
    }

    if (ingestion) {
      this.setStageOptions(PipelineStageIds.UnifiedIngestion, Object.freeze({
        ...ingestion.options,
        outputTarget: readTrimmedString(asRecord(datasetPipelineSpec?.outputs), "datasetVersionTarget")
          ?? readTrimmedString(ingestion.options as Readonly<Record<string, unknown>>, "outputTarget")
          ?? "records",
        executionMode: readTrimmedString(pipelineRuntime, "executionMode"),
      }));
    }

    this.bumpPersistentRevision();
    this.refreshResolution();
    return this.getSnapshot();
  }

  private getInitialStageId(): PipelineStageId | undefined {
    const firstAvailable = this.getOrderedStageSnapshots().find((stage) => stage.availability.isAvailable);
    return firstAvailable?.stageId;
  }

  private refreshResolution(): void {
    this.resolution = this.pipelineService.resolve(this.asset);
    const stages = this.getOrderedStageSnapshots();
    if (!stages.some((stage) => stage.stageId === this.currentStageId && stage.availability.isAvailable)) {
      const nextCurrent = stages.find((stage) => stage.availability.isAvailable)?.stageId;
      if (!nextCurrent) {
        throw new Error("Data Studio wizard requires at least one available stage.");
      }
      this.currentStageId = nextCurrent;
    }
    const knownStageIds = new Set(stages.map((stage) => stage.stageId));
    this.completedStageIds = dedupeOrderedStageIds(this.completedStageIds.filter((stageId) => knownStageIds.has(stageId)));
    this.skippedStageIds = dedupeOrderedStageIds(this.skippedStageIds.filter((stageId) => knownStageIds.has(stageId)));
    this.navigationHistory = Object.freeze(
      this.navigationHistory.filter((stageId) => knownStageIds.has(stageId)),
    );
    this.synchronizeLineageMetadata();
  }

  private resolveFieldSnapshots(
    stage: UnifiedPreparationStageConfig,
    conditionContext: DataStudioWizardConditionContext,
  ): ReadonlyArray<DataStudioWizardFieldSnapshot> {
    const descriptors = this.templateRegistry
      .listFieldDescriptors()
      .filter((descriptor) => descriptor.stageId === stage.stageId);

    return Object.freeze(descriptors.map((descriptor) => this.toFieldSnapshot(descriptor, stage, conditionContext)));
  }

  private toFieldSnapshot(
    descriptor: DataStudioPreparationFieldDescriptor,
    stage: UnifiedPreparationStageConfig,
    conditionContext: DataStudioWizardConditionContext,
  ): DataStudioWizardFieldSnapshot {
    const override = this.templateRegistry.resolveFieldVisibilityOverride(
      this.selectedTemplateId,
      stage.stageId,
      descriptor.fieldId,
    );

    const visibility = override?.visibility ?? descriptor.visibility;
    const templates = override?.templates ?? descriptor.templates;
    const dependency = override?.dependsOn ?? descriptor.dependsOn;

    let isVisible = true;
    let hiddenReason: DataStudioWizardFieldSnapshot["hiddenReason"];

    if (this.presentationMode === DataStudioWizardPresentationModes.simple && visibility === "advanced") {
      isVisible = false;
      hiddenReason = "visibility";
    } else if (templates && templates.length > 0 && !templates.includes(this.selectedTemplateId)) {
      isVisible = false;
      hiddenReason = "template";
    } else if (dependency && !matchesFieldDependency(dependency, conditionContext)) {
      isVisible = false;
      hiddenReason = "condition";
    }

    return Object.freeze({
      fieldId: descriptor.fieldId,
      optionKey: descriptor.optionKey,
      label: descriptor.label,
      description: descriptor.description,
      placeholder: descriptor.placeholder,
      inputKind: descriptor.inputKind,
      visibility,
      value: stage.options[descriptor.optionKey] ?? descriptor.defaultValue,
      options: descriptor.options,
      isVisible,
      hiddenReason,
    });
  }

  private getOrderedStageSnapshots(): ReadonlyArray<DataStudioWizardStageSnapshot> {
    const stageConfigById = new Map(this.asset.stages.map((stage) => [stage.stageId, stage]));
    const completedSet = new Set(this.completedStageIds);
    const skippedSet = new Set(this.skippedStageIds);
    const conditionContext: DataStudioWizardConditionContext = Object.freeze({
      currentStageId: this.currentStageId,
      presentationMode: this.presentationMode,
      completedStageIds: this.completedStageIds,
      skippedStageIds: this.skippedStageIds,
      stageOptions: stageOptionsMap(this.asset.stages),
    });

    return Object.freeze(this.resolution.stageDescriptors.map((descriptor) => {
      const config = stageConfigById.get(descriptor.stageId);
      if (!config) {
        throw new Error(`Missing unified preparation config for stage '${descriptor.stageId}'.`);
      }
      const availability = this.resolveAvailability(config, conditionContext);
      const status = this.resolveStatus(descriptor.stageId, availability, completedSet, skippedSet);
      const fields = this.resolveFieldSnapshots(config, conditionContext);

      return Object.freeze({
        stageId: descriptor.stageId,
        order: descriptor.order,
        title: descriptor.label,
        description: descriptor.description,
        status,
        isOptional: descriptor.optional,
        isSkippable: descriptor.optional,
        visibility: config.visibility,
        configMode: config.configMode,
        activation: config.activation,
        options: config.options,
        assetGroupIds: descriptor.assetGroupIds,
        availability,
        fields,
      });
    }));
  }

  private resolveAvailability(
    stage: UnifiedPreparationStageConfig,
    context: DataStudioWizardConditionContext,
  ): DataStudioWizardStageAvailability {
    if (stage.activation.mode === UnifiedPreparationStageActivationModes.disabled) {
      return Object.freeze({
        isAvailable: false,
        reason: "disabled",
      });
    }
    if (this.presentationMode === DataStudioWizardPresentationModes.simple && stage.visibility === "advanced") {
      return Object.freeze({
        isAvailable: false,
        reason: "visibility",
      });
    }
    if (stage.activation.mode === UnifiedPreparationStageActivationModes.conditional) {
      const conditionId = stage.activation.conditionId?.trim();
      if (!conditionId) {
        return Object.freeze({
          isAvailable: false,
          reason: "condition",
        });
      }
      const evaluator = this.customConditionEvaluators[conditionId] ?? this.templateConditionEvaluators[conditionId];
      const conditionMet = Boolean(evaluator?.(context));
      if (!conditionMet) {
        return Object.freeze({
          isAvailable: false,
          reason: "condition",
        });
      }
    }
    return Object.freeze({
      isAvailable: true,
    });
  }

  private resolveStatus(
    stageId: PipelineStageId,
    availability: DataStudioWizardStageAvailability,
    completedSet: ReadonlySet<PipelineStageId>,
    skippedSet: ReadonlySet<PipelineStageId>,
  ): DataStudioWizardStageStatus {
    if (stageId === this.currentStageId && availability.isAvailable) {
      return DataStudioWizardStageStatuses.current;
    }
    if (completedSet.has(stageId)) {
      return DataStudioWizardStageStatuses.completed;
    }
    if (skippedSet.has(stageId) || !availability.isAvailable) {
      return availability.reason === "disabled"
        ? DataStudioWizardStageStatuses.disabled
        : DataStudioWizardStageStatuses.skipped;
    }
    return DataStudioWizardStageStatuses.pending;
  }

  private collectSkippedBetween(
    stages: ReadonlyArray<DataStudioWizardStageSnapshot>,
    fromStageId: PipelineStageId,
    toStageId: PipelineStageId,
  ): ReadonlyArray<PipelineStageId> {
    const fromIndex = stages.findIndex((stage) => stage.stageId === fromStageId);
    const toIndex = stages.findIndex((stage) => stage.stageId === toStageId);
    if (fromIndex < 0 || toIndex < 0 || toIndex <= fromIndex + 1) {
      return Object.freeze([]);
    }
    return Object.freeze(stages
      .slice(fromIndex + 1, toIndex)
      .filter((stage) => !stage.availability.isAvailable)
      .map((stage) => stage.stageId));
  }

  private bumpPersistentRevision(): void {
    const now = new Date().toISOString();
    const nextRevision = (this.persistentIdentity.revision ?? 0) + 1;
    this.persistentIdentity = Object.freeze({
      ...this.persistentIdentity,
      assetId: this.asset.identity.assetId,
      assetVersionId: this.asset.identity.versionId,
      name: this.templateRegistry.getTemplateSummary(this.selectedTemplateId).name,
      description: this.templateRegistry.getTemplateSummary(this.selectedTemplateId).description,
      revision: nextRevision,
      updatedAt: now,
      createdAt: this.persistentIdentity.createdAt ?? now,
    });
  }

  private synchronizeLineageMetadata(): void {
    const stageReferences = Object.freeze(this.resolution.stageDescriptors.map((descriptor) => Object.freeze({
      stageId: descriptor.stageId,
      order: descriptor.order,
      assetGroupIds: descriptor.assetGroupIds,
    })));
    const upstreamPipelineAssetIds = normalizeStringArray(this.asset.upstreamBindings.map((binding) => binding.pipelineAssetId));
    const sourceSelection = this.asset.stages.find((stage) => stage.stageId === PipelineStageIds.SourceSelection);
    const sourceReferences = normalizeStringArray([
      typeof sourceSelection?.options.sourceReference === "string" ? sourceSelection.options.sourceReference : "",
      ...this.asset.upstreamBindings.map((binding) => binding.sourceReference ?? ""),
    ]);

    this.asset = Object.freeze({
      ...this.asset,
      lineage: Object.freeze({
        ...this.asset.lineage,
        upstreamPipelineAssetIds,
        sourceReferences,
        stageReferences,
        preparationContext: Object.freeze({
          ...this.asset.lineage.preparationContext,
          templateId: this.selectedTemplateId,
          presentationMode: this.presentationMode,
          authoringMode: "wizard",
        }),
      }),
    });
  }

}

export { createDefaultDataStudioPreparationAssetDefinition } from "./DataStudioPreparationAssetDefaults";
export type { DataStudioPreparationTemplateSummary } from "./DataStudioPreparationTemplates";

