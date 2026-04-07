import { describe, expect, it } from "bun:test";
import {
  createEmptyWorkflowDraft,
  deserializeWorkflowDraft,
  serializeWorkflowDraft,
  WorkflowValidationIssueCodes,
} from "../../../../src/domain/workflow-studio/WorkflowStudioDomain";
import { validateWorkflowStudioModeState } from "../WorkflowStudioModeValidation";

describe("WorkflowStudioModeValidation", () => {
  it("detects malformed mode state and canonical draft validation issues", () => {
    const invalidDraft = deserializeWorkflowDraft(serializeWorkflowDraft({
      ...createEmptyWorkflowDraft(),
      steps: [
        {
          id: "step-3",
          type: "action",
          kind: "action",
          order: 3,
          title: "Invalid order",
        },
      ],
    }));

    const result = validateWorkflowStudioModeState({
      selectedModeId: "wizard",
      selectedModeDefinitionId: "canvas",
      availableModeIds: ["canvas"] as const,
      sharedDraft: invalidDraft,
      draftParseError: "Malformed JSON",
    });

    expect(result.hasErrors).toBe(true);
    expect(result.issues.some((issue) => issue.code === "mode-not-registered")).toBe(true);
    expect(result.issues.some((issue) => issue.code === "mode-definition-mismatch")).toBe(true);
    expect(result.issues.some((issue) => issue.code === "draft-parse-error")).toBe(true);
    expect(result.issues.some((issue) => issue.code === "draft-validation-error")).toBe(true);
    expect(result.draftIssues).toContainEqual(expect.objectContaining({
      code: WorkflowValidationIssueCodes.stepOrderNonContiguous,
    }));
  });
});
