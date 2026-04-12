import {
  validateWorkflowDraft,
  type WorkflowDraft,
  type WorkflowValidationIssue,
} from "@domain/workflow-studio/WorkflowStudioDomain";
import type { WorkflowStudioModeId } from "./WorkflowStudioModes";

export const WorkflowStudioModeValidationIssueCodes = Object.freeze({
  modeNotRegistered: "mode-not-registered",
  modeDefinitionMismatch: "mode-definition-mismatch",
  draftParseError: "draft-parse-error",
  draftValidationError: "draft-validation-error",
});

export type WorkflowStudioModeValidationIssueCode = typeof WorkflowStudioModeValidationIssueCodes[
  keyof typeof WorkflowStudioModeValidationIssueCodes
];

export interface WorkflowStudioModeValidationIssue {
  readonly code: WorkflowStudioModeValidationIssueCode;
  readonly severity: "error" | "warning";
  readonly message: string;
}

export interface WorkflowStudioModeValidationState {
  readonly issues: ReadonlyArray<WorkflowStudioModeValidationIssue>;
  readonly hasErrors: boolean;
  readonly draftIssues: ReadonlyArray<WorkflowValidationIssue>;
  readonly draftIsValid: boolean;
}

export interface WorkflowStudioModeValidationInput {
  readonly selectedModeId: WorkflowStudioModeId;
  readonly selectedModeDefinitionId: WorkflowStudioModeId;
  readonly availableModeIds: ReadonlyArray<WorkflowStudioModeId>;
  readonly sharedDraft: WorkflowDraft;
  readonly draftParseError?: string;
}

function freezeIssues(
  issues: ReadonlyArray<WorkflowStudioModeValidationIssue>,
): ReadonlyArray<WorkflowStudioModeValidationIssue> {
  return Object.freeze([...issues]);
}

export function validateWorkflowStudioModeState(
  input: WorkflowStudioModeValidationInput,
): WorkflowStudioModeValidationState {
  const issues: WorkflowStudioModeValidationIssue[] = [];

  if (!input.availableModeIds.includes(input.selectedModeId)) {
    issues.push({
      code: WorkflowStudioModeValidationIssueCodes.modeNotRegistered,
      severity: "error",
      message: `Selected workflow mode '${input.selectedModeId}' is not registered.`,
    });
  }

  if (input.selectedModeDefinitionId !== input.selectedModeId) {
    issues.push({
      code: WorkflowStudioModeValidationIssueCodes.modeDefinitionMismatch,
      severity: "error",
      message: "Selected workflow mode and selected mode definition are out of sync.",
    });
  }

  if (input.draftParseError) {
    issues.push({
      code: WorkflowStudioModeValidationIssueCodes.draftParseError,
      severity: "error",
      message: "Workflow draft editor content is not valid canonical workflow JSON.",
    });
  }

  const draftValidation = validateWorkflowDraft(input.sharedDraft);
  if (!draftValidation.valid) {
    issues.push({
      code: WorkflowStudioModeValidationIssueCodes.draftValidationError,
      severity: "error",
      message: `Workflow draft validation reported ${draftValidation.issues.length} issue(s).`,
    });
  }

  return Object.freeze({
    issues: freezeIssues(issues),
    hasErrors: issues.some((issue) => issue.severity === "error"),
    draftIssues: Object.freeze([...draftValidation.issues]),
    draftIsValid: draftValidation.valid,
  });
}

