import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("AgentStudioPage contracts", () => {
  it("builds the shell from panel components and service contracts", () => {
    const source = readSource("ui/pages/AgentStudioPage.tsx");

    expect(source).toContain("AgentStudioService");
    expect(source).toContain("AgentListPanel");
    expect(source).toContain("AgentDetailPanel");
    expect(source).toContain("AgentLaunchPanel");
    expect(source).toContain("SessionListPanel");
    expect(source).toContain("SessionDetailPanel");
    expect(source).toContain("useUiDependencies");
    expect(source).toContain("canonicalAssetManagementService");
    expect(source).toContain("service.listAgents");
    expect(source).toContain("service.getStudioSnapshot");
    expect(source).toContain("service.createAgent");
    expect(source).toContain("service.launchAgent");
    expect(source).toContain("service.triggerLaunch");
    expect(source).toContain("service.getSessionDetail");
    expect(source).toContain("service.controlRun");
    expect(source).toContain("nextSnapshot.latestSession");
    expect(source).toContain("setLatestLaunch(undefined)");
    expect(source).toContain("setValidationIssues([])");
  });

  it("wires authoring sections to backend configuration use cases", () => {
    const detail = readSource("ui/components/agents/AgentDetailPanel.tsx");
    const page = readSource("ui/pages/AgentStudioPage.tsx");

    expect(detail).toContain("Goals");
    expect(detail).toContain("Policy");
    expect(detail).toContain("Tools");
    expect(detail).toContain("Memory");
    expect(detail).toContain("Strategy");
    expect(detail).toContain("Scope constraints");
    expect(detail).toContain("Retention mode");
    expect(page).toContain("service.configureGoals");
    expect(page).toContain("service.configurePolicy");
    expect(page).toContain("service.configureTools");
    expect(page).toContain("service.configureMemory");
    expect(page).toContain("service.configureStrategy");
    expect(page).toContain("validationIssues");
  });

  it("renders launch, control, and trigger sections as backend contract consumers", () => {
    const launch = readSource("ui/components/agents/AgentLaunchPanel.tsx");
    const sessionList = readSource("ui/components/agents/SessionListPanel.tsx");
    const sessionDetail = readSource("ui/components/agents/SessionDetailPanel.tsx");
    const controls = readSource("ui/components/agents/AgentRunControls.tsx");
    const detail = readSource("ui/components/agents/AgentDetailPanel.tsx");

    expect(launch).toContain("TriggerSelector");
    expect(launch).toContain("TriggerConfigFields");
    expect(launch).toContain("onTriggerLaunch");
    expect(launch).toContain("Backend trigger requires trigger.source");
    expect(sessionList).toContain("AgentRunControls");
    expect(sessionDetail).toContain("AgentRunControls");
    expect(controls).toContain("controls.includes(\"cancel\")");
    expect(controls).not.toContain("pause");
    expect(sessionList).toContain("session.composition.taxonomy.structuralKind");
    expect(sessionDetail).toContain("SessionOperationalSummary");
    expect(sessionDetail).toContain("SessionDiagnosticAssetsPanel");
    expect(sessionDetail).toContain("SessionTransitionHistoryPanel");
    expect(sessionDetail).toContain("SessionStepOutcomePanel");
    expect(sessionDetail).toContain("SessionDiagnosticAssetsPanel");
    expect(sessionDetail).toContain("CompositionSummaryCard");
    expect(detail).toContain("CompositionSummaryCard");
  });
});
