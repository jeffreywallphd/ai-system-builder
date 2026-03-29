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
  readonly buttonId?: string;
  readonly requiresConfirmation?: boolean;
  readonly allowedRoles?: ReadonlyArray<string>;
}

export interface WorkflowDraftTemporalTriggerConfig {
  readonly cronExpression?: string;
  readonly every?: number;
  readonly unit?: "minutes" | "hours" | "days" | "weeks";
  readonly timezone?: string;
  readonly startAt?: string;
  readonly endAt?: string;
}

export interface WorkflowDraftStateTriggerConfig {
  readonly eventName?: string;
  readonly asset?: WorkflowDraftAssetReference;
  readonly stateKey?: string;
  readonly stateValue?: string;
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
});

export type WorkflowDraftBuiltInStepType = typeof WorkflowDraftBuiltInStepTypes[keyof typeof WorkflowDraftBuiltInStepTypes];

export const WorkflowDraftLoopIterationModes = Object.freeze({
  collection: "collection",
  range: "range",
});

export type WorkflowDraftLoopIterationMode = typeof WorkflowDraftLoopIterationModes[keyof typeof WorkflowDraftLoopIterationModes];

export interface WorkflowDraftIfThenStepConfig {
  readonly conditionExpression: string;
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

export interface WorkflowDraftLoopIterationStepConfig {
  readonly repeatCount?: number;
  readonly loopConditionExpression?: string;
  readonly loopLabel?: string;
  readonly iterationMode?: WorkflowDraftLoopIterationMode;
  readonly bodyStepIds?: ReadonlyArray<string>;
  readonly itemAlias?: string;
  readonly collectionInputKey?: string;
  readonly range?: WorkflowDraftLoopRangeConfig;
  readonly maxIterations?: number;
}

export interface WorkflowDraftDelayWaitStepConfig {
  readonly durationSeconds: number;
  readonly note?: string;
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
  triggerMalformed: "trigger-malformed",
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

function normalizeUserTrigger(
  item: WorkflowDraftSectionItemBase,
  trigger: WorkflowDraftTrigger,
): WorkflowDraftUserTrigger {
  if (
    trigger.type !== WorkflowDraftTriggerTypes.userManual
    && trigger.type !== WorkflowDraftTriggerTypes.userButtonClick
    && trigger.type !== WorkflowDraftTriggerTypes.userInitiatedRun
  ) {
    throw new Error(`Workflow draft trigger type '${trigger.type}' is not valid for kind '${WorkflowDraftTriggerKinds.user}'.`);
  }

  const configRecord = assertRecord(trigger.config ?? {}, "Workflow draft trigger config");
  const buttonId = normalizeOptional(typeof configRecord.buttonId === "string" ? configRecord.buttonId : undefined);
  if (trigger.type === WorkflowDraftTriggerTypes.userButtonClick && !buttonId) {
    throw new Error("Workflow draft user button-click trigger requires config.buttonId.");
  }

  return Object.freeze({
    ...item,
    kind: WorkflowDraftTriggerKinds.user,
    type: trigger.type,
    config: Object.freeze({
      buttonId,
      requiresConfirmation: normalizeOptionalBoolean(configRecord.requiresConfirmation, "Workflow draft user trigger config.requiresConfirmation"),
      allowedRoles: normalizeStringArray(configRecord.allowedRoles, "Workflow draft user trigger config.allowedRoles"),
    }),
  });
}

function normalizeTemporalTrigger(
  item: WorkflowDraftSectionItemBase,
  trigger: WorkflowDraftTrigger,
): WorkflowDraftTemporalTrigger {
  if (
    trigger.type !== WorkflowDraftTriggerTypes.temporalSchedule
    && trigger.type !== WorkflowDraftTriggerTypes.temporalRecurring
  ) {
    throw new Error(`Workflow draft trigger type '${trigger.type}' is not valid for kind '${WorkflowDraftTriggerKinds.temporal}'.`);
  }

  const configRecord = assertRecord(trigger.config ?? {}, "Workflow draft trigger config");
  const cronExpression = normalizeOptional(typeof configRecord.cronExpression === "string" ? configRecord.cronExpression : undefined);
  const every = normalizePositiveInteger(configRecord.every, "Workflow draft temporal trigger config.every");
  const unit = normalizeOptional(typeof configRecord.unit === "string" ? configRecord.unit : undefined);
  const normalizedUnit = unit && ["minutes", "hours", "days", "weeks"].includes(unit)
    ? unit as WorkflowDraftTemporalTriggerConfig["unit"]
    : undefined;
  if (unit && !normalizedUnit) {
    throw new Error(`Workflow draft temporal trigger config.unit '${unit}' is not supported.`);
  }

  if (trigger.type === WorkflowDraftTriggerTypes.temporalSchedule && !cronExpression) {
    throw new Error("Workflow draft temporal schedule trigger requires config.cronExpression.");
  }
  if (trigger.type === WorkflowDraftTriggerTypes.temporalRecurring && (!every || !normalizedUnit)) {
    throw new Error("Workflow draft temporal recurring trigger requires config.every and config.unit.");
  }

  return Object.freeze({
    ...item,
    kind: WorkflowDraftTriggerKinds.temporal,
    type: trigger.type,
    config: Object.freeze({
      cronExpression,
      every,
      unit: normalizedUnit,
      timezone: normalizeOptional(typeof configRecord.timezone === "string" ? configRecord.timezone : undefined),
      startAt: normalizeOptional(typeof configRecord.startAt === "string" ? configRecord.startAt : undefined),
      endAt: normalizeOptional(typeof configRecord.endAt === "string" ? configRecord.endAt : undefined),
    }),
  });
}

function normalizeStateTrigger(
  item: WorkflowDraftSectionItemBase,
  trigger: WorkflowDraftTrigger,
): WorkflowDraftStateTrigger {
  if (
    trigger.type !== WorkflowDraftTriggerTypes.stateDataAvailable
    && trigger.type !== WorkflowDraftTriggerTypes.stateAssetStateChanged
    && trigger.type !== WorkflowDraftTriggerTypes.stateSystemEvent
  ) {
    throw new Error(`Workflow draft trigger type '${trigger.type}' is not valid for kind '${WorkflowDraftTriggerKinds.state}'.`);
  }

  const configRecord = assertRecord(trigger.config ?? {}, "Workflow draft trigger config");
  const eventName = normalizeOptional(typeof configRecord.eventName === "string" ? configRecord.eventName : undefined);
  const stateKey = normalizeOptional(typeof configRecord.stateKey === "string" ? configRecord.stateKey : undefined);
  const stateValue = normalizeOptional(typeof configRecord.stateValue === "string" ? configRecord.stateValue : undefined);
  const filter = configRecord.filter ? Object.freeze({ ...assertRecord(configRecord.filter, "Workflow draft state trigger config.filter") }) : undefined;
  const assetRecord = configRecord.asset
    ? normalizeWorkflowDraftAssetReference(
      assertRecord(configRecord.asset, "Workflow draft state trigger config.asset") as WorkflowDraftAssetReference,
      "Workflow draft state trigger config.asset",
    )
    : undefined;

  if (trigger.type === WorkflowDraftTriggerTypes.stateAssetStateChanged && !assetRecord) {
    throw new Error("Workflow draft state asset-state-changed trigger requires config.asset.");
  }
  if (trigger.type === WorkflowDraftTriggerTypes.stateSystemEvent && !eventName) {
    throw new Error("Workflow draft state system-event trigger requires config.eventName.");
  }

  return Object.freeze({
    ...item,
    kind: WorkflowDraftTriggerKinds.state,
    type: trigger.type,
    config: Object.freeze({
      eventName,
      asset: assetRecord,
      stateKey,
      stateValue,
      filter,
    }),
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

  switch (step.type) {
    case WorkflowDraftBuiltInStepTypes.ifThen:
      return normalizeIfThenStepConfig(configRecord);
    case WorkflowDraftBuiltInStepTypes.loopIteration:
      return normalizeLoopIterationStepConfig(configRecord);
    case WorkflowDraftBuiltInStepTypes.delayWait:
      return normalizeDelayWaitStepConfig(configRecord);
    default:
      return Object.freeze({ ...configRecord });
  }
}

function isBuiltInControlFlowStepType(value: string): value is WorkflowDraftBuiltInStepType {
  return value === WorkflowDraftBuiltInStepTypes.ifThen
    || value === WorkflowDraftBuiltInStepTypes.loopIteration
    || value === WorkflowDraftBuiltInStepTypes.delayWait;
}

function normalizeIfThenStepConfig(configRecord: Readonly<Record<string, unknown>>): Readonly<WorkflowDraftIfThenStepConfig> {
  const conditionExpression = normalizeRequired(
    typeof configRecord.conditionExpression === "string" ? configRecord.conditionExpression : "",
    "Workflow draft if-then step config.conditionExpression",
  );
  const thenLabel = normalizeOptional(typeof configRecord.thenLabel === "string" ? configRecord.thenLabel : undefined);
  const elseLabel = normalizeOptional(typeof configRecord.elseLabel === "string" ? configRecord.elseLabel : undefined);
  const thenStepIds = normalizeStringArray(configRecord.thenStepIds, "Workflow draft if-then step config.thenStepIds");
  const elseStepIds = normalizeStringArray(configRecord.elseStepIds, "Workflow draft if-then step config.elseStepIds");
  if (thenStepIds && elseStepIds && elseStepIds.some((stepId) => thenStepIds.includes(stepId))) {
    throw new Error("Workflow draft if-then step config elseStepIds cannot overlap thenStepIds.");
  }

  return Object.freeze({
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
  const repeatCount = normalizePositiveInteger(configRecord.repeatCount, "Workflow draft loop-iteration step config.repeatCount");
  const loopConditionExpression = normalizeOptional(
    typeof configRecord.loopConditionExpression === "string" ? configRecord.loopConditionExpression : undefined,
  );
  const loopLabel = normalizeOptional(typeof configRecord.loopLabel === "string" ? configRecord.loopLabel : undefined);

  const iterationModeRaw = normalizeOptional(
    typeof configRecord.iterationMode === "string" ? configRecord.iterationMode : undefined,
  );
  if (
    iterationModeRaw
    && iterationModeRaw !== WorkflowDraftLoopIterationModes.collection
    && iterationModeRaw !== WorkflowDraftLoopIterationModes.range
  ) {
    throw new Error(`Workflow draft loop-iteration step config.iterationMode '${iterationModeRaw}' is not supported.`);
  }
  const iterationMode = iterationModeRaw as WorkflowDraftLoopIterationMode | undefined;
  const bodyStepIds = normalizeStringArray(configRecord.bodyStepIds, "Workflow draft loop-iteration step config.bodyStepIds");
  const itemAlias = normalizeOptional(typeof configRecord.itemAlias === "string" ? configRecord.itemAlias : undefined);
  const maxIterations = normalizePositiveInteger(configRecord.maxIterations, "Workflow draft loop-iteration step config.maxIterations");
  const collectionInputKey = normalizeOptional(
    typeof configRecord.collectionInputKey === "string" ? configRecord.collectionInputKey : undefined,
  );

  if (iterationMode === WorkflowDraftLoopIterationModes.collection && !collectionInputKey) {
    throw new Error("Workflow draft loop-iteration collection mode requires config.collectionInputKey.");
  }

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

  if (iterationMode === WorkflowDraftLoopIterationModes.range && !range) {
    throw new Error("Workflow draft loop-iteration range mode requires config.range.");
  }
  if (iterationMode === WorkflowDraftLoopIterationModes.range && range && range.start > range.end) {
    throw new Error("Workflow draft loop-iteration step config.range.start must be less than or equal to range.end.");
  }
  if (!repeatCount && !loopConditionExpression && !iterationMode) {
    throw new Error("Workflow draft loop-iteration step requires config.repeatCount or config.loopConditionExpression.");
  }

  return Object.freeze({
    repeatCount,
    loopConditionExpression,
    loopLabel,
    iterationMode,
    bodyStepIds,
    itemAlias,
    collectionInputKey,
    range,
    maxIterations,
  });
}

function normalizeDelayWaitStepConfig(
  configRecord: Readonly<Record<string, unknown>>,
): Readonly<WorkflowDraftDelayWaitStepConfig> {
  const durationSeconds = normalizePositiveInteger(
    configRecord.durationSeconds,
    "Workflow draft delay-wait step config.durationSeconds",
  );
  if (!durationSeconds) {
    throw new Error("Workflow draft delay-wait step requires config.durationSeconds.");
  }
  const note = normalizeOptional(typeof configRecord.note === "string" ? configRecord.note : undefined);
  return Object.freeze({
    durationSeconds,
    note,
  });
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

  const triggers = Array.isArray(raw.triggers) ? raw.triggers : [];
  for (let index = 0; index < triggers.length; index += 1) {
    try {
      normalizeTrigger(triggers[index] as WorkflowDraftTrigger);
    } catch (error) {
      issues.push({
        code: WorkflowValidationIssueCodes.triggerMalformed,
        section: WorkflowValidationSections.triggers,
        severity: "error",
        message: error instanceof Error ? error.message : "Workflow trigger is malformed.",
        path: `draft.triggers[${index}]`,
      });
    }
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
      for (const referenced of [...(config.thenStepIds ?? []), ...(config.elseStepIds ?? [])]) {
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
        }
      }

      if (
        config.iterationMode === WorkflowDraftLoopIterationModes.collection
        && config.collectionInputKey
        && !inputIds.has(config.collectionInputKey)
      ) {
        issues.push({
          code: WorkflowValidationIssueCodes.loopCollectionInputMissing,
          section: WorkflowValidationSections.crossSection,
          severity: "error",
          message: `Built-in loop step '${step.id}' collectionInputKey '${config.collectionInputKey}' does not match any workflow input id.`,
          path: `draft.steps.${step.id}.config.collectionInputKey`,
        });
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
