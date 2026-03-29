import {
  WorkflowDraftStepAssetKinds,
  WorkflowDraftStepKinds,
  WorkflowDraftStepTypes,
  type WorkflowDraft,
  type WorkflowDraftStep,
} from "../../../domain/workflow-studio/WorkflowStudioDomain";
import {
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
  createCompositionTaxonomyDescriptor,
} from "../../../domain/taxonomy/CompositionTaxonomy";

export interface WorkflowStepTypeDefinition {
  readonly kind: WorkflowDraftStep["kind"];
  readonly type: string;
  readonly label: string;
  readonly summary: string;
  readonly interactive: boolean;
}

export interface WorkflowStepAgentAssetCandidate {
  readonly assetId: string;
  readonly versionId?: string;
  readonly name?: string;
}

export interface WorkflowStepAssetCatalogLoadResult {
  readonly assets: ReadonlyArray<WorkflowStepAgentAssetCandidate>;
  readonly error?: string;
}

interface RegistryAssetCandidateResponse {
  readonly ok: boolean;
  readonly data?: ReadonlyArray<{
    readonly assetId: string;
    readonly versionId?: string;
    readonly name: string;
  }>;
  readonly error?: {
    readonly message?: string;
  };
}

export interface WorkflowStepAssetCatalogService {
  filterAssets(filters: {
    readonly structuralKinds?: ReadonlyArray<string>;
    readonly semanticRoles?: ReadonlyArray<string>;
    readonly behaviorKinds?: ReadonlyArray<string>;
    readonly limit?: number;
  }): Promise<RegistryAssetCandidateResponse>;
  searchAssets(query: {
    readonly keyword: string;
    readonly structuralKinds?: ReadonlyArray<string>;
    readonly semanticRoles?: ReadonlyArray<string>;
    readonly behaviorKinds?: ReadonlyArray<string>;
    readonly limit?: number;
  }): Promise<RegistryAssetCandidateResponse>;
}

const stepAgentAssistantTaxonomy = createCompositionTaxonomyDescriptor({
  structuralKind: TaxonomyStructuralKinds.composite,
  semanticRole: TaxonomySemanticRoles.agent,
  behaviorKind: TaxonomyBehaviorKinds.autonomous,
});

export const workflowStepTypeDefinitions: ReadonlyArray<WorkflowStepTypeDefinition> = Object.freeze([
  Object.freeze({
    kind: WorkflowDraftStepKinds.action,
    type: WorkflowDraftStepTypes.agentAssistant,
    label: "Agent/assistant action",
    summary: "Select an agent/assistant asset to execute this step.",
    interactive: true,
  }),
  Object.freeze({
    kind: WorkflowDraftStepKinds.controlFlow,
    type: "if-then",
    label: "If/then branch",
    summary: "Planned built-in control flow step type.",
    interactive: false,
  }),
  Object.freeze({
    kind: WorkflowDraftStepKinds.controlFlow,
    type: "loop-iteration",
    label: "Loop iteration",
    summary: "Planned built-in loop step type.",
    interactive: false,
  }),
]);

const defaultStepTypeDefinition: WorkflowStepTypeDefinition = workflowStepTypeDefinitions[0] as WorkflowStepTypeDefinition;

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeStepOrdering(steps: ReadonlyArray<WorkflowDraftStep>): ReadonlyArray<WorkflowDraftStep> {
  return Object.freeze(
    steps.map((step, index) => Object.freeze({
      ...step,
      order: index + 1,
    })),
  );
}

function buildStepTitle(definition: WorkflowStepTypeDefinition, order: number): string {
  const baseLabel = definition.label.trim() || "Step";
  return `${baseLabel} ${order}`;
}

function buildNextStepId(draft: WorkflowDraft): string {
  const existingIds = new Set(draft.steps.map((entry) => entry.id));
  let index = draft.steps.length + 1;
  let candidate = `step-${index}`;
  while (existingIds.has(candidate)) {
    index += 1;
    candidate = `step-${index}`;
  }
  return candidate;
}

function toAssetCandidate(asset: {
  readonly assetId: string;
  readonly versionId?: string;
  readonly name: string;
}): WorkflowStepAgentAssetCandidate {
  return Object.freeze({
    assetId: asset.assetId,
    versionId: asset.versionId,
    name: asset.name,
  });
}

function moveStep(
  draft: WorkflowDraft,
  stepId: string,
  offset: -1 | 1,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  const index = draft.steps.findIndex((step) => step.id === stepId);
  if (index < 0) {
    return Object.freeze({ draft, changed: false });
  }
  const targetIndex = index + offset;
  if (targetIndex < 0 || targetIndex >= draft.steps.length) {
    return Object.freeze({ draft, changed: false });
  }

  const nextSteps = [...draft.steps];
  [nextSteps[index], nextSteps[targetIndex]] = [nextSteps[targetIndex] as WorkflowDraftStep, nextSteps[index] as WorkflowDraftStep];

  return Object.freeze({
    draft: Object.freeze({
      ...draft,
      steps: normalizeStepOrdering(nextSteps),
    }),
    changed: true,
  });
}

export function listAgentAssistantStepSelections(
  draft: WorkflowDraft,
): ReadonlyMap<string, WorkflowStepAgentAssetCandidate> {
  const entries: Array<readonly [string, WorkflowStepAgentAssetCandidate]> = [];
  for (const step of draft.steps) {
    const asset = step.assetRef?.asset;
    if (!asset?.assetId?.trim()) {
      continue;
    }
    entries.push([
      step.id,
      Object.freeze({
        assetId: asset.assetId,
        versionId: asset.versionId,
      }),
    ]);
  }
  return new Map(entries);
}

export function addWorkflowStep(
  draft: WorkflowDraft,
  definition: WorkflowStepTypeDefinition = defaultStepTypeDefinition,
): { readonly draft: WorkflowDraft; readonly stepId: string } {
  const stepId = buildNextStepId(draft);
  const nextOrder = draft.steps.length + 1;

  const nextStep: WorkflowDraftStep = Object.freeze({
    id: stepId,
    type: definition.type,
    kind: definition.kind ?? WorkflowDraftStepKinds.action,
    order: nextOrder,
    title: buildStepTitle(definition, nextOrder),
  });

  return Object.freeze({
    stepId,
    draft: Object.freeze({
      ...draft,
      steps: Object.freeze([
        ...draft.steps,
        nextStep,
      ]),
    }),
  });
}

export function removeWorkflowStep(
  draft: WorkflowDraft,
  stepId: string,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  const nextSteps = draft.steps.filter((step) => step.id !== stepId);
  if (nextSteps.length === draft.steps.length) {
    return Object.freeze({ draft, changed: false });
  }
  return Object.freeze({
    draft: Object.freeze({
      ...draft,
      steps: normalizeStepOrdering(nextSteps),
    }),
    changed: true,
  });
}

export function moveWorkflowStepUp(
  draft: WorkflowDraft,
  stepId: string,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  return moveStep(draft, stepId, -1);
}

export function moveWorkflowStepDown(
  draft: WorkflowDraft,
  stepId: string,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  return moveStep(draft, stepId, 1);
}

export function setWorkflowStepAgentAssetSelection(
  draft: WorkflowDraft,
  stepId: string,
  candidate: WorkflowStepAgentAssetCandidate,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  const assetId = candidate.assetId.trim();
  if (!assetId) {
    return Object.freeze({ draft, changed: false });
  }

  const stepIndex = draft.steps.findIndex((entry) => entry.id === stepId);
  if (stepIndex < 0) {
    return Object.freeze({ draft, changed: false });
  }

  const currentStep = draft.steps[stepIndex] as WorkflowDraftStep;
  const versionId = normalizeOptional(candidate.versionId);
  const normalizedName = normalizeOptional(candidate.name);
  const currentAsset = currentStep.assetRef?.asset;
  const assetAlreadySelected = currentStep.kind === WorkflowDraftStepKinds.assetBacked
    && currentStep.assetRef?.assetKind === WorkflowDraftStepAssetKinds.agentAssistant
    && currentAsset?.assetId === assetId
    && currentAsset.versionId === versionId;
  if (assetAlreadySelected && (!normalizedName || normalizedName === currentStep.title)) {
    return Object.freeze({ draft, changed: false });
  }

  const nextSteps = [...draft.steps];
  nextSteps[stepIndex] = Object.freeze({
    ...currentStep,
    type: WorkflowDraftStepTypes.agentAssistant,
    kind: WorkflowDraftStepKinds.assetBacked,
    title: normalizedName ?? currentStep.title,
    assetRef: Object.freeze({
      assetKind: WorkflowDraftStepAssetKinds.agentAssistant,
      asset: Object.freeze({
        assetId,
        versionId,
        taxonomy: stepAgentAssistantTaxonomy,
      }),
    }),
  });

  return Object.freeze({
    draft: Object.freeze({
      ...draft,
      steps: normalizeStepOrdering(nextSteps),
    }),
    changed: true,
  });
}

export function clearWorkflowStepAgentAssetSelection(
  draft: WorkflowDraft,
  stepId: string,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  const stepIndex = draft.steps.findIndex((entry) => entry.id === stepId);
  if (stepIndex < 0) {
    return Object.freeze({ draft, changed: false });
  }

  const currentStep = draft.steps[stepIndex] as WorkflowDraftStep;
  if (!currentStep.assetRef) {
    return Object.freeze({ draft, changed: false });
  }

  const nextSteps = [...draft.steps];
  nextSteps[stepIndex] = Object.freeze({
    ...currentStep,
    type: WorkflowDraftStepTypes.agentAssistant,
    kind: WorkflowDraftStepKinds.action,
    assetRef: undefined,
  });

  return Object.freeze({
    draft: Object.freeze({
      ...draft,
      steps: normalizeStepOrdering(nextSteps),
    }),
    changed: true,
  });
}

export function buildWorkflowStepAssetOptionKey(candidate: WorkflowStepAgentAssetCandidate): string {
  return `${candidate.assetId}::${candidate.versionId ?? ""}`;
}

export async function loadAgentAssistantAssetCandidates(
  service: WorkflowStepAssetCatalogService,
  query: string,
): Promise<WorkflowStepAssetCatalogLoadResult> {
  const keyword = query.trim();
  const response = keyword.length > 0
    ? await service.searchAssets({
      keyword,
      structuralKinds: [TaxonomyStructuralKinds.composite],
      semanticRoles: [TaxonomySemanticRoles.agent],
      behaviorKinds: [TaxonomyBehaviorKinds.autonomous],
      limit: 50,
    })
    : await service.filterAssets({
      structuralKinds: [TaxonomyStructuralKinds.composite],
      semanticRoles: [TaxonomySemanticRoles.agent],
      behaviorKinds: [TaxonomyBehaviorKinds.autonomous],
      limit: 50,
    });

  if (!response.ok || !response.data) {
    return Object.freeze({
      assets: Object.freeze([]),
      error: response.error?.message ?? "Unable to load agent/assistant assets.",
    });
  }

  return Object.freeze({
    assets: Object.freeze(response.data.map((asset) => toAssetCandidate(asset))),
  });
}
