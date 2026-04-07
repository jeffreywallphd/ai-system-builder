import {
  WorkflowDraftInputSourceTypes,
  WorkflowDraftInputValueTypes,
  type WorkflowDraft,
  type WorkflowDraftDatasetInput,
  type WorkflowDraftInput,
} from "../../../src/domain/workflow-studio/WorkflowStudioDomain";
import {
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
  createCompositionTaxonomyDescriptor,
} from "../../../src/domain/taxonomy/CompositionTaxonomy";

export interface WorkflowDatasetAssetCandidate {
  readonly assetId: string;
  readonly versionId?: string;
  readonly name?: string;
}

export interface WorkflowDatasetInlineReturnPayload {
  readonly status: "created" | "cancelled";
  readonly assetId?: string;
  readonly versionId?: string;
}

const datasetInputTaxonomy = createCompositionTaxonomyDescriptor({
  structuralKind: TaxonomyStructuralKinds.atomic,
  semanticRole: TaxonomySemanticRoles.dataset,
  behaviorKind: TaxonomyBehaviorKinds.none,
});

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function isCanonicalAssetIdentity(value: string | undefined): boolean {
  if (!value) {
    return true;
  }
  const normalized = value.trim();
  return normalized.length > 0 && normalized.startsWith("asset:");
}

function toDatasetInput(input: WorkflowDraftInput): WorkflowDraftDatasetInput | undefined {
  return input.sourceType === WorkflowDraftInputSourceTypes.datasetAsset
    ? input as WorkflowDraftDatasetInput
    : undefined;
}

export function listDatasetInputs(draft: WorkflowDraft): ReadonlyArray<WorkflowDraftDatasetInput> {
  return Object.freeze(
    draft.inputs
      .map((entry) => toDatasetInput(entry))
      .filter((entry): entry is WorkflowDraftDatasetInput => Boolean(entry)),
  );
}

export function findDatasetInputByAssetId(
  draft: WorkflowDraft,
  assetId: string,
): { readonly index: number; readonly input: WorkflowDraftDatasetInput } | undefined {
  const normalizedAssetId = assetId.trim();
  if (!normalizedAssetId) {
    return undefined;
  }

  for (let index = 0; index < draft.inputs.length; index += 1) {
    const input = toDatasetInput(draft.inputs[index] as WorkflowDraftInput);
    if (!input) {
      continue;
    }
    if (input.asset.assetId === normalizedAssetId) {
      return Object.freeze({ index, input });
    }
  }

  return undefined;
}

export function buildNextDatasetInputId(inputs: ReadonlyArray<WorkflowDraftInput>): string {
  const existing = new Set(inputs.map((entry) => entry.id));
  let index = inputs.length + 1;
  let candidate = `input-dataset-${index}`;
  while (existing.has(candidate)) {
    index += 1;
    candidate = `input-dataset-${index}`;
  }
  return candidate;
}

export function buildDatasetInputFromAsset(
  draft: WorkflowDraft,
  candidate: WorkflowDatasetAssetCandidate,
): WorkflowDraftDatasetInput {
  const assetId = candidate.assetId.trim();
  if (!assetId) {
    throw new Error("Dataset asset id is required.");
  }
  if (!isCanonicalAssetIdentity(assetId)) {
    throw new Error("Dataset asset id must use canonical 'asset:' identity.");
  }
  const versionId = normalizeOptional(candidate.versionId);
  if (!isCanonicalAssetIdentity(versionId)) {
    throw new Error("Dataset asset version id must use canonical 'asset:' identity when provided.");
  }

  const title = normalizeOptional(candidate.name);
  const suffix = assetId.split(":").at(-1) ?? assetId;

  return Object.freeze({
    id: buildNextDatasetInputId(draft.inputs),
    type: "dataset-input",
    title: title ?? `Dataset ${suffix}`,
    sourceType: WorkflowDraftInputSourceTypes.datasetAsset,
    valueType: WorkflowDraftInputValueTypes.array,
    required: true,
    asset: Object.freeze({
      assetId,
      versionId,
      taxonomy: datasetInputTaxonomy,
    }),
  });
}

export function upsertDatasetInputSelection(
  draft: WorkflowDraft,
  candidate: WorkflowDatasetAssetCandidate,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  const assetId = candidate.assetId.trim();
  if (!assetId) {
    return Object.freeze({ draft, changed: false });
  }
  if (!isCanonicalAssetIdentity(assetId)) {
    return Object.freeze({ draft, changed: false });
  }

  const existing = findDatasetInputByAssetId(draft, assetId);
  if (!existing) {
    const nextDraft: WorkflowDraft = Object.freeze({
      ...draft,
      inputs: Object.freeze([
        ...draft.inputs,
        buildDatasetInputFromAsset(draft, candidate),
      ]),
    });
    return Object.freeze({ draft: nextDraft, changed: true });
  }

  const normalizedVersionId = normalizeOptional(candidate.versionId);
  if (!isCanonicalAssetIdentity(normalizedVersionId)) {
    return Object.freeze({ draft, changed: false });
  }
  const normalizedTitle = normalizeOptional(candidate.name);
  const existingInput = existing.input;
  if (existingInput.asset.versionId === normalizedVersionId && (!normalizedTitle || normalizedTitle === existingInput.title)) {
    return Object.freeze({ draft, changed: false });
  }

  const nextInputs = [...draft.inputs];
  nextInputs[existing.index] = Object.freeze({
    ...existingInput,
    title: normalizedTitle ?? existingInput.title,
    asset: Object.freeze({
      ...existingInput.asset,
      versionId: normalizedVersionId,
      taxonomy: datasetInputTaxonomy,
    }),
  });

  return Object.freeze({
    draft: Object.freeze({
      ...draft,
      inputs: Object.freeze(nextInputs),
    }),
    changed: true,
  });
}

export function removeDatasetInputSelection(
  draft: WorkflowDraft,
  assetId: string,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  const existing = findDatasetInputByAssetId(draft, assetId);
  if (!existing) {
    return Object.freeze({ draft, changed: false });
  }

  return Object.freeze({
    draft: Object.freeze({
      ...draft,
      inputs: Object.freeze(draft.inputs.filter((_, index) => index !== existing.index)),
    }),
    changed: true,
  });
}

export function toggleDatasetInputSelection(
  draft: WorkflowDraft,
  candidate: WorkflowDatasetAssetCandidate,
): { readonly draft: WorkflowDraft; readonly selected: boolean; readonly changed: boolean } {
  const existing = findDatasetInputByAssetId(draft, candidate.assetId);
  if (existing) {
    const removed = removeDatasetInputSelection(draft, candidate.assetId);
    return Object.freeze({
      draft: removed.draft,
      selected: false,
      changed: removed.changed,
    });
  }

  const added = upsertDatasetInputSelection(draft, candidate);
  return Object.freeze({
    draft: added.draft,
    selected: true,
    changed: added.changed,
  });
}

export function applyInlineDatasetReturnToDraft(
  draft: WorkflowDraft,
  payload: WorkflowDatasetInlineReturnPayload,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  if (payload.status !== "created" || !payload.assetId?.trim()) {
    return Object.freeze({ draft, changed: false });
  }

  return upsertDatasetInputSelection(draft, {
    assetId: payload.assetId,
    versionId: payload.versionId,
  });
}

export function replaceDatasetInputSelections(
  draft: WorkflowDraft,
  selections: ReadonlyArray<WorkflowDatasetAssetCandidate>,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  const normalizedSelections = dedupeAssetReferences(selections);
  const existingDatasetInputs = listDatasetInputs(draft);

  if (
    existingDatasetInputs.length === normalizedSelections.length
    && existingDatasetInputs.every((entry) => normalizedSelections.some((candidate) => (
      candidate.assetId === entry.asset.assetId
      && (candidate.versionId ?? undefined) === (entry.asset.versionId ?? undefined)
      && (candidate.name ?? entry.title) === entry.title
    )))
  ) {
    return Object.freeze({
      draft,
      changed: false,
    });
  }

  let nextDraft: WorkflowDraft = Object.freeze({
    ...draft,
    inputs: Object.freeze(draft.inputs.filter((entry) => entry.sourceType !== WorkflowDraftInputSourceTypes.datasetAsset)),
  });

  for (const selection of normalizedSelections) {
    nextDraft = upsertDatasetInputSelection(nextDraft, selection).draft;
  }

  return Object.freeze({
    draft: nextDraft,
    changed: true,
  });
}

function dedupeAssetReferences(
  selections: ReadonlyArray<WorkflowDatasetAssetCandidate>,
): ReadonlyArray<WorkflowDatasetAssetCandidate> {
  const entries = new Map<string, WorkflowDatasetAssetCandidate>();
  for (const selection of selections) {
    const assetId = selection.assetId.trim();
    const versionId = normalizeOptional(selection.versionId);
    if (!assetId || !isCanonicalAssetIdentity(assetId) || !isCanonicalAssetIdentity(versionId)) {
      continue;
    }
    entries.set(assetId, Object.freeze({
      assetId,
      versionId,
      name: normalizeOptional(selection.name),
    }));
  }
  return Object.freeze([...entries.values()]);
}
