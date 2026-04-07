import { describe, expect, it } from "bun:test";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { createEmptyWorkflowDraft, deserializeWorkflowDraft } from "@domain/workflow-studio/WorkflowStudioDomain";
import { readSource } from "../../../../tests/testUtils";
import WorkflowStudioInputSectionEditor from "../WorkflowStudioInputSectionEditor";

describe("WorkflowStudioInputSectionEditor", () => {
  it("renders dataset selector affordances including launch-to-create path", () => {
    const draft = deserializeWorkflowDraft("{\"schemaVersion\":\"1.0.0\",\"triggers\":[],\"inputs\":[{\"id\":\"sourceImage\",\"type\":\"runtime-input\",\"sourceType\":\"runtime-parameter\",\"required\":true,\"valueType\":\"object\",\"parameterKey\":\"sourceImage\"}],\"steps\":[],\"outputs\":[]}");
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/studio-shell/workflow/wizard/inputs"]}>
        <WorkflowStudioInputSectionEditor
          sharedDraft={draft}
          draftValidationIssues={[]}
        />
      </MemoryRouter>,
    );

    expect(html).toContain("Dataset inputs");
    expect(html).toContain("Add or modify datasets");
    expect(html).toContain("Create dataset in Dataset Studio");
    expect(html).toContain("Input binding authoring");
    expect(html).toContain("Source type");
    expect(html).toContain("Source reference");
    expect(html).toContain('data-testid="workflow-input-launch-dataset-studio"');
    expect(html).toContain('data-testid="workflow-input-binding-authoring"');
  });

  it("threads canonical selector target metadata through launch and return handling", () => {
    const source = readSource("ui/components/studio-shell/workflow/WorkflowStudioInputSectionEditor.tsx");

    expect(source).toContain("selectorTargetId: datasetSelectorTargetId");
    expect(source).toContain("expectedSelectorTargetId: datasetSelectorTargetId");
    expect(source).toContain('expectedOriginatingField: datasetSelectorOriginatingField');
    expect(source).toContain('expectedUsageContext: "workflow-input"');
    expect(source).toContain("launchHandoffId: launch.studioHandoff?.launch.handoffId");
    expect(source).toContain("WorkflowStudioHandoffStatusKinds.launching");
    expect(source).toContain("WorkflowStudioHandoffStatusKinds.pending");
    expect(source).toContain("WorkflowStudioHandoffStatusKinds.completed");
    expect(source).toContain("WorkflowStudioHandoffStatusKinds.cancelled");
    expect(source).toContain("WorkflowStudioHandoffStatusKinds.recovered");
  });
});

