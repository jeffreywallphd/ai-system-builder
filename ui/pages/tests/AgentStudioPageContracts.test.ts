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
    expect(source).toContain("service.listAgents");
    expect(source).toContain("service.getStudioSnapshot");
    expect(source).toContain("service.createAgent");
    expect(source).toContain("service.launchAgent");
    expect(source).toContain("service.listSessions");
    expect(source).toContain("service.getSessionDetail");
    expect(source).toContain("service.controlRun");
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

  it("renders launch and monitoring sections as backend read-model consumers", () => {
    const launch = readSource("ui/components/agents/AgentLaunchPanel.tsx");
    const sessionList = readSource("ui/components/agents/SessionListPanel.tsx");
    const sessionDetail = readSource("ui/components/agents/SessionDetailPanel.tsx");

    expect(launch).toContain("Run input");
    expect(launch).toContain("Context overrides");
    expect(launch).toContain("Metadata");
    expect(launch).toContain("trigger");
    expect(launch).toContain("capabilities.controls.includes(\"cancel\")");
    expect(sessionList).toContain("session.composition.taxonomy.semanticRole");
    expect(sessionDetail).toContain("operational.retrySummary");
    expect(sessionDetail).toContain("outcomeSummary.outputAssetIds");
    expect(sessionDetail).toContain("Transition history");
  });
});
