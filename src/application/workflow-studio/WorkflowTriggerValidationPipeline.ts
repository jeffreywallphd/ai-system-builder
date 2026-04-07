import {
  WorkflowDraftUserTriggerScopes,
  validateWorkflowDraftTriggers,
  type WorkflowDraftTrigger,
  type WorkflowDraftTriggerKind,
  type WorkflowDraftTriggerType,
  type WorkflowValidationIssue,
} from "../../domain/workflow-studio/WorkflowStudioDomain";

export interface WorkflowTriggerValidationPipelineInput {
  readonly triggers: ReadonlyArray<unknown>;
  readonly stepIds?: ReadonlyArray<string>;
  readonly requireAtLeastOneTrigger?: boolean;
}

export interface WorkflowTriggerValidationPipelineResult {
  readonly valid: boolean;
  readonly issues: ReadonlyArray<WorkflowValidationIssue>;
  readonly normalizedTriggers: ReadonlyArray<WorkflowDraftTrigger>;
}

export interface WorkflowSingleTriggerValidationInput {
  readonly trigger: unknown;
  readonly stepIds?: ReadonlyArray<string>;
}

export interface WorkflowTriggerConfigValidationInput {
  readonly id: string;
  readonly kind: WorkflowDraftTriggerKind;
  readonly type: WorkflowDraftTriggerType;
  readonly config: unknown;
  readonly title?: string;
  readonly description?: string;
}

function toStepIdSet(stepIds: ReadonlyArray<string> | undefined): ReadonlySet<string> | undefined {
  if (!stepIds || stepIds.length === 0) {
    return undefined;
  }
  return new Set(stepIds);
}

export function validateWorkflowTriggerDefinitions(
  input: WorkflowTriggerValidationPipelineInput,
): WorkflowTriggerValidationPipelineResult {
  const result = validateWorkflowDraftTriggers(input.triggers, {
    stepIds: toStepIdSet(input.stepIds),
    requireAtLeastOneTrigger: input.requireAtLeastOneTrigger,
    // Keep continuation semantics allowed so future human-approval resume triggers are not blocked.
    allowedUserTriggerScopes: Object.freeze([
      WorkflowDraftUserTriggerScopes.workflowStart,
      WorkflowDraftUserTriggerScopes.workflowContinuation,
    ]),
  });

  return Object.freeze({
    valid: result.valid,
    issues: result.issues,
    normalizedTriggers: result.normalizedTriggers,
  });
}

export function validateSingleWorkflowTriggerDefinition(
  input: WorkflowSingleTriggerValidationInput,
): WorkflowTriggerValidationPipelineResult {
  return validateWorkflowTriggerDefinitions({
    triggers: [input.trigger],
    stepIds: input.stepIds,
  });
}

export function validateWorkflowTriggerTypeConfig(
  input: WorkflowTriggerConfigValidationInput,
): WorkflowTriggerValidationPipelineResult {
  const trigger = Object.freeze({
    id: input.id,
    kind: input.kind,
    type: input.type,
    title: input.title,
    description: input.description,
    config: input.config,
  });
  return validateSingleWorkflowTriggerDefinition({
    trigger,
  });
}
