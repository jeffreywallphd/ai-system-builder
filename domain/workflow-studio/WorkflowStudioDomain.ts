import type { AssetContractDescriptor } from "../contracts/AssetContract";
import type { AssetMetadata } from "../studio-shell/StudioShellDomain";
import {
  createCompositionTaxonomyDescriptor,
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
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

export interface WorkflowDraftOutput extends WorkflowDraftSectionItemBase {}

export interface WorkflowDraftStep extends WorkflowDraftSectionItemBase {
  readonly order: number;
  readonly dependsOnStepIds?: ReadonlyArray<string>;
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
  readonly draftRevision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

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

function normalizeTriggerKind(value: string): WorkflowDraftTriggerKind {
  if (value === WorkflowDraftTriggerKinds.user || value === WorkflowDraftTriggerKinds.temporal || value === WorkflowDraftTriggerKinds.state) {
    return value;
  }
  throw new Error(`Workflow draft trigger kind '${value}' is not supported.`);
}

function normalizeWorkflowDraftAssetReference(reference: WorkflowDraftAssetReference, label: string): WorkflowDraftAssetReference {
  const assetId = normalizeRequired(reference.assetId, `${label} asset id`);
  const versionId = normalizeOptional(reference.versionId);
  return Object.freeze({ assetId, versionId });
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
    const asset = normalizeWorkflowDraftAssetReference(datasetInput.asset, "Workflow draft dataset input asset");
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

  return Object.freeze({
    ...normalizedStep,
    dependsOnStepIds: dedupedDependencies.size > 0
      ? Object.freeze([...dedupedDependencies.values()])
      : undefined,
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
    outputs: normalizeSectionItems("Workflow draft output", draft.outputs ?? []),
  });
}

export function serializeWorkflowDraft(draft: WorkflowDraft): string {
  return JSON.stringify(normalizeWorkflowDraft(draft), null, 2);
}

export function deserializeWorkflowDraft(serializedDraft: string): WorkflowDraft {
  const normalizedPayload = normalizeRequired(serializedDraft, "Workflow draft payload");
  const parsed = JSON.parse(normalizedPayload);
  const record = assertRecord(parsed, "Workflow draft payload");

  return normalizeWorkflowDraft({
    triggers: Array.isArray(record.triggers) ? record.triggers as ReadonlyArray<WorkflowDraftTrigger> : [],
    inputs: Array.isArray(record.inputs) ? record.inputs as ReadonlyArray<WorkflowDraftInput> : [],
    steps: Array.isArray(record.steps) ? record.steps as ReadonlyArray<WorkflowDraftStep> : [],
    outputs: Array.isArray(record.outputs) ? record.outputs as ReadonlyArray<WorkflowDraftOutput> : [],
  });
}

export function createWorkflowEntity(input: {
  readonly id: string;
  readonly name: string;
  readonly metadata?: WorkflowEntityMetadata;
  readonly draft?: WorkflowDraft;
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

  return Object.freeze({
    id,
    name,
    metadata,
    draft: normalizeWorkflowDraft(input.draft),
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
