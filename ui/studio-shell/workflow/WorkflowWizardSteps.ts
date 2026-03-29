import {
  WorkflowDraftBuiltInStepTypes,
  WorkflowDraftStepAssetKinds,
  WorkflowDraftStepKinds,
  WorkflowDraftStepTypes,
  type WorkflowDraft,
  type WorkflowDraftDelayWaitStepConfig,
  type WorkflowDraftIfThenStepConfig,
  type WorkflowDraftLoopIterationStepConfig,
  type WorkflowDraftStep,
} from "../../../domain/workflow-studio/WorkflowStudioDomain";
import {
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
  createCompositionTaxonomyDescriptor,
} from "../../../domain/taxonomy/CompositionTaxonomy";

export const WorkflowWizardStepSelectionKinds = Object.freeze({
  assetBacked: "asset-backed",
  builtIn: "built-in",
});

export type WorkflowWizardStepSelectionKind =
  typeof WorkflowWizardStepSelectionKinds[keyof typeof WorkflowWizardStepSelectionKinds];

export interface WorkflowStepTypeDefinition {
  readonly kind: WorkflowDraftStep["kind"];
  readonly type: string;
  readonly selectionKind: WorkflowWizardStepSelectionKind;
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
    kind: WorkflowDraftStepKinds.assetBacked,
    type: WorkflowDraftStepTypes.agentAssistant,
    selectionKind: WorkflowWizardStepSelectionKinds.assetBacked,
    label: "Agent/assistant action",
    summary: "Select an agent/assistant asset for this step.",
    interactive: true,
  }),
  Object.freeze({
    kind: WorkflowDraftStepKinds.controlFlow,
    type: WorkflowDraftBuiltInStepTypes.ifThen,
    selectionKind: WorkflowWizardStepSelectionKinds.builtIn,
    label: "If / Then branching",
    summary: "Evaluate a condition and branch.",
    interactive: true,
  }),
  Object.freeze({
    kind: WorkflowDraftStepKinds.controlFlow,
    type: WorkflowDraftBuiltInStepTypes.loopIteration,
    selectionKind: WorkflowWizardStepSelectionKinds.builtIn,
    label: "Loop / Repeat",
    summary: "Repeat work by count or condition.",
    interactive: true,
  }),
  Object.freeze({
    kind: WorkflowDraftStepKinds.controlFlow,
    type: WorkflowDraftBuiltInStepTypes.delayWait,
    selectionKind: WorkflowWizardStepSelectionKinds.builtIn,
    label: "Delay / Wait",
    summary: "Pause workflow execution for a duration.",
    interactive: true,
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

function resolveStepDefinitionByType(kind: WorkflowDraftStep["kind"], type: string): WorkflowStepTypeDefinition {
  return (workflowStepTypeDefinitions.find((definition) => definition.kind === kind && definition.type === type)
    ?? defaultStepTypeDefinition) as WorkflowStepTypeDefinition;
}

function defaultBuiltInConfig(stepType: string): Readonly<Record<string, unknown>> | undefined {
  switch (stepType) {
    case WorkflowDraftBuiltInStepTypes.ifThen:
      return Object.freeze<WorkflowDraftIfThenStepConfig>({
        conditionExpression: "true",
      });
    case WorkflowDraftBuiltInStepTypes.loopIteration:
      return Object.freeze<WorkflowDraftLoopIterationStepConfig>({
        repeatCount: 1,
      });
    case WorkflowDraftBuiltInStepTypes.delayWait:
      return Object.freeze<WorkflowDraftDelayWaitStepConfig>({
        durationSeconds: 60,
      });
    default:
      return undefined;
  }
}

function applyStepType(
  currentStep: WorkflowDraftStep,
  definition: WorkflowStepTypeDefinition,
): WorkflowDraftStep {
  if (definition.selectionKind === WorkflowWizardStepSelectionKinds.assetBacked) {
    return Object.freeze({
      ...currentStep,
      kind: WorkflowDraftStepKinds.assetBacked,
      type: WorkflowDraftStepTypes.agentAssistant,
      config: undefined,
      assetRef: currentStep.assetRef?.assetKind === WorkflowDraftStepAssetKinds.agentAssistant
        ? currentStep.assetRef
        : undefined,
    });
  }

  return Object.freeze({
    ...currentStep,
    kind: WorkflowDraftStepKinds.controlFlow,
    type: definition.type,
    assetRef: undefined,
    config: defaultBuiltInConfig(definition.type),
  });
}

function updateStep(
  draft: WorkflowDraft,
  stepId: string,
  updater: (step: WorkflowDraftStep) => WorkflowDraftStep,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  const index = draft.steps.findIndex((step) => step.id === stepId);
  if (index < 0) {
    return Object.freeze({ draft, changed: false });
  }

  const currentStep = draft.steps[index] as WorkflowDraftStep;
  const nextStep = updater(currentStep);
  if (nextStep === currentStep) {
    return Object.freeze({ draft, changed: false });
  }

  const nextSteps = [...draft.steps];
  nextSteps[index] = nextStep;
  return Object.freeze({
    draft: Object.freeze({
      ...draft,
      steps: normalizeStepOrdering(nextSteps),
    }),
    changed: true,
  });
}

export function buildWorkflowStepTypeDefinitionKey(definition: WorkflowStepTypeDefinition): string {
  return `${definition.selectionKind}:${definition.kind ?? "none"}:${definition.type}`;
}

export function getWorkflowStepTypeDefinitionByKey(key: string): WorkflowStepTypeDefinition | undefined {
  return workflowStepTypeDefinitions.find((definition) => buildWorkflowStepTypeDefinitionKey(definition) === key);
}

export function resolveWorkflowStepTypeDefinition(step: WorkflowDraftStep): WorkflowStepTypeDefinition {
  const kind = step.kind ?? (step.assetRef ? WorkflowDraftStepKinds.assetBacked : WorkflowDraftStepKinds.action);
  return resolveStepDefinitionByType(kind, step.type);
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

  const baseStep: WorkflowDraftStep = Object.freeze({
    id: stepId,
    type: definition.type,
    kind: definition.kind ?? WorkflowDraftStepKinds.action,
    order: nextOrder,
    title: buildStepTitle(definition, nextOrder),
  });

  const nextStep = applyStepType(baseStep, definition);

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

export function setWorkflowStepType(
  draft: WorkflowDraft,
  stepId: string,
  definitionKey: string,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  const nextDefinition = getWorkflowStepTypeDefinitionByKey(definitionKey);
  if (!nextDefinition) {
    return Object.freeze({ draft, changed: false });
  }

  return updateStep(draft, stepId, (currentStep) => {
    const currentDefinition = resolveWorkflowStepTypeDefinition(currentStep);
    if (buildWorkflowStepTypeDefinitionKey(currentDefinition) === definitionKey) {
      return currentStep;
    }
    return applyStepType(currentStep, nextDefinition);
  });
}

export function setWorkflowStepTitle(
  draft: WorkflowDraft,
  stepId: string,
  title: string,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  const normalizedTitle = normalizeOptional(title);
  return updateStep(draft, stepId, (currentStep) => {
    if (normalizedTitle === currentStep.title) {
      return currentStep;
    }
    return Object.freeze({
      ...currentStep,
      title: normalizedTitle,
    });
  });
}

export function setWorkflowStepIfThenConfig(
  draft: WorkflowDraft,
  stepId: string,
  patch: {
    readonly conditionExpression?: string;
    readonly thenLabel?: string;
    readonly elseLabel?: string;
  },
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  return updateStep(draft, stepId, (currentStep) => {
    if (currentStep.type !== WorkflowDraftBuiltInStepTypes.ifThen) {
      return currentStep;
    }

    const existing = (currentStep.config ?? {}) as WorkflowDraftIfThenStepConfig;
    const nextConfig: WorkflowDraftIfThenStepConfig = Object.freeze({
      conditionExpression: patch.conditionExpression ?? existing.conditionExpression ?? "",
      thenLabel: patch.thenLabel !== undefined ? normalizeOptional(patch.thenLabel) : existing.thenLabel,
      elseLabel: patch.elseLabel !== undefined ? normalizeOptional(patch.elseLabel) : existing.elseLabel,
    });

    return Object.freeze({
      ...currentStep,
      config: nextConfig,
    });
  });
}

export function setWorkflowStepLoopConfig(
  draft: WorkflowDraft,
  stepId: string,
  patch: {
    readonly repeatCount?: number;
    readonly loopConditionExpression?: string;
    readonly loopLabel?: string;
  },
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  return updateStep(draft, stepId, (currentStep) => {
    if (currentStep.type !== WorkflowDraftBuiltInStepTypes.loopIteration) {
      return currentStep;
    }

    const existing = (currentStep.config ?? {}) as WorkflowDraftLoopIterationStepConfig;
    const nextConfig: WorkflowDraftLoopIterationStepConfig = Object.freeze({
      repeatCount: patch.repeatCount ?? existing.repeatCount,
      loopConditionExpression: patch.loopConditionExpression !== undefined
        ? normalizeOptional(patch.loopConditionExpression)
        : existing.loopConditionExpression,
      loopLabel: patch.loopLabel !== undefined ? normalizeOptional(patch.loopLabel) : existing.loopLabel,
    });

    return Object.freeze({
      ...currentStep,
      config: nextConfig,
    });
  });
}

export function setWorkflowStepDelayConfig(
  draft: WorkflowDraft,
  stepId: string,
  patch: {
    readonly durationSeconds?: number;
    readonly note?: string;
  },
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  return updateStep(draft, stepId, (currentStep) => {
    if (currentStep.type !== WorkflowDraftBuiltInStepTypes.delayWait) {
      return currentStep;
    }

    const existing = (currentStep.config ?? {}) as WorkflowDraftDelayWaitStepConfig;
    const nextConfig: WorkflowDraftDelayWaitStepConfig = Object.freeze({
      durationSeconds: patch.durationSeconds ?? existing.durationSeconds ?? 60,
      note: patch.note !== undefined ? normalizeOptional(patch.note) : existing.note,
    });

    return Object.freeze({
      ...currentStep,
      config: nextConfig,
    });
  });
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

  return updateStep(draft, stepId, (currentStep) => {
    const versionId = normalizeOptional(candidate.versionId);
    const normalizedName = normalizeOptional(candidate.name);
    const currentAsset = currentStep.assetRef?.asset;
    const assetAlreadySelected = currentStep.kind === WorkflowDraftStepKinds.assetBacked
      && currentStep.assetRef?.assetKind === WorkflowDraftStepAssetKinds.agentAssistant
      && currentAsset?.assetId === assetId
      && currentAsset.versionId === versionId;
    if (assetAlreadySelected && (!normalizedName || normalizedName === currentStep.title)) {
      return currentStep;
    }

    return Object.freeze({
      ...currentStep,
      type: WorkflowDraftStepTypes.agentAssistant,
      kind: WorkflowDraftStepKinds.assetBacked,
      title: normalizedName ?? currentStep.title,
      config: undefined,
      assetRef: Object.freeze({
        assetKind: WorkflowDraftStepAssetKinds.agentAssistant,
        asset: Object.freeze({
          assetId,
          versionId,
          taxonomy: stepAgentAssistantTaxonomy,
        }),
      }),
    });
  });
}

export function clearWorkflowStepAgentAssetSelection(
  draft: WorkflowDraft,
  stepId: string,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  return updateStep(draft, stepId, (currentStep) => {
    if (!currentStep.assetRef) {
      return currentStep;
    }

    return Object.freeze({
      ...currentStep,
      type: WorkflowDraftStepTypes.agentAssistant,
      kind: WorkflowDraftStepKinds.assetBacked,
      assetRef: undefined,
      config: undefined,
    });
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
