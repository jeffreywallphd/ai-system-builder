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
          sharedDraft: draft,
          sharedDraftSerialized: serializeWorkflowDraft(draft),
          draftEditorContent: serializeWorkflowDraft(draft),
          updateSharedDraft: () => undefined,
        }}
      />,
    );

    expect(html).toContain('data-testid="workflow-studio-wizard-mode-surface"');
    expect(html).toContain("Wizard mode shell");
    expect(html).toContain("Add trigger");
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
          sharedDraft: draft,
          sharedDraftSerialized: serializeWorkflowDraft(draft),
          draftEditorContent: serializeWorkflowDraft(draft),
          updateSharedDraft: () => undefined,
        }}
      />,
    );

    expect(html).toContain('data-testid="workflow-studio-canvas-mode-surface"');
    expect(html).toContain("Canvas mode (current Workflow Studio draft authoring)");
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
          sharedDraft: draft,
          sharedDraftSerialized: serializeWorkflowDraft(draft),
          draftEditorContent: serializeWorkflowDraft(draft),
          updateSharedDraft: () => undefined,
        }}
      />,
    );

    expect(html).toContain("Unsupported workflow mode route");
    expect(html).toContain("unsupported-mode");
    expect(html).toContain("using canvas mode");
  });
});
