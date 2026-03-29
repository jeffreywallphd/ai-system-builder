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

export interface WorkflowDraftSectionItemBase {
  readonly id: string;
  readonly type: string;
  readonly title?: string;
  readonly description?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface WorkflowDraftTrigger extends WorkflowDraftSectionItemBase {}
export interface WorkflowDraftInput extends WorkflowDraftSectionItemBase {}
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

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
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
): ReadonlyArray<T> {
  const normalized: T[] = [];
  const seenIds = new Set<string>();

  for (const item of items) {
    const normalizedItem = normalizeSectionItem(item, sectionName);
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
    triggers: normalizeSectionItems("Workflow draft trigger", draft.triggers ?? []),
    inputs: normalizeSectionItems("Workflow draft input", draft.inputs ?? []),
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
