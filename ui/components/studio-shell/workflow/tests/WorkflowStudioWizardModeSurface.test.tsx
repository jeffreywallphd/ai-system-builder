import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createEmptyWorkflowDraft,
  serializeWorkflowDraft,
} from "../../../../../domain/workflow-studio/WorkflowStudioDomain";
import WorkflowStudioWizardModeSurface from "../WorkflowStudioWizardModeSurface";

describe("WorkflowStudioWizardModeSurface", () => {
  it("renders blocking readiness summary and enabled handoff action for invalid drafts", () => {
    const draft = createEmptyWorkflowDraft();

    const html = renderToStaticMarkup(
      <WorkflowStudioWizardModeSurface
        sharedDraft={draft}
        sharedDraftSerialized={serializeWorkflowDraft(draft)}
        draftValidationIssues={[]}
        selectedWizardPageId="trigger"
      />,
    );

    expect(html).toContain('data-testid="workflow-wizard-readiness-summary"');
    expect(html).toContain('data-testid="workflow-wizard-pages-card"');
    expect(html).toContain("Workflow draft is not ready yet.");
    expect(html).toContain("Trigger needs at least 1 item.");
    expect(html).not.toContain("Trigger: Needs input");
    expect(html).not.toContain("Prepare for Run");
  });

  it("renders ready summary for valid drafts", () => {
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

    const html = renderToStaticMarkup(
      <WorkflowStudioWizardModeSurface
        sharedDraft={draft}
        sharedDraftSerialized={serializeWorkflowDraft(draft)}
        draftValidationIssues={[]}
        selectedWizardPageId="outputs"
      />,
    );

    expect(html).toContain("Workflow draft is ready for handoff.");
    expect(html).toContain("No blocking issues detected.");
    expect(html).toContain("Ready for next-stage handoff.");
    expect(html).toContain("Prepare for Run");
  });
});
