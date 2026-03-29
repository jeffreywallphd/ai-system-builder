import { describe, expect, it } from "bun:test";
import { createEmptyWorkflowDraft } from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import {
  deriveWorkflowWizardProgress,
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
  });
});
