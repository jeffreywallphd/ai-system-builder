import { describe, expect, it } from "bun:test";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { createEmptyWorkflowDraft } from "../../../../../domain/workflow-studio/WorkflowStudioDomain";
import { readSource } from "../../../../tests/testUtils";
import WorkflowStudioStepSectionEditor from "../WorkflowStudioStepSectionEditor";

describe("WorkflowStudioStepSectionEditor", () => {
  it("renders agent/assistant step authoring affordances in wizard mode", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/studio-shell/workflow/wizard/steps"]}>
        <WorkflowStudioStepSectionEditor
          sharedDraft={createEmptyWorkflowDraft()}
          draftValidationIssues={[]}
        />
      </MemoryRouter>,
    );

    expect(html).toContain("Steps Section");
    expect(html).toContain("Add step");
    expect(html).toContain("Agent/assistant action");
  });

  it("threads canonical selector target metadata through launch and return handling", () => {
    const source = readSource("ui/components/studio-shell/workflow/WorkflowStudioStepSectionEditor.tsx");

    expect(source).toContain("const stepSelectorOriginatingField = \"steps.agent-assistant\";");
    expect(source).toContain("const stepSelectorUsageContext = \"workflow-step\";");
    expect(source).toContain("selectorTargetId: buildStepSelectorTargetId(operation)");
    expect(source).toContain("expectedOriginatingField: stepSelectorOriginatingField");
    expect(source).toContain("expectedUsageContext: stepSelectorUsageContext");
    expect(source).toContain("expectedSelectorTargetId: expectedOperation ? buildStepSelectorTargetId(expectedOperation) : undefined");
    expect(source).toContain("launchHandoffId: launch.studioHandoff?.launch.handoffId");
  });
});

