import {
  type WorkflowDraftBuiltInStepCategory,
  type WorkflowDraftBuiltInStepType,
  WorkflowDraftBuiltInStepTypes,
  WorkflowDraftDelayWaitModes,
  WorkflowDraftStepAssetKinds,
  WorkflowDraftStepKinds,
  WorkflowDraftStepTypes,
  type WorkflowDraft,
  type WorkflowDraftDelayWaitMode,
  type WorkflowDraftDelayWaitStepConfig,
  type WorkflowDraftIfThenStepConfig,
  type WorkflowDraftLoopIterationMode,
  WorkflowDraftLoopIterationModes,
  type WorkflowDraftLoopIterationStepConfig,
  type WorkflowDraftManualApprovalStepConfig,
  type WorkflowDraftManualInteractionMode,
  WorkflowDraftManualInteractionModes,
  type WorkflowDraftStep,
} from "../../../domain/workflow-studio/WorkflowStudioDomain";
import { createDefaultBuiltInWorkflowStepRegistry } from "../../../application/workflow-studio/BuiltInWorkflowStepRegistry";
import {
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
  createCompositionTaxonomyDescriptor,
  type CompositionTaxonomyDescriptor,
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
  readonly builtInCategory?: WorkflowDraftBuiltInStepCategory;
  readonly interactive: boolean;
}

export interface WorkflowStepAgentAssetCandidate {
  readonly assetId: string;
  readonly versionId?: string;
  readonly name?: string;
}

export interface WorkflowStepAgentAssistantSelectionPayload {
  readonly assetRef: {
    readonly assetKind: typeof WorkflowDraftStepAssetKinds.agentAssistant;
    readonly asset: {
      readonly assetId: string;
      readonly versionId?: string;
      readonly taxonomy: CompositionTaxonomyDescriptor;
    };
  };
  readonly config: Readonly<Record<string, unknown>>;
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

const builtInStepRegistry = createDefaultBuiltInWorkflowStepRegistry();
const builtInCategoryLabels: Readonly<Record<WorkflowDraftBuiltInStepCategory, string>> = Object.freeze({
  "control-flow": "Control flow",
  temporal: "Temporal",
  "human-interaction": "Human interaction",
  transformation: "Transformation",
});

const builtInStepTypeDefinitions: ReadonlyArray<WorkflowStepTypeDefinition> = Object.freeze(
  builtInStepRegistry.list().map((entry) => Object.freeze({
    kind: WorkflowDraftStepKinds.controlFlow,
    type: entry.type,
    selectionKind: WorkflowWizardStepSelectionKinds.builtIn,
    label: entry.label,
    summary: `${builtInCategoryLabels[entry.category]} - ${entry.description}`,
    builtInCategory: entry.category,
    interactive: true,
  })),
);

export const workflowStepTypeDefinitions: ReadonlyArray<WorkflowStepTypeDefinition> = Object.freeze([
  Object.freeze({
    kind: WorkflowDraftStepKinds.assetBacked,
    type: WorkflowDraftStepTypes.agentAssistant,
    selectionKind: WorkflowWizardStepSelectionKinds.assetBacked,
    label: "Agent/assistant action",
    summary: "Select an agent/assistant asset for this step.",
    interactive: true,
  }),
  ...builtInStepTypeDefinitions,
]);

const defaultStepTypeDefinition: WorkflowStepTypeDefinition = workflowStepTypeDefinitions[0] as WorkflowStepTypeDefinition;

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
  if (!builtInStepRegistry.isSupported(stepType)) {
    return undefined;
  }
  return builtInStepRegistry.createDefaultConfig(stepType as WorkflowDraftBuiltInStepType) as Readonly<Record<string, unknown>>;
}

function normalizeStepIdReferences(stepIds?: ReadonlyArray<string>): ReadonlyArray<string> | undefined {
  if (!stepIds) {
    return undefined;
  }
  const deduped = Array.from(new Set(stepIds.map((stepId) => stepId.trim()).filter((stepId) => stepId.length > 0)));
  return deduped.length > 0 ? Object.freeze(deduped) : undefined;
}

function normalizeStringList(values?: ReadonlyArray<string>): ReadonlyArray<string> | undefined {
  if (!values) {
    return undefined;
  }
  const deduped = Array.from(new Set(values.map((entry) => entry.trim()).filter((entry) => entry.length > 0)));
  return deduped.length > 0 ? Object.freeze(deduped) : undefined;
}

function normalizePositiveInteger(value: number | undefined): number | undefined {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) {
    return undefined;
  }
  return value;
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
    readonly thenStepIds?: ReadonlyArray<string>;
    readonly elseStepIds?: ReadonlyArray<string>;
  },
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  return updateStep(draft, stepId, (currentStep) => {
    if (currentStep.type !== WorkflowDraftBuiltInStepTypes.ifThen) {
      return currentStep;
    }

    const existing = (currentStep.config ?? {}) as WorkflowDraftIfThenStepConfig;
    const previousThen = existing.branches?.then ?? Object.freeze({
      label: existing.thenLabel,
      stepIds: existing.thenStepIds,
    });
    const previousElse = existing.branches?.else ?? (
      existing.elseLabel || existing.elseStepIds
        ? Object.freeze({
          label: existing.elseLabel,
          stepIds: existing.elseStepIds,
        })
        : undefined
    );
    const nextThenLabel = patch.thenLabel !== undefined ? normalizeOptional(patch.thenLabel) : previousThen.label;
    const nextElseLabel = patch.elseLabel !== undefined ? normalizeOptional(patch.elseLabel) : previousElse?.label;
    const nextThenStepIds = patch.thenStepIds !== undefined ? normalizeStepIdReferences(patch.thenStepIds) : previousThen.stepIds;
    const nextElseStepIds = patch.elseStepIds !== undefined ? normalizeStepIdReferences(patch.elseStepIds) : previousElse?.stepIds;
    const conditionExpression = patch.conditionExpression
      ?? existing.conditionExpression
      ?? (existing.condition?.kind === "expression" ? existing.condition.expression : "")
      ?? "";
    const nextConfig: WorkflowDraftIfThenStepConfig = Object.freeze({
      condition: Object.freeze({
        kind: "expression",
        expression: conditionExpression,
      }),
      branches: Object.freeze({
        then: Object.freeze({
          label: nextThenLabel,
          stepIds: nextThenStepIds,
        }),
        else: (nextElseLabel || nextElseStepIds)
          ? Object.freeze({
            label: nextElseLabel,
            stepIds: nextElseStepIds,
          })
          : undefined,
      }),
      conditionExpression,
      thenLabel: nextThenLabel,
      elseLabel: nextElseLabel,
      thenStepIds: nextThenStepIds,
      elseStepIds: nextElseStepIds,
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
    readonly mode?: WorkflowDraftLoopIterationMode;
    readonly repeatCount?: number;
    readonly collectionInputKey?: string;
    readonly itemAlias?: string;
    readonly rangeStart?: number;
    readonly rangeEnd?: number;
    readonly rangeStep?: number;
    readonly loopConditionExpression?: string;
    readonly loopLabel?: string;
    readonly bodyStepIds?: ReadonlyArray<string>;
    readonly maxIterations?: number;
  },
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  return updateStep(draft, stepId, (currentStep) => {
    if (currentStep.type !== WorkflowDraftBuiltInStepTypes.loopIteration) {
      return currentStep;
    }

    const existing = (currentStep.config ?? {}) as WorkflowDraftLoopIterationStepConfig;
    const hasRepeatCountPatch = Object.prototype.hasOwnProperty.call(patch, "repeatCount");
    const hasCollectionInputPatch = Object.prototype.hasOwnProperty.call(patch, "collectionInputKey");
    const hasItemAliasPatch = Object.prototype.hasOwnProperty.call(patch, "itemAlias");
    const hasRangeStartPatch = Object.prototype.hasOwnProperty.call(patch, "rangeStart");
    const hasRangeEndPatch = Object.prototype.hasOwnProperty.call(patch, "rangeEnd");
    const hasRangeStepPatch = Object.prototype.hasOwnProperty.call(patch, "rangeStep");
    const hasBodyStepIdsPatch = Object.prototype.hasOwnProperty.call(patch, "bodyStepIds");
    const hasMaxIterationsPatch = Object.prototype.hasOwnProperty.call(patch, "maxIterations");
    const existingMode = existing.mode
      ?? existing.iterationMode
      ?? (existing.collection ? WorkflowDraftLoopIterationModes.collection : undefined)
      ?? (existing.range ? WorkflowDraftLoopIterationModes.range : undefined)
      ?? WorkflowDraftLoopIterationModes.fixedCount;
    const nextMode = patch.mode ?? existingMode;
    const nextRepeatCount = normalizePositiveInteger(
      hasRepeatCountPatch
        ? patch.repeatCount
        : (existing.fixedCount?.count ?? existing.repeatCount),
    );
    const nextCollectionInputKey = hasCollectionInputPatch
      ? normalizeOptional(patch.collectionInputKey)
      : (existing.collection?.inputKey ?? existing.collectionInputKey);
    const nextItemAlias = hasItemAliasPatch
      ? normalizeOptional(patch.itemAlias)
      : (existing.collection?.itemAlias ?? existing.itemAlias);
    const nextRangeStart = hasRangeStartPatch
      ? (Number.isFinite(patch.rangeStart) ? patch.rangeStart : undefined)
      : existing.range?.start;
    const nextRangeEnd = hasRangeEndPatch
      ? (Number.isFinite(patch.rangeEnd) ? patch.rangeEnd : undefined)
      : existing.range?.end;
    const nextRangeStep = hasRangeStepPatch
      ? normalizePositiveInteger(patch.rangeStep)
      : existing.range?.step;
    const nextLoopConditionExpression = patch.loopConditionExpression !== undefined
      ? normalizeOptional(patch.loopConditionExpression)
      : existing.loopConditionExpression;
    const nextLoopLabel = patch.loopLabel !== undefined ? normalizeOptional(patch.loopLabel) : existing.loopLabel;
    const nextBodyStepIds = hasBodyStepIdsPatch
      ? normalizeStepIdReferences(patch.bodyStepIds)
      : existing.bodyStepIds;
    const nextMaxIterations = hasMaxIterationsPatch
      ? normalizePositiveInteger(patch.maxIterations)
      : existing.maxIterations;
    const resolvedCollection = nextMode === WorkflowDraftLoopIterationModes.collection && nextCollectionInputKey
      ? Object.freeze({
        inputKey: nextCollectionInputKey,
        itemAlias: nextItemAlias,
      })
      : undefined;
    const resolvedRange = nextMode === WorkflowDraftLoopIterationModes.range
      && nextRangeStart !== undefined
      && nextRangeEnd !== undefined
      ? Object.freeze({
        start: nextRangeStart,
        end: nextRangeEnd,
        step: nextRangeStep,
      })
      : undefined;
    const nextConfig: WorkflowDraftLoopIterationStepConfig = Object.freeze({
      mode: nextMode,
      fixedCount: nextMode === WorkflowDraftLoopIterationModes.fixedCount && nextRepeatCount
        ? Object.freeze({
          count: nextRepeatCount,
        })
        : undefined,
      collection: resolvedCollection,
      range: resolvedRange,
      exitCondition: nextLoopConditionExpression
        ? Object.freeze({
          kind: "expression",
          expression: nextLoopConditionExpression,
        })
        : undefined,
      loopLabel: nextLoopLabel,
      bodyStepIds: nextBodyStepIds,
      maxIterations: nextMaxIterations,
      repeatCount: nextMode === WorkflowDraftLoopIterationModes.fixedCount ? nextRepeatCount : undefined,
      loopConditionExpression: nextLoopConditionExpression,
      iterationMode: nextMode,
      itemAlias: resolvedCollection?.itemAlias,
      collectionInputKey: resolvedCollection?.inputKey,
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
    readonly mode?: WorkflowDraftDelayWaitMode;
    readonly durationSeconds?: number;
    readonly waitUntil?: string;
    readonly timezone?: string;
    readonly note?: string;
  },
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  return updateStep(draft, stepId, (currentStep) => {
    if (currentStep.type !== WorkflowDraftBuiltInStepTypes.delayWait) {
      return currentStep;
    }

    const existing = (currentStep.config ?? {}) as WorkflowDraftDelayWaitStepConfig;
    const hasDurationPatch = Object.prototype.hasOwnProperty.call(patch, "durationSeconds");
    const hasWaitUntilPatch = Object.prototype.hasOwnProperty.call(patch, "waitUntil");
    const hasTimezonePatch = Object.prototype.hasOwnProperty.call(patch, "timezone");
    const existingMode = existing.mode
      ?? (existing.until ? WorkflowDraftDelayWaitModes.untilTime : WorkflowDraftDelayWaitModes.duration);
    const nextMode = patch.mode ?? existingMode;
    const resolvedDurationSeconds = normalizePositiveInteger(
      hasDurationPatch
        ? patch.durationSeconds
        : existing.durationSeconds ?? existing.duration?.value,
    );
    const nextWaitUntil = hasWaitUntilPatch
      ? normalizeOptional(patch.waitUntil)
      : (existing.waitUntil ?? existing.until?.timestamp);
    const nextTimezone = hasTimezonePatch
      ? normalizeOptional(patch.timezone)
      : existing.until?.timezone;
    const nextConfig: WorkflowDraftDelayWaitStepConfig = Object.freeze({
      mode: nextMode,
      duration: nextMode === WorkflowDraftDelayWaitModes.duration && resolvedDurationSeconds
        ? Object.freeze({
          value: resolvedDurationSeconds,
          unit: "seconds",
        })
        : undefined,
      until: nextMode === WorkflowDraftDelayWaitModes.untilTime && nextWaitUntil
        ? Object.freeze({
          timestamp: nextWaitUntil,
          timezone: nextTimezone,
        })
        : undefined,
      durationSeconds: nextMode === WorkflowDraftDelayWaitModes.duration ? resolvedDurationSeconds : undefined,
      waitUntil: nextMode === WorkflowDraftDelayWaitModes.untilTime ? nextWaitUntil : undefined,
      note: patch.note !== undefined ? normalizeOptional(patch.note) : existing.note,
    });

    return Object.freeze({
      ...currentStep,
      config: nextConfig,
    });
  });
}

export function setWorkflowStepManualApprovalConfig(
  draft: WorkflowDraft,
  stepId: string,
  patch: {
    readonly prompt?: string;
    readonly interactionMode?: WorkflowDraftManualInteractionMode;
    readonly continueLabel?: string;
    readonly continueStepIds?: ReadonlyArray<string>;
    readonly approveLabel?: string;
    readonly approveStepIds?: ReadonlyArray<string>;
    readonly rejectLabel?: string;
    readonly rejectStepIds?: ReadonlyArray<string>;
    readonly requiredApproverRoles?: ReadonlyArray<string>;
    readonly timeoutSeconds?: number;
    readonly onTimeout?: "reject" | "continue" | "escalate" | "";
    readonly allowSelfApproval?: boolean;
  },
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  return updateStep(draft, stepId, (currentStep) => {
    if (currentStep.type !== WorkflowDraftBuiltInStepTypes.manualApproval) {
      return currentStep;
    }

    const existing = (currentStep.config ?? {}) as WorkflowDraftManualApprovalStepConfig;
    const hasPromptPatch = Object.prototype.hasOwnProperty.call(patch, "prompt");
    const hasInteractionModePatch = Object.prototype.hasOwnProperty.call(patch, "interactionMode");
    const hasContinueLabelPatch = Object.prototype.hasOwnProperty.call(patch, "continueLabel");
    const hasContinueStepIdsPatch = Object.prototype.hasOwnProperty.call(patch, "continueStepIds");
    const hasApproveLabelPatch = Object.prototype.hasOwnProperty.call(patch, "approveLabel");
    const hasApproveStepIdsPatch = Object.prototype.hasOwnProperty.call(patch, "approveStepIds");
    const hasRejectLabelPatch = Object.prototype.hasOwnProperty.call(patch, "rejectLabel");
    const hasRejectStepIdsPatch = Object.prototype.hasOwnProperty.call(patch, "rejectStepIds");
    const hasRequiredRolesPatch = Object.prototype.hasOwnProperty.call(patch, "requiredApproverRoles");
    const hasTimeoutPatch = Object.prototype.hasOwnProperty.call(patch, "timeoutSeconds");
    const hasOnTimeoutPatch = Object.prototype.hasOwnProperty.call(patch, "onTimeout");
    const hasAllowSelfApprovalPatch = Object.prototype.hasOwnProperty.call(patch, "allowSelfApproval");

    const nextPrompt = hasPromptPatch
      ? (normalizeOptional(patch.prompt) ?? "")
      : (normalizeOptional(existing.prompt) ?? "");
    const interactionMode = hasInteractionModePatch
      ? patch.interactionMode
      : (existing.interactionMode ?? WorkflowDraftManualInteractionModes.approval);

    const nextContinueLabel = hasContinueLabelPatch
      ? normalizeOptional(patch.continueLabel)
      : existing.outcomes.continue?.label;
    const nextContinueStepIds = hasContinueStepIdsPatch
      ? normalizeStepIdReferences(patch.continueStepIds)
      : existing.outcomes.continue?.stepIds;
    const nextApproveLabel = hasApproveLabelPatch
      ? normalizeOptional(patch.approveLabel)
      : existing.outcomes.approve?.label;
    const nextApproveStepIds = hasApproveStepIdsPatch
      ? normalizeStepIdReferences(patch.approveStepIds)
      : existing.outcomes.approve?.stepIds;
    const nextRejectLabel = hasRejectLabelPatch
      ? normalizeOptional(patch.rejectLabel)
      : existing.outcomes.reject?.label;
    const nextRejectStepIds = hasRejectStepIdsPatch
      ? normalizeStepIdReferences(patch.rejectStepIds)
      : existing.outcomes.reject?.stepIds;
    const nextRequiredApproverRoles = hasRequiredRolesPatch
      ? normalizeStringList(patch.requiredApproverRoles)
      : existing.requiredApproverRoles;
    const nextTimeoutSeconds = hasTimeoutPatch
      ? normalizePositiveInteger(patch.timeoutSeconds)
      : existing.timeoutSeconds;
    const nextOnTimeout = hasOnTimeoutPatch
      ? (patch.onTimeout && patch.onTimeout.length > 0 ? patch.onTimeout : undefined)
      : existing.onTimeout;
    const nextAllowSelfApproval = hasAllowSelfApprovalPatch ? patch.allowSelfApproval : existing.allowSelfApproval;

    const outcomes = interactionMode === WorkflowDraftManualInteractionModes.review
      ? Object.freeze({
        continue: Object.freeze({
          label: nextContinueLabel,
          stepIds: nextContinueStepIds,
        }),
      })
      : Object.freeze({
        approve: Object.freeze({
          label: nextApproveLabel,
          stepIds: nextApproveStepIds,
        }),
        reject: Object.freeze({
          label: nextRejectLabel,
          stepIds: nextRejectStepIds,
        }),
      });

    const nextConfig: WorkflowDraftManualApprovalStepConfig = Object.freeze({
      prompt: nextPrompt,
      interactionMode,
      outcomes,
      requiredApproverRoles: nextRequiredApproverRoles,
      timeoutSeconds: nextTimeoutSeconds,
      onTimeout: nextOnTimeout,
      allowSelfApproval: nextAllowSelfApproval,
      approvalMessage: nextPrompt,
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
  const versionId = normalizeOptional(candidate.versionId);
  if (!assetId || !isCanonicalAssetIdentity(assetId) || !isCanonicalAssetIdentity(versionId)) {
    return Object.freeze({ draft, changed: false });
  }

  return updateStep(draft, stepId, (currentStep) => {
    const normalizedName = normalizeOptional(candidate.name);
    const currentAsset = currentStep.assetRef?.asset;
    const assetAlreadySelected = currentStep.kind === WorkflowDraftStepKinds.assetBacked
      && currentStep.assetRef?.assetKind === WorkflowDraftStepAssetKinds.agentAssistant
      && currentAsset?.assetId === assetId
      && currentAsset.versionId === versionId;
    if (assetAlreadySelected && (!normalizedName || normalizedName === currentStep.title)) {
      return currentStep;
    }

    const payload = buildWorkflowStepAgentAssistantSelectionPayload(candidate);

    return Object.freeze({
      ...currentStep,
      type: WorkflowDraftStepTypes.agentAssistant,
      kind: WorkflowDraftStepKinds.assetBacked,
      title: normalizedName ?? currentStep.title,
      config: payload.config,
      assetRef: payload.assetRef,
    });
  });
}

export function buildWorkflowStepAgentAssistantSelectionPayload(
  candidate: WorkflowStepAgentAssetCandidate,
): WorkflowStepAgentAssistantSelectionPayload {
  const assetId = candidate.assetId.trim();
  if (!assetId) {
    throw new Error("Agent or assistant asset id is required.");
  }
  if (!isCanonicalAssetIdentity(assetId)) {
    throw new Error("Agent or assistant asset id must use canonical 'asset:' identity.");
  }
  const versionId = normalizeOptional(candidate.versionId);
  if (!isCanonicalAssetIdentity(versionId)) {
    throw new Error("Agent or assistant version id must use canonical 'asset:' identity when provided.");
  }

  return Object.freeze({
    assetRef: Object.freeze({
      assetKind: WorkflowDraftStepAssetKinds.agentAssistant,
      asset: Object.freeze({
        assetId,
        versionId,
        taxonomy: stepAgentAssistantTaxonomy,
      }),
    }),
    // Keep a bounded placeholder so future step configuration can be layered without changing payload shape.
    config: Object.freeze({}),
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
