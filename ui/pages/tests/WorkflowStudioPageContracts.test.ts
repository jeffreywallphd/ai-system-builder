import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("WorkflowStudioPage contracts", () => {
  it("binds Workflow Studio route surface to the shared Studio Shell page with composite registration", () => {
    const pageSource = readSource("ui/pages/WorkflowStudioPage.tsx");
    const registrationSource = readSource("ui/studio-shell/registrations/WorkflowStudioRegistration.ts");
    const shellSource = readSource("ui/pages/StudioShellPage.tsx");

    expect(pageSource).toContain("StudioShellPage");
    expect(pageSource).toContain("workflowStudioRegistration");
    expect(pageSource).toContain("studioRegistration={workflowStudioRegistration}");

    expect(registrationSource).toContain("studioType: WorkflowStudioIdentity.studioType");
    expect(registrationSource).toContain('kind: "composite"');
    expect(registrationSource).toContain('role: "workflow"');
    expect(registrationSource).toContain("workflow-studio-mode-abstraction");
    expect(registrationSource).toContain('slot: "draft-authoring"');
    expect(registrationSource).toContain('slot: "metadata"');
    expect(registrationSource).toContain('createWorkflowStudioTaxonomy("deterministic")');

    expect(shellSource).toContain("isWorkflowWizardMode");
    expect(shellSource).toContain('workflowModeState?.selectedModeId === "wizard"');
    expect(shellSource).toContain("workflow-studio-canvas-mode-surface");
    expect(shellSource).toContain("workflow-studio-wizard-mode-surface");
    expect(shellSource).toContain("Canvas mode (current Workflow Studio draft authoring)");
    expect(shellSource).toContain("Wizard mode shell");
  });
});
