import { describe, expect, it } from "bun:test";
import { createEmptyWorkflowDraft } from "../../../../src/domain/workflow-studio/WorkflowStudioDomain";
import {
  deriveWorkflowWizardProgress,
  WorkflowWizardInputReadinessPolicies,
  WorkflowWizardSectionIds,
} from "../WorkflowStudioWizardProgress";

describe("WorkflowStudioWizardProgress", () => {
  it("derives guided section readiness from one canonical workflow draft and validation issues", () => {
    const draft = Object.freeze({
      ...createEmptyWorkflowDraft(),
      triggers: Object.freeze([
        Object.freeze({
          id: "trigger-1",
          kind: "user" as const,
          type: "manual" as const,
          config: Object.freeze({}),
        }),
      ]),
      inputs: Object.freeze([
        Object.freeze({
          id: "input-1",
          type: "dataset-input",
          title: "Dataset",
          sourceType: "dataset-asset" as const,
          asset: Object.freeze({
            assetId: "asset:dataset-a",
          }),
        }),
      ]),
      steps: Object.freeze([
        Object.freeze({
          id: "step-1",
          type: "agent-assistant",
          kind: "asset-backed" as const,
          order: 1,
        }),
      ]),
      outputs: Object.freeze([]),
    });

    const progress = deriveWorkflowWizardProgress(draft, Object.freeze([
      Object.freeze({
        code: "output-viewer-title-missing",
        section: "outputs" as const,
        severity: "error" as const,
        message: "Output issue",
        path: "draft.outputs[0].title",
      }),
    ]));

    expect(progress.readySectionCount).toBe(3);
    expect(progress.completedSectionCount).toBe(3);
    expect(progress.currentSectionId).toBe(WorkflowWizardSectionIds.outputs);
    expect(progress.firstIncompleteSectionId).toBe(WorkflowWizardSectionIds.outputs);
    expect(progress.previousSectionId).toBe(WorkflowWizardSectionIds.steps);
    expect(progress.nextSectionId).toBeUndefined();
    expect(progress.isWorkflowReady).toBe(false);
    expect(progress.validationIssueCount).toBe(1);
    expect(progress.blockingIssueCount).toBe(2);
    expect(progress.blockingIssues.some((issue) => (
      issue.sectionId === WorkflowWizardSectionIds.outputs && issue.source === "readiness-rule"
    ))).toBe(true);
    expect(progress.blockingIssues.some((issue) => (
      issue.sectionId === WorkflowWizardSectionIds.outputs && issue.source === "validation"
    ))).toBe(true);
  });

  it("marks workflow ready once all sections are complete and issue-free", () => {
    const draft = Object.freeze({
      ...createEmptyWorkflowDraft(),
      triggers: Object.freeze([
        Object.freeze({
          id: "trigger-1",
          kind: "user" as const,
          type: "manual" as const,
          config: Object.freeze({}),
        }),
      ]),
      inputs: Object.freeze([
        Object.freeze({
          id: "input-1",
          type: "dataset-input",
          title: "Dataset",
          sourceType: "dataset-asset" as const,
          asset: Object.freeze({
            assetId: "asset:dataset-a",
          }),
        }),
      ]),
      steps: Object.freeze([
        Object.freeze({
          id: "step-1",
          type: "agent-assistant",
          kind: "asset-backed" as const,
          order: 1,
        }),
      ]),
      outputs: Object.freeze([
        Object.freeze({
          id: "output-1",
          type: "result",
          outputType: "document",
          format: "json",
          destination: Object.freeze({
            type: "web-viewer",
            target: "preview",
          }),
          title: "Viewer",
        }),
      ]),
    });

    const progress = deriveWorkflowWizardProgress(draft, []);
    expect(progress.isWorkflowReady).toBe(true);
    expect(progress.currentSectionId).toBe(WorkflowWizardSectionIds.outputs);
    expect(progress.firstIncompleteSectionId).toBeUndefined();
    expect(progress.readySectionCount).toBe(4);
    expect(progress.completedSectionCount).toBe(4);
    expect(progress.blockingIssueCount).toBe(0);
    expect(progress.blockingIssues).toHaveLength(0);
    expect(progress.sections.every((section) => section.requiredItemCount === 1)).toBe(true);
  });

  it("supports explicit optional-input policy while keeping other sections required", () => {
    const draft = Object.freeze({
      ...createEmptyWorkflowDraft(),
      triggers: Object.freeze([
        Object.freeze({
          id: "trigger-1",
          kind: "user" as const,
          type: "manual" as const,
          config: Object.freeze({}),
        }),
      ]),
      inputs: Object.freeze([]),
      steps: Object.freeze([
        Object.freeze({
          id: "step-1",
          type: "agent-assistant",
          kind: "asset-backed" as const,
          order: 1,
        }),
      ]),
      outputs: Object.freeze([
        Object.freeze({
          id: "output-1",
          type: "result",
          outputType: "document",
          format: "json",
          destination: Object.freeze({
            type: "web-viewer",
            target: "preview",
          }),
          title: "Viewer",
        }),
      ]),
    });

    const progress = deriveWorkflowWizardProgress(draft, [], {
      inputs: WorkflowWizardInputReadinessPolicies.optional,
    });

    const inputSection = progress.sections.find((section) => section.id === WorkflowWizardSectionIds.inputs);
    expect(inputSection?.requiredItemCount).toBe(0);
    expect(inputSection?.isReady).toBe(true);
    expect(progress.isWorkflowReady).toBe(true);
  });

  it("derives readiness without mutating canonical workflow draft", () => {
    const draft = Object.freeze({
      ...createEmptyWorkflowDraft(),
      triggers: Object.freeze([]),
      inputs: Object.freeze([]),
      steps: Object.freeze([]),
      outputs: Object.freeze([]),
    });
    const initialSerialized = JSON.stringify(draft);

    const progress = deriveWorkflowWizardProgress(draft, []);

    expect(JSON.stringify(draft)).toBe(initialSerialized);
    expect(progress.isWorkflowReady).toBe(false);
    expect(progress.blockingIssueCount).toBe(4);
  });
});
