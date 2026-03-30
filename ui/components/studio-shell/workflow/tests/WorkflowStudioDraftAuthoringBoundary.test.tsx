import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createEmptyWorkflowDraft, serializeWorkflowDraft } from "../../../../../domain/workflow-studio/WorkflowStudioDomain";
import WorkflowStudioDraftAuthoringBoundary from "../WorkflowStudioDraftAuthoringBoundary";

describe("WorkflowStudioDraftAuthoringBoundary", () => {
  it("isolates wizard rendering behind the wizard mode surface", () => {
    const draft = createEmptyWorkflowDraft();
    const html = renderToStaticMarkup(
      <WorkflowStudioDraftAuthoringBoundary
        isWorkflowStudio
        content={serializeWorkflowDraft(draft)}
        onChangeContent={() => undefined}
        workflowModeContext={{
          selectedModeId: "wizard",
          selectedWizardPageId: "trigger",
          sharedDraft: draft,
          sharedDraftSerialized: serializeWorkflowDraft(draft),
          draftEditorContent: serializeWorkflowDraft(draft),
          modeValidationIssues: [],
          draftValidationIssues: [],
        }}
      />,
    );

    expect(html).toContain('data-testid="workflow-studio-wizard-mode-layout"');
    expect(html).toContain('data-testid="workflow-studio-wizard-mode-surface"');
    expect(html).toContain('data-testid="workflow-wizard-pages-card"');
    expect(html).toContain("Trigger Section");
    expect(html).not.toContain("Inputs Section");
    expect(html).not.toContain("Steps Section");
    expect(html).not.toContain("Outputs Section");
    expect(html).toContain("Back");
    expect(html).toContain("Next");
    expect(html).toContain("Workflow readiness summary");
    expect(html).not.toContain("Trigger: Needs input");
    expect(html).not.toContain("Prepare for run handoff");
    expect(html).not.toContain("Prepare for Run");
    expect(html).not.toContain('data-testid="workflow-studio-canvas-mode-layout"');
    expect(html).not.toContain('data-testid="workflow-studio-canvas-mode-surface"');
  });

  it("isolates canvas rendering behind the canvas mode surface", () => {
    const draft = createEmptyWorkflowDraft();
    const html = renderToStaticMarkup(
      <WorkflowStudioDraftAuthoringBoundary
        isWorkflowStudio
        content={serializeWorkflowDraft(draft)}
        onChangeContent={() => undefined}
        workflowModeContext={{
          selectedModeId: "canvas",
          selectedWizardPageId: "trigger",
          sharedDraft: draft,
          sharedDraftSerialized: serializeWorkflowDraft(draft),
          draftEditorContent: serializeWorkflowDraft(draft),
          modeValidationIssues: [],
          draftValidationIssues: [],
        }}
      />,
    );

    expect(html).toContain('data-testid="workflow-studio-canvas-mode-layout"');
    expect(html).toContain('data-testid="workflow-studio-canvas-mode-surface"');
    expect(html).toContain('data-testid="workflow-studio-canvas-reactflow"');
    expect(html).toContain('data-testid="workflow-studio-canvas-graph-details"');
    expect(html).not.toContain("Canvas layout container");
    expect(html).not.toContain('data-testid="workflow-studio-wizard-mode-layout"');
    expect(html).not.toContain('data-testid="workflow-studio-wizard-mode-surface"');
  });

  it("shows a safe fallback message for unsupported direct mode routes", () => {
    const draft = createEmptyWorkflowDraft();
    const html = renderToStaticMarkup(
      <WorkflowStudioDraftAuthoringBoundary
        isWorkflowStudio
        content={serializeWorkflowDraft(draft)}
        onChangeContent={() => undefined}
        invalidModeRouteId="unsupported-mode"
        workflowModeContext={{
          selectedModeId: "canvas",
          selectedWizardPageId: "trigger",
          sharedDraft: draft,
          sharedDraftSerialized: serializeWorkflowDraft(draft),
          draftEditorContent: serializeWorkflowDraft(draft),
          modeValidationIssues: [],
          draftValidationIssues: [],
        }}
      />,
    );

    expect(html).toContain("Unsupported workflow mode route");
    expect(html).toContain("unsupported-mode");
    expect(html).toContain("using canvas mode");
    expect(html.match(/Unsupported workflow mode route/g)?.length).toBe(1);
  });

  it("surfaces shared validation hook feedback without throwing", () => {
    const draft = createEmptyWorkflowDraft();
    const html = renderToStaticMarkup(
      <WorkflowStudioDraftAuthoringBoundary
        isWorkflowStudio
        content={serializeWorkflowDraft(draft)}
        onChangeContent={() => undefined}
        workflowModeContext={{
          selectedModeId: "canvas",
          selectedWizardPageId: "trigger",
          sharedDraft: draft,
          sharedDraftSerialized: serializeWorkflowDraft(draft),
          draftEditorContent: serializeWorkflowDraft(draft),
          modeValidationIssues: [{
            code: "draft-validation-error",
            severity: "error",
            message: "invalid draft",
          }],
          draftValidationIssues: [{
            code: "step-order-non-contiguous",
            section: "steps",
            severity: "error",
            message: "step order mismatch",
          }],
        }}
      />,
    );

    expect(html).toContain("Workflow mode validation: 1 issue(s) detected.");
    expect(html).toContain("Shared workflow draft validation: 1 canonical issue(s) detected.");
  });
});
