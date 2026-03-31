import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("WorkflowStudioPage contracts", () => {
  it("binds Workflow Studio route surface to the shared Studio Shell page with composite registration", () => {
    const pageSource = readSource("ui/pages/WorkflowStudioPage.tsx");
    const registrationSource = readSource("ui/studio-shell/registrations/WorkflowStudioRegistration.ts");
    const shellSource = readSource("ui/pages/StudioShellPage.tsx");

    expect(pageSource).toContain("StudioShellPage");
    expect(pageSource).toContain("workflowStudioRegistration");
    expect(pageSource).toContain("resolveWorkflowStudioModeRoute");
    expect(pageSource).toContain("resolveWorkflowStudioWizardPageRoute");
    expect(pageSource).toContain("resolveWorkflowStudioEntryRoute");
    expect(pageSource).toContain("useParams");
    expect(pageSource).toContain("useLocation");
    expect(pageSource).toContain("workflowModeRoute={workflowModeRoute}");
    expect(pageSource).toContain("workflowWizardPageRoute={workflowWizardPageRoute}");
    expect(pageSource).toContain("workflowEntryRoute={workflowEntryRoute}");
    expect(pageSource).toContain("studioRegistration={workflowStudioRegistration}");

    expect(registrationSource).toContain("studioType: WorkflowStudioIdentity.studioType");
    expect(registrationSource).toContain('kind: "composite"');
    expect(registrationSource).toContain('role: "workflow"');
    expect(registrationSource).toContain("workflow-studio-mode-abstraction");
    expect(registrationSource).toContain('slot: "draft-authoring"');
    expect(registrationSource).toContain('slot: "metadata"');
    expect(registrationSource).toContain('createWorkflowStudioTaxonomy("deterministic")');
    expect(registrationSource).toContain("drawers: Object.freeze(");
    expect(registrationSource).toContain('label: "Nodes"');
    expect(registrationSource).toContain('label: "Inspector"');
    expect(registrationSource).toContain('kind: "run-workflow-draft"');

    expect(shellSource).toContain("WorkflowStudioDraftAuthoringBoundary");
    expect(shellSource).toContain("workflowModeRoute");
    expect(shellSource).toContain("workflowWizardPageRoute");
    expect(shellSource).toContain("resolvedWorkflowModeId");
    expect(shellSource).toContain("resolvedWorkflowWizardPageId");
    expect(shellSource).toContain("workflowModeStore.setSelectedMode(resolvedWorkflowModeId)");
    expect(shellSource).toContain("getWorkflowStudioModeStateStore(studioId)");
    expect(shellSource).toContain("synchronizeSharedDraftFromSnapshot");
    expect(shellSource).toContain("WorkflowStudioReturnRestorationService");
    expect(shellSource).toContain("restoreFromReturnSearch");
    expect(shellSource).toContain("workflowEntryRoute");
    expect(shellSource).toContain("service.getPersistedWorkflow");
    expect(shellSource).toContain("WorkflowStudioEntryPaths");
    expect(shellSource).toContain("setHandoffStatus");
    expect(shellSource).toContain("clearHandoffStatus");
    expect(shellSource).toContain('data-testid="studio-shell-left-drawer-toggle"');
    expect(shellSource).toContain('data-testid="studio-shell-right-drawer-toggle"');
  });
});
