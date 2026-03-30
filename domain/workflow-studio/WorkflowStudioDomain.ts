import type { AssetContractDescriptor } from "../contracts/AssetContract";
import type { AssetMetadata } from "../studio-shell/StudioShellDomain";
import {
  assertAllowedCompositionTaxonomyCombination,
  createCompositionTaxonomyDescriptor,
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
  type CompositionTaxonomyDescriptor,
  type TaxonomyBehaviorKind,
} from "../taxonomy/CompositionTaxonomy";

export interface WorkflowEntityMetadata {
  readonly summary?: string;
  readonly tags: ReadonlyArray<string>;
}

export const WorkflowDraftTriggerKinds = Object.freeze({
  user: "user",
  temporal: "temporal",
  state: "state",
});

export type WorkflowDraftTriggerKind = typeof WorkflowDraftTriggerKinds[keyof typeof WorkflowDraftTriggerKinds];

export const WorkflowDraftTriggerTypes = Object.freeze({
  userManual: "manual",
  userButtonClick: "button-click",
  userInitiatedRun: "user-initiated-run",
  temporalSchedule: "schedule",
  temporalRecurring: "recurring",
  stateDataAvailable: "data-available",
  stateAssetStateChanged: "asset-state-changed",
  stateSystemEvent: "system-event",
});

export type WorkflowDraftTriggerType = typeof WorkflowDraftTriggerTypes[keyof typeof WorkflowDraftTriggerTypes];

export const WorkflowDraftUserTriggerScopes = Object.freeze({
  workflowStart: "workflow-start",
  workflowContinuation: "workflow-continuation",
});

export type WorkflowDraftUserTriggerScope =
  typeof WorkflowDraftUserTriggerScopes[keyof typeof WorkflowDraftUserTriggerScopes];

export const WorkflowDraftTemporalScheduleModes = Object.freeze({
  oneTime: "one-time",
  cron: "cron",
  interval: "interval",
});

export type WorkflowDraftTemporalScheduleMode =
  typeof WorkflowDraftTemporalScheduleModes[keyof typeof WorkflowDraftTemporalScheduleModes];

export const WorkflowDraftStateEventSourceTypes = Object.freeze({
  dataset: "dataset",
  asset: "asset",
  system: "system",
});

export type WorkflowDraftStateEventSourceType =
  typeof WorkflowDraftStateEventSourceTypes[keyof typeof WorkflowDraftStateEventSourceTypes];

export const WorkflowDraftStateEventCategories = Object.freeze({
  dataIngested: "data-ingested",
  assetUpdated: "asset-updated",
  systemStateChanged: "system-state-changed",
});

export type WorkflowDraftStateEventCategory =
  typeof WorkflowDraftStateEventCategories[keyof typeof WorkflowDraftStateEventCategories];

export interface WorkflowDraftAssetReference {
  readonly assetId: string;
  readonly versionId?: string;
  readonly taxonomy?: CompositionTaxonomyDescriptor;
}

export interface WorkflowDraftTriggerBase extends WorkflowDraftSectionItemBase {
  readonly kind: WorkflowDraftTriggerKind;
  readonly type: WorkflowDraftTriggerType;
}

export interface WorkflowDraftUserTriggerConfig {
  readonly invocationScope?: WorkflowDraftUserTriggerScope;
  readonly buttonId?: string;
  readonly requiresConfirmation?: boolean;
  readonly allowedRoles?: ReadonlyArray<string>;
  readonly continuationStepId?: string;
  readonly continuationTokenRef?: string;
}

export interface WorkflowDraftTemporalTriggerConfig {
  readonly scheduleMode?: WorkflowDraftTemporalScheduleMode;
  readonly runAt?: string;
  readonly cronExpression?: string;
  readonly every?: number;
  readonly unit?: "minutes" | "hours" | "days" | "weeks";
  readonly timezone?: string;
  readonly startAt?: string;
  readonly endAt?: string;
}

export interface WorkflowDraftStateTriggerConfig {
  readonly sourceType?: WorkflowDraftStateEventSourceType;
  readonly eventCategory?: WorkflowDraftStateEventCategory;
  readonly subject?: string;
  readonly eventName?: string;
  readonly asset?: WorkflowDraftAssetReference;
  readonly stateKey?: string;
  readonly stateValue?: string;
  readonly criteria?: Readonly<Record<string, unknown>>;
  readonly filter?: Readonly<Record<string, unknown>>;
}

export interface WorkflowDraftUserTrigger extends WorkflowDraftTriggerBase {
  readonly kind: typeof WorkflowDraftTriggerKinds.user;
  readonly type:
    | typeof WorkflowDraftTriggerTypes.userManual
    | typeof WorkflowDraftTriggerTypes.userButtonClick
    | typeof WorkflowDraftTriggerTypes.userInitiatedRun;
  readonly config: WorkflowDraftUserTriggerConfig;
}

export interface WorkflowDraftTemporalTrigger extends WorkflowDraftTriggerBase {
  readonly kind: typeof WorkflowDraftTriggerKinds.temporal;
  readonly type:
    | typeof WorkflowDraftTriggerTypes.temporalSchedule
    | typeof WorkflowDraftTriggerTypes.temporalRecurring;
  readonly config: WorkflowDraftTemporalTriggerConfig;
}

export interface WorkflowDraftStateTrigger extends WorkflowDraftTriggerBase {
  readonly kind: typeof WorkflowDraftTriggerKinds.state;
  readonly type:
    | typeof WorkflowDraftTriggerTypes.stateDataAvailable
    | typeof WorkflowDraftTriggerTypes.stateAssetStateChanged
    | typeof WorkflowDraftTriggerTypes.stateSystemEvent;
  readonly config: WorkflowDraftStateTriggerConfig;
}

export type WorkflowDraftTrigger = WorkflowDraftUserTrigger | WorkflowDraftTemporalTrigger | WorkflowDraftStateTrigger;

export type WorkflowDraftTriggerConfig =
  | WorkflowDraftUserTriggerConfig
  | WorkflowDraftTemporalTriggerConfig
  | WorkflowDraftStateTriggerConfig;

export interface WorkflowDraftTriggerCapabilityMetadata {
  readonly supportsManualInvocation: boolean;
  readonly supportsTemporalScheduling: boolean;
  readonly supportsStateSubscription: boolean;
  readonly supportsIntermediateContinuation: boolean;
}

export interface WorkflowDraftTriggerDefinition<TConfig extends WorkflowDraftTriggerConfig = WorkflowDraftTriggerConfig> {
  readonly kind: WorkflowDraftTriggerKind;
  readonly type: WorkflowDraftTriggerType;
  readonly label: string;
  readonly description: string;
  readonly configSchemaId: string;
  readonly capabilities: WorkflowDraftTriggerCapabilityMetadata;
  readonly defaultConfig: Readonly<TConfig>;
  readonly validateConfig: (configRecord: Readonly<Record<string, unknown>>) => Readonly<TConfig>;
}

export const WorkflowDraftInputSourceTypes = Object.freeze({
  datasetAsset: "dataset-asset",
  runtimeParameter: "runtime-parameter",
  staticValue: "static-value",
});

export type WorkflowDraftInputSourceType = typeof WorkflowDraftInputSourceTypes[keyof typeof WorkflowDraftInputSourceTypes];

export const WorkflowDraftInputValueTypes = Object.freeze({
  string: "string",
  number: "number",
  boolean: "boolean",
  object: "object",
  array: "array",
  unknown: "unknown",
});

export type WorkflowDraftInputValueType = typeof WorkflowDraftInputValueTypes[keyof typeof WorkflowDraftInputValueTypes];

export interface WorkflowDraftInputBase extends WorkflowDraftSectionItemBase {
  readonly sourceType: WorkflowDraftInputSourceType;
  readonly required?: boolean;
  readonly valueType?: WorkflowDraftInputValueType;
}

export interface WorkflowDraftDatasetInputSelection {
  readonly split?: string;
  readonly query?: string;
  readonly fields?: ReadonlyArray<string>;
  readonly limit?: number;
}

export interface WorkflowDraftDatasetInput extends WorkflowDraftInputBase {
  readonly sourceType: typeof WorkflowDraftInputSourceTypes.datasetAsset;
  readonly asset: WorkflowDraftAssetReference;
  readonly format?: "jsonl" | "json" | "csv" | "parquet";
  readonly selection?: WorkflowDraftDatasetInputSelection;
}

export interface WorkflowDraftRuntimeParameterInput extends WorkflowDraftInputBase {
  readonly sourceType: typeof WorkflowDraftInputSourceTypes.runtimeParameter;
  readonly parameterKey: string;
  readonly defaultValue?: unknown;
}

export interface WorkflowDraftStaticValueInput extends WorkflowDraftInputBase {
  readonly sourceType: typeof WorkflowDraftInputSourceTypes.staticValue;
  readonly value: unknown;
}

export type WorkflowDraftInput = WorkflowDraftDatasetInput | WorkflowDraftRuntimeParameterInput | WorkflowDraftStaticValueInput;

export interface WorkflowDraftSectionItemBase {
  readonly id: string;
  readonly type: string;
  readonly title?: string;
  readonly description?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export const WorkflowDraftOutputTypes = Object.freeze({
  document: "document",
  record: "record",
  media: "media",
});

export type WorkflowDraftOutputType = typeof WorkflowDraftOutputTypes[keyof typeof WorkflowDraftOutputTypes] | (string & {});

export const WorkflowDraftOutputFormats = Object.freeze({
  pdf: "pdf",
  json: "json",
  jsonl: "jsonl",
  csv: "csv",
  markdown: "markdown",
  html: "html",
});

export type WorkflowDraftOutputFormat = typeof WorkflowDraftOutputFormats[keyof typeof WorkflowDraftOutputFormats] | (string & {});

export const WorkflowDraftOutputDestinationTypes = Object.freeze({
  fileExport: "file-export",
  webViewer: "web-viewer",
  systemEntry: "system-entry",
});

export type WorkflowDraftOutputDestinationType = typeof WorkflowDraftOutputDestinationTypes[keyof typeof WorkflowDraftOutputDestinationTypes]
  | (string & {});

export interface WorkflowDraftOutputDestination {
  readonly type: WorkflowDraftOutputDestinationType;
  readonly target: string;
  readonly options?: Readonly<Record<string, unknown>>;
}

export interface WorkflowDraftOutput extends WorkflowDraftSectionItemBase {
  readonly outputType: WorkflowDraftOutputType;
  readonly format: WorkflowDraftOutputFormat;
  readonly destination: WorkflowDraftOutputDestination;
  readonly sourceStepId?: string;
}

export const WorkflowDraftStepKinds = Object.freeze({
  action: "action",
  controlFlow: "control-flow",
  assetBacked: "asset-backed",
});

export type WorkflowDraftStepKind = typeof WorkflowDraftStepKinds[keyof typeof WorkflowDraftStepKinds];

export const WorkflowDraftStepTypes = Object.freeze({
  agentAssistant: "agent-assistant",
});

export type WorkflowDraftStepType = typeof WorkflowDraftStepTypes[keyof typeof WorkflowDraftStepTypes] | (string & {});

export const WorkflowDraftBuiltInStepTypes = Object.freeze({
  ifThen: "if-then",
  loopIteration: "loop-iteration",
  delayWait: "delay-wait",
  manualApproval: "manual-approval",
});

export type WorkflowDraftBuiltInStepType = typeof WorkflowDraftBuiltInStepTypes[keyof typeof WorkflowDraftBuiltInStepTypes];

export const WorkflowDraftBuiltInStepCategories = Object.freeze({
  controlFlow: "control-flow",
  temporal: "temporal",
  humanInteraction: "human-interaction",
  transformation: "transformation",
});

export type WorkflowDraftBuiltInStepCategory =
  typeof WorkflowDraftBuiltInStepCategories[keyof typeof WorkflowDraftBuiltInStepCategories];

export const WorkflowDraftLoopIterationModes = Object.freeze({
  fixedCount: "fixed-count",
  collection: "collection",
  range: "range",
});

export type WorkflowDraftLoopIterationMode = typeof WorkflowDraftLoopIterationModes[keyof typeof WorkflowDraftLoopIterationModes];

export const WorkflowDraftConditionKinds = Object.freeze({
  expression: "expression",
  comparison: "comparison",
});

export type WorkflowDraftConditionKind = typeof WorkflowDraftConditionKinds[keyof typeof WorkflowDraftConditionKinds];

export const WorkflowDraftComparisonOperators = Object.freeze({
  equals: "equals",
  notEquals: "not-equals",
  greaterThan: "greater-than",
  greaterThanOrEqual: "greater-than-or-equal",
  lessThan: "less-than",
  lessThanOrEqual: "less-than-or-equal",
  contains: "contains",
  startsWith: "starts-with",
  endsWith: "ends-with",
  exists: "exists",
  notExists: "not-exists",
});

export type WorkflowDraftComparisonOperator =
  typeof WorkflowDraftComparisonOperators[keyof typeof WorkflowDraftComparisonOperators];

export interface WorkflowDraftComparisonConditionDefinition {
  readonly kind: typeof WorkflowDraftConditionKinds.comparison;
  readonly leftOperand: string;
  readonly operator: WorkflowDraftComparisonOperator;
  readonly rightOperand?: unknown;
}

export interface WorkflowDraftExpressionConditionDefinition {
  readonly kind: typeof WorkflowDraftConditionKinds.expression;
  readonly expression: string;
}

export type WorkflowDraftConditionDefinition =
  | WorkflowDraftExpressionConditionDefinition
  | WorkflowDraftComparisonConditionDefinition;

export interface WorkflowDraftIfThenBranchTarget {
  readonly label?: string;
  readonly stepIds?: ReadonlyArray<string>;
}

export interface WorkflowDraftIfThenStepConfig {
  readonly condition: WorkflowDraftConditionDefinition;
  readonly branches: Readonly<{
    readonly then: WorkflowDraftIfThenBranchTarget;
    readonly else?: WorkflowDraftIfThenBranchTarget;
  }>;
  // Deprecated compatibility aliases retained for existing authoring flows.
  readonly conditionExpression?: string;
  readonly thenLabel?: string;
  readonly elseLabel?: string;
  readonly thenStepIds?: ReadonlyArray<string>;
  readonly elseStepIds?: ReadonlyArray<string>;
}

export interface WorkflowDraftLoopRangeConfig {
  readonly start: number;
  readonly end: number;
  readonly step?: number;
}

export interface WorkflowDraftLoopFixedCountSource {
  readonly count: number;
}

export interface WorkflowDraftLoopCollectionSource {
  readonly inputKey: string;
  readonly itemAlias?: string;
}

export interface WorkflowDraftLoopIterationStepConfig {
  readonly mode: WorkflowDraftLoopIterationMode;
  readonly fixedCount?: WorkflowDraftLoopFixedCountSource;
  readonly collection?: WorkflowDraftLoopCollectionSource;
  readonly range?: WorkflowDraftLoopRangeConfig;
  readonly exitCondition?: WorkflowDraftConditionDefinition;
  readonly loopLabel?: string;
  readonly bodyStepIds?: ReadonlyArray<string>;
  readonly maxIterations?: number;
  // Deprecated compatibility aliases retained for existing authoring flows.
  readonly repeatCount?: number;
  readonly loopConditionExpression?: string;
  readonly iterationMode?: WorkflowDraftLoopIterationMode;
  readonly itemAlias?: string;
  readonly collectionInputKey?: string;
}

export const WorkflowDraftDelayWaitModes = Object.freeze({
  duration: "duration",
  untilTime: "until-time",
});

export type WorkflowDraftDelayWaitMode = typeof WorkflowDraftDelayWaitModes[keyof typeof WorkflowDraftDelayWaitModes];

export const WorkflowDraftDelayWaitDurationUnits = Object.freeze({
  seconds: "seconds",
  minutes: "minutes",
  hours: "hours",
});

export type WorkflowDraftDelayWaitDurationUnit =
  typeof WorkflowDraftDelayWaitDurationUnits[keyof typeof WorkflowDraftDelayWaitDurationUnits];

export interface WorkflowDraftDelayWaitDuration {
  readonly value: number;
  readonly unit: WorkflowDraftDelayWaitDurationUnit;
}

export interface WorkflowDraftDelayWaitUntilTime {
  readonly timestamp: string;
  readonly timezone?: string;
}

export interface WorkflowDraftDelayWaitStepConfig {
  readonly mode: WorkflowDraftDelayWaitMode;
  readonly duration?: WorkflowDraftDelayWaitDuration;
  readonly until?: WorkflowDraftDelayWaitUntilTime;
  readonly note?: string;
  // Deprecated compatibility aliases retained for existing authoring flows.
  readonly durationSeconds?: number;
  readonly waitUntil?: string;
}

export const WorkflowDraftManualInteractionModes = Object.freeze({
  review: "review",
  approval: "approval",
});

export type WorkflowDraftManualInteractionMode =
  typeof WorkflowDraftManualInteractionModes[keyof typeof WorkflowDraftManualInteractionModes];

export interface WorkflowDraftManualInteractionOutcomes {
  readonly continue?: WorkflowDraftIfThenBranchTarget;
  readonly approve?: WorkflowDraftIfThenBranchTarget;
  readonly reject?: WorkflowDraftIfThenBranchTarget;
}

export interface WorkflowDraftManualApprovalStepConfig {
  readonly prompt: string;
  readonly interactionMode: WorkflowDraftManualInteractionMode;
  readonly outcomes: WorkflowDraftManualInteractionOutcomes;
  readonly requiredApproverRoles?: ReadonlyArray<string>;
  readonly timeoutSeconds?: number;
  readonly onTimeout?: "reject" | "continue" | "escalate";
  readonly allowSelfApproval?: boolean;
  // Deprecated compatibility alias retained for existing authoring flows.
  readonly approvalMessage?: string;
}

export type WorkflowDraftBuiltInStepConfig =
  | WorkflowDraftIfThenStepConfig
  | WorkflowDraftLoopIterationStepConfig
  | WorkflowDraftDelayWaitStepConfig
  | WorkflowDraftManualApprovalStepConfig;

export interface WorkflowDraftBuiltInStepDefinition<TConfig extends WorkflowDraftBuiltInStepConfig = WorkflowDraftBuiltInStepConfig> {
  readonly type: WorkflowDraftBuiltInStepType;
  readonly category: WorkflowDraftBuiltInStepCategory;
  readonly label: string;
  readonly description: string;
  readonly configSchemaId: string;
  readonly defaultConfig: Readonly<TConfig>;
  readonly validateConfig: (configRecord: Readonly<Record<string, unknown>>) => Readonly<TConfig>;
}

export const WorkflowDraftStepAssetKinds = Object.freeze({
  agentAssistant: "agent-assistant",
});

export type WorkflowDraftStepAssetKind = typeof WorkflowDraftStepAssetKinds[keyof typeof WorkflowDraftStepAssetKinds] | (string & {});

export interface WorkflowDraftStepAssetReference {
  readonly assetKind: WorkflowDraftStepAssetKind;
  readonly asset: WorkflowDraftAssetReference;
}

export interface WorkflowDraftStep extends WorkflowDraftSectionItemBase {
  readonly order: number;
  readonly kind?: WorkflowDraftStepKind;
  readonly dependsOnStepIds?: ReadonlyArray<string>;
  readonly config?: Readonly<Record<string, unknown>>;
  readonly assetRef?: WorkflowDraftStepAssetReference;
}

export interface WorkflowDraftBuiltInStep extends WorkflowDraftStep {
  readonly kind: typeof WorkflowDraftStepKinds.controlFlow;
  readonly type: WorkflowDraftBuiltInStepType;
  readonly config: WorkflowDraftBuiltInStepConfig;
}

export interface WorkflowDraft {
  readonly triggers: ReadonlyArray<WorkflowDraftTrigger>;
  readonly inputs: ReadonlyArray<WorkflowDraftInput>;
  readonly steps: ReadonlyArray<WorkflowDraftStep>;
  readonly outputs: ReadonlyArray<WorkflowDraftOutput>;
}

export interface WorkflowEntity {
  readonly id: string;
  readonly name: string;
  readonly metadata: WorkflowEntityMetadata;
  readonly draft: WorkflowDraft;
  readonly lifecycleState: WorkflowLifecycleState;
  readonly draftRevision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WorkflowDraftPersistenceRecord {
  readonly triggers: ReadonlyArray<WorkflowDraftTrigger>;
  readonly inputs: ReadonlyArray<WorkflowDraftInput>;
  readonly steps: ReadonlyArray<WorkflowDraftStep>;
  readonly outputs: ReadonlyArray<WorkflowDraftOutput>;
}

export interface WorkflowEntityPersistenceRecord {
  readonly id: string;
  readonly name: string;
  readonly metadata: WorkflowEntityMetadata;
  readonly draft: WorkflowDraftPersistenceRecord;
  readonly lifecycleState: WorkflowLifecycleState;
  readonly draftRevision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WorkflowDraftSerializedDocument {
  readonly schemaVersion: "ai-loom.workflow-draft.v1";
  readonly draft: WorkflowDraftPersistenceRecord;
}

export interface WorkflowEntitySerializedDocument {
  readonly schemaVersion: "ai-loom.workflow-entity.v1";
  readonly entity: WorkflowEntityPersistenceRecord;
}

export const WorkflowLifecycleStates = Object.freeze({
  draft: "draft",
  saved: "saved",
  executable: "executable",
});

export type WorkflowLifecycleState = typeof WorkflowLifecycleStates[keyof typeof WorkflowLifecycleStates];

export class WorkflowLifecycleTransitionError extends Error {
  constructor(fromState: WorkflowLifecycleState, toState: WorkflowLifecycleState, detail?: string) {
    super(detail
      ? `Workflow lifecycle cannot transition from '${fromState}' to '${toState}': ${detail}.`
      : `Workflow lifecycle cannot transition from '${fromState}' to '${toState}'.`);
    this.name = "WorkflowLifecycleTransitionError";
  }
}

export const WorkflowValidationSections = Object.freeze({
  entity: "entity",
  draft: "draft",
  triggers: "triggers",
  inputs: "inputs",
  steps: "steps",
  outputs: "outputs",
  crossSection: "cross-section",
  lifecycle: "lifecycle",
});

export type WorkflowValidationSection = typeof WorkflowValidationSections[keyof typeof WorkflowValidationSections];

export const WorkflowValidationIssueCodes = Object.freeze({
  entityIdMissing: "entity-id-missing",
  entityNameMissing: "entity-name-missing",
  entityDraftRevisionInvalid: "entity-draft-revision-invalid",
  entityCreatedAtInvalid: "entity-created-at-invalid",
  entityUpdatedAtInvalid: "entity-updated-at-invalid",
  lifecycleStateInvalid: "lifecycle-state-invalid",
  lifecycleExecutableNotReady: "lifecycle-executable-not-ready",
  draftMalformed: "draft-malformed",
  draftSectionMissing: "draft-section-missing",
  triggerCollectionEmpty: "trigger-collection-empty",
  triggerMalformed: "trigger-malformed",
  triggerDuplicateId: "trigger-duplicate-id",
  triggerDuplicateDefinition: "trigger-duplicate-definition",
  triggerContinuationStepMissing: "trigger-continuation-step-missing",
  triggerScopeUnsupported: "trigger-scope-unsupported",
  inputMalformed: "input-malformed",
  inputDatasetAssetMalformed: "input-dataset-asset-malformed",
  inputDatasetAssetTaxonomyMismatch: "input-dataset-asset-taxonomy-mismatch",
  stepMalformed: "step-malformed",
  stepAssetReferenceMalformed: "step-asset-reference-malformed",
  stepAssetTaxonomyMismatch: "step-asset-taxonomy-mismatch",
  stepOrderNonContiguous: "step-order-non-contiguous",
  stepDependencyMissing: "step-dependency-missing",
  stepDependencySelf: "step-dependency-self",
  stepDependencyCycle: "step-dependency-cycle",
  builtInStepReferenceMissing: "built-in-step-reference-missing",
  builtInStepReferenceSelf: "built-in-step-reference-self",
  builtInStepReferenceOrderInvalid: "built-in-step-reference-order-invalid",
  loopCollectionInputMissing: "loop-collection-input-missing",
  outputMalformed: "output-malformed",
  outputSourceStepMissing: "output-source-step-missing",
  outputFileFormatInvalid: "output-file-format-invalid",
  outputViewerTitleMissing: "output-viewer-title-missing",
  outputSystemEntityMissing: "output-system-entity-missing",
});

export type WorkflowValidationIssueCode = typeof WorkflowValidationIssueCodes[keyof typeof WorkflowValidationIssueCodes];

export interface WorkflowValidationIssue {
  readonly code: WorkflowValidationIssueCode;
  readonly section: WorkflowValidationSection;
  readonly severity: "error" | "warning";
  readonly message: string;
  readonly path?: string;
}

export interface WorkflowValidationResult {
  readonly valid: boolean;
  readonly issues: ReadonlyArray<WorkflowValidationIssue>;
}

export const WorkflowDraftAssetReferenceKinds = Object.freeze({
  datasetInput: "dataset-input",
  agentAssistantStep: "agent-assistant-step",
});

export type WorkflowDraftAssetReferenceKind =
  typeof WorkflowDraftAssetReferenceKinds[keyof typeof WorkflowDraftAssetReferenceKinds];

export interface WorkflowDraftAssetReferenceClassification {
  readonly kind: WorkflowDraftAssetReferenceKind;
  readonly path: string;
  readonly asset: WorkflowDraftAssetReference;
  readonly expectedTaxonomy: CompositionTaxonomyDescriptor;
  readonly taxonomyMatched: boolean;
}

const WorkflowDraftAssetReferenceTaxonomyExpectations = Object.freeze({
  [WorkflowDraftAssetReferenceKinds.datasetInput]: createCompositionTaxonomyDescriptor({
    structuralKind: TaxonomyStructuralKinds.atomic,
    semanticRole: TaxonomySemanticRoles.dataset,
    behaviorKind: TaxonomyBehaviorKinds.none,
  }),
  [WorkflowDraftAssetReferenceKinds.agentAssistantStep]: createCompositionTaxonomyDescriptor({
    structuralKind: TaxonomyStructuralKinds.composite,
    semanticRole: TaxonomySemanticRoles.agent,
    behaviorKind: TaxonomyBehaviorKinds.autonomous,
  }),
});

const WorkflowDraftDocumentSchemaVersion = "ai-loom.workflow-draft.v1";
const WorkflowEntityDocumentSchemaVersion = "ai-loom.workflow-entity.v1";

function normalizeRequired(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} is required.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  return normalized;
}

function normalizeOptional(value?: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error("Optional string value must be a string when provided.");
  }
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function normalizeOptionalBoolean(value: unknown, label: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean when provided.`);
  }
  return value;
}

function normalizePositiveInteger(value: unknown, label: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer when provided.`);
  }
  return value;
}

function normalizeTags(tags?: ReadonlyArray<string>): ReadonlyArray<string> {
  const deduped = new Set<string>();
  for (const tag of tags ?? []) {
    const normalized = tag.trim();
    if (normalized) {
      deduped.add(normalized);
    }
  }

  return Object.freeze([...deduped.values()]);
}

function cloneRecord<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stableStringify(value: unknown): string {
  const normalize = (entry: unknown): unknown => {
    if (Array.isArray(entry)) {
      return entry.map((item) => normalize(item));
    }
    if (entry && typeof entry === "object") {
      const record = entry as Record<string, unknown>;
      const normalized: Record<string, unknown> = {};
      for (const key of Object.keys(record).sort((left, right) => left.localeCompare(right))) {
        normalized[key] = normalize(record[key]);
      }
      return normalized;
    }
    return entry;
  };

  return JSON.stringify(normalize(value), null, 2);
}

function taxonomyToLabel(taxonomy: CompositionTaxonomyDescriptor): string {
  return `${taxonomy.structuralKind}/${taxonomy.semanticRole}/${taxonomy.behaviorKind}`;
}

function taxonomyEquals(
  left: CompositionTaxonomyDescriptor | undefined,
  right: CompositionTaxonomyDescriptor,
): boolean {
  return Boolean(left)
    && left.structuralKind === right.structuralKind
    && left.semanticRole === right.semanticRole
    && left.behaviorKind === right.behaviorKind;
}

function assertRecord(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value as Readonly<Record<string, unknown>>;
}

function normalizeStringArray(values: unknown, label: string): ReadonlyArray<string> | undefined {
  if (values === undefined) {
    return undefined;
  }
  if (!Array.isArray(values)) {
    throw new Error(`${label} must be an array when provided.`);
  }

  const deduped = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string") {
      throw new Error(`${label} entries must be strings.`);
    }
    const normalized = value.trim();
    if (normalized) {
      deduped.add(normalized);
    }
  }

  return deduped.size > 0 ? Object.freeze([...deduped.values()]) : undefined;
}

function normalizeRequiredStringArray(values: unknown, label: string): ReadonlyArray<string> {
  const normalized = normalizeStringArray(values, label);
  if (!normalized || normalized.length === 0) {
    throw new Error(`${label} must include at least one value.`);
  }

  return normalized;
}

function normalizeTriggerKind(value: string): WorkflowDraftTriggerKind {
  if (value === WorkflowDraftTriggerKinds.user || value === WorkflowDraftTriggerKinds.temporal || value === WorkflowDraftTriggerKinds.state) {
    return value;
  }
  throw new Error(`Workflow draft trigger kind '${value}' is not supported.`);
}

function normalizeUserTriggerScope(value: unknown): WorkflowDraftUserTriggerScope {
  const normalized = normalizeOptional(typeof value === "string" ? value : undefined);
  if (!normalized) {
    return WorkflowDraftUserTriggerScopes.workflowStart;
  }
  if (
    normalized === WorkflowDraftUserTriggerScopes.workflowStart
    || normalized === WorkflowDraftUserTriggerScopes.workflowContinuation
  ) {
    return normalized;
  }
  throw new Error(`Workflow draft user trigger config.invocationScope '${normalized}' is not supported.`);
}

function normalizeTemporalScheduleMode(value: unknown): WorkflowDraftTemporalScheduleMode | undefined {
  const normalized = normalizeOptional(typeof value === "string" ? value : undefined);
  if (!normalized) {
    return undefined;
  }
  if (
    normalized === WorkflowDraftTemporalScheduleModes.oneTime
    || normalized === WorkflowDraftTemporalScheduleModes.cron
    || normalized === WorkflowDraftTemporalScheduleModes.interval
  ) {
    return normalized;
  }
  throw new Error(`Workflow draft temporal trigger config.scheduleMode '${normalized}' is not supported.`);
}

function normalizeStateEventSourceType(value: unknown): WorkflowDraftStateEventSourceType | undefined {
  const normalized = normalizeOptional(typeof value === "string" ? value : undefined);
  if (!normalized) {
    return undefined;
  }
  if (
    normalized === WorkflowDraftStateEventSourceTypes.dataset
    || normalized === WorkflowDraftStateEventSourceTypes.asset
    || normalized === WorkflowDraftStateEventSourceTypes.system
  ) {
    return normalized;
  }
  throw new Error(`Workflow draft state trigger config.sourceType '${normalized}' is not supported.`);
}

function normalizeStateEventCategory(value: unknown): WorkflowDraftStateEventCategory | undefined {
  const normalized = normalizeOptional(typeof value === "string" ? value : undefined);
  if (!normalized) {
    return undefined;
  }
  if (
    normalized === WorkflowDraftStateEventCategories.dataIngested
    || normalized === WorkflowDraftStateEventCategories.assetUpdated
    || normalized === WorkflowDraftStateEventCategories.systemStateChanged
  ) {
    return normalized;
  }
  throw new Error(`Workflow draft state trigger config.eventCategory '${normalized}' is not supported.`);
}

function isLikelyCronExpression(value: string): boolean {
  const fields = value.trim().split(/\s+/);
  if (fields.length !== 5) {
    return false;
  }
  return fields.every((field) => field.length > 0 && !field.includes(" "));
}

function normalizeWorkflowDraftAssetReference(
  reference: WorkflowDraftAssetReference,
  label: string,
  expectedTaxonomy?: CompositionTaxonomyDescriptor,
): WorkflowDraftAssetReference {
  const assetId = normalizeRequired(reference.assetId, `${label} asset id`);
  const versionId = normalizeOptional(reference.versionId);
  const taxonomy = reference.taxonomy
    ? createCompositionTaxonomyDescriptor(reference.taxonomy)
    : expectedTaxonomy;
  if (taxonomy) {
    assertAllowedCompositionTaxonomyCombination(taxonomy, `${label} taxonomy`);
  }
  if (expectedTaxonomy && taxonomy && !taxonomyEquals(taxonomy, expectedTaxonomy)) {
    throw new Error(
      `${label} taxonomy '${taxonomyToLabel(taxonomy)}' must match expected taxonomy ` +
      `'${taxonomyToLabel(expectedTaxonomy)}'.`,
    );
  }

  return Object.freeze({ assetId, versionId, taxonomy });
}

function normalizeUserTriggerConfig(
  triggerType: WorkflowDraftUserTrigger["type"],
  configRecord: Readonly<Record<string, unknown>>,
): WorkflowDraftUserTriggerConfig {
  if (
    triggerType !== WorkflowDraftTriggerTypes.userManual
    && triggerType !== WorkflowDraftTriggerTypes.userButtonClick
    && triggerType !== WorkflowDraftTriggerTypes.userInitiatedRun
  ) {
    throw new Error(`Workflow draft trigger type '${triggerType}' is not valid for kind '${WorkflowDraftTriggerKinds.user}'.`);
  }

  const buttonId = normalizeOptional(typeof configRecord.buttonId === "string" ? configRecord.buttonId : undefined);
  if (triggerType === WorkflowDraftTriggerTypes.userButtonClick && !buttonId) {
    throw new Error("Workflow draft user button-click trigger requires config.buttonId.");
  }

  const invocationScope = normalizeUserTriggerScope(configRecord.invocationScope);
  const continuationStepId = normalizeOptional(
    typeof configRecord.continuationStepId === "string" ? configRecord.continuationStepId : undefined,
  );
  const continuationTokenRef = normalizeOptional(
    typeof configRecord.continuationTokenRef === "string" ? configRecord.continuationTokenRef : undefined,
  );
  if (invocationScope !== WorkflowDraftUserTriggerScopes.workflowContinuation && (continuationStepId || continuationTokenRef)) {
    throw new Error(
      "Workflow draft user trigger continuation fields require config.invocationScope to be 'workflow-continuation'.",
    );
  }

  return Object.freeze({
    invocationScope,
    buttonId,
    requiresConfirmation: normalizeOptionalBoolean(configRecord.requiresConfirmation, "Workflow draft user trigger config.requiresConfirmation"),
    allowedRoles: normalizeStringArray(configRecord.allowedRoles, "Workflow draft user trigger config.allowedRoles"),
    continuationStepId,
    continuationTokenRef,
  });
}

function normalizeTemporalTriggerConfig(
  triggerType: WorkflowDraftTemporalTrigger["type"],
  configRecord: Readonly<Record<string, unknown>>,
): WorkflowDraftTemporalTriggerConfig {
  if (
    triggerType !== WorkflowDraftTriggerTypes.temporalSchedule
    && triggerType !== WorkflowDraftTriggerTypes.temporalRecurring
  ) {
    throw new Error(`Workflow draft trigger type '${triggerType}' is not valid for kind '${WorkflowDraftTriggerKinds.temporal}'.`);
  }

  const scheduleMode = normalizeTemporalScheduleMode(configRecord.scheduleMode);
  const runAt = normalizeOptional(typeof configRecord.runAt === "string" ? configRecord.runAt : undefined);
  if (runAt && !isValidTimestamp(runAt)) {
    throw new Error("Workflow draft temporal trigger config.runAt must be a valid timestamp when provided.");
  }

  const cronExpression = normalizeOptional(typeof configRecord.cronExpression === "string" ? configRecord.cronExpression : undefined);
  if (cronExpression && !isLikelyCronExpression(cronExpression)) {
    throw new Error("Workflow draft temporal trigger config.cronExpression must be a valid five-field cron expression.");
  }
  const every = normalizePositiveInteger(configRecord.every, "Workflow draft temporal trigger config.every");
  const unit = normalizeOptional(typeof configRecord.unit === "string" ? configRecord.unit : undefined);
  const normalizedUnit = unit && ["minutes", "hours", "days", "weeks"].includes(unit)
    ? unit as WorkflowDraftTemporalTriggerConfig["unit"]
    : undefined;
  if (unit && !normalizedUnit) {
    throw new Error(`Workflow draft temporal trigger config.unit '${unit}' is not supported.`);
  }

  const startAt = normalizeOptional(typeof configRecord.startAt === "string" ? configRecord.startAt : undefined);
  const endAt = normalizeOptional(typeof configRecord.endAt === "string" ? configRecord.endAt : undefined);
  if (startAt && !isValidTimestamp(startAt)) {
    throw new Error("Workflow draft temporal trigger config.startAt must be a valid timestamp when provided.");
  }
  if (endAt && !isValidTimestamp(endAt)) {
    throw new Error("Workflow draft temporal trigger config.endAt must be a valid timestamp when provided.");
  }
  if (startAt && endAt && Date.parse(startAt) > Date.parse(endAt)) {
    throw new Error("Workflow draft temporal trigger config.startAt must be before config.endAt when both are provided.");
  }

  if (triggerType === WorkflowDraftTriggerTypes.temporalSchedule && !cronExpression && !runAt) {
    throw new Error("Workflow draft temporal schedule trigger requires config.cronExpression or config.runAt.");
  }
  if (triggerType === WorkflowDraftTriggerTypes.temporalSchedule && cronExpression && runAt) {
    throw new Error("Workflow draft temporal schedule trigger cannot define both config.cronExpression and config.runAt.");
  }
  if (triggerType === WorkflowDraftTriggerTypes.temporalRecurring && (!every || !normalizedUnit || runAt)) {
    throw new Error("Workflow draft temporal recurring trigger requires config.every and config.unit.");
  }

  return Object.freeze({
    scheduleMode,
    runAt,
    cronExpression,
    every,
    unit: normalizedUnit,
    timezone: normalizeOptional(typeof configRecord.timezone === "string" ? configRecord.timezone : undefined),
    startAt,
    endAt,
  });
}

function normalizeStateTriggerConfig(
  triggerType: WorkflowDraftStateTrigger["type"],
  configRecord: Readonly<Record<string, unknown>>,
): WorkflowDraftStateTriggerConfig {
  if (
    triggerType !== WorkflowDraftTriggerTypes.stateDataAvailable
    && triggerType !== WorkflowDraftTriggerTypes.stateAssetStateChanged
    && triggerType !== WorkflowDraftTriggerTypes.stateSystemEvent
  ) {
    throw new Error(`Workflow draft trigger type '${triggerType}' is not valid for kind '${WorkflowDraftTriggerKinds.state}'.`);
  }

  const eventName = normalizeOptional(typeof configRecord.eventName === "string" ? configRecord.eventName : undefined);
  const subject = normalizeOptional(typeof configRecord.subject === "string" ? configRecord.subject : undefined);
  const stateKey = normalizeOptional(typeof configRecord.stateKey === "string" ? configRecord.stateKey : undefined);
  const stateValue = normalizeOptional(typeof configRecord.stateValue === "string" ? configRecord.stateValue : undefined);
  const filterRecord = configRecord.filter
    ? assertRecord(configRecord.filter, "Workflow draft state trigger config.filter")
    : undefined;
  const criteriaRecord = configRecord.criteria
    ? assertRecord(configRecord.criteria, "Workflow draft state trigger config.criteria")
    : filterRecord;
  const criteria = criteriaRecord ? Object.freeze({ ...criteriaRecord }) : undefined;
  const sourceType = normalizeStateEventSourceType(configRecord.sourceType)
    ?? (triggerType === WorkflowDraftTriggerTypes.stateAssetStateChanged
      ? WorkflowDraftStateEventSourceTypes.asset
      : (triggerType === WorkflowDraftTriggerTypes.stateSystemEvent
        ? WorkflowDraftStateEventSourceTypes.system
        : WorkflowDraftStateEventSourceTypes.dataset));
  const eventCategory = normalizeStateEventCategory(configRecord.eventCategory)
    ?? (triggerType === WorkflowDraftTriggerTypes.stateAssetStateChanged
      ? WorkflowDraftStateEventCategories.assetUpdated
      : (triggerType === WorkflowDraftTriggerTypes.stateSystemEvent
        ? WorkflowDraftStateEventCategories.systemStateChanged
        : WorkflowDraftStateEventCategories.dataIngested));
  const assetRecord = configRecord.asset
    ? normalizeWorkflowDraftAssetReference(
      assertRecord(configRecord.asset, "Workflow draft state trigger config.asset") as WorkflowDraftAssetReference,
      "Workflow draft state trigger config.asset",
    )
    : undefined;

  if (triggerType === WorkflowDraftTriggerTypes.stateAssetStateChanged && !assetRecord) {
    throw new Error("Workflow draft state asset-state-changed trigger requires config.asset.");
  }
  if (triggerType === WorkflowDraftTriggerTypes.stateSystemEvent && !eventName) {
    throw new Error("Workflow draft state system-event trigger requires config.eventName.");
  }
  if (triggerType === WorkflowDraftTriggerTypes.stateDataAvailable && !eventName && !subject && !stateKey) {
    throw new Error(
      "Workflow draft state data-available trigger requires config.eventName, config.subject, or config.stateKey.",
    );
  }
  if (sourceType === WorkflowDraftStateEventSourceTypes.asset && !assetRecord) {
    throw new Error("Workflow draft state trigger config.sourceType 'asset' requires config.asset.");
  }

  return Object.freeze({
    sourceType,
    eventCategory,
    subject,
    eventName,
    asset: assetRecord,
    stateKey,
    stateValue,
    criteria,
    filter: criteria,
  });
}

function normalizeUserTrigger(
  item: WorkflowDraftSectionItemBase,
  trigger: WorkflowDraftTrigger,
): WorkflowDraftUserTrigger {
  const triggerType = trigger.type as WorkflowDraftUserTrigger["type"];
  const configRecord = assertRecord(trigger.config ?? {}, "Workflow draft trigger config");

  return Object.freeze({
    ...item,
    kind: WorkflowDraftTriggerKinds.user,
    type: triggerType,
    config: normalizeUserTriggerConfig(triggerType, configRecord),
  });
}

function normalizeTemporalTrigger(
  item: WorkflowDraftSectionItemBase,
  trigger: WorkflowDraftTrigger,
): WorkflowDraftTemporalTrigger {
  const triggerType = trigger.type as WorkflowDraftTemporalTrigger["type"];
  const configRecord = assertRecord(trigger.config ?? {}, "Workflow draft trigger config");

  return Object.freeze({
    ...item,
    kind: WorkflowDraftTriggerKinds.temporal,
    type: triggerType,
    config: normalizeTemporalTriggerConfig(triggerType, configRecord),
  });
}

function normalizeStateTrigger(
  item: WorkflowDraftSectionItemBase,
  trigger: WorkflowDraftTrigger,
): WorkflowDraftStateTrigger {
  const triggerType = trigger.type as WorkflowDraftStateTrigger["type"];
  const configRecord = assertRecord(trigger.config ?? {}, "Workflow draft trigger config");

  return Object.freeze({
    ...item,
    kind: WorkflowDraftTriggerKinds.state,
    type: triggerType,
    config: normalizeStateTriggerConfig(triggerType, configRecord),
  });
}

function normalizeTrigger(trigger: WorkflowDraftTrigger): WorkflowDraftTrigger {
  const item = normalizeSectionItem(trigger, "Workflow draft trigger");
  const kind = normalizeTriggerKind(normalizeRequired(trigger.kind, "Workflow draft trigger kind"));

  switch (kind) {
    case WorkflowDraftTriggerKinds.user:
      return normalizeUserTrigger(item, trigger);
    case WorkflowDraftTriggerKinds.temporal:
      return normalizeTemporalTrigger(item, trigger);
    case WorkflowDraftTriggerKinds.state:
      return normalizeStateTrigger(item, trigger);
    default:
      throw new Error(`Workflow draft trigger kind '${kind}' is not supported.`);
  }
}

function normalizeInputSourceType(value: string): WorkflowDraftInputSourceType {
  if (
    value === WorkflowDraftInputSourceTypes.datasetAsset
    || value === WorkflowDraftInputSourceTypes.runtimeParameter
    || value === WorkflowDraftInputSourceTypes.staticValue
  ) {
    return value;
  }
  throw new Error(`Workflow draft input source type '${value}' is not supported.`);
}

function normalizeInputValueType(value?: string): WorkflowDraftInputValueType | undefined {
  if (!value) {
    return undefined;
  }
  if (
    value === WorkflowDraftInputValueTypes.string
    || value === WorkflowDraftInputValueTypes.number
    || value === WorkflowDraftInputValueTypes.boolean
    || value === WorkflowDraftInputValueTypes.object
    || value === WorkflowDraftInputValueTypes.array
    || value === WorkflowDraftInputValueTypes.unknown
  ) {
    return value;
  }
  throw new Error(`Workflow draft input value type '${value}' is not supported.`);
}

function normalizeInput(input: WorkflowDraftInput): WorkflowDraftInput {
  const item = normalizeSectionItem(input, "Workflow draft input");
  const sourceType = normalizeInputSourceType(normalizeRequired(input.sourceType, "Workflow draft input source type"));
  const required = normalizeOptionalBoolean(input.required, "Workflow draft input required");
  const valueType = normalizeInputValueType(normalizeOptional(input.valueType));

  if (sourceType === WorkflowDraftInputSourceTypes.datasetAsset) {
    const datasetInput = input as WorkflowDraftDatasetInput;
    if (!datasetInput.asset) {
      throw new Error("Workflow draft dataset input requires asset.");
    }
    const asset = normalizeWorkflowDraftAssetReference(
      datasetInput.asset,
      "Workflow draft dataset input asset",
      WorkflowDraftAssetReferenceTaxonomyExpectations[WorkflowDraftAssetReferenceKinds.datasetInput],
    );
    const selectionRecord = datasetInput.selection
      ? assertRecord(datasetInput.selection, "Workflow draft dataset input selection")
      : undefined;
    const fields = selectionRecord ? normalizeStringArray(selectionRecord.fields, "Workflow draft dataset input selection.fields") : undefined;
    const format = normalizeOptional(datasetInput.format);
    if (format && !["jsonl", "json", "csv", "parquet"].includes(format)) {
      throw new Error(`Workflow draft dataset input format '${format}' is not supported.`);
    }

    return Object.freeze({
      ...item,
      sourceType,
      required,
      valueType,
      asset,
      format: format as WorkflowDraftDatasetInput["format"] | undefined,
      selection: selectionRecord
        ? Object.freeze({
          split: normalizeOptional(typeof selectionRecord.split === "string" ? selectionRecord.split : undefined),
          query: normalizeOptional(typeof selectionRecord.query === "string" ? selectionRecord.query : undefined),
          fields,
          limit: normalizePositiveInteger(selectionRecord.limit, "Workflow draft dataset input selection.limit"),
        })
        : undefined,
    });
  }

  if (sourceType === WorkflowDraftInputSourceTypes.runtimeParameter) {
    const runtimeInput = input as WorkflowDraftRuntimeParameterInput;
    return Object.freeze({
      ...item,
      sourceType,
      required,
      valueType,
      parameterKey: normalizeRequired(runtimeInput.parameterKey, "Workflow draft runtime-parameter input parameterKey"),
      defaultValue: runtimeInput.defaultValue,
    });
  }

  const staticInput = input as WorkflowDraftStaticValueInput;
  if (!Object.prototype.hasOwnProperty.call(staticInput, "value")) {
    throw new Error("Workflow draft static-value input requires value.");
  }
  return Object.freeze({
    ...item,
    sourceType,
    required,
    valueType,
    value: staticInput.value,
  });
}

function normalizeSectionItem<T extends WorkflowDraftSectionItemBase>(
  item: T,
  sectionName: string,
): T {
  const id = normalizeRequired(item.id, `${sectionName} item id`);
  const type = normalizeRequired(item.type, `${sectionName} item type`);
  const title = normalizeOptional(item.title);
  const description = normalizeOptional(item.description);
  const metadata = item.metadata ? Object.freeze({ ...assertRecord(item.metadata, `${sectionName} item metadata`) }) : undefined;

  return Object.freeze({
    ...item,
    id,
    type,
    title,
    description,
    metadata,
  });
}

function normalizeStep(step: WorkflowDraftStep): WorkflowDraftStep {
  const normalizedStep = normalizeSectionItem(step, "Workflow draft step");
  const kind = normalizeStepKind(step);

  if (!Number.isInteger(normalizedStep.order) || normalizedStep.order < 1) {
    throw new Error("Workflow draft step order must be a positive integer.");
  }

  const dedupedDependencies = new Set<string>();
  for (const dependency of normalizedStep.dependsOnStepIds ?? []) {
    const normalized = dependency.trim();
    if (normalized) {
      dedupedDependencies.add(normalized);
    }
  }

  const config = normalizeStepConfig(normalizedStep, kind);
  const assetRef = step.assetRef
    ? normalizeWorkflowDraftStepAssetReference(step.assetRef)
    : undefined;
  if (kind === WorkflowDraftStepKinds.assetBacked && !assetRef) {
    throw new Error("Workflow draft asset-backed step requires assetRef.");
  }
  if (kind !== WorkflowDraftStepKinds.assetBacked && assetRef) {
    throw new Error("Workflow draft step assetRef is only supported for kind 'asset-backed'.");
  }
  if (assetRef?.assetKind === WorkflowDraftStepAssetKinds.agentAssistant && normalizedStep.type !== WorkflowDraftStepTypes.agentAssistant) {
    throw new Error(
      "Workflow draft asset-backed agent-assistant step requires type 'agent-assistant'.",
    );
  }
  if (kind !== WorkflowDraftStepKinds.controlFlow && isBuiltInControlFlowStepType(normalizedStep.type)) {
    throw new Error(
      `Workflow draft built-in step type '${normalizedStep.type}' requires kind '${WorkflowDraftStepKinds.controlFlow}'.`,
    );
  }

  return Object.freeze({
    ...normalizedStep,
    kind,
    dependsOnStepIds: dedupedDependencies.size > 0
      ? Object.freeze([...dedupedDependencies.values()])
      : undefined,
    config,
    assetRef,
  });
}

function normalizeStepConfig(
  step: WorkflowDraftStep,
  kind: WorkflowDraftStepKind,
): Readonly<Record<string, unknown>> | undefined {
  const configRecord = step.config
    ? assertRecord(step.config, "Workflow draft step config")
    : undefined;

  if (kind !== WorkflowDraftStepKinds.controlFlow) {
    return configRecord ? Object.freeze({ ...configRecord }) : undefined;
  }

  if (!isBuiltInControlFlowStepType(step.type)) {
    return configRecord ? Object.freeze({ ...configRecord }) : undefined;
  }

  if (!configRecord) {
    throw new Error(`Workflow draft built-in control-flow step '${step.type}' requires config.`);
  }

  const normalizedBuiltInConfig = normalizeWorkflowDraftBuiltInStepConfig(step.type, configRecord);
  return Object.freeze({ ...normalizedBuiltInConfig });
}

function isBuiltInControlFlowStepType(value: string): value is WorkflowDraftBuiltInStepType {
  return isWorkflowDraftBuiltInStepType(value);
}

function normalizeConditionDefinition(
  raw: unknown,
  label: string,
): Readonly<WorkflowDraftConditionDefinition> {
  const record = assertRecord(raw, label);
  const kind = normalizeRequired(
    typeof record.kind === "string" ? record.kind : "",
    `${label}.kind`,
  );

  if (kind === WorkflowDraftConditionKinds.expression) {
    const expression = normalizeRequired(
      typeof record.expression === "string" ? record.expression : "",
      `${label}.expression`,
    );
    return Object.freeze({
      kind: WorkflowDraftConditionKinds.expression,
      expression,
    });
  }

  if (kind === WorkflowDraftConditionKinds.comparison) {
    const leftOperand = normalizeRequired(
      typeof record.leftOperand === "string" ? record.leftOperand : "",
      `${label}.leftOperand`,
    );
    const operator = normalizeRequired(
      typeof record.operator === "string" ? record.operator : "",
      `${label}.operator`,
    );
    if (
      operator !== WorkflowDraftComparisonOperators.equals
      && operator !== WorkflowDraftComparisonOperators.notEquals
      && operator !== WorkflowDraftComparisonOperators.greaterThan
      && operator !== WorkflowDraftComparisonOperators.greaterThanOrEqual
      && operator !== WorkflowDraftComparisonOperators.lessThan
      && operator !== WorkflowDraftComparisonOperators.lessThanOrEqual
      && operator !== WorkflowDraftComparisonOperators.contains
      && operator !== WorkflowDraftComparisonOperators.startsWith
      && operator !== WorkflowDraftComparisonOperators.endsWith
      && operator !== WorkflowDraftComparisonOperators.exists
      && operator !== WorkflowDraftComparisonOperators.notExists
    ) {
      throw new Error(`${label}.operator '${operator}' is not supported.`);
    }
    const rightOperand = record.rightOperand;
    if (
      rightOperand === undefined
      && operator !== WorkflowDraftComparisonOperators.exists
      && operator !== WorkflowDraftComparisonOperators.notExists
    ) {
      throw new Error(`${label}.rightOperand is required for operator '${operator}'.`);
    }
    return Object.freeze({
      kind: WorkflowDraftConditionKinds.comparison,
      leftOperand,
      operator: operator as WorkflowDraftComparisonOperator,
      rightOperand,
    });
  }

  throw new Error(`${label}.kind '${kind}' is not supported.`);
}

function normalizeIfThenBranchTarget(
  raw: unknown,
  label: string,
): Readonly<WorkflowDraftIfThenBranchTarget> {
  const record = assertRecord(raw, label);
  const branchLabel = normalizeOptional(typeof record.label === "string" ? record.label : undefined);
  const stepIds = normalizeStringArray(record.stepIds, `${label}.stepIds`);
  if (!branchLabel && !stepIds) {
    throw new Error(`${label} requires label or stepIds.`);
  }
  return Object.freeze({
    label: branchLabel,
    stepIds,
  });
}

function normalizeIfThenStepConfig(configRecord: Readonly<Record<string, unknown>>): Readonly<WorkflowDraftIfThenStepConfig> {
  const condition = configRecord.condition
    ? normalizeConditionDefinition(configRecord.condition, "Workflow draft if-then step config.condition")
    : Object.freeze({
      kind: WorkflowDraftConditionKinds.expression,
      expression: normalizeRequired(
        typeof configRecord.conditionExpression === "string" ? configRecord.conditionExpression : "",
        "Workflow draft if-then step config.conditionExpression",
      ),
    } as WorkflowDraftExpressionConditionDefinition);

  const thenLabelLegacy = normalizeOptional(
    typeof configRecord.thenLabel === "string" ? configRecord.thenLabel : undefined,
  );
  const elseLabelLegacy = normalizeOptional(
    typeof configRecord.elseLabel === "string" ? configRecord.elseLabel : undefined,
  );
  const thenStepIdsLegacy = normalizeStringArray(
    configRecord.thenStepIds,
    "Workflow draft if-then step config.thenStepIds",
  );
  const elseStepIdsLegacy = normalizeStringArray(
    configRecord.elseStepIds,
    "Workflow draft if-then step config.elseStepIds",
  );

  const branchesRecord = configRecord.branches
    ? assertRecord(configRecord.branches, "Workflow draft if-then step config.branches")
    : undefined;
  const thenBranch = branchesRecord?.then
    ? normalizeIfThenBranchTarget(branchesRecord.then, "Workflow draft if-then step config.branches.then")
    : normalizeIfThenBranchTarget(
      { label: thenLabelLegacy, stepIds: thenStepIdsLegacy },
      "Workflow draft if-then step config.branches.then",
    );
  const elseBranch = branchesRecord?.else
    ? normalizeIfThenBranchTarget(branchesRecord.else, "Workflow draft if-then step config.branches.else")
    : (elseLabelLegacy || elseStepIdsLegacy
      ? normalizeIfThenBranchTarget(
        { label: elseLabelLegacy, stepIds: elseStepIdsLegacy },
        "Workflow draft if-then step config.branches.else",
      )
      : undefined);

  const thenStepIds = thenBranch.stepIds;
  const elseStepIds = elseBranch?.stepIds;
  if (thenStepIds && elseStepIds && elseStepIds.some((stepId) => thenStepIds.includes(stepId))) {
    throw new Error("Workflow draft if-then step config elseStepIds cannot overlap thenStepIds.");
  }

  const conditionExpression = condition.kind === WorkflowDraftConditionKinds.expression
    ? condition.expression
    : undefined;
  const thenLabel = thenBranch.label;
  const elseLabel = elseBranch?.label;

  return Object.freeze({
    condition,
    branches: Object.freeze({
      then: thenBranch,
      else: elseBranch,
    }),
    conditionExpression,
    thenLabel,
    elseLabel,
    thenStepIds,
    elseStepIds,
  });
}

function normalizeLoopIterationStepConfig(
  configRecord: Readonly<Record<string, unknown>>,
): Readonly<WorkflowDraftLoopIterationStepConfig> {
  const repeatCount = normalizePositiveInteger(
    configRecord.repeatCount,
    "Workflow draft loop-iteration step config.repeatCount",
  );
  const loopConditionExpression = normalizeOptional(
    typeof configRecord.loopConditionExpression === "string" ? configRecord.loopConditionExpression : undefined,
  );
  const loopLabel = normalizeOptional(typeof configRecord.loopLabel === "string" ? configRecord.loopLabel : undefined);

  const modeRaw = normalizeOptional(
    typeof configRecord.mode === "string"
      ? configRecord.mode
      : (typeof configRecord.iterationMode === "string" ? configRecord.iterationMode : undefined),
  );
  if (
    modeRaw
    && modeRaw !== WorkflowDraftLoopIterationModes.fixedCount
    && modeRaw !== WorkflowDraftLoopIterationModes.collection
    && modeRaw !== WorkflowDraftLoopIterationModes.range
  ) {
    throw new Error(`Workflow draft loop-iteration step config.mode '${modeRaw}' is not supported.`);
  }

  const bodyStepIds = normalizeStringArray(configRecord.bodyStepIds, "Workflow draft loop-iteration step config.bodyStepIds");
  const maxIterations = normalizePositiveInteger(configRecord.maxIterations, "Workflow draft loop-iteration step config.maxIterations");

  const rangeRecord = configRecord.range
    ? assertRecord(configRecord.range, "Workflow draft loop-iteration step config.range")
    : undefined;
  const range = rangeRecord
    ? Object.freeze({
      start: normalizeLoopRangeBoundary(rangeRecord.start, "Workflow draft loop-iteration step config.range.start"),
      end: normalizeLoopRangeBoundary(rangeRecord.end, "Workflow draft loop-iteration step config.range.end"),
      step: normalizePositiveInteger(rangeRecord.step, "Workflow draft loop-iteration step config.range.step"),
    })
    : undefined;

  if (range && range.start > range.end) {
    throw new Error("Workflow draft loop-iteration step config.range.start must be less than or equal to range.end.");
  }

  const fixedCountRecord = configRecord.fixedCount
    ? assertRecord(configRecord.fixedCount, "Workflow draft loop-iteration step config.fixedCount")
    : undefined;
  const fixedCountValue = fixedCountRecord
    ? normalizePositiveInteger(
      fixedCountRecord.count,
      "Workflow draft loop-iteration step config.fixedCount.count",
    )
    : repeatCount;
  if (fixedCountRecord && !fixedCountValue) {
    throw new Error("Workflow draft loop-iteration step config.fixedCount.count must be a positive integer.");
  }
  const fixedCount = fixedCountValue
    ? Object.freeze({
      count: fixedCountValue,
    })
    : undefined;

  const collectionRecord = configRecord.collection
    ? assertRecord(configRecord.collection, "Workflow draft loop-iteration step config.collection")
    : undefined;
  const collectionInputKeyLegacy = normalizeOptional(
    typeof configRecord.collectionInputKey === "string" ? configRecord.collectionInputKey : undefined,
  );
  const itemAliasLegacy = normalizeOptional(
    typeof configRecord.itemAlias === "string" ? configRecord.itemAlias : undefined,
  );
  const collection = collectionRecord
    ? Object.freeze({
      inputKey: normalizeRequired(
        typeof collectionRecord.inputKey === "string" ? collectionRecord.inputKey : "",
        "Workflow draft loop-iteration step config.collection.inputKey",
      ),
      itemAlias: normalizeOptional(typeof collectionRecord.itemAlias === "string" ? collectionRecord.itemAlias : undefined),
    })
    : (collectionInputKeyLegacy
      ? Object.freeze({
        inputKey: collectionInputKeyLegacy,
        itemAlias: itemAliasLegacy,
      })
      : undefined);

  const exitCondition = configRecord.exitCondition
    ? normalizeConditionDefinition(configRecord.exitCondition, "Workflow draft loop-iteration step config.exitCondition")
    : (loopConditionExpression
      ? Object.freeze({
        kind: WorkflowDraftConditionKinds.expression,
        expression: loopConditionExpression,
      } as WorkflowDraftExpressionConditionDefinition)
      : undefined);

  const mode = (modeRaw as WorkflowDraftLoopIterationMode | undefined)
    ?? (collection
      ? WorkflowDraftLoopIterationModes.collection
      : (range
        ? WorkflowDraftLoopIterationModes.range
        : (fixedCount
          ? WorkflowDraftLoopIterationModes.fixedCount
          : undefined)));

  if (!mode) {
    throw new Error(
      "Workflow draft loop-iteration step requires config.mode/fixedCount/collection/range or legacy repeatCount.",
    );
  }
  if (mode === WorkflowDraftLoopIterationModes.fixedCount && !fixedCount) {
    throw new Error("Workflow draft loop-iteration fixed-count mode requires config.fixedCount.");
  }
  if (mode === WorkflowDraftLoopIterationModes.collection && !collection) {
    throw new Error("Workflow draft loop-iteration collection mode requires config.collection.");
  }
  if (mode === WorkflowDraftLoopIterationModes.range && !range) {
    throw new Error("Workflow draft loop-iteration range mode requires config.range.");
  }

  const iterationMode = mode;
  const collectionInputKey = collection?.inputKey;
  const itemAlias = collection?.itemAlias;
  const legacyRepeatCount = fixedCount?.count;
  const legacyLoopConditionExpression = exitCondition?.kind === WorkflowDraftConditionKinds.expression
    ? exitCondition.expression
    : undefined;

  return Object.freeze({
    mode,
    fixedCount,
    collection,
    range,
    exitCondition,
    loopLabel,
    bodyStepIds,
    maxIterations,
    // Deprecated aliases retained for compatibility.
    repeatCount: legacyRepeatCount,
    loopConditionExpression: legacyLoopConditionExpression,
    iterationMode,
    itemAlias,
    collectionInputKey,
  });
}

function normalizeDelayWaitStepConfig(
  configRecord: Readonly<Record<string, unknown>>,
): Readonly<WorkflowDraftDelayWaitStepConfig> {
  const modeRaw = normalizeOptional(typeof configRecord.mode === "string" ? configRecord.mode : undefined);
  if (
    modeRaw
    && modeRaw !== WorkflowDraftDelayWaitModes.duration
    && modeRaw !== WorkflowDraftDelayWaitModes.untilTime
  ) {
    throw new Error(`Workflow draft delay-wait step config.mode '${modeRaw}' is not supported.`);
  }

  const legacyDurationSeconds = normalizePositiveInteger(
    configRecord.durationSeconds,
    "Workflow draft delay-wait step config.durationSeconds",
  );

  const durationRecord = configRecord.duration
    ? assertRecord(configRecord.duration, "Workflow draft delay-wait step config.duration")
    : undefined;
  const durationValue = durationRecord
    ? normalizePositiveInteger(durationRecord.value, "Workflow draft delay-wait step config.duration.value")
    : legacyDurationSeconds;
  const durationUnitRaw = durationRecord
    ? normalizeRequired(
      typeof durationRecord.unit === "string" ? durationRecord.unit : "",
      "Workflow draft delay-wait step config.duration.unit",
    )
    : (legacyDurationSeconds ? WorkflowDraftDelayWaitDurationUnits.seconds : undefined);
  if (
    durationUnitRaw
    && durationUnitRaw !== WorkflowDraftDelayWaitDurationUnits.seconds
    && durationUnitRaw !== WorkflowDraftDelayWaitDurationUnits.minutes
    && durationUnitRaw !== WorkflowDraftDelayWaitDurationUnits.hours
  ) {
    throw new Error(`Workflow draft delay-wait step config.duration.unit '${durationUnitRaw}' is not supported.`);
  }
  const duration = durationValue
    ? Object.freeze({
      value: durationValue,
      unit: durationUnitRaw as WorkflowDraftDelayWaitDurationUnit,
    })
    : undefined;

  const legacyWaitUntil = normalizeOptional(typeof configRecord.waitUntil === "string" ? configRecord.waitUntil : undefined);
  const untilRecord = configRecord.until
    ? assertRecord(configRecord.until, "Workflow draft delay-wait step config.until")
    : undefined;
  const untilTimestamp = normalizeOptional(
    typeof untilRecord?.timestamp === "string"
      ? untilRecord.timestamp
      : legacyWaitUntil,
  );
  if (untilTimestamp && !isValidTimestamp(untilTimestamp)) {
    throw new Error("Workflow draft delay-wait step config.until.timestamp must be a valid timestamp.");
  }
  const untilTimezone = normalizeOptional(
    typeof untilRecord?.timezone === "string" ? untilRecord.timezone : undefined,
  );
  const until = untilTimestamp
    ? Object.freeze({
      timestamp: untilTimestamp,
      timezone: untilTimezone,
    })
    : undefined;

  const mode = (modeRaw as WorkflowDraftDelayWaitMode | undefined)
    ?? (until ? WorkflowDraftDelayWaitModes.untilTime : (duration ? WorkflowDraftDelayWaitModes.duration : undefined));
  if (!mode) {
    throw new Error("Workflow draft delay-wait step requires config.mode with config.duration or config.until.");
  }
  if (mode === WorkflowDraftDelayWaitModes.duration && !duration) {
    throw new Error("Workflow draft delay-wait duration mode requires config.duration or legacy durationSeconds.");
  }
  if (mode === WorkflowDraftDelayWaitModes.untilTime && !until) {
    throw new Error("Workflow draft delay-wait until-time mode requires config.until.timestamp or legacy waitUntil.");
  }
  if (mode === WorkflowDraftDelayWaitModes.duration && until) {
    throw new Error("Workflow draft delay-wait duration mode does not allow config.until.");
  }
  if (mode === WorkflowDraftDelayWaitModes.untilTime && duration) {
    throw new Error("Workflow draft delay-wait until-time mode does not allow config.duration.");
  }

  const durationSeconds = duration
    ? (duration.unit === WorkflowDraftDelayWaitDurationUnits.seconds
      ? duration.value
      : (duration.unit === WorkflowDraftDelayWaitDurationUnits.minutes
        ? duration.value * 60
        : duration.value * 3600))
    : undefined;
  const note = normalizeOptional(typeof configRecord.note === "string" ? configRecord.note : undefined);
  return Object.freeze({
    mode,
    duration,
    until,
    note,
    durationSeconds,
    waitUntil: until?.timestamp,
  });
}

function normalizeManualApprovalStepConfig(
  configRecord: Readonly<Record<string, unknown>>,
): Readonly<WorkflowDraftManualApprovalStepConfig> {
  const prompt = normalizeOptional(
    typeof configRecord.prompt === "string" ? configRecord.prompt : undefined,
  ) ?? normalizeOptional(
    typeof configRecord.approvalMessage === "string" ? configRecord.approvalMessage : undefined,
  );
  if (!prompt) {
    throw new Error("Workflow draft manual-approval step requires config.prompt or legacy approvalMessage.");
  }

  const interactionModeRaw = normalizeOptional(
    typeof configRecord.interactionMode === "string" ? configRecord.interactionMode : undefined,
  );
  if (
    interactionModeRaw
    && interactionModeRaw !== WorkflowDraftManualInteractionModes.review
    && interactionModeRaw !== WorkflowDraftManualInteractionModes.approval
  ) {
    throw new Error(`Workflow draft manual-approval step config.interactionMode '${interactionModeRaw}' is not supported.`);
  }

  const outcomesRecord = configRecord.outcomes
    ? assertRecord(configRecord.outcomes, "Workflow draft manual-approval step config.outcomes")
    : undefined;
  const continueOutcome = outcomesRecord?.continue
    ? normalizeIfThenBranchTarget(
      outcomesRecord.continue,
      "Workflow draft manual-approval step config.outcomes.continue",
    )
    : undefined;
  const approveOutcome = outcomesRecord?.approve
    ? normalizeIfThenBranchTarget(
      outcomesRecord.approve,
      "Workflow draft manual-approval step config.outcomes.approve",
    )
    : undefined;
  const rejectOutcome = outcomesRecord?.reject
    ? normalizeIfThenBranchTarget(
      outcomesRecord.reject,
      "Workflow draft manual-approval step config.outcomes.reject",
    )
    : undefined;

  const interactionMode = (interactionModeRaw as WorkflowDraftManualInteractionMode | undefined)
    ?? WorkflowDraftManualInteractionModes.approval;

  const requiredApproverRoles = normalizeStringArray(
    configRecord.requiredApproverRoles,
    "Workflow draft manual-approval step config.requiredApproverRoles",
  );
  const timeoutSeconds = normalizePositiveInteger(
    configRecord.timeoutSeconds,
    "Workflow draft manual-approval step config.timeoutSeconds",
  );
  const onTimeoutRaw = normalizeOptional(typeof configRecord.onTimeout === "string" ? configRecord.onTimeout : undefined);
  if (onTimeoutRaw && onTimeoutRaw !== "reject" && onTimeoutRaw !== "continue" && onTimeoutRaw !== "escalate") {
    throw new Error(`Workflow draft manual-approval step config.onTimeout '${onTimeoutRaw}' is not supported.`);
  }

  if (interactionMode === WorkflowDraftManualInteractionModes.review && (approveOutcome || rejectOutcome)) {
    throw new Error("Workflow draft manual-approval review mode only allows config.outcomes.continue.");
  }
  if (interactionMode === WorkflowDraftManualInteractionModes.approval && continueOutcome) {
    throw new Error("Workflow draft manual-approval approval mode does not allow config.outcomes.continue.");
  }

  const outcomes = interactionMode === WorkflowDraftManualInteractionModes.review
    ? Object.freeze<WorkflowDraftManualInteractionOutcomes>({
      continue: continueOutcome ?? Object.freeze({ label: "Continue" }),
    })
    : Object.freeze<WorkflowDraftManualInteractionOutcomes>({
      approve: approveOutcome ?? Object.freeze({ label: "Approved" }),
      reject: rejectOutcome ?? Object.freeze({ label: "Rejected" }),
    });

  return Object.freeze({
    prompt,
    interactionMode,
    outcomes,
    requiredApproverRoles,
    timeoutSeconds,
    onTimeout: onTimeoutRaw as WorkflowDraftManualApprovalStepConfig["onTimeout"] | undefined,
    allowSelfApproval: normalizeOptionalBoolean(
      configRecord.allowSelfApproval,
      "Workflow draft manual-approval step config.allowSelfApproval",
    ),
    approvalMessage: prompt,
  });
}

const workflowDraftTriggerDefinitions: ReadonlyArray<WorkflowDraftTriggerDefinition> = Object.freeze([
  Object.freeze({
    kind: WorkflowDraftTriggerKinds.user,
    type: WorkflowDraftTriggerTypes.userManual,
    label: "Manual start",
    description: "Workflow execution starts from an explicit manual user action.",
    configSchemaId: "workflow.trigger.user.manual.v1",
    capabilities: Object.freeze({
      supportsManualInvocation: true,
      supportsTemporalScheduling: false,
      supportsStateSubscription: false,
      supportsIntermediateContinuation: true,
    }),
    defaultConfig: Object.freeze<WorkflowDraftUserTriggerConfig>({
      invocationScope: WorkflowDraftUserTriggerScopes.workflowStart,
    }),
    validateConfig: (configRecord) => normalizeUserTriggerConfig(WorkflowDraftTriggerTypes.userManual, configRecord),
  }),
  Object.freeze({
    kind: WorkflowDraftTriggerKinds.user,
    type: WorkflowDraftTriggerTypes.userButtonClick,
    label: "Button click",
    description: "Workflow execution starts from a configured UI/button action.",
    configSchemaId: "workflow.trigger.user.button-click.v1",
    capabilities: Object.freeze({
      supportsManualInvocation: true,
      supportsTemporalScheduling: false,
      supportsStateSubscription: false,
      supportsIntermediateContinuation: false,
    }),
    defaultConfig: Object.freeze<WorkflowDraftUserTriggerConfig>({
      invocationScope: WorkflowDraftUserTriggerScopes.workflowStart,
      buttonId: "run-workflow",
    }),
    validateConfig: (configRecord) => normalizeUserTriggerConfig(WorkflowDraftTriggerTypes.userButtonClick, configRecord),
  }),
  Object.freeze({
    kind: WorkflowDraftTriggerKinds.user,
    type: WorkflowDraftTriggerTypes.userInitiatedRun,
    label: "User initiated run",
    description: "Workflow execution starts when a user submits a run request.",
    configSchemaId: "workflow.trigger.user.initiated-run.v1",
    capabilities: Object.freeze({
      supportsManualInvocation: true,
      supportsTemporalScheduling: false,
      supportsStateSubscription: false,
      supportsIntermediateContinuation: true,
    }),
    defaultConfig: Object.freeze<WorkflowDraftUserTriggerConfig>({
      invocationScope: WorkflowDraftUserTriggerScopes.workflowStart,
    }),
    validateConfig: (configRecord) => normalizeUserTriggerConfig(WorkflowDraftTriggerTypes.userInitiatedRun, configRecord),
  }),
  Object.freeze({
    kind: WorkflowDraftTriggerKinds.temporal,
    type: WorkflowDraftTriggerTypes.temporalSchedule,
    label: "Scheduled time",
    description: "Workflow execution starts on a cron-like schedule expression.",
    configSchemaId: "workflow.trigger.temporal.schedule.v1",
    capabilities: Object.freeze({
      supportsManualInvocation: false,
      supportsTemporalScheduling: true,
      supportsStateSubscription: false,
      supportsIntermediateContinuation: false,
    }),
    defaultConfig: Object.freeze<WorkflowDraftTemporalTriggerConfig>({
      scheduleMode: WorkflowDraftTemporalScheduleModes.cron,
      cronExpression: "0 9 * * *",
      timezone: "UTC",
    }),
    validateConfig: (configRecord) => normalizeTemporalTriggerConfig(WorkflowDraftTriggerTypes.temporalSchedule, configRecord),
  }),
  Object.freeze({
    kind: WorkflowDraftTriggerKinds.temporal,
    type: WorkflowDraftTriggerTypes.temporalRecurring,
    label: "Recurring interval",
    description: "Workflow execution starts on a recurring interval cadence.",
    configSchemaId: "workflow.trigger.temporal.recurring.v1",
    capabilities: Object.freeze({
      supportsManualInvocation: false,
      supportsTemporalScheduling: true,
      supportsStateSubscription: false,
      supportsIntermediateContinuation: false,
    }),
    defaultConfig: Object.freeze<WorkflowDraftTemporalTriggerConfig>({
      scheduleMode: WorkflowDraftTemporalScheduleModes.interval,
      every: 1,
      unit: "days",
      timezone: "UTC",
    }),
    validateConfig: (configRecord) => normalizeTemporalTriggerConfig(WorkflowDraftTriggerTypes.temporalRecurring, configRecord),
  }),
  Object.freeze({
    kind: WorkflowDraftTriggerKinds.state,
    type: WorkflowDraftTriggerTypes.stateDataAvailable,
    label: "Data available",
    description: "Workflow execution starts when new input data is available.",
    configSchemaId: "workflow.trigger.state.data-available.v1",
    capabilities: Object.freeze({
      supportsManualInvocation: false,
      supportsTemporalScheduling: false,
      supportsStateSubscription: true,
      supportsIntermediateContinuation: false,
    }),
    defaultConfig: Object.freeze<WorkflowDraftStateTriggerConfig>({
      sourceType: WorkflowDraftStateEventSourceTypes.dataset,
      eventCategory: WorkflowDraftStateEventCategories.dataIngested,
      subject: "dataset",
      eventName: "data-available",
    }),
    validateConfig: (configRecord) => normalizeStateTriggerConfig(WorkflowDraftTriggerTypes.stateDataAvailable, configRecord),
  }),
  Object.freeze({
    kind: WorkflowDraftTriggerKinds.state,
    type: WorkflowDraftTriggerTypes.stateAssetStateChanged,
    label: "Asset state changed",
    description: "Workflow execution starts when a referenced asset changes state.",
    configSchemaId: "workflow.trigger.state.asset-state-changed.v1",
    capabilities: Object.freeze({
      supportsManualInvocation: false,
      supportsTemporalScheduling: false,
      supportsStateSubscription: true,
      supportsIntermediateContinuation: false,
    }),
    defaultConfig: Object.freeze<WorkflowDraftStateTriggerConfig>({
      sourceType: WorkflowDraftStateEventSourceTypes.asset,
      eventCategory: WorkflowDraftStateEventCategories.assetUpdated,
      subject: "asset",
      asset: Object.freeze({
        assetId: "asset:source",
      }),
      stateKey: "status",
      stateValue: "ready",
    }),
    validateConfig: (configRecord) => normalizeStateTriggerConfig(WorkflowDraftTriggerTypes.stateAssetStateChanged, configRecord),
  }),
  Object.freeze({
    kind: WorkflowDraftTriggerKinds.state,
    type: WorkflowDraftTriggerTypes.stateSystemEvent,
    label: "System event",
    description: "Workflow execution starts when a named system event is emitted.",
    configSchemaId: "workflow.trigger.state.system-event.v1",
    capabilities: Object.freeze({
      supportsManualInvocation: false,
      supportsTemporalScheduling: false,
      supportsStateSubscription: true,
      supportsIntermediateContinuation: false,
    }),
    defaultConfig: Object.freeze<WorkflowDraftStateTriggerConfig>({
      sourceType: WorkflowDraftStateEventSourceTypes.system,
      eventCategory: WorkflowDraftStateEventCategories.systemStateChanged,
      subject: "workflow",
      eventName: "system-event",
    }),
    validateConfig: (configRecord) => normalizeStateTriggerConfig(WorkflowDraftTriggerTypes.stateSystemEvent, configRecord),
  }),
]);

const workflowDraftTriggerDefinitionByType = new Map<WorkflowDraftTriggerType, WorkflowDraftTriggerDefinition>(
  workflowDraftTriggerDefinitions.map((definition) => [definition.type, definition]),
);

export function listWorkflowDraftTriggerDefinitions(): ReadonlyArray<WorkflowDraftTriggerDefinition> {
  return workflowDraftTriggerDefinitions;
}

export function getWorkflowDraftTriggerDefinition(type: string): WorkflowDraftTriggerDefinition | undefined {
  const normalized = normalizeOptional(type);
  if (!normalized) {
    return undefined;
  }
  return workflowDraftTriggerDefinitionByType.get(normalized as WorkflowDraftTriggerType);
}

export function isWorkflowDraftTriggerType(value: string): value is WorkflowDraftTriggerType {
  return workflowDraftTriggerDefinitionByType.has(value as WorkflowDraftTriggerType);
}

export function normalizeWorkflowDraftTriggerConfig(
  triggerType: WorkflowDraftTriggerType,
  configRecord: Readonly<Record<string, unknown>>,
): Readonly<WorkflowDraftTriggerConfig> {
  const definition = workflowDraftTriggerDefinitionByType.get(triggerType);
  if (!definition) {
    throw new Error(`Workflow draft trigger type '${triggerType}' is not supported.`);
  }
  return definition.validateConfig(configRecord);
}

const workflowDraftBuiltInStepDefinitions: ReadonlyArray<WorkflowDraftBuiltInStepDefinition> = Object.freeze([
  Object.freeze({
    type: WorkflowDraftBuiltInStepTypes.ifThen,
    category: WorkflowDraftBuiltInStepCategories.controlFlow,
    label: "If / Then branching",
    description: "Evaluate an expression and route execution to then/else branches.",
    configSchemaId: "workflow.builtin.if-then.v2",
    defaultConfig: Object.freeze<WorkflowDraftIfThenStepConfig>({
      condition: Object.freeze({
        kind: WorkflowDraftConditionKinds.expression,
        expression: "true",
      }),
      branches: Object.freeze({
        then: Object.freeze({
          label: "Then path",
        }),
        else: Object.freeze({
          label: "Else path",
        }),
      }),
      conditionExpression: "true",
      thenLabel: "Then path",
      elseLabel: "Else path",
    }),
    validateConfig: normalizeIfThenStepConfig,
  }),
  Object.freeze({
    type: WorkflowDraftBuiltInStepTypes.loopIteration,
    category: WorkflowDraftBuiltInStepCategories.controlFlow,
    label: "Loop / Repeat",
    description: "Repeat execution by count, condition, collection, or range.",
    configSchemaId: "workflow.builtin.loop-iteration.v2",
    defaultConfig: Object.freeze<WorkflowDraftLoopIterationStepConfig>({
      mode: WorkflowDraftLoopIterationModes.fixedCount,
      fixedCount: Object.freeze({
        count: 1,
      }),
      repeatCount: 1,
      iterationMode: WorkflowDraftLoopIterationModes.fixedCount,
    }),
    validateConfig: normalizeLoopIterationStepConfig,
  }),
  Object.freeze({
    type: WorkflowDraftBuiltInStepTypes.delayWait,
    category: WorkflowDraftBuiltInStepCategories.temporal,
    label: "Delay / Wait",
    description: "Pause workflow execution for a duration or until a specific time.",
    configSchemaId: "workflow.builtin.delay-wait.v2",
    defaultConfig: Object.freeze<WorkflowDraftDelayWaitStepConfig>({
      mode: WorkflowDraftDelayWaitModes.duration,
      duration: Object.freeze({
        value: 60,
        unit: WorkflowDraftDelayWaitDurationUnits.seconds,
      }),
      durationSeconds: 60,
    }),
    validateConfig: normalizeDelayWaitStepConfig,
  }),
  Object.freeze({
    type: WorkflowDraftBuiltInStepTypes.manualApproval,
    category: WorkflowDraftBuiltInStepCategories.humanInteraction,
    label: "Manual / Approval",
    description: "Pause for manual review or explicit approve/reject checkpoint decisions.",
    configSchemaId: "workflow.builtin.manual-approval.v2",
    defaultConfig: Object.freeze<WorkflowDraftManualApprovalStepConfig>({
      prompt: "Awaiting manual approval.",
      interactionMode: WorkflowDraftManualInteractionModes.approval,
      outcomes: Object.freeze({
        approve: Object.freeze({
          label: "Approved",
        }),
        reject: Object.freeze({
          label: "Rejected",
        }),
      }),
      approvalMessage: "Awaiting manual approval.",
      onTimeout: "reject",
    }),
    validateConfig: normalizeManualApprovalStepConfig,
  }),
]);

const workflowDraftBuiltInStepDefinitionByType = new Map<WorkflowDraftBuiltInStepType, WorkflowDraftBuiltInStepDefinition>(
  workflowDraftBuiltInStepDefinitions.map((definition) => [definition.type, definition]),
);

export function listWorkflowDraftBuiltInStepDefinitions(): ReadonlyArray<WorkflowDraftBuiltInStepDefinition> {
  return workflowDraftBuiltInStepDefinitions;
}

export function getWorkflowDraftBuiltInStepDefinition(type: string): WorkflowDraftBuiltInStepDefinition | undefined {
  const normalized = normalizeOptional(type);
  if (!normalized) {
    return undefined;
  }
  return workflowDraftBuiltInStepDefinitionByType.get(normalized as WorkflowDraftBuiltInStepType);
}

export function isWorkflowDraftBuiltInStepType(value: string): value is WorkflowDraftBuiltInStepType {
  return workflowDraftBuiltInStepDefinitionByType.has(value as WorkflowDraftBuiltInStepType);
}

export function normalizeWorkflowDraftBuiltInStepConfig(
  stepType: WorkflowDraftBuiltInStepType,
  configRecord: Readonly<Record<string, unknown>>,
): Readonly<WorkflowDraftBuiltInStepConfig> {
  const definition = workflowDraftBuiltInStepDefinitionByType.get(stepType);
  if (!definition) {
    throw new Error(`Workflow draft built-in step type '${stepType}' is not supported.`);
  }
  return definition.validateConfig(configRecord);
}

export function isWorkflowDraftBuiltInStep(step: WorkflowDraftStep): step is WorkflowDraftBuiltInStep {
  return step.kind === WorkflowDraftStepKinds.controlFlow
    && isWorkflowDraftBuiltInStepType(step.type)
    && Boolean(step.config);
}

function normalizeLoopRangeBoundary(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return value;
}

function normalizeStepKind(step: WorkflowDraftStep): WorkflowDraftStepKind {
  const kind = normalizeOptional(step.kind);
  if (!kind) {
    return step.assetRef ? WorkflowDraftStepKinds.assetBacked : WorkflowDraftStepKinds.action;
  }

  if (
    kind === WorkflowDraftStepKinds.action
    || kind === WorkflowDraftStepKinds.controlFlow
    || kind === WorkflowDraftStepKinds.assetBacked
  ) {
    return kind;
  }

  throw new Error(`Workflow draft step kind '${kind}' is not supported.`);
}

function normalizeWorkflowDraftStepAssetReference(reference: WorkflowDraftStepAssetReference): WorkflowDraftStepAssetReference {
  const record = assertRecord(reference, "Workflow draft step assetRef");
  const assetKind = normalizeRequired(
    typeof record.assetKind === "string" ? record.assetKind : "",
    "Workflow draft step assetRef assetKind",
  );
  const assetRecord = assertRecord(record.asset, "Workflow draft step assetRef asset");
  const expectedTaxonomy = assetKind === WorkflowDraftStepAssetKinds.agentAssistant
    ? WorkflowDraftAssetReferenceTaxonomyExpectations[WorkflowDraftAssetReferenceKinds.agentAssistantStep]
    : undefined;

  return Object.freeze({
    assetKind,
    asset: normalizeWorkflowDraftAssetReference(
      assetRecord as WorkflowDraftAssetReference,
      "Workflow draft step assetRef asset",
      expectedTaxonomy,
    ),
  });
}

function normalizeOutput(output: WorkflowDraftOutput): WorkflowDraftOutput {
  const item = normalizeSectionItem(output, "Workflow draft output");
  const outputType = normalizeRequired(output.outputType, "Workflow draft output outputType");
  const format = normalizeRequired(output.format, "Workflow draft output format");
  const destinationRecord = assertRecord(output.destination, "Workflow draft output destination");
  const destinationType = normalizeRequired(
    typeof destinationRecord.type === "string" ? destinationRecord.type : "",
    "Workflow draft output destination type",
  );
  const destinationTarget = normalizeRequired(
    typeof destinationRecord.target === "string" ? destinationRecord.target : "",
    "Workflow draft output destination target",
  );
  const destinationOptions = destinationRecord.options
    ? Object.freeze({ ...assertRecord(destinationRecord.options, "Workflow draft output destination options") })
    : undefined;
  const sourceStepId = normalizeOptional(output.sourceStepId);

  return Object.freeze({
    ...item,
    outputType,
    format,
    destination: Object.freeze({
      type: destinationType,
      target: destinationTarget,
      options: destinationOptions,
    }),
    sourceStepId,
  });
}

function normalizeStepOrdering(steps: ReadonlyArray<WorkflowDraftStep>): ReadonlyArray<WorkflowDraftStep> {
  const normalized = [...steps].sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order;
    }
    return left.id.localeCompare(right.id);
  });

  const seenOrder = new Set<number>();
  const seenIds = new Set<string>();
  for (const step of normalized) {
    if (seenOrder.has(step.order)) {
      throw new Error(`Workflow draft step order '${step.order}' is duplicated.`);
    }
    if (seenIds.has(step.id)) {
      throw new Error(`Workflow draft step id '${step.id}' is duplicated.`);
    }
    seenOrder.add(step.order);
    seenIds.add(step.id);
  }

  return Object.freeze(normalized);
}

function normalizeSectionItems<T extends WorkflowDraftSectionItemBase>(
  sectionName: string,
  items: ReadonlyArray<T>,
  normalizeItem: (item: T) => T = (item) => normalizeSectionItem(item, sectionName),
): ReadonlyArray<T> {
  const normalized: T[] = [];
  const seenIds = new Set<string>();

  for (const item of items) {
    const normalizedItem = normalizeItem(item);
    if (seenIds.has(normalizedItem.id)) {
      throw new Error(`${sectionName} item id '${normalizedItem.id}' is duplicated.`);
    }
    seenIds.add(normalizedItem.id);
    normalized.push(normalizedItem as T);
  }

  return Object.freeze(normalized);
}

export function createEmptyWorkflowDraft(): WorkflowDraft {
  return Object.freeze({
    triggers: Object.freeze([]),
    inputs: Object.freeze([]),
    steps: Object.freeze([]),
    outputs: Object.freeze([]),
  });
}

export function normalizeWorkflowDraft(draft?: WorkflowDraft): WorkflowDraft {
  if (!draft) {
    return createEmptyWorkflowDraft();
  }

  return Object.freeze({
    triggers: normalizeSectionItems("Workflow draft trigger", draft.triggers ?? [], (item) => normalizeTrigger(item as WorkflowDraftTrigger)),
    inputs: normalizeSectionItems("Workflow draft input", draft.inputs ?? [], (item) => normalizeInput(item as WorkflowDraftInput)),
    steps: normalizeStepOrdering((draft.steps ?? []).map((step) => normalizeStep(step))),
    outputs: normalizeSectionItems("Workflow draft output", draft.outputs ?? [], (item) => normalizeOutput(item as WorkflowDraftOutput)),
  });
}

function isWorkflowLifecycleState(value: string): value is WorkflowLifecycleState {
  return value === WorkflowLifecycleStates.draft
    || value === WorkflowLifecycleStates.saved
    || value === WorkflowLifecycleStates.executable;
}

function normalizeWorkflowLifecycleState(value: string): WorkflowLifecycleState {
  if (!isWorkflowLifecycleState(value)) {
    throw new Error(`Workflow lifecycle state '${value}' is not supported.`);
  }
  return value;
}

function isValidTimestamp(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }
  const millis = Date.parse(value);
  return Number.isFinite(millis);
}

function buildWorkflowValidationResult(issues: ReadonlyArray<WorkflowValidationIssue>): WorkflowValidationResult {
  const frozenIssues = Object.freeze(issues.map((issue) => Object.freeze(issue)));
  return Object.freeze({
    valid: frozenIssues.every((issue) => issue.severity !== "error"),
    issues: frozenIssues,
  });
}

function validateStepDependencyCycles(stepDependencies: ReadonlyMap<string, ReadonlyArray<string>>): boolean {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(stepId: string): boolean {
    if (visited.has(stepId)) {
      return false;
    }
    if (visiting.has(stepId)) {
      return true;
    }
    visiting.add(stepId);
    const dependencies = stepDependencies.get(stepId) ?? [];
    for (const dependency of dependencies) {
      if (visit(dependency)) {
        return true;
      }
    }
    visiting.delete(stepId);
    visited.add(stepId);
    return false;
  }

  for (const stepId of stepDependencies.keys()) {
    if (visit(stepId)) {
      return true;
    }
  }

  return false;
}

function readDestinationOptionString(
  output: WorkflowDraftOutput,
  optionKey: string,
): string | undefined {
  const candidate = output.destination.options?.[optionKey];
  if (typeof candidate !== "string") {
    return undefined;
  }
  const normalized = candidate.trim();
  return normalized ? normalized : undefined;
}

export function classifyWorkflowDraftAssetReferences(
  draft: WorkflowDraft,
): ReadonlyArray<WorkflowDraftAssetReferenceClassification> {
  const normalizedDraft = normalizeWorkflowDraft(draft);
  const classifications: WorkflowDraftAssetReferenceClassification[] = [];

  normalizedDraft.inputs.forEach((input, index) => {
    if (input.sourceType !== WorkflowDraftInputSourceTypes.datasetAsset) {
      return;
    }
    const expectedTaxonomy = WorkflowDraftAssetReferenceTaxonomyExpectations[WorkflowDraftAssetReferenceKinds.datasetInput];
    classifications.push(Object.freeze({
      kind: WorkflowDraftAssetReferenceKinds.datasetInput,
      path: `draft.inputs[${index}].asset`,
      asset: input.asset,
      expectedTaxonomy,
      taxonomyMatched: taxonomyEquals(input.asset.taxonomy, expectedTaxonomy),
    }));
  });

  normalizedDraft.steps.forEach((step, index) => {
    if (
      step.kind !== WorkflowDraftStepKinds.assetBacked
      || !step.assetRef
      || step.assetRef.assetKind !== WorkflowDraftStepAssetKinds.agentAssistant
    ) {
      return;
    }
    const expectedTaxonomy = WorkflowDraftAssetReferenceTaxonomyExpectations[WorkflowDraftAssetReferenceKinds.agentAssistantStep];
    classifications.push(Object.freeze({
      kind: WorkflowDraftAssetReferenceKinds.agentAssistantStep,
      path: `draft.steps[${index}].assetRef.asset`,
      asset: step.assetRef.asset,
      expectedTaxonomy,
      taxonomyMatched: taxonomyEquals(step.assetRef.asset.taxonomy, expectedTaxonomy),
    }));
  });

  return Object.freeze(classifications);
}

export interface WorkflowDraftTriggerValidationContext {
  readonly requireAtLeastOneTrigger?: boolean;
  readonly stepIds?: ReadonlySet<string>;
  readonly allowedUserTriggerScopes?: ReadonlyArray<WorkflowDraftUserTriggerScope>;
}

export interface WorkflowDraftTriggerValidationResult {
  readonly valid: boolean;
  readonly normalizedTriggers: ReadonlyArray<WorkflowDraftTrigger>;
  readonly issues: ReadonlyArray<WorkflowValidationIssue>;
}

function buildTriggerDefinitionSignature(trigger: WorkflowDraftTrigger): string {
  return stableStringify({
    kind: trigger.kind,
    type: trigger.type,
    config: trigger.config ?? {},
  });
}

function pushTriggerIssue(
  issues: WorkflowValidationIssue[],
  code: WorkflowValidationIssueCode,
  message: string,
  path: string,
  section: WorkflowValidationSection = WorkflowValidationSections.triggers,
): void {
  issues.push({
    code,
    section,
    severity: "error",
    message,
    path,
  });
}

export function validateWorkflowDraftTriggers(
  triggers: ReadonlyArray<unknown> | undefined,
  context: WorkflowDraftTriggerValidationContext = {},
): WorkflowDraftTriggerValidationResult {
  const issues: WorkflowValidationIssue[] = [];
  const normalizedTriggers: WorkflowDraftTrigger[] = [];
  const rawTriggers = Array.isArray(triggers) ? triggers : [];
  if ((context.requireAtLeastOneTrigger ?? false) && rawTriggers.length === 0) {
    pushTriggerIssue(
      issues,
      WorkflowValidationIssueCodes.triggerCollectionEmpty,
      "Workflow draft requires at least one trigger.",
      "draft.triggers",
    );
  }

  for (let index = 0; index < rawTriggers.length; index += 1) {
    try {
      const normalized = normalizeTrigger(rawTriggers[index] as WorkflowDraftTrigger);
      normalizedTriggers.push(normalized);
    } catch (error) {
      pushTriggerIssue(
        issues,
        WorkflowValidationIssueCodes.triggerMalformed,
        error instanceof Error ? error.message : "Workflow trigger is malformed.",
        `draft.triggers[${index}]`,
      );
    }
  }

  const triggerIdToIndexes = new Map<string, number[]>();
  normalizedTriggers.forEach((trigger, index) => {
    const indexes = triggerIdToIndexes.get(trigger.id) ?? [];
    indexes.push(index);
    triggerIdToIndexes.set(trigger.id, indexes);
  });
  for (const [triggerId, indexes] of triggerIdToIndexes.entries()) {
    if (indexes.length < 2) {
      continue;
    }
    for (const index of indexes) {
      pushTriggerIssue(
        issues,
        WorkflowValidationIssueCodes.triggerDuplicateId,
        `Workflow trigger id '${triggerId}' is duplicated.`,
        `draft.triggers[${index}].id`,
      );
    }
  }

  const triggerSignatureToIndexes = new Map<string, number[]>();
  normalizedTriggers.forEach((trigger, index) => {
    const signature = buildTriggerDefinitionSignature(trigger);
    const indexes = triggerSignatureToIndexes.get(signature) ?? [];
    indexes.push(index);
    triggerSignatureToIndexes.set(signature, indexes);
  });
  for (const indexes of triggerSignatureToIndexes.values()) {
    if (indexes.length < 2) {
      continue;
    }
    for (const index of indexes) {
      const trigger = normalizedTriggers[index]!;
      pushTriggerIssue(
        issues,
        WorkflowValidationIssueCodes.triggerDuplicateDefinition,
        `Workflow trigger '${trigger.id}' duplicates an existing '${trigger.type}' definition.`,
        `draft.triggers[${index}]`,
      );
    }
  }

  const allowedUserTriggerScopes = new Set<WorkflowDraftUserTriggerScope>(
    context.allowedUserTriggerScopes
      ?? Object.values(WorkflowDraftUserTriggerScopes),
  );
  normalizedTriggers.forEach((trigger, index) => {
    if (trigger.kind !== WorkflowDraftTriggerKinds.user) {
      return;
    }
    const scope = trigger.config.invocationScope ?? WorkflowDraftUserTriggerScopes.workflowStart;
    if (!allowedUserTriggerScopes.has(scope)) {
      pushTriggerIssue(
        issues,
        WorkflowValidationIssueCodes.triggerScopeUnsupported,
        `Workflow trigger '${trigger.id}' uses unsupported invocationScope '${scope}'.`,
        `draft.triggers[${index}].config.invocationScope`,
      );
    }
    if (
      scope === WorkflowDraftUserTriggerScopes.workflowContinuation
      && trigger.config.continuationStepId
      && context.stepIds
      && !context.stepIds.has(trigger.config.continuationStepId)
    ) {
      pushTriggerIssue(
        issues,
        WorkflowValidationIssueCodes.triggerContinuationStepMissing,
        `Workflow continuation trigger '${trigger.id}' references unknown continuationStepId '${trigger.config.continuationStepId}'.`,
        `draft.triggers[${index}].config.continuationStepId`,
        WorkflowValidationSections.crossSection,
      );
    }
  });

  return Object.freeze({
    valid: issues.length === 0,
    normalizedTriggers: Object.freeze(normalizedTriggers),
    issues: Object.freeze(issues),
  });
}

export function validateWorkflowDraft(draft: WorkflowDraft | undefined): WorkflowValidationResult {
  const issues: WorkflowValidationIssue[] = [];
  if (!draft || typeof draft !== "object") {
    issues.push({
      code: WorkflowValidationIssueCodes.draftMalformed,
      section: WorkflowValidationSections.draft,
      severity: "error",
      message: "Workflow draft must be an object.",
      path: "draft",
    });
    return buildWorkflowValidationResult(issues);
  }

  const raw = draft as {
    readonly triggers?: unknown;
    readonly inputs?: unknown;
    readonly steps?: unknown;
    readonly outputs?: unknown;
  };

  if (!Array.isArray(raw.triggers)) {
    issues.push({
      code: WorkflowValidationIssueCodes.draftSectionMissing,
      section: WorkflowValidationSections.draft,
      severity: "error",
      message: "Workflow draft requires a triggers array.",
      path: "draft.triggers",
    });
  }
  if (!Array.isArray(raw.inputs)) {
    issues.push({
      code: WorkflowValidationIssueCodes.draftSectionMissing,
      section: WorkflowValidationSections.draft,
      severity: "error",
      message: "Workflow draft requires an inputs array.",
      path: "draft.inputs",
    });
  }
  if (!Array.isArray(raw.steps)) {
    issues.push({
      code: WorkflowValidationIssueCodes.draftSectionMissing,
      section: WorkflowValidationSections.draft,
      severity: "error",
      message: "Workflow draft requires a steps array.",
      path: "draft.steps",
    });
  }
  if (!Array.isArray(raw.outputs)) {
    issues.push({
      code: WorkflowValidationIssueCodes.draftSectionMissing,
      section: WorkflowValidationSections.draft,
      severity: "error",
      message: "Workflow draft requires an outputs array.",
      path: "draft.outputs",
    });
  }

  const normalizedInputs: WorkflowDraftInput[] = [];
  const inputs = Array.isArray(raw.inputs) ? raw.inputs : [];
  for (let index = 0; index < inputs.length; index += 1) {
    try {
      const normalized = normalizeInput(inputs[index] as WorkflowDraftInput);
      normalizedInputs.push(normalized);
      if (
        normalized.sourceType === WorkflowDraftInputSourceTypes.datasetAsset
        && !normalized.asset.assetId.startsWith("asset:")
      ) {
        issues.push({
          code: WorkflowValidationIssueCodes.inputDatasetAssetMalformed,
          section: WorkflowValidationSections.inputs,
          severity: "error",
          message: `Dataset input asset '${normalized.asset.assetId}' must use canonical 'asset:' identity.`,
          path: `draft.inputs[${index}].asset.assetId`,
        });
      }
      if (normalized.sourceType === WorkflowDraftInputSourceTypes.datasetAsset) {
        const expectedTaxonomy = WorkflowDraftAssetReferenceTaxonomyExpectations[WorkflowDraftAssetReferenceKinds.datasetInput];
        if (!taxonomyEquals(normalized.asset.taxonomy, expectedTaxonomy)) {
          issues.push({
            code: WorkflowValidationIssueCodes.inputDatasetAssetTaxonomyMismatch,
            section: WorkflowValidationSections.inputs,
            severity: "error",
            message: `Dataset input asset '${normalized.asset.assetId}' must align with taxonomy '${taxonomyToLabel(expectedTaxonomy)}'.`,
            path: `draft.inputs[${index}].asset.taxonomy`,
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Workflow input is malformed.";
      const taxonomyMismatch = message.includes("Workflow draft dataset input asset taxonomy")
        && message.includes("must match expected taxonomy");
      issues.push({
        code: taxonomyMismatch
          ? WorkflowValidationIssueCodes.inputDatasetAssetTaxonomyMismatch
          : WorkflowValidationIssueCodes.inputMalformed,
        section: WorkflowValidationSections.inputs,
        severity: "error",
        message,
        path: taxonomyMismatch ? `draft.inputs[${index}].asset.taxonomy` : `draft.inputs[${index}]`,
      });
    }
  }

  const normalizedSteps: WorkflowDraftStep[] = [];
  const steps = Array.isArray(raw.steps) ? raw.steps : [];
  for (let index = 0; index < steps.length; index += 1) {
    try {
      normalizedSteps.push(normalizeStep(steps[index] as WorkflowDraftStep));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Workflow step is malformed.";
      const taxonomyMismatch = message.includes("Workflow draft step assetRef asset taxonomy")
        && message.includes("must match expected taxonomy");
      issues.push({
        code: taxonomyMismatch
          ? WorkflowValidationIssueCodes.stepAssetTaxonomyMismatch
          : WorkflowValidationIssueCodes.stepMalformed,
        section: WorkflowValidationSections.steps,
        severity: "error",
        message,
        path: taxonomyMismatch ? `draft.steps[${index}].assetRef.asset.taxonomy` : `draft.steps[${index}]`,
      });
    }
  }

  const stepIds = new Set<string>(normalizedSteps.map((step) => step.id));
  const stepOrderById = new Map<string, number>(normalizedSteps.map((step) => [step.id, step.order]));
  const triggerValidation = validateWorkflowDraftTriggers(
    Array.isArray(raw.triggers) ? raw.triggers : [],
    {
      stepIds,
      allowedUserTriggerScopes: Object.freeze([
        WorkflowDraftUserTriggerScopes.workflowStart,
        WorkflowDraftUserTriggerScopes.workflowContinuation,
      ]),
    },
  );
  issues.push(...triggerValidation.issues);
  const sortedOrders = [...normalizedSteps].map((step) => step.order).sort((left, right) => left - right);
  if (sortedOrders.some((order, index) => order !== index + 1)) {
    issues.push({
      code: WorkflowValidationIssueCodes.stepOrderNonContiguous,
      section: WorkflowValidationSections.steps,
      severity: "error",
      message: "Workflow step order values must be contiguous and start at 1.",
      path: "draft.steps",
    });
  }

  const inputIds = new Set<string>(normalizedInputs.map((input) => input.id));
  const stepDependencies = new Map<string, ReadonlyArray<string>>();
  for (const step of normalizedSteps) {
    const dependencies = step.dependsOnStepIds ?? [];
    stepDependencies.set(step.id, dependencies);
    for (const dependency of dependencies) {
      if (dependency === step.id) {
        issues.push({
          code: WorkflowValidationIssueCodes.stepDependencySelf,
          section: WorkflowValidationSections.crossSection,
          severity: "error",
          message: `Step '${step.id}' cannot depend on itself.`,
          path: `draft.steps.${step.id}.dependsOnStepIds`,
        });
        continue;
      }
      if (!stepIds.has(dependency)) {
        issues.push({
          code: WorkflowValidationIssueCodes.stepDependencyMissing,
          section: WorkflowValidationSections.crossSection,
          severity: "error",
          message: `Step '${step.id}' depends on unknown step '${dependency}'.`,
          path: `draft.steps.${step.id}.dependsOnStepIds`,
        });
      }
    }

    if (step.kind === WorkflowDraftStepKinds.assetBacked && step.assetRef) {
      if (!step.assetRef.asset.assetId.startsWith("asset:")) {
        issues.push({
          code: WorkflowValidationIssueCodes.stepAssetReferenceMalformed,
          section: WorkflowValidationSections.steps,
          severity: "error",
          message: `Asset-backed step '${step.id}' asset '${step.assetRef.asset.assetId}' must use canonical 'asset:' identity.`,
          path: `draft.steps.${step.id}.assetRef.asset.assetId`,
        });
      }

      if (step.assetRef.assetKind === WorkflowDraftStepAssetKinds.agentAssistant) {
        const expectedTaxonomy = WorkflowDraftAssetReferenceTaxonomyExpectations[WorkflowDraftAssetReferenceKinds.agentAssistantStep];
        if (!taxonomyEquals(step.assetRef.asset.taxonomy, expectedTaxonomy)) {
          issues.push({
            code: WorkflowValidationIssueCodes.stepAssetTaxonomyMismatch,
            section: WorkflowValidationSections.steps,
            severity: "error",
            message: `Agent-assistant step '${step.id}' must align with taxonomy '${taxonomyToLabel(expectedTaxonomy)}'.`,
            path: `draft.steps.${step.id}.assetRef.asset.taxonomy`,
          });
        }
      }
    }

    if (!isBuiltInControlFlowStepType(step.type) || step.kind !== WorkflowDraftStepKinds.controlFlow || !step.config) {
      continue;
    }

    if (step.type === WorkflowDraftBuiltInStepTypes.ifThen) {
      const config = step.config as WorkflowDraftIfThenStepConfig;
      const thenStepIds = config.branches.then.stepIds ?? config.thenStepIds ?? [];
      const elseStepIds = config.branches.else?.stepIds ?? config.elseStepIds ?? [];
      for (const referenced of [...thenStepIds, ...elseStepIds]) {
        if (referenced === step.id) {
          issues.push({
            code: WorkflowValidationIssueCodes.builtInStepReferenceSelf,
            section: WorkflowValidationSections.crossSection,
            severity: "error",
            message: `Built-in if-then step '${step.id}' cannot reference itself.`,
            path: `draft.steps.${step.id}.config`,
          });
          continue;
        }
        if (!stepIds.has(referenced)) {
          issues.push({
            code: WorkflowValidationIssueCodes.builtInStepReferenceMissing,
            section: WorkflowValidationSections.crossSection,
            severity: "error",
            message: `Built-in if-then step '${step.id}' references unknown step '${referenced}'.`,
            path: `draft.steps.${step.id}.config`,
          });
          continue;
        }
        if ((stepOrderById.get(referenced) ?? 0) <= step.order) {
          issues.push({
            code: WorkflowValidationIssueCodes.builtInStepReferenceOrderInvalid,
            section: WorkflowValidationSections.crossSection,
            severity: "error",
            message: `Built-in if-then step '${step.id}' can only reference downstream steps. Referenced step '${referenced}' must appear after order ${step.order}.`,
            path: `draft.steps.${step.id}.config`,
          });
        }
      }
    }

    if (step.type === WorkflowDraftBuiltInStepTypes.loopIteration) {
      const config = step.config as WorkflowDraftLoopIterationStepConfig;
      for (const referenced of config.bodyStepIds ?? []) {
        if (referenced === step.id) {
          issues.push({
            code: WorkflowValidationIssueCodes.builtInStepReferenceSelf,
            section: WorkflowValidationSections.crossSection,
            severity: "error",
            message: `Built-in loop step '${step.id}' cannot include itself in bodyStepIds.`,
            path: `draft.steps.${step.id}.config`,
          });
          continue;
        }
        if (!stepIds.has(referenced)) {
          issues.push({
            code: WorkflowValidationIssueCodes.builtInStepReferenceMissing,
            section: WorkflowValidationSections.crossSection,
            severity: "error",
            message: `Built-in loop step '${step.id}' references unknown body step '${referenced}'.`,
            path: `draft.steps.${step.id}.config`,
          });
          continue;
        }
        if ((stepOrderById.get(referenced) ?? 0) <= step.order) {
          issues.push({
            code: WorkflowValidationIssueCodes.builtInStepReferenceOrderInvalid,
            section: WorkflowValidationSections.crossSection,
            severity: "error",
            message: `Built-in loop step '${step.id}' can only reference downstream body steps. Referenced step '${referenced}' must appear after order ${step.order}.`,
            path: `draft.steps.${step.id}.config`,
          });
        }
      }

      const collectionInputKey = config.collection?.inputKey ?? config.collectionInputKey;
      if (
        config.mode === WorkflowDraftLoopIterationModes.collection
        && collectionInputKey
        && !inputIds.has(collectionInputKey)
      ) {
        issues.push({
          code: WorkflowValidationIssueCodes.loopCollectionInputMissing,
          section: WorkflowValidationSections.crossSection,
          severity: "error",
          message: `Built-in loop step '${step.id}' collection input '${collectionInputKey}' does not match any workflow input id.`,
          path: `draft.steps.${step.id}.config.collection.inputKey`,
        });
      }
    }

    if (step.type === WorkflowDraftBuiltInStepTypes.manualApproval) {
      const config = step.config as WorkflowDraftManualApprovalStepConfig;
      const referencedStepIds = [
        ...(config.outcomes.continue?.stepIds ?? []),
        ...(config.outcomes.approve?.stepIds ?? []),
        ...(config.outcomes.reject?.stepIds ?? []),
      ];
      for (const referenced of referencedStepIds) {
        if (referenced === step.id) {
          issues.push({
            code: WorkflowValidationIssueCodes.builtInStepReferenceSelf,
            section: WorkflowValidationSections.crossSection,
            severity: "error",
            message: `Built-in manual step '${step.id}' cannot reference itself in outcomes.`,
            path: `draft.steps.${step.id}.config`,
          });
          continue;
        }
        if (!stepIds.has(referenced)) {
          issues.push({
            code: WorkflowValidationIssueCodes.builtInStepReferenceMissing,
            section: WorkflowValidationSections.crossSection,
            severity: "error",
            message: `Built-in manual step '${step.id}' references unknown outcome step '${referenced}'.`,
            path: `draft.steps.${step.id}.config`,
          });
          continue;
        }
        if ((stepOrderById.get(referenced) ?? 0) <= step.order) {
          issues.push({
            code: WorkflowValidationIssueCodes.builtInStepReferenceOrderInvalid,
            section: WorkflowValidationSections.crossSection,
            severity: "error",
            message: `Built-in manual step '${step.id}' can only reference downstream outcome steps. Referenced step '${referenced}' must appear after order ${step.order}.`,
            path: `draft.steps.${step.id}.config`,
          });
        }
      }
    }
  }

  if (validateStepDependencyCycles(stepDependencies)) {
    issues.push({
      code: WorkflowValidationIssueCodes.stepDependencyCycle,
      section: WorkflowValidationSections.crossSection,
      severity: "error",
      message: "Workflow step dependencies cannot contain cycles.",
      path: "draft.steps",
    });
  }

  const outputs = Array.isArray(raw.outputs) ? raw.outputs : [];
  for (let index = 0; index < outputs.length; index += 1) {
    try {
      const normalized = normalizeOutput(outputs[index] as WorkflowDraftOutput);
      if (normalized.sourceStepId && !stepIds.has(normalized.sourceStepId)) {
        issues.push({
          code: WorkflowValidationIssueCodes.outputSourceStepMissing,
          section: WorkflowValidationSections.crossSection,
          severity: "error",
          message: `Workflow output '${normalized.id}' references unknown sourceStepId '${normalized.sourceStepId}'.`,
          path: `draft.outputs[${index}].sourceStepId`,
        });
      }

      if (normalized.destination.type === WorkflowDraftOutputDestinationTypes.fileExport) {
        const validFormats = new Set<string>([
          WorkflowDraftOutputFormats.pdf,
          WorkflowDraftOutputFormats.json,
          WorkflowDraftOutputFormats.jsonl,
          WorkflowDraftOutputFormats.csv,
          WorkflowDraftOutputFormats.markdown,
          WorkflowDraftOutputFormats.html,
        ]);
        if (!validFormats.has(normalized.format)) {
          issues.push({
            code: WorkflowValidationIssueCodes.outputFileFormatInvalid,
            section: WorkflowValidationSections.outputs,
            severity: "error",
            message: `File export output '${normalized.id}' format '${normalized.format}' is not supported.`,
            path: `draft.outputs[${index}].format`,
          });
        }
      }

      if (normalized.destination.type === WorkflowDraftOutputDestinationTypes.webViewer) {
        if (!normalized.title?.trim()) {
          issues.push({
            code: WorkflowValidationIssueCodes.outputViewerTitleMissing,
            section: WorkflowValidationSections.outputs,
            severity: "error",
            message: `Web viewer output '${normalized.id}' requires a title.`,
            path: `draft.outputs[${index}].title`,
          });
        }
      }

      if (normalized.destination.type === WorkflowDraftOutputDestinationTypes.systemEntry) {
        const entityName = readDestinationOptionString(normalized, "entityName");
        if (!entityName) {
          issues.push({
            code: WorkflowValidationIssueCodes.outputSystemEntityMissing,
            section: WorkflowValidationSections.outputs,
            severity: "error",
            message: `System record output '${normalized.id}' requires destination options.entityName.`,
            path: `draft.outputs[${index}].destination.options.entityName`,
          });
        }
      }
    } catch (error) {
      issues.push({
        code: WorkflowValidationIssueCodes.outputMalformed,
        section: WorkflowValidationSections.outputs,
        severity: "error",
        message: error instanceof Error ? error.message : "Workflow output is malformed.",
        path: `draft.outputs[${index}]`,
      });
    }
  }

  return buildWorkflowValidationResult(issues);
}

export function validateWorkflowEntity(entity: WorkflowEntity): WorkflowValidationResult {
  const issues: WorkflowValidationIssue[] = [];
  if (!entity.id.trim()) {
    issues.push({
      code: WorkflowValidationIssueCodes.entityIdMissing,
      section: WorkflowValidationSections.entity,
      severity: "error",
      message: "Workflow entity id is required.",
      path: "id",
    });
  }
  if (!entity.name.trim()) {
    issues.push({
      code: WorkflowValidationIssueCodes.entityNameMissing,
      section: WorkflowValidationSections.entity,
      severity: "error",
      message: "Workflow entity name is required.",
      path: "name",
    });
  }
  if (!Number.isInteger(entity.draftRevision) || entity.draftRevision < 1) {
    issues.push({
      code: WorkflowValidationIssueCodes.entityDraftRevisionInvalid,
      section: WorkflowValidationSections.entity,
      severity: "error",
      message: "Workflow entity draftRevision must be a positive integer.",
      path: "draftRevision",
    });
  }
  if (!isValidTimestamp(entity.createdAt)) {
    issues.push({
      code: WorkflowValidationIssueCodes.entityCreatedAtInvalid,
      section: WorkflowValidationSections.entity,
      severity: "error",
      message: "Workflow entity createdAt must be a valid timestamp.",
      path: "createdAt",
    });
  }
  if (!isValidTimestamp(entity.updatedAt)) {
    issues.push({
      code: WorkflowValidationIssueCodes.entityUpdatedAtInvalid,
      section: WorkflowValidationSections.entity,
      severity: "error",
      message: "Workflow entity updatedAt must be a valid timestamp.",
      path: "updatedAt",
    });
  }
  if (!isWorkflowLifecycleState(entity.lifecycleState)) {
    issues.push({
      code: WorkflowValidationIssueCodes.lifecycleStateInvalid,
      section: WorkflowValidationSections.lifecycle,
      severity: "error",
      message: `Workflow lifecycle state '${entity.lifecycleState}' is not supported.`,
      path: "lifecycleState",
    });
  }

  const draftValidation = validateWorkflowDraft(entity.draft);
  issues.push(...draftValidation.issues);
  if (entity.lifecycleState === WorkflowLifecycleStates.executable && !draftValidation.valid) {
    issues.push({
      code: WorkflowValidationIssueCodes.lifecycleExecutableNotReady,
      section: WorkflowValidationSections.lifecycle,
      severity: "error",
      message: "Workflow lifecycle state 'executable' requires a valid canonical workflow draft.",
      path: "lifecycleState",
    });
  }

  return buildWorkflowValidationResult(issues);
}

export function isWorkflowLifecycleTransitionAllowed(fromState: WorkflowLifecycleState, toState: WorkflowLifecycleState): boolean {
  if (fromState === toState) {
    return true;
  }

  if (fromState === WorkflowLifecycleStates.draft) {
    return toState === WorkflowLifecycleStates.saved;
  }
  if (fromState === WorkflowLifecycleStates.saved) {
    return toState === WorkflowLifecycleStates.draft || toState === WorkflowLifecycleStates.executable;
  }

  return fromState === WorkflowLifecycleStates.executable && toState === WorkflowLifecycleStates.saved;
}

export function transitionWorkflowEntityLifecycle(
  entity: WorkflowEntity,
  targetState: WorkflowLifecycleState,
  now: Date = new Date(),
): WorkflowEntity {
  if (!isWorkflowLifecycleTransitionAllowed(entity.lifecycleState, targetState)) {
    throw new WorkflowLifecycleTransitionError(entity.lifecycleState, targetState);
  }

  if (targetState === WorkflowLifecycleStates.executable) {
    const draftValidation = validateWorkflowDraft(entity.draft);
    if (!draftValidation.valid) {
      throw new WorkflowLifecycleTransitionError(
        entity.lifecycleState,
        targetState,
        "canonical workflow draft is not executable-ready",
      );
    }
  }

  if (targetState === entity.lifecycleState) {
    return entity;
  }

  return Object.freeze({
    ...entity,
    lifecycleState: targetState,
    updatedAt: now.toISOString(),
  });
}

export function mapWorkflowDraftToPersistenceRecord(draft: WorkflowDraft): WorkflowDraftPersistenceRecord {
  return cloneRecord(normalizeWorkflowDraft(draft));
}

export function mapWorkflowDraftFromPersistenceRecord(record: WorkflowDraftPersistenceRecord): WorkflowDraft {
  return normalizeWorkflowDraft({
    triggers: Array.isArray(record.triggers) ? record.triggers as ReadonlyArray<WorkflowDraftTrigger> : [],
    inputs: Array.isArray(record.inputs) ? record.inputs as ReadonlyArray<WorkflowDraftInput> : [],
    steps: Array.isArray(record.steps) ? record.steps as ReadonlyArray<WorkflowDraftStep> : [],
    outputs: Array.isArray(record.outputs) ? record.outputs as ReadonlyArray<WorkflowDraftOutput> : [],
  });
}

export function mapWorkflowEntityToPersistenceRecord(entity: WorkflowEntity): WorkflowEntityPersistenceRecord {
  const normalizedEntityId = normalizeRequired(entity.id, "Workflow entity id");
  const normalizedName = normalizeRequired(entity.name, "Workflow entity name");
  const metadata = Object.freeze({
    summary: normalizeOptional(entity.metadata?.summary),
    tags: normalizeTags(entity.metadata?.tags),
  });
  const lifecycleState = normalizeWorkflowLifecycleState(entity.lifecycleState);
  if (!Number.isInteger(entity.draftRevision) || entity.draftRevision < 1) {
    throw new Error("Workflow entity draftRevision must be a positive integer.");
  }
  if (!isValidTimestamp(entity.createdAt)) {
    throw new Error("Workflow entity createdAt must be a valid timestamp.");
  }
  if (!isValidTimestamp(entity.updatedAt)) {
    throw new Error("Workflow entity updatedAt must be a valid timestamp.");
  }

  return Object.freeze({
    id: normalizedEntityId,
    name: normalizedName,
    metadata,
    draft: mapWorkflowDraftToPersistenceRecord(entity.draft),
    lifecycleState,
    draftRevision: entity.draftRevision,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  });
}

export function mapWorkflowEntityFromPersistenceRecord(record: WorkflowEntityPersistenceRecord): WorkflowEntity {
  const normalizedRecord = assertRecord(record, "Workflow entity persistence record") as WorkflowEntityPersistenceRecord;
  const lifecycleState = normalizeWorkflowLifecycleState(
    normalizeRequired(normalizedRecord.lifecycleState, "Workflow entity lifecycle state"),
  );
  const draft = mapWorkflowDraftFromPersistenceRecord(normalizedRecord.draft);
  if (lifecycleState === WorkflowLifecycleStates.executable && !validateWorkflowDraft(draft).valid) {
    throw new Error("Workflow lifecycle state 'executable' requires a valid canonical workflow draft.");
  }

  const entity: WorkflowEntity = Object.freeze({
    id: normalizeRequired(normalizedRecord.id, "Workflow entity id"),
    name: normalizeRequired(normalizedRecord.name, "Workflow entity name"),
    metadata: Object.freeze({
      summary: normalizeOptional(normalizedRecord.metadata?.summary),
      tags: normalizeTags(normalizedRecord.metadata?.tags),
    }),
    draft,
    lifecycleState,
    draftRevision: normalizedRecord.draftRevision,
    createdAt: normalizeRequired(normalizedRecord.createdAt, "Workflow entity createdAt"),
    updatedAt: normalizeRequired(normalizedRecord.updatedAt, "Workflow entity updatedAt"),
  });

  if (!isValidTimestamp(entity.createdAt)) {
    throw new Error("Workflow entity createdAt must be a valid timestamp.");
  }
  if (!isValidTimestamp(entity.updatedAt)) {
    throw new Error("Workflow entity updatedAt must be a valid timestamp.");
  }
  if (!Number.isInteger(entity.draftRevision) || entity.draftRevision < 1) {
    throw new Error("Workflow entity draftRevision must be a positive integer.");
  }
  return entity;
}

export function serializeWorkflowDraft(draft: WorkflowDraft): string {
  return stableStringify(mapWorkflowDraftToPersistenceRecord(draft));
}

export function deserializeWorkflowDraft(serializedDraft: string): WorkflowDraft {
  const normalizedPayload = normalizeRequired(serializedDraft, "Workflow draft payload");
  const parsed = JSON.parse(normalizedPayload);
  const record = assertRecord(parsed, "Workflow draft payload") as Record<string, unknown>;
  if (record.schemaVersion === WorkflowDraftDocumentSchemaVersion) {
    const draftRecord = assertRecord(record.draft, "Workflow draft payload draft");
    return mapWorkflowDraftFromPersistenceRecord(draftRecord as WorkflowDraftPersistenceRecord);
  }

  return mapWorkflowDraftFromPersistenceRecord(record as WorkflowDraftPersistenceRecord);
}

export function serializeWorkflowDraftDocument(draft: WorkflowDraft): string {
  const document: WorkflowDraftSerializedDocument = Object.freeze({
    schemaVersion: WorkflowDraftDocumentSchemaVersion,
    draft: mapWorkflowDraftToPersistenceRecord(draft),
  });
  return stableStringify(document);
}

export function deserializeWorkflowDraftDocument(serializedDraft: string): WorkflowDraft {
  const normalizedPayload = normalizeRequired(serializedDraft, "Workflow draft payload");
  const parsed = assertRecord(JSON.parse(normalizedPayload), "Workflow draft payload");
  if (parsed.schemaVersion !== WorkflowDraftDocumentSchemaVersion) {
    throw new Error(
      `Workflow draft schema version '${String(parsed.schemaVersion)}' is not supported. Expected '${WorkflowDraftDocumentSchemaVersion}'.`,
    );
  }
  const draftRecord = assertRecord(parsed.draft, "Workflow draft payload draft");
  return mapWorkflowDraftFromPersistenceRecord(draftRecord as WorkflowDraftPersistenceRecord);
}

export function serializeWorkflowEntity(entity: WorkflowEntity): string {
  const document: WorkflowEntitySerializedDocument = Object.freeze({
    schemaVersion: WorkflowEntityDocumentSchemaVersion,
    entity: mapWorkflowEntityToPersistenceRecord(entity),
  });
  return stableStringify(document);
}

export function deserializeWorkflowEntity(serializedEntity: string): WorkflowEntity {
  const normalizedPayload = normalizeRequired(serializedEntity, "Workflow entity payload");
  const parsed = assertRecord(JSON.parse(normalizedPayload), "Workflow entity payload");
  if (parsed.schemaVersion === WorkflowEntityDocumentSchemaVersion) {
    const entityRecord = assertRecord(parsed.entity, "Workflow entity payload entity");
    return mapWorkflowEntityFromPersistenceRecord(entityRecord as WorkflowEntityPersistenceRecord);
  }

  return mapWorkflowEntityFromPersistenceRecord(parsed as WorkflowEntityPersistenceRecord);
}

export function createWorkflowEntity(input: {
  readonly id: string;
  readonly name: string;
  readonly metadata?: WorkflowEntityMetadata;
  readonly draft?: WorkflowDraft;
  readonly lifecycleState?: WorkflowLifecycleState;
  readonly draftRevision?: number;
  readonly now?: Date;
}): WorkflowEntity {
  const id = normalizeRequired(input.id, "Workflow entity id");
  const name = normalizeRequired(input.name, "Workflow entity name");
  const now = (input.now ?? new Date()).toISOString();
  const metadata = Object.freeze({
    summary: normalizeOptional(input.metadata?.summary),
    tags: normalizeTags(input.metadata?.tags),
  });

  const draftRevision = input.draftRevision ?? 1;
  if (!Number.isInteger(draftRevision) || draftRevision < 1) {
    throw new Error("Workflow entity draftRevision must be a positive integer.");
  }
  const draft = normalizeWorkflowDraft(input.draft);
  const lifecycleState = normalizeWorkflowLifecycleState(input.lifecycleState ?? WorkflowLifecycleStates.draft);
  if (lifecycleState === WorkflowLifecycleStates.executable && !validateWorkflowDraft(draft).valid) {
    throw new Error("Workflow lifecycle state 'executable' requires a valid canonical workflow draft.");
  }

  return Object.freeze({
    id,
    name,
    metadata,
    draft,
    lifecycleState,
    draftRevision,
    createdAt: now,
    updatedAt: now,
  });
}

export const WorkflowStudioIdentity = Object.freeze({
  studioType: "workflow-studio",
  defaultStudioId: "studio-workflows",
  defaultStudioName: "Workflow Studio",
});

export function createWorkflowStudioTaxonomy(
  behaviorKind: Extract<TaxonomyBehaviorKind, "deterministic" | "conditional" | "iterative"> = TaxonomyBehaviorKinds.deterministic,
) {
  return createCompositionTaxonomyDescriptor({
    structuralKind: TaxonomyStructuralKinds.composite,
    semanticRole: TaxonomySemanticRoles.workflow,
    behaviorKind,
  });
}

export function createWorkflowAssetMetadata(input: {
  readonly title: string;
  readonly summary?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly creatorId?: string;
  readonly sourceLabel?: string;
  readonly behaviorKind?: Extract<TaxonomyBehaviorKind, "deterministic" | "conditional" | "iterative">;
  readonly contract?: AssetContractDescriptor;
}): AssetMetadata {
  return Object.freeze({
    title: input.title,
    summary: input.summary,
    tags: Object.freeze(["workflow", ...(input.tags ?? [])]),
    taxonomy: createWorkflowStudioTaxonomy(input.behaviorKind),
    contract: input.contract,
    provenance: {
      creatorId: input.creatorId,
      sourceType: "generated",
      sourceLabel: input.sourceLabel ?? WorkflowStudioIdentity.studioType,
    },
  });
}
