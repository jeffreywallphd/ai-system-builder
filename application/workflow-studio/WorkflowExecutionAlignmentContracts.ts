import type {
  WorkflowDraft,
  WorkflowDraftInput,
  WorkflowDraftInputSourceType,
  WorkflowDraftInputValueType,
  WorkflowDraftOutputDestinationType,
  WorkflowDraftOutputFormat,
  WorkflowDraftOutputType,
  WorkflowDraftStepKind,
  WorkflowDraftStepType,
  WorkflowValidationIssue,
} from "../../domain/workflow-studio/WorkflowStudioDomain";

export const WorkflowExecutionValidationStages = Object.freeze({
  preTranslation: "pre-translation",
  preExecution: "pre-execution",
});

export type WorkflowExecutionValidationStage =
  typeof WorkflowExecutionValidationStages[keyof typeof WorkflowExecutionValidationStages];

export interface WorkflowExecutionRequest {
  readonly requestId?: string;
  readonly workflowId?: string;
  readonly workflowName?: string;
  readonly draftRevision?: number;
  readonly source: "workflow-draft";
}

export interface WorkflowExecutionTriggerActivationPayload {
  readonly triggerId: string;
  readonly activationType?: string;
  readonly payload?: Readonly<Record<string, unknown>>;
}

export interface WorkflowExecutionContext {
  readonly inputValues: Readonly<Record<string, unknown>>;
  readonly resolvedRuntimeInputs: Readonly<Record<string, unknown>>;
  readonly resolvedInputValues: Readonly<Record<string, unknown>>;
  readonly resolvedInputBindings: Readonly<Record<string, unknown>>;
  readonly resolvedInputs: ReadonlyArray<WorkflowExecutionResolvedInputValue>;
  readonly unresolvedInputs: ReadonlyArray<WorkflowExecutionUnresolvedInput>;
  readonly selectedAssets: Readonly<{
    readonly datasets: ReadonlyArray<WorkflowExecutionResolvedDatasetAsset>;
  }>;
  readonly triggerActivation?: WorkflowExecutionTriggerActivationPayload;
  readonly triggerPayload?: Readonly<Record<string, unknown>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly sessionContext?: Readonly<Record<string, unknown>>;
}

export interface WorkflowExecutionResolvedDatasetAsset {
  readonly inputId: string;
  readonly assetId: string;
  readonly versionId?: string;
  readonly format?: "jsonl" | "json" | "csv" | "parquet";
  readonly selection?: Readonly<Record<string, unknown>>;
}

export interface WorkflowExecutionResolvedInputValue {
  readonly inputId: string;
  readonly sourceType: WorkflowDraftInputSourceType;
  readonly required: boolean;
  readonly valueType?: WorkflowDraftInputValueType;
  readonly bindingKey: string;
  readonly resolved: boolean;
  readonly resolutionSource:
    | "runtime-parameter"
    | "runtime-default"
    | "trigger-activation"
    | "dataset-asset"
    | "static-value";
  readonly value: unknown;
}

export interface WorkflowExecutionUnresolvedInput {
  readonly inputId: string;
  readonly sourceType: WorkflowDraftInputSourceType;
  readonly required: boolean;
  readonly valueType?: WorkflowDraftInputValueType;
  readonly bindingKey: string;
  readonly reasonCode: "required-input-missing" | "runtime-parameter-unresolved";
  readonly message: string;
}

export interface WorkflowExecutionInputBinding {
  readonly inputId: string;
  readonly sourceType: WorkflowDraftInputSourceType;
  readonly required: boolean;
  readonly valueType?: WorkflowDraftInputValueType;
  readonly bindingKey: string;
  readonly defaultValue?: unknown;
  readonly staticValue?: unknown;
  readonly dataset?: Readonly<{
    readonly assetId: string;
    readonly versionId?: string;
    readonly format?: "jsonl" | "json" | "csv" | "parquet";
    readonly selection?: Readonly<Record<string, unknown>>;
  }>;
}

export interface WorkflowExecutionTriggerDescriptor {
  readonly triggerId: string;
  readonly runtimeKind: "manual" | "temporal" | "state";
  readonly triggerKind: string;
  readonly triggerType: string;
}

export interface WorkflowExecutionTriggerHandoff {
  readonly handoffMode: "await-trigger" | "activated";
  readonly availableTriggers: ReadonlyArray<WorkflowExecutionTriggerDescriptor>;
  readonly activation?: WorkflowExecutionTriggerActivationPayload;
}

export interface WorkflowExecutionStepSequencingMetadata {
  readonly stepId: string;
  readonly stepType: WorkflowDraftStepType;
  readonly stepKind?: WorkflowDraftStepKind;
  readonly order: number;
  readonly dependsOnStepIds: ReadonlyArray<string>;
  readonly controlFlow?: Readonly<{
      readonly branchStepIds?: Readonly<{
        readonly then: ReadonlyArray<string>;
        readonly else: ReadonlyArray<string>;
      }>;
      readonly conditionalRouteStepIds?: ReadonlyArray<string>;
      readonly loopBodyStepIds?: ReadonlyArray<string>;
      readonly manualOutcomeStepIds?: Readonly<Record<string, ReadonlyArray<string>>>;
    }>;
}

export interface WorkflowExecutionControlFlowBranchMapping {
  readonly mappingType: "branch";
  readonly stepId: string;
  readonly conditionKind: "expression" | "comparison";
  readonly thenStepIds: ReadonlyArray<string>;
  readonly elseStepIds: ReadonlyArray<string>;
}

export interface WorkflowExecutionControlFlowLoopMapping {
  readonly mappingType: "loop";
  readonly stepId: string;
  readonly mode: "fixed-count" | "collection" | "range";
  readonly bodyStepIds: ReadonlyArray<string>;
  readonly maxIterations?: number;
}

export interface WorkflowExecutionControlFlowManualMapping {
  readonly mappingType: "manual-routing";
  readonly stepId: string;
  readonly interactionMode: "approval" | "review" | "confirmation";
  readonly outcomes: Readonly<Record<string, ReadonlyArray<string>>>;
}

export type WorkflowExecutionControlFlowMapping =
  | WorkflowExecutionControlFlowBranchMapping
  | WorkflowExecutionControlFlowLoopMapping
  | WorkflowExecutionControlFlowManualMapping;

export interface WorkflowExecutionOutputBinding {
  readonly outputId: string;
  readonly outputType: WorkflowDraftOutputType;
  readonly format: WorkflowDraftOutputFormat;
  readonly sourceStepId?: string;
  readonly destinationType: WorkflowDraftOutputDestinationType;
  readonly target: string;
  readonly options?: Readonly<Record<string, unknown>>;
}

export interface WorkflowExecutionTranslationIssue {
  readonly code: string;
  readonly stage: WorkflowExecutionValidationStage;
  readonly severity: "error" | "warning";
  readonly message: string;
  readonly path?: string;
}

export interface WorkflowExecutionValidationBoundary {
  readonly stage: WorkflowExecutionValidationStage;
  readonly ready: boolean;
  readonly issues: ReadonlyArray<WorkflowExecutionTranslationIssue>;
}

export interface WorkflowExecutionPlanTranslationRequest {
  readonly draft: WorkflowDraft;
  readonly request?: Omit<WorkflowExecutionRequest, "source">;
  readonly context?: Partial<WorkflowExecutionContext>;
}

export interface WorkflowExecutionPlanTranslationResult<TPlan> {
  readonly success: boolean;
  readonly plan?: TPlan;
  readonly issues: ReadonlyArray<WorkflowExecutionTranslationIssue>;
  readonly validationBoundary: WorkflowExecutionValidationBoundary;
}

function readTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeWorkflowExecutionRequest(
  request?: WorkflowExecutionPlanTranslationRequest["request"],
): WorkflowExecutionRequest {
  return Object.freeze({
    source: "workflow-draft",
    requestId: readTrimmedString(request?.requestId),
    workflowId: readTrimmedString(request?.workflowId),
    workflowName: readTrimmedString(request?.workflowName),
    draftRevision: Number.isInteger(request?.draftRevision) && (request?.draftRevision ?? 0) > 0
      ? request?.draftRevision
      : undefined,
  });
}

export function normalizeWorkflowExecutionContext(
  context?: WorkflowExecutionPlanTranslationRequest["context"],
): WorkflowExecutionContext {
  const triggerId = readTrimmedString(context?.triggerActivation?.triggerId);
  const triggerPayload = context?.triggerActivation?.payload
    ? Object.freeze({ ...context.triggerActivation.payload })
    : undefined;
  const metadata = context?.metadata ? Object.freeze({ ...context.metadata }) : undefined;
  const sessionContext = metadata && typeof metadata.session === "object" && metadata.session
    ? Object.freeze({ ...(metadata.session as Record<string, unknown>) })
    : undefined;
  return Object.freeze({
    inputValues: Object.freeze({ ...(context?.inputValues ?? {}) }),
    resolvedRuntimeInputs: Object.freeze({}),
    resolvedInputValues: Object.freeze({}),
    resolvedInputBindings: Object.freeze({}),
    resolvedInputs: Object.freeze([]),
    unresolvedInputs: Object.freeze([]),
    selectedAssets: Object.freeze({
      datasets: Object.freeze([]),
    }),
    triggerActivation: triggerId
      ? Object.freeze({
        triggerId,
        activationType: readTrimmedString(context?.triggerActivation?.activationType),
        payload: triggerPayload,
      })
      : undefined,
    triggerPayload,
    metadata,
    sessionContext,
  });
}

export function mapValidationIssuesToExecutionTranslationIssues(
  issues: ReadonlyArray<WorkflowValidationIssue>,
): ReadonlyArray<WorkflowExecutionTranslationIssue> {
  return Object.freeze(issues.map((issue) => Object.freeze({
    code: issue.code,
    stage: WorkflowExecutionValidationStages.preTranslation,
    severity: issue.severity,
    message: issue.message,
    path: issue.path,
  })));
}

export function createTranslationFailureResult<TPlan>(input: {
  readonly issues: ReadonlyArray<WorkflowExecutionTranslationIssue>;
  readonly stage?: WorkflowExecutionValidationStage;
}): WorkflowExecutionPlanTranslationResult<TPlan> {
  const stage = input.stage ?? WorkflowExecutionValidationStages.preTranslation;
  const issues = Object.freeze([...input.issues]);
  return Object.freeze({
    success: false,
    issues,
    validationBoundary: Object.freeze({
      stage,
      ready: false,
      issues,
    }),
  });
}

export function createTranslationSuccessResult<TPlan>(
  plan: TPlan,
  issues: ReadonlyArray<WorkflowExecutionTranslationIssue> = Object.freeze([]),
): WorkflowExecutionPlanTranslationResult<TPlan> {
  const normalizedIssues = Object.freeze([...issues]);
  return Object.freeze({
    success: true,
    plan,
    issues: normalizedIssues,
    validationBoundary: Object.freeze({
      stage: WorkflowExecutionValidationStages.preExecution,
      ready: true,
      issues: normalizedIssues,
    }),
  });
}

export function mapWorkflowInputToExecutionBinding(input: WorkflowDraftInput): WorkflowExecutionInputBinding {
  if (input.sourceType === "dataset-asset") {
    return Object.freeze({
      inputId: input.id,
      sourceType: input.sourceType,
      required: input.required ?? false,
      valueType: input.valueType,
      bindingKey: `inputs.${input.id}.dataset`,
      dataset: Object.freeze({
        assetId: input.asset.assetId,
        versionId: input.asset.versionId,
        format: input.format,
        selection: input.selection ? Object.freeze({ ...input.selection }) : undefined,
      }),
    });
  }

  if (input.sourceType === "runtime-parameter") {
    return Object.freeze({
      inputId: input.id,
      sourceType: input.sourceType,
      required: input.required ?? false,
      valueType: input.valueType,
      bindingKey: `inputs.${input.parameterKey}`,
      defaultValue: input.defaultValue,
    });
  }

  return Object.freeze({
    inputId: input.id,
    sourceType: input.sourceType,
    required: input.required ?? false,
    valueType: input.valueType,
    bindingKey: `inputs.${input.id}.static`,
    staticValue: input.value,
  });
}

